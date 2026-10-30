// LA COMPOSIZIONE DELLE MAIL, scritta una volta sola.
//
// Sta qui e non in src/ perche' la usano due mondi: il browser, quando
// qualcuno preme "Invia mail di conferma", e Deno, quando il lavoro
// notturno manda i promemoria. Due copie dello stesso calcolo vuol dire
// che un giorno la prova in Setting mostrera' una mail e l'allieva ne
// ricevera' un'altra. E' lo stesso motivo per cui ci sta gia'
// `codiceReferral.js`, che App.jsx importa da questa cartella.
//
// Qui dentro non si legge e non si scrive niente: entrano dei valori,
// esce il testo. Chi li raccoglie — da oggetti React o da una riga SQL —
// e' affare di chi chiama.

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Deliberatamente identica a `toTitleCase` di App.jsx, separatori
// compresi: se un giorno divergono, la prova e la mail vera non diranno
// piu' la stessa cosa. C'e' una prova nel banco che le confronta.
/**
 * Le righe del dettaglio: coppie [etichetta, valore], nell'ordine in cui
 * vanno lette. Il tipo e' scritto qui perche' questo file e' JavaScript e
 * chi lo chiama da un .ts, senza, si vede dedurre `never[]` dal valore
 * predefinito — e `deno check` lo segnala come errore su una cosa che
 * funziona benissimo.
 * @typedef {Array<Array<any>>} RigheDettaglio
 */

export function titolo(testo) {
  return (testo || "")
    .toLowerCase()
    .split(/(\s+)/)
    .map((parola) => (parola ? parola.charAt(0).toUpperCase() + parola.slice(1) : parola))
    .join("");
}

// "12–13 novembre 2026", "12 novembre – 3 dicembre 2026", "3 dicembre 2026".
// Identica a `fmtIntervalloEsteso` di App.jsx, ma qui regge anche una data
// mancante invece di spaccarsi su `split` (vedi le schermate bianche nate
// cosi'): un promemoria notturno non puo' fermarsi per una data vuota.
export function dataEstesa(inizio, fine) {
  if (!inizio) return "";
  const [annoI, meseI, giornoI] = String(inizio).split("-").map(Number);
  if (!Number.isFinite(annoI) || !Number.isFinite(meseI) || !Number.isFinite(giornoI)) return "";
  const f = fine || inizio;
  if (f === inizio) return `${giornoI} ${MESI[meseI - 1]} ${annoI}`;
  const [annoF, meseF, giornoF] = String(f).split("-").map(Number);
  if (!Number.isFinite(annoF)) return `${giornoI} ${MESI[meseI - 1]} ${annoI}`;
  if (annoI === annoF && meseI === meseF) return `${giornoI}–${giornoF} ${MESI[meseI - 1]} ${annoI}`;
  if (annoI === annoF) return `${giornoI} ${MESI[meseI - 1]} – ${giornoF} ${MESI[meseF - 1]} ${annoI}`;
  return `${giornoI} ${MESI[meseI - 1]} ${annoI} – ${giornoF} ${MESI[meseF - 1]} ${annoF}`;
}

export function proteggi(s) {
  return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Un giro solo su tutte le graffe: sostituendo un segnaposto alla volta,
// un valore che ne contiene un altro verrebbe risostituito. Un segnaposto
// che non esiste resta scritto com'e' — meglio una graffa che si vede
// nell'anteprima di un buco dentro una mail gia' partita.
export function applicaSegnaposti(testo, valori) {
  return String(testo || "").replace(/\{(\w+)\}/g, (intero, chiave) =>
    Object.prototype.hasOwnProperty.call(valori || {}, chiave) ? String(valori[chiave] ?? "") : intero,
  );
}

// I valori di un corso, gia' scritti come vanno letti. `righe` e' l'ordine
// con cui compaiono in {dettagli}, saltando quelle vuote: una sede senza
// indirizzo non deve lasciare una riga "Indirizzo:" e basta.
export function valoriCorso({ nome, nomeCorso, dataInizio, dataFine, citta, sede, indirizzo }) {
  const corso = nomeCorso ? titolo(nomeCorso) : "il corso";
  const date = dataEstesa(dataInizio, dataFine);
  const valori = {
    nome: nome ? titolo(nome) : "",
    corso,
    date,
    citta: titolo(citta || ""),
    sede: sede ? titolo(sede) : "",
    indirizzo: indirizzo || "",
  };
  const righe = [
    ["Corso", valori.corso],
    ["Date", valori.date],
    ["Città", valori.citta],
    ["Sede", valori.sede],
    ["Indirizzo", valori.indirizzo],
  ].filter(([, v]) => v);
  return { valori, righe };
}

export function dettagliHtml(righe) {
  return `<table style="border-collapse:collapse;margin:16px 0">${righe
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7a7f8c">${proteggi(k)}</td><td style="padding:4px 0"><strong>${proteggi(v)}</strong></td></tr>`)
    .join("")}</table>`;
}

export const APRE_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2a44;max-width:560px">`;

// Un modello e' usabile solo con oggetto E testo pieni. Svuotarne uno non
// deve far partire una mail senza corpo: chi compone ripiega (il tasto sul
// testo scritto nel codice, il lavoro notturno non manda affatto).
export function modelloUsabile(modello) {
  return !!(modello && String(modello.testo || "").trim() && String(modello.oggetto || "").trim());
}

// Il testo scritto in Setting diventa le due versioni della mail. In HTML
// si protegge PRIMA quello che e' stato battuto a mano e si sostituisce
// DOPO: al contrario, un valore con dentro una & verrebbe protetto due
// volte e si leggerebbe "&amp;".
/** @param {any} modello @param {{ valori: Record<string, any>, righe: RigheDettaglio }} dati */
export function componiDaModello(modello, { valori, righe }) {
  const perTesto = { ...valori, dettagli: righe.map(([k, v]) => `${k}: ${v}`).join("\n") };
  const perHtml = {};
  for (const k of Object.keys(valori)) perHtml[k] = proteggi(valori[k]);
  perHtml.dettagli = dettagliHtml(righe);
  return {
    oggetto: applicaSegnaposti(modello.oggetto, perTesto),
    testo: applicaSegnaposti(modello.testo, perTesto),
    html: `${APRE_HTML}${applicaSegnaposti(proteggi(modello.testo).replace(/\n/g, "<br>"), perHtml)}\n</div>`,
  };
}

// IL PIEDE DELLA MAIL: chi la manda, e perche' sta arrivando.
//
// Non e' decorazione. La prima mail da questo dominio e' finita nello
// spam, ed e' quello che succede a un messaggio appena nato: nessuna
// storia alle spalle e niente che dica chi scrive. Un mittente che si
// firma con ragione sociale e indirizzo — e che spiega perche' quella
// mail e' arrivata — e' quello che distingue una comunicazione vera.
//
// Stava in src/iscrizioni/invio.js, cioe' solo dal lato browser. E' qui
// perche' adesso lo usa anche Deno: la conferma di ricezione parte dal
// server, e una mail col piede e una senza sarebbero due mail diverse.
export function piede({ societa, valori }) {
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

// LE CAMPAGNE DEL CRM (30/10/2026): la stessa mail la vede chi la scrive
// (anteprima nel browser) e la riceve il contatto (spedita da Deno). Una
// funzione sola, o anteprima e mail sarebbero due mail diverse.
//
// Il corpo arriva gia' in HTML dall'editor; i segnaposti {nome} {comune}
// {provincia} {regione} {corso} si riempiono per persona. Il piede e'
// FISSO e non si toglie: chi scrive, da dove, perche' questa mail e'
// arrivata, e il link per non riceverne piu'. In Vetta un consenso al
// marketing non esiste; il titolare ha deciso di scrivere a tutti perche'
// il consenso era sul sito, e la contropartita e' che la disiscrizione sia
// a un tocco e in fondo a ogni mail.
export const SEGNAPOSTI_CAMPAGNA = ["nome", "cognome", "comune", "provincia", "regione", "corso"];

/** @param {{ societa?: any, linkDisiscrizione?: string, motivo?: string }} args */
export function piedeCampagna({ societa, linkDisiscrizione, motivo }) {
  const righe = [societa?.nome, societa?.indirizzo].map((r) => String(r || "").trim()).filter(Boolean);
  const perche = motivo || "Ricevi questa mail perché hai chiesto informazioni sui corsi di Elitederma.";
  const link = linkDisiscrizione || "#";
  return {
    testo: ["", "—", perche, ...righe, `Per non ricevere più queste mail: ${link}`].join("\n"),
    html: `<hr style="border:none;border-top:1px solid #e6dfce;margin:26px 0 14px">`
      + `<div style="font-size:12px;line-height:1.5;color:#7a7f8c">`
      + `${proteggi(perche)}<br>`
      + righe.map((r) => proteggi(r)).join("<br>")
      + `<br><a href="${proteggi(link)}" style="color:#7a7f8c">Non voglio più ricevere queste mail</a>`
      + `</div>`,
  };
}

// L'HTML in testo semplice, per la parte "text" della mail e per chi legge
// senza HTML: righe dove c'erano blocchi, link con l'indirizzo accanto.
export function htmlInTesto(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (m, href, testo) => `${testo} (${href})`)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** @param {{ oggetto: string, corpoHtml: string, valori?: Record<string, any>, societa?: any, linkDisiscrizione?: string, motivo?: string }} args */
export function componiCampagna({ oggetto, corpoHtml, valori, societa, linkDisiscrizione, motivo }) {
  const perHtml = {};
  for (const k of SEGNAPOSTI_CAMPAGNA) perHtml[k] = proteggi(valori?.[k] ?? "");
  const perTesto = {};
  for (const k of SEGNAPOSTI_CAMPAGNA) perTesto[k] = String(valori?.[k] ?? "");
  const piede = piedeCampagna({ societa, linkDisiscrizione, motivo });
  const corpo = applicaSegnaposti(corpoHtml, perHtml);
  return {
    oggetto: applicaSegnaposti(oggetto, perTesto),
    html: `${APRE_HTML}${corpo}${piede.html}\n</div>`,
    testo: `${applicaSegnaposti(htmlInTesto(corpoHtml), perTesto)}${piede.testo}`,
  };
}

// LA CONFERMA DI RICEZIONE DEL MODULO.
//
// Parte da sola appena l'allieva preme Invia e il modulo e' stato
// scritto davvero. Non chiede niente e non ha link: dice solo che il
// modulo e' arrivato, perche' dall'altra parte c'e' qualcuno che ha
// appena mandato un documento d'identita' e la propria firma a un
// indirizzo che non conosce, e il silenzio e' la cosa peggiore.
//
// Riga mancante in `email_modelli` = vale il testo qui sotto. E' la
// stessa regola degli altri modelli, e non e' un ripiego pigro: questa
// mail deve partire anche il giorno in cui qualcuno svuota il modello
// per sbaglio.
export function diSerieRicezione({ valori }) {
  const oggetto = `Abbiamo ricevuto il tuo modulo — ${valori.corso}`;
  const testo = [
    `Ciao ${valori.nome},`,
    "",
    "abbiamo ricevuto il tuo modulo di iscrizione, firmato e completo.",
    "Non devi fare altro: da qui in avanti ci pensiamo noi.",
    "",
    "{dettagli}",
    "",
    "Se c'è qualcosa da correggere, rispondi a questa mail e lo sistemiamo.",
    "",
    "A presto,",
    "Elitederma Academy",
  ].join("\n");
  return { oggetto, testo };
}

// IL TASTO DEL RECESSO NELLA MAIL DI CONFERMA.
//
// La dicitura e' imposta dalla norma e si scrive cosi', minuscola
// compresa. Non passa dal modello correggibile in Setting: chi riscrive
// il testo della mail non deve poter far sparire — o rinominare — un
// collegamento che per legge ci deve essere. Per lo stesso motivo viene
// attaccato DOPO, sempre, qualunque cosa dica il modello.
export const TASTO_RECEDI = "recedi dal contratto qui";
// IL TASTO DI PRESA VISIONE E' STATO TOLTO il 19/10/2026, su richiesta.
// La conferma adesso si chiede al programma di posta con le intestazioni
// standard — vedi `invia-email`. Resta scritto qui perche' il patto e'
// cambiato, non per nostalgia: il tasto funzionava su ogni telefono e
// finiva registrato in `email_inviate`; le intestazioni non le mostra
// Mail di iPhone, Gmail le ignora sugli account normali, e dove compaiono
// la ricevuta torna come una mail a una persona, non nel registro.

function bloccoRecesso(link) {
  return {
    testo: `\n\nSe cambi idea hai 14 giorni per recedere dal contratto, senza dare spiegazioni:\n${TASTO_RECEDI}\n${link}`,
    html: `<hr style="border:none;border-top:1px solid #e6dfce;margin:24px 0 16px">`
      + `<p style="margin:0 0 12px;font-size:14px">Se cambi idea hai 14 giorni per recedere dal contratto, senza dare spiegazioni.</p>`
      + `<p style="margin:0 0 10px">`
      + `<a href="${link}" style="display:inline-block;background:#0E1B33;color:#ffffff;`
      + `text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">${TASTO_RECEDI}</a></p>`
      + `<p style="margin:0;font-size:12px;color:#7a7f8c;word-break:break-all">${proteggi(link)}</p>`,
  };
}

/** @param {{ valori: Record<string, any>, righe?: RigheDettaglio, modello?: any, societa?: any, linkRecesso?: string }} dati */
export function componiMailRicezione({ valori, righe = [], modello = null, societa = null, linkRecesso = "" }) {
  const p = piede({ societa, valori });
  const r = linkRecesso ? bloccoRecesso(linkRecesso) : { testo: "", html: "" };
  // UNA RIGA SULL'ALLEGATO RESTA. Non chiede niente e non e' un tasto:
  // dice solo che in fondo alla mail c'e' la copia del contratto, perche'
  // un allegato senza una frase che lo nomini passa inosservato.
  const a = {
    testo: "\n\nIn allegato trovi la copia firmata del tuo modulo di iscrizione: conservala, è la tua copia del contratto.",
    html: '<hr style="border:none;border-top:1px solid #e6dfce;margin:24px 0 16px">'
      + '<p style="margin:0;font-size:14px"><strong>In allegato trovi la copia firmata del tuo modulo di iscrizione.</strong>'
      + ' Conservala: è la tua copia del contratto.</p>',
  };
  const attacca = (mail) => ({
    ...mail,
    testo: mail.testo + a.testo + r.testo + p.testo,
    html: mail.html.replace("\n</div>", `${a.html}${r.html}${p.html}\n</div>`),
  });

  if (modelloUsabile(modello)) return attacca(componiDaModello(modello, { valori, righe }));

  // il testo di serie passa dalla stessa strada del modello scritto a
  // mano — stesso {dettagli}, stesso HTML — cosi' le due versioni della
  // mail non possono venire diverse
  const d = diSerieRicezione({ valori });
  return attacca(componiDaModello({ oggetto: d.oggetto, testo: d.testo }, { valori, righe }));
}
