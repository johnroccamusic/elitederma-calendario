// pdf-lib con i font di serie scrive solo in WinAnsi: un trattino lungo o
// un "×" copiati da una scheda prodotto farebbero fallire tutto il PDF a
// metà strada. Si sostituiscono quelli che capitano e si butta il resto.
//
// Sta in un file suo dal 18/11/2026 e non dentro `listinoPdf.js` soltanto
// perché la testata condivisa ne ha bisogno, e la testata la usa anche
// `listinoPdf.js`: lasciandola di là i due file si importerebbero a
// vicenda. Chi la importa da `listinoPdf.js` continua a trovarla, perché
// di là è ri-esportata.
const SOSTITUZIONI = { "—": "-", "–": "-", "×": "x", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "™": "", "®": "", "°": "o" };

// L'EURO SI SCRIVE €, non "EUR" (18/11/2026). Era sostituito per
// prudenza, e la prudenza era di troppo: WinAnsi il simbolo ce l'ha
// (0x80) e i font di serie di pdf-lib lo disegnano — provato. Si vedeva
// sul regolamento da consegnare, dove ogni soglia diceva "EUR 500" e le
// tre lettere in più facevano sbordare le celle della tabella nella
// colonna accanto. Sta fuori dal filtro finale perché è U+20AC, cioè
// sopra 0xFF: senza l'eccezione lo butterebbe via la riga qui sotto.
export function soloWinAnsi(testo) {
  let t = String(testo ?? "");
  for (const [da, a] of Object.entries(SOSTITUZIONI)) t = t.split(da).join(a);
  // eslint-disable-next-line no-control-regex
  return t.replace(/[^\x20-\xFF€]/g, "");
}
