// Il listino per i venditori: lettura e niente più.
//
// Il conto vive nella view `v_prezzi_listini` (migrazione
// 20260927090000), non qui: una formula sola, in un posto solo. Questo
// file la legge e la porta in tabella. Non scrive mai su
// `prodotti_shop`, e non parla con WooCommerce — il listino per i
// venditori è una cosa, il prezzo dello shop un'altra.
import { supabase, leggiTutte } from "../supabase.js";

// I tre parametri della regola. La quota del venditore è nostra; le due
// percentuali aziendali sono quelle che l'app usa già in Dettaglio
// prodotti, perché sono le stesse e due verità che divergono sui soldi
// sono il modo migliore per non fidarsi di nessuna delle due.
export const CHIAVE_QUOTA_VENDITORE = "prezziListini_quotaVenditorePct";
export const CHIAVE_COSTI_AZIENDALI = "dettaglioProdotti_margineOperativoPct";
export const CHIAVE_SICUREZZA = "puntiMaster_incidenzaCostiPct";
export const QUOTA_VENDITORE_DEFAULT = 50;

export const TIPI_PRODOTTO = [
  { v: "semplice", l: "Semplice" },
  { v: "bundle", l: "Bundle" },
  { v: "componente", l: "Componente" },
  { v: "variante", l: "Variante" },
];

// l'ordinamento è per nome e non per id: sulle pagine successive di
// PostgREST un ordine instabile fa comparire due volte la stessa riga
export async function leggiPrezziListini() {
  return leggiTutte(() => supabase.from("v_prezzi_listini").select("*").order("nome", { ascending: true }));
}

export function etichettaTipo(tipo) {
  return (TIPI_PRODOTTO.find((t) => t.v === tipo) || { l: tipo || "—" }).l;
}

// Perché un prodotto non ha un listino. Serve alla pastiglia in tabella:
// "Costo mancante" da solo non dice se il costo non c'è sulla riga o se
// manca in un pezzo della distinta, e sono due cose da sistemare in due
// posti diversi.
export function motivoCostoMancante(r) {
  if (r.stato_prezzo !== "costo_mancante") return null;
  if (r.tipo !== "bundle") return "Questo prodotto non ha un costo di acquisto, o è a zero.";
  if (r.componenti_distinta == null) return "Bundle senza distinta base: non c'è nessun componente da cui ricavare il costo.";
  if (r.componenti_senza_costo > 0) {
    const n = r.componenti_senza_costo;
    return `${n} component${n === 1 ? "e" : "i"} su ${r.componenti_distinta} non ha un costo di acquisto: la somma sarebbe una cifra falsa, più bassa del vero.`;
  }
  return "Il costo ricavato dalla distinta è zero.";
}

const CAMPI_CSV = [
  ["nome", "Prodotto"],
  ["tipo", "Tipo"],
  ["costo_acquisto", "Costo acquisto"],
  ["listino_netto", "Listino netto"],
  ["listino_ivato", "Listino IVA incl."],
  ["quota_venditore", "Quota venditore"],
  ["prezzo_shop_netto", "Prezzo shop netto"],
  ["prezzo_shop_ivato", "Prezzo shop IVA incl."],
  ["scarto", "Scarto"],
  ["moltiplicatore_attuale", "Moltiplicatore attuale"],
  ["aliquota_iva", "IVA %"],
  ["quota_venditore_pct", "Quota venditore %"],
  ["stato_prezzo", "Stato"],
];

// Il CSV per Excel italiano: punto e virgola fra le colonne, virgola nei
// decimali, e il BOM davanti o gli accenti arrivano illeggibili.
export function csvPrezziListini(righe) {
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
