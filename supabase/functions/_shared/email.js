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
