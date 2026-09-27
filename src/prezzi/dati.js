// Il listino: lettura e niente più.
//
// Il conto vive nella view `v_prezzi_listini` (migrazione
// 20260927200000), non qui: una formula sola, in un posto solo. Questo
// file la legge e la porta in pagina. Non scrive mai su `prodotti_shop`
// e non parla con WooCommerce — il listino per i rivenditori è una cosa,
// il prezzo dello shop un'altra.
import { supabase, leggiTutte } from "../supabase.js";

// l'ordinamento è per blocco e nome, non per id: sulle pagine successive
// di PostgREST un ordine instabile fa comparire due volte la stessa riga
export async function leggiListino() {
  return leggiTutte(() =>
    supabase.from("v_prezzi_listini").select("*")
      .order("blocco_ordine", { ascending: true })
      .order("nome", { ascending: true }));
}

// I blocchi, nell'ordine del menu del sito. Il numero combacia con
// `blocco_ordine` della view: se cambia là, cambia qui.
export const BLOCCHI = [
  { n: 1,  nome: "PIGMENTI",            descrizione: "Pigmenti per dermopigmentazione professionale" },
  { n: 2,  nome: "COLLE DA EXTENSIONS", descrizione: "Adesivi, sigillante e primer per extension ciglia" },
  { n: 3,  nome: "DERMOGRAFI",          descrizione: "Macchinette e manipoli" },
  { n: 4,  nome: "AGHI",                descrizione: "Aghi e cartucce per dermopigmentazione" },
  { n: 5,  nome: "MICROBLADING",        descrizione: "Lame e accessori per microblading" },
  { n: 6,  nome: "LASH EXTENSION",      descrizione: "Ciglia, pinzette e materiale per extension" },
  { n: 7,  nome: "LAMINAZIONE",         descrizione: "Prodotti e accessori per laminazione ciglia e sopracciglia" },
  { n: 8,  nome: "HENNE",               descrizione: "Tinte e accessori henné" },
  { n: 9,  nome: "NEEDLING",            descrizione: "Needling e trattamenti viso" },
  { n: 10, nome: "PROGETTAZIONE",       descrizione: "Matite, fili, calibri e strumenti di disegno" },
  { n: 11, nome: "ACCESSORI",           descrizione: "Monouso, protezioni e materiale di consumo" },
  { n: 12, nome: "WEAR & ACC",          descrizione: "Abbigliamento e accessori Elitederma" },
  { n: 99, nome: "ALTRI PRODOTTI",      descrizione: "In vendita sullo shop ma fuori dalle categorie del menu" },
];

export function bloccoDi(n) {
  return BLOCCHI.find((b) => b.n === n) || BLOCCHI[BLOCCHI.length - 1];
}

// Perché un prodotto non ha uno sconto massimo: senza costo non si può
// dire quanto si può cedere. Distinguere i due casi serve, perché si
// rimedia in due posti diversi.
export function motivoSenzaSconto(r) {
  if (r.sconto_max_pct != null) return null;
  if (r.tipo !== "bundle") return "Manca il costo di acquisto: senza quello non si può dire quanto si può scontare.";
  if (r.componenti_distinta == null) return "Bundle senza distinta base: non c'è nessun componente da cui ricavare il costo.";
  if (r.componenti_senza_costo > 0) {
    const n = r.componenti_senza_costo;
    return `${n} component${n === 1 ? "e" : "i"} su ${r.componenti_distinta} non ha un costo: la somma sarebbe più bassa del vero.`;
  }
  return "Il costo ricavato dalla distinta è zero.";
}

const CAMPI_CSV = [
  ["blocco", "Reparto"],
  ["nome", "Prodotto"],
  ["pubblico_lordo", "Pubblico lordo"],
  ["pubblico_netto", "Pubblico netto"],
  ["sconto_fase_pct", "Sconto %"],
  ["prezzo_fase", "Prezzo rivenditore"],
  ["guadagno_riv_fase", "A lui"],
  ["ti_resta_fase", "A te"],
  ["costo_acquisto", "Costo acquisto"],
];

// Il CSV per Excel italiano: punto e virgola fra le colonne, virgola nei
// decimali, e il BOM davanti o gli accenti arrivano illeggibili.
export function csvListino(righe) {
  const cella = (v) => {
    if (v == null) return "";
    const t = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const testata = CAMPI_CSV.map(([, l]) => cella(l)).join(";");
  const corpo = righe.map((r) => CAMPI_CSV.map(([c]) => cella(r[c])).join(";"));
  return "﻿" + [testata, ...corpo].join("\r\n") + "\r\n";
}

export function scaricaCsv(testo, nomeFile) {
  const blob = new Blob([testo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // senza revoke il blob resta in memoria finché non si chiude la pagina
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------
// I tre sotto-listini: come si divide il prezzo col rivenditore.
//
// La regola, detta dal titolare guardando la riga dell'Arizona (netto
// 32,70): "gli ho ceduto 24 euro e a me restano 8. Io mi aspetto 16 a
// lui e 16 a me". Quindi il confronto non e' fra l'utile finale e lo
// sconto: e' fra le DUE META' DEL PREZZO. Lo sconto non e' il risultato
// di un calcolo, lo sconto E' la divisione.
//
//     Bilanciato  meta' per uno     sconto 50%
//     Fase 2      due terzi a te    sconto 33,3%
//     Fase 1      tre quarti a te   sconto 25%
//
// Cioe' d = 1/(k+1), e basta. Quello che lui fa con la sua meta' — spese,
// societa', tasse — non entra nel conto e non deve: e' roba sua. Quello
// che tu fai con la tua resta scritto nelle colonne "a te", che sono
// un'altra cosa e continuano a dire la verita'.
//
// I due tentativi precedenti pareggiavano prima l'utile ante imposte e
// poi quello netto: numeri giusti, domanda sbagliata. Restano qui a
// memoria di cosa NON si stava chiedendo.
//
// L'unico limite e' non vendere sottocosto: oltre
//
//     tetto = 1 - C / ( N (1-a) )
//
// il prezzo al rivenditore non copre piu' merce e margine di sicurezza.
// Dove la quota teorica sfonda quel tetto lo sconto si ferma li' e la
// riga lo dichiara (`sotto`), invece di mostrare una meta' che non c'e'.
export const FASI = [
  { id: "fase1",      nome: "Fase 1",     k: 3, quota: "3/4 a te",     spiega: "Sconto del 25%: tre quarti del prezzo li incassi tu, un quarto lo lasci a lui. Si parte da qui." },
  { id: "fase2",      nome: "Fase 2",     k: 2, quota: "2/3 a te",     spiega: "Sconto del 33,3%: due terzi a te, un terzo a lui. Quando ha cominciato a portare volume." },
  { id: "bilanciato", nome: "Bilanciato", k: 1, quota: "metà per uno", spiega: "Sconto del 50%: il prezzo si divide a metà. Quanto gli lasci è quanto incassi — poi ognuno con la sua metà fa i conti suoi." },
];

export function faseDi(id) {
  return FASI.find((f) => f.id === id) || FASI[FASI.length - 1];
}

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// I numeri di una riga secondo la fase scelta. Tutto si ricava dai dati
// della view — prezzo netto, costo, costi aziendali, imposte — cosi' le
// tre fasi non possono raccontare cose diverse fra loro.
export function scenario(riga, k) {
  const N = Number(riga.pubblico_netto);
  const C = riga.costo_acquisto == null ? null : Number(riga.costo_acquisto);
  const a = Number(riga.sicurezza_pct ?? 15) / 100;
  const t = Number(riga.imposte_pct ?? 27.9) / 100;
  if (C == null || !(N > 0)) {
    return { scontoPct: null, prezzoRivenditore: null, guadagnoRivenditore: null,
             utile: null, tiResta: null, sotto: false, quotaPct: null };
  }
  // k parti a te, una a lui: la fetta di lui e' 1/(k+1) del prezzo
  const quota = 1 / (k + 1);
  // sotto a questo prezzo la merce e il margine di sicurezza non si
  // pagano piu': il tetto non e' una scelta commerciale, e' il fondo
  const tetto = Math.max(0, 1 - C / (N * (1 - a)));
  const d = Math.min(quota, tetto);
  const prezzo = r2(N * (1 - d));
  const utile = prezzo * (1 - a) - C;
  return {
    scontoPct: Math.round(d * 1000) / 10,
    quotaPct: Math.round(quota * 1000) / 10,
    sotto: d < quota - 1e-9,          // la meta' promessa non ci sta
    prezzoRivenditore: prezzo,
    guadagnoRivenditore: r2(N * d),
    utile: r2(utile),
    tiResta: r2(utile > 0 ? utile * (1 - t) : utile),
  };
}
