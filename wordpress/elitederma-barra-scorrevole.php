<?php
/**
 * Plugin Name: Elitederma - Barra scorrevole Black Friday
 * Description: La striscia nera con la scritta che scorre. Si accende e si spegne DA SOLA alle date scritte qui dentro, perche' a decidere e' l'orologio di chi guarda e non il server: cosi' non serve svuotare la cache ne' per accenderla ne' per spegnerla.
 * Version: 1.0
 * Author: Elitederma
 */

// ---------------------------------------------------------------------
// QUELLO CHE SI CAMBIA STA TUTTO QUI.
//
// LE DATE le legge il BROWSER DI CHI GUARDA, non il server: ogni pagina
// di questo sito arriva dalla copia di Cloudflare con trenta giorni di
// validita' (misurato: s-maxage=2592000), quindi una striscia accesa dal
// server resterebbe accesa per settimane dopo la fine. Scritta cosi'
// invece e' sempre nella pagina e si mostra solo nella finestra giusta.
//
// DOVE:
//   'header' = subito sotto la barra del sito. E' il posto giusto: la
//              vede chiunque entri, non copre niente, e scorre via con
//              la pagina.
//   'fondo'  = incollata in fondo allo schermo, sempre visibile. Copre
//              una fascia, quindi ha la crocetta.
//   'coda'   = in fondo alla pagina, dopo il footer.
// ---------------------------------------------------------------------
if ( ! defined( 'ELITEDERMA_BARRA_DA' ) )     { define( 'ELITEDERMA_BARRA_DA', '2026-11-19T00:00:00+01:00' ); }
if ( ! defined( 'ELITEDERMA_BARRA_A' ) )      { define( 'ELITEDERMA_BARRA_A',  '2026-12-01T23:59:59+01:00' ); }
if ( ! defined( 'ELITEDERMA_BARRA_TESTO' ) )  { define( 'ELITEDERMA_BARRA_TESTO', 'ELITEDERMA BLACK FRIDAY dal 19/11 al 01/12' ); }
if ( ! defined( 'ELITEDERMA_BARRA_DOVE' ) )   { define( 'ELITEDERMA_BARRA_DOVE', 'header' ); }
// quanti secondi impiega la scritta a fare un giro intero. Piu' alto =
// piu' lenta. Sotto i 18 diventa difficile da leggere, e una scritta che
// non si legge e' un fastidio e basta.
if ( ! defined( 'ELITEDERMA_BARRA_GIRO' ) )   { define( 'ELITEDERMA_BARRA_GIRO', 26 ); }
// QUANTO E' ALTA la striscia, in pixel. Il corpo della scritta lo segue
// da se', cosi' il numero da toccare resta uno solo: alzando l'altezza
// senza alzare il testo si otterrebbe una fascia nera con dentro una
// scritta piccola in mezzo al vuoto.
//
// Sotto i 22 px la scritta diventa un filo, e una cosa che non si legge
// e' solo una riga nera di troppo.
if ( ! defined( 'ELITEDERMA_BARRA_ALTEZZA' ) ) { define( 'ELITEDERMA_BARRA_ALTEZZA', 26 ); }
// IL FONT: Jost, geometrico alla Futura, scelto dal titolare il 19/11/2026.
// Il sito non ce l'ha, quindi va scaricato: una richiesta in piu' su ogni
// pagina, per i giorni della promozione. Si carica dalla TESTA della
// pagina e non da qui in fondo, o il browser disegnerebbe la striscia
// due volte — una col font di ripiego e una con Jost — e si vedrebbe il
// salto proprio mentre la scritta scorre.
//
// `display=swap` e' deliberato: finche' Jost non e' arrivato la scritta
// si legge comunque, col font di sistema. Il contrario (`block`) la
// terrebbe invisibile per un attimo su una striscia che dura pochi
// secondi sullo schermo.
if ( ! defined( 'ELITEDERMA_BARRA_FONT' ) )    { define( 'ELITEDERMA_BARRA_FONT', 'Jost' ); }
if ( ! defined( 'ELITEDERMA_BARRA_PESO' ) )    { define( 'ELITEDERMA_BARRA_PESO', 600 ); }
// si puo' chiudere? Solo quando sta incollata in fondo allo schermo: la'
// copre qualcosa, e chi non la vuole deve poterla togliere. Sotto
// l'header e in coda alla pagina non copre niente e scorre via da se':
// la crocetta sarebbe un tasto che non serve a nessuno.
if ( ! defined( 'ELITEDERMA_BARRA_CHIUDIBILE' ) ) { define( 'ELITEDERMA_BARRA_CHIUDIBILE', true ); }

if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'wp_head', 'elitederma_barra_font', 5 );
add_action( 'wp_footer', 'elitederma_barra_scorrevole', 98 );

if ( ! function_exists( 'elitederma_barra_font' ) ) {
function elitederma_barra_font() {
	$famiglia = str_replace( ' ', '+', ELITEDERMA_BARRA_FONT );
	$peso     = (int) ELITEDERMA_BARRA_PESO;
	?>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=<?php echo esc_attr( $famiglia ); ?>:wght@<?php echo $peso; ?>&amp;display=swap">
	<?php
}
}

// La guardia e' per Code Snippets, non per PHP: salvando o attivando uno
// snippet lo esegue DUE volte nella stessa richiesta, e alla seconda la
// funzione risulta gia' dichiarata. Senza, lo snippet non si accende.
if ( ! function_exists( 'elitederma_barra_scorrevole' ) ) {
function elitederma_barra_scorrevole() {

	$dove  = ELITEDERMA_BARRA_DOVE;
	$fondo = $dove === 'fondo';
	$testo = ELITEDERMA_BARRA_TESTO;
	// La scritta si ripete QUATTRO volte, e non e' per capriccio: perche'
	// il giro sia senza salto il nastro deve essere lungo il doppio dello
	// schermo e scorrere esattamente di meta'. Con una ripetizione sola,
	// su un monitor largo, si vedrebbe il vuoto fra la fine e l'inizio.
	$pezzo = '<span class="ed-barra__voce">' . esc_html( $testo ) . '</span><span class="ed-barra__rombo" aria-hidden="true">&#9670;</span>';
	?>
<div id="ed-barra" class="ed-barra ed-barra--<?php echo esc_attr( $dove ); ?>" data-dove="<?php echo esc_attr( $dove ); ?>" hidden>
  <div class="ed-barra__nastro" aria-hidden="true">
    <div class="ed-barra__treno"><?php echo str_repeat( $pezzo, 4 ); ?></div>
    <div class="ed-barra__treno"><?php echo str_repeat( $pezzo, 4 ); ?></div>
  </div>
  <?php // la scritta, una volta sola e ferma, per chi legge con la voce ?>
  <span class="ed-barra__perlavoce"><?php echo esc_html( $testo ); ?></span>
  <?php if ( ELITEDERMA_BARRA_CHIUDIBILE && $fondo ) : ?>
  <button type="button" class="ed-barra__x" id="ed-barra-x" aria-label="Chiudi la striscia">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>
  <?php endif; ?>
</div>

<style>
.ed-barra{background:#000;color:#fff;overflow:hidden;position:relative;z-index:9999;
  /* il ripiego non e' decorazione: se Google non risponde, o chi guarda
     ha i font di terze parti bloccati, la scritta si legge lo stesso */
  font-family:'<?php echo esc_attr( ELITEDERMA_BARRA_FONT ); ?>',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.ed-barra[hidden]{display:none}
.ed-barra--fondo{position:fixed;left:0;right:0;bottom:0;box-shadow:0 -6px 24px rgba(0,0,0,.28)}
.ed-barra--coda,.ed-barra--header{position:relative}
.ed-barra__nastro{display:flex;width:max-content;animation:ed-barra-scorre var(--ed-giro,26s) linear infinite}
.ed-barra__treno{display:flex;align-items:center;flex:0 0 auto;height:var(--ed-alta,26px)}
.ed-barra__voce{font-size:var(--ed-corpo,11.5px);font-weight:<?php echo (int) ELITEDERMA_BARRA_PESO; ?>;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap}
/* il rombo d'oro che separa una ripetizione dall'altra: senza, la frase
   ripetuta sembra una frase sola sbagliata */
.ed-barra__rombo{color:#D1A570;font-size:calc(var(--ed-corpo,11.5px) * .68);margin:0 24px;flex:0 0 auto}
@keyframes ed-barra-scorre{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* fermandocisi sopra si ferma: una scritta che scorre e non si puo'
   rileggere e' una scritta che non si legge */
.ed-barra:hover .ed-barra__nastro{animation-play-state:paused}
.ed-barra__x{position:absolute;top:50%;right:6px;transform:translateY(-50%);width:24px;height:24px;
  display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);border:none;border-radius:50%;
  color:rgba(255,255,255,.6);cursor:pointer;padding:0;transition:color .18s,background .18s}
.ed-barra__x:hover{color:#D1A570;background:rgba(0,0,0,.85)}
/* la copia per chi legge con la voce: non si vede, ma si sente */
.ed-barra__perlavoce{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* CHI HA CHIESTO MENO ANIMAZIONI AL SUO SISTEMA NON LE RICEVE: la
   scritta resta ferma e centrata, e si legge lo stesso. Su una striscia
   che scorre non e' un vezzo — c'e' chi dal movimento continuo ha mal di
   testa, e c'e' chi non riesce a leggere del testo in movimento. */
@media (prefers-reduced-motion:reduce){
  .ed-barra__nastro{animation:none;width:100%;justify-content:center}
  .ed-barra__treno:nth-child(2){display:none}
  .ed-barra__treno .ed-barra__voce:nth-of-type(n+2),
  .ed-barra__treno .ed-barra__rombo{display:none}
}
@media (max-width:480px){.ed-barra__voce{letter-spacing:.12em}.ed-barra__rombo{margin:0 16px}}
</style>

<script>
(function () {
  var DA = <?php echo wp_json_encode( ELITEDERMA_BARRA_DA ); ?>;
  var A  = <?php echo wp_json_encode( ELITEDERMA_BARRA_A ); ?>;
  var GIRO = <?php echo (int) ELITEDERMA_BARRA_GIRO; ?>;
  var ALTA = <?php echo (int) ELITEDERMA_BARRA_ALTEZZA; ?>;
  var n = document.getElementById('ed-barra');
  if (!n) { return; }

  // LA FINESTRA LA DECIDE L'OROLOGIO DI CHI GUARDA: e' il motivo per cui
  // questa striscia non ha bisogno che si svuoti la cache. La pagina puo'
  // essere vecchia di giorni, le date restano scritte dentro e il
  // confronto si fa adesso.
  var ora = Date.now();
  if (ora < Date.parse(DA) || ora > Date.parse(A)) { return; }

  // chi l'ha chiusa non la rivede. In finestra anonima `localStorage`
  // puo' lanciare: si riprova senza memoria, che e' meglio di una pagina
  // che si rompe per una striscia pubblicitaria.
  try { if (localStorage.getItem('ed-barra-chiusa') === '1') { return; } } catch (e) {}

  var nastro = n.querySelector('.ed-barra__nastro');
  if (nastro) { nastro.style.setProperty('--ed-giro', GIRO + 's'); }
  // il corpo della scritta segue l'altezza: 44 centesimi dell'altezza e'
  // la proporzione che lascia respiro sopra e sotto senza che la scritta
  // tocchi i bordi
  n.style.setProperty('--ed-alta', ALTA + 'px');
  n.style.setProperty('--ed-corpo', Math.max(9, Math.round(ALTA * 0.44 * 10) / 10) + 'px');

  // SOTTO L'HEADER: la striscia nasce in fondo alla pagina — e' li' che
  // WordPress lascia scrivere — e si sposta da sola al suo posto. Si
  // sposta PRIMA di mostrarsi, cosi' nessuno vede il salto.
  //
  // Si fa cosi' e non con un gancio di WordPress perche' l'header di
  // questo sito e' un template di LiveCanvas: un gancio «dopo
  // l'intestazione» qui non c'e', e quello del tema potrebbe cambiare al
  // prossimo aggiornamento. L'elemento <header>, invece, c'e' sempre.
  if (n.getAttribute('data-dove') === 'header') {
    var testa = document.querySelector('header#lc-header') || document.querySelector('header');
    if (testa && testa.parentNode) {
      testa.parentNode.insertBefore(n, testa.nextSibling);
    } else if (document.body && document.body.firstChild) {
      // nessun header riconoscibile: in cima alla pagina, che e' il
      // posto piu' vicino a quello voluto
      document.body.insertBefore(n, document.body.firstChild);
    }
  }

  n.hidden = false;

  var x = document.getElementById('ed-barra-x');
  if (x) {
    x.addEventListener('click', function () {
      n.hidden = true;
      try { localStorage.setItem('ed-barra-chiusa', '1'); } catch (e) {}
    });
  }
})();
</script>
	<?php
}
}
