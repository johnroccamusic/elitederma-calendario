// I MODELLI DELLE MAIL, letti e scritti dalla tabella `email_modelli`.
//
// Qui dentro non si compone niente: la composizione vera (quali valori
// entrano nei segnaposti, com'e' fatto l'HTML) resta accanto ai dati che
// la alimentano, in App.jsx. Questo modulo tiene le due cose che servono
// a tutti e due i lati — chi scrive il testo nel modale e chi lo spedisce
// dalla scheda iscritto: l'elenco dei segnaposti e la sostituzione.
import { supabase } from "../supabase.js";
// una sola implementazione, condivisa col lavoro notturno in Deno
export { applicaSegnaposti, modelloUsabile } from "../../supabase/functions/_shared/email.js";

// L'elenco dei modelli. La `chiave` non cambia mai: e' lei a legare la
// riga nel database al punto del codice che la usa. Il titolo si puo'
// riscrivere quando si vuole.
export const MODELLI = [
  {
    chiave: "conferma_iscrizione",
    titolo: "Conferma iscrizione",
    aChi: "All'allieva, dal pulsante «Invia mail di conferma» nella sua scheda.",
  },
  {
    chiave: "dettagli_organizzativi",
    titolo: "Dettagli organizzativi prima del corso",
    aChi: "Alle iscritte della classe, da sole, nei giorni prima dell'inizio. Parte solo se la regola è accesa in «Invii automatici» e questo testo non è vuoto.",
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

// ---------------------------------------------------------------- regole

// Due forme per evento, perche' in italiano "prima" e "dopo" vogliono la
// preposizione articolata e attaccarla a mano produce "prima l'inizio del
// corso" — che infatti e' quello che si leggeva.
export const EVENTI = {
  inizio_corso: { nome: "l'inizio del corso", di: "dell'inizio del corso" },
  fine_corso: { nome: "la fine del corso", di: "della fine del corso" },
};

// "3 giorni prima dell'inizio del corso", detto come si direbbe a voce.
// Lo scarto e' negativo quando si manda PRIMA, e la frase lo nasconde: chi
// regola i giorni non deve pensare in numeri col segno.
export function frasePeriodo(evento, scartoGiorni) {
  const e = EVENTI[evento] || { nome: evento, di: evento };
  const n = Math.abs(scartoGiorni);
  if (!n) return `il giorno ${e.di}`;
  // "prima DELLA fine", ma "dopo LA fine": le due preposizioni non reggono
  // lo stesso caso, e usarne una sola fa dire "dopo della fine del corso"
  const giorni = n === 1 ? "1 giorno" : `${n} giorni`;
  return scartoGiorni < 0 ? `${giorni} prima ${e.di}` : `${giorni} dopo ${e.nome}`;
}

export async function leggiRegole() {
  const { data, error } = await supabase
    .from("email_regole").select("*").order("creata_il");
  if (error) return { regole: [], errore: error.message };
  return { regole: data || [], errore: null };
}

export async function salvaRegola(id, patch) {
  // `.select` e non solo update: PostgREST dice "va bene" anche quando non
  // ha cambiato niente, e una regola che non si accende davvero e' il
  // genere di bugia che non si scopre finche' non manca una mail
  const { data, error } = await supabase
    .from("email_regole").update(patch).eq("id", id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Nessuna riga aggiornata: controlla i permessi sulla tabella.";
  return null;
}

// La prova a vuoto: la funzione guarda chi riceverebbe oggi e lo dice,
// senza mandare niente e senza scrivere nel registro.
export async function provaInviiAutomatici() {
  const { data, error } = await supabase.functions.invoke("email-programmate", {
    body: { prova: true },
  });
  if (error) return { esito: null, errore: error.message };
  if (data?.errore) return { esito: null, errore: data.errore };
  return { esito: data, errore: null };
}
