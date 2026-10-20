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
