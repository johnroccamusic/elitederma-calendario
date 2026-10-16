// MANDARE IL MODULO ALL'ALLIEVA.
//
// Un posto solo, perche' da qui si fanno due cose che devono restare
// legate: parte la mail, e la scheda si segna "modulo inviato". Se
// fossero due gesti separati, prima o poi una mail partirebbe senza che
// la scheda lo sappia — e l'allieva riceverebbe il modulo due volte
// mentre in ufficio risulta non spedito.
//
// IL LINK. Lo apre chi non ha un account: ?modulo=<gettone>. Il gettone
// e' gia' sulla riga dell'iscritto, nato con lei.
//
// IL TESTO. Il modello "invio_modulo" si scrive in Setting > Modelli
// email. Se la riga non c'e' o e' vuota vale quello qui sotto, come per
// la mail di conferma: un testo contrattuale non puo' dipendere dal
// fatto che qualcuno abbia riempito una casella.
import { supabase } from "../supabase.js";
import { componiDaModello, modelloUsabile, valoriCorso } from "../../supabase/functions/_shared/email.js";

export function linkModulo(token) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/?modulo=${token}`;
}

// il testo di serie, quello che parte se nessuno ne ha scritto uno
function diSerie({ valori, link }) {
  const oggetto = `Il tuo modulo di iscrizione — ${valori.corso}`;
  const testo = [
    `Ciao ${valori.nome},`,
    "",
    `per completare l'iscrizione a ${valori.corso} ti chiediamo di compilare e firmare il modulo qui sotto.`,
    "Ci vogliono pochi minuti: trovi già dentro i dati che ci hai dato, e devi solo aggiungere i tuoi e firmare col dito.",
    "",
    link,
    "",
    "A presto,",
    "Elitederma Academy",
  ].join("\n");
  return { oggetto, testo };
}

/**
 * Manda il modulo e segna la scheda.
 *
 * Un rinvio non e' un caso a parte: lascia una seconda riga nel
 * registro, con la sua data. Un doppione non si nasconde — e' una cosa
 * che si deve poter ricostruire.
 *
 * Torna { ok, errore, link }. Il link torna sempre, anche quando la
 * mail non parte: serve a poterlo copiare e mandare a mano.
 */
export async function inviaModulo({ iscritto, corso, corsoData, loc, chi = "" }) {
  const link = linkModulo(iscritto.token_modulo);
  const destinatario = String(iscritto.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatario)) {
    return { ok: false, errore: "Manca un'email valida nella scheda.", link };
  }

  const valori = valoriCorso({
    nome: iscritto.nome,
    nomeCorso: corso?.nome,
    dataInizio: corsoData?.data_inizio,
    dataFine: corsoData?.data_fine,
    citta: corsoData?.citta || loc?.citta || loc?.nome,
    sede: loc?.nome_sede,
    indirizzo: corsoData?.indirizzo || loc?.indirizzo,
  });

  // il modello si rilegge a ogni invio: chi corregge una frase deve
  // vederne l'effetto alla mail dopo, senza ricaricare l'app
  const { data: riga } = await supabase
    .from("email_modelli").select("*").eq("chiave", "invio_modulo").maybeSingle();

  let mail;
  if (modelloUsabile(riga)) {
    mail = componiDaModello(riga, { valori: { ...valori, link }, righe: [] });
    // il link deve esserci comunque: se chi ha scritto il modello si e'
    // dimenticato il segnaposto, la mail arriverebbe senza il modulo
    if (!String(mail.testo || "").includes(link)) {
      mail.testo = `${mail.testo}\n\n${link}`;
      mail.html = `${mail.html}<p><a href="${link}">${link}</a></p>`;
    }
  } else {
    const d = diSerie({ valori, link });
    mail = { oggetto: d.oggetto, testo: d.testo, html: d.testo.split("\n").map((r) => r ? `<p>${r}</p>` : "").join("") };
  }

  const { data, error } = await supabase.functions.invoke("invia-email", {
    body: { a: destinatario, oggetto: mail.oggetto, html: mail.html, testo: mail.testo },
  });
  const errore = data?.errore || (error ? (error.message || String(error)) : "");

  // IL REGISTRO SI SCRIVE SEMPRE, anche quando e' andata male: un invio
  // fallito e' proprio il caso in cui qualcuno deve poter sapere cos'e'
  // successo
  // Le colonne sono esattamente quelle della tabella: PostgREST butta
  // TUTTA la insert se ne nomini una che non c'e', e il registro
  // resterebbe vuoto senza dirlo a nessuno. (Qui c'era "note", che non
  // esiste: il rinvio non ha bisogno di una colonna sua — e' la seconda
  // riga con la stessa chiave e lo stesso iscritto.)
  const { error: erroreRegistro } = await supabase.from("email_inviate").insert({
    chiave_modello: "invio_modulo",
    iscritto_id: iscritto.id,
    corso_data_id: corsoData?.id || null,
    destinatario,
    oggetto: mail.oggetto,
    esito: errore ? "errore" : "ok",
    errore: errore || null,
    resend_id: data?.id || null,
    automatica: false,
    inviata_da: chi || null,
  });
  if (erroreRegistro) {
    // non si ferma l'invio per questo, ma non lo si nasconde: una mail
    // partita e non registrata e' il modo di mandarla due volte domani
    console.error("email_inviate: riga non scritta —", erroreRegistro.message);
  }

  if (errore) return { ok: false, errore, link };

  // LA SCHEDA SI SEGNA SOLO SE LA MAIL E' PARTITA DAVVERO.
  // `modulo_inviato_il` non si sovrascrive a ogni rinvio: resta la prima
  // volta, che e' la data che conta per capire da quanto si aspetta.
  const patch = { stato: "modulo_inviato" };
  if (!iscritto.modulo_inviato_il) patch.modulo_inviato_il = new Date().toISOString();
  const { data: righe, error: erroreStato } = await supabase
    .from("iscritti").update(patch).eq("id", iscritto.id).select("id");
  if (erroreStato) return { ok: true, errore: `Mail partita, ma la scheda non si è aggiornata: ${erroreStato.message}`, link };
  if (!righe?.length) return { ok: true, errore: "Mail partita, ma nessuna riga aggiornata: controlla i permessi.", link };

  return { ok: true, errore: "", link };
}
