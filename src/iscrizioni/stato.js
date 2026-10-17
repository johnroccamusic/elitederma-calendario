// LO STATO DELL'ISCRIZIONE, e l'unico posto che lo cambia.
//
// Quattro momenti:
//   dati_inseriti    la scheda c'e', il venditore ci sta ancora lavorando
//   modulo_inviato   il modulo e' partito davvero verso l'allieva
//   modulo_ricevuto  l'allieva ha compilato e firmato
//   confermato       c'e' anche l'acconto: l'iscrizione e' buona
//
// "DATI INSERITI" E' NATO IL 16/10/2026, e prima mancava: la colonna
// partiva da 'modulo_inviato', quindi ogni iscrizione nuova si
// presentava dicendo che il modulo era stato mandato. Non era vero —
// l'invio non esiste ancora — e comunque il venditore inserisce quello
// che sa e completa dopo i dati che mancano. In quel mentre la scheda
// c'e' ma non e' partito niente, e deve dirlo.
//
// PERCHE' UNA FUNZIONE SOLA. Al modulo ricevuto si arrivera' da due
// strade — il venditore che carica a mano il foglio firmato, e l'allievo
// che compila online dal link — e la regola per decidere lo stato e'
// la stessa. Scritta due volte, un giorno una delle due dimenticherebbe
// di guardare l'acconto, e l'iscrizione resterebbe in attesa per sempre
// senza che nessuno capisca perche'. Qui c'e' `decidiStato`, e basta
// quella: chi arriva da una strada o dall'altra la chiama e scrive.
import { supabase } from "../supabase.js";

export const STATI = {
  dati_inseriti: {
    chiave: "dati_inseriti",
    etichetta: "Dati inseriti",
    colore: "#8C8577",        // grigio caldo: e' il punto di partenza,
    sfondo: "#EFEBE3",        // non un allarme — si sta lavorando
    acceso: false,
  },
  modulo_inviato: {
    chiave: "modulo_inviato",
    etichetta: "Modulo inviato",
    colore: "#C07C14",        // ocra: in attesa dell'allievo, si deve vedere
    sfondo: "#FBF0DC",
    acceso: true,
  },
  modulo_ricevuto: {
    chiave: "modulo_ricevuto",
    etichetta: "Modulo ricevuto",
    colore: "#1565D8",        // blu: firmato, manca solo l'acconto
    sfondo: "#E3EEFC",
    acceso: true,
  },
  confermato: {
    chiave: "confermato",
    etichetta: "Confermato",
    colore: "#8A6A3B",        // taupe: a posto, non deve gridare
    sfondo: "#F2EADC",
    acceso: false,
  },
  // NON E' UN GRADINO DELLA SCALA: e' un'uscita.
  //
  // Gli altri quattro stati dicono a che punto e' arrivata
  // un'iscrizione; questo dice che non c'e' piu'. Per questo sta fuori
  // da ORDINE — nella fascia dei pallini non ha un posto — e per questo
  // `decidiStato` lo lascia stare qualunque cosa succeda dopo.
  //
  // Il rosso scuro non e' un allarme per chi guarda: e' il colore che si
  // riconosce a colpo d'occhio scorrendo un elenco, che e' l'unico
  // momento in cui questo stato conta davvero.
  recesso: {
    chiave: "recesso",
    etichetta: "Recesso",
    colore: "#B3261E",
    sfondo: "#FBE9E7",
    acceso: true,
  },
};

// I DUE COLORI DELLA FASCIA: fatto e da fare.
//
// Non uno per stato. Quello che conta scorrendo un elenco di dieci
// allievi non e' "a che punto e' questa", e' "che cosa manca": verde
// quello che c'e' gia', rosso quello che si aspetta ancora. Il pallino
// di adesso si riconosce dall'alone, non dal colore.
export const VERDE = "#2E7D32";
export const ROSSO = "#C0392B";

// l'ordine in cui si attraversano, per disegnare la fascia
export const ORDINE = ["dati_inseriti", "modulo_inviato", "modulo_ricevuto", "confermato"];

// Uno stato sconosciuto o mancante vale "dati_inseriti", il gradino che
// afferma meno: meglio dire che si sta lavorando che dichiarare partito
// un modulo che nessuno ha visto.
export function statoDi(iscritto) {
  const s = iscritto?.stato;
  return STATI[s] ? s : "dati_inseriti";
}

export function accontoRisultaPagato(iscritto) {
  return !!iscritto?.acconto_pagato;
}

// ---------------------------------------------------------------------
// LA REGOLA. Unica, e volutamente noiosa.
//
//   modulo NON ricevuto                 -> modulo_inviato
//   modulo ricevuto + acconto pagato    -> confermato
//   modulo ricevuto + acconto NON pagato-> modulo_ricevuto
//
// Quindi un acconto pagato PRIMA del modulo non fa scattare niente:
// l'iscrizione resta dov'e' e salta dritta a "confermato"
// quando il modulo arriva. E' il caso descritto dal punto 3, ed e'
// anche quello che succede piu' spesso.
//
// LO STORICO NON SI RICALCOLA. Le 254 iscrizioni nate prima di questo
// flusso sono "confermato" e non hanno nessun `modulo_ricevuto_il`:
// passarle da qui le declasserebbe a "modulo_inviato" per un modulo che
// nessuno gli ha mai chiesto. Per questo `decidiStato` si chiama solo
// sui passaggi — quando il modulo arriva, o quando l'acconto cambia —
// e mai su tutta la tabella.
export function decidiStato({ recesso, moduloInviato, moduloRicevuto, accontoPagato }) {
  // IL RECESSO VINCE SU TUTTO, e sta in cima apposta.
  //
  // Gli altri stati si DERIVANO da due fatti: modulo ricevuto e acconto
  // pagato. Un'iscrizione recessa li ha tutti e due, quindi senza questa
  // riga il giorno in cui qualcuno segna un acconto — o rimette mano
  // alla scheda — tornerebbe "confermato" da sola, e un contratto
  // sciolto risulterebbe di nuovo buono. Un recesso non si disfa
  // toccando una casella.
  if (recesso) return "recesso";
  if (moduloRicevuto) return accontoPagato ? "confermato" : "modulo_ricevuto";
  return moduloInviato ? "modulo_inviato" : "dati_inseriti";
}

// Un'iscrizione recessa non conta nei posti occupati del corso: il posto
// e' tornato libero. Sta qui, accanto agli stati, perche' e' la stessa
// domanda — "questa iscrizione vale ancora?" — e perche' chi conta i
// posti non debba ricordarsi di scrivere ogni volta la condizione.
export function iscrizioneAttiva(iscritto) {
  return statoDi(iscritto) !== "recesso";
}

export function iscrittiAttiviDi(iscritti, corsoDataId) {
  return (iscritti || []).filter((i) => i.corso_data_id === corsoDataId && iscrizioneAttiva(i));
}

// Il modulo e' arrivato. `origine` dice da quale delle due strade:
// "manuale" (caricato dal venditore) oppure "online" (compilato
// dall'allievo col link). Tutte e due passano di qui.
export async function segnaModuloRicevuto(iscritto, origine = "manuale") {
  if (!iscritto?.id) return "Iscritto senza identificativo.";
  if (statoDi(iscritto) === "recesso") return "Questa iscrizione è stata recessa.";
  if (origine !== "manuale" && origine !== "online") return `Origine non valida: ${origine}`;
  const stato = decidiStato({
    recesso: false,
    moduloInviato: !!iscritto.modulo_inviato_il,
    moduloRicevuto: true,
    accontoPagato: accontoRisultaPagato(iscritto),
  });
  // `.select` e non solo update: PostgREST risponde "va bene" anche
  // quando non ha cambiato niente, e un'iscrizione che resta indietro
  // senza dirlo e' proprio quello che questo stato serve a evitare
  const { data, error } = await supabase.from("iscritti")
    .update({
      stato,
      modulo_ricevuto_il: iscritto.modulo_ricevuto_il || new Date().toISOString(),
      modulo_ricevuto_da: origine,
    })
    .eq("id", iscritto.id)
    .select("id, stato");
  if (error) return error.message;
  if (!data?.length) return "Nessuna riga aggiornata: controlla i permessi.";
  return null;
}

// L'acconto e' stato segnato (o tolto) nella scheda.
//
// Promuove soltanto: chi era "modulo_ricevuto" diventa "confermato".
// Chi e' su "modulo_inviato" resta li', perche' il modulo non c'e'
// ancora. E si torna indietro da "confermato" SOLO se quell'iscrizione
// e' passata davvero dal modulo (ha una data di ricezione): senza quella
// data e' una delle vecchie, e non si tocca.
export async function aggiornaStatoDopoAcconto(iscritto) {
  if (!iscritto?.id) return null;
  if (statoDi(iscritto) === "recesso") return null;   // vedi decidiStato
  const moduloRicevuto = !!iscritto.modulo_ricevuto_il;
  if (!moduloRicevuto) return null;           // niente modulo, niente da decidere
  const atteso = decidiStato({ recesso: false, moduloInviato: !!iscritto.modulo_inviato_il, moduloRicevuto, accontoPagato: accontoRisultaPagato(iscritto) });
  if (atteso === statoDi(iscritto)) return null;
  const { data, error } = await supabase.from("iscritti")
    .update({ stato: atteso }).eq("id", iscritto.id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Nessuna riga aggiornata: controlla i permessi.";
  return null;
}
