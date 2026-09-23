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

/**
 * ATTENZIONE — VERIFICATO IL 23/09/2026: SU elitederma.shop QUESTO
 * SNIPPET NON MOSTRA NIENTE.
 *
 * Il carrello del sito e' il BLOCCO di WooCommerce (nella pagina c'e'
 * wp-block-woocommerce-cart, e non c'e' woocommerce-cart-form): lo
 * disegna JavaScript leggendo la Store API, e gli hook PHP qui sotto —
 * woocommerce_cart_item_name, woocommerce_cart_totals_before_order_total
 * — appartengono al carrello classico, quello a shortcode. Nel blocco
 * non vengono chiamati da nessuno.
 *
 * Questo file resta valido e pronto per due strade:
 *   1. si riportano le pagine Carrello e Checkout agli shortcode
 *      [woocommerce_cart] / [woocommerce_checkout], e funziona com'e';
 *   2. si tiene il carrello a blocchi e si rifa' lo stesso dettaglio in
 *      JavaScript sulla Store API.
 * Finche' non si sceglie, tenerlo pure disattivato: non fa danni, ma
 * non fa nemmeno niente.
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

/**
 * Il dettaglio riga per riga, sotto il nome del prodotto nel carrello.
 *
 * Il totale in fondo dice quanto si paga; questo dice perche'. Con un
 * codice che vale solo su certi prodotti serve vedere su quale riga lo
 * sconto e' caduto e su quale no — dal totale non si capisce.
 *
 * I numeri sono quelli che WooCommerce ha gia' messo nella riga:
 * line_subtotal e' l'imponibile prima dello sconto, line_total quello
 * dopo, line_tax l'imposta sul secondo. La percentuale si ricava dai
 * due imponibili, cosi' e' quella vera anche quando il coupon e' a
 * importo fisso o si ferma a una parte della riga.
 */
add_filter(
	'woocommerce_cart_item_name',
	function ( $nome, $riga, $chiave ) {
		if ( ! is_array( $riga ) || ! isset( $riga['line_subtotal'] ) ) {
			return $nome;
		}
		$netto  = (float) $riga['line_subtotal'];
		$dopo   = (float) ( isset( $riga['line_total'] ) ? $riga['line_total'] : $riga['line_subtotal'] );
		$imposta = (float) ( isset( $riga['line_tax'] ) ? $riga['line_tax'] : 0 );
		if ( $netto <= 0 ) {
			return $nome;
		}
		$sconto = round( $netto - $dopo, 2 );
		$pct    = $sconto > 0 ? round( $sconto / $netto * 100, 1 ) : 0;
		$totale = round( $dopo + $imposta, 2 );
		$aliq   = $dopo > 0 ? round( $imposta / $dopo * 100, 1 ) : 0;
		$num    = function ( $v, $d = 1 ) {
			return rtrim( rtrim( number_format_i18n( $v, $d ), '0' ), ',' );
		};

		$righe = array();
		$righe[] = array( 'Netto', wc_price( $netto ), '' );
		if ( $sconto > 0 ) {
			$righe[] = array( sprintf( 'Sconto %s%%', esc_html( $num( $pct ) ) ), '&minus; ' . wc_price( $sconto ), '#2E7D32' );
			$righe[] = array( 'Netto scontato', wc_price( $dopo ), '' );
		}
		if ( $imposta > 0 ) {
			$righe[] = array( sprintf( 'IVA %s%%', esc_html( $num( $aliq ) ) ), wc_price( $imposta ), '' );
		}
		$righe[] = array( 'Totale', wc_price( $totale ), '' );

		$html = '<div class="elitederma-riga-prodotto" style="margin-top:6px;font-size:.82em;line-height:1.5;opacity:.92;">';
		$ultima = count( $righe ) - 1;
		foreach ( $righe as $i => $r ) {
			$html .= sprintf(
				'<div style="display:flex;justify-content:space-between;gap:10px;%s"><span style="%s">%s</span><span style="white-space:nowrap;%s">%s</span></div>',
				$i === $ultima ? 'font-weight:700;border-top:1px solid rgba(0,0,0,.08);margin-top:3px;padding-top:3px;' : '',
				$r[2] ? 'color:' . esc_attr( $r[2] ) . ';' : '',
				wp_kses_post( $r[0] ),
				$r[2] ? 'color:' . esc_attr( $r[2] ) . ';' : '',
				wp_kses_post( $r[1] )
			);
		}
		$html .= '</div>';

		return $nome . $html;
	},
	20,
	3
);

// Carrello e checkout: sopra la riga del totale, dove il cliente guarda
// prima di pagare.
add_action( 'woocommerce_cart_totals_before_order_total', 'elitederma_dettaglio_totale' );
add_action( 'woocommerce_review_order_before_order_total', 'elitederma_dettaglio_totale' );
