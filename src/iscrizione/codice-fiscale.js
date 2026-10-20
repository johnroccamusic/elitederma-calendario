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

import { codiceCatastale, codiceCatastaleStato } from "../comuni-regioni.js";

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

// ---------------------------------------------------------------- calcolo
//
// IL CODICE FISCALE SI CALCOLA: non e' un dato da chiedere, e' una
// conseguenza di cognome, nome, sesso, data e luogo di nascita. L'ha
// scritto l'Agenzia delle Entrate, e qui si ripete la sua regola.
//
// DUE COSE DA DIRE, SEMPRE, quando lo si mostra:
//
//   * L'OMOCODIA. Quando due persone otterrebbero lo stesso codice,
//     l'Agenzia ne cambia alcune cifre in lettere. Il calcolo non lo
//     puo' sapere. Per questo il risultato va proposto come
//     SUGGERIMENTO CORREGGIBILE, mai scritto d'autorita'.
//   * Chi un codice italiano non ce l'ha proprio. Li' il campo resta
//     libero e il calcolo tace.

const CONSONANTI = (t) => t.split("").filter((c) => /[A-Z]/.test(c) && !VOCALI.includes(c));
const VOCALI_DI = (t) => t.split("").filter((c) => VOCALI.includes(c));
const VOCALI = "AEIOU";

function soloLettere(t) {
  return String(t ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toUpperCase().replace(/[^A-Z]/g, "");
}

/** Le tre lettere del cognome: consonanti, poi vocali, poi X. */
export function treDelCognome(cognome) {
  const t = soloLettere(cognome);
  return (CONSONANTI(t).join("") + VOCALI_DI(t).join("") + "XXX").slice(0, 3);
}

/** Le tre del nome, con la regola che lo distingue dal cognome: con
 *  quattro o piu' consonanti si prendono la PRIMA, la TERZA e la QUARTA.
 *  Senza di questa, Marco e Mario avrebbero lo stesso gruppo. */
export function treDelNome(nome) {
  const t = soloLettere(nome);
  const cons = CONSONANTI(t);
  if (cons.length >= 4) return cons[0] + cons[2] + cons[3];
  return (cons.join("") + VOCALI_DI(t).join("") + "XXX").slice(0, 3);
}

/** Il codice fiscale, o "" se manca un ingrediente o il luogo non si
 *  riconosce. Non tira a indovinare: o lo sa, o tace. */
export function calcolaCodiceFiscale({ cognome, nome, sesso, dataNascita, comuneNascita, statoNascita } = {}) {
  const c = soloLettere(cognome);
  const n = soloLettere(nome);
  if (!c || !n) return "";

  const giorni = String(dataNascita ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!giorni) return "";
  const [, anno, mese, giorno] = giorni.map(Number).length ? giorni : [];
  const m = Number(mese), g = Number(giorno);
  if (m < 1 || m > 12 || g < 1 || g > 31) return "";

  // Sesso mancante = niente calcolo. Senza questo controllo un sesso
  // non dichiarato passava per maschile, e quello che usciva era un
  // codice valido — lettera di controllo giusta — di un'altra persona:
  // il peggiore dei risultati possibili, perche' nessuno lo mette in
  // dubbio.
  const s = String(sesso ?? "").trim().toUpperCase().slice(0, 1);
  if (s !== "F" && s !== "M") return "";
  const femmina = s === "F";
  const luogo = String(statoNascita ?? "").trim()
    ? codiceCatastaleStato(statoNascita)
    : codiceCatastale(comuneNascita);
  if (!luogo) return "";

  const primi15 = treDelCognome(c) + treDelNome(n)
    + String(anno).slice(-2)
    + MESI[m - 1]
    + String(g + (femmina ? 40 : 0)).padStart(2, "0")
    + luogo;
  return primi15 + letteraDiControllo(primi15 + "X");
}

/** Quello che il codice fiscale DICE di chi lo porta: sesso, data e
 *  luogo di nascita. Serve a confrontarlo con quello che la persona ha
 *  scritto — se non combaciano, uno dei due e' sbagliato, e il momento
 *  per accorgersene e' adesso. */
export function leggiCodiceFiscale(codice) {
  const cf = String(codice ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return null;
  const m = MESI.indexOf(cf[8]);
  const gg = Number(cf.slice(9, 11));
  if (m < 0 || !Number.isFinite(gg)) return null;
  const femmina = gg > 40;
  const giorno = femmina ? gg - 40 : gg;
  if (giorno < 1 || giorno > 31) return null;
  return {
    sesso: femmina ? "F" : "M",
    giorno,
    mese: m + 1,
    // l'anno ha due cifre sole: il secolo non c'e' scritto
    anniDue: cf.slice(6, 8),
    luogo: cf.slice(11, 15),
  };
}

/** Un avviso quando il codice scritto contraddice la data di nascita
 *  dichiarata. Tace se uno dei due manca: non si rimprovera chi non ha
 *  ancora finito di scrivere. */
export function avvisoCoerenza(codice, { dataNascita, sesso } = {}) {
  const letto = leggiCodiceFiscale(codice);
  if (!letto) return null;
  const d = String(dataNascita ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) {
    const [, anno, mese, giorno] = d;
    if (anno.slice(-2) !== letto.anniDue || Number(mese) !== letto.mese || Number(giorno) !== letto.giorno) {
      return "Il codice fiscale dice una data di nascita diversa da quella scritta qui sopra: controlla quale delle due è giusta.";
    }
  }
  const s = String(sesso ?? "").trim().toUpperCase();
  if (s && s[0] !== letto.sesso) {
    return "Il codice fiscale dice un sesso diverso da quello indicato.";
  }
  return null;
}
