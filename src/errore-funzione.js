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
export async function testoErroreFunzione(error) {
  try {
    const corpo = await error?.context?.json?.();
    if (corpo?.errore) return corpo.errore;
  } catch { /* la risposta poteva non essere JSON */ }
  return error?.message || "Non riuscito.";
}

// Il codice di stato della risposta, quando c'e'. Serve a distinguere
// «non ha risposto nessuno» da «ha risposto di no».
export function statoErroreFunzione(error) {
  const s = error?.context?.status;
  return typeof s === "number" ? s : null;
}
