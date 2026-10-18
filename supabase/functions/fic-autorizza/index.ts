// Edge Function "fic-autorizza"
//
// Prepara il link con cui si rifa' il collegamento a Fatture in Cloud,
// chiedendo anche i permessi di SCRITTURA.
//
// Perche' serve. Il collegamento di agosto era nato per leggere: le
// fatture ricevute, le note di credito. Emettere una fattura e'
// scrittura, e un token senza quel permesso si ferma con un 403 che non
// dice niente di utile. I permessi di un token OAuth non si allargano:
// si rifa' l'autorizzazione chiedendo di piu', e l'utente riapprova.
//
// Perche' una funzione e non un link scritto a mano. L'URL contiene il
// FIC_CLIENT_ID, che sta nei secret di Supabase e non deve passare da
// una chat o da un file del repository, che e' pubblico. Qui l'URL si
// compone dove quella chiave gia' vive.
//
// Gli ambiti sono quelli che servono a quello che l'app fa davvero, e
// nient'altro:
//   received_documents:r          le fatture ricevute (gia' in uso)
//   settings:r                    le aliquote IVA, per la riga in fattura
//   entity.clients:a              il cliente della fattura
//   issued_documents.invoices:a   emettere la fattura
//   issued_documents.credit_notes:a  l'unico modo di correggerne una
// Le stringhe sono quelle dell'SDK ufficiale di Fatture in Cloud, non
// inventate: it/fattureincloud/sdk/auth/Scope.java.
//
// Variabili d'ambiente: FIC_CLIENT_ID, FIC_REDIRECT_URI.

const AMBITI = [
  "received_documents:r",
  "settings:r",
  "entity.clients:a",
  "issued_documents.invoices:a",
  "issued_documents.credit_notes:a",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const clientId = Deno.env.get("FIC_CLIENT_ID");
  const redirect = Deno.env.get("FIC_REDIRECT_URI");
  if (!clientId || !redirect) {
    return json({ errore: "Mancano FIC_CLIENT_ID o FIC_REDIRECT_URI fra i secret di Supabase." }, 500);
  }

  const parametri = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    scope: AMBITI.join(" "),
    // non lo controlla nessuno all'altro capo, ma mandarlo costa niente
    // e lascia una traccia di quando e' partita l'autorizzazione
    state: `elitederma-${Date.now()}`,
  });

  return json({
    url: `https://api-v2.fattureincloud.it/oauth/authorize?${parametri.toString()}`,
    ambiti: AMBITI,
  });
});
