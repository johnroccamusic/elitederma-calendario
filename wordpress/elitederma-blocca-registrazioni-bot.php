<?php
/**
 * Plugin Name: Elitederma — Blocca le registrazioni dei bot
 * Description: Rifiuta la creazione di account con indirizzi email "a codice", quelli generati a macchina.
 * Version: 1.0
 */

// IL PROBLEMA. Dal modulo "Registrati" di WooCommerce, nella pagina Il mio
// account, ogni giorno entravano decine di account con indirizzi come
// 0152beb28d7c4ee2@gmail.com: sedici caratteri esadecimali, nome utente
// identico alla parte prima della chiocciola, zero ordini. Sono bot.
//
// Chiudere il modulo li fermerebbe tutti, ma chiuderebbe anche le clienti
// vere che vogliono un account senza comprare subito. Quindi il modulo
// resta e si fermano loro.
//
// COME SI RICONOSCONO. Non dal dominio — gmail.com ce l'hanno anche le
// clienti — ma dalla FORMA della parte prima della chiocciola:
//
//   1. solo cifre e lettere dalla a alla f, dodici caratteri o piu'.
//      E' la firma di un codice esadecimale, e nessuno si chiama cosi'.
//      E' il caso di tutti quelli arrivati finora.
//
//   2. una sequenza lunga, senza punti ne' trattini, che mescola lettere e
//      cifre e non ha quasi vocali. Una persona scrive mario.rossi,
//      m.rossi88, chiara1990: ci sono separatori, o vocali, o entrambi.
//      Questa seconda rete e' piu' larga e serve per il giorno in cui il
//      bot cambia alfabeto.
//
// COSA NON FA. Non guarda il dominio, non tiene liste di indirizzi, non
// chiede captcha. E non tocca chi un account ce l'ha gia': vale solo al
// momento della creazione.
//
// Installazione: Code Snippets → Aggiungi nuovo → incollare tutto il file
// (senza la riga "<?php") → "Esegui ovunque" → Salva e attiva.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Le guardie function_exists ci sono per Code Snippets, non per PHP:
// quando salva o accende uno snippet lo esegue DUE volte nella stessa
// richiesta, e alla seconda le funzioni risultano gia' dichiarate.
if ( ! function_exists( 'elitederma_email_a_codice' ) ) :
/**
 * L'indirizzo sembra generato a macchina?
 * Restituisce il motivo (stringa) oppure '' se e' un indirizzo normale.
 */
function elitederma_email_a_codice( $email ) {
	$email = strtolower( trim( (string) $email ) );
	$chiocciola = strpos( $email, '@' );
	if ( false === $chiocciola ) {
		return '';
	}
	$nome = substr( $email, 0, $chiocciola );

	// 1. codice esadecimale puro: la firma di quelli arrivati finora
	if ( preg_match( '/^[0-9a-f]{12,}$/', $nome ) ) {
		return 'esadecimale';
	}

	// 2. sequenza lunga senza separatori, lettere e cifre mescolate, quasi
	//    senza vocali. I separatori salvano mario.rossi e m_rossi; le
	//    vocali salvano chiarabellezza1990.
	if ( strlen( $nome ) >= 14
		&& preg_match( '/^[a-z0-9]+$/', $nome )
		&& preg_match( '/[0-9]/', $nome )
		&& preg_match( '/[a-z]/', $nome ) ) {
		$vocali = preg_match_all( '/[aeiou]/', $nome );
		$lettere = preg_match_all( '/[a-z]/', $nome );
		// meno di una vocale ogni cinque lettere: non e' una parola
		if ( $lettere > 0 && ( $vocali / $lettere ) < 0.2 ) {
			return 'sequenza senza vocali';
		}
	}

	return '';
}
endif;

if ( ! function_exists( 'elitederma_ferma_registrazione_bot' ) ) :
/**
 * Il messaggio e' volutamente generico e rivolto a una persona: un bot non
 * lo legge, e a una cliente vera non si spiega quale regola ha incrociato
 * — saprebbe come aggirarla chi sta provando ad aggirarla.
 */
function elitederma_ferma_registrazione_bot( $errori, $nome_utente = '', $email = '' ) {
	if ( ! is_wp_error( $errori ) ) {
		$errori = new WP_Error();
	}
	$motivo = elitederma_email_a_codice( $email );
	if ( '' !== $motivo ) {
		$errori->add(
			'elitederma_email_non_valida',
			__( 'Questo indirizzo email non è accettato. Se è il tuo indirizzo e stai avendo difficoltà, scrivici e ti registriamo noi.', 'woocommerce' )
		);
	}
	return $errori;
}
endif;

// Il modulo "Registrati" della pagina Il mio account, che e' la porta da
// cui stanno entrando.
add_filter( 'woocommerce_process_registration_errors', 'elitederma_ferma_registrazione_bot', 10, 3 );
add_filter( 'woocommerce_registration_errors', 'elitederma_ferma_registrazione_bot', 10, 3 );

// E la registrazione di WordPress, per il giorno in cui qualcuno la
// riaprisse: la firma della chiamata e' diversa, l'email e' il secondo
// argomento.
if ( ! function_exists( 'elitederma_ferma_registrazione_wp' ) ) :
function elitederma_ferma_registrazione_wp( $errori, $nome_utente, $email ) {
	return elitederma_ferma_registrazione_bot( $errori, $nome_utente, $email );
}
endif;
add_filter( 'registration_errors', 'elitederma_ferma_registrazione_wp', 10, 3 );
