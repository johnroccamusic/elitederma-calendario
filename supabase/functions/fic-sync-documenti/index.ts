// Edge Function "fic-sync-documenti"
// Scarica da Fatture in Cloud le fatture di acquisto ricevute
// (received_documents, tipo "expense") e le allinea in
// fatture_ricevute_fic — upsert su fic_id, quindi rieseguirla non
// duplica nulla. Richiamabile dal tasto "Sincronizza da Fatture in
// Cloud" in Registro documenti fornitore.
//
// Rinnova da solo l'access_token quando è scaduto (o vicino a
// scadere), usando il refresh_token salvato da fic-oauth-callback —
// l'utente non deve mai rifare l'autorizzazione a mano.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   FIC_CLIENT_ID
//   FIC_CLIENT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 100; // tetto di sicurezza: 100 x 100 = 10.000 documenti

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function rinnovaTokenSeServe(config: any) {
  const scadeIl = config.token_scade_il ? new Date(config.token_scade_il).getTime() : 0;
  // margine di 5 minuti, per non rischiare di usare un token appena scaduto
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

// da ReceivedDocument (vedi models/schemas/ReceivedDocument.yaml) alla
// riga di fatture_ricevute_fic
function mappaDocumento(d: any) {
  return {
    fic_id: d.id,
    tipo: d.type || null,
    fornitore_nome: d.entity?.name || null,
    numero_documento: d.invoice_number || null,
    data_documento: d.date || null,
    descrizione: d.description || null,
    categoria: d.category || null,
    imponibile: d.amount_net ?? null,
    iva: d.amount_vat ?? null,
    totale: d.amount_gross ?? null,
    fattura_elettronica: d.e_invoice ?? null,
    payload_raw: d,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: configRighe, error: erroreConfig } = await supabase
    .from("fatture_in_cloud_config")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1);
  if (erroreConfig || !configRighe || configRighe.length === 0) {
    return new Response(JSON.stringify({ errore: "Nessun collegamento a Fatture in Cloud trovato — va completata prima l'autorizzazione OAuth." }), { status: 400, headers: jsonHeaders });
  }
  const config = configRighe[0];
  if (!config.company_id) {
    return new Response(JSON.stringify({ errore: "Azienda Fatture in Cloud non impostata su fatture_in_cloud_config.company_id." }), { status: 400, headers: jsonHeaders });
  }

  const { accessToken, errore: erroreToken } = await rinnovaTokenSeServe(config);
  if (erroreToken || !accessToken) {
    return new Response(JSON.stringify({ errore: erroreToken || "Token non disponibile" }), { status: 502, headers: jsonHeaders });
  }

  let pagina = 1;
  let importati = 0;
  let completato = false;

  while (pagina <= MASSIMO_PAGINE) {
    const url = `https://api-v2.fattureincloud.it/c/${config.company_id}/received_documents?type=expense&page=${pagina}&per_page=${PER_PAGE}`;
    const risposta = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!risposta.ok) {
      const testo = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `Fatture in Cloud ha risposto ${risposta.status} alla pagina ${pagina}`, dettaglio: testo, importati, pagina }),
        { status: 502, headers: jsonHeaders }
      );
    }
    const corpo = await risposta.json();
    const documenti = Array.isArray(corpo.data) ? corpo.data : [];
    if (documenti.length === 0) { completato = true; break; }

    const righe = documenti.map(mappaDocumento);
    const { error } = await supabase.from("fatture_ricevute_fic").upsert(righe, { onConflict: "fic_id" });
    if (error) {
      return new Response(JSON.stringify({ errore: "Errore salvataggio su Supabase: " + error.message, importati, pagina }), { status: 500, headers: jsonHeaders });
    }
    importati += righe.length;

    if (!corpo.last_page || pagina >= corpo.last_page) { completato = true; break; }
    pagina += 1;
  }

  await supabase.from("fatture_in_cloud_config").update({ ultima_sincronizzazione: new Date().toISOString() }).eq("id", config.id);

  return new Response(JSON.stringify({ importati, pagineProcessate: pagina, completato }), { status: 200, headers: jsonHeaders });
});
