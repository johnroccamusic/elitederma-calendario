// IL LISTINO PER I RIVENDITORI: PDF ed Excel. 18/11/2026.
//
// Nasce dalla lettura `listino_rivenditori_export()`, che costo, margine
// e sconto cedibile non li restituisce. Quindi qui non c'è niente da
// nascondere: quei campi non arrivano. È la differenza chiesta dal punto
// 6 della specifica fra «l'interfaccia non li mostra» e «il server non li
// manda».
//
// Il PDF si costruisce nel browser come tutti gli altri dell'app. Le
// foto dei prodotti qui non ci sono: con cinque colonne di prezzi non
// resta larghezza, e questo foglio si legge per confrontare numeri.
import { soloWinAnsi } from "../prezzi/listinoPdf.js";

const A4 = { corto: 595.28, lungo: 841.89 };
const MARGINE = 34;
const ALTEZZA_RIGA = 17;

const NAVY = [0.055, 0.106, 0.2];
const ORO = [0.722, 0.569, 0.333];
const GRIGIO = [0.42, 0.45, 0.52];
const RIGA_CHIARA = [0.976, 0.969, 0.953];
const BORDO = [0.886, 0.867, 0.835];

export const NOTA_PIEDE = "Prezzi IVA esclusa; prezzo al pubblico consigliato IVA inclusa e non vincolante";

const cifra = (n) => (n == null ? "-" : Number(n).toFixed(2).replace(".", ","));
const pct = (n) => (n == null ? "-" : `${String(Math.round(Number(n) * 10) / 10).replace(".", ",")}%`);
// Una soglia si legge in euro tondi: «ingresso ordine € 3.000».
//
// `useGrouping: "always"` non e' un vezzo: in italiano il CLDR non
// raggruppa i numeri di quattro cifre (`minimumGroupingDigits: 2`), e
// senza quell'opzione su un listino da consegnare si leggerebbe «€ 3000»
// — che sembra un errore di battitura. Lo stesso inciampo del 17/11 sui
// 1.888 clienti dello shop, dall'altra parte.
export const soglia = (n) => `€ ${Number(n || 0).toLocaleString("it-IT", { maximumFractionDigits: 0, useGrouping: "always" })}`;

// Le righe che entrano in un listino.
//
// Fuori restano i prodotti senza prezzo e quelli che si vendono SOLO AL
// BANCO: offrirli a un rivenditore vorrebbe dire promettere merce che non
// si sa come fargli avere. È la stessa regola del listino del 15/11.
export function righeEsportabili(righe) {
  return (righe || [])
    .filter((r) => r.pubblico_netto != null && r.pubblico_lordo != null && r.sullo_shop !== false)
    .slice()
    .sort((a, b) => (a.blocco_ordine - b.blocco_ordine) || String(a.nome).localeCompare(String(b.nome), "it"));
}

export function perReparto(righe) {
  const mappa = new Map();
  righeEsportabili(righe).forEach((r) => {
    const k = r.blocco || "ALTRI PRODOTTI";
    if (!mappa.has(k)) mappa.set(k, { nome: k, ordine: r.blocco_ordine ?? 99, prodotti: [] });
    mappa.get(k).prodotti.push(r);
  });
  return [...mappa.values()].sort((a, b) => a.ordine - b.ordine);
}

// IL TITOLO, e il motivo per cui con un livello solo cambia.
//
// Un listino con una colonna sola va a UN rivenditore, che non deve
// vedere che esistono livelli più convenienti del suo: «per un
// rivenditore Professional spunto solo Professional e il file non deve
// rivelare nulla degli altri livelli». Quindi il titolo lo nomina, e in
// testa si scrivono il suo sconto e la sua soglia d'ingresso.
export function titoloListino(livelliScelti) {
  return livelliScelti.length === 1
    ? `Listino rivenditori - livello ${livelliScelti[0].nome}`
    : "Listino rivenditori";
}

// Le colonne, nell'ordine della specifica. Con un livello solo l'ultima
// colonna NON è «Sconto max sul prodotto» — mostrerebbe lo sconto del
// Distributor, cioè proprio l'informazione che quel file non deve dare —
// ma «Sconto applicato», la percentuale di quel livello su quel prodotto.
export function colonneListino(livelliScelti) {
  const uno = livelliScelti.length === 1;
  const colonne = [
    { chiave: "pubblico_lordo", titolo: "Pubblico consigliato", sotto: "IVA inclusa", valore: (r) => cifra(r.pubblico_lordo) },
    { chiave: "pubblico_netto", titolo: "Prezzo netto", sotto: "IVA esclusa", valore: (r) => cifra(r.pubblico_netto) },
  ];
  livelliScelti.forEach((l) => {
    colonne.push({
      chiave: `livello_${l.codice}`,
      titolo: uno ? `Prezzo ${l.nome}` : l.nome,
      sotto: "IVA esclusa",
      grassetto: true,
      valore: (r) => cifra(r.prezzi?.[l.codice]),
    });
  });
  colonne.push(uno
    ? { chiave: "sconto_applicato", titolo: "Sconto applicato", sotto: "su questo prodotto", valore: (r) => pct(r.sconti_pct?.[livelliScelti[0].codice]) }
    : { chiave: "sconto_max", titolo: "Sconto max", sotto: "sul prodotto", valore: (r) => pct(r.sconto_max_pct) });
  return colonne;
}

// L'intestazione: che cosa si promette a chi legge. Con più livelli, uno
// per riga con sconto e soglia; con un livello solo, quello e basta.
export function righeIntestazione(livelliScelti, tettoPct) {
  return livelliScelti.map((l) => {
    const sconto = Math.round(Number(l.frazione) * Number(tettoPct) * 10) / 10;
    return `${l.nome} (fino a -${String(sconto).replace(".", ",")}%) - ingresso ${l.ingresso_cumulabile ? `${soglia(l.ingresso_eur)} di acquisti cumulati` : `ordine ${soglia(l.ingresso_eur)}`}`;
  });
}

// ---------- Excel ----------
//
// È un CSV con il punto e virgola e la virgola decimale, come l'altro
// export del listino: si apre in Excel con un doppio clic. Un vero .xlsx
// vorrebbe dire una libreria per scrivere uno zip, e questo progetto ha
// sei dipendenze per scelta.
export function csvListinoRivenditori(righe, livelliScelti) {
  const colonne = colonneListino(livelliScelti);
  const cella = (v) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const testata = ["Categoria", "Prodotto", ...colonne.map((c) => `${c.titolo} (${c.sotto})`)].map(cella).join(";");
  const corpo = righeEsportabili(righe).map((r) =>
    [r.blocco || "ALTRI PRODOTTI", r.nome, ...colonne.map((c) => c.valore(r))].map(cella).join(";"));
  return "﻿" + [testata, ...corpo].join("\r\n") + "\r\n";
}

let _pdfLibLocale = null;
async function caricaPdfLibLocale() {
  if (!_pdfLibLocale) {
    const pdfLib = await import("pdf-lib");
    _pdfLibLocale = { PDFDocument: pdfLib.PDFDocument, StandardFonts: pdfLib.StandardFonts, rgb: pdfLib.rgb };
  }
  return _pdfLibLocale;
}

// ---------- PDF ----------
export async function creaListinoRivenditoriPdf(righe, livelliScelti, {
  tettoPct = 50, getPdfLib, righeSocieta = [], dataDi = null,
} = {}) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLibLocale)();
  const reparti = perReparto(righe);
  const colonne = colonneListino(livelliScelti);
  // con molte colonne si gira il foglio: nove colonne di numeri su un A4
  // in verticale si schiacciano fino a toccarsi
  const larghezzaPagina = colonne.length > 4 ? A4.lungo : A4.corto;
  const altezzaPagina = colonne.length > 4 ? A4.corto : A4.lungo;

  const pdf = await PDFDocument.create();
  pdf.setTitle(titoloListino(livelliScelti));
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifGrassetto = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const colore = (c) => rgb(c[0], c[1], c[2]);

  const destra = larghezzaPagina - MARGINE;
  const LARG_COLONNA = 66;
  const xColonne = colonne.map((_, i) => destra - (colonne.length - 1 - i) * LARG_COLONNA);
  const larghezzaNome = xColonne[0] - LARG_COLONNA - MARGINE - 6;

  let pagina = null;
  let y = 0;
  let numeroPagina = 0;
  const data = (dataDi || new Date()).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" });

  const scriviDestra = (testo, x, yRiga, font, dim, c) => {
    const t = soloWinAnsi(testo);
    pagina.drawText(t, { x: x - font.widthOfTextAtSize(t, dim), y: yRiga, size: dim, font, color: colore(c) });
  };
  function accorcia(testo, font, dim, larghezza) {
    const t = soloWinAnsi(testo);
    if (font.widthOfTextAtSize(t, dim) <= larghezza) return t;
    let taglio = t;
    while (taglio.length > 1 && font.widthOfTextAtSize(`${taglio}...`, dim) > larghezza) taglio = taglio.slice(0, -1);
    return `${taglio}...`;
  }

  function intestazioneColonne() {
    pagina.drawText("PRODOTTO", { x: MARGINE, y: y - 16, size: 7.5, font: grassetto, color: colore(GRIGIO) });
    colonne.forEach((c, i) => {
      scriviDestra(c.titolo.toUpperCase(), xColonne[i], y - 6, grassetto, 7, GRIGIO);
      scriviDestra(c.sotto, xColonne[i], y - 16, normale, 6.5, GRIGIO);
    });
    pagina.drawLine({ start: { x: MARGINE, y: y - 23 }, end: { x: destra, y: y - 23 }, thickness: 0.8, color: colore(BORDO) });
    y -= 31;
  }

  function nuovaPagina() {
    pagina = pdf.addPage([larghezzaPagina, altezzaPagina]);
    numeroPagina += 1;
    y = altezzaPagina - MARGINE;
    if (numeroPagina === 1) {
      pagina.drawText(soloWinAnsi("ELITEDERMA"), { x: MARGINE, y: y - 26, size: 26, font: serifGrassetto, color: colore(NAVY) });
      const larg = serifGrassetto.widthOfTextAtSize("ELITEDERMA", 26);
      pagina.drawLine({ start: { x: MARGINE, y: y - 33 }, end: { x: MARGINE + larg, y: y - 33 }, thickness: 1.6, color: colore(ORO) });
      pagina.drawText(soloWinAnsi(titoloListino(livelliScelti).toUpperCase()), { x: MARGINE, y: y - 50, size: 13, font: normale, color: colore(NAVY) });
      scriviDestra(`AGGIORNATO AL ${data.toUpperCase()}`, destra, y - 26, grassetto, 8, GRIGIO);
      y -= 64;
      // le condizioni del livello, in alto: è la prima cosa che un
      // rivenditore cerca sul foglio che gli arriva
      righeIntestazione(livelliScelti, tettoPct).forEach((r) => {
        pagina.drawText(soloWinAnsi(r), { x: MARGINE, y, size: 8, font: normale, color: colore(GRIGIO) });
        y -= 11;
      });
      y -= 6;
    } else {
      pagina.drawText(soloWinAnsi("ELITEDERMA"), { x: MARGINE, y: y - 12, size: 13, font: serifGrassetto, color: colore(NAVY) });
      pagina.drawText(soloWinAnsi(titoloListino(livelliScelti)), { x: MARGINE + 90, y: y - 12, size: 9, font: normale, color: colore(GRIGIO) });
      scriviDestra(data.toUpperCase(), destra, y - 12, grassetto, 8, GRIGIO);
      y -= 34;
    }
    intestazioneColonne();
  }

  function spazio(quanto) { if (y - quanto < MARGINE + 22) nuovaPagina(); }

  nuovaPagina();

  for (const reparto of reparti) {
    spazio(26 + ALTEZZA_RIGA * 2);
    pagina.drawRectangle({ x: MARGINE, y: y - 16, width: destra - MARGINE, height: 18, color: colore(NAVY) });
    pagina.drawText(soloWinAnsi(reparto.nome), { x: MARGINE + 7, y: y - 11, size: 9, font: grassetto, color: rgb(1, 1, 1) });
    scriviDestra(`${reparto.prodotti.length} prodotti`, destra - 7, y - 11, normale, 7.5, [1, 1, 1]);
    y -= 24;

    let dispari = false;
    for (const p of reparto.prodotti) {
      spazio(ALTEZZA_RIGA);
      dispari = !dispari;
      if (dispari) {
        pagina.drawRectangle({ x: MARGINE, y: y - ALTEZZA_RIGA + 5, width: destra - MARGINE, height: ALTEZZA_RIGA, color: colore(RIGA_CHIARA) });
      }
      const yT = y - 7;
      pagina.drawText(accorcia(p.nome, normale, 8.5, larghezzaNome), { x: MARGINE, y: yT, size: 8.5, font: normale, color: colore(NAVY) });
      colonne.forEach((c, i) => {
        scriviDestra(c.valore(p), xColonne[i], yT, c.grassetto ? grassetto : normale, c.grassetto ? 9 : 8.5,
          c.grassetto ? NAVY : GRIGIO);
      });
      y -= ALTEZZA_RIGA;
    }
    y -= 5;
  }

  const rigaSocieta = righeSocieta.length ? righeSocieta.join("  ·  ") : "Elitederma";
  pdf.getPages().forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGINE, y: 32 }, end: { x: destra, y: 32 }, thickness: 0.6, color: colore(BORDO) });
    pg.drawText(soloWinAnsi(rigaSocieta), { x: MARGINE, y: 22, size: 7, font: normale, color: colore(GRIGIO) });
    pg.drawText(soloWinAnsi(NOTA_PIEDE), { x: MARGINE, y: 13, size: 7, font: normale, color: colore(GRIGIO) });
    const n = `${i + 1} / ${pdf.getPageCount()}`;
    pg.drawText(n, { x: destra - grassetto.widthOfTextAtSize(n, 8), y: 13, size: 8, font: grassetto, color: colore(NAVY) });
  });

  return { bytes: await pdf.save(), prodotti: reparti.reduce((s, r) => s + r.prodotti.length, 0), pagine: pdf.getPageCount() };
}
