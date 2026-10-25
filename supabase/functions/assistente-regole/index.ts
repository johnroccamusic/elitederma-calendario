// Edge Function "assistente-regole" — L'ASSISTENTE DEI REGOLAMENTI (25/10/2026).
//
// Chi lavora nell'app (venditori, master, assistenti) fa una domanda
// dall'icona flottante: «quanto sconto posso fare in aula?», «cosa faccio
// se l'allieva vuole aggiungere le modelle dopo la firma?». Il modello
// risponde SOLO con quello che sta scritto nelle schede di `regolamenti`
// visibili a quel ruolo, e dice quali ha usato. Se nessuna scheda
// risponde, lo dice chiaro e la domanda finisce nel registro come
// «senza risposta»: e' da li' che il titolare capisce cosa manca.
//
// Non arriva al modello nessun dato di allievi o vendite: solo le schede
// e la domanda. Serve una sessione vera (getUser): verify_jwt accetta
// anche il JWT anon del bundle, e non basta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Haiku: il lavoro e' ritrovare e citare, non ragionare. Costa un decimo.
const MODELLO = "claude-haiku-5-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RUOLI = ["tutti", "venditori", "master", "assistenti", "amministrazione"];

type Scheda = { id: string; titolo: string; argomento: string | null; testo: string; decisa_il: string | null; visibile_a: string[] };

const SISTEMA = (schede: Scheda[]) => `Sei l'assistente interno di Elitederma, un'accademia di formazione estetica. Chi ti scrive lavora nell'accademia (venditori, master, assistenti) e ti chiede come ci si comporta: prezzi, sconti, regole, procedure.
Rispondi SOLO con quello che sta scritto nelle schede qui sotto. Sono le decisioni prese dal titolare e sono l'unica fonte ammessa.
Regole ferree:
- se una o piu' schede rispondono, scrivi la risposta in italiano, breve e pratica, e indica i numeri delle schede usate;
- se nessuna scheda risponde, o la risposta richiederebbe di interpretare o inventare, NON rispondere nel merito: scrivi che su questo punto non c'e' una decisione scritta e che va chiesto a chi amministra, e segna senza_risposta = true;
- non inventare cifre, percentuali, date o procedure che non stanno nelle schede; non dedurre una regola da un'altra;
- se la domanda e' solo in parte coperta, rispondi alla parte coperta e di' chiaramente quale parte non lo e';
- cita la scheda per titolo nel testo quando serve («come dice la regola "Sconti d'aula"…»).
Rispondi SOLO con un JSON: {"risposta": "...", "schede": [numeri], "senza_risposta": true|false}. Nel testo usa al massimo elenchi con «- » e grassetto con **.

SCHEDE (${schede.length}):
${schede.map((s, i) => `[${i + 1}] ${s.titolo}${s.argomento ? ` — ${s.argomento}` : ""}${s.decisa_il ? ` (decisa il ${s.decisa_il})` : ""}\n${s.testo}`).join("\n\n")}`;

function estraiJson(testo: string) {
  const a = testo.indexOf("{"); const b = testo.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(testo.slice(a, b + 1)); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const domanda = String(corpo.domanda || "").trim().slice(0, 600);
  if (domanda.length < 3) return json({ ok: false, errore: "Scrivi una domanda." }, 400);
  const ruolo = RUOLI.includes(String(corpo.ruolo)) ? String(corpo.ruolo) : "tutti";
  const chi = String(corpo.chi || "").slice(0, 80) || null;
  const cronologia = Array.isArray(corpo.cronologia) ? corpo.cronologia.slice(-4) : [];

  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: utente } = await admin.auth.getUser(gettone);
  if (!utente?.user) return json({ ok: false, errore: "Serve l'accesso all'app." }, 401);

  // le schede che valgono per questo ruolo: «tutti» o il ruolo stesso.
  // Chi amministra le vede tutte.
  const { data: tutte, error: errSchede } = await admin.from("regolamenti")
    .select("id, titolo, argomento, testo, decisa_il, visibile_a")
    .eq("attivo", true).order("ordine").order("titolo");
  if (errSchede) return json({ ok: false, errore: errSchede.message }, 500);
  const schede: Scheda[] = (tutte || []).filter((s: Scheda) =>
    ruolo === "amministrazione" || (s.visibile_a || []).includes("tutti") || (s.visibile_a || []).includes(ruolo));

  const registra = async (risposta: string, citati: string[], senza: boolean, uso: unknown) => {
    try { await admin.from("regolamenti_domande").insert({ chi, ruolo, domanda, risposta, citati, senza_risposta: senza, modello: MODELLO, uso }); } catch { /* il registro non ferma la risposta */ }
  };

  if (schede.length === 0) {
    const risposta = "Non c'è ancora nessun regolamento scritto per il tuo ruolo: su questo punto chiedi a chi amministra. La tua domanda è stata registrata.";
    await registra(risposta, [], true, null);
    return json({ ok: true, risposta, citati: [], senza_risposta: true });
  }

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Assistente non disponibile: manca la chiave." }, 503);

  const prima = cronologia.map((c: any) => `Domanda precedente: ${String(c?.domanda || "").slice(0, 300)}\nRisposta data: ${String(c?.risposta || "").slice(0, 400)}`).join("\n\n");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELLO, max_tokens: 900, system: SISTEMA(schede),
      messages: [{ role: "user", content: (prima ? prima + "\n\n" : "") + `Domanda: ${domanda}` }],
    }),
  });
  if (!r.ok) return json({ ok: false, errore: `Il modello ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
  const esito = await r.json();
  const testo = (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  const piano = estraiJson(testo);
  if (!piano || typeof piano.risposta !== "string") return json({ ok: false, errore: "Non ho capito la risposta del modello." }, 502);

  const numeri: number[] = Array.isArray(piano.schede) ? piano.schede.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= schede.length) : [];
  const citati = [...new Set(numeri)].map((n) => schede[n - 1]);
  const senza = !!piano.senza_risposta || citati.length === 0;
  await registra(piano.risposta, citati.map((s) => s.id), senza, esito?.usage || null);
  return json({ ok: true, risposta: piano.risposta, citati: citati.map((s) => ({ id: s.id, titolo: s.titolo })), senza_risposta: senza });
});
