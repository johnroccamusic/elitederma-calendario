// Edge Function "woo-elimina-prodotto"
// Cancella un prodotto da WooCommerce (force=true, cancellazione
// definitiva non nel cestino) e SOLO se riesce stacca il collegamento
// nella riga locale (woo_product_id azzerato, giacenza online riportata
// a zero) — il prodotto resta nel magazzino locale come "solo offline",
// pronto a tornare online in futuro con un codice Woo nuovo. Stesso
// principio "Woo prima, locale poi" di woo-elimina-coupon.
//
// Va usata solo per prodotti senza storico vendite da preservare: un
// prodotto che ha già generato movimentazione va invece messo in bozza
// (woo-gestisci-prodotto, azione "modifica", stato "draft"), non cancellato.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app: supabase.functions.invoke('woo-elimina-prodotto', { body: { prodottoId } })

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

  const { prodottoId } = corpo || {};
  if (!prodottoId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: prodottoId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: riga, error: erroreLettura } = await supabase.from("prodotti_shop").select("id, woo_product_id").eq("id", prodottoId).single();
  if (erroreLettura || !riga) {
    return new Response(JSON.stringify({ errore: "Prodotto non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (riga.woo_product_id) {
    const siteUrl = Deno.env.get("WC_SITE_URL");
    const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
    const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
    if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
      return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);
    try {
      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/${riga.woo_product_id}?force=true`, {
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

  const { error: erroreUpdate } = await supabase.from("prodotti_shop").update({ woo_product_id: null, giacenza: 0 }).eq("id", prodottoId);
  if (erroreUpdate) {
    return new Response(JSON.stringify({ errore: "Cancellato da WooCommerce ma non scollegato in locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
