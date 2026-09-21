<?php
/**
 * Plugin Name: Elitederma — Cache breve sulle pagine prodotto
 * Description: Accorcia la vita in cache CDN delle pagine che mostrano prezzi e disponibilita', cosi' una modifica fatta dal gestionale si vede in un minuto invece che fra trenta giorni.
 * Version: 1.0
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

if ( ! defined( 'ELITEDERMA_CDN_SECONDI' ) ) {
	// Quanto Cloudflare puo' tenersi una pagina che mostra prezzi. Un
	// minuto e' un buon compromesso: le raffiche di visite restano
	// servite dal CDN, ma una correzione di prezzo si vede subito.
	define( 'ELITEDERMA_CDN_SECONDI', 60 );
}

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
		if ( elitederma_pagina_personale() ) {
			// via anche s-maxage: e' proprio la direttiva che oggi rende
			// cacheabile /carrello/ mentre /cart/, che non ce l'ha, resta
			// DYNAMIC e non viene mai messo in cache
			return 'no-store, no-cache, must-revalidate, max-age=0, private';
		}
		if ( elitederma_pagina_con_prezzi() ) {
			return 'public, max-age=0, s-maxage=' . ELITEDERMA_CDN_SECONDI . ', stale-while-revalidate=30';
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

// Tentativo 1 — il buffer di output. Se il nostro parte prima di quello
// di Breeze, il nostro e' il piu' esterno e la sua chiusura e' l'ultima
// cosa che succede prima che i byte partano.
if ( ! function_exists( 'elitederma_ultima_parola' ) ) {
	function elitederma_ultima_parola( $buffer ) {
		elitederma_applica_cache( 'buffer' );
		return $buffer;  // il contenuto non lo tocchiamo
	}
}
if ( ! is_admin() && PHP_SAPI !== 'cli' && ! defined( 'DOING_CRON' ) ) {
	ob_start( 'elitederma_ultima_parola' );
}

// Tentativo 2 e 3 — la chiusura della richiesta, prima in coda all'azione
// di WordPress, poi come funzione di spegnimento registrata quando ormai
// tutte le altre lo sono gia'.
add_action( 'shutdown', function () {
	elitederma_applica_cache( 'shutdown' );
	register_shutdown_function( function () {
		elitederma_applica_cache( 'shutdown-tardi' );
	} );
}, PHP_INT_MAX );

// ---------------------------------------------------------------
// La sonda
//
// Se anche i tre tentativi perdono, la forza bruta non basta e bisogna
// disinnescare l'aggancio di Breeze per nome. Questa elenca i suoi
// agganci sui ganci che possono toccare le intestazioni e li spedisce in
// una riga di risposta, dove si leggono da fuori con un curl. Non cambia
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

add_action( 'shutdown', function () {
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
