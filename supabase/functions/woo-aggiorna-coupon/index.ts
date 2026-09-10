// Edge Function "woo-aggiorna-coupon"
// Cambia la SCADENZA di un coupon già esistente su WooCommerce
// (PUT /wc/v3/coupons/{id}) e, solo se quella chiamata riesce, riscrive
// `valido_fino_a` nella nostra tabella.
//
// Perché esiste. Fino a ieri i coupon si potevano creare (woo-crea-coupon)
// e cancellare (woo-elimina-coupon), ma non correggere: cambiare la
// scadenza voleva dire cambiarla da noi e lasciarla vecchia sul sito, con
// il risultato peggiore possibile — un codice che nell'app risulta scaduto
// e sullo shop continua a scontare. Chi vende non se ne accorge finché
// non arriva l'ordine.
//
// L'ordine delle due scritture non è casuale: prima il sito, poi noi. Il
// sito è quello che sconta davvero; se restasse indietro lui, il danno
// sarebbe reale. Restare indietro noi è solo un dato da risistemare.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata:
//   supabase.functions.invoke('woo-aggiorna-coupon', { body: { couponId, validoFinoA } })
// `validoFinoA` è "aaaa-mm-gg", oppure null per togliere la scadenza.

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
  const validoFinoA = corpo?.validoFinoA ?? null;
  if (!couponId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: couponId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (validoFinoA !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(validoFinoA))) {
    return new Response(JSON.stringify({ errore: "validoFinoA dev'essere una data aaaa-mm-gg, oppure null" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: riga, error: erroreLettura } = await supabase.from("coupon").select("id, codice, woo_coupon_id, valido_fino_a").eq("id", couponId).single();
  if (erroreLettura || !riga) {
    return new Response(JSON.stringify({ errore: "Coupon non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!riga.woo_coupon_id) {
    return new Response(JSON.stringify({ errore: "Questo coupon non è ancora su WooCommerce: non c'è niente da aggiornare" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);

  try {
    // stringa vuota, non null: è così che WooCommerce toglie una scadenza
    const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/coupons/${riga.woo_coupon_id}`, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ date_expires: validoFinoA === null ? "" : validoFinoA }),
    });
    if (!rispostaWoo.ok) {
      const testo = await rispostaWoo.text();
      // il dato locale NON si tocca: meglio restare allineati sul vecchio
      // che raccontare una scadenza che sul sito non esiste
      return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato l'aggiornamento (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: erroreUpdate } = await supabase.from("coupon").update({ valido_fino_a: validoFinoA }).eq("id", couponId);
    if (erroreUpdate) {
      return new Response(JSON.stringify({ errore: "Aggiornato su WooCommerce ma non nel database locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, codice: riga.codice, prima: riga.valido_fino_a, adesso: validoFinoA }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: "Errore di rete verso WooCommerce: " + String(e) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
