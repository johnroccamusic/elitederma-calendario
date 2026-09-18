// Il consenso della modella: scriverlo, rileggerlo, guardare i documenti.
//
// Chi scrive e' una persona che non ha e non avra' mai un account: apre
// il link del QR, compila, invia. Chi legge e' lo staff, dall'archivio
// dentro Gestione modelle.
//
// I file (documento e firma) stanno in consensi-documenti, l'unico
// bucket privato del progetto. Privato vuol dire che nessun indirizzo
// diretto li serve: si guardano solo con un URL firmato, che scade.

import { supabase } from "../supabase.js";

export interface DatiConsenso {
  modelloCodice: string;
  versioneTesto: string;
  nome: string;
  cognome: string;
  dataNascita?: string | null;
  luogoNascita?: string | null;
  residenza?: string | null;
  telefono?: string | null;
  email?: string | null;
  documentoTipo?: string | null;
  documentoNumero?: string | null;
  trattamento?: string | null;
  trattamentoAltro?: string | null;
  noteSalute?: string | null;
  consensoTrattamento: boolean;
  consensoFotoVideo: boolean;
}

export interface FileConsenso {
  fronte?: Blob | null;
  retro?: Blob | null;
  firma?: Blob | null;
}

const BUCKET = "consensi-documenti";

const estensione = (b: Blob) => (b.type === "image/png" ? "png" : b.type === "image/webp" ? "webp" : "jpg");

/**
 * Invia il consenso.
 *
 * I file vanno su PRIMA della riga, sotto una cartella che porta l'id
 * del consenso. Se un caricamento fallisce si esce subito e la riga non
 * nasce: meglio niente che un consenso che dice "documento allegato"
 * indicando un file che non c'e'.
 *
 * L'id lo si decide qui invece di lasciarlo al database proprio per
 * questo: serve prima, per sapere dove mettere i file.
 */
export async function salvaConsenso(
  dati: DatiConsenso,
  file: FileConsenso,
  corsoDataId: string | null = null,
): Promise<{ id?: string; errore?: string }> {
  if (!dati.consensoTrattamento) return { errore: "Senza il consenso al trattamento non si puo' inviare." };
  if (!dati.nome?.trim() || !dati.cognome?.trim()) return { errore: "Servono nome e cognome." };

  const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const percorsi: Record<string, string | null> = { fronte: null, retro: null, firma: null };
  for (const chiave of ["fronte", "retro", "firma"] as const) {
    const blob = file[chiave];
    if (!blob) continue;
    const percorso = `${id}/${chiave}.${estensione(blob)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(percorso, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });
    if (error) return { errore: `Non sono riuscito a caricare ${chiave === "firma" ? "la firma" : `la foto del documento (${chiave})`}: ${error.message}` };
    percorsi[chiave] = percorso;
  }

  const { error } = await supabase.from("consensi_modelle").insert({
    id,
    corso_data_id: corsoDataId,
    modello_codice: dati.modelloCodice,
    versione_testo: dati.versioneTesto,
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    data_nascita: dati.dataNascita || null,
    luogo_nascita: dati.luogoNascita?.trim() || null,
    residenza: dati.residenza?.trim() || null,
    telefono: dati.telefono?.trim() || null,
    email: dati.email?.trim() || null,
    documento_tipo: dati.documentoTipo || null,
    documento_numero: dati.documentoNumero?.trim() || null,
    trattamento: dati.trattamento || null,
    trattamento_altro: dati.trattamentoAltro?.trim() || null,
    note_salute: dati.noteSalute?.trim() || null,
    consenso_trattamento: true,
    consenso_foto_video: !!dati.consensoFotoVideo,
    documento_fronte_path: percorsi.fronte,
    documento_retro_path: percorsi.retro,
    firma_path: percorsi.firma,
  });
  if (error) return { errore: error.message };
  return { id };
}

export interface ConsensoRaccolto {
  id: string;
  corsoDataId: string | null;
  modelloCodice: string | null;
  versioneTesto: string;
  nome: string;
  cognome: string;
  dataNascita: string | null;
  luogoNascita: string | null;
  residenza: string | null;
  telefono: string | null;
  email: string | null;
  documentoTipo: string | null;
  documentoNumero: string | null;
  trattamento: string | null;
  trattamentoAltro: string | null;
  noteSalute: string | null;
  consensoFotoVideo: boolean;
  frontePath: string | null;
  retroPath: string | null;
  firmaPath: string | null;
  ts: string;
}

function daRiga(r: any): ConsensoRaccolto {
  return {
    id: r.id,
    corsoDataId: r.corso_data_id || null,
    modelloCodice: r.modello_codice || null,
    versioneTesto: r.versione_testo || "v1",
    nome: r.nome || "",
    cognome: r.cognome || "",
    dataNascita: r.data_nascita || null,
    luogoNascita: r.luogo_nascita || null,
    residenza: r.residenza || null,
    telefono: r.telefono || null,
    email: r.email || null,
    documentoTipo: r.documento_tipo || null,
    documentoNumero: r.documento_numero || null,
    trattamento: r.trattamento || null,
    trattamentoAltro: r.trattamento_altro || null,
    noteSalute: r.note_salute || null,
    consensoFotoVideo: !!r.consenso_foto_video,
    frontePath: r.documento_fronte_path || null,
    retroPath: r.documento_retro_path || null,
    firmaPath: r.firma_path || null,
    ts: r.ts,
  };
}

/** Tutti i consensi raccolti, i piu' recenti per primi. */
export async function leggiConsensi(): Promise<ConsensoRaccolto[]> {
  const { data } = await supabase
    .from("consensi_modelle").select("*").order("ts", { ascending: false });
  return (data || []).map(daRiga);
}

/**
 * L'indirizzo temporaneo con cui si guarda un file del bucket privato.
 *
 * Dieci minuti: il tempo di aprirlo e chiuderlo. Un link che non scade
 * e' un link che qualcuno inoltra.
 */
export async function urlFirmato(percorso: string | null, secondi = 600): Promise<string | null> {
  if (!percorso) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(percorso, secondi);
  return data?.signedUrl || null;
}

/**
 * Il filtro dell'archivio: nome, cognome, telefono, email, documento,
 * trattamento. Una parola per volta, tutte devono trovare qualcosa —
 * cosi' "rossi labbra" trova le Rossi che hanno firmato per le labbra e
 * non tutte le Rossi piu' tutte le labbra.
 */
export function filtraConsensi(elenco: ConsensoRaccolto[], testo: string): ConsensoRaccolto[] {
  const parole = String(testo || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return elenco;
  return elenco.filter((c) => {
    const dentro = [
      c.nome, c.cognome, c.telefono, c.email, c.documentoNumero,
      c.documentoTipo, c.trattamento, c.trattamentoAltro, c.residenza, c.luogoNascita,
    ].filter(Boolean).join(" ").toLowerCase();
    return parole.every((p) => dentro.includes(p));
  });
}
