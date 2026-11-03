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
