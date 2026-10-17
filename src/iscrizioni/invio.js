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
import { link } from "../indirizzo.js";
import { componiDaModello, modelloUsabile, valoriCorso, proteggi, APRE_HTML } from "../../supabase/functions/_shared/email.js";

// LA MAIL DEL MODULO, composta una volta sola.
//
// La usa l'invio vero e la usa l'anteprima in Impostazioni: se fossero
// due scritture, un giorno l'anteprima mostrerebbe una mail e l'allieva
// ne riceverebbe un'altra.
export function componiMailModulo({ valori, righe = [], link, modello = null, societa = null }) {
  const p = piede({ societa, valori });

  if (modelloUsabile(modello)) {
    const mail = componiDaModello(modello, { valori: { ...valori, link }, righe });
    // IL LINK DEVE ESSERCI COMUNQUE. Se chi scrive il testo si dimentica
    // il segnaposto {link}, la mail arriverebbe senza il modulo: una
    // lettera che dice "compila qui" e non dice dove.
    if (!String(mail.testo || "").includes(link)) {
      mail.testo = `${mail.testo}\n\n${link}`;
      mail.html = mail.html.replace("\n</div>", `${tastoHtml(link)}\n</div>`);
    }
    return { ...mail, testo: mail.testo + p.testo, html: mail.html.replace("\n</div>", `${p.html}\n</div>`) };
  }

  const d = diSerie({ valori, link });
  // l'HTML non si fabbrica incollando <p> uno dietro l'altro: una mail
  // senza struttura, con dentro un indirizzo nudo, e' la forma che i
  // filtri conoscono meglio.
  //
  // Il tasto prende il POSTO della riga del link, non va in fondo:
  // appeso dopo i saluti finiva sotto "A presto, Elitederma Academy",
  // cioe' dopo la firma di una lettera.
  const paragrafo = (r) => (r ? `<p style="margin:0 0 14px">${proteggi(r)}</p>` : "");
  const corpo = d.testo
    .split("\n")
    .map((r) => (r === link ? tastoHtml(link) : paragrafo(r)))
    .join("");
  return {
    oggetto: d.oggetto,
    testo: d.testo + p.testo,
    html: `${APRE_HTML}${corpo}${p.html}\n</div>`,
  };
}

// Il link come tasto, e sotto scritto per esteso: chi legge da telefono
// tocca, chi diffida lo guarda prima di toccarlo. Un indirizzo nudo in
// mezzo al testo non fa ne' l'una ne' l'altra cosa.
function tastoHtml(link) {
  return `<p style="margin:22px 0 10px">`
    + `<a href="${link}" style="display:inline-block;background:#0E1B33;color:#ffffff;`
    + `text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">`
    + `Apri il modulo</a></p>`
    + `<p style="margin:0;font-size:12px;color:#7a7f8c;word-break:break-all">${proteggi(link)}</p>`;
}

export function linkModulo(token) {
  return link(`/?modulo=${token}`);
}

// il testo di serie, quello che parte se nessuno ne ha scritto uno
export function diSerie({ valori, link }) {
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

// IL PIEDE DELLA MAIL: chi la manda, e perche' sta arrivando.
//
// Non e' decorazione. La prima mail da questo dominio e' finita nello
// spam, ed e' quello che succede a un messaggio appena nato: nessuna
// storia alle spalle, un link a un indirizzo che nessuno ha mai visto, e
// niente che dica chi scrive. Un mittente che si firma con ragione
// sociale, indirizzo e partita IVA — e che spiega perche' quella mail e'
// arrivata — e' quello che distingue una comunicazione vera.
//
// I dati non si inventano: vengono da `intestazione_societa`, la stessa
// riga che finisce in cima ai documenti.
function piede({ societa, valori }) {
  const righe = [
    societa?.nome,
    societa?.indirizzo,
    societa?.indirizzo_2,
  ].map((r) => String(r || "").trim()).filter(Boolean);
  const perche = `Ricevi questa mail perché risulti iscritta a ${valori.corso}.`;
  return {
    testo: ["", "—", perche, ...righe].join("\n"),
    html: `<hr style="border:none;border-top:1px solid #e6dfce;margin:26px 0 14px">`
      + `<div style="font-size:12px;line-height:1.5;color:#7a7f8c">`
      + `${proteggi(perche)}<br>`
      + righe.map((r) => proteggi(r)).join("<br>")
      + `</div>`,
  };
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

  // `valoriCorso` torna DUE cose: i valori e le righe dei dettagli. Qui
  // c'era `const valori = valoriCorso(...)`, cioe' l'oggetto intero preso
  // per i valori: `valori.nome` era undefined, e nella mail si leggeva
  // "Ciao undefined". La build non puo' accorgersene.
  const { valori, righe: righeDettagli } = valoriCorso({
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

  // chi firma la mail: la stessa riga che va in cima ai documenti
  const { data: societa } = await supabase
    .from("intestazione_societa").select("*").limit(1).maybeSingle();

  const mail = componiMailModulo({ valori, righe: righeDettagli, link, modello: riga, societa });

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

/**
 * Segna il modulo come inviato SENZA mandare la mail.
 *
 * Serve a chi copia il link e lo manda su WhatsApp: il modulo e'
 * partito davvero, solo per un'altra strada, e la scheda deve dirlo. Se
 * non lo segnasse, quell'iscrizione resterebbe per sempre su "Invia
 * modulo" e qualcuno lo rimanderebbe.
 *
 * Lascia la sua riga nel registro, con esito "ok" e destinatario vuoto:
 * cosi' si distingue dalle mail partite da qui.
 */
export async function segnaInviatoAMano({ iscritto, corsoData, chi = "" }) {
  const patch = { stato: "modulo_inviato" };
  if (!iscritto.modulo_inviato_il) patch.modulo_inviato_il = new Date().toISOString();
  const { data, error } = await supabase
    .from("iscritti").update(patch).eq("id", iscritto.id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Nessuna riga aggiornata: controlla i permessi.";

  const { error: erroreRegistro } = await supabase.from("email_inviate").insert({
    chiave_modello: "invio_modulo",
    iscritto_id: iscritto.id,
    corso_data_id: corsoData?.id || null,
    destinatario: "",
    oggetto: "Link copiato e mandato a mano",
    esito: "ok",
    automatica: false,
    inviata_da: chi || null,
  });
  if (erroreRegistro) console.error("email_inviate: riga non scritta —", erroreRegistro.message);
  return null;
}
