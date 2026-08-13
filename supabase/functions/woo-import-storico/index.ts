// Edge Function "woo-import-storico"
// Recupera dallo storico WooCommerce gli ordini mancanti su Supabase (es.
// se il webhook "woo-webhook" si è fermato per un po') — è idempotente:
// rieseguirla non duplica nulla, fa solo un upsert su woo_order_id.
// Richiamabile dal tasto "Recupera ordini mancanti" in Vendite shop
// (supabase.functions.invoke, stessa autenticazione anon-key delle altre
// funzioni Woo — nessun secret separato da gestire lato client).
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL        — es. https://shop.elitederma.it (senza slash finale)
//   WC_CONSUMER_KEY    — Consumer key generata in WooCommerce → Impostazioni → Avanzate → REST API
//   WC_CONSUMER_SECRET — Consumer secret della stessa chiave

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mappaOrdine } from "../_shared/woo.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 200; // tetto di sicurezza: 200 x 100 = 20.000 ordini

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

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response("Configurazione WooCommerce mancante (WC_SITE_URL/WC_CONSUMER_KEY/WC_CONSUMER_SECRET)", { status: 500, headers: corsHeaders });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  let pagina = 1;
  let ordiniImportati = 0;
  let completato = false;

  while (pagina <= MASSIMO_PAGINE) {
    const url = `${siteUrl}/wp-json/wc/v3/orders?per_page=${PER_PAGE}&page=${pagina}&orderby=id&order=asc`;
    const risposta = await fetch(url, { headers: { Authorization: auth } });

    if (!risposta.ok) {
      const testo = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `WooCommerce ha risposto ${risposta.status} alla pagina ${pagina}`, dettaglio: testo, ordiniImportati, pagina }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ordini = await risposta.json();
    if (!Array.isArray(ordini) || ordini.length === 0) { completato = true; break; }

    const righe = ordini.map(mappaOrdine).filter((r): r is Record<string, unknown> => r !== null);
    if (righe.length > 0) {
      const { error } = await supabase.from("vendite_shop").upsert(righe, { onConflict: "woo_order_id" });
      if (error) {
        return new Response(
          JSON.stringify({ errore: "Errore salvataggio su Supabase: " + error.message, ordiniImportati, pagina }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    ordiniImportati += righe.length;
    if (ordini.length < PER_PAGE) { completato = true; break; }
    pagina += 1;
  }

  return new Response(
    JSON.stringify({ ordiniImportati, pagineProcessate: pagina, completato }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
