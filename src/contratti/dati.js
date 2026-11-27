// IL CONTRATTO MASTER: leggere, salvare la bozza, firmare, riaprire.
//
// NON TOCCA LE TABELLE. Tutto passa da `contratto_master_vista`,
// `contratto_master_bozza`, `contratto_master_salva` e
// `contratto_master_riapri`, quattro funzioni `security definer`. Le
// regole che contano stanno dentro quelle: qui c'e' la comodita'.
//
// I FILE vanno in `master-documenti`, privato (31/10/2026), nella
// cartella `contratti/<id della master>/`. Il percorso non e' una
// convenzione di questo file: `contratto_master_salva` rifiuta un file
// che stia altrove o che contenga `..`.
//
// LA DOMANDA PRIMA DI CANCELLARE non vive qui: questo e' il magazzino
// dei dati, e la conferma sta sulla pagina che lo chiama — come in
// `eventi/dati.js` e `consensi/dati.ts`.
import { supabase } from "../supabase.js";

export const SECCHIO = "master-documenti";

export const cartellaDi = (masterId) => `contratti/${masterId}/`;

export async function leggiContratto(masterId) {
  const { data, error } = await supabase.rpc("contratto_master_vista", { p_master_id: masterId });
  if (error) return { dati: null, errore: error.message };
  return { dati: data || null, errore: "" };
}

/**
 * Carica un file nella cartella del contratto e torna il percorso.
 *
 * Il nome porta l'istante: due fronti caricati di seguito non si
 * sovrascrivono, e `upsert: false` fa in modo che un nome che per caso
 * esistesse non venga coperto in silenzio.
 */
export async function caricaFile(masterId, file, nome) {
  if (!file) return { percorso: null, errore: "" };
  const est = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const percorso = `${cartellaDi(masterId)}${nome}-${Date.now()}.${est}`;
  const { error } = await supabase.storage.from(SECCHIO)
    .upload(percorso, file, { upsert: false, contentType: file.type || undefined });
  if (error) return { percorso: null, errore: `Non riesco a caricare ${nome}: ${error.message}` };
  return { percorso, errore: "" };
}

export async function salvaBozza(masterId, dati) {
  const { data, error } = await supabase.rpc("contratto_master_bozza", {
    p_master_id: masterId, p_dati: dati,
  });
  if (error) return { ok: false, errore: error.message };
  return { ok: !!data?.ok, errore: data?.ok ? "" : (data?.errore || "Non è stato possibile salvare."), motivo: data?.motivo };
}

/**
 * CHI HA APERTO, E QUANTO CI E' STATO (27/11/2026).
 *
 * Tre eventi: `pagina` (ha aperto la pagina della firma), `contratto` e
 * `manifesto` (ha aperto E RICHIUSO quel documento, con i secondi per
 * cui l'ha tenuto aperto). Le regole stanno dentro
 * `contratto_master_segna_lettura`: non si scrive su un contratto
 * firmato, non si scrive per chi e' escluso, non si scrive a firma
 * chiusa, e i secondi hanno un tetto.
 *
 * NON FA RUMORE SE FALLISCE, e questa e' la decisione: e' una traccia
 * per chi amministra, non un passo della firma. Un errore qui non deve
 * comparire davanti a chi sta leggendo un contratto da sottoscrivere —
 * chi legge non ha niente da correggere e non capirebbe cosa fare.
 */
export async function segnaLettura(masterId, evento, secondi = 0) {
  if (!masterId || !evento) return { ok: false, errore: "Manca la master o l'evento." };
  const { data, error } = await supabase.rpc("contratto_master_segna_lettura", {
    p_master_id: masterId, p_evento: evento, p_secondi: Math.max(0, Math.round(secondi) || 0),
  });
  if (error) return { ok: false, errore: error.message };
  return { ok: !!data?.ok, motivo: data?.motivo, errore: data?.ok ? "" : (data?.errore || "") };
}

export async function firmaContratto({ masterId, dati, firma, docFronte, docRetro, spunte, testi }) {
  const { data, error } = await supabase.rpc("contratto_master_salva", {
    p_master_id: masterId,
    p_dati: dati,
    p_firma: firma,
    p_doc_fronte: docFronte,
    p_doc_retro: docRetro,
    p_spunte: spunte,
    // QUELLO CHE AVEVA DAVANTI, e serve a una cosa sola: far dire al
    // server se il testo che lei leggeva era lo stesso che sta nel
    // database (`uguale_a_quello_mostrato`). Il contratto che si archivia
    // lo compone il server dalle sue righe, non da qui.
    p_contratto: testi,
  });
  if (error) return { ok: false, errore: error.message };
  return { ok: !!data?.ok, id: data?.id, errore: data?.ok ? "" : (data?.errore || "Non è stato possibile registrare la firma."), motivo: data?.motivo };
}

export async function riapriContratto(id, chi, perche) {
  const { data, error } = await supabase.rpc("contratto_master_riapri", {
    p_id: id, p_chi: chi || null, p_perche: perche || null,
  });
  if (error) return { ok: false, errore: error.message };
  return { ok: !!data?.ok, errore: data?.ok ? "" : (data?.errore || "Non è stato possibile riaprire il contratto.") };
}

/** L'elenco per «Contratti master»: una riga per master, con il suo stato. */
export async function leggiTuttiIContratti() {
  const [m, c] = await Promise.all([
    supabase.from("master").select("id, nome, email, contratto_escluso, contratto_escluso_motivo, partita_iva, codice_fiscale").order("nome"),
    supabase.from("master_contratti").select("*"),
  ]);
  if (m.error) return { righe: [], errore: m.error.message };
  if (c.error) return { righe: [], errore: c.error.message };
  const perMaster = new Map();
  for (const r of c.data || []) {
    const gia = perMaster.get(r.master_id);
    // il firmato vince sulla bozza: e' quello che si vuole vedere
    if (!gia || (r.stato === "firmato" && gia.stato !== "firmato")) perMaster.set(r.master_id, r);
  }
  return {
    righe: (m.data || []).map((master) => ({ master, contratto: perMaster.get(master.id) || null })),
    errore: "",
  };
}

/**
 * Chi resta fuori, e perche'. E' un dato sulla riga della master, non un
 * nome scritto nel codice: si cambia da qui, senza pubblicare niente.
 */
export async function cambiaEsclusione(masterId, escluso, motivo) {
  const { data, error } = await supabase
    .from("master")
    .update({ contratto_escluso: !!escluso, contratto_escluso_motivo: escluso ? (motivo || null) : null })
    .eq("id", masterId)
    .select("id");
  if (error) return error.message;
  if (!data?.length) return "Il database non ha cambiato nessuna riga: ricarica la pagina e riprova.";
  return "";
}

// ---------------------------------------------------------------------------
// L'INTERRUTTORE DELLA FIRMA (16/11/2026, sera).
//
// «Blocca per il momento l'accesso alle master alla firma del
// contratto». Una porta chiusa per tutti, che si riapre da «Contratti
// master» senza pubblicare niente.
//
// NON è `master.contratto_escluso` accesa su tutte: quella colonna vuol
// dire «questa persona, per un motivo suo, non firma questa versione» —
// riempirla di diciannove righe identiche farebbe perdere la sola che
// aveva un significato.
//
// La serratura NON è qui: `contratto_master_salva` e
// `contratto_master_bozza` leggono la stessa riga e rifiutano con
// `motivo: 'chiusa'`. Questo è il modo di guardarla e di muoverla.
export const CHIAVE_FIRMA_APERTA = "contratti_master_firma_aperta";

export async function leggiApertura() {
  const { data, error } = await supabase
    .from("impostazioni_layout_tabelle")
    .select("valore, aggiornato_il")
    .eq("chiave", CHIAVE_FIRMA_APERTA)
    .maybeSingle();
  // ASSENZA = CHIUSA, e un errore pure: una porta che si apre perché
  // un'impostazione non è stata trovata è una porta che non è mai stata
  // chiusa. È la stessa regola che fa rispettare il database.
  if (error) return { aperta: false, errore: error.message, cambiato: null };
  return {
    aperta: data?.valore?.aperta === true,
    cambiato: data?.valore ? { da: data.valore.cambiato_da, il: data.valore.cambiato_il || data.aggiornato_il } : null,
    errore: "",
  };
}

export async function cambiaApertura(aperta, chi) {
  const valore = {
    aperta: !!aperta,
    cambiato_il: new Date().toISOString(),
    cambiato_da: chi || null,
  };
  const { data, error } = await supabase
    .from("impostazioni_layout_tabelle")
    .upsert({ chiave: CHIAVE_FIRMA_APERTA, valore, aggiornato_il: valore.cambiato_il }, { onConflict: "chiave" })
    .select("chiave");
  if (error) return error.message;
  // un upsert senza select dice «va bene» anche a zero righe, e qui zero
  // righe vorrebbe dire una porta che si crede aperta e non lo è
  if (!data?.length) return "Il database non ha cambiato nessuna riga: ricarica la pagina e riprova.";
  return "";
}
