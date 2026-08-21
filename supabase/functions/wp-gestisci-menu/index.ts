// Edge Function "wp-gestisci-menu"
// Legge e modifica il menu di navigazione vero di WordPress (Aspetto →
// Menu, posizione "primary" di default) passando dal ponte custom
// installato lì come snippet (namespace REST "elitederma/v1") — non
// l'API WooCommerce, un canale a parte protetto da una chiave dedicata,
// perché le Password Applicazioni di WordPress erano bloccate su
// quell'installazione e la struttura del menu (pagine, link personalizzati,
// vere categorie prodotto) non è ricostruibile dalla sola tassonomia
// WooCommerce.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL              — stessa usata dalle funzioni woo-* (es. https://elitederma.shop)
//   WP_MENU_BRIDGE_SECRET     — la chiave scritta anche nello snippet WordPress
//
// Chiamata dall'app: supabase.functions.invoke('wp-gestisci-menu', { body: {
//   azione: 'leggi' | 'pagine' | 'crea_modifica' | 'elimina',
//   posizione,                              // solo 'leggi', default 'primary'
//   menuId, itemId, titolo, genitoreId,      // solo 'crea_modifica' (itemId assente = crea nuova voce)
//   ordine, tipo,                            // tipo: 'taxonomy' | 'post_type' | 'custom'
//   oggettoId, url,                          // oggettoId per 'taxonomy'/'post_type' (id categoria Woo o id pagina), url per 'custom'
//   itemId,                                  // solo 'elimina'
// }})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ errore: "JSON non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { azione } = corpo || {};
  if (!["leggi", "pagine", "crea_modifica", "elimina"].includes(azione)) {
    return new Response(JSON.stringify({ errore: "Parametro 'azione' non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const secret = Deno.env.get("WP_MENU_BRIDGE_SECRET");
  if (!siteUrl || !secret) {
    return new Response(JSON.stringify({ errore: "Configurazione ponte menu WordPress mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const headers = { "x-elitederma-secret": secret, "Content-Type": "application/json" };

  try {
    if (azione === "leggi") {
      const posizione = corpo.posizione || "primary";
      const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/menu?posizione=${encodeURIComponent(posizione)}`, { headers });
      const dati = await risposta.json();
      if (!risposta.ok) return new Response(JSON.stringify({ errore: dati?.message || `WordPress ha risposto ${risposta.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(dati), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "pagine") {
      const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/pagine`, { headers });
      const dati = await risposta.json();
      if (!risposta.ok) return new Response(JSON.stringify({ errore: dati?.message || `WordPress ha risposto ${risposta.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(dati), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "crea_modifica") {
      const { menuId, itemId, titolo, genitoreId, ordine, tipo, oggettoId, url } = corpo;
      if (!menuId || !titolo?.trim()) {
        return new Response(JSON.stringify({ errore: "menuId e titolo sono obbligatori" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const tipoValido = tipo === "taxonomy" || tipo === "post_type" ? tipo : "custom";
      const payload: Record<string, unknown> = {
        menu_id: menuId,
        item_id: itemId || 0,
        titolo: titolo.trim(),
        genitore_id: genitoreId || 0,
        ordine: ordine ?? 0,
        tipo: tipoValido,
      };
      if (tipoValido === "custom") payload.url = url || "#";
      else payload.oggetto_id = oggettoId;

      const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/menu-item`, { method: "POST", headers, body: JSON.stringify(payload) });
      const dati = await risposta.json();
      if (!risposta.ok) return new Response(JSON.stringify({ errore: dati?.message || `WordPress ha risposto ${risposta.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(dati), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // azione === "elimina"
    const { itemId } = corpo;
    if (!itemId) return new Response(JSON.stringify({ errore: "Parametro mancante: itemId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/menu-item/${itemId}`, { method: "DELETE", headers });
    const dati = await risposta.json();
    if (!risposta.ok) return new Response(JSON.stringify({ errore: dati?.message || `WordPress ha risposto ${risposta.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(dati), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
