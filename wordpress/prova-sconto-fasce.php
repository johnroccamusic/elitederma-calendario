<?php
/**
 * BANCO DI PROVA DELLO SNIPPET DELLO SCONTO. Non si installa: si lancia.
 *
 *     php wordpress/prova-sconto-fasce.php
 *
 * `php -l` dice solo che il file si legge. Qui dentro si finge quel
 * tanto di WooCommerce che serve — un coupon con le sue meta, un
 * prodotto con le sue, l'arrotondamento — e si controlla che lo sconto
 * esca in euro giusti. Questo snippet decide dei prezzi sul sito: una
 * regola sbagliata non da' nessun errore, si vede dagli ordini.
 */

define( 'ABSPATH', __DIR__ );
function add_filter() { return true; }
function add_action() { return true; }
function wc_get_rounding_precision() { return 2; }
function has_term() { return false; }
function wc_get_price_excluding_tax( $p, $a = array() ) { return $p->netto; }
function WC() { return null; }

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

require __DIR__ . '/elitederma-sconto-fasce.php';

$errori = 0;
function controlla( $titolo, $atteso, $avuto ) {
	global $errori;
	$ok = abs( (float) $atteso - (float) $avuto ) < 0.005;
	if ( ! $ok ) { $errori++; }
	printf( "%s %s — atteso %.2f, avuto %.2f\n", $ok ? 'ok  ' : 'NO  ', $titolo, $atteso, $avuto );
}

// il coupon al 30% su un tetto di 50 = frazione 0,6
$coupon = new FintoCoupon( array( '_ed_frazione_cedibile' => '0.6' ) );
$riga = function ( $prodotto, $qta = 1 ) { return array( 'data' => $prodotto, 'quantity' => $qta ); };

// ARIZONA: cede il 50% → 30% di 44,90 = 13,47
$arizona = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '50.0' ), 36.80 );
controlla( 'Arizona, cedibile 50%', 13.47,
	elitederma_sconto_a_fasce( 0, 44.90, $riga( $arizona ), true, $coupon ) );

// KIT LAMINAZIONE: cede il 14,7% → 8,82% di 234,90 = 20,72
$kit = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '14.7' ), 192.54 );
controlla( 'Kit laminazione, cedibile 14,7%', 20.72,
	elitederma_sconto_a_fasce( 0, 234.90, $riga( $kit ), true, $coupon ) );

// N2 FIXA: cede zero → nessuno sconto
$fixa = new FintoProdotto( array( '_ed_cedibile_riv_pct' => '0' ), 20.33 );
controlla( 'N2 Fixa, nessun margine', 0.00,
	elitederma_sconto_a_fasce( 0, 24.80, $riga( $fixa ), true, $coupon ) );

// SENZA IL CEDIBILE SCRITTO: non si sconta. E' la regola del banco — non
// si regala qualcosa di cui non si sa quanto vale.
$ignoto = new FintoProdotto( array(), 50.00 );
controlla( 'prodotto senza cedibile scritto', 0.00,
	elitederma_sconto_a_fasce( 0, 61.00, $riga( $ignoto ), true, $coupon ) );

// DUE PEZZI, riga intera: la percentuale e' sul lordo della riga, quindi
// `importo_da_scontare` porta gia' la quantita'
controlla( 'Arizona per due pezzi', 26.94,
	elitederma_sconto_a_fasce( 0, 89.80, $riga( $arizona, 2 ), false, $coupon ) );

// UN COUPON FORZATO NON ARRIVA QUI: la frazione non viene scritta, e lo
// sconto torna quello che WooCommerce fa da se'.
$forzato = new FintoCoupon( array() );
controlla( 'coupon senza contrassegni: WooCommerce decide', 7.44,
	elitederma_sconto_a_fasce( 7.44, 24.80, $riga( $fixa ), true, $forzato ) );

// frazione a zero = tabella spenta, non "sconta tutto"
$spento = new FintoCoupon( array( '_ed_frazione_cedibile' => '0' ) );
controlla( 'frazione a zero', 0.00,
	elitederma_sconto_a_fasce( 0, 44.90, $riga( $arizona ), true, $spento ) );

// IL CASO DELLE MASTER NON SI E' MOSSO: cede la sua quota del cedibile
// in euro, e la quota del reparto vince su quella generale.
$master = new FintoCoupon( array( '_ed_quota_master' => json_encode( array( 'generale' => 10, 'reparti' => array( 'LAMINAZIONE' => 20 ) ) ) ) );
$kitMaster = new FintoProdotto( array( '_ed_cedibile_eur' => '28.30', '_ed_blocco' => 'LAMINAZIONE' ), 192.54 );
controlla( 'master, 20% di 28,30 cedibili', 5.66,
	elitederma_sconto_a_fasce( 0, 234.90, $riga( $kitMaster ), true, $master ) );

echo $errori === 0 ? "\nTutto a posto.\n" : "\n$errori controlli falliti.\n";
exit( $errori === 0 ? 0 : 1 );
