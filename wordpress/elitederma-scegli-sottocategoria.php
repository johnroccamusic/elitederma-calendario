<?php
/**
 * Elitederma — scegli la sottocategoria prima di entrare
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui ovunque". Non serve toccare il tema.
 *
 * IL PROBLEMA
 * Le tessere tonde della home portano a pagine come /pigmenti-proomix/,
 * e li' dentro compaiono subito TUTTI i prodotti della famiglia — oggi
 * quarantadue. Chi cerca un pigmento per labbra deve scorrere in mezzo
 * a sopracciglia, eyeliner e correttivi, oppure sapere che le
 * sottocategorie stanno nel menu in alto.
 *
 * COSA FA QUESTO SNIPPET
 * Aggiunge lo shortcode [ed_sottocategorie] che disegna le
 * sottocategorie come le stesse tessere tonde della home: usa le classi
 * ed-cat-strip / ed-cat / ed-cat-ico / ed-cat-lab che gia' esistono nel
 * tuo CSS, quindi l'aspetto e' identico senza aggiungere una riga di
 * stile. Ogni tessera porta all'archivio vero della sottocategoria.
 *
 * DOVE SI METTE
 *   [ed_sottocategorie cat="pigmenti-proomix"]
 * in cima alla pagina /pigmenti-proomix/. Lo stesso per dermografi,
 * aghi, microblading, lash extension.
 *
 * Senza "cat", sulla pagina di una categoria prodotto, prende da solo la
 * categoria che si sta guardando:
 *   [ed_sottocategorie]
 *
 * ATTRIBUTI
 *   cat       slug o id della categoria madre (senza: quella corrente)
 *   titolo    testo sopra le tessere (vuoto = nessun titolo)
 *   vuote     "si" per mostrare anche le sottocategorie senza prodotti
 *
 * L'IMMAGINE
 * Si prende quella della categoria su WooCommerce (Prodotti → Categorie
 * → Modifica → Immagine miniatura). Dove non c'e', la tessera esce con
 * il tondo grigio e la sola scritta: si vede subito quale foto manca,
 * invece di far sparire la voce.
 *
 * PER NASCONDERE ANCHE I PRODOTTI
 * Questo snippet AGGIUNGE la scelta, non toglie niente. Se su una
 * categoria vuoi che si vedano solo le sottocategorie, si fa senza
 * codice: Prodotti → Categorie → Modifica → "Tipo di visualizzazione"
 * → Sottocategorie. E' la via prevista da WooCommerce, e vale solo per
 * la categoria su cui la imposti.
 *
 * DOPO AVERLO SALVATO
 * Il sito serve pagine in cache (Breeze + Cloudflare): finche' non la
 * svuoti continui a vedere la pagina di prima.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_shortcode( 'ed_sottocategorie', 'elitederma_sottocategorie_shortcode' );

function elitederma_sottocategorie_shortcode( $attributi = array() ) {
	// senza WooCommerce non esiste la tassonomia: si esce in silenzio
	// invece di far morire la pagina
	if ( ! taxonomy_exists( 'product_cat' ) ) {
		return '';
	}

	$a = shortcode_atts(
		array(
			'cat'    => '',
			'titolo' => '',
			'vuote'  => 'no',
		),
		$attributi,
		'ed_sottocategorie'
	);

	$madre = elitederma_trova_categoria_madre( $a['cat'] );
	if ( ! $madre ) {
		return '';
	}

	$figlie = get_terms(
		array(
			'taxonomy'   => 'product_cat',
			'parent'     => $madre->term_id,
			'hide_empty' => ( 'si' !== strtolower( $a['vuote'] ) ),
			'orderby'    => 'menu_order',
		)
	);
	if ( is_wp_error( $figlie ) || empty( $figlie ) ) {
		return '';
	}

	$html  = '<div class="ed-cats">';
	if ( '' !== trim( $a['titolo'] ) ) {
		$html .= '<h1>' . esc_html( $a['titolo'] ) . '</h1>';
	}
	$html .= '<div class="ed-cat-strip">';

	foreach ( $figlie as $figlia ) {
		$link = get_term_link( $figlia );
		if ( is_wp_error( $link ) ) {
			continue;
		}
		$html .= '<a class="ed-cat" href="' . esc_url( $link ) . '">';
		$html .= '<span class="ed-cat-ico">' . elitederma_immagine_categoria( $figlia ) . '</span>';
		$html .= '<span class="ed-cat-lab">' . esc_html( $figlia->name ) . '</span>';
		$html .= '</a>';
	}

	$html .= '</div></div>';
	return $html;
}

/**
 * La categoria madre: quella chiesta nello shortcode, oppure quella
 * della pagina che si sta guardando.
 */
function elitederma_trova_categoria_madre( $cat ) {
	$cat = trim( (string) $cat );

	if ( '' !== $cat ) {
		// un numero e' un id, il resto uno slug
		$termine = ctype_digit( $cat )
			? get_term( (int) $cat, 'product_cat' )
			: get_term_by( 'slug', $cat, 'product_cat' );
		return ( $termine && ! is_wp_error( $termine ) ) ? $termine : null;
	}

	if ( is_tax( 'product_cat' ) ) {
		$corrente = get_queried_object();
		if ( $corrente && isset( $corrente->term_id ) ) {
			return $corrente;
		}
	}
	return null;
}

/**
 * L'immagine della categoria come la vuole la tessera tonda: stessa
 * forma di quelle scritte a mano nella home, con srcset e lazy load.
 * Se la categoria non ha una miniatura su WooCommerce si restituisce
 * una stringa vuota: il tondo grigio del CSS resta, e si vede subito
 * dove manca la foto.
 */
function elitederma_immagine_categoria( $termine ) {
	$id_immagine = (int) get_term_meta( $termine->term_id, 'thumbnail_id', true );
	if ( ! $id_immagine ) {
		return '';
	}
	return wp_get_attachment_image(
		$id_immagine,
		'woocommerce_thumbnail',
		false,
		array(
			'alt'     => $termine->name,
			'sizes'   => '80px',
			'loading' => 'lazy',
		)
	);
}
