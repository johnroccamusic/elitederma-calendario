// Edge Function "woo-sync-coupon"
// Scarica da WooCommerce l'elenco completo dei codici promozionali
// (/wc/v3/coupons) e lo rispecchia nella tabella "woo_coupon": codice,
// tipo di sconto, importo, descrizione, prodotti, uso/limite e scadenza.
//
// E' uno specchio, non una seconda anagrafica: WooCommerce resta il
// padrone del dato — qui si copia per poterlo guardare insieme alle
// vendite senza uscire dall'app. I coupon spariti dal sito spariscono
// anche da qui, altrimenti resterebbero a mostrare numeri di un codice
// che non esiste piu'.
//
// Variabili d'ambiente richieste (Supabase -> Edge Functions -> Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET
//
// Chiamata dall'app: supabase.functions.invoke('woo-sync-coupon')

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PER_PAGE = 100;
const MASSIMO_PAGINE = 50; // 5.000 coupon: molto oltre il necessario

function soloData(valore: unknown): string | null {
  const testo = String(valore || "").trim();
  if (!testo) return null;
  return testo.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  const righe: Record<string, unknown>[] = [];
  let pagina = 1;
  while (pagina <= MASSIMO_PAGINE) {
    const url = `${siteUrl}/wp-json/wc/v3/coupons?per_page=${PER_PAGE}&page=${pagina}&orderby=date&order=desc`;
    const risposta = await fetch(url, { headers: { Authorization: auth } });
    if (!risposta.ok) {
      const dettaglio = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `WooCommerce ha risposto ${risposta.status}`, dettaglio, pagina }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const lotto = await risposta.json();
    if (!Array.isArray(lotto) || lotto.length === 0) break;
    lotto.forEach((c: any) => {
      righe.push({
        woo_coupon_id: c.id,
        codice: c.code || "",
        tipo_sconto: c.discount_type || null,
        importo: c.amount != null && c.amount !== "" ? Number(c.amount) : null,
        descrizione: c.description || null,
        prodotti_ids: Array.isArray(c.product_ids) ? c.product_ids : [],
        usati: Number(c.usage_count) || 0,
        // "usage_limit" nullo su WooCommerce vuol dire senza limite: si
        // tiene nullo anche qui, e l'app scrive il simbolo dell'infinito
        limite_uso: c.usage_limit != null ? Number(c.usage_limit) : null,
        data_scadenza: soloData(c.date_expires),
        data_creazione: c.date_created || null,
        ts_sincronizzato: new Date().toISOString(),
      });
    });
    if (lotto.length < PER_PAGE) break;
    pagina += 1;
  }

  if (righe.length > 0) {
    const { error } = await supabase.from("woo_coupon").upsert(righe, { onConflict: "woo_coupon_id" });
    if (error) {
      return new Response(JSON.stringify({ errore: "Errore salvataggio: " + error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // i coupon cancellati sul sito non devono sopravvivere qui
    const idsVivi = righe.map((r) => r.woo_coupon_id as number);
    await supabase.from("woo_coupon").delete().not("woo_coupon_id", "in", `(${idsVivi.join(",")})`);
  }

  return new Response(
    JSON.stringify({ coupon: righe.length, pagine: pagina }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
