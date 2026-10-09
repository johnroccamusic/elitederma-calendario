// Un file .zip costruito a mano, senza comprimere.
//
// PERCHE' UNO ZIP. I loghi sono PNG con lo sfondo trasparente. Mandati
// su WhatsApp come immagine vengono ricompressi in JPEG e la
// trasparenza diventa un rettangolo bianco o nero: il logo e' rovinato
// e non se ne accorge nessuno finche' non lo si apre. WhatsApp manda
// intatto solo quello che tratta come DOCUMENTO, e uno zip lo e'
// sempre. Dentro ci stanno i due PNG, nero e bianco, come sono usciti.
//
// PERCHE' A MANO. Serve un contenitore, non una compressione: i PNG
// sono gia' compressi e zipparli non toglierebbe un byte. Il metodo
// "store" e' una trentina di righe di intestazioni, e vale piu' che
// aggiungere una dipendenza al progetto per questo.
//
// Niente zip64: i loghi pesano qualche centinaio di kilobyte, e i
// limiti del formato classico (4 GB, 65535 file) non li sfiora nessuno.

// La tabella del CRC-32, costruita una volta sola alla prima chiamata.
let TABELLA = null;
function tabellaCrc() {
  if (TABELLA) return TABELLA;
  TABELLA = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    TABELLA[n] = c >>> 0;
  }
  return TABELLA;
}
function crc32(byte) {
  const t = tabellaCrc();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < byte.length; i++) c = t[(c ^ byte[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function scrivi16(a, i, v) { a[i] = v & 0xFF; a[i + 1] = (v >>> 8) & 0xFF; }
function scrivi32(a, i, v) { a[i] = v & 0xFF; a[i + 1] = (v >>> 8) & 0xFF; a[i + 2] = (v >>> 16) & 0xFF; a[i + 3] = (v >>> 24) & 0xFF; }

// data e ora in formato MS-DOS, che e' quello che lo zip si aspetta
function dataDos(d = new Date()) {
  const ora = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
  const giorno = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { ora, giorno };
}

// file: [{ nome, dati }] dove `dati` e' un Uint8Array o un ArrayBuffer
export function creaZip(file, { nomeZip = "archivio.zip" } = {}) {
  const codifica = new TextEncoder();
  const { ora, giorno } = dataDos();
  const pezzi = [];
  const centrale = [];
  let posizione = 0;

  (file || []).forEach((f) => {
    const dati = f.dati instanceof Uint8Array ? f.dati : new Uint8Array(f.dati);
    const nome = codifica.encode(f.nome);
    const crc = crc32(dati);

    const testa = new Uint8Array(30 + nome.length);
    scrivi32(testa, 0, 0x04034b50);   // firma di un file locale
    scrivi16(testa, 4, 20);           // versione minima per leggerlo
    scrivi16(testa, 6, 0x0800);       // il nome del file e' in UTF-8
    scrivi16(testa, 8, 0);            // metodo 0 = nessuna compressione
    scrivi16(testa, 10, ora);
    scrivi16(testa, 12, giorno);
    scrivi32(testa, 14, crc);
    scrivi32(testa, 18, dati.length); // compresso = non compresso
    scrivi32(testa, 22, dati.length);
    scrivi16(testa, 26, nome.length);
    scrivi16(testa, 28, 0);           // niente campi extra
    testa.set(nome, 30);

    pezzi.push(testa, dati);
    centrale.push({ nome, crc, lunghezza: dati.length, offset: posizione });
    posizione += testa.length + dati.length;
  });

  const inizioIndice = posizione;
  centrale.forEach((c) => {
    const riga = new Uint8Array(46 + c.nome.length);
    scrivi32(riga, 0, 0x02014b50);    // firma di una riga dell'indice
    scrivi16(riga, 4, 20);
    scrivi16(riga, 6, 20);
    scrivi16(riga, 8, 0x0800);
    scrivi16(riga, 10, 0);
    scrivi16(riga, 12, ora);
    scrivi16(riga, 14, giorno);
    scrivi32(riga, 16, c.crc);
    scrivi32(riga, 20, c.lunghezza);
    scrivi32(riga, 24, c.lunghezza);
    scrivi16(riga, 28, c.nome.length);
    scrivi32(riga, 42, c.offset);
    riga.set(c.nome, 46);
    pezzi.push(riga);
    posizione += riga.length;
  });

  const coda = new Uint8Array(22);
  scrivi32(coda, 0, 0x06054b50);      // firma della chiusura
  scrivi16(coda, 8, centrale.length);
  scrivi16(coda, 10, centrale.length);
  scrivi32(coda, 12, posizione - inizioIndice);
  scrivi32(coda, 16, inizioIndice);
  pezzi.push(coda);

  return new File(pezzi, nomeZip, { type: "application/zip" });
}

// Si puo' aprire il foglio di condivisione del telefono con questi file?
// Lo si chiede PRIMA di mostrare il tasto: su un computer il foglio non
// esiste, e un tasto che non fa niente e' peggio di un tasto che non c'e'.
export function siPuoCondividere(file) {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: file });
  } catch (e) { return false; }
}
