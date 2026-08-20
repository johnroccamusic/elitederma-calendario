// Edge Function "woo-elimina-coupon"
// Cancella un coupon: se è già stato creato su WooCommerce (woo_coupon_id
// valorizzato), lo elimina PRIMA lì (force=true, cancellazione definitiva
// non nel cestino) e solo se riesce cancella anche la riga locale — stesso
// principio "Woo prima, locale poi" delle altre funzioni di scrittura. Un
// coupon ancora bozza/programmato (mai creato su Woo) si cancella solo in
// locale, senza bisogno di chiamare WooCommerce.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app: supabase.functions.invoke('woo-elimina-coupon', { body: { couponId } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

  const { couponId } = corpo || {};
  if (!couponId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: couponId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: riga, error: erroreLettura } = await supabase.from("coupon").select("id, woo_coupon_id").eq("id", couponId).single();
  if (erroreLettura || !riga) {
    return new Response(JSON.stringify({ errore: "Coupon non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (riga.woo_coupon_id) {
    const siteUrl = Deno.env.get("WC_SITE_URL");
    const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
    const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
    if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
      return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);
    try {
      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/coupons/${riga.woo_coupon_id}?force=true`, {
        method: "DELETE",
        headers: { Authorization: auth },
      });
      if (!rispostaWoo.ok) {
        const testo = await rispostaWoo.text();
        return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato la cancellazione (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const { error: erroreDelete } = await supabase.from("coupon").delete().eq("id", couponId);
  if (erroreDelete) {
    return new Response(JSON.stringify({ errore: "Cancellato da WooCommerce ma non dal database locale: " + erroreDelete.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
