// Edge Function "cerca-indirizzo"
// Suggerisce la via mentre si scrive, cercandola su Photon (OpenStreetMap).
//
// PERCHE' NON STA NEL BROWSER, anche se Photon non vuole nessuna chiave.
// Per tre motivi, e il terzo e' quello che conta:
//   1. qui si puo' mettere un freno (Photon e' un servizio gratuito e
//      regge un uso ragionevole, non una raffica a ogni lettera);
//   2. qui si filtra sul comune scelto, e il browser non deve sapere
//      come e' fatta la risposta di Photon;
//   3. il giorno in cui Photon non bastasse e si passasse a Google o
//      Mapbox, quelli vogliono una chiave — e una chiave nel bundle e'
//      una chiave pubblica. Si cambia questa funzione e basta: nell'app
//      non si tocca niente.
//
// CHI PUO' CHIAMARLA. Solo chi ha fatto accesso, come `invia-email`. La
// chiave pubblicabile sta nel bundle: senza questo controllo la funzione
// diventerebbe un ponte aperto verso Photon a nome nostro, e chi offre
// un servizio gratuito se ne accorge e lo chiude.
//
// LA VIA RESTA SCRIVIBILE, E NON E' UN COMPROMESSO. Comune e CAP si
// scelgono da un elenco chiuso perche' l'elenco e' completo; le vie di
// OpenStreetMap non lo sono. Provato: «Via Circondario» a Castelfranci
// (Avellino, 1.900 abitanti) non c'e', e quella e' la residenza di
// un'allieva vera. Un elenco chiuso incompleto impedirebbe di
// registrare chi esiste — quindi qui si suggerisce, non si obbliga.
//
// COSA RESTITUISCE
//   { vie: [{ via, civico, cap, comune }] }
//
// IL CAP DEL SUGGERIMENTO NON COMANDA. Serve a far vedere che qualcosa
// non torna, non a riscrivere la scheda: il CAP l'ha appena scelto chi
// compila, e Photon a volte ne dice un altro (per «Via Carlo Severini»
// dice 00163, l'allieva aveva scritto 00166). Davanti a due fonti che
// non concordano decide la persona, non la piu' recente.
// Niente coordinate: all'app servono le parole dell'indirizzo, non un
// punto sulla mappa, e un dato che non serve e' un dato da non chiedere.
//
// LA RICERCA E' RISTRETTA AL COMUNE GIA' SCELTO. Non e' un dettaglio di
// qualita': la residenza nell'app si scende per gradini (stato, regione,
// provincia, comune, CAP), quindi quando si arriva alla via il comune e'
// gia' deciso. Cercare in tutta Italia darebbe venti "Via Roma" di venti
// paesi diversi, cioe' il contrario di un aiuto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PHOTON = "https://photon.komoot.io/api";
const MINIMO_LETTERE = 3;
const QUANTI = 8;

// UNA MEMORIA CORTA, PER NON MARTELLARE UN SERVIZIO GRATUITO.
//
// Provandolo il 19/10/2026, dopo una ventina di richieste di fila Photon
// ha smesso di rispondere in JSON e ha mandato una pagina HTML di
// errore: e' il loro modo di dire basta. Chi compila un indirizzo
// cancella e riscrive la stessa via tre o quattro volte, e quelle sono
// richieste identiche.
//
// Vive nell'isolato della funzione, quindi si svuota da se' quando
// Supabase lo ricicla: va bene, non e' una cache da cui dipende niente —
// se manca si richiede, se c'e' si risparmia.
const RICORDA_PER = 10 * 60 * 1000;
const MASSIMO_RICORDI = 300;
const memoria = new Map<string, { quando: number; vie: unknown[] }>();
function dalRicordo(k: string): unknown[] | null {
  const r = memoria.get(k);
  if (!r) return null;
  if (Date.now() - r.quando > RICORDA_PER) { memoria.delete(k); return null; }
  return r.vie;
}
function ricorda(k: string, vie: unknown[]): void {
  // la piu' vecchia esce: una Map in JavaScript conserva l'ordine di
  // inserimento, quindi la prima chiave e' sempre la piu' anziana
  if (memoria.size >= MASSIMO_RICORDI) {
    const prima = memoria.keys().next().value;
    if (prima !== undefined) memoria.delete(prima);
  }
  memoria.set(k, { quando: Date.now(), vie });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function chiamanteAutorizzato(req: Request): Promise<boolean> {
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return false;
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  const { data, error } = await admin.auth.getUser(gettone);
  return !error && !!data?.user?.email;
}

// Due nomi di comune si confrontano senza accenti e senza maiuscole:
// in archivio c'e' "PATERNO", Photon risponde "Paternò", ed e' lo stesso
// posto. Senza questo il filtro butterebbe via i risultati giusti.
function chiave(s: string): string {
  // `\p{Diacritic}` invece dell'intervallo \u0300-\u036f: dice la stessa
  // cosa e si legge, e soprattutto non si trasforma nei segni veri ogni
  // volta che questo file passa per uno strumento che interpreta gli
  // escape — e' appena successo due volte.
  return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// IL NOME DEVE C'ENTRARE CON QUELLO CHE SI STA SCRIVENDO.
//
// Photon, quando la via cercata non esiste, risponde con le altre vie
// dello stesso comune. Provato il 19/10/2026: «Via Circondario» a
// Castelfranci non c'e', e arrivavano Via San Nicola, Via Venezia, Via
// Roma — otto suggerimenti che non hanno niente a che fare con quello
// che la persona stava scrivendo. E' peggio di nessun suggerimento: chi
// ha fretta ne clicca uno e si porta a casa un indirizzo falso.
//
// Quindi ogni parola scritta — le generiche no, e nemmeno quelle da due
// lettere come "di" o "da" — deve essere l'inizio di una parola del
// nome proposto. Cosi' «Via Mergat» tiene «Via Mergataro», e «Via
// Circondario» non tiene «Via San Nicola».
const GENERICHE = new Set([
  "VIA", "VIALE", "PIAZZA", "PIAZZALE", "CORSO", "LARGO", "VICOLO", "STRADA",
  "CONTRADA", "LOCALITA", "FRAZIONE", "BORGO", "SALITA", "DISCESA", "TRAVERSA",
  "LUNGOMARE", "CIRCONVALLAZIONE", "PARCO", "RESIDENCE",
]);
function parolePiene(s: string): string[] {
  return chiave(s).split(" ").filter((x) => x.length >= 3 && !GENERICHE.has(x));
}
function nomeCentra(cercato: string, proposto: string): boolean {
  const cercate = parolePiene(cercato);
  // se si e' scritto solo "via" non c'e' niente da confrontare: decide
  // il comune, come prima
  if (cercate.length === 0) return true;
  const dentro = chiave(proposto).split(" ");
  return cercate.every((c) => dentro.some((d) => d.startsWith(c)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);
  if (!(await chiamanteAutorizzato(req))) return json({ errore: "Serve avere fatto accesso." }, 401);

  let corpo: { cerca?: string; comune?: string; cap?: string };
  try { corpo = await req.json(); } catch { return json({ errore: "Corpo non leggibile" }, 400); }

  const cerca = (corpo.cerca || "").trim();
  const comune = (corpo.comune || "").trim();
  const cap = (corpo.cap || "").trim();
  // Sotto le tre lettere non si cerca: i risultati sarebbero inutili e
  // la richiesta sarebbe comunque partita.
  if (cerca.length < MINIMO_LETTERE) return json({ vie: [] });
  // Il comune NON e' piu' obbligatorio. Senza, si cerca in tutta Italia
  // e la proposta porta con se' il paese: e' il gesto di chi scrive
  // l'indirizzo per intero e se lo vede completare, invece di dover
  // prima dichiarare dove abita. «Via Carlo Severini» in tutta Italia
  // da' una riga sola; «Via Roma» ne da' undici, e si sceglie la
  // propria leggendo il paese accanto.
  const inTuttaItalia = !comune;

  const ricordo = `${chiave(cerca)}|${chiave(comune)}|${cap}|${inTuttaItalia ? "IT" : ""}`;
  const giaVisto = dalRicordo(ricordo);
  if (giaVisto) return json({ vie: giaVisto });

  // Photon non ha un filtro "solo in questo comune": si chiede la via
  // insieme al comune e si filtra la risposta.
  //
  // `layer=street` E NIENTE ALTRO. Provato il 19/10/2026: senza quel
  // filtro «Via Roma Milano» risponde «Palazzo del Banco di Roma» e una
  // fermata dell'autobus; aggiungendo anche `layer=house` arrivano
  // ristoranti e vie che somigliano al nome cercato. Con il solo
  // `street` «Via Carlo Severini Roma» da' una riga, quella giusta.
  const url = new URL(PHOTON);
  //
  // NIENTE `lang=it`, ED E' CONTROINTUITIVO. Provato il 19/10/2026:
  // «Via Carlo Severini Roma» con `layer=street` da' una riga, quella
  // giusta; aggiungendo `lang=it` ne da' **zero**. Sembra il parametro
  // piu' ovvio da mettere su un'app italiana ed e' quello che spegne la
  // ricerca. Se un giorno i suggerimenti sparissero, guardare qui.
  url.searchParams.set("q", inTuttaItalia ? cerca : `${cerca}, ${comune}`);
  // senza comune il campo da setacciare e' tutta Italia: si chiede piu'
  // largo, perche' il filtro sul Paese scarta parecchio
  url.searchParams.set("limit", String(inTuttaItalia ? 40 : QUANTI * 4));
  url.searchParams.set("layer", "street");

  let risposta: Response;
  try {
    risposta = await fetch(url.toString(), {
      // Photon e' gratuito e chiede un uso corretto: dire chi chiama e'
      // il minimo, e serve a loro per scriverci invece che bloccarci.
      headers: { "User-Agent": "Elitederma-Gestionale (commerciale.elitederma@gmail.com)" },
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    // Un suggerimento che non arriva non deve fermare chi sta compilando:
    // la via si puo' sempre scrivere a mano.
    return json({ vie: [], avviso: `Ricerca non raggiungibile: ${e instanceof Error ? e.message : String(e)}` });
  }
  if (!risposta.ok) return json({ vie: [], avviso: `Ricerca non disponibile (${risposta.status})` });

  let dati: { features?: Array<{ properties?: Record<string, unknown> }> };
  try { dati = await risposta.json(); } catch { return json({ vie: [], avviso: "Risposta non leggibile" }); }

  const kComune = chiave(comune);
  const viste = new Set<string>();
  const vie: Array<{ via: string; civico: string; cap: string; comune: string }> = [];

  for (const f of dati.features || []) {
    const p = (f.properties || {}) as Record<string, string | undefined>;
    // Col layer `street` il nome sta in `name` e `street` e' vuoto; se
    // un giorno si riaprisse anche il layer `house` sarebbe il
    // contrario. Si guardano tutti e due.
    const via = (p.name || p.street || "").trim();
    if (!via) continue;
    const cittaRisposta = (p.city || p.locality || p.district || p.county || "").trim();
    const capRisposta = (p.postcode || "").trim();
    // Il comune deve combaciare. Quando Photon non lo dice, vale il CAP:
    // e' il caso delle frazioni, dove `city` e' la frazione e non il
    // comune che l'allieva ha scelto.
    if (inTuttaItalia) {
      // fuori dall'Italia non si spedisce da questa casella, e un
      // indirizzo straniero in mezzo ai suggerimenti confonde e basta
      if ((p.countrycode || "").toUpperCase() !== "IT") continue;
      // senza il paese la proposta non si puo' scegliere: due "Via
      // Roma" identiche nell'elenco sono peggio di nessuna proposta
      if (!cittaRisposta) continue;
    } else {
      const perNome = cittaRisposta && chiave(cittaRisposta) === kComune;
      const perCap = !!cap && !!capRisposta && capRisposta === cap;
      if (!perNome && !perCap) continue;
    }
    // ...e il nome deve c'entrare: il comune giusto da solo non basta
    if (!nomeCentra(cerca, via)) continue;

    const civico = (p.housenumber || "").trim();
    const firma = inTuttaItalia
      ? `${chiave(via)}|${chiave(cittaRisposta)}|${capRisposta}`
      : `${chiave(via)}|${civico}`;
    if (viste.has(firma)) continue;
    viste.add(firma);
    vie.push({ via, civico, cap: capRisposta || cap, comune: cittaRisposta || comune });
    if (vie.length >= QUANTI) break;
  }

  ricorda(ricordo, vie);
  return json({ vie });
});
