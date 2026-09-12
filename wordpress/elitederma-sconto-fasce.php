<?php
/**
 * Plugin Name: Elitederma — Sconto a fasce
 * Description: Applica ai coupon dell'accademia una percentuale di sconto diversa per ogni prodotto, scelta in base a quanto quel prodotto rende. Senza questo innesto il coupon resta valido e applica la sua percentuale unica.
 * Version: 1.0
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
//   - su ogni PRODOTTO c'e' un campo nascosto `_ed_margine_pct`, quanto
//     rende quel prodotto in percentuale;
//   - sul COUPON c'e' un campo nascosto `_ed_fasce_sconto`, le fasce con
//     la loro percentuale.
// Qui si mette insieme: si guarda quanto rende il prodotto, si trova la
// sua fascia, si applica quella percentuale.
//
// Se il gestionale non ha ancora scritto quei campi, o se questo file
// viene disattivato, non si rompe niente: il coupon torna a comportarsi
// come un normale coupon in percentuale.

if ( ! defined( 'ABSPATH' ) ) { exit; }

add_filter( 'woocommerce_coupon_get_discount_amount', 'elitederma_sconto_a_fasce', 10, 5 );

function elitederma_sconto_a_fasce( $sconto, $importo_da_scontare, $riga_carrello, $singolo, $coupon ) {

	// "fixed_cart" sconta il carrello intero e non ha una riga: li' non
	// c'e' nessun prodotto di cui guardare il margine, e si lascia fare
	// a WooCommerce.
	if ( ! is_array( $riga_carrello ) || empty( $riga_carrello['data'] ) ) {
		return $sconto;
	}

	$fasce_grezze    = $coupon->get_meta( '_ed_fasce_sconto' );
	$pct_sul_margine = $coupon->get_meta( '_ed_sconto_margine_pct' );

	// Nessuno dei due contrassegni: non e' un coupon dell'accademia, o e'
	// una normale percentuale sul prezzo. Si lascia fare a WooCommerce,
	// esattamente come prima che questo file esistesse.
	if ( empty( $fasce_grezze ) && '' === (string) $pct_sul_margine ) {
		return $sconto;
	}

	$prodotto = $riga_carrello['data'];

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
	// regola del banco — non si regala qualcosa di cui non si sa quanto
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

/**
 * Legge un campo del prodotto guardando prima la variante e poi il
 * prodotto padre: su un prodotto con varianti il dato puo' stare
 * sull'una o sull'altro.
 */
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

// In pagina carrello, accanto al coupon, una riga che spiega perche' lo
// sconto non e' "il 10% di tutto": chi compra deve poter capire il
// totale che gli viene chiesto.
add_filter( 'woocommerce_cart_totals_coupon_label', 'elitederma_etichetta_coupon_fasce', 10, 2 );

function elitederma_etichetta_coupon_fasce( $etichetta, $coupon ) {
	if ( $coupon->get_meta( '_ed_fasce_sconto' ) || '' !== (string) $coupon->get_meta( '_ed_sconto_margine_pct' ) ) {
		$etichetta .= ' — sconto variabile per prodotto';
	}
	return $etichetta;
}
