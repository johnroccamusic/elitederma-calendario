// «SCRIVO UN PRODOTTO E MI DICE I PREZZI DEL BANCO» (8/11/2026).
//
// Il titolare: «quando scrivo un nome di un prodotto mi dice il prezzo
// normale, poi se sono in fiera mi dice sconto fiera in contanti, il
// prezzo finale, e sconto fiera POS, il prezzo finale. In pratica una
// specie di simulazione del POS banco».
//
// Qui dentro c'e' SOLO il riconoscimento del testo: da «pigmento nero»
// ai prodotti dell'anagrafica. I PREZZI NON SI CALCOLANO QUI, e non e'
// una divisione per eleganza: lo sconto al banco lo decide
// `scontiPerRigaCarrello` in App.jsx, la stessa funzione che scrive il
// prezzo sullo scontrino. Un secondo conto qui vorrebbe dire un prezzo
// detto dall'assistente e un prezzo incassato dal POS che possono non
// coincidere — ed e' esattamente il guasto che il 7/11/2026 e' costato
// un pigmento venduto sotto costo.

// Le parole che non sono il nome di un prodotto: si scrive «quanto costa
// il pigmento», non «pigmento». Toglierle evita di cercare un prodotto
// chiamato «quanto».
export const PAROLE_NEUTRE = new Set([
  "prezzo", "prezzi", "costo", "costa", "costano", "quanto", "quanta", "quante", "quanti",
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "dello", "della", "dei", "degli", "delle",
  "mi", "dimmi", "dammi", "dai", "per", "che", "cosa", "e", "ed", "con", "al", "allo", "alla", "ai", "sul", "su",
  "in", "a", "da", "dal", "nel", "nella", "vorrei", "sapere", "fammi", "vedere",
  "fa", "viene", "vale", "fiera", "banco", "sconto", "scontato", "finale", "pos", "carta", "contanti", "cash",
]);

// Le stesse regole del comune di nascita: si cerca come si scrive, ogni
// parola e' l'INIZIO di una parola del nome. «lamin ess» trova «Kit
// laminazione essential», e le paroline di mezzo non vanno sapute.
export function parolePerCerca(testo) {
  return String(testo || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p && !PAROLE_NEUTRE.has(p));
}

function pezziDelNome(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Risponde con i prodotti che quel testo nomina, i piu' probabili per
// primi. Vuoto vuol dire «questa non e' la domanda di un prezzo», e chi
// chiama passa la domanda al modello come ha sempre fatto.
//
// Due prudenze, perche' questa scorciatoia non deve rubare le domande
// vere («come registro un cliente» non e' un prodotto):
//   - ogni parola scritta deve trovare posto nel nome o nello sku;
//   - serve almeno una parola di tre lettere, o «a b» pescherebbe mezza
//     anagrafica.
export function cercaProdottiPerTesto(testo, prodotti, { quanti = 6 } = {}) {
  const parole = parolePerCerca(testo);
  if (!parole.length) return [];
  if (!parole.some((p) => p.length >= 3)) return [];
  const voluti = (prodotti || []).filter((p) => p && p.id);
  const trovati = [];
  for (const p of voluti) {
    const pezzi = pezziDelNome(p.nome).concat(pezziDelNome(p.sku));
    if (!pezzi.length) continue;
    if (!parole.every((q) => pezzi.some((z) => z.startsWith(q)))) continue;
    // chi somiglia di piu': il nome piu' corto, a parita' di parole
    // trovate, e' quello che il nome lo dice e basta
    trovati.push({ prodotto: p, peso: pezzi.length });
  }
  trovati.sort((a, b) => a.peso - b.peso || String(a.prodotto.nome || "").localeCompare(String(b.prodotto.nome || "")));
  return trovati.slice(0, quanti).map((t) => t.prodotto);
}
