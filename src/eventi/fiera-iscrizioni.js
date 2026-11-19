// LE ISCRIZIONI CHIUSE AL BANCO DI UNA FIERA (8/11/2026).
//
// Chiesto dal titolare con la fiera di Napoli aperta: un flag «Vendita
// fiera» in cima alla scheda di iscrizione, e nella scheda della fiera
// l'elenco dei corsi che si stanno chiudendo li'.
//
// Qui dentro c'e' SOLO IL CONTO, senza niente che si disegni: lo
// leggono la scheda del venditore (il flag, in App.jsx) e la scheda
// della fiera (Gestione eventi). Due copie di «quali iscrizioni sono di
// questa fiera» vorrebbero dire due numeri diversi sulla stessa fiera,
// e quello sbagliato sarebbe sempre quello che si guarda.
//
// PERCHE' IL FLAG PORTA LA FIERA E NON UN SI'/NO: vedi la migrazione
// 20261108120000. In breve: la sezione sta dentro UN evento, e un
// booleano farebbe comparire le iscrizioni di Napoli anche nella scheda
// di ogni fiera successiva.

// QUANTI GIORNI DOPO LA FINE SI PUO' ANCORA FLAGGARE.
//
// Non e' un dettaglio: al banco si incassa e si corre, e le schede si
// sistemano il lunedi'. Se la tendina offrisse solo le fiere aperte
// adesso, il giorno dopo la chiusura non si potrebbe piu' dire da dove
// veniva quell'iscrizione — e nessuno tornerebbe a cercarla.
export const GIORNI_DI_CODA = 7;

// IL GIORNO DI CALENDARIO A ROMA DI UN ISTANTE.
//
// `iscritti.ts` e' un istante in UTC, le date della fiera sono giorni.
// Tagliare la stringa (`ts.slice(0, 10)`) sarebbe il giorno UTC: una
// scheda salvata alle 00:30 del 9 novembre a Roma e' ancora l'8 in UTC,
// e cadrebbe nel giorno sbagliato. Qui il giorno si chiede al fuso in
// cui quella persona stava compilando.
export function giornoRoma(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const q = (t) => (p.find((x) => x.type === t) || {}).value || "";
  return `${q("year")}-${q("month")}-${q("day")}`;
}

/** Il giorno di oggi a Roma, nella forma 2026-11-08. */
export function oggiRoma() {
  return giornoRoma(new Date().toISOString());
}

/** I giorni della fiera, come due stringhe ordinate. */
export function periodoFiera(evento) {
  const dal = evento?.data_inizio || "";
  const al = evento?.data_fine || dal;
  if (!dal) return null;
  return al < dal ? { dal: al, al: dal } : { dal, al };
}

/** Quell'istante cade nei giorni della fiera? */
export function nelPeriodo(evento, ts) {
  const p = periodoFiera(evento);
  const g = giornoRoma(ts);
  if (!p || !g) return false;
  return g >= p.dal && g <= p.al;
}

// LE FIERE CHE IL FLAG PUO' NOMINARE.
//
// Quelle in corso adesso, piu' quelle finite da pochi giorni (vedi
// GIORNI_DI_CODA), piu' SEMPRE quella che e' gia' scritta sulla scheda —
// anche se vecchia di un anno: una tendina che non contiene il valore
// che sta mostrando e' una tendina che lo cancella al primo tocco.
//
// Le fiere annullate restano fuori: non c'e' stato nessun banco.
export function fiereDaFlaggare(eventi, { oggi = null, giaScelta = "" } = {}) {
  const g = oggi || oggiRoma();
  const limite = giorniPrima(g, GIORNI_DI_CODA);
  const dentro = (e) => {
    const p = periodoFiera(e);
    if (!p) return false;
    if (e.stato === "annullato") return false;
    // non ancora cominciata ma gia' in calendario: si puo' chiudere
    // un'iscrizione «alla fiera» il giorno prima di partire
    return p.al >= limite;
  };
  return (eventi || [])
    .filter((e) => e && e.id && (dentro(e) || e.id === giaScelta))
    .sort((a, b) => String(b.data_inizio || "").localeCompare(String(a.data_inizio || "")));
}

/** Il giorno di N giorni prima, in forma 2026-11-01. */
export function giorniPrima(giorno, quanti) {
  const d = new Date(`${giorno}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return giorno;
  d.setUTCDate(d.getUTCDate() - quanti);
  return d.toISOString().slice(0, 10);
}

/** Le iscrizioni flaggate come vendite di questa fiera. */
export function iscrizioniDellaFiera(iscritti, eventoId) {
  if (!eventoId) return [];
  return (iscritti || [])
    .filter((i) => i && i.vendita_evento_id === eventoId)
    .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
}

// LE ISCRIZIONI DA GUARDARE, cioe' quelle fatte nei giorni della fiera e
// non ancora attribuite a lei.
//
// NON SONO «le vendite della fiera»: in quei due giorni si iscrive gente
// da tutta Italia, e chi lavora in sede continua a lavorare. L'8/11/2026
// nella finestra della Fiera di Napoli cadevano otto iscrizioni, di cui
// la maggior parte di classi di Roma e Milano. Per questo l'elenco
// PROPONE e una persona flagga: `ts` non sa dove stava chi ha compilato.
//
// Quelle gia' flaggate per un'ALTRA fiera restano fuori: sono gia'
// attribuite, e proporle vorrebbe dire invitare a rubarsele.
export function candidateDellaFiera(iscritti, evento) {
  if (!evento?.id) return [];
  return (iscritti || [])
    .filter((i) => i && nelPeriodo(evento, i.ts))
    .filter((i) => !i.vendita_evento_id)
    .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
}

const numero = (v) => (v == null || v === "" ? 0 : Number(v) || 0);
const arrotonda = (n) => Math.round((Number(n) || 0) * 100) / 100;

// QUANTO HA PORTATO LA FIERA, in due numeri che non si confondono.
//
// `pattuito` e' quello che quelle persone pagheranno in tutto;
// `incassato` e' quello che e' GIA' entrato — le quote segnate pagate,
// al totale (quello che e' passato di mano), non all'imponibile.
// Tenerli separati e' il punto: al banco di una fiera si prende un
// acconto, e una fiera che pattuisce ventimila euro e incassa mille non
// e' la stessa cosa di una che incassa diecimila.
//
// NESSUNO SCORPORO DI IVA: in tutta l'app ogni cifra registrata resta
// com'e' scritta (vedi non-sommare-o-detrarre-iva).
export function contoIscrizioniFiera(iscrizioni) {
  let pattuito = 0;
  let incassato = 0;
  (iscrizioni || []).forEach((i) => {
    pattuito += numero(i.totale_pattuito);
    if (i.acconto_pagato) incassato += numero(i.acconto_totale);
    if (i.precorso_pagato) incassato += numero(i.precorso_totale);
    ["acconto_extra", "precorso_extra"].forEach((campo) => {
      const righe = Array.isArray(i[campo]) ? i[campo] : [];
      righe.forEach((r) => { if (r?.pagato) incassato += numero(r.totale); });
    });
  });
  return { quante: (iscrizioni || []).length, pattuito: arrotonda(pattuito), incassato: arrotonda(incassato) };
}

// I CORSI CHE STIAMO CHIUDENDO IN FIERA.
//
// Si raggruppa per `corso_data_id` — la classe — e MAI per nome del
// corso: due edizioni dello stesso corso in due citta' sono due classi,
// e sommarle direbbe che a Napoli si e' venduto un corso che parte a
// Milano. E' la stessa regola di «raggruppa per prodotto, mai per nome».
//
// Chi non ha ancora una classe non si perde: finisce in un gruppo suo,
// perche' al banco si prende l'acconto e la data si decide dopo.
export function corsiChiusiInFiera(iscrizioni, { corsi = [], corsiDate = [], location = [] } = {}) {
  const corsoPerId = new Map((corsi || []).map((c) => [c.id, c]));
  const classePerId = new Map((corsiDate || []).map((cd) => [cd.id, cd]));
  const luogoPerId = new Map((location || []).map((l) => [l.id, l]));
  const gruppi = new Map();
  (iscrizioni || []).forEach((i) => {
    const chiave = i.corso_data_id || "senza-classe";
    if (!gruppi.has(chiave)) {
      const cd = classePerId.get(i.corso_data_id) || null;
      const corso = cd ? corsoPerId.get(cd.corso_id) : null;
      const luogo = cd ? luogoPerId.get(cd.location_id) : null;
      gruppi.set(chiave, {
        chiave,
        corsoDataId: cd ? cd.id : null,
        nome: corso?.nome || (cd ? "Classe senza corso" : "Classe non ancora scelta"),
        citta: luogo?.citta || cd?.citta || "",
        dataInizio: cd?.data_inizio || "",
        iscrizioni: [],
      });
    }
    gruppi.get(chiave).iscrizioni.push(i);
  });
  return [...gruppi.values()]
    .map((g) => ({ ...g, ...contoIscrizioniFiera(g.iscrizioni) }))
    // prima i corsi su cui la fiera ha portato piu' gente: e' la
    // domanda a cui questa pagina serve a rispondere
    .sort((a, b) => b.quante - a.quante
      || String(a.dataInizio || "9999").localeCompare(String(b.dataInizio || "9999"))
      || String(a.nome).localeCompare(String(b.nome)));
}
