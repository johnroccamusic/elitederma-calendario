// Generazione del codice referral di una master — un'unica implementazione
// condivisa fra il client (src/App.jsx, "Genera Coupon") e le edge function
// (genera-referral-automatico, la generazione manuale con controllo sul
// registro codici_emessi). Prima erano due copie identiche mantenute a
// mano in due punti diversi, col rischio di divergere nel tempo.
//
// File volutamente senza dipendenze da Deno o dal browser: solo funzioni
// pure, importabile da entrambi gli ambienti con un semplice import
// relativo (Vite lo bundla come un modulo qualunque, Deno lo legge come
// .js nativo).
//
// Formato: 2 iniziali fisse della master + una parte casuale (cifre e
// lettere mescolate). La parte casuale si allunga da sola quando lo
// spazio dei codici per quella master si esaurisce — vedi
// generaCodiceCasuale/livelloIniziale.
//
// Alfabeto ristretto: i codici vengono dettati a voce e ricopiati a
// mano, un carattere ambiguo letto male non lascia traccia, semplicemente
// l'allieva non riceve lo sconto e la master non matura punti senza che
// nessuno capisca perché. Escluse le cifre 0/1/5 (si confondono con
// O/I/S) e le lettere O/I/S.
export const CIFRE_AMMESSE = "2346789";
export const LETTERE_AMMESSE = "ABCDEFGHJKLMNPQRTUVWXYZ"; // A-Z senza O, I, S

export function inizialiMaster(nome) {
  const parole = (nome || "").trim().split(/\s+/).filter(Boolean);
  const lettereNome = parole.map((p) => p[0]).join("").toUpperCase().replace(/[^A-Z]/g, "");
  if (lettereNome.length >= 2) return lettereNome.slice(0, 2);
  const soloLettere = (nome || "").toUpperCase().replace(/[^A-Z]/g, "");
  return (soloLettere.slice(0, 2) || "MM").padEnd(2, "X");
}

// livello 0: 3 cifre + 1 lettera (il formato di sempre)
// livello 1: 4 cifre + 1 lettera
// livello 2: 4 cifre + 2 lettere
// livello 3: 5 cifre + 2 lettere ... e così via, alternando cifra e lettera
export function cifreDiLivello(livello) { return 3 + Math.ceil(livello / 2); }
export function lettereDiLivello(livello) { return 1 + Math.floor(livello / 2); }

function combinazioni(n, k) {
  if (k < 0 || k > n) return 0;
  let risultato = 1;
  for (let i = 0; i < k; i++) risultato = (risultato * (n - i)) / (i + 1);
  return risultato;
}
// quanti codici distinti esistono a un dato livello, per una singola
// coppia di iniziali — usato solo per decidere da quale livello partire
// (mai per bloccare la generazione: quello lo fa il conflitto reale sul
// registro, vedi genera-referral-automatico e la generazione manuale)
export function spazioDiLivello(livello) {
  const nCifre = cifreDiLivello(livello);
  const nLettere = lettereDiLivello(livello);
  const posizioniLettere = combinazioni(nCifre + nLettere, nLettere);
  return posizioniLettere * Math.pow(CIFRE_AMMESSE.length, nCifre) * Math.pow(LETTERE_AMMESSE.length, nLettere);
}
// livello di partenza per una master che ha già "numeroCodiciEsistenti"
// codici con le sue iniziali nel registro: il più basso il cui spazio
// resta ampiamente sopra il numero già emesso, così non si rischia di
// dover salire subito di livello alla prima generazione
export function livelloIniziale(numeroCodiciEsistenti) {
  let livello = 0;
  while (spazioDiLivello(livello) < numeroCodiciEsistenti * 4 && livello < 20) livello++;
  return livello;
}

export function generaCodiceCasuale(nome, livello = 0) {
  const nCifre = cifreDiLivello(livello);
  const nLettere = lettereDiLivello(livello);
  const parti = [
    ...Array.from({ length: nCifre }, () => CIFRE_AMMESSE[Math.floor(Math.random() * CIFRE_AMMESSE.length)]),
    ...Array.from({ length: nLettere }, () => LETTERE_AMMESSE[Math.floor(Math.random() * LETTERE_AMMESSE.length)]),
  ];
  for (let i = parti.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parti[i], parti[j]] = [parti[j], parti[i]];
  }
  return `${inizialiMaster(nome)}${parti.join("")}`;
}
