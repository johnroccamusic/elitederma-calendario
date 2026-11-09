// «PREZZI CORSO DI PMU»: L'ASSISTENTE MOSTRA LA LOCANDINA (9/11/2026).
//
// Il titolare: «quando all'agente AI gli chiedo prezzi corso di PMU,
// vorrei che mi mostrasse nella chat la locandina, che se e' composta di
// piu' pagine posso sfogliare col dito facendo slide da destra verso
// sinistra, e col pinch posso zoomare per vedere i prezzi».
//
// PERCHE' NON PUO' RISPONDERLO IL MODELLO: il prezzo di un corso NON
// esiste nei dati — e' scritto nelle locandine di «Prezzi corsi», che
// sono immagini e PDF in un secchio. Sta scritto perfino dentro il
// catalogo che l'assistente legge («il prezzo di un corso non esiste nei
// dati»), e finora la risposta era quella: «non ce l'ho, guarda in
// Prezzi corsi». Il foglio invece ce l'abbiamo: si mostra.
//
// Qui dentro c'e' SOLO il riconoscimento del testo: da «prezzi corso di
// PMU» ai file che lo riguardano. Le locandine non si leggono qui (lo fa
// App.jsx, dove vive il secchio) e non si disegnano qui (lo fa
// SfogliaLocandine.jsx).
import { PAROLE_NEUTRE, parolePerCerca, pezziDelNome } from "../pos/prezzo-al-banco.js";

// LA PAROLA CHE DISTINGUE LE DUE DOMANDE E' «CORSO».
//
// «prezzi PMU» e «prezzi corso di PMU» sembrano la stessa domanda e non
// lo sono: in anagrafica ci sono quattro prodotti che si chiamano PMU
// (Dispensa PMU, Specchio PMU...), e il banco deve continuare a
// rispondere per quelli. Quando il testo dice «corso» — o «locandina»,
// o «listino» — la domanda e' del corso, e la locandina viene prima.
export const PAROLE_DEL_CORSO = new Set([
  "corso", "corsi", "locandina", "locandine", "listino", "prezzario", "prezziario", "volantino", "brochure",
]);
// le parole del prezzo: servono a capire se una domanda senza nessuna
// corrispondenza esatta merita il secondo giro (vedi sotto)
const PAROLE_DEL_PREZZO = new Set(["prezzo", "prezzi", "costo", "costa", "costano", "quanto", "listino", "tariffa", "tariffe"]);
// quello che non e' il nome di un corso: le paroline del prezzo (le ha
// gia' il banco) piu' quelle con cui si chiede di vedere un foglio
const PAROLE_NEUTRE_LOCANDINA = new Set([
  ...PAROLE_NEUTRE, ...PAROLE_DEL_CORSO,
  "mostrami", "mostra", "mostrami", "far", "fammela", "vedi", "guarda", "apri", "aprimi", "foglio",
  "pagina", "pagine", "foto", "immagine", "quale", "quali", "qual", "sono", "ha", "hanno", "c", "ci",
]);

function parole(testo) {
  return parolePerCerca(testo, PAROLE_NEUTRE_LOCANDINA);
}

// true se il testo nomina un corso o una locandina: e' quello che decide
// se la locandina risponde PRIMA dei prodotti del banco
export function nominaUnCorso(testo) {
  return parolePerCerca(testo, new Set()).some((p) => PAROLE_DEL_CORSO.has(p));
}
export function chiedeUnPrezzo(testo) {
  return parolePerCerca(testo, new Set()).some((p) => PAROLE_DEL_PREZZO.has(p));
}

// Le locandine che quel testo nomina, le piu' probabili per prime. Vuoto
// vuol dire «questa non e' la domanda del prezzo di un corso», e chi
// chiama prosegue come ha sempre fatto.
//
// Due giri, e il secondo serve a un caso vero:
//   1. ogni parola scritta deve trovare posto nel nome del file. «prezzi
//      corso di PMU» -> le sei locandine del PMU;
//   2. se non torna niente MA la domanda chiede esplicitamente il prezzo
//      di un corso, bastano le parole che combaciano: «quanto costa il
//      corso di PMU a Milano» non deve finire a mani vuote per colpa di
//      «Milano», che in un nome di file non c'e' e non ci sara' mai.
// Il secondo giro non puo' allargare le maglie da solo: senza «corso» e
// senza «prezzo» non si fa, o «come funziona il PMU» mostrerebbe sei
// cartelli di prezzi invece di una spiegazione.
export function cercaLocandinePerTesto(testo, locandine, { quante = 8 } = {}) {
  const cercate = parole(testo);
  if (!cercate.length) return [];
  if (!cercate.some((p) => p.length >= 3)) return [];
  const voluti = (locandine || []).filter((l) => l && l.nome && l.url);
  const pesate = voluti.map((l) => {
    const pezzi = pezziDelNome(l.titolo || l.nome);
    const quanteCombaciano = cercate.filter((q) => pezzi.some((z) => z.startsWith(q))).length;
    return { locandina: l, quanteCombaciano, peso: pezzi.length };
  });
  // chi somiglia di piu': prima quante parole ha preso, poi il nome piu'
  // corto — a parita' di parole trovate, e' quello che dice solo quello
  const ordina = (a, b) => b.quanteCombaciano - a.quanteCombaciano || a.peso - b.peso
    || String(a.locandina.nome).localeCompare(String(b.locandina.nome));
  const tutte = pesate.filter((p) => p.quanteCombaciano === cercate.length);
  if (tutte.length) return tutte.sort(ordina).slice(0, quante).map((p) => p.locandina);
  if (!(nominaUnCorso(testo) && chiedeUnPrezzo(testo))) return [];
  const qualcuna = pesate.filter((p) => p.quanteCombaciano > 0);
  return qualcuna.sort(ordina).slice(0, quante).map((p) => p.locandina);
}

// Quello che la voce legge, e quello che si scrive nella cronologia: una
// foto non si legge ad alta voce, quindi si dice che c'e' e come si
// guarda. Le cifre NON si inventano: stanno sul foglio.
export function testoDelleLocandine(pagine) {
  const nomi = [];
  for (const p of pagine || []) if (!nomi.includes(p.titolo)) nomi.push(p.titolo);
  if (!nomi.length) return "Non ho trovato nessuna locandina per quel corso.";
  const quante = (pagine || []).length;
  const elenco = nomi.length === 1 ? `«${nomi[0]}»` : nomi.map((n) => `«${n}»`).join(", ");
  return `I prezzi di questo corso stanno sulla locandina, qui sopra: ${elenco}`
    + (quante > 1 ? `, ${quante} pagine in tutto. Sfogliale col dito e allarga con due dita per leggere le cifre.` : `. Allarga con due dita per leggere le cifre.`);
}
