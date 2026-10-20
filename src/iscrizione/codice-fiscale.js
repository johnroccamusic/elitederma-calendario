// LA SEDICESIMA LETTERA DEL CODICE FISCALE NON E' UNA LETTERA QUALSIASI.
//
// E' una somma di controllo delle altre quindici: se non torna, il
// codice e' scritto male. Non serve chiedere niente a nessuno e non
// serve una connessione — e' aritmetica.
//
// PERCHE' VALE LA PENA. Il 20/10/2026, passando questo calcolo sui 247
// codici in archivio, 11 non lo superavano: arrivano dal modulo del
// sito, scritti a mano da chi si iscriveva. Un codice fiscale sbagliato
// non si vede — sedici caratteri maiuscoli sono una macchia uguale a
// un'altra — e si scopre settimane dopo, quando la fattura non parte.
//
// PRESO UN ERRORE ANCHE A ME: leggendo un modulo da una foto avevo
// trascritto `1422` dove c'era `I422`. Il controllo l'ha detto subito.

// Le due tabelle della regola: i caratteri in posizione dispari valgono
// diversamente da quelli in posizione pari.
const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISPARI = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 1, 0, 5, 7, 9, 13, 15, 17, 19, 21,
                 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
const RESTO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** La lettera di controllo che i primi quindici caratteri richiedono,
 *  oppure null se quello che c'e' non ha nemmeno la forma giusta. */
export function letteraDiControllo(codice) {
  const c = String(codice ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{15,16}$/.test(c)) return null;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const p = ALFABETO.indexOf(c[i]);
    // la posizione si conta da 1: la prima e' dispari
    somma += i % 2 === 0 ? DISPARI[p] : (c[i] >= "0" && c[i] <= "9" ? p : p - 10);
  }
  return RESTO[somma % 26];
}

/** Un avviso da mostrare sotto la casella, o null se non c'e' niente da
 *  dire. Tace sul campo vuoto e su quello ancora a meta': li' parla
 *  gia' l'avviso sulla lunghezza, e due righe rosse sotto la stessa
 *  casella sembrano due guasti invece di uno. */
export function avvisoCodiceFiscale(valore) {
  const c = String(valore ?? "").trim().toUpperCase();
  if (c.length !== 16) return null;
  if (!/^[A-Z0-9]{16}$/.test(c)) {
    return "Questo codice fiscale ha caratteri che non possono esserci: solo lettere e numeri.";
  }
  const attesa = letteraDiControllo(c);
  if (attesa === c[15]) return null;
  // NON SI DICE QUALE SAREBBE LA LETTERA GIUSTA, ed e' voluto.
  //
  // Dirla inviterebbe a cambiare l'ultima e andare avanti — ma
  // l'ultima e' calcolata dalle altre quindici, quindi quasi sempre
  // l'errore e' in una di quelle. Correggendo la sedicesima si
  // otterrebbe un codice che supera il controllo ed e' comunque di
  // un'altra persona: il guasto di prima, reso invisibile.
  return "Questo codice fiscale non torna: l'ultimo carattere è una verifica degli altri quindici e non corrisponde. Ricontrollalo sul documento.";
}

// LA FORMA DEL CODICE, POSIZIONE PER POSIZIONE.
//
//   1-6   lettere   (tre del cognome, tre del nome)
//   7-8   cifre     (anno)
//   9     lettera   (mese, e solo dodici lettere su ventisei)
//   10-11 cifre     (giorno, +40 per le donne)
//   12    lettera   (la prima del codice del comune)
//   13-15 cifre     (le altre tre del comune)
//   16    lettera   (il controllo)
const FORMA = "LLLLLLDDMDDLDDDL";
const MESI = "ABCDEHLMPRST";

// Le confusioni di chi copia da uno schermo o da una tessera: una cifra
// letta come lettera e viceversa. Si raddrizzano SOLO dove la forma
// dice senza ambiguita' cosa ci va.
const A_CIFRA   = { O: "0", Q: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6" };
const A_LETTERA = { 0: "O", 1: "I", 2: "Z", 5: "S", 8: "B", 6: "G" };

/** Quello che la casella lascia entrare, carattere per carattere.
 *
 *  PERCHE' NON SEDICI CASELLE SEPARATE. Risolverebbero la lunghezza,
 *  che era gia' detta, e romperebbero l'incollatura — che e' come la
 *  maggioranza scrive un codice fiscale. Il problema vero sono i
 *  CARATTERI sbagliati, e quelli li prende questa regola.
 *
 *  Misurato sugli undici codici sbagliati trovati in archivio il
 *  20/10/2026: due si raddrizzano da soli, cinque si fermano mentre si
 *  scrive (e li' parla l'avviso sulla lunghezza), quattro hanno la
 *  forma giusta e li prende solo la lettera di controllo. Insieme
 *  coprono tutti e undici; nessuno dei due da solo basta. */
export function filtraCodiceFiscale(testo) {
  const fuori = [];
  for (const grezzo of String(testo ?? "").toUpperCase()) {
    if (fuori.length >= 16) break;
    // spazi, punti e trattini sono rumore di chi incolla: si saltano
    if (!/[A-Z0-9]/.test(grezzo)) continue;

    const atteso = FORMA[fuori.length];
    let buono = null;
    if (atteso === "D") buono = /[0-9]/.test(grezzo) ? grezzo : A_CIFRA[grezzo];
    else if (atteso === "M") {
      const forse = MESI.includes(grezzo) ? grezzo : A_LETTERA[grezzo];
      buono = MESI.includes(forse) ? forse : null;
    } else buono = /[A-Z]/.test(grezzo) ? grezzo : A_LETTERA[grezzo];

    // SI FERMA, NON SALTA. Saltare il carattere che non ci sta farebbe
    // scalare tutto il resto di una posizione: «BRNSFNY8R70H501K»
    // diventerebbe «BRNSFN87H50I», cioe' un codice DIVERSO e con la
    // faccia giusta — il guasto di prima, reso invisibile.
    //
    // Fermandosi, la casella resta corta: parla l'avviso sulla
    // lunghezza, e parla mentre la persona e' ancora davanti.
    if (!buono) break;
    fuori.push(buono);
  }
  return fuori.join("");
}
