// Stampe packaging: lettura e scrittura, niente altro.
//
// Una scheda per ogni cosa che si manda in tipografia — la scatola, il
// manuale, l'adesivo — con la foto di com'e' fatta, il file da mandare, e
// i dati di stampa riga per riga.
//
// Le righe sono libere di proposito. Nome, tipologia, materiale, formato,
// dimensioni e fornitore servono sempre e nascono gia' scritte; ma ogni
// stampa ha i suoi dettagli — la grammatura, il senso della fibra, i
// colori — e una colonna per ognuno vorrebbe dire una tabella con quaranta
// colonne vuote.
import { supabase } from "../supabase.js";

export const BUCKET_STAMPE = "stampe-packaging";

// Le righe con cui nasce una scheda nuova: quelle che servono sempre,
// gia' scritte e vuote, nell'ordine in cui si leggono.
export const RIGHE_PREDEFINITE = [
  "Nome prodotto",
  "Tipologia",
  "Materiale",
  "Formato",
  "Dimensioni template",
  "Fornitore",
];

// Passo 10 fra una riga e l'altra: inserirne una in mezzo non obbliga a
// rinumerare tutte quelle sotto, basta prendere il punto di mezzo.
export const PASSO_ORDINE = 10;

export async function leggiStampe() {
  const { data, error } = await supabase
    .from("stampe_packaging").select("*").order("ordine").order("creato_il");
  if (error) throw new Error(error.message);
  return data || [];
}

// I file di una scheda: copertina, pagine interne, fustella. Sono un
// elenco e non due colonne perche' "quanti file ha questa stampa" non ha
// una risposta fissa — il catalogo ne ha due, l'astuccio uno, il quaderno
// con la fustella tre.
export async function leggiFileStampe() {
  const { data, error } = await supabase
    .from("stampe_packaging_file").select("*").order("stampa_id").order("ordine");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function aggiungiFile(stampaId, file, etichetta = "", fileDellaScheda = []) {
  const percorso = percorsoFile(stampaId, file.name);
  await caricaFile(percorso, file);
  const ultimo = fileDellaScheda.reduce((max, f) => Math.max(max, Number(f.ordine) || 0), 0);
  const { data, error } = await supabase.from("stampe_packaging_file")
    .insert({ stampa_id: stampaId, percorso, nome: file.name, etichetta, ordine: ultimo + PASSO_ORDINE })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Sostituire il file di una riga che esiste gia': il percorso nuovo
// prende il posto del vecchio, l'etichetta resta quella che era.
export async function sostituisciFile(rigaId, stampaId, file) {
  const percorso = percorsoFile(stampaId, file.name);
  await caricaFile(percorso, file);
  await salvaFile(rigaId, { percorso, nome: file.name });
  return percorso;
}

export async function salvaFile(id, campi) {
  const { error } = await supabase.from("stampe_packaging_file").update(campi).eq("id", id);
  if (error) throw new Error(error.message);
}

// Si toglie la riga, non il file dal secchio: due schede possono puntare
// allo stesso file (il duplicato lo fa apposta), e cancellarlo da sotto
// l'altra sarebbe un danno silenzioso.
export async function eliminaFile(id) {
  const { error } = await supabase.from("stampe_packaging_file").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function leggiRighe() {
  const { data, error } = await supabase
    .from("stampe_packaging_righe").select("*").order("stampa_id").order("ordine");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function creaStampa(nome = "") {
  const { data, error } = await supabase
    .from("stampe_packaging").insert({ nome }).select().single();
  if (error) throw new Error(error.message);
  const righe = RIGHE_PREDEFINITE.map((etichetta, i) => ({
    stampa_id: data.id, etichetta, valore: "", ordine: (i + 1) * PASSO_ORDINE,
  }));
  const { error: e2 } = await supabase.from("stampe_packaging_righe").insert(righe);
  if (e2) throw new Error(e2.message);
  return data;
}

export async function salvaStampa(id, campi) {
  const { error } = await supabase.from("stampe_packaging").update(campi).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaStampa(id) {
  const { error } = await supabase.from("stampe_packaging").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function salvaRiga(id, campi) {
  const { error } = await supabase.from("stampe_packaging_righe").update(campi).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaRiga(id) {
  const { error } = await supabase.from("stampe_packaging_righe").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Una riga nuova SOTTO quella da cui si e' premuto il "+": prende il
// punto di mezzo fra lei e la successiva, cosi' le altre non si toccano.
// Se era l'ultima, si mette un passo piu' giu'.
export async function aggiungiRigaSotto(stampaId, righeDellaScheda, dopoId) {
  const ordinate = [...righeDellaScheda].sort((a, b) => Number(a.ordine) - Number(b.ordine));
  const i = ordinate.findIndex((r) => r.id === dopoId);
  const sopra = i >= 0 ? Number(ordinate[i].ordine) : 0;
  const sotto = i >= 0 && ordinate[i + 1] ? Number(ordinate[i + 1].ordine) : sopra + PASSO_ORDINE * 2;
  const { data, error } = await supabase.from("stampe_packaging_righe")
    .insert({ stampa_id: stampaId, etichetta: "", valore: "", ordine: (sopra + sotto) / 2 })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Duplicare una scheda: stesso contenuto, nome con "(copia)".
//
// Foto e file si tengono per RIFERIMENTO, non si ricopiano nel secchio:
// due schede che puntano allo stesso file sono la norma — il block notes
// A5 e quello A4 hanno la stessa grafica — e caricare un file nuovo crea
// comunque un percorso nuovo, quindi l'una non sovrascrive mai l'altra.
//
// La copia nasce subito sotto l'originale: `ordine` + 1, e siccome le
// schede si leggono anche per data di creazione finisce li' accanto.
export async function duplicaStampa(stampa, righeDellaScheda, fileDellaScheda = []) {
  const { data, error } = await supabase.from("stampe_packaging").insert({
    nome: `${stampa.nome || "Senza nome"} (copia)`,
    foto_path: stampa.foto_path || null,
    file_path: stampa.file_path || null,
    file_nome: stampa.file_nome || null,
    ordine: (Number(stampa.ordine) || 0) + 1,
  }).select().single();
  if (error) throw new Error(error.message);
  const righe = [...(righeDellaScheda || [])]
    .sort((a, b) => Number(a.ordine) - Number(b.ordine))
    .map((r) => ({ stampa_id: data.id, etichetta: r.etichetta || "", valore: r.valore || "", ordine: r.ordine }));
  if (righe.length > 0) {
    const { error: e2 } = await supabase.from("stampe_packaging_righe").insert(righe);
    if (e2) throw new Error(e2.message);
  }
  const file = [...(fileDellaScheda || [])]
    .sort((a, b) => Number(a.ordine) - Number(b.ordine))
    .map((f) => ({ stampa_id: data.id, percorso: f.percorso, nome: f.nome || "", etichetta: f.etichetta || "", ordine: f.ordine }));
  if (file.length > 0) {
    const { error: e3 } = await supabase.from("stampe_packaging_file").insert(file);
    if (e3) throw new Error(e3.message);
  }
  return data;
}

// Il percorso del file dentro il secchio: l'id della scheda fa da
// cartella, cosi' cancellando la scheda si sa cosa buttare.
export function percorsoFile(stampaId, nomeFile) {
  const pulito = String(nomeFile || "file").replace(/[^A-Za-z0-9._-]/g, "_");
  return `${stampaId}/${Date.now()}-${pulito}`;
}

export async function caricaFile(percorso, file) {
  const { error } = await supabase.storage.from(BUCKET_STAMPE).upload(percorso, file, { upsert: true });
  if (error) throw new Error(error.message);
  return percorso;
}

export function urlPubblico(percorso) {
  if (!percorso) return null;
  return supabase.storage.from(BUCKET_STAMPE).getPublicUrl(percorso).data.publicUrl;
}
