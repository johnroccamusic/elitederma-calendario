// LE DUE REGOLE DEL MODULO DELL'ALLIEVA, scritte una volta sola.
//
// 1. QUELLO CHE HA SCRITTO IL VENDITORE NON SI TOCCA. Se in scheda c'e'
//    gia' un valore, sul modulo si legge e basta: l'allieva non puo'
//    sovrascriverlo. Non e' una gentilezza, e' il punto del flusso —
//    il venditore ha concordato un prezzo e un pacchetto, e quelli
//    devono arrivare in fondo come sono partiti.
//
// 2. SE MANCA QUALCOSA, NON SI SPEDISCE. I campi che tocca a lei devono
//    essere tutti pieni prima che il tasto si accenda.
//
// IL CASO CHE LE FA LITIGARE: non tutti i campi vuoti si possono
// riempire. L'interno non ce l'hanno tutti; la partita IVA e la PEC
// servono solo a chi chiede fattura. Se "vuoto" bastasse a renderli
// obbligatori, chi abita in una villetta non riuscirebbe a spedire il
// modulo e non capirebbe perche'. Per questo c'e' `obbligatorio`: lo
// decide chi configura, campo per campo, dalla pagina in Setting.

// Un campo e' bloccato quando il venditore ci ha gia' messo qualcosa.
// Lo zero e il falso contano come valori scritti: "0 modelle" e "non
// richiede fattura" sono risposte, non vuoti.
export function campoBloccato(valoreScheda) {
  if (valoreScheda === null || valoreScheda === undefined) return false;
  if (typeof valoreScheda === "string") return valoreScheda.trim() !== "";
  return true;
}

export function campoVuoto(valore) {
  if (valore === null || valore === undefined) return true;
  if (typeof valore === "string") return valore.trim() === "";
  if (Array.isArray(valore)) return valore.length === 0;
  return false;
}

// Quali campi deve riempire lei: quelli sul modulo, non bloccati dal
// venditore e dichiarati obbligatori.
// Alcuni campi contano solo in un caso: i dati di fatturazione servono
// se l'intestazione e' "azienda", e a un privato non vanno nemmeno
// chiesti. `soloSe` dice da quale altra risposta dipendono — e guarda
// prima quello che ha risposto l'allieva, poi quello che c'era in
// scheda, perche' la scelta puo' cambiarla lei sul modulo.
export function condizioneSoddisfatta(campo, valoriScheda, risposte) {
  if (!campo?.soloSe) return true;
  const { chiave, valore } = campo.soloSe;
  const adesso = risposte && !campoVuoto(risposte[chiave]) ? risposte[chiave] : valoriScheda?.[chiave];
  return adesso === valore;
}

export function campiDaRiempire(campi, valoriScheda, risposte) {
  return (campi || []).filter(
    (c) => c.incluso !== false
      && c.obbligatorio !== false
      && condizioneSoddisfatta(c, valoriScheda, risposte)
      && !campoBloccato(valoriScheda?.[c.chiave]),
  );
}

// Il modulo si puo' spedire? Torna { puoi, mancanti } — `mancanti` sono
// le etichette da mostrare, non le chiavi: il messaggio lo legge una
// persona.
export function puoSpedire(campi, valoriScheda, risposte) {
  const mancanti = campiDaRiempire(campi, valoriScheda, risposte)
    .filter((c) => campoVuoto(risposte?.[c.chiave]))
    .map((c) => c.etichetta || c.chiave);
  return { puoi: mancanti.length === 0, mancanti };
}
