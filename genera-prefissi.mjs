// I PREFISSI TELEFONICI INTERNAZIONALI, UNO PER STATO.
//
// Scrive `src/prefissi-telefonici-dati.js`, con la stessa regola dei
// comuni: i dati non si scrivono a mano, si generano — e si rigenerano
// con
//
//     node genera-prefissi.mjs
//
// LA FONTE e' il dataset `mledoze/countries` su GitHub, lo stesso da cui
// e' costruita l'API restcountries. Si legge il file direttamente invece
// dell'API perche' quella, interrogata l'8/11/2026, risponde «questa
// versione e' dismessa» su ogni versione, v5 compresa: un dato che fa
// funzionare una casella non puo' dipendere da un servizio che si
// spegne senza avvisare. Il file e' versionato e si scarica in un colpo.
//
// LA CHIAVE E' IL NOSTRO ELENCO, NON IL LORO. Gli Stati sono i 232
// dell'ISTAT che l'app gia' si porta dietro (`STATI` in
// comuni-regioni.js): un paese del dataset che non e' nel nostro elenco
// non serve, e un nostro Stato senza prefisso DEVE comparire nel
// riepilogo invece di sparire — una tendina che non propone il paese di
// chi si ha davanti e' peggio di una casella da scrivere.
import { writeFileSync } from "node:fs";
import { STATI } from "./src/comuni-regioni.js";

const FONTE = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

// Accenti, maiuscole e punteggiatura non si devono sapere per far
// combaciare due nomi.
//
// `\p{Diacritic}` e NON l'intervallo dei segni combinanti scritto come
// escape: quell'escape si trasforma nei caratteri veri ogni volta che
// il file passa per uno strumento che li interpreta, e allora la riga
// smette di fare quello che dice. E' gia' successo tre volte in questo
// progetto, l'ultima proprio qui: la normalizzazione sembrava a posto e
// «Isole Fær Øer» diventava «ISOLE F R R».
//
// Æ, Ø, Ð e Þ si scrivono per esteso perche' NFD non li scompone: sono
// lettere, non lettere accentate, e senza queste righe la regola che
// butta via «tutto quello che non e' A-Z» se le mangerebbe.
const norm = (s) => String(s || "")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toUpperCase()
  .replace(/Æ/g, "AE").replace(/Ø/g, "O").replace(/Ð/g, "D").replace(/Þ/g, "TH")
  .replace(/\(.*?\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();

// I NOMI CHE NON COMBACIANO, DICHIARATI UNO PER UNO. L'ISTAT e il
// dataset chiamano le stesse cose in modi diversi; ogni riga qui e' una
// decisione presa guardando i due elenchi, non una somiglianza trovata
// da un algoritmo — un paese agganciato per assonanza e' un prefisso
// sbagliato addosso a una persona vera. Per questo il generatore
// stampa, riga per riga, a CHI ha agganciato: si rileggono.
const A_MANO = {
  "FEDERAZIONE RUSSA": "Russia",
  "REPUBBLICA CECA": "Cechia",
  "STATO DELLA CITTA DEL VATICANO": "Città del Vaticano",
  "MYANMAR BIRMANIA": "Myanmar",
  "ISOLE FAER OER": "Isole Far Oer",
  "ISOLE COOK NZ": "Isole Cook",
  "ISOLE COCOS": "Isole Cocos e Keeling",
  "ISOLE FALKLAND MALVINE": "Isole Falkland",
  "BRUNEI DARUSSALAM": "Brunei",
  "SANT ELENA": "Sant'Elena, Ascensione e Tristan da Cunha",
  "TIMOR LESTE": "Timor Est",
  "AZERBAIGIAN": "Azerbaijan",
  "GUADALUPA": "Guadeloupa",
  "ISOLE DELLE MARIANNE SETTENTRIONALI": "Isole Marianne Settentrionali",
  "MAURIZIO": "Mauritius",
  "SUD SUDAN": "Sudan del sud",
  "SUDAFRICA": "Sud Africa",
  "THAILANDIA": "Tailandia",
};

// E I DUE PREFISSI CHE IL DATASET NON SA DIRE, decisi a mano e
// scritti col perche'. Li ha trovati il riepilogo dei paesi con piu' di
// un suffisso: senza quel riepilogo sarebbero finiti in archivio come
// numeri veri.
const PREFISSO_A_MANO = {
  // il Vaticano ha un prefisso suo, +379; il dataset tiene per primo
  // «06698», che e' il numero di Roma da cui passano davvero le sue
  // linee — composto, darebbe +3906698, che non e' un prefisso
  Z106: "+379",
  // il Sahara occidentale si chiama attraverso il Marocco: +212. Il
  // dataset ne tiene i due interni (5288, 5289), e appiccicarli darebbe
  // +2125288
  Z339: "+212",
};

const risposta = await fetch(FONTE);
if (!risposta.ok) throw new Error(`la fonte non risponde: ${risposta.status}`);
const paesi = await risposta.json();

// un indice su tutti i nomi che un paese puo' avere: italiano comune e
// ufficiale, inglese, e le grafie alternative
const perNome = new Map();
const aggiungi = (nome, paese) => {
  const k = norm(nome);
  if (k && !perNome.has(k)) perNome.set(k, paese);
};
for (const p of paesi) {
  aggiungi(p.translations?.ita?.common, p);
  aggiungi(p.translations?.ita?.official, p);
  aggiungi(p.name?.common, p);
  aggiungi(p.name?.official, p);
  for (const alt of p.altSpellings || []) aggiungi(alt, p);
}

// IL PREFISSO, E PERCHE' NON BASTA «radice + suffisso».
//
// Nel dataset `root` e' solo la PRIMA CIFRA («+4» per la Svizzera) e il
// resto sta nei suffissi. Prendere la radice da sola quando i suffissi
// sono tanti dava «Sant'Elena +2» e «Vaticano +3», che non sono
// prefissi: sono una cifra.
//
// La regola segue il piano di numerazione internazionale:
//
//  - un suffisso solo: radice + suffisso. Anguilla e' +1264 — sta nel
//    piano nordamericano, e per chiamarla quel 264 serve;
//  - piu' suffissi su +1 o +7: la radice e basta. Sono gli unici due
//    prefissi di UNA cifra che esistono, e li' i suffissi sono i
//    distretti interni (gli Stati Uniti ne hanno piu' di trecento):
//    appiccicarne uno darebbe un numero che non si puo' chiamare;
//  - piu' suffissi su un'altra radice: radice + il primo, e i due casi
//    in cui sbaglia stanno scritti in PREFISSO_A_MANO.
function prefissoDi(p) {
  const radice = p.idd?.root || "";
  const code = p.idd?.suffixes || [];
  if (!radice) return "";
  if (code.length === 1) return radice + code[0];
  if (radice === "+1" || radice === "+7") return radice;
  return code.length ? radice + code[0] : radice;
}

const righe = [];
const senza = [];
const scelti = [];
const multipli = [];
for (const voce of STATI) {
  const [codice, nome] = voce.split("|");
  const paese = perNome.get(norm(A_MANO[norm(nome)] || nome));
  const prefisso = PREFISSO_A_MANO[codice] || (paese ? prefissoDi(paese) : "");
  if (!prefisso) { senza.push(nome); continue; }
  if (!PREFISSO_A_MANO[codice] && (paese.idd?.suffixes || []).length > 1) {
    const s = paese.idd.suffixes;
    multipli.push(`${nome} -> ${prefisso} (suffissi: ${s.slice(0, 4).join(",")}${s.length > 4 ? ",..." : ""})`);
  }
  if (A_MANO[norm(nome)]) scelti.push(`${nome} -> ${paese?.translations?.ita?.common || "?"} ${prefisso}`);
  righe.push(`${codice}|${prefisso}`);
}

writeFileSync("src/prefissi-telefonici-dati.js", `// GENERATO DA genera-prefissi.mjs — NON SI SCRIVE A MANO.
//
// Il prefisso telefonico internazionale di ogni Stato dell'elenco ISTAT
// (\`STATI\` in comuni-regioni.js), nella forma "Z###|+##". La chiave e'
// il codice catastale dello Stato e non il nome: cosi' il legame non si
// rompe il giorno che un nome viene scritto in un altro modo.
//
// Fonte: mledoze/countries. Rigenerare con: node genera-prefissi.mjs
export const PREFISSI = ${JSON.stringify(righe)};
`);
console.log(`Stati con prefisso: ${righe.length} su ${STATI.length}`);
if (senza.length) console.log(`SENZA PREFISSO (${senza.length}): ${senza.join(", ")}`);
console.log(`\nRiscritti a mano (${scelti.length}), da rileggere:`);
for (const r of scelti) console.log("  " + r);
console.log(`\nCon piu' di un suffisso (${multipli.length}), da rileggere:`);
for (const r of multipli) console.log("  " + r);
