<?php
/**
 * Elitederma — il totale spiegato nel carrello e al checkout
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui ovunque". Non serve toccare il tema.
 *
 * COSA FA
 * Nel riepilogo del carrello e in quello del checkout, subito sopra il
 * totale, aggiunge le righe che spiegano come ci si arriva:
 *
 *   Imponibile (netto)                   130,80 €
 *   Sconto codice AULA25                −11,12 €
 *   Netto scontato                       119,68 €
 *   IVA 22%                               26,33 €
 *   Totale                               146,01 €
 *
 * Il dettaglio sta QUI e non sulla scheda del prodotto perché il codice
 * promozionale il cliente lo inserisce alla fine: su un prodotto, lo
 * sconto o non c'è ancora o è quello di un carrello che non si sta
 * guardando.
 *
 * I numeri sono quelli che WooCommerce ha già calcolato per il carrello
 * — imponibile, sconto, imposta, totale. Non se ne ricalcola nessuno:
 * se il totale qui sotto non tornasse con quello di WooCommerce, il
 * cliente vedrebbe due conti diversi sulla stessa pagina.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Una riga del riepilogo, nella stessa tabella dei totali di WooCommerce. */
function elitederma_riga_totale( $etichetta, $importo, $classe = '', $colore = '' ) {
	printf(
		'<tr class="elitederma-riga %s"><th style="%s">%s</th><td style="%s">%s</td></tr>',
		esc_attr( $classe ),
		$colore ? 'color:' . esc_attr( $colore ) . ';font-weight:600;' : '',
		wp_kses_post( $etichetta ),
		$colore ? 'color:' . esc_attr( $colore ) . ';' : '',
		wp_kses_post( $importo )
	);
}

/**
 * Le righe del dettaglio, sopra il totale.
 *
 * Imponibile e sconto sono al netto dell'IVA: sono le due grandezze su
 * cui si ragiona, e sommarci l'imposta le renderebbe incomparabili con
 * i prezzi di listino che stanno in anagrafica.
 */
function elitederma_dettaglio_totale() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return;
	}
	$cart = WC()->cart;

	$netto   = (float) $cart->get_subtotal();          // imponibile, IVA esclusa
	$sconto  = (float) $cart->get_discount_total();    // sconto, IVA esclusa
	$imposta = (float) $cart->get_total_tax();
	$totale  = (float) $cart->get_total( 'edit' );

	if ( $netto <= 0 ) {
		return;
	}
	$netto_scontato = round( $netto - $sconto, 2 );
	// l'aliquota si legge dai numeri del carrello, non si scrive: un
	// carrello con prodotti ad aliquote diverse non ne ha una sola, e
	// allora si scrive "IVA" e basta invece di una percentuale falsa
	$aliquota  = $netto_scontato > 0 ? round( $imposta / $netto_scontato * 100, 1 ) : 0;
	$aliquote  = array();
	foreach ( $cart->get_cart() as $riga ) {
		$p = isset( $riga['data'] ) ? $riga['data'] : null;
		if ( $p instanceof WC_Product ) {
			$aliquote[ $p->get_tax_class() ] = true;
		}
	}
	$etichetta_iva = count( $aliquote ) === 1 && $aliquota > 0
		? sprintf( 'IVA %s%%', esc_html( rtrim( rtrim( number_format_i18n( $aliquota, 1 ), '0' ), ',' ) ) )
		: 'IVA';

	elitederma_riga_totale( 'Imponibile (netto)', wc_price( $netto ) );

	if ( $sconto > 0 ) {
		$codici = array_map( 'strtoupper', (array) $cart->get_applied_coupons() );
		elitederma_riga_totale(
			$codici ? sprintf( 'Sconto codice %s', esc_html( implode( ', ', $codici ) ) ) : 'Sconto',
			'&minus; ' . wc_price( $sconto ),
			'elitederma-sconto',
			'#2E7D32'
		);
		elitederma_riga_totale( 'Netto scontato', wc_price( $netto_scontato ) );
	}

	elitederma_riga_totale( $etichetta_iva, wc_price( $imposta ) );
}

// Carrello e checkout: sopra la riga del totale, dove il cliente guarda
// prima di pagare.
add_action( 'woocommerce_cart_totals_before_order_total', 'elitederma_dettaglio_totale' );
add_action( 'woocommerce_review_order_before_order_total', 'elitederma_dettaglio_totale' );
