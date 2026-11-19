<?php
/**
 * BANCO DI PROVA DEI DUE SNIPPET INSIEME. Non si installa: si lancia.
 *
 *     php wordpress/prova-sconto-progressivo.php
 *
 * Riproduce la situazione VERA del sito: lo snippet dello sconto a fasce
 * gira a priorita' 10 e quello progressivo a 20. Si controlla che il
 * secondo corregga solo i coupon del listino e lasci intatti tutti gli
 * altri — perche' il modo di sbagliare qui e' scontare due volte, o
 * rompere i codici delle master che funzionavano.
 */

define( 'ABSPATH', __DIR__ );
function wc_get_rounding_precision() { return 2; }
function has_term() { return false; }
function wc_get_price_excluding_tax( $p, $a = array() ) { return $p->netto; }
function wc_get_product( $id ) { return null; }
function WC() { return null; }

// una catena di filtri in miniatura: si registrano con la loro priorita'
// e si chiamano in ordine, passando il risultato del precedente — e'
// quello che fa WordPress
$GLOBALS['filtri'] = array();
function add_filter( $hook, $fn, $priorita = 10, $n = 1 ) {
	$GLOBALS['filtri'][] = array( 'hook' => $hook, 'fn' => $fn, 'p' => $priorita );
	return true;
}
function add_action() { return true; }
function applica_filtri( $hook, $valore, ...$resto ) {
	$miei = array_filter( $GLOBALS['filtri'], fn( $f ) => $f['hook'] === $hook );
	usort( $miei, fn( $a, $b ) => $a['p'] <=> $b['p'] );
	foreach ( $miei as $f ) {
		$valore = call_user_func( $f['fn'], $valore, ...$resto );
	}
	return $valore;
}

class FintoCoupon {
	private $meta;
	public function __construct( $meta ) { $this->meta = $meta; }
	public function get_meta( $k ) { return array_key_exists( $k, $this->meta ) ? $this->meta[ $k ] : ''; }
}
class FintoProdotto {
	public $meta; public $netto;
	public function __construct( $meta, $netto = 0 ) { $this->meta = $meta; $this->netto = $netto; }
	public function get_meta( $k, $single = true ) { return array_key_exists( $k, $this->meta ) ? $this->meta[ $k ] : ''; }
	public function get_parent_id() { return 0; }
	public function get_id() { return 1; }
}

// i due snippet, nell'ordine in cui WordPress li carica
require __DIR__ . '/elitederma-sconto-fasce.php';
require __DIR__ . '/elitederma-sconto-progressivo.php';

$errori = 0;
function controlla( $titolo, $atteso, $avuto ) {
	global $errori;
	$ok = abs( (float) $atteso - (float) $avuto ) < 0.005;
	if ( ! $ok ) { $errori++; }
	printf( "%s %-52s atteso %7.2f  avuto %7.2f\n", $ok ? 'ok  ' : 'NO  ', $titolo, $atteso, $avuto );
}
function sconto( $importo, $prodotto, $coupon, $singolo = true, $qta = 1 ) {
	return applica_filtri(
		'woocommerce_coupon_get_discount_amount',
		// il punto di partenza: la percentuale piatta che WooCommerce
		// applicherebbe da se'. Qui si finge il 15,36% di BLACK26
		round( $importo * 0.1536, 2 ),
		$importo,
		array( 'data' => $prodotto, 'quantity' => $qta ),
		$singolo,
		$coupon
	);
}

// i tre prodotti veri, con le meta che il sito ha ADESSO
$arizona = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '50', '_ed_cedibile_eur' => '18.4', '_ed_margine_pct' => '72.83', '_ed_blocco' => '1' ), 36.80 );
$kit     = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '14.7', '_ed_cedibile_eur' => '28.3', '_ed_margine_pct' => '', '_ed_blocco' => '7' ), 192.54 );
$fixa    = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '0', '_ed_cedibile_eur' => '0', '_ed_margine_pct' => '31.48', '_ed_blocco' => '7' ), 20.33 );
$ignoto  = new FintoProdotto( array( '_ed_margine_pct' => '40' ), 50.00 );

echo "\n--- BLACK26: tetto 20% su un tetto di 50 = frazione 0,4 ---\n";
$black = new FintoCoupon( array( '_ed_frazione_cedibile' => '0.4' ) );
controlla( 'Arizona, cede 50% -> 20% di 44,90', 8.98, sconto( 44.90, $arizona, $black ) );
controlla( 'Kit laminazione, cede 14,7% -> 5,88%', 13.81, sconto( 234.90, $kit, $black ) );
controlla( 'N2 Fixa, nessun margine -> ZERO', 0.00, sconto( 24.80, $fixa, $black ) );
controlla( 'prodotto fuori dal listino -> ZERO', 0.00, sconto( 61.00, $ignoto, $black ) );
controlla( 'Arizona per due pezzi, riga intera', 17.96, sconto( 89.80, $arizona, $black, false, 2 ) );

echo "\n--- GLI ALTRI CODICI NON SI DEVONO MUOVERE ---\n";
// a fasce: decide lo snippet vecchio, il nuovo non interviene
$fasce = new FintoCoupon( array( '_ed_fasce_sconto' => json_encode( array(
	array( 'a' => 35, 'percentuale' => 4 ),
	array( 'a' => 60, 'percentuale' => 7 ),
	array( 'percentuale' => 10 ),
) ) ) );
controlla( 'a fasce su Arizona (margine 72,8% -> 10%)', 4.49, sconto( 44.90, $arizona, $fasce ) );
controlla( 'a fasce su N2 Fixa (margine 31,5% -> 4%)', 0.99, sconto( 24.80, $fixa, $fasce ) );

// acquisto master: cede una quota del cedibile in euro
$master = new FintoCoupon( array( '_ed_quota_master' => json_encode( array( 'generale' => 30, 'reparti' => array( '7' => 55 ) ) ) ) );
controlla( 'master, 55% di 28,30 cedibili sul Kit', 15.57, sconto( 234.90, $kit, $master ) );
controlla( 'master, 30% di 18,40 cedibili su Arizona', 5.52, sconto( 44.90, $arizona, $master ) );

// un coupon senza nessun contrassegno: decide WooCommerce, nessuno tocca
$nudo = new FintoCoupon( array() );
controlla( 'coupon nudo: resta il 15,36% di WooCommerce', 6.90, sconto( 44.90, $arizona, $nudo ) );

echo "\n--- E LA FRAZIONE A ZERO NON VUOL DIRE SCONTO PIENO ---\n";
$spento = new FintoCoupon( array( '_ed_frazione_cedibile' => '0' ) );
controlla( 'frazione a zero -> niente sconto', 0.00, sconto( 44.90, $arizona, $spento ) );

echo $errori === 0 ? "\nTutto a posto.\n" : "\n$errori controlli falliti.\n";
exit( $errori === 0 ? 0 : 1 );
