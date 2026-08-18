// Edge Function "fic-documento-allegato"
// Dato il fic_id di un documento già sincronizzato, torna l'URL (temporaneo,
// firmato da Fatture in Cloud) dell'immagine/PDF originale — richiamata dal
// tasto "Vedi documento originale" nel form "Nuova spesa" quando si importa
// una fattura ricevuta, per poter controllare a mano numero fattura/IBAN
// quando Fatture in Cloud non li ha registrati.
//
// L'URL non viene mai salvato in tabella (è temporaneo, andrebbe presto
// stantio): si richiede fresco ad ogni click. Stessa logica di rinnovo
// token di fic-sync-documenti, duplicata qui apposta (niente import
// relativi fra Edge Function diverse, ognuna va deployata a sé).
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   FIC_CLIENT_ID
//   FIC_CLIENT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function caricaConfigFic() {
  const { data, error } = await supabase
    .from("fatture_in_cloud_config")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    return { config: null, errore: "Nessun collegamento a Fatture in Cloud trovato — va completata prima l'autorizzazione OAuth." };
  }
  return { config: data[0], errore: null as string | null };
}

async function rinnovaTokenSeServe(config: any) {
  const scadeIl = config.token_scade_il ? new Date(config.token_scade_il).getTime() : 0;
  if (scadeIl - Date.now() > 5 * 60 * 1000) {
    return { accessToken: config.access_token as string, errore: null as string | null };
  }

  const clientId = Deno.env.get("FIC_CLIENT_ID");
  const clientSecret = Deno.env.get("FIC_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { accessToken: null, errore: "Configurazione Fatture in Cloud mancante (FIC_CLIENT_ID/FIC_CLIENT_SECRET)" };
  }

  const risposta = await fetch("https://api-v2.fattureincloud.it/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refresh_token,
    }),
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    return { accessToken: null, errore: `Rinnovo token fallito: ${risposta.status} — ${testo}` };
  }
  const token = await risposta.json();
  const nuovaScadenza = new Date(Date.now() + (token.expires_in || 86400) * 1000).toISOString();

  await supabase.from("fatture_in_cloud_config").update({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_scade_il: nuovaScadenza,
  }).eq("id", config.id);

  return { accessToken: token.access_token as string, errore: null as string | null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  let ficId: number | null = null;
  try {
    const body = await req.json();
    ficId = body?.ficId ?? null;
  } catch {
    // corpo mancante o non JSON, gestito sotto
  }
  if (!ficId) {
    return new Response(JSON.stringify({ errore: "Parametro \"ficId\" mancante." }), { status: 400, headers: jsonHeaders });
  }

  const { config, errore: erroreConfig } = await caricaConfigFic();
  if (erroreConfig || !config) {
    return new Response(JSON.stringify({ errore: erroreConfig }), { status: 400, headers: jsonHeaders });
  }
  if (!config.company_id) {
    return new Response(JSON.stringify({ errore: "Azienda Fatture in Cloud non impostata su fatture_in_cloud_config.company_id." }), { status: 400, headers: jsonHeaders });
  }

  const { accessToken, errore: erroreToken } = await rinnovaTokenSeServe(config);
  if (erroreToken || !accessToken) {
    return new Response(JSON.stringify({ errore: erroreToken || "Token non disponibile" }), { status: 502, headers: jsonHeaders });
  }

  const risposta = await fetch(`https://api-v2.fattureincloud.it/c/${config.company_id}/received_documents/${ficId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    return new Response(JSON.stringify({ errore: `Fatture in Cloud ha risposto ${risposta.status}: ${testo}` }), { status: 502, headers: jsonHeaders });
  }
  const corpo = await risposta.json();
  const documento = corpo?.data;
  // per le fatture elettroniche "attachment_url" è il file originale
  // ricevuto dallo SdI: XML grezzo, illeggibile senza foglio di stile.
  // "attachment_preview_url" sarebbe l'anteprima leggibile, ma per i
  // documenti arrivati via canale elettronico spesso non esiste — si
  // prova comunque per prima, XML resta il fallback
  const url = documento?.attachment_preview_url || documento?.attachment_url || null;
  if (!url) {
    return new Response(JSON.stringify({ errore: "Nessun allegato disponibile per questo documento." }), { status: 404, headers: jsonHeaders });
  }

  // il bucket S3 di Fatture in Cloud non ha CORS abilitato: il browser
  // non può leggere l'XML con fetch() dal nostro dominio (funziona solo
  // la navigazione diretta, che però mostra l'albero XML grezzo). Lo
  // scarichiamo qui lato server — nessun problema di CORS fra server —
  // e lo passiamo al frontend come testo, che lo formatta per la
  // lettura (vedi renderaFatturaElettronicaHtml in App.jsx)
  const percorsoSenzaQuery = url.split("?")[0];
  if (percorsoSenzaQuery.toLowerCase().endsWith(".xml")) {
    const rispostaXml = await fetch(url);
    if (!rispostaXml.ok) {
      return new Response(JSON.stringify({ errore: `Download dell'allegato fallito: ${rispostaXml.status}` }), { status: 502, headers: jsonHeaders });
    }
    const xml = await rispostaXml.text();
    return new Response(JSON.stringify({ tipo: "xml", xml }), { status: 200, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ tipo: "url", url }), { status: 200, headers: jsonHeaders });
});
