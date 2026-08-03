import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
// build "legacy" invece di quella principale: consigliata dalla stessa
// pdf.js per i browser che supportano peggio i worker "module" (in
// particolare Safari/iOS), dove la build principale può innescare un bug
// interno della libreria durante l'estrazione del testo (es. un fallback
// a "fake worker" che prende un percorso di codice meno testato)
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || "";

const NAVY = "#0E1B33";
const CREAM_BORDER = "#E8E3D6";
const BG = "#EFE9DC";
const BG_CHIARO = "#EFE9DC"; // stesso colore anche nei riquadri interni alle schede
const MUTED = "#8B8FA3";
const GRAFITE = "#54585F";
const GOLD = "#C9A26D"; // accento per icone/badge (es. intestazione Contabilità classe)

const fontDisplay = { fontFamily: "'Prompt',sans-serif", fontWeight: 500 };
const fontBody = { fontFamily: "'Roboto',sans-serif" };
const fontCondensato = { fontFamily: "'Sofia Sans Condensed',sans-serif" }; // più stretto del normale a parità di dimensione: usato per i nomi dei corsi sulle barre del calendario, dove lo spazio orizzontale è poco

// larghezze di default delle colonne della tabella "Assegnazione Master"
// (l'utente può trascinarle: la scelta resta salvata in localStorage)
const LARGHEZZE_COLONNE_DEFAULT = [54, 100, 70, 60, 100, 90, 100, 90, 150, 100, 100];
const CHIAVE_LARGHEZZE_COLONNE = "assegnazioneMaster_larghezzeColonne";
const CHIAVE_LARGHEZZE_VENDITORI = "statisticaVenditori_larghezzeColonne";
const ETICHETTE_COLONNE_MASTER = ["Data", "Corso", "Città", "Sede OK?", "Master", "Note", "Assistenti", "Leve", "Viaggio", "Alloggio", "Note viaggio"];

// una "stagione" va da settembre di un anno ad agosto dell'anno successivo,
// identificata dall'anno in cui inizia (es. 2026 = Stagione 2026-2027)
const CHIAVE_STAGIONE_BLOCCATA = "assegnazioneMaster_stagioneBloccata";
function annoStagioneDaData(dataStr) {
  const [anno, mese] = dataStr.split("-").map(Number);
  return mese >= 9 ? anno : anno - 1;
}
function stagioneCorrente() { return annoStagioneDaData(dataOggiStr()); }
function etichettaStagione(annoInizio) { return `Stagione ${annoInizio}-${annoInizio + 1}`; }

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_ABBR = ["GEN","FEB","MAR","APR","MAG","GIU","LUG","AGO","SET","OTT","NOV","DIC"];
// data compatta per le liste: "11 OTT", "11–16 OTT", "29 SET–4 OTT"
function fmtDataCompatta(inizio, fine) {
  const [, mi, gi] = inizio.split("-").map(Number);
  const [, mf, gf] = fine.split("-").map(Number);
  if (inizio === fine) return `${gi} ${MESI_ABBR[mi - 1]}`;
  if (mi === mf) return `${gi}–${gf} ${MESI_ABBR[mi - 1]}`;
  return `${gi} ${MESI_ABBR[mi - 1]}–${gf} ${MESI_ABBR[mf - 1]}`;
}
// come fmtDataCompatta ma su due righe (numeri sopra, mese sotto) per le tabelle strette
function fmtDataStack(inizio, fine) {
  const [, mi, gi] = inizio.split("-").map(Number);
  const [, mf, gf] = fine.split("-").map(Number);
  if (inizio === fine) return { sopra: String(gi), sotto: MESI_ABBR[mi - 1] };
  if (mi === mf) return { sopra: `${gi}–${gf}`, sotto: MESI_ABBR[mi - 1] };
  return { sopra: `${gi} ${MESI_ABBR[mi - 1]}`, sotto: `${gf} ${MESI_ABBR[mf - 1]}` };
}

// data compatta per i link pubblici (es. "13-14sett2026"): niente spazi né
// caratteri strani, solo numeri/lettere, per un link pulito da leggere/mandare
const MESI_LINK = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "sett", "ott", "nov", "dic"];
function slugData(inizio, fine) {
  const [anno, mi, gi] = inizio.split("-").map(Number);
  const [, mf, gf] = fine.split("-").map(Number);
  if (inizio === fine) return `${gi}${MESI_LINK[mi - 1]}${anno}`;
  if (mi === mf) return `${gi}-${gf}${MESI_LINK[mi - 1]}${anno}`;
  return `${gi}${MESI_LINK[mi - 1]}-${gf}${MESI_LINK[mf - 1]}${anno}`;
}
// legge indietro il formato di slugData: restituisce {giorno,mese,anno} del
// primo giorno, o null se non riconosciuto
function leggiSlugData(testo) {
  const m = (testo || "").match(/^(\d{1,2})(?:-(\d{1,2}))?(gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)(\d{4})$/);
  if (m) return { giorno: parseInt(m[1], 10), mese: MESI_LINK.indexOf(m[3]) + 1, anno: parseInt(m[4], 10) };
  const m2 = (testo || "").match(/^(\d{1,2})(gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)-\d{1,2}(?:gen|feb|mar|apr|mag|giu|lug|ago|sett|ott|nov|dic)(\d{4})$/);
  if (m2) return { giorno: parseInt(m2[1], 10), mese: MESI_LINK.indexOf(m2[2]) + 1, anno: parseInt(m2[3], 10) };
  return null;
}
const GIORNI = ["L","M","M","G","V","S","D"];
const GIORNI_ABBR = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"]; // solo per l'intestazione del Calendario mensile
const COLORE_SABATO = "#F4F9FD"; // celeste tenuissimo, indice 5 = S
const COLORE_DOMENICA = "#F2F2F2"; // grigio molto chiaro, indice 6 = D

// vero quando la finestra è larga quanto un cellulare: usato per ingrandire
// le viste calendario (altrimenti le barre dei corsi diventano illeggibili
// su schermi stretti, dato che lo spazio orizzontale per giorno si riduce
// molto ma il testo resterebbe alla stessa dimensione)
function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= breakpoint);
  useEffect(() => {
    function aggiorna() { setIsMobile(window.innerWidth <= breakpoint); }
    window.addEventListener("resize", aggiorna);
    return () => window.removeEventListener("resize", aggiorna);
  }, [breakpoint]);
  return isMobile;
}

function fmtData(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// wa.me vuole solo cifre col prefisso internazionale: i numeri qui sono
// quasi sempre cellulari italiani inseriti senza prefisso, quindi si
// aggiunge "39" solo se non sembra già averlo (numero internazionale più lungo)
function numeroWhatsapp(telefono) {
  const cifre = (telefono || "").replace(/\D/g, "");
  return cifre.length > 10 ? cifre : `39${cifre}`;
}
function IconaWhatsapp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.41-1.42a9.87 9.87 0 0 0 4.63 1.18h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 18.11h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.25-4.35c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.2-8.25 8.2zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z" />
    </svg>
  );
}
// icona telefono: usata accanto a un CAMPO DI TESTO editabile per il
// numero (non sul numero stesso, altrimenti su schermo touch un tocco per
// chiamare finirebbe invece per mettere a fuoco/modificare il campo)
function IconaTelefono({ size = 16, color = "#0E1B33" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
// icone delle 3 card della home (Calendario/Cerca iscritto/Archivio)
function IconaCalendarioCard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" />
    </svg>
  );
}
function IconaRicercaCard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function IconaOrologioCard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  );
}
function IconaLoghiCard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2.2" />
      <path d="M21 15l-5.5-5.5a2 2 0 0 0-2.8 0L4 18" />
    </svg>
  );
}
// icone del riepilogo amministrativo (contabilità classe)
function IconaPortafoglio({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
function IconaBanconota({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
function IconaCartaPos({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  );
}
// icone dell'intestazione "Contabilità classe" (pin località + le 3 celle
// Date/Master/Disponibilità)
function IconaPin({ size = 15, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
function IconaDataAccento({ size = 26, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" />
      <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2" />
    </svg>
  );
}
function IconaMasterAccento({ size = 26, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5" />
    </svg>
  );
}
function IconaDisponibilitaAccento({ size = 26, color = GOLD }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M2.5 20c0-3.6 2.9-5.6 6.5-5.6" />
      <circle cx="16.5" cy="9.3" r="2.8" />
      <path d="M13.3 14.7c2.9.2 6.2 1.8 6.2 5.3" />
    </svg>
  );
}
// data estesa in italiano, es. "27 luglio 2026" (usata per raggruppare le
// ultime iscrizioni per giorno di inserimento)
function fmtDataLunga(dataStr) {
  const [anno, mese, giorno] = dataStr.split("-").map(Number);
  return `${giorno} ${MESI[mese - 1].toLowerCase()} ${anno}`;
}

// intervallo di date in italiano esteso, es. "18–19 ottobre 2026" (stesso
// mese) o "28 settembre – 2 ottobre 2026" (mesi diversi) — usato
// nell'intestazione di Contabilità classe
function fmtIntervalloEsteso(inizio, fine) {
  const [annoI, meseI, giornoI] = inizio.split("-").map(Number);
  if (inizio === fine) return `${giornoI} ${MESI[meseI - 1].toLowerCase()} ${annoI}`;
  const [annoF, meseF, giornoF] = fine.split("-").map(Number);
  if (annoI === annoF && meseI === meseF) return `${giornoI}–${giornoF} ${MESI[meseI - 1].toLowerCase()} ${annoI}`;
  if (annoI === annoF) return `${giornoI} ${MESI[meseI - 1].toLowerCase()} – ${giornoF} ${MESI[meseF - 1].toLowerCase()} ${annoI}`;
  return `${giornoI} ${MESI[meseI - 1].toLowerCase()} ${annoI} – ${giornoF} ${MESI[meseF - 1].toLowerCase()} ${annoF}`;
}

// genera la griglia di un mese come array di settimane (7 celle, null=padding)
function generaSettimane(anno, mese) {
  const primoGiorno = new Date(anno, mese, 1);
  const offset = (primoGiorno.getDay() + 6) % 7; // lunedì=0
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const celle = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let d = 1; d <= giorniMese; d++) celle.push(d);
  while (celle.length % 7 !== 0) celle.push(null);
  const settimane = [];
  for (let i = 0; i < celle.length; i += 7) settimane.push(celle.slice(i, i + 7));
  return settimane;
}
function dateStrFor(anno, mese, d) {
  return `${anno}-${String(mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// somma (o sottrae, se n è negativo) n giorni a una data "yyyy-mm-dd"
function addGiorni(dataStr, n) {
  const [y, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
// numero di giorni tra due date "yyyy-mm-dd" (dataB - dataA)
function differenzaGiorni(dataA, dataB) {
  const [ya, ma, da] = dataA.split("-").map(Number);
  const [yb, mb, db] = dataB.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}
// assegna una "corsia" (lane) a ciascun evento di una riga evitando sovrapposizioni
function assegnaLane(eventiRiga) {
  const lanes = [];
  return eventiRiga
    .slice()
    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
    .map((ev) => {
      let lane = 0;
      while (lanes[lane] && lanes[lane] >= ev.data_inizio) lane++;
      lanes[lane] = ev.data_fine;
      return { ...ev, lane };
    });
}

// sigle automobilistiche delle principali città italiane, per le etichette nel calendario
const SIGLE_CITTA = {
  "milano": "MI", "roma": "RM", "napoli": "NA", "torino": "TO", "bologna": "BO",
  "firenze": "FI", "verona": "VR", "venezia": "VE", "palermo": "PA", "genova": "GE",
  "bari": "BA", "catania": "CT", "padova": "PD", "bergamo": "BG", "brescia": "BS",
  "modena": "MO", "parma": "PR", "reggio emilia": "RE", "perugia": "PG", "cagliari": "CA",
  "ancona": "AN", "pescara": "PE", "trento": "TN", "bolzano": "BZ", "trieste": "TS",
  "udine": "UD", "rimini": "RN", "salerno": "SA", "livorno": "LI", "pisa": "PI",
  "siena": "SI", "lucca": "LU", "ravenna": "RA", "ferrara": "FE", "vicenza": "VI",
  "treviso": "TV", "como": "CO", "varese": "VA", "monza": "MB", "brindisi": "BR",
  "lecce": "LE", "taranto": "TA", "foggia": "FG", "messina": "ME", "siracusa": "SR",
  "sassari": "SS", "reggio calabria": "RC", "cosenza": "CS", "latina": "LT", "pavia": "PV",
  "piacenza": "PC", "cremona": "CR", "mantova": "MN", "novara": "NO", "asti": "AT",
  "cuneo": "CN", "aosta": "AO", "la spezia": "SP", "pistoia": "PT", "arezzo": "AR",
  "grosseto": "GR", "terni": "TR", "viterbo": "VT", "rieti": "RI", "frosinone": "FR",
  "campobasso": "CB", "potenza": "PZ", "matera": "MT", "avellino": "AV", "benevento": "BN",
  "caserta": "CE", "nuoro": "NU", "oristano": "OR", "imperia": "IM", "savona": "SV",
  "alessandria": "AL", "biella": "BI", "vercelli": "VC", "lodi": "LO", "sondrio": "SO",
  "belluno": "BL", "rovigo": "RO", "gorizia": "GO", "pordenone": "PN", "chieti": "CH",
  "teramo": "TE", "isernia": "IS", "l'aquila": "AQ", "macerata": "MC", "fermo": "FM",
  "pesaro": "PU", "prato": "PO", "massa": "MS",
};
function siglaCitta(nome) {
  if (!nome) return "";
  const s = SIGLE_CITTA[nome.trim().toLowerCase()];
  return s || nome.trim().slice(0, 2).toUpperCase();
}
// versione molto chiara (circa 28% di intensità) di un colore esadecimale,
// mescolandolo con il bianco: usata per la parte "vuota" dell'indicatore di
// capienza sulle barre del calendario. Restituisce un colore SOLIDO (non
// trasparente) così resta identico su qualunque sfondo ci sia dietro
function coloreTenue(hex, intensita = 0.28) {
  const cifre = (hex || "").replace("#", "").match(/.{1,2}/g);
  if (!cifre || cifre.length < 3) return hex;
  const [r, g, b] = cifre.map((h) => parseInt(h, 16));
  const mescola = (c) => Math.round(c * intensita + 255 * (1 - intensita));
  return `rgb(${mescola(r)}, ${mescola(g)}, ${mescola(b)})`;
}

// etichetta breve per le barre del calendario: nome corso (max maxChar
// caratteri, di default 10) + sigla città; maxChar=null non tronca affatto
// (usato da mobile sui corsi di un solo giorno, dove il nome può andare a
// capo su due righe invece di essere tagliato)
function etichettaBarra(corso, loc, maxChar = 10) {
  const nomeIntero = (corso?.nome || "").toUpperCase();
  const nome = maxChar != null ? nomeIntero.slice(0, maxChar) : nomeIntero;
  return `${nome} ${siglaCitta(loc?.nome)}`;
}

// angolo della punta di freccia, misurato dall'orizzontale: più è
// piccolo più la punta appare schiacciata/allungata invece che a 45°
const ANGOLO_PUNTA_FRECCIA_GRADI = 78;
// quanto deve rientrare orizzontalmente il taglio perché, unito a metà
// altezza della barra, la punta risultante formi ANGOLO_PUNTA_FRECCIA_GRADI
function runPuntaFreccia(altezzaPx) {
  return (altezzaPx / 2) / Math.tan((ANGOLO_PUNTA_FRECCIA_GRADI * Math.PI) / 180);
}
// se il corso prosegue nella riga precedente/successiva (spezzato dal
// cambio di settimana), taglia gli angoli della barra dal lato
// interessato: la barra stessa diventa la punta di una freccia che indica
// da/verso dove prosegue, invece di un simbolo scritto dentro
function clipPathBarra(continuaPrima, continuaDopo, altezzaPx) {
  if (!continuaPrima && !continuaDopo) return undefined;
  const h = runPuntaFreccia(altezzaPx);
  const punti = [];
  punti.push(continuaPrima ? `${h}px 0` : "0 0");
  punti.push(continuaDopo ? `calc(100% - ${h}px) 0` : "100% 0");
  if (continuaDopo) punti.push("100% 50%");
  punti.push(continuaDopo ? `calc(100% - ${h}px) 100%` : "100% 100%");
  punti.push(continuaPrima ? `${h}px 100%` : "0 100%");
  if (continuaPrima) punti.push("0 50%");
  return `polygon(${punti.join(", ")})`;
}

// contenuto di una barra evento nel calendario: per un corso di più giorni
// mostra, sopra ogni singolo giorno che attraversa in questa riga, il
// numero di frazione "giorno/totale" (es. 3/6); il nome del corso resta
// visibile solo all'inizio del segmento
function contenutoBarraCalendario({ etichetta, giorniTotali, indiciGiorno, fontSizeBadge, gap, inset, continuaPrima, continuaDopo, coneRun, isMobile }) {
  if (giorniTotali <= 1) {
    if (isMobile) {
      // da cellulare la colonna del giorno è troppo stretta perché il nome
      // stia su una riga sola anche riducendo il font: meglio andare a capo
      // su due righe (il nome intero, non troncato) che tagliarlo con "..."
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", padding: `0 ${inset}px`, boxSizing: "border-box" }}>
          <span
            style={{
              ...fontCondensato,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal", wordBreak: "break-word",
              fontSize: 10, lineHeight: 1.05,
            }}
          >
            {etichetta}
          </span>
        </div>
      );
    }
    return (
      <span style={{ ...fontCondensato, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: `0 ${inset}px`, height: "100%", display: "flex", alignItems: "center", boxSizing: "border-box" }}>
        {etichetta}
      </span>
    );
  }
  const ultimo = indiciGiorno.length - 1;
  return (
    // stesso numero di colonne E STESSO gap della griglia dei giorni sotto:
    // solo così ogni numero di frazione combacia esattamente con il giorno
    // a cui si riferisce, invece di scivolare via via che il corso è lungo.
    // Il rientro (inset) va messo sulla prima/ultima cella, non su questo
    // contenitore, altrimenti sposterebbe la larghezza delle colonne e
    // farebbe perdere l'allineamento con la griglia dei giorni.
    // Il distacco del numero dal bordo destro è LO STESSO gap usato tra le
    // colonne dei giorni, applicato a ogni cella: così la frazione si trova
    // sempre alla stessa distanza dal proprio giorno, sia che sia una cella
    // centrale sia che sia l'ultima (dove la barra può finire dritta o a
    // punta di freccia). Quando il lato è tagliato a punta (continuaPrima/
    // continuaDopo), si aggiunge il "coneRun" (la stessa distanza usata dal
    // clip-path per tagliare l'angolo): così testo e numero restano nella
    // parte dritta della barra, senza entrare nel cono della freccia.
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${indiciGiorno.length},1fr)`, gap, width: "100%", height: "100%", boxSizing: "border-box" }}>
      {indiciGiorno.map((indice, i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", justifyContent: i === 0 ? "space-between" : "center", gap: 3, minWidth: 0, overflow: "hidden",
            // il rientro riservato al cono della freccia è sempre lo stesso,
            // sia che questo segmento prosegua davvero da/verso un'altra
            // riga sia che inizi/finisca dritto: così i numeri di frazione
            // restano allineati alla stessa distanza dal bordo del giorno
            // su tutte le righe, indipendentemente da dove ogni singolo
            // corso comincia
            paddingLeft: i === 0 ? inset + coneRun : 0,
            paddingRight: gap + (i === ultimo ? coneRun : 0),
            boxSizing: "border-box",
          }}
        >
          {i === 0 && (
            isMobile ? (
              <span
                style={{
                  ...fontCondensato,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal", wordBreak: "break-word",
                  flex: "1 1 auto", minWidth: 0, fontSize: 10, lineHeight: 1.05,
                }}
              >
                {etichetta}
              </span>
            ) : (
              <span style={{ ...fontCondensato, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etichetta}</span>
            )
          )}
          {indice != null && !(isMobile && i === 0) && (
            <span style={{ ...fontBody, fontSize: fontSizeBadge, color: MUTED, flexShrink: 0, fontWeight: 400 }}>
              {indice}/{giorniTotali}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Card / pulsanti base ----------
// spunta verde ben visibile accanto ai campi di upload file, per confermare
// a colpo d'occhio che un file (nuovo o già caricato in precedenza) è
// presente, senza dover leggere la scritta piccola del browser sull'input
function BadgeFileCaricato() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2E7D32", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="2" />
        <path d="M7 12.5l3.2 3.2L17 8.5" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      File caricato
    </span>
  );
}

// senza "icona": riga singola titolo+freccia (usato in Statistiche).
// con "icona": card più alta, icona in alto a sinistra e freccia in
// alto a destra sulla stessa riga, titolo e sottotitolo sotto (usato
// nella home, per le card affiancate in riga)
function CardHome({ title, sub, onClick, icona }) {
  if (icona) {
    return (
      <button
        onClick={onClick}
        style={{
          ...fontBody,
          textAlign: "left",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          border: `1px solid ${CREAM_BORDER}`,
          borderRadius: 14,
          padding: 14,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
            {icona}
          </div>
          <div style={{ fontSize: 18, color: MUTED }}>&rsaquo;</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 15, color: NAVY }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        ...fontBody,
        textAlign: "left",
        width: "100%",
        background: "#FFFFFF",
        border: `1px solid ${CREAM_BORDER}`,
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 8,
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ ...fontDisplay, fontSize: 16, color: NAVY }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 18, color: NAVY }}>&rsaquo;</div>
    </button>
  );
}

function Button({ children, onClick, variant = "primary", style = {}, disabled }) {
  const base = {
    ...fontBody,
    fontSize: 14,
    padding: "10px 18px",
    borderRadius: 10,
    cursor: disabled ? "default" : "pointer",
    border: "1px solid " + NAVY,
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: NAVY, color: "#fff" },
    ghost: { background: "transparent", color: NAVY },
    danger: { background: "#fff", color: "#C0392B", border: "1px solid #C0392B" },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// minLabelHeight: quando più Field stanno affiancati in una riga e le
// etichette hanno lunghezze diverse (una va a capo su due righe, un'altra
// no), i campi sotto risultano sfalsati; passandola, tutte le etichette
// della riga riservano la stessa altezza e i campi tornano allineati
function Field({ label, children, minLabelHeight }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5, minHeight: minLabelHeight, display: minLabelHeight ? "flex" : undefined, alignItems: minLabelHeight ? "flex-end" : undefined }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  ...fontBody,
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${CREAM_BORDER}`,
  fontSize: 14,
};

// ---------- helper per i calcoli di imponibile/IVA/totale ----------
const PREZZO_MODELLA = 60;

// trattamenti tra cui scegliere per ogni modella richiesta da un iscritto
const OPZIONI_TIPO_MODELLA = [
  "Microblading", "Sopracciglia ombretto", "Labbra", "Eyeliner",
  "Pelo con dermografo", "Trico", "Areola", "Laminazione", "Extension", "Needling",
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function parseNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}
// data una quota { imponibile, totale, metodo }, aggiorna l'imponibile e ricalcola il totale
// (o viceversa). applicaIva=false = nessun calcolo IVA (es. saldo pagato in contanti)
function conImponibileAggiornato(prev, valore, applicaIva) {
  const num = parseNum(valore);
  const totale = valore === "" ? "" : String(applicaIva ? round2(num * 1.22) : num);
  return { ...prev, imponibile: valore, totale };
}
function conTotaleAggiornato(prev, valore, applicaIva) {
  const num = parseNum(valore);
  const imponibile = valore === "" ? "" : String(applicaIva ? round2(num / 1.22) : num);
  return { ...prev, totale: valore, imponibile };
}
function ivaDiQuota(q) {
  // imponibile vuoto (es. "Cash no iva": la casella resta bloccata
  // e non si riempie mai da sola) significa "nessuna IVA da mostrare",
  // anche se il totale è già stato inserito
  if (q.imponibile === "") return "";
  return round2(parseNum(q.totale) - parseNum(q.imponibile)).toFixed(2);
}
// quota venditore: 7% del totale pattuito, min 50€, altrimenti arrotondata ai 5€ superiori
function quotaVenditoreDi(totalePattuito) {
  const base = parseNum(totalePattuito) * 0.07;
  if (base <= 50) return 50;
  return Math.ceil(base / 5) * 5;
}

// etichette del modulo di iscrizione PDF (pagina 6, layout fisso a due colonne:
// etichetta a sinistra, valore a destra sulla stessa riga) mappate ai campi del form
const ETICHETTE_MODULO_PDF = {
  tutor: "tutor con cui hai parlato",
  nome: "nome",
  cognome: "cognome",
  telefono: "telefono",
  accontoMetodo: "acconto pagato a mezzo",
  accontoImporto: "di euro",
  tagliaDivisa: "taglia divisa",
  scelteModelle: "scelta delle modelle",
  tipoCorso: "tipo di corso scelto",
  tipoPagamentoSaldo: "tipo di pagamento del saldo",
};

// legge il testo di un file PDF (senza OCR: il modulo ha testo selezionabile)
// e ne estrae i campi noti confrontando etichetta/valore riga per riga.
// Restituisce null se non trova nessuna etichetta attesa in nessuna pagina provata.
async function estraiDatiModuloPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const paginePossibili = [6, 5, 7].filter((n) => n <= pdf.numPages);

  for (const numPagina of paginePossibili) {
    const page = await pdf.getPage(numPagina);
    const content = await page.getTextContent();

    const items = content.items
      .map((it) => ({ testo: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
      .filter((it) => it.testo);
    if (items.length === 0) continue;

    // le etichette sono ancorate alla colonna più a sinistra; i valori (anche
    // su più righe, es. un testo lungo che va a capo) stanno più a destra,
    // in una fascia verticale delimitata dal punto medio con l'etichetta
    // precedente/successiva — non necessariamente dalla riga esatta
    // dell'etichetta, perché un valore su più righe può iniziare più in alto.
    const xMin = Math.min(...items.map((it) => it.x));
    const etichetteItems = items.filter((it) => Math.abs(it.x - xMin) < 5).sort((a, b) => b.y - a.y);

    const scarti = [];
    for (let i = 1; i < etichetteItems.length; i++) scarti.push(etichetteItems[i - 1].y - etichetteItems[i].y);
    scarti.sort((a, b) => a - b);
    const scartoMediano = scarti.length ? scarti[Math.floor(scarti.length / 2)] : 20;

    const risultato = {};
    for (let i = 0; i < etichetteItems.length; i++) {
      const corrente = etichetteItems[i];
      const precedente = etichetteItems[i - 1];
      const successiva = etichetteItems[i + 1];
      const yMax = precedente ? (precedente.y + corrente.y) / 2 : corrente.y + scartoMediano / 2;
      const yMin = successiva ? (corrente.y + successiva.y) / 2 : -Infinity;

      const valore = items
        .filter((it) => it !== corrente && it.x > xMin + 5 && it.y <= yMax && it.y > yMin)
        .sort((a, b) => b.y - a.y)
        .map((it) => it.testo)
        .join(" ")
        .trim();

      const etichetta = corrente.testo.replace(/:\s*$/, "").trim().toLowerCase();
      if (!etichetta || !valore) continue;
      for (const [chiave, etichettaAttesa] of Object.entries(ETICHETTE_MODULO_PDF)) {
        if (etichetta === etichettaAttesa) risultato[chiave] = valore;
      }
    }
    if (Object.keys(risultato).length > 0) return risultato;
  }
  return null;
}
// data odierna in formato "YYYY-MM-DD", per confrontare con data_inizio/data_fine
// trasforma un testo in una forma leggibile per l'URL: "Microblading Base" → "microblading-base"
function slugify(testo) {
  return (testo || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "MARIA ROSSI" o "maria rossi" → "Maria Rossi": solo iniziali maiuscole,
// usato in stampa (mai per come il dato resta salvato nel database)
function toTitleCase(testo) {
  return (testo || "")
    .toLowerCase()
    .split(/(\s+)/)
    .map((parola) => (parola ? parola.charAt(0).toUpperCase() + parola.slice(1) : parola))
    .join("");
}
// testo da stampare sul segnaposto di ciascun iscritto della classe:
// solo il nome (già maiuscolo, così com'è salvato). Se nella stessa
// classe più iscritti condividono lo stesso nome, si aggiunge
// l'iniziale del cognome per distinguerli (es. "GIULIA G.")
function testiSegnaposto(listaIscritti) {
  const conteggio = new Map();
  listaIscritti.forEach((i) => conteggio.set(i.nome, (conteggio.get(i.nome) || 0) + 1));
  const mappa = new Map();
  listaIscritti.forEach((i) => {
    const testo = conteggio.get(i.nome) > 1 ? `${i.nome} ${i.cognome.charAt(0)}.` : i.nome;
    mappa.set(i.id, testo);
  });
  return mappa;
}
// quando si apre uno dei filtri "Filtra per..." si vuole vedere subito
// l'elenco delle opzioni, non solo il <select> chiuso con la voce
// generica selezionata: appena il select compare nel DOM, gli si dà il
// focus e (dove supportato) si apre subito il suo menu nativo
function useApriSelectAlMontaggio(aperto, ref) {
  useEffect(() => {
    if (!aperto) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    try { el.showPicker?.(); } catch { /* fuori da un gesto utente diretto in alcuni browser: resta comunque il focus */ }
  }, [aperto]);
}
// "#RRGGBB" → {r,g,b} 0-1, il formato richiesto dalla funzione rgb() di pdf-lib
function hexInRgb01(hex) {
  const cifre = (hex || "#000000").replace("#", "").match(/.{1,2}/g);
  if (!cifre || cifre.length < 3) return { r: 0, g: 0, b: 0 };
  const [r, g, b] = cifre.map((h) => parseInt(h, 16) / 255);
  return { r, g, b };
}
// scarica un file dallo storage Supabase come bytes grezzi, usato sia per
// "Stampa diplomi" che per "Stampa Segnaposto" (template, font)
async function scaricaBytesStorage(bucket, percorso) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(percorso);
  const risposta = await fetch(data.publicUrl);
  if (!risposta.ok) throw new Error(`impossibile scaricare ${percorso}`);
  return new Uint8Array(await risposta.arrayBuffer());
}

function dataOggiStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// corsi in cima a tutte le liste, in quest'ordine (riconosciuti dalle parole chiave, non dall'ordine esatto delle parole nel nome); gli altri seguono in ordine alfabetico
function prioritaCorso(nome) {
  const n = (nome || "").trim().toUpperCase();
  if (n.includes("PMU") && n.includes("BASE")) return 0;
  if (n.includes("MICRO") && n.includes("BASE")) return 1;
  return -1;
}
function ordinaCorsi(lista) {
  return [...(lista || [])].sort((a, b) => {
    const ia = prioritaCorso(a.nome);
    const ib = prioritaCorso(b.nome);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return (a.nome || "").localeCompare(b.nome || "");
  });
}
// totale effettivo di una quota (acconto/precorso) salvata su un iscritto, interessi compresi
function totQuota(i, prefisso) {
  const interessi = i[`${prefisso}_metodo`] === "Rate" ? (i[`${prefisso}_interessi`] || 0) : 0;
  return round2((i[`${prefisso}_totale`] || 0) + interessi);
}
// totale da pagare per le modelle: usa il prezzo speciale se impostato, altrimenti n. modelle × 60€
function modelleTotaleDi(i) {
  if (i.prezzo_speciale_modelle != null) return i.prezzo_speciale_modelle;
  return round2((i.numero_modelle || 0) * 60);
}
// posti massimi effettivi di un'edizione: il numero scelto per la data (o, in mancanza,
// quello di default del corso) non può mai superare il tetto massimo della sede
function postiMaxEffettivi(cd, corso, loc) {
  const base = cd?.posti_max ?? corso?.posti_max ?? 0;
  if (loc?.posti_max != null) return Math.min(base, loc.posti_max);
  return base;
}

// blocco Imponibile/IVA/Totale + metodo di pagamento per una singola quota
function BloccoQuota({ titolo, valori, onImponibile, onTotale, onMetodo, onInteressi, onTotaleConInteressi, soloLettura, imponibileBloccato, totaleBloccato, opzioniMetodo }) {
  const totaleConInteressi = round2(parseNum(valori.totale) + parseNum(valori.interessi || 0));
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10, background: soloLettura ? BG : "#fff" }}>
      <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 90px" }}>
          <Field label="Imponibile">
            <input
              style={{ ...inputStyle, background: soloLettura || imponibileBloccato ? "#EFEFEF" : "#fff", color: soloLettura || imponibileBloccato ? MUTED : NAVY }}
              inputMode="decimal"
              value={valori.imponibile}
              disabled={soloLettura || imponibileBloccato}
              onChange={(e) => onImponibile && onImponibile(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <Field label="IVA 22%">
            <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={ivaDiQuota(valori)} disabled />
          </Field>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <Field label={titolo === "Quota acconto" && valori.metodo === "Rate" ? "Totale (senza interessi)" : "Totale"}>
            <input
              style={{ ...inputStyle, background: soloLettura || totaleBloccato ? "#EFEFEF" : "#fff", color: soloLettura || totaleBloccato ? MUTED : NAVY }}
              inputMode="decimal"
              value={valori.totale}
              disabled={soloLettura || totaleBloccato}
              onChange={(e) => onTotale && onTotale(e.target.value)}
            />
          </Field>
        </div>
      </div>
      {onMetodo && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...fontBody, fontSize: 13, color: NAVY }}>
          {(opzioniMetodo || ["Sito", "Bonifico", "Pos", "Contanti"]).map((opz) => (
            <label key={opz} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" name={titolo + "-metodo"} checked={valori.metodo === opz} onChange={() => onMetodo(opz)} />
              {opz}
            </label>
          ))}
        </div>
      )}
      {onMetodo && valori.metodo === "Rate" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Interessi">
              <input
                style={inputStyle}
                inputMode="decimal"
                value={valori.interessi || ""}
                onChange={(e) => onInteressi && onInteressi(e.target.value)}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Totale incluso interessi">
              {onTotaleConInteressi ? (
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={valori.totale === "" && (valori.interessi || "") === "" ? "" : totaleConInteressi.toFixed(2)}
                  onChange={(e) => onTotaleConInteressi(e.target.value)}
                />
              ) : (
                <input
                  style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }}
                  value={valori.totale === "" && (valori.interessi || "") === "" ? "" : totaleConInteressi.toFixed(2)}
                  disabled
                />
              )}
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ title }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ ...fontDisplay, fontSize: 26, color: NAVY }}>{title}</div>
    </div>
  );
}

// ---------- Gate di accesso ----------
function Gate({ onOk }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const urlDebug = import.meta.env.VITE_SUPABASE_URL || "(VITE_SUPABASE_URL non impostata)";
  return (
    <div style={{ ...fontBody, maxWidth: 340, margin: "120px auto", textAlign: "center" }}>
      <div style={{ ...fontDisplay, fontSize: 24, color: NAVY, letterSpacing: 0.5 }}>CALENDARIO CORSI</div>
      <div style={{ ...fontDisplay, fontSize: 15, color: NAVY, marginBottom: 18, letterSpacing: 0.5 }}>ELITEDERMA</div>
      <input
        type="password"
        placeholder="Codice d'accesso"
        value={code}
        onChange={(e) => { setCode(e.target.value); setErr(false); }}
        style={{ ...inputStyle, textAlign: "center", marginBottom: 12 }}
        onKeyDown={(e) => e.key === "Enter" && check()}
      />
      <Button onClick={check} style={{ width: "100%" }}>Entra</Button>
      {err && <div style={{ color: "#C0392B", fontSize: 13, marginTop: 10 }}>Codice non corretto</div>}
      <div style={{ fontSize: 10, color: MUTED, marginTop: 30, wordBreak: "break-all" }}>
        Database collegato: {urlDebug}
      </div>
    </div>
  );
  function check() {
    if (!ACCESS_CODE || code === ACCESS_CODE) {
      sessionStorage.setItem("edc_ok", "1");
      onOk();
    } else setErr(true);
  }
}

// ---------- Assegnazione Master ----------
// tabella orizzontale con una riga per ogni data futura: sede confermata,
// master/assistenti/leve/alloggio assegnabili da tendina, note libere e
// gestione biglietti di viaggio (stato prenotazione, upload file, link da
// copiare e mandare alla master).
function AssegnazioneMaster({ corsi, location, corsiDate, master, hotel, assistente, leva, ricarica, onBack }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const [filtroCorso, setFiltroCorso] = useState("");
  const [filtroCitta, setFiltroCitta] = useState("");
  const [filtroMaster, setFiltroMaster] = useState("");
  const [filtroAssistente, setFiltroAssistente] = useState("");
  const [filtroLeva, setFiltroLeva] = useState("");
  const [apriFiltro, setApriFiltro] = useState(""); // quale tendina filtro è aperta, "" = nessuna

  // stagione bloccata (persistita): se assente, la stagione mostrata segue
  // sempre la data odierna e passa automaticamente a quella nuova a
  // settembre; "Setta di default" la fissa, "Sblocca" la rimuove
  const [stagioneBloccata, setStagioneBloccata] = useState(() => {
    try {
      const v = localStorage.getItem(CHIAVE_STAGIONE_BLOCCATA);
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  });
  // stagione al momento mostrata a schermo: parte dalla bloccata (se c'è)
  // o da quella corrente, ma può essere cambiata liberamente dalla tendina
  // per sfogliare le altre stagioni senza per questo bloccarle
  const [stagioneVista, setStagioneVista] = useState(stagioneBloccata ?? stagioneCorrente());

  const stagioniDisponibili = useMemo(() => {
    const set = new Set(corsiDate.map((cd) => annoStagioneDaData(cd.data_inizio)));
    set.add(stagioneCorrente());
    set.add(stagioneVista);
    return Array.from(set).sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corsiDate, stagioneVista]);

  function bloccaStagioneDiDefault() {
    try { localStorage.setItem(CHIAVE_STAGIONE_BLOCCATA, String(stagioneVista)); } catch { /* ignora */ }
    setStagioneBloccata(stagioneVista);
  }
  function sbloccaStagione() {
    try { localStorage.removeItem(CHIAVE_STAGIONE_BLOCCATA); } catch { /* ignora */ }
    setStagioneBloccata(null);
    setStagioneVista(stagioneCorrente());
  }

  const filtriAttivi = filtroCorso || filtroCitta || filtroMaster || filtroAssistente || filtroLeva;

  const righe = corsiDate
    .filter((cd) => cd.data_fine >= dataOggiStr())
    .filter((cd) => annoStagioneDaData(cd.data_inizio) === stagioneVista)
    .filter((cd) => !filtroCorso || cd.corso_id === filtroCorso)
    .filter((cd) => !filtroCitta || cd.location_id === filtroCitta)
    .filter((cd) => !filtroMaster || cd.master_id === filtroMaster)
    .filter((cd) => !filtroAssistente || (cd.assistente_ids || []).includes(filtroAssistente))
    .filter((cd) => !filtroLeva || (cd.leva_ids || []).includes(filtroLeva))
    .slice()
    .sort((a, b) =>
      a.data_inizio.localeCompare(b.data_inizio)
      || (corsoById[a.corso_id]?.nome || "").localeCompare(corsoById[b.corso_id]?.nome || "")
      || (locById[a.location_id]?.nome || "").localeCompare(locById[b.location_id]?.nome || "")
      || a.id.localeCompare(b.id)
    );

  const gruppiMese = {};
  righe.forEach((cd) => {
    const [anno, mese] = cd.data_inizio.split("-");
    const chiave = `${anno}-${mese}`;
    if (!gruppiMese[chiave]) gruppiMese[chiave] = { etichetta: `${MESI[parseInt(mese, 10) - 1]} ${anno}`, righe: [] };
    gruppiMese[chiave].righe.push(cd);
  });
  const chiaviMese = Object.keys(gruppiMese).sort();

  // quanti corsi (tra le edizioni future della stagione vista, indipendentemente
  // dagli altri filtri attivi) ha già ricevuto ciascuna master, per la barra
  // riassuntiva in alto
  const conteggioMaster = {};
  corsiDate
    .filter((cd) => cd.data_fine >= dataOggiStr() && cd.master_id && annoStagioneDaData(cd.data_inizio) === stagioneVista)
    .forEach((cd) => {
      conteggioMaster[cd.master_id] = (conteggioMaster[cd.master_id] || 0) + 1;
    });
  const masterConteggi = Object.entries(conteggioMaster)
    .map(([id, n]) => ({ nome: master.find((m) => m.id === id)?.nome, n }))
    .filter((x) => x.nome)
    .sort((a, b) => b.n - a.n);

  async function salvaCampo(id, campo, valore) {
    const { error } = await supabase.from("corsi_date").update({ [campo]: valore }).eq("id", id);
    if (error) { window.alert("Errore: " + error.message); return; }
    ricarica();
  }

  // aggiunge una riga vuota all'elenco (assistente_ids / leva_ids)
  function aggiungiRigaElenco(cd, campo) {
    salvaCampo(cd.id, campo, [...(cd[campo] || []), null]);
  }
  // aggiorna la riga "idx" dell'elenco: selezionare "—" (valore vuoto) rimuove quella riga
  function modificaRigaElenco(cd, campo, idx, valore) {
    const elenco = [...(cd[campo] || [])];
    if (!valore) elenco.splice(idx, 1);
    else elenco[idx] = valore;
    salvaCampo(cd.id, campo, elenco);
  }

  async function caricaBiglietti(cd, fileList) {
    const nuovi = [];
    for (const file of Array.from(fileList || [])) {
      const percorso = `${cd.id}/biglietto-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file);
      if (error) { window.alert("Errore caricamento: " + error.message); return; }
      nuovi.push(percorso);
    }
    if (nuovi.length === 0) return;
    await salvaCampo(cd.id, "viaggio_file", [...(cd.viaggio_file || []), ...nuovi]);
  }

  async function cancellaBiglietti(cd) {
    const n = (cd.viaggio_file || []).length;
    if (n === 0) return;
    if (!window.confirm(`Vuoi cancellare ${n === 1 ? "il file caricato" : `i ${n} file caricati`}?`)) return;
    await salvaCampo(cd.id, "viaggio_file", []);
    window.alert("Eseguito.");
  }

  async function copiaBiglietti(cd) {
    const file = cd.viaggio_file || [];
    if (file.length === 0) { window.alert("Non ci sono biglietti."); return; }
    const corso = corsoById[cd.corso_id];
    const loc = locById[cd.location_id];
    const leggibile = [slugify(corso?.nome), slugify(loc?.nome), slugData(cd.data_inizio, cd.data_fine)].filter(Boolean).join("/");
    const url = `${window.location.origin}${window.location.pathname}?biglietti=${leggibile}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Link copiato.");
    } catch (e) {
      window.alert("Impossibile copiare automaticamente. Link: " + url);
    }
  }

  const fontScheda = { fontFamily: "'Sofia Sans Condensed',sans-serif" };
  const bordoV = `1px solid ${CREAM_BORDER}`;
  const celStyle = { padding: "6px 5px", borderBottom: bordoV, borderRight: bordoV, verticalAlign: "middle" };
  const thStyle = { ...celStyle, ...fontScheda, fontSize: 8, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", whiteSpace: "nowrap", background: BG };
  const campoStyle = { ...fontScheda, fontSize: 10, padding: "5px 6px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 6, width: "100%", boxSizing: "border-box", background: "#fff" };
  const semaforo = (attivo, onClick, size = "normale") => (
    <button
      onClick={onClick}
      style={{
        ...fontScheda, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
        border: `1px solid ${attivo ? "#2E7D32" : "#C0392B"}`, borderRadius: 7,
        padding: size === "piccolo" ? "4px 9px" : "5px 10px",
        background: attivo ? "#E8F5E9" : "#FDECEC", color: attivo ? "#2E7D32" : "#C0392B",
      }}
    >
      {attivo ? "SI" : "NO"}
    </button>
  );

  // larghezza delle colonne della tabella: trascinabile con il mouse (come
  // in Excel) afferrando la giunzione tra due colonne nell'intestazione;
  // resta salvata per sempre in questo browser (localStorage)
  const larghezzeSalvate = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE_LARGHEZZE_COLONNE) || "null");
      if (Array.isArray(v) && v.length === LARGHEZZE_COLONNE_DEFAULT.length) return v;
    } catch { /* localStorage non disponibile: usa i default */ }
    return LARGHEZZE_COLONNE_DEFAULT;
  })();
  const [larghezze, setLarghezze] = useState(larghezzeSalvate);
  const COLONNE = larghezze.map((larghezza) => ({ larghezza }));
  const larghezzaTabella = larghezze.reduce((a, b) => a + b, 0);

  const ridimensionamentoRef = React.useRef(null);
  function iniziaRidimensionamento(e, indice) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    ridimensionamentoRef.current = { indice, pointerId: e.pointerId, startX: e.clientX, startWidth: larghezze[indice] };
  }
  function muoviRidimensionamento(e) {
    const r = ridimensionamentoRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    const nuovaLarghezza = Math.max(30, r.startWidth + (e.clientX - r.startX));
    setLarghezze((precedenti) => precedenti.map((l, i) => (i === r.indice ? nuovaLarghezza : l)));
  }
  function fineRidimensionamento() {
    if (!ridimensionamentoRef.current) return;
    ridimensionamentoRef.current = null;
    setLarghezze((attuali) => {
      try { localStorage.setItem(CHIAVE_LARGHEZZE_COLONNE, JSON.stringify(attuali)); } catch { /* ignora */ }
      return attuali;
    });
  }

  // elenco di tendine per un campo "array" (assistente_ids/leva_ids): un
  // quadratino "+" in alto aggiunge una riga, selezionare "—" su una riga
  // già esistente la rimuove
  function elencoModificabile(cd, campo, opzioni) {
    const elenco = cd[campo] || [];
    const righeVisibili = elenco.length > 0 ? elenco : [null];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {righeVisibili.map((id, idx) => {
          const sceltiAltrove = elenco.filter((_, i) => i !== idx);
          const opzioniDisponibili = opzioni.filter((o) => o.id === id || !sceltiAltrove.includes(o.id));
          return (
            <select
              key={idx}
              style={campoStyle}
              value={id || ""}
              onChange={(e) => {
                if (e.target.value === "__aggiungi__") { aggiungiRigaElenco(cd, campo); return; }
                modificaRigaElenco(cd, campo, idx, e.target.value);
              }}
            >
              <option value="">—</option>
              {opzioniDisponibili.map((o) => <option key={o.id} value={o.id}>{o.nome.toUpperCase()}</option>)}
              <option value="__aggiungi__">+ Aggiungi</option>
            </select>
          );
        })}
      </div>
    );
  }

  function filtroDropdown(chiave, etichetta, valore, setValore, opzioni) {
    return (
      <div style={{ position: "relative" }}>
        <Button
          variant={valore ? "primary" : "ghost"}
          style={fontScheda}
          onClick={() => setApriFiltro(apriFiltro === chiave ? "" : chiave)}
        >
          {valore ? opzioni.find((o) => o.id === valore)?.nome?.toUpperCase() : etichetta}
        </Button>
        {apriFiltro === chiave && (
          <select
            autoFocus
            style={{ ...inputStyle, ...fontScheda, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
            value={valore}
            onChange={(e) => { setValore(e.target.value); setApriFiltro(""); }}
            onBlur={() => setApriFiltro("")}
          >
            <option value="">Tutti</option>
            {opzioni.map((o) => <option key={o.id} value={o.id}>{o.nome.toUpperCase()}</option>)}
          </select>
        )}
      </div>
    );
  }

  function tabellaMese(righeMese) {
    return (
      <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, marginBottom: 28 }}>
        <table style={{ borderCollapse: "collapse", width: larghezzaTabella, tableLayout: "fixed" }}>
          <colgroup>{COLONNE.map((c, i) => <col key={i} style={{ width: c.larghezza }} />)}</colgroup>
          <thead>
            <tr>
              {ETICHETTE_COLONNE_MASTER.map((etichetta, i) => (
                <th key={i} style={{ ...thStyle, position: "relative", borderRight: i === ETICHETTE_COLONNE_MASTER.length - 1 ? "none" : bordoV }}>
                  {etichetta}
                  <div
                    onPointerDown={(e) => iniziaRidimensionamento(e, i)}
                    onPointerMove={muoviRidimensionamento}
                    onPointerUp={fineRidimensionamento}
                    onPointerCancel={fineRidimensionamento}
                    style={{ position: "absolute", top: 0, right: -4, bottom: 0, width: 8, cursor: "col-resize", touchAction: "none", zIndex: 3 }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righeMese.map((cd) => {
              const corso = corsoById[cd.corso_id];
              const loc = locById[cd.location_id];
              const nBiglietti = (cd.viaggio_file || []).length;
              const { sopra, sotto } = fmtDataStack(cd.data_inizio, cd.data_fine);
              return (
                <tr key={cd.id}>
                  <td style={{ ...celStyle, ...fontScheda, fontSize: 10, color: NAVY, textAlign: "center" }}>
                    <div>{sopra}</div>
                    <div style={{ fontSize: 8, color: MUTED }}>{sotto}</div>
                  </td>
                  <td style={{ ...celStyle, ...fontScheda, fontSize: 10, color: NAVY, fontWeight: 700 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: corso?.colore || NAVY, flexShrink: 0 }} />
                      {corso?.nome?.toUpperCase() || "?"}
                    </span>
                  </td>
                  <td style={{ ...celStyle, ...fontScheda, fontSize: 10, color: NAVY }}>{loc?.nome?.toUpperCase() || "?"}</td>
                  <td style={{ ...celStyle, textAlign: "center" }}>
                    {semaforo(cd.sede_confermata, () => salvaCampo(cd.id, "sede_confermata", !cd.sede_confermata), "piccolo")}
                  </td>
                  <td style={celStyle}>
                    <select style={campoStyle} value={cd.master_id || ""} onChange={(e) => salvaCampo(cd.id, "master_id", e.target.value || null)}>
                      <option value="">—</option>
                      {master.map((m) => <option key={m.id} value={m.id}>{m.nome.toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={celStyle}>
                    <input style={campoStyle} defaultValue={cd.note || ""} onBlur={(e) => { if (e.target.value !== (cd.note || "")) salvaCampo(cd.id, "note", e.target.value || null); }} />
                  </td>
                  <td style={celStyle}>
                    {elencoModificabile(cd, "assistente_ids", assistente)}
                  </td>
                  <td style={celStyle}>
                    {elencoModificabile(cd, "leva_ids", leva)}
                  </td>
                  <td style={celStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                      {semaforo(cd.viaggio_prenotato, () => salvaCampo(cd.id, "viaggio_prenotato", !cd.viaggio_prenotato), "piccolo")}
                      <Button variant="ghost" onClick={() => copiaBiglietti(cd)} style={{ ...fontScheda, fontSize: 8, padding: "4px 6px" }}>Copia</Button>
                      <label style={{ ...fontScheda, fontSize: 8, color: NAVY, border: `1px solid ${CREAM_BORDER}`, borderRadius: 6, padding: "4px 6px", cursor: "pointer", whiteSpace: "nowrap" }}>
                        +
                        <input type="file" multiple accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => { caricaBiglietti(cd, e.target.files); e.target.value = ""; }} />
                      </label>
                      {nBiglietti > 0 && (
                        <span
                          onClick={() => cancellaBiglietti(cd)}
                          title="Clicca per cancellare i file caricati"
                          style={{ ...fontScheda, fontSize: 8, color: MUTED, whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline" }}
                        >
                          {nBiglietti} file
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={celStyle}>
                    <select style={campoStyle} value={cd.alloggio_id || ""} onChange={(e) => salvaCampo(cd.id, "alloggio_id", e.target.value || null)}>
                      <option value="">—</option>
                      {hotel.map((h) => <option key={h.id} value={h.id}>{h.nome.toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={{ ...celStyle, borderRight: "none" }}>
                    <input style={campoStyle} defaultValue={cd.note_viaggio || ""} onBlur={(e) => { if (e.target.value !== (cd.note_viaggio || "")) salvaCampo(cd.id, "note_viaggio", e.target.value || null); }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Assegnazione Master" onBack={onBack} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <select
          value={stagioneVista}
          onChange={(e) => setStagioneVista(parseInt(e.target.value, 10))}
          style={{ ...inputStyle, ...fontScheda, width: "auto" }}
        >
          {stagioniDisponibili.map((anno) => (
            <option key={anno} value={anno}>{etichettaStagione(anno)}</option>
          ))}
        </select>
        <Button variant="ghost" style={fontScheda} onClick={bloccaStagioneDiDefault}>
          {stagioneBloccata === stagioneVista ? "Stagione di default ✓" : "Setta di default"}
        </Button>
        {stagioneBloccata != null && (
          <Button variant="ghost" style={fontScheda} onClick={sbloccaStagione}>Sblocca</Button>
        )}
      </div>
      <div style={{ ...fontScheda, fontSize: 13, color: MUTED, marginBottom: 18 }}>
        Solo le edizioni future. Ogni modifica si salva da sola. Scorri lateralmente per vedere tutte le colonne.
      </div>

      <div
        style={{
          position: "sticky", top: 0, zIndex: 20, background: "#fff",
          borderTop: `2px solid ${NAVY}`, borderBottom: `1px solid ${CREAM_BORDER}`,
          padding: "10px 12px", marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        }}
      >
        <span style={{ ...fontScheda, fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Corsi assegnati:</span>
        {masterConteggi.length === 0 && <span style={{ ...fontScheda, fontSize: 13, color: MUTED }}>nessuno ancora</span>}
        {masterConteggi.map((m) => (
          <span key={m.nome} style={{ ...fontScheda, fontSize: 11, fontWeight: 700, color: NAVY, background: BG_CHIARO, borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap" }}>
            {m.nome.toUpperCase()} {m.n}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {filtroDropdown("corso", "Filtra per corso", filtroCorso, setFiltroCorso, corsi)}
        {filtroDropdown("citta", "Filtra per città", filtroCitta, setFiltroCitta, location)}
        {filtroDropdown("master", "Filtra per master", filtroMaster, setFiltroMaster, master)}
        {filtroDropdown("assistente", "Filtra per assistente", filtroAssistente, setFiltroAssistente, assistente)}
        {filtroDropdown("leva", "Filtra per leva", filtroLeva, setFiltroLeva, leva)}
        {filtriAttivi && (
          <Button
            variant="ghost"
            onClick={() => { setFiltroCorso(""); setFiltroCitta(""); setFiltroMaster(""); setFiltroAssistente(""); setFiltroLeva(""); setApriFiltro(""); }}
          >
            Cancella filtri
          </Button>
        )}
      </div>

      {chiaviMese.length === 0 && (
        <div style={{ ...fontScheda, fontSize: 13, color: MUTED, textAlign: "center", padding: 20 }}>Nessuna data in programmazione.</div>
      )}
      {chiaviMese.map((chiave) => (
        <div key={chiave}>
          <div style={{ ...fontScheda, fontSize: 20, fontWeight: 800, color: NAVY, textAlign: "left", marginBottom: 10 }}>
            {gruppiMese[chiave].etichetta.toUpperCase()}
          </div>
          {tabellaMese(gruppiMese[chiave].righe)}
        </div>
      ))}
    </div>
  );
}

// ---------- Statistiche ----------
function Statistiche({ onBack, onApriVenditori, onApriUltimeIscrizioni }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Statistiche" onBack={onBack} />
      <CardHome title="Statistica venditori" sub="Iscrizioni fatte da ciascun venditore, per corso" onClick={onApriVenditori} />
      <CardHome title="Ultime iscrizioni" sub="Elenco delle iscrizioni più recenti, per giorno di inserimento" onClick={onApriUltimeIscrizioni} />
    </div>
  );
}

// elenco delle iscrizioni più recenti, raggruppate per giorno di
// inserimento (campo "ts" dell'iscritto), più recenti in cima
function UltimeIscrizioni({ corsi, location, corsiDate, iscritti, onApriIscritto }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const cdById = useMemo(() => Object.fromEntries(corsiDate.map((cd) => [cd.id, cd])), [corsiDate]);

  const ordinate = iscritti
    .filter((i) => i.ts)
    .slice()
    .sort((a, b) => b.ts.localeCompare(a.ts));

  // le iscrizioni flaggate "vecchia iscrizione" (inserite ora ma relative a
  // un corso già passato) non entrano nei gruppi per giorno: altrimenti
  // sporcherebbero il giorno di inserimento con dati che non riguardano
  // davvero "oggi". Finiscono tutte in un unico elenco a parte
  const recenti = ordinate.filter((i) => !i.vecchia_iscrizione);
  const mesePrecedenti = ordinate.filter((i) => i.vecchia_iscrizione);

  const gruppi = {};
  recenti.forEach((i) => {
    const chiave = i.ts.slice(0, 10); // "YYYY-MM-DD"
    if (!gruppi[chiave]) gruppi[chiave] = [];
    gruppi[chiave].push(i);
  });
  const chiaviData = Object.keys(gruppi).sort((a, b) => b.localeCompare(a));

  const bordoV = `1px solid ${CREAM_BORDER}`;
  const celStyle = { padding: "8px 12px", borderBottom: bordoV, borderRight: bordoV };
  const thStyle = { ...celStyle, ...fontBody, fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", background: BG };

  const tabella = (lista) => (
    <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Tutor</th>
            <th style={thStyle}>Tipo di corso</th>
            <th style={thStyle}>Pacchetto/Kit</th>
            <th style={thStyle}>Città</th>
            <th style={thStyle}>Data del corso</th>
            <th style={{ ...thStyle, borderRight: "none" }}>Importo pattuito</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((i) => {
            const cd = cdById[i.corso_data_id];
            const corso = cd ? corsoById[cd.corso_id] : null;
            const loc = cd ? locById[cd.location_id] : null;
            return (
              <tr
                key={i.id}
                onClick={onApriIscritto ? () => onApriIscritto(i) : undefined}
                style={{ cursor: onApriIscritto ? "pointer" : undefined }}
              >
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, fontWeight: 600, whiteSpace: "nowrap" }}>{(i.tutor || "—").toUpperCase()}</td>
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{corso?.nome?.toUpperCase() || "?"}</td>
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY }}>{i.pacchetto_kit || "—"}</td>
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{loc?.nome?.toUpperCase() || "?"}</td>
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{cd ? fmtDataCompatta(cd.data_inizio, cd.data_fine) : "—"}</td>
                <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, fontWeight: 600, whiteSpace: "nowrap", borderRight: "none" }}>
                  {i.totale_pattuito != null ? `${i.totale_pattuito} €` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 800, color: NAVY, textAlign: "center", marginBottom: 30 }}>
        ULTIME ISCRIZIONI
      </div>

      {chiaviData.length === 0 && mesePrecedenti.length === 0 && (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessuna iscrizione ancora.</div>
      )}

      {chiaviData.map((data) => (
        <div key={data} style={{ marginBottom: 28 }}>
          <div style={{ ...fontBody, fontSize: 15, fontWeight: 600, color: NAVY, textAlign: "center", marginBottom: 12 }}>
            {fmtDataLunga(data)}
          </div>
          {tabella(gruppi[data])}
        </div>
      ))}

      {mesePrecedenti.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...fontBody, fontSize: 15, fontWeight: 600, color: NAVY, textAlign: "center", marginBottom: 12 }}>
            Mesi precedenti
          </div>
          {tabella(mesePrecedenti)}
        </div>
      )}
    </div>
  );
}

// quante iscrizioni ha fatto ciascun venditore (campo "Tutor" nella scheda
// iscritto), nel periodo scelto, con il dettaglio corso per corso
function StatisticaVenditori({ corsi, corsiDate, iscritti, onBack }) {
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [periodoSel, setPeriodoSel] = useState("");

  // larghezza delle colonne trascinabile con il mouse (come in Assegnazione
  // Master), qui però le colonne sono una per venditore/corso e cambiano in
  // base ai filtri: la larghezza è quindi una mappa "chiave colonna" -> px
  // (chiave = "venditore"/"totale" o il nome del corso stesso) invece che
  // un array a indice fisso, e resta salvata per sempre in questo browser
  const [larghezze, setLarghezze] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHIAVE_LARGHEZZE_VENDITORI) || "{}"); } catch { return {}; }
  });
  function larghezzaDi(chiave, larghezzaDefault) {
    return larghezze[chiave] ?? larghezzaDefault;
  }
  const ridimensionamentoRef = React.useRef(null);
  function iniziaRidimensionamento(e, chiave, larghezzaAttuale) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    ridimensionamentoRef.current = { chiave, pointerId: e.pointerId, startX: e.clientX, startWidth: larghezzaAttuale };
  }
  function muoviRidimensionamento(e) {
    const r = ridimensionamentoRef.current;
    if (!r || e.pointerId !== r.pointerId) return;
    const nuovaLarghezza = Math.max(30, r.startWidth + (e.clientX - r.startX));
    setLarghezze((precedenti) => ({ ...precedenti, [r.chiave]: nuovaLarghezza }));
  }
  function fineRidimensionamento() {
    if (!ridimensionamentoRef.current) return;
    ridimensionamentoRef.current = null;
    setLarghezze((attuali) => {
      try { localStorage.setItem(CHIAVE_LARGHEZZE_VENDITORI, JSON.stringify(attuali)); } catch { /* ignora */ }
      return attuali;
    });
  }

  // primo e ultimo giorno del mese "oggi + offsetMesi" (0 = mese corrente, -1 = mese scorso)
  function rangeMese(offsetMesi) {
    const oggi = new Date();
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth() + offsetMesi, 1);
    const fine = new Date(oggi.getFullYear(), oggi.getMonth() + offsetMesi + 1, 0);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { inizio: fmt(inizio), fine: fmt(fine) };
  }
  function selezionaPeriodo(valore) {
    setPeriodoSel(valore);
    if (valore === "corrente") {
      const { inizio, fine } = rangeMese(0);
      setDa(inizio); setA(fine);
    } else if (valore === "scorso") {
      const { inizio, fine } = rangeMese(-1);
      setDa(inizio); setA(fine);
    }
  }
  function cancellaFiltri() {
    setDa(""); setA(""); setPeriodoSel("");
  }

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const cdById = useMemo(() => Object.fromEntries(corsiDate.map((cd) => [cd.id, cd])), [corsiDate]);

  const filtrati = iscritti.filter((i) => {
    if (!i.ts) return false;
    // le iscrizioni flaggate "vecchia iscrizione" sono relative a un corso
    // già passato inserito ora: non devono contare nelle statistiche per
    // periodo, altrimenti gonfiano il mese in cui vengono solo inserite
    if (i.vecchia_iscrizione) return false;
    if (da && i.ts < da) return false;
    if (a && i.ts > `${a}T23:59:59.999`) return false;
    return true;
  });

  // toglie gli accenti per riconoscere come lo stesso venditore "MAURE" e
  // "MAURÉ" (o qualunque altra variante con/senza accento dello stesso nome)
  function senzaAccenti(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  const perVenditore = {}; // chiave senza accenti -> { totale, perCorso, varianti: {nome scritto: quante volte} }
  const totaliCorso = {};
  filtrati.forEach((i) => {
    const cd = cdById[i.corso_data_id];
    const corsoNome = cd ? (corsoById[cd.corso_id]?.nome?.toUpperCase() || "?") : "?";
    const scritto = (i.tutor || "").trim().toUpperCase() || "NON SPECIFICATO";
    const chiave = senzaAccenti(scritto);
    if (!perVenditore[chiave]) perVenditore[chiave] = { totale: 0, perCorso: {}, varianti: {} };
    perVenditore[chiave].totale += 1;
    perVenditore[chiave].perCorso[corsoNome] = (perVenditore[chiave].perCorso[corsoNome] || 0) + 1;
    perVenditore[chiave].varianti[scritto] = (perVenditore[chiave].varianti[scritto] || 0) + 1;
    totaliCorso[corsoNome] = (totaliCorso[corsoNome] || 0) + 1;
  });

  // colonne dei corsi ordinate dal più venduto al meno venduto
  const colonneCorsi = Object.keys(totaliCorso).sort((x, y) => totaliCorso[y] - totaliCorso[x]);
  // nome da mostrare per ogni venditore: se tra le varianti scritte ce n'è
  // una con l'accento la si preferisce sempre (la più frequente tra quelle
  // accentate), altrimenti la variante scritta più frequente
  function nomeDaMostrare(varianti) {
    const voci = Object.entries(varianti);
    const conAccento = voci.filter(([nome]) => nome !== senzaAccenti(nome));
    const scelta = conAccento.length > 0 ? conAccento : voci;
    scelta.sort((x, y) => y[1] - x[1]);
    return scelta[0][0];
  }
  // venditori in ordine alfabetico: man mano che ne compaiono di nuovi si
  // inseriscono al posto giusto da soli, senza bisogno di toccare il codice
  const righeVenditori = Object.entries(perVenditore)
    .map(([, dati]) => ({ nome: nomeDaMostrare(dati.varianti), totale: dati.totale, perCorso: dati.perCorso }))
    .sort((x, y) => x.nome.localeCompare(y.nome));

  const bordoV = `1px solid ${CREAM_BORDER}`;
  const celStyle = { padding: "8px 12px", borderBottom: bordoV, borderRight: bordoV, whiteSpace: "nowrap" };
  const thStyle = { ...celStyle, ...fontBody, fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", background: BG };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Statistica venditori" onBack={onBack} />
      <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18 }}>
        Numero di iscrizioni registrate per ciascun venditore (campo "Tutor" nella scheda iscritto), nel periodo scelto.
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
        <Field label="Periodo rapido">
          <select style={inputStyle} value={periodoSel} onChange={(e) => selezionaPeriodo(e.target.value)}>
            <option value="">Scegli un periodo…</option>
            <option value="corrente">Mese corrente</option>
            <option value="scorso">Mese scorso</option>
          </select>
        </Field>
        <Field label="Da">
          <input type="date" style={inputStyle} value={da} onChange={(e) => { setDa(e.target.value); setPeriodoSel(""); }} />
        </Field>
        <Field label="A">
          <input type="date" style={inputStyle} value={a} onChange={(e) => { setA(e.target.value); setPeriodoSel(""); }} />
        </Field>
        {(da || a || periodoSel) && (
          <Button variant="ghost" onClick={cancellaFiltri}>Cancella filtri</Button>
        )}
      </div>

      {righeVenditori.length === 0 ? (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna iscrizione trovata nel periodo scelto.</div>
      ) : (() => {
        // colonne effettive di questa tabella, con la loro chiave di
        // ridimensionamento e larghezza (salvata o di default): cambia in
        // base ai corsi presenti nel periodo filtrato, quindi calcolata qui
        // invece di un array fisso come in Assegnazione Master
        const colonne = [
          { chiave: "venditore", etichetta: "Venditore", larghezzaDefault: 160 },
          { chiave: "totale", etichetta: "Totale", larghezzaDefault: 90 },
          ...colonneCorsi.map((c) => ({ chiave: c, etichetta: `${c} ${totaliCorso[c]}`, larghezzaDefault: 110 })),
        ].map((c) => ({ ...c, larghezza: larghezzaDi(c.chiave, c.larghezzaDefault) }));
        const larghezzaTabella = colonne.reduce((tot, c) => tot + c.larghezza, 0);

        return (
          <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12 }}>
            <table style={{ borderCollapse: "collapse", width: larghezzaTabella, tableLayout: "fixed" }}>
              <colgroup>{colonne.map((c) => <col key={c.chiave} style={{ width: c.larghezza }} />)}</colgroup>
              <thead>
                <tr>
                  {colonne.map((c, i) => (
                    <th key={c.chiave} style={{ ...thStyle, position: "relative", borderRight: i === colonne.length - 1 ? "none" : bordoV }}>
                      {c.etichetta}
                      <div
                        onPointerDown={(e) => iniziaRidimensionamento(e, c.chiave, c.larghezza)}
                        onPointerMove={muoviRidimensionamento}
                        onPointerUp={fineRidimensionamento}
                        onPointerCancel={fineRidimensionamento}
                        style={{ position: "absolute", top: 0, right: -4, bottom: 0, width: 8, cursor: "col-resize", touchAction: "none", zIndex: 3 }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {righeVenditori.map((r) => (
                  <tr key={r.nome}>
                    <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</td>
                    <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, fontWeight: 700 }}>{r.totale}</td>
                    {colonneCorsi.map((c) => (
                      <td key={c} style={{ ...celStyle, ...fontBody, fontSize: 13, color: r.perCorso[c] ? NAVY : MUTED, textAlign: "center" }}>
                        {r.perCorso[c] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Impostazioni ----------
function Impostazioni({ corsi, location, master, hotel, assistente, leva, ricarica, onBack, onApriAssegnazioneMaster, onApriFontDiplomi, onApriSettingLoghi }) {
  const [nomeCorso, setNomeCorso] = useState("");
  const [colore, setColore] = useState("#4A90D9");
  const [postiMax, setPostiMax] = useState(10);
  const [nomeLoc, setNomeLoc] = useState("");
  const [postiMaxLoc, setPostiMaxLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [showCorsoModal, setShowCorsoModal] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showAssistenteModal, setShowAssistenteModal] = useState(false);
  const [showLevaModal, setShowLevaModal] = useState(false);

  const [corsoInModifica, setCorsoInModifica] = useState(null);
  const [modNomeCorso, setModNomeCorso] = useState("");
  const [modColoreCorso, setModColoreCorso] = useState("");
  const [modPostiCorso, setModPostiCorso] = useState("");
  const [diplomaCorsoNuovo, setDiplomaCorsoNuovo] = useState(null); // File scelto in "Aggiungi corso", non ancora caricato
  const [diplomaCorsoModifica, setDiplomaCorsoModifica] = useState(null); // File scelto per sostituire il diploma di un corso esistente
  const [salvandoCorso, setSalvandoCorso] = useState(false);

  const [locInModifica, setLocInModifica] = useState(null);
  const [modNomeLoc, setModNomeLoc] = useState("");
  const [modPostiMaxLoc, setModPostiMaxLoc] = useState("");

  const coloriUsati = useMemo(() => corsi.map((c) => c.colore.toLowerCase()), [corsi]);

  async function eliminaCorso(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Corso eliminato.");
    ricarica();
  }
  async function eliminaLocation(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("location").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Città eliminata.");
    ricarica();
  }
  function apriModificaCorso(c) {
    setCorsoInModifica(c.id);
    setModNomeCorso(c.nome.toUpperCase());
    setModColoreCorso(c.colore);
    setModPostiCorso(String(c.posti_max));
    setDiplomaCorsoModifica(null);
  }
  // carica il template PDF del diploma di un corso nello storage
  // "diploma-templates" e restituisce il percorso salvato
  async function caricaTemplateDiploma(file, corsoId) {
    const percorso = `${corsoId}/template-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("diploma-templates").upload(percorso, file);
    if (error) throw error;
    return percorso;
  }
  async function salvaModificaCorso(id) {
    if (!modNomeCorso.trim()) { setMsg("Il nome del corso non può essere vuoto."); return; }
    setSalvandoCorso(true);
    const payload = {
      nome: modNomeCorso.trim().toUpperCase(),
      colore: modColoreCorso,
      posti_max: Number(modPostiCorso) || 10,
    };
    if (diplomaCorsoModifica) {
      try {
        payload.diploma_template_path = await caricaTemplateDiploma(diplomaCorsoModifica, id);
      } catch (e) { setMsg("Errore nel caricamento del diploma: " + e.message); setSalvandoCorso(false); return; }
    }
    const { error } = await supabase.from("corsi").update(payload).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); setSalvandoCorso(false); return; }
    await ricarica();
    setSalvandoCorso(false);
    setCorsoInModifica(null);
    setDiplomaCorsoModifica(null);
    setMsg("Corso aggiornato.");
  }

  function apriModificaLocation(l) {
    setLocInModifica(l.id);
    setModNomeLoc(l.nome.toUpperCase());
    setModPostiMaxLoc(l.posti_max != null ? String(l.posti_max) : "");
  }
  async function salvaModificaLocation(id) {
    if (!modNomeLoc.trim()) { setMsg("Il nome della città non può essere vuoto."); return; }
    const { error } = await supabase.from("location").update({
      nome: modNomeLoc.trim().toUpperCase(),
      posti_max: modPostiMaxLoc === "" ? null : Number(modPostiMaxLoc),
    }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setLocInModifica(null);
    setMsg("Città aggiornata.");
    ricarica();
  }

  async function aggiungiCorso() {
    if (!nomeCorso.trim()) return;
    if (coloriUsati.includes(colore.toLowerCase())) {
      setMsg("Questo colore è già usato da un altro corso: scegline un altro.");
      return;
    }
    const ins = await supabase.from("corsi").insert({ nome: nomeCorso.trim().toUpperCase(), colore, posti_max: Number(postiMax) || 10 }).select("id").single();
    if (ins.error) { setMsg("Errore: " + ins.error.message); return; }
    if (diplomaCorsoNuovo) {
      try {
        const percorso = await caricaTemplateDiploma(diplomaCorsoNuovo, ins.data.id);
        await supabase.from("corsi").update({ diploma_template_path: percorso }).eq("id", ins.data.id);
      } catch (e) {
        setMsg("Corso aggiunto, ma errore nel caricamento del diploma: " + e.message);
        setNomeCorso(""); setDiplomaCorsoNuovo(null);
        ricarica();
        return;
      }
    }
    setNomeCorso(""); setDiplomaCorsoNuovo(null); setMsg("Corso aggiunto.");
    ricarica();
  }

  async function aggiungiLocation() {
    if (!nomeLoc.trim()) return;
    const { error } = await supabase.from("location").insert({
      nome: nomeLoc.trim().toUpperCase(),
      posti_max: postiMaxLoc === "" ? null : Number(postiMaxLoc),
    });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNomeLoc(""); setPostiMaxLoc(""); setMsg("Location aggiunta.");
    ricarica();
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Setting" onBack={onBack} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { etichetta: "Definisci corsi", onClick: () => setShowCorsoModal(true) },
          { etichetta: "Definisci Location", onClick: () => setShowLocModal(true) },
          { etichetta: "Definisci Master", onClick: () => setShowMasterModal(true) },
          { etichetta: "Definisci Hotel", onClick: () => setShowHotelModal(true) },
          { etichetta: "Definisci Assistenti", onClick: () => setShowAssistenteModal(true) },
          { etichetta: "Definisci Leve", onClick: () => setShowLevaModal(true) },
          { etichetta: "Assegna Master", onClick: onApriAssegnazioneMaster },
          { etichetta: "Setting diplomi", onClick: onApriFontDiplomi },
          { etichetta: "Setting loghi", onClick: onApriSettingLoghi },
        ].map(({ etichetta, onClick }) => (
          <Button
            key={etichetta}
            onClick={onClick}
            style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", whiteSpace: "normal", lineHeight: 1.25, padding: "6px 8px" }}
          >
            {etichetta}
          </Button>
        ))}
      </div>


      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 6 }}>{msg}</div>}

      {showCorsoModal && (
        <Modal title="Corsi" onClose={() => setShowCorsoModal(false)}>
          <div style={hStyle}>Aggiungi corso</div>
          <div style={subStyle}>Nome, colore univoco per il calendario, posti massimi di default.</div>
          <Field label="Nome corso">
            <input style={{ ...inputStyle, textTransform: "uppercase" }} value={nomeCorso} onChange={(e) => setNomeCorso(e.target.value.toUpperCase())} placeholder="es. MICROBLADING" />
          </Field>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Field label="Colore">
                <input type="color" value={colore} onChange={(e) => setColore(e.target.value)} style={{ width: "100%", height: 40, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Posti massimi">
                <input type="number" min="1" style={inputStyle} value={postiMax} onChange={(e) => setPostiMax(e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Diploma (PDF, opzionale)">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setDiplomaCorsoNuovo(e.target.files?.[0] || null)} />
              {diplomaCorsoNuovo ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun diploma caricato — caricalo qui</span>}
            </div>
          </Field>
          <Button onClick={aggiungiCorso}>Aggiungi corso</Button>

          <div style={{ ...hStyle, marginTop: 24 }}>Corsi esistenti</div>
          <div style={subStyle}>Clicca la matita per modificare, il cestino per eliminare (rimuove anche le sue date e i relativi iscritti).</div>
          {corsi.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun corso ancora.</div>}
          {corsi.map((c) => (
            <div key={c.id}>
              <RigaEliminabile
                label={
                  <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span>
                      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: c.colore, marginRight: 8 }} />
                      {c.nome.toUpperCase()}
                    </span>
                    {c.diploma_template_path ? (
                      <BadgeFileCaricato />
                    ) : (
                      <button
                        onClick={() => apriModificaCorso(c)}
                        style={{ ...fontBody, fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                      >
                        Nessun diploma caricato — caricalo qui
                      </button>
                    )}
                  </span>
                }
                dettaglio={`posti default: ${c.posti_max}`}
                onModifica={() => apriModificaCorso(c)}
                onDelete={() => eliminaCorso(c.id)}
              />
              {corsoInModifica === c.id && (
                <div style={{ padding: "10px 0 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>
                  <Field label="Nome corso">
                    <input style={{ ...inputStyle, textTransform: "uppercase" }} value={modNomeCorso} onChange={(e) => setModNomeCorso(e.target.value.toUpperCase())} />
                  </Field>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Colore">
                        <input type="color" value={modColoreCorso} onChange={(e) => setModColoreCorso(e.target.value)} style={{ width: "100%", height: 40, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }} />
                      </Field>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Posti massimi">
                        <input type="number" min="1" style={inputStyle} value={modPostiCorso} onChange={(e) => setModPostiCorso(e.target.value)} />
                      </Field>
                    </div>
                  </div>
                  <Field label="Diploma (PDF, opzionale)">
                    {c.diploma_template_path && !diplomaCorsoModifica && (
                      <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink bucket="diploma-templates" percorso={c.diploma_template_path} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="file" accept="application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setDiplomaCorsoModifica(e.target.files?.[0] || null)} />
                      {(diplomaCorsoModifica || c.diploma_template_path) ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun diploma caricato — caricalo qui</span>}
                    </div>
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button onClick={() => salvaModificaCorso(c.id)} disabled={salvandoCorso}>{salvandoCorso ? "Salvataggio…" : "Salva"}</Button>
                    <Button variant="ghost" disabled={salvandoCorso} onClick={() => { setCorsoInModifica(null); setDiplomaCorsoModifica(null); }}>Annulla</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
        </Modal>
      )}

      {showLocModal && (
        <Modal title="Location" onClose={() => setShowLocModal(false)}>
          <div style={hStyle}>Aggiungi location</div>
          <div style={subStyle}>Aggiungi una città in cui si terranno i corsi. La "Capienza sede" è il tetto assoluto: nessun corso in quella città potrà mai superarlo, anche se prevede più posti di default.</div>
          <Field label="Città">
            <input style={{ ...inputStyle, textTransform: "uppercase" }} value={nomeLoc} onChange={(e) => setNomeLoc(e.target.value.toUpperCase())} placeholder="es. MILANO" />
          </Field>
          <Field label="Capienza sede (opzionale — se vuoto, nessun tetto)">
            <input type="number" min="1" style={inputStyle} value={postiMaxLoc} onChange={(e) => setPostiMaxLoc(e.target.value)} placeholder="es. 8" />
          </Field>
          <Button onClick={aggiungiLocation}>Aggiungi location</Button>

          <div style={{ ...hStyle, marginTop: 24 }}>Città esistenti</div>
          <div style={subStyle}>Clicca la matita per modificare, il cestino per eliminare (rimuove anche le date collegate a quella città).</div>
          {location.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna città ancora.</div>}
          {location.map((l) => (
            <div key={l.id}>
              <RigaEliminabile
                label={l.nome.toUpperCase()}
                dettaglio={l.posti_max != null ? `capienza sede: ${l.posti_max}` : "nessun tetto sui posti"}
                onModifica={() => apriModificaLocation(l)}
                onDelete={() => eliminaLocation(l.id)}
              />
              {locInModifica === l.id && (
                <div style={{ padding: "10px 0 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>
                  <Field label="Nome città">
                    <input style={{ ...inputStyle, textTransform: "uppercase" }} value={modNomeLoc} onChange={(e) => setModNomeLoc(e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Capienza sede (opzionale — se vuoto, nessun tetto)">
                    <input type="number" min="1" style={inputStyle} value={modPostiMaxLoc} onChange={(e) => setModPostiMaxLoc(e.target.value)} />
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button onClick={() => salvaModificaLocation(l.id)}>Salva</Button>
                    <Button variant="ghost" onClick={() => setLocInModifica(null)}>Annulla</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
        </Modal>
      )}

      {showMasterModal && (
        <Modal title="Master" onClose={() => setShowMasterModal(false)}>
          <div style={{ ...subStyle, marginTop: -4 }}>Nomi assegnabili a una specifica data/edizione di un corso.</div>
          <GestioneListaSemplice
            nomeSingolare="Master" nomeArticolo="una" tabella="master"
            elementi={master} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. MARIA ROSSI"
            mostraFirmaCheckbox
          />
        </Modal>
      )}

      {showHotelModal && (
        <Modal title="Hotel" onClose={() => setShowHotelModal(false)}>
          <GestioneListaSemplice
            nomeSingolare="Hotel" nomeArticolo="un" tabella="hotel"
            elementi={hotel} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. HOTEL ROMA"
          />
        </Modal>
      )}

      {showAssistenteModal && (
        <Modal title="Assistente" onClose={() => setShowAssistenteModal(false)}>
          <GestioneListaSemplice
            nomeSingolare="Assistente" nomeArticolo="un" tabella="assistente"
            elementi={assistente} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. MARIA ROSSI"
          />
        </Modal>
      )}

      {showLevaModal && (
        <Modal title="Leva" onClose={() => setShowLevaModal(false)}>
          <GestioneListaSemplice
            nomeSingolare="Leva" nomeArticolo="una" tabella="leva"
            elementi={leva} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. LEVA 1"
          />
        </Modal>
      )}
    </div>
  );
}

// "Gestione date": calendario per aggiungere nuove edizioni e pannello
// per modificarle/eliminarle — prima viveva dentro "Setting", ora è una
// sua pagina separata (stesso sblocco amministratore condiviso)
function GestioneDate({ corsi, location, corsiDate, iscritti, master, ricarica, onBack, onApriData, filtroCorsoDate, setFiltroCorsoDate, filtroCittaDate, setFiltroCittaDate, filtroMasterDate, setFiltroMasterDate, cronologicoDate, setCronologicoDate }) {
  const [msg, setMsg] = useState("");
  const [popupNuovaData, setPopupNuovaData] = useState(null);
  const [popupEliminaData, setPopupEliminaData] = useState(null);
  const corsoByIdImp = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locByIdImp = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  // i filtri (corso/città/master/cronologico) vivono in App, non qui: così
  // restano impostati anche se si esce da "Gestione date" e ci si torna,
  // finché non si preme esplicitamente "Reset filtri"
  const [apriFiltroCorsoDate, setApriFiltroCorsoDate] = useState(false);
  const [apriFiltroCittaDate, setApriFiltroCittaDate] = useState(false);
  const [apriFiltroMasterDate, setApriFiltroMasterDate] = useState(false);
  const selectFiltroCorsoDateRef = React.useRef(null);
  const selectFiltroCittaDateRef = React.useRef(null);
  const selectFiltroMasterDateRef = React.useRef(null);
  useApriSelectAlMontaggio(apriFiltroCorsoDate, selectFiltroCorsoDateRef);
  useApriSelectAlMontaggio(apriFiltroCittaDate, selectFiltroCittaDateRef);
  useApriSelectAlMontaggio(apriFiltroMasterDate, selectFiltroMasterDateRef);

  const [dataInModifica, setDataInModifica] = useState(null);
  const [modDataInizio, setModDataInizio] = useState("");
  const [modDataFine, setModDataFine] = useState("");
  const [modPostiData, setModPostiData] = useState("");
  const [modMasterSel, setModMasterSel] = useState("");

  async function eliminaData(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Data eliminata.");
    ricarica();
  }
  function apriModificaData(cd) {
    setDataInModifica(cd.id);
    setModDataInizio(cd.data_inizio);
    setModDataFine(cd.data_fine);
    setModMasterSel(cd.master_id || "");
    const corsoCd = corsi.find((c) => c.id === cd.corso_id);
    const locCd = location.find((l) => l.id === cd.location_id);
    setModPostiData(String(postiMaxEffettivi(cd, corsoCd, locCd)));
  }
  function cambiaModPostiData(delta) {
    const locCd = location.find((l) => l.id === corsiDate.find((cd) => cd.id === dataInModifica)?.location_id);
    const iscrittiCount = iscritti.filter((i) => i.corso_data_id === dataInModifica).length;
    setModPostiData((v) => {
      const nuovo = Math.max(iscrittiCount, (Number(v) || 0) + delta);
      if (delta > 0 && locCd?.posti_max != null && nuovo > locCd.posti_max) {
        setMsg(`Attenzione: superati i posti disponibili per la sede (max ${locCd.posti_max} a ${locCd.nome}).`);
        return v;
      }
      return String(nuovo);
    });
  }
  async function salvaModificaData(id) {
    if (!modDataInizio) { setMsg("Seleziona almeno una data d'inizio."); return; }
    const fine = modDataFine || modDataInizio;
    const { error } = await supabase.from("corsi_date").update({
      data_inizio: modDataInizio,
      data_fine: fine,
      posti_max: modPostiData ? Number(modPostiData) : null,
      master_id: modMasterSel || null,
    }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setDataInModifica(null);
    setMsg("Data aggiornata.");
    ricarica();
  }
  async function salvaNuovaData({ corso_id, location_id, data_inizio, data_fine }) {
    const { error } = await supabase.from("corsi_date").insert({ corso_id, location_id, data_inizio, data_fine });
    if (error) { setMsg("Errore: " + error.message); return; }
    setPopupNuovaData(null);
    setMsg("Data aggiunta al calendario.");
    ricarica();
  }
  async function eliminaDataCliccata(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setPopupEliminaData(null);
    setMsg("Data eliminata.");
    ricarica();
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Gestione date" onBack={onBack} />

      <div style={cardStyle}>
        <div style={{ ...hStyle, textAlign: "center", textTransform: "uppercase" }}>Aggiungi data</div>
        <div style={subStyle}>Clicca un giorno vuoto per creare una nuova edizione (corso, città, durata). Clicca due volte un corso già esistente per eliminarlo.</div>
        <SelettoreCalendario
          corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti}
          onClickGiorno={setPopupNuovaData}
          onDoppioClickEvento={setPopupEliminaData}
        />
      </div>
      {popupNuovaData && (
        <PopupNuovaData corsi={corsi} location={location} dataClic={popupNuovaData} onSalva={salvaNuovaData} onChiudi={() => setPopupNuovaData(null)} />
      )}
      {popupEliminaData && (
        <PopupEliminaData evento={popupEliminaData} corsoById={corsoByIdImp} locById={locByIdImp} onElimina={eliminaDataCliccata} onChiudi={() => setPopupEliminaData(null)} />
      )}

      <div>
        <div style={subStyle}>Solo le edizioni future. Clicca la matita per modificarne una (anche per spostarla), il cestino per eliminarla (rimuove anche i suoi iscritti).</div>

        <div style={{ ...fontDisplay, fontSize: 20, color: NAVY, marginBottom: 10 }}>Date in programmazione</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <FiltroPill
              etichetta="Filtra corso" opzioneVuota="Tutti i corsi" opzioni={corsi}
              valore={filtroCorsoDate} etichettaAttiva={corsi.find((c) => c.id === filtroCorsoDate)?.nome.toUpperCase()}
              aperto={apriFiltroCorsoDate} selectRef={selectFiltroCorsoDateRef}
              onToggle={() => { setApriFiltroCorsoDate((v) => !v); setApriFiltroCittaDate(false); setApriFiltroMasterDate(false); }}
              onChange={(e) => { setFiltroCorsoDate(e.target.value); setApriFiltroCorsoDate(false); }}
              onBlur={() => setApriFiltroCorsoDate(false)}
            />
            <FiltroPill
              etichetta="Filtra città" opzioneVuota="Tutte le città" opzioni={location}
              valore={filtroCittaDate} etichettaAttiva={location.find((l) => l.id === filtroCittaDate)?.nome.toUpperCase()}
              aperto={apriFiltroCittaDate} selectRef={selectFiltroCittaDateRef}
              onToggle={() => { setApriFiltroCittaDate((v) => !v); setApriFiltroCorsoDate(false); setApriFiltroMasterDate(false); }}
              onChange={(e) => { setFiltroCittaDate(e.target.value); setApriFiltroCittaDate(false); }}
              onBlur={() => setApriFiltroCittaDate(false)}
            />
            <FiltroPill
              etichetta="Filtra master" opzioneVuota="Tutte le master" opzioni={master}
              valore={filtroMasterDate} etichettaAttiva={master.find((m) => m.id === filtroMasterDate)?.nome.toUpperCase()}
              aperto={apriFiltroMasterDate} selectRef={selectFiltroMasterDateRef}
              onToggle={() => { setApriFiltroMasterDate((v) => !v); setApriFiltroCorsoDate(false); setApriFiltroCittaDate(false); }}
              onChange={(e) => { setFiltroMasterDate(e.target.value); setApriFiltroMasterDate(false); }}
              onBlur={() => setApriFiltroMasterDate(false)}
            />
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <button
                onClick={() => setCronologicoDate((v) => !v)}
                style={{ ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20, border: cronologicoDate ? "none" : `1px solid ${CREAM_BORDER}`, background: cronologicoDate ? NAVY : "#fff", color: cronologicoDate ? "#fff" : NAVY, cursor: "pointer", overflow: "hidden", width: "100%", display: "block" }}
              >
                <EtichettaAdattiva testo="Cronologico" />
              </button>
            </div>
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <button
                onClick={() => { setFiltroCorsoDate(""); setFiltroCittaDate(""); setFiltroMasterDate(""); setApriFiltroCorsoDate(false); setApriFiltroCittaDate(false); setApriFiltroMasterDate(false); }}
                style={{ ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer", overflow: "hidden", width: "100%", display: "block" }}
              >
                <EtichettaAdattiva testo="Reset filtri" />
              </button>
            </div>
        </div>

        <DateRaggruppatePerCitta
          corsi={corsi}
          location={location}
          cronologico={cronologicoDate}
          corsiDate={corsiDate.filter((cd) =>
            cd.data_fine >= dataOggiStr() &&
            (!filtroCorsoDate || cd.corso_id === filtroCorsoDate) &&
            (!filtroCittaDate || cd.location_id === filtroCittaDate) &&
            (!filtroMasterDate || cd.master_id === filtroMasterDate)
          )}
          iscritti={iscritti}
          master={master}
          onApriData={onApriData}
          onDelete={eliminaData}
          onEdit={apriModificaData}
          idInModifica={dataInModifica}
          renderModifica={() => (
            <div style={{ padding: "14px 0", borderTop: `1px solid ${CREAM_BORDER}`, marginTop: 8 }}>
              <div style={{ ...fontBody, fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 10 }}>Modifica data</div>
              <div style={{ marginBottom: 14 }}>
                <CalendarioModifica
                  corsi={corsi}
                  location={location}
                  corsiDate={corsiDate}
                  iscritti={iscritti}
                  cdId={dataInModifica}
                  valore={{ inizio: modDataInizio, fine: modDataFine }}
                  onCambia={({ inizio, fine }) => { setModDataInizio(inizio); setModDataFine(fine); }}
                  ricarica={ricarica}
                  onDataEliminata={(id) => { if (id === dataInModifica) setDataInModifica(null); }}
                />
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Data inizio">
                    <input type="date" style={inputStyle} value={modDataInizio} onChange={(e) => setModDataInizio(e.target.value)} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Data fine">
                    <input type="date" style={inputStyle} value={modDataFine} min={modDataInizio || undefined} onChange={(e) => setModDataFine(e.target.value)} />
                  </Field>
                </div>
              </div>
              <Field label="Posti in classe">
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <button
                    type="button"
                    onClick={() => cambiaModPostiData(-1)}
                    disabled={Number(modPostiData) <= iscritti.filter((i) => i.corso_data_id === dataInModifica).length}
                    style={{
                      width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, fontSize: 20,
                      cursor: Number(modPostiData) <= iscritti.filter((i) => i.corso_data_id === dataInModifica).length ? "default" : "pointer",
                      opacity: Number(modPostiData) <= iscritti.filter((i) => i.corso_data_id === dataInModifica).length ? 0.35 : 1,
                    }}
                  >
                    −
                  </button>
                  <div style={{ ...fontDisplay, fontSize: 26, color: NAVY, minWidth: 40, textAlign: "center" }}>{modPostiData}</div>
                  <button
                    type="button"
                    onClick={() => cambiaModPostiData(1)}
                    style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 20, cursor: "pointer" }}
                  >
                    +
                  </button>
                </div>
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => salvaModificaData(dataInModifica)}>Salva</Button>
                <Button variant="ghost" onClick={() => setDataInModifica(null)}>Annulla</Button>
              </div>
            </div>
          )}
        />
      </div>

      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

const cardStyle = { background: "#FFFFFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 22, marginBottom: 18 };
const hStyle = { ...fontDisplay, fontSize: 20, color: NAVY, margin: "0 0 4px" };
const subStyle = { ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 };

// scala usata per renderizzare il diploma di riferimento su canvas
// (pdf.js): serve a convertire i pixel del canvas in punti PDF, così la
// dimensione dei testi di prova in anteprima può essere ricalcolata alla
// stessa proporzione con cui verranno disegnati nel PDF vero (in punti)
const SCALA_ANTEPRIMA_DIPLOMA = 1.4;

const CONFIG_DIPLOMI_DEFAULT = {
  id: null,
  font_allievo_path: null, font_data_path: null, font_firma_path: null,
  diploma_riferimento_path: null,
  nome_pos_x: 50, nome_pos_y: 45, nome_font_size: 24, nome_colore: "#ffffff", nome_allineamento: "center",
  data_pos_x: 50, data_pos_y: 65, data_font_size: 16, data_colore: "#ffffff", data_allineamento: "center",
  firma_pos_x: 50, firma_pos_y: 80, firma_font_size: 16, firma_colore: "#ffffff", firma_allineamento: "center",
  // due linee verticali trascinabili che limitano solo la larghezza del
  // nome allievo (non città/data né firma, né il resto del diploma): se
  // il nome supera questa larghezza il font si rimpicciolisce in stampa
  nome_limite_sx: 20,
  nome_limite_dx: 80,
};
// i 3 testi scritti sui diplomi: chiave dei campi in font_diplomi, colore
// dell'indicatore nell'editor visivo ed etichetta del testo di prova
// mostrato nell'anteprima trascinabile
const ELEMENTI_DIPLOMA = [
  { chiave: "nome", colore: "#2563EB", etichetta: "Nome allievo", testoProva: "Nome Cognome", campoFont: "font_allievo_path", famigliaFont: "diplomaFontNome" },
  { chiave: "data", colore: "#16A34A", etichetta: "Città e data", testoProva: "Roma, 27/06/2026", campoFont: "font_data_path", famigliaFont: "diplomaFontData" },
  { chiave: "firma", colore: "#EA580C", etichetta: "Firma master", testoProva: "Nome Master", campoFont: "font_firma_path", famigliaFont: "diplomaFontFirma" },
];

// quanti nomi allievo entrano in un foglio A4 di segnaposti: oltre questo
// numero la stampa genera più pagine, ripetendo lo stesso foglio di
// riferimento e ricominciando dal primo posto
const POSTI_PER_PAGINA_SEGNAPOSTI = 7;
const CONFIG_SEGNAPOSTI_DEFAULT = {
  id: null,
  font_path: null,
  riferimento_path: null,
  font_size: 20,
  colore: "#000000",
  // due linee verticali trascinabili (sinistra/destra): la distanza tra
  // le due definisce la larghezza massima consentita per il nome in
  // stampa, uguale per tutti i 7 posti
  limite_sx_pos_x: 30,
  limite_dx_pos_x: 70,
  // posizioni di default: 7 righe distribuite lungo il foglio, poi si
  // trascinano nel punto esatto sul foglio di riferimento caricato
  slot1_pos_x: 50, slot1_pos_y: 12.5,
  slot2_pos_x: 50, slot2_pos_y: 25,
  slot3_pos_x: 50, slot3_pos_y: 37.5,
  slot4_pos_x: 50, slot4_pos_y: 50,
  slot5_pos_x: 50, slot5_pos_y: 62.5,
  slot6_pos_x: 50, slot6_pos_y: 75,
  slot7_pos_x: 50, slot7_pos_y: 87.5,
};
const SLOT_SEGNAPOSTI = Array.from({ length: POSTI_PER_PAGINA_SEGNAPOSTI }, (_, idx) => ({
  chiave: `slot${idx + 1}`,
  numero: idx + 1,
}));

// ---------- Setting loghi / Generazione loghi ----------
const CONFIG_LOGHI_DEFAULT = { id: null, font_nome_path: null, font_numero_path: null, prossimo_numero: 1 };
// i 4 corsi che hanno sia il logo Artist che quello Expert; Master
// Assistant e Master sono categorie a sé, aggiunte a parte sotto
const CORSI_LOGO = [
  { chiave: "microblading", etichetta: "Microblading" },
  { chiave: "pmu", etichetta: "PMU" },
  { chiave: "laminazione", etichetta: "Laminazione" },
  { chiave: "extension", etichetta: "Extension" },
];
const VARIANTI_LOGO = [
  { chiave: "artist", etichetta: "Artist" },
  { chiave: "expert", etichetta: "Expert" },
];
// le 10 categorie effettive (righe di loghi_categorie): usata sia da
// "Setting loghi" (per disegnare le 10 card) sia da "Generazione loghi"
// (per risalire dalla scelta corso+variante alla chiave giusta)
const CATEGORIE_LOGO = [
  ...CORSI_LOGO.flatMap((c) => VARIANTI_LOGO.map((v) => ({
    chiave: `${c.chiave}_${v.chiave}`,
    etichetta: `${c.etichetta} — ${v.etichetta}`,
    richiedeBianco: true,
  }))),
  { chiave: "master_assistant", etichetta: "Master Assistant", richiedeBianco: true },
  { chiave: "master", etichetta: "Master", richiedeBianco: false },
];

const SIGLA_PAESE_LOGO = "IT";
// due lettere iniziali di un nome completo: se ha più parole prende la
// prima lettera della prima e dell'ultima parola (ignora eventuali nomi
// composti nel mezzo), altrimenti raddoppia l'unica parola disponibile
function inizialiNomeLogo(nomeCompleto) {
  const parole = (nomeCompleto || "").trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return "XX";
  if (parole.length === 1) return (parole[0] + "X").slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[parole.length - 1][0]).toUpperCase();
}
// es. master "Andrea Paura" + allieva "Carla Bosi" + numero 402 -> "APCB0402IT"
function calcolaCodiceLogo(masterNome, allievaNome, numero) {
  return `${inizialiNomeLogo(masterNome)}${inizialiNomeLogo(allievaNome)}${String(numero).padStart(4, "0")}${SIGLA_PAESE_LOGO}`;
}

// pagina globale (non per corso) di impostazioni per la stampa diplomi:
// i 3 font usati per scrivere su ogni diploma, e la posizione/dimensione/
// colore/allineamento di nome/città-data/firma — sempre gli stessi su
// tutti i corsi, calibrati qui trascinando 3 testi di prova sopra
// l'anteprima di un diploma di riferimento caricato apposta per questo
function FontDiplomi({ fontDiplomi, diplomaEccezioni, segnaposti, ricarica, onBack }) {
  const [config, setConfig] = useState(fontDiplomi || CONFIG_DIPLOMI_DEFAULT);
  const [msg, setMsg] = useState("");
  const [nomeEccezione, setNomeEccezione] = useState("");
  const [fileEccezione, setFileEccezione] = useState(null);
  const [salvandoEccezione, setSalvandoEccezione] = useState(false);
  const [eccezioneInModifica, setEccezioneInModifica] = useState(null);
  const [nomeModificaEccezione, setNomeModificaEccezione] = useState("");
  const [fileModificaEccezione, setFileModificaEccezione] = useState(null);
  const [fileRiferimentoNuovo, setFileRiferimentoNuovo] = useState(null);
  const [dimensioniCanvas, setDimensioniCanvas] = useState(null);
  const [larghezzaMostrata, setLarghezzaMostrata] = useState(null);
  const [elementoTrascinato, setElementoTrascinato] = useState(null);
  const [limiteNomeTrascinato, setLimiteNomeTrascinato] = useState(null); // "sx" | "dx" | null
  const canvasRef = React.useRef(null);
  const contenitoreRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const dragLimiteNomeRef = React.useRef(null);

  // ---- "Regolazione segnaposto": stessa logica del diploma di
  // riferimento sopra, ma con 7 posti invece di 3 elementi diversi, e in
  // una tabella (segnaposti_config) separata da font_diplomi
  const [configSegna, setConfigSegna] = useState(segnaposti || CONFIG_SEGNAPOSTI_DEFAULT);
  const [fileRiferimentoSegnaNuovo, setFileRiferimentoSegnaNuovo] = useState(null);
  const [dimensioniCanvasSegna, setDimensioniCanvasSegna] = useState(null);
  const [larghezzaMostrataSegna, setLarghezzaMostrataSegna] = useState(null);
  const [slotTrascinato, setSlotTrascinato] = useState(null);
  const [limiteTrascinato, setLimiteTrascinato] = useState(null); // "sx" | "dx" | null
  const canvasSegnaRef = React.useRef(null);
  const contenitoreSegnaRef = React.useRef(null);
  const dragSegnaRef = React.useRef(null);
  const dragLimiteRef = React.useRef(null);
  const modificatoLocalmenteSegnaRef = React.useRef(false);
  // una volta che l'utente inizia a modificare qualcosa qui, lo stato
  // locale diventa l'unica fonte di verità: il ricaricamento dati che
  // "aggiorna" lancia dopo ogni salvataggio serve al resto dell'app (es.
  // "Stampa diplomi"), non a questa pagina — se la si lasciasse
  // risincronizzare da fontDiplomi ad ogni fetch, un fetch avviato da
  // un'interazione precedente e arrivato in ritardo poteva sovrascrivere
  // una posizione più recente, dando l'impressione che gli elementi
  // saltassero a caso mentre li si trascinava
  const modificatoLocalmenteRef = React.useRef(false);

  useEffect(() => {
    if (!modificatoLocalmenteRef.current) setConfig(fontDiplomi || CONFIG_DIPLOMI_DEFAULT);
  }, [fontDiplomi]);

  // aggiorna lo stato locale (per il feedback visivo immediato) e salva su
  // Supabase: se la riga non esiste ancora la crea, altrimenti la aggiorna
  async function aggiorna(campi) {
    modificatoLocalmenteRef.current = true;
    const nuovo = { ...config, ...campi };
    setConfig(nuovo);
    const payload = { ...nuovo };
    delete payload.id;
    delete payload.ts;
    if (nuovo.id) {
      const { error } = await supabase.from("font_diplomi").update(payload).eq("id", nuovo.id);
      if (error) { setMsg("Errore: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("font_diplomi").insert(payload).select("id").single();
      if (error) { setMsg("Errore: " + error.message); return; }
      setConfig((c) => ({ ...c, id: data.id }));
    }
    ricarica();
  }

  useEffect(() => {
    if (!modificatoLocalmenteSegnaRef.current) setConfigSegna(segnaposti || CONFIG_SEGNAPOSTI_DEFAULT);
  }, [segnaposti]);

  async function aggiornaSegnaposti(campi) {
    modificatoLocalmenteSegnaRef.current = true;
    const nuovo = { ...configSegna, ...campi };
    setConfigSegna(nuovo);
    const payload = { ...nuovo };
    delete payload.id;
    delete payload.ts;
    if (nuovo.id) {
      const { error } = await supabase.from("segnaposti_config").update(payload).eq("id", nuovo.id);
      if (error) { setMsg("Errore: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("segnaposti_config").insert(payload).select("id").single();
      if (error) { setMsg("Errore: " + error.message); return; }
      setConfigSegna((c) => ({ ...c, id: data.id }));
    }
    ricarica();
  }

  async function caricaFile(file, bucket, prefisso) {
    const percorso = `${prefisso}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(percorso, file);
    if (error) throw error;
    return percorso;
  }

  // "Eccezioni diplomi": diplomi caricati qui una volta per tutte, poi
  // scelti sul singolo iscritto (in Contabilità classe) al posto del
  // template normale del corso
  async function aggiungiEccezione() {
    if (!nomeEccezione.trim()) { setMsg("Dai un nome all'eccezione."); return; }
    if (!fileEccezione) { setMsg("Scegli il file PDF dell'eccezione."); return; }
    setSalvandoEccezione(true);
    try {
      const percorso = await caricaFile(fileEccezione, "diploma-templates", "eccezione");
      const { error } = await supabase.from("diploma_eccezioni").insert({ nome: nomeEccezione.trim(), file_path: percorso });
      if (error) { setMsg("Errore: " + error.message); setSalvandoEccezione(false); return; }
      // il ricaricamento completo dei dati dell'app (9 tabelle) non serve
      // per mostrare subito il salvataggio: la lista qui sotto si
      // aggiorna da sola non appena la risposta arriva, senza dover
      // bloccare l'utente in attesa
      ricarica();
      setNomeEccezione(""); setFileEccezione(null);
      setMsg("Eccezione diploma aggiunta.");
    } catch (e) {
      setMsg("Errore nel caricamento dell'eccezione: " + e.message);
    }
    setSalvandoEccezione(false);
  }
  async function eliminaEccezione(id) {
    if (!window.confirm("Eliminare questa eccezione diploma? Gli iscritti che la usano torneranno al template normale del corso.")) return;
    const { error } = await supabase.from("diploma_eccezioni").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
    setMsg("Eccezione diploma eliminata.");
  }
  function apriModificaEccezione(d) {
    setEccezioneInModifica(d.id);
    setNomeModificaEccezione(d.nome);
    setFileModificaEccezione(null);
  }
  async function salvaModificaEccezione(id) {
    if (!nomeModificaEccezione.trim()) { setMsg("Dai un nome all'eccezione."); return; }
    const payload = { nome: nomeModificaEccezione.trim() };
    if (fileModificaEccezione) {
      try {
        payload.file_path = await caricaFile(fileModificaEccezione, "diploma-templates", "eccezione");
      } catch (e) { setMsg("Errore nel caricamento del file: " + e.message); return; }
    }
    const { error } = await supabase.from("diploma_eccezioni").update(payload).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setEccezioneInModifica(null);
    setFileModificaEccezione(null);
    ricarica();
    setMsg("Eccezione diploma aggiornata.");
  }

  async function gestisciUploadFont(file, campo) {
    if (!file) return;
    try {
      const percorso = await caricaFile(file, "diploma-fonts", campo);
      await aggiorna({ [campo]: percorso });
      setMsg("Font caricato.");
    } catch (e) {
      setMsg("Errore nel caricamento del font: " + e.message);
    }
  }

  async function gestisciUploadRiferimento(file) {
    if (!file) return;
    setFileRiferimentoNuovo(file);
    try {
      const percorso = await caricaFile(file, "diploma-templates", "riferimento");
      await aggiorna({ diploma_riferimento_path: percorso });
    } catch (e) {
      setMsg("Errore nel caricamento del diploma di riferimento: " + e.message);
    }
  }

  async function gestisciUploadFontSegnaposti(file) {
    if (!file) return;
    try {
      const percorso = await caricaFile(file, "diploma-fonts", "font_segnaposto");
      await aggiornaSegnaposti({ font_path: percorso });
      setMsg("Font caricato.");
    } catch (e) {
      setMsg("Errore nel caricamento del font: " + e.message);
    }
  }

  // a differenza del diploma (dove il riferimento serve solo a calibrare
  // e ogni corso ha il suo template), qui il file caricato è il vero
  // foglio di stampa: lo stesso, sempre, per ogni classe
  async function gestisciUploadRiferimentoSegnaposti(file) {
    if (!file) return;
    setFileRiferimentoSegnaNuovo(file);
    try {
      const percorso = await caricaFile(file, "diploma-templates", "segnaposti-riferimento");
      await aggiornaSegnaposti({ riferimento_path: percorso });
    } catch (e) {
      setMsg("Errore nel caricamento del foglio segnaposti: " + e.message);
    }
  }

  // renderizza la prima pagina del diploma di riferimento (il file appena
  // scelto, se c'è, altrimenti quello già salvato) su un canvas, per poter
  // posizionare i 3 testi di prova sopra la sua immagine reale
  useEffect(() => {
    let annullato = false;
    async function renderizza() {
      let buffer;
      try {
        if (fileRiferimentoNuovo) {
          buffer = await fileRiferimentoNuovo.arrayBuffer();
        } else if (config.diploma_riferimento_path) {
          const { data } = supabase.storage.from("diploma-templates").getPublicUrl(config.diploma_riferimento_path);
          const risposta = await fetch(data.publicUrl);
          buffer = await risposta.arrayBuffer();
        } else {
          setDimensioniCanvas(null);
          return;
        }
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: SCALA_ANTEPRIMA_DIPLOMA });
        const canvas = canvasRef.current;
        if (!canvas || annullato) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (!annullato) setDimensioniCanvas({ width: viewport.width, height: viewport.height });
      } catch (e) {
        if (!annullato) setMsg("Non sono riuscito a mostrare l'anteprima del diploma di riferimento: " + e.message);
      }
    }
    renderizza();
    return () => { annullato = true; };
  }, [fileRiferimentoNuovo, config.diploma_riferimento_path]);

  // carica i 3 font come web-font veri, per vedere in anteprima il testo
  // di prova esattamente nel font che verrà usato in stampa (se un font
  // manca o non si carica, l'anteprima usa semplicemente il font di
  // sistema: non blocca nulla)
  useEffect(() => {
    async function carica(percorso, famiglia) {
      if (!percorso) return;
      try {
        const { data } = supabase.storage.from("diploma-fonts").getPublicUrl(percorso);
        const font = new FontFace(famiglia, `url(${data.publicUrl})`);
        await font.load();
        document.fonts.add(font);
      } catch { /* niente da fare: resta il font di sistema in anteprima */ }
    }
    carica(config.font_allievo_path, "diplomaFontNome");
    carica(config.font_data_path, "diplomaFontData");
    carica(config.font_firma_path, "diplomaFontFirma");
  }, [config.font_allievo_path, config.font_data_path, config.font_firma_path]);

  // il contenitore dell'anteprima è mostrato a "width: 100%" fino a un
  // massimo di dimensioniCanvas.width: su schermi stretti (o se il
  // diploma è più largo dello spazio disponibile) viene quindi compresso
  // rispetto alle sue dimensioni native. Senza tenerne conto, un testo di
  // prova a fontSize fisso in px apparirebbe qui più grande, in
  // proporzione al diploma, di quanto sarà nel PDF stampato (dove la
  // stessa dimensione è in punti, sulla pagina a grandezza reale) —
  // misurando la larghezza REALMENTE visualizzata si può riscalare il
  // testo di prova in proporzione, così l'anteprima corrisponde davvero
  useEffect(() => {
    if (!fileRiferimentoNuovo && !config.diploma_riferimento_path) return;
    const el = contenitoreRef.current;
    if (!el) return;
    const osservatore = new ResizeObserver((voci) => {
      for (const voce of voci) setLarghezzaMostrata(voce.contentRect.width);
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [fileRiferimentoNuovo, config.diploma_riferimento_path]);

  // fattore che converte i punti PDF (l'unità di misura di
  // "..._font_size", quella usata davvero nella stampa) in pixel CSS alla
  // scala con cui il diploma di riferimento è mostrato in questo momento
  const scalaAnteprimaTesto = (dimensioniCanvas && larghezzaMostrata)
    ? larghezzaMostrata / (dimensioniCanvas.width / SCALA_ANTEPRIMA_DIPLOMA)
    : 1;

  // stesse identiche logiche di sopra (render su canvas, font-face,
  // scala anteprima), applicate al foglio segnaposti di riferimento
  useEffect(() => {
    let annullato = false;
    async function renderizza() {
      let buffer;
      try {
        if (fileRiferimentoSegnaNuovo) {
          buffer = await fileRiferimentoSegnaNuovo.arrayBuffer();
        } else if (configSegna.riferimento_path) {
          const { data } = supabase.storage.from("diploma-templates").getPublicUrl(configSegna.riferimento_path);
          const risposta = await fetch(data.publicUrl);
          buffer = await risposta.arrayBuffer();
        } else {
          setDimensioniCanvasSegna(null);
          return;
        }
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: SCALA_ANTEPRIMA_DIPLOMA });
        const canvas = canvasSegnaRef.current;
        if (!canvas || annullato) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (!annullato) setDimensioniCanvasSegna({ width: viewport.width, height: viewport.height });
      } catch (e) {
        if (!annullato) setMsg("Non sono riuscito a mostrare l'anteprima del foglio segnaposti: " + e.message);
      }
    }
    renderizza();
    return () => { annullato = true; };
  }, [fileRiferimentoSegnaNuovo, configSegna.riferimento_path]);

  useEffect(() => {
    async function carica(percorso, famiglia) {
      if (!percorso) return;
      try {
        const { data } = supabase.storage.from("diploma-fonts").getPublicUrl(percorso);
        const font = new FontFace(famiglia, `url(${data.publicUrl})`);
        await font.load();
        document.fonts.add(font);
      } catch { /* niente da fare: resta il font di sistema in anteprima */ }
    }
    carica(configSegna.font_path, "fontSegnaposto");
  }, [configSegna.font_path]);

  useEffect(() => {
    if (!fileRiferimentoSegnaNuovo && !configSegna.riferimento_path) return;
    const el = contenitoreSegnaRef.current;
    if (!el) return;
    const osservatore = new ResizeObserver((voci) => {
      for (const voce of voci) setLarghezzaMostrataSegna(voce.contentRect.width);
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [fileRiferimentoSegnaNuovo, configSegna.riferimento_path]);

  const scalaAnteprimaTestoSegna = (dimensioniCanvasSegna && larghezzaMostrataSegna)
    ? larghezzaMostrataSegna / (dimensioniCanvasSegna.width / SCALA_ANTEPRIMA_DIPLOMA)
    : 1;

  function iniziaDragSegna(e, chiave) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragSegnaRef.current = { chiave, pointerId: e.pointerId };
    setSlotTrascinato(chiave);
  }
  function muoviDragSegna(e) {
    const d = dragSegnaRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreSegnaRef.current) return;
    const rect = contenitoreSegnaRef.current.getBoundingClientRect();
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    // il nome si stampa sempre centrato tra le due linee di limite: solo
    // la posizione verticale di ogni posto si trascina, l'orizzontale non
    // conterebbe comunque nulla in stampa
    setConfigSegna((c) => ({ ...c, [`${d.chiave}_pos_y`]: y }));
  }
  function fineDragSegna() {
    const d = dragSegnaRef.current;
    if (!d) return;
    dragSegnaRef.current = null;
    setSlotTrascinato(null);
    aggiornaSegnaposti({ [`${d.chiave}_pos_y`]: configSegna[`${d.chiave}_pos_y`] });
  }

  // due linee verticali trascinabili (solo orizzontalmente), sinistra e
  // destra: la distanza tra le due segna la larghezza massima del nome;
  // in stampa, un nome più largo di questo limite viene rimpicciolito
  // solo per quella riga, non per tutte
  function iniziaDragLimite(e, lato) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragLimiteRef.current = { lato, pointerId: e.pointerId };
    setLimiteTrascinato(lato);
  }
  function muoviDragLimite(e) {
    const d = dragLimiteRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreSegnaRef.current) return;
    const rect = contenitoreSegnaRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    setConfigSegna((c) => ({ ...c, [`limite_${d.lato}_pos_x`]: x }));
  }
  function fineDragLimite() {
    const d = dragLimiteRef.current;
    if (!d) return;
    dragLimiteRef.current = null;
    setLimiteTrascinato(null);
    aggiornaSegnaposti({ [`limite_${d.lato}_pos_x`]: configSegna[`limite_${d.lato}_pos_x`] });
  }

  function iniziaDrag(e, chiave) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { chiave, pointerId: e.pointerId };
    setElementoTrascinato(chiave);
  }
  function muoviDrag(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreRef.current) return;
    const rect = contenitoreRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setConfig((c) => ({ ...c, [`${d.chiave}_pos_x`]: x, [`${d.chiave}_pos_y`]: y }));
  }
  function fineDrag() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setElementoTrascinato(null);
    // durante il trascinamento la posizione è già stata aggiornata (in
    // tempo reale) nello stato locale da muoviDrag: qui la si salva solo,
    // rileggendola dallo stato attuale invece di ricalcolarla
    aggiorna({ [`${d.chiave}_pos_x`]: config[`${d.chiave}_pos_x`], [`${d.chiave}_pos_y`]: config[`${d.chiave}_pos_y`] });
  }

  // due linee verticali trascinabili che limitano solo la larghezza del
  // nome allievo: città/data e firma non ne sono toccate
  function iniziaDragLimiteNome(e, lato) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragLimiteNomeRef.current = { lato, pointerId: e.pointerId };
    setLimiteNomeTrascinato(lato);
  }
  function muoviDragLimiteNome(e) {
    const d = dragLimiteNomeRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreRef.current) return;
    const rect = contenitoreRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    setConfig((c) => ({ ...c, [`nome_limite_${d.lato}`]: x }));
  }
  function fineDragLimiteNome() {
    const d = dragLimiteNomeRef.current;
    if (!d) return;
    dragLimiteNomeRef.current = null;
    setLimiteNomeTrascinato(null);
    aggiorna({ [`nome_limite_${d.lato}`]: config[`nome_limite_${d.lato}`] });
  }

  const traduzioneAllineamento = { left: "flex-start", center: "center", right: "flex-end" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Setting diplomi" onBack={onBack} />
      <div style={subStyle}>
        Impostazioni globali per la stampa dei diplomi: i 3 font e la posizione di nome, città/data e firma sono
        uguali per tutti i corsi. Carica qui un diploma di riferimento per vedere dove finiranno i testi e
        trascinarli nel punto giusto.
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Eccezioni diplomi</div>
        <div style={subStyle}>
          Diplomi alternativi, caricati qui una volta per tutte: da "Contabilità classe" si può assegnare
          un'eccezione a un singolo iscritto, che verrà stampata al posto del template normale del corso.
        </div>
        <Field label="Nome eccezione">
          <input style={inputStyle} value={nomeEccezione} onChange={(e) => setNomeEccezione(e.target.value)} placeholder="es. Diploma rifatto per errore stampa" />
        </Field>
        <Field label="File diploma (PDF)">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept="application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setFileEccezione(e.target.files?.[0] || null)} />
            {fileEccezione ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun file caricato</span>}
          </div>
        </Field>
        <Button onClick={aggiungiEccezione} disabled={salvandoEccezione}>{salvandoEccezione ? "Salvataggio…" : "Salva eccezione"}</Button>

        {(diplomaEccezioni || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            {diplomaEccezioni.map((d) => (
              <div key={d.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${CREAM_BORDER}`, gap: 10 }}>
                  <div style={{ ...fontBody, fontSize: 14, color: NAVY }}>{d.nome}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <BadgeFileCaricato />
                    <button
                      onClick={() => apriModificaEccezione(d)}
                      title="Modifica"
                      style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 4, display: "flex", alignItems: "center" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => eliminaEccezione(d.id)}
                      title="Elimina"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex", alignItems: "center" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {eccezioneInModifica === d.id && (
                  <div style={{ padding: "10px 0 14px" }}>
                    <Field label="Nome eccezione">
                      <input style={inputStyle} value={nomeModificaEccezione} onChange={(e) => setNomeModificaEccezione(e.target.value)} />
                    </Field>
                    <Field label="File diploma (PDF) — scegline uno nuovo solo se vuoi sostituire la grafica">
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="file" accept="application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setFileModificaEccezione(e.target.files?.[0] || null)} />
                        {fileModificaEccezione ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun file nuovo scelto — resta quello attuale</span>}
                      </div>
                    </Field>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button onClick={() => salvaModificaEccezione(d.id)}>Salva</Button>
                      <Button variant="ghost" onClick={() => setEccezioneInModifica(null)}>Annulla</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Font</div>
        <div style={subStyle}>Usati per scrivere i 3 testi su ogni diploma stampato, e il nome sui segnaposti.</div>
        {[
          { campo: "font_allievo_path", etichetta: "Font Allievo" },
          { campo: "font_data_path", etichetta: "Font città e data" },
          { campo: "font_firma_path", etichetta: "Font firma" },
        ].map(({ campo, etichetta }) => (
          <Field key={campo} label={etichetta}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".ttf,.otf,font/ttf,font/otf"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                onChange={(e) => gestisciUploadFont(e.target.files?.[0] || null, campo)}
              />
              {config[campo] ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun font caricato</span>}
            </div>
          </Field>
        ))}
        <Field label="Font segnaposto">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf"
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              onChange={(e) => gestisciUploadFontSegnaposti(e.target.files?.[0] || null)}
            />
            {configSegna.font_path ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun font caricato</span>}
          </div>
        </Field>
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Diploma di riferimento</div>
        <div style={subStyle}>
          Un PDF diploma qualsiasi, usato solo per calibrare la posizione: la stessa posizione verrà applicata al
          template di ciascun corso. La riga tratteggiata rossa (2 linee) segna la larghezza massima del nome
          allievo — non tocca città/data né firma: se in stampa un nome la supera, il font si rimpicciolisce solo
          per quel nome.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="application/pdf"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            onChange={(e) => gestisciUploadRiferimento(e.target.files?.[0] || null)}
          />
          {(fileRiferimentoNuovo || config.diploma_riferimento_path) ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun diploma di riferimento caricato</span>}
        </div>

        {(fileRiferimentoNuovo || config.diploma_riferimento_path) && (
          <div
            ref={contenitoreRef}
            style={{ position: "relative", marginTop: 16, width: "100%", maxWidth: dimensioniCanvas?.width || 800, touchAction: "none" }}
          >
            {/* il canvas deve esistere nel DOM fin da subito: l'effetto che
                lo disegna legge canvasRef.current, e se questo contenitore
                comparisse solo DOPO aver calcolato le dimensioni si
                creerebbe un cane che si morde la coda (nessuna dimensione
                finché non si disegna, nessun disegno finché non c'è il
                canvas) */}
            <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: `1px solid ${CREAM_BORDER}` }} />
            {["sx", "dx"].map((lato) => (
              <div
                key={lato}
                onPointerDown={(e) => iniziaDragLimiteNome(e, lato)}
                onPointerMove={muoviDragLimiteNome}
                onPointerUp={fineDragLimiteNome}
                onPointerCancel={fineDragLimiteNome}
                title="Trascina per impostare la larghezza massima del nome allievo"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${config[`nome_limite_${lato}`]}%`,
                  width: 20,
                  transform: "translateX(-50%)",
                  cursor: "ew-resize",
                  display: "flex",
                  justifyContent: "center",
                  touchAction: "none",
                }}
              >
                <div style={{ width: 0, height: "100%", borderLeft: `2px dashed #C0392B`, background: limiteNomeTrascinato === lato ? "rgba(192,57,43,0.08)" : "transparent" }} />
              </div>
            ))}
            {ELEMENTI_DIPLOMA.map(({ chiave, colore, testoProva, campoFont, famigliaFont }) => (
              <div
                key={chiave}
                onPointerDown={(e) => iniziaDrag(e, chiave)}
                onPointerMove={muoviDrag}
                onPointerUp={fineDrag}
                onPointerCancel={fineDrag}
                style={{
                  position: "absolute",
                  left: `${config[`${chiave}_pos_x`]}%`,
                  top: `${config[`${chiave}_pos_y`]}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  justifyContent: traduzioneAllineamento[config[`${chiave}_allineamento`]] || "center",
                  minWidth: 40,
                  cursor: "grab",
                  padding: 4,
                  border: `2px dashed ${colore}`,
                  borderRadius: 4,
                  background: elementoTrascinato === chiave ? `${colore}22` : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: config[`${chiave}_font_size`] * scalaAnteprimaTesto,
                    color: config[`${chiave}_colore`],
                    fontFamily: config[campoFont] ? famigliaFont : undefined,
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {testoProva}
                </span>
              </div>
            ))}
          </div>
        )}

        {(fileRiferimentoNuovo || config.diploma_riferimento_path) && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            {ELEMENTI_DIPLOMA.map(({ chiave, colore, etichetta }) => (
              <div key={chiave} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: colore, flexShrink: 0 }} />
                <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 110 }}>{etichetta}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => aggiorna({ [`${chiave}_font_size`]: Math.max(6, config[`${chiave}_font_size`] - 1) })}
                    style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                  >
                    −
                  </button>
                  <span style={{ ...fontBody, fontSize: 13, color: NAVY, minWidth: 26, textAlign: "center" }}>{config[`${chiave}_font_size`]}</span>
                  <button
                    onClick={() => aggiorna({ [`${chiave}_font_size`]: Math.min(120, config[`${chiave}_font_size`] + 1) })}
                    style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
                <input
                  type="color"
                  value={config[`${chiave}_colore`]}
                  onChange={(e) => aggiorna({ [`${chiave}_colore`]: e.target.value })}
                  style={{ width: 36, height: 30, border: `1px solid ${CREAM_BORDER}`, borderRadius: 6 }}
                />
                <select
                  value={config[`${chiave}_allineamento`]}
                  onChange={(e) => aggiorna({ [`${chiave}_allineamento`]: e.target.value })}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value="left">Sinistra</option>
                  <option value="center">Centro</option>
                  <option value="right">Destra</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Regolazione segnaposto</div>
        <div style={subStyle}>
          A differenza del diploma, qui il file caricato è il vero foglio A4 che verrà stampato (non solo un
          riferimento): trascina ciascuno dei {POSTI_PER_PAGINA_SEGNAPOSTI} nomi di prova nel punto esatto della
          griglia. Se una classe ha più di {POSTI_PER_PAGINA_SEGNAPOSTI} iscritti, la stampa genera altre pagine
          ripartendo dal primo posto. Le due linee tratteggiate rosse (sinistra e destra) segnano la larghezza
          massima del testo, uguale per tutti i posti: se un nome in stampa la supera, si rimpicciolisce
          automaticamente solo per quel nome, senza toccare gli altri.
        </div>
        <Field label="Segnaposti di riferimento (PDF A4)">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="application/pdf"
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              onChange={(e) => gestisciUploadRiferimentoSegnaposti(e.target.files?.[0] || null)}
            />
            {(fileRiferimentoSegnaNuovo || configSegna.riferimento_path) ? <BadgeFileCaricato /> : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun foglio caricato</span>}
          </div>
        </Field>

        {(fileRiferimentoSegnaNuovo || configSegna.riferimento_path) && (
          <div
            ref={contenitoreSegnaRef}
            style={{ position: "relative", marginTop: 16, width: "100%", maxWidth: dimensioniCanvasSegna?.width || 800, touchAction: "none" }}
          >
            <canvas ref={canvasSegnaRef} style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: `1px solid ${CREAM_BORDER}` }} />
            {["sx", "dx"].map((lato) => (
              <div
                key={lato}
                onPointerDown={(e) => iniziaDragLimite(e, lato)}
                onPointerMove={muoviDragLimite}
                onPointerUp={fineDragLimite}
                onPointerCancel={fineDragLimite}
                title="Trascina per impostare la larghezza massima del testo"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${configSegna[`limite_${lato}_pos_x`]}%`,
                  width: 20,
                  transform: "translateX(-50%)",
                  cursor: "ew-resize",
                  display: "flex",
                  justifyContent: "center",
                  touchAction: "none",
                }}
              >
                <div style={{ width: 0, height: "100%", borderLeft: `2px dashed #C0392B`, background: limiteTrascinato === lato ? "rgba(192,57,43,0.08)" : "transparent" }} />
              </div>
            ))}
            {SLOT_SEGNAPOSTI.map(({ chiave, numero }) => (
              <div
                key={chiave}
                onPointerDown={(e) => iniziaDragSegna(e, chiave)}
                onPointerMove={muoviDragSegna}
                onPointerUp={fineDragSegna}
                onPointerCancel={fineDragSegna}
                style={{
                  position: "absolute",
                  // il nome si stampa centrato tra le due linee di limite,
                  // non nella posizione X trascinata (che quindi conta solo
                  // in verticale): l'anteprima deve riflettere lo stesso
                  left: `${(configSegna.limite_sx_pos_x + configSegna.limite_dx_pos_x) / 2}%`,
                  top: `${configSegna[`${chiave}_pos_y`]}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  justifyContent: "center",
                  minWidth: 40,
                  cursor: "grab",
                  padding: 4,
                  border: `2px dashed #2563EB`,
                  borderRadius: 4,
                  background: slotTrascinato === chiave ? "#2563EB22" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: configSegna.font_size * scalaAnteprimaTestoSegna,
                    color: configSegna.colore,
                    fontFamily: configSegna.font_path ? "fontSegnaposto" : undefined,
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  Nome {numero}
                </span>
              </div>
            ))}
          </div>
        )}

        {(fileRiferimentoSegnaNuovo || configSegna.riferimento_path) && (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }}>
            <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>Dimensione font (uguale per tutti i posti)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => aggiornaSegnaposti({ font_size: Math.max(6, configSegna.font_size - 1) })}
                style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              >
                −
              </button>
              <span style={{ ...fontBody, fontSize: 13, color: NAVY, minWidth: 26, textAlign: "center" }}>{configSegna.font_size}</span>
              <button
                onClick={() => aggiornaSegnaposti({ font_size: Math.min(120, configSegna.font_size + 1) })}
                style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              >
                +
              </button>
            </div>
            <input
              type="color"
              value={configSegna.colore}
              onChange={(e) => aggiornaSegnaposti({ colore: e.target.value })}
              style={{ width: 36, height: 30, border: `1px solid ${CREAM_BORDER}`, borderRadius: 6 }}
            />
          </div>
        )}
      </div>

      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY }}>{msg}</div>}
    </div>
  );
}

// una card per ciascuna delle 10 categorie di loghi: upload nero/bianco,
// e (appena c'è un nero) un'anteprima con 2 testi di prova trascinabili
// (nome allieva, codice progressivo) sopra l'immagine vera del logo —
// stessa logica di trascinamento a percentuale di ELEMENTI_DIPLOMA in
// FontDiplomi, ma qui il riferimento è una semplice <img>, non un canvas
// pdf.js: niente conversione punti-PDF, basta naturalWidth dell'immagine
function CategoriaLogo({ categoria, ricarica }) {
  const [config, setConfig] = useState(categoria);
  const [previewNeroUrl, setPreviewNeroUrl] = useState(null);
  const [previewBiancoUrl, setPreviewBiancoUrl] = useState(null);
  const [msg, setMsg] = useState("");
  const [larghezzaMostrata, setLarghezzaMostrata] = useState(null);
  const [naturaleWidth, setNaturaleWidth] = useState(null);
  const [elementoTrascinato, setElementoTrascinato] = useState(null);
  const contenitoreRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const modificatoLocalmenteRef = React.useRef(false);

  useEffect(() => {
    if (!modificatoLocalmenteRef.current) setConfig(categoria);
  }, [categoria]);

  async function aggiorna(campi) {
    modificatoLocalmenteRef.current = true;
    setConfig((c) => ({ ...c, ...campi }));
    const { error } = await supabase.from("loghi_categorie").update(campi).eq("chiave", categoria.chiave);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function caricaLogo(file, campo) {
    if (!file) return;
    if (campo === "logo_nero_path") setPreviewNeroUrl(URL.createObjectURL(file));
    else setPreviewBiancoUrl(URL.createObjectURL(file));
    try {
      const percorso = `${categoria.chiave}/${campo === "logo_nero_path" ? "nero" : "bianco"}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("loghi-immagini").upload(percorso, file);
      if (error) throw error;
      await aggiorna({ [campo]: percorso });
    } catch (e) {
      setMsg("Errore nel caricamento del logo: " + e.message);
    }
  }

  const srcNero = previewNeroUrl || (config.logo_nero_path ? supabase.storage.from("loghi-immagini").getPublicUrl(config.logo_nero_path).data.publicUrl : null);
  const srcBianco = previewBiancoUrl || (config.logo_bianco_path ? supabase.storage.from("loghi-immagini").getPublicUrl(config.logo_bianco_path).data.publicUrl : null);

  useEffect(() => {
    if (!srcNero) { setLarghezzaMostrata(null); return; }
    const el = contenitoreRef.current;
    if (!el) return;
    const osservatore = new ResizeObserver((voci) => {
      for (const voce of voci) setLarghezzaMostrata(voce.contentRect.width);
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [srcNero]);

  const scalaAnteprima = naturaleWidth && larghezzaMostrata ? larghezzaMostrata / naturaleWidth : 1;

  function iniziaDrag(e, chiave) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { chiave, pointerId: e.pointerId };
    setElementoTrascinato(chiave);
  }
  function muoviDrag(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreRef.current) return;
    const rect = contenitoreRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setConfig((c) => ({ ...c, [`${d.chiave}_pos_x`]: x, [`${d.chiave}_pos_y`]: y }));
  }
  function fineDrag() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setElementoTrascinato(null);
    aggiorna({ [`${d.chiave}_pos_x`]: config[`${d.chiave}_pos_x`], [`${d.chiave}_pos_y`]: config[`${d.chiave}_pos_y`] });
  }

  const ELEMENTI_LOGO = [
    { chiave: "nome", colore: "#2563EB", etichetta: "Nome allieva", testoProva: "Nome Cognome" },
    { chiave: "numero", colore: "#EA580C", etichetta: "Codice progressivo", testoProva: calcolaCodiceLogo("Andrea Paura", "Carla Bosi", 402) },
  ];

  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={hStyle}>{config.etichetta}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 200px" }}>
          <Field label="Logo nero (diventa il riferimento qui sotto)">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*" style={{ ...inputStyle, flex: 1, minWidth: 160 }} onChange={(e) => caricaLogo(e.target.files?.[0] || null, "logo_nero_path")} />
              {srcNero && <BadgeFileCaricato />}
            </div>
          </Field>
        </div>
        {config.richiede_bianco && (
          <div style={{ flex: "1 1 200px" }}>
            <Field label="Logo bianco">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="file" accept="image/*" style={{ ...inputStyle, flex: 1, minWidth: 160 }} onChange={(e) => caricaLogo(e.target.files?.[0] || null, "logo_bianco_path")} />
                {srcBianco && <BadgeFileCaricato />}
              </div>
            </Field>
          </div>
        )}
      </div>

      {srcNero && (
        <>
          <div ref={contenitoreRef} style={{ position: "relative", width: "100%", maxWidth: naturaleWidth || 500, touchAction: "none" }}>
            <img
              src={srcNero}
              alt={config.etichetta}
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: `1px solid ${CREAM_BORDER}`, background: "#EFEFEF" }}
              onLoad={(e) => setNaturaleWidth(e.target.naturalWidth)}
            />
            {ELEMENTI_LOGO.map(({ chiave, colore, testoProva }) => (
              <div
                key={chiave}
                onPointerDown={(e) => iniziaDrag(e, chiave)}
                onPointerMove={muoviDrag}
                onPointerUp={fineDrag}
                onPointerCancel={fineDrag}
                style={{
                  position: "absolute",
                  left: `${config[`${chiave}_pos_x`]}%`,
                  top: `${config[`${chiave}_pos_y`]}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "grab",
                  padding: 4,
                  border: `2px dashed ${colore}`,
                  borderRadius: 4,
                  background: elementoTrascinato === chiave ? `${colore}22` : "transparent",
                  touchAction: "none",
                }}
              >
                <span
                  style={{
                    fontSize: config[`${chiave}_font_size`] * scalaAnteprima,
                    color: config[`${chiave}_colore`],
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {testoProva}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {ELEMENTI_LOGO.map(({ chiave, colore, etichetta }) => (
              <div key={chiave} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: colore, flexShrink: 0 }} />
                <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 140 }}>{etichetta}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => aggiorna({ [`${chiave}_font_size`]: Math.max(6, config[`${chiave}_font_size`] - 2) })}
                    style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                  >
                    −
                  </button>
                  <span style={{ ...fontBody, fontSize: 13, color: NAVY, minWidth: 30, textAlign: "center" }}>{config[`${chiave}_font_size`]}</span>
                  <button
                    onClick={() => aggiorna({ [`${chiave}_font_size`]: Math.min(400, config[`${chiave}_font_size`] + 2) })}
                    style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
                <input
                  type="color"
                  value={config[`${chiave}_colore`]}
                  onChange={(e) => aggiorna({ [`${chiave}_colore`]: e.target.value })}
                  style={{ width: 36, height: 30, border: `1px solid ${CREAM_BORDER}`, borderRadius: 6 }}
                />
              </div>
            ))}
          </div>
        </>
      )}
      {msg && <div style={{ ...fontBody, fontSize: 12, color: NAVY, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// pagina "Setting loghi": i 2 font condivisi + il numero di partenza del
// contatore progressivo globale, poi una card per ciascuna delle 10
// categorie (CategoriaLogo)
function SettingLoghi({ loghiImpostazioni, loghiCategorie, ricarica, onBack }) {
  const [config, setConfig] = useState(loghiImpostazioni || CONFIG_LOGHI_DEFAULT);
  const [numeroPartenza, setNumeroPartenza] = useState(String((loghiImpostazioni || CONFIG_LOGHI_DEFAULT).prossimo_numero));
  const [msg, setMsg] = useState("");
  const modificatoLocalmenteRef = React.useRef(false);

  useEffect(() => {
    if (!modificatoLocalmenteRef.current) {
      const nuovo = loghiImpostazioni || CONFIG_LOGHI_DEFAULT;
      setConfig(nuovo);
      setNumeroPartenza(String(nuovo.prossimo_numero));
    }
  }, [loghiImpostazioni]);

  async function aggiorna(campi) {
    modificatoLocalmenteRef.current = true;
    const nuovo = { ...config, ...campi };
    setConfig(nuovo);
    const payload = { ...nuovo };
    delete payload.id;
    delete payload.ts;
    if (nuovo.id) {
      const { error } = await supabase.from("loghi_impostazioni").update(payload).eq("id", nuovo.id);
      if (error) { setMsg("Errore: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("loghi_impostazioni").insert(payload).select("id").single();
      if (error) { setMsg("Errore: " + error.message); return; }
      setConfig((c) => ({ ...c, id: data.id }));
    }
    ricarica();
  }

  async function caricaFont(file, campo) {
    if (!file) return;
    try {
      const percorso = `${campo}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("loghi-fonts").upload(percorso, file);
      if (error) throw error;
      await aggiorna({ [campo]: percorso });
      setMsg("Font caricato.");
    } catch (e) {
      setMsg("Errore nel caricamento del font: " + e.message);
    }
  }

  function salvaNumeroPartenza() {
    const n = parseInt(numeroPartenza, 10);
    if (isNaN(n) || n < 0) { setMsg("Numero non valido."); return; }
    aggiorna({ prossimo_numero: n });
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Setting loghi" onBack={onBack} />
      <div style={subStyle}>
        Carica qui i 2 font usati per scrivere nome allieva e codice progressivo sui loghi, il numero da cui riparte
        il contatore (unico per tutti i loghi), e per ciascuna categoria il logo nero/bianco con la posizione dei 2
        testi calibrata trascinandoli sopra l'immagine vera.
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Font e contatore</div>
        <Field label="Font nome allieva">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".ttf,.otf,font/ttf,font/otf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => caricaFont(e.target.files?.[0] || null, "font_nome_path")} />
            {config.font_nome_path && <BadgeFileCaricato />}
          </div>
        </Field>
        <Field label="Font codice progressivo">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".ttf,.otf,font/ttf,font/otf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => caricaFont(e.target.files?.[0] || null, "font_numero_path")} />
            {config.font_numero_path && <BadgeFileCaricato />}
          </div>
        </Field>
        <Field label="Numero di partenza (contatore progressivo)">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input inputMode="numeric" value={numeroPartenza} onChange={(e) => setNumeroPartenza(e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, width: 120 }} />
            <Button variant="ghost" onClick={salvaNumeroPartenza}>Salva</Button>
          </div>
        </Field>
        {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY }}>{msg}</div>}
      </div>

      {loghiCategorie.map((cat) => (
        <CategoriaLogo key={cat.chiave} categoria={cat} ricarica={ricarica} />
      ))}
    </div>
  );
}

// componi su un <canvas> offscreen il logo sorgente + nome + codice, alla
// risoluzione piena dell'immagine originale (non quella ridotta
// dell'anteprima), e restituisce il PNG risultante come Blob
async function componiLogoPng({ percorsoLogo, nomeTesto, codiceTesto, categoria, famigliaNome, famigliaNumero }) {
  const bytes = await scaricaBytesStorage("loghi-immagini", percorsoLogo);
  const blobSorgente = new Blob([bytes]);
  const url = URL.createObjectURL(blobSorgente);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("immagine logo non valida"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    await document.fonts.ready;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${categoria.nome_font_size}px ${famigliaNome}, sans-serif`;
    ctx.fillStyle = categoria.nome_colore;
    ctx.fillText(nomeTesto, (canvas.width * categoria.nome_pos_x) / 100, (canvas.height * categoria.nome_pos_y) / 100);
    ctx.font = `${categoria.numero_font_size}px ${famigliaNumero}, sans-serif`;
    ctx.fillStyle = categoria.numero_colore;
    ctx.fillText(codiceTesto, (canvas.width * categoria.numero_pos_x) / 100, (canvas.height * categoria.numero_pos_y) / 100);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaricaBlob(blob, nomeFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// pagina aperta dalla home (nessun codice amministratore richiesto, la usa
// chiunque abbia appena concluso un corso con un'allieva): sceglie
// master + corso + eventuale variante Artist/Expert + nome allieva, e
// genera i PNG nero (sempre) e bianco (se la categoria lo richiede) con
// nome e codice progressivo scritti sopra, usando la calibrazione fatta
// in "Setting loghi"
function GenerazioneLoghi({ master, loghiCategorie, loghiImpostazioni, ricarica, onBack }) {
  const [masterId, setMasterId] = useState("");
  const [corso, setCorso] = useState("");
  const [variante, setVariante] = useState("artist");
  const [nomeAllieva, setNomeAllieva] = useState("");
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg] = useState("");
  const [codiceGenerato, setCodiceGenerato] = useState(null);

  const OPZIONI_CORSO = [...CORSI_LOGO, { chiave: "master_assistant", etichetta: "Master Assistant" }, { chiave: "master", etichetta: "Master" }];
  const richiedeVariante = corso && corso !== "master_assistant" && corso !== "master";
  const chiaveCategoria = corso ? (richiedeVariante ? `${corso}_${variante}` : corso) : null;
  const categoria = chiaveCategoria ? loghiCategorie.find((c) => c.chiave === chiaveCategoria) : null;
  const masterScelta = master.find((m) => m.id === masterId);

  const prossimoNumero = loghiImpostazioni?.prossimo_numero ?? 1;
  const anteprimaCodice = masterScelta && nomeAllieva.trim() ? calcolaCodiceLogo(masterScelta.nome, nomeAllieva, prossimoNumero) : null;

  useEffect(() => {
    async function caricaFontGenerazione() {
      if (loghiImpostazioni?.font_nome_path) {
        try {
          const { data } = supabase.storage.from("loghi-fonts").getPublicUrl(loghiImpostazioni.font_nome_path);
          const f = new FontFace("loghiFontNomeGen", `url(${data.publicUrl})`);
          await f.load();
          document.fonts.add(f);
        } catch { /* fallback al font di sistema */ }
      }
      if (loghiImpostazioni?.font_numero_path) {
        try {
          const { data } = supabase.storage.from("loghi-fonts").getPublicUrl(loghiImpostazioni.font_numero_path);
          const f = new FontFace("loghiFontNumeroGen", `url(${data.publicUrl})`);
          await f.load();
          document.fonts.add(f);
        } catch { /* fallback al font di sistema */ }
      }
    }
    caricaFontGenerazione();
  }, [loghiImpostazioni?.font_nome_path, loghiImpostazioni?.font_numero_path]);

  async function genera() {
    if (!masterScelta) { setMsg("Scegli la master."); return; }
    if (!categoria) { setMsg("Scegli il tipo di corso/logo."); return; }
    if (!nomeAllieva.trim()) { setMsg("Inserisci il nome dell'allieva."); return; }
    if (!categoria.logo_nero_path) { setMsg("Manca ancora il logo nero di questa categoria in Setting loghi."); return; }
    if (categoria.richiede_bianco && !categoria.logo_bianco_path) { setMsg("Manca ancora il logo bianco di questa categoria in Setting loghi."); return; }

    setGenerando(true);
    setMsg("");
    try {
      const codice = calcolaCodiceLogo(masterScelta.nome, nomeAllieva, prossimoNumero);
      const blobNero = await componiLogoPng({
        percorsoLogo: categoria.logo_nero_path,
        nomeTesto: nomeAllieva.trim().toUpperCase(),
        codiceTesto: codice,
        categoria,
        famigliaNome: "loghiFontNomeGen",
        famigliaNumero: "loghiFontNumeroGen",
      });
      scaricaBlob(blobNero, `${categoria.chiave}-nero-${codice}.png`);

      if (categoria.richiede_bianco) {
        const blobBianco = await componiLogoPng({
          percorsoLogo: categoria.logo_bianco_path,
          nomeTesto: nomeAllieva.trim().toUpperCase(),
          codiceTesto: codice,
          categoria,
          famigliaNome: "loghiFontNomeGen",
          famigliaNumero: "loghiFontNumeroGen",
        });
        scaricaBlob(blobBianco, `${categoria.chiave}-bianco-${codice}.png`);
      }

      const { error } = await supabase.from("loghi_impostazioni").update({ prossimo_numero: prossimoNumero + 1 }).eq("id", loghiImpostazioni.id);
      if (error) { setMsg("Loghi generati, ma non sono riuscito ad aggiornare il contatore: " + error.message); setGenerando(false); return; }
      setCodiceGenerato(codice);
      setMsg(`Loghi generati con codice ${codice}.`);
      ricarica();
    } catch (e) {
      setMsg("Errore nella generazione: " + e.message);
    }
    setGenerando(false);
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Generazione loghi" onBack={onBack} />
      <div style={cardStyle}>
        <Field label="Master">
          <select style={inputStyle} value={masterId} onChange={(e) => setMasterId(e.target.value)}>
            <option value="">— scegli —</option>
            {master.map((m) => <option key={m.id} value={m.id}>{m.nome.toUpperCase()}</option>)}
          </select>
        </Field>
        <Field label="Tipo di corso">
          <select style={inputStyle} value={corso} onChange={(e) => setCorso(e.target.value)}>
            <option value="">— scegli —</option>
            {OPZIONI_CORSO.map((c) => <option key={c.chiave} value={c.chiave}>{c.etichetta}</option>)}
          </select>
        </Field>
        {richiedeVariante && (
          <Field label="Tipo di logo">
            <div style={{ display: "flex", gap: 14, ...fontBody, fontSize: 13, color: NAVY }}>
              {VARIANTI_LOGO.map((v) => (
                <label key={v.chiave} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="varianteLogo" checked={variante === v.chiave} onChange={() => setVariante(v.chiave)} />
                  {v.etichetta}
                </label>
              ))}
            </div>
          </Field>
        )}
        <Field label="Nome allieva">
          <input style={{ ...inputStyle, textTransform: "uppercase" }} value={nomeAllieva} onChange={(e) => setNomeAllieva(e.target.value)} placeholder="Nome Cognome" />
        </Field>

        {anteprimaCodice && (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 }}>
            Codice che verrà usato: <b style={{ color: NAVY }}>{anteprimaCodice}</b>
          </div>
        )}

        <Button onClick={genera} disabled={generando} style={{ width: "100%" }}>
          {generando ? "Genero…" : "Genera loghi"}
        </Button>
        {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
        {codiceGenerato && (
          <div style={{ ...fontBody, fontSize: 13, color: "#2E7D32", marginTop: 6 }}>
            I 2 file PNG sono stati scaricati.
          </div>
        )}
      </div>
    </div>
  );
}

// una riga di "Assegna modelle": trattamento, eventuali MAT/POM (nascosti
// nella pagina pubblica di ricerca modelle), e nome/telefono della modella
// una volta trovata. Nome/telefono usano stato locale e si salvano solo al
// blur, non ad ogni tasto: altrimenti ogni carattere digitato scatenerebbe
// un salvataggio e un ricaricamento dell'intera pagina, facendo perdere il
// focus mentre si scrive
function RigaModella({ modella, mostraOrario = true, primaRiga, onSalva }) {
  const [nome, setNome] = useState(modella.nome_modella || "");
  const [telefono, setTelefono] = useState(modella.telefono_modella || "");
  useEffect(() => { setNome(modella.nome_modella || ""); }, [modella.nome_modella]);
  useEffect(() => { setTelefono(modella.telefono_modella || ""); }, [modella.telefono_modella]);

  return (
    <div style={{ padding: "10px 0", borderTop: primaRiga ? "none" : `1px solid ${CREAM_BORDER}` }}>
      <div style={{ ...fontBody, fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 8 }}>{modella.tipo || "(trattamento non scelto)"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {mostraOrario && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
              <input type="checkbox" checked={!!modella.mattina} onChange={(e) => onSalva("mattina", e.target.checked)} />
              MAT
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
              <input type="checkbox" checked={!!modella.pomeriggio} onChange={(e) => onSalva("pomeriggio", e.target.checked)} />
              POM
            </label>
          </>
        )}
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => { if (nome !== (modella.nome_modella || "")) onSalva("nome_modella", nome); }}
          style={{ ...inputStyle, flex: "1 1 130px", padding: "6px 10px" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 170px" }}>
          <input
            placeholder="Tel."
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => { if (telefono !== (modella.telefono_modella || "")) onSalva("telefono_modella", telefono); }}
            style={{ ...inputStyle, flex: 1, padding: "6px 10px" }}
          />
          {telefono.trim() && (
            <>
              <a href={`tel:${telefono.replace(/\s+/g, "")}`} title="Chiama" style={{ display: "flex", alignItems: "center", color: NAVY, flexShrink: 0 }}>
                <IconaTelefono />
              </a>
              <a href={`https://wa.me/${numeroWhatsapp(telefono)}`} target="_blank" rel="noopener noreferrer" title="Apri chat WhatsApp" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <IconaWhatsapp />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  const overlayRef = React.useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    // su iOS la tastiera che si apre riduce il "visual viewport" ma questo
    // overlay (position:fixed) resta alto quanto l'intera pagina: la parte
    // in basso finisce nascosta dietro la tastiera. Restringendo l'altezza
    // dell'overlay a window.visualViewport.height, lo spazio davvero
    // visibile combacia con quello occupato, e lo scroll interno può
    // portare in vista il campo anche quando la tastiera è aperta
    function aggiornaAltezza() {
      if (window.visualViewport) overlay.style.height = `${window.visualViewport.height}px`;
    }
    aggiornaAltezza();
    window.visualViewport?.addEventListener("resize", aggiornaAltezza);

    // la tastiera impiega qualche istante ad aprirsi: si attende che
    // l'animazione finisca prima di centrare il campo appena messo a
    // fuoco, altrimenti scrollIntoView calcolerebbe la posizione sullo
    // spazio ancora pieno (tastiera non ancora comparsa)
    function scrollaCampoInVista(e) {
      const el = e.target;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
      }
    }
    overlay.addEventListener("focusin", scrollaCampoInVista);

    return () => {
      window.visualViewport?.removeEventListener("resize", aggiornaAltezza);
      overlay.removeEventListener("focusin", scrollaCampoInVista);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ ...cardStyle, maxWidth: 560, width: "100%", height: "fit-content", marginBottom: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...hStyle, margin: 0 }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: MUTED, padding: 4 }}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// gestione CRUD di una semplice tabella "nome" (master, hotel, assistente, leva):
// aggiungi, elenco esistenti con modifica/elimina. Va dentro un <Modal>.
function GestioneListaSemplice({ nomeSingolare, nomeArticolo, tabella, elementi, ricarica, msg, setMsg, placeholder, mostraFirmaCheckbox }) {
  const [nome, setNome] = useState("");
  const [inModifica, setInModifica] = useState(null);
  const [modNome, setModNome] = useState("");

  async function toggleFirmato(el) {
    const { error } = await supabase.from(tabella).update({ diploma_gia_firmato: !el.diploma_gia_firmato }).eq("id", el.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function aggiungi() {
    if (!nome.trim()) return;
    const { error } = await supabase.from(tabella).insert({ nome: nome.trim().toUpperCase() });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNome(""); setMsg(`${nomeSingolare} aggiunt${nomeArticolo === "un" ? "o" : "a"}.`);
    ricarica();
  }
  async function elimina(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from(tabella).delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg(`${nomeSingolare} eliminat${nomeArticolo === "un" ? "o" : "a"}.`);
    ricarica();
  }
  function apriModifica(el) {
    setInModifica(el.id);
    setModNome(el.nome.toUpperCase());
  }
  async function salvaModifica(id) {
    if (!modNome.trim()) { setMsg("Il nome non può essere vuoto."); return; }
    const { error } = await supabase.from(tabella).update({ nome: modNome.trim().toUpperCase() }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setInModifica(null);
    setMsg(`${nomeSingolare} aggiornat${nomeArticolo === "un" ? "o" : "a"}.`);
    ricarica();
  }

  return (
    <>
      <div style={hStyle}>Aggiungi {nomeSingolare}</div>
      <Field label="Nome">
        <input style={{ ...inputStyle, textTransform: "uppercase" }} value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} placeholder={placeholder} />
      </Field>
      <Button onClick={aggiungi}>Aggiungi {nomeSingolare}</Button>

      <div style={{ ...hStyle, marginTop: 24 }}>{nomeSingolare} esistenti</div>
      <div style={subStyle}>Clicca la matita per modificare, il cestino per eliminare.</div>
      {elementi.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun{nomeArticolo === "un" ? "o" : "a"} {nomeSingolare.toLowerCase()} ancora.</div>}
      {elementi.map((el) => (
        <div key={el.id}>
          <RigaEliminabile
            label={el.nome.toUpperCase()}
            onModifica={() => apriModifica(el)}
            onDelete={() => elimina(el.id)}
          />
          {mostraFirmaCheckbox && (
            <div
              onClick={() => toggleFirmato(el)}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
            >
              <input type="checkbox" checked={!!el.diploma_gia_firmato} readOnly style={{ width: 18, height: 18, pointerEvents: "none" }} />
              <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Diploma già firmato (non applicare la firma automatica)</span>
            </div>
          )}
          {inModifica === el.id && (
            <div style={{ padding: "10px 0 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>
              <Field label="Nome">
                <input style={{ ...inputStyle, textTransform: "uppercase" }} value={modNome} onChange={(e) => setModNome(e.target.value.toUpperCase())} />
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => salvaModifica(el.id)}>Salva</Button>
                <Button variant="ghost" onClick={() => setInModifica(null)}>Annulla</Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
    </>
  );
}

// etichetta dei tasti a pillola (Filtra corso/città/master, Cronologico,
// Reset filtri, Contabilità classe, Iscrivi...): SEMPRE alla stessa
// dimensione dei tasti vicini, mai più piccola o più grande. Se un'etichetta
// di più parole non entra su una riga va semplicemente a capo (il tasto si
// allarga in altezza, non si rimpicciolisce il testo) — niente riduzione
// automatica del font, altrimenti tasti diversi nella stessa fila
// finiscono con dimensioni del testo vistosamente diverse tra loro
function EtichettaAdattiva({ testo, fontSizeBase = 13 }) {
  return (
    <span style={{ display: "block", fontSize: fontSizeBase, whiteSpace: "normal", textAlign: "center", lineHeight: 1.25, overflowWrap: "anywhere" }}>
      {testo}
    </span>
  );
}

// tasto filtro "a pillola": pieno/scuro quando un valore è scelto,
// altrimenti contornato; al click apre sotto di sé un <select> nativo
// con l'elenco delle opzioni. Usato per i filtri corso/città/master
// sia in Home che in Gestione date
function FiltroPill({ etichetta, etichettaAttiva, valore, aperto, onToggle, selectRef, onChange, onBlur, opzioni, opzioneVuota }) {
  return (
    <div style={{ position: "relative", flex: "1 1 0", minWidth: 0 }}>
      <button
        onClick={onToggle}
        style={{
          ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20,
          border: valore ? "none" : `1px solid ${CREAM_BORDER}`,
          background: valore ? NAVY : "#fff", color: valore ? "#fff" : NAVY, cursor: "pointer",
          overflow: "hidden", width: "100%", display: "block",
        }}
      >
        <EtichettaAdattiva testo={valore ? etichettaAttiva : etichetta} />
      </button>
      {aperto && (
        <select
          autoFocus
          ref={selectRef}
          style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
          value={valore}
          onChange={onChange}
          onBlur={onBlur}
        >
          <option value="">{opzioneVuota}</option>
          {opzioni.map((o) => <option key={o.id} value={o.id}>{o.nome.toUpperCase()}</option>)}
        </select>
      )}
    </div>
  );
}

function RigaEliminabile({ label, dettaglio, onModifica, onDelete }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
      <div>
        <div style={{ ...fontBody, fontSize: 14, color: NAVY }}>{label}</div>
        {dettaglio && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{dettaglio}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {onModifica && (
          <button
            onClick={onModifica}
            title="Modifica"
            style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 6, display: "flex", alignItems: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          title="Elimina"
          style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 6, display: "flex", alignItems: "center" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" /><path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Vista raggruppata: CITTÀ → corso → elenco date. Usata sia nella Home (sola lettura)
// che in Impostazioni (con cestino per eliminare).
function DateRaggruppatePerCitta({ corsi, location, corsiDate, iscritti, master, onApriData, onDelete, onEdit, idInModifica, renderModifica, cronologico }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const masterById = useMemo(() => Object.fromEntries((master || []).map((m) => [m.id, m])), [master]);

  const perCitta = {};
  corsiDate.forEach((cd) => {
    const locId = cd.location_id;
    if (!perCitta[locId]) perCitta[locId] = { nome: locById[locId]?.nome || "?", mesi: {} };
    const [anno, mese] = cd.data_inizio.split("-");
    const chiaveMese = `${anno}-${mese}`;
    if (!perCitta[locId].mesi[chiaveMese]) {
      perCitta[locId].mesi[chiaveMese] = { etichetta: `${MESI[parseInt(mese, 10) - 1]} ${anno}`, voci: [] };
    }
    perCitta[locId].mesi[chiaveMese].voci.push(cd);
  });
  const cittaOrdinate = Object.values(perCitta).sort((a, b) => a.nome.localeCompare(b.nome));

  if (corsiDate.length === 0) {
    return <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna data ancora.</div>;
  }

  // riga di un singolo corso: usata sia raggruppata per città (mostraCitta
  // false, la città è già nell'intestazione della card) sia in modalità
  // "Cronologico" (mostraCitta true: qui non c'è una card per città, quindi
  // il nome città va scritto nella riga stessa, accanto al master)
  function rigaCorso(cd, i, mostraCitta) {
    const corso = corsoById[cd.corso_id];
    const sfondoRiga = "transparent";
    const coloreBadge = i % 2 === 0 ? { bg: "#F5EBDA", testo: "#A08A63" } : { bg: "#E3EDF8", testo: "#7C93AD" };
    const rigaCittaMaster = (mostraCitta || cd.master_id) && (
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {mostraCitta && toTitleCase(locById[cd.location_id]?.nome || "?")}
        {mostraCitta && cd.master_id && " · "}
        {cd.master_id && `Master: ${toTitleCase(masterById[cd.master_id]?.nome || "?")}`}
      </div>
    );
    return onEdit ? (
      <div key={cd.id} style={{ marginBottom: 8 }}>
        <div style={{ background: sfondoRiga, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span
            onClick={onApriData ? () => onApriData(cd) : undefined}
            title={onApriData ? "Apri la classe: iscritti e dettagli" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto", cursor: onApriData ? "pointer" : undefined }}
          >
            <span style={{ width: 4, height: 32, borderRadius: 2, background: corso?.colore || NAVY, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toTitleCase(corso?.nome || "?")}</div>
              {rigaCittaMaster}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>{fmtDataCompatta(cd.data_inizio, cd.data_fine)}</span>
            {iscritti && (() => {
              const max = postiMaxEffettivi(cd, corso, locById[cd.location_id]);
              const occupati = iscritti.filter((i2) => i2.corso_data_id === cd.id).length;
              const liberi = Math.max(0, max - occupati);
              return (
                <span
                  onClick={onApriData ? () => onApriData(cd) : undefined}
                  title={onApriData ? "Apri la classe: iscritti e dettagli" : undefined}
                  style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: coloreBadge.testo, background: coloreBadge.bg, borderRadius: 20, padding: "6px 12px", whiteSpace: "nowrap", cursor: onApriData ? "pointer" : undefined }}
                >
                  {liberi} post{liberi === 1 ? "o" : "i"}
                </span>
              );
            })()}
            <button
              onClick={() => onEdit(cd)}
              title="Modifica"
              style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 4, display: "flex", alignItems: "center" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(cd.id)}
              title="Elimina"
              style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex", alignItems: "center" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
            {onApriData && <span style={{ fontSize: 18, color: MUTED }}>&rsaquo;</span>}
          </span>
        </div>
        {idInModifica === cd.id && renderModifica && renderModifica(cd)}
      </div>
    ) : (
      <div
        key={cd.id}
        onClick={() => onApriData?.(cd)}
        style={{ background: sfondoRiga, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: onApriData ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ width: 4, height: 32, borderRadius: 2, background: corso?.colore || NAVY, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toTitleCase(corso?.nome || "?")}</div>
            {rigaCittaMaster}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>{fmtDataCompatta(cd.data_inizio, cd.data_fine)}</span>
          {iscritti && (() => {
            const max = postiMaxEffettivi(cd, corso, locById[cd.location_id]);
            const occupati = iscritti.filter((i2) => i2.corso_data_id === cd.id).length;
            const liberi = Math.max(0, max - occupati);
            return (
              <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: coloreBadge.testo, background: coloreBadge.bg, borderRadius: 20, padding: "6px 12px", whiteSpace: "nowrap" }}>
                {liberi} post{liberi === 1 ? "o" : "i"}
              </span>
            );
          })()}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(cd.id); }}
              title="Elimina"
              style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex", alignItems: "center" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
          {onApriData && <span style={{ fontSize: 18, color: MUTED }}>&rsaquo;</span>}
        </span>
      </div>
    );
  }

  // "Cronologico": tutte le date di tutte le città in un'unica lista,
  // raggruppata solo per mese e ordinata per data (invece che per città)
  if (cronologico) {
    const mesi = {};
    corsiDate.forEach((cd) => {
      const [anno, mese] = cd.data_inizio.split("-");
      const chiaveMese = `${anno}-${mese}`;
      if (!mesi[chiaveMese]) mesi[chiaveMese] = { etichetta: `${MESI[parseInt(mese, 10) - 1]} ${anno}`, voci: [] };
      mesi[chiaveMese].voci.push(cd);
    });
    const chiaviMesi = Object.keys(mesi).sort();
    return (
      <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 20 }}>
        {chiaviMesi.map((chiaveMese, mIdx) => {
          const gruppoMese = mesi[chiaveMese];
          return (
            <div key={chiaveMese} style={{ marginBottom: 14, paddingTop: mIdx > 0 ? 14 : 0, borderTop: mIdx > 0 ? `1px solid ${CREAM_BORDER}` : "none" }}>
              <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                {gruppoMese.etichetta}
              </div>
              {gruppoMese.voci
                .slice()
                .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                .map((cd, i) => rigaCorso(cd, i, true))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {cittaOrdinate.map((c, idx) => {
        const totaleCorsiCitta = Object.values(c.mesi).reduce((tot, m) => tot + m.voci.length, 0);
        return (
          <div key={c.nome} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, marginTop: idx > 0 ? 0 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <IconaPin size={20} />
                <span style={{ ...fontDisplay, fontSize: 20, color: NAVY }}>{toTitleCase(c.nome)}</span>
              </div>
              <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, background: BG, borderRadius: 20, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>
                {totaleCorsiCitta} cors{totaleCorsiCitta === 1 ? "o" : "i"}
              </span>
            </div>
          {Object.keys(c.mesi)
            .sort()
            .map((chiaveMese, mIdx) => {
              const gruppoMese = c.mesi[chiaveMese];
              return (
                <div key={chiaveMese} style={{ marginBottom: 14, paddingTop: mIdx > 0 ? 14 : 0, borderTop: mIdx > 0 ? `1px solid ${CREAM_BORDER}` : "none" }}>
                  <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                    {gruppoMese.etichetta}
                  </div>
                  {gruppoMese.voci
                    .slice()
                    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                    .map((cd, i) => rigaCorso(cd, i, false))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Selettore usato per spostare un iscritto: stessa struttura città→corso→date,
// ma cliccabile per scegliere la destinazione e con le date già al completo disattivate.
function SelettoreSpostamento({ corsi, location, corsiDate, iscritti, corsoDataEscluso, onScegli }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const disponibili = corsiDate.filter((cd) => cd.id !== corsoDataEscluso);
  const perCitta = {};
  disponibili.forEach((cd) => {
    const locId = cd.location_id;
    if (!perCitta[locId]) perCitta[locId] = { nome: locById[locId]?.nome || "?", corsi: {} };
    if (!perCitta[locId].corsi[cd.corso_id]) perCitta[locId].corsi[cd.corso_id] = { corso: corsoById[cd.corso_id], date: [] };
    perCitta[locId].corsi[cd.corso_id].date.push(cd);
  });
  const cittaOrdinate = Object.values(perCitta).sort((a, b) => a.nome.localeCompare(b.nome));

  if (disponibili.length === 0) {
    return <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Non ci sono altre date disponibili.</div>;
  }

  return (
    <div>
      {cittaOrdinate.map((c) => (
        <div key={c.nome} style={{ marginBottom: 16 }}>
          <div style={{ ...fontDisplay, fontSize: 16, color: NAVY, marginBottom: 6, letterSpacing: 0.5 }}>{c.nome.toUpperCase()}</div>
          {Object.values(c.corsi)
            .sort((a, b) => (a.corso?.nome || "").localeCompare(b.corso?.nome || ""))
            .map((gruppo) => (
              <div key={gruppo.corso?.id || Math.random()} style={{ marginBottom: 8, paddingLeft: 4 }}>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 3, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: gruppo.corso?.colore || NAVY, flexShrink: 0 }} />
                  {gruppo.corso?.nome?.toUpperCase() || "?"}
                </div>
                {gruppo.date
                  .slice()
                  .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                  .map((cd) => {
                    const max = postiMaxEffettivi(cd, gruppo.corso, locById[cd.location_id]);
                    const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
                    const liberi = Math.max(0, max - occupati);
                    const pieno = liberi <= 0;
                    return (
                      <div
                        key={cd.id}
                        onClick={() => !pieno && onScegli(cd, gruppo.corso, locById[cd.location_id])}
                        style={{
                          ...fontBody,
                          fontSize: 13,
                          color: pieno ? "#C9A9A9" : MUTED,
                          padding: "5px 8px",
                          marginLeft: 15,
                          borderRadius: 6,
                          cursor: pieno ? "default" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          maxWidth: 380,
                          background: pieno ? "#F6EFEF" : "transparent",
                        }}
                      >
                        <span>{cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}</span>
                        <span>{pieno ? "completo" : `${liberi} posti liberi`}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}


// un singolo mese: titolo + griglia con le barre degli eventi
// idEvidenziato/overrideInizio/overrideFine/onDragBarra/refEvidenziato sono
// opzionali: servono solo quando questo mese è usato dentro CalendarioModifica
// per rendere trascinabile/ridimensionabile la barra dell'edizione in modifica.
// Il trascinamento vero e proprio (move/up) è gestito dal contenitore stabile
// in CalendarioModifica, non da questa barra: se lo spostamento la fa
// comparire in una settimana diversa, React distrugge e ricrea il suo nodo
// DOM, e qualunque cattura del puntore impostata su di essa andrebbe persa.
function MeseGriglia({ anno, mese, corsi, location, corsiDate, iscritti, onApriData, corsoById, locById, idEvidenziato, overrideInizio, overrideFine, onDragBarra, refEvidenziato, onClickGiornoVuoto, onDoppioClickEvento }) {
  // su schermi stretti (cellulare) le barre dei corsi diventano illeggibili
  // se restano alla dimensione pensata per desktop: qui si ingrandiscono
  // corsia, intestazione del giorno e i relativi font
  const isMobile = useIsMobile();
  const LANE_H = isMobile ? 28 : 20; // altezza di ogni "corsia" di eventi (px)
  const HEADER_H = isMobile ? 20 : 26; // spazio per il numero del giorno
  const GAP_LANE = isMobile ? 2 : 4; // spazio verticale tra due corsie di eventi sovrapposti
  const GAP_GIORNO = 1; // spazio orizzontale tra le colonne dei giorni: celle quasi a contatto
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const settimane = generaSettimane(anno, mese);
  function dateStr(d) { return dateStrFor(anno, mese, d); }

  // un doppio click nativo del browser scatta comunque prima un "click"
  // singolo: se onApriData navigasse subito via, il secondo click del
  // doppio click non avrebbe più nessun bottone su cui atterrare. Quindi il
  // primo click viene ritardato per vedere se ne arriva subito un secondo
  // (= doppio click, apre il popup elimina) prima di navigare per davvero
  const cliccoInAttesaRef = React.useRef(null);
  function gestisciClickBarra(ev) {
    if (!onDoppioClickEvento) { onApriData(ev); return; }
    if (cliccoInAttesaRef.current) {
      clearTimeout(cliccoInAttesaRef.current);
      cliccoInAttesaRef.current = null;
      onDoppioClickEvento(ev);
    } else {
      cliccoInAttesaRef.current = setTimeout(() => {
        cliccoInAttesaRef.current = null;
        onApriData(ev);
      }, 250);
    }
  }

  // durante il trascinamento, l'edizione evidenziata viene posizionata usando
  // le date "in corso di modifica" invece di quelle salvate sul database
  const corsiDateEff = (idEvidenziato && overrideInizio)
    ? corsiDate.map((cd) => cd.id === idEvidenziato ? { ...cd, data_inizio: overrideInizio, data_fine: overrideFine || overrideInizio } : cd)
    : corsiDate;

  const eventiMese = corsiDateEff.filter(
    (cd) => cd.data_inizio <= dateStr(giorniMese) && cd.data_fine >= dateStr(1)
  );

  return (
    <div style={{ marginBottom: 34 }}>
      <div style={{ ...fontDisplay, fontSize: 20, color: NAVY, marginBottom: 10 }}>{MESI[mese]} {anno}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: GAP_GIORNO, marginBottom: 4 }}>
        {GIORNI_ABBR.map((g, i) => <div key={i} style={{ ...fontBody, fontSize: isMobile ? 13 : 11, color: MUTED, textAlign: "center" }}>{g}</div>)}
      </div>

      {settimane.map((settimana, wi) => {
        const giorniValidi = settimana.filter((d) => d !== null);
        if (giorniValidi.length === 0) return null;
        const inizioRiga = dateStr(giorniValidi[0]);
        const fineRiga = dateStr(giorniValidi[giorniValidi.length - 1]);
        const eventiRiga = eventiMese.filter((ev) => ev.data_inizio <= fineRiga && ev.data_fine >= inizioRiga);
        const eventiConLane = assegnaLane(eventiRiga);
        const maxLane = eventiConLane.reduce((m, e) => Math.max(m, e.lane), -1);
        const numLane = maxLane + 1;
        // l'altezza deve contenere anche il gap TRA le corsie (GAP_LANE per
        // ognuna delle numLane-1 giunture): senza, con 3+ corsie sovrapposte
        // nella stessa settimana la pila di barre sborda oltre il fondo
        // della casella del giorno, perché lo spazio libero calcolato non
        // teneva conto di quanto gap si accumula andando avanti
        const rowHeight = HEADER_H + numLane * LANE_H + Math.max(0, numLane - 1) * GAP_LANE + 6;

        return (
          <div key={wi} style={{ position: "relative", marginBottom: 2 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: GAP_GIORNO }}>
              {settimana.map((d, i) => (
                <div
                  key={i}
                  data-data={d ? dateStr(d) : undefined}
                  onClick={d && onClickGiornoVuoto ? () => onClickGiornoVuoto(dateStr(d)) : undefined}
                  style={{
                    border: d ? `1px solid ${CREAM_BORDER}` : "none", borderRadius: 6, height: rowHeight,
                    background: !d ? "transparent" : i === 5 ? COLORE_SABATO : i === 6 ? COLORE_DOMENICA : "#fff",
                    boxSizing: "border-box", cursor: d && onClickGiornoVuoto ? "pointer" : undefined,
                  }}
                >
                  {d && <div style={{ ...fontBody, fontSize: isMobile ? 13 : 12, color: NAVY, padding: isMobile ? "2px 6px" : "4px 6px" }}>{d}</div>}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", top: HEADER_H, left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: LANE_H, columnGap: GAP_GIORNO, rowGap: GAP_LANE, pointerEvents: "none" }}>
              {eventiConLane.map((ev) => {
                const primoIdxValido = settimana.findIndex((d) => d !== null);
                const startIdx = settimana.findIndex((d) => d && dateStr(d) === ev.data_inizio);
                const colStart = startIdx >= 0 ? startIdx : primoIdxValido;
                const endIdx = settimana.reduce((acc, d, idx) => (d && dateStr(d) <= ev.data_fine ? idx : acc), colStart);
                const colSpan = endIdx - colStart + 1;
                const evidenziata = ev.id === idEvidenziato;
                const giorniTotali = differenzaGiorni(ev.data_inizio, ev.data_fine) + 1;
                const indiciGiorno = Array.from({ length: colSpan }, (_, i) => {
                  const g = settimana[colStart + i];
                  return g ? differenzaGiorni(ev.data_inizio, dateStr(g)) + 1 : null;
                });
                const continuaPrima = startIdx < 0;
                const continuaDopo = ev.data_fine > fineRiga;
                const corso = corsoById[ev.corso_id];
                const loc = locById[ev.location_id];
                const coloreCorso = corso?.colore || NAVY;
                const capienza = postiMaxEffettivi(ev, corso, loc);
                const numeroAllievi = iscritti ? iscritti.filter((i) => i.corso_data_id === ev.id).length : 0;
                const occupancy = iscritti && capienza > 0
                  ? Math.min(100, Math.max(0, (numeroAllievi / capienza) * 100))
                  : null;
                return (
                  <div
                    key={ev.id}
                    ref={evidenziata ? refEvidenziato : null}
                    onClick={() => gestisciClickBarra(ev)}
                    onPointerDown={evidenziata && onDragBarra ? (e) => onDragBarra(e, "sposta") : undefined}
                    title={`${corso?.nome?.toUpperCase()} · ${loc?.nome?.toUpperCase()}${occupancy != null ? ` · ${numeroAllievi}/${capienza}` : ""}`}
                    style={{
                      position: "relative",
                      pointerEvents: "auto",
                      gridColumn: `${colStart + 1} / span ${colSpan}`,
                      gridRow: ev.lane + 1,
                      alignSelf: "center",
                      // un po' di margine dai bordi dei giorni dove la barra
                      // non prosegue: attaccata al bordo diventa un ammasso
                      // di grafica; dove invece prosegue (freccia) deve
                      // restare a contatto per sembrare un pezzo unico
                      marginLeft: continuaPrima ? 0 : 3,
                      marginRight: continuaDopo ? 0 : 3,
                      height: LANE_H - 4,
                      // niente bordo/contorno: solo il colore tenue di
                      // sfondo, riempito dal basso col colore pieno via via
                      // che si iscrivono allievi (vedi il div dell'occupancy
                      // qui sotto)
                      background: occupancy != null ? coloreTenue(coloreCorso) : coloreCorso,
                      borderRadius: 4,
                      clipPath: clipPathBarra(continuaPrima, continuaDopo, LANE_H - 4),
                      overflow: "hidden",
                      color: "#000",
                      fontSize: isMobile ? 9 : 8,
                      fontWeight: 500,
                      ...fontBody,
                      cursor: evidenziata ? "grab" : "pointer",
                      touchAction: evidenziata ? "none" : undefined,
                      userSelect: evidenziata ? "none" : undefined,
                      boxShadow: evidenziata ? "0 0 0 2px #fff, 0 0 0 4px " + NAVY : "none",
                      zIndex: evidenziata ? 5 : 1,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {occupancy != null && (
                      <div
                        style={{
                          position: "absolute", left: 0, right: 0, bottom: 0, height: `${occupancy}%`,
                          background: coloreCorso, pointerEvents: "none", zIndex: 0, transition: "height 250ms ease",
                        }}
                      />
                    )}
                    <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                      {contenutoBarraCalendario({
                        etichetta: etichettaBarra(corso, loc, isMobile ? null : 10),
                        giorniTotali, indiciGiorno, fontSizeBadge: isMobile ? 8 : 7, gap: GAP_GIORNO, inset: 6,
                        continuaPrima, continuaDopo, coneRun: runPuntaFreccia(LANE_H - 4), isMobile,
                      })}
                    </div>
                    {evidenziata && onDragBarra && (
                      <div
                        onPointerDown={(e) => { e.stopPropagation(); onDragBarra(e, "inizio"); }}
                        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, cursor: "ew-resize", touchAction: "none", zIndex: 1 }}
                      />
                    )}
                    {evidenziata && onDragBarra && (
                      <div
                        onPointerDown={(e) => { e.stopPropagation(); onDragBarra(e, "fine"); }}
                        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 10, cursor: "ew-resize", touchAction: "none", zIndex: 1 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// finestra per creare rapidamente una nuova data cliccando un giorno vuoto
// nel calendario: tipo di corso, città (se non già fissata dal contesto) e
// durata in giorni con +/-, poi Salva o Annulla
function PopupNuovaData({ corsi, location, cittaFissa, dataClic, onSalva, onChiudi }) {
  const [corsoSel, setCorsoSel] = useState("");
  const [locSel, setLocSel] = useState(cittaFissa || "");
  const [giorni, setGiorni] = useState(1);

  return (
    <Modal title={`Nuova data — ${fmtData(dataClic)}`} onClose={onChiudi}>
      <Field label="Tipo di corso">
        <select style={inputStyle} value={corsoSel} onChange={(e) => setCorsoSel(e.target.value)}>
          <option value="">Seleziona corso</option>
          {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
        </select>
      </Field>
      {!cittaFissa && (
        <Field label="Città">
          <select style={inputStyle} value={locSel} onChange={(e) => setLocSel(e.target.value)}>
            <option value="">Seleziona città</option>
            {location.map((l) => <option key={l.id} value={l.id}>{l.nome.toUpperCase()}</option>)}
          </select>
        </Field>
      )}
      <Field label="Durata (giorni)">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            type="button"
            onClick={() => setGiorni((g) => Math.max(1, g - 1))}
            style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, fontSize: 20, cursor: "pointer" }}
          >
            −
          </button>
          <div style={{ ...fontDisplay, fontSize: 26, color: NAVY, minWidth: 30, textAlign: "center" }}>{giorni}</div>
          <button
            type="button"
            onClick={() => setGiorni((g) => g + 1)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 20, cursor: "pointer" }}
          >
            +
          </button>
        </div>
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Button
          disabled={!corsoSel || !locSel}
          onClick={() => onSalva({ corso_id: corsoSel, location_id: locSel, data_inizio: dataClic, data_fine: addGiorni(dataClic, giorni - 1) })}
        >
          Salva
        </Button>
        <Button variant="ghost" onClick={onChiudi}>Annulla</Button>
      </div>
    </Modal>
  );
}

// finestra che compare facendo doppio click su un corso già esistente nel
// calendario, per eliminarlo rapidamente
function PopupEliminaData({ evento, corsoById, locById, onElimina, onChiudi }) {
  return (
    <Modal title="Corso esistente" onClose={onChiudi}>
      <div style={{ ...fontBody, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        {corsoById[evento.corso_id]?.nome?.toUpperCase() || "?"} · {locById[evento.location_id]?.nome?.toUpperCase() || "?"}
      </div>
      <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 20 }}>
        {fmtDataCompatta(evento.data_inizio, evento.data_fine)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="danger" onClick={() => onElimina(evento.id)}>Elimina</Button>
        <Button variant="ghost" onClick={onChiudi}>Annulla</Button>
      </div>
    </Modal>
  );
}

function Calendario({ corsi, location, corsiDate, iscritti, onApriData, onBack, ricarica }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const [popupNuovo, setPopupNuovo] = useState(null); // data "yyyy-mm-dd" cliccata, o null
  const [popupElimina, setPopupElimina] = useState(null); // evento corsi_date cliccato, o null

  async function salvaNuovo({ corso_id, location_id, data_inizio, data_fine }) {
    const { error } = await supabase.from("corsi_date").insert({ corso_id, location_id, data_inizio, data_fine });
    if (error) { window.alert("Errore: " + error.message); return; }
    setPopupNuovo(null);
    ricarica();
  }
  async function eliminaEsistente(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { window.alert("Errore: " + error.message); return; }
    setPopupElimina(null);
    ricarica();
  }

  const oggi = new Date();
  // elenco continuo di mesi: da 6 mesi fa a 12 mesi avanti, così basta scorrere invece di usare frecce
  const mesi = useMemo(() => {
    const arr = [];
    for (let i = -6; i <= 12; i++) {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1);
      arr.push({ anno: d.getFullYear(), mese: d.getMonth() });
    }
    return arr;
  }, []);

  const refOggi = React.useRef(null);
  useEffect(() => {
    refOggi.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <TopBar title="Calendario" onBack={onBack} />
        <Button variant="ghost" onClick={() => refOggi.current?.scrollIntoView({ block: "start", behavior: "smooth" })}>Oggi</Button>
      </div>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 16 }}>
        Scorri su o giù per vedere gli altri mesi. Clicca un corso per aprire iscritti e posti disponibili (doppio click per eliminarlo), clicca un giorno vuoto per crearne uno nuovo.
      </div>

      {mesi.map(({ anno, mese }) => (
        // scrollMarginTop: lo scroll automatico al mese corrente (block:"start")
        // allineerebbe altrimenti il mese proprio sotto la barra fissa
        // Indietro/Avanti, nascondendolo parzialmente dietro di essa
        <div key={`${anno}-${mese}`} style={{ scrollMarginTop: 54 }} ref={anno === oggi.getFullYear() && mese === oggi.getMonth() ? refOggi : null}>
          <MeseGriglia
            anno={anno} mese={mese} corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti}
            onApriData={onApriData} corsoById={corsoById} locById={locById}
            onClickGiornoVuoto={setPopupNuovo}
            onDoppioClickEvento={setPopupElimina}
          />
        </div>
      ))}

      {popupNuovo && (
        <PopupNuovaData corsi={corsi} location={location} dataClic={popupNuovo} onSalva={salvaNuovo} onChiudi={() => setPopupNuovo(null)} />
      )}
      {popupElimina && (
        <PopupEliminaData evento={popupElimina} corsoById={corsoById} locById={locById} onElimina={eliminaEsistente} onChiudi={() => setPopupElimina(null)} />
      )}
    </div>
  );
}

// ---------- Calendario trascinabile (per modificare una data esistente) ----------
// mostra tutto il calendario, scorribile, con le barre colorate di tutti i
// corsi: quella dell'edizione in modifica si può trascinare per spostarla su
// altre date, oppure allungare/accorciare trascinandone i bordi
function CalendarioModifica({ corsi, location, corsiDate, iscritti, cdId, valore, onCambia, ricarica, onDataEliminata }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  // stessa possibilità di aggiungere/eliminare cliccando direttamente sul
  // calendario disponibile nell'altro Calendario e in "Aggiungi data"
  const [popupNuovo, setPopupNuovo] = useState(null);
  const [popupElimina, setPopupElimina] = useState(null);
  async function salvaNuovo({ corso_id, location_id, data_inizio, data_fine }) {
    const { error } = await supabase.from("corsi_date").insert({ corso_id, location_id, data_inizio, data_fine });
    if (error) { window.alert("Errore: " + error.message); return; }
    setPopupNuovo(null);
    ricarica();
  }
  async function eliminaEsistente(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { window.alert("Errore: " + error.message); return; }
    setPopupElimina(null);
    ricarica();
    onDataEliminata?.(id);
  }

  const oggi = new Date();
  const mesi = useMemo(() => {
    const arr = [];
    for (let i = -6; i <= 12; i++) {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1);
      arr.push({ anno: d.getFullYear(), mese: d.getMonth() });
    }
    return arr;
  }, []);

  const refEvidenziato = React.useRef(null);
  useEffect(() => {
    refEvidenziato.current?.scrollIntoView({ block: "center" });
  }, []);

  // posizione mostrata a schermo mentre si trascina: vive SOLO in questo
  // componente (non nel genitore Impostazioni) proprio per evitare di
  // ridisegnare a ogni giorno attraversato l'intera pagina Impostazioni
  // (con tutta la lunga lista "Date esistenti"), che causava una latenza
  // pesante durante il trascinamento. Il genitore (onCambia, che salva
  // anche nei campi Data inizio/fine) viene aggiornato una sola volta,
  // al rilascio del mouse/dito.
  const [posizione, setPosizione] = useState(valore);
  const trascinandoRef = React.useRef(false);
  useEffect(() => {
    if (!trascinandoRef.current) setPosizione(valore);
  }, [valore.inizio, valore.fine]);

  const contenitoreRef = React.useRef(null);

  // stato del trascinamento in corso (dita/mouse). il giorno "sotto" il
  // dito/mouse viene letto direttamente dal calendario (cella con
  // data-data), non calcolato dallo spostamento in pixel: così si può
  // trascinare liberamente su qualunque settimana, anche più in basso,
  // senza dover passare per tutti i giorni intermedi
  const dragRef = React.useRef(null);

  function trovaGiornoSotto(clientX, clientY) {
    const pila = document.elementsFromPoint(clientX, clientY);
    for (const el of pila) {
      if (el.hasAttribute && el.hasAttribute("data-data")) return el.getAttribute("data-data");
    }
    return null;
  }

  function calcolaPosizione(d, giornoSotto) {
    const deltaGiorni = differenzaGiorni(d.giornoAggancio, giornoSotto);
    if (d.modo === "sposta") {
      return { inizio: addGiorni(d.origInizio, deltaGiorni), fine: addGiorni(d.origFine, deltaGiorni) };
    } else if (d.modo === "inizio") {
      let nuovoInizio = addGiorni(d.origInizio, deltaGiorni);
      if (nuovoInizio > d.origFine) nuovoInizio = d.origFine;
      return { inizio: nuovoInizio, fine: d.origFine };
    } else {
      let nuovaFine = addGiorni(d.origFine, deltaGiorni);
      if (nuovaFine < d.origInizio) nuovaFine = d.origInizio;
      return { inizio: d.origInizio, fine: nuovaFine };
    }
  }

  // avvicinandosi al bordo superiore/inferiore del riquadro (che ha
  // un'altezza limitata e scorre al suo interno) lo fa scorrere da solo,
  // altrimenti trascinare verso una settimana fuori dalla vista attuale
  // farebbe uscire il dito/mouse dal calendario e il trascinamento si
  // fermerebbe senza poter raggiungere quella settimana
  function autoScroll(clientY) {
    const box = contenitoreRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const margine = 36;
    if (clientY < r.top + margine) box.scrollTop -= 14;
    else if (clientY > r.bottom - margine) box.scrollTop += 14;
  }

  function iniziaDrag(e, modo) {
    e.preventDefault();
    // la cattura del puntore va impostata sul CONTENITORE stabile (che non
    // sparisce mai durante il trascinamento), non sulla barra: spostando il
    // corso su un'altra settimana la barra cambia riga e React distrugge e
    // ricrea quel nodo del DOM, il che fa perdere la cattura impostata su di
    // essa e blocca il trascinamento a metà (il bug segnalato dall'utente)
    contenitoreRef.current?.setPointerCapture(e.pointerId);
    trascinandoRef.current = true;
    const giornoAggancio = trovaGiornoSotto(e.clientX, e.clientY) || posizione.inizio;
    dragRef.current = {
      modo, pointerId: e.pointerId,
      origInizio: posizione.inizio, origFine: posizione.fine || posizione.inizio,
      giornoAggancio, ultimoGiorno: giornoAggancio,
    };
  }
  function muoviDrag(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    autoScroll(e.clientY);
    const giornoSotto = trovaGiornoSotto(e.clientX, e.clientY);
    if (!giornoSotto || giornoSotto === d.ultimoGiorno) return;
    d.ultimoGiorno = giornoSotto;
    setPosizione(calcolaPosizione(d, giornoSotto));
  }
  function fineDrag(e) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    trascinandoRef.current = false;
    // ricalcola la posizione finale direttamente dalle coordinate del
    // rilascio, invece di fidarsi dell'ultimo "muoviDrag" arrivato: così
    // il corso si posiziona sempre esattamente dove viene rilasciato
    const giornoSotto = trovaGiornoSotto(e.clientX, e.clientY) || d.ultimoGiorno;
    const finale = calcolaPosizione(d, giornoSotto);
    setPosizione(finale);
    onCambia(finale);
  }

  return (
    <div
      ref={contenitoreRef}
      onPointerMove={muoviDrag}
      onPointerUp={fineDrag}
      onPointerCancel={fineDrag}
      style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "14px 16px", maxHeight: 480, overflowY: "auto" }}
    >
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 14 }}>
        Trascina la barra evidenziata (con il bordo bianco) per spostare il corso su altre date, oppure trascina i suoi due bordi per accorciarla o allungarla.
      </div>
      {mesi.map(({ anno, mese }) => (
        <MeseGriglia
          key={`${anno}-${mese}`}
          anno={anno} mese={mese}
          corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti}
          corsoById={corsoById} locById={locById}
          onApriData={() => {}}
          idEvidenziato={cdId}
          overrideInizio={posizione.inizio} overrideFine={posizione.fine}
          onDragBarra={iniziaDrag}
          refEvidenziato={refEvidenziato}
          onClickGiornoVuoto={setPopupNuovo}
          onDoppioClickEvento={setPopupElimina}
        />
      ))}
      {popupNuovo && (
        <PopupNuovaData corsi={corsi} location={location} dataClic={popupNuovo} onSalva={salvaNuovo} onChiudi={() => setPopupNuovo(null)} />
      )}
      {popupElimina && (
        <PopupEliminaData evento={popupElimina} corsoById={corsoById} locById={locById} onElimina={eliminaEsistente} onChiudi={() => setPopupElimina(null)} />
      )}
    </div>
  );
}

// ---------- Selettore date dal calendario (per Aggiungi data) ----------
function SelettoreCalendario({ corsi, location, corsiDate, iscritti, onClickGiorno, onDoppioClickEvento }) {
  const [mese, setMese] = useState(new Date().getMonth());
  const [anno, setAnno] = useState(new Date().getFullYear());

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const settimane = generaSettimane(anno, mese);
  function dateStr(d) { return dateStrFor(anno, mese, d); }

  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button type="button" onClick={() => { const m = mese - 1; if (m < 0) { setMese(11); setAnno(anno - 1); } else setMese(m); }} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY }}>&larr;</button>
        <div style={{ ...fontBody, fontSize: 13, color: NAVY, fontWeight: 500 }}>{MESI[mese]} {anno}</div>
        <button type="button" onClick={() => { const m = mese + 1; if (m > 11) { setMese(0); setAnno(anno + 1); } else setMese(m); }} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY }}>&rarr;</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
        {GIORNI.map((g, i) => <div key={i} style={{ ...fontBody, fontSize: 10, color: MUTED, textAlign: "center" }}>{g}</div>)}
      </div>

      {settimane.map((settimana, wi) => {
        const giorniValidi = settimana.filter((d) => d !== null);
        if (giorniValidi.length === 0) return null;
        const inizioRiga = dateStr(giorniValidi[0]);
        const fineRiga = dateStr(giorniValidi[giorniValidi.length - 1]);
        const eventiRiga = corsiDate.filter((ev) => ev.data_inizio <= fineRiga && ev.data_fine >= inizioRiga);
        const eventiConLane = assegnaLane(eventiRiga);
        const maxLane = eventiConLane.reduce((m, e) => Math.max(m, e.lane), -1);
        const barH = 15;
        const numLane = Math.max(0, maxLane + 1);
        // vedi MeseGriglia: l'altezza deve contenere anche il gap (3px) tra
        // ogni coppia di corsie, altrimenti con più corsi sovrapposti la
        // pila di barre sborda oltre il fondo della casella del giorno
        const rowHeight = 20 + numLane * barH + Math.max(0, numLane - 1) * 3 + 4;

        return (
          <div key={wi} style={{ position: "relative", marginBottom: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {settimana.map((d, i) => {
                if (!d) return <div key={i} style={{ height: rowHeight }} />;
                return (
                  <div
                    key={i}
                    onClick={() => onClickGiorno(dateStr(d))}
                    style={{
                      height: rowHeight,
                      borderRadius: 6,
                      background: i === 5 ? COLORE_SABATO : i === 6 ? COLORE_DOMENICA : "#fff",
                      border: `1px solid ${CREAM_BORDER}`,
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ ...fontBody, fontSize: 11, color: NAVY, padding: "2px 5px" }}>{d}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", top: 20, left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: barH, gap: 3, pointerEvents: "none" }}>
              {eventiConLane.map((ev) => {
                const primoIdxValido = settimana.findIndex((d) => d !== null);
                const startIdx = settimana.findIndex((d) => d && dateStr(d) === ev.data_inizio);
                const colStart = startIdx >= 0 ? startIdx : primoIdxValido;
                const endIdx = settimana.reduce((acc, d, idx) => (d && dateStr(d) <= ev.data_fine ? idx : acc), colStart);
                const colSpan = endIdx - colStart + 1;
                const giorniTotali = differenzaGiorni(ev.data_inizio, ev.data_fine) + 1;
                const indiciGiorno = Array.from({ length: colSpan }, (_, i) => {
                  const g = settimana[colStart + i];
                  return g ? differenzaGiorni(ev.data_inizio, dateStr(g)) + 1 : null;
                });
                const continuaPrima = startIdx < 0;
                const continuaDopo = ev.data_fine > fineRiga;
                const corso = corsoById[ev.corso_id];
                const loc = locById[ev.location_id];
                const coloreCorso = corso?.colore || NAVY;
                const capienza = postiMaxEffettivi(ev, corso, loc);
                const numeroAllievi = iscritti ? iscritti.filter((i) => i.corso_data_id === ev.id).length : 0;
                const occupancy = iscritti && capienza > 0
                  ? Math.min(100, Math.max(0, (numeroAllievi / capienza) * 100))
                  : null;
                return (
                  <div
                    key={ev.id}
                    onDoubleClick={() => onDoppioClickEvento(ev)}
                    title={`${corso?.nome?.toUpperCase()} · ${loc?.nome?.toUpperCase()}${occupancy != null ? ` · ${numeroAllievi}/${capienza}` : ""}`}
                    style={{
                      position: "relative",
                      pointerEvents: "auto",
                      gridColumn: `${colStart + 1} / span ${colSpan}`,
                      gridRow: ev.lane + 1,
                      alignSelf: "center",
                      marginLeft: continuaPrima ? 0 : 2,
                      marginRight: continuaDopo ? 0 : 2,
                      height: barH - 3,
                      // niente bordo/contorno: solo il colore tenue di
                      // sfondo, riempito dal basso col colore pieno via via
                      // che si iscrivono allievi
                      background: occupancy != null ? coloreTenue(coloreCorso) : coloreCorso,
                      borderRadius: 3,
                      clipPath: clipPathBarra(continuaPrima, continuaDopo, barH - 3),
                      overflow: "hidden",
                      color: "#000",
                      fontSize: 9,
                      fontWeight: 500,
                      ...fontBody,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {occupancy != null && (
                      <div
                        style={{
                          position: "absolute", left: 0, right: 0, bottom: 0, height: `${occupancy}%`,
                          background: coloreCorso, pointerEvents: "none", zIndex: 0, transition: "height 250ms ease",
                        }}
                      />
                    )}
                    <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                      {contenutoBarraCalendario({
                        etichetta: etichettaBarra(corso, loc),
                        giorniTotali, indiciGiorno, fontSizeBadge: 7, gap: 3, inset: 4,
                        continuaPrima, continuaDopo, coneRun: runPuntaFreccia(barH - 3),
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 8 }}>
        Clicca un giorno vuoto per creare una nuova edizione. Doppio click su un corso esistente per eliminarlo.
      </div>
    </div>
  );
}

// ---------- Cerca corso ----------
function CercaCorso({ corsi, location, corsiDate, iscritti, onApriData, onBack }) {
  const [citta, setCitta] = useState("");
  const [corso, setCorso] = useState("");
  const [mese, setMese] = useState(""); // formato "YYYY-MM" dall'input type="month"
  const [tutti, setTutti] = useState(false);

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  // trasformo il mese selezionato in un intervallo primo/ultimo giorno per il confronto
  let meseInizio = null, meseFine = null;
  if (mese) {
    const [y, m] = mese.split("-").map(Number);
    meseInizio = `${mese}-01`;
    meseFine = `${mese}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  }

  const filtrati = corsiDate.filter((cd) => {
    if (!tutti) {
      if (citta && cd.location_id !== citta) return false;
      if (corso && cd.corso_id !== corso) return false;
      if (mese && !(cd.data_inizio <= meseFine && cd.data_fine >= meseInizio)) return false;
      if (!citta && !corso && !mese) return false;
    }
    return true;
  });

  // raggruppa per corso + città
  const gruppi = {};
  filtrati.forEach((cd) => {
    const key = cd.corso_id + "|" + cd.location_id;
    if (!gruppi[key]) gruppi[key] = [];
    gruppi[key].push(cd);
  });

  function postiLiberi(cd) {
    const max = postiMaxEffettivi(cd, corsoById[cd.corso_id], locById[cd.location_id]);
    const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
    return Math.max(0, max - occupati);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Cerca corso" onBack={onBack} />

      <div style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Città">
            <select style={inputStyle} value={citta} onChange={(e) => { setCitta(e.target.value); setTutti(false); }}>
              <option value="">Tutte</option>
              {location.map((l) => <option key={l.id} value={l.id}>{l.nome.toUpperCase()}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Corso">
            <select style={inputStyle} value={corso} onChange={(e) => { setCorso(e.target.value); setTutti(false); }}>
              <option value="">Tutti</option>
              {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Mese">
            <input type="month" style={inputStyle} value={mese} onChange={(e) => { setMese(e.target.value); setTutti(false); }} />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Button variant={tutti ? "primary" : "ghost"} onClick={() => { setTutti(true); setCitta(""); setCorso(""); setMese(""); }}>Tutti i corsi</Button>
        </div>
      </div>

      {Object.keys(gruppi).length === 0 && (
        <div style={{ ...fontBody, color: MUTED, fontSize: 14 }}>Imposta un filtro oppure premi "Tutti i corsi" per vedere l'elenco.</div>
      )}

      {Object.entries(gruppi).map(([key, date]) => {
        const first = date[0];
        return (
          <div key={key} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: corsoById[first.corso_id]?.colore }} />
              <div style={hStyle}>{corsoById[first.corso_id]?.nome?.toUpperCase()} · {locById[first.location_id]?.nome?.toUpperCase()}</div>
            </div>
            {date.sort((a, b) => a.data_inizio.localeCompare(b.data_inizio)).map((cd) => (
              <div
                key={cd.id}
                onClick={() => onApriData(cd)}
                style={{ ...fontBody, fontSize: 14, color: NAVY, padding: "8px 4px", borderTop: `1px solid ${CREAM_BORDER}`, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
              >
                <span>{cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}</span>
                <span style={{ color: MUTED }}>{postiLiberi(cd)} posti liberi</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Cerca iscritto ----------
function CercaIscritto({ corsi, location, corsiDate, iscritti, onApriData, onBack }) {
  const [query, setQuery] = useState("");

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const corsoDataById = useMemo(() => Object.fromEntries(corsiDate.map((cd) => [cd.id, cd])), [corsiDate]);

  const q = query.trim().toLowerCase();
  const risultati = q
    ? iscritti.filter((i) => i.nome.toLowerCase().includes(q) || i.cognome.toLowerCase().includes(q))
    : [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Cerca iscritto" onBack={onBack} />
      <div style={cardStyle}>
        <Field label="Nome o cognome">
          <input
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="es. Rossi"
            autoFocus
          />
        </Field>
      </div>

      {q && risultati.length === 0 && (
        <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Nessun iscritto trovato con questo nome.</div>
      )}

      {risultati.map((i) => {
        const cd = corsoDataById[i.corso_data_id];
        if (!cd) return null;
        const corso = corsoById[cd.corso_id];
        const loc = locById[cd.location_id];
        return (
          <div
            key={i.id}
            onClick={() => onApriData(cd)}
            style={{ ...cardStyle, cursor: "pointer", padding: "16px 20px", marginBottom: 10 }}
          >
            <div style={{ ...fontBody, fontSize: 15, color: NAVY, fontWeight: 500, marginBottom: 3 }}>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</div>
            <div style={{ ...fontBody, fontSize: 13, color: MUTED, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: corso?.colore || NAVY, flexShrink: 0 }} />
              {corso?.nome?.toUpperCase() || "?"} · {loc?.nome?.toUpperCase() || "?"} · {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Scheda data (iscritti) ----------
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || "";

// link cliccabile a un allegato caricato nello storage "allegati-iscritti"
function AllegatoLink({ percorso, etichetta, bucket = "allegati-iscritti" }) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(percorso);
  return (
    <a
      href={data.publicUrl}
      target="_blank"
      rel="noreferrer"
      style={{ ...fontBody, fontSize: 12, color: NAVY, textDecoration: "underline" }}
    >
      {etichetta}
    </a>
  );
}

// calendario sempre visibile (non il picker nativo del browser, che su
// alcuni dispositivi/browser non risponde in modo affidabile) per scegliere
// la data eccezione da mostrare sul diploma: evidenzia i giorni in cui il
// corso si sta davvero svolgendo
function SelettoreDataDiploma({ valore, dataInizio, dataFine, onCambia }) {
  const partenza = valore || dataInizio;
  const [pAnno, pMese] = partenza.split("-").map(Number);
  const [vista, setVista] = useState({ anno: pAnno, mese: pMese - 1 });
  const settimane = generaSettimane(vista.anno, vista.mese);
  const meseVuoto = (d) => (d ? d : "");
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setVista((v) => (v.mese === 0 ? { anno: v.anno - 1, mese: 11 } : { anno: v.anno, mese: v.mese - 1 }))}
          style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY, fontSize: 16, padding: 4 }}
        >
          &larr;
        </button>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>{MESI[vista.mese]} {vista.anno}</div>
        <button
          type="button"
          onClick={() => setVista((v) => (v.mese === 11 ? { anno: v.anno + 1, mese: 0 } : { anno: v.anno, mese: v.mese + 1 }))}
          style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY, fontSize: 16, padding: 4 }}
        >
          &rarr;
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {GIORNI_ABBR.map((g) => (
          <div key={g} style={{ ...fontBody, textAlign: "center", fontSize: 10, color: MUTED }}>{g}</div>
        ))}
      </div>
      {settimane.map((sett, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
          {sett.map((d, di) => {
            if (!d) return <div key={di} />;
            const ds = dateStrFor(vista.anno, vista.mese, d);
            const inCorso = ds >= dataInizio && ds <= dataFine;
            const selezionato = ds === valore;
            return (
              <button
                type="button"
                key={di}
                disabled={!inCorso}
                onClick={() => onCambia(ds)}
                title={inCorso ? "" : "Fuori dalle date del corso"}
                style={{
                  ...fontBody,
                  aspectRatio: "1",
                  border: "none",
                  borderRadius: 6,
                  cursor: inCorso ? "pointer" : "default",
                  background: selezionato ? NAVY : inCorso ? "#DCE8FB" : "transparent",
                  color: selezionato ? "#fff" : inCorso ? NAVY : "#C9C9C9",
                  fontSize: 12,
                  fontWeight: selezionato ? 700 : 400,
                }}
              >
                {meseVuoto(d)}
              </button>
            );
          })}
        </div>
      ))}
      {valore && (
        <button
          type="button"
          onClick={() => onCambia(null)}
          style={{ ...fontBody, marginTop: 8, width: "100%", padding: "6px 0", border: "none", background: "none", color: "#C0392B", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
        >
          Cancella (usa la data del corso)
        </button>
      )}
    </div>
  );
}

function SchedaData({ corsoData, corsi, location, corsiDate, iscritti, master, fontDiplomi, diplomaEccezioni, segnaposti, ricarica, onBack, sottoVistaIniziale, onCambiaSottoVista }) {
  // vista/modificandoId/mostraGestione partono dal valore iniziale ricevuto
  // dal genitore (App) invece che sempre dai default: quando i pulsanti
  // Indietro/Avanti riportano qui con uno stato salvato, il genitore
  // rimonta questo componente (via key) passando lo stato da ripristinare
  const [vista, setVista] = useState(sottoVistaIniziale?.vista ?? "lista"); // 'lista' | 'form'
  const [modificandoId, setModificandoId] = useState(sottoVistaIniziale?.modificandoId ?? null); // id dell'iscritto in modifica, null se è una nuova iscrizione
  const isMobile = useIsMobile();

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [note, setNote] = useState("");
  const [tutor, setTutor] = useState("");
  const [telefono, setTelefono] = useState("");
  // iscrizione inserita ora ma relativa a un corso già passato: non deve
  // sporcare le statistiche/iscrizioni "di oggi" (si basano su `ts`, il
  // momento in cui viene salvata nel database, non la data del corso)
  const [vecchiaIscrizione, setVecchiaIscrizione] = useState(false);
  const QUOTA_VUOTA = { imponibile: "", totale: "", metodo: "", interessi: "" };
  const [pagAcconto, setPagAcconto] = useState(QUOTA_VUOTA);
  const [pagPrecorso, setPagPrecorso] = useState(QUOTA_VUOTA);
  const [pagSaldo, setPagSaldo] = useState(QUOTA_VUOTA);
  const [accordiCommerciali, setAccordiCommerciali] = useState("");
  const [richiedeModelle, setRichiedeModelle] = useState("");
  const [numeroModelle, setNumeroModelle] = useState("");
  const [prezzoSpecialeModelle, setPrezzoSpecialeModelle] = useState("");
  // un elemento per modella richiesta: { tipo, mattina, pomeriggio }. Il
  // form modifica solo "tipo" — mattina/pomeriggio si impostano esclusivamente
  // da "Assegna modelle" in Contabilità classe e qui restano invariati
  const [tipiModelle, setTipiModelle] = useState([]);
  const [pacchettoKit, setPacchettoKit] = useState("");
  const [tagliaDivisa, setTagliaDivisa] = useState("");
  const [totalePattuito, setTotalePattuito] = useState("");
  const [quotaSpeciale, setQuotaSpeciale] = useState("");
  const [fileIscrizione, setFileIscrizione] = useState(null);
  const [fileScreenAcconto, setFileScreenAcconto] = useState(null);
  const [fileScreenRecap, setFileScreenRecap] = useState(null);
  const [caricando, setCaricando] = useState(false);

  const [spostaIscrittoId, setSpostaIscrittoId] = useState(null); // id dell'iscritto per cui si sta scegliendo la nuova data
  const [eccezioneApertaId, setEccezioneApertaId] = useState(null); // id dell'iscritto per cui si sta scegliendo l'eccezione diploma
  const [msg, setMsg] = useState("");
  const [adminSbloccato, setAdminSbloccato] = useState(sessionStorage.getItem("edc_admin_ok") === "1");
  const [mostraGestione, setMostraGestione] = useState(sottoVistaIniziale?.mostraGestione ?? false);
  const [linkMaster, setLinkMaster] = useState("");
  const [linkModelle, setLinkModelle] = useState("");
  const [generandoDiplomi, setGenerandoDiplomi] = useState(false);
  const [generandoSegnaposti, setGenerandoSegnaposti] = useState(false);

  // pannello "Riepilogo amministrativo" (costi della classe): parte
  // chiuso perché, se sempre aperto, intralcia la normale gestione
  // contabilità (spuntare incassato, aprire schede...)
  const [costiAperto, setCostiAperto] = useState(false);
  const [costoAccademia, setCostoAccademia] = useState(corsoData.costo_accademia != null ? String(corsoData.costo_accademia) : "");
  const [costoMaster, setCostoMaster] = useState(corsoData.costo_master != null ? String(corsoData.costo_master) : "");
  const [costoAssistenti, setCostoAssistenti] = useState(corsoData.costo_assistenti != null ? String(corsoData.costo_assistenti) : "");
  const [costoPranzi, setCostoPranzi] = useState(corsoData.costo_pranzi != null ? String(corsoData.costo_pranzi) : "");
  const [costoHotel, setCostoHotel] = useState(corsoData.costo_hotel != null ? String(corsoData.costo_hotel) : "");
  // voci di costo aggiunte liberamente dall'amministratore (titolo + importo)
  const [costiExtra, setCostiExtra] = useState(
    Array.isArray(corsoData.costi_extra) ? corsoData.costi_extra.map((c) => ({ titolo: c.titolo || "", valore: c.valore != null ? String(c.valore) : "" })) : []
  );
  const [salvandoCosti, setSalvandoCosti] = useState(false);

  // segnala al genitore ogni cambiamento di sotto-vista (lista/form,
  // quale iscritto in modifica, contabilità aperta o no): è così che i
  // pulsanti Indietro/Avanti possono registrare anche questi passaggi
  // interni, non solo i cambi di schermata principale
  useEffect(() => {
    onCambiaSottoVista?.({ vista, modificandoId, mostraGestione });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, modificandoId, mostraGestione]);

  // quando si arriva qui già con un iscritto da modificare (es. cliccando
  // una riga in "Ultime iscrizioni", o tornando con Indietro/Avanti a
  // questo stato), sottoVistaIniziale imposta solo vista/modificandoId:
  // senza questo, tutti gli altri campi del form (nome, importi...)
  // resterebbero ai valori vuoti di default invece dei dati veri
  // dell'iscritto, facendo sembrare la scheda vuota
  useEffect(() => {
    if (sottoVistaIniziale?.modificandoId) {
      const i = iscritti.find((x) => x.id === sottoVistaIniziale.modificandoId);
      if (i) apriModificaCompleta(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tiene l'elenco "tipiModelle" della stessa lunghezza del numero di
  // modelle richiesto: aggiunge righe vuote se si aumenta il numero,
  // taglia quelle in eccesso se si riduce (senza toccare tipo/mattina/
  // pomeriggio delle righe che restano)
  useEffect(() => {
    if (richiedeModelle !== "si") { if (tipiModelle.length > 0) setTipiModelle([]); return; }
    const n = Math.max(0, parseInt(numeroModelle, 10) || 0);
    if (n === tipiModelle.length) return;
    setTipiModelle((prev) => {
      if (n < prev.length) return prev.slice(0, n);
      return [...prev, ...Array.from({ length: n - prev.length }, () => ({ tipo: "", mattina: false, pomeriggio: false, nome_modella: "", telefono_modella: "" }))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richiedeModelle, numeroModelle]);

  const corso = corsi.find((c) => c.id === corsoData.corso_id);
  const loc = location.find((l) => l.id === corsoData.location_id);
  const listaIscritti = iscritti.filter((i) => i.corso_data_id === corsoData.id);
  const max = postiMaxEffettivi(corsoData, corso, loc);
  const liberi = Math.max(0, max - listaIscritti.length);

  // "Da avere al corso" e le modelle sono gli unici importi incassati
  // fisicamente il giorno del corso (in contanti o via POS): acconto/pre
  // corso arrivano prima, con bonifico/sito, e non passano dalle mani
  // del master in aula — per questo il riepilogo costi si basa solo su
  // questi importi, non sul totale generale della classe
  const contantiClasse = round2(listaIscritti.reduce((s, i) => s + (i.saldo_metodo === "Contanti" ? (i.saldo_totale || 0) : 0) + modelleTotaleDi(i), 0));
  const posClasse = round2(listaIscritti.reduce((s, i) => s + (i.saldo_metodo === "Pos" ? (i.saldo_totale || 0) : 0), 0));
  const daIncassareClasse = round2(contantiClasse + posClasse);
  // la quota venditore di ogni iscritto è un costo della classe a tutti gli
  // effetti (va pagata al venditore): fa parte del totale costi anche prima
  // che l'amministratore compili qualunque altro campo del pannello
  const quoteVenditoreClasse = round2(listaIscritti.reduce((s, i) => s + (i.quota_venditore || 0), 0));
  const totaleCostiClasse = round2(
    quoteVenditoreClasse + parseNum(costoAccademia) + parseNum(costoMaster) + parseNum(costoAssistenti) +
    parseNum(costoPranzi) + parseNum(costoHotel) +
    costiExtra.reduce((s, c) => s + parseNum(c.valore), 0)
  );
  const risultatoClasse = round2(daIncassareClasse - totaleCostiClasse);

  function aggiungiVoceCosto() {
    setCostiExtra((prev) => [...prev, { titolo: "", valore: "" }]);
    setCostiAperto(true);
  }
  function modificaVoceCosto(idx, campo, valore) {
    setCostiExtra((prev) => prev.map((c, i) => (i === idx ? { ...c, [campo]: valore } : c)));
  }
  function rimuoviVoceCosto(idx) {
    setCostiExtra((prev) => prev.filter((_, i) => i !== idx));
  }
  async function salvaCostiClasse() {
    setSalvandoCosti(true);
    const { error } = await supabase.from("corsi_date").update({
      costo_accademia: costoAccademia === "" ? null : parseNum(costoAccademia),
      costo_master: costoMaster === "" ? null : parseNum(costoMaster),
      costo_assistenti: costoAssistenti === "" ? null : parseNum(costoAssistenti),
      costo_pranzi: costoPranzi === "" ? null : parseNum(costoPranzi),
      costo_hotel: costoHotel === "" ? null : parseNum(costoHotel),
      costi_extra: costiExtra.filter((c) => c.titolo.trim() !== "" || c.valore !== "").map((c) => ({ titolo: c.titolo.trim(), valore: parseNum(c.valore) })),
    }).eq("id", corsoData.id);
    setSalvandoCosti(false);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Costi salvati.");
    ricarica();
  }

  function apriGestioneClasse() {
    if (mostraGestione) { setMostraGestione(false); return; }
    if (adminSbloccato) { setMostraGestione(true); return; }
    const codice = window.prompt("Codice amministratore per aprire la contabilità classe:");
    if (codice === null) return;
    if (ADMIN_CODE && codice === ADMIN_CODE) {
      sessionStorage.setItem("edc_admin_ok", "1");
      setAdminSbloccato(true);
      setMostraGestione(true);
    } else {
      window.alert("Codice non corretto.");
    }
  }

  // disegna un testo su una pagina pdf-lib, convertendo la posizione da
  // percentuale (0-100, origine in alto a sinistra, come nell'editor
  // visivo di "Font Diplomi") a punti pdf (origine in basso a sinistra),
  // e l'allineamento in un offset orizzontale rispetto al punto ancorato
  function disegnaTestoDiploma(page, testo, { posX, posY, fontSize, colore, allineamento, font }) {
    if (!testo) return;
    const { width, height } = page.getSize();
    const larghezzaTesto = font.widthOfTextAtSize(testo, fontSize);
    const ancoraX = (posX / 100) * width;
    const x = allineamento === "left" ? ancoraX : allineamento === "right" ? ancoraX - larghezzaTesto : ancoraX - larghezzaTesto / 2;
    // approssimazione: la percentuale rappresenta il centro verticale del
    // testo, non la sua baseline — spostare di metà font size la
    // avvicina al centro reale senza bisogno di misure di ascent/descent
    const y = height - (posY / 100) * height - fontSize * 0.35;
    const { r, g, b } = hexInRgb01(colore);
    page.drawText(testo, { x, y, size: fontSize, font, color: rgb(r, g, b) });
  }

  async function stampaDiplomi() {
    if (!corso?.diploma_template_path) {
      window.alert('Nessun template diploma collegato a questo corso — impostalo da Impostazioni.');
      return;
    }
    if (listaIscritti.length === 0) {
      window.alert("Non ci sono iscritti in questa classe.");
      return;
    }
    setGenerandoDiplomi(true);
    try {
      // stesso motivo del merge in stampaSegnaposti: un campo mancante
      // (colonna nuova non ancora migrata su questo database) non deve
      // ripiegare su un valore che disattiva il limite in silenzio
      const config = { ...CONFIG_DIPLOMI_DEFAULT, ...(fontDiplomi || {}) };
      const masterCorso = corsoData.master_id ? (master || []).find((m) => m.id === corsoData.master_id) : null;
      const testoData = `${toTitleCase(loc?.nome || "")}, ${fmtData(corsoData.data_fine)}`;
      // tolto lo spazio tra nome e cognome: con un font firma corsivo il
      // testo deve scorrere come una firma vera, non con un vuoto in mezzo.
      // Se la master ha "diploma già firmato" attivo, firmerà a mano: il
      // campo firma resta vuoto, senza applicare nulla in automatico
      const testoFirma = masterCorso && !masterCorso.diploma_gia_firmato
        ? toTitleCase(masterCorso.nome).replace(/\s+/g, "")
        : "";

      const scaricaBytes = scaricaBytesStorage;

      const templateBytes = await scaricaBytes("diploma-templates", corso.diploma_template_path);
      const templateDoc = await PDFDocument.load(templateBytes);

      const outputPdf = await PDFDocument.create();
      outputPdf.registerFontkit(fontkit);

      // per ciascun font: se manca o non si riesce a caricare, ripiego su
      // Helvetica solo per quell'elemento, senza bloccare la stampa
      async function embedFontOFallback(percorso) {
        if (percorso) {
          try {
            const bytes = await scaricaBytes("diploma-fonts", percorso);
            return await outputPdf.embedFont(bytes);
          } catch { /* ripiego sotto */ }
        }
        return await outputPdf.embedFont(StandardFonts.Helvetica);
      }
      const fontNome = await embedFontOFallback(config.font_allievo_path);
      const fontData = await embedFontOFallback(config.font_data_path);
      const fontFirma = await embedFontOFallback(config.font_firma_path);

      // un iscritto con un'"eccezione diploma" assegnata (da Contabilità
      // classe) usa quel template al posto di quello del corso: si
      // scarica una sola volta per eccezione, anche se piu' iscritti la
      // condividono. Nome allievo e master restano quelli calcolati
      // normalmente: cambiano solo il template e/o la data
      const cacheDocEccezioni = new Map();
      async function docTemplatePer(iscritto) {
        const eccezione = iscritto.diploma_eccezione_id
          ? (diplomaEccezioni || []).find((d) => d.id === iscritto.diploma_eccezione_id)
          : null;
        if (!eccezione) return templateDoc;
        if (!cacheDocEccezioni.has(eccezione.id)) {
          const bytesEccezione = await scaricaBytes("diploma-templates", eccezione.file_path);
          cacheDocEccezioni.set(eccezione.id, await PDFDocument.load(bytesEccezione));
        }
        return cacheDocEccezioni.get(eccezione.id);
      }

      // se uno o più iscritti hanno "Ristampa solo questo" spuntato, il PDF
      // si genera solo per loro; altrimenti (nessuno flaggato) per tutti,
      // come sempre
      const flaggati = listaIscritti.filter((i) => i.ristampa_diploma);
      const iscrittiDaStampare = flaggati.length > 0 ? flaggati : listaIscritti;

      for (const iscritto of iscrittiDaStampare) {
        const docDaUsare = await docTemplatePer(iscritto);
        const [pagina] = await outputPdf.copyPages(docDaUsare, [0]);
        outputPdf.addPage(pagina);
        const { width: larghezzaPaginaDiploma } = pagina.getSize();

        const testoDataIscritto = iscritto.diploma_eccezione_data
          ? `${toTitleCase(loc?.nome || "")}, ${fmtData(iscritto.diploma_eccezione_data)}`
          : testoData;

        // solo il nome allievo è limitato dalle 2 linee di "Diploma di
        // riferimento": se supera quella larghezza si rimpicciolisce
        // solo per questo nome, non tocca città/data né firma. Il nome è
        // centrato su nome_pos_x: il lato più stretto rispetto alle due
        // linee è quello che vincola, raddoppiato dà la larghezza massima
        // (la sola distanza fissa tra le due linee sbaglierebbe ogni volta
        // che nome_pos_x non sta esattamente a metà strada tra le due)
        const testoNome = toTitleCase(`${iscritto.nome} ${iscritto.cognome}`);
        const spazioSxNome = (config.nome_pos_x - config.nome_limite_sx) / 100 * larghezzaPaginaDiploma;
        const spazioDxNome = (config.nome_limite_dx - config.nome_pos_x) / 100 * larghezzaPaginaDiploma;
        const larghezzaMaxNome = 2 * Math.min(spazioSxNome, spazioDxNome);
        let nomeFontSize = config.nome_font_size;
        if (larghezzaMaxNome > 0) {
          const larghezzaTestoNome = fontNome.widthOfTextAtSize(testoNome, nomeFontSize);
          if (larghezzaTestoNome > larghezzaMaxNome) nomeFontSize = Math.max(6, (larghezzaMaxNome / larghezzaTestoNome) * nomeFontSize);
        }
        disegnaTestoDiploma(pagina, testoNome, {
          posX: config.nome_pos_x, posY: config.nome_pos_y, fontSize: nomeFontSize,
          colore: config.nome_colore, allineamento: config.nome_allineamento, font: fontNome,
        });
        disegnaTestoDiploma(pagina, testoDataIscritto, {
          posX: config.data_pos_x, posY: config.data_pos_y, fontSize: config.data_font_size,
          colore: config.data_colore, allineamento: config.data_allineamento, font: fontData,
        });
        if (testoFirma) {
          disegnaTestoDiploma(pagina, testoFirma, {
            posX: config.firma_pos_x, posY: config.firma_pos_y, fontSize: config.firma_font_size,
            colore: config.firma_colore, allineamento: config.firma_allineamento, font: fontFirma,
          });
        }
      }

      const bytesFinali = await outputPdf.save();
      const blob = new Blob([bytesFinali], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diplomi-${slugify(corso.nome)}-${corsoData.data_fine}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert("Errore nella generazione dei diplomi: " + e.message);
    } finally {
      setGenerandoDiplomi(false);
    }
  }

  // stampa i segnaposti (nome allievo) per tutti gli iscritti di questa
  // classe: usa direttamente il foglio "Segnaposti di riferimento"
  // caricato in Setting diplomi come vero e proprio template di stampa
  // (a differenza dei diplomi, qui non c'è un template diverso per ogni
  // corso). Se gli iscritti superano i posti di una pagina, se ne
  // generano altre, ripartendo dal primo posto della griglia
  async function stampaSegnaposti() {
    // se la riga esiste ma manca ancora qualche colonna nuova (es.
    // limite_sx_pos_x/limite_dx_pos_x, appena aggiunte e non ancora
    // eseguite su questo database), il campo mancante non deve
    // "spegnere" il limite tornando a 0/100 (praticamente nessun
    // limite): meglio ripiegare sul valore di default vero e proprio
    const cfg = { ...CONFIG_SEGNAPOSTI_DEFAULT, ...(segnaposti || {}) };
    if (!cfg.riferimento_path) {
      window.alert('Nessun foglio segnaposti di riferimento caricato — impostalo da Setting diplomi.');
      return;
    }
    if (listaIscritti.length === 0) {
      window.alert("Non ci sono iscritti in questa classe.");
      return;
    }
    setGenerandoSegnaposti(true);
    try {
      const templateBytes = await scaricaBytesStorage("diploma-templates", cfg.riferimento_path);
      const templateDoc = await PDFDocument.load(templateBytes);

      const outputPdf = await PDFDocument.create();
      outputPdf.registerFontkit(fontkit);
      let font = null;
      if (cfg.font_path) {
        try {
          const bytesFont = await scaricaBytesStorage("diploma-fonts", cfg.font_path);
          font = await outputPdf.embedFont(bytesFont);
        } catch { /* ripiego sotto */ }
      }
      if (!font) font = await outputPdf.embedFont(StandardFonts.Helvetica);

      // stesso comportamento di "Ristampa solo questo" nei diplomi: se
      // qualcuno è flaggato, il foglio segnaposti si genera solo per lui
      const flaggati = listaIscritti.filter((i) => i.ristampa_diploma);
      const iscrittiDaStampare = flaggati.length > 0 ? flaggati : listaIscritti;
      const testi = testiSegnaposto(listaIscritti);

      for (let inizio = 0; inizio < iscrittiDaStampare.length; inizio += POSTI_PER_PAGINA_SEGNAPOSTI) {
        const gruppo = iscrittiDaStampare.slice(inizio, inizio + POSTI_PER_PAGINA_SEGNAPOSTI);
        const [pagina] = await outputPdf.copyPages(templateDoc, [0]);
        outputPdf.addPage(pagina);
        const { width: larghezzaPagina, height: altezzaPagina } = pagina.getSize();
        // il nome si stampa sempre centrato esattamente a metà strada tra
        // le due linee di limite (non nella posizione X di ogni singolo
        // posto, che conta solo in verticale): così la larghezza massima è
        // semplicemente la distanza tra le due linee, senza calcoli
        // asimmetrici, e non può mai sforare né a sinistra né a destra
        const posX = (cfg.limite_sx_pos_x + cfg.limite_dx_pos_x) / 2;
        const larghezzaMax = Math.abs(cfg.limite_dx_pos_x - cfg.limite_sx_pos_x) / 100 * larghezzaPagina;
        // riduce fontSizeBase finché "testoRiga" non entra nel limite,
        // poi lo disegna: usata sia per un nome su una riga sola sia per
        // ciascuna delle due righe quando il nome viene spezzato
        function disegnaRigaConLimite(testoRiga, posY, fontSizeBase) {
          let fontSize = fontSizeBase;
          if (larghezzaMax > 0) {
            const larghezzaTesto = font.widthOfTextAtSize(testoRiga, fontSize);
            if (larghezzaTesto > larghezzaMax) fontSize = Math.max(6, (larghezzaMax / larghezzaTesto) * fontSize);
          }
          disegnaTestoDiploma(pagina, testoRiga, {
            posX, posY, fontSize, colore: cfg.colore, allineamento: "center", font,
          });
        }
        gruppo.forEach((iscritto, idx) => {
          const slot = SLOT_SEGNAPOSTI[idx];
          const posY = cfg[`${slot.chiave}_pos_y`];
          const testo = testi.get(iscritto.id);
          const parole = testo.trim().split(/\s+/);
          // un nome composto da più parole (es. "GIANFRANCA ANTONELLA") che
          // ci sta su una riga sola resta su una riga sola; solo se non ci
          // sta si spezza su 2 righe (una parola sopra, il resto sotto)
          // invece di rimpicciolire il font più del necessario
          const staSuUnaRiga = larghezzaMax <= 0 || parole.length < 2 || font.widthOfTextAtSize(testo, cfg.font_size) <= larghezzaMax;
          if (staSuUnaRiga) {
            disegnaRigaConLimite(testo, posY, cfg.font_size);
          } else {
            // spezzando su 2 righe, ciascuna parola da sola ha di nuovo
            // tutto lo spazio necessario: si scrive alla stessa dimensione
            // usata per un nome su una riga sola, senza rimpicciolire, e le
            // due righe restano vicine (poco più della metà di una riga
            // sopra e sotto la posizione del posto, non un'intera riga)
            const scostamentoPercento = ((cfg.font_size * 0.42) / altezzaPagina) * 100;
            disegnaTestoDiploma(pagina, parole[0], {
              posX, posY: posY - scostamentoPercento, fontSize: cfg.font_size, colore: cfg.colore, allineamento: "center", font,
            });
            disegnaTestoDiploma(pagina, parole.slice(1).join(" "), {
              posX, posY: posY + scostamentoPercento, fontSize: cfg.font_size, colore: cfg.colore, allineamento: "center", font,
            });
          }
        });
      }

      const bytesFinali = await outputPdf.save();
      const blob = new Blob([bytesFinali], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `segnaposti-${slugify(corso.nome)}-${corsoData.data_fine}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert("Errore nella generazione dei segnaposti: " + e.message);
    } finally {
      setGenerandoSegnaposti(false);
    }
  }

  // carica un file nello storage "allegati-iscritti" e restituisce il percorso salvato
  async function caricaAllegato(file, prefisso) {
    if (!file) return null;
    const percorso = `${corsoData.id}/${prefisso}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file);
    if (error) throw error;
    return percorso;
  }

  function resetCampi() {
    setNome(""); setCognome(""); setNote(""); setTutor(""); setTelefono(""); setVecchiaIscrizione(false);
    setPagAcconto(QUOTA_VUOTA); setPagPrecorso(QUOTA_VUOTA); setPagSaldo(QUOTA_VUOTA);
    setAccordiCommerciali(""); setRichiedeModelle(""); setNumeroModelle(""); setPrezzoSpecialeModelle(""); setTipiModelle([]); setTotalePattuito(""); setQuotaSpeciale("");
    setPacchettoKit(""); setTagliaDivisa("");
    setFileIscrizione(null); setFileScreenAcconto(null); setFileScreenRecap(null);
  }

  function apriIscrizione() {
    resetCampi();
    setModificandoId(null);
    setMsg("");
    setVista("form");
  }

  function apriModificaCompleta(i) {
    setNome(i.nome); setCognome(i.cognome); setNote(i.note || "");
    setTutor(i.tutor || ""); setTelefono(i.telefono || "");
    setVecchiaIscrizione(i.vecchia_iscrizione === true);
    setPagAcconto({
      imponibile: i.acconto_imponibile != null ? String(i.acconto_imponibile) : "",
      totale: i.acconto_totale != null ? String(i.acconto_totale) : "",
      metodo: i.acconto_metodo || "",
      interessi: i.acconto_interessi != null ? String(i.acconto_interessi) : "",
    });
    setPagPrecorso({
      imponibile: i.precorso_imponibile != null ? String(i.precorso_imponibile) : "",
      totale: i.precorso_totale != null ? String(i.precorso_totale) : "",
      metodo: i.precorso_metodo || "",
      interessi: i.precorso_interessi != null ? String(i.precorso_interessi) : "",
    });
    setPagSaldo({
      imponibile: i.saldo_imponibile != null ? String(i.saldo_imponibile) : "",
      totale: i.saldo_totale != null ? String(i.saldo_totale) : "",
      metodo: i.saldo_metodo || "",
    });
    setAccordiCommerciali(i.accordi_commerciali || "");
    setRichiedeModelle(i.richiede_modelle === true ? "si" : i.richiede_modelle === false ? "no" : "");
    setNumeroModelle(i.numero_modelle != null ? String(i.numero_modelle) : "");
    setPrezzoSpecialeModelle(i.prezzo_speciale_modelle != null ? String(i.prezzo_speciale_modelle) : "");
    setTipiModelle(Array.isArray(i.tipi_modelle) ? i.tipi_modelle.map((m) => ({ tipo: m.tipo || "", mattina: !!m.mattina, pomeriggio: !!m.pomeriggio, nome_modella: m.nome_modella || "", telefono_modella: m.telefono_modella || "" })) : []);
    setPacchettoKit(i.pacchetto_kit || "");
    setTagliaDivisa(i.taglia_divisa || "");
    setTotalePattuito(i.totale_pattuito != null ? String(i.totale_pattuito) : "");
    setQuotaSpeciale(i.quota_speciale != null ? String(i.quota_speciale) : "");
    setFileIscrizione(null); setFileScreenAcconto(null); setFileScreenRecap(null);
    setModificandoId(i.id);
    setMsg("");
    setVista("form");
  }

  function annullaForm() {
    resetCampi();
    setModificandoId(null);
    setMsg("");
    setVista("lista");
  }

  // salva i dati correnti del form sul database. Restituisce true se riuscito.
  // Non naviga da nessuna parte: la usano sia il pulsante "Salva"/"Aggiungi"
  // sia il salvataggio automatico quando si esce da un campo.
  // "strict" richiede tutti i campi anagrafici/vendita compilati: si applica
  // solo quando si crea un nuovo iscritto, mai quando se ne modifica uno già
  // esistente, altrimenti un campo mancante da prima (es. taglia divisa mai
  // compilata) bloccherebbe in silenzio ogni futuro salvataggio automatico.
  async function persistiIscritto(strict = !modificandoId) {
    if (!nome.trim() || !cognome.trim()) { setMsg("Inserisci nome e cognome."); return false; }
    if (!modificandoId && liberi <= 0) { setMsg("Nessun posto disponibile su questa data."); return false; }

    const metodiMancanti = [];
    if (pagAcconto.totale !== "" && parseNum(pagAcconto.totale) !== 0 && !pagAcconto.metodo) metodiMancanti.push("quota acconto");
    if (pagPrecorso.totale !== "" && parseNum(pagPrecorso.totale) !== 0 && !pagPrecorso.metodo) metodiMancanti.push("quota pre corso");
    if (pagSaldo.totale !== "" && parseNum(pagSaldo.totale) !== 0 && !pagSaldo.metodo) metodiMancanti.push("da avere al corso");

    const altriMancanti = [];
    if (strict) {
      if (totalePattuito === "") altriMancanti.push("totale pattuito");
      if (pagAcconto.totale === "") altriMancanti.push("quota acconto");
      if (!pacchettoKit.trim()) altriMancanti.push("pacchetto/kit");
      if (!tutor.trim()) altriMancanti.push("tutor");
      if (!telefono.trim()) altriMancanti.push("numero di telefono");
      if (!tagliaDivisa) altriMancanti.push("taglia divisa");
    }

    if (metodiMancanti.length > 0 || altriMancanti.length > 0) {
      const parti = [];
      if (metodiMancanti.length > 0) parti.push(`manca metodo di pagamento ${metodiMancanti.join(", oppure ")}`);
      altriMancanti.forEach((campo) => parti.push(`manca ${campo}`));
      setMsg("Impossibile salvare: " + parti.join(". ") + ".");
      return false;
    }

    setCaricando(true);
    try {
      const originale = modificandoId ? iscritti.find((x) => x.id === modificandoId) : null;
      const [pathIscrizione, pathAcconto, pathRecap] = await Promise.all([
        fileIscrizione ? caricaAllegato(fileIscrizione, "modulo") : Promise.resolve(originale?.file_iscrizione ?? null),
        fileScreenAcconto ? caricaAllegato(fileScreenAcconto, "acconto") : Promise.resolve(originale?.file_screen_acconto ?? null),
        fileScreenRecap ? caricaAllegato(fileScreenRecap, "recap") : Promise.resolve(originale?.file_screen_recap ?? null),
      ]);
      const payload = {
        nome: nome.trim(),
        cognome: cognome.trim(),
        note: note.trim() || null,
        tutor: tutor.trim() || null,
        telefono: telefono.trim() || null,
        vecchia_iscrizione: vecchiaIscrizione,
        acconto_imponibile: pagAcconto.imponibile === "" ? null : parseNum(pagAcconto.imponibile),
        acconto_totale: pagAcconto.totale === "" ? null : parseNum(pagAcconto.totale),
        acconto_metodo: pagAcconto.metodo || null,
        acconto_interessi: pagAcconto.metodo === "Rate" && pagAcconto.interessi !== "" ? parseNum(pagAcconto.interessi) : null,
        precorso_imponibile: pagPrecorso.imponibile === "" ? null : parseNum(pagPrecorso.imponibile),
        precorso_totale: pagPrecorso.totale === "" ? null : parseNum(pagPrecorso.totale),
        precorso_metodo: pagPrecorso.metodo || null,
        precorso_interessi: pagPrecorso.metodo === "Rate" && pagPrecorso.interessi !== "" ? parseNum(pagPrecorso.interessi) : null,
        saldo_imponibile: pagSaldo.imponibile === "" ? null : parseNum(pagSaldo.imponibile),
        saldo_totale: pagSaldo.totale === "" ? null : parseNum(pagSaldo.totale),
        saldo_metodo: pagSaldo.metodo || null,
        accordi_commerciali: accordiCommerciali.trim() || null,
        richiede_modelle: richiedeModelle === "" ? null : richiedeModelle === "si",
        numero_modelle: richiedeModelle === "si" && numeroModelle !== "" ? parseInt(numeroModelle, 10) : null,
        prezzo_speciale_modelle: richiedeModelle === "si" && prezzoSpecialeModelle !== "" ? parseNum(prezzoSpecialeModelle) : null,
        tipi_modelle: richiedeModelle === "si" ? tipiModelle.map((m) => ({ tipo: m.tipo || "", mattina: !!m.mattina, pomeriggio: !!m.pomeriggio, nome_modella: m.nome_modella || "", telefono_modella: m.telefono_modella || "" })) : [],
        pacchetto_kit: pacchettoKit.trim() || null,
        taglia_divisa: tagliaDivisa || null,
        totale_pattuito: totalePattuito === "" ? null : parseNum(totalePattuito),
        quota_speciale: quotaSpeciale === "" ? null : parseNum(quotaSpeciale),
        // se compilata, la quota speciale sostituisce ovunque la quota venditore
        // calcolata al 7%: è quest'unico campo che viene letto in tutta l'app
        quota_venditore: quotaSpeciale !== "" ? parseNum(quotaSpeciale) : (totalePattuito === "" ? null : quotaVenditoreDi(totalePattuito)),
        file_iscrizione: pathIscrizione,
        file_screen_acconto: pathAcconto,
        file_screen_recap: pathRecap,
      };
      let error, nuovoId;
      if (modificandoId) {
        ({ error } = await supabase.from("iscritti").update(payload).eq("id", modificandoId));
      } else {
        payload.corso_data_id = corsoData.id;
        const ins = await supabase.from("iscritti").insert(payload).select("id").single();
        error = ins.error;
        nuovoId = ins.data?.id;
      }
      if (error) { setMsg("Errore: " + error.message); return false; }
      if (nuovoId) setModificandoId(nuovoId); // da qui in poi i campi successivi si autosalvano sullo stesso iscritto
      ricarica();
      return true;
    } catch (e) {
      setMsg("Errore nel caricamento allegati: " + e.message);
      return false;
    } finally {
      setCaricando(false);
    }
  }

  // salvataggio automatico: usato quando si esce da un campo (onBlur) o si
  // cambia un metodo/radio, solo se si sta già modificando un iscritto esistente
  async function autosalva() {
    if (!modificandoId) return; // un iscritto nuovo va prima creato col pulsante
    if (!nome.trim() || !cognome.trim()) return; // non salvare stati incompleti
    const ok = await persistiIscritto();
    if (ok) setMsg("Salvato.");
  }

  // legge il modulo di iscrizione PDF appena caricato e compila da solo tutor,
  // nome, cognome, telefono, metodo/importo dell'acconto e taglia divisa —
  // solo nei campi ancora vuoti, per non sovrascrivere dati già inseriti a mano
  // applica i dati letti dal modulo ai campi del form. Con sovrascrivi=false
  // (comportamento di sempre, al solo caricamento del file) tocca solo i
  // campi ancora vuoti; con sovrascrivi=true (pulsante "Leggi dati dal
  // modulo", scelta esplicita dell'utente) sostituisce anche quelli già
  // compilati a mano
  function applicaDatiModulo(dati, sovrascrivi) {
    const salta = (giaCompilato) => !sovrascrivi && giaCompilato;
    if (dati.tutor && !salta(tutor.trim())) setTutor(dati.tutor.toUpperCase());
    if (dati.nome && !salta(nome.trim())) setNome(dati.nome.toUpperCase());
    if (dati.cognome && !salta(cognome.trim())) setCognome(dati.cognome.toUpperCase());
    if (dati.telefono && !salta(telefono.trim())) setTelefono(dati.telefono.toUpperCase());

    if (dati.tagliaDivisa && !salta(tagliaDivisa)) {
      const taglia = ["NO DIVISA", "XS", "S", "M", "L", "XL", "XXL", "XXXL"].find((t) => t.toLowerCase() === dati.tagliaDivisa.toLowerCase());
      if (taglia) setTagliaDivisa(taglia);
    }

    if (dati.tipoCorso && !salta(pacchettoKit.trim())) setPacchettoKit(dati.tipoCorso.toUpperCase());

    if (dati.tipoPagamentoSaldo && !salta(accordiCommerciali.trim())) setAccordiCommerciali(dati.tipoPagamentoSaldo.toUpperCase());

    if (dati.scelteModelle && !salta(richiedeModelle !== "")) {
      const testoModelle = dati.scelteModelle.toLowerCase();
      if (testoModelle.includes("cercherò io") || testoModelle.includes("cerchero io")) setRichiedeModelle("no");
    }

    if ((dati.accontoMetodo || dati.accontoImporto) && !salta(pagAcconto.totale !== "")) {
      const metodo = ["Sito", "Bonifico", "Pos", "Contanti", "Rate"].find((m) => m.toLowerCase() === (dati.accontoMetodo || "").toLowerCase());
      setPagAcconto((prev) => {
        let next = metodo ? { ...prev, metodo } : prev;
        if (dati.accontoImporto) next = conTotaleAggiornato(next, dati.accontoImporto.replace(",", "."), true);
        return next;
      });
    }
  }

  // il caricamento del file NON legge più i dati in automatico: si limita a
  // salvare il file scelto. La lettura avviene solo premendo esplicitamente
  // "Leggi dati dal modulo" (rileggiModuloForzato)
  function gestisciFileModulo(file) {
    setFileIscrizione(file);
  }

  // pulsante esplicito "Leggi dati dal modulo": a differenza della lettura
  // automatica al caricamento (che tocca solo i campi vuoti), qui l'utente
  // sceglie consapevolmente di rileggere il PDF e sovrascrivere anche i
  // campi già compilati a mano — da qui l'avviso prima di procedere
  async function rileggiModuloForzato() {
    if (!fileIscrizione) { setMsg("Carica prima il modulo PDF."); return; }
    if (!window.confirm("Vuoi leggere i dati dal modulo caricato? La lettura sovrascriverà i dati eventualmente già inseriti a mano.")) return;
    try {
      const dati = await estraiDatiModuloPdf(fileIscrizione);
      if (!dati) { setMsg("Non ho trovato i dati attesi nel modulo PDF: da compilare a mano."); return; }
      applicaDatiModulo(dati, true);
      setMsg("Dati letti dal modulo PDF e inseriti nel form (sovrascritti): controllali prima di salvare.");
    } catch (e) {
      setMsg("Non sono riuscito a leggere automaticamente questo modulo PDF: da compilare a mano.");
    }
  }

  async function salvaIscritto() {
    const ok = await persistiIscritto();
    if (!ok) return;
    setMsg(modificandoId ? "Iscritto aggiornato." : "Iscritto aggiunto.");
    resetCampi();
    setModificandoId(null);
    setVista("lista");
  }

  async function elimina(id) {
    if (!window.confirm("Sei sicuro di voler cancellare in modo definitivo l'allievo?")) return;
    const { error } = await supabase.from("iscritti").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  function generaLinkMaster() {
    const [aaaa, mm, gg] = corsoData.data_inizio.split("-");
    const dataLeggibile = `${gg}-${mm}-${aaaa}`;
    const leggibile = [slugify(corso?.nome), slugify(loc?.nome), dataLeggibile].filter(Boolean).join("/");
    const url = `${window.location.origin}${window.location.pathname}?master=${leggibile}`;
    setLinkMaster(url);
  }

  async function copiaLinkMaster() {
    try {
      await navigator.clipboard.writeText(linkMaster);
      setMsg("Link copiato.");
    } catch (e) {
      setMsg("Seleziona e copia il link qui sopra.");
    }
  }

  function generaLinkModelle() {
    const [aaaa, mm, gg] = corsoData.data_inizio.split("-");
    const dataLeggibile = `${gg}-${mm}-${aaaa}`;
    const leggibile = [slugify(corso?.nome), slugify(loc?.nome), dataLeggibile].filter(Boolean).join("/");
    const url = `${window.location.origin}${window.location.pathname}?modelle=${leggibile}`;
    setLinkModelle(url);
  }

  async function copiaLinkModelle() {
    try {
      await navigator.clipboard.writeText(linkModelle);
      setMsg("Link copiato.");
    } catch (e) {
      setMsg("Seleziona e copia il link qui sopra.");
    }
  }

  // flagga/sflagga mattina o pomeriggio per una singola modella di un
  // iscritto: si salva subito, niente tasto "Salva" separato
  async function aggiornaModellaSlot(iscrittoId, idx, campo, valore) {
    const iscritto = listaIscritti.find((x) => x.id === iscrittoId);
    if (!iscritto) return;
    const nuovoElenco = (iscritto.tipi_modelle || []).map((m, i) => (i === idx ? { ...m, [campo]: valore } : m));
    const { error } = await supabase.from("iscritti").update({ tipi_modelle: nuovoElenco }).eq("id", iscrittoId);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function toggleIncassato(i) {
    const { error } = await supabase.from("iscritti").update({ incassato: !i.incassato }).eq("id", i.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function toggleRicontattato(i) {
    const { error } = await supabase.from("iscritti").update({ ricontattato: !i.ricontattato }).eq("id", i.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  // se uno o più iscritti hanno questa casella spuntata, "Stampa diplomi"
  // genera il PDF solo per loro invece che per tutta la classe
  async function toggleRistampaDiploma(i) {
    const { error } = await supabase.from("iscritti").update({ ristampa_diploma: !i.ristampa_diploma }).eq("id", i.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function salvaNotaRicontatto(id, valore) {
    const { error } = await supabase.from("iscritti").update({ note_ricontatto: valore.trim() || null }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  // eccezione diploma: sostituisce, solo per questo iscritto, il template
  // del corso e/o la data mostrata sul diploma stampato — nome allievo e
  // master restano quelli calcolati normalmente
  async function impostaEccezioneDiploma(id, eccezioneId) {
    const { error } = await supabase.from("iscritti").update({ diploma_eccezione_id: eccezioneId || null }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }
  async function impostaEccezioneData(id, data) {
    const { error } = await supabase.from("iscritti").update({ diploma_eccezione_data: data || null }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }
  async function rimuoviEccezioneDiploma(id) {
    const { error } = await supabase.from("iscritti").update({ diploma_eccezione_id: null, diploma_eccezione_data: null }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function eseguiSpostamento(iscritto, cdTarget, corsoTarget, locTarget) {
    const etichetta = cdTarget.data_inizio === cdTarget.data_fine ? fmtData(cdTarget.data_inizio) : `${fmtData(cdTarget.data_inizio)} → ${fmtData(cdTarget.data_fine)}`;
    if (!window.confirm(`Spostare ${iscritto.nome.toUpperCase()} ${iscritto.cognome.toUpperCase()} su ${corsoTarget?.nome || "?"} · ${locTarget?.nome || "?"} · ${etichetta}?`)) return;
    const { error } = await supabase.from("iscritti").update({ corso_data_id: cdTarget.id }).eq("id", iscritto.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setSpostaIscrittoId(null);
    setMsg("Iscritto spostato.");
    ricarica();
  }

  const msgErrore = msg && (msg.startsWith("Errore") || msg.startsWith("Impossibile salvare")) ? msg : null;
  // un venditore può aprire la scheda di un iscritto già registrato solo
  // per consultarla: la modifica vera e propria richiede il codice
  // amministratore (lo stesso condiviso con Setting/Statistiche/
  // Contabilità classe — adminSbloccato riflette lo sblocco valido per
  // l'intera sessione, non solo la vista "Contabilità classe" di questa
  // singola classe)
  const soloLettura = !!(modificandoId && !adminSbloccato);

  // riga "etichetta / importo / metodo" della sezione Pagamenti: da
  // desktop importo e metodo restano in due colonne fisse (allineate
  // riga per riga e scheda per scheda); da mobile non c'è spazio per 3
  // colonne, quindi importo e metodo vanno appaiati sulla stessa riga
  // sotto l'etichetta
  function rigaPagamento(label, valore, metodo) {
    if (isMobile) {
      return (
        <>
          <div style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY }}>{label}</div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 10, paddingBottom: 10 }}>
            <span style={{ minWidth: 0, fontWeight: 700, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{valore}</span>
            <span style={{ minWidth: 0, color: NAVY, whiteSpace: "normal", wordBreak: "break-word", textAlign: "right" }}>{metodo}</span>
          </div>
        </>
      );
    }
    return (
      <>
        <div style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY }}>{label}</div>
        <div style={{ minWidth: 0, padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, fontWeight: 700, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{valore}</div>
        <div style={{ minWidth: 0, padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{metodo}</div>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      {msgErrore && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
          <div style={{ ...cardStyle, maxWidth: 360, width: "100%", marginBottom: 0, textAlign: "center" }}>
            <div style={{ ...fontBody, fontSize: 15, color: NAVY, marginBottom: 18 }}>{msgErrore}</div>
            <Button onClick={() => setMsg("")} style={{ width: "100%" }}>OK</Button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, letterSpacing: 0.3 }}>{(corso?.nome || "").toUpperCase()}</div>
        {loc?.nome && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: BG_CHIARO, border: `1px solid ${GOLD}`, borderRadius: 20, padding: "6px 14px" }}>
            <IconaPin size={14} />
            <span style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.3 }}>{loc.nome}</span>
          </div>
        )}
      </div>
      {(() => {
        const celleIntestazione = [
          {
            chiave: "date", Icona: IconaDataAccento, label: "Date",
            valore: fmtIntervalloEsteso(corsoData.data_inizio, corsoData.data_fine),
          },
          corsoData.master_id && {
            chiave: "master", Icona: IconaMasterAccento, label: "Master",
            valore: (master || []).find((m) => m.id === corsoData.master_id)?.nome?.toUpperCase() || "?",
          },
          { chiave: "disponibilita", Icona: IconaDisponibilitaAccento, label: "Disponibilità", valore: `${liberi} posti liberi su ${max}` },
        ].filter(Boolean);
        return (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${celleIntestazione.length}, 1fr)`, gap: 14 }}>
              {celleIntestazione.map(({ chiave, Icona, label, valore }, idx) => (
                <div key={chiave} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, paddingLeft: idx > 0 ? 14 : 0, borderLeft: idx > 0 ? `1px solid ${CREAM_BORDER}` : "none" }}>
                  <Icona size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</div>
                    <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{valore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        {vista === "lista" ? (
          <div style={{ display: "flex", background: "#E3DCC9", borderRadius: 30, padding: 4, gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={apriGestioneClasse}
              style={{ ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26, padding: "10px 14px", fontWeight: 600, color: NAVY, cursor: "pointer", overflow: "hidden" }}
            >
              <EtichettaAdattiva testo={mostraGestione ? "Esci da contabilità" : "Contabilità classe"} />
            </button>
            {mostraGestione && (
              <button
                onClick={stampaDiplomi}
                disabled={generandoDiplomi}
                style={{ ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26, padding: "10px 14px", fontWeight: 600, color: NAVY, cursor: generandoDiplomi ? "default" : "pointer", opacity: generandoDiplomi ? 0.5 : 1, overflow: "hidden" }}
              >
                <EtichettaAdattiva testo={generandoDiplomi ? "Genero i diplomi…" : "Stampa diplomi"} />
              </button>
            )}
            {mostraGestione && (
              <button
                onClick={stampaSegnaposti}
                disabled={generandoSegnaposti}
                style={{ ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26, padding: "10px 14px", fontWeight: 600, color: NAVY, cursor: generandoSegnaposti ? "default" : "pointer", opacity: generandoSegnaposti ? 0.5 : 1, overflow: "hidden" }}
              >
                <EtichettaAdattiva testo={generandoSegnaposti ? "Genero i segnaposti…" : "Stampa Segnaposto"} />
              </button>
            )}
            {mostraGestione && (
              <button
                onClick={() => setVista("modelle")}
                style={{ ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26, padding: "10px 14px", fontWeight: 600, color: NAVY, cursor: "pointer", overflow: "hidden" }}
              >
                <EtichettaAdattiva testo="Assegna modelle" />
              </button>
            )}
            {!mostraGestione && (
              <button
                onClick={apriIscrizione}
                disabled={liberi <= 0}
                title={liberi <= 0 ? "Nessun posto disponibile" : ""}
                style={{ ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26, padding: "10px 14px", fontWeight: 600, color: NAVY, cursor: liberi <= 0 ? "default" : "pointer", opacity: liberi <= 0 ? 0.5 : 1, overflow: "hidden" }}
              >
                <EtichettaAdattiva testo={liberi <= 0 ? "Completo" : "Iscrivi"} />
              </button>
            )}
          </div>
        ) : (
          <Button variant="ghost" onClick={annullaForm}>&larr; Torna alla lista</Button>
        )}
      </div>

      {vista === "lista" && mostraGestione && (
        <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY, textAlign: "center", textTransform: "uppercase", letterSpacing: 1, marginBottom: 18 }}>
          Contabilità classe
        </div>
      )}

      {vista === "lista" && mostraGestione && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div
            onClick={() => setCostiAperto((v) => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 20px", cursor: "pointer" }}
          >
            <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>Riepilogo amministrativo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {costiAperto && (
                <button
                  title="Aggiungi voce di costo"
                  onClick={(e) => { e.stopPropagation(); aggiungiVoceCosto(); }}
                  style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
                >
                  +
                </button>
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: costiAperto ? "rotate(180deg)" : "none" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {costiAperto && (
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: BG_CHIARO, display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}><IconaPortafoglio /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>Totale da incassare</div>
                    <div style={{ ...fontBody, fontSize: 20, fontWeight: 700, color: NAVY }}>€ {daIncassareClasse}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: BG_CHIARO, display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}><IconaBanconota /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Contanti</div>
                    <div style={{ ...fontBody, fontSize: 20, fontWeight: 700, color: NAVY }}>€ {contantiClasse}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: BG_CHIARO, display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}><IconaCartaPos /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Pos</div>
                    <div style={{ ...fontBody, fontSize: 20, fontWeight: 700, color: NAVY }}>€ {posClasse}</div>
                  </div>
                </div>
              </div>

              <div style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Costi della classe</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0 14px" }}>
                <Field label="Costo accademia"><input style={inputStyle} inputMode="decimal" value={costoAccademia} onChange={(e) => setCostoAccademia(e.target.value)} /></Field>
                <Field label="Costo master"><input style={inputStyle} inputMode="decimal" value={costoMaster} onChange={(e) => setCostoMaster(e.target.value)} /></Field>
                <Field label="Costo assistenti"><input style={inputStyle} inputMode="decimal" value={costoAssistenti} onChange={(e) => setCostoAssistenti(e.target.value)} /></Field>
                <Field label="Costo pranzi"><input style={inputStyle} inputMode="decimal" value={costoPranzi} onChange={(e) => setCostoPranzi(e.target.value)} /></Field>
                <Field label="Costo hotel"><input style={inputStyle} inputMode="decimal" value={costoHotel} onChange={(e) => setCostoHotel(e.target.value)} /></Field>
              </div>

              {costiExtra.map((voce, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: "2 1 140px", minWidth: 0 }}>
                    <Field label="Voce di costo"><input style={{ ...inputStyle, textTransform: "uppercase" }} placeholder="Titolo" value={voce.titolo} onChange={(e) => modificaVoceCosto(idx, "titolo", e.target.value.toUpperCase())} /></Field>
                  </div>
                  <div style={{ flex: "1 1 90px", minWidth: 0 }}>
                    <Field label="Importo"><input style={inputStyle} inputMode="decimal" value={voce.valore} onChange={(e) => modificaVoceCosto(idx, "valore", e.target.value)} /></Field>
                  </div>
                  <button
                    onClick={() => rimuoviVoceCosto(idx)}
                    title="Rimuovi voce"
                    style={{ width: 38, height: 38, marginBottom: 14, borderRadius: 8, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: "#C0392B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, paddingTop: 16, marginTop: 6, borderTop: `1px solid ${CREAM_BORDER}` }}>
                <div>
                  <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Totale costi</div>
                  <div style={{ ...fontBody, fontSize: 20, fontWeight: 700, color: NAVY }}>€ {totaleCostiClasse}</div>
                </div>
                <div>
                  <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Risultato classe</div>
                  <div style={{ ...fontBody, fontSize: 20, fontWeight: 700, color: risultatoClasse < 0 ? "#C0392B" : NAVY }}>€ {risultatoClasse}</div>
                </div>
                <Button onClick={salvaCostiClasse} disabled={salvandoCosti}>{salvandoCosti ? "Salvo…" : "Salva costi"}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {vista === "form" && (
        <div
          style={cardStyle}
          onBlur={(e) => {
            // se il focus sta passando a un bottone (es. proprio "Fatto,
            // torna alla lista"), non serve il salvataggio automatico qui:
            // quel bottone fa già il suo salvataggio completo. Altrimenti
            // il blur del campo appena lasciato parte per primo, disabilita
            // il bottone mentre salva, e il click sullo stesso bottone (che
            // nel frattempo è disabled) non scatta: serve un secondo click
            if (modificandoId && !soloLettura && !(e.relatedTarget && e.relatedTarget.tagName === "BUTTON")) autosalva();
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={hStyle}>{soloLettura ? "Scheda iscritto" : modificandoId ? "Modifica iscritto" : "Iscrivi allievo"}</div>
            {adminSbloccato && !soloLettura && (
              <label
                title="L'iscrizione non compare tra le iscrizioni/statistiche di oggi: finisce nell'elenco Statistiche → Ultime iscrizioni → Mesi precedenti"
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 12, color: MUTED }}
              >
                <input type="checkbox" checked={vecchiaIscrizione} onChange={(e) => setVecchiaIscrizione(e.target.checked)} style={{ width: 16, height: 16 }} />
                Vecchia iscrizione
              </label>
            )}
          </div>
          {soloLettura ? (
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 14 }}>
              Sola visualizzazione: per modificare i dati serve aprire "Contabilità classe".
            </div>
          ) : modificandoId && (
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 14 }}>
              Le modifiche si salvano da sole appena esci da un campo — non serve premere alcun pulsante per ogni singola modifica.
            </div>
          )}

          <fieldset disabled={soloLettura} style={{ border: "none", padding: 0, margin: 0 }}>

          <Field label="Modulo iscrizione (PDF)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_iscrizione && !fileIscrizione && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_iscrizione} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="application/pdf,image/*" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => gestisciFileModulo(e.target.files?.[0] || null)} />
              <Button variant="ghost" onClick={rileggiModuloForzato} disabled={!fileIscrizione || soloLettura}>Leggi dati dal modulo</Button>
              {(fileIscrizione || (modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_iscrizione)) && <BadgeFileCaricato />}
            </div>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 4 }}>
              <b style={{ color: NAVY }}>Attenzione: i dati importati dal modulo con "Leggi dati dal modulo" sovrascriveranno i dati scritti a mano.</b>
            </div>
          </Field>

          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Field label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Cognome"><input value={cognome} onChange={(e) => setCognome(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Field label="Tutor"><input value={tutor} onChange={(e) => setTutor(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Numero di telefono"><input value={telefono} onChange={(e) => setTelefono(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
            </div>
          </div>
          <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <Field label="Totale pattuito per la vendita (senza IVA)" minLabelHeight={34}>
                  <input style={inputStyle} inputMode="decimal" value={totalePattuito} onChange={(e) => setTotalePattuito(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Quota venditore (7%)" minLabelHeight={34}>
                  <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={totalePattuito === "" ? "" : quotaVenditoreDi(totalePattuito).toFixed(2)} disabled />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Quota speciale" minLabelHeight={34}>
                  <input
                    style={inputStyle}
                    inputMode="decimal"
                    placeholder="es. 60.00"
                    value={quotaSpeciale}
                    onChange={(e) => setQuotaSpeciale(e.target.value)}
                  />
                </Field>
              </div>
            </div>
            {quotaSpeciale !== "" && (
              <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>
                La quota speciale sostituisce ovunque la quota venditore del 7%.
              </div>
            )}
          </div>
          <Field label="Pacchetto/Kit">
            <input value={pacchettoKit} onChange={(e) => setPacchettoKit(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
          </Field>
          <BloccoQuota
            titolo="Quota acconto"
            valori={pagAcconto}
            opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Cash no iva", "Rate"]}
            totaleBloccato={false}
            imponibileBloccato={pagAcconto.metodo === "Cash no iva"}
            onImponibile={(v) => setPagAcconto((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagAcconto((prev) => (prev.metodo === "Cash no iva" ? { ...prev, totale: v } : conTotaleAggiornato(prev, v, true)))}
            onMetodo={(v) =>
              setPagAcconto((prev) => {
                if (v === "Cash no iva") {
                  return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "", imponibile: "" };
                }
                // si esce da "Cash no iva": ripristina l'IVA ricalcolando
                // l'imponibile dal totale già inserito, invece di lasciare
                // l'imponibile vuoto come se non fosse mai stato compilato
                if (prev.metodo === "Cash no iva" && prev.totale !== "") {
                  return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "", imponibile: String(round2(parseNum(prev.totale) / 1.22)) };
                }
                return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "" };
              })
            }
            onInteressi={(v) => setPagAcconto((prev) => ({ ...prev, interessi: v }))}
            onTotaleConInteressi={(v) =>
              setPagAcconto((prev) => {
                const nettoNuovo = round2(parseNum(v) - parseNum(prev.interessi));
                return conTotaleAggiornato(prev, String(nettoNuovo), true);
              })
            }
          />
          <BloccoQuota
            titolo="Quota pre corso"
            valori={pagPrecorso}
            opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Rate"]}
            onImponibile={(v) => setPagPrecorso((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagPrecorso((prev) => conTotaleAggiornato(prev, v, true))}
            onMetodo={(v) => setPagPrecorso((prev) => ({ ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "" }))}
            onInteressi={(v) => setPagPrecorso((prev) => ({ ...prev, interessi: v }))}
          />
          <BloccoQuota
            titolo="Da avere al corso"
            valori={pagSaldo}
            onImponibile={(v) => setPagSaldo((prev) => conImponibileAggiornato(prev, v, prev.metodo !== "Contanti"))}
            onTotale={(v) => setPagSaldo((prev) => conTotaleAggiornato(prev, v, prev.metodo !== "Contanti"))}
            onMetodo={(v) =>
              setPagSaldo((prev) => {
                const applicaIva = v !== "Contanti";
                const imp = parseNum(prev.imponibile);
                const totale = prev.imponibile === "" ? "" : String(applicaIva ? round2(imp * 1.22) : imp);
                return { ...prev, metodo: v, totale };
              })
            }
          />
          {(() => {
            // l'iva di una quota è "totale - imponibile", ma quando
            // l'imponibile è vuoto (Cash no iva) non c'è nessun calcolo da
            // fare: quella quota è per intero "senza iva" e non deve
            // abbassare il totale senza iva solo perché la casella
            // imponibile non è mai stata riempita
            const impEffettivo = (q) => (q.imponibile === "" ? parseNum(q.totale) : parseNum(q.imponibile));
            const ivaEffettiva = (q) => (q.imponibile === "" ? 0 : round2(parseNum(q.totale) - parseNum(q.imponibile)));
            const nessunaIva = ivaEffettiva(pagAcconto) === 0 && ivaEffettiva(pagPrecorso) === 0 && ivaEffettiva(pagSaldo) === 0;
            const totaleSenzaIva = impEffettivo(pagAcconto) + impEffettivo(pagPrecorso) + impEffettivo(pagSaldo);
            const totaleConIva = parseNum(pagAcconto.totale) + parseNum(pagPrecorso.totale) + parseNum(pagSaldo.totale);
            return (
              <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10, background: BG_CHIARO }}>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Totale pagato</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 100px" }}>
                    <Field label="Totale senza Iva">
                      <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={totaleSenzaIva.toFixed(2)} disabled />
                    </Field>
                  </div>
                  {/* se nessuna quota ha davvero un'IVA (tutte pagate con
                      metodi "no iva"), il totale con IVA sarebbe identico a
                      quello senza IVA: inutile e fuorviante mostrarlo */}
                  {!nessunaIva && (
                    <div style={{ flex: "1 1 100px" }}>
                      <Field label="Totale con Iva">
                        <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={totaleConIva.toFixed(2)} disabled />
                      </Field>
                    </div>
                  )}
                  <div style={{ flex: "1 1 100px" }}>
                    <Field label="Totale con interessi">
                      <input
                        style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }}
                        value={(() => {
                          const intAcconto = pagAcconto.metodo === "Rate" ? parseNum(pagAcconto.interessi) : 0;
                          const intPrecorso = pagPrecorso.metodo === "Rate" ? parseNum(pagPrecorso.interessi) : 0;
                          if (intAcconto <= 0 && intPrecorso <= 0) return "";
                          return (totaleConIva + intAcconto + intPrecorso).toFixed(2);
                        })()}
                        disabled
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })()}
          <Field label="Accordi commerciali">
            <input value={accordiCommerciali} onChange={(e) => setAccordiCommerciali(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
          </Field>
          <Field label="Richiede modelle a pagamento?">
            <div style={{ display: "flex", gap: 16, ...fontBody, fontSize: 14, color: NAVY }}>
              {[["si", "Sì"], ["no", "No"]].map(([val, lab]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="richiedeModelle" checked={richiedeModelle === val} onChange={() => setRichiedeModelle(val)} />
                  {lab}
                </label>
              ))}
            </div>
          </Field>

          {richiedeModelle === "si" && (
            <>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Quante modelle">
                    <input type="number" min="0" style={inputStyle} value={numeroModelle} onChange={(e) => setNumeroModelle(e.target.value)} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Da pagare per modelle">
                    <input
                      style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }}
                      value={
                        prezzoSpecialeModelle !== ""
                          ? parseNum(prezzoSpecialeModelle).toFixed(2)
                          : numeroModelle === ""
                          ? ""
                          : (parseNum(numeroModelle) * 60).toFixed(2)
                      }
                      disabled
                    />
                  </Field>
                </div>
              </div>
              <Field label="Prezzo speciale modelle (opzionale — se compilato sostituisce il calcolo automatico)">
                <input style={inputStyle} inputMode="decimal" value={prezzoSpecialeModelle} onChange={(e) => setPrezzoSpecialeModelle(e.target.value)} />
              </Field>
              {tipiModelle.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Trattamento di ogni modella</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tipiModelle.map((m, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 78, flexShrink: 0 }}>Modella {idx + 1}</span>
                        <select
                          style={{ ...inputStyle, flex: 1 }}
                          value={m.tipo}
                          onChange={(e) => setTipiModelle((prev) => prev.map((x, i) => (i === idx ? { ...x, tipo: e.target.value } : x)))}
                        >
                          <option value="">— scegli —</option>
                          {OPZIONI_TIPO_MODELLA.map((opz) => <option key={opz} value={opz}>{opz}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Field label="Taglia divisa">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...fontBody, fontSize: 14, color: NAVY }}>
              {["NO DIVISA", "XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((taglia) => (
                <label key={taglia} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="tagliaDivisa" checked={tagliaDivisa === taglia} onChange={() => setTagliaDivisa(taglia)} />
                  {taglia}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Screen acconto (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_acconto && !fileScreenAcconto && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_acconto} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*,application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setFileScreenAcconto(e.target.files?.[0] || null)} />
              {(fileScreenAcconto || (modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_acconto)) && <BadgeFileCaricato />}
            </div>
          </Field>
          <Field label="Screen di recap (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_recap && !fileScreenRecap && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_recap} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*,application/pdf" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onChange={(e) => setFileScreenRecap(e.target.files?.[0] || null)} />
              {(fileScreenRecap || (modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_recap)) && <BadgeFileCaricato />}
            </div>
          </Field>
          <Field label="Note (opzionale)"><input value={note} onChange={(e) => setNote(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>

          </fieldset>

          <div style={{ display: "flex", gap: 10 }}>
            {soloLettura ? (
              <Button variant="ghost" onClick={annullaForm}>&larr; Torna alla lista</Button>
            ) : (
              <>
                <Button onClick={salvaIscritto} disabled={caricando}>
                  {caricando ? "Caricamento…" : modificandoId ? "Fatto, torna alla lista" : "Aggiungi iscritto"}
                </Button>
                <Button variant="ghost" onClick={annullaForm}>Annulla</Button>
              </>
            )}
          </div>
          {msg && !msgErrore && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
        </div>
      )}

      {vista === "modelle" && (() => {
        const iscrittiConModelle = listaIscritti.filter((i) => i.richiede_modelle && Array.isArray(i.tipi_modelle) && i.tipi_modelle.length > 0);
        return (
          <div>
            <div style={{ ...hStyle, marginBottom: 4 }}>Assegna modelle</div>
            <div style={subStyle}>
              Per ogni modella richiesta, spunta MAT/POM e, appena trovata, inserisci nome e telefono: si salva da solo, non serve premere Salva.
            </div>

            {iscrittiConModelle.length === 0 && (
              <div style={{ ...cardStyle, ...fontBody, color: MUTED, fontSize: 14 }}>Nessun iscritto di questa classe ha richiesto modelle.</div>
            )}

            {iscrittiConModelle.map((i) => (
              <div key={i.id} style={{ ...cardStyle, padding: 18 }}>
                <div style={{ ...fontBody, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
                  {i.nome.toUpperCase()} {i.cognome.toUpperCase()}
                </div>
                <div>
                  {i.tipi_modelle.map((m, idx) => (
                    <RigaModella
                      key={idx}
                      modella={m}
                      primaRiga={idx === 0}
                      onSalva={(campo, valore) => aggiornaModellaSlot(i.id, idx, campo, valore)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div style={cardStyle}>
              <div style={hStyle}>Link per ricerca modelle</div>
              <div style={subStyle}>Genera un link senza dati personali o di pagamento, con solo i trattamenti richiesti, dove chi cerca le modelle può scrivere nome e telefono appena ne trova una.</div>
              <Button variant="ghost" onClick={generaLinkModelle} style={{ width: "100%" }}>Genera link per ricerca modelle</Button>
              {linkModelle && (
                <div style={{ marginTop: 12 }}>
                  <input readOnly value={linkModelle} onFocus={(e) => e.target.select()} style={{ ...inputStyle, marginBottom: 8 }} />
                  <Button onClick={copiaLinkModelle} style={{ width: "100%" }}>Copia link</Button>
                </div>
              )}
            </div>
            {msg && !msgErrore && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
          </div>
        );
      })()}

      {vista === "lista" && (
        <>
          <div style={{ ...hStyle, marginBottom: 12 }}>Iscritti ({listaIscritti.length})</div>
          {listaIscritti.length === 0 && (
            <div style={{ ...cardStyle, ...fontBody, color: MUTED, fontSize: 14 }}>Nessun iscritto ancora. Usa "Iscrivi" in alto per aggiungerne uno.</div>
          )}
          {listaIscritti.map((i, idx) => {
            const mostraIncasso = i.saldo_totale != null || i.numero_modelle != null;
            const daIncassare = round2((i.saldo_totale || 0) + modelleTotaleDi(i));
            const aPosto = i.incassato || daIncassare === 0;
            const coloreIncasso = aPosto ? "#2E7D32" : "#C0392B";
            return (
            <div key={i.id} style={{ ...cardStyle, padding: mostraGestione ? 0 : 16, marginBottom: 10, overflow: "hidden" }}>
              {!mostraGestione && (
                // fuori da "Contabilità classe": scheda semplice, solo nome e telefono
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10 }}>
                  <div
                    onClick={() => apriModificaCompleta(i)}
                    title="Clicca per vedere i dati dell'iscritto"
                    style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: NAVY, cursor: "pointer", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, minWidth: 0 }}
                  >
                    <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>{idx + 1}.</span>
                    <span>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</span>
                    {i.tutor && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· Tutor: {i.tutor}</span>}
                    {i.note && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>({i.note})</span>}
                  </div>
                  {i.telefono && (
                    <span style={{ fontSize: 12, fontWeight: 400, color: MUTED, display: "inline-flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                      <a href={`tel:${i.telefono.replace(/\s+/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ color: MUTED, textDecoration: "underline" }}>{i.telefono}</a>
                      <a href={`https://wa.me/${numeroWhatsapp(i.telefono)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Apri chat WhatsApp" style={{ display: "flex", alignItems: "center", padding: 8, margin: -8 }}>
                        <IconaWhatsapp size={22} />
                      </a>
                    </span>
                  )}
                </div>
              )}
              {mostraGestione && (
                <>
                  {/* barra degli strumenti della scheda (come la barra dei
                      pulsanti in cima a una finestra Mac): le azioni
                      sull'iscritto vivono qui, non sparse dentro la scheda */}
                  <div
                    style={{
                      display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2,
                      padding: "6px 10px",
                      background: "#F6F6F8",
                      borderBottom: `1px solid ${CREAM_BORDER}`,
                    }}
                  >
                    <button
                      onClick={() => toggleRistampaDiploma(i)}
                      title="Ristampa solo questo (nel PDF di Stampa diplomi e Stampa segnaposti)"
                      style={{
                        border: "none", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", alignItems: "center",
                        background: i.ristampa_diploma ? "#1D4ED8" : "transparent", color: i.ristampa_diploma ? "#fff" : NAVY,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    </button>
                    <button
                      onClick={() => apriModificaCompleta(i)}
                      title="Modifica"
                      style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 6, display: "flex", alignItems: "center" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <Button variant="ghost" onClick={() => setSpostaIscrittoId(spostaIscrittoId === i.id ? null : i.id)} style={{ padding: "4px 10px", fontSize: 12 }}>
                      Sposta
                    </Button>
                    <button
                      onClick={() => elimina(i.id)}
                      title="Elimina"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 6, display: "flex", alignItems: "center" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>

                  {/* tabella, non flex/grid: colonne di altezza sempre
                      identica tra loro è un comportamento base delle
                      celle di tabella, garantito su ogni browser da
                      prima che esistessero flexbox e grid - lo sfondo
                      della colonna sinistra deve arrivare fino in fondo
                      alla scheda, non fermarsi al suo contenuto */}
                  <div style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    {/* colonna sinistra: anagrafica e ricontatto */}
                    <div style={{ display: "table-cell", position: "relative", width: "33.333%", verticalAlign: "top", background: "#F6F6F8", padding: 20 }}>
                      <div onClick={() => apriModificaCompleta(i)} title="Clicca per vedere i dati dell'iscritto" style={{ cursor: "pointer" }}>
                        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 4 }}>{idx + 1}.</div>
                        <div style={{ ...fontBody, fontSize: 19, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</div>
                        {i.tutor && <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginTop: 4 }}>Tutor: {i.tutor}</div>}
                        {i.note && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>({i.note})</div>}
                      </div>
                      {i.telefono && (
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                          <a href={`tel:${i.telefono.replace(/\s+/g, "")}`} style={{ ...fontBody, fontSize: 13, color: MUTED, textDecoration: "underline" }}>{i.telefono}</a>
                          <a href={`https://wa.me/${numeroWhatsapp(i.telefono)}`} target="_blank" rel="noopener noreferrer" title="Apri chat WhatsApp" style={{ display: "flex", alignItems: "center" }}>
                            <IconaWhatsapp size={20} />
                          </a>
                        </div>
                      )}

                      <div style={{ borderTop: `1px solid ${CREAM_BORDER}`, margin: "16px 0" }} />

                      <div
                        onClick={() => toggleRicontattato(i)}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", ...fontBody, fontSize: 14, color: NAVY }}
                      >
                        <input type="checkbox" checked={!!i.ricontattato} readOnly style={{ width: 20, height: 20, pointerEvents: "none" }} />
                        Ricontattato
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <span onClick={() => toggleRicontattato(i)} style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#E0E0E0" : "#C0392B", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
                        <span onClick={() => toggleRicontattato(i)} style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#2E7D32" : "#E0E0E0", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
                      </div>
                      <textarea
                        rows={2}
                        defaultValue={(i.note_ricontatto || "").toUpperCase()}
                        placeholder="Note dopo il ricontatto"
                        onBlur={(e) => salvaNotaRicontatto(i.id, e.target.value.toUpperCase())}
                        style={{ ...inputStyle, marginTop: 10, fontSize: 8, textTransform: "uppercase", resize: "vertical", width: "100%", boxSizing: "border-box" }}
                      />

                      {(() => {
                        const eccezioneAttiva = i.diploma_eccezione_id ? (diplomaEccezioni || []).find((d) => d.id === i.diploma_eccezione_id) : null;
                        const impostata = i.diploma_eccezione_id || i.diploma_eccezione_data;
                        return (
                          <div style={{ position: "absolute", left: 20, right: 20, bottom: 20 }}>
                            <Button
                              onClick={() => setEccezioneApertaId(eccezioneApertaId === i.id ? null : i.id)}
                              style={impostata
                                ? { width: "100%", padding: "8px 6px", fontSize: 10.5, lineHeight: 1.25, whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "#6FA8DC", border: "1px solid #6FA8DC", color: "#fff" }
                                : { width: "100%", padding: "8px 6px", fontSize: 10.5, lineHeight: 1.25, whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "#fff", border: "1px solid #1D4ED8", color: "#1D4ED8" }
                              }
                            >
                              {impostata ? "Eccezione diploma impostata" : "Carica eccezione diploma"}
                            </Button>
                            {impostata && (
                              <div style={{ marginTop: 6, width: "100%" }}>
                                <div style={{ ...fontBody, fontSize: 10, color: MUTED, textAlign: "right" }}>
                                  {eccezioneAttiva ? eccezioneAttiva.nome : ""}
                                  {eccezioneAttiva && i.diploma_eccezione_data ? " · " : ""}
                                  {i.diploma_eccezione_data ? fmtData(i.diploma_eccezione_data) : ""}
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <button
                                    onClick={() => { if (window.confirm("Rimuovere l'eccezione diploma per questo iscritto?")) rimuoviEccezioneDiploma(i.id); }}
                                    title="Rimuovi eccezione diploma"
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex", alignItems: "center" }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6" /><path d="M14 11v6" />
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* colonna destra: pacchetto, pagamenti, allegati */}
                    <div style={{ display: "table-cell", width: "66.667%", verticalAlign: "top", padding: 20, ...fontBody, fontSize: 14, color: NAVY }}>
                      {i.pacchetto_kit && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Pacchetto/Kit</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{i.pacchetto_kit}</div>
                        </div>
                      )}

                      {(i.totale_pattuito != null || i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null || i.quota_venditore != null) && (() => {
                        const netto = round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0));
                        const conRate = round2(totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0));
                        const celle = [
                          i.totale_pattuito != null && { chiave: "pattuito", label: "Totale pattuito", valore: `${i.totale_pattuito} €` },
                          (i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && { chiave: "pagato", label: "Totale pagato", valore: conRate !== netto ? `${conRate} €` : `${netto} €` },
                          i.quota_venditore != null && { chiave: "venditore", label: "Quota venditore", valore: `${i.quota_venditore} €` },
                        ].filter(Boolean);
                        return (
                          // grid a colonne fisse (mai una sotto l'altra): con
                          // flex-wrap "quota venditore" andava a capo perché
                          // lo spazio finiva, con grid ogni colonna prende
                          // esattamente 1/N dello spazio disponibile
                          <div style={{ display: "grid", gridTemplateColumns: `repeat(${celle.length}, 1fr)`, marginBottom: 18 }}>
                            {celle.map((c, ci) => (
                              <div key={c.chiave} style={{ minWidth: 0, paddingLeft: ci > 0 ? 12 : 0, paddingRight: 10, borderLeft: ci > 0 ? `1px solid ${CREAM_BORDER}` : "none" }}>
                                <div style={{ fontSize: 12, color: NAVY, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
                                <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.valore}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* un'unica griglia per tutte le righe sotto, così
                          l'importo e il metodo restano nella stessa colonna
                          riga per riga invece di rincorrere la lunghezza
                          dell'etichetta a sinistra. Le colonne importo/metodo
                          usano una larghezza FISSA (in "ch", non "auto"):
                          "auto" si dimensiona sul contenuto più lungo di
                          ogni singola scheda, quindi schede diverse (una con
                          "0 €", un'altra con "353.8 €") finiscono con le
                          colonne disallineate tra loro anche se le schede
                          hanno la stessa larghezza. Da mobile lo spazio non
                          basta per 3 colonne fisse: importo e metodo vanno
                          allora sulla stessa riga, sotto l'etichetta */}
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 9ch 9ch", columnGap: 14 }}>
                        {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
                          <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}` }}>Pagamenti</div>
                        )}
                        {i.acconto_totale != null && rigaPagamento(
                          "Pagato in acconto",
                          `${totQuota(i, "acconto")} €${i.acconto_interessi ? ` (interessi ${i.acconto_interessi} €)` : ""}`,
                          i.acconto_metodo || "?"
                        )}
                        {i.precorso_totale != null && rigaPagamento(
                          "Pagato pre corso",
                          `${totQuota(i, "precorso")} €${i.precorso_interessi ? ` (interessi ${i.precorso_interessi} €)` : ""}`,
                          i.precorso_metodo || "?"
                        )}
                        {i.saldo_totale != null && rigaPagamento(
                          "Importo da pagare al corso",
                          `${i.saldo_totale} €`,
                          i.saldo_metodo || "?"
                        )}
                        {i.richiede_modelle && i.numero_modelle != null && (
                          <>
                            <div style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY }}>Modelle da pagare</div>
                            <div style={{ gridColumn: isMobile ? "1 / -1" : "2 / -1", minWidth: 0, padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, fontWeight: 700, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{i.numero_modelle} modell{i.numero_modelle === 1 ? "a" : "e"} → {modelleTotaleDi(i)} €{i.prezzo_speciale_modelle != null ? " (prezzo speciale)" : ""}</div>
                          </>
                        )}
                        {i.taglia_divisa && (
                          <>
                            <div style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY }}>Taglia divisa</div>
                            <div style={{ gridColumn: isMobile ? "1 / -1" : "2 / -1", padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, fontWeight: 700, fontSize: 22, color: NAVY }}>{i.taglia_divisa}</div>
                          </>
                        )}
                        {i.accordi_commerciali && (
                          <>
                            <div style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, color: NAVY }}>Accordi commerciali</div>
                            <div style={{ gridColumn: isMobile ? "1 / -1" : "2 / -1", minWidth: 0, padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, fontWeight: 700, fontSize: 11, color: NAVY, whiteSpace: "normal", wordBreak: "break-word" }}>{i.accordi_commerciali}</div>
                          </>
                        )}
                        {(i.file_iscrizione || i.file_screen_acconto || i.file_screen_recap) && (
                          <div style={{ gridColumn: "1 / -1", paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}`, marginTop: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Allegati</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {[
                                i.file_iscrizione && { percorso: i.file_iscrizione, etichetta: "Modulo iscrizione" },
                                i.file_screen_acconto && { percorso: i.file_screen_acconto, etichetta: "Screen acconto" },
                                i.file_screen_recap && { percorso: i.file_screen_recap, etichetta: "Screen recap" },
                              ].filter(Boolean).map((f) => (
                                <div key={f.etichetta} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                  </svg>
                                  <AllegatoLink percorso={f.percorso} etichetta={f.etichetta} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {i.totale_pattuito == null && i.acconto_totale == null && i.precorso_totale == null && i.saldo_totale == null && !i.accordi_commerciali && !i.file_iscrizione && (
                        <div style={{ color: MUTED }}>Nessun dato di vendita registrato per questo iscritto.</div>
                      )}

                      {/* "Da incassare" resta dentro la colonna bianca,
                          allineato come Pagamenti/Allegati: il celeste
                          della colonna sinistra prosegue così ininterrotto
                          fino in fondo alla scheda, senza una riga a parte
                          che lo tagli */}
                      {mostraIncasso && (
                        <div
                          onClick={() => toggleIncassato(i)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            paddingTop: 14,
                            marginTop: 4,
                            borderTop: `1px solid ${CREAM_BORDER}`,
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "baseline", gap: isMobile ? 2 : 8 }}>
                            <span style={{ ...fontBody, fontSize: 11, fontWeight: 600, color: coloreIncasso, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                              {i.incassato ? "Incassato" : "Da incassare"}
                            </span>
                            <span style={{ ...fontBody, fontSize: 22, fontWeight: 800, color: coloreIncasso, whiteSpace: "nowrap" }}>{daIncassare} €</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, ...fontBody, fontSize: 14, color: coloreIncasso }}>
                            <input type="checkbox" checked={!!i.incassato} readOnly style={{ width: 22, height: 22, pointerEvents: "none" }} />
                            Incassato
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {eccezioneApertaId === i.id && (
                    <div style={{ margin: "0 20px 20px", padding: 14, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, background: BG_CHIARO }}>
                      <div style={{ ...fontBody, fontSize: 13, color: NAVY, fontWeight: 500, marginBottom: 10 }}>
                        Eccezione diploma per {i.nome.toUpperCase()} {i.cognome.toUpperCase()}:
                      </div>
                      <Field label="Diploma da usare (al posto del template normale del corso)">
                        <select
                          value={i.diploma_eccezione_id || ""}
                          onChange={(e) => impostaEccezioneDiploma(i.id, e.target.value || null)}
                          style={inputStyle}
                        >
                          <option value="">Nessuna — usa il template normale del corso</option>
                          {(diplomaEccezioni || []).map((d) => (
                            <option key={d.id} value={d.id}>{d.nome}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Data da mostrare sul diploma (opzionale — se vuota resta la data del corso)">
                        <SelettoreDataDiploma
                          valore={i.diploma_eccezione_data || null}
                          dataInizio={corsoData.data_inizio}
                          dataFine={corsoData.data_fine}
                          onCambia={(data) => impostaEccezioneData(i.id, data)}
                        />
                      </Field>
                      <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginBottom: 10 }}>
                        Il nome dell'allievo e il nome della master restano invariati: cambiano solo il template del diploma e/o la data.
                      </div>
                      <Button onClick={() => setEccezioneApertaId(null)}>Salva</Button>
                    </div>
                  )}
                  {spostaIscrittoId === i.id && (
                    <div style={{ margin: "0 20px 20px", padding: 14, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, background: BG_CHIARO }}>
                      <div style={{ ...fontBody, fontSize: 13, color: NAVY, fontWeight: 500, marginBottom: 10 }}>Scegli il nuovo corso/data per {i.nome.toUpperCase()} {i.cognome.toUpperCase()}:</div>
                      <SelettoreSpostamento
                        corsi={corsi}
                        location={location}
                        corsiDate={corsiDate}
                        iscritti={iscritti}
                        corsoDataEscluso={corsoData.id}
                        onScegli={(cd, corsoTarget, locTarget) => eseguiSpostamento(i, cd, corsoTarget, locTarget)}
                      />
                      <Button variant="ghost" onClick={() => setSpostaIscrittoId(null)} style={{ marginTop: 8 }}>Annulla</Button>
                    </div>
                  )}

                </>
              )}
            </div>
            );
          })}
          {msg && !msgErrore && <div style={{ ...fontBody, fontSize: 13, color: NAVY }}>{msg}</div>}

          {mostraGestione && (
            <div style={cardStyle}>
              <Button onClick={() => window.print()} style={{ width: "100%", marginBottom: 8 }}>Stampa elenco classe</Button>
              <Button variant="ghost" onClick={generaLinkMaster} style={{ width: "100%" }}>Crea link per master</Button>
              {linkMaster && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                  <input
                    readOnly
                    value={linkMaster}
                    onFocus={(e) => e.target.select()}
                    style={{ ...inputStyle, flex: "1 1 200px", fontSize: 12, color: MUTED }}
                  />
                  <Button variant="ghost" onClick={copiaLinkMaster}>Copia link</Button>
                </div>
              )}
              <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 8 }}>
                Genera un link di sola lettura da mandare al/alla master: potrà vedere tutti i dati e gli allegati di ogni allievo, senza poter modificare nulla né accedere al resto dell'app.
              </div>
            </div>
          )}

          {mostraGestione && (
            <div
              className="stampa-classe"
              style={{ position: "absolute", left: "-9999px", top: 0, width: 700, background: "#fff", padding: 24, fontFamily: "'Roboto',sans-serif", color: "#000" }}
            >
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, marginBottom: 24, textTransform: "uppercase" }}>
                Contabilità corso {corso?.nome} {loc?.nome} {corsoData.data_inizio === corsoData.data_fine ? fmtData(corsoData.data_inizio) : `${fmtData(corsoData.data_inizio)} – ${fmtData(corsoData.data_fine)}`}
              </div>
              {listaIscritti.length === 0 && <div>Nessun iscritto.</div>}
              {listaIscritti.map((i, idx) => (
                <div key={i.id} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #ccc" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{idx + 1}. {i.nome.toUpperCase()} {i.cognome.toUpperCase()}</div>
                  {i.tutor && <div>Tutor: {i.tutor}</div>}
                  {i.telefono && <div>Telefono: {i.telefono}</div>}
                  {i.acconto_totale != null && <div>Acconto: {i.acconto_imponibile} € imp. → {totQuota(i, "acconto")} € tot. ({i.acconto_metodo || "?"}{i.acconto_interessi ? `, interessi ${i.acconto_interessi} €` : ""})</div>}
                  {i.precorso_totale != null && <div>Pre corso: {i.precorso_imponibile} € imp. → {totQuota(i, "precorso")} € tot. ({i.precorso_metodo || "?"}{i.precorso_interessi ? `, interessi ${i.precorso_interessi} €` : ""})</div>}
                  {i.saldo_totale != null && <div>Da avere al corso: {i.saldo_imponibile} € imp. → {i.saldo_totale} € tot. ({i.saldo_metodo || "?"})</div>}
                  {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (() => {
                    const netto = round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0));
                    const conRate = round2(totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0));
                    return <div style={{ fontWeight: 700 }}>Totale pagato: {netto} €{conRate !== netto && ` — con rate: ${conRate} €`}</div>;
                  })()}
                  {i.richiede_modelle !== null && i.richiede_modelle !== undefined && <div>Richiede modelle: {i.richiede_modelle ? "Sì" : "No"}</div>}
                  {i.richiede_modelle && i.numero_modelle != null && <div>Modelle da pagare: {i.numero_modelle} modell{i.numero_modelle === 1 ? "a" : "e"} → {modelleTotaleDi(i)} €{i.prezzo_speciale_modelle != null ? " (prezzo speciale)" : ""}</div>}
                  {(i.saldo_totale != null || i.numero_modelle != null) && (
                    <div style={{ fontWeight: 700 }}>
                      Da incassare: {round2((i.saldo_totale || 0) + modelleTotaleDi(i))} € — {i.incassato ? "INCASSATO" : "NON INCASSATO"}
                    </div>
                  )}
                  {i.accordi_commerciali && <div>Accordi commerciali: {i.accordi_commerciali}</div>}
                  {i.note && <div>Note: {i.note}</div>}
                </div>
              ))}
              {listaIscritti.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 12, borderTop: "2px solid #000", fontWeight: 700, fontSize: 15 }}>
                  <div>Totale generale classe netto: {round2(listaIscritti.reduce((s, i) => s + (i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0), 0))} € — con rate: {round2(listaIscritti.reduce((s, i) => s + totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0), 0))} €</div>
                  <div style={{ marginTop: 6 }}>Totale ancora da incassare: {round2(listaIscritti.reduce((s, i) => s + (i.incassato ? 0 : (i.saldo_totale || 0) + modelleTotaleDi(i)), 0))} €</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- App principale ----------
// ---------- Vista master: pagina pubblica di sola lettura per richiedere i pagamenti ----------
function VistaMaster({ param }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    async function carica() {
      const parti = decodeURIComponent(param || "").split("/");
      const [slugCorso, slugCitta, dataLeggibile] = parti;
      const match = (dataLeggibile || "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!slugCorso || !slugCitta || !match) { setErrore(true); return; }
      const dataIso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;

      const [{ data: corsi }, { data: location }] = await Promise.all([
        supabase.from("corsi").select("*"),
        supabase.from("location").select("*"),
      ]);
      const corso = (corsi || []).find((c) => slugify(c.nome) === slugCorso);
      const loc = (location || []).find((l) => slugify(l.nome) === slugCitta);
      if (!corso || !loc) { setErrore(true); return; }

      const { data: cd } = await supabase
        .from("corsi_date")
        .select("*")
        .eq("corso_id", corso.id)
        .eq("location_id", loc.id)
        .eq("data_inizio", dataIso)
        .maybeSingle();
      if (!cd) { setErrore(true); return; }

      const { data: iscritti } = await supabase.from("iscritti").select("*").eq("corso_data_id", cd.id).order("ts");
      setDati({ cd, corso, loc, iscritti: iscritti || [] });
    }
    carica();
  }, [param]);

  async function toggleIncassato(i) {
    const { error } = await supabase.from("iscritti").update({ incassato: !i.incassato }).eq("id", i.id);
    if (error) return;
    setDati((prev) => ({
      ...prev,
      iscritti: prev.iscritti.map((x) => (x.id === i.id ? { ...x, incassato: !x.incassato } : x)),
    }));
  }

  if (errore) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, padding: 20, textAlign: "center" }}>
        Link non valido o corso non trovato.
      </div>
    );
  }
  if (!dati) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  const { cd, corso, loc, iscritti } = dati;

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, marginBottom: 2 }}>{corso?.nome?.toUpperCase() || "?"} · {loc?.nome?.toUpperCase() || "?"}</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 24 }}>
          {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`} — richiesta pagamenti
        </div>

        {iscritti.length === 0 && <div style={{ color: MUTED }}>Nessun iscritto.</div>}

        {iscritti.map((i, idx) => {
          const daIncassare = round2((i.saldo_totale || 0) + modelleTotaleDi(i));
          const aPosto = i.incassato || daIncassare === 0;
          const colore = aPosto ? "#2E7D32" : "#C0392B";
          return (
            <div key={i.id} style={{ ...cardStyle, padding: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 2, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>{idx + 1}.</span>
                <span>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</span>
                {i.tutor && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· Tutor: {i.tutor}</span>}
                {i.telefono && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: MUTED, display: "inline-flex", alignItems: "center", gap: 12 }}>
                    · <a href={`tel:${i.telefono.replace(/\s+/g, "")}`} style={{ color: MUTED, textDecoration: "underline" }}>{i.telefono}</a>
                    <a href={`https://wa.me/${numeroWhatsapp(i.telefono)}`} target="_blank" rel="noopener noreferrer" title="Apri chat WhatsApp" style={{ display: "flex", alignItems: "center", padding: 8, margin: -8 }}>
                      <IconaWhatsapp size={22} />
                    </a>
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: NAVY }}>Ricontattato: {i.ricontattato ? "Sì" : "No"}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: i.ricontattato ? "#E0E0E0" : "#C0392B", border: "1px solid rgba(0,0,0,0.1)" }} />
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: i.ricontattato ? "#2E7D32" : "#E0E0E0", border: "1px solid rgba(0,0,0,0.1)" }} />
                </div>
              </div>
              {i.note_ricontatto && <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, fontStyle: "italic" }}>"{i.note_ricontatto}"</div>}

              <div style={{ marginTop: 8, padding: "12px 14px", background: BG_CHIARO, borderRadius: 8, fontSize: 13, color: MUTED }}>
                {i.pacchetto_kit && (
                  <div style={{ marginBottom: 6 }}><b style={{ color: NAVY }}>Pacchetto/Kit:</b> {i.pacchetto_kit}</div>
                )}
                {i.totale_pattuito != null && (
                  <div style={{ marginBottom: 6 }}>
                    <b style={{ color: NAVY }}>Totale pattuito:</b> {i.totale_pattuito} €{i.quota_venditore != null && ` — quota venditore: ${i.quota_venditore} €`}
                  </div>
                )}
                {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (() => {
                  const netto = round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0));
                  const conRate = round2(totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0));
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <b style={{ color: NAVY }}>Totale pagato:</b> {netto} €{conRate !== netto && <> — <b style={{ color: NAVY }}>totale con interessi:</b> {conRate} €</>}
                    </div>
                  );
                })()}
                {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
                  <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Pagamenti</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {i.acconto_totale != null && <div><b style={{ color: NAVY }}>Pagato in acconto:</b> {totQuota(i, "acconto")} € ({i.acconto_metodo || "?"}{i.acconto_interessi ? `, interessi ${i.acconto_interessi} €` : ""})</div>}
                      {i.precorso_totale != null && <div><b style={{ color: NAVY }}>Pagato pre corso:</b> {totQuota(i, "precorso")} € ({i.precorso_metodo || "?"}{i.precorso_interessi ? `, interessi ${i.precorso_interessi} €` : ""})</div>}
                      {i.saldo_totale != null && <div><b style={{ color: NAVY }}>Importo da pagare al corso:</b> {i.saldo_totale} € ({i.saldo_metodo || "?"})</div>}
                    </div>
                  </div>
                )}
                {i.richiede_modelle && (
                  <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Modelle</div>
                    {i.numero_modelle != null && (
                      <div><b style={{ color: NAVY }}>Modelle da pagare:</b> {i.numero_modelle} modell{i.numero_modelle === 1 ? "a" : "e"} → {modelleTotaleDi(i)} €{i.prezzo_speciale_modelle != null ? " (prezzo speciale)" : ""}</div>
                    )}
                  </div>
                )}
                {i.taglia_divisa && (
                  <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}><b style={{ color: NAVY }}>Taglia divisa:</b> {i.taglia_divisa}</div>
                )}
                {i.accordi_commerciali && (
                  <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <b style={{ color: NAVY }}>Accordi commerciali:</b> {i.accordi_commerciali}
                  </div>
                )}
                {(i.file_iscrizione || i.file_screen_acconto || i.file_screen_recap) && (
                  <div style={{ paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Allegati</div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {i.file_iscrizione && <AllegatoLink percorso={i.file_iscrizione} etichetta="Modulo iscrizione" />}
                      {i.file_screen_acconto && <AllegatoLink percorso={i.file_screen_acconto} etichetta="Screen acconto" />}
                      {i.file_screen_recap && <AllegatoLink percorso={i.file_screen_recap} etichetta="Screen recap" />}
                    </div>
                  </div>
                )}
                {i.note && (
                  <div style={{ paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <b style={{ color: NAVY }}>Note:</b> {i.note}
                  </div>
                )}
              </div>

              <div
                onClick={() => toggleIncassato(i)}
                style={{
                  marginTop: 10,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: aPosto ? "#E8F5E9" : "#FDECEC",
                  border: `1px solid ${colore}`,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: colore }}>
                  {i.incassato ? `INCASSATO ${daIncassare} €` : `DA INCASSARE ${daIncassare} €`}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 12, color: colore }}>
                  <input type="checkbox" checked={!!i.incassato} readOnly style={{ width: 22, height: 22, pointerEvents: "none" }} />
                  incassato
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: 11, color: MUTED, marginTop: 20, textAlign: "center" }}>
          Pagina di sola lettura — Elitederma Academy
        </div>
      </div>
    </div>
  );
}

// pagina pubblica di sola lettura per chi cerca modelle per una classe:
// solo i trattamenti richiesti, senza nessun dato personale o di pagamento
// (stessa logica di slug di VistaMaster, ma parametro "?modelle=")
function VistaRicercaModelle({ param }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    async function carica() {
      const parti = decodeURIComponent(param || "").split("/");
      const [slugCorso, slugCitta, dataLeggibile] = parti;
      const match = (dataLeggibile || "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!slugCorso || !slugCitta || !match) { setErrore(true); return; }
      const dataIso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;

      const [{ data: corsi }, { data: location }, { data: master }] = await Promise.all([
        supabase.from("corsi").select("*"),
        supabase.from("location").select("*"),
        supabase.from("master").select("*"),
      ]);
      const corso = (corsi || []).find((c) => slugify(c.nome) === slugCorso);
      const loc = (location || []).find((l) => slugify(l.nome) === slugCitta);
      if (!corso || !loc) { setErrore(true); return; }

      const { data: cd } = await supabase
        .from("corsi_date")
        .select("*")
        .eq("corso_id", corso.id)
        .eq("location_id", loc.id)
        .eq("data_inizio", dataIso)
        .maybeSingle();
      if (!cd) { setErrore(true); return; }

      const { data: iscritti } = await supabase.from("iscritti").select("*").eq("corso_data_id", cd.id).order("ts");
      const masterNome = cd.master_id ? (master || []).find((m) => m.id === cd.master_id)?.nome : null;
      setDati({ cd, corso, loc, masterNome, iscritti: iscritti || [] });
    }
    carica();
  }, [param]);

  if (errore) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, padding: 20, textAlign: "center" }}>
        Link non valido o corso non trovato.
      </div>
    );
  }
  if (!dati) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  const { cd, corso, loc, masterNome, iscritti } = dati;
  const iscrittiConModelle = iscritti.filter((i) => i.richiede_modelle && Array.isArray(i.tipi_modelle) && i.tipi_modelle.length > 0);

  async function aggiornaModellaSlot(iscrittoId, idx, campo, valore) {
    const iscritto = iscritti.find((x) => x.id === iscrittoId);
    if (!iscritto) return;
    const nuovoElenco = (iscritto.tipi_modelle || []).map((m, i) => (i === idx ? { ...m, [campo]: valore } : m));
    const { error } = await supabase.from("iscritti").update({ tipi_modelle: nuovoElenco }).eq("id", iscrittoId);
    if (error) return;
    setDati((prev) => ({
      ...prev,
      iscritti: prev.iscritti.map((x) => (x.id === iscrittoId ? { ...x, tipi_modelle: nuovoElenco } : x)),
    }));
  }

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, marginBottom: 2 }}>{corso?.nome?.toUpperCase() || "?"} · {loc?.nome?.toUpperCase() || "?"}</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 6 }}>
          {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}
          {masterNome && ` — Master: ${masterNome.toUpperCase()}`} — Ricerca modelle
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 24 }}>
          Appena trovi una modella per un trattamento, scrivi qui il suo nome e il suo numero: si salva da solo.
        </div>

        {iscrittiConModelle.length === 0 && <div style={{ color: MUTED }}>Nessuna modella richiesta per questa classe.</div>}

        {iscrittiConModelle.map((i, idx) => (
          <div key={i.id} style={{ ...cardStyle, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ color: MUTED, fontWeight: 400, fontSize: 13 }}>{idx + 1}.</span>
              {i.nome.toUpperCase()} {i.cognome.toUpperCase()}
            </div>
            <div>
              {i.tipi_modelle.map((m, mi) => (
                <RigaModella
                  key={mi}
                  modella={m}
                  mostraOrario={false}
                  primaRiga={mi === 0}
                  onSalva={(campo, valore) => aggiornaModellaSlot(i.id, mi, campo, valore)}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11, color: MUTED, marginTop: 20, textAlign: "center" }}>
          Elitederma Academy
        </div>
      </div>
    </div>
  );
}

// pagina pubblica di sola lettura con i biglietti di viaggio caricati per una data
function VistaBiglietti({ param }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    async function carica() {
      const parti = decodeURIComponent(param || "").split("/");
      const [slugCorso, slugCitta, slugDataParte] = parti;
      const dataInfo = leggiSlugData(slugDataParte);
      if (!slugCorso || !slugCitta || !dataInfo) { setErrore(true); return; }
      const dataIso = `${dataInfo.anno}-${String(dataInfo.mese).padStart(2, "0")}-${String(dataInfo.giorno).padStart(2, "0")}`;

      const [{ data: corsi }, { data: location }] = await Promise.all([
        supabase.from("corsi").select("*"),
        supabase.from("location").select("*"),
      ]);
      const corso = (corsi || []).find((c) => slugify(c.nome) === slugCorso);
      const loc = (location || []).find((l) => slugify(l.nome) === slugCitta);
      if (!corso || !loc) { setErrore(true); return; }

      const { data: cd } = await supabase
        .from("corsi_date")
        .select("*")
        .eq("corso_id", corso.id)
        .eq("location_id", loc.id)
        .eq("data_inizio", dataIso)
        .maybeSingle();
      if (!cd) { setErrore(true); return; }

      setDati({ cd, corso, loc });
    }
    carica();
  }, [param]);

  if (errore) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, padding: 20, textAlign: "center" }}>
        Link non valido o data non trovata.
      </div>
    );
  }
  if (!dati) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  const { cd, corso, loc } = dati;
  const file = cd.viaggio_file || [];

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, marginBottom: 2 }}>{corso?.nome?.toUpperCase() || "?"} · {loc?.nome?.toUpperCase() || "?"}</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 24 }}>
          {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`} — biglietti di viaggio
        </div>

        {file.length === 0 && <div style={{ color: MUTED }}>Nessun biglietto caricato.</div>}
        {file.map((percorso, idx) => (
          <div key={percorso} style={{ ...cardStyle, padding: 16, marginBottom: 10 }}>
            <AllegatoLink percorso={percorso} etichetta={`Biglietto ${idx + 1} — apri il file`} />
          </div>
        ))}

        <div style={{ fontSize: 11, color: MUTED, marginTop: 20, textAlign: "center" }}>
          Pagina di sola lettura — Elitederma Academy
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // se il link contiene ?master=<id>, mostro solo la vista di sola lettura per la master
  // e salto del tutto login/home/resto dell'app
  const paramMaster = new URLSearchParams(window.location.search).get("master");
  if (paramMaster) {
    return <VistaMaster param={paramMaster} />;
  }
  const paramBiglietti = new URLSearchParams(window.location.search).get("biglietti");
  if (paramBiglietti) {
    return <VistaBiglietti param={paramBiglietti} />;
  }
  // se il link contiene ?modelle=<id>, mostro solo l'elenco dei trattamenti
  // richiesti per questa classe (nessun dato personale/di pagamento)
  const paramModelle = new URLSearchParams(window.location.search).get("modelle");
  if (paramModelle) {
    return <VistaRicercaModelle param={paramModelle} />;
  }

  const [ok, setOk] = useState(sessionStorage.getItem("edc_ok") === "1");
  const [view, setView] = useState("home");
  const [corsoDataAperta, setCorsoDataAperta] = useState(null);
  const [corsi, setCorsi] = useState([]);
  const [location, setLocation] = useState([]);
  const [corsiDate, setCorsiDate] = useState([]);
  const [iscritti, setIscritti] = useState([]);
  const [master, setMaster] = useState([]);
  const [hotel, setHotel] = useState([]);
  const [assistente, setAssistente] = useState([]);
  const [leva, setLeva] = useState([]);
  const [fontDiplomi, setFontDiplomi] = useState(null); // riga singola di impostazioni globali stampa diplomi, o null se non ancora creata
  const [diplomaEccezioni, setDiplomaEccezioni] = useState([]); // diplomi "eccezione" caricabili sul singolo iscritto, al posto del template del corso
  const [segnaposti, setSegnaposti] = useState(null); // riga singola di impostazioni globali stampa segnaposti, o null se non ancora creata
  const [loghiImpostazioni, setLoghiImpostazioni] = useState(null); // riga singola: font condivisi + contatore progressivo globale dei loghi
  const [loghiCategorie, setLoghiCategorie] = useState([]); // le 10 categorie fisse (corsi x Artist/Expert + Master Assistant + Master)
  const [loading, setLoading] = useState(true);
  const [filtroCorsoHome, setFiltroCorsoHome] = useState("");
  const [filtroCittaHome, setFiltroCittaHome] = useState("");
  const [filtroMasterHome, setFiltroMasterHome] = useState("");
  const [cronologicoHome, setCronologicoHome] = useState(false);
  // stessi filtri ma per "Gestione date": vivono qui (non dentro
  // GestioneDate) perché quel componente viene smontato/rimontato ogni
  // volta che si esce e si rientra nella view, e altrimenti perderebbe i
  // filtri impostati in precedenza
  const [filtroCorsoDate, setFiltroCorsoDate] = useState("");
  const [filtroCittaDate, setFiltroCittaDate] = useState("");
  const [filtroMasterDate, setFiltroMasterDate] = useState("");
  const [cronologicoDate, setCronologicoDate] = useState(false);
  const [apriFiltroCorsoHome, setApriFiltroCorsoHome] = useState(false);
  const [apriFiltroCittaHome, setApriFiltroCittaHome] = useState(false);
  const [apriFiltroMasterHome, setApriFiltroMasterHome] = useState(false);
  const selectFiltroCorsoHomeRef = React.useRef(null);
  const selectFiltroCittaHomeRef = React.useRef(null);
  const selectFiltroMasterHomeRef = React.useRef(null);
  useApriSelectAlMontaggio(apriFiltroCorsoHome, selectFiltroCorsoHomeRef);
  useApriSelectAlMontaggio(apriFiltroCittaHome, selectFiltroCittaHomeRef);
  useApriSelectAlMontaggio(apriFiltroMasterHome, selectFiltroMasterHomeRef);

  // fetch "silenzioso": ricarica i dati senza mostrare la schermata di caricamento
  // (usato dopo ogni modifica, così l'app non "sparisce" per un attimo)
  async function fetchDati() {
    const [c, l, cd, i, m, h, a, lv, fd, de, sg, li, lc] = await Promise.all([
      supabase.from("corsi").select("*").order("nome"),
      supabase.from("location").select("*").order("nome"),
      supabase.from("corsi_date").select("*").order("data_inizio"),
      supabase.from("iscritti").select("*").order("ts"),
      supabase.from("master").select("*").order("nome"),
      supabase.from("hotel").select("*").order("nome"),
      supabase.from("assistente").select("*").order("nome"),
      supabase.from("leva").select("*").order("nome"),
      supabase.from("font_diplomi").select("*").limit(1),
      supabase.from("diploma_eccezioni").select("*").order("nome"),
      supabase.from("segnaposti_config").select("*").limit(1),
      supabase.from("loghi_impostazioni").select("*").limit(1),
      supabase.from("loghi_categorie").select("*"),
    ]);
    setCorsi(ordinaCorsi(c.data));
    setLocation(l.data || []);
    setCorsiDate(cd.data || []);
    setIscritti(i.data || []);
    setMaster(m.data || []);
    setHotel(h.data || []);
    setAssistente(a.data || []);
    setLeva(lv.data || []);
    setFontDiplomi(fd.data?.[0] || null);
    setDiplomaEccezioni(de.data || []);
    setSegnaposti(sg.data?.[0] || null);
    setLoghiImpostazioni(li.data?.[0] || null);
    setLoghiCategorie(lc.data || []);
  }

  async function eliminaDataArchiviata(id) {
    const cd = corsiDate.find((x) => x.id === id);
    const numIscritti = iscritti.filter((i) => i.corso_data_id === id).length;
    const etichetta = cd ? (cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`) : "";
    if (!window.confirm(`Stai per cancellare definitivamente una data GIÀ CONCLUSA (${etichetta}) insieme a ${numIscritti} iscritt${numIscritti === 1 ? "o" : "i"} e a tutti i loro dati di pagamento. L'operazione non è reversibile. Continuare?`)) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { window.alert("Errore: " + error.message); return; }
    fetchDati();
  }

  async function caricaIniziale() {
    setLoading(true);
    await fetchDati();
    setLoading(false);
  }

  useEffect(() => { if (ok) caricaIniziale(); }, [ok]);

  // cronologia di navigazione tra le schermate (view + eventuale corsoDataAperta
  // per "scheda"): senza, tornare indietro (swipe o pulsante) riportava sempre
  // e solo alla home invece che alla schermata da cui si era davvero venuti,
  // costringendo a ricominciare da capo la ricerca del corso/iscritto.
  // sottoVistaScheda tiene traccia anche dei passaggi INTERNI a SchedaData
  // (lista iscritti / form iscrivi-modifica / contabilità classe), che non
  // cambiano "view" ma sono comunque passi su cui si vuole poter tornare.
  const [sottoVistaScheda, setSottoVistaScheda] = useState(null);
  // SchedaData inizializza vista/modificandoId/mostraGestione una sola volta,
  // al primo render (useState): per "ripristinarli" quando Indietro/Avanti
  // riportano a uno stato salvato bisogna rimontare il componente da zero,
  // passandogli quello stato come valore iniziale — cambiare questa key è
  // il modo per forzare React a farlo
  const [schedaKey, setSchedaKey] = useState(0);
  function stessoSottoVista(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.vista === b.vista && a.modificandoId === b.modificandoId && a.mostraGestione === b.mostraGestione;
  }

  const statoAttualeRef = React.useRef({ view, corsoDataAperta, sottoVistaScheda });
  const navigazioneStoricoRef = React.useRef(false); // true mentre Indietro/Avanti stanno applicando un cambiamento (per non registrarlo di nuovo)
  const [pilaIndietro, setPilaIndietro] = useState([]);
  const [pilaAvanti, setPilaAvanti] = useState([]);

  useEffect(() => {
    const precedente = statoAttualeRef.current;
    const cambiato = precedente.view !== view || precedente.corsoDataAperta !== corsoDataAperta || !stessoSottoVista(precedente.sottoVistaScheda, sottoVistaScheda);
    if (!cambiato) return;
    if (navigazioneStoricoRef.current) {
      navigazioneStoricoRef.current = false;
    } else {
      // una navigazione "normale" (click su qualcosa): come nel back/forward
      // del browser, la pila avanti non ha più senso e va svuotata
      setPilaIndietro((p) => [...p, precedente]);
      setPilaAvanti([]);
    }
    statoAttualeRef.current = { view, corsoDataAperta, sottoVistaScheda };
  }, [view, corsoDataAperta, sottoVistaScheda]);

  function vaiIndietro() {
    if (pilaIndietro.length === 0) return;
    window.scrollTo(0, 0); // altrimenti la nuova schermata resta alla posizione di scroll di quella precedente
    const precedente = pilaIndietro[pilaIndietro.length - 1];
    navigazioneStoricoRef.current = true;
    setPilaAvanti((p) => [...p, statoAttualeRef.current]);
    setPilaIndietro((p) => p.slice(0, -1));
    // statoAttualeRef.current NON va aggiornato qui: deve restare com'era
    // finché l'effetto qui sopra non vede il cambiamento vero e proprio
    // (dopo che view/corsoDataAperta/sottoVistaScheda sono stati applicati),
    // altrimenti l'effetto troverebbe "nessuna differenza" e non
    // consumerebbe mai il flag navigazioneStoricoRef, che resterebbe
    // bloccato a true e romperebbe ogni Indietro/Avanti successivo
    setView(precedente.view);
    setCorsoDataAperta(precedente.corsoDataAperta);
    setSottoVistaScheda(precedente.sottoVistaScheda);
    setSchedaKey((k) => k + 1);
  }
  function vaiAvanti() {
    if (pilaAvanti.length === 0) return;
    window.scrollTo(0, 0);
    const successivo = pilaAvanti[pilaAvanti.length - 1];
    navigazioneStoricoRef.current = true;
    setPilaIndietro((p) => [...p, statoAttualeRef.current]);
    setPilaAvanti((p) => p.slice(0, -1));
    setView(successivo.view);
    setCorsoDataAperta(successivo.corsoDataAperta);
    setSottoVistaScheda(successivo.sottoVistaScheda);
    setSchedaKey((k) => k + 1);
  }

  // swipe da sinistra a destra su mobile → un passo indietro nella cronologia,
  // swipe da destra a sinistra → un passo avanti (stessa cosa dei pulsanti
  // "Indietro"/"Avanti" in alto, gesto equivalente)
  useEffect(() => {
    let startX = 0, startY = 0, tracking = false;
    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }
    function onTouchEnd(e) {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 80 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        if (dx > 0) vaiIndietro();
        else vaiAvanti();
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pilaIndietro, pilaAvanti]);

  if (!ok) return <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}><Gate onOk={() => setOk(true)} /></div>;

  if (loading) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  function apriData(cd) {
    setCorsoDataAperta(cd.id);
    setSottoVistaScheda({ vista: "lista", modificandoId: null, mostraGestione: false });
    setSchedaKey((k) => k + 1);
    setView("scheda");
  }
  // Setting e Statistiche usano lo stesso codice amministratore e lo
  // stesso sblocco (valido per l'intera sessione) già usato per la
  // contabilità classe: una volta inserito corretto una volta, non viene
  // richiesto di nuovo altrove nella stessa sessione
  function apriViewProtetta(nomeView) {
    if (sessionStorage.getItem("edc_admin_ok") === "1") { setView(nomeView); return; }
    const codice = window.prompt("Codice amministratore:");
    if (codice === null) return;
    if (ADMIN_CODE && codice === ADMIN_CODE) {
      sessionStorage.setItem("edc_admin_ok", "1");
      setView(nomeView);
    } else {
      window.alert("Codice non corretto.");
    }
  }
  function apriStatistiche() { apriViewProtetta("statistiche"); }
  function apriImpostazioni() { apriViewProtetta("impostazioni"); }
  function apriGestioneDate() { apriViewProtetta("gestionedate"); }
  // apre direttamente la pagina di modifica di un iscritto (non solo
  // l'elenco della sua classe): usato da "Ultime iscrizioni", dove ogni
  // riga rappresenta un'iscrizione specifica su cui si vuole entrare subito
  function apriIscritto(i) {
    window.scrollTo(0, 0);
    setCorsoDataAperta(i.corso_data_id);
    setSottoVistaScheda({ vista: "form", modificandoId: i.id, mostraGestione: false });
    setSchedaKey((k) => k + 1);
    setView("scheda");
  }
  const corsoDataApertaObj = corsiDate.find((cd) => cd.id === corsoDataAperta) || null;

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      <div
        style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 640,
          zIndex: 2000, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          background: "#fff", borderRadius: 30, padding: "8px 8px 8px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden" }}>
          <img src="/logo-elitederma.png" alt="Elitederma" style={{ height: 34, width: "auto", flexShrink: 1, minWidth: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={vaiIndietro}
            disabled={pilaIndietro.length === 0}
            style={{
              ...fontBody, background: "#F1ECDF", color: NAVY, border: "none", borderRadius: 20,
              padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: pilaIndietro.length === 0 ? "default" : "pointer", opacity: pilaIndietro.length === 0 ? 0.4 : 1,
            }}
          >
            ← Indietro
          </button>
          <button
            onClick={vaiAvanti}
            disabled={pilaAvanti.length === 0}
            style={{
              ...fontBody, background: "#F1ECDF", color: NAVY, border: "none", borderRadius: 20,
              padding: "8px 14px", fontSize: 13, fontWeight: 600,
              cursor: pilaAvanti.length === 0 ? "default" : "pointer", opacity: pilaAvanti.length === 0 ? 0.4 : 1,
            }}
          >
            Avanti →
          </button>
          <button
            onClick={() => { window.scrollTo(0, 0); setView("home"); setCorsoDataAperta(null); setSottoVistaScheda(null); }}
            aria-label="Home"
            title="Home"
            style={{
              background: NAVY, color: "#fff", border: "none", borderRadius: "50%",
              width: 38, height: 38, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        </div>
      </div>
      {/* riserva lo spazio occupato dalla barra fissa qui sopra, altrimenti
          (essendo "position:fixed") coprirebbe l'inizio del contenuto di
          ogni schermata invece di limitarsi ad affiancarlo */}
      <div style={{ height: 76 }} />
      {view === "home" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "42px 20px 60px" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img src="/logo-elitederma.png" alt="Elitederma" style={{ height: 90, width: "auto" }} />
          </div>
          <div style={{ ...fontDisplay, fontSize: 28, color: NAVY, textAlign: "center", letterSpacing: 0.5, marginTop: 44, marginBottom: 30 }}>CALENDARIO CORSI</div>
          <div style={{ display: "flex", background: "#E3DCC9", borderRadius: 30, padding: 4, gap: 4, marginBottom: 20 }}>
            {[
              { etichetta: "Gestione date", onClick: apriGestioneDate },
              { etichetta: "Statistiche", onClick: apriStatistiche },
              { etichetta: "Setting", onClick: apriImpostazioni },
            ].map(({ etichetta, onClick }) => (
              <button
                key={etichetta}
                onClick={onClick}
                style={{
                  ...fontDisplay, flex: 1, background: "transparent", border: "none", borderRadius: 26,
                  padding: "10px 6px", fontSize: 13, fontWeight: 600, color: NAVY, cursor: "pointer",
                  whiteSpace: "nowrap", textAlign: "center",
                }}
              >
                {etichetta}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <div style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0 }}>
              <CardHome title="Calendario" sub="Vista mensile con tutte le edizioni" onClick={() => setView("calendario")} icona={<IconaCalendarioCard />} />
            </div>
            <div style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0 }}>
              <CardHome title="Cerca iscritto" sub="Trova in quale corso è iscritto" onClick={() => setView("cercaiscritto")} icona={<IconaRicercaCard />} />
            </div>
            <div style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0 }}>
              <CardHome title="Archivio corsi" sub="Corsi con date già concluse" onClick={() => setView("archivio")} icona={<IconaOrologioCard />} />
            </div>
            <div style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0 }}>
              <CardHome title="Generazione loghi" sub="Crea il PNG con nome e codice" onClick={() => setView("generazioneloghi")} icona={<IconaLoghiCard />} />
            </div>
          </div>

          <div style={{ ...fontDisplay, fontSize: 20, color: NAVY, margin: "34px 0 10px" }}>Date in programmazione</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <FiltroPill
                etichetta="Filtra corso" opzioneVuota="Tutti i corsi" opzioni={corsi}
                valore={filtroCorsoHome} etichettaAttiva={corsi.find((c) => c.id === filtroCorsoHome)?.nome.toUpperCase()}
                aperto={apriFiltroCorsoHome} selectRef={selectFiltroCorsoHomeRef}
                onToggle={() => { setApriFiltroCorsoHome((v) => !v); setApriFiltroCittaHome(false); setApriFiltroMasterHome(false); }}
                onChange={(e) => { setFiltroCorsoHome(e.target.value); setApriFiltroCorsoHome(false); }}
                onBlur={() => setApriFiltroCorsoHome(false)}
              />
              <FiltroPill
                etichetta="Filtra città" opzioneVuota="Tutte le città" opzioni={location}
                valore={filtroCittaHome} etichettaAttiva={location.find((l) => l.id === filtroCittaHome)?.nome.toUpperCase()}
                aperto={apriFiltroCittaHome} selectRef={selectFiltroCittaHomeRef}
                onToggle={() => { setApriFiltroCittaHome((v) => !v); setApriFiltroCorsoHome(false); setApriFiltroMasterHome(false); }}
                onChange={(e) => { setFiltroCittaHome(e.target.value); setApriFiltroCittaHome(false); }}
                onBlur={() => setApriFiltroCittaHome(false)}
              />
              <FiltroPill
                etichetta="Filtra master" opzioneVuota="Tutte le master" opzioni={master}
                valore={filtroMasterHome} etichettaAttiva={master.find((m) => m.id === filtroMasterHome)?.nome.toUpperCase()}
                aperto={apriFiltroMasterHome} selectRef={selectFiltroMasterHomeRef}
                onToggle={() => { setApriFiltroMasterHome((v) => !v); setApriFiltroCorsoHome(false); setApriFiltroCittaHome(false); }}
                onChange={(e) => { setFiltroMasterHome(e.target.value); setApriFiltroMasterHome(false); }}
                onBlur={() => setApriFiltroMasterHome(false)}
              />
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <button
                  onClick={() => setCronologicoHome((v) => !v)}
                  style={{ ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20, border: cronologicoHome ? "none" : `1px solid ${CREAM_BORDER}`, background: cronologicoHome ? NAVY : "#fff", color: cronologicoHome ? "#fff" : NAVY, cursor: "pointer", overflow: "hidden", width: "100%", display: "block" }}
                >
                  <EtichettaAdattiva testo="Cronologico" />
                </button>
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <button
                  onClick={() => { setFiltroCorsoHome(""); setFiltroCittaHome(""); setFiltroMasterHome(""); setApriFiltroCorsoHome(false); setApriFiltroCittaHome(false); setApriFiltroMasterHome(false); }}
                  style={{ ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer", overflow: "hidden", width: "100%", display: "block" }}
                >
                  <EtichettaAdattiva testo="Reset filtri" />
                </button>
              </div>
          </div>

          <DateRaggruppatePerCitta
            corsi={corsi}
            location={location}
            cronologico={cronologicoHome}
            corsiDate={corsiDate.filter((cd) =>
              cd.data_fine >= dataOggiStr() &&
              (!filtroCorsoHome || cd.corso_id === filtroCorsoHome) &&
              (!filtroCittaHome || cd.location_id === filtroCittaHome) &&
              (!filtroMasterHome || cd.master_id === filtroMasterHome)
            )}
            iscritti={iscritti}
            master={master}
            onApriData={apriData}
          />
        </div>
      )}

      {view === "archivio" && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
          <TopBar title="Archivio corsi" onBack={() => setView("home")} />
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18 }}>
            Corsi con data già conclusa, completi dei dati registrati. Il cestino cancella definitivamente la data e tutti i suoi iscritti.
          </div>
          <DateRaggruppatePerCitta
            corsi={corsi}
            location={location}
            corsiDate={corsiDate.filter((cd) => cd.data_fine < dataOggiStr())}
            iscritti={iscritti}
            master={master}
            onApriData={apriData}
            onDelete={eliminaDataArchiviata}
          />
        </div>
      )}

      {view === "impostazioni" && (
        <Impostazioni corsi={corsi} location={location} master={master} hotel={hotel} assistente={assistente} leva={leva} ricarica={fetchDati} onBack={() => setView("home")} onApriAssegnazioneMaster={() => setView("assegnazionemaster")} onApriFontDiplomi={() => setView("fontdiplomi")} onApriSettingLoghi={() => setView("settingloghi")} />
      )}

      {view === "gestionedate" && (
        <GestioneDate
          corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master}
          ricarica={fetchDati} onBack={() => setView("home")} onApriData={apriData}
          filtroCorsoDate={filtroCorsoDate} setFiltroCorsoDate={setFiltroCorsoDate}
          filtroCittaDate={filtroCittaDate} setFiltroCittaDate={setFiltroCittaDate}
          filtroMasterDate={filtroMasterDate} setFiltroMasterDate={setFiltroMasterDate}
          cronologicoDate={cronologicoDate} setCronologicoDate={setCronologicoDate}
        />
      )}

      {view === "fontdiplomi" && (
        <FontDiplomi fontDiplomi={fontDiplomi} diplomaEccezioni={diplomaEccezioni} segnaposti={segnaposti} ricarica={fetchDati} onBack={() => setView("impostazioni")} />
      )}

      {view === "settingloghi" && (
        <SettingLoghi loghiImpostazioni={loghiImpostazioni} loghiCategorie={loghiCategorie} ricarica={fetchDati} onBack={() => setView("impostazioni")} />
      )}

      {view === "generazioneloghi" && (
        <GenerazioneLoghi master={master} loghiCategorie={loghiCategorie} loghiImpostazioni={loghiImpostazioni} ricarica={fetchDati} onBack={() => setView("home")} />
      )}

      {view === "statistiche" && (
        <Statistiche
          onBack={() => setView("home")}
          onApriVenditori={() => setView("statisticavenditori")}
          onApriUltimeIscrizioni={() => setView("ultimeiscrizioni")}
        />
      )}

      {view === "statisticavenditori" && (
        <StatisticaVenditori corsi={corsi} corsiDate={corsiDate} iscritti={iscritti} onBack={() => setView("statistiche")} />
      )}

      {view === "ultimeiscrizioni" && (
        <UltimeIscrizioni corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriIscritto={apriIscritto} />
      )}

      {view === "assegnazionemaster" && (
        <AssegnazioneMaster corsi={corsi} location={location} corsiDate={corsiDate} master={master} hotel={hotel} assistente={assistente} leva={leva} ricarica={fetchDati} onBack={() => setView("impostazioni")} />
      )}

      {view === "calendario" && (
        <Calendario corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} ricarica={fetchDati} />
      )}

      {view === "cerca" && (
        <CercaCorso corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "cercaiscritto" && (
        <CercaIscritto corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "scheda" && corsoDataApertaObj && (
        <SchedaData
          key={schedaKey}
          corsoData={corsoDataApertaObj}
          corsi={corsi}
          location={location}
          corsiDate={corsiDate}
          iscritti={iscritti}
          master={master}
          fontDiplomi={fontDiplomi}
          diplomaEccezioni={diplomaEccezioni}
          segnaposti={segnaposti}
          ricarica={fetchDati}
          onBack={() => setView("home")}
          sottoVistaIniziale={sottoVistaScheda}
          onCambiaSottoVista={setSottoVistaScheda}
        />
      )}
    </div>
  );
}
