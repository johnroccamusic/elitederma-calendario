// IL PREFISSO INTERNAZIONALE SI SCEGLIE, E PARTE DAL PAESE DI RESIDENZA.
//
// Chiesto dal titolare l'8/11/2026, subito dopo la residenza svizzera:
// «il prefisso telefonico internazionale adesso e' scritto sulla
// casella nel testo +39, e in futuro va selezionato da una tendina che
// ti propone come priorita' quelli dello stato di residenza che hai
// appena inserito, e che in ogni modo ti da' l'opportunita' di
// cambiarlo».
//
// Era una scritta fissa, in due posti: l'etichetta «Cellulare (+39...)»
// e il suggerimento dentro la casella. Dire «+39» a una svizzera e'
// chiederle un numero che non ha, e il numero che scriveva finiva in
// archivio senza prefisso o con quello sbagliato — e da li' passano
// WhatsApp, le mail e chi la deve richiamare.
//
// COME SI ARCHIVIA, E PERCHE' NON CAMBIA NIENTE IN BANCA DATI.
// `iscritti.telefono` resta UNA colonna di testo: dentro ci va prefisso
// e numero attaccati, «+41791234567», che e' la forma in cui l'app gia'
// scrive i numeri italiani da sempre (vedi normalizzaCellulare). La
// tendina non e' un campo nuovo: e' un modo di leggere e di riscrivere
// quella stringa. Nessuna migrazione, e i 253 numeri gia' in archivio
// si riaprono come sono.
import { STATI, normalizzaLuogo } from "./comuni-regioni.js";
import { PREFISSI } from "./prefissi-telefonici-dati.js";

export const PREFISSO_ITALIA = "+39";

// L'ITALIA NON STA NELL'ELENCO ISTAT, e non e' una dimenticanza: quello
// e' l'elenco degli Stati ESTERI, per chi e' nato o vive fuori. La sua
// riga si scrive qui, ed e' l'unica scritta a mano.
const perCodice = new Map(PREFISSI.map((r) => r.split("|")));

const VOCI = [
  { nome: "Italia", prefisso: PREFISSO_ITALIA },
  ...STATI.map((r) => {
    const [codice, nome] = r.split("|");
    return { nome, prefisso: perCodice.get(codice) || "" };
  }).filter((v) => v.prefisso),
];

/** Il prefisso di uno Stato scritto come viene. Vuoto = Italia, con la
 *  stessa convenzione di tutta la scheda: 253 residenze su 260 sono
 *  italiane e quello Stato non l'ha mai scritto nessuno. */
export function prefissoDiStato(stato) {
  const chiave = normalizzaLuogo(stato);
  if (!chiave) return PREFISSO_ITALIA;
  return VOCI.find((v) => normalizzaLuogo(v.nome) === chiave)?.prefisso || "";
}

// I prefissi dal piu' lungo al piu' corto: «+1264» (Anguilla) va
// riconosciuto PRIMA di «+1», o ogni numero caraibico verrebbe letto
// come americano con quattro cifre di troppo nel numero.
const PIU_LUNGHI_PRIMA = [...new Set(VOCI.map((v) => v.prefisso))]
  .sort((a, b) => b.length - a.length);

/** Spezza un numero archiviato in prefisso e numero locale.
 *
 *  Senza il «+» davanti non si indovina: il prefisso mostrato e' quello
 *  del paese di residenza e le cifre restano tutte nel numero. E'
 *  quello che serve per i numeri vecchi, scritti quando il prefisso non
 *  si poteva scegliere. */
export function separaPrefisso(telefono, statoResidenza) {
  const scritto = String(telefono || "").trim();
  // «0039» e' lo stesso prefisso scritto all'antica
  const conPiu = scritto.startsWith("00") ? "+" + scritto.slice(2) : scritto;
  const cifre = conPiu.startsWith("+") ? "+" + conPiu.slice(1).replace(/\D/g, "") : conPiu.replace(/\D/g, "");
  if (cifre.startsWith("+")) {
    const trovato = PIU_LUNGHI_PRIMA.find((p) => cifre.startsWith(p) && cifre.length > p.length);
    if (trovato) return { prefisso: trovato, numero: cifre.slice(trovato.length) };
    // un «+» con un prefisso che non conosciamo: non si inventa niente,
    // il numero resta intero e visibile
    const soloPrefisso = PIU_LUNGHI_PRIMA.find((p) => cifre === p);
    if (soloPrefisso) return { prefisso: soloPrefisso, numero: "" };
    return { prefisso: "", numero: cifre };
  }
  return { prefisso: prefissoDiStato(statoResidenza), numero: cifre };
}

/** Rimette insieme quello che si archivia.
 *
 *  Numero vuoto = casella vuota, NON il solo prefisso: un «+39» da solo
 *  in archivio sembrerebbe un numero e non si potrebbe chiamare. */
export function componiTelefono(prefisso, numero) {
  const sole = String(numero || "").replace(/\D/g, "");
  if (!sole) return "";
  return `${prefisso || PREFISSO_ITALIA}${sole}`;
}

/** Le voci della tendina, nell'ordine in cui servono.
 *
 *  PRIMA IL PAESE DI RESIDENZA: e' quello che si e' appena scritto due
 *  righe sopra, ed e' il numero che quella persona ha quasi sempre.
 *  Poi l'Italia, perche' resta il caso normale. Poi tutti gli altri in
 *  ordine: la tendina si cerca, quindi nessuno e' lontano. */
export function vociPrefisso(statoResidenza) {
  const suo = normalizzaLuogo(statoResidenza);
  const primo = suo ? VOCI.find((v) => normalizzaLuogo(v.nome) === suo) : null;
  const inTesta = [primo, VOCI[0]].filter(Boolean);
  const resto = VOCI.filter((v) => !inTesta.includes(v));
  return [...new Map([...inTesta, ...resto].map((v) => [v.nome, v])).values()]
    .map((v) => ({ valore: v.prefisso, testo: `${v.nome} ${v.prefisso}`, nome: v.nome }));
}
