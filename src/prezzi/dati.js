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
  ["sconto_max_pct", "Sconto max %"],
  ["prezzo_rivenditore", "Prezzo rivenditore"],
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
