// IL REGOLAMENTO IN PDF, da consegnare al rivenditore. 18/11/2026.
//
// Non contiene MAI costi, margini né sconti cedibili: è la riga del punto
// 3.6 della specifica, e qui è vera per costruzione — questo file riceve
// i blocchi composti da `regolamento-testo.js`, che leggono solo la
// configurazione dei livelli, e del listino non sa niente.
//
// Le tabelle dei livelli e dei riassortimenti si ricavano dalla
// configurazione a ogni generazione: così il foglio che si consegna non
// può promettere soglie vecchie.
import { soloWinAnsi } from "../prezzi/listinoPdf.js";

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 48;
const NAVY = [0.055, 0.106, 0.2];
const ORO = [0.722, 0.569, 0.333];
const GRIGIO = [0.42, 0.45, 0.52];
const BORDO = [0.886, 0.867, 0.835];
const RIGA_CHIARA = [0.976, 0.969, 0.953];

let _pdfLib = null;
async function caricaPdfLib() {
  if (!_pdfLib) {
    const l = await import("pdf-lib");
    _pdfLib = { PDFDocument: l.PDFDocument, StandardFonts: l.StandardFonts, rgb: l.rgb };
  }
  return _pdfLib;
}

// Il testo va a capo misurando la larghezza vera con il font che lo
// disegnerà: tagliare a numero di caratteri sbaglia di parecchio fra
// "IIII" e "MMMM", e un paragrafo tagliato male su un documento che si
// firma si nota.
export function spezzaInRighe(testo, font, dimensione, larghezza) {
  const parole = soloWinAnsi(testo).split(/\s+/).filter(Boolean);
  const righe = [];
  let riga = "";
  for (const parola of parole) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (font.widthOfTextAtSize(prova, dimensione) <= larghezza) riga = prova;
    else { if (riga) righe.push(riga); riga = parola; }
  }
  if (riga) righe.push(riga);
  return righe;
}

export async function creaRegolamentoPdf(composizione, {
  getPdfLib, righeSocieta = [], versione = null, inVigoreDal = null, dataDi = null,
} = {}) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLib)();
  const pdf = await PDFDocument.create();
  pdf.setTitle(composizione.titolo);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifGrassetto = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const colore = (c) => rgb(c[0], c[1], c[2]);
  const destra = A4.larghezza - MARGINE;
  const larghezza = destra - MARGINE;

  let pagina = null;
  let y = 0;
  let numeroPagina = 0;
  const data = (dataDi || new Date()).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" });

  function nuovaPagina() {
    pagina = pdf.addPage([A4.larghezza, A4.altezza]);
    numeroPagina += 1;
    y = A4.altezza - MARGINE;
    if (numeroPagina === 1) {
      pagina.drawText(soloWinAnsi("ELITEDERMA"), { x: MARGINE, y: y - 24, size: 24, font: serifGrassetto, color: colore(NAVY) });
      const larg = serifGrassetto.widthOfTextAtSize("ELITEDERMA", 24);
      pagina.drawLine({ start: { x: MARGINE, y: y - 31 }, end: { x: MARGINE + larg, y: y - 31 }, thickness: 1.6, color: colore(ORO) });
      pagina.drawText(soloWinAnsi(composizione.titolo.toUpperCase()), { x: MARGINE, y: y - 50, size: 14, font: grassetto, color: colore(NAVY) });
      const riga2 = [versione ? `Versione ${versione}` : null, inVigoreDal ? `in vigore dal ${new Date(`${inVigoreDal}T00:00:00Z`).toLocaleDateString("it-IT", { timeZone: "UTC" })}` : null, `documento del ${data}`]
        .filter(Boolean).join("  ·  ");
      pagina.drawText(soloWinAnsi(riga2), { x: MARGINE, y: y - 64, size: 8.5, font: normale, color: colore(GRIGIO) });
      y -= 84;
    } else {
      pagina.drawText(soloWinAnsi("ELITEDERMA"), { x: MARGINE, y: y - 11, size: 12, font: serifGrassetto, color: colore(NAVY) });
      pagina.drawText(soloWinAnsi(composizione.titolo), { x: MARGINE + 84, y: y - 11, size: 8.5, font: normale, color: colore(GRIGIO) });
      y -= 30;
    }
  }
  function spazio(quanto) { if (y - quanto < MARGINE + 24) nuovaPagina(); }

  nuovaPagina();

  for (const blocco of composizione.blocchi) {
    spazio(46);
    pagina.drawText(soloWinAnsi(blocco.titolo), { x: MARGINE, y, size: 11.5, font: grassetto, color: colore(NAVY) });
    pagina.drawLine({ start: { x: MARGINE, y: y - 6 }, end: { x: MARGINE + 46, y: y - 6 }, thickness: 1.4, color: colore(ORO) });
    y -= 22;

    if (blocco.tabella) {
      const colonne = blocco.tabella.testata.length;
      const largPrima = colonne > 3 ? 108 : 150;
      const largAltre = (larghezza - largPrima) / (colonne - 1);
      const x = (i) => MARGINE + (i === 0 ? 0 : largPrima + largAltre * (i - 1));
      spazio(18 + 14 * blocco.tabella.righe.length);
      pagina.drawRectangle({ x: MARGINE, y: y - 12, width: larghezza, height: 15, color: colore(NAVY) });
      blocco.tabella.testata.forEach((t, i) => {
        pagina.drawText(soloWinAnsi(t), { x: x(i) + 4, y: y - 8, size: 7, font: grassetto, color: rgb(1, 1, 1) });
      });
      y -= 17;
      blocco.tabella.righe.forEach((riga, n) => {
        spazio(14);
        if (n % 2 === 0) pagina.drawRectangle({ x: MARGINE, y: y - 10, width: larghezza, height: 13, color: colore(RIGA_CHIARA) });
        riga.forEach((cella, i) => {
          pagina.drawText(soloWinAnsi(cella), { x: x(i) + 4, y: y - 6.5, size: 7.5, font: i === 0 ? grassetto : normale, color: colore(NAVY) });
        });
        y -= 13;
      });
      y -= 10;
    }

    for (const paragrafo of blocco.paragrafi || []) {
      const righe = spezzaInRighe(paragrafo, normale, 9, larghezza - 10);
      spazio(righe.length * 12 + 4);
      // un segnaposto si vede: un documento che manca di un pezzo non
      // deve sembrare completo
      if (blocco.segnaposto) {
        pagina.drawRectangle({ x: MARGINE, y: y - righe.length * 12 + 4, width: larghezza, height: righe.length * 12 + 4, borderColor: colore(ORO), borderWidth: 0.8 });
      }
      righe.forEach((r, i) => {
        pagina.drawText(r, { x: MARGINE + (blocco.segnaposto ? 6 : 0), y: y - i * 12, size: 9, font: normale, color: colore(blocco.segnaposto ? GRIGIO : NAVY) });
      });
      y -= righe.length * 12 + 8;
    }

    if (blocco.firme) {
      // tre righe da riempire a penna: ragione sociale, luogo e data,
      // firma — e sotto la doppia firma delle clausole 1341-1342, che è
      // un atto a parte e per questo ha una riga sua
      spazio(110);
      y -= 8;
      [["Ragione sociale", 300], ["Luogo e data", 220], ["Firma del rivenditore", 240]].forEach(([etichetta, larg]) => {
        pagina.drawText(soloWinAnsi(etichetta), { x: MARGINE, y, size: 8, font: normale, color: colore(GRIGIO) });
        pagina.drawLine({ start: { x: MARGINE + 110, y: y + 2 }, end: { x: MARGINE + 110 + larg, y: y + 2 }, thickness: 0.7, color: colore(BORDO) });
        y -= 26;
      });
      y -= 6;
      pagina.drawText(soloWinAnsi("Approvazione specifica delle clausole ai sensi degli artt. 1341-1342 c.c."), { x: MARGINE, y, size: 8.5, font: grassetto, color: colore(NAVY) });
      y -= 22;
      pagina.drawText(soloWinAnsi("Firma del rivenditore"), { x: MARGINE, y, size: 8, font: normale, color: colore(GRIGIO) });
      pagina.drawLine({ start: { x: MARGINE + 110, y: y + 2 }, end: { x: MARGINE + 350, y: y + 2 }, thickness: 0.7, color: colore(BORDO) });
      y -= 24;
    }
  }

  const rigaSocieta = righeSocieta.length ? righeSocieta.join("  ·  ") : "Elitederma";
  pdf.getPages().forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGINE, y: 36 }, end: { x: destra, y: 36 }, thickness: 0.6, color: colore(BORDO) });
    pg.drawText(soloWinAnsi(rigaSocieta), { x: MARGINE, y: 26, size: 7, font: normale, color: colore(GRIGIO) });
    pg.drawText(soloWinAnsi("Importi IVA esclusa. Prezzi al pubblico consigliati e non vincolanti."), { x: MARGINE, y: 17, size: 7, font: normale, color: colore(GRIGIO) });
    const n = `${i + 1} / ${pdf.getPageCount()}`;
    pg.drawText(n, { x: destra - grassetto.widthOfTextAtSize(n, 8), y: 17, size: 8, font: grassetto, color: colore(NAVY) });
  });

  return { bytes: await pdf.save(), pagine: pdf.getPageCount() };
}
