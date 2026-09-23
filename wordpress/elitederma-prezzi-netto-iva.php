<?php
/**
 * Elitederma — il prezzo spiegato: netto, sconto, netto scontato, IVA
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui ovunque". Non serve toccare il tema.
 *
 * COSA FA
 * Sotto il prezzo di ogni prodotto aggiunge un riquadrino con:
 *
 *   Prezzo netto                     32,70 €
 *   Sconto codice AULA25  −8,5%     − 2,78 €
 *   Netto scontato                   29,92 €
 *   Totale con IVA 22%               36,50 €
 *
 * Le due righe dello sconto compaiono solo se nel carrello c'è davvero
 * un codice attivo, e solo se è uno sconto in percentuale: uno sconto a
 * importo fisso vale sul carrello intero e non si può spalmare su un
 * prodotto senza inventarsi come.
 *
 * I prezzi li chiede a WooCommerce (wc_get_price_excluding_tax /
 * including_tax): così l'aliquota è quella vera del prodotto, anche se
 * un domani qualcuno ne avrà una diversa dal 22%. Niente divisioni per
 * 1,22 scritte a mano.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Il codice sconto attivo adesso, se è in percentuale.
 *
 * Torna [ 'codice' => 'AULA25', 'percentuale' => 8.5 ] oppure null.
 * Il carrello non esiste sempre (richieste REST, cron, pagine servite
 * dalla cache prima che la sessione parta): senza, non si sconta nulla.
 */
function elitederma_coupon_percentuale_attivo() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return null;
	}
	foreach ( WC()->cart->get_applied_coupons() as $codice ) {
		$coupon = new WC_Coupon( $codice );
		if ( 'percent' !== $coupon->get_discount_type() ) {
			continue;
		}
		$pct = (float) $coupon->get_amount();
		if ( $pct > 0 ) {
			return array( 'codice' => strtoupper( $codice ), 'percentuale' => $pct );
		}
	}
	return null;
}

/** Una riga del riquadro: etichetta a sinistra, importo a destra. */
function elitederma_riga_prezzo( $etichetta, $importo, $forte = false, $colore = '' ) {
	printf(
		'<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;%s">'
			. '<span style="%s">%s</span><span style="white-space:nowrap;%s">%s</span></div>',
		$forte ? 'border-top:1px solid rgba(0,0,0,.08);margin-top:4px;padding-top:6px;' : '',
		$colore ? 'color:' . esc_attr( $colore ) . ';' : '',
		wp_kses_post( $etichetta ),
		( $forte ? 'font-weight:700;' : '' ) . ( $colore ? 'color:' . esc_attr( $colore ) . ';' : '' ),
		wp_kses_post( $importo )
	);
}

/**
 * Il riquadro sotto il prezzo, nella scheda del prodotto.
 *
 * Un prodotto con varianti ha un prezzo solo quando la variante è
 * scelta: sul padre il riquadro non compare, perché direbbe il prezzo
 * della taglia più economica spacciandolo per quello scelto.
 */
add_action(
	'woocommerce_single_product_summary',
	function () {
		global $product;
		if ( ! $product instanceof WC_Product || $product->is_type( 'variable' ) || $product->is_type( 'grouped' ) ) {
			return;
		}
		$netto = (float) wc_get_price_excluding_tax( $product );
		$lordo = (float) wc_get_price_including_tax( $product );
		if ( $netto <= 0 ) {
			return;
		}
		// l'aliquota vera del prodotto, ricavata dai due prezzi: così non
		// c'è un 22 scritto da nessuna parte che un giorno sarà sbagliato
		$aliquota = $netto > 0 ? round( ( ( $lordo / $netto ) - 1 ) * 100, 1 ) : 0;

		$coupon = elitederma_coupon_percentuale_attivo();
		$sconto = $coupon ? round( $netto * $coupon['percentuale'] / 100, 2 ) : 0;
		$netto_scontato = round( $netto - $sconto, 2 );
		$iva = round( $netto_scontato * $aliquota / 100, 2 );
		$totale = round( $netto_scontato + $iva, 2 );

		echo '<div class="elitederma-prezzo-dettaglio" style="margin:.75em 0 1em;padding:12px 14px;border:1px solid rgba(0,0,0,.10);border-radius:10px;font-size:.92em;line-height:1.5;max-width:360px;">';
		elitederma_riga_prezzo( 'Prezzo netto', wc_price( $netto ) );
		if ( $coupon ) {
			elitederma_riga_prezzo(
				sprintf( 'Sconto codice %s &minus;%s%%', esc_html( $coupon['codice'] ), esc_html( rtrim( rtrim( number_format_i18n( $coupon['percentuale'], 2 ), '0' ), ',' ) ) ),
				'&minus; ' . wc_price( $sconto ),
				false,
				'#2E7D32'
			);
			elitederma_riga_prezzo( 'Netto scontato', wc_price( $netto_scontato ) );
		}
		elitederma_riga_prezzo( sprintf( 'IVA %s%%', esc_html( rtrim( rtrim( number_format_i18n( $aliquota, 1 ), '0' ), ',' ) ) ), wc_price( $iva ) );
		elitederma_riga_prezzo( 'Totale', wc_price( $totale ), true );
		echo '</div>';
	},
	11
);
