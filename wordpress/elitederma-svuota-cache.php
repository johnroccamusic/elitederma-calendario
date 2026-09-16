<?php
/**
 * Plugin Name: Elitederma — Svuota cache dal gestionale
 * Description: Espone una rotta REST (elitederma/v1/svuota-cache) con cui il gestionale fa svuotare a Breeze la cache delle pagine — locale e Cloudflare di Cloudways — subito dopo aver modificato un prodotto.
 * Version: 1.0
 * Author: Elitederma
 */

// Perche' esiste questo file.
//
// Il gestionale scrive prezzi, immagini e descrizioni sul sito passando
// dall'API di WooCommerce. WooCommerce li salva davvero, ma le pagine che
// vedono i clienti le serve una cache (Breeze sul server di Cloudways e,
// davanti, la rete Cloudflare di Cloudways) che tiene una copia della
// pagina fino a 30 giorni. Una modifica fatta dall'API non svuota quella
// copia: il sito continua a mostrare il prezzo e le foto di prima.
//
// Verificato il 16/09/2026: prodotto salvato alle 16:20, l'API del sito
// rispondeva col prezzo nuovo e le foto nuove, la pagina pubblica era
// ancora quella messa in cache alle 13:40.
//
// Breeze sa svuotare tutte le sue cache (file locali, Varnish e, sui
// server Cloudways con Cloudflare, anche quella) per un singolo articolo:
// lo fa quando si salva dall'editor di WordPress, con l'azione
// "purge_post_cache". Qui la si richiama da una rotta protetta dalla
// stessa chiave gia' usata dal ponte del menu (x-elitederma-secret), cosi'
// il gestionale puo' chiederlo subito dopo ogni salvataggio.
//
// Installazione: Code Snippets → Aggiungi nuovo → incollare tutto il file
// (senza la riga "<?php") → "Esegui ovunque" → Salva e attiva. Niente da
// cambiare: la chiave arriva dallo snippet del menu.

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Svuota la cache del sito (Breeze + Cloudflare di Cloudways) su richiesta
// del gestionale, dopo ogni modifica fatta dall'API di WooCommerce.
// La chiave e' la costante ELITEDERMA_BRIDGE_SECRET, definita nello
// snippet "Claude access" (riga 1). Qui non si ridefinisce.
//
// Le classi di Breeze si chiamano direttamente, non con i suoi ganci
// (breeze_clear_all_cache, purge_post_cache): quei ganci li registra il
// pannello di amministrazione, che in una chiamata REST non c'e'.

add_action( 'rest_api_init', function () {
	register_rest_route( 'elitederma/v1', '/svuota-cache', array(
		'methods'             => 'POST',
		'callback'            => 'elitederma_svuota_cache',
		'permission_callback' => 'elitederma_svuota_cache_autorizzato',
	) );
} );

function elitederma_svuota_cache_autorizzato( $richiesta ) {
	$chiave = $richiesta->get_header( 'x-elitederma-secret' );
	if ( ! $chiave || ! defined( 'ELITEDERMA_BRIDGE_SECRET' ) ) {
		return false;
	}
	return hash_equals( ELITEDERMA_BRIDGE_SECRET, $chiave );
}

// Corpo atteso: { "prodotti": [699, 668], "tutto": false }
//   prodotti — id WooCommerce dei prodotti toccati: si svuota la pagina di
//              ognuno piu' le pagine di elenco (shop, categorie)
//   tutto    — true per svuotare l'intera cache del sito
function elitederma_svuota_cache( $richiesta ) {
	$corpo    = $richiesta->get_json_params();
	$prodotti = isset( $corpo['prodotti'] ) && is_array( $corpo['prodotti'] ) ? array_map( 'intval', $corpo['prodotti'] ) : array();
	$tutto    = ! empty( $corpo['tutto'] );

	$cf_classe = class_exists( 'Breeze_CloudFlare_Helper' );
	$dati = array(
		'breeze'            => defined( 'BREEZE_VERSION' ) ? BREEZE_VERSION : null,
		'classe_cache'      => class_exists( 'Breeze_PurgeCache' ),
		'classe_cloudflare' => $cf_classe,
		'cloudflare_attivo' => $cf_classe && method_exists( 'Breeze_CloudFlare_Helper', 'is_cloudflare_enabled' ) ? (bool) Breeze_CloudFlare_Helper::is_cloudflare_enabled() : null,
		'server_cloudways'  => $cf_classe && method_exists( 'Breeze_CloudFlare_Helper', 'is_cloudways_server' ) ? (bool) Breeze_CloudFlare_Helper::is_cloudways_server() : null,
		'costanti_cdn'      => defined( 'CDN_SITE_ID' ) && defined( 'CDN_SITE_TOKEN' ),
		'gancio_tutto'      => false !== has_action( 'breeze_clear_all_cache' ),
		'gancio_prodotto'   => false !== has_action( 'purge_post_cache' ),
		'passi'             => array(),
	);

	if ( ! class_exists( 'Breeze_PurgeCache' ) ) {
		return new WP_REST_Response( array( 'ok' => false, 'errore' => 'Breeze non risulta attivo su questo sito: cache non svuotata.', 'dati' => $dati ), 200 );
	}

	try {
		if ( $tutto ) {
			if ( class_exists( 'Breeze_MinificationCache' ) && method_exists( 'Breeze_MinificationCache', 'clear_minification' ) ) {
				Breeze_MinificationCache::clear_minification();
				$dati['passi'][] = 'minificati';
			}
			Breeze_PurgeCache::breeze_cache_flush();
			$dati['passi'][] = 'locale';
			if ( class_exists( 'Breeze_PurgeVarnish' ) ) {
				$varnish = new Breeze_PurgeVarnish();
				if ( method_exists( $varnish, 'purge_cache' ) ) {
					$varnish->purge_cache( home_url( '/' ) );
					$dati['passi'][] = 'varnish';
				}
			}
			if ( $cf_classe && method_exists( 'Breeze_CloudFlare_Helper', 'reset_all_cache' ) ) {
				$esito = Breeze_CloudFlare_Helper::reset_all_cache();
				$dati['passi'][] = 'cloudflare:' . ( false === $esito ? 'no' : 'si' );
			}
			if ( method_exists( 'Breeze_PurgeCache', '__flush_object_cache' ) ) {
				Breeze_PurgeCache::__flush_object_cache();
				$dati['passi'][] = 'oggetti';
			}
			$dati['svuotati'] = 'tutto';
		} else {
			$svuotati = array();
			$purga    = method_exists( 'Breeze_PurgeCache', 'factory' ) ? Breeze_PurgeCache::factory() : new Breeze_PurgeCache();
			foreach ( $prodotti as $id ) {
				if ( $id <= 0 || ! get_post( $id ) ) {
					continue;
				}
				if ( method_exists( $purga, 'purge_post_cache' ) ) {
					// pagina del prodotto, shop e categorie che lo mostrano:
					// locale, Varnish e Cloudflare insieme
					$purga->purge_post_cache( $id );
					$dati['passi'][] = 'prodotto:' . $id;
				} else {
					Breeze_PurgeCache::breeze_cache_flush();
					$dati['passi'][] = 'locale';
					if ( $cf_classe && method_exists( 'Breeze_CloudFlare_Helper', 'reset_all_cache' ) ) {
						Breeze_CloudFlare_Helper::reset_all_cache();
						$dati['passi'][] = 'cloudflare';
					}
				}
				$svuotati[] = $id;
			}
			$dati['svuotati'] = $svuotati;
		}
	} catch ( Throwable $e ) {
		return new WP_REST_Response( array( 'ok' => false, 'errore' => 'Breeze ha dato errore: ' . $e->getMessage(), 'dati' => $dati ), 200 );
	}

	return new WP_REST_Response( array( 'ok' => true, 'dati' => $dati ), 200 );
}
