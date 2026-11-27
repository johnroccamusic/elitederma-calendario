// IL CONTRATTO MASTER IN PDF, PER LEGGERLO (27/11/2026).
//
// Il titolare: «le maestre che devono firmare il contratto mi hanno
// chiesto un tasto che generi un PDF per la lettura del testo».
//
// A COSA SERVE, e a cosa NON serve. Serve a portarsi via il testo: su
// un telefono ventitre' articoli in un riquadro che scorre si leggono
// male, e chi vuole stamparlo, rileggerlo sul computer o farlo guardare
// al proprio commercialista oggi non ha niente da mandargli. NON e' la
// copia firmata: quella la compone il server dopo la firma, porta la
// firma, le foto del documento, il timbro dell'Accademia e le tre
// dichiarazioni con la loro ora. Confondere le due cose sarebbe il
// danno peggiore — una master che crede di avere in mano il documento
// sottoscritto — quindi QUESTO FOGLIO LO DICE: in testa, in fondo a
// ogni pagina, e nel nome del file.
//
// IL TESTO NON SI SCRIVE QUI DENTRO. Arriva dalle stesse funzioni che
// disegnano la pagina della firma e che il server congela alla firma —
// `blocchiContratto`, `casellePronte`, le righe di `master_contratti_testi`
// passate come `testi`. Una seconda stesura degli articoli vorrebbe
// dire un PDF che dice una cosa e una firma che ne vale un'altra: una
// prova rilegge questo file e pretende che non contenga nemmeno un
// pezzo di clausola.
//
// L'IMPAGINAZIONE invece e' sua, e somiglia a quella della copia
// firmata (`_shared/contratto-master-pdf.ts`) senza esserne una copia:
// quel file gira in Deno, importa pdf-lib da un indirizzo che Vite non
// sa risolvere, e rifattorizzarlo adesso vorrebbe dire metterci le mani
// il giorno prima che componga il suo primo contratto vero. Quello che
// non deve divergere e' il testo, e il testo e' condiviso.
import { soloWinAnsi } from "../prezzi/winansi.js";
import {
  CLAUSOLE, INTESTAZIONE, MANIFESTO,
  blocchiContratto, casellePronte, epigrafeMaster, giornoLungo,
} from "../../supabase/functions/_shared/contratto-master.js";

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 48;

// pdf-lib pesa, e questa pagina la apre una master dal telefono: arriva
// solo quando il tasto si preme davvero.
let _pdfLib = null;
async function caricaPdfLib() {
  if (!_pdfLib) {
    const m = await import("pdf-lib");
    _pdfLib = { PDFDocument: m.PDFDocument, StandardFonts: m.StandardFonts, rgb: m.rgb };
  }
  return _pdfLib;
}

const AVVISO = "COPIA PER LA LETTURA — NON È IL DOCUMENTO FIRMATO";

/**
 * Il nome del file dice cos'è, perché è la prima cosa che si legge nella
 * cartella dei download fra sei mesi.
 */
export function nomeFileContrattoDaLeggere(oggi = new Date()) {
  const g = oggi.toISOString().slice(0, 10);
  return `contratto-master-elitederma-da-leggere-${g}.pdf`;
}

/**
 * COSA C'E' DENTRO IL FOGLIO, in ordine, e niente che si disegni.
 *
 * Sta a parte perche' e' la sola cosa di questo file che si possa
 * sbagliare in silenzio: pdf-lib comprime i flussi di testo, quindi un
 * PDF generato non si rilegge con un `grep` e una prova sui soli byte
 * direbbe «esiste» senza dire «dentro c'e' il contratto». Da qui invece
 * si controlla articolo per articolo — e che ogni pezzo arrivi dalle
 * funzioni condivise, non da una seconda stesura.
 *
 * `caselle` su una sezione vuol dire «qui si disegnano i quadratini»:
 * sono le tre dichiarazioni, VUOTE, perche' su questo foglio nessuno ha
 * dichiarato niente.
 */
export function sezioniDaLeggere(testi, dati = {}) {
  const t = testi || {};
  const clausole = t.clausole || CLAUSOLE;
  const manifesto = t.manifesto || MANIFESTO;
  return [
    ...blocchiContratto(t, dati).map((b) => ({ ...b, parte: "contratto" })),
    { parte: "clausole", nuovaPagina: true, titolo: clausole.titolo, punti: clausole.punti || [] },
    {
      // PAGINA SUA, come nella copia firmata. Le sedici clausole
      // compaiono due volte — nella sezione qui sopra e dentro la
      // dichiarazione che le approva — ed e' giusto che sia cosi', e'
      // il foglio che si firma; ma stampate due volte a dieci
      // centimetri di distanza si leggono come un errore.
      parte: "dichiarazioni", nuovaPagina: true,
      titolo: "Le tre dichiarazioni da spuntare al momento della firma",
      punti: ["Nel foglio firmato ognuna porta l'ora in cui l'hai spuntata. Qui sono vuote: non hai dichiarato niente."],
      caselle: casellePronte(t),
    },
    {
      parte: "manifesto", nuovaPagina: true,
      titolo: manifesto.titolo, sottotitolo: manifesto.versione || "",
      blocchi: (manifesto.blocchi || []).map((b) => ({ ...b, parte: "manifesto" })),
    },
  ];
}

export async function creaPdfContrattoDaLeggere({ testi, dati = {}, oggi = new Date(), getPdfLib } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLib)();
  const NAVY = rgb(0.055, 0.106, 0.2);
  const GRIGIO = rgb(0.33, 0.35, 0.37);
  const CHIARO = rgb(0.62, 0.63, 0.66);
  const ROSSO = rgb(0.7, 0.15, 0.12);

  const t = testi || {};
  const intestazione = t.intestazione || INTESTAZIONE;

  const pdf = await PDFDocument.create();
  pdf.setTitle(soloWinAnsi(`${intestazione.titolo} — da leggere`));
  const tondo = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);

  const larghezzaUtile = A4.larghezza - MARGINE * 2;
  let pagina = pdf.addPage([A4.larghezza, A4.altezza]);
  let y = A4.altezza - MARGINE;

  // IL PIEDE E' ALTO 30 PUNTI e il testo si ferma prima: senza questo
  // margine l'ultima riga di una pagina finisce sopra il numero, e due
  // scritte sovrapposte su un contratto si leggono come un errore.
  const spazio = (quanto) => {
    if (y - quanto < MARGINE + 30) {
      pagina = pdf.addPage([A4.larghezza, A4.altezza]);
      y = A4.altezza - MARGINE;
    }
    y -= quanto;
  };

  const aCapo = (testo, font, misura, larghezza) => {
    const righe = [];
    for (const paragrafo of soloWinAnsi(testo).split("\n")) {
      let riga = "";
      for (const parola of paragrafo.split(/\s+/)) {
        const prova = riga ? riga + " " + parola : parola;
        if (font.widthOfTextAtSize(prova, misura) > larghezza && riga) { righe.push(riga); riga = parola; }
        else riga = prova;
      }
      righe.push(riga);
    }
    return righe;
  };

  const scrivi = (testo, { misura = 9, font = tondo, colore = NAVY, interlinea = 1.45, dopo = 0, rientro = 0 } = {}) => {
    for (const riga of aCapo(testo, font, misura, larghezzaUtile - rientro)) {
      spazio(misura * interlinea);
      pagina.drawText(riga, { x: MARGINE + rientro, y, size: misura, font, color: colore });
    }
    if (dopo) spazio(dopo);
  };

  const titolo = (testo) => {
    spazio(12);
    scrivi(String(testo || "").toUpperCase(), { misura: 10.5, font: grassetto, dopo: 4 });
    spazio(2);
    pagina.drawLine({
      start: { x: MARGINE, y: y + 6 }, end: { x: A4.larghezza - MARGINE, y: y + 6 },
      thickness: 0.7, color: CHIARO,
    });
    spazio(6);
  };

  // una voce dell'elenco rientra e si smorza, come nella pagina
  const punto = (p) => {
    const voce = String(p).trim().startsWith("•");
    spazio(3);
    scrivi(p, { misura: 8.6, colore: voce ? GRIGIO : NAVY, rientro: voce ? 12 : 0 });
  };

  // -------------------------------------------------------------- testata
  //
  // Non porta il nome della societa' scritto a mano: l'Accademia si
  // identifica per intero nel primo blocco («Le parti»), che e' testo
  // del contratto. Un secondo posto da cui leggere la ragione sociale
  // sarebbe un secondo posto da correggere il giorno che cambia.
  scrivi(intestazione.titolo, { misura: 13, font: grassetto });
  scrivi([intestazione.sottotitolo, intestazione.versione].filter(Boolean).join(" · "),
    { misura: 8.5, colore: GRIGIO, dopo: 4 });
  scrivi(AVVISO, { misura: 9.5, font: grassetto, colore: ROSSO });
  scrivi("Questo foglio serve a leggere il testo con calma, stamparlo o farlo guardare a chi ti assiste. "
    + "Non è il contratto sottoscritto: si firma dall'app, nella tessera «Firma del contratto», e la copia firmata "
    + "— con la tua firma, il tuo documento e il timbro dell'Accademia — ti arriva per email subito dopo.",
    { misura: 8.2, colore: GRIGIO });
  scrivi("Stampato il " + giornoLungo(oggi.toISOString()), { misura: 8, colore: CHIARO, dopo: 6 });

  // ------------------------------------------------- quello che c'e' dentro
  //
  // L'ordine e i contenuti li decide `sezioniDaLeggere`: qui si disegna
  // quello che quella dice, nient'altro. Le clausole degli artt. 1341 e
  // 1342 c.c. stanno dentro anche se nella pagina della firma non sono
  // uno dei due documenti che si aprono: sono una seconda
  // sottoscrizione, la copia firmata le stampa per intero, e un foglio
  // «per leggere il contratto» senza le sedici clausole da approvare
  // specificamente sarebbe senza il pezzo che conviene leggere prima.
  for (const sezione of sezioniDaLeggere(t, dati)) {
    if (sezione.nuovaPagina) {
      pagina = pdf.addPage([A4.larghezza, A4.altezza]);
      y = A4.altezza - MARGINE;
    }
    if (sezione.blocchi) {
      // l'Allegato A: un titolo suo, e dentro i suoi blocchi
      scrivi(sezione.titolo, { misura: 12, font: grassetto });
      if (sezione.sottotitolo) scrivi(sezione.sottotitolo, { misura: 8.5, colore: GRIGIO, dopo: 6 });
      for (const blocco of sezione.blocchi) {
        titolo(blocco.titolo || "");
        for (const p of blocco.punti || []) punto(p);
      }
      continue;
    }
    titolo(sezione.titolo || "");
    for (const p of sezione.punti || []) punto(p);
    // LE CASELLE SONO VUOTE, e si dice perche': un «[X]» stampato su un
    // foglio che nessuno ha firmato sarebbe una dichiarazione finta.
    for (const casella of sezione.caselle || []) {
      spazio(12);
      pagina.drawText("[  ]", { x: MARGINE, y, size: 9.5, font: grassetto, color: NAVY });
      y += 12;
      scrivi(casella.etichetta, { misura: 8.6, font: grassetto, rientro: 22 });
      scrivi(casella.testo, { misura: 8.2, colore: GRIGIO, rientro: 22 });
      for (const voce of casella.clausole || []) {
        scrivi("- " + voce, { misura: 7.6, colore: GRIGIO, rientro: 34, interlinea: 1.35 });
      }
      spazio(4);
    }
  }

  // ------------------------------------------------------------- il piede
  //
  // SU OGNI PAGINA, perche' un foglio si legge anche staccato dagli
  // altri: una pagina sola, trovata in mezzo ad altre carte, non deve
  // poter passare per una pagina del contratto firmato.
  const pagine = pdf.getPages();
  pagine.forEach((pg, i) => {
    const n = `Pagina ${i + 1} di ${pagine.length}`;
    pg.drawText(soloWinAnsi(AVVISO), { x: MARGINE, y: 18, size: 7, font: tondo, color: CHIARO });
    pg.drawText(n, {
      x: A4.larghezza - MARGINE - tondo.widthOfTextAtSize(n, 7), y: 18,
      size: 7, font: tondo, color: CHIARO,
    });
  });

  return pdf.save();
}

// Riesportata per chi monta la pagina: l'epigrafe che compare in testa
// al PDF e' la stessa della schermata, trattini compresi dove un dato
// non c'e' ancora.
export { epigrafeMaster };
