// LE SCELTE SUL MODULO: cosa ci va, e cosa arriva gia' scritto.
//
// L'elenco dei campi non sta qui: sta in contenuto.js, trascritto dal
// modulo del sito. Qui ci sono solo le spunte, che le tocca chi lavora e
// non chi programma. La `chiave` lega le due cose.
import { supabase } from "../supabase.js";

// Come si legge una provenienza: "iscritti.tutor" diventa "dalla scheda
// — Tutor". Serve a chi guarda la pagina, che non deve sapere come si
// chiamano le colonne.
export const NOMI_ORIGINE = {
  "iscritti.tutor": "Tutor della scheda",
  "iscritti.nome": "Nome",
  "iscritti.cognome": "Cognome",
  "iscritti.telefono": "Telefono",
  "iscritti.email": "Email",
  "iscritti.indirizzo_residenza": "Indirizzo di residenza",
  "iscritti.cap_residenza": "CAP",
  "iscritti.citta_residenza": "Città di residenza",
  "iscritti.taglia_divisa": "Taglia divisa",
  "iscritti.richiede_modelle": "Richiede modelle",
  "iscritti.acconto_pagato_il": "Data di pagamento dell'acconto",
  "iscritti.acconto_metodo": "Metodo dell'acconto",
  "iscritti.acconto_totale": "Importo dell'acconto",
  "iscritti.saldo_metodo": "Metodo del saldo",
  "corsi.nome": "Nome del corso",
  "corsi_date.data_inizio": "Data d'inizio del corso",
  "corsi_date.citta": "Città del corso",
};

// Da dove PUO' arrivare ogni campo. Serve a riaccendere la spunta dopo
// che qualcuno l'ha spenta: senza, una volta tolta la precompilazione
// non si saprebbe piu' da quale colonna ripescarla. I sei campi che non
// compaiono qui sono quelli che il venditore non ha — documento, codice
// fiscale, e la scelta modelle della tricopigmentazione.
export const ORIGINE_PROPOSTA = {
  tutor: "iscritti.tutor",
  nome: "iscritti.nome",
  cognome: "iscritti.cognome",
  telefono: "iscritti.telefono",
  indirizzo: "iscritti.indirizzo_residenza",
  cap: "iscritti.cap_residenza",
  citta: "iscritti.citta_residenza",
  email: "iscritti.email",
  corso: "corsi.nome",
  data_inizio: "corsi_date.data_inizio",
  localita: "corsi_date.citta",
  modelle: "iscritti.richiede_modelle",
  data_pagamento: "iscritti.acconto_pagato_il",
  saldo_con_contanti: "iscritti.saldo_metodo",
  saldo_senza_contanti: "iscritti.saldo_metodo",
  acconto_mezzo: "iscritti.acconto_metodo",
  acconto_euro: "iscritti.acconto_totale",
  taglia: "iscritti.taglia_divisa",
};

export function etichettaOrigine(chiave) {
  if (!chiave) return null;
  return NOMI_ORIGINE[chiave] || chiave;
}

export async function leggiScelte() {
  const { data, error } = await supabase
    .from("modulo_iscrizione_campi").select("*");
  if (error) return { scelte: {}, errore: error.message };
  const per = {};
  for (const r of data || []) per[r.chiave] = r;
  return { scelte: per, errore: null };
}

// Una spunta alla volta: e' un valore solo, si salva uscendo dal dito
// come tutto il resto dell'app. `.select` perche' PostgREST dice "va
// bene" anche quando non ha cambiato niente.
export async function salvaScelta(chiave, patch, chi) {
  const { data, error } = await supabase
    .from("modulo_iscrizione_campi")
    .upsert(
      { chiave, ...patch, aggiornato_il: new Date().toISOString(), aggiornato_da: chi || null },
      { onConflict: "chiave" },
    )
    .select("chiave");
  if (error) return error.message;
  if (!data?.length) return "Nessuna riga aggiornata: controlla i permessi.";
  return null;
}
