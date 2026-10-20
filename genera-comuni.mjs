// Rigenera src/comuni-regioni.js dai dati ISTAT pubblici (comuni-json).
//
// L'intestazione di quel file promette da agosto «rigenerata da uno
// script se serve aggiornarla», e lo script non c'era: il giorno in cui
// un comune si fonde o cambia provincia, nessuno sa come rifarla.
//
//   node genera-comuni.mjs
//
// COSA NON DEVE CAMBIARE. L'ordine di REGIONI: `CAP_REG` sono indici in
// quell'array, e rimescolarlo sposterebbe in silenzio la regione di
// migliaia di CAP. Lo script riusa l'ordine del file esistente e si
// ferma se trova una regione che non c'era.
import { readFileSync, writeFileSync } from "node:fs";

const FONTE = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json";
// Gli Stati esteri col loro codice catastale (quello che nel codice
// fiscale comincia per Z). Verificato il 20/10/2026 contro i 17 codici
// gia' presenti nelle schede: combaciano tutti e diciassette, e ognuno
// torna coi cognomi di chi li porta — Z129 Romania, Z100 Albania, Z604
// Colombia, Z138 Ucraina, Z504 Cuba…
const FONTE_STATI = "https://raw.githubusercontent.com/EvolvifyApp/database-comuni-italiani-demo/main/json/nazioni.json";
const USCITA = "src/comuni-regioni.js";

const vecchio = readFileSync(USCITA, "utf8");
const REGIONI = JSON.parse(vecchio.match(/export const REGIONI = (\[[\s\S]*?\]);/)[1]);
const CAP_REG = vecchio.match(/const CAP_REG = (\{[\s\S]*?\});/)[1];

const comuni = await fetch(FONTE).then((r) => r.json());
const nazioni = await fetch(FONTE_STATI).then((r) => r.json());
for (const c of comuni) {
  if (!REGIONI.includes(c.regione.nome)) {
    throw new Error(`regione nuova: "${c.regione.nome}". Va aggiunta IN CODA a REGIONI, mai in mezzo.`);
  }
}

// le province, ordinate per nome: "SIGLA|Nome|indiceRegione"
const viste = new Map();
for (const c of comuni) {
  if (!viste.has(c.sigla)) viste.set(c.sigla, `${c.sigla}|${c.provincia.nome}|${REGIONI.indexOf(c.regione.nome)}`);
}
const PROVINCE = [...viste.values()].sort((a, b) => a.split("|")[1].localeCompare(b.split("|")[1], "it"));
const indiceProv = new Map(PROVINCE.map((r, i) => [r.split("|")[0], i]));

// i comuni, ordinati per nome: "Nome|indiceProvincia|cap,cap,..."
// Un comune su 7904 ha un CAP solo in 7860 casi; Roma ne ha 82.
const COMUNI = comuni
  .map((c) => `${c.nome}|${indiceProv.get(c.sigla)}|${[...c.cap].sort().join(",")}|${c.codiceCatastale}`)
  .sort((a, b) => a.localeCompare(b, "it"));

// "Znnn|Nome dello Stato", solo quelli che un codice catastale ce l'hanno
const STATI = nazioni
  .filter((n) => String(n.codice_at || "").startsWith("Z"))
  .map((n) => `${n.codice_at}|${n.denominazione}`)
  .sort((a, b) => a.split("|")[1].localeCompare(b.split("|")[1], "it"));

// GLI OMONIMI, che sono sette e stanno tutti in regioni diverse.
//
// "Paterno" (PZ, Basilicata) e "Paternò" (CT, Sicilia) diventano la
// stessa chiave appena si togliono gli accenti, e cosi' Calliano,
// Castro, Livo, Peglio, Samone e San Teodoro. La tabella comune ->
// regione puo' tenerne uno solo, e il file di agosto teneva
// semplicemente l'ultimo scritto — cioe' il risultato dipendeva
// dall'ordine di generazione, che e' un modo di decidere senza averlo
// deciso.
//
// Qui la regola e' dichiarata: a parita' di nome comanda il CAP, e solo
// quando il CAP non c'e' vale il comune piu' popoloso. Cambia un caso
// rispetto a prima, Samone: senza CAP era Trentino (544 abitanti),
// adesso e' Piemonte (1614).
function norm(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/\([^)]*\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
}
const perChiave = new Map();
for (const c of comuni) {
  const k = norm(c.nome);
  if (!perChiave.has(k)) perChiave.set(k, []);
  perChiave.get(k).push(c);
}
const OMONIMI = {};
for (const [k, lista] of perChiave) {
  if (lista.length < 2) continue;
  const grosso = lista.reduce((a, b) => (b.popolazione > a.popolazione ? b : a));
  OMONIMI[k] = REGIONI.indexOf(grosso.regione.nome);
}

const testo = `// Comuni italiani: regione, provincia e CAP (dati ISTAT via comuni-json),
// generati e inclusi nel bundle — la residenza si compila in locale,
// senza chiamate di rete.
//
// NON modificare a mano: \`node genera-comuni.mjs\` lo rifa'.
//
// L'ordine di REGIONI non si tocca: CAP_REG sono indici in quell'array.
export const REGIONI = ${JSON.stringify(REGIONI)};

// "SIGLA|Nome provincia|indice in REGIONI"
export const PROVINCE = ${JSON.stringify(PROVINCE)};

// "Nome comune|indice in PROVINCE|CAP separati da virgola|codice catastale"
const COMUNI = ${JSON.stringify(COMUNI)};

// "codice catastale|Nome", per chi e' nato fuori Italia. Il codice
// fiscale di chi nasce all'estero porta questo al posto del comune.
export const STATI = ${JSON.stringify(STATI)};

const CAP_REG = ${CAP_REG};

// Nomi che dopo la normalizzazione appartengono a due comuni in regioni
// diverse: qui vince il piu' popoloso, ma solo se non c'e' un CAP.
const OMONIMI = ${JSON.stringify(OMONIMI)};

function normalizza(s) {
  return (s || "").toString().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase().replace(/\\([^)]*\\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
}

// La tabella comune -> regione si ricava da COMUNI la prima volta che
// serve, invece di spedire gli stessi 7900 nomi due volte nel bundle.
let CITTA_REG = null;
function cittaReg() {
  if (CITTA_REG) return CITTA_REG;
  CITTA_REG = Object.create(null);
  for (const riga of COMUNI) {
    const [nome, prov] = riga.split("|");
    CITTA_REG[normalizza(nome)] = Number(PROVINCE[Number(prov)].split("|")[2]);
  }
  Object.assign(CITTA_REG, OMONIMI); // gli omonimi non li decide l'ordine
  return CITTA_REG;
}

// Ricava la regione italiana da una citta di residenza (e, se disponibile,
// dal CAP come fallback/disambiguazione). Restituisce il nome della regione
// oppure "" se non trovata.
export function regioneDaCitta(citta, cap) {
  const key = normalizza(citta);
  const tab = cittaReg();
  const capPulito = (cap || "").toString().replace(/[^0-9]/g, "").slice(0, 5);
  // Su un nome che appartiene a due comuni in regioni diverse comanda il
  // CAP: la tabella per nome puo' tenerne uno solo, il CAP sa quale.
  if (key && OMONIMI[key] != null && capPulito.length === 5 && CAP_REG[capPulito] != null)
    return REGIONI[CAP_REG[capPulito]];
  if (key && tab[key] != null) return REGIONI[tab[key]];
  if (capPulito.length === 5 && CAP_REG[capPulito] != null) return REGIONI[CAP_REG[capPulito]];
  return "";
}

// --- la cascata: regione -> provincia -> comune -> CAP ---------------
//
// Ogni gradino restituisce solo quello che sta sotto al precedente, cosi'
// nessuno puo' scegliere una combinazione che non esiste.

export function provinceDiRegione(regione) {
  const i = REGIONI.indexOf(regione);
  if (i < 0) return [];
  return PROVINCE
    .filter((r) => Number(r.split("|")[2]) === i)
    .map((r) => { const [sigla, nome] = r.split("|"); return { sigla, nome }; });
}

// La regione di una provincia: serve a riaprire la cascata su una
// scheda gia' compilata, dove in archivio c'e' la sigla e non la regione.
export function regioneDiProvincia(sigla) {
  const r = PROVINCE.find((x) => x.split("|")[0] === sigla);
  return r ? REGIONI[Number(r.split("|")[2])] : "";
}

export function comuniDiProvincia(sigla) {
  const i = PROVINCE.findIndex((r) => r.split("|")[0] === sigla);
  if (i < 0) return [];
  return COMUNI.filter((r) => Number(r.split("|")[1]) === i).map((r) => r.split("|")[0]);
}

// I CAP di un comune. Quasi sempre uno: si preseleziona da solo e chi
// compila non deve nemmeno saperlo. Roma ne ha 82, e quelli si scelgono.
export function capDiComune(sigla, comune) {
  const i = PROVINCE.findIndex((r) => r.split("|")[0] === sigla);
  const chiave = normalizza(comune);
  for (const riga of COMUNI) {
    const [nome, prov, cap] = riga.split("|");
    if (Number(prov) === i && normalizza(nome) === chiave) return cap ? cap.split(",") : [];
  }
  return [];
}

// La provincia di un comune, quando la si sa per nome e non per cascata
// (serve a ricostruire la scelta da una scheda gia' compilata).
// Il codice catastale di un comune (quattro caratteri: una lettera e tre
// cifre), che e' il pezzo centrale del codice fiscale.
export function codiceCatastale(comune) {
  const chiave = normalizza(comune);
  for (const riga of COMUNI) {
    const [nome, , , catastale] = riga.split("|");
    if (normalizza(nome) === chiave) return catastale || "";
  }
  return "";
}

// Lo stesso, per chi e' nato fuori Italia.
export function codiceCatastaleStato(stato) {
  const chiave = normalizza(stato);
  for (const riga of STATI) {
    const [codice, nome] = riga.split("|");
    if (normalizza(nome) === chiave) return codice;
  }
  return "";
}

export function nomiStati() {
  return STATI.map((r) => r.split("|")[1]);
}

export function provinciaDiComune(comune, cap) {
  const chiave = normalizza(comune);
  const capPulito = (cap || "").toString().replace(/[^0-9]/g, "");
  let perNome = null;
  for (const riga of COMUNI) {
    const [nome, prov, caps] = riga.split("|");
    if (normalizza(nome) !== chiave) continue;
    const lista = caps ? caps.split(",") : [];
    if (capPulito && lista.includes(capPulito)) return PROVINCE[Number(prov)].split("|")[0];
    if (!perNome) perNome = PROVINCE[Number(prov)].split("|")[0];
  }
  return perNome || "";
}
`;
writeFileSync(USCITA, testo);
console.log(`${USCITA}: ${REGIONI.length} regioni, ${PROVINCE.length} province, ${COMUNI.length} comuni, ${Math.round(testo.length / 1024)} KB`);
