// Edge Function "assistente-regole" — L'ASSISTENTE DELL'APP.
//
// 25/10/2026, come e' nato: una domanda dall'icona flottante — «quanto
// sconto posso fare in aula?» — e il modello risponde con quello che sta
// scritto nelle schede di `regolamenti` visibili a quel ruolo, citandole.
// Se nessuna scheda risponde lo dice, e la domanda resta registrata come
// «senza risposta»: e' da li' che il titolare capisce quali regole mancano.
//
// 3/11/2026 mattina: risponde anche su come funziona l'app e sui dati,
// «solo limitatamente alle funzioni che ciascun utente vede».
//
// 3/11/2026 pomeriggio — PERCHE' E' DIVENTATO UN AGENTE. Il titolare,
// provandolo: «perche' non ragiona come un modello Claude un po' sveglio
// e deduttivo?». Aveva ragione, e la colpa non era del modello: era
// dell'impianto. Prima il giro era «una domanda → UNA query → la
// risposta», e soprattutto UN RISULTATO VUOTO NON E' UN ERRORE: se la
// query falliva l'errore gli tornava indietro e riprovava, ma se tornava
// vuota doveva rispondere da quel vuoto. Nessuna seconda mossa, nessun
// «strano, fammi guardare quali kit esistono». Un collega sveglio fa
// cinque passi: guarda cosa c'e', nota che il risultato e' assurdo,
// cambia angolo, poi conclude.
//
// Succedeva davvero: il 3/11 alle 9:41 il modello aveva scritto DA SOLO
// la query giusta sul costo dei kit, il database gli ha risposto zero
// righe (una vista perdeva il collegamento al corso su 957 righe su
// 1565), e lui ha detto l'unica cosa che poteva: «per PMU Base non ho
// trovato nessun kit». La vista e' stata corretta; questo file e' la
// correzione dell'altra meta' del guasto.
//
// Adesso il modello ha uno STRUMENTO (`interroga_dati`) e lo puo' usare
// piu' volte: vede le righe e decide se bastano. Tre cose sono imposte
// dal codice, non chieste per favore nel prompt:
//   - zero righe tornano con l'avviso «non concludere, guarda prima cosa
//     esiste»: e' il passo che prima non poteva fare;
//   - l'errore torna scritto in italiano, cosi' puo' correggere la query;
//   - oltre cinque interrogazioni si chiude e si risponde con quello che
//     si ha, perche' un assistente che pensa per un minuto non serve.
// Piu' il ragionamento esteso, e la cache del prompt (guida, catalogo e
// schede sono identici a ogni domanda: ripagarli ogni volta era tempo e
// soldi buttati).
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
// SUPABASE PER TUTTI» nel § 4 di CLAUDE.md). Quello che invece e' una
// serratura gia' oggi e' il motore: qualunque cosa chieda il modello, al
// database arriva una sola SELECT su viste di sola lettura.
//
// Nessuna vista porta dati personali di allievi o clienti: niente nomi,
// email, telefoni, residenze. Domanda e risposta passano da un modello di
// terze parti, e mandargli l'anagrafica di un'allieva e' una decisione
// del titolare, non di chi scrive il codice.
//
// Serve una sessione vera (getUser): `verify_jwt` accetta anche il JWT
// anon del bundle, e non basta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { catalogoPer, controllaSql, leggiCopertura, vistePermesse } from "../_shared/analisi.js";
import { guidaPer } from "../_shared/guida-app.js";
import { esitoInterrogazione, registroFinale, senzaRisposta } from "../_shared/assistente.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODELLO = "claude-sonnet-5-5";
// Quanto puo' pensare prima di parlare. Il ragionamento esteso e' quello
// che gli fa notare che un risultato non torna; tenuto corto perche' la
// risposta spesso viene letta ad alta voce e si aspetta in piedi.
const PENSIERO = 1600;
const TETTO_RISPOSTA = 3200;
// Cinque interrogazioni bastano a guardare cosa esiste, correggere il
// filtro e rispondere. Oltre, si risponde con quello che si ha.
const MAX_INTERROGAZIONI = 5;
const MAX_GIRI = 7;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RUOLI = ["tutti", "venditori", "master", "assistenti", "amministrazione"];

type Scheda = { id: string; titolo: string; argomento: string | null; testo: string; decisa_il: string | null; visibile_a: string[] };
type Passo = { sql: string; righe: number; perche: string };

function oggiRoma(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

const STRUMENTO_DATI = {
  name: "interroga_dati",
  description: "Interroga i dati dell'accademia con UNA select di sola lettura sulle viste del catalogo. Si puo' chiamare piu' volte: prima per guardare cosa esiste, poi per la risposta. Torna le righe in JSON.",
  input_schema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "Una sola SELECT Postgres (o WITH ... SELECT), senza punto e virgola, sulle sole viste del catalogo." },
      perche: { type: "string", description: "Una riga: cosa stai cercando con questa query." },
    },
    required: ["sql"],
  },
};

const SISTEMA = (schede: Scheda[], ruolo: string, guida: string, catalogo: string, oggi: string) => `Sei l'assistente interno di Elitederma, un'accademia di formazione estetica (trucco permanente, microblading, microneedling, laminazione ciglia, tricopigmentazione, dermopigmentazione dell'areola) che vende corsi a calendario in varie citta' italiane e prodotti professionali: al banco durante i corsi, in fiera e sullo shop online. Oggi e' ${oggi}. Chi ti scrive e' ${ruolo === "tutti" ? "una persona dello staff" : ruolo === "amministrazione" ? "chi amministra" : "un/una " + ruolo.replace(/i$/, "e")} e ti parla da dentro il gestionale, mentre lavora. Sei un collega esperto che ha i dati davanti, non un centralino.

HAI QUATTRO REGISTRI, E DICI SEMPRE QUALE STAI USANDO.

1. DALLE REGOLE (registro "regole"). Se una o piu' schede qui sotto rispondono, la risposta e' quella: precisa, breve, con i numeri delle schede usate. Non aggiungere condizioni, cifre o eccezioni che le schede non dicono. Se una scheda copre solo una parte, di' quale parte resta scoperta.

2. COME FUNZIONA L'APP (registro "guida"). Per «dove si fa…», «come faccio a…», «a cosa serve questa pagina», «non trovo…»: rispondi con la guida delle aree qui sotto, dicendo il percorso (da quale tessera si entra, quale tasto si preme). La guida dice dove si fa una cosa, non quanto costa: non contiene cifre, e tu non ne inventi.

3. DAI DATI (registro "dati"). Per le domande sui fatti dell'accademia — «che corso c'e' a novembre a Bari», «chi tiene il PMU di Milano», «quanti posti restano», «quanto costa il kit X», «cosa c'e' dentro il kit», «quel prodotto c'e' in magazzino» — NON rispondere a memoria: usa lo strumento interroga_dati.

COME SI INDAGA, ed e' la parte che conta:
- Puoi chiamare interroga_dati PIU' VOLTE (fino a ${MAX_INTERROGAZIONI}). Usale: e' meglio un giro in piu' che una risposta sbagliata.
- **ZERO RIGHE NON E' UNA RISPOSTA.** Se una query torna vuota, NON concludere «non c'e' niente»: quasi sempre il filtro era troppo stretto o il nome e' scritto in un altro modo. Guarda prima cosa esiste (per esempio: select distinct corso from ... limit 50, oppure cerca con ilike su un pezzo di parola) e riprova. Dire «non esiste» quando invece esisteva e' il peggiore degli errori che puoi fare qui, perche' chi legge ci crede e prende una decisione.
- **I nomi li scrive chi vende, non chi programma.** Corsi, kit, prodotti e citta' sono scritti come vengono («KIT ELITE Completo», «PMU BASE», «ROMA»): cerca con ilike e con pezzi di parola, mai con l'uguale. Se un nome non torna, cerca il simile.
- **Deduci invece di chiedere.** Se una lettura della domanda e' chiaramente la piu' probabile, rispondi su quella e aggiungi una riga sola («se intendevi l'altra cosa, dimmelo»). Esempio: «quanto costa il kit di PMU base, quello completo Elite» vuol dire il kit che si chiama KIT ELITE Completo del corso PMU BASE — si va a cercarlo, non si chiede quale kit intende. Chiedi un chiarimento solo se davvero senza quello non puoi muoverti.
- **Prima di dire che non puoi, prova.** Il dato che serve puo' stare in un'altra area fra quelle che hai: guarda il catalogo prima di arrenderti.
- Se chiede il DETTAGLIO, elenca riga per riga e non riassumere; se chiede un totale, dai il totale.
- Dopo l'ultima interrogazione scrivi la risposta usando SOLO le righe che hai letto: non inventare cifre, nomi o date. Se un dato manca su alcune righe (un costo non scritto, per esempio) dillo in una riga.

Regole per la query: una sola SELECT di sola lettura, solo sulle viste del catalogo, senza punto e virgola; al massimo 50 righe salvo richiesta diversa; importi arrotondati a 2 decimali con round(); «a novembre» senza anno vuol dire novembre dell'anno in corso; «che corso c'e'» al futuro esclude quelli conclusi.
${catalogo ? catalogo : "NESSUNA AREA DI DATI: questa persona non ha permessi che aprano dati, e lo strumento non c'e'. Alle domande sui fatti rispondi che non puoi vederli e che li chieda a chi amministra."}

4. UN RAGIONAMENTO (registro "ragionamento"). Se nessuna scheda, nessuna area della guida e nessun dato rispondono, NON inventare una regola e NON dire cifre o percentuali come se fossero decise. Pero' aiuta davvero: ragiona sul caso con chi ti scrive, fai una domanda di chiarimento se serve, proponi come lo gestiresti e quali sono i rischi, e di' chiaramente che su questo punto non c'e' una decisione scritta e che prima di agire va sentito chi amministra.

QUELLO CHE NON PUOI VEDERE, e come si dice. Il catalogo e la guida qui sotto contengono SOLO le aree che spettano a questa persona: se la domanda riguarda un'area che non c'e', dillo in una riga — «quella parte non e' fra le aree che vedi, chiedila a chi amministra» — senza elencare quello che non ha. E NESSUN dato personale di allievi, clienti o modelle esiste in questi dati: niente nomi, email, telefoni, indirizzi. Se chiedono «chi e' iscritta al corso di…», la risposta e' quante sono e dove si leggono i nomi (la scheda della classe, in app), non un elenco di persone.

Puoi anche conversare (registro "conversazione"): rispondere a un «grazie», chiedere cosa intendeva, riprendere la domanda precedente. Resta sui temi del lavoro in accademia; se la domanda non c'entra, dillo con garbo e riporta il discorso li'.

${ruolo === "amministrazione" ? `DISPOSIZIONI DA SCRIVERE. Chi ti parla e' chi decide le regole. Se nel messaggio da' una disposizione — «da oggi…», «la regola e'…», «voglio che…» — oltre a rispondere PROPONI la scheda da salvare in "proposta_regola": titolo breve, argomento (Prezzi, Sconti, Modelle, Kit, Spedizioni, Pagamenti, Iscrizioni, Procedure…), testo scritto come una regola che altri applicheranno alla lettera (completo, con cifre e condizioni dette; niente che non sia stato detto), e vale_per fra "tutti","venditori","master","assistenti","amministrazione". Se una scheda esistente dice il contrario, dillo e metti in "sostituisce" il suo numero. Nella risposta chiedi conferma in una riga («La salvo cosi'?»). Se la disposizione e' incompleta chiedi quello che manca invece di proporre. Non proporre niente per semplici domande.

` : ""}LA RISPOSTA FINALE, quando hai finito di indagare, e' UN SOLO JSON e nient'altro:
{"risposta": "...", "schede": [numeri delle schede usate], "senza_risposta": true|false, "registro": "regole"|"ragionamento"|"misto"|"conversazione"|"dati"|"guida"${ruolo === "amministrazione" ? `, "proposta_regola": null | {"titolo": "...", "argomento": "...", "testo": "...", "vale_per": ["..."], "sostituisce": null | numero}` : ""}}
- senza_risposta = true SOLO quando la domanda chiedeva una REGOLA e nessuna scheda la copre: e' cosi' che chi scrive le regole scopre cosa manca. Una domanda sui dati o sull'app non e' una regola che manca.
- "risposta" e' quello che la persona legge o sente: in italiano, diretto, corto. Importi in formato italiano (1.234,56 €), date come «8 novembre». Al massimo elenchi con «- » e grassetto con **. Niente nomi di viste, di colonne o di query: chi legge vuole la risposta.

${guida}

${schede.length === 0 ? "SCHEDE DI REGOLAMENTO: nessuna ancora scritta. Ogni domanda di regola va in registro «ragionamento»." : `SCHEDE DI REGOLAMENTO (${schede.length}):\n${schede.map((s, i) => `[${i + 1}] ${s.titolo}${s.argomento ? ` — ${s.argomento}` : ""}${s.decisa_il ? ` (decisa il ${s.decisa_il})` : ""}\n${s.testo}`).join("\n\n")}`}`;

function estraiJson(testo: string) {
  const a = testo.indexOf("{"); const b = testo.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(testo.slice(a, b + 1)); } catch { return null; }
}

// La chiamata al modello. Il blocco di sistema porta `cache_control`:
// guida, catalogo e schede sono identici fra una domanda e l'altra, e
// ripagarli ogni volta era tempo di attesa e soldi.
async function chiediAlModello(chiave: string, system: string, messaggi: unknown[], strumenti: unknown[]) {
  const corpo: Record<string, unknown> = {
    model: MODELLO,
    max_tokens: TETTO_RISPOSTA,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "enabled", budget_tokens: PENSIERO },
    messages: messaggi,
  };
  if (strumenti.length) corpo.tools = strumenti;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`Il modello ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

const testoDi = (esito: any) =>
  (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();

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

  const { data: tutte, error: errSchede } = await admin.from("regolamenti")
    .select("id, titolo, argomento, testo, decisa_il, visibile_a")
    .eq("attivo", true).order("ordine").order("titolo");
  if (errSchede) return json({ ok: false, errore: errSchede.message }, 500);
  const schede: Scheda[] = (tutte || []).filter((s: Scheda) =>
    ruolo === "amministrazione" || (s.visibile_a || []).includes("tutti") || (s.visibile_a || []).includes(ruolo));

  const viste = vistePermesse({ ruolo, permessi });
  // le date di copertura entrano nel catalogo a OGNI domanda, misurate dal
  // dato: senza, una risposta su un periodo che i dati non hanno sembra
  // completa e non lo e' (vedi bloccoCopertura in _shared/analisi.js)
  const catalogo = catalogoPer(viste, await leggiCopertura(admin));
  const guida = guidaPer({ ruolo, permessi });

  const registra = async (campi: Record<string, unknown>) => {
    try {
      await admin.from("regolamenti_domande").insert({ chi, ruolo, domanda, modello: MODELLO, aree: viste, ...campi });
    } catch { /* il registro non ferma la risposta */ }
  };

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Assistente non disponibile: manca la chiave." }, 503);
  const oggi = oggiRoma();
  const system = SISTEMA(schede, ruolo, guida, catalogo, oggi);
  const strumenti = viste.length ? [STRUMENTO_DATI] : [];

  // la conversazione precedente come veri turni, cosi' «e se invece
  // paga in contanti?» si attacca alla domanda di prima
  const messaggi: any[] = [];
  for (const c of cronologia) {
    if (c?.domanda && c?.risposta) {
      messaggi.push({ role: "user", content: String(c.domanda).slice(0, 600) }, { role: "assistant", content: String(c.risposta).slice(0, 1200) });
    }
  }
  messaggi.push({ role: "user", content: domanda });

  // IL GIRO. Il modello indaga, vede le righe, decide. Si esce quando
  // smette di chiedere dati (o quando ha chiesto abbastanza).
  const passi: Passo[] = [];
  let ultimeRighe: unknown[] = [];
  let piano: any = null;
  let usoTotale = { input: 0, output: 0, cache_letta: 0, cache_scritta: 0 };
  let testoFinale = "";

  for (let giro = 0; giro < MAX_GIRI; giro++) {
    let esito: any;
    try {
      esito = await chiediAlModello(chiave, system, messaggi, passi.length >= MAX_INTERROGAZIONI ? [] : strumenti);
    } catch (e) { return json({ ok: false, errore: String((e as any)?.message || e) }, 502); }
    const u = esito?.usage || {};
    usoTotale = {
      input: usoTotale.input + (u.input_tokens || 0),
      output: usoTotale.output + (u.output_tokens || 0),
      cache_letta: usoTotale.cache_letta + (u.cache_read_input_tokens || 0),
      cache_scritta: usoTotale.cache_scritta + (u.cache_creation_input_tokens || 0),
    };

    const chiamate = (esito?.content || []).filter((b: any) => b.type === "tool_use");
    if (!chiamate.length) { testoFinale = testoDi(esito); piano = estraiJson(testoFinale); break; }

    // con il ragionamento esteso va rimandato indietro TUTTO il contenuto
    // (i blocchi di pensiero compresi), o il modello perde il filo
    messaggi.push({ role: "assistant", content: esito.content });
    const risultati: any[] = [];
    for (const c of chiamate) {
      const sqlChiesto = String(c?.input?.sql || "");
      const perche = String(c?.input?.perche || "").slice(0, 200);
      const controllo = controllaSql(sqlChiesto, viste);
      if (!controllo.ok) {
        risultati.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: `La query non e' accettabile: ${controllo.errore}` });
        continue;
      }
      const sqlBuona = String(controllo.sql || "");
      const { data, error } = await admin.rpc("analisi_esegui", { p_sql: sqlBuona, p_viste: viste });
      if (error) {
        risultati.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: `Postgres ha risposto: ${error.message}` });
        continue;
      }
      const righe = Array.isArray(data) ? data : [];
      passi.push({ sql: sqlBuona, righe: righe.length, perche });
      if (righe.length) ultimeRighe = righe;
      // ZERO RIGHE: l'avviso lo mette il codice, non il prompt (la regola
      // sta in _shared/assistente.js, provata nel banco). E' il passo che
      // prima non poteva fare, ed e' quello che gli impedisce di dire
      // «non esiste» quando invece esisteva.
      risultati.push({ type: "tool_result", tool_use_id: c.id, content: esitoInterrogazione(righe) });
    }
    messaggi.push({ role: "user", content: risultati });
  }

  // LA RISPOSTA VUOTA, vista il 3/11: una domanda di dettaglio su 28
  // classi e' tornata con la risposta vuota. Meglio chiederla di nuovo,
  // e in ultima istanza dire cosa si e' letto, che consegnare il nulla.
  if (!piano || typeof piano.risposta !== "string" || !piano.risposta.trim()) {
    messaggi.push({ role: "assistant", content: testoFinale || "(nessun testo)" });
    messaggi.push({ role: "user", content: "Non ho ricevuto la risposta. Scrivi ADESSO solo il JSON finale, con «risposta» piena: usa le righe che hai gia' letto, senza interrogare altro." });
    try {
      const esito = await chiediAlModello(chiave, system, messaggi, []);
      const t = testoDi(esito);
      const p2 = estraiJson(t);
      if (p2 && typeof p2.risposta === "string" && p2.risposta.trim()) piano = p2;
      else if (t) piano = { risposta: t.slice(0, 3000), registro: passi.length ? "dati" : "ragionamento", schede: [], senza_risposta: false };
    } catch { /* si risponde con quello che c'e' */ }
  }
  if (!piano || typeof piano.risposta !== "string" || !piano.risposta.trim()) {
    const quante = passi.reduce((s, p) => s + p.righe, 0);
    piano = {
      risposta: passi.length
        ? `Ho letto i dati (${quante} righe) ma non sono riuscito a scrivere la risposta. Riprova a chiedermelo, magari piu' corto.`
        : "Non sono riuscito a formulare la risposta. Riprova a chiedermelo.",
      registro: passi.length ? "dati" : "ragionamento", schede: [], senza_risposta: false,
    };
  }

  const numeri: number[] = Array.isArray(piano.schede) ? piano.schede.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= schede.length) : [];
  const citati = [...new Set(numeri)].map((n) => schede[n - 1]);
  const registro = registroFinale({ interrogazioni: passi.length, dichiarato: piano.registro, quanteSchedeCitate: citati.length });

  const VALE = ["tutti", "venditori", "master", "assistenti", "amministrazione"];
  let proposta: Record<string, unknown> | null = null;
  const pr = piano.proposta_regola;
  if (ruolo === "amministrazione" && pr && typeof pr === "object" && typeof pr.titolo === "string" && typeof pr.testo === "string" && pr.titolo.trim().length >= 3 && pr.testo.trim().length >= 10) {
    const vale = Array.isArray(pr.vale_per) ? pr.vale_per.map(String).filter((v: string) => VALE.includes(v)) : [];
    const nSost = Number(pr.sostituisce);
    const sostituisce = nSost >= 1 && nSost <= schede.length ? schede[nSost - 1] : null;
    proposta = { titolo: pr.titolo.trim().slice(0, 120), argomento: String(pr.argomento || "").trim().slice(0, 60) || null, testo: pr.testo.trim().slice(0, 4000), vale_per: vale.length ? vale : ["tutti"], sostituisce: sostituisce ? { id: sostituisce.id, titolo: sostituisce.titolo } : null };
  }
  const senzaDefinitivo = senzaRisposta({ registro, dichiarato: piano.senza_risposta, quanteSchedeCitate: citati.length, proposta });

  // «Come l'ho calcolato» mostra TUTTI i passi, anche quelli a vuoto: e'
  // il modo di vedere che ha cercato, dove, e cosa non ha trovato
  const conto = passi.map((p, i) => `-- ${i + 1}) ${p.perche || "interrogazione"} → ${p.righe} righe\n${p.sql}`).join("\n\n");

  await registra({
    risposta: piano.risposta, citati: citati.map((s) => s.id), senza_risposta: senzaDefinitivo,
    registro, sql: conto || null, righe: passi.reduce((s, p) => s + p.righe, 0), uso: usoTotale,
  });
  return json({
    ok: true, risposta: piano.risposta, citati: citati.map((s) => ({ id: s.id, titolo: s.titolo })),
    senza_risposta: senzaDefinitivo, registro, proposta_regola: proposta,
    sql: conto || null, nota: passi.length ? `${passi.length} interrogazion${passi.length === 1 ? "e" : "i"} ai dati` : null,
    righe: ultimeRighe.slice(0, 50), totale_righe: ultimeRighe.length, passi: passi.length,
  });
});
