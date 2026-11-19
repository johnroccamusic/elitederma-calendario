// GLI ELENCHI DELLA RESIDENZA, UNO PER STATO.
//
// La cascata — stato -> (regione) -> provincia -> comune -> CAP — e'
// scritta UNA volta sola, nella scheda del venditore e nel modulo
// dell'allieva. Quello che cambia da un paese all'altro non e' il
// gesto, sono gli elenchi: qui dentro c'e' chi li fornisce.
//
// PERCHE' COSI' E NON UN RAMO «if svizzera». Di posti che scendono per
// gradini ce ne sono due (AreeAnagrafiche e PaginaModulo); un `if` per
// paese vorrebbe dire due rami per paese, quattro, e il giorno in cui
// si aggiunge la Francia diventano sei — con la certezza che uno dei
// sei si dimentica. Qui si aggiunge un elenco e i due posti lo trovano
// da se'.
//
// COSA SIGNIFICA «nessun elenco». Degli altri 230 Stati non abbiamo
// ne' localita' ne' codici postali: la' le caselle restano di scrittura
// libera, com'erano. Un elenco chiuso incompleto impedirebbe di
// registrare chi esiste, ed e' il peggiore dei due difetti.
import {
  REGIONI, provinceDiRegione, regioneDiProvincia, comuniDiProvincia,
  capDiComune, provinciaDiComune, normalizzaLuogo, nomiStati,
} from "../comuni-regioni.js";
import { filtraCodiceFiscale } from "./codice-fiscale.js";
import {
  cantoniSvizzeri, localitaDiCantone, npaDiLocalita, cantoneDiLocalita,
} from "../comuni-svizzera.js";

export const ITALIA = "ITALIA";
export const SVIZZERA = "SVIZZERA";

// In archivio lo Stato e' una stringa scritta da chi ha compilato:
// «Svizzera», «SVIZZERA», «svizzera» sono lo stesso posto.
const ELENCHI = [
  {
    stato: ITALIA,
    nome: "Italia",
    // il codice del paese, per la ricerca delle vie (vedi
    // cerca-indirizzo): senza, si cercherebbe la via di Sion in Italia
    paese: "IT",
    // In Italia la regione e' il primo gradino e serve a tagliare 107
    // province in gruppi scorribili.
    conRegione: true,
    etichette: {},
    // le frasi delle tendine stanno scritte, non composte: «— scegli
    // l'NPA —» e «— scegli il CAP —» non si ricavano dall'etichetta
    // senza indovinare un articolo, e un articolo indovinato si vede.
    frasi: {
      scegliProvincia: "— scegli la provincia —", primaProvincia: "prima la regione",
      scegliComune: "— scegli il comune —", primaComune: "prima la provincia",
      scegliCap: "— scegli il CAP —", primaCap: "prima il comune",
    },
    regioni: () => REGIONI,
    // in Italia le province dipendono dalla regione; dove la regione
    // non c'e', l'argomento non si guarda
    provinceDi: (regione) => provinceDiRegione(regione),
    regioneDi: (sigla) => regioneDiProvincia(sigla),
    comuniDi: (sigla) => comuniDiProvincia(sigla),
    capDi: (sigla, comune) => capDiComune(sigla, comune),
    provinciaDi: (comune, cap) => provinciaDiComune(comune, cap),
  },
  {
    stato: SVIZZERA,
    nome: "Svizzera",
    paese: "CH",
    // In Svizzera NON C'E' NIENTE SOPRA IL CANTONE. I ventisei stanno
    // in una tendina sola senza bisogno di un gradino che li divida, e
    // una casella «Regione» sopra un indirizzo svizzero chiederebbe una
    // cosa che non esiste.
    conRegione: false,
    // «Provincia», «Comune» e «CAP» in Svizzera si chiamano in un altro
    // modo, e chi compila legge l'etichetta: NPA e' il codice postale
    // svizzero, ed e' quello scritto sulla busta.
    etichette: { provincia: "Cantone", comune: "Località", cap: "NPA" },
    frasi: {
      scegliProvincia: "— scegli il cantone —", primaProvincia: "",
      scegliComune: "— scegli la località —", primaComune: "prima il cantone",
      scegliCap: "— scegli l'NPA —", primaCap: "prima la località",
    },
    regioni: () => [],
    provinceDi: () => cantoniSvizzeri(),
    regioneDi: () => "",
    comuniDi: (sigla) => localitaDiCantone(sigla),
    capDi: (sigla, localita) => npaDiLocalita(sigla, localita),
    provinciaDi: (localita, npa) => cantoneDiLocalita(localita, npa),
  },
];

/** L'elenco di quello Stato, o null se di la' non ne abbiamo uno. */
export function elencoResidenza(stato) {
  const chiave = normalizzaLuogo(stato);
  // LA CASELLA VUOTA E' L'ITALIA, e non per pigrizia: 253 schede su 260
  // in archivio hanno la residenza italiana e lo Stato mai scritto. Se
  // il vuoto non valesse Italia, quelle aprirebbero tutte in scrittura
  // libera e la cascata non si vedrebbe piu'.
  if (!chiave) return ELENCHI[0];
  return ELENCHI.find((e) => normalizzaLuogo(e.stato) === chiave) || null;
}

/** I nomi da mettere in tendina: prima quelli con l'elenco. */
export function statiConElenco() {
  return ELENCHI.map((e) => e.nome);
}

// LA TENDINA DELLO STATO.
//
// Prima Italia e Svizzera, che hanno gli elenchi; poi tutti gli altri
// Stati — sono gli stessi 232 dello stato di nascita, lista ISTAT — e in
// coda «Altro stato», che apre la scrittura libera per quello che in
// quella lista non c'e'.
//
// Perche' anche gli altri 230 in tendina, se poi non portano elenchi:
// perche' «SVIZERA» scritto a mano e «Svizzera» sono due paesi diversi
// per chiunque debba contare, e perche' lo Stato di una residenza e'
// esattamente il tipo di dato che non si lascia scrivere a mano.
export const ALTRO_STATO = "ALTRO";

export function vociStatoResidenza({ conAltro = true } = {}) {
  const conElenco = statiConElenco();
  const altri = nomiStati().filter((n) => !conElenco.some((x) => normalizzaLuogo(x) === normalizzaLuogo(n)));
  return [
    ...conElenco.map((n) => ({ valore: n.toUpperCase(), testo: n })),
    ...altri.map((n) => ({ valore: n.toUpperCase(), testo: n })),
    // Nel modulo dell'allieva la voce «Altro stato» non ha senso: li'
    // non c'e' una casella accanto in cui scrivere il nome, e una voce
    // che apre il vuoto e' peggio di una voce che manca.
    ...(conAltro ? [{ valore: ALTRO_STATO, testo: "Altro stato (lo scrivo io)" }] : []),
  ];
}

/** Il valore da mostrare nella tendina per quello che c'e' in archivio. */
export function vocePerStato(statoScritto, aManoLibera) {
  if (aManoLibera) return ALTRO_STATO;
  const scritto = (statoScritto || "").trim();
  if (!scritto) return "";
  const voci = vociStatoResidenza();
  const trovata = voci.find((v) => normalizzaLuogo(v.valore) === normalizzaLuogo(scritto));
  // uno Stato scritto a mano che nella lista non c'e' resta scritto: la
  // tendina mostra «Altro stato» e la casella accanto il suo nome
  return trovata ? trovata.valore : ALTRO_STATO;
}

// L'IDENTIFICATIVO FISCALE NON E' IL CODICE FISCALE ITALIANO.
//
// Il campo si chiama «Identificativo fiscale personale (TIN)» perche'
// chi vive fuori ne ha uno del suo paese: l'AHV svizzero si scrive
// 756.1234.5678.97 — sedici caratteri non lo sono, i punti dentro il
// filtro del codice italiano li toglieva, e l'avviso «mancano quattro
// caratteri» dava torto a chi aveva scritto il numero giusto.
//
// Quindi le regole del codice italiano — sedici caratteri esatti, solo
// lettere e numeri, la lettera di controllo, il calcolo automatico da
// nome, sesso e nascita — valgono SOLO per chi risiede in Italia.
// Fuori si scrive quello che c'e' sul documento, e nessuno lo corregge.
export function campoFiscale(campo, elenco) {
  if (campo?.chiave !== "codice_fiscale") return campo;
  // il paese viaggia col campo: e' quello che decide come si scrive
  // quel numero mentre lo si batte (vedi formattaFiscale)
  if (elenco?.stato === ITALIA) return { ...campo, formatoItaliano: true, paeseFiscale: "IT" };
  const senzaMisura = { ...campo, formatoItaliano: false, paeseFiscale: elenco?.paese || "" };
  delete senzaMisura.lunghezza;
  delete senzaMisura.lunghezzaEsatta;
  return senzaMisura;
}

// I PUNTI DELL'AVS LI METTE LA CASELLA (8/11/2026, chiesto dal titolare
// provando a iscrivere un'allieva svizzera: «mentre scrivi non appaiono
// i punti automaticamente, che sarebbe perfetto»).
//
// L'AVS si scrive 756.1234.5678.97, e quei punti non sono un vezzo: e'
// un numero di tredici cifre che si copia guardando una tessera, e
// tredici cifre di fila non si rileggono per controllare se si e'
// battuto giusto. A gruppi si'. Quindi si battono le sole cifre.
//
// DUE REGOLE, E TUTTE E DUE SONO PROTEZIONI:
//
// 1. SE C'E' UNA LETTERA NON SI TOCCA NIENTE. Un italiano che vive in
//    Svizzera in quella casella ci scrive il suo codice fiscale:
//    levargli le lettere per fare spazio ai punti sarebbe, al
//    contrario, lo stesso guasto da cui veniamo — il filtro italiano
//    che mangiava l'AVS.
// 2. SI RAGGRUPPA SOLO QUELLO CHE STA DIVENTANDO UN AVS, cioe' le
//    cifre che cominciano per 756 (il codice della Svizzera, uguale
//    per tutti). Un identificativo numerico di un altro genere non si
//    spezza in gruppi che non sono i suoi.
//
// E un punto non si appiccica MAI in coda a un gruppo finito: con
// «756.» gia' scritto, il tasto cancella toglierebbe il punto, la
// formattazione lo rimetterebbe, e la casella sembrerebbe inchiodata.
export function formattaAhv(testo) {
  const scritto = String(testo ?? "");
  if (/[^\d.\s-]/.test(scritto)) return scritto;
  const cifre = scritto.replace(/\D/g, "").slice(0, 13);
  if (!"756".startsWith(cifre.slice(0, 3))) return scritto;
  return [cifre.slice(0, 3), cifre.slice(3, 7), cifre.slice(7, 11), cifre.slice(11, 13)]
    .filter(Boolean).join(".");
}

/** Cosa fa la casella fiscale mentre si scrive, secondo il paese.
 *
 *  Sta qui e non nelle due caselle che la chiamano — la scheda del
 *  venditore e il modulo dell'allieva — perche' due copie vorrebbero
 *  dire un numero accettato di qua e rifiutato di la', sullo stesso
 *  documento. */
export function formattaFiscale(testo, campo) {
  // L'ITALIA E' L'UNICO PAESE DI CUI SAPPIAMO ABBASTANZA PER CORREGGERE
  // CHI SCRIVE: il codice fiscale ha una forma obbligata e la casella
  // la fa rispettare. Senza campo (la pagina delle impostazioni, che
  // disegna i campi senza una residenza) vale la regola di sempre.
  if (campo?.formatoItaliano !== false) return filtraCodiceFiscale(testo);
  if (campo?.paeseFiscale === "CH") return formattaAhv(testo);
  // degli altri 230 Stati non sappiamo niente: si scrive quello che c'e'
  // sul documento, e nessuno lo corregge
  return testo;
}

/** L'etichetta di un campo secondo lo Stato (Provincia -> Cantone...). */
export function etichettaResidenza(campo, elenco) {
  const nuova = elenco?.etichette?.[campo?.tipo];
  return nuova ? { ...campo, etichetta: nuova } : campo;
}
