// Edge Function "analisi-domanda" — CHIEDI AI DATI (25/10/2026).
//
// Una domanda in italiano («i dieci prodotti piu' venduti a maggio»,
// «quale master vende di piu'», «ricavi da settembre a oggi», «quale spesa
// posso abbassare»). In due passi:
//   1. il modello traduce la domanda in UNA SELECT sulle viste analisi_*
//      (il catalogo e' in _shared/analisi.js); la si controlla e la si
//      esegue con `analisi_esegui`, che accetta solo quelle viste;
//   2. il modello scrive la risposta in italiano partendo dalle righe
//      che il database ha restituito.
// Il modello compone e commenta; i numeri li fa Postgres. Se la SELECT
// e' sbagliata, l'errore gli torna indietro e riprova una volta.
//
// Va chiamata con una sessione (verify_jwt): e' per chi amministra, e la
// pagina la mostra solo a loro. Non esce nessun dato personale: le viste
// non ne contengono.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATALOGO_ANALISI, controllaSql, estraiJson } from "../_shared/analisi.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODELLO = "claude-sonnet-5-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function chiedi(chiave: string, system: string, messaggi: unknown[], maxTokens = 1200): Promise<{ testo: string; uso: unknown }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELLO, max_tokens: maxTokens, system, messages: messaggi }),
  });
  if (!r.ok) throw new Error(`Il modello ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const esito = await r.json();
  const testo = (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  return { testo, uso: esito?.usage || null };
}

function oggiRoma(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

const SISTEMA_SQL = (oggi: string) => `Sei l'analista dei dati di Elitederma, un'accademia di formazione estetica che vende corsi e prodotti (al banco durante i corsi, in fiera e sullo shop online).
Oggi e' ${oggi}. Ti viene fatta una domanda in italiano: traduci la domanda in UNA sola query SQL Postgres di sola lettura sulle viste qui sotto, e rispondi SOLO con un JSON {"sql": "...", "nota": "..."} dove "nota" e' una riga che spiega cosa hai contato e con quali filtri.
Se la domanda non si puo' rispondere con queste viste, rispondi {"sql": null, "nota": "perche' no"}.
Regole: usa solo le viste elencate; niente punto e virgola; limita a 50 righe salvo richiesta diversa; arrotonda gli importi a 2 decimali con round(); ordina come chiede la domanda; per «ricavi/incassi» usa analisi_incassi; per i prodotti usa analisi_vendite_righe con stato in ('completed','processing') e tipo_movimento = 'vendita'; «da settembre a oggi» vuol dire dal 1° settembre dell'anno in corso a oggi; «a maggio» senza anno vuol dire maggio dell'anno in corso; i nomi di prodotti, corsi e persone vanno confrontati con ilike.

${CATALOGO_ANALISI}`;

const SISTEMA_RISPOSTA = (oggi: string) => `Sei l'analista dei dati di Elitederma. Oggi e' ${oggi}. Ti vengono dati: la domanda di chi amministra l'accademia, la query SQL che e' stata eseguita e le righe che il database ha restituito.
Scrivi la risposta in italiano, chiara e breve, come la direbbe un collega che ha i numeri davanti: prima il dato che risponde alla domanda, poi se serve un elenco puntato con i numeri (formato italiano: 1.234,56 €), poi al massimo due osservazioni.
Regole ferree: usa SOLO i numeri che stanno nelle righe; non inventare cifre, percentuali o cause; se le righe sono vuote dillo; se i dati hanno un limite (per esempio i costi mancano su alcuni prodotti, o le spese non sono classificate) dillo in una riga. Per domande di giudizio («quale spesa si puo' abbassare») ragiona sui numeri che hai e proponi, senza presentare l'ipotesi come un fatto. Niente markdown complesso: solo testo, elenchi con «- » e grassetto con **.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const domanda = String(corpo.domanda || "").trim().slice(0, 600);
  if (domanda.length < 3) return json({ ok: false, errore: "Scrivi una domanda." }, 400);
  const cronologia = Array.isArray(corpo.cronologia) ? corpo.cronologia.slice(-4) : [];

  // `verify_jwt` accetta anche il JWT anon, cioe' la chiave del bundle:
  // qui serve una persona con la sessione aperta, non la chiave pubblica.
  // Il ruolo (amministratore) lo sa solo la pagina, finche' l'account e'
  // uno per tutti; ma almeno da fuori, senza accesso, non si interroga.
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: utente } = await admin.auth.getUser(gettone);
  if (!utente?.user) return json({ ok: false, errore: "Serve l'accesso all'app." }, 401);

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Analisi non disponibile: manca la chiave." }, 503);
  const oggi = oggiRoma();

  // il contesto delle domande precedenti, solo come testo: cosi' «e a giugno?» ha senso
  const prima = cronologia.map((c: any) => `Domanda precedente: ${String(c?.domanda || "").slice(0, 300)}\nRisposta data: ${String(c?.risposta || "").slice(0, 400)}`).join("\n\n");
  const messaggi: any[] = [{ role: "user", content: (prima ? prima + "\n\n" : "") + `Domanda: ${domanda}` }];

  // passo 1: la query, con un secondo tentativo se non passa
  let sql: string | null = null; let nota = ""; let ultimoErrore = ""; let righe: unknown[] = []; let usoSql: unknown = null;
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    let testo: string;
    try {
      const r = await chiedi(chiave, SISTEMA_SQL(oggi), messaggi, 800);
      testo = r.testo; usoSql = r.uso;
    } catch (e) { return json({ ok: false, errore: String((e as any)?.message || e) }, 502); }
    const piano = estraiJson(testo);
    if (!piano) { ultimoErrore = "Non ho capito la risposta del modello."; messaggi.push({ role: "assistant", content: testo }, { role: "user", content: "Rispondi solo con il JSON {\"sql\": ..., \"nota\": ...}." }); continue; }
    if (!piano.sql) return json({ ok: true, risposta: String(piano.nota || "Con i dati che ho non posso rispondere a questa domanda."), sql: null, righe: [], nota: piano.nota || null });
    const c = controllaSql(String(piano.sql));
    if (!c.ok) { ultimoErrore = c.errore || "query non accettabile"; messaggi.push({ role: "assistant", content: testo }, { role: "user", content: `La query non e' accettabile: ${c.errore}. Correggila e rispondi solo con il JSON.` }); continue; }
    const sqlBuona = String(c.sql || "");
    const { data, error } = await admin.rpc("analisi_esegui", { p_sql: sqlBuona });
    if (error) { ultimoErrore = error.message; messaggi.push({ role: "assistant", content: testo }, { role: "user", content: `Postgres ha risposto: ${error.message}. Correggi la query e rispondi solo con il JSON.` }); continue; }
    sql = sqlBuona; nota = String(piano.nota || ""); righe = Array.isArray(data) ? data : [];
    break;
  }
  if (!sql) return json({ ok: false, errore: "Non sono riuscito a tradurre la domanda in un calcolo: " + ultimoErrore }, 422);

  // passo 2: la risposta, dai numeri
  let risposta = ""; let usoRisposta: unknown = null;
  try {
    const r = await chiedi(chiave, SISTEMA_RISPOSTA(oggi), [{
      role: "user",
      content: `Domanda: ${domanda}\n\nQuery eseguita:\n${sql}\n\nCosa conta la query: ${nota}\n\nRighe restituite (${righe.length}${righe.length >= 300 ? ", troncate a 300" : ""}):\n${JSON.stringify(righe.slice(0, 120))}`,
    }], 1200);
    risposta = r.testo; usoRisposta = r.uso;
  } catch (e) { return json({ ok: false, errore: String((e as any)?.message || e), sql, righe: righe.slice(0, 50) }, 502); }

  // un registro leggero: domanda, query, quante righe, token. Niente righe.
  try {
    await admin.from("analisi_domande").insert({ domanda, sql, nota, righe: righe.length, modello: MODELLO, uso: { sql: usoSql, risposta: usoRisposta }, chi: String(corpo.chi || "").slice(0, 80) || null });
  } catch { /* il registro non ferma la risposta */ }

  return json({ ok: true, risposta, sql, nota, righe: righe.slice(0, 50), totale_righe: righe.length });
});
