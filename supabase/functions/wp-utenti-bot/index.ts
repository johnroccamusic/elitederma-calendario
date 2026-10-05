// Edge Function "wp-utenti-bot"
// Elenca — e, se glielo si chiede, cancella — gli account WordPress creati
// dai bot: indirizzi "a codice", nessun ordine, nessun contenuto.
//
// Perche' passa di qui e non dal browser: cancellare utenti di WordPress
// vuole le credenziali di un amministratore, e quelle non devono girare
// nell'app ne' in una chat. Qui si usa la stessa chiave del ponte del menu
// e della cache, che vive solo fra i secret di Supabase.
//
// Variabili d'ambiente: WC_SITE_URL / WP_MENU_BRIDGE_SECRET.
//
// Chiamata:
//   supabase.functions.invoke('wp-utenti-bot')                      -> guarda e basta
//   supabase.functions.invoke('wp-utenti-bot', { body: { cancella: true } })
//
// Sul sito deve essere attivo lo snippet "Elitederma — Pulizia degli
// account creati dai bot" (wordpress/elitederma-utenti-bot.php).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { /* chiamata senza corpo: va bene */ }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const secret = Deno.env.get("WP_MENU_BRIDGE_SECRET");
  if (!siteUrl || !secret) return json({ errore: "Manca la chiave del ponte WordPress (WP_MENU_BRIDGE_SECRET)" }, 500);

  const risposta = await fetch(`${siteUrl}/wp-json/elitederma/v1/utenti-bot`, {
    method: "POST",
    headers: { "x-elitederma-secret": secret, "Content-Type": "application/json" },
    body: JSON.stringify({
      // di suo non cancella niente: lo si chiede, e si chiede dopo aver guardato
      cancella: corpo?.cancella === true,
      limite: typeof corpo?.limite === "number" ? corpo.limite : 500,
    }),
  });

  if (risposta.status === 404) {
    return json({ errore: 'Sul sito manca lo snippet "Elitederma — Pulizia degli account creati dai bot".' }, 404);
  }
  if (risposta.status === 401 || risposta.status === 403) {
    return json({ errore: "Il sito ha rifiutato la chiave: controlla ELITEDERMA_BRIDGE_SECRET nello snippet \"Claude access\"." }, 403);
  }
  if (!risposta.ok) {
    return json({ errore: `Il sito ha risposto ${risposta.status}`, dettaglio: await risposta.text() }, 502);
  }
  return json(await risposta.json());
});
