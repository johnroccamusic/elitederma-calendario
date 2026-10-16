// IL TESTO DEL CONTRATTO: dove sta, e chi vince.
//
// Regolamento, informativa privacy e consensi sono trascritti in
// contenuto.js parola per parola dal modulo che girava sul sito. Da
// Setting > Modulo di iscrizione > Il contratto si possono correggere, e
// la correzione finisce in `modulo_iscrizione_testi`.
//
// CHI VINCE: la riga del database, se c'e'. Se non c'e' — tabella vuota,
// riga cancellata, query fallita perche' la sessione e' scaduta — vale
// il testo del codice. Non e' un ripiego pigro: quello che una persona
// firma non puo' dipendere dal fatto che una select sia andata a buon
// fine, e un modulo che si presenta senza regolamento e' peggio di uno
// con un regolamento vecchio di un giorno.
//
// E' lo stesso patto dei modelli email, e vale la pena ricordarlo:
// quando si corregge un testo qui, il codice NON si aggiorna da solo.
// Resta quello di partenza, come rete.
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
    provenienza[r.chiave] = { da: r.aggiornato_da, il: r.aggiornato_il };
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

// Rimette una chiave com'era nel codice cancellando la riga: e' il modo
// di tornare indietro senza dover riscrivere a mano nove punti di
// regolamento.
export async function ripristinaTesto(chiave) {
  const { error } = await supabase
    .from("modulo_iscrizione_testi").delete().eq("chiave", chiave);
  return error ? error.message : "";
}

// Un capoverso per riga, come si scrive in una casella di testo. Le
// righe vuote si buttano: servono solo a respirare mentre si scrive.
export const aRighe = (elenco) => (elenco || []).join("\n");
export const daRighe = (testo) =>
  String(testo || "").split("\n").map((r) => r.trim()).filter(Boolean);
