// I REGISTRI DELL'ASSISTENTE, e quando una domanda conta come «regola che
// manca».
//
// Sta qui, e non dentro la edge function, per due motivi: la decisione
// riempie l'elenco in fondo a Regolamenti — quello da cui il titolare
// capisce quali regole deve ancora scrivere — e una regola che decide
// cosa compare in un elenco va provata, non ricordata. Un file .ts di
// Deno il banco di prova non lo sa leggere; questo si'.

export const REGISTRI = ["regole", "ragionamento", "misto", "conversazione", "dati", "guida"];

/**
 * Il registro di una risposta: quello dichiarato dal modello se e' uno di
 * quelli previsti, altrimenti si deduce — se ha citato una scheda ha
 * risposto dalle regole, se non ha citato niente ha ragionato.
 *
 * @param {unknown} dichiarato
 * @param {number} quanteSchedeCitate
 * @returns {string}
 */
export function registroDa(dichiarato, quanteSchedeCitate = 0) {
  if (REGISTRI.includes(String(dichiarato))) return String(dichiarato);
  return quanteSchedeCitate > 0 ? "regole" : "ragionamento";
}

/**
 * «Questa domanda chiedeva una regola, e la regola non c'e'»: e' l'unico
 * caso che deve finire fra le domande senza risposta.
 *
 * Quattro cose NON sono una regola che manca, e tenerle fuori e' il punto
 * di questa funzione — un elenco che si riempie di roba che non c'entra
 * nessuno lo guarda piu':
 *  - una chiacchiera («grazie», «cosa intendi?»);
 *  - una spiegazione di come funziona l'app: la guida c'e', la risposta
 *    e' arrivata;
 *  - un dato («che corso c'e' a Bari»): il database ha risposto, non
 *    serve scrivere una scheda;
 *  - una disposizione che sta diventando una scheda adesso.
 * E una risposta che CITA una scheda non puo' essere una regola mancante,
 * qualunque cosa dica il modello di se stesso.
 *
 * @param {{ registro: string, dichiarato?: unknown, quanteSchedeCitate?: number, proposta?: unknown }} esito
 * @returns {boolean}
 */
export function senzaRisposta({ registro, dichiarato = false, quanteSchedeCitate = 0, proposta = null } = {}) {
  if (proposta) return false;
  if (registro === "conversazione" || registro === "guida" || registro === "dati") return false;
  if (registro === "ragionamento") return true;
  return !!dichiarato && quanteSchedeCitate === 0;
}

// ZERO RIGHE NON E' UNA RISPOSTA (3/11/2026).
//
// E' la regola nata dal guasto del 3/11: il modello aveva scritto la
// query giusta sul costo dei kit, una vista perdeva il collegamento al
// corso, il database ha risposto zero righe e lui ha detto «per PMU Base
// non ho trovato nessun kit». Una query che FALLISCE torna con l'errore e
// si corregge; una query che torna VUOTA sembra una risposta, e invece
// quasi sempre e' un filtro troppo stretto o un nome scritto in un altro
// modo.
//
// L'avviso lo mette il codice e non il prompt, perche' e' la differenza
// fra un assistente che indaga e uno che si arrende: una regola che il
// modello deve ricordare non e' una regola.
export const AVVISO_ZERO_RIGHE = "NESSUNA RIGA. Non concludere che non esiste: quasi sempre il filtro e' troppo stretto o il nome e' scritto in un altro modo. Guarda cosa esiste (select distinct … limit 50, oppure ilike su un pezzo di parola) e riprova.";

/**
 * Cosa torna al modello dopo un'interrogazione ai dati.
 *
 * @param {unknown[]} righe
 * @param {number} [maxRighe] quante righe passargli davvero (il resto e'
 *   contesto buttato: se ne servono piu' di cosi' la domanda era un
 *   elenco, e l'elenco lo si fa contare al database)
 * @returns {string}
 */
export function esitoInterrogazione(righe = [], maxRighe = 60) {
  const lista = Array.isArray(righe) ? righe : [];
  const avviso = lista.length === 0 ? AVVISO_ZERO_RIGHE + "\n\n" : "";
  return `${avviso}Righe: ${lista.length}\n${JSON.stringify(lista.slice(0, maxRighe))}`;
}

/**
 * Il registro di una risposta, quando l'assistente puo' anche interrogare
 * i dati: se ha interrogato, ha risposto dai dati — lo dice quello che ha
 * FATTO, non quello che dichiara di aver fatto. Resta «misto» se ha unito
 * i dati a una regola scritta, perche' quella e' una cosa diversa e chi
 * legge deve vederla.
 *
 * @param {{ interrogazioni?: number, dichiarato?: unknown, quanteSchedeCitate?: number }} esito
 * @returns {string}
 */
export function registroFinale({ interrogazioni = 0, dichiarato = null, quanteSchedeCitate = 0 } = {}) {
  if (interrogazioni > 0) return String(dichiarato) === "misto" ? "misto" : "dati";
  return registroDa(dichiarato, quanteSchedeCitate);
}
