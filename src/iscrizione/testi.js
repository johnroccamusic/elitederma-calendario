// IL TESTO DEL CONTRATTO: dove sta, e chi vince.
//
// Regolamento, informativa privacy e consensi sono trascritti in
// contenuto.js parola per parola dal modulo che girava sul sito. Da
// Setting > Modulo di iscrizione > Il contratto si possono correggere, e
// la correzione finisce in `modulo_iscrizione_testi`.
//
// CHI VINCE: la riga del database. Dal 31/10/2026 le tre righe ci sono
// sempre (caricate identiche al testo del codice) e il SERVER compone il
// contratto firmato da quelle: modulo_salva non si fida piu' del testo che
// manda il browser. Il codice resta come rete per chi VEDE la pagina — se la
// query fallisce perche' la sessione e' scaduta, il modulo non si presenta
// vuoto — ma non e' piu' quello che si firma.
//
// Si corregge da Setting come prima, a piacere: la correzione archivia da
// sola la versione precedente (modulo_iscrizione_testi_archivio, trigger
// modulo_testi_archivia). Quando si corregge un testo qui, il codice NON si
// aggiorna da solo: resta il testo di partenza, e «Rimetti com'era» lo
// riscrive nel database invece di cancellare la riga.
import { supabase } from "../supabase.js";
import { INTRO, SEZIONI, CONSENSI } from "./contenuto.js";

const REGOLAMENTO = SEZIONI.find((s) => s.tipo === "testo");

// quello che vale se il database non dice niente
export const DAL_CODICE = {
  intro: INTRO,
  regolamento: { titolo: REGOLAMENTO.titolo, blocchi: REGOLAMENTO.blocchi },
  consensi: CONSENSI,
};

export const CHIAVI_TESTI = ["intro", "regolamento", "consensi"];

// Le righe caricate dal codice (o rimesse com'erano) portano questo inizio in
// `aggiornato_da`: per l'editor sono «testo di partenza, mai corretto», non
// una correzione di qualcuno.
export const PARTENZA = "testo di partenza";

export const NOMI_TESTI = {
  intro: "Intestazione del modulo",
  regolamento: "Regolamento di partecipazione",
  consensi: "Privacy, immagini e consensi",
};

// Legge i tre pezzi. Torna sempre qualcosa di completo: le chiavi che il
// database non ha vengono dal codice.
export async function leggiTesti() {
  const base = JSON.parse(JSON.stringify(DAL_CODICE));
  const { data, error } = await supabase
    .from("modulo_iscrizione_testi")
    .select("chiave, corpo, aggiornato_da, aggiornato_il");
  if (error) {
    // si va avanti col testo del codice: l'errore si mostra, ma la
    // pagina non resta vuota
    return { testi: base, provenienza: {}, errore: error.message };
  }
  const provenienza = {};
  for (const r of data || []) {
    if (!CHIAVI_TESTI.includes(r.chiave) || !r.corpo) continue;
    base[r.chiave] = r.corpo;
    if (!String(r.aggiornato_da || "").startsWith(PARTENZA)) {
      provenienza[r.chiave] = { da: r.aggiornato_da, il: r.aggiornato_il };
    }
  }
  return { testi: base, provenienza, errore: "" };
}

export async function salvaTesto(chiave, corpo, chi) {
  if (!CHIAVI_TESTI.includes(chiave)) return "Chiave sconosciuta: " + chiave;
  const { error } = await supabase
    .from("modulo_iscrizione_testi")
    .upsert({ chiave, corpo, aggiornato_da: chi || null, aggiornato_il: new Date().toISOString() },
            { onConflict: "chiave" });
  return error ? error.message : "";
}

// Rimette una chiave com'era nel codice RISCRIVENDO la riga con il testo di
// partenza: e' il modo di tornare indietro senza dover riscrivere a mano
// nove punti di regolamento. Non si cancella piu': dal 31/10/2026 la riga
// serve al server per comporre il contratto, e senza si ricadrebbe sul
// testo mandato dal browser. La versione che si butta finisce in archivio.
export async function ripristinaTesto(chiave) {
  if (!CHIAVI_TESTI.includes(chiave)) return "Chiave sconosciuta: " + chiave;
  const { error } = await supabase
    .from("modulo_iscrizione_testi")
    .upsert({ chiave, corpo: JSON.parse(JSON.stringify(DAL_CODICE[chiave])), aggiornato_da: PARTENZA + " (rimesso com'era)", aggiornato_il: new Date().toISOString() },
            { onConflict: "chiave" });
  return error ? error.message : "";
}

// Un capoverso per riga, come si scrive in una casella di testo. Le
// righe vuote si buttano: servono solo a respirare mentre si scrive.
export const aRighe = (elenco) => (elenco || []).join("\n");
export const daRighe = (testo) =>
  String(testo || "").split("\n").map((r) => r.trim()).filter(Boolean);
