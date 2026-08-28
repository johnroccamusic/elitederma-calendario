// Edge Function "woo-variazioni"
// Sola lettura: elenca le variazioni (taglie, colori) di un prodotto
// variabile di WooCommerce.
//
// Perché serve. Su WooCommerce una taglia NON è un prodotto: è una
// "variazione" figlia del prodotto padre, con un id suo. In anagrafica
// invece ogni taglia è una riga a sé. Senza un elenco delle variazioni
// l'app non ha modo di sapere che la XXL venduta online corrisponde a una
// certa riga del suo magazzino — ed è il motivo per cui la vendita di una
// taglia non scaricava nulla: il webhook cercava per nome, e il nome della
// variazione ("T-Shirt EliteDerma - XXL") non è quello della riga
// ("T-Shirt Elitederma Tg. XXL").
//
// Il collegamento si scrive poi in prodotti_shop.woo_variation_id, che il
// webhook prova per primo.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET (bastano permessi di lettura)
//
// Chiamata dall'app:
//   supabase.functions.invoke('woo-variazioni', { body: { wooProductId: 698 } })

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let corpo: any;
  try { corpo = await req.json(); } catch {
    return new Response(JSON.stringify({ errore: "JSON non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const wooProductId = corpo?.wooProductId;
  if (!wooProductId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: wooProductId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/products/${wooProductId}/variations?per_page=100`, { headers: { Authorization: auth } });
  if (!risposta.ok) {
    const testo = await risposta.text();
    return new Response(JSON.stringify({ errore: `WooCommerce ha risposto ${risposta.status}`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const variazioni = await risposta.json();

  return new Response(JSON.stringify({
    ok: true,
    variazioni: (Array.isArray(variazioni) ? variazioni : []).map((v: any) => ({
      id: v.id,
      // "M", "XXL", "Rosso / L": è come la variazione si presenta al cliente
      descrizione: (Array.isArray(v.attributes) ? v.attributes : []).map((a: any) => a.option).filter(Boolean).join(" / ") || v.sku || String(v.id),
      sku: v.sku || null,
      prezzo: v.price != null && v.price !== "" ? Number(v.price) : null,
      stock: v.stock_quantity ?? null,
      stato: v.status || null,
    })),
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
