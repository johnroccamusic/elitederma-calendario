// I MODELLI DELLE MAIL, letti e scritti dalla tabella `email_modelli`.
//
// Qui dentro non si compone niente: la composizione vera (quali valori
// entrano nei segnaposti, com'e' fatto l'HTML) resta accanto ai dati che
// la alimentano, in App.jsx. Questo modulo tiene le due cose che servono
// a tutti e due i lati — chi scrive il testo nel modale e chi lo spedisce
// dalla scheda iscritto: l'elenco dei segnaposti e la sostituzione.
import { supabase } from "../supabase.js";

// L'elenco dei modelli. La `chiave` non cambia mai: e' lei a legare la
// riga nel database al punto del codice che la usa. Il titolo si puo'
// riscrivere quando si vuole.
export const MODELLI = [
  {
    chiave: "conferma_iscrizione",
    titolo: "Conferma iscrizione",
    aChi: "All'allieva, dal pulsante «Invia mail di conferma» nella sua scheda.",
  },
];

// I segnaposti, con la spiegazione che si legge nel modale. Non e' un
// dettaglio: chi scrive il testo non ha nessun altro modo di sapere che
// {date} e' "12–13 novembre 2026" e non "12/11/2026".
export const SEGNAPOSTI = [
  { chiave: "nome", spiega: "il nome dell'allieva, come Chiara" },
  { chiave: "corso", spiega: "il nome del corso" },
  { chiave: "date", spiega: "le date per esteso, come 12–13 novembre 2026" },
  { chiave: "citta", spiega: "la città del corso" },
  { chiave: "sede", spiega: "il nome della sede, se c'è" },
  { chiave: "indirizzo", spiega: "l'indirizzo della sede" },
  { chiave: "dettagli", spiega: "corso, date, città, sede e indirizzo tutti insieme, incolonnati" },
];

// Sostituisce {chiave} con il valore. Un segnaposto che non esiste resta
// scritto com'e': meglio una graffa che si vede nell'anteprima che un
// buco silenzioso dentro una mail gia' partita.
//
// Il giro e' uno solo, su tutte le graffe insieme: sostituendo un
// segnaposto alla volta, un valore che contenesse a sua volta una graffa
// — il nome di un corso scritto male, per dire — verrebbe risostituito.
export function applicaSegnaposti(testo, valori) {
  return String(testo || "").replace(/\{(\w+)\}/g, (intero, chiave) =>
    Object.prototype.hasOwnProperty.call(valori || {}, chiave) ? String(valori[chiave] ?? "") : intero,
  );
}

// La riga del modello, o null se non c'e'. `maybeSingle` e non `single`:
// la prima volta la riga non esiste e `single` restituirebbe un errore
// invece di un vuoto.
export async function leggiModello(chiave) {
  const { data, error } = await supabase
    .from("email_modelli").select("*").eq("chiave", chiave).maybeSingle();
  if (error) return { modello: null, errore: error.message };
  return { modello: data || null, errore: null };
}

export async function salvaModello({ chiave, oggetto, testo, chi }) {
  const { error } = await supabase.from("email_modelli").upsert(
    {
      chiave,
      oggetto: (oggetto || "").trim() || null,
      testo: (testo || "").trim() || null,
      aggiornato_il: new Date().toISOString(),
      aggiornato_da: chi || null,
    },
    { onConflict: "chiave" },
  );
  return error ? error.message : null;
}

// Un modello "vuoto" (riga assente, o oggetto e testo cancellati) non e'
// un modello: chi compone deve ripiegare sul testo scritto nel codice.
// Senza questo controllo, svuotare il campo manderebbe mail senza corpo.
export function modelloUsabile(modello) {
  return !!(modello && String(modello.testo || "").trim() && String(modello.oggetto || "").trim());
}
