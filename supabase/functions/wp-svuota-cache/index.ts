// Edge Function "wp-svuota-cache"
// Il tasto manuale "Svuota cache del sito" di Gestione shop: chiede al
// sito (via lo snippet elitederma/v1/svuota-cache) di buttare via tutte
// le pagine in cache, Breeze e Cloudflare insieme. Serve quando si sono
// fatte modifiche direttamente su WordPress, o per sicurezza dopo una
// serie di salvataggi.
//
// Le scritture normali (prodotto, categoria, riordino) svuotano la cache
// da sole, ognuna per la sua parte: vedi _shared/cacheSito.ts.
//
// Variabili d'ambiente richieste: WC_SITE_URL, WP_MENU_BRIDGE_SECRET.
//
// Chiamata dall'app: supabase.functions.invoke('wp-svuota-cache')

import { svuotaCacheSito } from "../_shared/cacheSito.ts";

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
  const avviso = await svuotaCacheSito({ tutto: true });
  if (avviso) {
    return new Response(JSON.stringify({ errore: avviso }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
