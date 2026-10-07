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

// I punti di un prodotto, scritti a mano. Nessun calcolo: null svuota la
// casella e la riporta a "non ancora deciso".
export async function salvaPuntiProdotto(prodottoId, punti) {
  const { error } = await supabase.from("prodotti_shop")
    .update({ punti_prodotto: punti })
    .eq("id", prodottoId);
  if (error) throw error;
}

// La riduzione dello sconto massimo di un reparto: punti percentuali da
// togliere a tutti i suoi prodotti. Zero (o vuoto) significa nessuna
// riduzione, e la riga sparisce invece di restare a zero.
export async function leggiRiduzioniReparto() {
  const { data, error } = await supabase.from("listino_riduzioni_blocco").select("blocco_ordine, punti");
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.blocco_ordine, Number(r.punti)]));
}

export async function salvaRiduzioneReparto(bloccoOrdine, punti) {
  if (!punti) {
    const { error } = await supabase.from("listino_riduzioni_blocco").delete().eq("blocco_ordine", bloccoOrdine);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("listino_riduzioni_blocco")
    .upsert({ blocco_ordine: bloccoOrdine, punti, updated_at: new Date().toISOString() }, { onConflict: "blocco_ordine" });
  if (error) throw error;
}

// I reparti che NON entrano nel listino PDF. Si ricordano fra una volta e
// l'altra: chi prepara un listino per i rivenditori lo rifa' con le stesse
// esclusioni, e rispuntarle ogni volta e' lavoro ripetuto.
//
// Stanno nella cassetta delle impostazioni condivise, come le altre scelte
// di lavoro: una riga chiave/valore, niente tabella nuova.
export const CHIAVE_REPARTI_ESCLUSI = "listino_reparti_esclusi";

export async function leggiRepartiEsclusi() {
  const { data, error } = await supabase.from("impostazioni_layout_tabelle")
    .select("valore").eq("chiave", CHIAVE_REPARTI_ESCLUSI).maybeSingle();
  if (error) return [];
  return Array.isArray(data?.valore) ? data.valore.map(Number) : [];
}

export async function salvaRepartiEsclusi(numeri) {
  const { error } = await supabase.from("impostazioni_layout_tabelle")
    .upsert({ chiave: CHIAVE_REPARTI_ESCLUSI, valore: numeri, aggiornato_il: new Date().toISOString() }, { onConflict: "chiave" });
  if (error) throw error;
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

// ---------- Il listino delle master ----------
//
// Alle master non si cede il massimo: quello e' il prezzo del
// rivenditore, che compra per rivendere e si prende il rischio del
// magazzino. Alla master si cede una FETTA di quel massimo, decisa qui.
//
// Una quota generale, e se serve una diversa per reparto: sui pigmenti si
// puo' essere piu' larghi che sui dermografi. Il conto resta quello della
// view — sconto massimo per prodotto — e qui si decide solo quanta parte
// di quello spazio si regala.
export const CHIAVE_QUOTA_MASTER = "listino_master_quota";
export const QUOTA_MASTER_DEFAULT = 50;

export async function leggiQuotaMaster() {
  const { data, error } = await supabase.from("impostazioni_layout_tabelle")
    .select("valore").eq("chiave", CHIAVE_QUOTA_MASTER).maybeSingle();
  if (error || !data?.valore || typeof data.valore !== "object") return { generale: QUOTA_MASTER_DEFAULT, reparti: {} };
  const v = data.valore;
  return {
    generale: Number.isFinite(Number(v.generale)) ? Number(v.generale) : QUOTA_MASTER_DEFAULT,
    reparti: v.reparti && typeof v.reparti === "object" ? v.reparti : {},
  };
}

export async function salvaQuotaMaster(quota) {
  const { error } = await supabase.from("impostazioni_layout_tabelle")
    .upsert({ chiave: CHIAVE_QUOTA_MASTER, valore: quota, aggiornato_il: new Date().toISOString() }, { onConflict: "chiave" });
  if (error) throw error;
}

// La quota che vale su un reparto: la sua se c'e' scritta, altrimenti
// quella generale. Zero e' una quota valida — vuol dire "niente sconto" —
// quindi si distingue da "non scritta", che e' null o stringa vuota.
export function quotaMasterDi(quota, bloccoOrdine) {
  const sua = quota?.reparti?.[bloccoOrdine];
  const n = Number(sua);
  if (sua != null && sua !== "" && Number.isFinite(n) && n >= 0) return n;
  const g = Number(quota?.generale);
  return Number.isFinite(g) && g >= 0 ? g : QUOTA_MASTER_DEFAULT;
}

// Lo sconto e il prezzo di una master su un prodotto.
//
// La percentuale si legge sul prezzo NETTO, come lo sconto massimo e come
// il prezzo rivenditore: e' la stessa base, altrimenti due righe della
// stessa tabella direbbero due cose diverse.
export function prezzoMasterDi(r, quotaPct) {
  const max = r?.sconto_max_pct;
  const netto = Number(r?.pubblico_netto);
  if (max == null || !(netto > 0)) return { pct: null, prezzo: null, risparmio: null, cedibile: null };
  // Si parte dagli EURO cedibili, non dalla percentuale.
  //
  // E' lo stesso numero che l'allineamento scrive su ogni prodotto di
  // WooCommerce (`_ed_cedibile_eur`), e il sito fa esattamente questa
  // moltiplicazione. Arrotondare prima la percentuale — 31,5 x 33,5% =
  // 10,5525, letto 10,55 — spostava fino a due centesimi sui prodotti
  // cari: il banco e il sito dicevano due prezzi diversi sulla stessa
  // riga. Partendo dagli euro la differenza non puo' nascere.
  const cedibile = Math.round(netto * Number(max)) / 100;
  const sconto = Math.round(cedibile * (Number(quotaPct) || 0)) / 100;
  const prezzo = Math.round((netto - sconto) * 100) / 100;
  // la percentuale serve a leggersi, non a calcolare: si ricava indietro
  const pct = Math.round((sconto / netto) * 10000) / 100;
  return { pct, prezzo, risparmio: sconto, cedibile };
}
