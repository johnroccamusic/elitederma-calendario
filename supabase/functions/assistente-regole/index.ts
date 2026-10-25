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
// Sonnet, dal 25/10/2026 sera: il titolare ha chiesto «un po' piu' di
// intelligenza» — non solo ritrovare e citare, ma aiutare a ragionare sul
// caso quando una regola scritta non c'e', dicendo pero' sempre quale
// delle due cose sta facendo.
const MODELLO = "claude-sonnet-5-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RUOLI = ["tutti", "venditori", "master", "assistenti", "amministrazione"];

type Scheda = { id: string; titolo: string; argomento: string | null; testo: string; decisa_il: string | null; visibile_a: string[] };

const SISTEMA = (schede: Scheda[], ruolo: string) => `Sei l'assistente interno di Elitederma, un'accademia di formazione estetica (trucco permanente, microblading, microneedling, laminazione ciglia, tricopigmentazione, dermopigmentazione dell'areola) che vende corsi a calendario in varie citta' italiane e prodotti professionali: al banco durante i corsi, in fiera e sullo shop online. Chi ti scrive e' ${ruolo === "tutti" ? "una persona dello staff" : ruolo === "amministrazione" ? "chi amministra" : "un/una " + ruolo.replace(/i$/, "e")} e ti chiede come comportarsi nel lavoro: prezzi, sconti, iscrizioni, modelle, kit, spedizioni, pagamenti, cosa fare in una situazione.

HAI DUE REGISTRI, E DICI SEMPRE QUALE STAI USANDO.

1. DALLE REGOLE. Se una o piu' schede qui sotto rispondono, la risposta e' quella: precisa, breve, con i numeri delle schede usate. Non aggiungere condizioni, cifre o eccezioni che le schede non dicono. Se una scheda copre solo una parte, di' quale parte resta scoperta.

2. UN RAGIONAMENTO. Se nessuna scheda risponde, NON inventare una regola e NON dire cifre o percentuali come se fossero decise. Pero' aiuta davvero: ragiona sul caso con chi ti scrive, fai una domanda di chiarimento se serve, proponi come lo gestiresti e quali sono i rischi, e di' chiaramente che su questo punto non c'e' una decisione scritta e che prima di agire va sentito chi amministra. Un collega esperto che pensa insieme a te, non un centralino che dice «non e' previsto».

Puoi anche conversare: rispondere a un «grazie», chiedere cosa intendeva, riprendere la domanda precedente. Resta sui temi del lavoro in accademia; se la domanda non c'entra con l'accademia, dillo con garbo e riporta il discorso li'.

${ruolo === "amministrazione" ? `3. DISPOSIZIONI DA SCRIVERE. Chi ti parla e' chi decide le regole. Se nel messaggio da' una disposizione — «da oggi…», «la regola e'…», «voglio che…», «lo sconto in aula e'…» — oltre a rispondere PROPONI la scheda da salvare in "proposta_regola": titolo breve, argomento (Prezzi, Sconti, Modelle, Kit, Spedizioni, Pagamenti, Iscrizioni, Procedure…), testo scritto come una regola che altri applicheranno alla lettera (completo, con cifre e condizioni dette; niente che non sia stato detto), e vale_per fra "tutti","venditori","master","assistenti","amministrazione". Se una scheda esistente dice il contrario, dillo e metti in "sostituisce" il suo numero. Nella risposta chiedi conferma in una riga («La salvo cosi'?»). Se la disposizione e' incompleta (manca una cifra, non si capisce a chi vale) chiedi quello che manca invece di proporre. Non proporre niente per semplici domande.

` : ""}Rispondi SOLO con un JSON: {"risposta": "...", "schede": [numeri delle schede usate], "senza_risposta": true|false, "registro": "regole"|"ragionamento"|"misto"|"conversazione"${ruolo === "amministrazione" ? `, "proposta_regola": null | {"titolo": "...", "argomento": "...", "testo": "...", "vale_per": ["..."], "sostituisce": null | numero}` : ""}}.
- senza_risposta = true quando la domanda chiedeva una regola e nessuna scheda la copre (anche se hai ragionato): e' cosi' che chi scrive le regole scopre cosa manca.
- registro = "conversazione" per saluti, chiarimenti e domande che non chiedono una regola: li' senza_risposta = false.
Nel testo usa al massimo elenchi con «- » e grassetto con **. In italiano, tono diretto e cordiale.

${schede.length === 0 ? "SCHEDE: nessuna ancora scritta. Ogni domanda di regola va in registro «ragionamento»." : `SCHEDE (${schede.length}):\n${schede.map((s, i) => `[${i + 1}] ${s.titolo}${s.argomento ? ` — ${s.argomento}` : ""}${s.decisa_il ? ` (decisa il ${s.decisa_il})` : ""}\n${s.testo}`).join("\n\n")}`}`;

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
  const cronologia = Array.isArray(corpo.cronologia) ? corpo.cronologia.slice(-6) : [];

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

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Assistente non disponibile: manca la chiave." }, 503);

  // la conversazione precedente come veri turni, cosi' «e se invece
  // paga in contanti?» si attacca alla domanda di prima
  const messaggi: { role: string; content: string }[] = [];
  for (const c of cronologia) {
    if (c?.domanda && c?.risposta) {
      messaggi.push({ role: "user", content: String(c.domanda).slice(0, 600) }, { role: "assistant", content: String(c.risposta).slice(0, 1200) });
    }
  }
  messaggi.push({ role: "user", content: domanda });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELLO, max_tokens: 1200, system: SISTEMA(schede, ruolo), messages: messaggi }),
  });
  if (!r.ok) return json({ ok: false, errore: `Il modello ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
  const esito = await r.json();
  const testo = (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  const piano = estraiJson(testo);
  if (!piano || typeof piano.risposta !== "string") return json({ ok: false, errore: "Non ho capito la risposta del modello." }, 502);

  const numeri: number[] = Array.isArray(piano.schede) ? piano.schede.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= schede.length) : [];
  const citati = [...new Set(numeri)].map((n) => schede[n - 1]);
  const registro = ["regole", "ragionamento", "misto", "conversazione"].includes(piano.registro) ? piano.registro : (citati.length ? "regole" : "ragionamento");
  // «senza risposta» lo decide il modello, ma una risposta che cita una
  // scheda non puo' esserlo, e una chiacchiera non e' una regola mancante
  const senza = registro === "conversazione" ? false : (!!piano.senza_risposta && citati.length === 0) || (registro === "ragionamento");
  // la scheda proposta, solo a chi amministra e solo se ha tutto
  const VALE = ["tutti", "venditori", "master", "assistenti", "amministrazione"];
  let proposta: Record<string, unknown> | null = null;
  const pr = piano.proposta_regola;
  if (ruolo === "amministrazione" && pr && typeof pr === "object" && typeof pr.titolo === "string" && typeof pr.testo === "string" && pr.titolo.trim().length >= 3 && pr.testo.trim().length >= 10) {
    const vale = Array.isArray(pr.vale_per) ? pr.vale_per.map(String).filter((v: string) => VALE.includes(v)) : [];
    const nSost = Number(pr.sostituisce);
    const sostituisce = nSost >= 1 && nSost <= schede.length ? schede[nSost - 1] : null;
    proposta = { titolo: pr.titolo.trim().slice(0, 120), argomento: String(pr.argomento || "").trim().slice(0, 60) || null, testo: pr.testo.trim().slice(0, 4000), vale_per: vale.length ? vale : ["tutti"], sostituisce: sostituisce ? { id: sostituisce.id, titolo: sostituisce.titolo } : null };
  }
  // una disposizione che diventa scheda non e' una domanda rimasta senza risposta
  const senzaDefinitivo = proposta ? false : senza;
  await registra(piano.risposta, citati.map((s) => s.id), senzaDefinitivo, esito?.usage || null);
  return json({ ok: true, risposta: piano.risposta, citati: citati.map((s) => ({ id: s.id, titolo: s.titolo })), senza_risposta: senzaDefinitivo, registro, proposta_regola: proposta });
});
