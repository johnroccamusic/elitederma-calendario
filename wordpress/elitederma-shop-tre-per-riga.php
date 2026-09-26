<?php
/**
 * Elitederma — tre prodotti per riga da telefono
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui solo nel front-end". Non serve toccare il tema.
 *
 * COSA FA
 * La griglia dei prodotti di elitederma.shop e' Bootstrap 5, e il tema
 * picostrap5 la scrive cosi':
 *
 *   <div class="row row-cols-2 row-cols-md-2 row-cols-lg-3 row-cols-xxl-4 g-4">
 *
 * `row-cols-2` vale da telefono in su: due prodotti per riga. Questo
 * snippet li porta a tre sotto i 768px, sullo shop, sulle categorie e
 * sui risultati di ricerca — sono la stessa griglia, dentro lo stesso
 * contenitore `#container-content-shop-page`.
 *
 * PERCHE' NON SOLO LA LARGHEZZA
 * A tre colonne su un telefono da 375px ogni card resta circa 117px. Con
 * le misure di adesso non ci sta niente: il nome del prodotto e' un
 * `h2.h5`, cioe' 20px, e "Aftercare post trattamento vit A+D 25pz"
 * diventerebbe una colonna di parole spezzate. Quindi insieme alla
 * larghezza si stringono lo spazio fra le card (da 1,5rem a 0,5rem, che
 * su tre colonne sono 32px di respiro in piu' per ogni card), il nome,
 * il prezzo e il tasto. Nient'altro: fuori da quel contenitore e sopra i
 * 768px il sito resta identico.
 *
 * SE VUOI TRE PER RIGA ANCHE SU TABLET
 * Oggi fra 768 e 991px sono ancora due (`row-cols-md-2`), e a quella
 * larghezza e' uno spreco. Togli le barre dal blocco in fondo.
 *
 * DOPO AVERLO SALVATO
 * Il sito serve pagine in cache (Breeze + Cloudflare, 30 giorni): finche'
 * non la svuoti continui a vedere due colonne. Svuotala dal gestionale,
 * o da WordPress → Breeze → Purge all cache.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_head', 'elitederma_shop_tre_per_riga_css', 99 );

function elitederma_shop_tre_per_riga_css() {
	// solo dove c'e' una griglia di prodotti: shop, categorie, tag,
	// ricerca prodotti. Sulle altre pagine questo CSS non serve e non
	// deve nemmeno essere spedito
	if ( ! function_exists( 'is_woocommerce' ) ) {
		return;
	}
	$griglia = is_shop() || is_product_category() || is_product_tag()
		|| ( is_search() && 'product' === get_query_var( 'post_type' ) );
	if ( ! $griglia ) {
		return;
	}
	?>
<style id="elitederma-tre-per-riga">
/* Tre prodotti per riga sotto i 768px.
   Il selettore parte dall'id del contenitore dello shop: cosi' vince sul
   `.row-cols-2 > *` di Bootstrap senza !important, e non tocca nessuna
   altra griglia del sito. */
@media (max-width: 767.98px) {
	#container-content-shop-page .row-cols-2 {
		/* g-4 vale 1,5rem: su tre colonne se ne mangia troppa. */
		--bs-gutter-x: .5rem;
		--bs-gutter-y: 1rem;
	}
	#container-content-shop-page .row-cols-2 > .col {
		flex: 0 0 auto;
		width: 33.3333333333%;
	}
	/* la card non deve piu' stringersi da sola: lo spazio e' quello */
	#container-content-shop-page .row-cols-2 > .col > .card {
		width: 100%;
	}
	/* il nome del prodotto: da 20px a 12,5px, e le parole lunghe vanno
	   spezzate o sfondano la colonna */
	#container-content-shop-page .row-cols-2 .card-body h2 {
		font-size: .78rem;
		line-height: 1.25;
		margin-bottom: .25rem;
		overflow-wrap: anywhere;
	}
	#container-content-shop-page .row-cols-2 .card-body {
		padding-left: .4rem;
		padding-right: .4rem;
	}
	/* il prezzo, che e' un h5 anche lui */
	#container-content-shop-page .row-cols-2 .card-footer h5 {
		font-size: .92rem;
		margin-bottom: 0;
	}
	/* il tasto: "Aggiungi al carrello" a 117px va a capo, e va bene, ma
	   con il carattere e i margini di prima diventava altissimo */
	#container-content-shop-page .row-cols-2 .card-footer {
		padding-left: .4rem;
		padding-right: .4rem;
	}
	#container-content-shop-page .row-cols-2 .card-footer .btn {
		font-size: .7rem;
		padding: .35rem .3rem;
		line-height: 1.15;
		white-space: normal;
	}
}

/* --- Tre per riga anche su tablet (768-991px) ------------------------
   Oggi a quella larghezza sono ancora due. Togli le barre da qui sotto
   per portarli a tre; lo spazio fra le card resta quello del tema,
   perche' a 768px ce n'e' in abbondanza.

@media (min-width: 768px) and (max-width: 991.98px) {
	#container-content-shop-page .row-cols-md-2 > .col {
		flex: 0 0 auto;
		width: 33.3333333333%;
	}
}
--------------------------------------------------------------------- */
</style>
	<?php
}
