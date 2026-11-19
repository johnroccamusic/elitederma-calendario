<?php
/**
 * Plugin Name: Elitederma - Logo della barra, due misure
 * Description: Il logo dell'intestazione con una misura per il computer e una per il telefono. Serve perche' un attributo `style` scritto sul tag non puo' avere punti di rottura: una misura sola vale ovunque, e quella giusta sul monitor e' troppo grande sul telefono.
 * Version: 1.0
 * Author: Elitederma
 */

// ---------------------------------------------------------------------
// PERCHE' QUESTO SNIPPET ESISTE, E PERCHE' QUI NON E' UN RIPIEGO.
//
// La misura del logo e' scritta nell'header di LiveCanvas, dentro
// l'attributo `style` dell'immagine. Un attributo inline pero' NON PUO'
// avere punti di rottura: non esiste un modo di scriverci «25 sul
// computer e 20 sul telefono». E' un limite del linguaggio, non
// dell'editor — nessuna casella di LiveCanvas lo aggira.
//
// Quindi due misure si possono dare solo da un foglio di stile, ed e'
// questo. Il `!important` serve perche' una regola di foglio, senza,
// perde sempre contro uno `style` scritto sul tag.
//
// CONSEGUENZA DA SAPERE: da adesso la misura la decide QUESTO file, e
// quella scritta nell'header non comanda piu'. Lasciala uguale a
// ELITEDERMA_LOGO_DESKTOP: cosi' le due non si contraddicono a vista, e
// se un giorno questo snippet venisse tolto il logo resterebbe della
// misura giusta invece di saltare.
// ---------------------------------------------------------------------

// quanto e' alto il logo, in pixel.
if ( ! defined( 'ELITEDERMA_LOGO_DESKTOP' ) ) { define( 'ELITEDERMA_LOGO_DESKTOP', 25 ); }
if ( ! defined( 'ELITEDERMA_LOGO_MOBILE' ) )  { define( 'ELITEDERMA_LOGO_MOBILE', 20 ); }

// SOTTO QUANTO VALE LA MISURA DEL TELEFONO.
// 576 e non 992, che e' dove la barra si trasforma nel menu' a panino:
// fra i due c'e' il tablet, dove di spazio ce n'e' in abbondanza e il
// logo piccolo sembrerebbe solo sbagliato. Il punto in cui il logo
// diventa una fetta grossa della larghezza e' il telefono.
if ( ! defined( 'ELITEDERMA_LOGO_SOGLIA' ) )  { define( 'ELITEDERMA_LOGO_SOGLIA', 576 ); }

if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'wp_head', 'elitederma_logo_due_misure', 99 );

// La guardia e' per Code Snippets, non per PHP: salvando o attivando uno
// snippet lo esegue DUE volte nella stessa richiesta, e alla seconda la
// funzione risulta gia' dichiarata. Senza, lo snippet non si accende.
if ( ! function_exists( 'elitederma_logo_due_misure' ) ) {
function elitederma_logo_due_misure() {
	$d = (int) ELITEDERMA_LOGO_DESKTOP;
	$m = (int) ELITEDERMA_LOGO_MOBILE;
	// 0,02 sotto la soglia: i due intervalli non si devono sovrapporre
	// nemmeno per mezzo pixel, o a quella larghezza esatta valgono tutte
	// e due le regole e a decidere e' l'ordine in cui sono scritte.
	$s = (float) ELITEDERMA_LOGO_SOGLIA - 0.02;
	?>
<style id="ed-logo-misure">
/* il logo della barra: l'altezza la decidono queste due righe */
.navbar-brand img { height: <?php echo $d; ?>px !important; width: auto !important; }
@media (max-width: <?php echo $s; ?>px) {
  .navbar-brand img { height: <?php echo $m; ?>px !important; }
}
</style>
	<?php
}
}
