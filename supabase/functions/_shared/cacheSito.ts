// Svuota la cache delle pagine del sito dopo una scrittura su WooCommerce.
//
// Il sito sta dietro due cache (Breeze sul server di Cloudways e la rete
// Cloudflare di Cloudways davanti) che tengono una copia della pagina
// fino a 30 giorni. Una modifica fatta dall'API di WooCommerce non le
// svuota: WooCommerce ha il prezzo nuovo, i clienti vedono ancora quello
// vecchio. Verificato il 16/09/2026.
//
// La rotta elitederma/v1/svuota-cache (snippet WordPress in
// wordpress/elitederma-svuota-cache.php) chiede a Breeze di svuotare le
// pagine di quei prodotti — o tutto il sito — e Breeze, sui server
// Cloudways, svuota anche Cloudflare.
//
// Non fa mai fallire la scrittura che l'ha chiamata: WooCommerce ha gia'
// salvato, la cache e' un dettaglio in piu'. Restituisce un avviso
// (stringa) se non ci e' riuscita, null se e' andata bene, cosi' chi
// chiama lo mette nella risposta e l'app lo puo' mostrare.
//
// Variabili d'ambiente: WC_SITE_URL e WP_MENU_BRIDGE_SECRET (le stesse
// del ponte del menu).

export async function svuotaCacheSito(opzioni: { prodottiWooIds?: (number | null | undefined)[]; tutto?: boolean }): Promise<string | null> {
  const siteUrl = Deno.env.get("WC_SITE_URL");
  const secret = Deno.env.get("WP_MENU_BRIDGE_SECRET");
  if (!siteUrl || !secret) {
    return "La cache del sito non e' stata svuotata: manca la chiave del ponte WordPress (WP_MENU_BRIDGE_SECRET).";
  }
  const prodotti = (opzioni.prodottiWooIds || []).filter((id): id is number => typeof id === "number" && id > 0);
  if (!opzioni.tutto && prodotti.length === 0) return null;
  try {
    const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/svuota-cache`, {
      method: "POST",
      headers: { "x-elitederma-secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify({ prodotti, tutto: !!opzioni.tutto }),
    });
    if (risposta.status === 404) {
      return "La cache del sito non e' stata svuotata: sul sito manca lo snippet \"Elitederma — Svuota cache dal gestionale\".";
    }
    if (!risposta.ok) {
      return `La cache del sito non e' stata svuotata: il sito ha risposto ${risposta.status}.`;
    }
    const dati = await risposta.json().catch(() => null);
    if (!dati?.ok) {
      return "La cache del sito non e' stata svuotata: " + (dati?.errore || "risposta inattesa dal sito.");
    }
    return null;
  } catch (e) {
    console.error("svuotaCacheSito: sito non raggiunto", e instanceof Error ? e.message : String(e));
    return "La cache del sito non e' stata svuotata: sito non raggiungibile.";
  }
}
