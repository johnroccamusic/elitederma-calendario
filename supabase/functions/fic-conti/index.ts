// Edge Function "fic-conti"
//
// Elenca i conti di saldo dell'azienda su Fatture in Cloud — banca,
// contanti, Stripe, PayPal — perche' l'app possa farli scegliere da una
// tendina invece di chiederli a voce.
//
// Non e' un dato del cliente e non sta sulla fattura: e' dove entrano i
// soldi, cioe' una cosa nostra, decisa una volta. Per questo non vive
// fra i campi dell'intestatario ma fra le impostazioni.
//
// Chiede solo. Il token sta dal lato server e non esce di qui.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { leggiConnessione, tokenValido, contiSaldo } from "../_shared/fic.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const conn = await leggiConnessione(sb);
    const token = await tokenValido(sb, conn);
    return json({ conti: await contiSaldo(token, conn.company_id) });
  } catch (e) {
    return json({ errore: e instanceof Error ? e.message : String(e) }, 502);
  }
});
