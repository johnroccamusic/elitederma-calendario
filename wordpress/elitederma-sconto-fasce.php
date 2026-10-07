<?php
/**
 * Plugin Name: Elitederma - Sconto a fasce
 * Description: Applica ai coupon dell'accademia una percentuale di sconto diversa per ogni prodotto, scelta in base a quanto quel prodotto rende. I prodotti del reparto Needling hanno invece una tabella loro, a scaglioni di spesa e sul prezzo netto. I coupon di acquisto delle master cedono una quota di quello che su ogni pezzo si puo' cedere. Senza questo innesto il coupon resta valido e applica la sua percentuale unica.
 * Version: 1.3
 * Author: Elitederma
 */

// Perche' esiste questo file.
//
// Un coupon di WooCommerce ha UNA percentuale e vale per tutto il
// carrello. Il gestionale dell'accademia invece sconta a fasce: quanto
// rende un prodotto decide quanto si sconta, cosi' un articolo che rende
// il 10% non viene svenduto insieme a uno che rende il 90%. Al banco
// (POS) il conto si fa riga per riga; sul sito, senza queste venti
// righe, non si potrebbe.
//
// Come funziona, in due pezzi che arrivano entrambi dal gestionale:
//   - su ogni PRODOTTO c'e' un campo nascosto _ed_margine_pct, quanto
//     rende quel prodotto in percentuale;
//   - sul COUPON c'e' un campo nascosto _ed_fasce_sconto, le fasce con
//     la loro percentuale.
// Qui si mette insieme: si guarda quanto rende il prodotto, si trova la
// sua fascia, si applica quella percentuale.
//
// Se il gestionale non ha ancora scritto quei campi, o se questo file
// viene disattivato, non si rompe niente: il coupon torna a comportarsi
// come un normale coupon in percentuale.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// La categoria "Needling" su WooCommerce. Se un giorno cambiasse, si
// cambia qui e basta: e' l'unico punto che la nomina.
if ( ! defined( 'ELITEDERMA_CATEGORIA_NEEDLING' ) ) {
	define( 'ELITEDERMA_CATEGORIA_NEEDLING', 64 );
}

add_filter( 'woocommerce_coupon_get_discount_amount', 'elitederma_sconto_a_fasce', 10, 5 );

// La guardia c'e' per Code Snippets, non per PHP: quando salva o
// accende uno snippet lo esegue DUE volte nella stessa richiesta, una
// per controllarlo e una per attivarlo, e alla seconda la funzione
// risulta gia' dichiarata. Senza questa riga lo snippet non si accende.
if ( ! function_exists( 'elitederma_sconto_a_fasce' ) ) {
function elitederma_sconto_a_fasce( $sconto, $importo_da_scontare, $riga_carrello, $singolo, $coupon ) {

	// "fixed_cart" sconta il carrello intero e non ha una riga: li' non
	// c'e' nessun prodotto di cui guardare il margine, e si lascia fare
	// a WooCommerce.
	if ( ! is_array( $riga_carrello ) || empty( $riga_carrello['data'] ) ) {
		return $sconto;
	}

	$fasce_grezze    = $coupon->get_meta( '_ed_fasce_sconto' );
	$pct_sul_margine = $coupon->get_meta( '_ed_sconto_margine_pct' );
	$needling_grezzo = $coupon->get_meta( '_ed_needling' );
	$quota_master    = $coupon->get_meta( '_ed_quota_master' );

	// Nessuno dei tre contrassegni: non e' un coupon dell'accademia, o e'
	// una normale percentuale sul prezzo. Si lascia fare a WooCommerce,
	// esattamente come prima che questo file esistesse.
	if ( empty( $fasce_grezze ) && '' === (string) $pct_sul_margine && empty( $needling_grezzo ) && empty( $quota_master ) ) {
		return $sconto;
	}

	$prodotto = $riga_carrello['data'];

	// ---- CASO M: IL LISTINO DELLE MASTER ----
	//
	// Una master non compra per rivendere: compra per se'. Le si cede una
	// FETTA di quello che su quel pezzo si potrebbe cedere - il massimo e'
	// il prezzo del rivenditore, che il rischio del magazzino se lo prende.
	//
	// Sul prodotto il gestionale scrive quanti euro si possono cedere
	// (_ed_cedibile_eur, netti, per pezzo) e in quale reparto sta
	// (_ed_blocco). Sul coupon viaggia solo la quota: una generale e, se
	// c'e', una diversa per reparto. Cosi' cambiare la quota non obbliga a
	// riscrivere trecento prodotti, e il conto e' lo stesso che fa il POS.
	//
	// Gli euro sono gia' netti: non si tocca l'IVA, come nel caso del
	// margine qui sotto.
	if ( ! empty( $quota_master ) ) {
		$quota = json_decode( $quota_master, true );
		$cedibile = elitederma_meta_prodotto( $prodotto, '_ed_cedibile_eur' );
		if ( '' === $cedibile ) {
			return 0.0; // non si sa quanto si puo' cedere: non si sconta
		}
		$pct = isset( $quota['generale'] ) ? (float) $quota['generale'] : 0.0;
		$blocco = elitederma_meta_prodotto( $prodotto, '_ed_blocco' );
		// La quota del reparto vince su quella generale. Zero e' una
		// quota vera - "qui non si sconta" - e si distingue da "non
		// scritta", che e' la chiave che non c'e'.
		if ( '' !== $blocco && isset( $quota['reparti'] ) && is_array( $quota['reparti'] ) && array_key_exists( $blocco, $quota['reparti'] ) ) {
			$pct = (float) $quota['reparti'][ $blocco ];
		}
		if ( $pct <= 0 ) {
			return 0.0;
		}
		$quantita = isset( $riga_carrello['quantity'] ) ? (int) $riga_carrello['quantity'] : 1;
		$pezzi    = $singolo ? 1 : max( 1, $quantita );
		$importo  = (float) $cedibile * $pct / 100 * $pezzi;
		return round( min( $importo, (float) $importo_da_scontare ), wc_get_rounding_precision() );
	}

	// ---- CASO 0: NEEDLING, che ha una tabella sua ----
	//
	// I prodotti del reparto Needling non guardano le fasce: lo sconto lo
	// decide la loro tabella, a scaglioni di spesa, e le due non si
	// sommano mai. E' la stessa regola che applica il POS dell'app.
	//
	// Due differenze dalle fasce, ed e' importante non confonderle:
	//  - lo scaglione lo sceglie QUANTO SI SPENDE in tutto il carrello,
	//    non quanto rende il prodotto;
	//  - la percentuale si legge SUL PREZZO NETTO, mentre le fasce sono
	//    sul lordo. Il 30% di needling sono trenta euro ogni cento netti.
	if ( ! empty( $needling_grezzo ) && elitederma_e_needling( $prodotto ) ) {
		$needling = json_decode( $needling_grezzo, true );
		$soglie   = isset( $needling['soglie'] ) && is_array( $needling['soglie'] ) ? $needling['soglie'] : array();
		$sconti   = isset( $needling['sconti'] ) && is_array( $needling['sconti'] ) ? $needling['sconti'] : array();

		if ( count( $soglie ) === 2 && count( $sconti ) === 3 ) {
			// il totale del carrello a listino, IVA compresa e prima di
			// qualunque sconto: e' la stessa base che legge il POS
			$speso = 0.0;
			if ( function_exists( 'WC' ) && WC()->cart ) {
				$speso = (float) WC()->cart->get_subtotal() + (float) WC()->cart->get_subtotal_tax();
			}
			$pct = (float) ( $speso < (float) $soglie[0] ? $sconti[0] : ( $speso < (float) $soglie[1] ? $sconti[1] : $sconti[2] ) );

			if ( $pct <= 0 ) {
				return 0.0; // tabella spenta su questo scaglione: niente sconto
			}

			// la percentuale e' sul NETTO: si prende il prezzo senza IVA e
			// si sconta quello. Applicarla al lordo darebbe un quinto in
			// piu' di sconto senza che nessuno l'abbia deciso.
			$netto_unitario = (float) wc_get_price_excluding_tax( $prodotto, array( 'qty' => 1 ) );
			$quantita       = isset( $riga_carrello['quantity'] ) ? (int) $riga_carrello['quantity'] : 1;
			$pezzi          = $singolo ? 1 : max( 1, $quantita );
			$importo        = $netto_unitario * $pct / 100 * $pezzi;

			return round( min( $importo, (float) $importo_da_scontare ), wc_get_rounding_precision() );
		}
	}


	// ---- CASO 2: una percentuale sola, ma letta sul GUADAGNO ----
	// "15%" vuol dire quindici euro ogni cento guadagnati, non ogni cento
	// incassati. Il guadagno per pezzo lo scrive il gestionale sul
	// prodotto, gia' in euro e gia' netto: qui non si calcola niente, si
	// legge.
	if ( empty( $fasce_grezze ) ) {
		$margine_eur = elitederma_meta_prodotto( $prodotto, '_ed_margine_eur' );
		if ( '' === $margine_eur ) {
			return 0.0; // guadagno sconosciuto: non si sconta
		}
		$quantita = isset( $riga_carrello['quantity'] ) ? (int) $riga_carrello['quantity'] : 1;
		// $singolo = true quando WooCommerce sta scontando UN pezzo e
		// moltiplichera' lui per la quantita'; false quando chiede lo
		// sconto dell'intera riga
		$pezzi = $singolo ? 1 : max( 1, $quantita );
		$importo = (float) $margine_eur * (float) $pct_sul_margine / 100 * $pezzi;
		return round( min( $importo, (float) $importo_da_scontare ), wc_get_rounding_precision() );
	}

	// ---- CASO 1: sconto a fasce ----
	$fasce = json_decode( $fasce_grezze, true );
	if ( ! is_array( $fasce ) || ! count( $fasce ) ) {
		return $sconto;
	}

	$margine = elitederma_meta_prodotto( $prodotto, '_ed_margine_pct' );

	// Margine sconosciuto: niente sconto su questa riga. E' la stessa
	// regola del banco - non si regala qualcosa di cui non si sa quanto
	// vale.
	if ( '' === $margine ) {
		return 0.0;
	}

	$m = (float) $margine;

	// La prima fascia che lo contiene. Oltre l'ultimo confine resta
	// l'ultima, cosi' un margine del 100% non cade nel vuoto.
	$percentuale = 0.0;
	foreach ( $fasce as $fascia ) {
		$percentuale = isset( $fascia['percentuale'] ) ? (float) $fascia['percentuale'] : 0.0;
		if ( isset( $fascia['a'] ) && $m <= (float) $fascia['a'] ) {
			break;
		}
	}

	if ( $percentuale <= 0 ) {
		return 0.0;
	}

	return round( (float) $importo_da_scontare * $percentuale / 100, wc_get_rounding_precision() );
}
}

/**
 * Il prodotto appartiene al reparto Needling?
 *
 * Si guarda la categoria di WooCommerce (id 64) invece di un
 * contrassegno scritto sul prodotto: il contrassegno andrebbe tenuto
 * aggiornato su duecento schede, la categoria e' gia' li' e la si
 * cambia in un posto solo. Su una variante si guarda il padre, che e'
 * dove stanno le categorie.
 */
if ( ! function_exists( 'elitederma_e_needling' ) ) {
function elitederma_e_needling( $prodotto ) {
	$id = $prodotto->get_parent_id() ? $prodotto->get_parent_id() : $prodotto->get_id();
	return has_term( ELITEDERMA_CATEGORIA_NEEDLING, 'product_cat', $id );
}
}

/**
 * Legge un campo del prodotto guardando prima la variante e poi il
 * prodotto padre: su un prodotto con varianti il dato puo' stare
 * sull'una o sull'altro.
 */
if ( ! function_exists( 'elitederma_meta_prodotto' ) ) {
function elitederma_meta_prodotto( $prodotto, $chiave ) {
	$valore = $prodotto->get_meta( $chiave );
	if ( '' === $valore || null === $valore ) {
		$padre = $prodotto->get_parent_id();
		if ( $padre ) {
			$valore = get_post_meta( $padre, $chiave, true );
		}
	}
	return ( null === $valore ) ? '' : (string) $valore;
}
}

// In pagina carrello, accanto al coupon, una riga che spiega perche' lo
// sconto non e' "il 10% di tutto": chi compra deve poter capire il
// totale che gli viene chiesto.
add_filter( 'woocommerce_cart_totals_coupon_label', 'elitederma_etichetta_coupon_fasce', 10, 2 );

if ( ! function_exists( 'elitederma_etichetta_coupon_fasce' ) ) {
function elitederma_etichetta_coupon_fasce( $etichetta, $coupon ) {
	if ( $coupon->get_meta( '_ed_fasce_sconto' ) || '' !== (string) $coupon->get_meta( '_ed_sconto_margine_pct' ) || $coupon->get_meta( '_ed_needling' ) || $coupon->get_meta( '_ed_quota_master' ) ) {
		$etichetta .= ' - sconto variabile per prodotto';
	}
	return $etichetta;
}
}

/**
 * L'ordine dei prodotti DENTRO una categoria.
 *
 * WooCommerce ha un "menu_order" solo per prodotto: se un prodotto sta in
 * tre categorie, la sua posizione e' la stessa in tutte e tre, e
 * riordinarne una rimanda all'aria le altre. Sul nostro catalogo succede
 * su quasi meta' dei prodotti.
 *
 * Il gestionale scrive su ogni prodotto un campo per ogni categoria in cui
 * sta - _ed_ordine_cat_<id della categoria> - e qui, quando il cliente
 * apre quell'elenco, si ordina per quel campo.
 *
 * Si tocca la query SQL invece di passare da "orderby", e per due ragioni
 * che abbiamo imparato provando:
 *
 *  - WooCommerce decide l'ordine del catalogo DOPO pre_get_posts, nel suo
 *    get_catalog_ordering_args, e quello che si scrive prima lo sovrascrive
 *    lui. Il primo tentativo era li' e non comandava niente: l'archivio
 *    continuava a seguire menu_order.
 *  - un ordinamento per meta_key normale farebbe SPARIRE i prodotti che
 *    quel campo non ce l'hanno. Con la giunzione a sinistra restano, e
 *    finiscono in fondo: un prodotto nuovo non deve scavalcare quelli
 *    messi in ordine a mano, ma nemmeno sparire dalla vetrina.
 *
 * Fuori dalle pagine di categoria non si tocca niente, e se il cliente
 * sceglie lui un ordinamento - prezzo, novita' - comanda la sua scelta.
 */
add_filter( 'posts_clauses', 'elitederma_ordine_per_categoria', 20, 2 );

if ( ! function_exists( 'elitederma_ordine_per_categoria' ) ) {
function elitederma_ordine_per_categoria( $clausole, $query ) {
    if ( is_admin() || ! is_a( $query, 'WP_Query' ) || ! $query->is_main_query() ) {
        return $clausole;
    }
    if ( ! $query->is_tax( 'product_cat' ) ) {
        return $clausole;
    }
    // Se il cliente ha scelto lui un ordinamento - prezzo, novita',
    // popolarita' - comanda la sua scelta, non la nostra vetrina.
    $scelto = isset( $_GET['orderby'] ) ? sanitize_text_field( wp_unslash( $_GET['orderby'] ) ) : '';
    if ( '' !== $scelto && 'menu_order' !== $scelto ) {
        return $clausole;
    }
    $termine = $query->get_queried_object();
    if ( ! $termine || ! isset( $termine->term_id ) ) {
        return $clausole;
    }

    global $wpdb;
    $chiave = '_ed_ordine_cat_' . (int) $termine->term_id;
    $clausole['join'] .= $wpdb->prepare(
        " LEFT JOIN {$wpdb->postmeta} AS ed_ordine ON ( ed_ordine.post_id = {$wpdb->posts}.ID AND ed_ordine.meta_key = %s ) ",
        $chiave
    );
    // 999999 e' "non ha una posizione": in fondo, e fra loro si ordinano
    // come faceva WooCommerce prima che questo file esistesse.
    $clausole['orderby'] = " COALESCE( CAST( ed_ordine.meta_value AS UNSIGNED ), 999999 ) ASC, {$wpdb->posts}.menu_order ASC, {$wpdb->posts}.post_title ASC ";
    return $clausole;
}
}
