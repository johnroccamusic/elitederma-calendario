// IL TESTO DEL CONTRATTO MASTER: dove sta, e chi vince.
//
// Stessa regola del regolamento del modulo di iscrizione (vedi
// `src/iscrizione/testi.js`), e per lo stesso motivo.
//
// CHI VINCE: la riga del database. `master_contratti_testi` e' quello da
// cui il SERVER compone la copia congelata alla firma: dal browser il
// testo del contratto non si accetta, o con una sessione si farebbe
// registrare un contratto alterato.
//
// IL CODICE RESTA, e serve a due cose: far VEDERE la pagina se la query
// fallisce — un contratto che non si presenta e' peggio di un contratto
// non corretto — ed essere il testo di partenza a cui «Rimetti com'era»
// torna.
//
// LE DUE COPIE NASCONO IDENTICHE, e lo si controlla invece di crederlo:
// `impronte()` calcola lo sha256 di ogni chiave da una parte e
// dall'altra, e la pagina le mette affiancate. Lo stesso numero lo
// stampa `scripts/genera-testi-contratto.mjs`, che genera
// `supabase/testi-contratto-master.sql`.
import { supabase } from "../supabase.js";
import {
  INTESTAZIONE, PARTI, PREMESSE, ARTICOLI, CLAUSOLE, MANIFESTO, CASELLE,
} from "../../supabase/functions/_shared/contratto-master.js";

export const CHIAVI = ["intestazione", "parti", "premesse", "articoli", "clausole", "manifesto", "caselle"];

export const NOMI = {
  intestazione: "Intestazione del contratto",
  parti: "Le parti",
  premesse: "Premesse",
  articoli: "Articoli da 1 a 23",
  clausole: "Approvazione specifica (artt. 1341 e 1342 c.c.)",
  manifesto: "Allegato A — Manifesto Elitederma",
  caselle: "Le dichiarazioni da spuntare",
};

/** Quello che vale se il database non dice niente. */
export const DAL_CODICE = {
  intestazione: INTESTAZIONE,
  parti: PARTI,
  premesse: PREMESSE,
  articoli: ARTICOLI,
  clausole: CLAUSOLE,
  manifesto: MANIFESTO,
  caselle: CASELLE,
};

// Le righe caricate dal codice portano questo inizio in `aggiornato_da`:
// per la pagina sono «testo di partenza, mai corretto», non la
// correzione di qualcuno.
export const PARTENZA = "testo di partenza";

const copia = (x) => JSON.parse(JSON.stringify(x));

/**
 * L'IMPRONTA DI UN TESTO, per confrontare le due copie senza leggerle.
 *
 * sha256 dei primi 16 caratteri, come il generatore. `crypto.subtle` non
 * c'e' in ogni contesto (una pagina servita in chiaro non lo espone, e
 * jsdom nel banco di prova nemmeno): quando manca si torna una stringa
 * vuota e la pagina scrive «non confrontabile» invece di far credere che
 * i due testi coincidano.
 */
export async function impronta(valore) {
  try {
    const dati = new TextEncoder().encode(JSON.stringify(valore));
    const somma = await crypto.subtle.digest("SHA-256", dati);
    return Array.from(new Uint8Array(somma)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  } catch { return ""; }
}

/**
 * Legge i sette pezzi. Torna sempre qualcosa di completo: le chiavi che
 * il database non ha vengono dal codice, e `mancanti` dice quali — e'
 * quello che la pagina mostra per far premere «Carica il testo di
 * partenza».
 */
export async function leggiTesti() {
  const base = copia(DAL_CODICE);
  const { data, error } = await supabase
    .from("master_contratti_testi")
    .select("chiave, corpo, aggiornato_da, aggiornato_il");
  if (error) return { testi: base, provenienza: {}, mancanti: [...CHIAVI], errore: error.message };
  const provenienza = {};
  const trovate = new Set();
  for (const r of data || []) {
    if (!CHIAVI.includes(r.chiave) || !r.corpo) continue;
    base[r.chiave] = r.corpo;
    trovate.add(r.chiave);
    provenienza[r.chiave] = {
      da: r.aggiornato_da,
      il: r.aggiornato_il,
      diPartenza: String(r.aggiornato_da || "").startsWith(PARTENZA),
    };
  }
  return { testi: base, provenienza, mancanti: CHIAVI.filter((k) => !trovate.has(k)), errore: "" };
}

export async function salvaTesto(chiave, corpo, chi) {
  if (!CHIAVI.includes(chiave)) return "Chiave sconosciuta: " + chiave;
  const { data, error } = await supabase
    .from("master_contratti_testi")
    .upsert({ chiave, corpo, aggiornato_da: chi || null, aggiornato_il: new Date().toISOString() },
            { onConflict: "chiave" })
    .select("chiave");
  if (error) return error.message;
  // UN UPSERT SENZA SELECT DICE «VA BENE» ANCHE A ZERO RIGHE, e qui
  // zero righe vuol dire una correzione che si crede salvata e non lo e':
  // la prossima firma congelerebbe il testo di prima.
  if (!data || data.length === 0) return `«${NOMI[chiave] || chiave}» non e' stata scritta: ricarica la pagina e riprova.`;
  return "";
}

/**
 * CARICA (O RIMETTE) IL TESTO DI PARTENZA, quello del codice.
 *
 * E' lo stesso contenuto che scrive `supabase/testi-contratto-master.sql`:
 * quel file si incolla nell'editor SQL, questo tasto fa la stessa cosa
 * dall'app. Si usa due volte nella vita di una chiave — la prima, per
 * caricarla, e quando si vuole buttare una correzione. La versione che
 * si butta finisce in archivio da sola (trigger).
 *
 * NON si cancella la riga: dal momento in cui il server compone da
 * quelle righe la copia congelata, una chiave mancante vuol dire
 * ricadere sul testo mandato dal browser.
 */
export async function caricaDiPartenza(chiavi = CHIAVI) {
  const righe = chiavi.filter((k) => CHIAVI.includes(k)).map((chiave) => ({
    chiave,
    corpo: copia(DAL_CODICE[chiave]),
    aggiornato_da: `${PARTENZA} (14/11/2026)`,
    aggiornato_il: new Date().toISOString(),
  }));
  if (!righe.length) return "Nessuna chiave da caricare.";
  const { data, error } = await supabase
    .from("master_contratti_testi")
    .upsert(righe, { onConflict: "chiave" })
    .select("chiave");
  if (error) return error.message;
  // UN UPSERT SENZA SELECT DICE «VA BENE» ANCHE A ZERO RIGHE: qui si
  // conta, perche' un testo che non e' stato scritto e' un contratto che
  // alla firma ricadrebbe sul testo del browser senza dirlo a nessuno.
  if (!data || data.length !== righe.length) {
    return `Il database ha scritto ${data?.length ?? 0} righe su ${righe.length}: ricarica la pagina e riprova.`;
  }
  return "";
}

/** Un capoverso per riga, come si scrive in una casella di testo. */
export const aRighe = (elenco) => (elenco || []).join("\n");
export const daRighe = (testo) =>
  String(testo || "").split("\n").map((r) => r.trim()).filter(Boolean);
