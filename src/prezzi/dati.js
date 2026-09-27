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
// I tre sotto-listini: quanto del guadagno si lascia al rivenditore.
//
// Non si decide la percentuale di sconto e si guarda cosa succede: si
// decide COME DIVIDERE IL GUADAGNO, e lo sconto viene di conseguenza.
// Chiamando k il rapporto fra quello che resta a noi e quello che prende
// lui, e a i costi aziendali:
//
//     noi: N(1-d)(1-a) - C        lui: dN
//     imponendo  noi = k x lui:
//     d = [ N(1-a) - C ] / [ N(k + 1 - a) ]
//
// Con k=1 torna la formula della meta' per uno. Lo sconto si arrotonda
// all'intero percento PER DIFETTO: cosi' l'errore di arrotondamento
// cade sempre dalla nostra parte, mai dalla sua.
//
// Sono tre fasi di un rapporto commerciale, non tre listini a caso: si
// parte stretti e si concede terreno quando il rivenditore ha dimostrato
// di portare volume.
export const FASI = [
  { id: "fase1",      nome: "Fase 1",     k: 3, quota: "3/4 a noi",  spiega: "Tre quarti del guadagno a noi, un quarto al rivenditore. Si parte da qui." },
  { id: "fase2",      nome: "Fase 2",     k: 2, quota: "2/3 a noi",  spiega: "Due terzi a noi, un terzo al rivenditore. Quando ha cominciato a portare volume." },
  { id: "bilanciato", nome: "Bilanciato", k: 1, quota: "metà per uno", spiega: "Guadagniamo lo stesso: quello che resta a noi è quanto prende lui." },
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
  const imposte = Number(riga.imposte_pct ?? 27.9) / 100;
  if (C == null || !(N > 0)) {
    return { scontoPct: null, prezzoRivenditore: null, guadagnoRivenditore: null, utile: null, tiResta: null };
  }
  const esatto = (N * (1 - a) - C) / (N * (k + 1 - a));
  const d = Math.max(0, Math.floor(esatto * 100) / 100);
  const prezzo = r2(N * (1 - d));
  const utile = prezzo * (1 - a) - C;
  return {
    scontoPct: Math.round(d * 100),
    prezzoRivenditore: prezzo,
    guadagnoRivenditore: r2(N * d),
    utile: r2(utile),
    tiResta: r2(utile > 0 ? utile * (1 - imposte) : utile),
  };
}
