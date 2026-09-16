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

// La chiave condivisa col gestionale (WP_MENU_BRIDGE_SECRET nelle
// variabili delle edge function) e' la costante ELITEDERMA_BRIDGE_SECRET,
// definita nello snippet del menu ("Claude access", riga 1). Qui non si
// ridefinisce: due define della stessa costante farebbero scattare un
// avviso PHP, e la si legge comunque solo a richiesta arrivata, quando
// tutti gli snippet sono gia' caricati.

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
//              ognuno piu' le pagine di elenco (shop, categorie) che lo
//              mostrano, come fa Breeze quando si salva dall'editor
//   tutto    — true per svuotare l'intera cache del sito (riordino della
//              vetrina, categorie rinominate, tasto manuale nel gestionale)
function elitederma_svuota_cache( $richiesta ) {
	$corpo    = $richiesta->get_json_params();
	$prodotti = isset( $corpo['prodotti'] ) && is_array( $corpo['prodotti'] ) ? array_map( 'intval', $corpo['prodotti'] ) : array();
	$tutto    = ! empty( $corpo['tutto'] );

	$breeze_presente = class_exists( 'Breeze_PurgeCache' );
	if ( ! $breeze_presente ) {
		return new WP_REST_Response( array(
			'ok'      => false,
			'errore'  => 'Breeze non risulta attivo su questo sito: cache non svuotata.',
		), 200 );
	}

	$svuotati = array();
	if ( $tutto ) {
		// e' la stessa azione che Breeze lancia da solo quando cambia il
		// menu o il tema: file locali, Varnish e Cloudflare insieme
		do_action( 'breeze_clear_all_cache' );
		$svuotati[] = 'tutto';
	} else {
		foreach ( $prodotti as $id ) {
			if ( $id > 0 && get_post( $id ) ) {
				do_action( 'purge_post_cache', $id );
				$svuotati[] = $id;
			}
		}
	}

	return new WP_REST_Response( array(
		'ok'       => true,
		'svuotati' => $svuotati,
		'breeze'   => defined( 'BREEZE_VERSION' ) ? BREEZE_VERSION : null,
	), 200 );
}
