// Un QR code, senza aggiungere una libreria.
//
// Serve per una cosa sola: stampare il codice che la modella inquadra
// per aprire il suo consenso. Sei dipendenze in tutto il progetto sono
// una scelta, e per disegnare quaranta quadratini non vale la pena
// diventare sette.
//
// Quindi: solo modalita' byte, solo correzione M (recupera il 15%: un
// foglio stampato si sgualcisce, si macchia, e M e' il compromesso che
// usano quasi tutti), versioni da 1 a 10 — fino a 213 byte, tre
// volte quello che serve all'indirizzo piu' lungo che ci passera' mai.
//
// Non e' codice da leggere per capirlo: e' l'attuazione riga per riga
// della ISO/IEC 18004. I test lo confrontano quadratino per quadratino
// con un'implementazione di riferimento, ed e' li' che si vede se e'
// giusto, non qui.

// --- aritmetica del campo di Galois GF(256), quella dei Reed-Solomon ---
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function tabelle() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // polinomio primitivo dello standard
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const moltiplica = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Il polinomio generatore per n codeword di correzione. */
function generatore(n) {
  let g = [1];
  for (let i = 0; i < n; i += 1) {
    const nuovo = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j += 1) {
      nuovo[j] ^= g[j];
      nuovo[j + 1] ^= moltiplica(g[j], EXP[i]);
    }
    g = nuovo;
  }
  return g;
}

/** Le codeword di correzione di un blocco di dati. */
function correzione(dati, quante) {
  const g = generatore(quante);
  const resto = new Array(quante).fill(0);
  for (const byte of dati) {
    const guida = byte ^ resto[0];
    resto.shift();
    resto.push(0);
    if (guida !== 0) {
      for (let i = 0; i < quante; i += 1) resto[i] ^= moltiplica(g[i + 1], guida);
    }
  }
  return resto;
}

// --- tabelle dello standard, solo per la correzione M ---
// [codeword di correzione per blocco, blocchi corti, dati per blocco corto,
//  blocchi lunghi (uno in piu' di dati ciascuno)]
const STRUTTURA_M = {
  1: [10, 1, 16, 0],
  2: [16, 1, 28, 0],
  3: [26, 1, 44, 0],
  4: [18, 2, 32, 0],
  5: [24, 2, 43, 0],
  6: [16, 4, 27, 0],
  7: [18, 4, 31, 0],
  8: [22, 2, 38, 2],
  9: [22, 3, 36, 2],
  10: [26, 4, 43, 1],
};

const ALLINEAMENTI = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** Quanti byte di dati ci stanno in una versione, correzione M. */
function capacita(versione) {
  const [, corti, datiCorti, lunghi] = STRUTTURA_M[versione];
  return corti * datiCorti + lunghi * (datiCorti + 1);
}

/** La versione piu' piccola che contiene questi byte. */
function versionePer(quantiByte) {
  for (let v = 1; v <= 10; v += 1) {
    // indicatore di modo (4 bit) + contatore (8 bit fino alla 9, 16 dalla 10)
    const intestazione = v <= 9 ? 12 : 20;
    if (capacita(v) * 8 >= intestazione + quantiByte * 8) return v;
  }
  return null;
}

/** I byte del messaggio: intestazione, dati, terminatore, riempimento. */
function codewordDati(byte, versione) {
  const bit = [];
  const scrivi = (valore, quanti) => {
    for (let i = quanti - 1; i >= 0; i -= 1) bit.push((valore >> i) & 1);
  };
  scrivi(0b0100, 4);                       // modalita' byte
  scrivi(byte.length, versione <= 9 ? 8 : 16);
  byte.forEach((b) => scrivi(b, 8));

  const totaleBit = capacita(versione) * 8;
  // terminatore: fino a quattro zeri, ma non oltre la fine
  for (let i = 0; i < 4 && bit.length < totaleBit; i += 1) bit.push(0);
  while (bit.length % 8 !== 0) bit.push(0);

  const codeword = [];
  for (let i = 0; i < bit.length; i += 8) {
    codeword.push(bit.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  }
  // riempimento: 236 e 17 alternati, come dice lo standard
  const riempimento = [0xec, 0x11];
  let k = 0;
  while (codeword.length < capacita(versione)) {
    codeword.push(riempimento[k % 2]);
    k += 1;
  }
  return codeword;
}

/** Blocchi, correzione, e l'intreccio finale. */
function codewordFinali(byte, versione) {
  const dati = codewordDati(byte, versione);
  const [quanteEc, corti, datiCorti, lunghi] = STRUTTURA_M[versione];

  const blocchi = [];
  let da = 0;
  for (let i = 0; i < corti + lunghi; i += 1) {
    const quanti = i < corti ? datiCorti : datiCorti + 1;
    const blocco = dati.slice(da, da + quanti);
    da += quanti;
    blocchi.push({ dati: blocco, ec: correzione(blocco, quanteEc) });
  }

  // i blocchi si intrecciano: primo byte di ogni blocco, poi il secondo…
  const fuori = [];
  const massimo = Math.max(...blocchi.map((b) => b.dati.length));
  for (let i = 0; i < massimo; i += 1) {
    blocchi.forEach((b) => { if (i < b.dati.length) fuori.push(b.dati[i]); });
  }
  for (let i = 0; i < quanteEc; i += 1) {
    blocchi.forEach((b) => fuori.push(b.ec[i]));
  }
  return fuori;
}

// --- la griglia ---
const LIBERO = -1;

function grigliaVuota(versione) {
  const lato = versione * 4 + 17;
  const m = [];
  for (let r = 0; r < lato; r += 1) m.push(new Array(lato).fill(LIBERO));
  return m;
}

function disegnaFissi(m, versione) {
  const lato = m.length;
  const mettiFinder = (riga, colonna) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = riga + r;
        const cc = colonna + c;
        if (rr < 0 || rr >= lato || cc < 0 || cc >= lato) continue;
        const bordo = r === -1 || r === 7 || c === -1 || c === 7;
        const dentro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const cornice = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        m[rr][cc] = bordo ? 0 : (dentro || cornice) ? 1 : 0;
      }
    }
  };
  mettiFinder(0, 0);
  mettiFinder(0, lato - 7);
  mettiFinder(lato - 7, 0);

  // righe di sincronismo
  for (let i = 8; i < lato - 8; i += 1) {
    const v = i % 2 === 0 ? 1 : 0;
    m[6][i] = v;
    m[i][6] = v;
  }

  // quadratini di allineamento, tranne dove ci sono gia' i finder
  const posizioni = ALLINEAMENTI[versione];
  posizioni.forEach((r) => posizioni.forEach((c) => {
    const suFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= lato - 9) || (r >= lato - 9 && c <= 8);
    if (suFinder) return;
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const bordo = Math.max(Math.abs(dr), Math.abs(dc));
        m[r + dr][c + dc] = bordo === 1 ? 0 : 1;
      }
    }
  }));

  // il modulo sempre nero
  m[lato - 8][8] = 1;

  // lo spazio del formato si riserva adesso, si riempie dopo la maschera
  for (let i = 0; i <= 8; i += 1) {
    if (m[8][i] === LIBERO) m[8][i] = 0;
    if (m[i][8] === LIBERO) m[i][8] = 0;
  }
  for (let i = 0; i < 8; i += 1) {
    if (m[8][lato - 1 - i] === LIBERO) m[8][lato - 1 - i] = 0;
    if (m[lato - 1 - i][8] === LIBERO) m[lato - 1 - i][8] = 0;
  }

  // dalla versione 7 c'e' anche il blocco che dichiara la versione
  if (versione >= 7) {
    const bit = bitVersione(versione);
    for (let i = 0; i < 18; i += 1) {
      const b = (bit >> i) & 1;
      const r = Math.floor(i / 3);
      const c = lato - 11 + (i % 3);
      m[r][c] = b;
      m[c][r] = b;
    }
  }
}

/** I 18 bit che dichiarano la versione: 6 di numero + 12 di BCH. */
function bitVersione(versione) {
  let resto = versione << 12;
  for (let i = 0; i < 12; i += 1) {
    if ((resto >> (17 - i)) & 1) resto ^= 0x1f25 << (5 - i);
  }
  return (versione << 12) | (resto & 0xfff);
}

/** I 15 bit del formato: correzione M, maschera, BCH e mascheratura finale. */
function bitFormato(maschera) {
  const dati = (0b00 << 3) | maschera; // 00 = correzione M
  let resto = dati << 10;
  for (let i = 0; i < 5; i += 1) {
    if ((resto >> (14 - i)) & 1) resto ^= 0x537 << (4 - i);
  }
  return ((dati << 10) | (resto & 0x3ff)) ^ 0x5412;
}

function scriviFormato(m, maschera) {
  const lato = m.length;
  const bit = bitFormato(maschera);
  const b = (i) => (bit >> i) & 1;
  // prima copia, attorno al finder in alto a sinistra: scende lungo la
  // colonna 8 e poi gira verso sinistra sulla riga 8
  for (let i = 0; i <= 5; i += 1) m[i][8] = b(i);
  m[7][8] = b(6);
  m[8][8] = b(7);
  m[8][7] = b(8);
  for (let i = 9; i <= 14; i += 1) m[8][14 - i] = b(i);
  // seconda copia, spezzata fra gli altri due angoli: prima verso destra
  // sulla riga 8, poi in basso lungo la colonna 8
  for (let i = 0; i <= 7; i += 1) m[8][lato - 1 - i] = b(i);
  for (let i = 8; i <= 14; i += 1) m[lato - 15 + i][8] = b(i);
  // il modulo sempre nero sta in mezzo al tratto verticale della seconda
  // copia, e va rimesso dopo: il giro qui sopra ci passa sopra
  m[lato - 8][8] = 1;
}

const mascheraAttiva = (numero, r, c) => [
  (r + c) % 2 === 0,
  r % 2 === 0,
  c % 3 === 0,
  (r + c) % 3 === 0,
  (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  ((r * c) % 2) + ((r * c) % 3) === 0,
  (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
][numero];

/** I dati si infilano a serpentina, dal basso a destra, due colonne per volta. */
function scriviDati(m, codeword, maschera) {
  const lato = m.length;
  const bit = [];
  codeword.forEach((cw) => { for (let i = 7; i >= 0; i -= 1) bit.push((cw >> i) & 1); });

  let indice = 0;
  let versoAlto = true;
  for (let colonna = lato - 1; colonna > 0; colonna -= 2) {
    if (colonna === 6) colonna -= 1; // la colonna di sincronismo si salta
    for (let passo = 0; passo < lato; passo += 1) {
      const r = versoAlto ? lato - 1 - passo : passo;
      for (const c of [colonna, colonna - 1]) {
        if (m[r][c] !== LIBERO) continue;
        const b = indice < bit.length ? bit[indice] : 0;
        indice += 1;
        m[r][c] = mascheraAttiva(maschera, r, c) ? b ^ 1 : b;
      }
    }
    versoAlto = !versoAlto;
  }
}

/** Le quattro penalita' dello standard: vince la maschera che fa meno danno. */
function penalita(m) {
  const lato = m.length;
  let totale = 0;

  // 1. file di cinque o piu' moduli uguali
  const fila = (leggi) => {
    for (let a = 0; a < lato; a += 1) {
      let corrente = leggi(a, 0);
      let quanti = 1;
      for (let b = 1; b < lato; b += 1) {
        const v = leggi(a, b);
        if (v === corrente) { quanti += 1; continue; }
        if (quanti >= 5) totale += 3 + (quanti - 5);
        corrente = v;
        quanti = 1;
      }
      if (quanti >= 5) totale += 3 + (quanti - 5);
    }
  };
  fila((r, c) => m[r][c]);
  fila((c, r) => m[r][c]);

  // 2. quadrati 2x2 dello stesso colore
  for (let r = 0; r < lato - 1; r += 1) {
    for (let c = 0; c < lato - 1; c += 1) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) totale += 3;
    }
  }

  // 3. la sagoma che assomiglia a un finder
  const SAGOMA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const cerca = (leggi) => {
    for (let a = 0; a < lato; a += 1) {
      for (let b = 0; b <= lato - 11; b += 1) {
        let avanti = true;
        let indietro = true;
        for (let i = 0; i < 11; i += 1) {
          if (leggi(a, b + i) !== SAGOMA[i]) avanti = false;
          if (leggi(a, b + i) !== SAGOMA[10 - i]) indietro = false;
        }
        if (avanti || indietro) totale += 40;
      }
    }
  };
  cerca((r, c) => m[r][c]);
  cerca((c, r) => m[r][c]);

  // 4. quanto si sbilancia il rapporto fra nero e bianco
  let neri = 0;
  m.forEach((riga) => riga.forEach((v) => { if (v) neri += 1; }));
  const percentuale = (neri * 100) / (lato * lato);
  totale += Math.floor(Math.abs(percentuale - 50) / 5) * 10;

  return totale;
}

/**
 * La griglia del QR per questo testo: un array di array di 0 e 1, senza
 * il margine bianco attorno (lo mette chi disegna, vedi qrSvg).
 *
 * Torna null se il testo non ci sta: oltre i 213 byte servirebbe una
 * versione piu' alta di quelle implementate. Meglio niente che un QR
 * che sembra giusto e non si legge.
 */
export function matriceQr(testo) {
  const byte = Array.from(new TextEncoder().encode(String(testo ?? "")));
  const versione = versionePer(byte.length);
  if (!versione) return null;

  const codeword = codewordFinali(byte, versione);
  let migliore = null;
  for (let maschera = 0; maschera < 8; maschera += 1) {
    const m = grigliaVuota(versione);
    disegnaFissi(m, versione);
    scriviDati(m, codeword, maschera);
    scriviFormato(m, maschera);
    const p = penalita(m);
    if (!migliore || p < migliore.p) migliore = { m, p };
  }
  return migliore.m;
}

/**
 * Lo stesso QR come SVG, pronto da mettere in un <img> o da stampare.
 *
 * Il margine di quattro moduli non e' decorazione: senza, un telefono
 * fatica a trovare il codice sul foglio. Lo dice lo standard e si vede
 * subito provando.
 */
export function qrSvg(testo, { lato = 240, margine = 4, colore = "#000", sfondo = "#fff" } = {}) {
  const m = matriceQr(testo);
  if (!m) return null;
  const moduli = m.length + margine * 2;
  const quadrati = [];
  for (let r = 0; r < m.length; r += 1) {
    for (let c = 0; c < m.length; c += 1) {
      if (m[r][c]) quadrati.push(`M${c + margine} ${r + margine}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 ${moduli} ${moduli}" shape-rendering="crispEdges"><rect width="${moduli}" height="${moduli}" fill="${sfondo}"/><path d="${quadrati.join("")}" fill="${colore}"/></svg>`;
}
