// Edge Function "ispeziona-prodotto" — TEMPORANEA.
//
// Legge i campi nascosti che il gestionale scrive sui prodotti di
// WooCommerce e li restituisce. Serve a rispondere a una domanda che da
// fuori non si puo' fare: il campo c'e' davvero sul sito, o il problema
// e' da un'altra parte? La Store API i campi che cominciano con "_" non
// li mostra, e senza questa funzione si va a tentativi.
//
// Si cancella appena la domanda ha una risposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (c: unknown, s = 200) =>
  new Response(JSON.stringify(c), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const siteUrl = Deno.env.get("WC_SITE_URL");
  const key = Deno.env.get("WC_CONSUMER_KEY");
  const secret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !key || !secret) return json({ errore: "credenziali mancanti" }, 500);
  let wooId = 0;
  try { const b = await req.json(); wooId = Number(b?.wooId) || 0; } catch { /* vuoto */ }
  if (!wooId) return json({ errore: "serve wooId" }, 400);
  const auth = "Basic " + btoa(`${key}:${secret}`);
  const r = await fetch(`${siteUrl}/wp-json/wc/v3/products/${wooId}`, { headers: { Authorization: auth } });
  if (!r.ok) return json({ errore: `WooCommerce ha risposto ${r.status}`, dettaglio: (await r.text()).slice(0, 300) }, 502);
  const p = await r.json();
  const nostri = (p.meta_data || []).filter((m: any) => String(m.key || "").startsWith("_ed_"));
  return json({ nome: p.name, menu_order: p.menu_order, campi: nostri });
});
