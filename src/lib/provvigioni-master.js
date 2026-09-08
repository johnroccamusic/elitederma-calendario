// Provvigioni delle master sulla vendita prodotti.
//
// Qui dentro non si legge e non si scrive niente: sono conti puri, così
// gli stessi numeri valgono al banco, nel referral e in dashboard senza
// che tre posti li calcolino ognuno a modo suo.
//
// La regola di fondo: la provvigione si prende SEMPRE sul margine — il
// ricavo netto (senza IVA e senza spedizione) meno il costo d'acquisto —
// e mai sul prezzo di vendita. Su un prodotto rivenduto a poco più di
// quanto costa non c'è niente da dividere, e una percentuale sul prezzo
// farebbe pagare all'azienda una provvigione che il prodotto non ha
// prodotto.
//
// Quanto di quel margine va alla master dipende da quanto il margine è
// alto: più il prodotto è generoso, più se ne cede. Le fasce stanno nel
// database (provvigioni_fasce) e si regolano da Setting → Definizione
// provvigioni; qui ci sono solo quelle di partenza.

// I due canali. Restano separati perché sono due lavori diversi: al corso
// la master ha davanti una classe che è già lì, con il referral porta
// gente da fuori — e infatti il referral è premiato di più.
export const CANALI_PROVVIGIONE = [
  { chiave: "referral", etichetta: "Provvigioni referral code" },
  { chiave: "corso", etichetta: "Provvigioni al corso" },
];

// Fasce proposte al primo accesso: si vedono in Setting e si cambiano di
// lì. "margine_da" è incluso, "margine_a" escluso; l'ultima fascia ha
// margine_a null e vale da lì in su.
export const FASCE_PROVVIGIONI_DEFAULT = [
  { canale: "corso", margine_da: 0, margine_a: 20, percentuale: 10 },
  { canale: "corso", margine_da: 20, margine_a: 35, percentuale: 15 },
  { canale: "corso", margine_da: 35, margine_a: 50, percentuale: 20 },
  { canale: "corso", margine_da: 50, margine_a: null, percentuale: 25 },
  { canale: "referral", margine_da: 0, margine_a: 20, percentuale: 15 },
  { canale: "referral", margine_da: 20, margine_a: 35, percentuale: 22 },
  { canale: "referral", margine_da: 35, margine_a: 50, percentuale: 30 },
  { canale: "referral", margine_da: 50, margine_a: null, percentuale: 35 },
];

// Sotto un euro la provvigione non entra nei punti: un centesimo per
// volta non si accorge nessuno, e riempirebbe la dashboard di righe che
// non valgono il tempo di leggerle. Quei pezzi contano lo stesso, ma a
// numero — vedi i premi a volume qui sotto.
export const SOGLIA_PROVVIGIONE_EURO = 1;

// Premi a volume, cumulativi: chi arriva a 100 pezzi ha già preso anche
// i tre premi prima. Si azzerano a ogni anno di raccolta.
export const PREMI_VOLUME_PROVVIGIONI = [
  { pezzi: 10, euro: 5 },
  { pezzi: 25, euro: 15 },
  { pezzi: 50, euro: 35 },
  { pezzi: 100, euro: 80 },
];

const arrotonda2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Il margine di una riga: quanto resta all'azienda prima di dividere.
// Il ricavo va passato NETTO — senza IVA e senza spedizione: la
// spedizione non è un ricavo, è un costo ribaltato sul cliente, e l'IVA
// non è mai stata nostra.
export function margineRiga({ ricavoNetto, costoUnitario, quantita = 1 }) {
  const ricavo = Number(ricavoNetto) || 0;
  const costo = (Number(costoUnitario) || 0) * (Number(quantita) || 0);
  const margine = arrotonda2(ricavo - costo);
  // la percentuale si misura sul ricavo, non sul costo: è "quanto di
  // quello che incasso mi resta", che è come si legge un margine
  const marginePct = ricavo > 0 ? (margine / ricavo) * 100 : 0;
  return { ricavo, costo: arrotonda2(costo), margine, marginePct };
}

// La fascia che copre questo margine. Le fasce si guardano in ordine di
// soglia: la prima che contiene il valore vince, e l'ultima senza tetto
// prende tutto quello che sta più in alto.
export function fasciaProvvigione(fasce, canale, marginePct) {
  const delCanale = (fasce || [])
    .filter((f) => f.canale === canale)
    .slice()
    .sort((a, b) => Number(a.margine_da) - Number(b.margine_da));
  for (const f of delCanale) {
    const da = Number(f.margine_da) || 0;
    const a = f.margine_a == null ? Infinity : Number(f.margine_a);
    if (marginePct >= da && marginePct < a) return f;
  }
  // margine negativo (venduto sottocosto) o nessuna fascia definita: non
  // si inventa una percentuale, si dichiara che non c'è
  return null;
}

// Quanto matura UNA riga d'ordine. Restituisce sempre tutto il conto, non
// solo il risultato: chi salva la riga congela questi numeri, e domani
// deve poter dire perché sono quelli anche se le fasce nel frattempo sono
// cambiate.
export function provvigioneRiga({ ricavoNetto, costoUnitario, quantita = 1, canale, fasce }) {
  const conti = margineRiga({ ricavoNetto, costoUnitario, quantita });
  const fascia = conti.margine > 0 ? fasciaProvvigione(fasce, canale, conti.marginePct) : null;
  const percentuale = fascia ? Number(fascia.percentuale) || 0 : 0;
  const provvigione = arrotonda2((conti.margine * percentuale) / 100);
  // Sotto la soglia il pezzo non porta euro ma conta come pezzo: è
  // l'ingresso ai premi a volume, e nasce proprio per i prodotti piccoli
  // che altrimenti non varrebbero niente.
  const sottoSoglia = provvigione > 0 && provvigione < SOGLIA_PROVVIGIONE_EURO;
  return {
    ...conti,
    canale,
    percentuale,
    provvigione: sottoSoglia ? 0 : provvigione,
    provvigioneTeorica: provvigione,
    sottoSoglia,
    pezziSottoSoglia: sottoSoglia ? Math.abs(Number(quantita) || 0) : 0,
  };
}

// L'intera vendita: la somma delle righe. Le righe si contano una per una
// e mai sul totale dell'ordine — due prodotti con margini diversi stanno
// in due fasce diverse, e sommarli prima vorrebbe dire pagarli alla
// fascia sbagliata.
export function provvigioneVendita({ righe, canale, fasce }) {
  const dettaglio = (righe || []).map((r) => provvigioneRiga({ ...r, canale, fasce }));
  return {
    canale,
    provvigione: arrotonda2(dettaglio.reduce((s, d) => s + d.provvigione, 0)),
    pezziSottoSoglia: dettaglio.reduce((s, d) => s + d.pezziSottoSoglia, 0),
    dettaglio,
  };
}

// I premi già sbloccati da un certo numero di pezzi, e quanto manca al
// prossimo: la dashboard mostra tutti e due, perché "ti mancano 4 pezzi"
// è l'unica parte che fa venire voglia di venderne un altro.
export function premiVolumeRaggiunti(pezzi) {
  const n = Number(pezzi) || 0;
  const raggiunti = PREMI_VOLUME_PROVVIGIONI.filter((p) => n >= p.pezzi);
  const prossimo = PREMI_VOLUME_PROVVIGIONI.find((p) => n < p.pezzi) || null;
  return {
    pezzi: n,
    euro: arrotonda2(raggiunti.reduce((s, p) => s + p.euro, 0)),
    raggiunti,
    prossimo,
    pezziAlProssimo: prossimo ? prossimo.pezzi - n : 0,
  };
}
