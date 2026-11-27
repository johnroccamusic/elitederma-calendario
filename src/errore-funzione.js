// IL MOTIVO DI UN ERRORE DI EDGE FUNCTION, DETTO PER DAVVERO.
//
// `supabase.functions.invoke`, davanti a una risposta che non e' 2xx,
// torna `{ data: null, error }` con `error.message` = «Edge Function
// returned a non-2xx status code». Il motivo vero — quello che la
// funzione ha scritto in `{ ok: false, errore: "..." }` — sta nel corpo
// della risposta, che e' appeso a `error.context`, e `data` e' nullo:
// quindi un `data?.errore || error?.message` mostra sempre la frase
// inutile e non dice niente a chi sta davanti.
//
// E' costato una diagnosi l'8/11/2026: l'assistente rispondeva «non-2xx»
// e il motivo (il modello che aveva rifiutato, col suo codice) era
// scritto nel corpo e buttato via dal pannello. Un errore che non dice
// perche' manda a cercare il guasto nel posto sbagliato.
//
// Sta qui, fuori da App.jsx, perche' la usano sia il monolite sia i
// moduli (l'assistente, Chiedi ai dati, Regolamenti): due copie
// vorrebbero dire due messaggi diversi per la stessa risposta.
const NON_PUBBLICATA = "NOT_FOUND";

/**
 * IL CORPO SI LEGGE UNA VOLTA SOLA, e questo e' il punto da non
 * sbagliare: `Response.json()` consuma il flusso, quindi una seconda
 * lettura dello stesso errore torna vuota. Si legge sempre da una COPIA
 * (`clone()`), cosi' chiamare due volte queste funzioni sullo stesso
 * errore non fa sparire il motivo. Dove `clone` non c'e' (le finte del
 * banco di prova, e i vecchi ambienti) si legge l'originale.
 */
async function corpoDi(error) {
  const ctx = error?.context;
  if (!ctx) return null;
  try {
    const fonte = typeof ctx.clone === "function" ? ctx.clone() : ctx;
    return await fonte.json?.();
  } catch { return null; }
}

/**
 * TUTTO QUELLO CHE SI SA DI UN ERRORE, letto in un colpo: il motivo da
 * mostrare, se la funzione non esiste sul server, e il codice di stato.
 *
 * Una funzione sola perche' il corpo si legge una volta: due funzioni
 * che lo leggono a turno funzionano o no secondo l'ordine in cui le si
 * chiama, e un errore che dipende dall'ordine e' un errore che un giorno
 * tace.
 */
export async function dettaglioErroreFunzione(error) {
  const stato = statoErroreFunzione(error);
  const corpo = await corpoDi(error);
  // UNA FUNZIONE NON PUBBLICATA RISPONDE 404 CON `message`, NON CON
  // `errore` (27/11/2026). Provato sul progetto vero:
  // `{"code":"NOT_FOUND","message":"Requested function was not found"}`.
  // Senza questo si tornava alla frase inutile proprio nel caso in cui
  // il tasto non poteva riuscire per niente — ed e' quello che il
  // titolare ha letto premendo «Fai la copia» su un contratto firmato.
  const nonPubblicata = stato === 404 && corpo?.code === NON_PUBBLICATA;
  let testo;
  if (corpo?.errore) testo = String(corpo.errore);
  else if (nonPubblicata) testo = "questa funzione non è pubblicata sul server, quindi il tasto non può riuscire: non dipende da chi lo preme";
  else if (corpo?.message) testo = String(corpo.message);
  else testo = error?.message || "Non riuscito.";
  return { testo, nonPubblicata, stato };
}

/** Il solo motivo, per i punti che non hanno bisogno del resto. */
export async function testoErroreFunzione(error) {
  const { testo } = await dettaglioErroreFunzione(error);
  return testo;
}

/**
 * SE LA FUNZIONE NON ESISTE SUL SERVER, e non e' un dettaglio tecnico:
 * vuol dire che quel tasto non puo' riuscire, e chi lo preme crede di
 * aver sbagliato lui (la lezione del 25/11/2026, «un tasto che non puo'
 * riuscire e' peggio di un tasto che manca»).
 */
export async function funzioneNonPubblicata(error) {
  const { nonPubblicata } = await dettaglioErroreFunzione(error);
  return nonPubblicata;
}

// Il codice di stato della risposta, quando c'e'. Serve a distinguere
// «non ha risposto nessuno» da «ha risposto di no».
export function statoErroreFunzione(error) {
  const s = error?.context?.status;
  return typeof s === "number" ? s : null;
}
