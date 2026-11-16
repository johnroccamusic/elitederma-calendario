<?php
/**
 * Plugin Name: Elitederma - I punti sulla scheda prodotto
 * Description: Sotto il prezzo di ogni scheda prodotto scrive quanti punti fedelta' vale quel prodotto. Il numero lo chiede al plugin dei punti: se il plugin e' spento, o se quel prodotto non ne da', non compare niente.
 * Version: 1.0
 * Author: Elitederma
 */

// Perche' passa dal SUFFISSO DEL PREZZO e non da un hook del catalogo.
//
// Sulle schede di elitederma.shop la riga «32,70 EUR netto» non la
// stampa nessun hook: e' il «suffisso prezzo» di WooCommerce
// (Impostazioni -> Imposte -> Visualizzazione suffisso prezzo), scritto
// come «{price_excluding_tax} netto». E' per questo che compare su
// TUTTE le schede — quelle costruite con LiveCanvas e gli archivi di
// WooCommerce, che sono due pagine disegnate da due programmi diversi.
//
// Un hook del catalogo (woocommerce_after_shop_loop_item_title) vive
// solo dentro il ciclo di WooCommerce: sulle pagine LiveCanvas non lo
// chiama nessuno, e i punti comparirebbero su meta' del negozio senza
// che nessuno capisca perche'. Il suffisso invece viaggia attaccato al
// prezzo: dove c'e' un prezzo, c'e'.
//
// IL NUMERO NON LO CALCOLIAMO NOI, LO CHIEDIAMO AL PLUGIN.
// La regola misurata il 16/11/2026 sui 1.325 ordini veri e' «1 punto
// ogni 10 EUR di netto, riga per riga, arrotondato per difetto», ma chi
// assegna i punti e' YITH, e YITH ammette eccezioni per prodotto e per
// categoria. Una scheda che promette 4 punti mentre il plugin ne
// riconosce 3 e' peggio di una scheda che non dice niente. Quindi: si
// prova a chiederlo al plugin, e solo se il plugin non risponde si
// ricade sulla regola generale, con il tasto scritto in UN POSTO SOLO
// qui sotto.
//
// E se il plugin e' SPENTO non si scrive niente: oggi (16/11/2026) lo
// e', e una scheda che promette punti che nessuno accumula piu' e' una
// promessa falsa.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Il ripiego, usato solo se il plugin non risponde: quanti euro di
// NETTO fanno un punto. Un posto solo: se un giorno il tasso cambia
// nelle impostazioni di YITH, qui si allinea e basta.
if ( ! defined( 'ELITEDERMA_EURO_PER_PUNTO' ) ) {
	define( 'ELITEDERMA_EURO_PER_PUNTO', 10 );
}

// La guardia c'e' per Code Snippets, non per PHP: quando salva o accende
// uno snippet lo esegue DUE volte nella stessa richiesta, e alla seconda
// la funzione risulta gia' dichiarata.
if ( ! function_exists( 'elitederma_punti_del_prodotto' ) ) {
function elitederma_punti_del_prodotto( $prodotto ) {

	if ( ! $prodotto instanceof WC_Product ) { return 0; }

	// Il plugin c'e'? Se e' spento non esiste la funzione. In quel caso
	// si esce — nessuna promessa a un cliente — TRANNE che per chi
	// amministra, a cui si fa vedere l'anteprima: senza, chi installa
	// questo snippet non ha nessun modo di sapere se funziona, perche'
	// una pagina muta e una pagina rotta si assomigliano.
	if ( ! function_exists( 'YITH_WC_Points_Rewards' ) ) {
		return elitederma_punti_anteprima() ? elitederma_punti_dal_netto( $prodotto ) : 0;
	}

	$plugin = YITH_WC_Points_Rewards();

	// I nomi con cui YITH ha chiamato questo conto nelle sue versioni.
	// Si prova in ordine e ci si ferma al primo che esiste davvero: non
	// si indovina una firma, si guarda se il metodo c'e'.
	foreach ( array( 'get_points_earned_by_product', 'calculate_points_earned_by_product', 'get_product_points' ) as $metodo ) {
		if ( is_object( $plugin ) && method_exists( $plugin, $metodo ) ) {
			$punti = $plugin->$metodo( $prodotto );
			if ( is_numeric( $punti ) ) { return max( 0, (int) $punti ); }
			// alcune versioni vogliono l'id invece dell'oggetto
			$punti = $plugin->$metodo( $prodotto->get_id() );
			if ( is_numeric( $punti ) ) { return max( 0, (int) $punti ); }
		}
	}

	return elitederma_punti_dal_netto( $prodotto );
}
}

// Il ripiego: la regola generale sul prezzo NETTO. Netto e non lordo
// perche' e' quello il numero su cui il plugin conta — misurato: 5
// pigmenti da 32,70 netti hanno fatto 3 punti l'uno, 15 in tutto.
if ( ! function_exists( 'elitederma_punti_dal_netto' ) ) {
function elitederma_punti_dal_netto( $prodotto ) {
	$netto = (float) wc_get_price_excluding_tax( $prodotto );
	if ( $netto <= 0 ) { return 0; }
	return (int) floor( $netto / ELITEDERMA_EURO_PER_PUNTO );
}
}

// Chi vede l'anteprima quando il plugin dei punti e' spento: solo chi
// puo' accendere i plugin. Le pagine in cache non si servono a chi ha
// fatto accesso (ne' Breeze ne' Varnish le danno a un utente loggato),
// quindi questa riga non finisce addosso a un cliente.
if ( ! function_exists( 'elitederma_punti_anteprima' ) ) {
function elitederma_punti_anteprima() {
	return is_user_logged_in() && current_user_can( 'manage_options' );
}
}

if ( ! function_exists( 'elitederma_punti_nel_suffisso' ) ) {
function elitederma_punti_nel_suffisso( $html, $prodotto, $prezzo, $quantita ) {

	// Nel carrello e al checkout no: li' il prezzo di una riga lo spiega
	// gia' il blocco «il prezzo spiegato nel carrello», e due voci che
	// parlano sopra lo stesso numero si leggono come un difetto.
	if ( is_cart() || is_checkout() ) { return $html; }

	$punti = elitederma_punti_del_prodotto( $prodotto );

	// Zero punti non si scrive. Un prodotto sotto i 10 EUR netti non ne
	// da' nessuno, ed e' giusto cosi': «guadagni 0 punti» su una scheda
	// e' peggio di una scheda che tace.
	if ( $punti < 1 ) { return $html; }

	// Un prodotto a prezzo variabile mostra il prezzo PIU' BASSO, quindi
	// questo e' il minimo che quel prodotto vale: si scrive «da».
	$da = $prodotto->is_type( 'variable' ) ? 'da ' : '';

	$testo = sprintf(
		/* translators: %s = quanti punti */
		_n( '%s punto fedelta&#768;', '%s punti fedelta&#768;', $punti, 'elitederma' ),
		$da . $punti
	);

	// Quando la raccolta e' spenta e sta guardando chi amministra, la
	// riga deve DIRE che e' una prova: un numero che sembra vero su un
	// negozio in cui i punti non si accumulano piu' e' una bugia anche
	// se la legge una persona sola.
	$classe = 'ed-punti-prodotto';
	if ( ! function_exists( 'YITH_WC_Points_Rewards' ) ) {
		$classe .= ' ed-punti-anteprima';
		$testo  .= ' <em>(anteprima: la raccolta e&#768; spenta)</em>';
	}

	return $html . '<span class="' . $classe . '">' . $testo . '</span>';
}
}
add_filter( 'woocommerce_get_price_suffix', 'elitederma_punti_nel_suffisso', 10, 4 );

// Lo stile: la stessa famiglia della riga «netto» che sta sopra — oro
// spento, piccola, una riga sua. Sta qui e non nel CSS del tema perche'
// e' lo stile di QUESTA riga: spento lo snippet, non resta una regola
// orfana nel foglio di stile che nessuno sa piu' a cosa serviva.
if ( ! function_exists( 'elitederma_punti_stile' ) ) {
function elitederma_punti_stile() {
	if ( is_cart() || is_checkout() ) { return; }
	$css = '.ed-punti-prodotto{display:block;font-size:.62rem;font-weight:600;'
		. 'letter-spacing:.02em;color:#a5813f;margin-top:.12rem;}'
		. '.ed-punti-prodotto::before{content:"\\2726";margin-right:.28em;opacity:.75;}'
		. '.ed-punti-anteprima{color:#9a9a9a;}'
		. '.ed-punti-anteprima em{font-style:normal;font-weight:400;opacity:.8;}';
	wp_register_style( 'elitederma-punti', false );
	wp_enqueue_style( 'elitederma-punti' );
	wp_add_inline_style( 'elitederma-punti', $css );
}
}
add_action( 'wp_enqueue_scripts', 'elitederma_punti_stile' );
