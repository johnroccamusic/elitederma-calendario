// Edge Function "assistente-regole" — L'ASSISTENTE DELL'APP.
//
// 25/10/2026, come e' nato: chi lavora nell'app (venditori, master,
// assistenti) fa una domanda dall'icona flottante — «quanto sconto posso
// fare in aula?», «l'allieva vuole le modelle dopo la firma, cosa
// faccio?» — e il modello risponde con quello che sta scritto nelle
// schede di `regolamenti` visibili a quel ruolo, citandole. Se nessuna
// scheda risponde lo dice, e la domanda resta registrata come «senza
// risposta»: e' da li' che il titolare capisce quali regole mancano.
//
// 3/11/2026, cosa e' cambiato, chiesto dal titolare: «oltre a rispondere
// sui regolamenti, deve rispondere anche sulle funzionalita' e sui dati
// dell'app, pero' solo limitatamente alle funzioni che ciascun utente
// vede». Quindi adesso i registri sono quattro:
//
//   REGOLE        le schede di `regolamenti` (come prima)
//   L'APP         come funziona, area per area (_shared/guida-app.js)
//   I DATI        il modello scrive UNA select sulle viste analisi_*,
//                 Postgres la esegue, lui scrive la risposta dai numeri
//                 tornati (_shared/analisi.js, lo stesso motore di
//                 «Chiedi ai dati»)
//   RAGIONAMENTO  quando non c'e' niente di scritto: ragiona sul caso e
//                 dice che e' un ragionamento, non una regola
//
// IL LIMITE PER PERSONA. La pagina manda i permessi di chi ha fatto
// accesso (le caselle delle aree della Home); da quelli si ricavano le
// aree della guida e l'elenco delle viste ammesse, e quell'elenco va a
// `analisi_esegui`, che rifiuta qualunque altra vista anche se il modello
// la nominasse. Due difese per la stessa regola, e quella che conta e' la
// seconda: una regola che vive solo nel prompt non e' una regola.
//
// Va detto con precisione cos'e' questo limite: decide COSA
// L'ASSISTENTE MOSTRA, non cosa la sessione potrebbe leggere. Finche'
// l'account Supabase e' uno per tutti i permessi li sa solo la pagina, e
// dal browser le tabelle si leggono comunque (vedi «UN SOLO ACCOUNT
// SUPABASE PER TUTTI» nel § 4 di CLAUDE.md). Diventa una serratura il
// giorno che il ruolo passa dal JWT. Quello che invece e' una serratura
// gia' oggi e' il motore: qualunque cosa chieda il modello, al database
// arriva una sola SELECT su viste di sola lettura.
//
// Nessuna vista porta dati personali di allievi o clienti: niente nomi,
// email, telefoni, residenze. Domanda e risposta passano da un modello di
// terze parti, e mandargli l'anagrafica di un'allieva e' una decisione
// del titolare, non di chi scrive il codice.
//
// Serve una sessione vera (getUser): `verify_jwt` accetta anche il JWT
// anon del bundle, e non basta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { catalogoPer, controllaSql, vistePermesse } from "../_shared/analisi.js";
import { guidaPer } from "../_shared/guida-app.js";
import { REGISTRI, registroDa, senzaRisposta } from "../_shared/assistente.js";

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

function oggiRoma(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

const SISTEMA = (schede: Scheda[], ruolo: string, guida: string, catalogo: string, oggi: string) => `Sei l'assistente interno di Elitederma, un'accademia di formazione estetica (trucco permanente, microblading, microneedling, laminazione ciglia, tricopigmentazione, dermopigmentazione dell'areola) che vende corsi a calendario in varie citta' italiane e prodotti professionali: al banco durante i corsi, in fiera e sullo shop online. Oggi e' ${oggi}. Chi ti scrive e' ${ruolo === "tutti" ? "una persona dello staff" : ruolo === "amministrazione" ? "chi amministra" : "un/una " + ruolo.replace(/i$/, "e")} e ti parla da dentro il gestionale, mentre lavora.

HAI QUATTRO REGISTRI, E DICI SEMPRE QUALE STAI USANDO.

1. DALLE REGOLE (registro "regole"). Se una o piu' schede qui sotto rispondono, la risposta e' quella: precisa, breve, con i numeri delle schede usate. Non aggiungere condizioni, cifre o eccezioni che le schede non dicono. Se una scheda copre solo una parte, di' quale parte resta scoperta.

2. COME FUNZIONA L'APP (registro "guida"). Per «dove si fa…», «come faccio a…», «a cosa serve questa pagina», «non trovo…»: rispondi con la guida delle aree qui sotto, dicendo il percorso (da quale tessera si entra, quale tasto si preme). La guida dice dove si fa una cosa, non quanto costa: non contiene cifre, e tu non ne inventi.

3. DAI DATI (registro "dati"). Per le domande sui fatti dell'accademia — «che corso c'e' a novembre a Bari», «chi tiene il PMU di Milano», «quanti posti restano», «quanto costa il kit di laminazione», «cosa c'e' dentro il kit», «quel prodotto c'e' in magazzino» — NON rispondi a memoria: chiedi al database. In quel caso rispondi SOLO con {"sql": "...", "nota": "una riga che dice cosa hai contato e con quali filtri"}; i numeri te li rimando io e poi scrivi la risposta.
Regole per la query: una sola SELECT Postgres di sola lettura, solo sulle viste del catalogo qui sotto, senza punto e virgola; al massimo 50 righe salvo richiesta diversa; importi arrotondati a 2 decimali con round(); nomi di corsi, citta', prodotti e persone confrontati con ilike (in archivio sono spesso in MAIUSCOLO); «a novembre» senza anno vuol dire novembre dell'anno in corso; «che corso c'e'» al futuro esclude quelli conclusi.
${catalogo ? catalogo : "NESSUNA AREA DI DATI: questa persona non ha permessi che aprano dati. Alle domande sui fatti rispondi che non puoi vederli e che li chieda a chi amministra."}

4. UN RAGIONAMENTO (registro "ragionamento"). Se nessuna scheda, nessuna area della guida e nessun dato rispondono, NON inventare una regola e NON dire cifre o percentuali come se fossero decise. Pero' aiuta davvero: ragiona sul caso con chi ti scrive, fai una domanda di chiarimento se serve, proponi come lo gestiresti e quali sono i rischi, e di' chiaramente che su questo punto non c'e' una decisione scritta e che prima di agire va sentito chi amministra. Un collega esperto che pensa insieme a te, non un centralino che dice «non e' previsto».

QUELLO CHE NON PUOI VEDERE, e come si dice. Il catalogo e la guida qui sotto contengono SOLO le aree che spettano a questa persona: se la domanda riguarda un'area che non c'e', dillo in una riga — «quella parte non e' fra le aree che vedi, chiedila a chi amministra» — senza elencare quello che non ha. E NESSUN dato personale di allievi, clienti o modelle esiste in questi dati: niente nomi, email, telefoni, indirizzi. Se chiedono «chi e' iscritta al corso di…», la risposta e' quante sono e dove si leggono i nomi (la scheda della classe, in app), non un elenco di persone.

Puoi anche conversare (registro "conversazione"): rispondere a un «grazie», chiedere cosa intendeva, riprendere la domanda precedente. Resta sui temi del lavoro in accademia; se la domanda non c'entra, dillo con garbo e riporta il discorso li'.

${ruolo === "amministrazione" ? `5. DISPOSIZIONI DA SCRIVERE. Chi ti parla e' chi decide le regole. Se nel messaggio da' una disposizione — «da oggi…», «la regola e'…», «voglio che…», «lo sconto in aula e'…» — oltre a rispondere PROPONI la scheda da salvare in "proposta_regola": titolo breve, argomento (Prezzi, Sconti, Modelle, Kit, Spedizioni, Pagamenti, Iscrizioni, Procedure…), testo scritto come una regola che altri applicheranno alla lettera (completo, con cifre e condizioni dette; niente che non sia stato detto), e vale_per fra "tutti","venditori","master","assistenti","amministrazione". Se una scheda esistente dice il contrario, dillo e metti in "sostituisce" il suo numero. Nella risposta chiedi conferma in una riga («La salvo cosi'?»). Se la disposizione e' incompleta (manca una cifra, non si capisce a chi vale) chiedi quello che manca invece di proporre. Non proporre niente per semplici domande.

` : ""}RISPONDI SEMPRE CON UN SOLO JSON, una di queste due forme:
- per chiedere i dati: {"sql": "...", "nota": "..."}
- altrimenti: {"risposta": "...", "schede": [numeri delle schede usate], "senza_risposta": true|false, "registro": ${REGISTRI.map((r) => `"${r}"`).join("|")}${ruolo === "amministrazione" ? `, "proposta_regola": null | {"titolo": "...", "argomento": "...", "testo": "...", "vale_per": ["..."], "sostituisce": null | numero}` : ""}}
- senza_risposta = true SOLO quando la domanda chiedeva una REGOLA e nessuna scheda la copre (anche se hai ragionato): e' cosi' che chi scrive le regole scopre cosa manca. Una domanda sui dati o sull'app non e' una regola che manca: li' senza_risposta = false.
Nel testo usa al massimo elenchi con «- » e grassetto con **. In italiano, tono diretto e cordiale, e corto: spesso questa risposta viene letta ad alta voce.

${guida}

${schede.length === 0 ? "SCHEDE DI REGOLAMENTO: nessuna ancora scritta. Ogni domanda di regola va in registro «ragionamento»." : `SCHEDE DI REGOLAMENTO (${schede.length}):\n${schede.map((s, i) => `[${i + 1}] ${s.titolo}${s.argomento ? ` — ${s.argomento}` : ""}${s.decisa_il ? ` (decisa il ${s.decisa_il})` : ""}\n${s.testo}`).join("\n\n")}`}`;

// il secondo passo delle domande sui dati: la risposta nasce dalle righe
// che il database ha restituito, non da quello che il modello ricorda
const SISTEMA_DAI_NUMERI = (oggi: string, ruolo: string) => `Sei l'assistente interno di Elitederma e stai rispondendo a ${ruolo === "amministrazione" ? "chi amministra" : "una persona dello staff"} che lavora nel gestionale. Oggi e' ${oggi}. Ti vengono dati: la domanda, la query che e' stata eseguita e le righe che il database ha restituito.
Scrivi la risposta in italiano, breve e diretta, come un collega che ha i dati davanti: prima il fatto che risponde alla domanda, poi se serve un elenco con «- » (importi in formato italiano, 1.234,56 €; date come 8 novembre).
Regole ferree: usa SOLO quello che sta nelle righe; non inventare cifre, nomi, date o cause; se le righe sono vuote dillo chiaramente («non c'e' nessun corso a Bari a novembre») invece di girarci intorno; se un dato manca su alcune righe (per esempio un costo non scritto) dillo in una riga, perche' un dato mancante contato come zero fa sembrare le cose diverse da come sono.
Non citare la query e non parlare di viste o colonne: chi legge vuole la risposta. Niente markdown complesso: solo testo, «- » e **grassetto**. Spesso questa risposta viene letta ad alta voce: corta.`;

function estraiJson(testo: string) {
  const a = testo.indexOf("{"); const b = testo.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(testo.slice(a, b + 1)); } catch { return null; }
}

async function chiediAlModello(chiave: string, system: string, messaggi: unknown[], maxTokens = 1200): Promise<{ testo: string; uso: unknown }> {
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
  // i permessi della Home di chi ha fatto accesso: decidono quali aree
  // della guida e quali viste di dati entrano nella risposta
  const permessi = Array.isArray(corpo.permessi) ? corpo.permessi.map(String).slice(0, 60) : [];

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

  const viste = vistePermesse({ ruolo, permessi });
  const catalogo = catalogoPer(viste);
  const guida = guidaPer({ ruolo, permessi });

  const registra = async (campi: Record<string, unknown>) => {
    try {
      await admin.from("regolamenti_domande").insert({ chi, ruolo, domanda, modello: MODELLO, aree: viste, ...campi });
    } catch { /* il registro non ferma la risposta */ }
  };

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Assistente non disponibile: manca la chiave." }, 503);
  const oggi = oggiRoma();

  // la conversazione precedente come veri turni, cosi' «e se invece
  // paga in contanti?» si attacca alla domanda di prima
  const messaggi: { role: string; content: string }[] = [];
  for (const c of cronologia) {
    if (c?.domanda && c?.risposta) {
      messaggi.push({ role: "user", content: String(c.domanda).slice(0, 600) }, { role: "assistant", content: String(c.risposta).slice(0, 1200) });
    }
  }
  messaggi.push({ role: "user", content: domanda });

  const system = SISTEMA(schede, ruolo, guida, catalogo, oggi);

  // PRIMO PASSO. Il modello risponde, oppure chiede i dati con una
  // SELECT. Se la query non e' accettabile (o Postgres la rifiuta)
  // l'errore gli torna indietro scritto in italiano e riprova: davanti a
  // una vista che non gli spetta puo' ripiegare su un'area che ha, invece
  // di rispondere a mani vuote.
  let piano: any = null; let uso: unknown = null; let usoSql: unknown = null;
  let sql: string | null = null; let nota = ""; let righe: unknown[] = [];
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    let testo: string;
    try {
      const r = await chiediAlModello(chiave, system, messaggi, 1200);
      testo = r.testo; uso = r.uso;
    } catch (e) { return json({ ok: false, errore: String((e as any)?.message || e) }, 502); }
    const p = estraiJson(testo);
    if (!p) {
      if (tentativo >= 1) return json({ ok: false, errore: "Non ho capito la risposta del modello." }, 502);
      messaggi.push({ role: "assistant", content: testo }, { role: "user", content: "Rispondi solo con il JSON previsto." });
      continue;
    }
    if (!p.sql) { piano = p; break; }
    // una domanda sui dati
    const c = controllaSql(String(p.sql), viste);
    if (!c.ok) {
      messaggi.push({ role: "assistant", content: testo }, { role: "user", content: `La query non e' accettabile: ${c.errore} Correggila, oppure rispondi senza i dati spiegando cosa non puoi vedere.` });
      continue;
    }
    const sqlBuona = String(c.sql || "");
    const { data, error } = await admin.rpc("analisi_esegui", { p_sql: sqlBuona, p_viste: viste });
    if (error) {
      messaggi.push({ role: "assistant", content: testo }, { role: "user", content: `Postgres ha risposto: ${error.message}. Correggi la query, oppure rispondi senza i dati.` });
      continue;
    }
    sql = sqlBuona; nota = String(p.nota || ""); righe = Array.isArray(data) ? data : []; usoSql = uso;
    break;
  }

  // SECONDO PASSO, solo per le domande sui dati: la risposta dalle righe.
  if (sql) {
    let risposta = ""; let usoRisposta: unknown = null;
    try {
      const r = await chiediAlModello(chiave, SISTEMA_DAI_NUMERI(oggi, ruolo), [{
        role: "user",
        content: `Domanda: ${domanda}\n\nQuery eseguita:\n${sql}\n\nCosa conta la query: ${nota}\n\nRighe restituite (${righe.length}):\n${JSON.stringify(righe.slice(0, 120))}`,
      }], 1000);
      risposta = r.testo; usoRisposta = r.uso;
    } catch (e) { return json({ ok: false, errore: String((e as any)?.message || e) }, 502); }
    await registra({ risposta, citati: [], senza_risposta: false, registro: "dati", sql, righe: righe.length, uso: { sql: usoSql, risposta: usoRisposta } });
    return json({
      ok: true, risposta, citati: [], senza_risposta: false, registro: "dati",
      sql, nota, righe: righe.slice(0, 50), totale_righe: righe.length, proposta_regola: null,
    });
  }

  if (!piano || typeof piano.risposta !== "string") return json({ ok: false, errore: "Non ho capito la risposta del modello." }, 502);

  const numeri: number[] = Array.isArray(piano.schede) ? piano.schede.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= schede.length) : [];
  const citati = [...new Set(numeri)].map((n) => schede[n - 1]);
  const registro = registroDa(piano.registro, citati.length);
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
  // «senza risposta» lo decide il modello, ma la regola di cosa conta
  // davvero come regola mancante sta in _shared/assistente.js, provata
  // nel banco: e' quella che riempie l'elenco in fondo a Regolamenti
  const senzaDefinitivo = senzaRisposta({ registro, dichiarato: piano.senza_risposta, quanteSchedeCitate: citati.length, proposta });
  await registra({ risposta: piano.risposta, citati: citati.map((s) => s.id), senza_risposta: senzaDefinitivo, registro, uso });
  return json({ ok: true, risposta: piano.risposta, citati: citati.map((s) => ({ id: s.id, titolo: s.titolo })), senza_risposta: senzaDefinitivo, registro, proposta_regola: proposta });
});
