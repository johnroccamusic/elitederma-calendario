// LA DOMANDA PRIMA DI CANCELLARE, IN UN POSTO SOLO (11/11/2026).
//
// Il titolare: «ogni cancellazione nell'app che sia di prodotto o di
// iscritto o eliminazione da una lista di iscritti o di prodotti deve
// essere preceduta dall'avviso di "sei sicuro di voler cancellare?"».
// E, davanti alla sezione della fiera: «le iscritte della fiera non puoi
// poterne cancellare cosi' cliccando "non iscritta" e sparisce».
//
// Misurato prima di scrivere: dei 124 gesti che toglievano qualcosa, 62
// non chiedevano niente. Il tasto c'era, si premeva, la riga spariva.
//
// PERCHE' STA QUI E NON RISCRITTA A MANO 62 VOLTE. La frase e' una
// promessa all'utente, e sessantadue copie sarebbero sessantadue
// promesse che un giorno si scostano: una dice «Sei sicuro?», un'altra
// «Confermi?», e la terza non dice niente perche' chi l'ha aggiunta non
// sapeva che le altre esistessero. Qui la domanda e' una, e chi chiama
// dice soltanto COSA sta per sparire.
//
// E CHI CHIAMA DEVE DIRE COSA. Non «Sei sicuro?» da solo: davanti a un
// elenco di venti righe, «sei sicuro» non dice QUALE riga si e' premuta,
// e la conferma diventa un tasto da premere a occhi chiusi — cioe' una
// conferma che non protegge niente. `cosa` nomina la riga («l'iscrizione
// di Maria Rossi», «il prodotto "Ago 1RL"»), e `conseguenza` dice quello
// che non si potra' disfare, dove c'e' qualcosa da dire.

/**
 * La domanda da fare prima di togliere qualcosa. `true` = procedi.
 *
 * @param {string} cosa quello che sparisce, nominato: «l'iscrizione di
 *   Maria Rossi», «il prodotto "Ago 1RL"», «questa riga dal kit».
 * @param {string} [conseguenza] cosa comporta, se c'e' qualcosa che non
 *   si disfa: «Il file non sara' piu' recuperabile.»
 * @returns {boolean}
 */
export function confermaCancellazione(cosa, conseguenza = "") {
  const oggetto = String(cosa || "").trim();
  const domanda = oggetto
    ? `Sei sicuro di voler cancellare ${oggetto}?`
    : "Sei sicuro di voler cancellare?";
  const coda = String(conseguenza || "").trim();
  return window.confirm(coda ? `${domanda}\n\n${coda}` : domanda);
}

/**
 * La variante per quello che NON si cancella ma si stacca: un'iscrizione
 * che esce dall'elenco della fiera, una modella che torna «da trovare»,
 * un'attribuzione che si toglie. Il dato resta, e dirle «cancellare»
 * sarebbe una bugia nel verso peggiore — chi legge crede di distruggere
 * una scheda e non preme piu'. Ma la riga SPARISCE dall'elenco che si ha
 * davanti, e questo va chiesto: e' il caso della fiera.
 *
 * @param {string} cosa cosa si toglie: «Maria Rossi dalle iscrizioni di
 *   questa fiera».
 * @param {string} [conseguenza] dove va a finire, se vale la pena dirlo.
 * @returns {boolean}
 */
export function confermaRimozione(cosa, conseguenza = "") {
  const oggetto = String(cosa || "").trim();
  const domanda = oggetto ? `Sei sicuro di voler togliere ${oggetto}?` : "Sei sicuro di voler togliere?";
  const coda = String(conseguenza || "").trim();
  return window.confirm(coda ? `${domanda}\n\n${coda}` : domanda);
}

/**
 * LA TERZA, PER QUELLO CHE SI METTE DA PARTE (28/11/2026). Archiviare
 * una persona non e' cancellarla — i suoi dati, le sue iscrizioni e i
 * suoi compensi restano tutti — e non e' nemmeno «toglierla» da un
 * elenco: e' una porta che si chiude, perche' la sua password smette di
 * aprire l'app. Quindi la domanda e' sua, e dice quella conseguenza.
 *
 * E' un `prompt` e non un `confirm` perche' fa due cose in un gesto: la
 * conferma e il MOTIVO, che fra sei mesi e' l'unica cosa che distingue
 * «ha smesso» da «archiviata per sbaglio». Il motivo e' facoltativo —
 * si batte Invio e si archivia — perche' il senso del tasto e' pulire
 * una lista in fretta; obbligarlo vorrebbe dire una frase inventata
 * ogni volta, che e' peggio di nessuna frase.
 *
 * @param {string} cosa chi si archivia, nominato: «il venditore MARIO».
 * @param {string} [conseguenza] cosa comporta.
 * @returns {string|null} il motivo (anche vuoto) o `null` se annullato.
 */
export function chiediMotivoArchiviazione(cosa, conseguenza = "") {
  const oggetto = String(cosa || "").trim();
  const testa = oggetto ? `Metti in archivio ${oggetto}.` : "Metti in archivio.";
  const coda = String(conseguenza || "").trim();
  return window.prompt(
    `${testa}${coda ? `\n\n${coda}` : ""}\n\nScrivi il motivo (facoltativo) e premi OK. Annulla per lasciare tutto com'è.`,
    "",
  );
}
