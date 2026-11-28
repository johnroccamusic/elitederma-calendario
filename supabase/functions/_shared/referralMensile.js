// Il referral personale delle master dura un mese di calendario.
//
// Deciso dal titolare il 28/10/2026: ogni mese il codice che una master
// da' ai clienti scade, al suo posto ne nasce uno nuovo, e quello vecchio
// smette di funzionare e sparisce. Un codice che gira per sempre finisce
// nei gruppi, sui siti di sconti, nelle chat di chi non e' mai stato
// cliente di nessuna: rinnovarlo ogni mese lo tiene nelle mani di chi l'ha
// ricevuto dalla master.
//
// Qui stanno solo le regole, senza Deno e senza browser, come
// codiceReferral.js: le legge la edge function `ruota-referral-master`,
// che fa il lavoro, e l'app, che deve mostrare il codice giusto e
// nasconde quelli finiti. Due copie della stessa regola vorrebbero dire
// un'app che mostra un codice che il sito ha gia' spento.
//
// IL MESE E' QUELLO DI ROMA. Il cron gira in UTC: a mezzanotte e cinque
// del primo del mese, in Italia, a Londra e' ancora l'ultimo giorno. Il
// giorno si legge sempre sul fuso di Roma, mai con toISOString().
//
// «SPARISCE» NON VUOL DIRE «SI CANCELLA LA RIGA». Dal sito il codice
// vecchio si cancella davvero; nell'app la riga resta, segnata
// `scaduto` e nascosta da ogni elenco, perche' e' lei che dice di chi
// erano le vendite fatte con quel codice: la vista dei punti
// (v_punti_master_righe) trova la master dal codice. Cancellarla
// toglierebbe alle master i punti dei mesi passati.

export function giornoRoma(istante = new Date()) {
  const parti = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(istante);
  const p = Object.fromEntries(parti.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// l'ultimo giorno del mese di `giorno` ("aaaa-mm-gg"): fin li' il codice
// vale, compreso
export function ultimoGiornoDelMese(giorno) {
  const [a, m] = String(giorno).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

// il primo giorno del mese dopo. E' la scadenza da scrivere su
// WooCommerce, che non la intende come noi: per il sito un coupon scade
// alle 00:00 del giorno indicato, quindi "fino al 30" sul sito si scrive
// "il 1°". Scrivere l'ultimo del mese lo spegnerebbe un giorno prima.
export function primoDelMeseDopo(giorno) {
  const [a, m] = String(giorno).split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return d.toISOString().slice(0, 10);
}

// Il referral personale e' il codice di una master senza edizione, su
// tutto il catalogo. Restano fuori, e non ruotano:
//  - il codice con cui la master COMPRA (serie acquisto_master): sconta
//    a lei, non ai suoi clienti, e non e' stato chiesto;
//  - i codici ristretti a certe categorie, come need30 di Tommaso
//    Giumbini: non sono il suo referral, sono uno sconto d'aula senza
//    edizione;
//  - i codici d'aula, che hanno gia' la loro scadenza a fine corso.
export function eReferralPersonale(c) {
  if (!c || !c.master_id || c.corsi_date_id) return false;
  if (c.serie_regole === "acquisto_master") return false;
  if ((c.ambito || "tutto") !== "tutto") return false;
  if ((c.categorie_ids || []).length || (c.prodotti_ids || []).length) return false;
  return true;
}

// spento per sempre: ritirato dalla rotazione, o annullato a mano
export function eSpento(c) {
  return c?.stato === "scaduto" || c?.stato === "annullato";
}

// vale oggi: non spento, e oggi dentro la sua finestra
export function valeOggi(c, oggi) {
  if (!c || eSpento(c)) return false;
  if (c.valido_da && oggi < c.valido_da) return false;
  if (c.valido_fino_a && oggi > c.valido_fino_a) return false;
  return true;
}

// Il referral che una master ha in mano oggi. Se per un istante ce ne
// fossero due (il nuovo appena nato, il vecchio non ancora ritirato),
// vince quello che scade piu' tardi: e' il nuovo.
export function referralDiOggi(coupon, masterId, oggi) {
  const validi = (coupon || []).filter((c) => c.master_id === masterId && eReferralPersonale(c) && valeOggi(c, oggi));
  validi.sort((a, b) => String(b.valido_fino_a || "9999").localeCompare(String(a.valido_fino_a || "9999"))
    || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return validi[0] || null;
}

// Cosa c'e' da fare oggi. Non scrive niente: lo decide e basta, cosi'
// che il giro di prova e quello vero facciano esattamente gli stessi
// conti.
//
//  adottare  codici senza scadenza, nati prima di questa regola (o fuori
//            da questa strada): non si cambiano a meta' mese — qualcuno
//            ce li ha gia' in mano — ma prendono la fine del mese
//            corrente, e da li' ruotano come gli altri;
//  ruotare   una master per ogni gruppo di codici finiti senza un
//            sostituto valido: le nasce il codice nuovo, che copia
//            l'accordo di quello vecchio (sconto, fasce, limiti) e
//            cambia solo il codice e la scadenza;
//  ritirare  ogni codice finito ancora acceso: si cancella dal sito e si
//            segna scaduto.
export function pianoDelGiorno(coupon, oggi) {
  const personali = (coupon || []).filter((c) => eReferralPersonale(c) && !eSpento(c));
  const adottare = personali.filter((c) => !c.valido_fino_a && (c.stato === "attivo" || c.stato === "bozza"));
  const finiti = personali.filter((c) => c.valido_fino_a && c.valido_fino_a < oggi);
  const perMaster = new Map();
  finiti.forEach((c) => {
    if (!perMaster.has(c.master_id)) perMaster.set(c.master_id, []);
    perMaster.get(c.master_id).push(c);
  });
  const ruotare = [];
  perMaster.forEach((vecchi, masterId) => {
    if (referralDiOggi(coupon, masterId, oggi)) return;
    // l'accordo si copia dal piu' recente: se nel frattempo qualcuno
    // l'ha cambiato, vale l'ultima parola
    const modello = [...vecchi].sort((a, b) => String(b.valido_fino_a).localeCompare(String(a.valido_fino_a))
      || String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
    ruotare.push({ masterId, modello });
  });
  return {
    oggi,
    validoFinoA: ultimoGiornoDelMese(oggi),
    scadenzaSito: primoDelMeseDopo(oggi),
    adottare,
    ruotare,
    ritirare: finiti,
  };
}

// La riga del codice nuovo: l'accordo del vecchio, il codice e la
// scadenza nuovi. Nasce "bozza" come ogni coupon: diventa "attivo" solo
// quando woo-crea-coupon l'ha creato davvero sul sito.
export function rigaCodiceNuovo(modello, codice, validoFinoA, nomeMaster) {
  return {
    codice,
    descrizione: `Referral — ${nomeMaster || ""}`.trim(),
    tipo_sconto: modello.tipo_sconto || "percent",
    base_sconto: modello.base_sconto || "lordo",
    valore: modello.valore,
    valore_woo: modello.valore_woo ?? null,
    tipo_regola_sconto: modello.tipo_regola_sconto || "semplice",
    fasce_sconto: modello.fasce_sconto ?? null,
    valido_da: null,
    valido_fino_a: validoFinoA,
    ambito: "tutto",
    utilizzi_max: modello.utilizzi_max ?? null,
    utilizzi_max_per_utente: modello.utilizzi_max_per_utente ?? null,
    spesa_minima: modello.spesa_minima ?? null,
    non_cumulabile: modello.non_cumulabile ?? true,
    limita_a_email: modello.limita_a_email ?? null,
    escludi_categorie_ids: modello.escludi_categorie_ids ?? null,
    escludi_prodotti_ids: modello.escludi_prodotti_ids ?? null,
    punti_valore: modello.punti_valore ?? null,
    punti_ogni_euro: modello.punti_ogni_euro ?? null,
    serie_regole: modello.serie_regole ?? null,
    stato: "bozza",
    master_id: modello.master_id,
    generato_da_cron: false,
    creato_da: "rotazione_mensile",
  };
}
