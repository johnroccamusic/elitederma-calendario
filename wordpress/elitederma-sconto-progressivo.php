<?php
/**
 * Plugin Name: Elitederma - Sconto progressivo rivenditori
 * Description: Sui coupon che seguono il listino rivenditori, la percentuale scritta sul codice e' un TETTO: ogni prodotto sconta la sua parte di quello che puo' cedere, e un prodotto senza margine non si sconta. Si aggiunge allo snippet dello sconto a fasce senza sostituirlo. Senza questo innesto il coupon resta valido e applica la sua percentuale unica.
 * Version: 1.0
 * Author: Elitederma
 */

// PERCHE' E' UNO SNIPPET A PARTE, E NON UNA RIGA IN QUELLO DELLE FASCE.
//
// Deciso il 19/11/2026, dopo aver misurato sul sito: lo snippet dello
// sconto a fasce e' lungo duecentocinquanta righe, e sostituirlo per
// intero ha due modi di andare storto che abbiamo gia' pagato —
// l'editor di Code Snippets rovina il testo incollato, e
// un'importazione con un titolo che non combacia crea un SECONDO
// snippet lasciando attivo il vecchio. E' esattamente quello che e'
// successo: provato con un carrello vero, un coupon al 20% scontava
// 15,36% piatto su tutto, e il sito girava ancora la versione di prima.
//
// Questo file invece si AGGIUNGE, e puo' farlo per una ragione precisa:
// davanti a un coupon che porta solo `_ed_frazione_cedibile`, lo snippet
// delle fasce non riconosce nessuno dei suoi contrassegni e restituisce
// lo sconto di WooCommerce intatto. Qui si riprende da li' con una
// priorita' piu' alta (20 contro 10) e si corregge.
//
// E se un giorno lo snippet delle fasce arrivasse alla versione che
// questo conto lo sa fare da se', non cambia niente: si ricalcola lo
// stesso numero dagli stessi due dati, quindi il risultato e' identico.
// Non si somma nulla due volte — questo filtro SOSTITUISCE lo sconto
// della riga, non lo aggiunge.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// La priorita' 20 viene DOPO il 10 dello snippet a fasce: quello decide
// per primo, questo ha l'ultima parola sui soli coupon del listino.
add_filter( 'woocommerce_coupon_get_discount_amount', 'elitederma_sconto_progressivo', 20, 5 );

// La guardia e' per Code Snippets, non per PHP: salvando o attivando uno
// snippet lo esegue DUE volte nella stessa richiesta, e alla seconda la
// funzione risulta gia' dichiarata. Senza, lo snippet non si accende.
if ( ! function_exists( 'elitederma_sconto_progressivo' ) ) {
function elitederma_sconto_progressivo( $sconto, $importo_da_scontare, $riga_carrello, $singolo, $coupon ) {

	// "fixed_cart" sconta il carrello intero e non ha una riga: li' non
	// c'e' nessun prodotto di cui guardare il cedibile, e si lascia fare
	// a WooCommerce.
	if ( ! is_array( $riga_carrello ) || empty( $riga_carrello['data'] ) ) {
		return $sconto;
	}

	$frazione_grezza = $coupon->get_meta( '_ed_frazione_cedibile' );

	// Non e' un coupon che segue il listino: non si tocca niente. Qui
	// passano tutti gli altri — fasce, needling, acquisto master,
	// percentuale secca — e devono uscire esattamente come sono entrati.
	if ( '' === (string) $frazione_grezza ) {
		return $sconto;
	}

	$frazione = (float) $frazione_grezza;
	if ( $frazione <= 0 ) {
		return 0.0; // frazione spenta: niente sconto, non "sconto pieno"
	}

	$prodotto = $riga_carrello['data'];

	// Quanto quel pezzo puo' cedere, scritto dal gestionale
	// (`_ed_cedibile_riv_pct`, da woo-allinea-margini). Su una variante
	// il campo sta sul padre, come per gli altri campi nascosti.
	$cedibile_pct = elitederma_progressivo_meta( $prodotto, '_ed_cedibile_riv_pct' );

	// NON SCRITTO VUOL DIRE NON SI SA, E NON SI SCONTA. E' la stessa
	// regola del banco e dello snippet a fasce: non si regala qualcosa
	// di cui non si sa quanto vale. Capita sui prodotti che non stanno
	// nel listino, e sulle righe che prodotto non sono (la spedizione).
	if ( '' === $cedibile_pct ) {
		return 0.0;
	}

	$pct = (float) $cedibile_pct * $frazione;

	// Cedibile zero: il prodotto non ha margine da cedere. Zero e' una
	// risposta vera, e si distingue da "non scritto" qui sopra.
	if ( $pct <= 0 ) {
		return 0.0;
	}

	// La percentuale e' sul LORDO, come le fasce: `$importo_da_scontare`
	// e' quello che WooCommerce chiede di scontare su questa riga, e
	// porta gia' la quantita' quando non sta chiedendo il singolo pezzo.
	//
	// Si parte da `$importo_da_scontare` e NON da `$sconto`: `$sconto` e'
	// quello che ha deciso il filtro prima di questo — la percentuale
	// piatta — e ricalcolarci sopra vorrebbe dire scontare uno sconto.
	return round( (float) $importo_da_scontare * $pct / 100, wc_get_rounding_precision() );
}
}

/**
 * Un campo nascosto del prodotto, preso dal padre quando si tratta di
 * una variante: le meta del gestionale stanno sul prodotto principale.
 *
 * Il nome e' diverso da quello dello snippet a fasce
 * (`elitederma_meta_prodotto`) apposta: due funzioni con lo stesso nome
 * in due snippet attivi insieme fanno morire il secondo che si carica,
 * e con esso tutto il carrello.
 */
if ( ! function_exists( 'elitederma_progressivo_meta' ) ) {
function elitederma_progressivo_meta( $prodotto, $chiave ) {
	$valore = $prodotto->get_meta( $chiave, true );
	if ( '' === $valore && $prodotto->get_parent_id() ) {
		$padre = wc_get_product( $prodotto->get_parent_id() );
		if ( $padre ) {
			$valore = $padre->get_meta( $chiave, true );
		}
	}
	return is_scalar( $valore ) ? (string) $valore : '';
}
}
