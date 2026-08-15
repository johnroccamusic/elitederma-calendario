// Edge Function "woo-crea-coupon"
// Legge una riga "coupon" (bozza o programmato), la crea su WooCommerce
// (/wc/v3/coupons) e SOLO se la chiamata riesce salva woo_coupon_id e
// porta stato ad "attivo". Se WooCommerce rifiuta, la riga locale resta
// com'era (bozza/programmato) e l'errore torna al client — nessuna
// modifica deve mai risultare "salvata" solo in locale.
//
// "valido_da" non esiste in WooCommerce (che ha solo la scadenza): un
// coupon con valido_da futura resta "programmato" finché qualcuno non
// preme "Attiva ora", che richiama semplicemente questa stessa funzione.
// Nessuna azione "modifica": per cambiare un coupon già creato si passa
// da WooCommerce, questa è la prima versione (base anche per la futura
// generazione automatica dei premi alle master).
//
// categorie_ids/prodotti_ids/escludi_*_ids sono già woo_category_id /
// woo_product_id (non uuid locali): la conversione dagli id locali
// scelti nel form avviene lato client al salvataggio del coupon, non qui.
//
// Usa la coppia di chiavi API di WooCommerce con permessi di SCRITTURA,
// le stesse già usate da woo-gestisci-prodotto/woo-gestisci-categoria.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app (già autenticata con l'anon key):
//   supabase.functions.invoke('woo-crea-coupon', { body: { couponId } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// senza queste intestazioni il browser blocca la risposta (CORS) e il
// client Supabase fallisce con "Failed to send a request to the Edge
// Function" ancora prima che la funzione faccia qualunque cosa
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

  const { data: riga, error: erroreLettura } = await supabase.from("coupon").select("*").eq("id", couponId).single();
  if (erroreLettura || !riga) {
    return new Response(JSON.stringify({ errore: "Coupon non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (riga.woo_coupon_id) {
    return new Response(JSON.stringify({ errore: "Questo coupon è già stato creato su WooCommerce" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);

  const payloadWoo: Record<string, unknown> = {
    code: riga.codice,
    discount_type: riga.tipo_sconto,
    amount: String(riga.valore),
  };
  if (riga.descrizione) payloadWoo.description = riga.descrizione;
  if (riga.valido_fino_a) payloadWoo.date_expires = riga.valido_fino_a;
  if (riga.ambito === "categorie" && riga.categorie_ids?.length) payloadWoo.product_categories = riga.categorie_ids;
  if (riga.ambito === "prodotti" && riga.prodotti_ids?.length) payloadWoo.product_ids = riga.prodotti_ids;
  if (riga.escludi_categorie_ids?.length) payloadWoo.excluded_product_categories = riga.escludi_categorie_ids;
  if (riga.escludi_prodotti_ids?.length) payloadWoo.excluded_product_ids = riga.escludi_prodotti_ids;
  if (riga.utilizzi_max != null) payloadWoo.usage_limit = riga.utilizzi_max;
  if (riga.utilizzi_max_per_utente != null) payloadWoo.usage_limit_per_user = riga.utilizzi_max_per_utente;
  if (riga.spesa_minima != null) payloadWoo.minimum_amount = String(riga.spesa_minima);
  if (riga.non_cumulabile) payloadWoo.individual_use = true;
  if (riga.limita_a_email?.length) payloadWoo.email_restrictions = riga.limita_a_email;

  try {
    const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/coupons`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payloadWoo),
    });
    if (!rispostaWoo.ok) {
      const testo = await rispostaWoo.text();
      return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato la creazione del coupon (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const creato = await rispostaWoo.json();

    const { error: erroreUpdate } = await supabase.from("coupon").update({ woo_coupon_id: creato.id, stato: "attivo" }).eq("id", couponId);
    if (erroreUpdate) {
      // creato su WooCommerce ma non aggiornato in locale: il coupon esiste
      // ed è già utilizzabile, ma la riga qui resta "bozza"/"programmato" —
      // da correggere a mano confrontando con wp-admin
      return new Response(JSON.stringify({ errore: "Creato su WooCommerce ma non aggiornato nel database locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, wooCouponId: creato.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
