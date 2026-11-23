// Le letture e le scritture dei certificati, senza niente che si disegni.
// Il PDF si compone nel browser (come tutti i PDF dell'app): qui si
// prende il modello, si salva il certificato fatto e si rilegge l'elenco.
import { supabase } from "../supabase.js";
import { generaPdfCertificato42, nomeFileCertificato } from "./certificato-42-ore.js";

export const SECCHIO_CERTIFICATI = "certificati";
// Il modello vuoto con le firme sta nello stesso secchio privato: un
// foglio firmato e vuoto, scaricabile da chiunque conosca l'indirizzo,
// sarebbe un certificato che chiunque puo' riempire.
export const MODELLO_42_ORE = "_modelli/certificato-42-ore.pdf";

// null = il modello non c'e' ancora (va caricato una volta)
export async function leggiModello42() {
  const { data, error } = await supabase.storage.from(SECCHIO_CERTIFICATI).download(MODELLO_42_ORE);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function caricaModello42(file) {
  if (!file) throw new Error("Nessun file scelto.");
  const testa = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  // si guarda l'inizio del file, non il nome: un'immagine chiamata .pdf
  // farebbe fallire ogni certificato dopo
  if (String.fromCharCode(...testa) !== "%PDF-") throw new Error("Il file scelto non è un PDF.");
  const { error } = await supabase.storage.from(SECCHIO_CERTIFICATI).upload(MODELLO_42_ORE, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error("Non riesco a caricare il modello: " + error.message);
}

export async function leggiCertificati() {
  const { data, error } = await supabase.from("certificati_generati").select("*").order("creato_il", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return data || [];
}

// Genera, archivia e registra. Il file per primo, poi la riga: se la riga
// non si scrive il file si toglie, invece di restare orfano in un secchio
// dove nessuno lo ritrova.
export async function generaECertifica42(modello, dati, chi) {
  const bytes = await generaPdfCertificato42(modello, dati);
  const percorso = `42-ore/${new Date().toISOString().slice(0, 10)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error } = await supabase.storage.from(SECCHIO_CERTIFICATI).upload(percorso, new Blob([bytes], { type: "application/pdf" }), { upsert: false, contentType: "application/pdf" });
  if (error) throw new Error("Il certificato è pronto ma non riesco ad archiviarlo: " + error.message);
  const vuotoNull = (v) => (String(v || "").trim() ? String(v).trim() : null);
  const riga = {
    tipo: "pmu_42_ore",
    nome: String(dati.nome || "").trim(),
    cognome: String(dati.cognome || "").trim(),
    luogo_nascita: vuotoNull(dati.luogo_nascita),
    data_nascita: vuotoNull(dati.data_nascita),
    indirizzo: vuotoNull(dati.indirizzo),
    comune: vuotoNull(dati.comune),
    provincia: vuotoNull(String(dati.provincia || "").toUpperCase()),
    corso_dal: vuotoNull(dati.corso_dal),
    corso_al: vuotoNull(dati.corso_al),
    luogo_rilascio: vuotoNull(dati.luogo_rilascio),
    data_rilascio: vuotoNull(dati.data_rilascio),
    iscritto_id: dati.iscritto_id || null,
    percorso,
    creato_da: chi || null,
  };
  const { data, error: erroreRiga } = await supabase.from("certificati_generati").insert(riga).select().single();
  if (erroreRiga) {
    await supabase.storage.from(SECCHIO_CERTIFICATI).remove([percorso]);
    throw new Error("Il certificato non è stato registrato: " + erroreRiga.message);
  }
  return { riga: data, bytes, nomeFile: nomeFileCertificato(dati) };
}

export async function scaricaCertificato(riga) {
  const { data, error } = await supabase.storage.from(SECCHIO_CERTIFICATI).download(riga.percorso);
  if (error || !data) throw new Error("Non riesco ad aprire il certificato: " + (error?.message || "file non trovato"));
  salvaFile(data, nomeFileCertificato(riga));
}

export function salvaFile(blobOBytes, nome) {
  const blob = blobOBytes instanceof Blob ? blobOBytes : new Blob([blobOBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Prendere i dati da un'iscrizione: chi ha fatto il corso e' quasi
// sempre gia' in archivio, e ricopiare nome, nascita e residenza a mano
// e' il modo di sbagliarne uno.
export async function cercaIscritti(testo) {
  const parole = String(testo || "").trim().split(/\s+/).filter((p) => p.length >= 2).slice(0, 3);
  if (parole.length === 0) return [];
  let q = supabase.from("iscritti").select("id, nome, cognome, data_nascita, comune_nascita, stato_nascita, indirizzo_residenza, civico_residenza, citta_residenza, prov_residenza, corso_data_id").limit(12);
  for (const p of parole) {
    const pulita = p.replace(/[%_,()]/g, "");
    q = q.or(`nome.ilike.%${pulita}%,cognome.ilike.%${pulita}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const righe = data || [];
  const idClassi = [...new Set(righe.map((r) => r.corso_data_id).filter(Boolean))];
  let classi = {};
  if (idClassi.length) {
    const { data: cd } = await supabase.from("corsi_date").select("id, data_inizio, data_fine").in("id", idClassi);
    classi = Object.fromEntries((cd || []).map((c) => [c.id, c]));
  }
  return righe.map((r) => ({ ...r, classe: classi[r.corso_data_id] || null }));
}

// Da una riga di iscritti alle voci del certificato. Riempie solo quello
// che l'iscrizione sa: il resto resta com'era.
export function datiDaIscritto(r, attuali) {
  const via = [r.indirizzo_residenza, r.civico_residenza].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const nascita = [r.comune_nascita, r.stato_nascita && !/^ital/i.test(r.stato_nascita) ? r.stato_nascita : ""].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  const scegli = (nuovo, vecchio) => (String(nuovo || "").trim() ? String(nuovo).trim() : vecchio);
  return {
    ...attuali,
    iscritto_id: r.id,
    nome: scegli(titolo(r.nome), attuali.nome),
    cognome: scegli(titolo(r.cognome), attuali.cognome),
    luogo_nascita: scegli(titolo(nascita), attuali.luogo_nascita),
    data_nascita: scegli(r.data_nascita, attuali.data_nascita),
    indirizzo: scegli(titolo(via), attuali.indirizzo),
    comune: scegli(titolo(r.citta_residenza), attuali.comune),
    provincia: scegli(String(r.prov_residenza || "").toUpperCase().slice(0, 2), attuali.provincia),
    corso_dal: scegli(r.classe?.data_inizio, attuali.corso_dal),
    corso_al: scegli(r.classe?.data_fine, attuali.corso_al),
  };
}

// MARIA ROSSI -> Maria Rossi: sul certificato i nomi si leggono come si
// scrivono, non come li ha battuti chi ha compilato il modulo
function titolo(t) {
  return String(t || "").toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}
