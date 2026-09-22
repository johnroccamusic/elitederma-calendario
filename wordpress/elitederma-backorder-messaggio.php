<?php
/**
 * Elitederma — il messaggio del back order al posto della disponibilità
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui ovunque". Non serve toccare il tema.
 *
 * COSA FA
 * Quando un prodotto è a zero pezzi ma è ordinabile lo stesso (in
 * WooCommerce: "Consenti ordini arretrati"), WooCommerce scrive "Ordine
 * arretrato disponibile" — una frase che al cliente non dice niente.
 * Questo snippet ci mette al suo posto il testo scritto nel gestionale,
 * che viaggia sul prodotto come meta "_elitederma_backorder_messaggio":
 * per esempio "Disponibile in circa 4 giorni lavorativi".
 *
 * Con i pezzi in casa non cambia niente: la disponibilità resta quella
 * di sempre. Il messaggio compare SOLO quando la giacenza è finita, ed è
 * al posto dell'indicazione di disponibilità, non in aggiunta: nessuno
 * deve leggere "0 disponibili" e sotto un invito a ordinare.
 *
 * Chi scrive quella meta è il gestionale, salvando la scheda prodotto:
 * qui non si tocca nulla a mano.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ELITEDERMA_BACKORDER_META = '_elitederma_backorder_messaggio';

/**
 * Il testo da mostrare per questo prodotto, o '' se non ce n'è uno.
 *
 * Una variazione eredita il testo del prodotto padre quando non ne ha
 * uno suo: il gestionale scrive sul padre, e senza questo le varianti
 * resterebbero con la frase di WooCommerce.
 */
function elitederma_backorder_testo( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return '';
	}
	$testo = trim( (string) $product->get_meta( ELITEDERMA_BACKORDER_META ) );
	if ( '' === $testo && $product->get_parent_id() ) {
		$padre = wc_get_product( $product->get_parent_id() );
		if ( $padre ) {
			$testo = trim( (string) $padre->get_meta( ELITEDERMA_BACKORDER_META ) );
		}
	}
	return $testo;
}

/**
 * Siamo nel caso "zero pezzi, ma si ordina lo stesso"?
 *
 * Si guarda lo stato calcolato da WooCommerce e non solo la giacenza:
 * con la gestione scorte spenta la quantità è null, e un confronto con
 * zero direbbe di sì a sproposito su tutto il catalogo.
 */
function elitederma_backorder_in_corso( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return false;
	}
	if ( 'onbackorder' === $product->get_stock_status() ) {
		return true;
	}
	$quantita = $product->get_stock_quantity();
	return $product->managing_stock() && null !== $quantita && $quantita <= 0 && $product->backorders_allowed();
}

/**
 * Sostituisce testo e classe della riga di disponibilità.
 *
 * Si filtra l'array intero e non il solo testo perché la classe decide
 * il colore: lasciata a "out-of-stock" il messaggio uscirebbe rosso, e
 * un "arriva fra quattro giorni" scritto in rosso si legge come un
 * problema invece che come una promessa.
 */
add_filter(
	'woocommerce_get_availability',
	function ( $availability, $product ) {
		if ( ! elitederma_backorder_in_corso( $product ) ) {
			return $availability;
		}
		$testo = elitederma_backorder_testo( $product );
		if ( '' === $testo ) {
			return $availability;
		}
		$availability['availability'] = $testo;
		$availability['class']        = 'available-on-backorder elitederma-backorder';
		return $availability;
	},
	20,
	2
);

/**
 * La stessa frase anche sulle tessere dell'elenco (shop, categorie,
 * ricerca), sotto il prezzo: è lì che il cliente decide se aprire la
 * scheda, e senza questo un prodotto finito sembra uguale agli altri
 * fino a un clic dopo.
 */
add_action(
	'woocommerce_after_shop_loop_item_title',
	function () {
		global $product;
		if ( ! elitederma_backorder_in_corso( $product ) ) {
			return;
		}
		$testo = elitederma_backorder_testo( $product );
		if ( '' === $testo ) {
			return;
		}
		printf(
			'<p class="elitederma-backorder-loop" style="margin:.25em 0 .5em;font-size:.85em;font-weight:600;color:#8a6d1f;">%s</p>',
			esc_html( $testo )
		);
	},
	11
);
