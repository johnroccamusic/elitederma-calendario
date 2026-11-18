// LA TESTATA DEI LISTINI, IN UN POSTO SOLO. 18/11/2026.
//
// I listini sono due — quello del 15/11 con le foto e i quattro prezzi, e
// quello a livelli per i rivenditori — ma la carta intestata è una: stesso
// marchio, stesso filo d'oro, stessa data in alto a destra. Scritta due
// volte si scosterebbe al primo ritocco, e sono due fogli che finiscono
// nelle mani della stessa persona nella stessa settimana.
//
// IL MARCHIO È UN'IMMAGINE, non più «ELITEDERMA» disegnato in Times con le
// lettere distanziate (18/11/2026, il titolare ha mandato il file). Il
// motivo non è estetico: nel marchio vero la E centrale è il simbolo ≋, e
// nessun font di serie di pdf-lib lo contiene — il testo disegnato era
// un'approssimazione che a confronto con la carta intestata si vedeva.
//
// Il ripiego resta, ed è voluto: **se il file del logo non arriva si
// scrive il nome come prima**. Un listino senza marchio è meno grave di un
// listino che non esce, ed è la stessa regola di `datiSocieta()`.
import { soloWinAnsi } from "./winansi.js";

export const LOGO_TESTATA = "/logo-elitederma-testata.png";
// il marchio è 652 x 102: il rapporto serve a dare l'altezza e ricavare la
// larghezza, perché è l'altezza che deve stare in riga con il testo
export const RAPPORTO_LOGO = 652 / 102;

const NAVY = [0.055, 0.106, 0.2];
const ORO = [0.722, 0.569, 0.333];
const GRIGIO = [0.42, 0.45, 0.52];
const BORDO = [0.886, 0.867, 0.835];

let _bytes;

// Si legge una volta per sessione. `undefined` = non ci ho ancora
// provato, `null` = non c'è: la differenza serve a non riprovare a ogni
// listino quando il file manca davvero.
export async function caricaLogoTestata(url = LOGO_TESTATA) {
  if (_bytes !== undefined) return _bytes;
  try {
    const risposta = await fetch(url);
    if (!risposta.ok) { _bytes = null; return null; }
    const buffer = await risposta.arrayBuffer();
    _bytes = buffer && buffer.byteLength ? new Uint8Array(buffer) : null;
  } catch { _bytes = null; }
  return _bytes;
}

export function _dimenticaLogo() { _bytes = undefined; }

// L'innesto nel documento. Un PNG storto non deve far fallire il listino a
// metà strada: si torna null e la testata scrive il nome.
export async function innestaLogo(pdf, bytes) {
  if (!bytes) return null;
  try { return await pdf.embedPng(bytes); } catch { return null; }
}

// Le lettere distanziate del ripiego. pdf-lib non sa spaziare un testo,
// quindi si disegna una lettera alla volta.
export function larghezzaSpaziata(testo, font, dimensione, extra) {
  const t = soloWinAnsi(testo);
  if (!t) return 0;
  return font.widthOfTextAtSize(t, dimensione) + extra * (t.length - 1);
}

export function scriviSpaziato(pagina, testo, x, y, font, dimensione, extra, colore) {
  let cursore = x;
  for (const lettera of soloWinAnsi(testo)) {
    pagina.drawText(lettera, { x: cursore, y, size: dimensione, font, color: colore });
    cursore += font.widthOfTextAtSize(lettera, dimensione) + extra;
  }
  return cursore - extra - x;
}

// Il marchio, immagine o nome scritto, con il filo d'oro sotto.
// Torna la larghezza occupata, che serve a chi disegna quello che viene
// dopo: il filo, la riga verticale, il titolo.
export function disegnaMarchio(pagina, { logo, x, y, altezza, font, colore, conRegistrato }) {
  if (logo) {
    const larghezza = altezza * RAPPORTO_LOGO;
    pagina.drawImage(logo, { x, y, width: larghezza, height: altezza });
    if (conRegistrato) {
      pagina.drawText("®", { x: x + larghezza + 5, y: y + altezza - 9, size: 8, font: font.serif, color: colore(NAVY) });
    }
    return larghezza;
  }
  const dimensione = altezza * 1.15;
  const larghezza = scriviSpaziato(pagina, "ELITEDERMA", x, y, font.serifGrassetto, dimensione, dimensione / 11.5, colore(NAVY));
  if (conRegistrato) {
    pagina.drawText("®", { x: x + larghezza + 5, y: y + altezza - 9, size: 8, font: font.serif, color: colore(NAVY) });
  }
  return larghezza;
}

// LA TESTATA DELLA PRIMA PAGINA. Il marchio comanda; sotto il filo d'oro
// largo quanto lui, poi che cosa è questo foglio. A destra, staccata da una
// riga verticale, la data: un listino senza data è un listino di cui
// nessuno sa se vale ancora.
//
// Torna la y da cui continuare.
export function disegnaTestata(pagina, { logo, titolo, data, margine, destra, font, colore, y, altezzaLogo = 26 }) {
  const yLogo = y - altezzaLogo - 6;
  const larghezza = disegnaMarchio(pagina, { logo, x: margine, y: yLogo, altezza: altezzaLogo, font, colore, conRegistrato: true });

  pagina.drawLine({
    start: { x: margine, y: yLogo - 9 }, end: { x: margine + larghezza, y: yLogo - 9 },
    thickness: 1.6, color: colore(ORO),
  });
  scriviSpaziato(pagina, titolo.toUpperCase(), margine, yLogo - 27, font.normale, 13, 2.2, colore(NAVY));

  const xRiga = margine + larghezza + 46;
  if (xRiga < destra - 120) {
    pagina.drawLine({ start: { x: xRiga, y: yLogo + altezzaLogo - 4 }, end: { x: xRiga, y: yLogo - 30 }, thickness: 0.8, color: colore(BORDO) });
  }
  ["AGGIORNATO AL", String(data).toUpperCase()].forEach((t, i) => {
    const larg = larghezzaSpaziata(t, font.grassetto, 8, 1.4);
    scriviSpaziato(pagina, t, destra - larg, yLogo + 4 - i * 12, font.grassetto, 8, 1.4, colore(i === 0 ? GRIGIO : NAVY));
    if (i === 1) {
      pagina.drawLine({ start: { x: destra - larg, y: yLogo - 14 }, end: { x: destra, y: yLogo - 14 }, thickness: 1.2, color: colore(ORO) });
    }
  });
  return yLogo - 52;
}

// LE PAGINE DOPO: la stessa testata in piccolo, perché un foglio staccato
// dal mazzo deve dire da solo di chi è.
export function disegnaTestatina(pagina, { logo, titolo, data, margine, destra, font, colore, y, altezzaLogo = 11 }) {
  const yLogo = y - altezzaLogo - 3;
  const larghezza = disegnaMarchio(pagina, { logo, x: margine, y: yLogo, altezza: altezzaLogo, font, colore, conRegistrato: false });
  pagina.drawLine({
    start: { x: margine, y: yLogo - 5 }, end: { x: margine + larghezza, y: yLogo - 5 },
    thickness: 1, color: colore(ORO),
  });
  scriviSpaziato(pagina, titolo, margine + larghezza + 14, yLogo + 1, font.normale, 9, 1.2, colore(GRIGIO));
  const d = soloWinAnsi(String(data).toUpperCase());
  pagina.drawText(d, {
    x: destra - font.grassetto.widthOfTextAtSize(d, 8), y: yLogo + 1, size: 8, font: font.grassetto, color: colore(GRIGIO),
  });
  return yLogo - 17;
}
