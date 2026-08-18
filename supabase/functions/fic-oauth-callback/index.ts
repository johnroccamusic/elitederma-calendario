// Edge Function "fic-oauth-callback"
// Riceve il redirect OAuth2 di Fatture in Cloud dopo che l'utente ha
// cliccato "Autorizza" (Authorization Code Flow): scambia il "code"
// con un access_token/refresh_token e li salva in
// fatture_in_cloud_config — l'unica tabella di questo database senza
// policy RLS per anon/authenticated: leggibile e scrivibile solo da
// qui (service role), mai dal browser. Se l'account ha più aziende
// collegate viene scelta la prima e segnalata nella risposta.
//
// Va registrato su developers.fattureincloud.it come Redirect URL
// dell'app, esattamente uguale a FIC_REDIRECT_URI qui sotto.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   FIC_CLIENT_ID
//   FIC_CLIENT_SECRET
//   FIC_REDIRECT_URI   — es. https://<project>.supabase.co/functions/v1/fic-oauth-callback

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function paginaEsito(titolo: string, corpo: string) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${titolo}</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 60px auto; color: #0E1B33;">
<h2>${titolo}</h2><p>${corpo}</p><p>Puoi chiudere questa pagina.</p></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const erroreOAuth = url.searchParams.get("error");
  const htmlHeaders = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

  if (erroreOAuth) {
    return new Response(paginaEsito("Autorizzazione rifiutata", `Fatture in Cloud ha risposto: ${erroreOAuth}`), { status: 400, headers: htmlHeaders });
  }
  if (!code) {
    return new Response(paginaEsito("Errore", "Parametro \"code\" mancante nel redirect."), { status: 400, headers: htmlHeaders });
  }

  const clientId = Deno.env.get("FIC_CLIENT_ID");
  const clientSecret = Deno.env.get("FIC_CLIENT_SECRET");
  const redirectUri = Deno.env.get("FIC_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(paginaEsito("Configurazione mancante", "FIC_CLIENT_ID/FIC_CLIENT_SECRET/FIC_REDIRECT_URI non impostati nei secret dell'Edge Function."), { status: 500, headers: htmlHeaders });
  }

  const rispostaToken = await fetch("https://api-v2.fattureincloud.it/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!rispostaToken.ok) {
    const testo = await rispostaToken.text();
    return new Response(paginaEsito("Errore nello scambio del codice", `Fatture in Cloud ha risposto ${rispostaToken.status}: ${testo}`), { status: 502, headers: htmlHeaders });
  }
  const token = await rispostaToken.json();

  // elenco aziende collegate all'account (ListUserCompaniesResponse:
  // { data: { companies: [{ id, name, ... }] } }) — con più di
  // un'azienda si sceglie la prima e lo si segnala in risposta
  const rispostaAziende = await fetch("https://api-v2.fattureincloud.it/user/companies", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const aziende = rispostaAziende.ok ? await rispostaAziende.json() : null;
  const elencoAziende: Array<{ id: number; name: string }> = aziende?.data?.companies || [];
  const companyId = elencoAziende[0]?.id ?? null;
  const companyNome = elencoAziende[0]?.name ?? null;

  const scadeIl = new Date(Date.now() + (token.expires_in || 86400) * 1000).toISOString();

  const { error } = await supabase.from("fatture_in_cloud_config").insert({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_scade_il: scadeIl,
    company_id: companyId,
    company_nome: companyNome,
  });
  if (error) {
    return new Response(paginaEsito("Autorizzazione ottenuta ma salvataggio fallito", error.message), { status: 500, headers: htmlHeaders });
  }

  const notaMultiAzienda = elencoAziende.length > 1
    ? ` Attenzione: sono state trovate ${elencoAziende.length} aziende sul tuo account, è stata collegata automaticamente "${companyNome}" — se non è quella giusta, va corretto a mano nella tabella fatture_in_cloud_config.`
    : "";

  return new Response(
    paginaEsito("Collegamento a Fatture in Cloud riuscito", `Azienda collegata: <b>${companyNome || "sconosciuta"}</b>.${notaMultiAzienda}`),
    { status: 200, headers: htmlHeaders }
  );
});
