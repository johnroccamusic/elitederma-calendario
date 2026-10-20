// Edge Function "fic-fattura-pdf"
// Dato il `fic_id` di una fattura emessa, torna il link al suo PDF.
//
// PERCHE' NON LO TIENE L'APP. Il link che Fatture in Cloud restituisce e'
// TEMPORANEO e firmato: salvarlo in tabella vorrebbe dire conservare un
// indirizzo che fra un'ora non apre piu' niente, e scoprirlo il giorno in
// cui serve mandarla a un cliente. Si chiede fresco a ogni clic.
//
// Nomi dei campi presi dalla documentazione, non indovinati:
// `IssuedDocument.url` e' «[Temporary] [Read Only] Issued document url of
// the document PDF file». `ei_status` dice a che punto e' il documento
// nello SdI, e vale la pena portarselo dietro: una fattura «discarded»
// mandata al cliente e' una figura, non una copia.
//
// Variabili d'ambiente: FIC_CLIENT_ID / FIC_CLIENT_SECRET (per il rinnovo
// del token, dentro `_shared/fic.ts`).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { leggiConnessione, tokenValido } from "../_shared/fic.ts";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return risposta({ errore: "Metodo non consentito" }, 405);

  let corpo: { ficId?: number | string };
  try { corpo = await req.json(); } catch { return risposta({ errore: "Corpo non leggibile" }, 400); }
  const ficId = Number(corpo?.ficId);
  if (!Number.isFinite(ficId) || ficId <= 0) return risposta({ errore: "Manca il numero del documento." }, 400);

  try {
    const conn = await leggiConnessione(sb);
    const token = await tokenValido(sb, conn);
    const base = `https://api-v2.fattureincloud.it/c/${conn.company_id}/issued_documents/${ficId}`;

    // Prima si chiede il documento intero: `url` di solito c'e' gia'.
    // Se non ci fosse si richiede nominando i campi — due strade invece
    // di una, perche' questa funzione la si prova quando serve davvero
    // e non deve fallire per un parametro.
    const chiedi = async (indirizzo: string) => {
      const r = await fetch(indirizzo, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Fatture in Cloud ha risposto ${r.status}: ${await r.text()}`);
      return (await r.json())?.data || {};
    };

    let documento = await chiedi(base);
    if (!documento?.url) {
      documento = { ...documento, ...(await chiedi(`${base}?fields=url,number,ei_status`)) };
    }
    if (!documento?.url) {
      return risposta({ errore: "Fatture in Cloud non ha dato nessun PDF per questo documento." }, 404);
    }

    return risposta({
      url: documento.url,
      numero: String(documento.number ?? documento.numeration ?? ""),
      // stato nello SdI: «sent», «accepted», «discarded»…
      statoElettronica: documento.ei_status || null,
    });
  } catch (e) {
    return risposta({ errore: e instanceof Error ? e.message : String(e) }, 502);
  }
});
