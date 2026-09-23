<?php
/**
 * Elitederma — il prezzo spiegato nel carrello a blocchi
 * ---------------------------------------------------------------------
 * Da incollare in Code Snippets (WordPress → Snippets → Aggiungi nuovo),
 * "Esegui ovunque". Non serve toccare il tema.
 *
 * COSA FA
 * Sotto il nome di ogni prodotto, nel carrello e al checkout, aggiunge:
 *
 *   Netto                        51,64 €
 *   Sconto 30%                 − 15,49 €
 *   Netto scontato               36,15 €
 *   IVA 22%                       7,95 €
 *   Totale                       44,10 €
 *
 * Su un prodotto senza sconto restano netto, IVA e totale.
 *
 * PERCHE' IN JAVASCRIPT
 * Il carrello di elitederma.shop e' il BLOCCO di WooCommerce: lo disegna
 * il browser leggendo la Store API, e gli hook PHP del carrello classico
 * (woocommerce_cart_item_name e compagnia) li' non li chiama nessuno.
 * Quindi i numeri si leggono dalla stessa Store API che usa il blocco —
 * line_subtotal, line_total, line_total_tax — e si scrivono accanto al
 * nome. Nessun conto rifatto a mano: se il blocco cambia idea sul
 * totale, cambia idea anche questo.
 *
 * Il blocco si ridisegna a ogni cambio di quantita' o di codice: un
 * osservatore rimette il dettaglio quando sparisce e rilegge i numeri
 * poco dopo, quando la Store API ha finito di aggiornarsi.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ELITEDERMA_PREZZI_JS', <<<'JS'
(function () {
  var RADICE = (window.elitedermaPrezzi && window.elitedermaPrezzi.store) || "/wp-json/wc/store/v1/cart";
  var CLASSE = "elitederma-dettaglio";
  var dati = null;
  var inCorso = false;

  function soldi(minori, t) {
    var unita = Math.pow(10, t.currency_minor_unit);
    var n = (Number(minori) / unita).toFixed(t.currency_minor_unit);
    var pezzi = n.split(".");
    pezzi[0] = pezzi[0].replace(/\B(?=(\d{3})+(?!\d))/g, t.currency_thousand_separator);
    var testo = pezzi.join(t.currency_decimal_separator);
    return (t.currency_prefix || "") + testo + (t.currency_suffix || "");
  }

  function riga(etichetta, valore, colore, forte) {
    var d = document.createElement("div");
    d.style.cssText = "display:flex;justify-content:space-between;gap:10px;" +
      (forte ? "font-weight:700;border-top:1px solid rgba(0,0,0,.10);margin-top:3px;padding-top:3px;" : "");
    var a = document.createElement("span");
    var b = document.createElement("span");
    a.textContent = etichetta;
    b.textContent = valore;
    b.style.whiteSpace = "nowrap";
    if (colore) { a.style.color = colore; b.style.color = colore; }
    d.appendChild(a); d.appendChild(b);
    return d;
  }

  // il dettaglio di una voce: netto, sconto con la sua percentuale,
  // netto scontato, IVA e totale. I numeri sono quelli della Store API,
  // non ricalcolati dal prezzo a video
  function blocco(voce, t) {
    var netto = Number(voce.totals.line_subtotal);
    var dopo = Number(voce.totals.line_total);
    var imposta = Number(voce.totals.line_total_tax || 0);
    if (!(netto > 0)) return null;
    var sconto = netto - dopo;
    var box = document.createElement("div");
    box.className = CLASSE;
    box.style.cssText = "margin-top:6px;font-size:.82em;line-height:1.5;opacity:.92;max-width:320px;";
    box.appendChild(riga("Netto", soldi(netto, t)));
    if (sconto > 0.5) {
      var pct = Math.round(sconto / netto * 1000) / 10;
      box.appendChild(riga("Sconto " + String(pct).replace(".", ",") + "%", "− " + soldi(sconto, t), "#2E7D32"));
      box.appendChild(riga("Netto scontato", soldi(dopo, t)));
    }
    if (imposta > 0) {
      var aliq = Math.round(imposta / dopo * 1000) / 10;
      box.appendChild(riga("IVA " + String(aliq).replace(".", ",") + "%", soldi(imposta, t)));
    }
    box.appendChild(riga("Totale", soldi(dopo + imposta, t), "", true));
    return box;
  }

  function chiaveDi(url) {
    try { return new URL(url, location.origin).pathname.replace(/\/+$/, ""); } catch (e) { return url || ""; }
  }

  function disegna() {
    if (!dati || !dati.items) return;
    var perPermalink = {};
    dati.items.forEach(function (v) { perPermalink[chiaveDi(v.permalink)] = v; });

    document.querySelectorAll(".wc-block-cart-items__row, .wc-block-components-order-summary-item").forEach(function (r) {
      var link = r.querySelector("a[href]");
      var voce = link ? perPermalink[chiaveDi(link.getAttribute("href"))] : null;
      if (!voce) return;
      var vecchio = r.querySelector("." + CLASSE);
      var nuovo = blocco(voce, dati.totals);
      if (!nuovo) return;
      if (vecchio) {
        if (vecchio.textContent === nuovo.textContent) return;   // gia' giusto: non si tocca
        vecchio.replaceWith(nuovo);
        return;
      }
      var nome = r.querySelector(".wc-block-components-product-name") || link;
      var dove = nome && nome.parentNode ? nome.parentNode : r;
      dove.appendChild(nuovo);
    });
  }

  function carica() {
    if (inCorso) return;
    inCorso = true;
    fetch(RADICE, { credentials: "same-origin", headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { inCorso = false; if (j) { dati = j; disegna(); } })
      .catch(function () { inCorso = false; });
  }

  // il blocco si ridisegna da solo a ogni cambio di quantita' o codice:
  // si riattacca il dettaglio quando sparisce, e si rileggono i numeri
  // poco dopo, quando la Store API ha finito di aggiornarsi
  var attesa = null;
  function osserva() {
    var radice = document.querySelector(".wp-block-woocommerce-cart, .wp-block-woocommerce-checkout") || document.body;
    new MutationObserver(function () {
      disegna();
      clearTimeout(attesa);
      attesa = setTimeout(carica, 600);
    }).observe(radice, { childList: true, subtree: true });
  }

  function avvia() { carica(); osserva(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
  else avvia();
})();
JS
);

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( ! function_exists( 'is_cart' ) || ( ! is_cart() && ! is_checkout() ) ) {
			return;
		}
		// un appiglio per lo script: l'indirizzo della Store API di
		// QUESTO sito, che non e' detto stia sotto /wp-json
		wp_register_script( 'elitederma-prezzi', '', array(), '1.0.0', true );
		wp_enqueue_script( 'elitederma-prezzi' );
		wp_add_inline_script(
			'elitederma-prezzi',
			'window.elitedermaPrezzi = ' . wp_json_encode( array( 'store' => rest_url( 'wc/store/v1/cart' ) ) ) . ';',
			'before'
		);
		wp_add_inline_script( 'elitederma-prezzi', ELITEDERMA_PREZZI_JS );
	},
	20
);
