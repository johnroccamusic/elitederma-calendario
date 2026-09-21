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

// "template_redirect" e non "send_headers": send_headers scatta prima
// che WordPress abbia eseguito la query principale, e li' is_product() e
// compagni non sanno ancora dire su che pagina siamo. A
// template_redirect la query c'e', e l'output non e' ancora cominciato.
add_action( 'template_redirect', 'elitederma_accorcia_cache_cdn', 9999 );

// Breeze rimette la propria intestazione piu' avanti, quando la pagina e'
// gia' composta. Con il buffer di output attivo i byte partono solo alla
// fine, quindi qui siamo ancora in tempo a riscriverla; se invece sono
// gia' partiti, headers_sent() ci fa uscire senza danni.
add_action( 'shutdown', 'elitederma_accorcia_cache_cdn', 0 );
