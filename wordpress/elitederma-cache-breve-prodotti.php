<?php
/**
 * Plugin Name: Elitederma — Cache breve sulle pagine prodotto
 * Description: Accorcia la vita in cache CDN delle pagine che mostrano prezzi e disponibilita', cosi' una modifica fatta dal gestionale si vede in un minuto invece che fra trenta giorni.
 * Version: 4.0
 * Note: 4.0 non prova piu' ad accorciare il TTL — dice a Cloudflare di non tenersi affatto le pagine con prezzi.
 */

// Perche' esiste questo snippet.
//
// Il sito sta dietro la rete Cloudflare di Cloudways
// (`cache-provider: CLOUDWAYS-CACHE-DE`). Chi decide quanto Cloudflare
// puo' tenersi una pagina non e' Cloudflare: e' l'intestazione
// `Cache-Control` che parte da qui. Oggi su ogni pagina arriva
// `s-maxage=2592000`, cioe' trenta giorni — appiccicata in coda perfino
// alle pagine dichiarate `no-store`, tanto che il carrello italiano
// (/carrello/) risulta cacheabile mentre quello inglese (/cart/), che
// quella direttiva non ce l'ha, e' `DYNAMIC` e non viene mai cachato.
// E' la prova che comanda l'origine, non il CDN.
//
// Conseguenza: cambi prezzo, nome o foto dal gestionale, WooCommerce li
// prende subito, ma i clienti continuano a vedere la copia vecchia
// finche' qualcuno non svuota la cache a mano dal pannello Cloudways.
// Verificato il 21/09/2026: pagina servita con `age` di tre giorni,
// nome e prezzo vecchi, mentre l'API di WooCommerce aveva gia' i nuovi.
//
// Lo svuotamento automatico (snippet "Elitederma — Svuota cache dal
// gestionale") non basta: Breeze sa svuotare il proprio, ma per
// Cloudflare gli servono le costanti CDN_SITE_ID e CDN_SITE_TOKEN che
// in wp-config.php non ci sono.
//
// Questo snippet aggira il problema dall'altro capo: invece di
// rincorrere la cache per svuotarla, le dice fin dall'inizio di tenersi
// la pagina poco. Solo dove conta — prodotti, negozio, categorie,
// carrello e account — il resto del sito (pagine fisse, articoli)
// continua a stare in cache trenta giorni come prima.

if ( ! function_exists( 'elitederma_pagina_con_prezzi' ) ) {
	function elitederma_pagina_con_prezzi() {
		if ( is_admin() ) {
			return false;
		}
		// le pagine che un cliente guarda per decidere se comprare: se il
		// prezzo o la disponibilita' qui sono vecchi, il danno e' vero
		if ( function_exists( 'is_product' ) && ( is_product() || is_shop() || is_product_category() || is_product_tag() ) ) {
			return true;
		}
		return false;
	}
}

if ( ! function_exists( 'elitederma_pagina_personale' ) ) {
	function elitederma_pagina_personale() {
		if ( is_admin() ) {
			return false;
		}
		// carrello, cassa e account non vanno mai in cache condivisa:
		// dentro c'e' roba di una persona sola
		return function_exists( 'is_cart' ) && ( is_cart() || is_checkout() || is_account_page() );
	}
}

// Decide che intestazione merita questa pagina, e basta: niente effetti
// collaterali. Tenerla separata da chi la spedisce permette di provarla
// davvero, con le condizionali di WooCommerce finte, invece di fidarsi.
// Restituisce null quando la pagina non ci riguarda: in quel caso non si
// tocca niente e vale quello che ha deciso Breeze.
if ( ! function_exists( 'elitederma_intestazione_cache' ) ) {
	function elitederma_intestazione_cache() {
		// Perche' la stessa riga per il carrello e per le pagine prodotto.
		//
		// Accorciare il TTL non funziona: qualcosa dopo PHP appende sempre
		// "s-maxage=2592000" alla riga, e fra due s-maxage in conflitto
		// Cloudflare tiene l'ultimo. Verificato il 21/09/2026 arrivando fino
		// a header_register_callback(), che e' l'ultima cosa che PHP tocca
		// prima di spedire: il doppione ricompare lo stesso, quindi non lo
		// mette WordPress e da qui non lo si toglie.
		//
		// Quello che invece Cloudflare rispetta, anche con i 30 giorni
		// appesi in coda, sono no-store / no-cache / private — e lo si vede
		// sul sito stesso: il carrello, che li ha, viene riverificato di
		// continuo (eta' 2-4 secondi), mentre una pagina prodotto che
		// diceva "public" veniva servita con 38 minuti sul groppone.
		//
		// Quindi non chiediamo una cache breve: chiediamo di non tenersela.
		// Le pagine restano veloci lo stesso, perche' Breeze e Varnish le
		// servono dalla cache del server, che lo snippet "Svuota cache dal
		// gestionale" ripulisce a ogni salvataggio.
		if ( elitederma_pagina_personale() || elitederma_pagina_con_prezzi() ) {
			return 'no-store, no-cache, must-revalidate, max-age=0, private';
		}
		return null;
	}
}

if ( ! function_exists( 'elitederma_accorcia_cache_cdn' ) ) {
	function elitederma_accorcia_cache_cdn() {
		// se i byte sono gia' partiti non c'e' piu' niente da fare, ed e'
		// giusto uscire in silenzio invece di far comparire un warning
		// in cima a una pagina del negozio
		if ( headers_sent() ) {
			return;
		}
		$intestazione = elitederma_intestazione_cache();
		if ( null !== $intestazione ) {
			header( 'Cache-Control: ' . $intestazione, true );
		}
	}
}

// ---------------------------------------------------------------
// Prendersi l'ultima parola
//
// Misurato il 21/09/2026: il nostro Cache-Control parte, ma Breeze ne
// appende un altro subito dopo sulla stessa riga, e la riga finale
// diventa "... s-maxage=60 ... s-maxage=2592000". Fra due direttive in
// conflitto Cloudflare tiene l'ultima, quindi vincono i trenta giorni.
// Verificato campionando una pagina per 200 secondi: l'eta' sale sempre
// e non si azzera mai.
//
// Non lo aggiunge il server: le richieste che nginx serve da solo
// (immagini, jquery.min.js) non ce l'hanno. Lo aggiunge PHP, e in
// Breeze non esiste un'opzione per spegnerlo — cinque schede guardate
// una per una.
//
// Quindi la strada e' arrivare dopo di lui. Ci proviamo da tre punti
// diversi, perche' quale sia l'ultimo utile dipende da come Breeze
// tiene i buffer, e non e' cosa che si possa dedurre da fuori. Ogni
// tentativo riscrive l'intestazione INTERA (replace = true), quindi chi
// arriva per ultimo cancella anche il doppione.
// ---------------------------------------------------------------

// Decidiamo presto (qui le condizionali di WooCommerce rispondono) e
// applichiamo tardi: la decisione viaggia in una variabile.
if ( ! isset( $GLOBALS['elitederma_cache_decisa'] ) ) {
	$GLOBALS['elitederma_cache_decisa'] = null;
}

add_action( 'template_redirect', function () {
	$GLOBALS['elitederma_cache_decisa'] = elitederma_intestazione_cache();
	elitederma_applica_cache( 'template_redirect' );
}, 9999 );

if ( ! function_exists( 'elitederma_applica_cache' ) ) {
	function elitederma_applica_cache( $da_dove ) {
		if ( headers_sent() || empty( $GLOBALS['elitederma_cache_decisa'] ) ) {
			return;
		}
		header( 'Cache-Control: ' . $GLOBALS['elitederma_cache_decisa'], true );
		// cosi' da fuori, con un curl, si vede quale dei tre tentativi ha
		// parlato per ultimo: senza questo si tira a indovinare
		header( 'X-Elitederma-Via: ' . $da_dove, true );
	}
}

// Il gancio giusto: PHP chiama questa funzione nell'istante in cui sta
// per spedire le intestazioni, dopo chiunque altro le abbia toccate,
// buffer o non buffer. E' esattamente il momento che serve a noi.
//
// Misurato il 21/09/2026: i tentativi su ob_start e su shutdown non
// incidevano, perche' a shutdown le intestazioni erano gia' partite (la
// sonda, agganciata li', non riusciva nemmeno a rispondere).
//
// Attenzione: PHP ne tiene UNA sola, e chi registra per ultimo sostituisce
// il precedente. Registriamo tardi per questo.
add_action( 'template_redirect', function () {
	if ( ! function_exists( 'header_register_callback' ) || empty( $GLOBALS['elitederma_cache_decisa'] ) ) {
		return;
	}
	header_register_callback( function () {
		elitederma_applica_cache( 'header_callback' );
	} );
}, PHP_INT_MAX );

// Restano come rete di sicurezza, nel caso header_register_callback sia
// disattivato o gia' occupato da un altro plugin. Non fanno danno: se le
// intestazioni sono partite, escono subito.
if ( ! function_exists( 'elitederma_ultima_parola' ) ) {
	function elitederma_ultima_parola( $buffer ) {
		elitederma_applica_cache( 'buffer' );
		return $buffer;  // il contenuto non lo tocchiamo
	}
}
if ( ! is_admin() && PHP_SAPI !== 'cli' && ! defined( 'DOING_CRON' ) ) {
	ob_start( 'elitederma_ultima_parola' );
}
add_action( 'shutdown', function () {
	elitederma_applica_cache( 'shutdown' );
}, PHP_INT_MAX );

// ---------------------------------------------------------------
// La sonda
//
// Se anche il gancio giusto perde, bisogna
// disinnescare l'aggancio di Breeze per nome. Questa elenca i suoi
// agganci sui ganci che possono toccare le intestazioni e li spedisce in
// una riga di risposta, dove si leggono da fuori con un curl. Sta su
// template_redirect e non su shutdown perche' li' le intestazioni sono
// gia' partite e non si riuscirebbe nemmeno a rispondere. Non cambia
// niente: guarda e riferisce.
// ---------------------------------------------------------------
if ( ! function_exists( 'elitederma_nome_callback' ) ) {
	function elitederma_nome_callback( $f ) {
		if ( is_string( $f ) ) {
			return $f;
		}
		if ( is_array( $f ) && count( $f ) === 2 ) {
			$oggetto = is_object( $f[0] ) ? get_class( $f[0] ) : (string) $f[0];
			return $oggetto . '::' . (string) $f[1];
		}
		if ( $f instanceof Closure ) {
			return 'Closure';
		}
		return '';
	}
}

add_action( 'template_redirect', function () {
	if ( headers_sent() || empty( $GLOBALS['elitederma_cache_decisa'] ) ) {
		return;
	}
	global $wp_filter;
	$ganci  = array( 'send_headers', 'template_redirect', 'wp', 'wp_loaded', 'shutdown', 'wp_headers' );
	$trovati = array();
	foreach ( $ganci as $gancio ) {
		if ( empty( $wp_filter[ $gancio ] ) || ! isset( $wp_filter[ $gancio ]->callbacks ) ) {
			continue;
		}
		foreach ( $wp_filter[ $gancio ]->callbacks as $priorita => $elenco ) {
			foreach ( $elenco as $voce ) {
				$nome = elitederma_nome_callback( $voce['function'] );
				if ( $nome && preg_match( '/breeze|cloudflare|cdn/i', $nome ) ) {
					$trovati[] = $gancio . '@' . $priorita . '=' . $nome;
				}
			}
		}
	}
	$riga = $trovati ? implode( ' ~ ', $trovati ) : 'nessuno';
	// una riga di intestazione non puo' contenere a capo, e conviene non
	// farla chilometrica
	$riga = substr( preg_replace( '/[^A-Za-z0-9_:@=~\. -]/', '', $riga ), 0, 900 );
	header( 'X-Elitederma-Ganci: ' . $riga, true );
}, PHP_INT_MAX );
