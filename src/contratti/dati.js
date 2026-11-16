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
