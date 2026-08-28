// Edge Function "woo-stato-ordine"
// Cambia lo stato di un ordine su WooCommerce (PUT /orders/{id}) e, solo
// se il sito accetta, aggiorna anche la riga locale in vendite_shop.
//
// Perché passare da qui e non scrivere solo in locale: lo stato di un
// ordine è del sito — è lui che manda le email al cliente, che decide
// cosa è spedito e cosa no. Scriverlo solo in anagrafica creerebbe due
// verità, e la prima sincronizzazione lo riporterebbe indietro.
//
// Il magazzino non viene toccato qui: ci pensa woo-webhook, che riceve da
// WooCommerce l'aggiornamento dell'ordine e scarica o ripristina secondo
// la stessa regola di sempre (STATI_VIVI). Un solo posto che muove le
// giacenze, come per gli ordini che arrivano dal sito.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// gli stati che ha senso impostare a mano dall'app. "trash" e "failed"
// restano fuori: il primo cancella, il secondo lo decide il pagamento
const STATI_AMMESSI = ["completed", "processing", "on-hold", "cancelled", "refunded", "pending"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let corpo: any;
  try { corpo = await req.json(); } catch {
    return new Response(JSON.stringify({ errore: "JSON non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { venditaId, stato } = corpo || {};
  if (!venditaId || !stato) {
    return new Response(JSON.stringify({ errore: "Parametri mancanti: venditaId e stato" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!STATI_AMMESSI.includes(stato)) {
    return new Response(JSON.stringify({ errore: `Stato non ammesso: ${stato}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: vendita, error: erroreLettura } = await supabase
    .from("vendite_shop")
    .select("id, woo_order_id, numero_ordine, origine")
    .eq("id", venditaId)
    .single();
  if (erroreLettura || !vendita) {
    return new Response(JSON.stringify({ errore: "Ordine non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!vendita.woo_order_id) {
    return new Response(JSON.stringify({ errore: "Questo movimento non è un ordine dello shop online: non ha uno stato da cambiare sul sito." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/orders/${vendita.woo_order_id}`, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ status: stato }),
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    // niente scritto in locale: meglio restare indietro che divergere
    return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato il cambio di stato (${risposta.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const aggiornato = await risposta.json();

  const { error: erroreUpdate } = await supabase
    .from("vendite_shop")
    .update({ stato: aggiornato.status || stato, ts_ricevuto: new Date().toISOString() })
    .eq("id", venditaId);
  if (erroreUpdate) {
    return new Response(JSON.stringify({ errore: "Cambiato su WooCommerce ma non nel database locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, stato: aggiornato.status || stato }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
