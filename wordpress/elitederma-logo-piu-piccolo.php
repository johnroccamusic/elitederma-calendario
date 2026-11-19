<?php
/**
 * Plugin Name: Elitederma - Logo della barra piu' piccolo
 * Description: Porta il logo dell'intestazione a 25 px di altezza. Serve quando non si riesce a cambiare la misura scritta dentro l'header di LiveCanvas: questa regola vince su quella, senza toccare il template.
 * Version: 1.0
 * Author: Elitederma
 */

// PERCHE' ESISTE, E PERCHE' NON E' LA STRADA PREFERITA.
//
// La misura del logo e' scritta nell'header di LiveCanvas, dentro
// l'attributo `style` dell'immagine: `height:38px`. Cambiarla la' e' la
// cosa giusta — un posto solo, e chi legge l'HTML capisce perche' il
// logo e' grande cosi'.
//
// Questa regola invece la SCAVALCA da fuori. E' comoda quando
// nell'editor non si trova dove mettere le mani, ma lascia due
// dichiarazioni della stessa cosa: l'HTML dice 38 e la pagina mostra 25.
// Fra sei mesi, qualcuno che cambia il 38 nell'header vedra' che non
// succede niente, e non capira' perche'.
//
// Quindi: se riesci a correggere l'header, correggi l'header e togli
// questo snippet. Se non ci riesci, questo fa il lavoro.
//
// Il `!important` serve: una regola di foglio di stile, senza, perde
// sempre contro uno `style` scritto sul tag.

if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! defined( 'ELITEDERMA_LOGO_ALTEZZA' ) ) { define( 'ELITEDERMA_LOGO_ALTEZZA', 25 ); }

add_action( 'wp_head', 'elitederma_logo_piu_piccolo', 99 );

// La guardia e' per Code Snippets, non per PHP: salvando o attivando uno
// snippet lo esegue DUE volte nella stessa richiesta, e alla seconda la
// funzione risulta gia' dichiarata.
if ( ! function_exists( 'elitederma_logo_piu_piccolo' ) ) {
function elitederma_logo_piu_piccolo() {
	$h = (int) ELITEDERMA_LOGO_ALTEZZA;
	?>
<style id="ed-logo-misura">
/* il logo della barra: l'altezza la decide questa riga */
.navbar-brand img { height: <?php echo $h; ?>px !important; width: auto !important; }
</style>
	<?php
}
}
