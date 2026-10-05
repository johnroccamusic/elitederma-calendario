<?php
/**
 * Plugin Name: Elitederma — Pulizia degli account creati dai bot
 * Description: Rotta protetta che elenca e cancella gli account con email "a codice", senza ordini.
 * Version: 1.0
 */

// A COSA SERVE. Dal modulo di registrazione di WooCommerce sono entrati
// centinaia di account con indirizzi come 0152beb28d7c4ee2@gmail.com.
// Cancellarli a mano, a gruppi di venti per pagina, e' mezza giornata.
//
// LA REGOLA, e non si tocca: si cancella SOLO chi ha tutte queste cose
// insieme.
//   - l'indirizzo e' "a codice" (vedi sotto);
//   - non ha mai fatto un ordine su WooCommerce;
//   - non ha scritto articoli ne' commenti;
//   - non ha nome ne' cognome in anagrafica;
//   - il suo ruolo e' solo "customer" o "subscriber" — mai un
//     amministratore, un gestore negozio o chiunque abbia altri poteri.
// Basta che una sola di queste manchi e l'account resta dov'e'. Una
// cliente vera cancellata per sbaglio non si recupera con un tasto.
//
// SI GUARDA PRIMA. La rotta nasce in prova: dice quanti e quali, e non
// tocca niente. Si cancella solo chiedendolo esplicitamente.
//
// Installazione: Code Snippets → Aggiungi nuovo → incollare tutto il file
// (senza la riga "<?php") → "Esegui ovunque" → Salva e attiva.
// La chiave e' ELITEDERMA_BRIDGE_SECRET, la stessa del ponte del menu.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Le guardie function_exists ci sono per Code Snippets, non per PHP:
// quando salva o accende uno snippet lo esegue DUE volte nella stessa
// richiesta, e alla seconda le funzioni risultano gia' dichiarate.
if ( ! function_exists( 'elitederma_utenti_bot_email_a_codice' ) ) :
/**
 * L'indirizzo sembra generato a macchina? Torna il motivo, o '' se e'
 * normale. Due reti:
 *   1. solo cifre e lettere dalla a alla f, dodici caratteri o piu': la
 *      firma di un codice esadecimale, ed e' quella di tutti i casi visti;
 *   2. sequenza lunga senza separatori che mescola lettere e cifre e non
 *      ha quasi vocali: mario.rossi, m.rossi88 e chiara1990 hanno
 *      separatori o vocali, un codice no.
 * Provata sui 172 indirizzi veri dell'archivio: nessuno viene preso.
 */
function elitederma_utenti_bot_email_a_codice( $email ) {
	$email = strtolower( trim( (string) $email ) );
	$chiocciola = strpos( $email, '@' );
	if ( false === $chiocciola ) {
		return '';
	}
	$nome = substr( $email, 0, $chiocciola );
	if ( preg_match( '/^[0-9a-f]{12,}$/', $nome ) ) {
		return 'esadecimale';
	}
	if ( strlen( $nome ) >= 14
		&& preg_match( '/^[a-z0-9]+$/', $nome )
		&& preg_match( '/[0-9]/', $nome )
		&& preg_match( '/[a-z]/', $nome ) ) {
		$vocali  = preg_match_all( '/[aeiou]/', $nome );
		$lettere = preg_match_all( '/[a-z]/', $nome );
		if ( $lettere > 0 && ( $vocali / $lettere ) < 0.2 ) {
			return 'sequenza senza vocali';
		}
	}
	return '';
}
endif;

add_action( 'rest_api_init', function () {
	register_rest_route( 'elitederma/v1', '/utenti-bot', array(
		'methods'             => 'POST',
		'callback'            => 'elitederma_utenti_bot',
		'permission_callback' => 'elitederma_utenti_bot_autorizzato',
	) );
} );

if ( ! function_exists( 'elitederma_utenti_bot_autorizzato' ) ) :
function elitederma_utenti_bot_autorizzato( $richiesta ) {
	$chiave = $richiesta->get_header( 'x-elitederma-secret' );
	if ( ! $chiave || ! defined( 'ELITEDERMA_BRIDGE_SECRET' ) ) {
		return false;
	}
	return hash_equals( ELITEDERMA_BRIDGE_SECRET, $chiave );
}
endif;

if ( ! function_exists( 'elitederma_utenti_bot' ) ) :
// Corpo: { "cancella": false, "limite": 500 }
// cancella = false (predefinito): guarda e basta.
function elitederma_utenti_bot( $richiesta ) {
	$corpo    = $richiesta->get_json_params();
	$cancella = ! empty( $corpo['cancella'] );
	$limite   = isset( $corpo['limite'] ) ? max( 1, min( 2000, (int) $corpo['limite'] ) ) : 500;

	if ( $cancella ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
	}

	// solo i ruoli senza poteri: un amministratore non entra nemmeno
	// nell'elenco da guardare
	$utenti = get_users( array(
		'role__in' => array( 'customer', 'subscriber' ),
		'number'   => $limite,
		'orderby'  => 'registered',
		'order'    => 'ASC',
		'fields'   => array( 'ID', 'user_email', 'user_login', 'user_registered' ),
	) );

	$daCancellare = array();
	$salvati      = array();

	foreach ( $utenti as $u ) {
		$motivo = elitederma_utenti_bot_email_a_codice( $u->user_email );
		if ( '' === $motivo ) {
			continue;
		}
		// un ruolo in piu' oltre a customer/subscriber e' gia' un motivo
		// per non toccarlo
		$dati = get_userdata( $u->ID );
		$ruoli = (array) $dati->roles;
		$altriRuoli = array_diff( $ruoli, array( 'customer', 'subscriber' ) );
		if ( ! empty( $altriRuoli ) ) {
			$salvati[] = array( 'email' => $u->user_email, 'perche' => 'ha altri ruoli: ' . implode( ',', $altriRuoli ) );
			continue;
		}
		$ordini = function_exists( 'wc_get_customer_order_count' ) ? (int) wc_get_customer_order_count( $u->ID ) : 0;
		if ( $ordini > 0 ) {
			$salvati[] = array( 'email' => $u->user_email, 'perche' => "ha $ordini ordini" );
			continue;
		}
		if ( (int) count_user_posts( $u->ID ) > 0 ) {
			$salvati[] = array( 'email' => $u->user_email, 'perche' => 'ha scritto articoli' );
			continue;
		}
		$commenti = get_comments( array( 'user_id' => $u->ID, 'count' => true ) );
		if ( (int) $commenti > 0 ) {
			$salvati[] = array( 'email' => $u->user_email, 'perche' => 'ha scritto commenti' );
			continue;
		}
		$nome = trim( (string) get_user_meta( $u->ID, 'first_name', true ) . ' ' . (string) get_user_meta( $u->ID, 'last_name', true ) );
		if ( '' !== $nome ) {
			$salvati[] = array( 'email' => $u->user_email, 'perche' => 'ha un nome in anagrafica: ' . $nome );
			continue;
		}
		$daCancellare[] = array( 'id' => (int) $u->ID, 'email' => $u->user_email, 'registrato' => $u->user_registered, 'motivo' => $motivo );
	}

	$cancellati = 0;
	$falliti    = array();
	if ( $cancella ) {
		foreach ( $daCancellare as $x ) {
			if ( wp_delete_user( $x['id'] ) ) {
				$cancellati++;
			} else {
				$falliti[] = $x['email'];
			}
		}
	}

	return new WP_REST_Response( array(
		'ok'            => true,
		'guardati'      => count( $utenti ),
		'da_cancellare' => count( $daCancellare ),
		'cancellati'    => $cancellati,
		'risparmiati'   => $salvati,
		'falliti'       => $falliti,
		// i primi venti, per poterli leggere senza affogare nella risposta
		'esempi'        => array_slice( $daCancellare, 0, 20 ),
		'prova'         => ! $cancella,
	), 200 );
}
endif;
