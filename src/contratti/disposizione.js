// LE CASELLE DEL CONTRATTO MASTER, IN ORDINE.
//
// NON SONO DEFINIZIONI NUOVE: dove la chiave esiste già nell'anagrafica
// di un allievo — i due Stati, sesso, data e comune di nascita, il
// codice fiscale, la residenza a cascata, email e telefono — la
// definizione si PRENDE da `src/iscrizione/disposizione.js`, che è la
// stessa che compila il venditore e la stessa che compila l'allieva. Una
// seconda copia vorrebbe dire due caselle che si somigliano e si
// comportano diverso: il comune che di là si scegli e di qua si scrive,
// il codice fiscale che di là si calcola e di qua no.
//
// Si aggiungono solo le tre che in quell'area non esistono — nome e
// cognome in una casella sola, partita IVA, PEC — perché il contratto le
// vuole e un allievo no.
//
// L'ORDINE È QUELLO IN CUI SI COMPILA, e i due Stati stanno subito dopo
// il nome: è la lezione del 7/11/2026 sul modulo di iscrizione — una
// casella di luogo incontrata prima dello Stato si riempie col paese
// sbagliato, e il codice fiscale sotto viene calcolato come se la
// persona fosse italiana. Qui costerebbe uguale.
import { AREA_ALLIEVO } from "../iscrizione/disposizione.js";
import { CAMPI, PER_CHIAVE as PER_CHIAVE_CONTRATTO } from "../../supabase/functions/_shared/contratto-master.js";

// tutte le definizioni dell'area anagrafica, per chiave
const DALLA_SCHEDA = Object.fromEntries(
  AREA_ALLIEVO.righe.flatMap((r) => r.campi).map((c) => [c.chiave, c]),
);

// Le tre che la scheda di un allievo non ha. `nome_cognome` è UNA
// casella e non due: l'epigrafe del contratto dice «[Nome e cognome]»,
// e in anagrafica la master ha una colonna sola (`master.nome`).
// Spezzarla in due vorrebbe dire decidere noi dove finisce il nome di
// «MARIA T. NAPOLEONE».
const NUOVE = {
  nome_cognome: { chiave: "nome_cognome", etichetta: "Nome e cognome", larghezza: "1 1 100%", maiuscolo: true },
  partita_iva:  { chiave: "partita_iva",  etichetta: "Partita IVA",    larghezza: "1 1 180px", lunghezza: 13, suggerimento: "11 cifre" },
  pec:          { chiave: "pec",          etichetta: "PEC",            larghezza: "1 1 220px", suggerimento: "la tua posta certificata, se ce l'hai" },
};

const definizione = (chiave) => {
  const base = NUOVE[chiave] || DALLA_SCHEDA[chiave] || { chiave };
  // l'etichetta e l'obbligatorietà le decide `CAMPI`: è l'elenco che
  // legge anche il server e che compare nel «Manca ancora»
  const mio = PER_CHIAVE_CONTRATTO[chiave];
  return { ...base, etichetta: mio?.etichetta || base.etichetta || chiave };
};

export const RIGHE = [
  { campi: ["nome_cognome"] },
  { campi: ["stato_nascita", "stato_residenza"] },
  { campi: ["sesso", "data_nascita", "comune_nascita"] },
  { campi: ["codice_fiscale"] },
  { titolo: "Residenza", campi: [] },
  { campi: ["prov_residenza", "citta_residenza", "cap_residenza"] },
  { campi: ["indirizzo_residenza", "civico_residenza"] },
  { titolo: "Posizione fiscale e recapiti", campi: [] },
  { campi: ["partita_iva", "pec"] },
  { campi: ["email", "telefono"] },
].map((r) => ({ ...r, campi: r.campi.map(definizione) }));

export const OBBLIGATORI = new Set(CAMPI.filter((c) => c.obbligatorio).map((c) => c.chiave));
