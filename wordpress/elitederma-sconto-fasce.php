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

	$fasce_grezze = $coupon->get_meta( '_ed_fasce_sconto' );
	if ( empty( $fasce_grezze ) ) {
		return $sconto; // non e' un coupon a fasce: nulla da fare
	}

	$fasce = json_decode( $fasce_grezze, true );
	if ( ! is_array( $fasce ) || ! count( $fasce ) ) {
		return $sconto;
	}

	$prodotto = $riga_carrello['data'];

	// Su una variante il margine puo' stare sulla variante stessa oppure
	// sul prodotto padre: si guarda prima la piu' specifica.
	$margine = $prodotto->get_meta( '_ed_margine_pct' );
	if ( '' === $margine || null === $margine ) {
		$padre = $prodotto->get_parent_id();
		if ( $padre ) {
			$margine = get_post_meta( $padre, '_ed_margine_pct', true );
		}
	}

	// Margine sconosciuto: niente sconto su questa riga. E' la stessa
	// regola del banco — non si regala qualcosa di cui non si sa quanto
	// vale.
	if ( '' === $margine || null === $margine ) {
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

// In pagina carrello, accanto al coupon, una riga che spiega perche' lo
// sconto non e' "il 10% di tutto": chi compra deve poter capire il
// totale che gli viene chiesto.
add_filter( 'woocommerce_cart_totals_coupon_label', 'elitederma_etichetta_coupon_fasce', 10, 2 );

function elitederma_etichetta_coupon_fasce( $etichetta, $coupon ) {
	if ( $coupon->get_meta( '_ed_fasce_sconto' ) ) {
		$etichetta .= ' — sconto variabile per prodotto';
	}
	return $etichetta;
}
