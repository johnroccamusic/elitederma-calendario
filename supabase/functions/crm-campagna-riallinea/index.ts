// RIMETTERE IN PARI GLI STATI DI UNA CAMPAGNA, CHIEDENDOLI A RESEND
// (25/11/2026).
//
// PERCHE' ESISTE. Fino al 25/11 un avviso di Resend che arrivava prima
// che la riga avesse il suo `resend_id` veniva buttato: la riga restava
// «inviata» per sempre, anche quando la mail era stata consegnata o era
// rimbalzata. Sulla prima campagna vera sono rimaste cosi' 301 righe su
// 437. Il buco e' chiuso (vedi `crm_campagna_segna_inviate`), ma le
// righe gia' cieche nessuno le rimette in pari da solo: questa funzione
// chiede a Resend, una per una, com'e' finita.
//
// E RESTA UTILE DOPO, come rete sotto le altre due difese: un avviso
// puo' sempre perdersi — Resend giu' per un minuto, il nostro endpoint
// che risponde 500, un rinvio che non arriva mai. Una riga ferma su
// «inviata» da piu' di un'ora si richiede e basta. Il cron la chiama
// ogni ora.
//
// NON SPEDISCE NIENTE. Legge `GET /emails/{id}` e scrive lo stato con la
// stessa scala di tutti gli altri avvisi (`crm_campagna_applica_evento`,
// in un posto solo): una riga non torna mai indietro, e un rimbalzo
// rimane un rimbalzo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Identica a quella di `sync-shop-vigilanza`, e per gli stessi motivi:
// il gettone del cron nasce dentro Postgres e non esce dal database.
async function autorizzato(req: Request): Promise<boolean> {
  const gettoneCron = (req.headers.get("x-cron-token") || "").trim();
  if (gettoneCron) {
    const { data, error } = await admin.rpc("email_cron_ok", { gettone: gettoneCron });
    return !error && data === true;
  }
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return false;
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  const { data, error } = await admin.auth.getUser(gettone);
  return !error && !!data?.user;
}

// Lo stato che Resend restituisce, tradotto nell'avviso corrispondente:
// si riusa la stessa scala del webhook invece di scrivere i nomi degli
// stati qui dentro.
const EVENTO: Record<string, string> = {
  delivered: "email.delivered",
  bounced: "email.bounced",
  complained: "email.complained",
  opened: "email.opened",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);
  if (!(await autorizzato(req))) return json({ ok: false, errore: "Non autorizzato" }, 401);

  // LA CHIAVE CHE SPEDISCE NON SA LEGGERE (misurato il 25/11/2026: la
  // prima chiamata vera ha avuto 401 su ogni riga). Le chiavi di Resend
  // sono «Sending access» o «Full access», e `GET /emails/{id}` vuole la
  // seconda. Qui si usa una chiave di SOLA LETTURA tenuta a parte
  // (`RESEND_API_KEY_LETTURA`), cosi' quella che spedisce resta quella
  // che spedisce e basta; se non c'e' si prova con l'altra, che e' il
  // caso in cui qualcuno ha allargato i permessi di quella.
  const chiave = Deno.env.get("RESEND_API_KEY_LETTURA") || Deno.env.get("RESEND_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Manca RESEND_API_KEY_LETTURA (o RESEND_API_KEY)" }, 500);

  const corpo = await req.json().catch(() => ({}));
  const campagnaId: string | null = corpo?.campagnaId || null;
  // quante righe per chiamata: Resend accetta una richiesta alla volta e
  // la funzione ha un tetto di tempo. Chi chiama ripete finche'
  // `restanti` non e' zero, come fa l'invio.
  const quante = Math.min(200, Math.max(1, Number(corpo?.quante) || 100));
  // di default si guardano solo le righe ferme da piu' di un'ora: una
  // appena spedita puo' essere semplicemente ancora in viaggio, e
  // chiederla adesso vorrebbe dire una domanda sprecata
  const minutiFermi = corpo?.minutiFermi == null ? 60 : Math.max(0, Number(corpo.minutiFermi) || 0);
  const soglia = new Date(Date.now() - minutiFermi * 60_000).toISOString();

  let query = admin.from("crm_campagne_destinatari")
    .select("id, resend_id, inviata_il")
    .eq("stato", "inviata")
    .not("resend_id", "is", null)
    .lte("inviata_il", soglia)
    .order("inviata_il", { ascending: true })
    .limit(quante);
  if (campagnaId) query = query.eq("campagna_id", campagnaId);

  const { data: righe, error } = await query;
  if (error) return json({ ok: false, errore: error.message }, 500);
  if (!righe?.length) return json({ ok: true, guardate: 0, aggiornate: 0, restanti: 0 });

  let aggiornate = 0;
  let ancoraInViaggio = 0;
  const perStato: Record<string, number> = {};
  const guasti: string[] = [];

  for (const riga of righe) {
    let r: Response;
    try {
      r = await fetch(`https://api.resend.com/emails/${riga.resend_id}`, {
        headers: { Authorization: `Bearer ${chiave}` },
      });
    } catch (e) {
      guasti.push(String(e).slice(0, 80));
      break; // Resend non risponde: si riprova alla chiamata dopo
    }
    if (r.status === 429) break; // troppo in fretta: si riprende dopo
    // 401/403 NON E' UN GUASTO DELLA SINGOLA RIGA, e' la chiave che non
    // puo' leggere: ci si ferma subito e lo si dice. Insistere vorrebbe
    // dire cento domande identiche e cento rifiuti, e in fondo un «0
    // rimesse in pari» che non spiega niente.
    if (r.status === 401 || r.status === 403) {
      return json({
        ok: false, guardate: 0, aggiornate: 0,
        errore: "La chiave di Resend non puo' LEGGERE le mail (risponde "
          + r.status + "): quella che spedisce ha i soli permessi di invio. "
          + "Serve una chiave «Full access» su Resend, messa nei secret di Supabase come RESEND_API_KEY_LETTURA.",
      }, 200);
    }
    if (!r.ok) { guasti.push(`${riga.resend_id}: Resend ${r.status}`); continue; }
    const dati = await r.json().catch(() => ({}));
    const stato = String(dati?.last_event || dati?.status || "").toLowerCase();
    perStato[stato || "?"] = (perStato[stato || "?"] || 0) + 1;
    const tipo = EVENTO[stato];
    if (!tipo) { ancoraInViaggio++; continue; }
    const { error: erroreScrittura } = await admin.rpc("crm_campagna_applica_evento", {
      p_resend_id: riga.resend_id, p_tipo: tipo, p_quando: new Date().toISOString(), p_parcheggia: false,
    });
    if (erroreScrittura) { guasti.push(`${riga.resend_id}: ${erroreScrittura.message}`); continue; }
    aggiornate++;
  }

  // quante ne restano da guardare, con gli stessi criteri
  let conta = admin.from("crm_campagne_destinatari")
    .select("id", { count: "exact", head: true })
    .eq("stato", "inviata").not("resend_id", "is", null).lte("inviata_il", soglia);
  if (campagnaId) conta = conta.eq("campagna_id", campagnaId);
  const { count: restanti } = await conta;

  return json({
    ok: true, guardate: righe.length, aggiornate, ancoraInViaggio,
    perStato, restanti: restanti || 0, guasti: guasti.slice(0, 5),
  });
});
