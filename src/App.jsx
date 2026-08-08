import React, { useEffect, useMemo, useRef, useState } from "react";
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
// serif elegante per il titolo del corso nell'intestazione scura
// (Contabilità classe / schede di inserimento allievo): unico punto dove
// si usa questo font, per dargli un peso più "editoriale" rispetto al
// sans-serif del resto dell'app
const fontHero = { fontFamily: "'Playfair Display',serif", fontWeight: 700 };
const fontCondensato = { fontFamily: "'Sofia Sans Condensed',sans-serif" }; // più stretto del normale a parità di dimensione: usato per i nomi dei corsi sulle barre del calendario, dove lo spazio orizzontale è poco

// larghezze di default delle colonne della tabella "Assegnazione Master"
// (l'utente può trascinarle: la scelta resta salvata in localStorage)
const LARGHEZZE_COLONNE_DEFAULT = [54, 100, 70, 60, 100, 90, 100, 90, 150, 150, 100, 100];
const CHIAVE_LARGHEZZE_COLONNE = "assegnazioneMaster_larghezzeColonne";
const CHIAVE_LARGHEZZE_VENDITORI = "statisticaVenditori_larghezzeColonne";
const ETICHETTE_COLONNE_MASTER = ["Data", "Corso", "Città", "Sede OK?", "Master", "Note", "Assistenti", "Leve", "Viaggio master", "Viaggio ass.", "Alloggio", "Note viaggio"];

// una "stagione" va da settembre di un anno ad agosto dell'anno successivo,
// identificata dall'anno in cui inizia (es. 2026 = Stagione 2026-2027)
const CHIAVE_STAGIONE_BLOCCATA = "assegnazioneMaster_stagioneBloccata";
function annoStagioneDaData(dataStr) {
  const [anno, mese] = dataStr.split("-").map(Number);
  return mese >= 9 ? anno : anno - 1;
}
function stagioneCorrente() { return annoStagioneDaData(dataOggiStr()); }
function etichettaStagione(annoInizio) { return `Stagione ${annoInizio}–${annoInizio + 1}`; }

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_ABBR = ["GEN","FEB","MAR","APR","MAG","GIU","LUG","AGO","SET","OTT","NOV","DIC"];
// ordine "anno scolastico" (settembre -> agosto), come indici 0-based in MESI/MESI_ABBR
const ORDINE_MESI_SCOLASTICO = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];
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
// icone della pagina "Setting" (intestazione dei 3 gruppi + voci di lista)
function IconaChevronDestra({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconaGruppoTeam({ size = 22, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.7 20c0-3.8 2.8-6 6.3-6s6.3 2.2 6.3 6" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M15.2 14.3c2.9.3 5.8 2 5.8 5.7" />
    </svg>
  );
}
function IconaLeveRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 18l9 5 9-5" />
    </svg>
  );
}
function IconaAssistentiRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 20c0-3.6 2.7-5.7 6-5.7s6 2.1 6 5.7" />
      <circle cx="16.3" cy="8.7" r="2.3" />
      <path d="M14.7 14.5c2.7.3 5.3 1.9 5.3 5.3" />
    </svg>
  );
}
function IconaMasterRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M3 20c0-4 3.1-6.5 7-6.5" />
      <path d="M14 14.5a2.3 2.3 0 0 1 3.3-2.1" />
      <path d="M20.3 15.4a2.3 2.3 0 0 1-3.3 2.1" />
      <path d="M15.6 14.9l1.2 2.1" />
    </svg>
  );
}
function IconaVenditoreRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
function IconaGruppoSediCorsi({ size = 22, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="12" height="17" rx="1.5" />
      <path d="M7 8h.01M11 8h.01M7 12h.01M11 12h.01M7 16h.01M11 16h.01" />
      <path d="M15 21v-6a5 5 0 0 1 5 5v1" />
      <circle cx="18.5" cy="14" r="0.6" fill={color} stroke="none" />
    </svg>
  );
}
function IconaCorsoRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5.5C10.5 4.3 8 3.7 3 4v14.5c5 0 7.5.6 9 1.5" />
      <path d="M12 5.5C13.5 4.3 16 3.7 21 4v14.5c-5 0-7.5.6-9 1.5" />
      <path d="M12 5.5v15" />
    </svg>
  );
}
function IconaHotelRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h.01M13 7h.01M16 7h.01M8 11h.01M13 11h.01M16 11h.01M8 15h.01M13 15h.01M16 15h.01" />
      <path d="M9 21v-3.5h6V21" />
    </svg>
  );
}
function IconaTipoModellaRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9Z" transform="translate(0.5 0.5)" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </svg>
  );
}
function IconaGruppoDocumenti({ size = 22, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h9l3 3V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V4A1.5 1.5 0 0 1 6 2.5Z" />
      <path d="M8 7h6M8 10.5h6" />
      <circle cx="9.5" cy="18" r="3" />
      <path d="M7.9 20.6L7.2 23.5l2.3-1.3 2.3 1.3-.7-2.9" />
    </svg>
  );
}
function IconaDiplomaRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h9l3 3V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V4A1.5 1.5 0 0 1 6 2.5Z" />
      <path d="M8 7h6M8 10.5h6" />
      <circle cx="9.5" cy="18" r="3" />
      <path d="M7.9 20.6L7.2 23.5l2.3-1.3 2.3 1.3-.7-2.9" />
    </svg>
  );
}
function IconaFormeRiga({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6" />
      <path d="M16.5 8l5 12h-11l6-12Z" />
    </svg>
  );
}
// icone della pagina "ERP" (testata + card KPI)
function IconaRicercaErp({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function IconaCampanellaErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function IconaIngranaggioErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V19a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
function IconaRicevutaErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h12v19l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5V2.5Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
function IconaBustaErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5l9 6.5 9-6.5" />
    </svg>
  );
}
function IconaLaureaErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9l10-4.5L22 9l-10 4.5L2 9Z" />
      <path d="M6 11.3V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.7" />
      <path d="M22 9v6" />
    </svg>
  );
}
function IconaScatolaErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16V8Z" />
      <path d="M3 8l9 4.5L21 8" />
      <path d="M12 12.5V21" />
    </svg>
  );
}
function IconaClipboardErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11.5h7M8.5 15h7" />
    </svg>
  );
}
function IconaChevronGiuErp({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
// icone della barra azioni con intestazione scura (Contabilità classe /
// schede di inserimento allievo)
function IconaFrecciaSinistra({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="M11 18l-6-6 6-6" />
    </svg>
  );
}
function IconaLibroContabile({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" /><path d="M7 13h4M7 16.5h7" />
    </svg>
  );
}
function IconaStampante({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}
function IconaBigliettoSegnaposto({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.5a1.5 1.5 0 0 0 0-3Z" />
      <path d="M10 6v12" strokeDasharray="1.5 2.5" />
    </svg>
  );
}
function IconaPersonaAggiungi({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 20c0-4 3.1-6.5 7-6.5" />
      <path d="M17 9v6M14 12h6" />
    </svg>
  );
}
function IconaRiepilogoCircolare({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h7l3 3V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5" />
    </svg>
  );
}
// decorazione a onde nell'angolo dell'intestazione scura: puramente
// ornamentale (pointer-events:none), non interattiva
function DecorazioneOndeHero() {
  return (
    <svg
      width="200" height="180" viewBox="0 0 200 180" fill="none"
      style={{ position: "absolute", top: 0, right: 0, pointerEvents: "none", opacity: 0.35 }}
    >
      <path d="M40 180C90 140 110 100 90 40" stroke={GOLD} strokeWidth="1" opacity="0.5" />
      <path d="M70 180C120 140 140 100 120 30" stroke={GOLD} strokeWidth="1" opacity="0.4" />
      <path d="M100 180C150 140 170 100 150 20" stroke={GOLD} strokeWidth="1" opacity="0.3" />
      <path d="M130 180C180 140 200 100 180 10" stroke={GOLD} strokeWidth="1" opacity="0.2" />
    </svg>
  );
}
// icone della pagina "Assegnazione Master"
function IconaLucchetto({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconaSpuntaCerchio({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.3l2.4 2.4 5-5.2" />
    </svg>
  );
}
function IconaInfoCerchio({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6h.01" />
    </svg>
  );
}
function IconaGrigliaTabella({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </svg>
  );
}
function IconaCalendarioLeve({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}
function IconaCopiaFile({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
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

// card grande e quadrata della home (griglia 4x2): solo titolo, nessuna
// icona/sottotitolo. "attivo=false" la mostra spenta con badge "Non
// attivo", per aree non ancora costruite
// su mobile le tile sono più basse (non quadrate) e con testo/padding
// più compatti: le 8 devono stare tutte a schermo, senza scroll, su un
// iPhone normale — quadrate come su desktop non ci sarebbero mai state
function TileHome({ title, attivo = true, onClick }) {
  const isMobile = useIsMobile();
  return (
    <button
      onClick={attivo ? onClick : undefined}
      disabled={!attivo}
      style={{
        ...fontBody, textAlign: "left", width: "100%", boxSizing: "border-box", aspectRatio: "1", position: "relative",
        display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 0,
        background: attivo ? "#FFFFFF" : "#EDEAE0", border: `1px solid ${CREAM_BORDER}`, borderRadius: isMobile ? 10 : 16,
        padding: isMobile ? "8px 10px" : 22, cursor: attivo ? "pointer" : "default",
      }}
    >
      {!attivo && (
        <span style={{ position: "absolute", top: isMobile ? 6 : 16, right: isMobile ? 8 : 18, ...fontBody, fontSize: isMobile ? 8 : 11, color: MUTED }}>Non attivo</span>
      )}
      <span style={{ ...fontDisplay, fontSize: isMobile ? 13 : 22, fontWeight: 700, lineHeight: 1.15, color: attivo ? NAVY : MUTED }}>{title}</span>
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
// cambio del metodo di pagamento di una quota (o di una sua riga extra):
// stessa logica già usata per "Quota acconto" (gestisce anche "Cash no
// iva", che azzera l'imponibile mostrato/bloccato), estratta qui perché
// serve identica anche per ogni riga aggiunta con "+"
function conMetodoAggiornato(prev, v) {
  if (v === "Cash no iva") {
    return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "", imponibile: "" };
  }
  if (prev.metodo === "Cash no iva" && prev.totale !== "") {
    return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "", imponibile: String(round2(parseNum(prev.totale) / 1.22)) };
  }
  return { ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "" };
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
// pillola rosso/verde "Da pagare"/"Pagato": stesso linguaggio visivo del
// semaforo() già in uso altrove nell'app (Sì/NO verde/rosso), qui applicato
// a una singola riga di pagamento (acconto/pre corso, comprese le righe
// aggiunte con "+")
function SemaforoPagamento({ pagato, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...fontBody, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
        border: "none", borderRadius: 8, padding: "6px 14px", flexShrink: 0,
        background: pagato ? "#E8F5E9" : "#FDECEC", color: pagato ? "#2E7D32" : "#C0392B",
      }}
    >
      {pagato ? "Pagato" : "Da pagare"}
    </button>
  );
}
function BloccoQuota({ titolo, valori, onImponibile, onTotale, onMetodo, onInteressi, onTotaleConInteressi, soloLettura, imponibileBloccato, totaleBloccato, opzioniMetodo, pagato, onPagato, onRimuovi }) {
  const totaleConInteressi = round2(parseNum(valori.totale) + parseNum(valori.interessi || 0));
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10, background: soloLettura ? BG : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</div>
        {onRimuovi && (
          <button onClick={onRimuovi} title="Rimuovi questo pagamento" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 2, display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        )}
      </div>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...fontBody, fontSize: 13, color: NAVY }}>
            {(opzioniMetodo || ["Sito", "Bonifico", "Pos", "Contanti"]).map((opz) => (
              <label key={opz} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="radio" name={titolo + "-metodo"} checked={valori.metodo === opz} onChange={() => onMetodo(opz)} />
                {opz}
              </label>
            ))}
          </div>
          {onPagato && <SemaforoPagamento pagato={pagato} onClick={() => onPagato(!pagato)} />}
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
  const [verificando, setVerificando] = useState(false);
  const urlDebug = import.meta.env.VITE_SUPABASE_URL || "(VITE_SUPABASE_URL non impostata)";
  return (
    <div style={{ ...fontBody, boxSizing: "border-box", maxWidth: 340, margin: "0 auto", minHeight: "100vh", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", textAlign: "center" }}>
      <div />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img src="/logo-elitederma.png" alt="Elitederma" style={{ height: 90, width: "auto", marginBottom: 30 }} />
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, letterSpacing: 0.5, marginBottom: 30 }}>Gestionale Academy</div>
        <input
          type="password"
          placeholder="Codice d'accesso"
          value={code}
          onChange={(e) => { setCode(e.target.value); setErr(false); }}
          style={{ ...inputStyle, width: "100%", textAlign: "center", marginBottom: 12 }}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        <Button onClick={check} disabled={verificando} style={{ width: "100%" }}>{verificando ? "Verifico…" : "Entra"}</Button>
        {err && <div style={{ color: "#C0392B", fontSize: 13, marginTop: 10 }}>Codice non corretto</div>}
      </div>
      <div>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          programmato da<br />GianLuca Rocca
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 14, wordBreak: "break-all" }}>
          Database collegato: {urlDebug}
        </div>
      </div>
    </div>
  );
  // le 3 password di accesso (User generico, Amministratore, Programmatore)
  // sono impostabili dalla rotellina e vivono in password_menu — qui, prima
  // del login, non sono ancora caricate in memoria (fetchDati parte solo
  // dopo essere entrati), quindi si interrogano al volo con una query
  // dedicata; se non è mai stata impostata una versione personalizzata si
  // ricade sui valori di sempre (env var, o "1234" per il Programmatore)
  async function check() {
    setVerificando(true);
    const { data } = await supabase.from("password_menu").select("vista, password").in("vista", ["__user", "__admin", "__programmatore"]);
    setVerificando(false);
    const valoreDi = (v) => (data || []).find((r) => r.vista === v)?.password;
    const pwProgrammatore = valoreDi("__programmatore") || "1234";
    const pwAmministratore = valoreDi("__admin") || ADMIN_CODE;
    const pwUser = valoreDi("__user") || ACCESS_CODE;
    let ruolo = null;
    if (pwProgrammatore && code === pwProgrammatore) ruolo = "programmatore";
    else if (pwAmministratore && code === pwAmministratore) ruolo = "amministratore";
    else if (!pwUser || code === pwUser) ruolo = "user";
    if (ruolo) {
      sessionStorage.setItem("edc_ok", "1");
      sessionStorage.setItem("edc_ruolo", ruolo);
      onOk(ruolo);
    } else {
      setErr(true);
    }
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
  const [ricercaTesto, setRicercaTesto] = useState("");

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
    .filter((cd) => {
      const q = ricercaTesto.trim().toLowerCase();
      if (!q) return true;
      const nomiAssistenti = (cd.assistente_ids || []).map((id) => assistente.find((a) => a.id === id)?.nome || "");
      const nomiLeve = (cd.leva_ids || []).map((id) => leva.find((l) => l.id === id)?.nome || "");
      const campi = [
        corsoById[cd.corso_id]?.nome, locById[cd.location_id]?.nome,
        master.find((m) => m.id === cd.master_id)?.nome,
        ...nomiAssistenti, ...nomiLeve,
      ];
      return campi.some((c) => (c || "").toLowerCase().includes(q));
    })
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

  // "Carico assegnazioni": quante volte ciascuna persona compare come
  // master, assistente o leva (tra le edizioni future della stagione
  // vista, indipendentemente dagli altri filtri attivi) — un'unica
  // classifica del carico di lavoro complessivo, non solo delle master
  const conteggioCarico = {};
  corsiDate
    .filter((cd) => cd.data_fine >= dataOggiStr() && annoStagioneDaData(cd.data_inizio) === stagioneVista)
    .forEach((cd) => {
      if (cd.master_id) {
        const nome = master.find((m) => m.id === cd.master_id)?.nome;
        if (nome) conteggioCarico[nome] = (conteggioCarico[nome] || 0) + 1;
      }
      (cd.assistente_ids || []).forEach((id) => {
        const nome = assistente.find((a) => a.id === id)?.nome;
        if (nome) conteggioCarico[nome] = (conteggioCarico[nome] || 0) + 1;
      });
      (cd.leva_ids || []).forEach((id) => {
        const nome = leva.find((l) => l.id === id)?.nome;
        if (nome) conteggioCarico[nome] = (conteggioCarico[nome] || 0) + 1;
      });
    });
  const caricoAssegnazioni = Object.entries(conteggioCarico)
    .map(([nome, n]) => ({ nome, n }))
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

  async function caricaBiglietti(cd, fileList, campo) {
    const nuovi = [];
    for (const file of Array.from(fileList || [])) {
      const percorso = `${cd.id}/biglietto-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file);
      if (error) { window.alert("Errore caricamento: " + error.message); return; }
      nuovi.push(percorso);
    }
    if (nuovi.length === 0) return;
    await salvaCampo(cd.id, campo, [...(cd[campo] || []), ...nuovi]);
  }

  async function cancellaBiglietti(cd, campo) {
    const n = (cd[campo] || []).length;
    if (n === 0) return;
    if (!window.confirm(`Vuoi cancellare ${n === 1 ? "il file caricato" : `i ${n} file caricati`}?`)) return;
    await salvaCampo(cd.id, campo, []);
    window.alert("Eseguito.");
  }

  async function copiaBiglietti(cd, campo, tipo) {
    const file = cd[campo] || [];
    if (file.length === 0) { window.alert("Non ci sono biglietti."); return; }
    const corso = corsoById[cd.corso_id];
    const loc = locById[cd.location_id];
    const leggibile = [slugify(corso?.nome), slugify(loc?.nome), slugData(cd.data_inizio, cd.data_fine)].filter(Boolean).join("/");
    const url = `${window.location.origin}${window.location.pathname}?biglietti=${leggibile}${tipo ? `&tipo=${tipo}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Link copiato.");
    } catch (e) {
      window.alert("Impossibile copiare automaticamente. Link: " + url);
    }
  }

  const fontScheda = { fontFamily: "'Sofia Sans Condensed',sans-serif" };
  const bordoV = `1px solid ${CREAM_BORDER}`;
  const celStyle = { padding: "10px 8px", borderBottom: bordoV, verticalAlign: "middle" };
  const thStyle = { ...celStyle, ...fontScheda, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", whiteSpace: "nowrap", background: "#F7F5EF", borderBottom: `1px solid ${CREAM_BORDER}` };
  const campoStyle = { ...fontScheda, fontSize: 12, fontWeight: 600, padding: "7px 8px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, width: "100%", boxSizing: "border-box", background: "#fff", color: NAVY };
  const semaforo = (attivo, onClick, size = "normale") => (
    <button
      onClick={onClick}
      style={{
        ...fontScheda, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
        border: "none", borderRadius: 8,
        padding: size === "piccolo" ? "5px 12px" : "6px 14px",
        background: attivo ? "#E8F5E9" : "#FDECEC", color: attivo ? "#2E7D32" : "#C0392B",
      }}
    >
      {attivo ? "Sì" : "NO"}
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

  function filtroDropdown(chiave, etichetta, valore, setValore, opzioni, Icona) {
    return (
      <div style={{ position: "relative", flex: "1 1 150px", minWidth: 130 }}>
        <button
          onClick={() => setApriFiltro(apriFiltro === chiave ? "" : chiave)}
          style={{
            ...fontScheda, width: "100%", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
            padding: "10px 12px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${valore ? NAVY : CREAM_BORDER}`, background: "#fff", color: NAVY,
          }}
        >
          {Icona && <Icona size={16} color={valore ? NAVY : MUTED} />}
          <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {valore ? opzioni.find((o) => o.id === valore)?.nome?.toUpperCase() : etichetta}
          </span>
          <IconaChevronGiuErp size={13} color={MUTED} />
        </button>
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

  // cella "Viaggio master"/"Viaggio ass.": pallino rosso/verde (prenotato
  // o no), icona per copiare il link di sola lettura dei biglietti, "+"
  // per caricarne di nuovi, conteggio di quelli già presenti
  function cellaViaggio(cd, campoPrenotato, campoFile, tipoLink) {
    const nBiglietti = (cd[campoFile] || []).length;
    const attivo = !!cd[campoPrenotato];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
        <button
          onClick={() => salvaCampo(cd.id, campoPrenotato, !attivo)}
          title={attivo ? "Viaggio prenotato" : "Viaggio non prenotato"}
          style={{ width: 18, height: 18, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: attivo ? "#2E7D32" : "#C0392B", flexShrink: 0 }}
        />
        <button
          onClick={() => copiaBiglietti(cd, campoFile, tipoLink)}
          title="Copia link biglietti"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, border: `1px solid ${CREAM_BORDER}`, background: "#fff", cursor: "pointer", flexShrink: 0, padding: 0 }}
        >
          <IconaCopiaFile size={14} color={NAVY} />
        </button>
        <label style={{ ...fontScheda, fontSize: 11, fontWeight: 700, color: NAVY, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
          +
          <input type="file" multiple accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => { caricaBiglietti(cd, e.target.files, campoFile); e.target.value = ""; }} />
        </label>
        {nBiglietti > 0 && (
          <span
            onClick={() => cancellaBiglietti(cd, campoFile)}
            title="Clicca per cancellare i file caricati"
            style={{ ...fontScheda, fontSize: 8, color: MUTED, whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline" }}
          >
            {nBiglietti} file
          </span>
        )}
      </div>
    );
  }

  function tabellaMese(righeMese) {
    return (
      <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, marginBottom: 28, boxShadow: "0 10px 24px -14px rgba(14,27,51,0.2)" }}>
        <table style={{ borderCollapse: "collapse", width: larghezzaTabella, tableLayout: "fixed" }}>
          <colgroup>{COLONNE.map((c, i) => <col key={i} style={{ width: c.larghezza }} />)}</colgroup>
          <thead>
            <tr>
              {ETICHETTE_COLONNE_MASTER.map((etichetta, i) => (
                <th key={i} style={{ ...thStyle, position: "relative" }}>
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
                    {cellaViaggio(cd, "viaggio_prenotato", "viaggio_file", undefined)}
                  </td>
                  <td style={celStyle}>
                    {cellaViaggio(cd, "viaggio_assistente_prenotato", "viaggio_assistente_file", "assistente")}
                  </td>
                  <td style={celStyle}>
                    <select style={campoStyle} value={cd.alloggio_id || ""} onChange={(e) => salvaCampo(cd.id, "alloggio_id", e.target.value || null)}>
                      <option value="">—</option>
                      {hotel.map((h) => <option key={h.id} value={h.id}>{h.nome.toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={celStyle}>
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
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>Team</div>
            <div style={{ ...fontDisplay, fontSize: 32, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Assegnazione Master</div>
            <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Organizza il team, gli assistenti e le trasferte per ogni corso</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select
              value={stagioneVista}
              onChange={(e) => setStagioneVista(parseInt(e.target.value, 10))}
              style={{ ...inputStyle, ...fontBody, fontWeight: 600, width: "auto", borderRadius: 10 }}
            >
              {stagioniDisponibili.map((anno) => (
                <option key={anno} value={anno}>{etichettaStagione(anno)}</option>
              ))}
            </select>
            {stagioneBloccata === stagioneVista ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#EEF1FA", border: "1px solid #D9DEF2", borderRadius: 10, padding: "9px 14px", ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>
                <IconaSpuntaCerchio size={15} color="#2E7D32" /> Stagione di default
              </div>
            ) : (
              <button
                onClick={bloccaStagioneDiDefault}
                style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Imposta come default
              </button>
            )}
            {stagioneBloccata != null && (
              <button
                onClick={sbloccaStagione}
                style={{ display: "flex", alignItems: "center", gap: 7, ...fontBody, fontSize: 13, fontWeight: 700, color: "#fff", background: NAVY, border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <IconaLucchetto size={15} color="#fff" /> Sblocca
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF1FA", border: "1px solid #D9DEF2", borderRadius: 10, padding: "11px 16px", ...fontBody, fontSize: 13, color: NAVY, marginBottom: 24 }}>
          <IconaInfoCerchio size={16} color="#4A5FBF" />
          Solo le edizioni future · Le modifiche vengono salvate automaticamente
        </div>

        <div style={{ ...cardStyle, boxShadow: "0 10px 24px -14px rgba(14,27,51,0.15)", marginBottom: 24 }}>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>Carico assegnazioni</div>
          {caricoAssegnazioni.length === 0 ? (
            <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna assegnazione ancora.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {caricoAssegnazioni.map((p) => (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "6px 8px 6px 6px", background: "#fff" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: GOLD, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", ...fontScheda, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {inizialiNomeLogo(p.nome)}
                  </div>
                  <span style={{ ...fontScheda, fontSize: 11.5, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{p.nome.toUpperCase()}</span>
                  <span style={{ ...fontScheda, fontSize: 10.5, fontWeight: 700, color: "#fff", background: NAVY, borderRadius: 5, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "2 1 220px", minWidth: 180 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
              <IconaRicercaErp size={16} color={MUTED} />
            </span>
            <input
              value={ricercaTesto}
              onChange={(e) => setRicercaTesto(e.target.value)}
              placeholder="Cerca corso, città o persona"
              style={{ ...inputStyle, ...fontBody, fontSize: 13, paddingLeft: 36, borderRadius: 10, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          {filtroDropdown("corso", "Corso", filtroCorso, setFiltroCorso, corsi, IconaLaureaErp)}
          {filtroDropdown("citta", "Città", filtroCitta, setFiltroCitta, location, IconaPin)}
          {filtroDropdown("master", "Master", filtroMaster, setFiltroMaster, master, IconaMasterRiga)}
          {filtroDropdown("assistente", "Assistente", filtroAssistente, setFiltroAssistente, assistente, IconaAssistentiRiga)}
          {filtroDropdown("leva", "Leve", filtroLeva, setFiltroLeva, leva, IconaCalendarioLeve)}
          {(filtriAttivi || ricercaTesto) && (
            <button
              onClick={() => { setFiltroCorso(""); setFiltroCitta(""); setFiltroMaster(""); setFiltroAssistente(""); setFiltroLeva(""); setApriFiltro(""); setRicercaTesto(""); }}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: GOLD, background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap", padding: "10px 4px" }}
            >
              Azzera filtri
            </button>
          )}
        </div>

        {chiaviMese.length === 0 && (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, textAlign: "center", padding: 20 }}>Nessuna data in programmazione.</div>
        )}
        {chiaviMese.map((chiave) => (
          <div key={chiave}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{gruppiMese[chiave].etichetta.toUpperCase()}</div>
                <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>
                  {gruppiMese[chiave].righe.length} cors{gruppiMese[chiave].righe.length === 1 ? "o" : "i"} visibil{gruppiMese[chiave].righe.length === 1 ? "e" : "i"}
                </div>
              </div>
              <div
                title="Al momento è disponibile solo la vista tabella"
                style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 13, fontWeight: 600, color: MUTED, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "8px 12px", opacity: 0.6, cursor: "default", background: "#fff" }}
              >
                <IconaGrigliaTabella size={15} color={MUTED} /> Vista tabella <IconaChevronGiuErp size={12} color={MUTED} />
              </div>
            </div>
            {tabellaMese(gruppiMese[chiave].righe)}
          </div>
        ))}
      </div>
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

// ---------- Dashboard venditori ----------
// tasto "pillola" per le tab (In programmazione/Archivio, Elenco/Calendario)
function TabPillola({ attivo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 16, border: attivo ? "none" : `1px solid ${CREAM_BORDER}`, background: attivo ? NAVY : "#fff", color: attivo ? "#fff" : NAVY, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
    >
      {children}
    </button>
  );
}

// colori pastello per le tipologie di modella nella Dashboard modelle: le
// tipologie sono libere (catalogo "Definisci tipi di modelle", non un enum
// fisso), quindi il colore si sceglie con un hash del testo invece di un
// elenco codificato — stabile per ogni nome, senza doverli conoscere prima
const PALETTE_TIPOLOGIA = [
  { bg: "#FBE5D6", fg: "#8A4B1F" },
  { bg: "#FCE4EC", fg: "#9B3A5B" },
  { bg: "#E3F2FD", fg: "#1F5C8A" },
  { bg: "#EDE7F6", fg: "#5B3B8A" },
  { bg: "#E8F5E9", fg: "#2E7D32" },
  { bg: "#FFF8E1", fg: "#8A6D1F" },
];
function coloreTipologia(testo) {
  let hash = 0;
  for (let i = 0; i < (testo || "").length; i++) hash = (hash * 31 + testo.charCodeAt(i)) | 0;
  return PALETTE_TIPOLOGIA[Math.abs(hash) % PALETTE_TIPOLOGIA.length];
}
function BadgeTipologia({ testo, conteggio }) {
  const c = coloreTipologia(testo);
  return (
    <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 20, background: c.bg, color: c.fg, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      {testo}{conteggio != null && <span style={{ fontWeight: 700 }}>{conteggio}</span>}
    </span>
  );
}

// blocco "Date corsi" (tab In programmazione/Archivio, ricerca, filtri,
// Elenco/Calendario): riusato sia da "Dashboard venditori" sia da
// "Gestione modelle" — cambia solo dove porta il click su una data
// (onApriData), passato dal chiamante
function SezioneDateCorsi({
  corsi, location, corsiDate, iscritti, master, ricarica, onApriData,
  filtroCorsoHome, setFiltroCorsoHome, filtroCittaHome, setFiltroCittaHome, filtroMasterHome, setFiltroMasterHome,
  cronologicoHome, setCronologicoHome,
  apriFiltroCorsoHome, setApriFiltroCorsoHome, apriFiltroCittaHome, setApriFiltroCittaHome, apriFiltroMasterHome, setApriFiltroMasterHome,
  selectFiltroCorsoHomeRef, selectFiltroCittaHomeRef, selectFiltroMasterHomeRef,
  // opzionali: solo "Gestione corsi" li passa, per matita/cestino inline
  // sulle righe. Dashboard venditori e Gestione modelle restano di sola
  // consultazione non passandoli (undefined).
  onEdit, onDelete, idInModifica, renderModifica,
  // opzionali: quando il chiamante ha già le proprie tab esterne
  // equivalenti (es. Dashboard modelle: Elenco richieste/Calendario/
  // Archivio), può forzare qui tab/modo e nascondere le pillole interne
  // per non duplicarle
  tabForzata, modoForzato, nascondiControlli,
}) {
  const [vistaDateTabInterna, setVistaDateTabInterna] = useState("programmazione"); // programmazione | archivio
  const [vistaDateModoInterno, setVistaDateModoInterno] = useState("elenco"); // elenco | calendario
  const vistaDateTab = tabForzata || vistaDateTabInterna;
  const vistaDateModo = modoForzato || vistaDateModoInterno;
  const setVistaDateTab = setVistaDateTabInterna;
  const setVistaDateModo = setVistaDateModoInterno;
  const [ricercaDate, setRicercaDate] = useState("");
  const oggiStr = dataOggiStr();

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const masterById = useMemo(() => Object.fromEntries((master || []).map((m) => [m.id, m])), [master]);

  const numeroInProgrammazione = corsiDate.filter((cd) => cd.data_fine >= oggiStr).length;
  const corsiDateFiltrate = corsiDate.filter((cd) => {
    if (vistaDateTab === "programmazione" ? cd.data_fine < oggiStr : cd.data_fine >= oggiStr) return false;
    if (filtroCorsoHome && cd.corso_id !== filtroCorsoHome) return false;
    if (filtroCittaHome && cd.location_id !== filtroCittaHome) return false;
    if (filtroMasterHome && cd.master_id !== filtroMasterHome) return false;
    const termini = ricercaDate.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (termini.length === 0) return true;
    const nomiAllievi = iscritti.filter((i) => i.corso_data_id === cd.id).map((i) => `${i.nome} ${i.cognome}`);
    const mesiCd = [cd.data_inizio, cd.data_fine].filter(Boolean).map((d) => MESI[parseInt(d.slice(5, 7), 10) - 1]);
    const anniCd = [cd.data_inizio, cd.data_fine].filter(Boolean).map((d) => d.slice(0, 4));
    const testo = [corsoById[cd.corso_id]?.nome, locById[cd.location_id]?.nome, masterById[cd.master_id]?.nome, ...nomiAllievi, ...mesiCd, ...anniCd]
      .filter(Boolean).join(" ").toLowerCase();
    // ogni termine digitato deve trovarsi da qualche parte nel testo
    // (in qualunque ordine): "mei milano" trova Mei anche se sta in un
    // campo diverso da "milano" (es. nome allievo + città)
    return termini.every((t) => testo.includes(t));
  });

  return (
    <div>
      {!nascondiControlli && (
        <>
          <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY, marginBottom: 12, textAlign: "center", textTransform: "uppercase" }}>Corsi in programmazione</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TabPillola attivo={vistaDateTab === "programmazione"} onClick={() => setVistaDateTab("programmazione")}>In programmazione ({numeroInProgrammazione})</TabPillola>
              <TabPillola attivo={vistaDateTab === "archivio"} onClick={() => setVistaDateTab("archivio")}>Archivio date</TabPillola>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <TabPillola attivo={vistaDateModo === "elenco"} onClick={() => setVistaDateModo("elenco")}>Elenco</TabPillola>
              <TabPillola attivo={vistaDateModo === "calendario"} onClick={() => setVistaDateModo("calendario")}>Calendario</TabPillola>
            </div>
          </div>
        </>
      )}
      <CampoRicerca value={ricercaDate} onChange={(e) => setRicercaDate(e.target.value)} placeholder="Cerca allievo, corso, sede o master…" style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
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
        <button
          onClick={() => setCronologicoHome((v) => !v)}
          style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 20, border: cronologicoHome ? "none" : `1px solid ${CREAM_BORDER}`, background: cronologicoHome ? NAVY : "#fff", color: cronologicoHome ? "#fff" : NAVY, cursor: "pointer" }}
        >
          Cronologico
        </button>
        <button
          onClick={() => { setFiltroCorsoHome(""); setFiltroCittaHome(""); setFiltroMasterHome(""); setRicercaDate(""); setApriFiltroCorsoHome(false); setApriFiltroCittaHome(false); setApriFiltroMasterHome(false); }}
          style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 20, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}
        >
          Reset filtri
        </button>
      </div>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 10 }}>{corsiDateFiltrate.length} cors{corsiDateFiltrate.length === 1 ? "o trovato" : "i trovati"}</div>

      {vistaDateModo === "elenco" ? (
        <DateRaggruppatePerCitta
          corsi={corsi} location={location} cronologico={cronologicoHome}
          corsiDate={corsiDateFiltrate}
          iscritti={iscritti} master={master} onApriData={onApriData}
          onEdit={onEdit} onDelete={onDelete} idInModifica={idInModifica} renderModifica={renderModifica}
        />
      ) : (
        <Calendario corsi={corsi} location={location} corsiDate={corsiDateFiltrate} iscritti={iscritti} onApriData={onApriData} onBack={() => setVistaDateModo("elenco")} ricarica={ricarica} />
      )}
    </div>
  );
}

// login del venditore per la propria Dashboard: sceglie il proprio nome
// da una tendina (stesso elenco di "Definisci venditori") e scrive la
// password. Se il codice inserito è l'ADMIN_CODE (lo stesso già usato
// per le altre aree protette), entra invece in modalità amministratore:
// la Dashboard resta "sbloccata", con la tendina per scegliere
// qualunque venditore — così l'amministratore non perde la possibilità
// di controllare le performance di tutti.
function ModaleLoginVenditore({ venditori, onClose, onEntra, codiceAdmin }) {
  const [venditoreId, setVenditoreId] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function entra() {
    if (!venditoreId) { setErrore("Scegli il tuo nome."); return; }
    if (!password) { setErrore("Scrivi la password."); return; }
    setErrore(""); setVerificando(true);
    if (codiceAdmin && password === codiceAdmin) {
      setVerificando(false);
      onEntra({ modalitaAdmin: true });
      return;
    }
    const { data, error } = await supabase.functions.invoke("venditori-login", { body: { venditoreId, password } });
    setVerificando(false);
    if (error || data?.errore) { setErrore(data?.errore || "Password errata."); return; }
    onEntra({ modalitaAdmin: false, venditoreId, nome: data.nome });
  }

  return (
    <Modal title="Accedi come venditore" onClose={onClose}>
      <div style={{ ...subStyle, marginTop: -4 }}>Scegli il tuo nome e scrivi la tua password per vedere le tue chiusure e commissioni.</div>
      <Field label="Il tuo nome">
        <select style={inputStyle} value={venditoreId} onChange={(e) => setVenditoreId(e.target.value)}>
          <option value="">— scegli —</option>
          {venditori.map((v) => <option key={v.id} value={v.id}>{v.nome.toUpperCase()}</option>)}
        </select>
      </Field>
      <Field label="Password">
        <input
          type="password" style={inputStyle} value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entra()}
        />
      </Field>
      {errore && <div style={{ ...fontBody, fontSize: 13, color: "#C0392B", marginBottom: 10 }}>{errore}</div>}
      <Button onClick={entra} disabled={verificando} style={{ width: "100%" }}>{verificando ? "Verifico…" : "Entra"}</Button>
    </Modal>
  );
}

function PaginaDashboardVenditori({
  corsi, location, corsiDate, iscritti, master, venditori, ricarica, onBack, apriData, venditoreBloccato,
  filtroCorsoHome, setFiltroCorsoHome, filtroCittaHome, setFiltroCittaHome, filtroMasterHome, setFiltroMasterHome,
  cronologicoHome, setCronologicoHome,
  apriFiltroCorsoHome, setApriFiltroCorsoHome, apriFiltroCittaHome, setApriFiltroCittaHome, apriFiltroMasterHome, setApriFiltroMasterHome,
  selectFiltroCorsoHomeRef, selectFiltroCittaHomeRef, selectFiltroMasterHomeRef,
}) {
  const isMobile = useIsMobile();
  // se un venditore ha fatto login (venditoreBloccato valorizzato), la
  // selezione parte già su di lui e resta fissa — niente tendina, niente
  // modo di guardare i dati di qualcun altro
  const [venditoreSelId, setVenditoreSelId] = useState(venditoreBloccato?.id || "");
  const [periodo, setPeriodo] = useState("mese"); // mese | trimestre | personalizzato
  const [customDa, setCustomDa] = useState("");
  const [customA, setCustomA] = useState("");
  const [espansoChiusurePerCorso, setEspansoChiusurePerCorso] = useState(false);
  const [tabDashboardVenditore, setTabDashboardVenditore] = useState("performance"); // performance | corsi
  const [meseClassifica, setMeseClassifica] = useState(() => { const o = new Date(); return { anno: o.getFullYear(), mese: o.getMonth() }; });
  const [classificaCorsiCompleta, setClassificaCorsiCompleta] = useState(false);
  const [classificaTicketCompleta, setClassificaTicketCompleta] = useState(false);

  const venditoreSel = venditoreBloccato
    ? (venditori.find((v) => v.id === venditoreBloccato.id) || { id: venditoreBloccato.id, nome: venditoreBloccato.nome })
    : (venditori.find((v) => v.id === venditoreSelId) || null);
  const oggiStr = dataOggiStr();
  const numeroDateProgrammazione = corsiDate.filter((cd) => cd.data_fine >= oggiStr).length;

  const range = useMemo(() => {
    const oggi = new Date();
    if (periodo === "mese") {
      return { inizio: fmtDataIso(new Date(oggi.getFullYear(), oggi.getMonth(), 1)), fine: fmtDataIso(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0)) };
    }
    if (periodo === "trimestre") {
      const t = Math.floor(oggi.getMonth() / 3);
      return { inizio: fmtDataIso(new Date(oggi.getFullYear(), t * 3, 1)), fine: fmtDataIso(new Date(oggi.getFullYear(), t * 3 + 3, 0)) };
    }
    return { inizio: customDa || oggiStr, fine: customA || oggiStr };
  }, [periodo, customDa, customA, oggiStr]);

  const rangeLabel = useMemo(() => {
    const [ay, am, ad] = range.inizio.split("-").map(Number);
    const [by, bm, bd] = range.fine.split("-").map(Number);
    if (am === bm && ay === by) return `${String(ad).padStart(2, "0")}–${String(bd).padStart(2, "0")} ${MESI_ABBR[am - 1]} ${ay}`;
    return `${String(ad).padStart(2, "0")} ${MESI_ABBR[am - 1]} ${ay} – ${String(bd).padStart(2, "0")} ${MESI_ABBR[bm - 1]} ${by}`;
  }, [range]);

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const corsoDataById = useMemo(() => Object.fromEntries(corsiDate.map((cd) => [cd.id, cd])), [corsiDate]);

  // "chiusura" = un'iscrizione venduta da questo venditore, nel periodo
  // scelto (per data di iscrizione, cioè il giorno reale della vendita —
  // non la data del corso, che può essere mesi dopo). Le "vecchie
  // iscrizioni" (inserite oggi per recuperare dati di un'iscrizione
  // avvenuta tempo fa) sono sempre escluse: la loro data di inserimento
  // (oggi) non è la vera data della vendita, quindi non vanno mai
  // conteggiate come chiusura del mese/periodo corrente — stessa
  // esclusione già in uso per "Ultime iscrizioni" nelle Statistiche
  const chiusure = useMemo(() => {
    if (!venditoreSel) return [];
    const nomeNorm = venditoreSel.nome.trim().toUpperCase();
    return iscritti
      .filter((i) => (i.tutor || "").trim().toUpperCase() === nomeNorm)
      .filter((i) => !i.vecchia_iscrizione)
      .filter((i) => {
        const dataIscr = (i.ts || "").slice(0, 10);
        return dataIscr >= range.inizio && dataIscr <= range.fine;
      })
      .map((i) => ({ iscritto: i, corsoData: corsoDataById[i.corso_data_id] || null }));
  }, [iscritti, venditoreSel, range, corsoDataById]);

  const numeroChiusure = chiusure.length;
  const valoreVenduto = round2(chiusure.reduce((s, { iscritto }) => s + (iscritto.totale_pattuito || 0), 0));
  const ticketMedio = numeroChiusure > 0 ? round2(valoreVenduto / numeroChiusure) : 0;
  const commissioniGenerate = round2(chiusure.reduce((s, { iscritto }) => s + (iscritto.quota_venditore || 0), 0));

  // periodo immediatamente precedente a quello scelto, stessa durata:
  // mese prima se "Ultimo mese", trimestre prima se "Ultimo trimestre",
  // altrimenti (personalizzato) lo stesso numero di giorni appena prima
  // dell'inizio scelto — dà un confronto, non solo il numero assoluto
  const rangePrecedente = useMemo(() => {
    const oggi = new Date();
    if (periodo === "mese") {
      return { inizio: fmtDataIso(new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1)), fine: fmtDataIso(new Date(oggi.getFullYear(), oggi.getMonth(), 0)) };
    }
    if (periodo === "trimestre") {
      const t = Math.floor(oggi.getMonth() / 3);
      return { inizio: fmtDataIso(new Date(oggi.getFullYear(), (t - 1) * 3, 1)), fine: fmtDataIso(new Date(oggi.getFullYear(), t * 3, 0)) };
    }
    const [ay, am, ad] = range.inizio.split("-").map(Number);
    const [by, bm, bd] = range.fine.split("-").map(Number);
    const inizioCorrente = new Date(ay, am - 1, ad);
    const fineCorrente = new Date(by, bm - 1, bd);
    const giorni = Math.round((fineCorrente - inizioCorrente) / 86400000) + 1;
    const finePrecedente = new Date(inizioCorrente);
    finePrecedente.setDate(finePrecedente.getDate() - 1);
    const inizioPrecedente = new Date(finePrecedente);
    inizioPrecedente.setDate(inizioPrecedente.getDate() - (giorni - 1));
    return { inizio: fmtDataIso(inizioPrecedente), fine: fmtDataIso(finePrecedente) };
  }, [periodo, range]);
  const etichettaPeriodoPrecedente = periodo === "mese" ? "Mese precedente" : periodo === "trimestre" ? "Trimestre precedente" : "Periodo precedente";
  const statsPrecedenti = useMemo(() => {
    if (!venditoreSel) return { count: 0, commissioni: 0 };
    const nomeNorm = venditoreSel.nome.trim().toUpperCase();
    const righe = iscritti
      .filter((i) => (i.tutor || "").trim().toUpperCase() === nomeNorm)
      .filter((i) => !i.vecchia_iscrizione)
      .filter((i) => {
        const d = (i.ts || "").slice(0, 10);
        return d >= rangePrecedente.inizio && d <= rangePrecedente.fine;
      });
    return { count: righe.length, commissioni: righe.reduce((s, i) => s + (i.quota_venditore || 0), 0) };
  }, [iscritti, venditoreSel, rangePrecedente]);
  const numeroChiusurePrecedenti = statsPrecedenti.count;

  // "Performance" = commissione media per chiusura (somma commissioni /
  // numero chiusure), col confronto in % rispetto allo stesso valore nel
  // periodo precedente — niente più fasce fisse Alta/Media/Bassa, il
  // numero e la sua variazione parlano da soli
  const commissioneMediaVenditore = numeroChiusure > 0 ? commissioniGenerate / numeroChiusure : 0;
  const commissioneMediaPrecedente = statsPrecedenti.count > 0 ? statsPrecedenti.commissioni / statsPrecedenti.count : 0;
  const variazionePerformance = numeroChiusure > 0 && commissioneMediaPrecedente > 0
    ? Math.round(((commissioneMediaVenditore - commissioneMediaPrecedente) / commissioneMediaPrecedente) * 100)
    : null;
  // la commissione diventa incassabile da sola alla fine del corso (stessa
  // logica già usata per "Archivio corsi", nessun interruttore manuale):
  // finché il corso non è concluso resta "in arrivo"
  const chiusureInAttesa = chiusure.filter(({ corsoData }) => corsoData && corsoData.data_fine >= oggiStr);
  const daIncassare = round2(chiusureInAttesa.reduce((s, { iscritto }) => s + (iscritto.quota_venditore || 0), 0));
  const dataUltimaScadenza = chiusureInAttesa.reduce((max, { corsoData }) => (!max || corsoData.data_fine > max ? corsoData.data_fine : max), null);
  const corsiInAttesaCount = new Set(chiusureInAttesa.map(({ corsoData }) => corsoData?.id)).size;

  const perCorso = {};
  chiusure.forEach(({ iscritto, corsoData }) => {
    const nomeCorso = corsoData ? (corsoById[corsoData.corso_id]?.nome || "—") : "—";
    perCorso[nomeCorso] = (perCorso[nomeCorso] || 0) + 1;
  });
  const righeChiusurePerCorso = Object.entries(perCorso).sort((a, b) => b[1] - a[1]);
  const maxChiusurePerCorso = Math.max(1, ...righeChiusurePerCorso.map(([, n]) => n));

  // dettaglio di "Chiusure per corso": per ogni corso-tipo, quante
  // chiusure in ciascuna edizione (città + date) — mostrato solo quando
  // si espande, per non appesantire la vista compatta di default
  const perCorsoEdizioni = {};
  chiusure.forEach(({ corsoData }) => {
    if (!corsoData) return;
    const nomeCorso = corsoById[corsoData.corso_id]?.nome || "—";
    if (!perCorsoEdizioni[nomeCorso]) perCorsoEdizioni[nomeCorso] = {};
    if (!perCorsoEdizioni[nomeCorso][corsoData.id]) perCorsoEdizioni[nomeCorso][corsoData.id] = { corsoData, totale: 0 };
    perCorsoEdizioni[nomeCorso][corsoData.id].totale += 1;
  });
  function edizioniDi(nomeCorso) {
    return Object.values(perCorsoEdizioni[nomeCorso] || {}).sort((a, b) => a.corsoData.data_inizio.localeCompare(b.corsoData.data_inizio));
  }

  const perEdizione = {};
  chiusureInAttesa.forEach(({ iscritto, corsoData }) => {
    if (!corsoData) return;
    if (!perEdizione[corsoData.id]) perEdizione[corsoData.id] = { corsoData, totale: 0 };
    perEdizione[corsoData.id].totale += iscritto.quota_venditore || 0;
  });
  const commissioniInArrivo = Object.values(perEdizione).sort((a, b) => a.corsoData.data_fine.localeCompare(b.corsoData.data_fine));

  // classifica del team: chiusure e ticket medio di TUTTI i venditori nel
  // mese scelto, indipendente dal "Periodo di analisi" qui sopra (che
  // riguarda solo la scheda personale) — il confronto con il mese
  // precedente è per posizione in classifica (chiusure) o per variazione %
  // del valore (ticket medio, ha senso confrontarlo come importo)
  const classifiche = useMemo(() => {
    function statsMese({ anno, mese }) {
      const inizio = fmtDataIso(new Date(anno, mese, 1));
      const fine = fmtDataIso(new Date(anno, mese + 1, 0));
      const base = venditori.map((v) => ({ venditore: v, corsi: 0, valore: 0 }));
      const byId = Object.fromEntries(base.map((r) => [r.venditore.id, r]));
      iscritti.forEach((i) => {
        if (i.vecchia_iscrizione) return;
        const d = (i.ts || "").slice(0, 10);
        if (d < inizio || d > fine) return;
        const nomeNorm = (i.tutor || "").trim().toUpperCase();
        const v = venditori.find((vv) => vv.nome.trim().toUpperCase() === nomeNorm);
        if (!v || !byId[v.id]) return;
        byId[v.id].corsi += 1;
        byId[v.id].valore += i.totale_pattuito || 0;
      });
      return base.map((r) => ({ ...r, ticketMedio: r.corsi > 0 ? r.valore / r.corsi : 0 }));
    }
    const corrente = statsMese(meseClassifica);
    const mesePrecObj = meseClassifica.mese === 0 ? { anno: meseClassifica.anno - 1, mese: 11 } : { anno: meseClassifica.anno, mese: meseClassifica.mese - 1 };
    const precedente = statsMese(mesePrecObj);
    const precedenteById = Object.fromEntries(precedente.map((r) => [r.venditore.id, r]));

    const rankCorsiPrecedente = precedente.slice().sort((a, b) => b.corsi - a.corsi);
    const posPrecCorsiById = Object.fromEntries(rankCorsiPrecedente.map((r, i) => [r.venditore.id, i + 1]));

    const corsiRanked = corrente.slice().sort((a, b) => b.corsi - a.corsi).map((r, i) => ({
      ...r,
      posizione: i + 1,
      trendPosizioni: r.corsi > 0 && posPrecCorsiById[r.venditore.id] ? posPrecCorsiById[r.venditore.id] - (i + 1) : null,
    }));

    // Performance = ticket medio "corretto" per il volume di vendite
    // (Bayesian shrinkage verso la media del team, così un campione di
    // 2-3 vendite di alto valore non scavalca chi ne ha chiuse molte di
    // più) più un indice di volume, pesati 60/40 — calcolata sul proprio
    // mese per non far dipendere il confronto da baseline diverse
    function calcolaPerformance(righeMese) {
      const attivi = righeMese.filter((r) => r.corsi > 0);
      const venditeTotali = attivi.reduce((s, r) => s + r.corsi, 0);
      const fatturatoTotale = attivi.reduce((s, r) => s + r.valore, 0);
      const numeroVenditoriAttivi = attivi.length;
      if (venditeTotali === 0 || numeroVenditoriAttivi === 0) return { righe: [], mediaPerformance: 0 };
      const ticketMedioTeam = fatturatoTotale / venditeTotali;
      const venditeMedieTeam = venditeTotali / numeroVenditoriAttivi;
      const righe = attivi.map((r) => {
        const n = r.corsi;
        const ticketMedioAggiustato = (n * r.ticketMedio + venditeMedieTeam * ticketMedioTeam) / (n + venditeMedieTeam);
        const indiceQualita = (ticketMedioAggiustato / ticketMedioTeam) * 100;
        const indiceVolume = (n / venditeMedieTeam) * 100;
        return { ...r, performance: indiceQualita * 0.6 + indiceVolume * 0.4 };
      });
      const mediaPerformance = righe.reduce((s, r) => s + r.performance, 0) / righe.length;
      return { righe, mediaPerformance };
    }
    const perfCorrente = calcolaPerformance(corrente);
    const perfPrecedente = calcolaPerformance(precedente);
    const posPrecPerformanceById = Object.fromEntries(
      perfPrecedente.righe.slice().sort((a, b) => b.performance - a.performance).map((r, i) => [r.venditore.id, i + 1])
    );
    const performanceRanked = perfCorrente.righe.slice().sort((a, b) => b.performance - a.performance).map((r, i) => ({
      ...r,
      posizione: i + 1,
      trendPosizioni: posPrecPerformanceById[r.venditore.id] ? posPrecPerformanceById[r.venditore.id] - (i + 1) : null,
    }));

    const mediaCorsi = corrente.length > 0 ? round2(corrente.reduce((s, r) => s + r.corsi, 0) / corrente.length) : 0;

    return { corsi: corsiRanked, performance: performanceRanked, mediaCorsi, mediaPerformance: Math.round(perfCorrente.mediaPerformance) };
  }, [iscritti, venditori, meseClassifica]);
  const etichettaMeseClassifica = `${MESI[meseClassifica.mese].toUpperCase()} ${meseClassifica.anno}`;
  const meseClassificaFuturo = (() => { const o = new Date(); return meseClassifica.anno > o.getFullYear() || (meseClassifica.anno === o.getFullYear() && meseClassifica.mese >= o.getMonth()); })();

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Team</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY }}>
            {venditoreSel ? `Dashboard ${toTitleCase(venditoreSel.nome)}` : "Dashboard venditori"}
          </div>
          {venditoreBloccato ? null : (
            <select style={{ ...inputStyle, width: "auto", minWidth: 220 }} value={venditoreSelId} onChange={(e) => setVenditoreSelId(e.target.value)}>
              <option value="">— scegli venditore —</option>
              {venditori.map((v) => <option key={v.id} value={v.id}>{v.nome.toUpperCase()}</option>)}
            </select>
          )}
        </div>
        {venditoreSel && <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18 }}>Area venditore</div>}

        {!venditoreSel ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: MUTED, ...fontBody, fontSize: 14 }}>Scegli un venditore per vedere le sue chiusure e commissioni.</div>
        ) : (
          <>
            <div style={{ display: "flex", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
              <button
                onClick={() => setTabDashboardVenditore("performance")}
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", borderRight: `1px solid ${CREAM_BORDER}`, cursor: "pointer", padding: "18px 22px" }}
              >
                <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: tabDashboardVenditore === "performance" ? NAVY : MUTED }}>Performance di vendita</div>
                <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginTop: 2 }}>Chiusure e commissioni</div>
                <div style={{ width: 28, height: 3, borderRadius: 2, marginTop: 8, background: tabDashboardVenditore === "performance" ? GOLD : "transparent" }} />
              </button>
              <button
                onClick={() => setTabDashboardVenditore("corsi")}
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "18px 22px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: tabDashboardVenditore === "corsi" ? NAVY : MUTED }}>Corsi in programmazione</div>
                  <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, background: BG, borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>{numeroDateProgrammazione} date</span>
                </div>
                <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginTop: 2 }}>Corsi disponibili e prossime date</div>
                <div style={{ width: 28, height: 3, borderRadius: 2, marginTop: 8, background: tabDashboardVenditore === "corsi" ? GOLD : "transparent" }} />
              </button>
            </div>

            {tabDashboardVenditore === "performance" && (
            <>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Periodo di analisi</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
                {[["mese", "Ultimo mese"], ["trimestre", "Ultimo trimestre"], ["personalizzato", "Periodo personalizzato"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPeriodo(v)} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 16, border: "none", background: periodo === v ? NAVY : "transparent", color: periodo === v ? "#fff" : NAVY, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
              {periodo === "personalizzato" ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" style={inputStyle} value={customDa} onChange={(e) => setCustomDa(e.target.value)} />
                  <span style={{ color: MUTED }}>–</span>
                  <input type="date" style={inputStyle} value={customA} onChange={(e) => setCustomA(e.target.value)} />
                </div>
              ) : (
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 20, padding: "8px 14px" }}>{rangeLabel}</div>
              )}
            </div>

            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Chiusure e commissioni</div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Le "vecchie iscrizioni" (recuperate a posteriori) non contano mai come chiusura del periodo corrente.</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Chiusure</div>
                <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }}>{numeroChiusure}</div>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 2 }}>{etichettaPeriodoPrecedente}: {numeroChiusurePrecedenti}</div>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Performance</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }}>{numeroChiusure > 0 ? fmtEuroErp(round2(commissioneMediaVenditore)) : "—"}</div>
                  {variazionePerformance !== null && (
                    <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: variazionePerformance >= 0 ? "#2E7D32" : "#C0392B" }}>
                      {variazionePerformance >= 0 ? `+${variazionePerformance}%` : `${variazionePerformance}%`}
                    </div>
                  )}
                </div>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 2 }}>commissione media</div>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Ticket medio</div>
                <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }}>{fmtEuroErp(ticketMedio)}</div>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 2 }}>valore venduto / chiusure</div>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0 }}>
                <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Commissioni generate</div>
                <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }}>{fmtEuroErp(commissioniGenerate)}</div>
              </div>
              <div style={{ ...cardStyle, marginBottom: 0, background: "#FBF3E4", border: `1px solid ${GOLD}` }}>
                <div style={{ ...fontBody, fontSize: 11, color: "#8A6D1D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  Da incassare{dataUltimaScadenza ? ` entro il ${fmtData(dataUltimaScadenza)}` : ""}
                </div>
                <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: "#8A6D1D" }}>{fmtEuroErp(daIncassare)}</div>
                {corsiInAttesaCount > 0 && <div style={{ ...fontBody, fontSize: 11, color: "#8A6D1D" }}>quando terminano {corsiInAttesaCount} cors{corsiInAttesaCount === 1 ? "o" : "i"}</div>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 4 }}>
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY }}>Chiusure per corso</div>
                    {righeChiusurePerCorso.length > 0 && (
                      <button
                        onClick={() => setEspansoChiusurePerCorso((v) => !v)}
                        title={espansoChiusurePerCorso ? "Comprimi il dettaglio" : "Espandi il dettaglio per edizione"}
                        style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, fontSize: 14, fontWeight: 700, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        {espansoChiusurePerCorso ? "−" : "+"}
                      </button>
                    )}
                  </div>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{numeroChiusure} chiusure</div>
                </div>
                {righeChiusurePerCorso.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna chiusura nel periodo.</div>}
                {righeChiusurePerCorso.map(([nome, n]) => (
                  <div key={nome} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", ...fontBody, fontSize: 13, color: NAVY, marginBottom: 4 }}>
                      <span>{nome}</span><span>{n}</span>
                    </div>
                    <div style={{ height: 6, background: BG, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(n / maxChiusurePerCorso) * 100}%`, background: NAVY, borderRadius: 3 }} />
                    </div>
                    {espansoChiusurePerCorso && (
                      <div style={{ marginTop: 6, paddingLeft: 4 }}>
                        {edizioniDi(nome).map(({ corsoData, totale }) => (
                          <div key={corsoData.id} style={{ display: "flex", justifyContent: "space-between", ...fontBody, fontSize: 12, color: MUTED, padding: "3px 0" }}>
                            <span>{toTitleCase(locById[corsoData.location_id]?.nome || "—")} · {fmtDataCompatta(corsoData.data_inizio, corsoData.data_fine)}</span>
                            <span>n. {totale}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Commissioni in arrivo</div>
                {commissioniInArrivo.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna commissione ancora in arrivo.</div>}
                {commissioniInArrivo.map(({ corsoData, totale }) => (
                  <div key={corsoData.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>{fmtData(corsoData.data_fine)} · {corsoById[corsoData.corso_id]?.nome || "—"}</div>
                      <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>{locById[corsoData.location_id]?.nome || "—"} · a fine corso</div>
                    </div>
                    <div style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, flexShrink: 0 }}>{fmtEuroErp(round2(totale))}</div>
                  </div>
                ))}
                {commissioniInArrivo.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>
                    <span>Totale in arrivo</span><span>{fmtEuroErp(daIncassare)}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 8, marginBottom: 24 }}>Le commissioni diventano incassabili alla data di conclusione del corso.</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>Classifiche venditori</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setMeseClassifica((m) => (m.mese === 0 ? { anno: m.anno - 1, mese: 11 } : { anno: m.anno, mese: m.mese - 1 }))}
                  title="Mese precedente"
                  style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY }}
                ><IconaFrecciaSinistra size={14} /></button>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, minWidth: 120, textAlign: "center" }}>{etichettaMeseClassifica}</div>
                <button
                  onClick={() => setMeseClassifica((m) => (m.mese === 11 ? { anno: m.anno + 1, mese: 0 } : { anno: m.anno, mese: m.mese + 1 }))}
                  title="Mese successivo"
                  disabled={meseClassificaFuturo}
                  style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: meseClassificaFuturo ? "default" : "pointer", color: meseClassificaFuturo ? MUTED : NAVY, opacity: meseClassificaFuturo ? 0.4 : 1, transform: "rotate(180deg)" }}
                ><IconaFrecciaSinistra size={14} /></button>
              </div>
            </div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Aggiornate in tempo reale</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 24 }}>
              <ColonnaClassifica
                titolo="Corsi venduti" sottotitolo="Numero di chiusure nel mese"
                righe={classifiche.corsi} chiaveValore="corsi" tipoTrend="posizioni"
                etichettaMedia={`${classifiche.mediaCorsi} corsi`}
                formatValore={(v) => String(v)}
                venditoreSelId={venditoreSel?.id}
                mostraTutti={classificaCorsiCompleta} onToggleMostraTutti={() => setClassificaCorsiCompleta((v) => !v)}
              />
              <ColonnaClassifica
                titolo="Performance" sottotitolo="Ticket medio corretto per il volume di vendite"
                righe={classifiche.performance} chiaveValore="performance" tipoTrend="posizioni"
                etichettaMedia={`${classifiche.mediaPerformance} pt`}
                formatValore={(v) => String(Math.round(v))}
                coloreValore={coloreScorePerformance}
                venditoreSelId={venditoreSel?.id}
                mostraTutti={classificaTicketCompleta} onToggleMostraTutti={() => setClassificaTicketCompleta((v) => !v)}
              />
            </div>
            </>
            )}

            {tabDashboardVenditore === "corsi" && (
              <SezioneDateCorsi
                corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master}
                ricarica={ricarica} onApriData={apriData}
                filtroCorsoHome={filtroCorsoHome} setFiltroCorsoHome={setFiltroCorsoHome}
                filtroCittaHome={filtroCittaHome} setFiltroCittaHome={setFiltroCittaHome}
                filtroMasterHome={filtroMasterHome} setFiltroMasterHome={setFiltroMasterHome}
                cronologicoHome={cronologicoHome} setCronologicoHome={setCronologicoHome}
                apriFiltroCorsoHome={apriFiltroCorsoHome} setApriFiltroCorsoHome={setApriFiltroCorsoHome}
                apriFiltroCittaHome={apriFiltroCittaHome} setApriFiltroCittaHome={setApriFiltroCittaHome}
                apriFiltroMasterHome={apriFiltroMasterHome} setApriFiltroMasterHome={setApriFiltroMasterHome}
                selectFiltroCorsoHomeRef={selectFiltroCorsoHomeRef} selectFiltroCittaHomeRef={selectFiltroCittaHomeRef} selectFiltroMasterHomeRef={selectFiltroMasterHomeRef}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// colore in continuo per il punteggio Performance, centrato su 100 (in
// linea con la media team): rosso sotto 85, transizione verso il navy
// intorno a 100, verde sopra 120 — niente fasce fisse alta/media/bassa
function interpolaColore(hex1, hex2, t) {
  const c1 = [1, 3, 5].map((i) => parseInt(hex1.slice(i, i + 2), 16));
  const c2 = [1, 3, 5].map((i) => parseInt(hex2.slice(i, i + 2), 16));
  const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function coloreScorePerformance(score) {
  const ROSSO = "#C0392B", VERDE = "#2E7D32";
  if (score <= 85) return ROSSO;
  if (score >= 120) return VERDE;
  if (score <= 100) return interpolaColore(ROSSO, NAVY, (score - 85) / 15);
  return interpolaColore(NAVY, VERDE, (score - 100) / 20);
}

const COLORI_AVATAR_CLASSIFICA = ["#2E5C8A", "#8A6D1D", "#2E7D32", "#7B4B94", "#B0552F", "#456", "#1F6F78"];
function coloreAvatarClassifica(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % COLORI_AVATAR_CLASSIFICA.length;
  return COLORI_AVATAR_CLASSIFICA[h];
}

// una colonna della classifica venditori (vedi PaginaDashboardVenditori):
// mostra i primi 5 per il valore scelto (chiusure o Performance), con
// il proprio venditore sempre visibile — aggiunto in coda se fuori dal
// primo 5 — e un confronto col mese precedente espresso come movimento
// in classifica (posizioni salite/scese)
function ColonnaClassifica({ titolo, sottotitolo, righe, chiaveValore, tipoTrend, etichettaMedia, formatValore, coloreValore, venditoreSelId, mostraTutti, onToggleMostraTutti }) {
  const proprioIdx = righe.findIndex((r) => r.venditore.id === venditoreSelId);
  const max = Math.max(1, ...righe.map((r) => r[chiaveValore]));
  let daMostrare = righe.slice(0, 5);
  let mostraSeparatore = false;
  if (mostraTutti) {
    daMostrare = righe;
  } else if (proprioIdx >= 5) {
    daMostrare = [...righe.slice(0, 5), righe[proprioIdx]];
    mostraSeparatore = true;
  }
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY }}>{titolo}</div>
          <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>{sottotitolo}</div>
        </div>
        {proprioIdx >= 0 && (
          <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#8A6D1D", background: "#FBF3E4", border: `1px solid ${GOLD}`, borderRadius: 20, padding: "5px 10px", whiteSpace: "nowrap" }}>
            La tua posizione: {proprioIdx + 1}°
          </div>
        )}
      </div>
      {righe.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun venditore da classificare.</div>}
      {daMostrare.map((r, i) => (
        <React.Fragment key={r.venditore.id}>
          {mostraSeparatore && i === 5 && <div style={{ ...fontBody, fontSize: 11, color: MUTED, textAlign: "center", padding: "4px 0" }}>⋯</div>}
          <RigaClassifica r={r} max={max} chiaveValore={chiaveValore} tipoTrend={tipoTrend} formatValore={formatValore} coloreValore={coloreValore} evidenzia={r.venditore.id === venditoreSelId} />
        </React.Fragment>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Media team: {etichettaMedia}</div>
        {righe.length > 5 && (
          <button onClick={onToggleMostraTutti} style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            {mostraTutti ? "Mostra solo i primi 5" : "Vedi classifica completa"}
          </button>
        )}
      </div>
    </div>
  );
}

function RigaClassifica({ r, max, chiaveValore, tipoTrend, formatValore, coloreValore, evidenzia }) {
  const iniziali = r.venditore.nome.trim().slice(0, 2).toUpperCase();
  const valore = r[chiaveValore];
  let trendTesto = "–", trendColore = MUTED;
  if (tipoTrend === "posizioni") {
    if (r.trendPosizioni) { trendTesto = r.trendPosizioni > 0 ? `+${r.trendPosizioni}` : String(r.trendPosizioni); trendColore = r.trendPosizioni > 0 ? "#2E7D32" : "#C0392B"; }
  } else if (tipoTrend === "percentuale") {
    if (r.trendPct) { trendTesto = r.trendPct > 0 ? `+${r.trendPct}%` : `${r.trendPct}%`; trendColore = r.trendPct > 0 ? "#2E7D32" : "#C0392B"; }
  }
  const coloreValoreFinale = coloreValore ? coloreValore(valore) : NAVY;
  return (
    <div style={{ padding: "8px 8px", marginBottom: 4, borderRadius: 10, background: evidenzia ? "#FBF3E4" : "transparent", border: evidenzia ? `1px solid ${GOLD}` : "1px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: r.posizione === 1 ? GOLD : MUTED, width: 16, textAlign: "center", flexShrink: 0 }}>{r.posizione}</div>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: coloreAvatarClassifica(r.venditore.nome), color: "#fff", ...fontBody, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{iniziali}</div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toTitleCase(r.venditore.nome)}</span>
          {evidenzia && <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: "#fff", background: GOLD, borderRadius: 8, padding: "1px 6px", flexShrink: 0 }}>TU</span>}
        </div>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: coloreValoreFinale, flexShrink: 0 }}>{formatValore(valore)}</div>
        <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: trendColore, width: 34, textAlign: "right", flexShrink: 0 }}>{trendTesto}</div>
      </div>
      <div style={{ height: 5, background: BG, borderRadius: 3, overflow: "hidden", marginTop: 6, marginLeft: 40 }}>
        <div style={{ height: "100%", width: `${Math.min(100, (valore / max) * 100)}%`, background: evidenzia ? GOLD : coloreValoreFinale, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ---------- Dashboard modelle ----------
// calcola, per ogni edizione (corsi_date), l'elenco degli "slot modella"
// richiesti: uno per giorno con "Modella del Master" nel template
// corsi_giorni, più uno per ogni trattamento richiesto da ciascun allievo
// NOSTRA (richiede_modelle=true) nei giorni Allievi del template. Stessa
// logica esatta usata in "Assegna modelle" (SchedaData, vista "modelle"),
// solo estesa a tutte le edizioni invece che a una sola — uno slot è
// "assegnata" quando il suo nome_modella non è vuoto
function calcolaSlotModelle({ corsiDate, corsi, location, master, iscritti, corsiGiorni }) {
  const corsoById = Object.fromEntries(corsi.map((c) => [c.id, c]));
  const locById = Object.fromEntries(location.map((l) => [l.id, l]));
  const masterById = Object.fromEntries((master || []).map((m) => [m.id, m]));
  const giorniByCorso = {};
  (corsiGiorni || []).forEach((g) => {
    (giorniByCorso[g.corso_id] = giorniByCorso[g.corso_id] || []).push(g);
  });

  const slot = [];
  corsiDate.forEach((cd) => {
    const corso = corsoById[cd.corso_id];
    const loc = locById[cd.location_id];
    const masterRec = masterById[cd.master_id];
    const base = {
      corsoDataId: cd.id, corsoId: cd.corso_id, corsoNome: corso?.nome || "?", cittaNome: loc?.nome || "?",
      dataInizio: cd.data_inizio, dataFine: cd.data_fine, masterTrainerNome: masterRec?.nome || "",
    };
    const giorniCorso = (giorniByCorso[cd.corso_id] || []).slice().sort((a, b) => a.numero_giorno - b.numero_giorno);
    const giorniRilevanti = giorniCorso.filter((g) => g.richiede_modella_master || g.richiede_modelle_allievi);
    const giornoRipiego = giorniCorso.filter((g) => g.richiede_modelle_allievi)[0]?.numero_giorno ?? null;
    const iscrittiCd = iscritti.filter((i) => i.corso_data_id === cd.id);

    if (giorniRilevanti.length > 0) {
      giorniRilevanti.forEach((g) => {
        if (g.richiede_modella_master) {
          const modelleMaster = Array.isArray(cd.modelle_master) ? cd.modelle_master : [];
          const entry = modelleMaster.find((m) => m.numero_giorno === g.numero_giorno);
          if (!entry?.la_porta_master) slot.push({
            ...base, id: `${cd.id}-master-${g.numero_giorno}`, ruolo: "master", numeroGiorno: g.numero_giorno,
            tipo: g.tipo_modella_master || "Modella del Master", allievoNome: null,
            nomeModella: entry?.nome_modella || "", telefonoModella: entry?.telefono_modella || "",
            assegnata: !!(entry?.nome_modella && entry.nome_modella.trim()),
          });
        }
        if (g.richiede_modelle_allievi) {
          iscrittiCd.forEach((i) => {
            if (!i.richiede_modelle) return; // SUA: se la porta l'allieva, non è un "fabbisogno" nostro
            (Array.isArray(i.tipi_modelle) ? i.tipi_modelle : []).forEach((m, idx) => {
              if ((m.giorno ?? giornoRipiego) !== g.numero_giorno) return;
              slot.push({
                ...base, id: `${cd.id}-allievo-${i.id}-${idx}`, ruolo: "allievo", numeroGiorno: g.numero_giorno,
                tipo: m.tipo || g.tipo_modella_allievi || "?", allievoNome: `${i.nome} ${i.cognome}`,
                iscrittoId: i.id, indexTipi: idx,
                nomeModella: m.nome_modella || "", telefonoModella: m.telefono_modella || "",
                assegnata: !!(m.nome_modella && m.nome_modella.trim()),
              });
            });
          });
        }
      });
    } else {
      // corso senza template corsi_giorni: elenco piatto, come il ramo
      // legacy di "Assegna modelle" quando giorniRilevantiModelle è vuoto
      iscrittiCd.forEach((i) => {
        if (!i.richiede_modelle) return;
        (Array.isArray(i.tipi_modelle) ? i.tipi_modelle : []).forEach((m, idx) => {
          slot.push({
            ...base, id: `${cd.id}-allievo-${i.id}-${idx}`, ruolo: "allievo", numeroGiorno: null,
            tipo: m.tipo || "?", allievoNome: `${i.nome} ${i.cognome}`, iscrittoId: i.id, indexTipi: idx,
            nomeModella: m.nome_modella || "", telefonoModella: m.telefono_modella || "",
            assegnata: !!(m.nome_modella && m.nome_modella.trim()),
          });
        });
      });
    }
  });
  return slot;
}

// scrive nome/telefono su un singolo slot (master o allievo), sulla
// tabella giusta (corsi_date.modelle_master o iscritti.tipi_modelle) —
// nome/telefono vuoti "liberano" lo slot (usato anche per "Elimina")
async function scriviSlotModella(slotDaScrivere, { corsiDate, iscritti }, nomeModella, telefonoModella) {
  if (slotDaScrivere.ruolo === "master") {
    const cd = corsiDate.find((c) => c.id === slotDaScrivere.corsoDataId);
    const attuale = Array.isArray(cd?.modelle_master) ? cd.modelle_master : [];
    const idx = attuale.findIndex((m) => m.numero_giorno === slotDaScrivere.numeroGiorno);
    const nuovo = idx >= 0
      ? attuale.map((m, i) => (i === idx ? { ...m, nome_modella: nomeModella, telefono_modella: telefonoModella } : m))
      : [...attuale, { numero_giorno: slotDaScrivere.numeroGiorno, mattina: false, pomeriggio: false, nome_modella: nomeModella, telefono_modella: telefonoModella }];
    const { error } = await supabase.from("corsi_date").update({ modelle_master: nuovo }).eq("id", slotDaScrivere.corsoDataId);
    return error;
  }
  const iscritto = iscritti.find((i) => i.id === slotDaScrivere.iscrittoId);
  const attuale = Array.isArray(iscritto?.tipi_modelle) ? iscritto.tipi_modelle : [];
  const nuovo = attuale.map((m, i) => (i === slotDaScrivere.indexTipi ? { ...m, nome_modella: nomeModella, telefono_modella: telefonoModella } : m));
  const { error } = await supabase.from("iscritti").update({ tipi_modelle: nuovo }).eq("id", slotDaScrivere.iscrittoId);
  return error;
}

// sposta una modella già assegnata da uno slot a un altro (libera lo slot
// di partenza, la scrive su quello di arrivo con lo stesso nome/telefono)
async function spostaModellaTraSlot(slotOrigine, slotDestinazione, ctx) {
  const err1 = await scriviSlotModella(slotOrigine, ctx, "", "");
  if (err1) return err1;
  const err2 = await scriviSlotModella(slotDestinazione, ctx, slotOrigine.nomeModella, slotOrigine.telefonoModella);
  return err2;
}

function etichettaSlot(s) {
  return `${fmtDataCompatta(s.dataInizio, s.dataFine)} · ${s.cittaNome} · ${toTitleCase(s.corsoNome)} · ${s.tipo}${s.allievoNome ? " · " + toTitleCase(s.allievoNome) : ""}`;
}

// card statistica in cima alla Dashboard modelle: cliccabile quando passa
// onClick (le due centrali aprono le liste di slot corrispondenti)
function CardStatisticaModelle({ etichetta, valore, sottotitolo, colore, sfondo, icona, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        ...fontBody, textAlign: "left", flex: "1 1 200px", display: "flex", alignItems: "center", gap: 14,
        background: sfondo || "#fff", border: `1px solid ${sfondo ? "transparent" : CREAM_BORDER}`, borderRadius: 14,
        padding: 18, cursor: onClick ? "pointer" : "default",
      }}
    >
      {icona && (
        <span style={{ width: 42, height: 42, borderRadius: "50%", background: colore ? `${colore}22` : "#F1ECDF", color: colore || NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icona}
        </span>
      )}
      <span>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 2 }}>{etichetta}</div>
        <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: colore || NAVY, lineHeight: 1 }}>{valore}</div>
        {sottotitolo && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 3 }}>{sottotitolo}</div>}
      </span>
    </button>
  );
}

// banner di avviso scadenze modelle: rimane visibile finché non si preme
// "Visualizzato" — torna a comparire da capo se, alla riapertura della
// pagina, il numero di slot urgenti è cambiato rispetto a quando è stato
// chiuso l'ultima volta (altrimenti resterebbe muto per sempre su nuove
// urgenze comparse dopo la chiusura)
function AlertScadenzeModelle({ numeroSlot, numeroCorsi, giorni }) {
  const chiaveVisto = `edc_alert_modelle_${numeroSlot}_${numeroCorsi}_${giorni}`;
  const [chiuso, setChiuso] = useState(() => sessionStorage.getItem(chiaveVisto) === "1");
  if (chiuso || numeroSlot === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#FDECEC", border: "1px solid #F5C6C0", borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#C0392B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" /><path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </span>
      <div style={{ flex: 1, ...fontBody, fontSize: 14, color: "#7A2C1E" }}>
        <strong>{numeroSlot} modell{numeroSlot === 1 ? "a" : "e"} ancora da trovare</strong> per {numeroCorsi} corso{numeroCorsi === 1 ? "" : "i"} in partenza entro {giorni} giorni.
      </div>
      <Button variant="ghost" style={{ borderColor: "#C0392B", color: "#C0392B", flexShrink: 0 }} onClick={() => { sessionStorage.setItem(chiaveVisto, "1"); setChiuso(true); }}>
        Visualizzato
      </Button>
    </div>
  );
}

// riga cliccabile della lista "Priorità": mostra il badge "TRA N GIORNI"
// (colore in base all'urgenza), città+data, corso, master, tipologie
// richieste e i tre numeri richieste/assegnate/da trovare
function RigaPrioritaModelle({ edizione, onApri }) {
  const g = edizione.giorniAOggi;
  const urgenza = g <= 3 ? { bg: "#FDECEC", fg: "#C0392B" } : g <= 7 ? { bg: "#FFF3E0", fg: "#B9770E" } : { bg: "#F1ECDF", fg: NAVY };
  const testoGiorni = g < 0 ? "IN CORSO" : g === 0 ? "OGGI" : g === 1 ? "DOMANI" : `TRA ${g} GIORNI`;
  return (
    <div onClick={onApri} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", borderBottom: `1px solid ${CREAM_BORDER}`, cursor: "pointer" }}>
      <div style={{ width: 100, flexShrink: 0 }}>
        <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: urgenza.fg, background: urgenza.bg, borderRadius: 20, padding: "4px 9px", display: "inline-block", marginBottom: 6 }}>{testoGiorni}</span>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{edizione.cittaNome.toUpperCase()}</div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{fmtDataCompatta(edizione.dataInizio, edizione.dataFine).toUpperCase()}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: NAVY }}>{toTitleCase(edizione.corsoNome)}</div>
        {edizione.masterTrainerNome && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 6 }}>Master: {toTitleCase(edizione.masterTrainerNome)}</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(edizione.tipologie).map(([t, n]) => <BadgeTipologia key={t} testo={t} conteggio={n} />)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, flexShrink: 0, textAlign: "center" }}>
        <div><div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{edizione.richieste}</div><div style={{ ...fontBody, fontSize: 11, color: MUTED }}>richieste</div></div>
        <div><div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: "#2E7D32" }}>{edizione.assegnate}</div><div style={{ ...fontBody, fontSize: 11, color: MUTED }}>assegnate</div></div>
        <div><div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: "#C0392B" }}>{edizione.daTrovare}</div><div style={{ ...fontBody, fontSize: 11, color: MUTED }}>da trovare</div></div>
      </div>
      <IconaFrecciaSinistra size={16} color={MUTED} />
    </div>
  );
}

// blocco per città nel pannello "Richieste totali per città": barra di
// avanzamento assegnate/richieste + tipologie principali
// riga cliccabile: si espande mostrando, corso per corso, ogni singolo
// slot che compone il totale (Modella del Master vs allievo, con nome
// dell'allievo e se è già assegnata) — serve a verificare da dove viene
// un numero, non solo a vederlo
function RigaCittaModelle({ dati, onApriEdizione }) {
  const [espanso, setEspanso] = useState(false);
  const pct = dati.richieste > 0 ? Math.round((dati.assegnate / dati.richieste) * 100) : 0;
  const tipologieOrdinate = Object.entries(dati.tipologie).sort((a, b) => b[1] - a[1]);
  const principali = tipologieOrdinate.slice(0, 3);
  const restoConteggio = tipologieOrdinate.slice(3).reduce((s, [, n]) => s + n, 0);
  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${CREAM_BORDER}` }}>
      <div onClick={() => setEspanso((v) => !v)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>
            <IconaMarker size={14} /> {dati.citta.toUpperCase()}
            <span style={{ transform: espanso ? "rotate(90deg)" : "none", display: "flex", color: MUTED }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          </div>
          <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>{dati.richieste} modell{dati.richieste === 1 ? "a" : "e"}</div>
        </div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 8 }}>
          {principali.map(([t, n], idx) => <span key={t}>{idx > 0 ? " · " : ""}{t} {n}</span>)}
          {restoConteggio > 0 && <span> · Altro {restoConteggio}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#F1ECDF", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#2E7D32", borderRadius: 3 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", ...fontBody, fontSize: 12 }}>
          <span style={{ color: "#2E7D32", fontWeight: 600 }}>{dati.assegnate} assegnate</span>
          <span style={{ color: "#C0392B", fontWeight: 600 }}>{dati.richieste - dati.assegnate} da trovare</span>
        </div>
      </div>
      {espanso && (
        <div style={{ marginTop: 10, background: "#F7F5EF", borderRadius: 10, padding: 10 }}>
          {dati.edizioni.map((e) => (
            <div key={e.corsoDataId} style={{ marginBottom: 10 }}>
              <div
                onClick={() => onApriEdizione?.(e)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", cursor: onApriEdizione ? "pointer" : "default", marginBottom: 4 }}
              >
                <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY }}>{fmtDataCompatta(e.dataInizio, e.dataFine)} · {toTitleCase(e.corsoNome)}</span>
                <span style={{ ...fontBody, fontSize: 11, color: MUTED }}>{e.richieste} slot</span>
              </div>
              {e.slot.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, ...fontBody, fontSize: 12, padding: "3px 0", color: NAVY }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.ruolo === "master" ? "Modella del Master" : toTitleCase(s.allievoNome)} · {s.tipo}
                  </span>
                  <span style={{ flexShrink: 0, fontWeight: 600, color: s.assegnata ? "#2E7D32" : "#C0392B" }}>
                    {s.assegnata ? toTitleCase(s.nomeModella) : "da trovare"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function IconaMarker({ size = 14, color = NAVY }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// modale "Ancora da trovare": elenco degli slot scoperti, ognuno apribile
// per inserire nome e telefono della modella trovata e salvare
function ModaleSlotDaTrovare({ slotList, ctx, ricarica, onClose }) {
  const [apertoId, setApertoId] = useState(null);
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  function apri(s) { setApertoId(s.id); setNome(""); setTelefono(""); setErrore(""); }
  async function salva(s) {
    if (!nome.trim()) { setErrore("Scrivi almeno il nome della modella."); return; }
    setSalvando(true); setErrore("");
    const err = await scriviSlotModella(s, ctx, nome.trim(), telefono.trim());
    setSalvando(false);
    if (err) { setErrore("Errore: " + err.message); return; }
    setApertoId(null);
    await ricarica();
  }

  return (
    <Modal title={`Modelle da trovare (${slotList.length})`} onClose={onClose} maxWidth={640}>
      {slotList.length === 0 ? (
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: "20px 0" }}>Nessuna modella ancora da trovare: tutti gli slot attivi sono assegnati.</div>
      ) : (
        slotList.map((s) => (
          <div key={s.id} style={{ borderBottom: `1px solid ${CREAM_BORDER}`, padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>{fmtDataCompatta(s.dataInizio, s.dataFine)} · {s.cittaNome} · {toTitleCase(s.corsoNome)}</div>
                <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {s.ruolo === "master" ? "Modella del Master" : `Allieva: ${toTitleCase(s.allievoNome)}`} · {s.tipo}
                </div>
              </div>
              {apertoId !== s.id && <Button variant="ghost" style={{ flexShrink: 0 }} onClick={() => apri(s)}>Assegna</Button>}
            </div>
            {apertoId === s.id && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <Field label="Nome e cognome"><input style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <Field label="Telefono"><input style={inputStyle} value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <Button onClick={() => salva(s)} disabled={salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
                  <Button variant="ghost" onClick={() => setApertoId(null)}>Annulla</Button>
                </div>
              </div>
            )}
            {apertoId === s.id && errore && <div style={{ ...fontBody, fontSize: 13, color: "#C0392B" }}>{errore}</div>}
          </div>
        ))
      )}
    </Modal>
  );
}

// modale "Già assegnate": elenco delle modelle assegnate, con azioni
// Modifica (rinomina nome/telefono), Sposta (su un altro slot scoperto),
// Elimina (libera lo slot)
function ModaleModelleAssegnate({ slotList, slotDaTrovare, ctx, ricarica, onClose }) {
  const [inModifica, setInModifica] = useState(null); // { id, modo: "modifica" | "sposta" }
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [destinazioneId, setDestinazioneId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  function apriModifica(s) { setInModifica({ id: s.id, modo: "modifica" }); setNome(s.nomeModella); setTelefono(s.telefonoModella); setErrore(""); }
  function apriSposta(s) { setInModifica({ id: s.id, modo: "sposta" }); setDestinazioneId(""); setErrore(""); }
  async function salvaModifica(s) {
    if (!nome.trim()) { setErrore("Il nome non può essere vuoto (usa Elimina per liberare lo slot)."); return; }
    setSalvando(true); setErrore("");
    const err = await scriviSlotModella(s, ctx, nome.trim(), telefono.trim());
    setSalvando(false);
    if (err) { setErrore("Errore: " + err.message); return; }
    setInModifica(null);
    await ricarica();
  }
  async function confermaSposta(s) {
    const dest = slotDaTrovare.find((d) => d.id === destinazioneId);
    if (!dest) { setErrore("Scegli lo slot di destinazione."); return; }
    setSalvando(true); setErrore("");
    const err = await spostaModellaTraSlot(s, dest, ctx);
    setSalvando(false);
    if (err) { setErrore("Errore: " + err.message); return; }
    setInModifica(null);
    await ricarica();
  }
  async function elimina(s) {
    if (!window.confirm(`Rimuovere ${toTitleCase(s.nomeModella)} da questo slot? Tornerà "da trovare".`)) return;
    setSalvando(true);
    const err = await scriviSlotModella(s, ctx, "", "");
    setSalvando(false);
    if (err) { window.alert("Errore: " + err.message); return; }
    await ricarica();
  }

  return (
    <Modal title={`Modelle assegnate (${slotList.length})`} onClose={onClose} maxWidth={680}>
      {slotList.length === 0 ? (
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: "20px 0" }}>Nessuna modella assegnata ancora.</div>
      ) : (
        slotList.map((s) => (
          <div key={s.id} style={{ borderBottom: `1px solid ${CREAM_BORDER}`, padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>{toTitleCase(s.nomeModella)}{s.telefonoModella && <span style={{ fontWeight: 400, color: MUTED }}> · {s.telefonoModella}</span>}</div>
                <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>{etichettaSlot(s)}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => apriModifica(s)} title="Modifica" style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 6, display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button onClick={() => apriSposta(s)} title="Sposta su un altro corso" style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 6, display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                </button>
                <button onClick={() => elimina(s)} disabled={salvando} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 6, display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                </button>
              </div>
            </div>
            {inModifica?.id === s.id && inModifica.modo === "modifica" && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}><Field label="Nome e cognome"><input style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field></div>
                <div style={{ flex: "1 1 140px" }}><Field label="Telefono"><input style={inputStyle} value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field></div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <Button onClick={() => salvaModifica(s)} disabled={salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
                  <Button variant="ghost" onClick={() => setInModifica(null)}>Annulla</Button>
                </div>
              </div>
            )}
            {inModifica?.id === s.id && inModifica.modo === "sposta" && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px" }}>
                  <Field label="Sposta su">
                    <select style={inputStyle} value={destinazioneId} onChange={(e) => setDestinazioneId(e.target.value)}>
                      <option value="">— scegli lo slot scoperto —</option>
                      {slotDaTrovare.map((d) => <option key={d.id} value={d.id}>{etichettaSlot(d)}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <Button onClick={() => confermaSposta(s)} disabled={salvando || !destinazioneId}>{salvando ? "Sposto…" : "Conferma spostamento"}</Button>
                  <Button variant="ghost" onClick={() => setInModifica(null)}>Annulla</Button>
                </div>
              </div>
            )}
            {inModifica?.id === s.id && errore && <div style={{ ...fontBody, fontSize: 13, color: "#C0392B" }}>{errore}</div>}
          </div>
        ))
      )}
    </Modal>
  );
}

// dashboard "Fabbisogno, scadenze e assegnazioni": card riepilogo, filtri,
// priorità prossimi 15 giorni, riepilogo per città, tabella completa
function PaginaDashboardModelle({ corsi, location, corsiDate, iscritti, master, corsiGiorni, ricarica, apriDataModelle }) {
  const oggiStr = dataOggiStr();
  const [ricerca, setRicerca] = useState("");
  const [filtroCitta, setFiltroCitta] = useState("");
  const [filtroTipologia, setFiltroTipologia] = useState("");
  const [scadenzaGiorni, setScadenzaGiorni] = useState(15);
  const [ordine, setOrdine] = useState("urgenza"); // urgenza | richieste
  const [modaleDaTrovare, setModaleDaTrovare] = useState(false);
  const [modaleAssegnate, setModaleAssegnate] = useState(false);

  const ctx = { corsiDate, iscritti };

  const slotAttivi = useMemo(
    () => calcolaSlotModelle({ corsiDate, corsi, location, master, iscritti, corsiGiorni }).filter((s) => s.dataFine >= oggiStr),
    [corsiDate, corsi, location, master, iscritti, corsiGiorni, oggiStr]
  );

  const edizioni = useMemo(() => {
    const m = new Map();
    slotAttivi.forEach((s) => {
      if (!m.has(s.corsoDataId)) m.set(s.corsoDataId, { corsoDataId: s.corsoDataId, corsoId: s.corsoId, corsoNome: s.corsoNome, cittaNome: s.cittaNome, dataInizio: s.dataInizio, dataFine: s.dataFine, masterTrainerNome: s.masterTrainerNome, slot: [] });
      m.get(s.corsoDataId).slot.push(s);
    });
    return Array.from(m.values()).map((e) => {
      const richieste = e.slot.length;
      const assegnate = e.slot.filter((s) => s.assegnata).length;
      const tipologie = {};
      e.slot.forEach((s) => { tipologie[s.tipo] = (tipologie[s.tipo] || 0) + 1; });
      const giorniAOggi = Math.round((new Date(e.dataInizio + "T00:00:00") - new Date(oggiStr + "T00:00:00")) / 86400000);
      return { ...e, richieste, assegnate, daTrovare: richieste - assegnate, tipologie, giorniAOggi };
    }).sort((a, b) => a.dataInizio.localeCompare(b.dataInizio));
  }, [slotAttivi, oggiStr]);

  const tipologiePresenti = useMemo(() => Array.from(new Set(slotAttivi.map((s) => s.tipo))).sort(), [slotAttivi]);
  const cittaPresenti = useMemo(() => Array.from(new Set(edizioni.map((e) => e.cittaNome))).sort(), [edizioni]);

  const edizioniFiltrate = useMemo(() => {
    let arr = edizioni.filter((e) => e.richieste > 0);
    if (filtroCitta) arr = arr.filter((e) => e.cittaNome === filtroCitta);
    if (filtroTipologia) arr = arr.filter((e) => Object.keys(e.tipologie).includes(filtroTipologia));
    const termini = ricerca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (termini.length > 0) {
      arr = arr.filter((e) => {
        const testo = [e.corsoNome, e.cittaNome, e.masterTrainerNome, ...Object.keys(e.tipologie)].filter(Boolean).join(" ").toLowerCase();
        return termini.every((t) => testo.includes(t));
      });
    }
    return arr.slice().sort((a, b) => (ordine === "richieste" ? b.daTrovare - a.daTrovare : a.dataInizio.localeCompare(b.dataInizio)));
  }, [edizioni, filtroCitta, filtroTipologia, ricerca, ordine]);

  // tabella raggruppata per mese (come nei calendari): l'ordine scelto
  // nel filtro "Ordina" vale dentro ogni mese, i mesi restano sempre in
  // sequenza cronologica
  const edizioniPerMese = useMemo(() => {
    const gruppi = new Map();
    edizioniFiltrate.forEach((e) => {
      const chiave = e.dataInizio.slice(0, 7); // "YYYY-MM"
      if (!gruppi.has(chiave)) {
        const mese = parseInt(e.dataInizio.slice(5, 7), 10);
        gruppi.set(chiave, { chiave, etichetta: `${MESI[mese - 1]} ${e.dataInizio.slice(0, 4)}`, edizioni: [] });
      }
      gruppi.get(chiave).edizioni.push(e);
    });
    return Array.from(gruppi.values()).sort((a, b) => a.chiave.localeCompare(b.chiave));
  }, [edizioniFiltrate]);

  const edizioniPrioritarie = useMemo(
    () => edizioniFiltrate.filter((e) => e.daTrovare > 0 && e.giorniAOggi <= scadenzaGiorni),
    [edizioniFiltrate, scadenzaGiorni]
  );
  // vista fissa a 60 giorni, indipendente dal filtro "Entro N giorni" qui
  // sopra: dà sempre un colpo d'occhio più ampio accanto a quella corta
  const edizioniPrioritarie60 = useMemo(
    () => edizioniFiltrate.filter((e) => e.daTrovare > 0 && e.giorniAOggi <= 60),
    [edizioniFiltrate]
  );

  const perCitta = useMemo(() => {
    const m = new Map();
    edizioniFiltrate.forEach((e) => {
      if (!m.has(e.cittaNome)) m.set(e.cittaNome, { citta: e.cittaNome, richieste: 0, assegnate: 0, tipologie: {}, edizioni: [] });
      const c = m.get(e.cittaNome);
      c.richieste += e.richieste; c.assegnate += e.assegnate;
      Object.entries(e.tipologie).forEach(([t, n]) => { c.tipologie[t] = (c.tipologie[t] || 0) + n; });
      c.edizioni.push(e);
    });
    return Array.from(m.values()).sort((a, b) => b.richieste - a.richieste);
  }, [edizioniFiltrate]);

  const totaleRichieste = edizioni.reduce((s, e) => s + e.richieste, 0);
  const totaleAssegnate = edizioni.reduce((s, e) => s + e.assegnate, 0);
  const totaleDaTrovare = totaleRichieste - totaleAssegnate;
  const corsiDistinti = new Set(edizioni.filter((e) => e.richieste > 0).map((e) => e.corsoId)).size;

  const slotDaTrovare = useMemo(() => slotAttivi.filter((s) => !s.assegnata).sort((a, b) => a.dataInizio.localeCompare(b.dataInizio)), [slotAttivi]);
  const slotAssegnati = useMemo(() => slotAttivi.filter((s) => s.assegnata).sort((a, b) => a.dataInizio.localeCompare(b.dataInizio)), [slotAttivi]);

  function apriEdizione(e) {
    const cd = corsiDate.find((c) => c.id === e.corsoDataId);
    if (cd) apriDataModelle(cd);
  }

  async function ricaricaLocale() { await ricarica(); }

  return (
    <div>
      <AlertScadenzeModelle numeroSlot={edizioniPrioritarie.reduce((s, e) => s + e.daTrovare, 0)} numeroCorsi={edizioniPrioritarie.length} giorni={scadenzaGiorni} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <CardStatisticaModelle
          etichetta="Modelle richieste" valore={totaleRichieste} sottotitolo={`su ${corsiDistinti} cors${corsiDistinti === 1 ? "o" : "i"}`}
          icona={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
        />
        <CardStatisticaModelle
          etichetta={`In scadenza entro ${scadenzaGiorni} gg`} valore={edizioniPrioritarie.reduce((s, e) => s + e.daTrovare, 0)}
          sottotitolo={`${edizioniPrioritarie.length} cors${edizioniPrioritarie.length === 1 ? "o prioritario" : "i prioritari"}`}
          colore="#C0392B" sfondo="#FDF3D9"
          icona={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        />
        <CardStatisticaModelle
          etichetta="Già assegnate" valore={totaleAssegnate} colore="#2E7D32" onClick={() => setModaleAssegnate(true)}
          icona={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
        />
        <CardStatisticaModelle
          etichetta="Ancora da trovare" valore={totaleDaTrovare} colore="#C0392B" onClick={() => setModaleDaTrovare(true)}
          icona={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <CampoRicerca value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca città, corso, master o tipologia…" style={{ flex: "2 1 260px" }} />
        <select style={{ ...inputStyle, flex: "1 1 150px" }} value={filtroCitta} onChange={(e) => setFiltroCitta(e.target.value)}>
          <option value="">Tutte le città</option>
          {cittaPresenti.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
        <select style={{ ...inputStyle, flex: "1 1 150px" }} value={filtroTipologia} onChange={(e) => setFiltroTipologia(e.target.value)}>
          <option value="">Tutte le tipologie</option>
          {tipologiePresenti.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...inputStyle, flex: "1 1 150px" }} value={scadenzaGiorni} onChange={(e) => setScadenzaGiorni(Number(e.target.value))}>
          <option value={7}>Entro 7 giorni</option>
          <option value={15}>Entro 15 giorni</option>
          <option value={30}>Entro 30 giorni</option>
          <option value={90}>Entro 90 giorni</option>
        </select>
        <select style={{ ...inputStyle, flex: "1 1 150px" }} value={ordine} onChange={(e) => setOrdine(e.target.value)}>
          <option value="urgenza">Ordina: urgenza</option>
          <option value="richieste">Ordina: più da trovare</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ ...hStyle, marginBottom: 0 }}>Priorità · prossimi {scadenzaGiorni} giorni</div>
              <div style={subStyle}>In ordine di urgenza</div>
            </div>
            {edizioniPrioritarie.length > 0 && <Button onClick={() => apriEdizione(edizioniPrioritarie[0])}>Gestisci assegnazioni</Button>}
          </div>
          {edizioniPrioritarie.length === 0 ? (
            <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: "20px 0" }}>Nessuna urgenza nei prossimi {scadenzaGiorni} giorni.</div>
          ) : (
            edizioniPrioritarie.map((e) => <RigaPrioritaModelle key={e.corsoDataId} edizione={e} onApri={() => apriEdizione(e)} />)
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ ...hStyle, marginBottom: 0 }}>Priorità prossimi 60 giorni</div>
              <div style={subStyle}>In ordine di urgenza</div>
            </div>
            {edizioniPrioritarie60.length > 0 && <Button onClick={() => apriEdizione(edizioniPrioritarie60[0])}>Gestisci assegnazioni</Button>}
          </div>
          {edizioniPrioritarie60.length === 0 ? (
            <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: "20px 0" }}>Nessuna urgenza nei prossimi 60 giorni.</div>
          ) : (
            edizioniPrioritarie60.map((e) => <RigaPrioritaModelle key={e.corsoDataId} edizione={e} onApri={() => apriEdizione(e)} />)
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, alignItems: "start", marginTop: 18 }}>
        <div style={cardStyle}>
          <div style={{ ...hStyle, marginBottom: 0 }}>Tutti i corsi con modelle richieste</div>
          <div style={subStyle}>Solo corsi con fabbisogno attivo · ordinati per {ordine === "richieste" ? "quante ne mancano" : "urgenza"}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>
                  <th style={{ padding: "0 8px 8px 0" }}>Città</th>
                  <th style={{ padding: "0 8px 8px 0" }}>Data</th>
                  <th style={{ padding: "0 8px 8px 0" }}>Corso</th>
                  <th style={{ padding: "0 8px 8px 0" }}>Tipologie richieste</th>
                  <th style={{ padding: "0 8px 8px 0", textAlign: "right" }}>Richieste</th>
                  <th style={{ padding: "0 0 8px 0", textAlign: "right" }}>Da trovare</th>
                </tr>
              </thead>
              <tbody>
                {edizioniPerMese.map((gruppo) => (
                  <React.Fragment key={gruppo.chiave}>
                    <tr>
                      <td colSpan={6} style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, background: BG, padding: "7px 10px", borderRadius: 6 }}>
                        {gruppo.etichetta}
                      </td>
                    </tr>
                    {gruppo.edizioni.map((e) => (
                      <tr key={e.corsoDataId} onClick={() => apriEdizione(e)} style={{ cursor: "pointer", borderTop: `1px solid ${CREAM_BORDER}` }}>
                        <td style={{ padding: "10px 8px 10px 0", ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{e.cittaNome.toUpperCase()}</td>
                        <td style={{ padding: "10px 8px", ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{fmtDataCompatta(e.dataInizio, e.dataFine).toUpperCase()}</td>
                        <td style={{ padding: "10px 8px", ...fontBody, fontSize: 13, color: NAVY }}>{toTitleCase(e.corsoNome)}</td>
                        <td style={{ padding: "10px 8px" }}><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{Object.entries(e.tipologie).map(([t, n]) => <BadgeTipologia key={t} testo={t} conteggio={n} />)}</div></td>
                        <td style={{ padding: "10px 8px", ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, textAlign: "right" }}>{e.richieste}</td>
                        <td style={{ padding: "10px 0", ...fontBody, fontSize: 13, fontWeight: 700, textAlign: "right", color: e.daTrovare > 0 ? "#C0392B" : "#2E7D32" }}>{e.daTrovare}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {edizioniFiltrate.length === 0 && <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: "20px 0" }}>Nessun corso trovato con questi filtri.</div>}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ ...hStyle, marginBottom: 12 }}>Richieste totali per città</div>
          {perCitta.length === 0 ? (
            <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Nessuna richiesta attiva.</div>
          ) : (
            perCitta.map((c) => <RigaCittaModelle key={c.citta} dati={c} onApriEdizione={apriEdizione} />)
          )}
        </div>
      </div>

      {modaleDaTrovare && <ModaleSlotDaTrovare slotList={slotDaTrovare} ctx={ctx} ricarica={ricaricaLocale} onClose={() => setModaleDaTrovare(false)} />}
      {modaleAssegnate && <ModaleModelleAssegnate slotList={slotAssegnati} slotDaTrovare={slotDaTrovare} ctx={ctx} ricarica={ricaricaLocale} onClose={() => setModaleAssegnate(false)} />}
    </div>
  );
}

// pagina "Gestione modelle": Dashboard (fabbisogno/scadenze/assegnazioni)
// più le stesse 3 modalità di "Date corsi" già usate in Dashboard
// venditori/Gestione corsi — qui pilotate da tab in alto invece che dalle
// pillole interne di SezioneDateCorsi, per restare fedeli al mockup
// (Dashboard | Elenco richieste | Calendario | Archivio). Cliccando una
// data si entra direttamente nella scheda "Assegna modelle" di
// quell'edizione (onApriData qui è apriDataModelle, non apriData)
function PaginaGestioneModelle({
  corsi, location, corsiDate, iscritti, master, corsiGiorni, ricarica, onBack, apriDataModelle,
  filtroCorsoHome, setFiltroCorsoHome, filtroCittaHome, setFiltroCittaHome, filtroMasterHome, setFiltroMasterHome,
  cronologicoHome, setCronologicoHome,
  apriFiltroCorsoHome, setApriFiltroCorsoHome, apriFiltroCittaHome, setApriFiltroCittaHome, apriFiltroMasterHome, setApriFiltroMasterHome,
  selectFiltroCorsoHomeRef, selectFiltroCittaHomeRef, selectFiltroMasterHomeRef,
}) {
  const isMobile = useIsMobile();
  const [tabGM, setTabGM] = useState("dashboard"); // dashboard | richieste | calendario | archivio
  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Team</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div>
            <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Gestione modelle</div>
            <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Fabbisogno, scadenze e assegnazioni</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <TabPillola attivo={tabGM === "dashboard"} onClick={() => setTabGM("dashboard")}>Dashboard</TabPillola>
            <TabPillola attivo={tabGM === "richieste"} onClick={() => setTabGM("richieste")}>Elenco richieste</TabPillola>
            <TabPillola attivo={tabGM === "calendario"} onClick={() => setTabGM("calendario")}>Calendario</TabPillola>
            <TabPillola attivo={tabGM === "archivio"} onClick={() => setTabGM("archivio")}>Archivio</TabPillola>
          </div>
        </div>
        <div style={{ marginBottom: 20 }} />

        {tabGM === "dashboard" ? (
          <PaginaDashboardModelle
            corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master} corsiGiorni={corsiGiorni}
            ricarica={ricarica} apriDataModelle={apriDataModelle}
          />
        ) : (
          <SezioneDateCorsi
            corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master}
            ricarica={ricarica} onApriData={apriDataModelle}
            filtroCorsoHome={filtroCorsoHome} setFiltroCorsoHome={setFiltroCorsoHome}
            filtroCittaHome={filtroCittaHome} setFiltroCittaHome={setFiltroCittaHome}
            filtroMasterHome={filtroMasterHome} setFiltroMasterHome={setFiltroMasterHome}
            cronologicoHome={cronologicoHome} setCronologicoHome={setCronologicoHome}
            apriFiltroCorsoHome={apriFiltroCorsoHome} setApriFiltroCorsoHome={setApriFiltroCorsoHome}
            apriFiltroCittaHome={apriFiltroCittaHome} setApriFiltroCittaHome={setApriFiltroCittaHome}
            apriFiltroMasterHome={apriFiltroMasterHome} setApriFiltroMasterHome={setApriFiltroMasterHome}
            selectFiltroCorsoHomeRef={selectFiltroCorsoHomeRef} selectFiltroCittaHomeRef={selectFiltroCittaHomeRef} selectFiltroMasterHomeRef={selectFiltroMasterHomeRef}
            nascondiControlli
            tabForzata={tabGM === "archivio" ? "archivio" : "programmazione"}
            modoForzato={tabGM === "calendario" ? "calendario" : "elenco"}
          />
        )}
      </div>
    </div>
  );
}

function RigaPasswordMenu({ valoreDiDefault, onSalva }) {
  const [password, setPassword] = useState(valoreDiDefault);
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  async function salva() {
    setSalvando(true); setFatto(false);
    await onSalva(password);
    setSalvando(false); setFatto(true);
    setTimeout(() => setFatto(false), 2000);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        style={{ ...inputStyle, maxWidth: 220 }}
        placeholder="Nessuna (solo codice amministratore)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={salva}
        disabled={salvando}
        style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: "8px 12px", cursor: salvando ? "default" : "pointer" }}
      >
        {salvando ? "Salvo…" : fatto ? "Salvata ✓" : "Salva"}
      </button>
    </div>
  );
}

// pannello dietro la rotellina in home (codice CODICE_ROTELLINA): imposta,
// voce per voce, la password che sblocca ciascuna area protetta della
// home — un modo per delegare l'accesso a una singola area senza dare il
// codice amministratore generale, che invece continua a funzionare ovunque
function PaginaPasswordMenu({ passwordMenu, ricarica, onBack }) {
  const isMobile = useIsMobile();
  const [msg, setMsg] = useState("");
  async function salvaPassword(vista, password) {
    const { error } = await supabase.from("password_menu").upsert({ vista, password: password.trim() }, { onConflict: "vista" });
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Password aggiornata.");
    ricarica();
  }
  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontDisplay, fontSize: 24, fontWeight: 700, color: NAVY }}>Password menù</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Password di accesso all'app</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 }}>
          Le password inserite nella schermata di ingresso. Cambiale qui in qualsiasi momento.
        </div>
        {PASSWORD_SISTEMA_MENU.map((v) => {
          const riga = passwordMenu.find((p) => p.vista === v.vista);
          return (
            <div key={v.vista} style={{ ...cardStyle, marginBottom: 10, padding: 14 }}>
              <div style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 3 }}>{v.etichetta}</div>
              <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 8 }}>{v.descrizione}</div>
              <RigaPasswordMenu valoreDiDefault={riga?.password || v.fallback} onSalva={(pwd) => salvaPassword(v.vista, pwd)} />
            </div>
          );
        })}

        <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4, marginTop: 24 }}>Password per singola voce del menù</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 20 }}>
          Imposta una password per ogni voce protetta della home: chi la conosce entra solo in quella voce. Il codice amministratore generale continua a funzionare ovunque, in aggiunta. Campo vuoto = resta valido solo il codice amministratore.
        </div>
        {VISTE_PROTETTE_MENU.map((v) => {
          const riga = passwordMenu.find((p) => p.vista === v.vista);
          return (
            <div key={v.vista} style={{ ...cardStyle, marginBottom: 10, padding: 14 }}>
              <div style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{v.etichetta}</div>
              <RigaPasswordMenu valoreDiDefault={riga?.password || ""} onSalva={(pwd) => salvaPassword(v.vista, pwd)} />
            </div>
          );
        })}
        {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 6 }}>{msg}</div>}
      </div>
    </div>
  );
}

// ---------- Impostazioni ----------
// un blocco "Giorno N" nel template di un corso-tipo: quali modelle
// servono quel giorno (Modella del Master per la demo e/o modelle degli
// Allievi) e con quale trattamento — vale per tutte le edizioni del corso
function nuovoGiornoCorsoVuoto(numero) {
  return {
    numero_giorno: numero,
    richiede_modella_master: false, mattina_master: false, pomeriggio_master: false, tipo_modella_master: "",
    richiede_modelle_allievi: false, mattina_allievi: false, pomeriggio_allievi: false, tipo_modella_allievi: "",
  };
}
// una riga "turno (MAT/POM) + tipo di trattamento", usata identica sia
// per il blocco Modella del Master sia per il blocco Modella Allievi:
// stessa forma, dati indipendenti, così non si confondono mai i due turni
// né i due trattamenti quando entrambi ricorrono nello stesso giorno
function RigaTurnoETipoGiorno({ etichetta, coloreEtichetta, mattina, pomeriggio, tipo, opzioniTipo, onCambiaMattina, onCambiaPomeriggio, onCambiaTipo }) {
  return (
    <div style={{ background: BG, borderRadius: 8, padding: 10 }}>
      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: coloreEtichetta, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>{etichetta}</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 8, ...fontBody, fontSize: 12.5, color: NAVY }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <input type="checkbox" checked={mattina} onChange={(e) => onCambiaMattina(e.target.checked)} /> MAT
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <input type="checkbox" checked={pomeriggio} onChange={(e) => onCambiaPomeriggio(e.target.checked)} /> POM
        </label>
      </div>
      <select style={{ ...inputStyle, fontSize: 13, background: "#fff" }} value={tipo || ""} onChange={(e) => onCambiaTipo(e.target.value)}>
        <option value="">— Tipo trattamento —</option>
        {opzioniTipo.map((opz) => <option key={opz} value={opz}>{opz}</option>)}
      </select>
    </div>
  );
}
function BloccoGiornoCorso({ giorno, onCambia, opzioniTipo }) {
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Giorno {giorno.numero_giorno}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: giorno.richiede_modella_master || giorno.richiede_modelle_allievi ? 10 : 0 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
          <input type="checkbox" checked={giorno.richiede_modella_master} onChange={(e) => onCambia({ ...giorno, richiede_modella_master: e.target.checked })} />
          Modella del Master
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
          <input type="checkbox" checked={giorno.richiede_modelle_allievi} onChange={(e) => onCambia({ ...giorno, richiede_modelle_allievi: e.target.checked })} />
          Allievi
        </label>
      </div>

      {giorno.richiede_modella_master && (
        <div style={{ marginBottom: giorno.richiede_modelle_allievi ? 8 : 0 }}>
          <RigaTurnoETipoGiorno
            etichetta="Modella del Master" coloreEtichetta={GOLD}
            mattina={giorno.mattina_master} pomeriggio={giorno.pomeriggio_master} tipo={giorno.tipo_modella_master}
            opzioniTipo={opzioniTipo}
            onCambiaMattina={(v) => onCambia({ ...giorno, mattina_master: v })}
            onCambiaPomeriggio={(v) => onCambia({ ...giorno, pomeriggio_master: v })}
            onCambiaTipo={(v) => onCambia({ ...giorno, tipo_modella_master: v })}
          />
        </div>
      )}
      {giorno.richiede_modelle_allievi && (
        <RigaTurnoETipoGiorno
          etichetta="Modella Allievi" coloreEtichetta={MUTED}
          mattina={giorno.mattina_allievi} pomeriggio={giorno.pomeriggio_allievi} tipo={giorno.tipo_modella_allievi}
          opzioniTipo={opzioniTipo}
          onCambiaMattina={(v) => onCambia({ ...giorno, mattina_allievi: v })}
          onCambiaPomeriggio={(v) => onCambia({ ...giorno, pomeriggio_allievi: v })}
          onCambiaTipo={(v) => onCambia({ ...giorno, tipo_modella_allievi: v })}
        />
      )}
    </div>
  );
}
// true se un giorno richiede una modella ma non ha scelto il suo tipo di
// trattamento: blocca il salvataggio (Master e Allievi controllati separatamente)
function giorniCorsoNonValidi(giorni) {
  return giorni.some((g) => (g.richiede_modella_master && !g.tipo_modella_master) || (g.richiede_modelle_allievi && !g.tipo_modella_allievi));
}

// card di un corso-tipo nella griglia "Aggiungi corso"
function CardCorso({ corso, onModifica, onElimina }) {
  const [menuAperto, setMenuAperto] = useState(false);
  return (
    <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 5, background: corso.colore }} />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, minWidth: 0 }}>{corso.nome}</div>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setMenuAperto((v) => !v)} title="Altre azioni" style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4, fontSize: 18, lineHeight: 1 }}>⋯</button>
            {menuAperto && (
              <>
                <div onClick={() => setMenuAperto(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
                <div style={{ position: "absolute", right: 0, top: "100%", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.14)", zIndex: 10, minWidth: 110, overflow: "hidden" }}>
                  <button onClick={() => { setMenuAperto(false); onElimina(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", color: "#C0392B", ...fontBody, fontSize: 13 }}>Elimina</button>
                </div>
              </>
            )}
          </div>
        </div>
        {corso.categoria && (
          <span style={{ display: "inline-block", ...fontBody, fontSize: 11, fontWeight: 700, color: NAVY, background: BG, borderRadius: 6, padding: "3px 9px", marginBottom: 10 }}>{corso.categoria}</span>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, ...fontBody, fontSize: 13, color: NAVY }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></svg>
            {corso.posti_max} posti
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, ...fontBody, fontSize: 13, color: corso.diploma_template_path ? "#2E7D32" : MUTED }}>
            {corso.diploma_template_path ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></svg>
            )}
            {corso.diploma_template_path ? "Diploma caricato" : "Diploma da caricare"}
          </div>
        </div>
        <button onClick={onModifica} style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Modifica</button>
      </div>
    </div>
  );
}

function Impostazioni({ corsi, location, master, hotel, assistente, leva, corsiGiorni, tipiModella, corsiTipiModella, venditori, ricarica, onBack, onApriAssegnazioneMaster, onApriFontDiplomi, onApriSettingLoghi }) {
  const isMobile = useIsMobile();
  const [nomeCorso, setNomeCorso] = useState("");
  const [colore, setColore] = useState("#4A90D9");
  const [postiMax, setPostiMax] = useState(10);
  const [durataCorso, setDurataCorso] = useState("");
  const [giorniCorso, setGiorniCorso] = useState([]);
  const [durataCorsoModifica, setDurataCorsoModifica] = useState("");
  const [giorniCorsoModifica, setGiorniCorsoModifica] = useState([]);
  const [categoriaCorso, setCategoriaCorso] = useState("");
  const [modCategoriaCorso, setModCategoriaCorso] = useState("");
  const [vistaCorsiModal, setVistaCorsiModal] = useState("griglia"); // griglia | nuovo | modifica
  const [ricercaCorsi, setRicercaCorsi] = useState("");
  const [tipiModellaSelCorso, setTipiModellaSelCorso] = useState([]);
  const [tipiModellaSelCorsoModifica, setTipiModellaSelCorsoModifica] = useState([]);
  const [nomeLoc, setNomeLoc] = useState("");
  const [postiMaxLoc, setPostiMaxLoc] = useState("");
  const [msg, setMsg] = useState("");
  const [showCorsoModal, setShowCorsoModal] = useState(false);
  const [showTipiModellaModal, setShowTipiModellaModal] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showAssistenteModal, setShowAssistenteModal] = useState(false);
  const [showLevaModal, setShowLevaModal] = useState(false);
  const [showVenditoriModal, setShowVenditoriModal] = useState(false);
  // il cellulare vive in una colonna a sé, interrogata solo qui (non nel
  // caricamento generale): così, se in futuro dovesse mai mancare o dare
  // errore, non rischia di svuotare l'elenco venditori usato ovunque
  // altrove (login, selezione "Tutor")
  const [telefoniVenditori, setTelefoniVenditori] = useState({});
  useEffect(() => {
    if (!showVenditoriModal) return;
    supabase.from("venditori").select("id, telefono").then(({ data }) => {
      setTelefoniVenditori(Object.fromEntries((data || []).map((v) => [v.id, v.telefono || ""])));
    });
    // si riallinea anche quando "venditori" cambia (es. dopo aver salvato
    // un numero: ricarica() in GestioneListaSemplice rifà fetchDati, che
    // non include più il telefono, quindi va ripreso da qui)
  }, [showVenditoriModal, venditori]);

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

  // "Nessuna riga selezionata" per un corso = nessuna restrizione: nei
  // selettori "tipo modella" compaiono comunque tutti i tipi del catalogo
  const nomiTipiModella = (tipiModella || []).map((t) => t.nome);
  function opzioniTipoPerSelezione(idSelezionati) {
    if (!idSelezionati || idSelezionati.length === 0) return nomiTipiModella;
    const idsSet = new Set(idSelezionati);
    return (tipiModella || []).filter((t) => idsSet.has(t.id)).map((t) => t.nome);
  }
  const opzioniTipoNuovo = opzioniTipoPerSelezione(tipiModellaSelCorso);
  const opzioniTipoModifica = opzioniTipoPerSelezione(tipiModellaSelCorsoModifica);

  // sostituisce per intero le righe corsi_tipi_modella di un corso, stesso
  // principio non distruttivo di salvaGiorniCorso: nessun vincolo esterno
  // dipende da queste righe, quindi non c'è mai perdita di dati altrove
  async function salvaTipiModellaCorso(corsoId, idSelezionati) {
    await supabase.from("corsi_tipi_modella").delete().eq("corso_id", corsoId);
    if (idSelezionati.length > 0) {
      const { error } = await supabase.from("corsi_tipi_modella").insert(idSelezionati.map((tipoId) => ({ corso_id: corsoId, tipo_modella_id: tipoId })));
      if (error) return error;
    }
    return null;
  }

  // "Durata (giorni)" pilota l'elenco dei blocchi giorno, stesso
  // meccanismo già in uso per "Quante modelle" → elenco trattamenti
  // nell'iscrizione allievo: allunga con giorni vuoti o taglia in eccesso
  useEffect(() => {
    const n = Math.max(0, parseInt(durataCorso, 10) || 0);
    setGiorniCorso((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      return [...prev, ...Array.from({ length: n - prev.length }, (_, idx) => nuovoGiornoCorsoVuoto(prev.length + idx + 1))];
    });
  }, [durataCorso]);
  useEffect(() => {
    const n = Math.max(0, parseInt(durataCorsoModifica, 10) || 0);
    setGiorniCorsoModifica((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      return [...prev, ...Array.from({ length: n - prev.length }, (_, idx) => nuovoGiornoCorsoVuoto(prev.length + idx + 1))];
    });
  }, [durataCorsoModifica]);

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
    setModCategoriaCorso(c.categoria || "");
    setDiplomaCorsoModifica(null);
    const giorniEsistenti = (corsiGiorni || []).filter((g) => g.corso_id === c.id).sort((a, b) => a.numero_giorno - b.numero_giorno);
    setDurataCorsoModifica(giorniEsistenti.length > 0 ? String(giorniEsistenti.length) : "");
    setGiorniCorsoModifica(giorniEsistenti.map((g) => ({
      numero_giorno: g.numero_giorno,
      richiede_modella_master: g.richiede_modella_master,
      mattina_master: g.mattina_master,
      pomeriggio_master: g.pomeriggio_master,
      tipo_modella_master: g.tipo_modella_master || "",
      richiede_modelle_allievi: g.richiede_modelle_allievi,
      mattina_allievi: g.mattina_allievi,
      pomeriggio_allievi: g.pomeriggio_allievi,
      tipo_modella_allievi: g.tipo_modella_allievi || "",
    })));
    setTipiModellaSelCorsoModifica((corsiTipiModella || []).filter((x) => x.corso_id === c.id).map((x) => x.tipo_modella_id));
    setVistaCorsiModal("modifica");
  }
  function apriNuovoCorso() {
    setNomeCorso(""); setColore("#4A90D9"); setPostiMax(10); setCategoriaCorso("");
    setDiplomaCorsoNuovo(null); setDurataCorso(""); setGiorniCorso([]); setTipiModellaSelCorso([]);
    setMsg("");
    setVistaCorsiModal("nuovo");
  }
  // sostituisce per intero il template giorni di un corso: nessun dato
  // già inserito nelle edizioni (corsi_date/iscritti) dipende da queste
  // righe con un vincolo di chiave esterna, quindi accorciare la durata
  // non cancella mai nulla di già compilato altrove
  async function salvaGiorniCorso(corsoId, giorni) {
    await supabase.from("corsi_giorni").delete().eq("corso_id", corsoId);
    if (giorni.length > 0) {
      const righe = giorni.map((g) => ({
        corso_id: corsoId,
        numero_giorno: g.numero_giorno,
        richiede_modella_master: g.richiede_modella_master,
        mattina_master: g.mattina_master,
        pomeriggio_master: g.pomeriggio_master,
        tipo_modella_master: g.tipo_modella_master || null,
        richiede_modelle_allievi: g.richiede_modelle_allievi,
        mattina_allievi: g.mattina_allievi,
        pomeriggio_allievi: g.pomeriggio_allievi,
        tipo_modella_allievi: g.tipo_modella_allievi || null,
      }));
      const { error } = await supabase.from("corsi_giorni").insert(righe);
      if (error) return error;
    }
    return null;
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
    if (giorniCorsoNonValidi(giorniCorsoModifica)) { setMsg("Scegli il tipo di modella per ogni giorno che la richiede."); return; }
    setSalvandoCorso(true);
    const payload = {
      nome: modNomeCorso.trim().toUpperCase(),
      colore: modColoreCorso,
      posti_max: Number(modPostiCorso) || 10,
      categoria: modCategoriaCorso.trim() || null,
    };
    if (diplomaCorsoModifica) {
      try {
        payload.diploma_template_path = await caricaTemplateDiploma(diplomaCorsoModifica, id);
      } catch (e) { setMsg("Errore nel caricamento del diploma: " + e.message); setSalvandoCorso(false); return; }
    }
    const { error } = await supabase.from("corsi").update(payload).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); setSalvandoCorso(false); return; }
    const erroreGiorni = await salvaGiorniCorso(id, giorniCorsoModifica);
    if (erroreGiorni) { setMsg("Corso aggiornato, ma errore nel salvataggio dei giorni: " + erroreGiorni.message); setSalvandoCorso(false); return; }
    const erroreTipi = await salvaTipiModellaCorso(id, tipiModellaSelCorsoModifica);
    if (erroreTipi) { setMsg("Corso aggiornato, ma errore nel salvataggio dei tipi di modella: " + erroreTipi.message); setSalvandoCorso(false); return; }
    await ricarica();
    setSalvandoCorso(false);
    setCorsoInModifica(null);
    setDiplomaCorsoModifica(null);
    setVistaCorsiModal("griglia");
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
    if (giorniCorsoNonValidi(giorniCorso)) { setMsg("Scegli il tipo di modella per ogni giorno che la richiede."); return; }
    const ins = await supabase.from("corsi").insert({ nome: nomeCorso.trim().toUpperCase(), colore, posti_max: Number(postiMax) || 10, categoria: categoriaCorso.trim() || null }).select("id").single();
    if (ins.error) { setMsg("Errore: " + ins.error.message); return; }
    const erroreGiorni = await salvaGiorniCorso(ins.data.id, giorniCorso);
    if (erroreGiorni) { setMsg("Corso aggiunto, ma errore nel salvataggio dei giorni: " + erroreGiorni.message); }
    const erroreTipi = await salvaTipiModellaCorso(ins.data.id, tipiModellaSelCorso);
    if (erroreTipi) { setMsg("Corso aggiunto, ma errore nel salvataggio dei tipi di modella: " + erroreTipi.message); }
    if (diplomaCorsoNuovo) {
      try {
        const percorso = await caricaTemplateDiploma(diplomaCorsoNuovo, ins.data.id);
        await supabase.from("corsi").update({ diploma_template_path: percorso }).eq("id", ins.data.id);
      } catch (e) {
        setMsg("Corso aggiunto, ma errore nel caricamento del diploma: " + e.message);
        setNomeCorso(""); setDiplomaCorsoNuovo(null); setDurataCorso(""); setGiorniCorso([]); setCategoriaCorso(""); setTipiModellaSelCorso([]);
        ricarica();
        return;
      }
    }
    setNomeCorso(""); setDiplomaCorsoNuovo(null); setDurataCorso(""); setGiorniCorso([]); setCategoriaCorso(""); setTipiModellaSelCorso([]);
    if (!erroreGiorni && !erroreTipi) { setMsg("Corso aggiunto."); setVistaCorsiModal("griglia"); }
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

  const gruppiSetting = [
    {
      chiave: "team", titolo: "Team", coloreBg: "#F5E6C8", Icona: IconaGruppoTeam,
      voci: [
        { etichetta: "Definisci Leve", Icona: IconaLeveRiga, onClick: () => setShowLevaModal(true) },
        { etichetta: "Definisci Assistenti", Icona: IconaAssistentiRiga, onClick: () => setShowAssistenteModal(true) },
        { etichetta: "Definisci Master", Icona: IconaMasterRiga, onClick: () => setShowMasterModal(true) },
        { etichetta: "Gestione venditori", Icona: IconaVenditoreRiga, onClick: () => setShowVenditoriModal(true) },
      ],
    },
    {
      chiave: "sedi", titolo: "Sedi e corsi", coloreBg: "#D9E8F5", Icona: IconaGruppoSediCorsi,
      voci: [
        { etichetta: "Definisci corsi", Icona: IconaCorsoRiga, onClick: () => { setShowCorsoModal(true); setVistaCorsiModal("griglia"); } },
        { etichetta: "Definisci tipi di modelle", Icona: IconaTipoModellaRiga, onClick: () => setShowTipiModellaModal(true) },
        { etichetta: "Definisci Hotel", Icona: IconaHotelRiga, onClick: () => setShowHotelModal(true) },
        { etichetta: "Definisci Location", Icona: IconaPin, onClick: () => setShowLocModal(true) },
        { etichetta: "Assegna Master", Icona: IconaMasterRiga, onClick: onApriAssegnazioneMaster },
      ],
    },
    {
      chiave: "documenti", titolo: "Documenti e brand", coloreBg: "#DCEEDD", Icona: IconaGruppoDocumenti,
      voci: [
        { etichetta: "Setting diplomi", Icona: IconaDiplomaRiga, onClick: onApriFontDiplomi },
        { etichetta: "Setting loghi", Icona: IconaFormeRiga, onClick: onApriSettingLoghi },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Setting" onBack={onBack} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 18, alignItems: "start" }}>
        {gruppiSetting.map((g) => (
          <div key={g.chiave} style={{ ...cardStyle, padding: 20, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: g.coloreBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <g.Icona size={22} color={NAVY} />
                </div>
                <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: 0.3, textTransform: "uppercase" }}>{g.titolo}</div>
              </div>
              <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, background: BG, borderRadius: 8, padding: "3px 11px", flexShrink: 0 }}>{g.voci.length}</div>
            </div>
            <div style={{ borderTop: `1px solid ${CREAM_BORDER}` }}>
              {g.voci.map((v, i) => (
                <button
                  key={v.etichetta}
                  onClick={v.onClick}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
                    border: "none", borderBottom: i < g.voci.length - 1 ? `1px solid ${CREAM_BORDER}` : "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F7EDDB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <v.Icona size={18} color={NAVY} />
                  </div>
                  <div style={{ ...fontBody, fontSize: 14.5, fontWeight: 600, color: NAVY, flex: 1 }}>{v.etichetta}</div>
                  <IconaChevronDestra size={16} color={MUTED} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 6 }}>{msg}</div>}

      {showCorsoModal && (() => {
        const corsiFiltrati = corsi.filter((c) => {
          const q = ricercaCorsi.trim().toLowerCase();
          if (!q) return true;
          return c.nome.toLowerCase().includes(q) || (c.categoria || "").toLowerCase().includes(q);
        });
        return (
        <Modal title="Corsi" onClose={() => setShowCorsoModal(false)} maxWidth={vistaCorsiModal === "griglia" ? 1080 : 560}>
          {vistaCorsiModal === "griglia" && (
            <>
              <div style={hStyle}>Aggiungi corso</div>
              <div style={{ ...subStyle, marginBottom: 16 }}>Nome, colore univoco per il calendario, posti massimi di default.</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <CampoRicerca value={ricercaCorsi} onChange={(e) => setRicercaCorsi(e.target.value)} placeholder="Cerca" style={{ maxWidth: 260 }} />
                <Button onClick={apriNuovoCorso}>+ Nuovo tipo di corso</Button>
              </div>
              <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 14 }}>{corsiFiltrati.length} tipologie</div>
              {corsiFiltrati.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun corso trovato.</div>}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 14 }}>
                {corsiFiltrati.map((c) => (
                  <CardCorso key={c.id} corso={c} onModifica={() => apriModificaCorso(c)} onElimina={() => eliminaCorso(c.id)} />
                ))}
              </div>
              {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
            </>
          )}

          {vistaCorsiModal === "nuovo" && (
            <>
              <button onClick={() => setVistaCorsiModal("griglia")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: NAVY, padding: 0, marginBottom: 14, ...fontBody, fontSize: 13, fontWeight: 600 }}>
                <IconaFrecciaSinistra size={15} /> Tutti i corsi
              </button>
              <div style={hStyle}>Nuovo tipo di corso</div>
              <div style={subStyle}>Nome, colore univoco per il calendario, posti massimi di default.</div>
              <Field label="Nome corso">
                <input style={{ ...inputStyle, textTransform: "uppercase" }} value={nomeCorso} onChange={(e) => setNomeCorso(e.target.value.toUpperCase())} placeholder="es. MICROBLADING" />
              </Field>
              <Field label="Categoria (opzionale)">
                <input style={{ ...inputStyle, textTransform: "uppercase" }} value={categoriaCorso} onChange={(e) => setCategoriaCorso(e.target.value.toUpperCase())} placeholder="es. PMU" />
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
              <Field label="Tipi di modella selezionabili in questo corso (vuoto = tutti)">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: 10, maxHeight: 160, overflow: "auto" }}>
                  {tipiModella.length === 0 && <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun tipo di modella definito ancora — vedi "Definisci tipi di modelle".</span>}
                  {tipiModella.map((t) => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
                      <input type="checkbox" checked={tipiModellaSelCorso.includes(t.id)} onChange={(e) => setTipiModellaSelCorso((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))} />
                      {t.nome}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Durata (giorni, opzionale — serve per organizzare le modelle per giorno)">
                <input type="number" min="0" style={inputStyle} value={durataCorso} onChange={(e) => setDurataCorso(e.target.value)} />
              </Field>
              {giorniCorso.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Modelle richieste per giorno</div>
                  {giorniCorso.map((g, idx) => (
                    <BloccoGiornoCorso key={g.numero_giorno} giorno={g} opzioniTipo={opzioniTipoNuovo} onCambia={(nuovo) => setGiorniCorso((prev) => prev.map((x, i) => (i === idx ? nuovo : x)))} />
                  ))}
                </div>
              )}
              <Button onClick={aggiungiCorso}>Aggiungi corso</Button>
              {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
            </>
          )}

          {vistaCorsiModal === "modifica" && corsoInModifica && (() => {
            const c = corsi.find((x) => x.id === corsoInModifica);
            if (!c) return null;
            return (
              <>
                <button onClick={() => { setCorsoInModifica(null); setDiplomaCorsoModifica(null); setVistaCorsiModal("griglia"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: NAVY, padding: 0, marginBottom: 14, ...fontBody, fontSize: 13, fontWeight: 600 }}>
                  <IconaFrecciaSinistra size={15} /> Tutti i corsi
                </button>
                <div style={hStyle}>Modifica corso</div>
                <div style={{ ...subStyle, marginBottom: 16 }}>Clicca "Elimina" nella griglia per rimuoverlo (rimuove anche le sue date e i relativi iscritti).</div>
                <Field label="Nome corso">
                  <input style={{ ...inputStyle, textTransform: "uppercase" }} value={modNomeCorso} onChange={(e) => setModNomeCorso(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Categoria (opzionale)">
                  <input style={{ ...inputStyle, textTransform: "uppercase" }} value={modCategoriaCorso} onChange={(e) => setModCategoriaCorso(e.target.value.toUpperCase())} placeholder="es. PMU" />
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
                <Field label="Tipi di modella selezionabili in questo corso (vuoto = tutti)">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: 10, maxHeight: 160, overflow: "auto" }}>
                    {tipiModella.length === 0 && <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun tipo di modella definito ancora — vedi "Definisci tipi di modelle".</span>}
                    {tipiModella.map((t) => (
                      <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY }}>
                        <input type="checkbox" checked={tipiModellaSelCorsoModifica.includes(t.id)} onChange={(e) => setTipiModellaSelCorsoModifica((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))} />
                        {t.nome}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Durata (giorni, opzionale — serve per organizzare le modelle per giorno)">
                  <input type="number" min="0" style={inputStyle} value={durataCorsoModifica} onChange={(e) => setDurataCorsoModifica(e.target.value)} />
                </Field>
                {giorniCorsoModifica.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Modelle richieste per giorno</div>
                    {giorniCorsoModifica.map((g, idx) => (
                      <BloccoGiornoCorso key={g.numero_giorno} giorno={g} opzioniTipo={opzioniTipoModifica} onCambia={(nuovo) => setGiorniCorsoModifica((prev) => prev.map((x, i) => (i === idx ? nuovo : x)))} />
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => salvaModificaCorso(c.id)} disabled={salvandoCorso}>{salvandoCorso ? "Salvataggio…" : "Salva"}</Button>
                  <Button variant="ghost" disabled={salvandoCorso} onClick={() => { setCorsoInModifica(null); setDiplomaCorsoModifica(null); setVistaCorsiModal("griglia"); }}>Annulla</Button>
                </div>
                {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 12 }}>{msg}</div>}
              </>
            );
          })()}
        </Modal>
        );
      })()}

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

      {showTipiModellaModal && (
        <Modal title="Tipi di modella" onClose={() => setShowTipiModellaModal(false)}>
          <div style={{ ...subStyle, marginTop: -4 }}>Trattamenti tra cui scegliere quando un allievo richiede una modella. In "Definisci corsi" puoi limitare quali di questi sono selezionabili per ciascun corso.</div>
          <GestioneListaSemplice
            nomeSingolare="Tipo di modella" nomeArticolo="un" tabella="tipi_modella"
            elementi={tipiModella} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. MICROBLADING"
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

      {showVenditoriModal && (
        <Modal title="Gestione venditori" onClose={() => setShowVenditoriModal(false)}>
          <div style={{ ...subStyle, marginTop: -4 }}>Nomi selezionabili come "Tutor" in fase di iscrizione, invece di scriverli a mano. Ogni venditore ha anche una password (in vista di un futuro login alla propria Dashboard venditori) — parte da "0000" e si può cambiare qui in qualsiasi momento — e un numero di cellulare, che useremo per l'integrazione dei messaggi con WhatsApp.</div>
          <GestioneListaSemplice
            nomeSingolare="Venditore" nomeArticolo="un" tabella="venditori"
            elementi={venditori.map((v) => ({ ...v, telefono: telefoniVenditori[v.id] || "" }))} ricarica={ricarica} msg={msg} setMsg={setMsg}
            placeholder="es. MARIA ROSSI"
            mostraPassword passwordDiDefault="0000"
            onImpostaPassword={async (venditoreId, password) => {
              const { data, error } = await supabase.functions.invoke("venditori-imposta-password", { body: { venditoreId, password } });
              if (error || data?.errore) setMsg("Errore password: " + (data?.errore || error.message));
            }}
            mostraTelefono
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
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
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

      <div style={{ ...subStyle, marginTop: 24, marginBottom: -4 }}>Clicca la matita per modificare una data (anche per spostarla), il cestino per eliminarla (rimuove anche i suoi iscritti).</div>

      <SezioneDateCorsi
        corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master}
        ricarica={ricarica} onApriData={onApriData}
        filtroCorsoHome={filtroCorsoDate} setFiltroCorsoHome={setFiltroCorsoDate}
        filtroCittaHome={filtroCittaDate} setFiltroCittaHome={setFiltroCittaDate}
        filtroMasterHome={filtroMasterDate} setFiltroMasterHome={setFiltroMasterDate}
        cronologicoHome={cronologicoDate} setCronologicoHome={setCronologicoDate}
        apriFiltroCorsoHome={apriFiltroCorsoDate} setApriFiltroCorsoHome={setApriFiltroCorsoDate}
        apriFiltroCittaHome={apriFiltroCittaDate} setApriFiltroCittaHome={setApriFiltroCittaDate}
        apriFiltroMasterHome={apriFiltroMasterDate} setApriFiltroMasterHome={setApriFiltroMasterDate}
        selectFiltroCorsoHomeRef={selectFiltroCorsoDateRef} selectFiltroCittaHomeRef={selectFiltroCittaDateRef} selectFiltroMasterHomeRef={selectFiltroMasterDateRef}
        onEdit={apriModificaData}
        onDelete={eliminaData}
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

// ---------- Analisi costi di gestione ----------
// le 20 categorie + "Versamenti e adempimenti" e le loro sotto-voci ora
// vivono nel database (costi_categorie/costi_sottocategorie, gestibili
// dal "Catalogo delle categorie"), non più come costante fissa qui.
// Questi sono solo piccoli helper di lookup che operano sugli array
// caricati da fetchDati().
function categoriaCostoDi(costiCategorie, id) {
  return (costiCategorie || []).find((c) => c.id === id) || null;
}
function sottocategoriaCostoDi(costiSottocategorie, id) {
  return (costiSottocategorie || []).find((v) => v.id === id) || null;
}
function sottocategorieDiCategoria(costiSottocategorie, categoriaId) {
  return (costiSottocategorie || [])
    .filter((v) => v.categoria_id === categoriaId && v.attiva !== false)
    .sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
}
// categorie "aziendali" (non legate a una singola classe): taggabili
// solo da "+ Nuova operazione" nella dashboard, non dal "+" del
// Riepilogo amministrativo di una singola data di corso
const CHIAVI_ESCLUSE_RIEPILOGO = ["personale_accademia", "oneri_contributivi", "commerciale", "commissioni_pagamento", "pubblicita_acquisizione", "agenzie_consulenti", "affitto_aule_esterne", "struttura_centrale", "fiere_eventi", "prodotti_vendita", "versamenti_adempimenti"];

// i 10 costi fissi del pannello "Riepilogo amministrativo": ognuno è
// una casella che apre "Nuova spesa" già precompilata su categoria/
// sotto-categoria/classe. Il valore mostrato in ciascuna casella è la
// somma delle spese vere già registrate per quella classe+sotto-categoria
const CAMPI_RIEPILOGO_AMMINISTRATIVO = [
  { chiave: "costo_accademia", etichetta: "Costo accademia", categoriaId: "affitto_aule_esterne", sottocategoriaId: "affitto_aule_esterne__quota_accademia" },
  { chiave: "costo_master", etichetta: "Costo master", categoriaId: "docenti_corsi", sottocategoriaId: "docenti_corsi__compensi_master" },
  { chiave: "costo_assistenti", etichetta: "Costo assistenti", categoriaId: "docenti_corsi", sottocategoriaId: "docenti_corsi__compensi_assistenti" },
  { chiave: "costo_pranzi", etichetta: "Costo pranzi", categoriaId: "vitto_corsi", sottocategoriaId: "vitto_corsi__costo_pranzi" },
  { chiave: "rimborso_cene", etichetta: "Rimborso cene", categoriaId: "vitto_corsi", sottocategoriaId: "vitto_corsi__rimborso_cene" },
  { chiave: "rimborso_colazioni_spesa", etichetta: "Rimborso colazioni e spesa", categoriaId: "vitto_corsi", sottocategoriaId: "vitto_corsi__rimborso_colazioni" },
  { chiave: "costo_hotel", etichetta: "Costo appartamento/hotel", categoriaId: "alloggi_corsi", sottocategoriaId: "alloggi_corsi__hotel" },
  { chiave: "costo_coordinatore", etichetta: "Costo coordinatore", categoriaId: "personale_accademia", sottocategoriaId: "personale_accademia__costo_coordinatore" },
  { chiave: "rimborso_taxi", etichetta: "Rimborso taxi", categoriaId: "viaggi_corsi", sottocategoriaId: "viaggi_corsi__taxi_trasporti_locali" },
  { chiave: "rimborso_parcheggi", etichetta: "Rimborso parcheggi", categoriaId: "viaggi_corsi", sottocategoriaId: "viaggi_corsi__rimborso_parcheggi" },
];

const ALIQUOTE_IVA_COSTI = [22, 10, 4, 0];
const STATI_SPESA = [
  { chiave: "preventivata", etichetta: "Preventivata" },
  { chiave: "impegnata", etichetta: "Impegnata" },
  { chiave: "fatturata", etichetta: "Fatturata" },
  { chiave: "pagata", etichetta: "Pagata" },
  { chiave: "parzialmente_pagata", etichetta: "Parzialmente pagata" },
  { chiave: "scaduta", etichetta: "Scaduta" },
  { chiave: "annullata", etichetta: "Annullata" },
];
const AMBITI_SPESA = [
  { chiave: "generale", etichetta: "Generale aziendale" },
  { chiave: "struttura_centrale", etichetta: "Struttura centrale" },
  { chiave: "sede", etichetta: "Sede" },
  { chiave: "corso", etichetta: "Corso" },
  { chiave: "classe", etichetta: "Classe specifica" },
  { chiave: "evento", etichetta: "Evento o fiera" },
];
const RICORRENZA_OPZIONI = ["nessuna", "mensile", "bimestrale", "trimestrale", "semestrale", "annuale", "personalizzata"];
const DIRETTO_INDIRETTO_OPZIONI = [{ chiave: "diretto", etichetta: "Diretto" }, { chiave: "indiretto", etichetta: "Indiretto" }];
const FISSO_VARIABILE_OPZIONI = [{ chiave: "fisso", etichetta: "Fisso" }, { chiave: "variabile", etichetta: "Variabile" }, { chiave: "semivariabile", etichetta: "Semivariabile" }];
const RICORRENTE_OCCASIONALE_OPZIONI = [{ chiave: "ricorrente", etichetta: "Ricorrente" }, { chiave: "occasionale", etichetta: "Occasionale" }];
const NATURA_OPZIONI = [{ chiave: "operativo", etichetta: "Operativo" }, { chiave: "investimento", etichetta: "Investimento" }, { chiave: "straordinario", etichetta: "Straordinario" }];
const CONTROLLABILITA_OPZIONI = [{ chiave: "controllabile", etichetta: "Controllabile" }, { chiave: "parzialmente_controllabile", etichetta: "Parzialmente controllabile" }, { chiave: "non_controllabile", etichetta: "Non controllabile" }];
const RIDUCIBILITA_OPZIONI = [{ chiave: "alta", etichetta: "Alta" }, { chiave: "media", etichetta: "Media" }, { chiave: "bassa", etichetta: "Bassa" }];
const ESSENZIALITA_OPZIONI = [{ chiave: "essenziale", etichetta: "Essenziale" }, { chiave: "utile", etichetta: "Utile" }, { chiave: "discrezionale", etichetta: "Discrezionale" }];
const ORIGINE_OPZIONI = [{ chiave: "manuale", etichetta: "Manuale" }, { chiave: "automatico", etichetta: "Automatico" }, { chiave: "importato", etichetta: "Importato" }];
function etichettaOpzione(lista, chiave) {
  return lista.find((o) => o.chiave === chiave)?.etichetta || chiave || "—";
}
// scostamento % rispetto al budget: "N/D" se il budget è zero/assente,
// invece di una percentuale infinita
function scostamentoBudget(effettivo, budget) {
  if (!budget) return null;
  return round1Erp(((effettivo - budget) / budget) * 100);
}

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
// blocco di calibrazione per UNA variante (nero o bianco) di una
// categoria: il nome è sempre centrato tra i 2 limiti sx/dx (trascinabili
// solo in orizzontale) e trascinabile solo in verticale; il codice
// progressivo resta libero in X/Y come prima. Il colore mostrato qui è
// sempre l'OPPOSTO di quello reale (bianco su nero, nero su bianco): solo
// per poterlo vedere durante il trascinamento, dato che in stampa il
// testo è sempre coerente col colore del logo (nero su logo nero, bianco
// su logo bianco)
function BloccoCalibrazioneLogo({ titolo, prefisso, src, config, setConfig, aggiorna, testoProvaNome, testoProvaNumero, famigliaNome }) {
  const [naturaleWidth, setNaturaleWidth] = useState(null);
  const [larghezzaMostrata, setLarghezzaMostrata] = useState(null);
  const contenitoreRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const [trascinato, setTrascinato] = useState(null); // "nome" | "numero" | "limiteSx" | "limiteDx" | null

  useEffect(() => {
    if (!src) { setLarghezzaMostrata(null); return; }
    const el = contenitoreRef.current;
    if (!el) return;
    const osservatore = new ResizeObserver((voci) => {
      for (const voce of voci) setLarghezzaMostrata(voce.contentRect.width);
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [src]);

  const scalaAnteprima = naturaleWidth && larghezzaMostrata ? larghezzaMostrata / naturaleWidth : 1;
  const coloreAnteprima = prefisso === "nero" ? "#ffffff" : "#000000";
  const kY = `${prefisso}_nome_pos_y`;
  const kNumX = `${prefisso}_numero_pos_x`;
  const kNumY = `${prefisso}_numero_pos_y`;
  const kSx = `${prefisso}_nome_limite_sx`;
  const kDx = `${prefisso}_nome_limite_dx`;
  const kFontNome = `${prefisso}_nome_font_size`;
  const kFontNumero = `${prefisso}_numero_font_size`;

  function iniziaDrag(e, chiave) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { chiave, pointerId: e.pointerId };
    setTrascinato(chiave);
  }
  function muoviDrag(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId || !contenitoreRef.current) return;
    const rect = contenitoreRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    if (d.chiave === "nome") setConfig((c) => ({ ...c, [kY]: y }));
    else if (d.chiave === "numero") setConfig((c) => ({ ...c, [kNumX]: x, [kNumY]: y }));
    else if (d.chiave === "limiteSx") setConfig((c) => ({ ...c, [kSx]: Math.min(x, c[kDx] - 2) }));
    else if (d.chiave === "limiteDx") setConfig((c) => ({ ...c, [kDx]: Math.max(x, c[kSx] + 2) }));
  }
  function fineDrag() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setTrascinato(null);
    if (d.chiave === "nome") aggiorna({ [kY]: config[kY] });
    else if (d.chiave === "numero") aggiorna({ [kNumX]: config[kNumX], [kNumY]: config[kNumY] });
    else if (d.chiave === "limiteSx") aggiorna({ [kSx]: config[kSx] });
    else if (d.chiave === "limiteDx") aggiorna({ [kDx]: config[kDx] });
  }

  if (!src) return null;

  const limiteSxPx = naturaleWidth ? (naturaleWidth * config[kSx]) / 100 : 0;
  const limiteDxPx = naturaleWidth ? (naturaleWidth * config[kDx]) / 100 : 0;
  const adattamento = naturaleWidth
    ? adattaNomeLogo(testoProvaNome, config[kFontNome], famigliaNome, Math.max(1, limiteDxPx - limiteSxPx))
    : { fontSize: config[kFontNome], spaziatura: 0 };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{titolo}</div>
      <div ref={contenitoreRef} style={{ position: "relative", width: "100%", maxWidth: naturaleWidth || 500, touchAction: "none" }}>
        <img
          src={src}
          alt={titolo}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: `1px solid ${CREAM_BORDER}`, background: "#EFEFEF" }}
          onLoad={(e) => setNaturaleWidth(e.target.naturalWidth)}
        />

        <div
          onPointerDown={(e) => iniziaDrag(e, "limiteSx")}
          onPointerMove={muoviDrag}
          onPointerUp={fineDrag}
          onPointerCancel={fineDrag}
          title="Limite sinistro del nome"
          style={{ position: "absolute", left: `${config[kSx]}%`, top: 0, bottom: 0, width: 16, marginLeft: -8, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        >
          <div style={{ width: 2, height: "100%", background: "#16A34A", opacity: trascinato === "limiteSx" ? 1 : 0.6 }} />
        </div>
        <div
          onPointerDown={(e) => iniziaDrag(e, "limiteDx")}
          onPointerMove={muoviDrag}
          onPointerUp={fineDrag}
          onPointerCancel={fineDrag}
          title="Limite destro del nome"
          style={{ position: "absolute", left: `${config[kDx]}%`, top: 0, bottom: 0, width: 16, marginLeft: -8, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        >
          <div style={{ width: 2, height: "100%", background: "#16A34A", opacity: trascinato === "limiteDx" ? 1 : 0.6 }} />
        </div>

        <div
          onPointerDown={(e) => iniziaDrag(e, "nome")}
          onPointerMove={muoviDrag}
          onPointerUp={fineDrag}
          onPointerCancel={fineDrag}
          title="Trascina su/giù per la posizione verticale del nome"
          style={{
            position: "absolute", left: `${(config[kSx] + config[kDx]) / 2}%`, top: `${config[kY]}%`,
            transform: "translate(-50%, -50%)", cursor: "ns-resize", padding: 4,
            border: "2px dashed #2563EB", borderRadius: 4,
            background: trascinato === "nome" ? "#2563EB22" : "transparent", touchAction: "none",
          }}
        >
          <div style={{ display: "flex", userSelect: "none", pointerEvents: "none" }}>
            {testoProvaNome.split("").map((ch, i) => (
              <span
                key={i}
                style={{
                  fontFamily: `"${famigliaNome || "sans-serif"}", sans-serif`,
                  fontSize: adattamento.fontSize * scalaAnteprima,
                  color: coloreAnteprima,
                  whiteSpace: "pre",
                  marginRight: i < testoProvaNome.length - 1 ? adattamento.spaziatura * scalaAnteprima : 0,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>

        <div
          onPointerDown={(e) => iniziaDrag(e, "numero")}
          onPointerMove={muoviDrag}
          onPointerUp={fineDrag}
          onPointerCancel={fineDrag}
          title="Trascina per posizionare il codice progressivo"
          style={{
            position: "absolute", left: `${config[kNumX]}%`, top: `${config[kNumY]}%`,
            transform: "translate(-50%, -50%)", cursor: "grab", padding: 4,
            border: "2px dashed #EA580C", borderRadius: 4,
            background: trascinato === "numero" ? "#EA580C22" : "transparent", touchAction: "none",
          }}
        >
          <span style={{ fontSize: config[kFontNumero] * scalaAnteprima, color: coloreAnteprima, whiteSpace: "nowrap", userSelect: "none", pointerEvents: "none" }}>
            {testoProvaNumero}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
          <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 140 }}>Nome allieva (dimensione base)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => aggiorna({ [kFontNome]: Math.max(6, config[kFontNome] - 2) })} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>−</button>
            <span style={{ ...fontBody, fontSize: 13, color: NAVY, minWidth: 30, textAlign: "center" }}>{config[kFontNome]}</span>
            <button onClick={() => aggiorna({ [kFontNome]: Math.min(400, config[kFontNome] + 2) })} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
          </div>
        </div>
        <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>
          Il nome viene sempre centrato tra le 2 righe verdi: se è più corto la spaziatura tra le lettere si allarga per riempirle, se è più lungo il font si rimpicciolisce automaticamente finché non ci entra.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#EA580C", flexShrink: 0 }} />
          <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 140 }}>Codice progressivo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => aggiorna({ [kFontNumero]: Math.max(6, config[kFontNumero] - 2) })} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>−</button>
            <span style={{ ...fontBody, fontSize: 13, color: NAVY, minWidth: 30, textAlign: "center" }}>{config[kFontNumero]}</span>
            <button onClick={() => aggiorna({ [kFontNumero]: Math.min(400, config[kFontNumero] + 2) })} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriaLogo({ categoria, ricarica, famigliaNome }) {
  const [config, setConfig] = useState(categoria);
  const [previewNeroUrl, setPreviewNeroUrl] = useState(null);
  const [previewBiancoUrl, setPreviewBiancoUrl] = useState(null);
  const [msg, setMsg] = useState("");
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

  const testoProvaNome = "NOME COGNOME";
  const testoProvaNumero = calcolaCodiceLogo("Andrea Paura", "Carla Bosi", 402);

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
            <Field label="Logo bianco (diventa il riferimento qui sotto)">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="file" accept="image/*" style={{ ...inputStyle, flex: 1, minWidth: 160 }} onChange={(e) => caricaLogo(e.target.files?.[0] || null, "logo_bianco_path")} />
                {srcBianco && <BadgeFileCaricato />}
              </div>
            </Field>
          </div>
        )}
      </div>

      <BloccoCalibrazioneLogo
        titolo="Posizionamento su logo nero (in stampa il testo è nero, qui è mostrato bianco solo per poterlo vedere)"
        prefisso="nero"
        src={srcNero}
        config={config}
        setConfig={setConfig}
        aggiorna={aggiorna}
        testoProvaNome={testoProvaNome}
        testoProvaNumero={testoProvaNumero}
        famigliaNome={famigliaNome}
      />
      {config.richiede_bianco && (
        <BloccoCalibrazioneLogo
          titolo="Posizionamento su logo bianco (in stampa il testo è bianco, qui è mostrato nero solo per poterlo vedere)"
          prefisso="bianco"
          src={srcBianco}
          config={config}
          setConfig={setConfig}
          aggiorna={aggiorna}
          testoProvaNome={testoProvaNome}
          testoProvaNumero={testoProvaNumero}
          famigliaNome={famigliaNome}
        />
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
  const [famigliaNomeAnteprima, setFamigliaNomeAnteprima] = useState(null);
  const modificatoLocalmenteRef = React.useRef(false);

  useEffect(() => {
    if (!modificatoLocalmenteRef.current) {
      const nuovo = loghiImpostazioni || CONFIG_LOGHI_DEFAULT;
      setConfig(nuovo);
      setNumeroPartenza(String(nuovo.prossimo_numero));
    }
  }, [loghiImpostazioni]);

  // carica il font del nome anche qui, per far vedere in anteprima lo
  // stesso adattamento (spaziatura/rimpicciolimento) che verrà usato in
  // "Generazione loghi": senza il font vero, misurare la larghezza del
  // nome darebbe una stima imprecisa e la calibrazione non sarebbe fedele
  useEffect(() => {
    async function carica() {
      if (!config.font_nome_path) { setFamigliaNomeAnteprima(null); return; }
      try {
        const { data } = supabase.storage.from("loghi-fonts").getPublicUrl(config.font_nome_path);
        const f = new FontFace("loghiFontNomeSetting", `url(${data.publicUrl})`);
        await f.load();
        document.fonts.add(f);
        setFamigliaNomeAnteprima("loghiFontNomeSetting");
      } catch {
        setFamigliaNomeAnteprima(null);
      }
    }
    carica();
  }, [config.font_nome_path]);

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

      {CATEGORIE_LOGO
        .map((c) => loghiCategorie.find((lc) => lc.chiave === c.chiave))
        .filter(Boolean)
        .map((cat) => (
          <CategoriaLogo key={cat.chiave} categoria={cat} ricarica={ricarica} famigliaNome={famigliaNomeAnteprima} />
        ))}
    </div>
  );
}

// canvas offscreen riutilizzato solo per misurare il testo (measureText):
// stessa istanza sia in anteprima (Setting loghi) sia in generazione, così
// i 2 posti calcolano esattamente la stessa cosa
let ctxMisuraLoghi = null;
function ottieniCtxMisuraLoghi() {
  if (!ctxMisuraLoghi) ctxMisuraLoghi = document.createElement("canvas").getContext("2d");
  return ctxMisuraLoghi;
}

// il nome allieva va sempre centrato esattamente tra i 2 limiti sx/dx
// impostati in "Setting loghi": se col font base è più STRETTO dello
// spazio disponibile, si allarga la spaziatura tra le lettere fino a
// riempirlo; se è più LARGO, si rimpicciolisce il font finché non
// rientra (senza spaziatura extra)
function adattaNomeLogo(testo, fontSizeBase, famiglia, spazioDisponibilePx) {
  if (!testo) return { fontSize: fontSizeBase, spaziatura: 0, larghezze: [] };
  const ctx = ottieniCtxMisuraLoghi();
  const famigliaSicura = famiglia || "sans-serif";
  function misura(fontSize) {
    ctx.font = `${fontSize}px "${famigliaSicura}", sans-serif`;
    return testo.split("").map((ch) => ctx.measureText(ch).width);
  }
  let fontSize = fontSizeBase;
  let larghezze = misura(fontSize);
  let larghezzaTesto = larghezze.reduce((s, w) => s + w, 0);
  if (larghezzaTesto > spazioDisponibilePx) {
    while (fontSize > 6 && larghezzaTesto > spazioDisponibilePx) {
      fontSize -= 0.5;
      larghezze = misura(fontSize);
      larghezzaTesto = larghezze.reduce((s, w) => s + w, 0);
    }
    return { fontSize, spaziatura: 0, larghezze };
  }
  const spaziatura = testo.length > 1 ? (spazioDisponibilePx - larghezzaTesto) / (testo.length - 1) : 0;
  return { fontSize, spaziatura, larghezze };
}

// disegna il nome centrato su centroX, lettera per lettera, con la
// spaziatura calcolata da adattaNomeLogo (ctx.letterSpacing non è
// disponibile in modo uniforme su tutti i browser: si posiziona ogni
// carattere a mano per un risultato identico ovunque)
function disegnaNomeConSpaziatura(ctx, testo, centroX, y, fontSize, famiglia, colore, spaziatura) {
  const famigliaSicura = famiglia || "sans-serif";
  ctx.font = `${fontSize}px "${famigliaSicura}", sans-serif`;
  ctx.fillStyle = colore;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const caratteri = testo.split("");
  const larghezze = caratteri.map((ch) => ctx.measureText(ch).width);
  const larghezzaTotale = larghezze.reduce((s, w) => s + w, 0) + spaziatura * Math.max(0, caratteri.length - 1);
  let x = centroX - larghezzaTotale / 2;
  caratteri.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += larghezze[i] + spaziatura;
  });
}

// componi su un <canvas> offscreen il logo sorgente + nome + codice, alla
// risoluzione piena dell'immagine originale (non quella ridotta
// dell'anteprima), e restituisce il PNG risultante come Blob. Il colore
// del testo non si sceglie più a mano: è sempre nero sul logo nero e
// bianco sul logo bianco, per restare coerente col colore del logo
// stesso; il nome è sempre centrato tra i 2 limiti della variante e
// adattato automaticamente (spaziatura o rimpicciolimento) per entrarci
async function componiLogoPng({ percorsoLogo, variante, nomeTesto, codiceTesto, categoria, famigliaNome, famigliaNumero }) {
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

    const colore = variante === "nero" ? "#000000" : "#ffffff";
    const pfx = variante;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${categoria[`${pfx}_numero_font_size`]}px ${famigliaNumero}, sans-serif`;
    ctx.fillStyle = colore;
    ctx.fillText(codiceTesto, (canvas.width * categoria[`${pfx}_numero_pos_x`]) / 100, (canvas.height * categoria[`${pfx}_numero_pos_y`]) / 100);

    const limiteSxPx = (canvas.width * categoria[`${pfx}_nome_limite_sx`]) / 100;
    const limiteDxPx = (canvas.width * categoria[`${pfx}_nome_limite_dx`]) / 100;
    const centroXPx = (limiteSxPx + limiteDxPx) / 2;
    const yPx = (canvas.height * categoria[`${pfx}_nome_pos_y`]) / 100;
    const { fontSize, spaziatura } = adattaNomeLogo(nomeTesto, categoria[`${pfx}_nome_font_size`], famigliaNome, Math.max(1, limiteDxPx - limiteSxPx));
    disegnaNomeConSpaziatura(ctx, nomeTesto, centroXPx, yPx, fontSize, famigliaNome, colore, spaziatura);

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
        variante: "nero",
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
          variante: "bianco",
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

// checkbox grande con stato ottimistico: cambia colore/spunta subito al
// click invece di aspettare che il salvataggio finisca e l'intera pagina
// si ricarichi (ricarica() rifà fetchDati() su tutte le tabelle, quindi
// senza questo la spunta resterebbe visibilmente "in ritardo")
function CheckboxOttimistica({ valore, onCambia, children }) {
  const [locale, setLocale] = useState(!!valore);
  useEffect(() => { setLocale(!!valore); }, [valore]);
  function click() {
    const nuovo = !locale;
    setLocale(nuovo);
    onCambia(nuovo);
  }
  return (
    <div
      role="checkbox"
      aria-checked={locale}
      onClick={click}
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", ...fontBody, fontSize: 14, fontWeight: 600, color: locale ? "#111" : "#C7C7C7" }}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          border: locale ? "none" : "1.5px solid #C7C7C7",
          background: locale ? "#2E7D32" : "#fff",
        }}
      >
        {locale && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        )}
      </span>
      {children}
    </div>
  );
}

// una riga di "Assegna modelle": trattamento, eventuali MAT/POM (nascosti
// nella pagina pubblica di ricerca modelle), e nome/telefono della modella
// una volta trovata. Nome/telefono usano stato locale e si salvano solo al
// blur, non ad ogni tasto: altrimenti ogni carattere digitato scatenerebbe
// un salvataggio e un ricaricamento dell'intera pagina, facendo perdere il
// focus mentre si scrive
function RigaModella({ modella, mostraOrario = true, primaRiga, onSalva, opzioniTipo }) {
  const [nome, setNome] = useState(modella.nome_modella || "");
  const [telefono, setTelefono] = useState(modella.telefono_modella || "");
  useEffect(() => { setNome(modella.nome_modella || ""); }, [modella.nome_modella]);
  useEffect(() => { setTelefono(modella.telefono_modella || ""); }, [modella.telefono_modella]);

  return (
    <div style={{ padding: "10px 0", borderTop: primaRiga ? "none" : `1px solid ${CREAM_BORDER}` }}>
      {opzioniTipo ? (
        <select
          style={{ ...inputStyle, fontSize: 13, fontWeight: 600, marginBottom: 8, maxWidth: 280 }}
          value={modella.tipo || ""}
          onChange={(e) => onSalva("tipo", e.target.value)}
        >
          <option value="">— scegli trattamento —</option>
          {opzioniTipo.map((opz) => <option key={opz} value={opz}>{opz}</option>)}
        </select>
      ) : (
        <div style={{ ...fontBody, fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 8 }}>{modella.tipo || "(trattamento non scelto)"}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {mostraOrario && (
          <>
            {/* etichetta sopra il quadratino invece che affiancata: occupa
                molto meno spazio in orizzontale, lasciandone di più al
                campo Tel. che altrimenti veniva mozzato */}
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", ...fontBody, fontSize: 11, color: NAVY, flexShrink: 0 }}>
              MAT
              <input type="checkbox" checked={!!modella.mattina} onChange={(e) => onSalva("mattina", e.target.checked)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", ...fontBody, fontSize: 11, color: NAVY, flexShrink: 0 }}>
              POM
              <input type="checkbox" checked={!!modella.pomeriggio} onChange={(e) => onSalva("pomeriggio", e.target.checked)} />
            </label>
          </>
        )}
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => { if (nome !== (modella.nome_modella || "")) onSalva("nome_modella", nome); }}
          style={{ ...inputStyle, flex: "2 1 150px", padding: "6px 10px" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: "1 1 140px" }}>
          <input
            placeholder="Tel."
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => { if (telefono !== (modella.telefono_modella || "")) onSalva("telefono_modella", telefono); }}
            style={{ ...inputStyle, flex: 1, minWidth: 0, padding: "6px 10px" }}
          />
          {telefono.trim() && (
            <>
              <a href={`tel:${telefono.replace(/\s+/g, "")}`} title="Chiama" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, flexShrink: 0, padding: 6 }}>
                <IconaTelefono size={34} />
              </a>
              <a href={`https://wa.me/${numeroWhatsapp(telefono)}`} target="_blank" rel="noopener noreferrer" title="Apri chat WhatsApp" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 6 }}>
                <IconaWhatsapp size={34} />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, maxWidth = 560 }) {
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
        style={{ ...cardStyle, maxWidth, width: "100%", height: "fit-content", marginBottom: 0 }}
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
// riga "Password" di un venditore: mai precompilata con quella attuale
// (non viene mai letta/mostrata, solo scritta) — solo un campo per
// impostarne una nuova, con "0000" già scritto come suggerimento pratico
function RigaPasswordVenditore({ valoreDiDefault, onImposta }) {
  const [password, setPassword] = useState(valoreDiDefault);
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  async function salva() {
    if (!password || password.length < 4) return;
    setSalvando(true); setFatto(false);
    await onImposta(password);
    setSalvando(false); setFatto(true);
    setTimeout(() => setFatto(false), 2000);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <input
        style={{ ...inputStyle, maxWidth: 140, padding: "6px 10px" }}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={salva}
        disabled={salvando || !password || password.length < 4}
        style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: "6px 10px", cursor: salvando ? "default" : "pointer" }}
      >
        {salvando ? "Imposto…" : fatto ? "Impostata ✓" : "Imposta password"}
      </button>
    </div>
  );
}
// cellulare del venditore, per la futura integrazione messaggi WhatsApp:
// stesso pattern "campo + Salva" già in uso per la password
function RigaTelefonoVenditore({ valoreDiDefault, onSalva }) {
  const [telefono, setTelefono] = useState(valoreDiDefault || "");
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  async function salva() {
    setSalvando(true); setFatto(false);
    await onSalva(telefono.trim());
    setSalvando(false); setFatto(true);
    setTimeout(() => setFatto(false), 2000);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <IconaWhatsapp size={16} />
      <input
        style={{ ...inputStyle, maxWidth: 160, padding: "6px 10px" }}
        placeholder="Cellulare (WhatsApp)"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <button
        onClick={salva}
        disabled={salvando}
        style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: "6px 10px", cursor: salvando ? "default" : "pointer" }}
      >
        {salvando ? "Salvo…" : fatto ? "Salvato ✓" : "Salva"}
      </button>
    </div>
  );
}
function GestioneListaSemplice({ nomeSingolare, nomeArticolo, tabella, elementi, ricarica, msg, setMsg, placeholder, mostraFirmaCheckbox, mostraPassword, onImpostaPassword, passwordDiDefault, mostraTelefono }) {
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
    const { data, error } = await supabase.from(tabella).insert({ nome: nome.trim().toUpperCase() }).select("id").single();
    if (error) { setMsg("Errore: " + error.message); return; }
    setNome(""); setMsg(`${nomeSingolare} aggiunt${nomeArticolo === "un" ? "o" : "a"}.`);
    // ogni nuovo venditore parte con una password predefinita, così è
    // subito pronto per il futuro login: chi ha accesso a Impostazioni la
    // può cambiare in qualsiasi momento dal campo qui sotto
    if (mostraPassword && onImpostaPassword && data?.id) {
      await onImpostaPassword(data.id, passwordDiDefault || "0000");
    }
    ricarica();
  }
  async function elimina(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from(tabella).delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg(`${nomeSingolare} eliminat${nomeArticolo === "un" ? "o" : "a"}.`);
    ricarica();
  }
  async function salvaTelefono(id, telefono) {
    const { error } = await supabase.from(tabella).update({ telefono }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
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
          {mostraPassword && (
            <RigaPasswordVenditore valoreDiDefault={passwordDiDefault || "0000"} onImposta={(pwd) => onImpostaPassword(el.id, pwd)} />
          )}
          {mostraTelefono && (
            <RigaTelefonoVenditore valoreDiDefault={el.telefono || ""} onSalva={(tel) => salvaTelefono(el.id, tel)} />
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
// Reset filtri, Contabilità classe, Iscrivi...). Un'etichetta di più parole
// che non entra su una riga va semplicemente a capo (mai spezzare una
// singola parola lasciando un'unica lettera orfana): il font si riduce
// SOLO come ultima spiaggia, se anche una parola da sola — già sulla sua
// riga — non ci sta comunque. Il tasto stesso (vedi i suoi stili in
// App.jsx, height:"100%") si allarga poi fino all'altezza del vicino più
// alto, così tasti con font ridotto o testo su 2 righe restano comunque
// alti quanto gli altri della stessa fila
function useFontAdattato(testo, fontSizeBase, fontSizeMin = 9) {
  const ref = React.useRef(null);
  const [fontSize, setFontSize] = useState(fontSizeBase);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function adatta() {
      let dimensione = fontSizeBase;
      el.style.fontSize = `${dimensione}px`;
      while (el.scrollWidth > el.clientWidth + 0.5 && dimensione > fontSizeMin) {
        dimensione -= 0.5;
        el.style.fontSize = `${dimensione}px`;
      }
      setFontSize(dimensione);
    }
    adatta();
    const osservatore = new ResizeObserver(adatta);
    osservatore.observe(el);
    return () => osservatore.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testo, fontSizeBase, fontSizeMin]);
  return { ref, fontSize };
}
function EtichettaAdattiva({ testo, fontSizeBase = 13, fontSizeMin = 9 }) {
  const { ref, fontSize } = useFontAdattato(testo, fontSizeBase, fontSizeMin);
  return (
    <span ref={ref} style={{ display: "block", fontSize, whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.25, wordBreak: "keep-all", overflowWrap: "normal" }}>
      {testo}
    </span>
  );
}

// campo di ricerca con un tasto "Cerca" sulla destra: su Android digitare
// in un campo di testo apre la tastiera a schermo, che poi resta aperta
// finché non si tocca esplicitamente altrove — il tasto (e il tasto
// "invio"/lente della tastiera stessa, grazie a enterKeyHint) tolgono il
// focus dal campo, così la tastiera si chiude subito
function CampoRicerca({ value, onChange, placeholder, style }) {
  const ref = React.useRef(null);
  return (
    <div style={{ position: "relative", ...style }}>
      <input
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === "Enter") ref.current?.blur(); }}
        style={{ ...inputStyle, paddingRight: 44, width: "100%", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => ref.current?.blur()}
        title="Cerca"
        aria-label="Cerca"
        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", border: "none", background: NAVY, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      </button>
    </div>
  );
}

// tasto filtro "a pillola": pieno/scuro quando un valore è scelto,
// altrimenti contornato; al click apre sotto di sé un <select> nativo
// con l'elenco delle opzioni. Usato per i filtri corso/città/master
// sia in Home che in Gestione date
function FiltroPill({ etichetta, etichettaAttiva, valore, aperto, onToggle, selectRef, onChange, onBlur, opzioni, opzioneVuota }) {
  return (
    <div style={{ position: "relative", flex: "1 1 0", minWidth: 0, display: "flex" }}>
      <button
        onClick={onToggle}
        style={{
          ...fontBody, fontWeight: 600, padding: "10px 10px", borderRadius: 20,
          border: valore ? "none" : `1px solid ${CREAM_BORDER}`,
          background: valore ? NAVY : "#fff", color: valore ? "#fff" : NAVY, cursor: "pointer",
          overflow: "hidden", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
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

// indicatore "iscritti/posti" nella colonna Capienza: due numeri
// affiancati da una lineetta verticale, barra di riempimento sotto, e
// quanti liberi restano — o "Completo" in oro quando non ce ne sono più
function IndicatorePosti({ occupati, max, liberi }) {
  const completo = liberi === 0;
  const pct = max > 0 ? Math.min(100, Math.round((occupati / max) * 100)) : 0;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 16, marginBottom: 7 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...fontBody, fontSize: 18, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{occupati}</div>
          <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>iscritti</div>
        </div>
        <div style={{ width: 1, background: CREAM_BORDER }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ ...fontBody, fontSize: 18, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{max}</div>
          <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>posti</div>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "#EFE9DC", overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: NAVY, borderRadius: 3 }} />
      </div>
      <div style={{ textAlign: "center", ...fontBody, fontSize: 13, fontWeight: completo ? 700 : 400, color: completo ? GOLD : MUTED }}>
        {completo ? "Completo" : `${liberi} liber${liberi === 1 ? "o" : "i"}`}
      </div>
    </div>
  );
}

// tastini +/- in alto a destra di una scheda: fanno "zoom" (font +
// spaziature + icone, tutto insieme) solo dentro quella scheda, un passo
// per click. Salvato in localStorage (chiave unica per tutte le schede
// "Date corsi"): resta impostato per questa persona/dispositivo anche
// dopo un refresh o riaprendo l'app, ma non è condiviso con nessun altro
// utente — è una preferenza visiva locale, non un dato del gestionale
const CHIAVE_ZOOM_DATE_CORSI = "edc_zoom_date_corsi";
function useZoomScheda() {
  const [zoom, setZoom] = useState(() => {
    const salvato = parseInt(localStorage.getItem(CHIAVE_ZOOM_DATE_CORSI), 10);
    return Number.isFinite(salvato) ? salvato : 100;
  });
  function cambiaZoom(delta) {
    setZoom((z) => {
      const nuovo = Math.min(160, Math.max(70, z + delta));
      localStorage.setItem(CHIAVE_ZOOM_DATE_CORSI, String(nuovo));
      return nuovo;
    });
  }
  const bottoneStyle = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, fontSize: 15, fontWeight: 700, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const controlli = (
    <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 6, zIndex: 1 }}>
      <button onClick={() => cambiaZoom(-8)} title="Rimpicciolisci il testo" style={bottoneStyle}>−</button>
      <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, minWidth: 30, textAlign: "center" }}>{zoom}%</span>
      <button onClick={() => cambiaZoom(8)} title="Ingrandisci il testo" style={bottoneStyle}>+</button>
    </div>
  );
  return [zoom, controlli];
}

const ICONA_MATITA_PATH = <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>;
const ICONA_CESTINO_PATH = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>;

// tabella "Corso e docente / Data / Capienza / Azioni" per una scheda
// (una città, o l'unica tabella in modalità Cronologico): raggruppa le
// voci per mese con una striscia di sfondo, come nei calendari
function TabellaDateCorsi({ mesi, renderRiga }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 230 }} /><col style={{ width: 110 }} /></colgroup>
      <thead>
        <tr style={{ borderBottom: `2px solid ${GOLD}` }}>
          <th style={{ textAlign: "left", padding: "0 10px 12px 0", ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>Corso e docente</th>
          <th style={{ textAlign: "center", padding: "0 10px 12px", ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>Data</th>
          <th style={{ textAlign: "center", padding: "0 10px 12px", ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>Capienza</th>
          <th style={{ textAlign: "right", padding: "0 0 12px 10px", ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>Azioni</th>
        </tr>
      </thead>
      <tbody>
        {Object.keys(mesi).sort().map((chiaveMese) => {
          const gruppoMese = mesi[chiaveMese];
          const voci = gruppoMese.voci.slice().sort((a, b) => a.data_inizio.localeCompare(b.data_inizio));
          return (
            <React.Fragment key={chiaveMese}>
              <tr>
                <td colSpan={4} style={{ padding: "10px 12px", background: BG }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.8 }}>{gruppoMese.etichetta}</span>
                    <span style={{ ...fontBody, fontSize: 13, color: MUTED }}>{voci.length} cors{voci.length === 1 ? "o" : "i"}</span>
                  </div>
                </td>
              </tr>
              {voci.map((cd, i) => renderRiga(cd, i === 0))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// una scheda "città" (pin + nome + N corsi programmati) con la tabella
// date dentro — sua propria rotellina di zoom, indipendente dalle altre
function CardCittaData({ c, renderRiga }) {
  const [zoom, controlliZoom] = useZoomScheda();
  const totaleCorsiCitta = Object.values(c.mesi).reduce((tot, m) => tot + m.voci.length, 0);
  return (
    <div style={{ position: "relative", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, zoom: `${zoom}%` }}>
      {controlliZoom}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <IconaPin size={30} color={GOLD} />
        <div>
          <div style={{ ...fontDisplay, fontSize: 30, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{toTitleCase(c.nome)}</div>
          <div style={{ ...fontBody, fontSize: 15, color: MUTED }}>{totaleCorsiCitta} cors{totaleCorsiCitta === 1 ? "o" : "i"} programmat{totaleCorsiCitta === 1 ? "o" : "i"}</div>
        </div>
      </div>
      <TabellaDateCorsi mesi={c.mesi} renderRiga={renderRiga} />
    </div>
  );
}

// stessa tabella ma senza intestazione città: usata in modalità
// Cronologico, dove tutte le città stanno in un'unica scheda
function CardCronologico({ mesi, renderRiga }) {
  const [zoom, controlliZoom] = useZoomScheda();
  return (
    <div style={{ position: "relative", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 20, zoom: `${zoom}%` }}>
      {controlliZoom}
      <TabellaDateCorsi mesi={mesi} renderRiga={renderRiga} />
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

  // riga (tr) di un singolo corso: usata sia raggruppata per città
  // (mostraCitta false, la città è già nell'intestazione della card) sia
  // in modalità "Cronologico" (mostraCitta true: qui non c'è una card
  // per città, quindi il nome città va scritto nella riga stessa)
  function rigaCorso(cd, mostraCitta, primaDelGruppo) {
    const corso = corsoById[cd.corso_id];
    const max = postiMaxEffettivi(cd, corso, locById[cd.location_id]);
    const occupati = iscritti ? iscritti.filter((i2) => i2.corso_data_id === cd.id).length : 0;
    const liberi = Math.max(0, max - occupati);
    const rigaCittaMaster = (mostraCitta || cd.master_id) && (
      <div style={{ ...fontBody, fontSize: 13, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {mostraCitta && toTitleCase(locById[cd.location_id]?.nome || "?")}
        {mostraCitta && cd.master_id && " · "}
        {cd.master_id && `Master: ${toTitleCase(masterById[cd.master_id]?.nome || "?")}`}
      </div>
    );
    return (
      <React.Fragment key={cd.id}>
        <tr onClick={() => onApriData?.(cd)} style={{ cursor: onApriData ? "pointer" : "default", borderTop: primaDelGruppo ? "none" : `1px solid ${CREAM_BORDER}` }}>
          <td style={{ padding: "16px 10px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span style={{ width: 4, height: 34, borderRadius: 2, background: corso?.colore || NAVY, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ ...fontDisplay, fontSize: 19, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toTitleCase(corso?.nome || "?")}</div>
                {rigaCittaMaster}
              </div>
            </div>
          </td>
          <td style={{ padding: "16px 10px", ...fontBody, fontSize: 19, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", textAlign: "center" }}>
            {fmtDataCompatta(cd.data_inizio, cd.data_fine).toUpperCase()}
          </td>
          <td style={{ padding: "16px 10px" }}>
            {iscritti && <IndicatorePosti occupati={occupati} max={max} liberi={liberi} />}
          </td>
          <td style={{ padding: "16px 0 16px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
              {onEdit && (
                <button onClick={(e) => { e.stopPropagation(); onEdit(cd); }} title="Modifica" style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 4, display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONA_MATITA_PATH}</svg>
                </button>
              )}
              {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(cd.id); }} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONA_CESTINO_PATH}</svg>
                </button>
              )}
              {onApriData && <span style={{ fontSize: 18, color: MUTED }}>&rsaquo;</span>}
            </div>
          </td>
        </tr>
        {idInModifica === cd.id && renderModifica && (
          <tr>
            <td colSpan={4} style={{ padding: "0 0 12px" }}>{renderModifica(cd)}</td>
          </tr>
        )}
      </React.Fragment>
    );
  }

  // "Cronologico": tutte le date di tutte le città in un'unica tabella,
  // raggruppata solo per mese e ordinata per data (invece che per città)
  if (cronologico) {
    const mesi = {};
    corsiDate.forEach((cd) => {
      const [anno, mese] = cd.data_inizio.split("-");
      const chiaveMese = `${anno}-${mese}`;
      if (!mesi[chiaveMese]) mesi[chiaveMese] = { etichetta: `${MESI[parseInt(mese, 10) - 1]} ${anno}`, voci: [] };
      mesi[chiaveMese].voci.push(cd);
    });
    return <CardCronologico mesi={mesi} renderRiga={(cd, primaDelGruppo) => rigaCorso(cd, true, primaDelGruppo)} />;
  }

  return (
    <div>
      {cittaOrdinate.map((c) => (
        <CardCittaData key={c.nome} c={c} renderRiga={(cd, primaDelGruppo) => rigaCorso(cd, false, primaDelGruppo)} />
      ))}
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
// codice fisso per aprire la rotellina "password menù" in home, dove si
// impostano le password delle singole voci protette — volutamente diverso
// dall'ADMIN_CODE generale, così anche chi non ha l'ADMIN_CODE ma conosce
// solo questo può gestire le password delle voci senza avere accesso
// amministratore ovunque
const CODICE_ROTELLINA = "RCCGLC68H03L719U";
// le voci della home protette da apriViewProtetta, gestibili dalla rotellina
const VISTE_PROTETTE_MENU = [
  { vista: "gestionedate", etichetta: "Gestione corsi" },
  { vista: "erp", etichetta: "ERP / Magazzino" },
  { vista: "generazioneloghi", etichetta: "Assegna logo" },
  { vista: "gestionemodelle", etichetta: "Gestione modelle" },
  { vista: "statistiche", etichetta: "Statistiche" },
  { vista: "impostazioni", etichetta: "Setting" },
];
// le 4 password "di sistema": accesso generale (Gate), amministratore,
// programmatore (entra ovunque senza reinserire nulla) e quella per
// aprire questa stessa rotellina — modificabili qui, con fallback al
// valore di sempre finché non viene impostato qualcosa di personalizzato
const PASSWORD_SISTEMA_MENU = [
  { vista: "__user", etichetta: "Password utente (accesso generale)", fallback: ACCESS_CODE, descrizione: "La password che usano tutti per entrare nell'app. Chi entra con questa vede \"User\" in alto." },
  { vista: "__admin", etichetta: "Password amministratore", fallback: ADMIN_CODE, descrizione: "Sblocca le voci protette (Gestione corsi, ERP, Assegna logo, Gestione modelle, Statistiche, Setting) una per volta." },
  { vista: "__programmatore", etichetta: "Password programmatore", fallback: "1234", descrizione: "Entra ovunque nell'app senza dover reinserire nessun'altra password, nemmeno per le voci protette." },
  { vista: "__rotellina", etichetta: "Password di questa rotellina", fallback: CODICE_ROTELLINA, descrizione: "Il codice per aprire questo stesso pannello e cambiare tutte le password." },
];

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

// riga "etichetta / importo / metodo" della sezione Pagamenti: da mobile
// importo e metodo scendono sulla stessa riga sotto l'etichetta (3
// colonne fisse non ci stanno), da desktop restano affiancati
function rigaPagamentoIscritto(label, valore, metodo, isMobile) {
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

// pacchetto/kit, totale pattuito/pagato, pagamenti, modelle, taglia divisa,
// accordi commerciali, allegati: stesso blocco riusato sia nella colonna
// destra di "Contabilità classe" (mostraQuotaVenditore=true, solo admin)
// sia nella scheda verticale del link pubblico per le master
// (mostraQuotaVenditore=false, la quota venditore resta un dato riservato)
function RiepilogoVenditaIscritto({ i, isMobile, mostraQuotaVenditore = true }) {
  return (
    <>
      {i.pacchetto_kit && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Pacchetto/Kit</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{i.pacchetto_kit}</div>
        </div>
      )}

      {(i.totale_pattuito != null || i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null || (mostraQuotaVenditore && i.quota_venditore != null)) && (() => {
        const netto = round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0));
        const conRate = round2(totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0));
        const celle = [
          i.totale_pattuito != null && { chiave: "pattuito", label: "Totale pattuito", valore: `${i.totale_pattuito} €` },
          (i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && { chiave: "pagato", label: "Totale pagato", valore: conRate !== netto ? `${conRate} €` : `${netto} €` },
          mostraQuotaVenditore && i.quota_venditore != null && { chiave: "venditore", label: "Quota venditore", valore: `${i.quota_venditore} €` },
        ].filter(Boolean);
        return (
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

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 9ch 9ch", columnGap: 14 }}>
        {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
          <div style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}` }}>Pagamenti</div>
        )}
        {i.acconto_totale != null && rigaPagamentoIscritto(
          "Pagato in acconto",
          `${totQuota(i, "acconto")} €${i.acconto_interessi ? ` (interessi ${i.acconto_interessi} €)` : ""}`,
          i.acconto_metodo || "?",
          isMobile
        )}
        {i.precorso_totale != null && rigaPagamentoIscritto(
          "Pagato pre corso",
          `${totQuota(i, "precorso")} €${i.precorso_interessi ? ` (interessi ${i.precorso_interessi} €)` : ""}`,
          i.precorso_metodo || "?",
          isMobile
        )}
        {i.saldo_totale != null && rigaPagamentoIscritto(
          "Importo da pagare al corso",
          `${i.saldo_totale} €`,
          i.saldo_metodo || "?",
          isMobile
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
    </>
  );
}

function SchedaData({ corsoData, corsi, location, corsiDate, iscritti, master, fontDiplomi, diplomaEccezioni, segnaposti, costiCategorie, costiSottocategorie, spese, corsiGiorni, tipiModella, corsiTipiModella, venditori, ricarica, onBack, sottoVistaIniziale, onCambiaSottoVista, onApriNuovaSpesaPerClasse, origineGestioneModelle, onTornaGestioneModelle }) {
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
  // dati di fatturazione: spuntando "Richiede fattura" compaiono i campi
  // sotto; deflaggando spariscono E si azzerano (nessun dato residuo)
  const [richiedeFattura, setRichiedeFattura] = useState(false);
  const [fatturaDitta, setFatturaDitta] = useState("");
  const [fatturaIndirizzo, setFatturaIndirizzo] = useState("");
  const [fatturaCivico, setFatturaCivico] = useState("");
  const [fatturaCitta, setFatturaCitta] = useState("");
  const [fatturaProv, setFatturaProv] = useState("");
  const [fatturaCap, setFatturaCap] = useState("");
  const [fatturaPiva, setFatturaPiva] = useState("");
  const [fatturaCodDest, setFatturaCodDest] = useState("");
  const [fatturaPec, setFatturaPec] = useState("");
  function svuotaCampiFattura() {
    setFatturaDitta(""); setFatturaIndirizzo(""); setFatturaCivico("");
    setFatturaCitta(""); setFatturaProv(""); setFatturaCap("");
    setFatturaPiva(""); setFatturaCodDest(""); setFatturaPec("");
  }
  // iscrizione inserita ora ma relativa a un corso già passato: non deve
  // sporcare le statistiche/iscrizioni "di oggi" (si basano su `ts`, il
  // momento in cui viene salvata nel database, non la data del corso)
  const [vecchiaIscrizione, setVecchiaIscrizione] = useState(false);
  const QUOTA_VUOTA = { imponibile: "", totale: "", metodo: "", interessi: "" };
  const RIGA_PAGAMENTO_EXTRA_VUOTA = { imponibile: "", totale: "", metodo: "", interessi: "", pagato: false };
  const [pagAcconto, setPagAcconto] = useState(QUOTA_VUOTA);
  const [pagAccontoPagato, setPagAccontoPagato] = useState(false);
  // pagamenti aggiuntivi di acconto oltre al primo (pulsante "+"): stesso
  // conto (acconto), semplicemente arrivati in un secondo momento — non
  // toccano "Da avere al corso", che resta sempre a scrittura manuale
  const [accontoExtra, setAccontoExtra] = useState([]);
  const [pagPrecorso, setPagPrecorso] = useState(QUOTA_VUOTA);
  const [pagPrecorsoPagato, setPagPrecorsoPagato] = useState(false);
  const [precorsoExtra, setPrecorsoExtra] = useState([]);
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
  const [costiAperto, setCostiAperto] = useState(sottoVistaIniziale?.costiAperto ?? false);
  // ognuno dei 10 costi fissi è ormai una spesa vera in "spese" (non più
  // un numero nudo su corsi_date): il valore mostrato in ogni casella è
  // la somma di quelle spese per questa classe+sotto-categoria
  const totaliRiepilogo = Object.fromEntries(
    CAMPI_RIEPILOGO_AMMINISTRATIVO.map((c) => [
      c.chiave,
      round2((spese || []).filter((s) => s.classe_id === corsoData.id && s.sottocategoria_id === c.sottocategoriaId).reduce((s, v) => s + (v.imponibile || 0), 0)),
    ])
  );
  // voci di costo aggiunte liberamente dall'amministratore (titolo + importo)
  const [costiExtra, setCostiExtra] = useState(
    Array.isArray(corsoData.costi_extra) ? corsoData.costi_extra.map((c) => ({ titolo: c.titolo || "", valore: c.valore != null ? String(c.valore) : "", categoria: c.categoria || "", sottovoce: c.sottovoce || "" })) : []
  );
  const [salvandoCosti, setSalvandoCosti] = useState(false);
  const [sceltaCategoriaCosto, setSceltaCategoriaCosto] = useState(false);

  // segnala al genitore ogni cambiamento di sotto-vista (lista/form,
  // quale iscritto in modifica, contabilità aperta o no): è così che i
  // pulsanti Indietro/Avanti possono registrare anche questi passaggi
  // interni, non solo i cambi di schermata principale
  useEffect(() => {
    onCambiaSottoVista?.({ vista, modificandoId, mostraGestione, costiAperto });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, modificandoId, mostraGestione, costiAperto]);

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
    // se il corso ha un solo giorno che richiede modelle allievi, lo si
    // assegna subito senza chiedere nulla — il selettore "Giorno" compare
    // solo quando c'è davvero una scelta da fare (più giorni possibili)
    const giorniAllievi = (corsiGiorni || []).filter((g) => g.corso_id === corsoData.corso_id && g.richiede_modelle_allievi);
    const giornoUnico = giorniAllievi.length === 1 ? giorniAllievi[0] : null;
    const giornoDefault = giornoUnico ? giornoUnico.numero_giorno : null;
    const tipoDefault = giornoUnico ? (giornoUnico.tipo_modella_allievi || "") : "";
    setTipiModelle((prev) => {
      if (n < prev.length) return prev.slice(0, n);
      return [...prev, ...Array.from({ length: n - prev.length }, () => ({ tipo: tipoDefault, mattina: false, pomeriggio: false, nome_modella: "", telefono_modella: "", giorno: giornoDefault }))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richiedeModelle, numeroModelle]);

  const corso = corsi.find((c) => c.id === corsoData.corso_id);
  const loc = location.find((l) => l.id === corsoData.location_id);
  // template dei giorni di questo corso-tipo (Modella del Master/Allievi),
  // usato sia dal selettore "Giorno" nell'iscrizione sia da "Assegna modelle"
  const giorniCorsoDiQuesto = (corsiGiorni || []).filter((g) => g.corso_id === corsoData.corso_id).sort((a, b) => a.numero_giorno - b.numero_giorno);
  const giorniAllieviCorso = giorniCorsoDiQuesto.filter((g) => g.richiede_modelle_allievi);
  const giorniRilevantiModelle = giorniCorsoDiQuesto.filter((g) => g.richiede_modella_master || g.richiede_modelle_allievi);
  // giorno di ripiego per le voci di tipi_modelle inserite prima di questa
  // funzionalità (senza "giorno" valorizzato): il primo/unico giorno
  // Allievi del corso, così non spariscono dalla vista
  const giornoDiRipiegoAllievi = giorniAllieviCorso[0]?.numero_giorno ?? null;
  // tipi di modella selezionabili per QUESTO corso (da "Definisci corsi");
  // nessuna riga configurata = nessuna restrizione, si mostra tutto il catalogo
  const idTipiModellaCorso = (corsiTipiModella || []).filter((x) => x.corso_id === corsoData.corso_id).map((x) => x.tipo_modella_id);
  const opzioniTipoModellaCorso = idTipiModellaCorso.length > 0
    ? (tipiModella || []).filter((t) => idTipiModellaCorso.includes(t.id)).map((t) => t.nome)
    : (tipiModella || []).map((t) => t.nome);
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
    quoteVenditoreClasse + Object.values(totaliRiepilogo).reduce((s, v) => s + v, 0) +
    costiExtra.reduce((s, c) => s + parseNum(c.valore), 0)
  );
  const risultatoClasse = round2(daIncassareClasse - totaleCostiClasse);

  // solo le categorie legate a UNA classe hanno senso nel "+" del
  // Riepilogo amministrativo (le categorie "aziendali" restano taggabili
  // solo da "+ Nuova operazione" nella dashboard)
  const categorieRiepilogo = (costiCategorie || []).filter((c) => !CHIAVI_ESCLUSE_RIEPILOGO.includes(c.id)).sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
  // il "+" apre una tendina con TUTTE le sotto-voci di "Costi operativi"
  // (raggruppate per categoria, come nel form "Nuova uscita"): la voce si
  // crea già taggata con categoria+sottovoce, così confluisce nella riga
  // giusta del drill-down invece che in un generico "extra" di categoria
  function aggiungiVoceCosto(valoreCombinato) {
    const [categoria, sottovoce] = valoreCombinato.split("::");
    setCostiExtra((prev) => [...prev, { titolo: "", valore: "", categoria, sottovoce }]);
    setCostiAperto(true);
    setSceltaCategoriaCosto(false);
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
      costi_extra: costiExtra.filter((c) => c.titolo.trim() !== "" || c.valore !== "").map((c) => ({ titolo: c.titolo.trim(), valore: parseNum(c.valore), categoria: c.categoria || null, sottovoce: c.sottovoce || null })),
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
    setPagAcconto(QUOTA_VUOTA); setPagAccontoPagato(false); setAccontoExtra([]);
    setPagPrecorso(QUOTA_VUOTA); setPagPrecorsoPagato(false); setPrecorsoExtra([]);
    setPagSaldo(QUOTA_VUOTA);
    setAccordiCommerciali(""); setRichiedeModelle(""); setNumeroModelle(""); setPrezzoSpecialeModelle(""); setTipiModelle([]); setTotalePattuito(""); setQuotaSpeciale("");
    setPacchettoKit(""); setTagliaDivisa("");
    setRichiedeFattura(false); svuotaCampiFattura();
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
    setPagAccontoPagato(i.acconto_pagato === true);
    setAccontoExtra(Array.isArray(i.acconto_extra) ? i.acconto_extra.map((r) => ({
      imponibile: r.imponibile != null ? String(r.imponibile) : "",
      totale: r.totale != null ? String(r.totale) : "",
      metodo: r.metodo || "",
      interessi: r.interessi != null ? String(r.interessi) : "",
      pagato: !!r.pagato,
    })) : []);
    setPagPrecorso({
      imponibile: i.precorso_imponibile != null ? String(i.precorso_imponibile) : "",
      totale: i.precorso_totale != null ? String(i.precorso_totale) : "",
      metodo: i.precorso_metodo || "",
      interessi: i.precorso_interessi != null ? String(i.precorso_interessi) : "",
    });
    setPagPrecorsoPagato(i.precorso_pagato === true);
    setPrecorsoExtra(Array.isArray(i.precorso_extra) ? i.precorso_extra.map((r) => ({
      imponibile: r.imponibile != null ? String(r.imponibile) : "",
      totale: r.totale != null ? String(r.totale) : "",
      metodo: r.metodo || "",
      interessi: r.interessi != null ? String(r.interessi) : "",
      pagato: !!r.pagato,
    })) : []);
    setPagSaldo({
      imponibile: i.saldo_imponibile != null ? String(i.saldo_imponibile) : "",
      totale: i.saldo_totale != null ? String(i.saldo_totale) : "",
      metodo: i.saldo_metodo || "",
    });
    setAccordiCommerciali(i.accordi_commerciali || "");
    setRichiedeFattura(i.richiede_fattura === true);
    setFatturaDitta(i.fattura_ditta || "");
    setFatturaIndirizzo(i.fattura_indirizzo || "");
    setFatturaCivico(i.fattura_civico || "");
    setFatturaCitta(i.fattura_citta || "");
    setFatturaProv(i.fattura_prov || "");
    setFatturaCap(i.fattura_cap || "");
    setFatturaPiva(i.fattura_piva || "");
    setFatturaCodDest(i.fattura_cod_dest || "");
    setFatturaPec(i.fattura_pec || "");
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
    accontoExtra.forEach((r, idx) => { if (r.totale !== "" && parseNum(r.totale) !== 0 && !r.metodo) metodiMancanti.push(`acconto aggiuntivo ${idx + 1}`); });
    if (pagPrecorso.totale !== "" && parseNum(pagPrecorso.totale) !== 0 && !pagPrecorso.metodo) metodiMancanti.push("quota pre corso");
    precorsoExtra.forEach((r, idx) => { if (r.totale !== "" && parseNum(r.totale) !== 0 && !r.metodo) metodiMancanti.push(`pre corso aggiuntivo ${idx + 1}`); });
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
        acconto_pagato: pagAccontoPagato,
        acconto_extra: accontoExtra.map((r) => ({
          imponibile: r.imponibile === "" ? null : parseNum(r.imponibile),
          totale: r.totale === "" ? null : parseNum(r.totale),
          metodo: r.metodo || null,
          interessi: r.metodo === "Rate" && r.interessi !== "" ? parseNum(r.interessi) : null,
          pagato: !!r.pagato,
        })),
        precorso_imponibile: pagPrecorso.imponibile === "" ? null : parseNum(pagPrecorso.imponibile),
        precorso_totale: pagPrecorso.totale === "" ? null : parseNum(pagPrecorso.totale),
        precorso_metodo: pagPrecorso.metodo || null,
        precorso_interessi: pagPrecorso.metodo === "Rate" && pagPrecorso.interessi !== "" ? parseNum(pagPrecorso.interessi) : null,
        precorso_pagato: pagPrecorsoPagato,
        precorso_extra: precorsoExtra.map((r) => ({
          imponibile: r.imponibile === "" ? null : parseNum(r.imponibile),
          totale: r.totale === "" ? null : parseNum(r.totale),
          metodo: r.metodo || null,
          interessi: r.metodo === "Rate" && r.interessi !== "" ? parseNum(r.interessi) : null,
          pagato: !!r.pagato,
        })),
        saldo_imponibile: pagSaldo.imponibile === "" ? null : parseNum(pagSaldo.imponibile),
        saldo_totale: pagSaldo.totale === "" ? null : parseNum(pagSaldo.totale),
        saldo_metodo: pagSaldo.metodo || null,
        accordi_commerciali: accordiCommerciali.trim() || null,
        richiede_fattura: richiedeFattura,
        fattura_ditta: richiedeFattura ? (fatturaDitta.trim() || null) : null,
        fattura_indirizzo: richiedeFattura ? (fatturaIndirizzo.trim() || null) : null,
        fattura_civico: richiedeFattura ? (fatturaCivico.trim() || null) : null,
        fattura_citta: richiedeFattura ? (fatturaCitta.trim() || null) : null,
        fattura_prov: richiedeFattura ? (fatturaProv.trim() || null) : null,
        fattura_cap: richiedeFattura ? (fatturaCap.trim() || null) : null,
        fattura_piva: richiedeFattura ? (fatturaPiva.trim() || null) : null,
        fattura_cod_dest: richiedeFattura ? (fatturaCodDest.trim() || null) : null,
        fattura_pec: richiedeFattura ? (fatturaPec.trim() || null) : null,
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

  // stesso principio di aggiornaModellaSlot ma per la Modella del Master:
  // un array in corsi_date.modelle_master con una voce per giorno che la
  // richiede, creata al volo la prima volta che si scrive qualcosa
  async function aggiornaModellaMaster(numeroGiorno, campo, valore) {
    const elencoAttuale = Array.isArray(corsoData.modelle_master) ? corsoData.modelle_master : [];
    const esiste = elencoAttuale.some((m) => m.numero_giorno === numeroGiorno);
    const nuovoElenco = esiste
      ? elencoAttuale.map((m) => (m.numero_giorno === numeroGiorno ? { ...m, [campo]: valore } : m))
      : [...elencoAttuale, { numero_giorno: numeroGiorno, mattina: false, pomeriggio: false, nome_modella: "", telefono_modella: "", [campo]: valore }];
    const { error } = await supabase.from("corsi_date").update({ modelle_master: nuovoElenco }).eq("id", corsoData.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  // stesso principio, ma per la modella di un allievo in un giorno preciso
  // di "Assegna modelle": scrive/crea la voce in iscritti.tipi_modelle
  // indipendentemente da SUA/NOSTRA — il nome/telefono va sempre potuto
  // annotare, anche se l'allievo porta una modella propria (SUA), quella
  // dell'allievo serve solo a sapere chi porta cosa, non blocca la scrittura
  async function aggiornaModellaAllievoGiorno(iscrittoId, numeroGiorno, campo, valore, tipoDefault) {
    const iscritto = listaIscritti.find((x) => x.id === iscrittoId);
    if (!iscritto) return;
    const elenco = Array.isArray(iscritto.tipi_modelle) ? iscritto.tipi_modelle : [];
    const idx = elenco.findIndex((m) => (m.giorno ?? giornoDiRipiegoAllievi) === numeroGiorno);
    const nuovoElenco = idx >= 0
      ? elenco.map((m, i) => (i === idx ? { ...m, [campo]: valore } : m))
      : [...elenco, { tipo: tipoDefault || "", mattina: false, pomeriggio: false, nome_modella: "", telefono_modella: "", giorno: numeroGiorno, [campo]: valore }];
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
      <div style={{ position: "relative", overflow: "hidden", background: NAVY, borderRadius: 24, padding: "28px 26px", marginBottom: 0 }}>
        <DecorazioneOndeHero />
        <div style={{ ...fontBody, position: "relative", fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
          {mostraGestione ? "Contabilità classe" : "Gestione iscrizioni"}
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ ...fontHero, fontSize: 40, color: "#F7F2E7", lineHeight: 1.05 }}>{(corso?.nome || "").toUpperCase()}</div>
          {loc?.nome && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${GOLD}`, borderRadius: 20, padding: "7px 16px", flexShrink: 0 }}>
              <IconaPin size={16} color={GOLD} />
              <span style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.3 }}>{loc.nome}</span>
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
            <div style={{ position: "relative", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${celleIntestazione.length}, 1fr)`, gap: 14 }}>
                {celleIntestazione.map(({ chiave, Icona, label, valore }, idx) => (
                  <div key={chiave} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, paddingLeft: idx > 0 ? 14 : 0, borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
                    <Icona size={26} color={GOLD} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...fontBody, fontSize: 11, color: GOLD, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</div>
                      <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: "#F7F2E7", whiteSpace: "normal", wordBreak: "break-word" }}>{valore}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {(() => {
        const pulsanti = vista === "lista"
          ? (mostraGestione
              ? [
                  { chiave: "esci", etichetta: "Esci da contabilità", Icona: IconaFrecciaSinistra, onClick: apriGestioneClasse },
                  { chiave: "diplomi", etichetta: generandoDiplomi ? "Genero i diplomi…" : "Stampa diplomi", Icona: IconaStampante, onClick: stampaDiplomi, disabled: generandoDiplomi },
                  { chiave: "segnaposti", etichetta: generandoSegnaposti ? "Genero i segnaposti…" : "Stampa Segnaposto", Icona: IconaBigliettoSegnaposto, onClick: stampaSegnaposti, disabled: generandoSegnaposti },
                  { chiave: "modelle", etichetta: "Assegna modelle", Icona: IconaPersonaAggiungi, onClick: () => setVista("modelle"), primario: true },
                ]
              : [
                  { chiave: "contabilita", etichetta: "Contabilità classe", Icona: IconaLibroContabile, onClick: apriGestioneClasse },
                  { chiave: "iscrivi", etichetta: liberi <= 0 ? "Completo" : "Iscrivi", Icona: IconaPersonaAggiungi, onClick: apriIscrizione, disabled: liberi <= 0, primario: true },
                ])
          : vista === "modelle" && origineGestioneModelle
          ? [{ chiave: "torna", etichetta: "Torna a Gestione modelle", Icona: IconaFrecciaSinistra, onClick: onTornaGestioneModelle }]
          : [{ chiave: "torna", etichetta: "Torna alla lista", Icona: IconaFrecciaSinistra, onClick: annullaForm }];

        return (
          <div style={{ position: "relative", marginTop: -36, marginBottom: 32, zIndex: 2, padding: "0 6px" }}>
            <div style={{ background: "#fff", borderRadius: 22, padding: "8px 10px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", boxShadow: "0 18px 34px -14px rgba(14,27,51,0.32)" }}>
              {pulsanti.map((p) => (
                <button
                  key={p.chiave}
                  onClick={p.onClick}
                  disabled={p.disabled}
                  style={{
                    ...fontDisplay, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
                    padding: p.primario ? "12px 22px" : "10px 14px",
                    borderRadius: 18, border: "none", cursor: p.disabled ? "default" : "pointer",
                    background: p.primario ? GOLD : "transparent",
                    color: NAVY, opacity: p.disabled ? 0.5 : 1,
                    marginLeft: p.primario ? "auto" : 0,
                    textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap",
                  }}
                >
                  <p.Icona size={17} color={p.primario ? NAVY : GOLD} />
                  {p.etichetta}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {vista === "lista" && mostraGestione && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden", boxShadow: "0 16px 30px -16px rgba(14,27,51,0.25)" }}>
          <div
            onClick={() => setCostiAperto((v) => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: "50%", border: `1px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
                <IconaRiepilogoCircolare size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>Riepilogo amministrativo</div>
                <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Incassi, costi e saldo della classe</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {costiAperto && (
                <div style={{ position: "relative" }}>
                  <button
                    title="Aggiungi voce di costo"
                    onClick={(e) => { e.stopPropagation(); setSceltaCategoriaCosto((v) => !v); }}
                    style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
                  >
                    +
                  </button>
                  {sceltaCategoriaCosto && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 10, width: 260, maxHeight: 320, overflowY: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, boxShadow: "0 12px 28px -12px rgba(14,27,51,0.3)" }}
                    >
                      {categorieRiepilogo.map((cat) => (
                        <div key={cat.id}>
                          <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 12px 4px", background: BG }}>{cat.nome}</div>
                          {sottocategorieDiCategoria(costiSottocategorie, cat.id).filter((v) => !v.automatico).map((v) => (
                            <button
                              key={v.id}
                              onClick={() => aggiungiVoceCosto(`${cat.id}::${v.id}`)}
                              style={{ display: "block", width: "100%", textAlign: "left", ...fontBody, fontSize: 13, padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: NAVY }}
                            >
                              {v.nome}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                {CAMPI_RIEPILOGO_AMMINISTRATIVO.map((c) => (
                  <Field key={c.chiave} label={c.etichetta}>
                    <button
                      type="button"
                      onClick={() => onApriNuovaSpesaPerClasse(corsoData.id, c.categoriaId, c.sottocategoriaId)}
                      title="Aggiungi spesa"
                      style={{ ...inputStyle, textAlign: "left", cursor: "pointer", background: "#fff", color: totaliRiepilogo[c.chiave] ? NAVY : MUTED }}
                    >
                      {totaliRiepilogo[c.chiave] ? `€ ${totaliRiepilogo[c.chiave]}` : "+ Aggiungi"}
                    </button>
                  </Field>
                ))}
              </div>

              {costiExtra.map((voce, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: "2 1 140px", minWidth: 0 }}>
                    {voce.categoria && (
                      <div style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>
                        {sottocategoriaCostoDi(costiSottocategorie, voce.sottovoce)?.nome || categoriaCostoDi(costiCategorie, voce.categoria)?.nome || voce.categoria}
                      </div>
                    )}
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
        <div style={cardStyle}>
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

          <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Anagrafica</div>
          <>
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
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "2 1 140px" }}>
              <Field label="Tutor">
                <select value={tutor} onChange={(e) => setTutor(e.target.value)} style={{ ...inputStyle, textTransform: "uppercase" }}>
                  <option value="">— scegli venditore —</option>
                  {(venditori || []).map((v) => <option key={v.id} value={v.nome.toUpperCase()}>{v.nome.toUpperCase()}</option>)}
                  {/* valore già presente ma non (più) in elenco: resta visibile invece di sparire silenziosamente */}
                  {tutor && !(venditori || []).some((v) => v.nome.toUpperCase() === tutor.toUpperCase()) && (
                    <option value={tutor}>{tutor} (non in elenco)</option>
                  )}
                </select>
              </Field>
            </div>
            <div style={{ flex: "2 1 140px" }}>
              <Field label="Numero di telefono"><input value={telefono} onChange={(e) => setTelefono(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
            </div>
            <div style={{ flex: "1 1 130px", marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={richiedeFattura}
                  onChange={(e) => { setRichiedeFattura(e.target.checked); if (!e.target.checked) svuotaCampiFattura(); }}
                />
                Richiede fattura
              </label>
            </div>
          </div>

          {richiedeFattura && (
            <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <Field label="Nome ditta">
                <input value={fatturaDitta} onChange={(e) => setFatturaDitta(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
              </Field>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 3 }}>
                  <Field label="Indirizzo">
                    <input value={fatturaIndirizzo} onChange={(e) => setFatturaIndirizzo(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="N. civico">
                    <input maxLength={5} value={fatturaCivico} onChange={(e) => setFatturaCivico(e.target.value.toUpperCase().slice(0, 5))} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 2 }}>
                  <Field label="Città">
                    <input value={fatturaCitta} onChange={(e) => setFatturaCitta(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Prov.">
                    <input maxLength={2} value={fatturaProv} onChange={(e) => setFatturaProv(e.target.value.toUpperCase().slice(0, 2))} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Cap">
                    <input maxLength={5} value={fatturaCap} onChange={(e) => setFatturaCap(e.target.value.slice(0, 5))} style={inputStyle} />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Field label="P.IVA">
                    <input value={fatturaPiva} onChange={(e) => setFatturaPiva(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Cod. Dest.">
                    <input value={fatturaCodDest} onChange={(e) => setFatturaCodDest(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="PEC">
                    <input value={fatturaPec} onChange={(e) => setFatturaPec(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </div>
            </div>
          )}
          </>
          </fieldset>
        </div>

        <div style={cardStyle}>
          <fieldset disabled={soloLettura} style={{ border: "none", padding: 0, margin: 0 }}>
          <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Dati contabili</div>
          <>
          <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <Field label="Totale pattuito per la vendita (senza IVA)" minLabelHeight={34}>
                  <input style={inputStyle} inputMode="decimal" value={totalePattuito} onChange={(e) => setTotalePattuito(e.target.value)} />
                </Field>
              </div>
              {adminSbloccato && (
                <>
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
                </>
              )}
            </div>
            {adminSbloccato && quotaSpeciale !== "" && (
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
            pagato={pagAccontoPagato}
            onPagato={setPagAccontoPagato}
          />
          {accontoExtra.map((riga, idx) => (
            <BloccoQuota
              key={idx}
              titolo={`Acconto aggiuntivo ${idx + 1}`}
              valori={riga}
              opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Cash no iva", "Rate"]}
              imponibileBloccato={riga.metodo === "Cash no iva"}
              onImponibile={(v) => setAccontoExtra((prev) => prev.map((r, i) => (i === idx ? conImponibileAggiornato(r, v, true) : r)))}
              onTotale={(v) => setAccontoExtra((prev) => prev.map((r, i) => (i === idx ? (r.metodo === "Cash no iva" ? { ...r, totale: v } : conTotaleAggiornato(r, v, true)) : r)))}
              onMetodo={(v) => setAccontoExtra((prev) => prev.map((r, i) => (i === idx ? conMetodoAggiornato(r, v) : r)))}
              onInteressi={(v) => setAccontoExtra((prev) => prev.map((r, i) => (i === idx ? { ...r, interessi: v } : r)))}
              pagato={riga.pagato}
              onPagato={(v) => setAccontoExtra((prev) => prev.map((r, i) => (i === idx ? { ...r, pagato: v } : r)))}
              onRimuovi={() => setAccontoExtra((prev) => prev.filter((_, i) => i !== idx))}
            />
          ))}
          <button
            type="button"
            onClick={() => setAccontoExtra((prev) => [...prev, { ...RIGA_PAGAMENTO_EXTRA_VUOTA }])}
            style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "transparent", border: `1px dashed ${CREAM_BORDER}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", width: "100%", marginBottom: 14 }}
          >
            + Aggiungi un altro acconto
          </button>

          <BloccoQuota
            titolo="Quota pre corso"
            valori={pagPrecorso}
            opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Rate"]}
            onImponibile={(v) => setPagPrecorso((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagPrecorso((prev) => conTotaleAggiornato(prev, v, true))}
            onMetodo={(v) => setPagPrecorso((prev) => ({ ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "" }))}
            onInteressi={(v) => setPagPrecorso((prev) => ({ ...prev, interessi: v }))}
            pagato={pagPrecorsoPagato}
            onPagato={setPagPrecorsoPagato}
          />
          {precorsoExtra.map((riga, idx) => (
            <BloccoQuota
              key={idx}
              titolo={`Pre corso aggiuntivo ${idx + 1}`}
              valori={riga}
              opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Rate"]}
              onImponibile={(v) => setPrecorsoExtra((prev) => prev.map((r, i) => (i === idx ? conImponibileAggiornato(r, v, true) : r)))}
              onTotale={(v) => setPrecorsoExtra((prev) => prev.map((r, i) => (i === idx ? conTotaleAggiornato(r, v, true) : r)))}
              onMetodo={(v) => setPrecorsoExtra((prev) => prev.map((r, i) => (i === idx ? conMetodoAggiornato(r, v) : r)))}
              onInteressi={(v) => setPrecorsoExtra((prev) => prev.map((r, i) => (i === idx ? { ...r, interessi: v } : r)))}
              pagato={riga.pagato}
              onPagato={(v) => setPrecorsoExtra((prev) => prev.map((r, i) => (i === idx ? { ...r, pagato: v } : r)))}
              onRimuovi={() => setPrecorsoExtra((prev) => prev.filter((_, i) => i !== idx))}
            />
          ))}
          <button
            type="button"
            onClick={() => setPrecorsoExtra((prev) => [...prev, { ...RIGA_PAGAMENTO_EXTRA_VUOTA }])}
            style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "transparent", border: `1px dashed ${CREAM_BORDER}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", width: "100%", marginBottom: 14 }}
          >
            + Aggiungi un'altra quota pre corso
          </button>

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
            // include anche i pagamenti extra aggiunti con "+": sono a tutti
            // gli effetti altre quote di acconto/pre corso, solo arrivate dopo
            const tutteLeQuote = [pagAcconto, pagPrecorso, pagSaldo, ...accontoExtra, ...precorsoExtra];
            const nessunaIva = tutteLeQuote.every((q) => ivaEffettiva(q) === 0);
            const totaleSenzaIva = tutteLeQuote.reduce((somma, q) => somma + impEffettivo(q), 0);
            const totaleConIva = tutteLeQuote.reduce((somma, q) => somma + parseNum(q.totale), 0);
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
                          const interessiTotali = tutteLeQuote
                            .filter((q) => q !== pagSaldo && q.metodo === "Rate")
                            .reduce((somma, q) => somma + parseNum(q.interessi), 0);
                          if (interessiTotali <= 0) return "";
                          return (totaleConIva + interessiTotali).toFixed(2);
                        })()}
                        disabled
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })()}
          </>
          </fieldset>
        </div>

        <div style={cardStyle}>
          <fieldset disabled={soloLettura} style={{ border: "none", padding: 0, margin: 0 }}>
          <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Dati organizzativi</div>
          <>
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
                          {opzioniTipoModellaCorso.map((opz) => <option key={opz} value={opz}>{opz}</option>)}
                        </select>
                        {giorniAllieviCorso.length > 1 && (
                          <select
                            style={{ ...inputStyle, flex: 1 }}
                            value={m.giorno || ""}
                            onChange={(e) => {
                              const giornoScelto = e.target.value ? Number(e.target.value) : null;
                              const giornoObj = giorniAllieviCorso.find((g) => g.numero_giorno === giornoScelto);
                              // scegliendo il giorno si suggerisce anche il suo trattamento
                              // previsto, restando comunque modificabile a mano se serve
                              setTipiModelle((prev) => prev.map((x, i) => (i === idx ? { ...x, giorno: giornoScelto, tipo: giornoObj?.tipo_modella_allievi || x.tipo } : x)));
                            }}
                          >
                            <option value="">— giorno —</option>
                            {giorniAllieviCorso.map((g) => (
                              <option key={g.numero_giorno} value={g.numero_giorno}>Giorno {g.numero_giorno}{g.tipo_modella_allievi ? ` — ${g.tipo_modella_allievi}` : ""}</option>
                            ))}
                          </select>
                        )}
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
          </>

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
        </div>
      )}

      {vista === "modelle" && (() => {
        const iscrittiConModelle = listaIscritti.filter((i) => i.richiede_modelle && Array.isArray(i.tipi_modelle) && i.tipi_modelle.length > 0);
        const linkCard = (
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
        );

        // corso senza template giorni impostato: comportamento identico a
        // prima di questa funzionalità, nessuna rottura per i corsi già
        // esistenti che non l'hanno ancora configurata
        if (giorniRilevantiModelle.length === 0) {
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
                        opzioniTipo={opzioniTipoModellaCorso}
                        onSalva={(campo, valore) => aggiornaModellaSlot(i.id, idx, campo, valore)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {linkCard}
              {msg && !msgErrore && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
            </div>
          );
        }

        const modelleMaster = Array.isArray(corsoData.modelle_master) ? corsoData.modelle_master : [];

        return (
          <div>
            <div style={{ ...hStyle, marginBottom: 4 }}>Assegna modelle</div>
            <div style={subStyle}>
              Per ogni modella richiesta, spunta MAT/POM e, appena trovata, inserisci nome e telefono: si salva da solo, non serve premere Salva.
            </div>

            {giorniRilevantiModelle.map((g) => {
              const modellaMaster = modelleMaster.find((m) => m.numero_giorno === g.numero_giorno)
                || { mattina: g.mattina_master, pomeriggio: g.pomeriggio_master, nome_modella: "", telefono_modella: "" };

              return (
                <div key={g.id} style={{ ...cardStyle, padding: 18 }}>
                  <div style={{ ...fontBody, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
                    Giorno {g.numero_giorno}
                  </div>

                  {g.richiede_modella_master && (
                    <div style={{ marginBottom: g.richiede_modelle_allievi ? 16 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
                        <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.6 }}>
                          Modella del Master{g.tipo_modella_master ? ` — ${g.tipo_modella_master}` : ""}
                        </div>
                        <CheckboxOttimistica
                          valore={modellaMaster.la_porta_master}
                          onCambia={(v) => aggiornaModellaMaster(g.numero_giorno, "la_porta_master", v)}
                        >
                          La porta la master
                        </CheckboxOttimistica>
                      </div>
                      <RigaModella
                        modella={{ ...modellaMaster, tipo: g.tipo_modella_master }}
                        primaRiga
                        onSalva={(campo, valore) => aggiornaModellaMaster(g.numero_giorno, campo, valore)}
                      />
                    </div>
                  )}

                  {g.richiede_modelle_allievi && (
                    <div>
                      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                        Allievi{g.tipo_modella_allievi ? ` — ${g.tipo_modella_allievi}` : ""}
                      </div>
                      {listaIscritti.length === 0 && (
                        <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun iscritto in questa classe.</div>
                      )}
                      {/* prima chi dobbiamo trovare noi (NOSTRA), poi chi
                          porta già la propria modella: così si vede a
                          colpo d'occhio chi manca ancora */}
                      {listaIscritti.slice().sort((a, b) => (b.richiede_modelle ? 1 : 0) - (a.richiede_modelle ? 1 : 0)).map((i, idx, elencoOrdinato) => {
                        const nostra = !!i.richiede_modelle;
                        const ultimo = idx === elencoOrdinato.length - 1;
                        const elenco = Array.isArray(i.tipi_modelle) ? i.tipi_modelle : [];
                        const slotEsistente = elenco.find((m) => (m.giorno ?? giornoDiRipiegoAllievi) === g.numero_giorno);
                        // una riga scrivibile sempre presente, anche se non
                        // esiste ancora nulla salvato per questo allievo in
                        // questo giorno (creata al primo carattere digitato)
                        // — vale sia per NOSTRA che per SUA: sapere chi porta
                        // quale modella è utile in entrambi i casi
                        const modellaVista = slotEsistente || { tipo: g.tipo_modella_allievi || "", mattina: false, pomeriggio: false, nome_modella: "", telefono_modella: "" };
                        return (
                          <div
                            key={i.id}
                            style={{
                              padding: nostra ? "8px 0" : ultimo ? "8px 18px 26px" : "8px 18px",
                              margin: nostra ? 0 : ultimo ? "0 -18px -18px" : "0 -18px",
                              background: nostra ? "transparent" : "#F7F6F3",
                              borderTop: `1px solid ${CREAM_BORDER}`,
                              borderBottomLeftRadius: ultimo && !nostra ? 14 : 0,
                              borderBottomRightRadius: ultimo && !nostra ? 14 : 0,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ ...fontBody, fontSize: 14, fontWeight: 600, color: NAVY }}>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</span>
                              <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: nostra ? "#F7EDDB" : "#FDECEC", color: nostra ? "#8A6D1D" : "#C0392B" }}>
                                {nostra ? "NOSTRA" : "HA LA SUA MODELLA"}
                              </span>
                            </div>
                            <RigaModella
                              modella={modellaVista}
                              primaRiga
                              opzioniTipo={opzioniTipoModellaCorso}
                              onSalva={(campo, valore) => aggiornaModellaAllievoGiorno(i.id, g.numero_giorno, campo, valore, g.tipo_modella_allievi)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {linkCard}
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
                      alla scheda, non fermarsi al suo contenuto.
                      minWidth+overflowX sul contenitore: sotto quella
                      soglia la scheda scorre lateralmente invece di
                      schiacciare le 2 colonne e diventare illeggibile
                      su cellulare */}
                  <div style={{ overflowX: "auto" }}>
                  <div style={{ display: "table", width: "100%", minWidth: 580, tableLayout: "fixed" }}>
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

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, ...fontBody, fontSize: 14, color: NAVY }}>
                        Ricontattato
                        <div style={{ display: "flex", gap: 6 }}>
                          <span onClick={() => toggleRicontattato(i)} title="Non ricontattato" style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#E0E0E0" : "#C0392B", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
                          <span onClick={() => toggleRicontattato(i)} title="Ricontattato" style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#2E7D32" : "#E0E0E0", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue={(i.note_ricontatto || "").toUpperCase()}
                        placeholder="Note dopo il ricontatto"
                        onBlur={(e) => salvaNotaRicontatto(i.id, e.target.value.toUpperCase())}
                        style={{ ...inputStyle, marginTop: 10, fontSize: 8, textTransform: "uppercase", resize: "vertical", width: "100%", boxSizing: "border-box" }}
                      />

                      {i.richiede_fattura && (
                        // marginBottom generoso: "Eccezione diploma" più sotto
                        // è posizionato in absolute (bottom:20) rispetto
                        // all'intera colonna, quindi NON riserva da solo lo
                        // spazio necessario nel flusso normale — senza questo
                        // margine il testo di questo riquadro (specie con PEC)
                        // finirebbe nascosto dietro al tasto/dettagli sotto
                        <div style={{ marginTop: 12, marginBottom: 100, padding: 10, borderRadius: 8, background: "#fff", border: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 11, color: NAVY, lineHeight: 1.6 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, textAlign: "center" }}>Dati fatturazione</div>
                          <div>Ditta: {i.fattura_ditta || "—"}</div>
                          <div>Ind. {i.fattura_indirizzo || "—"} n. {i.fattura_civico || "—"}</div>
                          <div>Città {i.fattura_citta || "—"} prov {i.fattura_prov || "—"} cap {i.fattura_cap || "—"}</div>
                          <div>P.IVA {i.fattura_piva || "—"} C.Dest {i.fattura_cod_dest || "—"}</div>
                          {i.fattura_pec && <div>PEC {i.fattura_pec}</div>}
                        </div>
                      )}

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
                      <RiepilogoVenditaIscritto i={i} isMobile={isMobile} mostraQuotaVenditore={true} />

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
  const isMobile = useIsMobile();

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

              <div style={{ marginTop: 8, padding: "12px 14px", background: BG_CHIARO, borderRadius: 8, ...fontBody, fontSize: 14, color: NAVY }}>
                <RiepilogoVenditaIscritto i={i} isMobile={isMobile} mostraQuotaVenditore={false} />
                {i.note && (
                  <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1px solid ${CREAM_BORDER}` }}>
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
          Appena trovi una modella per un trattamento, spunta se viene la mattina o il pomeriggio e scrivi il suo nome e il suo numero: si salva da solo.
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
function VistaBiglietti({ param, tipo }) {
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
  const file = (tipo === "assistente" ? cd.viaggio_assistente_file : cd.viaggio_file) || [];

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, marginBottom: 2 }}>{corso?.nome?.toUpperCase() || "?"} · {loc?.nome?.toUpperCase() || "?"}</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 24 }}>
          {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`} — biglietti di viaggio{tipo === "assistente" ? " (assistente)" : ""}
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

// ---------- ERP: dashboard direzionale ----------
// somma solo le voci libere aggiunte in "Riepilogo amministrativo"
// (Contabilità classe): i 10 costi fissi (Costo Master, Rimborso
// cene...) ora sono spese vere nella tabella "spese" (tipo_ambito
// "classe"), già sommate da calcolaKpiErp tramite "costiManuali" —
// includerle anche qui le conterebbe due volte
function costoClasseErp(cd) {
  return Array.isArray(cd.costi_extra) ? cd.costi_extra.reduce((s, c) => s + (Number(c.valore) || 0), 0) : 0;
}
function fmtEuroErp(n) {
  return `${Math.round(n || 0).toLocaleString("it-IT")} €`;
}
function fmtEuroKErp(n) {
  const v = n || 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",")}K €`;
  return fmtEuroErp(v);
}
function fmtPctErp(n) {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}
function round1Erp(n) {
  return Math.round(n * 10) / 10;
}
// range del periodo scelto, sempre con date costruite dal costruttore
// numerico di Date (anno, mese, giorno) invece che da stringa: evita lo
// sfasamento di un giorno che "new Date(stringa)" introdurrebbe in alcuni
// fusi orari, perché legge un istante UTC con i getter in ora locale
function rangePeriodoErp(periodo) {
  const oggi = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (periodo === "30giorni") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 29);
    return { inizio: fmt(inizio), fine: fmt(oggi) };
  }
  if (periodo === "trimestre") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 3, oggi.getDate() + 1);
    return { inizio: fmt(inizio), fine: fmt(oggi) };
  }
  return { inizio: `${oggi.getFullYear()}-01-01`, fine: `${oggi.getFullYear()}-12-31` };
}
// stesso numero di giorni del periodo attuale, subito prima del suo inizio: usato per confronti "vs periodo precedente"
function rangePrecedenteErp(range) {
  const [aI, mI, gI] = range.inizio.split("-").map(Number);
  const [aF, mF, gF] = range.fine.split("-").map(Number);
  const inizio = new Date(aI, mI - 1, gI);
  const fine = new Date(aF, mF - 1, gF);
  const giorni = Math.round((fine - inizio) / 86400000) + 1;
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const finePrec = new Date(aI, mI - 1, gI - 1);
  const inizioPrec = new Date(finePrec.getFullYear(), finePrec.getMonth(), finePrec.getDate() - giorni + 1);
  return { inizio: fmt(inizioPrec), fine: fmt(finePrec) };
}
// periodi della pagina "Costi operativi" (diversi da quelli della
// dashboard ERP: qui servono "ultimo mese"/"mese precedente" come mesi
// di calendario interi, non gli ultimi 30 giorni)
function rangePeriodoCosti(periodo, personalizzato) {
  const oggi = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (periodo === "ultimomese") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const fine = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
    return { inizio: fmt(inizio), fine: fmt(fine) };
  }
  if (periodo === "mesescorso") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
    const fine = new Date(oggi.getFullYear(), oggi.getMonth(), 0);
    return { inizio: fmt(inizio), fine: fmt(fine) };
  }
  if (periodo === "trimestre") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 3, oggi.getDate() + 1);
    return { inizio: fmt(inizio), fine: fmt(oggi) };
  }
  if (periodo === "personalizzato") {
    return { inizio: personalizzato?.da || fmt(oggi), fine: personalizzato?.a || fmt(oggi) };
  }
  return { inizio: `${oggi.getFullYear()}-01-01`, fine: `${oggi.getFullYear()}-12-31` };
}
function variazionePctErp(attuale, precedente) {
  if (!precedente) return attuale ? null : 0;
  return ((attuale - precedente) / Math.abs(precedente)) * 100;
}
// ricavi/costi/allievi/riempimento/cash flow/crediti di un insieme di
// edizioni filtrate per periodo + sede — riusata sia per i KPI del
// periodo corrente/precedente sia per ogni riga di "Andamento per sede"
function calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio, fine, sedeId, corsoById, locById }) {
  const cdFiltrate = corsiDate.filter((cd) => cd.data_inizio >= inizio && cd.data_inizio <= fine && (!sedeId || cd.location_id === sedeId));
  const idsCd = new Set(cdFiltrate.map((cd) => cd.id));
  const iscrittiFiltrati = iscritti.filter((i) => idsCd.has(i.corso_data_id));
  // incassi non legati a un'iscrizione (es. vendita di un prodotto in
  // accademia): stesso trattamento "al netto di IVA" dei ricavi corsi,
  // così restano confrontabili nello stesso KPI
  const entrateManualiValide = (entrateManuali || []).filter((e) => {
    if (!e.data || e.data < inizio || e.data > fine) return false;
    return !sedeId || e.sede_id === sedeId;
  });
  const totaleEntrateManuali = round2(entrateManualiValide.reduce((s, e) => s + (e.imponibile || 0), 0));
  const ricavi = round2(iscrittiFiltrati.reduce((s, i) => s + (i.totale_pattuito || 0), 0) + totaleEntrateManuali);
  const costiClasse = round2(cdFiltrate.reduce((s, cd) => s + costoClasseErp(cd), 0));
  const quoteVenditore = round2(iscrittiFiltrati.reduce((s, i) => s + (i.quota_venditore || 0), 0));
  // spese di "Analisi costi di gestione": sull'imponibile, coerente coi
  // ricavi (sempre al netto di IVA) — le voci extra taggate del
  // Riepilogo amministrativo sono già incluse in costiClasse sopra
  // (fanno parte di costi_extra di ogni edizione), quindi qui si somma
  // solo la tabella "spese", senza rischio di doppio conteggio. Esclude
  // le spese marcate fuori analisi (per-spesa o per l'intera categoria,
  // es. "Versamenti e adempimenti")
  const corsiDateById = Object.fromEntries(corsiDate.map((cd) => [cd.id, cd]));
  const speseValide = (spese || []).filter((s) => {
    if (s.includi_analisi_costi === false) return false;
    const cat = costiCategorieById?.[s.categoria_id];
    if (cat && cat.includi_analisi_costi === false) return false;
    const data = s.data_documento || s.data_pagamento;
    if (!data || data < inizio || data > fine) return false;
    if (!sedeId) return true;
    if (s.sede_id === sedeId) return true;
    if (s.classe_id && corsiDateById[s.classe_id]?.location_id === sedeId) return true;
    return false;
  });
  const costiManuali = round2(speseValide.reduce((s, v) => s + (v.imponibile || 0), 0));
  const costi = round2(costiClasse + quoteVenditore + costiManuali);
  const utile = round2(ricavi - costi);
  const riempimenti = cdFiltrate
    .map((cd) => {
      const n = iscritti.filter((i) => i.corso_data_id === cd.id).length;
      const max = postiMaxEffettivi(cd, corsoById[cd.corso_id], locById[cd.location_id]);
      return max > 0 ? (n / max) * 100 : null;
    })
    .filter((v) => v != null);
  const riempimentoMedio = riempimenti.length ? round1Erp(riempimenti.reduce((s, v) => s + v, 0) / riempimenti.length) : 0;
  // "cash flow": incassato realmente (acconto/precorso arrivati prima +
  // saldo solo se già spuntato "incassato") meno i costi — non è un vero
  // saldo di cassa bancario (non tracciato), ma un incassato netto reale
  const incassatoReale = round2(iscrittiFiltrati.reduce((s, i) => s + (i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.incassato ? (i.saldo_totale || 0) + modelleTotaleDi(i) : 0), 0));
  const cashFlow = round2(incassatoReale - costi);
  const creditiDaIncassare = round2(iscrittiFiltrati.filter((i) => !i.incassato).reduce((s, i) => s + (i.saldo_totale || 0) + modelleTotaleDi(i), 0));
  const pagamentiAperti = iscrittiFiltrati.filter((i) => !i.incassato && (i.saldo_totale || 0) + modelleTotaleDi(i) > 0).length;
  return { ricavi, costi, utile, nAllievi: iscrittiFiltrati.length, riempimentoMedio, cashFlow, creditiDaIncassare, pagamentiAperti, cdFiltrate, iscrittiFiltrati };
}

function CardKpiErp({ titolo, valore, variazione, variazioneInvertita, sub, Icona, coloreIcona, coloreBgIcona, scuro, onClick }) {
  const positivo = variazione == null ? null : variazioneInvertita ? variazione <= 0 : variazione >= 0;
  return (
    <div
      onClick={onClick}
      style={{ ...cardStyle, padding: 18, background: scuro ? NAVY : "#fff", marginBottom: 0, cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: coloreBgIcona, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icona size={19} color={coloreIcona} />
        </div>
        {variazione != null && (
          <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: positivo ? "#2E7D32" : "#C0392B", background: positivo ? "#E3F3E5" : "#FBE4E1", borderRadius: 8, padding: "2px 8px", whiteSpace: "nowrap" }}>
            {variazione >= 0 ? "↗" : "↘"} {fmtPctErp(Math.abs(variazione))}
          </div>
        )}
      </div>
      <div style={{ ...fontBody, fontSize: 12.5, color: scuro ? "rgba(255,255,255,0.7)" : MUTED, marginBottom: 4 }}>{titolo}</div>
      <div style={{ ...fontDisplay, fontSize: 24, fontWeight: 700, color: scuro ? "#fff" : NAVY, marginBottom: 4 }}>{valore}</div>
      <div style={{ ...fontBody, fontSize: 11.5, color: scuro ? "rgba(255,255,255,0.6)" : MUTED }}>{sub}</div>
    </div>
  );
}

function RigaBusinessPulseErp({ Icona, coloreIconaProp, titolo, sub, valore, ultima }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: ultima ? "none" : `1px solid ${CREAM_BORDER}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icona size={17} color={coloreIconaProp || NAVY} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>{titolo}</div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>{sub}</div>
      </div>
      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{valore}</div>
    </div>
  );
}

function GaugeMargineErp({ percentuale }) {
  const clamp = Math.max(0, Math.min(100, percentuale));
  const raggio = 34;
  const circonferenza = 2 * Math.PI * raggio;
  const offset = circonferenza * (1 - clamp / 100);
  return (
    <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={raggio} fill="none" stroke={BG} strokeWidth="9" />
        <circle
          cx="42" cy="42" r={raggio} fill="none" stroke={GOLD} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circonferenza} strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY }}>{percentuale.toFixed(1).replace(".", ",")}%</div>
        <div style={{ ...fontBody, fontSize: 9, color: MUTED }}>margine</div>
      </div>
    </div>
  );
}

// form "+ Nuova operazione" → "Entrata": incasso non legato a
// un'iscrizione (es. vendita in accademia di un prodotto a un cliente
// occasionale). Stessa struttura/UX di "Uscita", ma senza voce di costo:
// qui la descrizione libera indica cosa è stato venduto/incassato
function ModaleNuovaEntrata({ location, onClose, onSalvato }) {
  const [data, setData] = useState(dataOggiStr());
  const [citta, setCitta] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [imponibile, setImponibile] = useState("");
  const [totale, setTotale] = useState("");
  const [iva, setIva] = useState(22);
  const [esenteIva, setEsenteIva] = useState(false);
  const [metodo, setMetodo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const ivaBloccata = esenteIva || metodo === "Cash no iva";
  const ivaEffettiva = ivaBloccata ? 0 : iva;

  function totaleDaImponibile(v, ivaPct) {
    return v === "" ? "" : String(round2(parseNum(v) * (1 + ivaPct / 100)));
  }
  function imponibileDaTotale(v, ivaPct) {
    return v === "" ? "" : String(round2(parseNum(v) / (1 + ivaPct / 100)));
  }

  function onImponibileChange(v) {
    setImponibile(v);
    setTotale(ivaBloccata ? v : totaleDaImponibile(v, ivaEffettiva));
  }
  function onTotaleChange(v) {
    setTotale(v);
    setImponibile(ivaBloccata ? v : imponibileDaTotale(v, ivaEffettiva));
  }
  function onIvaChange(v) {
    setIva(v);
    if (!ivaBloccata) setTotale(totaleDaImponibile(imponibile, v));
  }
  function ricalcolaBlocco(nuovaBloccata) {
    setTotale(nuovaBloccata ? imponibile : totaleDaImponibile(imponibile, iva));
  }
  function onEsenteChange(checked) {
    setEsenteIva(checked);
    ricalcolaBlocco(checked || metodo === "Cash no iva");
  }
  function onMetodoChange(opz) {
    setMetodo(opz);
    ricalcolaBlocco(esenteIva || opz === "Cash no iva");
  }

  async function salva() {
    const imp = parseNum(imponibile);
    if (!imp) { setMsg("Inserisci un imponibile."); return; }
    setSalvando(true);
    const { error } = await supabase.from("entrate_manuali").insert({
      descrizione: descrizione.trim() || null,
      sede_id: citta || null,
      imponibile: imp,
      iva_percentuale: ivaEffettiva,
      totale: totale === "" ? imp : round2(parseNum(totale)),
      data,
      metodo_pagamento: metodo || null,
    });
    setSalvando(false);
    if (error) { setMsg("Errore: " + error.message); return; }
    onSalvato();
  }

  return (
    <Modal title="Nuova entrata" onClose={onClose}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <Field label="Data"><input type="date" style={inputStyle} value={data} onChange={(e) => setData(e.target.value)} /></Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Città (opzionale)">
            <select style={inputStyle} value={citta} onChange={(e) => setCitta(e.target.value)}>
              <option value="">—</option>
              {location.map((l) => <option key={l.id} value={l.id}>{l.nome.toUpperCase()}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Descrizione (es. vendita prodotto, cliente occasionale)">
        <input style={inputStyle} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, marginBottom: 6 }}>
        <input type="checkbox" checked={esenteIva} onChange={(e) => onEsenteChange(e.target.checked)} />
        Importo esente iva
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Field label="Imponibile"><input style={inputStyle} inputMode="decimal" value={imponibile} onChange={(e) => onImponibileChange(e.target.value)} /></Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="IVA">
            <select
              style={{ ...inputStyle, background: ivaBloccata ? "#EFEFEF" : "#fff", color: ivaBloccata ? MUTED : NAVY }}
              disabled={ivaBloccata}
              value={ivaEffettiva}
              onChange={(e) => onIvaChange(Number(e.target.value))}
            >
              {ALIQUOTE_IVA_COSTI.map((a) => <option key={a} value={a}>{a}%</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Totale"><input style={inputStyle} inputMode="decimal" value={totale} onChange={(e) => onTotaleChange(e.target.value)} /></Field>
        </div>
      </div>
      <Field label="Metodo di pagamento">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...fontBody, fontSize: 13, color: NAVY }}>
          {["Paypal", "Carta", "Bonifico", "Contanti", "Cash no iva"].map((opz) => (
            <label key={opz} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" name="metodo-entrata" checked={metodo === opz} onChange={() => onMetodoChange(opz)} />
              {opz}
            </label>
          ))}
        </div>
      </Field>
      {msg && <div style={{ ...fontBody, fontSize: 12, color: "#C0392B", marginBottom: 10 }}>{msg}</div>}
      <Button onClick={salva} disabled={salvando} style={{ width: "100%" }}>{salvando ? "Salvo…" : "Salva entrata"}</Button>
    </Modal>
  );
}

// pannello aperto cliccando la card "Ricavi e costi": confronto anno
// scolastico su anno scolastico (settembre -> agosto), UNA RIGA PER
// ANNO, con i 12 mesi in orizzontale dentro la riga (stesso stile a
// barre della card "Ricavi e costi" della dashboard) — scorrendo verso
// il basso si passa dall'anno scolastico corrente ai precedenti, e la
// scala delle barre è GLOBALE (stesso massimo per tutte le righe) così
// il confronto tra un anno e l'altro si vede subito anche solo
// guardando l'altezza delle barre nella stessa colonna (stesso mese)
function annoScolasticoDi(dataStr) {
  const [anno, mese] = dataStr.split("-").map(Number);
  return mese >= 9 ? anno : anno - 1;
}
function PannelloConfrontoAnnuale({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, sedeSel, corsoById, locById, onClose }) {
  const isMobile = useIsMobile();
  const annoScolasticoCorrente = annoScolasticoDi(dataOggiStr());
  const anniScolasticiDisponibili = useMemo(() => {
    const anni = new Set([annoScolasticoCorrente]);
    corsiDate.forEach((cd) => { if (cd.data_inizio) anni.add(annoScolasticoDi(cd.data_inizio)); });
    spese.forEach((v) => { const d = v.data_documento || v.data_pagamento; if (d) anni.add(annoScolasticoDi(d)); });
    return [...anni].sort((a, b) => b - a);
  }, [corsiDate, spese, annoScolasticoCorrente]);

  const confronto = useMemo(() => anniScolasticiDisponibili.map((annoIniziale) => {
    const mesi = ORDINE_MESI_SCOLASTICO.map((mese0) => {
      const anno = mese0 >= 8 ? annoIniziale : annoIniziale + 1; // SET-DIC (indici 8-11) nell'anno iniziale, GEN-AGO (0-7) in quello successivo
      const inizioMese = `${anno}-${String(mese0 + 1).padStart(2, "0")}-01`;
      const ultimoGiorno = new Date(anno, mese0 + 1, 0).getDate();
      const fineMese = `${anno}-${String(mese0 + 1).padStart(2, "0")}-${String(ultimoGiorno).padStart(2, "0")}`;
      const k = calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: inizioMese, fine: fineMese, sedeId: sedeSel, corsoById, locById });
      return { etichetta: MESI_ABBR[mese0], ricavi: k.ricavi, costi: k.costi };
    });
    const totaleRicavi = round2(mesi.reduce((s, m) => s + m.ricavi, 0));
    const totaleCosti = round2(mesi.reduce((s, m) => s + m.costi, 0));
    return { annoIniziale, etichetta: `${annoIniziale}/${annoIniziale + 1}`, mesi, totaleRicavi, totaleCosti, totaleUtile: round2(totaleRicavi - totaleCosti) };
  }), [anniScolasticiDisponibili, corsiDate, iscritti, spese, costiCategorieById, entrateManuali, sedeSel, corsoById, locById]);

  const massimoGlobale = Math.max(1, ...confronto.flatMap((a) => a.mesi.flatMap((m) => [m.ricavi, m.costi])));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...cardStyle, maxWidth: 820, width: "100%", height: "fit-content", marginBottom: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>Ricavi e costi, anno su anno</div>
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 4 }}>Un anno scolastico per riga (settembre → agosto) — scorri per confrontare gli anni precedenti.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: MUTED, padding: 4, flexShrink: 0 }} aria-label="Chiudi">×</button>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, ...fontBody, fontSize: 12, color: MUTED }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: NAVY, display: "inline-block" }} />Ricavi</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GOLD, display: "inline-block" }} />Costi</span>
        </div>

        {confronto.map((a) => (
          <div key={a.annoIniziale} style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${CREAM_BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>
                {a.etichetta}
                {a.annoIniziale === annoScolasticoCorrente && <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: GOLD, marginLeft: 8 }}>ANNO CORRENTE</span>}
              </div>
              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: a.totaleUtile >= 0 ? "#2E7D32" : "#C0392B", background: a.totaleUtile >= 0 ? "#E3F3E5" : "#FBE4E1", borderRadius: 8, padding: "2px 8px" }}>
                Utile {a.totaleUtile >= 0 ? "+" : ""}{fmtEuroErp(a.totaleUtile)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 4 : 16, height: 130, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 10, overflowX: "auto" }}>
              {a.mesi.map((m, idx) => (
                <div key={`${m.etichetta}-${idx}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 4 : 6, minWidth: isMobile ? 14 : 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 2 : 3, height: 100 }}>
                    <div title={`Ricavi ${m.etichetta}: ${fmtEuroErp(m.ricavi)}`} style={{ width: isMobile ? 5 : 10, height: `${Math.max(2, (m.ricavi / massimoGlobale) * 100)}px`, background: NAVY, borderRadius: 3 }} />
                    <div title={`Costi ${m.etichetta}: ${fmtEuroErp(m.costi)}`} style={{ width: isMobile ? 5 : 10, height: `${Math.max(2, (m.costi / massimoGlobale) * 100)}px`, background: GOLD, borderRadius: 3 }} />
                  </div>
                  <div style={{ ...fontBody, fontSize: isMobile ? 8.5 : 10, color: MUTED }}>{m.etichetta}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// dashboard direzionale: riepiloga ricavi/costi/utile/allievi/andamento
// per sede usando SOLO i dati già tracciati dal gestionale (iscritti,
// costi per edizione, quota venditore, incassato, sede confermata).
// Magazzino/CRM/Contabilità generale/Report non esistono ancora come
// moduli dati: le voci di navigazione e i pulsanti che li richiederebbero
// restano visibili ma disattivati, invece di inventare numeri finti
function PaginaErp({ corsi, location, master, corsiDate, iscritti, spese, costiCategorie, costiSottocategorie, entrateManuali, ricarica, onBack, onApriGestioneDate, onApriImpostazioni, onApriCercaIscritto, onApriCostiOperativi, onApriNuovaSpesa, onApriVenditeShop, onApriMagazzino }) {
  const isMobile = useIsMobile();
  const [periodo, setPeriodo] = useState("anno");
  const [sedeSel, setSedeSel] = useState("");
  const [menuNuovaOperazione, setMenuNuovaOperazione] = useState(false);
  const [modaleEntrataAperta, setModaleEntrataAperta] = useState(false);
  const [confrontoAnnualeAperto, setConfrontoAnnualeAperto] = useState(false);

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const costiCategorieById = useMemo(() => Object.fromEntries((costiCategorie || []).map((c) => [c.id, c])), [costiCategorie]);

  const range = rangePeriodoErp(periodo);
  const rangePrec = rangePrecedenteErp(range);

  const kpi = useMemo(
    () => calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: range.inizio, fine: range.fine, sedeId: sedeSel, corsoById, locById }),
    [corsiDate, iscritti, spese, costiCategorieById, entrateManuali, range.inizio, range.fine, sedeSel, corsoById, locById]
  );
  const kpiPrec = useMemo(
    () => calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: rangePrec.inizio, fine: rangePrec.fine, sedeId: sedeSel, corsoById, locById }),
    [corsiDate, iscritti, spese, costiCategorieById, entrateManuali, rangePrec.inizio, rangePrec.fine, sedeSel, corsoById, locById]
  );

  const varRicavi = variazionePctErp(kpi.ricavi, kpiPrec.ricavi);
  const varCosti = variazionePctErp(kpi.costi, kpiPrec.costi);
  const varUtile = variazionePctErp(kpi.utile, kpiPrec.utile);
  const varAllievi = variazionePctErp(kpi.nAllievi, kpiPrec.nAllievi);

  const marginePct = kpi.ricavi > 0 ? round1Erp((kpi.utile / kpi.ricavi) * 100) : 0;
  const giudizioMargine = marginePct >= 30 ? "Ottima" : marginePct >= 15 ? "Buona" : marginePct >= 0 ? "Da migliorare" : "In perdita";

  const mesiRange = useMemo(() => {
    const [annoIni, meseIni] = range.inizio.split("-").map(Number);
    const [annoFin, meseFin] = range.fine.split("-").map(Number);
    const risultato = [];
    let anno = annoIni, mese = meseIni;
    while (anno < annoFin || (anno === annoFin && mese <= meseFin)) {
      risultato.push({ anno, mese0: mese - 1 });
      mese += 1;
      if (mese > 12) { mese = 1; anno += 1; }
    }
    return risultato;
  }, [range.inizio, range.fine]);

  const andamentoMensile = mesiRange.map(({ anno, mese0 }) => {
    const inizioMese = `${anno}-${String(mese0 + 1).padStart(2, "0")}-01`;
    const ultimoGiorno = new Date(anno, mese0 + 1, 0).getDate();
    const fineMese = `${anno}-${String(mese0 + 1).padStart(2, "0")}-${String(ultimoGiorno).padStart(2, "0")}`;
    const k = calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: inizioMese, fine: fineMese, sedeId: sedeSel, corsoById, locById });
    return { etichetta: MESI_ABBR[mese0], ricavi: k.ricavi, costi: k.costi };
  });
  const maxBarra = Math.max(1, ...andamentoMensile.flatMap((m) => [m.ricavi, m.costi]));

  const sediConDati = location.filter((l) => corsiDate.some((cd) => cd.location_id === l.id && cd.data_inizio >= range.inizio && cd.data_inizio <= range.fine));
  const righeSedi = (sediConDati.length ? sediConDati : location)
    .map((l) => {
      const k = calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: range.inizio, fine: range.fine, sedeId: l.id, corsoById, locById });
      const kPrec = calcolaKpiErp({ corsiDate, iscritti, spese, costiCategorieById, entrateManuali, inizio: rangePrec.inizio, fine: rangePrec.fine, sedeId: l.id, corsoById, locById });
      return { location: l, ...k, trend: variazionePctErp(k.ricavi, kPrec.ricavi) };
    })
    .sort((a, b) => b.ricavi - a.ricavi);

  const oggiStr = dataOggiStr();
  const tra60gg = (() => {
    const d = new Date();
    const d2 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 60);
    return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
  })();
  const corsiConfermatiProssimi = corsiDate.filter((cd) => cd.data_inizio >= oggiStr && cd.data_inizio <= tra60gg && cd.sede_confermata).length;

  // unico alert reale che ho dati per calcolare davvero: fatture in
  // scadenza e scorte di magazzino non sono ancora tracciate nel gestionale
  const SOGLIA_RIEMPIMENTO_BASSO_ERP = 60;
  const classiSottoSoglia = kpi.cdFiltrate.filter((cd) => {
    const n = iscritti.filter((i) => i.corso_data_id === cd.id).length;
    const max = postiMaxEffettivi(cd, corsoById[cd.corso_id], locById[cd.location_id]);
    return max > 0 && (n / max) * 100 < SOGLIA_RIEMPIMENTO_BASSO_ERP;
  }).length;

  const vociNav = [
    { chiave: "dashboard", etichetta: "Dashboard", attiva: true, corrente: true },
    { chiave: "calendario", etichetta: "Calendario", attiva: true, onClick: onApriGestioneDate },
    { chiave: "corsi", etichetta: "Corsi", attiva: true, onClick: onApriImpostazioni },
    { chiave: "allievi", etichetta: "Allievi", attiva: true, onClick: onApriCercaIscritto },
    { chiave: "crm", etichetta: "CRM & vendite", attiva: false },
    { chiave: "sedi", etichetta: "Sedi", attiva: true, onClick: onApriImpostazioni },
    { chiave: "team", etichetta: "Team", attiva: true, onClick: onApriImpostazioni },
    { chiave: "contabilita", etichetta: "Contabilità", attiva: true, onClick: onApriCostiOperativi },
    { chiave: "venditeshop", etichetta: "Vendite shop", attiva: true, onClick: onApriVenditeShop },
    { chiave: "magazzino", etichetta: "Magazzino", attiva: true, onClick: onApriMagazzino },
    { chiave: "report", etichetta: "Report", attiva: false },
  ];

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh" }}>
      <div style={{ background: NAVY, padding: isMobile ? "14px 16px" : "14px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button onClick={onBack} title="Torna alla home" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            <img src="/logo-elitederma.png" alt="Elitederma" style={{ height: 26, width: "auto", filter: "invert(1) brightness(1.8)" }} />
          </button>
          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>ELITEDERMA</div>
          <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 6, padding: "2px 6px" }}>ERP</div>
        </div>
        {!isMobile && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", maxWidth: 420, opacity: 0.55 }} title="Ricerca non ancora disponibile">
            <IconaRicercaErp size={16} color="#fff" />
            <input disabled placeholder="Cerca allievi, corsi, fatture…" style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13, flex: 1, cursor: "not-allowed" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
          <div style={{ opacity: 0.4, cursor: "not-allowed", display: "flex" }} title="Notifiche non ancora disponibili"><IconaCampanellaErp color="#fff" /></div>
          <button onClick={onApriImpostazioni} title="Impostazioni" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff", opacity: 0.85, display: "flex" }}>
            <IconaIngranaggioErp color="#fff" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", ...fontDisplay, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>GR</div>
            {!isMobile && (
              <div>
                <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap" }}>GianLuca Rocca</div>
                <div style={{ ...fontBody, fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>Amministratore</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: `1px solid ${CREAM_BORDER}`, padding: isMobile ? "0 12px" : "0 28px", display: "flex", gap: 4, overflowX: "auto" }}>
        {vociNav.map((v) => (
          <button
            key={v.chiave}
            onClick={v.attiva ? v.onClick : undefined}
            disabled={!v.attiva}
            title={v.attiva ? undefined : "Sezione non ancora collegata a dati reali"}
            style={{
              ...fontBody, fontSize: 13.5, fontWeight: 600, padding: "14px 12px", whiteSpace: "nowrap",
              background: "transparent", border: "none", borderBottom: v.corrente ? `2px solid ${GOLD}` : "2px solid transparent",
              color: v.corrente ? NAVY : v.attiva ? MUTED : "#C7C9D4",
              cursor: v.attiva ? "pointer" : "default",
            }}
          >
            {v.etichetta}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
        <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Control center · {fmtDataLunga(dataOggiStr())}
        </div>
        <div style={{ ...fontDisplay, fontSize: isMobile ? 26 : 32, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Buongiorno, GianLuca.</div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 24 }}>Ecco come sta andando Elitederma oggi.</div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
            {[{ v: "30giorni", l: "30 giorni" }, { v: "trimestre", l: "Trimestre" }, { v: "anno", l: "Anno" }].map((p) => (
              <button key={p.v} onClick={() => setPeriodo(p.v)} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 16, border: "none", background: periodo === p.v ? "#fff" : "transparent", color: NAVY, cursor: "pointer" }}>
                {p.l}
              </button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuNuovaOperazione((v) => !v)}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: 20, border: "none", background: NAVY, color: "#fff", cursor: "pointer" }}
            >
              + Nuova operazione
            </button>
            {menuNuovaOperazione && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, boxShadow: "0 12px 28px -12px rgba(14,27,51,0.3)", overflow: "hidden", minWidth: 160 }}>
                <button
                  onClick={() => { setMenuNuovaOperazione(false); onApriNuovaSpesa(); }}
                  style={{ ...fontBody, display: "block", width: "100%", textAlign: "left", fontSize: 13.5, fontWeight: 600, padding: "12px 16px", border: "none", background: "transparent", color: NAVY, cursor: "pointer" }}
                >
                  Uscita
                </button>
                <button
                  onClick={() => { setMenuNuovaOperazione(false); setModaleEntrataAperta(true); }}
                  style={{ ...fontBody, display: "block", width: "100%", textAlign: "left", fontSize: 13.5, fontWeight: 600, padding: "12px 16px", border: "none", borderTop: `1px solid ${CREAM_BORDER}`, background: "transparent", color: NAVY, cursor: "pointer" }}
                >
                  Entrata
                </button>
              </div>
            )}
          </div>
        </div>

        {modaleEntrataAperta && (
          <ModaleNuovaEntrata location={location} onClose={() => setModaleEntrataAperta(false)} onSalvato={() => { setModaleEntrataAperta(false); ricarica(); }} />
        )}

        {confrontoAnnualeAperto && (
          <PannelloConfrontoAnnuale
            corsiDate={corsiDate} iscritti={iscritti} spese={spese} costiCategorieById={costiCategorieById} entrateManuali={entrateManuali}
            sedeSel={sedeSel} corsoById={corsoById} locById={locById}
            onClose={() => setConfrontoAnnualeAperto(false)}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, marginRight: 4, whiteSpace: "nowrap" }}>Analisi sede</div>
          <button onClick={() => setSedeSel("")} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 16, border: sedeSel === "" ? "none" : `1px solid ${CREAM_BORDER}`, background: sedeSel === "" ? NAVY : "#fff", color: sedeSel === "" ? "#fff" : NAVY, cursor: "pointer" }}>
            Tutte le sedi
          </button>
          {location.map((l) => (
            <button key={l.id} onClick={() => setSedeSel(l.id)} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 16, border: sedeSel === l.id ? "none" : `1px solid ${CREAM_BORDER}`, background: sedeSel === l.id ? NAVY : "#fff", color: sedeSel === l.id ? "#fff" : NAVY, cursor: "pointer" }}>
              {l.nome}
            </button>
          ))}
          <button disabled title="Non ancora disponibile" style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: "#C7C9D4", cursor: "not-allowed", marginLeft: "auto" }}>
            Confronta sedi
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
          <CardKpiErp titolo="Ricavi totali" valore={fmtEuroKErp(kpi.ricavi)} variazione={varRicavi} sub="vs stesso periodo precedente" Icona={IconaBanconota} coloreIcona="#2E7D32" coloreBgIcona="#E3F3E5" />
          <CardKpiErp titolo="Costi operativi" valore={fmtEuroKErp(kpi.costi)} variazione={varCosti} variazioneInvertita sub={kpi.ricavi > 0 ? `${round1Erp((kpi.costi / kpi.ricavi) * 100)}% dei ricavi` : "—"} Icona={IconaRicevutaErp} coloreIcona="#C0392B" coloreBgIcona="#FBE4E1" onClick={onApriCostiOperativi} />
          <CardKpiErp titolo="Utile netto" valore={fmtEuroKErp(kpi.utile)} variazione={varUtile} sub={`Margine netto ${marginePct.toFixed(1).replace(".", ",")}%`} Icona={IconaBustaErp} coloreIcona="#fff" coloreBgIcona="rgba(255,255,255,0.15)" scuro />
          <CardKpiErp titolo="Allievi iscritti" valore={String(kpi.nAllievi)} variazione={varAllievi} sub={`Riempimento medio classi ${kpi.riempimentoMedio.toFixed(0)}%`} Icona={IconaLaureaErp} coloreIcona="#2563EB" coloreBgIcona="#E1EAF9" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,2fr) minmax(0,1fr)", gap: 14, marginBottom: 18, alignItems: "start" }}>
          <div
            onClick={() => setConfrontoAnnualeAperto(true)}
            title="Clicca per confrontare i mesi anno su anno"
            style={{ ...cardStyle, padding: 20, cursor: "pointer" }}
          >
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Andamento economico</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>Ricavi e costi</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, ...fontBody, fontSize: 12, color: MUTED }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: NAVY, display: "inline-block" }} />Ricavi</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GOLD, display: "inline-block" }} />Costi</span>
                <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: GOLD }}>Confronta anni →</span>
              </div>
            </div>
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 4 }}>Risultato del periodo</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <div style={{ ...fontDisplay, fontSize: 24, fontWeight: 700, color: NAVY }}>{fmtEuroErp(kpi.utile)}</div>
              {varUtile != null && (
                <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: varUtile >= 0 ? "#2E7D32" : "#C0392B" }}>
                  {varUtile >= 0 ? "↗" : "↘"} {fmtPctErp(varUtile)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 5 : 18, height: 160, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 10, overflowX: "auto" }}>
              {andamentoMensile.map((m, idx) => (
                <div key={`${m.etichetta}-${idx}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 4 : 6, minWidth: isMobile ? 15 : 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 2 : 3, height: 130 }}>
                    <div title={`Ricavi: ${fmtEuroErp(m.ricavi)}`} style={{ width: isMobile ? 6 : 12, height: `${Math.max(2, (m.ricavi / maxBarra) * 130)}px`, background: NAVY, borderRadius: 3 }} />
                    <div title={`Costi: ${fmtEuroErp(m.costi)}`} style={{ width: isMobile ? 6 : 12, height: `${Math.max(2, (m.costi / maxBarra) * 130)}px`, background: GOLD, borderRadius: 3 }} />
                  </div>
                  <div style={{ ...fontBody, fontSize: isMobile ? 9 : 10.5, color: MUTED }}>{m.etichetta}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Business pulse</div>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 18 }}>Salute aziendale</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <GaugeMargineErp percentuale={marginePct} />
              <div>
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: NAVY, background: BG, borderRadius: 6, padding: "2px 8px", display: "inline-block", marginBottom: 6 }}>{giudizioMargine.toUpperCase()}</div>
                <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>
                  {marginePct >= 15 ? "Redditività solida" : marginePct >= 0 ? "Redditività da consolidare" : "Redditività in calo"}
                </div>
                {varUtile != null && (
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {varUtile >= 0 ? "+" : ""}{varUtile.toFixed(1).replace(".", ",")} punti rispetto al periodo precedente
                  </div>
                )}
              </div>
            </div>
            <RigaBusinessPulseErp Icona={IconaScatolaErp} titolo="Cash flow" sub="Incassato netto del periodo" valore={fmtEuroErp(kpi.cashFlow)} />
            <RigaBusinessPulseErp Icona={IconaClipboardErp} titolo="Crediti da incassare" sub={`${kpi.pagamentiAperti} pagamenti aperti`} valore={fmtEuroErp(kpi.creditiDaIncassare)} />
            <RigaBusinessPulseErp Icona={IconaDataAccento} coloreIconaProp={GOLD} titolo="Corsi confermati" sub="Prossimi 60 giorni" valore={String(corsiConfermatiProssimi)} ultima />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.4fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8 }}>Performance</div>
              <button disabled title="Non ancora disponibile" style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#C7C9D4", background: "transparent", border: "none", cursor: "not-allowed" }}>Report completo →</button>
            </div>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Andamento per sede</div>
            {isMobile ? (
              <div>
                {righeSedi.map((r) => (
                  <div key={r.location.id} style={{ padding: "12px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 7, background: BG, ...fontBody, fontSize: 10, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {r.location.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.location.nome}</span>
                      </div>
                      {r.trend != null ? (
                        <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: r.trend >= 0 ? "#2E7D32" : "#C0392B", flexShrink: 0 }}>{r.trend >= 0 ? "↗" : "↘"} {fmtPctErp(r.trend)}</span>
                      ) : <span style={{ ...fontBody, fontSize: 11, color: MUTED, flexShrink: 0 }}>—</span>}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginBottom: 8, ...fontBody, fontSize: 11.5 }}>
                      <div><span style={{ color: MUTED }}>Ricavi </span><span style={{ color: NAVY, fontWeight: 700 }}>{fmtEuroErp(r.ricavi)}</span></div>
                      <div><span style={{ color: MUTED }}>Utile </span><span style={{ color: NAVY, fontWeight: 700 }}>{fmtEuroErp(r.utile)}</span></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: BG, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, r.riempimentoMedio)}%`, height: "100%", background: GOLD }} />
                      </div>
                      <span style={{ ...fontBody, fontSize: 11, color: NAVY, flexShrink: 0 }}>{r.riempimentoMedio.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
                {righeSedi.length === 0 && (
                  <div style={{ padding: "16px 0", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessuna data in questo periodo.</div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Sede", "Ricavi", "Utile", "Riempimento", "Trend"].map((th) => (
                        <th key={th} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>{th}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {righeSedi.map((r) => (
                      <tr key={r.location.id}>
                        <td style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 8, background: BG, ...fontBody, fontSize: 10.5, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {r.location.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>{r.location.nome}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(r.ricavi)}</td>
                        <td style={{ padding: "10px 8px", ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(r.utile)}</td>
                        <td style={{ padding: "10px 8px", minWidth: 100 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: BG, borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                              <div style={{ width: `${Math.min(100, r.riempimentoMedio)}%`, height: "100%", background: GOLD }} />
                            </div>
                            <span style={{ ...fontBody, fontSize: 12, color: NAVY, whiteSpace: "nowrap" }}>{r.riempimentoMedio.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                          {r.trend != null ? (
                            <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: r.trend >= 0 ? "#2E7D32" : "#C0392B" }}>{r.trend >= 0 ? "↗" : "↘"} {fmtPctErp(r.trend)}</span>
                          ) : <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    {righeSedi.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "16px 8px", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessuna data in questo periodo.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8 }}>Da controllare</div>
              {classiSottoSoglia > 0 && (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#C0392B", color: "#fff", ...fontBody, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{classiSottoSoglia}</div>
              )}
            </div>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Richiede attenzione</div>
            {classiSottoSoglia > 0 ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>{classiSottoSoglia} {classiSottoSoglia === 1 ? "classe" : "classi"} sotto il {SOGLIA_RIEMPIMENTO_BASSO_ERP}%</div>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Riempimento nel periodo selezionato</div>
                </div>
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED }}>CRM</div>
              </div>
            ) : (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "10px 0" }}>Nessuna criticità rilevata nel periodo selezionato.</div>
            )}
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 14, lineHeight: 1.5 }}>
              Le fatture in scadenza non sono ancora tracciate nel gestionale: comparirà qui non appena questa sezione sarà collegata a dati reali. Le scorte di magazzino sono già tracciate — vedi "Magazzino" nel menu qui sopra.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Vendite shop (WooCommerce) ----------
// stati ordine standard di WooCommerce, con etichetta/colore coerenti
// col resto del gestionale (verde = incassato, giallo = in corso, rosso
// = annullato/rimborsato)
const STATI_VENDITA_SHOP = {
  completed: { etichetta: "Completato", colore: "#2E7D32", sfondo: "#E3F3E5" },
  processing: { etichetta: "In lavorazione", colore: "#B8860B", sfondo: "#FBF1D9" },
  "on-hold": { etichetta: "In sospeso", colore: "#B8860B", sfondo: "#FBF1D9" },
  pending: { etichetta: "In attesa di pagamento", colore: "#8B8FA3", sfondo: "#EFEFEF" },
  cancelled: { etichetta: "Annullato", colore: "#C0392B", sfondo: "#FBE4E1" },
  refunded: { etichetta: "Rimborsato", colore: "#C0392B", sfondo: "#FBE4E1" },
  failed: { etichetta: "Fallito", colore: "#C0392B", sfondo: "#FBE4E1" },
};
function etichettaStatoVenditaShop(stato) {
  return STATI_VENDITA_SHOP[stato]?.etichetta || stato || "—";
}

function PaginaVenditeShop({ venditeShop, onBack }) {
  const isMobile = useIsMobile();
  const [periodo, setPeriodo] = useState("tutto");
  const [statoSel, setStatoSel] = useState("");

  // "tutto" non esiste in rangePeriodoErp (pensato per l'ERP, senza
  // storico pluriennale): qui serve perché l'import storico può
  // risalire ad anni fa, e di default si vuole vedere l'intera storia
  const range = periodo === "tutto" ? { inizio: "0000-01-01", fine: "9999-12-31" } : rangePeriodoErp(periodo);
  const statiPresenti = [...new Set((venditeShop || []).map((v) => v.stato).filter(Boolean))].sort();

  const venditeFiltrate = (venditeShop || []).filter((v) => {
    const data = v.data_ordine ? v.data_ordine.slice(0, 10) : null;
    if (data && (data < range.inizio || data > range.fine)) return false;
    if (statoSel && v.stato !== statoSel) return false;
    return true;
  });

  const kpi = {
    nOrdini: venditeFiltrate.length,
    totale: round2(venditeFiltrate.reduce((s, v) => s + (v.totale || 0), 0)),
    imponibile: round2(venditeFiltrate.reduce((s, v) => s + (v.totale_imponibile ?? v.totale ?? 0), 0)),
    iva: round2(venditeFiltrate.reduce((s, v) => s + (v.totale_iva || 0), 0)),
  };

  // "prodotti più venduti": aggrega le righe-prodotto di tutti gli
  // ordini filtrati (stesso periodo/stato della tabella sopra). Se lo
  // stato è "Tutti" include anche ordini annullati/rimborsati/falliti —
  // per un'analisi realistica delle vendite conviene filtrare per
  // "Completato" nella tendina qui sopra
  const [ordinePer, setOrdinePer] = useState("quantita");
  const prodottiAggregati = (() => {
    const mappa = {};
    venditeFiltrate.forEach((v) => {
      (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((p) => {
        const nome = (p.nome || "").trim() || "—";
        if (!mappa[nome]) mappa[nome] = { nome, quantita: 0, ricavo: 0, ordini: new Set() };
        mappa[nome].quantita += Number(p.quantita) || 0;
        mappa[nome].ricavo += Number(p.totale_riga) || 0;
        mappa[nome].ordini.add(v.id);
      });
    });
    return Object.values(mappa)
      .map((p) => ({ nome: p.nome, quantita: p.quantita, ricavo: round2(p.ricavo), nOrdini: p.ordini.size, prezzoMedio: p.quantita > 0 ? round2(p.ricavo / p.quantita) : 0 }))
      .sort((a, b) => (ordinePer === "quantita" ? b.quantita - a.quantita : b.ricavo - a.ricavo));
  })();

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Vendite shop</div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 20 }}>Ordini importati automaticamente dallo shop WooCommerce.</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
            {[{ v: "30giorni", l: "30 giorni" }, { v: "trimestre", l: "Trimestre" }, { v: "anno", l: "Anno" }, { v: "tutto", l: "Tutto" }].map((p) => (
              <button key={p.v} onClick={() => setPeriodo(p.v)} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 16, border: "none", background: periodo === p.v ? "#fff" : "transparent", color: NAVY, cursor: "pointer" }}>
                {p.l}
              </button>
            ))}
          </div>
          <select style={{ ...inputStyle, width: "auto", minWidth: 160 }} value={statoSel} onChange={(e) => setStatoSel(e.target.value)}>
            <option value="">Tutti gli stati</option>
            {statiPresenti.map((s) => <option key={s} value={s}>{etichettaStatoVenditaShop(s)}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Ordini</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{kpi.nOrdini}</div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Totale incassato</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{fmtEuroErp(kpi.totale)}</div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Imponibile</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{fmtEuroErp(kpi.imponibile)}</div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>IVA</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{fmtEuroErp(kpi.iva)}</div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {["Ordine", "Data", "Cliente", "Stato", "Imponibile", "IVA", "Totale"].map((th) => (
                    <th key={th} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venditeFiltrate
                  .slice()
                  .sort((a, b) => (b.data_ordine || "").localeCompare(a.data_ordine || ""))
                  .map((v) => {
                    const st = STATI_VENDITA_SHOP[v.stato];
                    return (
                      <tr key={v.id}>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>#{v.numero_ordine || v.woo_order_id}</td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{v.data_ordine ? fmtData(v.data_ordine.slice(0, 10)) : "—"}</td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY }}>{v.cliente_nome || v.cliente_email || "—"}</td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: st?.colore || MUTED, background: st?.sfondo || "#EFEFEF", borderRadius: 8, padding: "3px 9px", whiteSpace: "nowrap" }}>{etichettaStatoVenditaShop(v.stato)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{v.totale_imponibile != null ? fmtEuroErp(v.totale_imponibile) : "—"}</td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{v.totale_iva != null ? fmtEuroErp(v.totale_iva) : "—"}</td>
                        <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(v.totale)}</td>
                      </tr>
                    );
                  })}
                {venditeFiltrate.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "20px 14px", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessuna vendita nel periodo selezionato.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 28, marginBottom: 4 }}>
          <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>Prodotti più venduti</div>
          <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
            {[{ v: "quantita", l: "Per quantità" }, { v: "ricavo", l: "Per ricavo" }].map((o) => (
              <button key={o.v} onClick={() => setOrdinePer(o.v)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 16, border: "none", background: ordinePer === o.v ? "#fff" : "transparent", color: NAVY, cursor: "pointer" }}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 14 }}>
          Stesso periodo/stato filtrati sopra — con "Tutti gli stati" include anche annullati/rimborsati/falliti; per la vendita reale filtra su "Completato".
        </div>
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  {["Prodotto", "Quantità", "N. ordini", "Ricavo", "Prezzo medio"].map((th) => (
                    <th key={th} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prodottiAggregati.slice(0, 20).map((p, i) => (
                  <tr key={p.nome}>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>
                      {i === 0 && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: GOLD, marginRight: 8 }} />}
                      {p.nome}
                    </td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{p.quantita}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>{p.nOrdini}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(p.ricavo)}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>{fmtEuroErp(p.prezzoMedio)}</td>
                  </tr>
                ))}
                {prodottiAggregati.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "20px 14px", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessun prodotto nel periodo selezionato.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {prodottiAggregati.length > 20 && (
            <div style={{ padding: "10px 14px", ...fontBody, fontSize: 12, color: MUTED, borderTop: `1px solid ${CREAM_BORDER}` }}>
              Mostrati i primi 20 di {prodottiAggregati.length} prodotti diversi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Magazzino (catalogo prodotti WooCommerce) ----------
// pannello di modifica di un prodotto: prezzo di vendita e giacenza
// vengono sincronizzati davvero su WooCommerce (Edge Function
// woo-aggiorna-prodotto, scrive prima sullo shop e solo se riesce
// aggiorna il locale); costo di acquisto e scorta minima sono dati
// che WooCommerce non conosce, salvati direttamente sul database
// dell'app, sempre, indipendentemente dall'esito della sincronizzazione
function PannelloModificaProdotto({ prodotto, onClose, onFatto }) {
  const [prezzoVendita, setPrezzoVendita] = useState(prodotto.prezzo_vendita != null ? String(prodotto.prezzo_vendita) : "");
  const [giacenza, setGiacenza] = useState(prodotto.giacenza != null ? String(prodotto.giacenza) : "");
  const [costoAcquisto, setCostoAcquisto] = useState(prodotto.costo_acquisto != null ? String(prodotto.costo_acquisto) : "");
  const [scortaMinima, setScortaMinima] = useState(prodotto.scorta_minima != null ? String(prodotto.scorta_minima) : "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  async function salvaESincronizza() {
    setSalvando(true);
    setMsg("");

    const { error: erroreLocale } = await supabase.from("prodotti_shop").update({
      costo_acquisto: costoAcquisto === "" ? null : parseNum(costoAcquisto),
      scorta_minima: scortaMinima === "" ? null : parseInt(parseNum(scortaMinima), 10),
    }).eq("id", prodotto.id);
    if (erroreLocale) { setSalvando(false); setMsg("Errore salvataggio: " + erroreLocale.message); return; }

    const nuovoPrezzo = prezzoVendita === "" ? null : parseNum(prezzoVendita);
    const nuovaGiacenza = giacenza === "" ? null : parseInt(parseNum(giacenza), 10);
    const prezzoCambiato = nuovoPrezzo != null && nuovoPrezzo !== prodotto.prezzo_vendita;
    const giacenzaCambiata = nuovaGiacenza != null && nuovaGiacenza !== prodotto.giacenza;

    if (prezzoCambiato || giacenzaCambiata) {
      const { data, error } = await supabase.functions.invoke("woo-aggiorna-prodotto", {
        body: {
          prodottoId: prodotto.id,
          ...(prezzoCambiato ? { prezzoVendita: nuovoPrezzo } : {}),
          ...(giacenzaCambiata ? { giacenza: nuovaGiacenza } : {}),
        },
      });
      setSalvando(false);
      if (error || data?.errore) {
        setMsg("Costo/scorta minima salvati. Prezzo/giacenza NON sincronizzati con WooCommerce: " + (data?.errore || error.message));
        return;
      }
    } else {
      setSalvando(false);
    }
    onFatto();
  }

  return (
    <Modal title={`Modifica prodotto — ${prodotto.nome}`} onClose={onClose}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Prezzo vendita (sincronizzato su WooCommerce)">
            <input style={inputStyle} inputMode="decimal" value={prezzoVendita} onChange={(e) => setPrezzoVendita(e.target.value)} autoFocus />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Giacenza (sincronizzata su WooCommerce)">
            <input style={inputStyle} inputMode="numeric" value={giacenza} onChange={(e) => setGiacenza(e.target.value)} />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Costo di acquisto (solo interno)">
            <input style={inputStyle} inputMode="decimal" value={costoAcquisto} onChange={(e) => setCostoAcquisto(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Scorta minima — alert (solo interno)">
            <input style={inputStyle} inputMode="numeric" value={scortaMinima} onChange={(e) => setScortaMinima(e.target.value)} />
          </Field>
        </div>
      </div>
      {msg && <div style={{ ...fontBody, fontSize: 12, color: "#C0392B", marginBottom: 10 }}>{msg}</div>}
      <Button onClick={salvaESincronizza} disabled={salvando} style={{ width: "100%" }}>{salvando ? "Salvo e sincronizzo…" : "Salva e sincronizza"}</Button>
    </Modal>
  );
}

// colonne ordinabili della tabella dettaglio, e direzione di default al
// primo click su ciascuna (stile Windows Explorer): testo parte
// crescente A→Z, numeri partono decrescente (più alto in cima)
const COLONNE_MAGAZZINO = [
  { label: "Prodotto", campo: "nome", direzioneIniziale: "asc" },
  { label: "Categoria", campo: "nomeCategorie", direzioneIniziale: "asc" },
  { label: "Giacenza", campo: "giacenza", direzioneIniziale: "desc" },
  { label: "Scorta min.", campo: "scorta_minima", direzioneIniziale: "desc" },
  { label: "Stato", campo: "esaurito", direzioneIniziale: "desc" },
  { label: "Prezzo vendita", campo: "prezzo_vendita", direzioneIniziale: "desc" },
  { label: "Costo acquisto", campo: "costo_acquisto", direzioneIniziale: "desc" },
  { label: "Margine %", campo: "margine", direzioneIniziale: "desc" },
  { label: "Venduto", campo: "quantitaVenduta", direzioneIniziale: "desc" },
  { label: "Fatturato", campo: "fatturato", direzioneIniziale: "desc" },
];

function fmtDataIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// range di date per ciascun periodo:
// - annuale: anno solare Gen→Dic dell'anno scelto
// - semestrale/trimestrale: intero ANNO SCOLASTICO Set→Ago (stessa
//   convenzione già usata per il confronto "Ricavi e costi" nell'ERP),
//   così si vedono tutti i trimestri/semestri affiancati, non uno solo
// - mensile: mese scelto (anno+mese) dell'anno solare, spezzato in giorni
// - settimanale: "zoom" sulla settimana IN CORSO, spezzato in giorni
function rangeMagazzino(periodo, anno, meseSel) {
  const oggi = new Date();
  if (periodo === "annuale") return { inizio: `${anno}-01-01`, fine: `${anno}-12-31` };
  if (periodo === "semestrale" || periodo === "trimestrale") {
    return { inizio: `${anno}-09-01`, fine: fmtDataIso(new Date(anno + 1, 7, 31)) };
  }
  if (periodo === "mensile") {
    return { inizio: fmtDataIso(new Date(anno, meseSel, 1)), fine: fmtDataIso(new Date(anno, meseSel + 1, 0)) };
  }
  // settimanale: lunedì-domenica della settimana corrente
  const giornoSett = oggi.getDay();
  const offsetLunedi = giornoSett === 0 ? -6 : 1 - giornoSett;
  const lunedi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + offsetLunedi);
  const domenica = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + 6);
  return { inizio: fmtDataIso(lunedi), fine: fmtDataIso(domenica) };
}
// range "precedente" per il confronto. Per "mensile" l'utente sceglie
// (stesso selettore "periodo prec./anno prec." già usato per Annuale):
// "periodo precedente" → il mese solare subito prima, "anno precedente"
// → GLI STESSI GIORNI dello stesso mese un anno prima (utile per capire
// se un'offerta ricorrente ha funzionato come l'anno scorso). Per
// trimestrale/semestrale/settimanale non c'è scelta perché le due
// opzioni coinciderebbero (l'intero range dura già ~1 anno/settimana):
// resta l'anno scolastico precedente / la settimana precedente
function rangePrecedenteMagazzino(periodo, range, anno, confrontoTipo) {
  if (periodo === "mensile") {
    const [a, m] = range.inizio.split("-").map(Number);
    if (confrontoTipo === "annoprecedente") {
      return { inizio: `${a - 1}-${String(m).padStart(2, "0")}-01`, fine: fmtDataIso(new Date(a - 1, m, 0)) };
    }
    const meseIni = new Date(a, m - 2, 1);
    return { inizio: fmtDataIso(meseIni), fine: fmtDataIso(new Date(meseIni.getFullYear(), meseIni.getMonth() + 1, 0)) };
  }
  if (periodo === "settimanale") return rangeConfrontoAnalisiCosti(range, "periodoprecedente");
  if (periodo === "semestrale" || periodo === "trimestrale") {
    return { inizio: `${anno - 1}-09-01`, fine: fmtDataIso(new Date(anno, 7, 31)) };
  }
  return rangeConfrontoAnalisiCosti(range, confrontoTipo);
}
const GIORNI_SETTIMANA_ABBR = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]; // getDay(): 0=Domenica
// 7 bucket giornalieri Lun→Dom con i nomi dei giorni (non i numeri del mese)
function bucketsGiorniSettimana(range) {
  const [aI, mI, gI] = range.inizio.split("-").map(Number);
  const buckets = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(aI, mI - 1, gI + i);
    const iso = fmtDataIso(d);
    buckets.push({ etichetta: GIORNI_SETTIMANA_ABBR[d.getDay()], da: iso, a: iso });
  }
  return buckets;
}
// 4 trimestri o 2 semestri dell'anno SCOLASTICO che parte a settembre
// dell'anno indicato (es. anno=2025 → Set 2025 → Ago 2026)
function bucketsAnnoScolasticoGruppi(anno, nGruppi) {
  const mesiPerGruppo = 12 / nGruppi;
  const buckets = [];
  for (let g = 0; g < nGruppi; g++) {
    const meseIniAssoluto = 8 + g * mesiPerGruppo; // 8 = settembre (indice 0-based)
    const dIni = new Date(anno + Math.floor(meseIniAssoluto / 12), meseIniAssoluto % 12, 1);
    const meseFineAssoluto = meseIniAssoluto + mesiPerGruppo - 1;
    const dFine = new Date(anno + Math.floor(meseFineAssoluto / 12), (meseFineAssoluto % 12) + 1, 0);
    const etichetta = mesiPerGruppo === 1 ? MESI_ABBR[dIni.getMonth()] : `${MESI_ABBR[dIni.getMonth()]}-${MESI_ABBR[dFine.getMonth()]}`;
    buckets.push({ etichetta, da: fmtDataIso(dIni), a: fmtDataIso(dFine) });
  }
  return buckets;
}

// grafico a barre affiancate (periodo selezionato vs periodo di
// confronto) per bucket — usato per "Andamento" quantità/fatturato
function GraficoBarreVendite({ punti }) {
  if (!punti.length) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun dato nel periodo.</div>;
  const larghezza = 640, altezza = 220, padSx = 46, padDx = 12, padAlto = 14, padBasso = 30;
  const massimo = Math.max(1, ...punti.flatMap((p) => [p.selezionato || 0, p.precedente || 0]));
  const n = punti.length;
  const stepX = (larghezza - padSx - padDx) / n;
  const yBar = (v) => altezza - padBasso - (v / massimo) * (altezza - padAlto - padBasso);
  const saltoEtichette = n <= 12 ? 1 : Math.ceil(n / 10);
  return (
    <svg width="100%" height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const y = padAlto + (i / 4) * (altezza - padAlto - padBasso);
        const valore = Math.round(massimo * (1 - i / 4));
        return (
          <g key={i}>
            <line x1={padSx} y1={y} x2={larghezza - padDx} y2={y} stroke={CREAM_BORDER} strokeWidth="1" />
            <text x={0} y={y + 4} fontSize="10" fill={MUTED} fontFamily="'Roboto',sans-serif">{valore >= 1000 ? `${Math.round(valore / 1000)}k` : valore}</text>
          </g>
        );
      })}
      {punti.map((p, i) => {
        const xCentro = padSx + stepX * i + stepX / 2;
        const largBarra = Math.min(16, stepX * 0.32);
        return (
          <g key={i}>
            <rect x={xCentro - largBarra - 2} y={yBar(p.selezionato || 0)} width={largBarra} height={Math.max(1, altezza - padBasso - yBar(p.selezionato || 0))} fill={NAVY} rx="2" />
            {p.precedente != null && <rect x={xCentro + 2} y={yBar(p.precedente)} width={largBarra} height={Math.max(1, altezza - padBasso - yBar(p.precedente))} fill={GOLD} rx="2" />}
            {i % saltoEtichette === 0 && <text x={xCentro} y={altezza - 8} fontSize="10" fill={MUTED} textAnchor="middle" fontFamily="'Roboto',sans-serif">{p.etichetta}</text>}
          </g>
        );
      })}
    </svg>
  );
}
// linea semplice (una sola serie) — usata per "Carrello medio nel tempo"
function GraficoLineaSemplice({ punti }) {
  if (!punti.length) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun dato nel periodo.</div>;
  const larghezza = 560, altezza = 160, padSx = 46, padDx = 12, padAlto = 14, padBasso = 26;
  const valori = punti.map((p) => p.valore).filter((v) => v != null);
  const massimo = Math.max(1, ...valori);
  const scalaX = (i) => padSx + (i / Math.max(1, punti.length - 1)) * (larghezza - padSx - padDx);
  const scalaY = (v) => padAlto + (1 - v / massimo) * (altezza - padAlto - padBasso);
  const pts = punti.map((p, i) => [scalaX(i), p.valore != null ? scalaY(p.valore) : null]).filter(([, y]) => y != null);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const saltoEtichette = punti.length <= 12 ? 1 : Math.ceil(punti.length / 8);
  return (
    <svg width="100%" height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {Array.from({ length: 4 }).map((_, i) => {
        const y = padAlto + (i / 3) * (altezza - padAlto - padBasso);
        const valore = Math.round(massimo * (1 - i / 3));
        return (
          <g key={i}>
            <line x1={padSx} y1={y} x2={larghezza - padDx} y2={y} stroke={CREAM_BORDER} strokeWidth="1" />
            <text x={0} y={y + 4} fontSize="10" fill={MUTED} fontFamily="'Roboto',sans-serif">{valore} €</text>
          </g>
        );
      })}
      {pts.length > 1 && <path d={path} fill="none" stroke={NAVY} strokeWidth="2.5" />}
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill={GOLD} />)}
      {punti.map((p, i) => (i % saltoEtichette === 0 ? <text key={i} x={scalaX(i)} y={altezza - 6} fontSize="10" fill={MUTED} textAnchor="middle" fontFamily="'Roboto',sans-serif">{p.etichetta}</text> : null))}
    </svg>
  );
}
// una barra per categoria/prodotto, con la % di trend scritta sopra e il
// nome sotto — usata da "Trend per categoria/prodotto"
function GraficoTrendBarre({ voci }) {
  if (!voci.length) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun dato nel periodo.</div>;
  const larghezza = 560, altezza = 200, padSx = 8, padDx = 8, padAlto = 30, padBasso = 30;
  const massimo = Math.max(1, ...voci.map((v) => v.valore));
  const n = voci.length;
  const stepX = (larghezza - padSx - padDx) / n;
  const xCentro = (i) => padSx + stepX * i + stepX / 2;
  const yBar = (v) => altezza - padBasso - (v / massimo) * (altezza - padAlto - padBasso);
  return (
    <svg width="100%" height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {voci.map((v, i) => (
        <rect key={v.nome} x={xCentro(i) - stepX * 0.3} y={yBar(v.valore)} width={stepX * 0.6} height={Math.max(1, altezza - padBasso - yBar(v.valore))} fill={NAVY} rx="3" />
      ))}
      {voci.map((v, i) => (
        <text key={`t${v.nome}`} x={xCentro(i)} y={yBar(v.valore) - 8} fontSize="11" fontWeight="700" fill={v.trend == null ? MUTED : v.trend >= 0 ? "#2E7D32" : "#C0392B"} textAnchor="middle" fontFamily="'Roboto',sans-serif">
          {v.trend == null ? "N/D" : `${v.trend >= 0 ? "+" : ""}${v.trend}%`}
        </text>
      ))}
      {voci.map((v, i) => (
        <text key={`n${v.nome}`} x={xCentro(i)} y={altezza - padBasso + 16} fontSize="9.5" fill={MUTED} textAnchor="middle" fontFamily="'Roboto',sans-serif">
          {v.nome.length > 12 ? `${v.nome.slice(0, 11)}…` : v.nome}
        </text>
      ))}
    </svg>
  );
}

function PaginaMagazzino({ categorieProdotti, prodottiShop, prodottiCategorie, venditeShop, ricarica, onBack, onApriGestioneShop }) {
  const isMobile = useIsMobile();
  const oggi = new Date();
  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
  const [periodo, setPeriodo] = useState("annuale");
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [meseSel, setMeseSel] = useState(oggi.getMonth());
  const [confrontoTipo, setConfrontoTipo] = useState("periodoprecedente");
  const [vistaAnalisi, setVistaAnalisi] = useState("quantita");
  const [categoriaSel, setCategoriaSel] = useState("");
  const [vistaTrend, setVistaTrend] = useState("categoria");
  const [ricercaProdotto, setRicercaProdotto] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("tutti");
  const [ordinamento, setOrdinamento] = useState({ campo: "quantitaVenduta", direzione: "desc" });
  const [prodottoModifica, setProdottoModifica] = useState(null);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [msgSync, setMsgSync] = useState("");

  function ordinaPer(campo) {
    setOrdinamento((prev) => (prev.campo === campo ? { campo, direzione: prev.direzione === "asc" ? "desc" : "asc" } : { campo, direzione: COLONNE_MAGAZZINO.find((c) => c.campo === campo)?.direzioneIniziale || "desc" }));
  }

  // cambiando periodo, l'anno selezionato deve restare sensato: "Annuale"
  // vuole l'anno solare corrente, "Trimestrale/Semestrale" l'anno
  // scolastico in corso (che può essere l'anno solare precedente, es. ad
  // agosto siamo ancora nell'anno scolastico iniziato a settembre scorso)
  function selezionaPeriodo(nuovoPeriodo) {
    setPeriodo(nuovoPeriodo);
    if (nuovoPeriodo === "annuale") setAnno(oggi.getFullYear());
    else if (nuovoPeriodo === "trimestrale" || nuovoPeriodo === "semestrale") setAnno(annoScolasticoDi(oggiStr));
    else if (nuovoPeriodo === "mensile") { setAnno(oggi.getFullYear()); setMeseSel(oggi.getMonth()); }
  }

  async function sincronizzaCatalogo() {
    setSincronizzando(true);
    setMsgSync("");
    const { data, error } = await supabase.functions.invoke("woo-sync-catalogo");
    setSincronizzando(false);
    if (error || data?.errore) { setMsgSync("Errore: " + (data?.errore || error.message)); return; }
    setMsgSync(`Sincronizzato: ${data.categorieImportate} categorie, ${data.prodottiImportati} prodotti (${data.prodottiDisattivati} disattivati).`);
    ricarica();
  }

  const range = rangeMagazzino(periodo, anno, meseSel);
  const rangePrecedente = rangePrecedenteMagazzino(periodo, range, anno, confrontoTipo);
  const anniDisponibili = [...new Set([oggi.getFullYear(), ...(venditeShop || []).map((v) => (v.data_ordine ? parseInt(v.data_ordine.slice(0, 4), 10) : null)).filter(Boolean)])].sort((a, b) => b - a);
  // etichette CONCRETE (non generiche "periodo precedente") di quale
  // periodo esatto sta nella barra/riga "selezionato" e quale in quella
  // "precedente": tolgono l'ambiguità su "rispetto a cosa" è calcolata
  // ogni % — usate sia nel sottotitolo che nella legenda dei grafici
  const etichettaPeriodoSelezionato = periodo === "annuale" ? `${anno}`
    : periodo === "mensile" ? `${MESI[meseSel]} ${anno}`
    : periodo === "settimanale" ? "questa settimana"
    : `${anno}/${String((anno + 1) % 100).padStart(2, "0")}`;
  const [annoMesePrecedente, numMesePrecedente] = rangePrecedente.inizio.split("-").map(Number);
  const etichettaPeriodoPrecedente = periodo === "annuale" ? `${anno - 1}`
    : periodo === "mensile" ? `${MESI[numMesePrecedente - 1]} ${annoMesePrecedente}`
    : periodo === "settimanale" ? "settimana precedente"
    : `${anno - 1}/${String(anno % 100).padStart(2, "0")}`;
  const etichettaConfronto = `vs ${etichettaPeriodoPrecedente}`;

  const categoriaNomeById = Object.fromEntries((categorieProdotti || []).map((c) => [c.id, c.nome]));
  const categorieOrdinate = [...(categorieProdotti || [])].sort((a, b) => a.nome.localeCompare(b.nome));
  const categorieIdPerProdottoId = {};
  (prodottiCategorie || []).forEach((pc) => { (categorieIdPerProdottoId[pc.prodotto_id] ||= []).push(pc.categoria_id); });
  const categorieIdPerNomeProdotto = {};
  (prodottiShop || []).forEach((p) => { categorieIdPerNomeProdotto[(p.nome || "").trim().toLowerCase()] = categorieIdPerProdottoId[p.id] || []; });

  // il collegamento vendita<->prodotto è per nome: vendite_shop non ha
  // un riferimento diretto al prodotto, solo la descrizione della riga
  function aggregaVenditePerNome(inizio, fine) {
    const mappa = {};
    (venditeShop || []).forEach((v) => {
      const d = v.data_ordine ? v.data_ordine.slice(0, 10) : null;
      if (!d || d < inizio || d > fine) return;
      (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((p) => {
        const chiave = (p.nome || "").trim().toLowerCase();
        if (!chiave) return;
        if (!mappa[chiave]) mappa[chiave] = { quantita: 0, fatturato: 0 };
        mappa[chiave].quantita += Number(p.quantita) || 0;
        mappa[chiave].fatturato += Number(p.totale_riga) || 0;
      });
    });
    return mappa;
  }
  const venditePerNome = aggregaVenditePerNome(range.inizio, range.fine);
  const venditePerNomePrecedente = aggregaVenditePerNome(rangePrecedente.inizio, rangePrecedente.fine);

  // "fermi da oltre 90 giorni": guarda TUTTO lo storico vendite, non solo il periodo selezionato
  const mappaUltimaVendita = {};
  (venditeShop || []).forEach((v) => {
    const d = v.data_ordine ? v.data_ordine.slice(0, 10) : null;
    if (!d || !Array.isArray(v.prodotti)) return;
    v.prodotti.forEach((p) => {
      const chiave = (p.nome || "").trim().toLowerCase();
      if (!chiave) return;
      if (!mappaUltimaVendita[chiave] || d > mappaUltimaVendita[chiave]) mappaUltimaVendita[chiave] = d;
    });
  });
  function giorniFermo(nome) {
    const ultima = mappaUltimaVendita[(nome || "").trim().toLowerCase()];
    if (!ultima) return Infinity;
    return Math.round((new Date(oggiStr) - new Date(ultima)) / 86400000);
  }

  const prodottiConStato = (prodottiShop || []).filter((p) => p.attivo !== false).map((p) => {
    const chiave = (p.nome || "").trim().toLowerCase();
    const venduto = venditePerNome[chiave] || { quantita: 0, fatturato: 0 };
    const margine = p.costo_acquisto != null && p.prezzo_vendita > 0 ? round1Erp(((p.prezzo_vendita - p.costo_acquisto) / p.prezzo_vendita) * 100) : null;
    const categorieIds = categorieIdPerProdottoId[p.id] || [];
    return {
      ...p,
      quantitaVenduta: venduto.quantita,
      fatturato: round2(venduto.fatturato),
      margine,
      categorieIds,
      nomeCategorie: categorieIds.map((id) => categoriaNomeById[id]).filter(Boolean).join(", "),
      giorniFermo: giorniFermo(p.nome),
      sottoScorta: p.scorta_minima != null && (p.giacenza || 0) < p.scorta_minima,
      esaurito: (p.giacenza || 0) <= 0,
    };
  });

  const sottoScorta = prodottiConStato.filter((p) => p.sottoScorta);
  const senzaCosto = prodottiConStato.filter((p) => p.costo_acquisto == null);
  const fermi = prodottiConStato.filter((p) => p.giorniFermo > 90);
  const totSegnalazioni = sottoScorta.length + fermi.length + senzaCosto.length;

  const piuVenduto = [...prodottiConStato].filter((p) => p.quantitaVenduta > 0).sort((a, b) => b.quantitaVenduta - a.quantitaVenduta)[0] || null;
  const maggiorFatturato = [...prodottiConStato].filter((p) => p.fatturato > 0).sort((a, b) => b.fatturato - a.fatturato)[0] || null;
  const migliorMargine = [...prodottiConStato].filter((p) => p.margine != null).sort((a, b) => b.margine - a.margine)[0] || null;

  const valoreGiacenzaVendita = round2(prodottiConStato.reduce((s, p) => s + (p.prezzo_vendita != null ? (p.giacenza || 0) * p.prezzo_vendita : 0), 0));
  const valoreGiacenzaCosto = round2(prodottiConStato.reduce((s, p) => s + (p.costo_acquisto != null ? (p.giacenza || 0) * p.costo_acquisto : 0), 0));
  const totGiacenza = prodottiConStato.reduce((s, p) => s + (p.giacenza || 0), 0);
  const totQuantitaVendutaAttivi = prodottiConStato.reduce((s, p) => s + p.quantitaVenduta, 0);
  const rotazione = totGiacenza > 0 ? round2(totQuantitaVendutaAttivi / totGiacenza) : null;
  const rotazioneBadge = rotazione == null ? null : rotazione < 0.5 ? { testo: "Bassa", colore: "#C0392B", sfondo: "#FBE4E1" } : rotazione < 2 ? { testo: "Media", colore: "#B8860B", sfondo: "#FBF1D9" } : { testo: "Alta", colore: "#2E7D32", sfondo: "#E3F3E5" };

  // i totali di riepilogo vengono dalle vendite REALI del periodo (tutte
  // le righe), non dalla somma dei soli prodotti ancora nel catalogo:
  // così una vendita di un prodotto poi rinominato/rimosso non sparisce
  const totQuantitaSelezionato = Object.values(venditePerNome).reduce((s, v) => s + v.quantita, 0);
  const totFatturatoSelezionato = round2(Object.values(venditePerNome).reduce((s, v) => s + v.fatturato, 0));
  const totQuantitaPrecedente = Object.values(venditePerNomePrecedente).reduce((s, v) => s + v.quantita, 0);
  const totFatturatoPrecedente = round2(Object.values(venditePerNomePrecedente).reduce((s, v) => s + v.fatturato, 0));
  const varQuantita = totQuantitaPrecedente > 0 ? round1Erp(((totQuantitaSelezionato - totQuantitaPrecedente) / totQuantitaPrecedente) * 100) : null;
  const varFatturato = totFatturatoPrecedente > 0 ? round1Erp(((totFatturatoSelezionato - totFatturatoPrecedente) / totFatturatoPrecedente) * 100) : null;

  function carrelloMedioPeriodo(inizio, fine) {
    const ordini = (venditeShop || []).filter((v) => { const d = v.data_ordine ? v.data_ordine.slice(0, 10) : null; return d && d >= inizio && d <= fine; });
    if (!ordini.length) return null;
    return round2(ordini.reduce((s, v) => s + (v.totale || 0), 0) / ordini.length);
  }
  const carrelloMedio = carrelloMedioPeriodo(range.inizio, range.fine);
  const carrelloMedioPrecedente = carrelloMedioPeriodo(rangePrecedente.inizio, rangePrecedente.fine);
  const varCarrello = carrelloMedio != null && carrelloMedioPrecedente > 0 ? round1Erp(((carrelloMedio - carrelloMedioPrecedente) / carrelloMedioPrecedente) * 100) : null;

  // bucketizzazione: dipende dal periodo scelto, non solo dalla durata
  // (vedi rangeMagazzino) — "Annuale"/"Mensile" riusano la
  // bucketizzazione generica già usata da "Costi operativi" (per
  // Annuale, un anno solare supera sempre i 120gg → bucket mensili; per
  // Mensile, un mese sta sempre sotto i 45gg → bucket giornalieri, i
  // giorni 1..28/30/31 richiesti); gli altri periodi hanno bucket dedicati
  function bucketsPerPeriodo(r) {
    if (periodo === "trimestrale") return bucketsAnnoScolasticoGruppi(parseInt(r.inizio.slice(0, 4), 10), 4);
    if (periodo === "semestrale") return bucketsAnnoScolasticoGruppi(parseInt(r.inizio.slice(0, 4), 10), 2);
    if (periodo === "settimanale") return bucketsGiorniSettimana(r);
    return bucketizzaPeriodoCosti(r.inizio, r.fine);
  }
  const buckets = bucketsPerPeriodo(range);
  const bucketsPrecedenti = bucketsPerPeriodo(rangePrecedente);

  function sommaBucketVendite(inizio, fine) {
    let quantita = 0, fatturato = 0;
    (venditeShop || []).forEach((v) => {
      const d = v.data_ordine ? v.data_ordine.slice(0, 10) : null;
      if (!d || d < inizio || d > fine) return;
      (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((p) => { quantita += Number(p.quantita) || 0; fatturato += Number(p.totale_riga) || 0; });
    });
    return { quantita, fatturato: round2(fatturato) };
  }

  const puntiAndamento = buckets.map((b, i) => {
    const sel = sommaBucketVendite(b.da, b.a);
    const bPrec = bucketsPrecedenti[i];
    const prec = bPrec ? sommaBucketVendite(bPrec.da, bPrec.a) : null;
    return {
      etichetta: b.etichetta,
      selezionato: vistaAnalisi === "quantita" ? sel.quantita : sel.fatturato,
      precedente: prec ? (vistaAnalisi === "quantita" ? prec.quantita : prec.fatturato) : null,
    };
  });

  const puntiCarrelloMedio = buckets.map((b) => ({ etichetta: b.etichetta, valore: carrelloMedioPeriodo(b.da, b.a) }));

  // "Trend per categoria/prodotto": non è più una serie nel tempo, ma un
  // singolo valore (periodo selezionato) con la variazione % vs il
  // periodo precedente, una barra per categoria o per prodotto (top 10)
  function valoreVendite(v) { return vistaAnalisi === "quantita" ? v.quantita : v.fatturato; }
  // classifica dal calo maggiore al calo minore (e poi le crescite): chi
  // non ha un periodo precedente da confrontare (N/D) va in fondo, non è
  // né un calo né una crescita misurabile
  function ordinaPerCaloTrend(a, b) {
    if (a.trend == null && b.trend == null) return 0;
    if (a.trend == null) return 1;
    if (b.trend == null) return -1;
    return a.trend - b.trend;
  }
  const totaliTrendCategoria = {};
  Object.entries(venditePerNome).forEach(([chiave, v]) => {
    (categorieIdPerNomeProdotto[chiave] || []).forEach((catId) => {
      (totaliTrendCategoria[catId] ||= { corrente: 0, precedente: 0 }).corrente += valoreVendite(v);
    });
  });
  Object.entries(venditePerNomePrecedente).forEach(([chiave, v]) => {
    (categorieIdPerNomeProdotto[chiave] || []).forEach((catId) => {
      (totaliTrendCategoria[catId] ||= { corrente: 0, precedente: 0 }).precedente += valoreVendite(v);
    });
  });
  const trendCategorie = Object.entries(totaliTrendCategoria)
    .map(([catId, t]) => ({
      nome: categoriaNomeById[catId],
      valore: round2(t.corrente),
      trend: t.precedente > 0 ? round1Erp(((t.corrente - t.precedente) / t.precedente) * 100) : null,
    }))
    .filter((v) => v.nome && v.valore > 0)
    .sort(ordinaPerCaloTrend)
    .slice(0, 10);
  const trendProdotti = (prodottiShop || [])
    .filter((p) => p.attivo !== false)
    .filter((p) => !categoriaSel || (categorieIdPerProdottoId[p.id] || []).includes(categoriaSel))
    .map((p) => {
      const chiave = (p.nome || "").trim().toLowerCase();
      const corrente = valoreVendite(venditePerNome[chiave] || { quantita: 0, fatturato: 0 });
      const precedente = valoreVendite(venditePerNomePrecedente[chiave] || { quantita: 0, fatturato: 0 });
      return { nome: p.nome, valore: round2(corrente), trend: precedente > 0 ? round1Erp(((corrente - precedente) / precedente) * 100) : null };
    })
    .filter((v) => v.valore > 0)
    .sort(ordinaPerCaloTrend)
    .slice(0, 10);

  let prodottiVisti = prodottiConStato;
  if (categoriaSel) prodottiVisti = prodottiVisti.filter((p) => p.categorieIds.includes(categoriaSel));
  if (ricercaProdotto.trim()) { const q = ricercaProdotto.trim().toLowerCase(); prodottiVisti = prodottiVisti.filter((p) => p.nome.toLowerCase().includes(q)); }
  if (filtroRapido === "sottoscorta") prodottiVisti = prodottiVisti.filter((p) => p.sottoScorta);
  if (filtroRapido === "esauriti") prodottiVisti = prodottiVisti.filter((p) => p.esaurito);
  if (filtroRapido === "senzacosto") prodottiVisti = prodottiVisti.filter((p) => p.costo_acquisto == null);
  if (filtroRapido === "fermi") prodottiVisti = prodottiVisti.filter((p) => p.giorniFermo > 90);

  const prodottiOrdinati = [...prodottiVisti].sort((a, b) => {
    const { campo, direzione } = ordinamento;
    const dir = direzione === "asc" ? 1 : -1;
    const va = a[campo], vb = b[campo];
    if ((va == null || va === "") && (vb == null || vb === "")) return 0;
    if (va == null || va === "") return 1;
    if (vb == null || vb === "") return -1;
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    if (typeof va === "boolean") return (va === vb ? 0 : va ? -1 : 1) * dir;
    return (va - vb) * dir;
  });

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY }}>Magazzino</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={onApriGestioneShop}>Gestione Shop</Button>
              <Button onClick={sincronizzaCatalogo} disabled={sincronizzando}>{sincronizzando ? "Sincronizzo…" : "Sincronizza catalogo"}</Button>
            </div>
            {msgSync && <div style={{ ...fontBody, fontSize: 11.5, color: msgSync.startsWith("Errore") ? "#C0392B" : "#2E7D32", marginTop: 4 }}>{msgSync}</div>}
          </div>
        </div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 20 }}>Catalogo prodotti sincronizzato da WooCommerce. Clicca sul nome di un prodotto per modificarlo.</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
            {[{ v: "annuale", l: "Annuale" }, { v: "semestrale", l: "Semestrale" }, { v: "trimestrale", l: "Trimestrale" }, { v: "mensile", l: "Mensile" }, { v: "settimanale", l: "Settimanale" }].map((p) => (
              <button key={p.v} onClick={() => selezionaPeriodo(p.v)} style={{ ...fontBody, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 16, border: "none", background: periodo === p.v ? NAVY : "transparent", color: periodo === p.v ? "#fff" : NAVY, cursor: "pointer" }}>
                {p.l}
              </button>
            ))}
          </div>
          {periodo === "mensile" && (
            <select style={{ ...inputStyle, width: "auto" }} value={meseSel} onChange={(e) => setMeseSel(Number(e.target.value))}>
              {MESI.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          )}
          {(periodo === "annuale" || periodo === "trimestrale" || periodo === "semestrale" || periodo === "mensile") && (
            <select style={{ ...inputStyle, width: "auto" }} value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
              {anniDisponibili.map((a) => <option key={a} value={a}>{periodo === "annuale" || periodo === "mensile" ? a : `${a}/${String((a + 1) % 100).padStart(2, "0")}`}</option>)}
            </select>
          )}
          <select style={{ ...inputStyle, width: "auto", minWidth: 180 }} value={categoriaSel} onChange={(e) => setCategoriaSel(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {categorieOrdinate.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <CampoRicerca value={ricercaProdotto} onChange={(e) => setRicercaProdotto(e.target.value)} placeholder="Cerca prodotto…" style={{ minWidth: 180 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 14 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Valore potenziale</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{fmtEuroErp(valoreGiacenzaVendita)}</div>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>a prezzo di vendita — {fmtEuroErp(valoreGiacenzaCosto)} a costo</div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Rotazione magazzino</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{rotazione != null ? rotazione : "N/D"}</div>
              {rotazioneBadge && <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: rotazioneBadge.colore, background: rotazioneBadge.sfondo, borderRadius: 8, padding: "2px 8px" }}>{rotazioneBadge.testo}</span>}
            </div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0, cursor: "pointer" }} onClick={() => setFiltroRapido("tutti")}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Segnalazioni</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: totSegnalazioni > 0 ? "#C0392B" : NAVY }}>{totSegnalazioni}</div>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>richiedono attenzione</div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0, cursor: "pointer" }} onClick={() => setFiltroRapido("senzacosto")}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Dati da completare</div>
            <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{senzaCosto.length}</div>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>prodotti senza costo</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Più venduto</div>
            <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{piuVenduto ? piuVenduto.nome : "—"}</div>
            {piuVenduto && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{piuVenduto.quantitaVenduta} pezzi</div>}
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Maggior fatturato</div>
            <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{maggiorFatturato ? maggiorFatturato.nome : "—"}</div>
            {maggiorFatturato && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{fmtEuroErp(maggiorFatturato.fatturato)}</div>}
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Miglior margine</div>
            <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{migliorMargine ? migliorMargine.nome : "Non disponibile"}</div>
            {migliorMargine ? <div style={{ ...fontBody, fontSize: 12, color: "#2E7D32", fontWeight: 700 }}>{fmtPctErp(migliorMargine.margine)}</div> : <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>Completa i costi per calcolarlo</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(0,1fr)", gap: 14, marginBottom: 22, alignItems: "start" }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY }}>Analisi vendite</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {periodo === "annuale" || periodo === "mensile" ? (
                  <select style={{ ...inputStyle, width: "auto", fontSize: 12.5 }} value={confrontoTipo} onChange={(e) => setConfrontoTipo(e.target.value)}>
                    <option value="periodoprecedente">{etichettaPeriodoSelezionato} vs {periodo === "annuale" ? "periodo prec." : MESI[(meseSel + 11) % 12]}</option>
                    <option value="annoprecedente">{etichettaPeriodoSelezionato} vs {periodo === "annuale" ? anno - 1 : `${MESI[meseSel]} ${anno - 1}`}</option>
                  </select>
                ) : (
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{etichettaConfronto}</div>
                )}
                <div style={{ display: "flex", background: BG, borderRadius: 16, padding: 3, gap: 2 }}>
                  {[{ v: "quantita", l: "Quantità" }, { v: "fatturato", l: "Fatturato" }].map((o) => (
                    <button key={o.v} onClick={() => setVistaAnalisi(o.v)} style={{ ...fontBody, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 13, border: "none", background: vistaAnalisi === o.v ? NAVY : "transparent", color: vistaAnalisi === o.v ? "#fff" : NAVY, cursor: "pointer" }}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Quantità venduta</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{totQuantitaSelezionato} pz</div>
                  {varQuantita != null && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: varQuantita >= 0 ? "#2E7D32" : "#C0392B" }}>{varQuantita >= 0 ? "+" : ""}{fmtPctErp(varQuantita)}</span>}
                </div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED }}>{etichettaConfronto}</div>
              </div>
              <div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Fatturato</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{fmtEuroErp(totFatturatoSelezionato)}</div>
                  {varFatturato != null && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: varFatturato >= 0 ? "#2E7D32" : "#C0392B" }}>{varFatturato >= 0 ? "+" : ""}{fmtPctErp(varFatturato)}</span>}
                </div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED }}>{etichettaConfronto}</div>
              </div>
              <div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Carrello medio</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{carrelloMedio != null ? fmtEuroErp(carrelloMedio) : "N/D"}</div>
                  {varCarrello != null && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: varCarrello >= 0 ? "#2E7D32" : "#C0392B" }}>{varCarrello >= 0 ? "+" : ""}{fmtPctErp(varCarrello)}</span>}
                </div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED }}>{etichettaConfronto}</div>
              </div>
            </div>
            <GraficoBarreVendite punti={puntiAndamento} />
            <div style={{ display: "flex", gap: 14, marginTop: 8, ...fontBody, fontSize: 11.5, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: NAVY, display: "inline-block" }} />{etichettaPeriodoSelezionato}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: GOLD, display: "inline-block" }} />{etichettaPeriodoPrecedente}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Carrello medio</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{carrelloMedio != null ? fmtEuroErp(carrelloMedio) : "N/D"}</div>
                {varCarrello != null && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: varCarrello >= 0 ? "#2E7D32" : "#C0392B" }}>{varCarrello >= 0 ? "+" : ""}{fmtPctErp(varCarrello)} {etichettaConfronto}</span>}
              </div>
              <GraficoLineaSemplice punti={puntiCarrelloMedio} />
            </div>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2, flexWrap: "wrap" }}>
                <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>Trend {vistaTrend === "categoria" ? "per categoria" : "per prodotto"}</div>
                <div style={{ display: "flex", background: BG, borderRadius: 16, padding: 3, gap: 2 }}>
                  {[{ v: "categoria", l: "Per categoria" }, { v: "prodotto", l: "Per prodotto" }].map((o) => (
                    <button key={o.v} onClick={() => setVistaTrend(o.v)} style={{ ...fontBody, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 13, border: "none", background: vistaTrend === o.v ? NAVY : "transparent", color: vistaTrend === o.v ? "#fff" : NAVY, cursor: "pointer" }}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 8 }}>
                {vistaAnalisi === "quantita" ? "Quantità venduta" : "Fatturato"} nel periodo, {etichettaConfronto}
              </div>
              <GraficoTrendBarre voci={vistaTrend === "categoria" ? trendCategorie : trendProdotti} />
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY }}>
              Da gestire oggi
              {totSegnalazioni > 0 && <span style={{ marginLeft: 8, ...fontBody, fontSize: 11, fontWeight: 700, color: "#C0392B", background: "#FBE4E1", borderRadius: 8, padding: "2px 8px" }}>{totSegnalazioni}</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
            <button onClick={() => setFiltroRapido("sottoscorta")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, background: filtroRapido === "sottoscorta" ? BG : "#fff", cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, textAlign: "left" }}>
              <span>⚠️ Prodotti sotto scorta</span>
              <span style={{ fontWeight: 700 }}>{sottoScorta.length} ›</span>
            </button>
            <button onClick={() => setFiltroRapido("fermi")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, background: filtroRapido === "fermi" ? BG : "#fff", cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, textAlign: "left" }}>
              <span>⏱ Fermi da oltre 90 giorni</span>
              <span style={{ fontWeight: 700 }}>{fermi.length} ›</span>
            </button>
            <button onClick={() => setFiltroRapido("senzacosto")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, background: filtroRapido === "senzacosto" ? BG : "#fff", cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, textAlign: "left" }}>
              <span>📋 Senza costo di acquisto</span>
              <span style={{ fontWeight: 700 }}>{senzaCosto.length} ›</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>Dettaglio prodotti</div>
          <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2, flexWrap: "wrap" }}>
            {[{ v: "tutti", l: "Tutti" }, { v: "sottoscorta", l: "Sotto scorta" }, { v: "esauriti", l: "Esauriti" }, { v: "senzacosto", l: "Senza costo" }, { v: "fermi", l: "Fermi" }].map((f) => (
              <button key={f.v} onClick={() => setFiltroRapido(f.v)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 16, border: "none", background: filtroRapido === f.v ? NAVY : "transparent", color: filtroRapido === f.v ? "#fff" : NAVY, cursor: "pointer" }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginTop: 10 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1020 }}>
              <thead>
                <tr>
                  {COLONNE_MAGAZZINO.map((col) => (
                    <th
                      key={col.campo}
                      onClick={() => ordinaPer(col.campo)}
                      title="Clicca per ordinare"
                      style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: ordinamento.campo === col.campo ? NAVY : MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}
                    >
                      {col.label}{ordinamento.campo === col.campo && (ordinamento.direzione === "asc" ? " ▲" : " ▼")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prodottiOrdinati.map((p) => (
                  <tr key={p.id}>
                    <td onClick={() => setProdottoModifica(p)} title="Clicca per modificare" style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, cursor: "pointer", textDecoration: "underline", textDecorationColor: CREAM_BORDER, textDecorationThickness: 1 }}>{p.nome}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12.5, color: MUTED }}>{p.nomeCategorie || "—"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: p.sottoScorta ? "#C0392B" : NAVY, fontWeight: p.sottoScorta ? 700 : 400, whiteSpace: "nowrap" }}>{p.giacenza ?? "—"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>{p.scorta_minima ?? "—"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>
                      <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: p.esaurito ? "#C0392B" : p.sottoScorta ? "#B8860B" : "#2E7D32", background: p.esaurito ? "#FBE4E1" : p.sottoScorta ? "#FBF1D9" : "#E3F3E5", borderRadius: 8, padding: "3px 9px" }}>
                        {p.esaurito ? "Esaurito" : p.sottoScorta ? "Sotto scorta" : "OK"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{p.prezzo_vendita != null ? fmtEuroErp(p.prezzo_vendita) : "—"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{p.costo_acquisto != null ? fmtEuroErp(p.costo_acquisto) : "—"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{p.margine != null ? fmtPctErp(p.margine) : "N/D"}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{p.quantitaVenduta}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(p.fatturato)}</td>
                  </tr>
                ))}
                {prodottiOrdinati.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: "20px 14px", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessun prodotto corrisponde ai filtri.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {prodottoModifica && (
        <PannelloModificaProdotto
          prodotto={prodottoModifica}
          onClose={() => setProdottoModifica(null)}
          onFatto={() => { setProdottoModifica(null); ricarica(); }}
        />
      )}
    </div>
  );
}

// ---------- Gestione Shop (categorie/prodotti/immagini WooCommerce) ----------
// Pannello dentro Magazzino per gestire lo shop online senza aprire
// wp-admin: albero categorie a sinistra, elenco prodotti della categoria
// al centro, dettaglio (categoria o prodotto) a destra. Ogni scrittura
// passa da una Edge Function che aggiorna prima WooCommerce e solo se
// riesce riflette la modifica sui dati locali (vedi woo-gestisci-categoria
// e woo-gestisci-prodotto): niente salvataggi "finti" in caso di errore.

function IconaCartellaShop({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}
function IconaImmagineShop({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function IconaShopShop({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" />
    </svg>
  );
}

// { "_root": [categorie di primo livello], "<idCategoria>": [figli] },
// ognuna ordinata per "ordine" (rispecchia l'ordine reale dello shop)
function costruisciAlberoCategorie(categorie) {
  const figliDi = {};
  (categorie || []).forEach((c) => {
    const chiave = c.categoria_padre_id || "_root";
    (figliDi[chiave] ||= []).push(c);
  });
  Object.values(figliDi).forEach((lista) => lista.sort((a, b) => (a.ordine || 0) - (b.ordine || 0) || a.nome.localeCompare(b.nome)));
  return figliDi;
}

function NodoAlberoShop({ categoria, profondita, figliDi, contaProdotti, categoriaSelId, collassate, onSeleziona, onToggle, onAggiungiSotto }) {
  const figli = figliDi[categoria.id] || [];
  const haFigli = figli.length > 0;
  const collassato = collassate.has(categoria.id);
  const selezionata = categoriaSelId === categoria.id;
  return (
    <div>
      <div
        onClick={() => onSeleziona(categoria.id)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 6px", paddingLeft: 6 + profondita * 16, borderRadius: 8, cursor: "pointer", background: selezionata ? "#FBF3E4" : "transparent", border: selezionata ? `1px solid ${GOLD}` : "1px solid transparent" }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (haFigli) onToggle(categoria.id); }}
          style={{ background: "none", border: "none", padding: 2, display: "flex", cursor: haFigli ? "pointer" : "default", color: haFigli ? NAVY : "transparent", flexShrink: 0 }}
        >
          {haFigli
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collassato ? "rotate(-90deg)" : "none" }}><polyline points="6 9 12 15 18 9" /></svg>
            : <span style={{ width: 11, display: "inline-block" }} />}
        </button>
        <span style={{ color: GOLD, display: "flex", flexShrink: 0 }}><IconaCartellaShop size={14} /></span>
        <span style={{ ...fontBody, fontSize: 13.5, color: NAVY, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{categoria.nome}</span>
        <span style={{ ...fontBody, fontSize: 11, color: MUTED, background: BG, borderRadius: 10, padding: "1px 7px", flexShrink: 0 }}>{contaProdotti(categoria.id)}</span>
        <button onClick={(e) => { e.stopPropagation(); onAggiungiSotto(categoria.id); }} title="Aggiungi sotto-categoria" style={{ background: "none", border: "none", padding: 2, display: "flex", cursor: "pointer", color: MUTED, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      {haFigli && !collassato && figli.map((f) => (
        <NodoAlberoShop key={f.id} categoria={f} profondita={profondita + 1} figliDi={figliDi} contaProdotti={contaProdotti} categoriaSelId={categoriaSelId} collassate={collassate} onSeleziona={onSeleziona} onToggle={onToggle} onAggiungiSotto={onAggiungiSotto} />
      ))}
    </div>
  );
}

function ModaleNuovaCategoriaShop({ padreNome, onClose, onCrea, salvando }) {
  const [nome, setNome] = useState("");
  return (
    <Modal title={padreNome ? `Nuova sotto-categoria di "${padreNome}"` : "Nuova categoria"} onClose={onClose}>
      <Field label="Nome categoria">
        <input style={inputStyle} autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nome.trim() && onCrea(nome)} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button onClick={() => onCrea(nome)} disabled={salvando || !nome.trim()}>{salvando ? "Creo…" : "Crea categoria"}</Button>
      </div>
    </Modal>
  );
}

// editor di testo con formattazione (grassetto/corsivo/elenco) invece di un
// campo dove si vedrebbe il codice HTML grezzo: WooCommerce salva le
// descrizioni come HTML, ma chi lavora in magazzino non deve scriverlo a
// mano. "key" sull'istanza (fatto dal chiamante, tipicamente sull'id del
// prodotto/categoria) serve a far ripartire il contenuto quando si passa a
// un prodotto diverso, dato che il contenuto iniziale viene scritto nel div
// una sola volta (altrimenti riscriverlo ad ogni render sposterebbe il
// cursore mentre si digita)
function EditorRicco({ value, onChange, minHeight = 90 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function comando(nome) {
    document.execCommand("styleWithCSS", false, false);
    document.execCommand(nome);
    onChange(ref.current.innerHTML);
  }

  const bottone = (etichetta, comandoNome, stile) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => comando(comandoNome)}
      style={{ ...fontBody, fontSize: 13, minWidth: 28, padding: "4px 8px", borderRadius: 6, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer", ...stile }}
    >
      {etichetta}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {bottone("B", "bold", { fontWeight: 700 })}
        {bottone("I", "italic", { fontStyle: "italic" })}
        {bottone("• Elenco", "insertUnorderedList", {})}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        style={{ ...inputStyle, minHeight, overflow: "auto" }}
      />
    </div>
  );
}

function PaginaGestioneShop({ categorieProdotti, prodottiShop, prodottiCategorie, prodottiImmagini, ricarica, onBack }) {
  const isMobile = useIsMobile();
  const [categoriaSelId, setCategoriaSelId] = useState(null); // null = "Tutti i prodotti"
  const [collassate, setCollassate] = useState(() => new Set());
  const [ricerca, setRicerca] = useState("");
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [prodottoForm, setProdottoForm] = useState(null);
  const [categoriaForm, setCategoriaForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [caricandoImmagine, setCaricandoImmagine] = useState(false);
  const [msgErrore, setMsgErrore] = useState("");
  const [msgSuccesso, setMsgSuccesso] = useState("");
  const [modaleCategoria, setModaleCategoria] = useState(null);
  const [vistaMobile, setVistaMobile] = useState("albero");
  const trascinamento = useRef(null);

  const categorieAttive = categorieProdotti || [];
  const figliDi = useMemo(() => costruisciAlberoCategorie(categorieAttive), [categorieAttive]);
  const radiciCategorie = figliDi["_root"] || [];

  const contaProdottiDiretti = (categoriaId) => (prodottiCategorie || []).filter((pc) => pc.categoria_id === categoriaId).length;

  const categorieIdPerProdotto = useMemo(() => {
    const mappa = {};
    (prodottiCategorie || []).forEach((pc) => { (mappa[pc.prodotto_id] ||= []).push(pc.categoria_id); });
    return mappa;
  }, [prodottiCategorie]);

  const immaginiPerProdotto = useMemo(() => {
    const mappa = {};
    (prodottiImmagini || []).forEach((im) => { (mappa[im.prodotto_id] ||= []).push(im); });
    Object.values(mappa).forEach((lista) => lista.sort((a, b) => (a.ordine || 0) - (b.ordine || 0)));
    return mappa;
  }, [prodottiImmagini]);

  const categoriaSelezionata = categorieAttive.find((c) => c.id === categoriaSelId) || null;
  const totaleProdottiAttivi = (prodottiShop || []).filter((p) => p.attivo !== false).length;

  // la ricerca testuale è globale (ignora la categoria selezionata), utile
  // quando una categoria ha troppi articoli o non si ricorda dov'è il prodotto
  const prodottiBase = ricerca.trim() || !categoriaSelId
    ? (prodottiShop || []).filter((p) => p.attivo !== false)
    : (prodottiShop || []).filter((p) => p.attivo !== false && (categorieIdPerProdotto[p.id] || []).includes(categoriaSelId));

  const prodottiFiltrati = prodottiBase
    .filter((p) => !ricerca.trim() || p.nome.toLowerCase().includes(ricerca.trim().toLowerCase()))
    .filter((p) => filtroStato === "tutti" || (filtroStato === "online" ? p.stato !== "draft" : p.stato === "draft"))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const conteggiStato = {
    tutti: prodottiBase.length,
    online: prodottiBase.filter((p) => p.stato !== "draft").length,
    bozze: prodottiBase.filter((p) => p.stato === "draft").length,
  };

  function categorieAppiattite() {
    const righe = [];
    (function esplora(lista, profondita) {
      lista.forEach((c) => { righe.push({ ...c, profondita }); esplora(figliDi[c.id] || [], profondita + 1); });
    })(radiciCategorie, 0);
    return righe;
  }

  function selezionaCategoria(id) {
    setCategoriaSelId(id);
    setProdottoForm(null);
    setMsgErrore(""); setMsgSuccesso("");
    const cat = categorieAttive.find((c) => c.id === id);
    setCategoriaForm(cat ? { id: cat.id, nome: cat.nome, descrizione: cat.descrizione || "", immagineUrl: cat.immagine_url || "" } : null);
    if (isMobile) setVistaMobile("lista");
  }

  function toggleCollassa(id) {
    setCollassate((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function apriProdotto(p) {
    setProdottoForm({
      id: p.id,
      nome: p.nome,
      descrizioneBreve: p.descrizione_breve || "",
      descrizione: p.descrizione || "",
      prezzo: p.prezzo_vendita != null ? String(p.prezzo_vendita) : "",
      stato: p.stato || "publish",
      categorieIds: categorieIdPerProdotto[p.id] || [],
      immagini: (immaginiPerProdotto[p.id] || []).map((im) => ({ chiave: im.id, url: im.url, wooImageId: im.woo_image_id })),
    });
    setMsgErrore(""); setMsgSuccesso("");
    if (isMobile) setVistaMobile("dettaglio");
  }

  function nuovoProdotto() {
    setProdottoForm({
      id: null, nome: "", descrizioneBreve: "", descrizione: "", prezzo: "", stato: "publish",
      categorieIds: categoriaSelId ? [categoriaSelId] : [],
      immagini: [],
    });
    setMsgErrore(""); setMsgSuccesso("");
    if (isMobile) setVistaMobile("dettaglio");
  }

  async function caricaFileSuStorage(file) {
    const estensione = (file.name.split(".").pop() || "jpg").toLowerCase();
    const percorso = `${Date.now()}-${Math.random().toString(36).slice(2)}.${estensione}`;
    const { error } = await supabase.storage.from("shop-immagini").upload(percorso, file);
    if (error) throw new Error(error.message);
    return supabase.storage.from("shop-immagini").getPublicUrl(percorso).data.publicUrl;
  }

  async function onCambiaImmagineCategoria(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !categoriaForm) return;
    setCaricandoImmagine(true);
    try {
      const url = await caricaFileSuStorage(file);
      setCategoriaForm((f) => ({ ...f, immagineUrl: url }));
    } catch (err) {
      window.alert("Caricamento immagine non riuscito: " + err.message);
    }
    setCaricandoImmagine(false);
  }

  async function onAggiungiImmaginiProdotto(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !prodottoForm) return;
    setCaricandoImmagine(true);
    try {
      const nuove = [];
      for (const file of files) {
        const url = await caricaFileSuStorage(file);
        nuove.push({ chiave: `nuova-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, wooImageId: null });
      }
      setProdottoForm((f) => ({ ...f, immagini: [...f.immagini, ...nuove] }));
    } catch (err) {
      window.alert("Caricamento immagine non riuscito: " + err.message);
    }
    setCaricandoImmagine(false);
  }

  function rimuoviImmagineProdotto(chiave) {
    setProdottoForm((f) => ({ ...f, immagini: f.immagini.filter((im) => im.chiave !== chiave) }));
  }
  function rendiCopertina(chiave) {
    setProdottoForm((f) => {
      const idx = f.immagini.findIndex((im) => im.chiave === chiave);
      if (idx <= 0) return f;
      const nuove = [...f.immagini];
      const [scelta] = nuove.splice(idx, 1);
      nuove.unshift(scelta);
      return { ...f, immagini: nuove };
    });
  }
  function onDropImmagine(chiaveDestinazione) {
    const origine = trascinamento.current;
    trascinamento.current = null;
    if (!origine || origine === chiaveDestinazione) return;
    setProdottoForm((f) => {
      const nuove = [...f.immagini];
      const idxOrigine = nuove.findIndex((im) => im.chiave === origine);
      const idxDestinazione = nuove.findIndex((im) => im.chiave === chiaveDestinazione);
      if (idxOrigine < 0 || idxDestinazione < 0) return f;
      const [spostata] = nuove.splice(idxOrigine, 1);
      nuove.splice(idxDestinazione, 0, spostata);
      return { ...f, immagini: nuove };
    });
  }

  function toggleCategoriaProdotto(categoriaId) {
    setProdottoForm((f) => {
      const presente = f.categorieIds.includes(categoriaId);
      return { ...f, categorieIds: presente ? f.categorieIds.filter((id) => id !== categoriaId) : [...f.categorieIds, categoriaId] };
    });
  }

  async function salvaCategoria() {
    if (!categoriaForm) return;
    setSalvando(true); setMsgErrore(""); setMsgSuccesso("");
    const { data, error } = await supabase.functions.invoke("woo-gestisci-categoria", {
      body: { azione: "modifica", categoriaId: categoriaForm.id, nome: categoriaForm.nome, descrizione: categoriaForm.descrizione, immagineUrl: categoriaForm.immagineUrl },
    });
    setSalvando(false);
    if (error || data?.errore) { setMsgErrore("Salvataggio non riuscito, riprova. " + (data?.errore || error.message)); return; }
    setMsgSuccesso("Categoria salvata.");
    ricarica();
  }

  async function eliminaCategoriaCorrente() {
    if (!categoriaForm) return;
    const n = contaProdottiDiretti(categoriaForm.id);
    const messaggio = n > 0
      ? `Questa categoria contiene ${n} prodott${n === 1 ? "o" : "i"}: verranno scollegati da questa categoria (non eliminati). Continuare?`
      : `Eliminare la categoria "${categoriaForm.nome}"?`;
    if (!window.confirm(messaggio)) return;
    setSalvando(true); setMsgErrore("");
    const { data, error } = await supabase.functions.invoke("woo-gestisci-categoria", { body: { azione: "elimina", categoriaId: categoriaForm.id } });
    setSalvando(false);
    if (error || data?.errore) { window.alert("Eliminazione non riuscita, riprova. " + (data?.errore || error.message)); return; }
    setCategoriaSelId(null); setCategoriaForm(null);
    ricarica();
  }

  async function creaCategoria(nome, padreId) {
    if (!nome.trim()) return;
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("woo-gestisci-categoria", { body: { azione: "crea", nome: nome.trim(), categoriaPadreId: padreId || undefined } });
    setSalvando(false);
    if (error || data?.errore) { window.alert("Creazione non riuscita, riprova. " + (data?.errore || error.message)); return; }
    setModaleCategoria(null);
    await ricarica();
    if (data?.categoria?.id) selezionaCategoria(data.categoria.id);
  }

  async function salvaProdotto() {
    if (!prodottoForm) return;
    if (!prodottoForm.nome.trim()) { setMsgErrore("Il nome del prodotto è obbligatorio."); return; }
    const prezzoNum = parseNum(prodottoForm.prezzo);
    if (!(prezzoNum > 0)) { setMsgErrore("Inserisci un prezzo valido, maggiore di zero."); return; }
    setSalvando(true); setMsgErrore(""); setMsgSuccesso("");
    const { data, error } = await supabase.functions.invoke("woo-gestisci-prodotto", {
      body: {
        azione: prodottoForm.id ? "modifica" : "crea",
        prodottoId: prodottoForm.id || undefined,
        nome: prodottoForm.nome.trim(),
        descrizioneBreve: prodottoForm.descrizioneBreve,
        descrizione: prodottoForm.descrizione,
        prezzo: prezzoNum,
        stato: prodottoForm.stato,
        categorieIds: prodottoForm.categorieIds,
        immagini: prodottoForm.immagini.map((im) => ({ url: im.url, wooImageId: im.wooImageId })),
      },
    });
    setSalvando(false);
    if (error || data?.errore) { setMsgErrore("Salvataggio non riuscito, riprova. " + (data?.errore || error.message)); return; }
    setMsgSuccesso(prodottoForm.id ? "Prodotto salvato." : "Prodotto creato.");
    if (!prodottoForm.id && data?.prodottoId) setProdottoForm((f) => ({ ...f, id: data.prodottoId }));
    ricarica();
  }

  const paneAlbero = (
    <div style={{ ...cardStyle, padding: 14, marginBottom: 0, display: "flex", flexDirection: "column", height: isMobile ? "auto" : "calc(100vh - 230px)", minHeight: isMobile ? undefined : 400 }}>
      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Struttura shop</div>
      <div
        onClick={() => selezionaCategoria(null)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 6px", borderRadius: 8, cursor: "pointer", marginBottom: 6, background: categoriaSelId === null ? "#FBF3E4" : "transparent", border: categoriaSelId === null ? `1px solid ${GOLD}` : "1px solid transparent" }}
      >
        <span style={{ color: NAVY, display: "flex" }}><IconaShopShop size={14} /></span>
        <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, flex: 1 }}>Tutti i prodotti</span>
        <span style={{ ...fontBody, fontSize: 11, color: MUTED, background: BG, borderRadius: 10, padding: "1px 7px" }}>{totaleProdottiAttivi}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {radiciCategorie.map((c) => (
          <NodoAlberoShop key={c.id} categoria={c} profondita={0} figliDi={figliDi} contaProdotti={contaProdottiDiretti} categoriaSelId={categoriaSelId} collassate={collassate} onSeleziona={selezionaCategoria} onToggle={toggleCollassa} onAggiungiSotto={(padreId) => setModaleCategoria({ padreId })} />
        ))}
        {radiciCategorie.length === 0 && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, padding: "10px 4px" }}>Nessuna categoria. Sincronizza il catalogo da Magazzino o creane una.</div>}
      </div>
      <button onClick={() => setModaleCategoria({ padreId: null })} style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, background: "transparent", border: `1px dashed ${CREAM_BORDER}`, borderRadius: 8, padding: "9px 10px", cursor: "pointer", marginTop: 10 }}>+ Aggiungi categoria</button>
    </div>
  );

  const paneLista = (
    <div style={{ ...cardStyle, padding: 14, marginBottom: 0, display: "flex", flexDirection: "column", height: isMobile ? "auto" : "calc(100vh - 230px)", minHeight: isMobile ? undefined : 400 }}>
      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
        {ricerca.trim() ? "Risultati ricerca" : categoriaSelezionata ? categoriaSelezionata.nome : "Tutti i prodotti"}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[{ v: "tutti", l: "Tutti" }, { v: "online", l: "Online" }, { v: "bozze", l: "Bozze" }].map((t) => (
          <button key={t.v} onClick={() => setFiltroStato(t.v)} style={{ ...fontBody, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 14, border: "none", background: filtroStato === t.v ? NAVY : BG, color: filtroStato === t.v ? "#fff" : NAVY, cursor: "pointer" }}>
            {t.l} {conteggiStato[t.v]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {prodottiFiltrati.map((p) => {
          const immagini = immaginiPerProdotto[p.id] || [];
          const selezionato = prodottoForm?.id === p.id;
          return (
            <div key={p.id} onClick={() => apriProdotto(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, cursor: "pointer", background: selezionato ? "#FBF3E4" : "#FAF8F2", border: selezionato ? `1px solid ${GOLD}` : `1px solid ${CREAM_BORDER}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: BG, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {immagini[0] ? <img src={immagini[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: MUTED }}><IconaImmagineShop size={16} /></span>}
                {immagini.length > 1 && <span style={{ position: "absolute", bottom: -1, right: -1, ...fontBody, fontSize: 9, fontWeight: 700, color: "#fff", background: NAVY, borderRadius: 8, padding: "1px 4px" }}>{immagini.length}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{p.prezzo_vendita != null ? fmtEuroErp(p.prezzo_vendita) : "—"}</div>
              </div>
              <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: p.stato === "draft" ? "#F4EEDB" : "#E6F2E8", color: p.stato === "draft" ? "#8A6D1D" : "#2E7D32", flexShrink: 0 }}>{p.stato === "draft" ? "Bozza" : "Online"}</span>
            </div>
          );
        })}
        {prodottiFiltrati.length === 0 && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, padding: "10px 4px" }}>Nessun prodotto.</div>}
      </div>
      <button onClick={nuovoProdotto} style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: "#fff", background: NAVY, border: "none", borderRadius: 8, padding: "10px 10px", cursor: "pointer", marginTop: 10 }}>+ Nuovo prodotto</button>
    </div>
  );

  const messaggi = (
    <>
      {msgErrore && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 12, padding: "8px 10px", background: "#FBEAEA", borderRadius: 8 }}>{msgErrore}</div>}
      {msgSuccesso && !msgErrore && <div style={{ ...fontBody, fontSize: 12.5, color: "#2E7D32", marginBottom: 12, padding: "8px 10px", background: "#EAF5EC", borderRadius: 8 }}>{msgSuccesso}</div>}
    </>
  );

  const paneDettaglioProdotto = prodottoForm && (
    <div style={{ ...cardStyle, padding: 18, marginBottom: 0, height: isMobile ? "auto" : "calc(100vh - 230px)", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>{prodottoForm.id ? "Modifica prodotto" : "Nuovo prodotto"}</div>
        <Button onClick={salvaProdotto} disabled={salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
      </div>
      {messaggi}
      <Field label="Immagini prodotto">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {prodottoForm.immagini.map((im, i) => (
            <div
              key={im.chiave}
              draggable
              onDragStart={() => { trascinamento.current = im.chiave; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropImmagine(im.chiave)}
              style={{ width: 84, height: 84, borderRadius: 10, overflow: "hidden", position: "relative", border: i === 0 ? `2px solid ${GOLD}` : `1px solid ${CREAM_BORDER}`, cursor: "grab" }}
            >
              <img src={im.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {i === 0 && <span style={{ position: "absolute", top: 3, left: 3, ...fontBody, fontSize: 8.5, fontWeight: 700, color: "#fff", background: NAVY, borderRadius: 6, padding: "1px 5px" }}>Copertina</span>}
              <div style={{ position: "absolute", top: 3, right: 3, display: "flex", gap: 3 }}>
                {i !== 0 && (
                  <button onClick={() => rendiCopertina(im.chiave)} title="Rendi copertina" style={{ background: "rgba(14,27,51,0.75)", border: "none", borderRadius: 6, color: "#fff", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, padding: 0 }}>★</button>
                )}
                <button onClick={() => rimuoviImmagineProdotto(im.chiave)} title="Elimina immagine" style={{ background: "rgba(192,57,43,0.85)", border: "none", borderRadius: 6, color: "#fff", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
          <label style={{ width: 84, height: 84, borderRadius: 10, border: `1.5px dashed ${CREAM_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: caricandoImmagine ? "default" : "pointer", color: MUTED, ...fontBody, fontSize: 24 }}>
            {caricandoImmagine ? "…" : "+"}
            <input type="file" accept="image/*" multiple onChange={onAggiungiImmaginiProdotto} style={{ display: "none" }} disabled={caricandoImmagine} />
          </label>
        </div>
        <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 6 }}>Trascina per riordinare le immagini. La prima è la copertina mostrata sullo shop.</div>
      </Field>
      <Field label="Nome prodotto"><input style={inputStyle} value={prodottoForm.nome} onChange={(e) => setProdottoForm((f) => ({ ...f, nome: e.target.value }))} /></Field>
      <Field label="Descrizione breve">
        <EditorRicco key={`breve-${prodottoForm.id || "nuovo"}`} value={prodottoForm.descrizioneBreve} onChange={(html) => setProdottoForm((f) => ({ ...f, descrizioneBreve: html }))} minHeight={60} />
      </Field>
      <Field label="Descrizione completa">
        <EditorRicco key={`completa-${prodottoForm.id || "nuovo"}`} value={prodottoForm.descrizione} onChange={(html) => setProdottoForm((f) => ({ ...f, descrizione: html }))} minHeight={110} />
      </Field>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px" }}><Field label="Prezzo (€)"><input style={inputStyle} inputMode="decimal" value={prodottoForm.prezzo} onChange={(e) => setProdottoForm((f) => ({ ...f, prezzo: e.target.value }))} /></Field></div>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Disponibilità">
            <select style={inputStyle} value={prodottoForm.stato} onChange={(e) => setProdottoForm((f) => ({ ...f, stato: e.target.value }))}>
              <option value="publish">Pubblicato</option>
              <option value="draft">Bozza</option>
            </select>
          </Field>
        </div>
      </div>
      <Field label="Categorie">
        <div style={{ maxHeight: 160, overflow: "auto", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: 8 }}>
          {categorieAppiattite().map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 4px", paddingLeft: 4 + c.profondita * 16, cursor: "pointer" }}>
              <input type="checkbox" checked={prodottoForm.categorieIds.includes(c.id)} onChange={() => toggleCategoriaProdotto(c.id)} />
              <span style={{ ...fontBody, fontSize: 12.5, color: NAVY }}>{c.nome}</span>
            </label>
          ))}
          {categorieAppiattite().length === 0 && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessuna categoria disponibile.</div>}
        </div>
      </Field>
    </div>
  );

  const paneDettaglioCategoria = !prodottoForm && categoriaForm && (
    <div style={{ ...cardStyle, padding: 18, marginBottom: 0, height: isMobile ? "auto" : "calc(100vh - 230px)", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>Categoria</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="danger" onClick={eliminaCategoriaCorrente} disabled={salvando}>Elimina</Button>
          <Button onClick={salvaCategoria} disabled={salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
        </div>
      </div>
      {messaggi}
      <Field label="Immagine categoria">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 72, height: 72, borderRadius: 10, background: BG, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {categoriaForm.immagineUrl ? <img src={categoriaForm.immagineUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: MUTED }}><IconaImmagineShop size={22} /></span>}
          </div>
          <label style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: "8px 12px", cursor: caricandoImmagine ? "default" : "pointer" }}>
            {caricandoImmagine ? "Carico…" : "Cambia immagine"}
            <input type="file" accept="image/*" onChange={onCambiaImmagineCategoria} style={{ display: "none" }} disabled={caricandoImmagine} />
          </label>
        </div>
      </Field>
      <Field label="Nome categoria"><input style={inputStyle} value={categoriaForm.nome} onChange={(e) => setCategoriaForm((f) => ({ ...f, nome: e.target.value }))} /></Field>
      <Field label="Descrizione">
        <EditorRicco key={`cat-${categoriaForm.id}`} value={categoriaForm.descrizione} onChange={(html) => setCategoriaForm((f) => ({ ...f, descrizione: html }))} minHeight={100} />
      </Field>
    </div>
  );

  const panePlaceholder = (
    <div style={{ ...cardStyle, marginBottom: 0, height: isMobile ? 200 : "calc(100vh - 230px)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 30 }}>
      <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Seleziona una categoria o un prodotto per vederne i dettagli, oppure crea qualcosa di nuovo.</div>
    </div>
  );

  const paneDettaglio = paneDettaglioProdotto || paneDettaglioCategoria || panePlaceholder;

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Magazzino</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY }}>Gestione Shop</div>
            <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Categorie, prodotti e immagini dello shop online, sincronizzati con WooCommerce.</div>
          </div>
          <CampoRicerca value={ricerca} onChange={(e) => { setRicerca(e.target.value); if (isMobile) setVistaMobile("lista"); }} placeholder="Cerca prodotto…" style={{ minWidth: 220 }} />
        </div>

        {isMobile ? (
          <>
            {vistaMobile !== "albero" && (
              <button onClick={() => setVistaMobile(vistaMobile === "dettaglio" ? "lista" : "albero")} style={{ ...fontBody, fontSize: 12.5, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <IconaFrecciaSinistra size={14} /> {vistaMobile === "dettaglio" ? "Elenco prodotti" : "Struttura shop"}
              </button>
            )}
            {vistaMobile === "albero" && paneAlbero}
            {vistaMobile === "lista" && paneLista}
            {vistaMobile === "dettaglio" && paneDettaglio}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "280px 340px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
            {paneAlbero}
            {paneLista}
            {paneDettaglio}
          </div>
        )}
      </div>

      {modaleCategoria && (
        <ModaleNuovaCategoriaShop
          padreNome={modaleCategoria.padreId ? categorieAttive.find((c) => c.id === modaleCategoria.padreId)?.nome : null}
          onClose={() => setModaleCategoria(null)}
          onCrea={(nome) => creaCategoria(nome, modaleCategoria.padreId)}
          salvando={salvando}
        />
      )}
    </div>
  );
}

// ---------- Costi operativi ----------
function IconaTortaCostiErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
function IconaSedeCostiErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 21v-4h6v4" />
    </svg>
  );
}
function IconaTrendCostiErp({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
// divide un range di date in "bucket" per il grafico "Andamento dei
// costi": giornalieri se il periodo è breve (≲45gg, es. un mese),
// settimanali se medio (≲120gg, es. un trimestre), mensili altrimenti
// (es. un anno) — così il grafico resta leggibile qualunque periodo/
// intervallo personalizzato scelga l'utente
function bucketizzaPeriodoCosti(inizio, fine) {
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [aI, mI, gI] = inizio.split("-").map(Number);
  const [aF, mF, gF] = fine.split("-").map(Number);
  const dIn = new Date(aI, mI - 1, gI);
  const dFin = new Date(aF, mF - 1, gF);
  const giorni = Math.max(1, Math.round((dFin - dIn) / 86400000) + 1);

  if (giorni <= 45) {
    const buckets = [];
    for (let i = 0; i < giorni; i++) {
      const d = new Date(aI, mI - 1, gI + i);
      buckets.push({ etichetta: String(d.getDate()), da: fmt(d), a: fmt(d) });
    }
    return buckets;
  }
  if (giorni <= 120) {
    const buckets = [];
    let n = 1;
    for (let i = 0; i < giorni; i += 7) {
      const dA = new Date(aI, mI - 1, gI + i);
      const dB = new Date(aI, mI - 1, gI + Math.min(i + 6, giorni - 1));
      buckets.push({ etichetta: `S${n}`, da: fmt(dA), a: fmt(dB) });
      n++;
    }
    return buckets;
  }
  const buckets = [];
  let cursoreAnno = aI, cursoreMese = mI - 1;
  while (cursoreAnno < aF || (cursoreAnno === aF && cursoreMese <= mF - 1)) {
    const primoDelMese = new Date(cursoreAnno, cursoreMese, 1);
    const ultimoDelMese = new Date(cursoreAnno, cursoreMese + 1, 0);
    const da = primoDelMese < dIn ? dIn : primoDelMese;
    const a = ultimoDelMese > dFin ? dFin : ultimoDelMese;
    buckets.push({ etichetta: MESI_ABBR[cursoreMese], da: fmt(da), a: fmt(a) });
    cursoreMese++;
    if (cursoreMese > 11) { cursoreMese = 0; cursoreAnno++; }
  }
  return buckets;
}
const COLORI_DONUT_COSTI = [NAVY, GOLD, "#7C8DA6", "#C9BFA0", "#D9D4C4"];
function DonutIncidenzaCosti({ dati }) {
  const raggio = 56, spessore = 22, cx = 74, cy = 74, circonferenza = 2 * Math.PI * raggio;
  let cumulato = 0;
  return (
    <svg width={148} height={148} viewBox="0 0 148 148" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={raggio} fill="none" stroke={BG} strokeWidth={spessore} />
      {dati.map((d, i) => {
        const dash = (d.pct / 100) * circonferenza;
        const el = (
          <circle
            key={d.etichetta}
            cx={cx} cy={cy} r={raggio} fill="none"
            stroke={COLORI_DONUT_COSTI[i % COLORI_DONUT_COSTI.length]}
            strokeWidth={spessore}
            strokeDasharray={`${dash} ${circonferenza - dash}`}
            strokeDashoffset={-cumulato}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        cumulato += dash;
        return el;
      })}
    </svg>
  );
}
// linea "andamento dei costi": periodo corrente (piena) vs stesso numero
// di bucket del periodo precedente (tratteggiata), scala automatica sul
// valore massimo tra le due serie
function GraficoAndamentoCosti({ punti }) {
  if (punti.length === 0) return null;
  const larghezza = 560, altezza = 200, padSx = 46, padDx = 12, padAlto = 14, padBasso = 26;
  const valori = punti.flatMap((p) => [p.corrente, p.precedente]).filter((v) => v != null);
  const massimo = Math.max(1, ...valori);
  const scalaX = (i) => padSx + (i / Math.max(1, punti.length - 1)) * (larghezza - padSx - padDx);
  const scalaY = (v) => padAlto + (1 - v / massimo) * (altezza - padAlto - padBasso);
  const puntiA = punti.map((p, i) => [scalaX(i), scalaY(p.corrente)]);
  const puntiP = punti.filter((p) => p.precedente != null).map((p, i) => [scalaX(i), scalaY(p.precedente)]);
  const path = (pts) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const righeGriglia = 4;
  const saltoEtichette = punti.length <= 12 ? 1 : Math.ceil(punti.length / 8);
  return (
    <svg width="100%" height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {Array.from({ length: righeGriglia + 1 }).map((_, i) => {
        const y = padAlto + (i / righeGriglia) * (altezza - padAlto - padBasso);
        const valore = Math.round(massimo * (1 - i / righeGriglia));
        return (
          <g key={i}>
            <line x1={padSx} y1={y} x2={larghezza - padDx} y2={y} stroke={CREAM_BORDER} strokeWidth="1" />
            <text x={0} y={y + 4} fontSize="10" fill={MUTED} fontFamily="'Roboto',sans-serif">{fmtEuroKErp(valore)}</text>
          </g>
        );
      })}
      {puntiP.length > 1 && <path d={path(puntiP)} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="4 4" />}
      <path d={path(puntiA)} fill="none" stroke={NAVY} strokeWidth="2.5" />
      {puntiA.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill={NAVY} />)}
      {punti.map((p, i) => (
        i % saltoEtichette === 0 ? (
          <text key={i} x={scalaX(i)} y={altezza - 6} fontSize="10" fill={MUTED} textAnchor="middle" fontFamily="'Roboto',sans-serif">{p.etichetta}</text>
        ) : null
      ))}
    </svg>
  );
}
function BarraCostiPerSede({ dati, totale }) {
  if (dati.length === 0) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun costo registrato nel periodo.</div>;
  return (
    <div>
      {dati.map((d, i) => {
        const pct = totale > 0 ? (d.costi / totale) * 100 : 0;
        return (
          <div key={d.sede.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, ...fontBody, fontSize: 12.5, color: NAVY, fontWeight: 600 }}>
              <span>{d.sede.nome}</span>
              <span>{fmtPctErp(pct)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: BG, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 6, background: i === 0 ? GOLD : NAVY }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
// indice di performance per sede: margine (utile/ricavi) del periodo,
// che tiene conto sia di quanto costa gestire la sede sia di quanto
// incassa — non solo "quanto costa" ma "quanto rende rispetto a quanto
// costa", che è la richiesta esplicita dell'utente
function RigaPerformanceSede({ pos, dato }) {
  const margine = dato.margine;
  const buono = margine != null && margine >= 15;
  const negativo = margine != null && margine < 0;
  const colore = margine == null ? MUTED : negativo ? "#C0392B" : buono ? "#2E7D32" : "#B7791F";
  const bg = margine == null ? BG : negativo ? "#FBE4E1" : buono ? "#E3F3E5" : "#FBF0DD";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}` }}>
      <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: MUTED, width: 20, flexShrink: 0 }}>{pos}°</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{dato.sede.nome}</div>
        <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>{fmtEuroErp(dato.ricavi)} incassati · {fmtEuroErp(dato.costi)} di costi</div>
      </div>
      <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: colore, background: bg, borderRadius: 8, padding: "3px 9px", whiteSpace: "nowrap", flexShrink: 0 }}>
        {margine == null ? "—" : `${margine >= 0 ? "+" : ""}${fmtPctErp(margine)}`}
      </div>
    </div>
  );
}

// ---------- Analisi costi di gestione ----------
// una spesa "conta" per l'ambito richiesto (sede/corso/classe/evento) o
// direttamente sui campi tipo_ambito/sede_id/corso_id/classe_id/evento_id
// della spesa stessa (caso comune, un solo ambito), oppure — se la spesa
// è stata ripartita — tramite le righe di spese_attribuzioni che
// combaciano, sommando solo la porzione (importo) di competenza
function corrispondeAmbitoDiretto(s, filtri, corsiDateById) {
  if (filtri.sedeId) {
    if (s.sede_id === filtri.sedeId) return true;
    if (s.classe_id && corsiDateById[s.classe_id]?.location_id === filtri.sedeId) return true;
    return false;
  }
  if (filtri.corsoId) {
    if (s.corso_id === filtri.corsoId) return true;
    if (s.classe_id && corsiDateById[s.classe_id]?.corso_id === filtri.corsoId) return true;
    return false;
  }
  if (filtri.classeId) return s.classe_id === filtri.classeId;
  if (filtri.eventoId) return s.evento_id === filtri.eventoId;
  return true;
}
// commissioni venditori: automatiche dalla quota_venditore di ogni
// iscritto, raggruppate per classe (stessa data della classe)
function generaVociCommissioniVenditori(corsiDate, iscritti) {
  const corsiDateById = Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd]));
  const perClasse = {};
  (iscritti || []).forEach((i) => { if (i.quota_venditore) perClasse[i.corso_data_id] = round2((perClasse[i.corso_data_id] || 0) + i.quota_venditore); });
  return Object.entries(perClasse).map(([classeId, tot]) => {
    const cd = corsiDateById[classeId];
    if (!cd) return null;
    return {
      id: `auto__commissioni__${classeId}`, categoria_id: "commerciale", sottocategoria_id: "commerciale__commissioni_venditori",
      imponibile: tot, data_documento: cd.data_inizio, data_pagamento: cd.data_inizio, competenza_da: cd.data_inizio, competenza_a: cd.data_inizio,
      tipo_ambito: "classe", classe_id: classeId, origine: "automatico", stato: "pagata", includi_analisi_costi: true,
    };
  }).filter(Boolean);
}
// le voci extra del Riepilogo amministrativo (corsi_date.costi_extra,
// jsonb) usano ancora le chiavi della VECCHIA tassonomia a 13
// categorie: questa mappa le porta sulla nuova, così anche queste
// confluiscono nel totale invece di sparire silenziosamente (la stessa
// somma è già dentro costoClasseErp/calcolaKpiErp, quindi qui serve solo
// per non far scendere il totale di "Analisi costi di gestione" sotto
// quello della dashboard ERP)
const MAPPA_VECCHIA_CATEGORIA_COSTI = {
  agenzie: "agenzie_consulenti", viaggi: "viaggi_corsi", alloggi: "alloggi_corsi", vitto: "vitto_corsi",
  materiali: "materiali_didattici_corsi", logistica: "corrieri_spedizioni", sedi: "affitto_aule_esterne",
  commerciale: "commerciale", eventi: "fiere_eventi", allestimento: "allestimento_immagine_sale",
  accademia_centrale: "struttura_centrale", utenze: "struttura_centrale", personale_accademia: "personale_accademia",
  docenti_corsi: "docenti_corsi",
};
function generaVociDaCostiExtra(corsiDate, costiSottocategorie) {
  const voci = [];
  (corsiDate || []).forEach((cd) => {
    (Array.isArray(cd.costi_extra) ? cd.costi_extra : []).forEach((extra, idx) => {
      const valore = Number(extra.valore) || 0;
      if (!valore) return;
      const categoriaId = MAPPA_VECCHIA_CATEGORIA_COSTI[extra.categoria] || null;
      const sottocategoriaMatch = categoriaId ? (costiSottocategorie || []).find((v) => v.id === extra.sottovoce && v.categoria_id === categoriaId) : null;
      const catchAll = categoriaId ? (costiSottocategorie || []).find((v) => v.categoria_id === categoriaId && /altre_spese|altri_/.test(v.id)) : null;
      voci.push({
        id: `extra__${cd.id}__${idx}`, categoria_id: categoriaId, sottocategoria_id: (sottocategoriaMatch || catchAll)?.id || null,
        descrizione: extra.titolo || null, imponibile: valore,
        data_documento: cd.data_inizio, data_pagamento: cd.data_inizio, competenza_da: cd.data_inizio, competenza_a: cd.data_inizio,
        tipo_ambito: "classe", classe_id: cd.id, origine: "automatico", stato: "pagata", includi_analisi_costi: true,
      });
    });
  });
  return voci;
}
// spese reali + voci automatiche generate dai dati già tracciati: la
// base comune usata da tutta l'aggregazione di "Analisi costi di gestione"
function speseComplete(spese, corsiDate, iscritti, costiSottocategorie) {
  return [
    ...(spese || []),
    ...generaVociCommissioniVenditori(corsiDate, iscritti),
    ...generaVociDaCostiExtra(corsiDate, costiSottocategorie),
  ];
}
// somma le spese che rispettano periodo/filtri, per il calcolo di KPI,
// grafici e tabelle: ritorna sia il totale sia l'elenco delle "voci
// incluse" (spesa + importo effettivamente contato), utile per i
// drill-down e per i raggruppamenti per categoria/sede/ecc.
function calcolaTotaleSpese(spese, speseAttribuzioni, costiCategorieById, corsiDateById, inizio, fine, filtri = {}) {
  const attribPerSpesa = {};
  (speseAttribuzioni || []).forEach((a) => { (attribPerSpesa[a.spesa_id] ||= []).push(a); });
  let totale = 0;
  const vociIncluse = [];
  for (const s of (spese || [])) {
    if (s.includi_analisi_costi === false) continue;
    const cat = costiCategorieById?.[s.categoria_id];
    if (cat && cat.includi_analisi_costi === false) continue;
    if (cat && cat.attiva === false && !filtri.includiCategorieDisattivate) continue;
    const data = s.competenza_da || s.data_documento || s.data_pagamento;
    if (!data || data < inizio || data > fine) continue;
    if (filtri.categoriaId && s.categoria_id !== filtri.categoriaId) continue;
    if (filtri.sottocategoriaId && s.sottocategoria_id !== filtri.sottocategoriaId) continue;
    if (filtri.fornitoreId && s.fornitore_id !== filtri.fornitoreId) continue;
    if (filtri.stato && s.stato !== filtri.stato) continue;
    if (filtri.fissoVariabile && s.fisso_variabile !== filtri.fissoVariabile) continue;
    if (filtri.ricorrenteOccasionale && s.ricorrente_occasionale !== filtri.ricorrenteOccasionale) continue;
    if (filtri.natura && s.natura !== filtri.natura) continue;
    if (filtri.riducibilita && s.riducibilita !== filtri.riducibilita) continue;
    if (filtri.origine && s.origine !== filtri.origine) continue;

    const haFiltroAmbito = filtri.sedeId || filtri.corsoId || filtri.classeId || filtri.eventoId;
    const attrib = attribPerSpesa[s.id];
    let importo;
    if (attrib && attrib.length) {
      importo = haFiltroAmbito
        ? round2(attrib.filter((a) => corrispondeAmbitoDiretto(a, filtri, corsiDateById)).reduce((sum, a) => sum + (a.importo || 0), 0))
        : round2(attrib.reduce((sum, a) => sum + (a.importo || 0), 0));
    } else {
      importo = (!haFiltroAmbito || corrispondeAmbitoDiretto(s, filtri, corsiDateById)) ? (s.imponibile || 0) : 0;
    }
    if (importo > 0) { totale += importo; vociIncluse.push({ spesa: s, importo }); }
  }
  return { totale: round2(totale), vociIncluse };
}
// range di periodo standard (mese/trimestre/semestre/anno/personalizzato)
function rangePeriodoAnalisiCosti(periodo, personalizzato) {
  const oggi = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (periodo === "mese") {
    return { inizio: fmt(new Date(oggi.getFullYear(), oggi.getMonth(), 1)), fine: fmt(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0)) };
  }
  if (periodo === "trimestre") {
    const meseInizio = Math.floor(oggi.getMonth() / 3) * 3;
    return { inizio: fmt(new Date(oggi.getFullYear(), meseInizio, 1)), fine: fmt(new Date(oggi.getFullYear(), meseInizio + 3, 0)) };
  }
  if (periodo === "semestre") {
    const meseInizio = oggi.getMonth() < 6 ? 0 : 6;
    return { inizio: fmt(new Date(oggi.getFullYear(), meseInizio, 1)), fine: fmt(new Date(oggi.getFullYear(), meseInizio + 6, 0)) };
  }
  if (periodo === "personalizzato") return { inizio: personalizzato?.da || fmt(oggi), fine: personalizzato?.a || fmt(oggi) };
  return { inizio: `${oggi.getFullYear()}-01-01`, fine: `${oggi.getFullYear()}-12-31` };
}
function rangeConfrontoAnalisiCosti(range, tipo) {
  const [aI, mI, gI] = range.inizio.split("-").map(Number);
  const [aF, mF, gF] = range.fine.split("-").map(Number);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (tipo === "annoprecedente") {
    return { inizio: fmt(new Date(aI - 1, mI - 1, gI)), fine: fmt(new Date(aF - 1, mF - 1, gF)) };
  }
  // "periodoprecedente" (default): stesso numero di giorni, subito prima
  const inizio = new Date(aI, mI - 1, gI);
  const fine = new Date(aF, mF - 1, gF);
  const giorni = Math.round((fine - inizio) / 86400000) + 1;
  const finePrec = new Date(aI, mI - 1, gI - 1);
  const inizioPrec = new Date(finePrec.getFullYear(), finePrec.getMonth(), finePrec.getDate() - giorni + 1);
  return { inizio: fmt(inizioPrec), fine: fmt(finePrec) };
}
// KPI principali del cruscotto: costi totali, incidenza sui ricavi,
// voce con maggiore incidenza, categoria con maggiore aumento, costi
// ricorrenti, costi riducibili — calcolati una sola volta sui dati già
// filtrati, così cruscotto/grafici/tabella restano sempre coerenti tra loro
function calcolaKpiAnalisiCosti({ spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, inizio, fine, rangeConfronto, filtri }) {
  const costiCategorieById = Object.fromEntries((costiCategorie || []).map((c) => [c.id, c]));
  const corsiDateById = Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd]));
  const tutteLeSpese = speseComplete(spese, corsiDate, iscritti, costiSottocategorie);

  const { totale, vociIncluse } = calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, inizio, fine, filtri);
  const confronto = rangeConfronto ? calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, rangeConfronto.inizio, rangeConfronto.fine, filtri) : null;

  const cdFiltrate = (corsiDate || []).filter((cd) => cd.data_inizio >= inizio && cd.data_inizio <= fine
    && (!filtri.sedeId || cd.location_id === filtri.sedeId) && (!filtri.corsoId || cd.corso_id === filtri.corsoId) && (!filtri.classeId || cd.id === filtri.classeId));
  const idsCd = new Set(cdFiltrate.map((cd) => cd.id));
  const ricavi = round2((iscritti || []).filter((i) => idsCd.has(i.corso_data_id)).reduce((s, i) => s + (i.totale_pattuito || 0), 0));
  const incidenzaRicavi = ricavi > 0 ? round1Erp((totale / ricavi) * 100) : null;
  const variazione = confronto ? variazionePctErp(totale, confronto.totale) : null;

  const perCategoria = {};
  vociIncluse.forEach(({ spesa, importo }) => { perCategoria[spesa.categoria_id] = round2((perCategoria[spesa.categoria_id] || 0) + importo); });
  const categorieOrdinate = Object.entries(perCategoria)
    .map(([id, tot]) => ({ categoria: costiCategorieById[id], totale: tot }))
    .filter((c) => c.categoria)
    .sort((a, b) => b.totale - a.totale);
  const voceMaggiore = categorieOrdinate[0] ? { ...categorieOrdinate[0], pct: totale > 0 ? round1Erp((categorieOrdinate[0].totale / totale) * 100) : 0 } : null;

  let categoriaMaggiorAumento = null;
  if (confronto) {
    const perCategoriaPrec = {};
    confronto.vociIncluse.forEach(({ spesa, importo }) => { perCategoriaPrec[spesa.categoria_id] = round2((perCategoriaPrec[spesa.categoria_id] || 0) + importo); });
    const aumenti = categorieOrdinate
      .map((c) => ({ categoria: c.categoria, totale: c.totale, aumento: variazionePctErp(c.totale, perCategoriaPrec[c.categoria.id] || 0) }))
      .filter((c) => c.aumento != null)
      .sort((a, b) => b.aumento - a.aumento);
    categoriaMaggiorAumento = aumenti[0] || null;
  }

  const ricorrenti = round2(vociIncluse.filter((v) => v.spesa.ricorrente_occasionale === "ricorrente").reduce((s, v) => s + v.importo, 0));
  const riducibiliAlta = round2(vociIncluse.filter((v) => v.spesa.riducibilita === "alta").reduce((s, v) => s + v.importo, 0));

  const perSede = (location || []).map((l) => {
    const t = calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, inizio, fine, { ...filtri, sedeId: l.id });
    return { sede: l, totale: t.totale };
  }).filter((r) => r.totale > 0).sort((a, b) => b.totale - a.totale);

  const perFissoVariabile = { fisso: 0, variabile: 0, semivariabile: 0, nd: 0 };
  vociIncluse.forEach(({ spesa, importo }) => {
    const k = ["fisso", "variabile", "semivariabile"].includes(spesa.fisso_variabile) ? spesa.fisso_variabile : "nd";
    perFissoVariabile[k] = round2(perFissoVariabile[k] + importo);
  });
  const perRicorrenzaNatura = { ricorrente: 0, occasionale: 0, investimento: 0, straordinario: 0 };
  vociIncluse.forEach(({ spesa, importo }) => {
    if (spesa.natura === "investimento") perRicorrenzaNatura.investimento = round2(perRicorrenzaNatura.investimento + importo);
    else if (spesa.natura === "straordinario") perRicorrenzaNatura.straordinario = round2(perRicorrenzaNatura.straordinario + importo);
    else if (spesa.ricorrente_occasionale === "ricorrente") perRicorrenzaNatura.ricorrente = round2(perRicorrenzaNatura.ricorrente + importo);
    else if (spesa.ricorrente_occasionale === "occasionale") perRicorrenzaNatura.occasionale = round2(perRicorrenzaNatura.occasionale + importo);
  });

  return {
    totale, ricavi, incidenzaRicavi, variazione, voceMaggiore, categoriaMaggiorAumento,
    ricorrenti, riducibiliAlta, categorieOrdinate, perSede, perFissoVariabile, perRicorrenzaNatura, vociIncluse,
    pctRicorrenti: totale > 0 ? round1Erp((ricorrenti / totale) * 100) : 0,
    pctRiducibili: totale > 0 ? round1Erp((riducibiliAlta / totale) * 100) : 0,
  };
}

// tendina ricercabile compatta (bottone + <select> a comparsa), usata
// per ogni filtro della barra di "Analisi costi di gestione": evita la
// lunga fila di pulsanti-città vietata dal brief
function FiltroRicercabile({ chiave, etichetta, valore, setValore, opzioni, apriChiave, setApriChiave, larghezza }) {
  const aperto = apriChiave === chiave;
  return (
    <div style={{ position: "relative", flex: `1 1 ${larghezza || 150}px`, minWidth: 130 }}>
      <button
        onClick={() => setApriChiave(aperto ? "" : chiave)}
        style={{
          ...fontBody, width: "100%", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600,
          padding: "9px 11px", borderRadius: 10, cursor: "pointer",
          border: `1px solid ${valore ? NAVY : CREAM_BORDER}`, background: "#fff", color: NAVY,
        }}
      >
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {valore ? (opzioni.find((o) => o.id === valore)?.nome || valore) : etichetta}
        </span>
        <IconaChevronGiuErp size={12} color={MUTED} />
      </button>
      {aperto && (
        <select
          autoFocus
          style={{ ...inputStyle, ...fontBody, fontSize: 12.5, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, width: "auto" }}
          value={valore}
          onChange={(e) => { setValore(e.target.value); setApriChiave(""); }}
          onBlur={() => setApriChiave("")}
        >
          <option value="">Tutti</option>
          {opzioni.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      )}
    </div>
  );
}

// grafico Pareto: barre ordinate dalla categoria più costosa alla meno
// costosa (grigie oltre l'80% cumulato) + linea della percentuale cumulata
function GraficoParetoCosti({ categorie }) {
  if (!categorie.length) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun costo nel periodo.</div>;
  const top = categorie.slice(0, 8);
  const totaleGenerale = categorie.reduce((s, c) => s + c.totale, 0);
  let cum = 0;
  const punti = top.map((c) => { cum += c.totale; return { ...c, cumulPct: totaleGenerale > 0 ? round1Erp((cum / totaleGenerale) * 100) : 0 }; });
  const massimo = Math.max(1, ...punti.map((p) => p.totale));
  const larghezza = 600, altezza = 220, padSx = 44, padDx = 40, padAlto = 14, padBasso = 46;
  const n = punti.length;
  const stepX = (larghezza - padSx - padDx) / n;
  const xCentro = (i) => padSx + stepX * i + stepX / 2;
  const yBar = (v) => altezza - padBasso - (v / massimo) * (altezza - padAlto - padBasso);
  const yLinea = (pct) => padAlto + (1 - pct / 100) * (altezza - padAlto - padBasso);
  const path = punti.map((p, i) => `${i === 0 ? "M" : "L"}${xCentro(i).toFixed(1)},${yLinea(p.cumulPct).toFixed(1)}`).join(" ");
  const idx80 = punti.findIndex((p) => p.cumulPct >= 80);
  return (
    <svg width="100%" height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <line x1={padSx} y1={yLinea(80)} x2={larghezza - padDx} y2={yLinea(80)} stroke={GOLD} strokeDasharray="3 3" strokeWidth="1" />
      <text x={larghezza - padDx + 4} y={yLinea(80) + 3} fontSize="9" fill={GOLD} fontFamily="'Roboto',sans-serif">80%</text>
      {punti.map((p, i) => (
        <rect key={p.categoria.id} x={xCentro(i) - stepX * 0.28} y={yBar(p.totale)} width={stepX * 0.56} height={Math.max(1, altezza - padBasso - yBar(p.totale))}
          fill={idx80 >= 0 && i <= idx80 ? NAVY : "#C7CBD6"} rx="3" />
      ))}
      <path d={path} fill="none" stroke={GOLD} strokeWidth="2" />
      {punti.map((p, i) => <circle key={`c${p.categoria.id}`} cx={xCentro(i)} cy={yLinea(p.cumulPct)} r="2.5" fill={GOLD} />)}
      {punti.map((p, i) => (
        <text key={`t${p.categoria.id}`} x={xCentro(i)} y={altezza - padBasso + 16} fontSize="9.5" fill={MUTED} textAnchor="middle" fontFamily="'Roboto',sans-serif">
          {p.categoria.nome.length > 12 ? `${p.categoria.nome.slice(0, 11)}…` : p.categoria.nome}
        </text>
      ))}
    </svg>
  );
}
// barra comparativa generica (fisso/variabile/semivariabile, oppure
// ricorrente/occasionale/investimento/straordinario)
function BarraComparativaCosti({ voci }) {
  const totale = voci.reduce((s, v) => s + v.valore, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 10, background: BG }}>
        {totale > 0 && voci.filter((v) => v.valore > 0).map((v) => (
          <div key={v.etichetta} style={{ width: `${(v.valore / totale) * 100}%`, background: v.colore }} title={`${v.etichetta}: ${fmtEuroErp(v.valore)}`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {voci.map((v) => (
          <div key={v.etichetta} style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 12, color: NAVY }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: v.colore, display: "inline-block", flexShrink: 0 }} />
            {v.etichetta} <b>{fmtEuroErp(v.valore)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// cruscotto principale: filtri, KPI, grafici, tabella "Voci di spesa
// principali", segnalazioni gestionali, drill-down — legge SOLO dati
// reali già tracciati nel gestionale più il registro "spese"
function PaginaAnalisiCosti({
  corsi, location, master, corsiDate, iscritti, costiCategorie, costiSottocategorie, eventi, fornitori,
  spese, speseAttribuzioni, costiBudget, costiSoglieAllerta, ricarica, onBack,
  onApriCatalogo, onApriNuovaSpesa, onApriBudget, onApriModificaSpesa,
}) {
  const isMobile = useIsMobile();
  const [periodo, setPeriodo] = useState("anno");
  const [customDa, setCustomDa] = useState(dataOggiStr());
  const [customA, setCustomA] = useState(dataOggiStr());
  const [confronto, setConfronto] = useState("periodoprecedente");
  const [apriFiltro, setApriFiltro] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [corsoId, setCorsoId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [sottocategoriaId, setSottocategoriaId] = useState("");
  const [fornitoreId, setFornitoreId] = useState("");
  const [fissoVariabile, setFissoVariabile] = useState("");
  const [ricorrenteOccasionale, setRicorrenteOccasionale] = useState("");
  const [natura, setNatura] = useState("");
  const [riducibilita, setRiducibilita] = useState("");
  const [stato, setStato] = useState("");
  const [origine, setOrigine] = useState("");
  const [drillDown, setDrillDown] = useState(null);
  const [segnalazioniAperte, setSegnalazioniAperte] = useState(true);
  const [importCsvAperto, setImportCsvAperto] = useState(false);

  const range = rangePeriodoAnalisiCosti(periodo, { da: customDa, a: customA });
  const rangeConfronto = (confronto === "nessuno" || confronto === "budget") ? null : rangeConfrontoAnalisiCosti(range, confronto);
  const filtri = useMemo(() => ({ sedeId, corsoId, classeId, eventoId, categoriaId, sottocategoriaId, fornitoreId, fissoVariabile, ricorrenteOccasionale, natura, riducibilita, stato, origine }),
    [sedeId, corsoId, classeId, eventoId, categoriaId, sottocategoriaId, fornitoreId, fissoVariabile, ricorrenteOccasionale, natura, riducibilita, stato, origine]);

  const kpi = useMemo(
    () => calcolaKpiAnalisiCosti({ spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, inizio: range.inizio, fine: range.fine, rangeConfronto, filtri }),
    [spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, range.inizio, range.fine, rangeConfronto, filtri]
  );

  const budgetPeriodo = useMemo(() => {
    const [annoIni, meseIni] = range.inizio.split("-").map(Number);
    const [annoFin, meseFin] = range.fine.split("-").map(Number);
    return (costiBudget || []).filter((b) => {
      if (filtri.categoriaId && b.categoria_id && b.categoria_id !== filtri.categoriaId) return false;
      if (filtri.sedeId && b.sede_id && b.sede_id !== filtri.sedeId) return false;
      if (filtri.corsoId && b.corso_id && b.corso_id !== filtri.corsoId) return false;
      if (b.mese) {
        const dataBudget = b.anno * 12 + (b.mese - 1);
        return dataBudget >= (annoIni * 12 + meseIni - 1) && dataBudget <= (annoFin * 12 + meseFin - 1);
      }
      return b.anno >= annoIni && b.anno <= annoFin;
    }).reduce((s, b) => s + (b.importo_budget || 0), 0);
  }, [costiBudget, range.inizio, range.fine, filtri]);
  const scostamentoBudgetPeriodo = scostamentoBudget(kpi.totale, budgetPeriodo);

  // "Andamento dei costi": bucket mensili del periodo, confrontati con
  // lo stesso bucket del periodo di confronto (stesso meccanismo già
  // collaudato in PannelloConfrontoAnnuale/PaginaErp)
  const bucketsMensili = useMemo(() => {
    const [aI, mI] = range.inizio.split("-").map(Number);
    const [aF, mF] = range.fine.split("-").map(Number);
    const risultato = [];
    let anno = aI, mese = mI;
    while (anno < aF || (anno === aF && mese <= mF)) {
      const inizioMese = `${anno}-${String(mese).padStart(2, "0")}-01`;
      const ultimoGiorno = new Date(anno, mese, 0).getDate();
      const fineMese = `${anno}-${String(mese).padStart(2, "0")}-${String(ultimoGiorno).padStart(2, "0")}`;
      risultato.push({ etichetta: MESI_ABBR[mese - 1], inizio: inizioMese, fine: fineMese });
      mese += 1;
      if (mese > 12) { mese = 1; anno += 1; }
    }
    return risultato;
  }, [range.inizio, range.fine]);
  const andamentoMensile = useMemo(() => bucketsMensili.map((b, idx) => {
    const kA = calcolaKpiAnalisiCosti({ spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, inizio: b.inizio, fine: b.fine, rangeConfronto: null, filtri });
    let precedente = null;
    if (rangeConfronto) {
      const giorniOffset = Math.round((new Date(range.inizio) - new Date(rangeConfronto.inizio)) / 86400000);
      const dInizio = new Date(b.inizio); dInizio.setDate(dInizio.getDate() - giorniOffset);
      const dFine = new Date(b.fine); dFine.setDate(dFine.getDate() - giorniOffset);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const kP = calcolaKpiAnalisiCosti({ spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, inizio: fmt(dInizio), fine: fmt(dFine), rangeConfronto: null, filtri });
      precedente = kP.totale;
    }
    return { etichetta: b.etichetta, corrente: kA.totale, precedente };
  }), [bucketsMensili, spese, speseAttribuzioni, costiCategorie, costiSottocategorie, corsiDate, iscritti, location, rangeConfronto, range.inizio, filtri]);

  const donutDati = useMemo(() => {
    const top = kpi.categorieOrdinate.slice(0, 4);
    const restoTotale = round2(kpi.categorieOrdinate.slice(4).reduce((s, c) => s + c.totale, 0));
    const voci = top.map((c) => ({ etichetta: c.categoria.nome, totale: c.totale }));
    if (restoTotale > 0) voci.push({ etichetta: "Altro", totale: restoTotale });
    return voci.map((v) => ({ ...v, pct: kpi.totale > 0 ? round1Erp((v.totale / kpi.totale) * 100) : 0 }));
  }, [kpi.categorieOrdinate, kpi.totale]);

  const opzioniSede = location.map((l) => ({ id: l.id, nome: l.nome.toUpperCase() }));
  const opzioniCorso = corsi.map((c) => ({ id: c.id, nome: c.nome.toUpperCase() }));
  const opzioniClasse = corsiDate.map((cd) => ({ id: cd.id, nome: `${fmtData(cd.data_inizio)} — ${corsi.find((c) => c.id === cd.corso_id)?.nome || ""}`.toUpperCase() }));
  const opzioniEvento = eventi.map((e) => ({ id: e.id, nome: e.nome.toUpperCase() }));
  const opzioniCategoria = [...costiCategorie].sort((a, b) => (a.ordine || 0) - (b.ordine || 0)).map((c) => ({ id: c.id, nome: c.nome }));
  const opzioniSottocategoria = sottocategorieDiCategoria(costiSottocategorie, categoriaId).map((v) => ({ id: v.id, nome: v.nome }));
  const opzioniFornitore = fornitori.map((f) => ({ id: f.id, nome: f.nome.toUpperCase() }));

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}>
              <IconaFrecciaSinistra size={20} />
            </button>
            <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setImportCsvAperto(true)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}>Importa CSV</button>
            <button onClick={() => esportaCsvSpese(kpi.vociIncluse, Object.fromEntries(costiCategorie.map((c) => [c.id, c])), Object.fromEntries(costiSottocategorie.map((v) => [v.id, v])))} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}>Esporta CSV</button>
            <button onClick={() => window.print()} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}>Esporta PDF</button>
            <button onClick={onApriBudget} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}>Budget</button>
            <button onClick={onApriCatalogo} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer" }}>Catalogo categorie</button>
            <button onClick={onApriNuovaSpesa} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 14px", borderRadius: 16, border: "none", background: NAVY, color: "#fff", cursor: "pointer" }}>+ Nuova spesa</button>
          </div>
        </div>
        {importCsvAperto && (
          <PannelloImportCsv costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie} spese={spese} onClose={() => setImportCsvAperto(false)} ricarica={ricarica} />
        )}
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Analisi costi di gestione</div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 20 }}>Quanto spendiamo, dove incide di più, cosa sta crescendo, cosa possiamo ridurre.</div>

        {/* barra filtri */}
        <div style={{ ...cardStyle, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
              {[{ v: "mese", l: "Mese" }, { v: "trimestre", l: "Trimestre" }, { v: "semestre", l: "Semestre" }, { v: "anno", l: "Anno" }, { v: "personalizzato", l: "Personalizzato" }].map((p) => (
                <button key={p.v} onClick={() => setPeriodo(p.v)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 600, padding: "8px 12px", borderRadius: 16, border: "none", background: periodo === p.v ? "#fff" : "transparent", color: NAVY, cursor: "pointer", whiteSpace: "nowrap" }}>{p.l}</button>
              ))}
            </div>
            <div style={{ display: "flex", background: BG, borderRadius: 20, padding: 4, gap: 2 }}>
              {[{ v: "periodoprecedente", l: "Vs periodo prec." }, { v: "annoprecedente", l: "Vs anno prec." }, { v: "budget", l: "Vs budget" }, { v: "nessuno", l: "Nessun confronto" }].map((p) => (
                <button key={p.v} onClick={() => setConfronto(p.v)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 600, padding: "8px 12px", borderRadius: 16, border: "none", background: confronto === p.v ? "#fff" : "transparent", color: NAVY, cursor: "pointer", whiteSpace: "nowrap" }}>{p.l}</button>
              ))}
            </div>
          </div>
          {periodo === "personalizzato" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <Field label="Dal"><input type="date" style={inputStyle} value={customDa} onChange={(e) => setCustomDa(e.target.value)} /></Field>
              <Field label="Al"><input type="date" style={inputStyle} value={customA} onChange={(e) => setCustomA(e.target.value)} /></Field>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <FiltroRicercabile chiave="sede" etichetta="Sede" valore={sedeId} setValore={setSedeId} opzioni={opzioniSede} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="corso" etichetta="Corso" valore={corsoId} setValore={setCorsoId} opzioni={opzioniCorso} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="classe" etichetta="Classe" valore={classeId} setValore={setClasseId} opzioni={opzioniClasse} apriChiave={apriFiltro} setApriChiave={setApriFiltro} larghezza={200} />
            <FiltroRicercabile chiave="evento" etichetta="Evento" valore={eventoId} setValore={setEventoId} opzioni={opzioniEvento} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="categoria" etichetta="Categoria" valore={categoriaId} setValore={(v) => { setCategoriaId(v); setSottocategoriaId(""); }} opzioni={opzioniCategoria} apriChiave={apriFiltro} setApriChiave={setApriFiltro} larghezza={180} />
            <FiltroRicercabile chiave="sottocategoria" etichetta="Sotto-categoria" valore={sottocategoriaId} setValore={setSottocategoriaId} opzioni={opzioniSottocategoria} apriChiave={apriFiltro} setApriChiave={setApriFiltro} larghezza={180} />
            <FiltroRicercabile chiave="fornitore" etichetta="Fornitore" valore={fornitoreId} setValore={setFornitoreId} opzioni={opzioniFornitore} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="fissovar" etichetta="Fisso/variabile" valore={fissoVariabile} setValore={setFissoVariabile} opzioni={FISSO_VARIABILE_OPZIONI.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="ricorroccas" etichetta="Ricorrente/occasionale" valore={ricorrenteOccasionale} setValore={setRicorrenteOccasionale} opzioni={RICORRENTE_OCCASIONALE_OPZIONI.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} larghezza={190} />
            <FiltroRicercabile chiave="natura" etichetta="Operativo/investimento" valore={natura} setValore={setNatura} opzioni={NATURA_OPZIONI.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} larghezza={190} />
            <FiltroRicercabile chiave="riducibilita" etichetta="Riducibilità" valore={riducibilita} setValore={setRiducibilita} opzioni={RIDUCIBILITA_OPZIONI.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="stato" etichetta="Stato pagamento" valore={stato} setValore={setStato} opzioni={STATI_SPESA.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
            <FiltroRicercabile chiave="origine" etichetta="Origine" valore={origine} setValore={setOrigine} opzioni={ORIGINE_OPZIONI.map((o) => ({ id: o.chiave, nome: o.etichetta }))} apriChiave={apriFiltro} setApriChiave={setApriFiltro} />
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) minmax(0,1fr)" : "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 14 }}>
          <CardKpiErp titolo="Costi totali" valore={fmtEuroErp(kpi.totale)} variazione={kpi.variazione} variazioneInvertita sub="vs periodo di confronto" Icona={IconaRicevutaErp} coloreIcona="#C0392B" coloreBgIcona="#FBE4E1" />
          <CardKpiErp titolo="Incidenza sui ricavi" valore={kpi.incidenzaRicavi == null ? "N/D" : fmtPctErp(kpi.incidenzaRicavi)} sub={`Ricavi periodo: ${fmtEuroErp(kpi.ricavi)}`} Icona={IconaBanconota} coloreIcona="#2563EB" coloreBgIcona="#E1EAF9" />
          <div style={{ ...cardStyle, padding: 18, marginBottom: 0, background: "#FBF3E0", border: "1px solid #EEDCB4" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F3E3C0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <IconaTortaCostiErp size={19} color={GOLD} />
            </div>
            <div style={{ ...fontBody, fontSize: 12.5, color: "#9C7C3E", marginBottom: 4 }}>Voce con maggiore incidenza</div>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8, lineHeight: 1.25 }}>{kpi.voceMaggiore?.categoria.nome || "—"}</div>
            {kpi.voceMaggiore && <div style={{ display: "inline-block", ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "3px 9px" }}>{fmtEuroErp(kpi.voceMaggiore.totale)} · {fmtPctErp(kpi.voceMaggiore.pct)}</div>}
          </div>
          <CardKpiErp
            titolo="Categoria con maggiore aumento"
            valore={kpi.categoriaMaggiorAumento?.categoria.nome || "—"}
            sub={kpi.categoriaMaggiorAumento ? `${kpi.categoriaMaggiorAumento.aumento >= 0 ? "+" : ""}${fmtPctErp(kpi.categoriaMaggiorAumento.aumento)} vs confronto` : "Nessun confronto disponibile"}
            Icona={IconaTrendCostiErp} coloreIcona="#C0392B" coloreBgIcona="#FBE4E1"
          />
          <CardKpiErp titolo="Costi ricorrenti" valore={fmtEuroErp(kpi.ricorrenti)} sub={`${fmtPctErp(kpi.pctRicorrenti)} dei costi totali`} Icona={IconaSedeCostiErp} coloreIcona="#2E7D32" coloreBgIcona="#E3F3E5" />
          <CardKpiErp titolo="Costi potenzialmente riducibili" valore={fmtEuroErp(kpi.riducibiliAlta)} sub={`${fmtPctErp(kpi.pctRiducibili)} dei costi totali`} Icona={IconaScatolaErp} coloreIcona="#B7791F" coloreBgIcona="#FBF0DD" />
        </div>

        {confronto === "budget" && (
          <div style={{ ...cardStyle, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Budget del periodo</div>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>{budgetPeriodo > 0 ? fmtEuroErp(budgetPeriodo) : "Non impostato"}</div>
            {budgetPeriodo > 0 && (
              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: scostamentoBudgetPeriodo != null && scostamentoBudgetPeriodo > 0 ? "#C0392B" : "#2E7D32", background: scostamentoBudgetPeriodo != null && scostamentoBudgetPeriodo > 0 ? "#FBE4E1" : "#E3F3E5", borderRadius: 8, padding: "4px 10px" }}>
                Scostamento: {scostamentoBudgetPeriodo == null ? "N/D" : `${scostamentoBudgetPeriodo >= 0 ? "+" : ""}${fmtPctErp(scostamentoBudgetPeriodo)}`}
              </div>
            )}
          </div>
        )}

        {/* grafici */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.4fr) minmax(0,1fr)", gap: 14, marginBottom: 14 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Andamento dei costi</div>
            <GraficoAndamentoCosti punti={andamentoMensile} />
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Incidenza per categoria</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <DonutIncidenzaCosti dati={donutDati} />
              <div style={{ flex: 1, minWidth: 140 }}>
                {donutDati.map((d, i) => (
                  <div key={d.etichetta} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", ...fontBody, fontSize: 12.5, color: NAVY }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: COLORI_DONUT_COSTI[i % COLORI_DONUT_COSTI.length], flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{d.etichetta}</span>
                    <span style={{ fontWeight: 700 }}>{fmtPctErp(d.pct)}</span>
                  </div>
                ))}
                {donutDati.length === 0 && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun costo nel periodo.</div>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 14 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Pareto dei costi</div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 10 }}>Le categorie che generano l'80% dei costi (barre blu)</div>
            <GraficoParetoCosti categorie={kpi.categorieOrdinate} />
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Costi per sede</div>
            <BarraCostiPerSede dati={kpi.perSede} totale={kpi.perSede.reduce((s, r) => s + r.totale, 0)} />
            {kpi.perSede.length === 0 && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Nessun costo registrato per sede nel periodo.</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 18 }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Costi fissi e variabili</div>
            <BarraComparativaCosti voci={[
              { etichetta: "Fisso", valore: kpi.perFissoVariabile.fisso, colore: NAVY },
              { etichetta: "Variabile", valore: kpi.perFissoVariabile.variabile, colore: GOLD },
              { etichetta: "Semivariabile", valore: kpi.perFissoVariabile.semivariabile, colore: "#7C8DA6" },
              { etichetta: "Non classificato", valore: kpi.perFissoVariabile.nd, colore: "#D9D4C4" },
            ]} />
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Ricorrenti, occasionali e investimenti</div>
            <BarraComparativaCosti voci={[
              { etichetta: "Ricorrenti", valore: kpi.perRicorrenzaNatura.ricorrente, colore: NAVY },
              { etichetta: "Occasionali", valore: kpi.perRicorrenzaNatura.occasionale, colore: GOLD },
              { etichetta: "Investimenti", valore: kpi.perRicorrenzaNatura.investimento, colore: "#2563EB" },
              { etichetta: "Straordinari", valore: kpi.perRicorrenzaNatura.straordinario, colore: "#C0392B" },
            ]} />
          </div>
        </div>

        <PannelloSegnalazioniGestionali
          aperto={segnalazioniAperte} onToggle={() => setSegnalazioniAperte((v) => !v)}
          spese={spese} speseAttribuzioni={speseAttribuzioni} costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie} costiSoglieAllerta={costiSoglieAllerta}
          corsiDate={corsiDate} iscritti={iscritti} location={location} range={range} rangeConfronto={rangeConfronto}
        />

        <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4, marginTop: 4 }}>Voci di spesa principali</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 }}>Le categorie più rilevanti del periodo — clicca una riga per il dettaglio.</div>
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {["Categoria", "Importo", "Incidenza", "Ricorrente", "Riducibilità", "Azione"].map((th) => (
                    <th key={th} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpi.categorieOrdinate.slice(0, 10).map((c, i) => {
                  const vociCategoria = kpi.vociIncluse.filter((v) => v.spesa.categoria_id === c.categoria.id);
                  const nRicorrenti = vociCategoria.filter((v) => v.spesa.ricorrente_occasionale === "ricorrente").length;
                  const nRiducibiliAlta = vociCategoria.filter((v) => v.spesa.riducibilita === "alta").length;
                  const pct = kpi.totale > 0 ? round1Erp((c.totale / kpi.totale) * 100) : 0;
                  return (
                    <tr key={c.categoria.id} style={{ cursor: "pointer" }} onClick={() => setDrillDown({ tipo: "categoria", categoria: c.categoria })}>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>
                        {i === 0 && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: GOLD, marginRight: 8 }} />}
                        {c.categoria.nome}
                      </td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY, whiteSpace: "nowrap" }}>{fmtEuroErp(c.totale)}</td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: BG, borderRadius: 3, overflow: "hidden", minWidth: 50 }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: i === 0 ? GOLD : NAVY }} />
                          </div>
                          <span style={{ ...fontBody, fontSize: 12, color: NAVY, whiteSpace: "nowrap" }}>{fmtPctErp(pct)}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{nRicorrenti}/{vociCategoria.length}</td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{nRiducibiliAlta}/{vociCategoria.length}</td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap" }}>
                        <button onClick={(e) => { e.stopPropagation(); setDrillDown({ tipo: "categoria", categoria: c.categoria }); }} style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "transparent", border: "none", cursor: "pointer" }}>Apri dettaglio →</button>
                      </td>
                    </tr>
                  );
                })}
                {kpi.categorieOrdinate.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: "20px 14px", ...fontBody, fontSize: 13, color: MUTED, textAlign: "center" }}>Nessuna spesa registrata in questo periodo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {drillDown && (
          <PannelloDrillDownCosti
            drillDown={drillDown} onClose={() => setDrillDown(null)}
            kpi={kpi} range={range} rangeConfronto={rangeConfronto} location={location} corsi={corsi} corsiDate={corsiDate}
            fornitori={fornitori} costiSottocategorie={costiSottocategorie}
            onApriModificaSpesa={onApriModificaSpesa} ricarica={ricarica}
          />
        )}
      </div>
    </div>
  );
}

// pannello "Segnalazioni gestionali": alert calcolati dai dati reali,
// non da soglie inventate — ogni riga cita l'importo/percentuale vera
function PannelloSegnalazioniGestionali({ aperto, onToggle, spese, speseAttribuzioni, costiCategorie, costiSottocategorie, costiSoglieAllerta, corsiDate, iscritti, location, range, rangeConfronto }) {
  const costiCategorieById = Object.fromEntries((costiCategorie || []).map((c) => [c.id, c]));
  const corsiDateById = Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd]));
  const tutteLeSpese = speseComplete(spese, corsiDate, iscritti, costiSottocategorie);
  const segnalazioni = useMemo(() => {
    const righe = [];
    const attuale = calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, range.inizio, range.fine, {});
    const perCategoriaAttuale = {};
    attuale.vociIncluse.forEach(({ spesa, importo }) => { perCategoriaAttuale[spesa.categoria_id] = round2((perCategoriaAttuale[spesa.categoria_id] || 0) + importo); });

    // crescita categoria oltre il 10% rispetto al confronto
    if (rangeConfronto) {
      const precedente = calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, rangeConfronto.inizio, rangeConfronto.fine, {});
      const perCategoriaPrec = {};
      precedente.vociIncluse.forEach(({ spesa, importo }) => { perCategoriaPrec[spesa.categoria_id] = round2((perCategoriaPrec[spesa.categoria_id] || 0) + importo); });
      Object.entries(perCategoriaAttuale).forEach(([catId, tot]) => {
        const prec = perCategoriaPrec[catId] || 0;
        if (prec > 0) {
          const variazione = round1Erp(((tot - prec) / prec) * 100);
          if (variazione > 10) righe.push({ tipo: "crescita", testo: `"${costiCategorieById[catId]?.nome}" è cresciuta del ${fmtPctErp(variazione)} rispetto al periodo di confronto.` });
        }
      });
    }

    // concentrazione: quante categorie generano l'80% dei costi
    const ordinate = Object.entries(perCategoriaAttuale).map(([id, tot]) => ({ id, tot })).sort((a, b) => b.tot - a.tot);
    const totaleGenerale = ordinate.reduce((s, c) => s + c.tot, 0);
    if (totaleGenerale > 0) {
      let cum = 0, n = 0;
      for (const c of ordinate) { cum += c.tot; n++; if (cum / totaleGenerale >= 0.8) break; }
      if (n > 0 && n <= 5) righe.push({ tipo: "concentrazione", testo: `Il ${round1Erp((cum / totaleGenerale) * 100)}% dei costi è concentrato in ${n} categori${n === 1 ? "a" : "e"}.` });
    }

    // sede con rapporto costi/ricavi più alto
    const cdPeriodo = (corsiDate || []).filter((cd) => cd.data_inizio >= range.inizio && cd.data_inizio <= range.fine);
    const rapportiSede = (location || []).map((l) => {
      const idsCd = new Set(cdPeriodo.filter((cd) => cd.location_id === l.id).map((cd) => cd.id));
      const ricaviSede = round2((iscritti || []).filter((i) => idsCd.has(i.corso_data_id)).reduce((s, i) => s + (i.totale_pattuito || 0), 0));
      const costiSede = calcolaTotaleSpese(tutteLeSpese, speseAttribuzioni, costiCategorieById, corsiDateById, range.inizio, range.fine, { sedeId: l.id }).totale;
      return { sede: l, ricavi: ricaviSede, costi: costiSede, rapporto: ricaviSede > 0 ? round1Erp((costiSede / ricaviSede) * 100) : null };
    }).filter((r) => r.rapporto != null && r.costi > 0).sort((a, b) => b.rapporto - a.rapporto);
    if (rapportiSede[0] && rapportiSede[0].rapporto > 50) righe.push({ tipo: "sede", testo: `La sede di ${rapportiSede[0].sede.nome} presenta il rapporto costi/ricavi più elevato (${fmtPctErp(rapportiSede[0].rapporto)}).` });

    // fatture scadute
    const scadute = attuale.vociIncluse.filter((v) => v.spesa.stato === "scaduta");
    if (scadute.length > 0) righe.push({ tipo: "scadute", testo: `${scadute.length} fattur${scadute.length === 1 ? "a" : "e"} risulta${scadute.length === 1 ? "" : "no"} scadut${scadute.length === 1 ? "a" : "e"}, per un totale di ${fmtEuroErp(scadute.reduce((s, v) => s + v.importo, 0))}.` });

    // ambito richiesto ma mancante
    const senzaAmbito = attuale.vociIncluse.filter(({ spesa }) => {
      if (spesa.tipo_ambito === "sede" && !spesa.sede_id) return true;
      if (spesa.tipo_ambito === "corso" && !spesa.corso_id) return true;
      if (spesa.tipo_ambito === "evento" && !spesa.evento_id) return true;
      return false;
    });
    if (senzaAmbito.length > 0) righe.push({ tipo: "ambito", testo: `${senzaAmbito.length} spes${senzaAmbito.length === 1 ? "a" : "e"} indica${senzaAmbito.length === 1 ? "" : "no"} un ambito (sede/corso/evento) senza averlo selezionato.` });

    // possibili duplicati: stesso fornitore + stesso importo entro 3 giorni
    const perFornitore = {};
    attuale.vociIncluse.forEach(({ spesa }) => { if (spesa.fornitore_id) (perFornitore[spesa.fornitore_id] ||= []).push(spesa); });
    let duplicati = 0;
    Object.values(perFornitore).forEach((lista) => {
      for (let a = 0; a < lista.length; a++) {
        for (let b = a + 1; b < lista.length; b++) {
          if (lista[a].totale === lista[b].totale && lista[a].data_documento && lista[b].data_documento) {
            const diff = Math.abs(new Date(lista[a].data_documento) - new Date(lista[b].data_documento)) / 86400000;
            if (diff <= 3) duplicati++;
          }
        }
      }
    });
    if (duplicati > 0) righe.push({ tipo: "duplicati", testo: `Sono presenti ${duplicati} possibil${duplicati === 1 ? "e" : "i"} registrazion${duplicati === 1 ? "e" : "i"} duplicat${duplicati === 1 ? "a" : "e"} (stesso fornitore, stesso importo, a pochi giorni di distanza).` });

    // commissioni piattaforma sopra soglia (soglia configurata o 5% di default)
    const sogliaCommissioni = (costiSoglieAllerta || []).find((s) => s.tipo_indicatore === "commissioni_piattaforma" && s.attiva !== false)?.soglia ?? 5;
    const commissioni = attuale.vociIncluse.filter((v) => v.spesa.categoria_id === "commissioni_pagamento" && v.spesa.percentuale_commissione_effettiva != null);
    commissioni.forEach(({ spesa }) => {
      if (spesa.percentuale_commissione_effettiva > sogliaCommissioni) {
        righe.push({ tipo: "commissioni", testo: `Le commissioni ${spesa.piattaforma_pagamento || "di pagamento"} sono al ${fmtPctErp(spesa.percentuale_commissione_effettiva)}, sopra la soglia del ${fmtPctErp(sogliaCommissioni)}.` });
      }
    });

    // soglie di allerta configurate manualmente (per categoria)
    (costiSoglieAllerta || []).filter((s) => s.attiva !== false && s.tipo_indicatore === "incidenza_categoria" && s.categoria_id).forEach((s) => {
      const tot = perCategoriaAttuale[s.categoria_id] || 0;
      const pctSuTotale = totaleGenerale > 0 ? (tot / totaleGenerale) * 100 : 0;
      const superata = s.operatore === "<" ? pctSuTotale < s.soglia : pctSuTotale > s.soglia;
      if (superata && tot > 0) righe.push({ tipo: "soglia", testo: `"${costiCategorieById[s.categoria_id]?.nome}" ha superato la soglia impostata (${fmtPctErp(pctSuTotale)} contro ${fmtPctErp(s.soglia)}).` });
    });

    return righe;
  }, [spese, speseAttribuzioni, costiCategorieById, corsiDateById, costiSoglieAllerta, corsiDate, iscritti, location, range.inizio, range.fine, rangeConfronto]);

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: 14 }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 20px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>Segnalazioni gestionali</div>
          {segnalazioni.length > 0 && (
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#C0392B", color: "#fff", ...fontBody, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{segnalazioni.length}</div>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: aperto ? "rotate(180deg)" : "none" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {aperto && (
        <div style={{ padding: "0 20px 18px" }}>
          {segnalazioni.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna criticità rilevata nel periodo selezionato.</div>}
          {segnalazioni.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C0392B", marginTop: 6, flexShrink: 0 }} />
              <span style={{ ...fontBody, fontSize: 13, color: NAVY }}>{s.testo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// pannello laterale di drill-down: dettaglio di una categoria (totale,
// andamento, per sede, elenco spese, allegati)
function PannelloDrillDownCosti({ drillDown, onClose, kpi, range, location, corsi, corsiDate, fornitori, costiSottocategorie, onApriModificaSpesa, ricarica }) {
  const categoria = drillDown.categoria;
  const vociCategoria = kpi.vociIncluse.filter((v) => v.spesa.categoria_id === categoria.id);
  const totale = round2(vociCategoria.reduce((s, v) => s + v.importo, 0));
  const fornitoriById = Object.fromEntries((fornitori || []).map((f) => [f.id, f]));
  const corsiById = Object.fromEntries((corsi || []).map((c) => [c.id, c]));
  const corsiDateById = Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd]));
  const sottocategorieById = Object.fromEntries((costiSottocategorie || []).map((v) => [v.id, v]));

  const perSottocategoria = {};
  vociCategoria.forEach(({ spesa, importo }) => { perSottocategoria[spesa.sottocategoria_id] = round2((perSottocategoria[spesa.sottocategoria_id] || 0) + importo); });
  const sottocategorieOrdinate = Object.entries(perSottocategoria).map(([id, tot]) => ({ sottocategoria: sottocategorieById[id], totale: tot })).filter((s) => s.sottocategoria).sort((a, b) => b.totale - a.totale);

  const perSede = {};
  vociCategoria.forEach(({ spesa, importo }) => {
    const sedeId = spesa.sede_id || (spesa.classe_id && corsiDateById[spesa.classe_id]?.location_id) || null;
    if (sedeId) perSede[sedeId] = round2((perSede[sedeId] || 0) + importo);
  });
  const perSedeOrdinato = Object.entries(perSede).map(([id, tot]) => ({ sede: location.find((l) => l.id === id), totale: tot })).filter((s) => s.sede).sort((a, b) => b.totale - a.totale);

  async function eliminaSpesa(id) {
    if (!window.confirm("Eliminare questa spesa?")) return;
    const { error } = await supabase.from("spese").delete().eq("id", id);
    if (error) { window.alert("Errore: " + error.message); return; }
    ricarica();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#fff", width: "min(520px, 100%)", height: "100%", overflowY: "auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.8 }}>{fmtData(range.inizio)} — {fmtData(range.fine)}</div>
            <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }}>{categoria.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: MUTED, padding: 4 }} aria-label="Chiudi">×</button>
        </div>
        <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY, marginTop: 14, marginBottom: 4 }}>{fmtEuroErp(totale)}</div>
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 20 }}>{kpi.totale > 0 ? `${fmtPctErp(round1Erp((totale / kpi.totale) * 100))} dei costi totali del periodo` : "—"}</div>

        {sottocategorieOrdinate.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Composizione</div>
            {sottocategorieOrdinate.map((s) => (
              <div key={s.sottocategoria.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 13, color: NAVY }}>
                <span>{s.sottocategoria.nome}</span>
                <span style={{ fontWeight: 700 }}>{fmtEuroErp(s.totale)}</span>
              </div>
            ))}
          </div>
        )}

        {perSedeOrdinato.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Per sede</div>
            <BarraCostiPerSede dati={perSedeOrdinato} totale={perSedeOrdinato.reduce((s, r) => s + r.totale, 0)} />
          </div>
        )}

        <div>
          <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Elenco spese ({vociCategoria.length})</div>
          {vociCategoria.map(({ spesa, importo }) => (
            <div key={spesa.id} style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{spesa.descrizione || sottocategorieById[spesa.sottocategoria_id]?.nome || "Spesa"}</div>
                  <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>
                    {spesa.data_documento ? fmtData(spesa.data_documento) : "—"}
                    {spesa.fornitore_id ? ` · ${fornitoriById[spesa.fornitore_id]?.nome}` : ""}
                    {" · "}{etichettaOpzione(STATI_SPESA, spesa.stato)}
                    {spesa.classe_id && corsiDateById[spesa.classe_id] ? ` · ${corsiById[corsiDateById[spesa.classe_id].corso_id]?.nome || ""}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{fmtEuroErp(importo)}</span>
                  {spesa.allegato_path && (
                    <a href={spesa.allegato_path} target="_blank" rel="noreferrer" title="Apri allegato" style={{ display: "flex", color: NAVY }}>
                      <IconaCopiaFile size={14} />
                    </a>
                  )}
                  {onApriModificaSpesa && (
                    <button onClick={() => onApriModificaSpesa(spesa.id)} title="Modifica" style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 4, display: "flex" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  )}
                  <button onClick={() => eliminaSpesa(spesa.id)} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {vociCategoria.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna spesa in questo periodo.</div>}
        </div>
      </div>
    </div>
  );
}

function slugificaCosti(testo) {
  return testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
// amministrazione delle categorie/sotto-categorie (ora in database, non
// più una costante fissa nel codice): aggiungi/rinomina/riordina/
// disattiva, blocco cancellazione se già usata da qualche spesa, più le
// soglie di allerta configurabili
function PaginaCatalogoCategorieCosti({ costiCategorie, costiSottocategorie, spese, costiSoglieAllerta, ricarica, onBack }) {
  const [categoriaAperta, setCategoriaAperta] = useState("");
  const [nuovaCategoria, setNuovaCategoria] = useState("");
  const [testoNuovaSottocategoria, setTestoNuovaSottocategoria] = useState({});
  const [msg, setMsg] = useState("");
  const [nuovaSoglia, setNuovaSoglia] = useState({ tipo_indicatore: "incidenza_categoria", categoria_id: "", soglia: "", operatore: ">" });

  const categorieOrdinate = [...costiCategorie].sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
  const conteggioUsoCategoria = (id) => spese.filter((s) => s.categoria_id === id).length;
  const conteggioUsoSottocategoria = (id) => spese.filter((s) => s.sottocategoria_id === id).length;

  async function aggiungiCategoria() {
    const nome = nuovaCategoria.trim();
    if (!nome) return;
    const id = slugificaCosti(nome);
    if (costiCategorie.some((c) => c.id === id)) { setMsg("Esiste già una categoria con questo nome."); return; }
    const ordine = Math.max(0, ...costiCategorie.map((c) => c.ordine || 0)) + 1;
    const { error } = await supabase.from("costi_categorie").insert({ id, nome, ordine });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNuovaCategoria(""); setMsg(""); ricarica();
  }
  async function rinominaCategoria(id, nome) { await supabase.from("costi_categorie").update({ nome }).eq("id", id); ricarica(); }
  async function disattivaCategoria(cat) { await supabase.from("costi_categorie").update({ attiva: !cat.attiva }).eq("id", cat.id); ricarica(); }
  async function eliminaCategoria(cat) {
    if (conteggioUsoCategoria(cat.id) > 0) { window.alert("Questa categoria è già usata da alcune spese: disattivala invece di eliminarla."); return; }
    if (!window.confirm(`Eliminare la categoria "${cat.nome}"?`)) return;
    await supabase.from("costi_categorie").delete().eq("id", cat.id);
    ricarica();
  }
  async function spostaCategoria(cat, direzione) {
    const idx = categorieOrdinate.findIndex((c) => c.id === cat.id);
    const altro = categorieOrdinate[idx + direzione];
    if (!altro) return;
    await Promise.all([
      supabase.from("costi_categorie").update({ ordine: altro.ordine ?? 0 }).eq("id", cat.id),
      supabase.from("costi_categorie").update({ ordine: cat.ordine ?? 0 }).eq("id", altro.id),
    ]);
    ricarica();
  }

  async function aggiungiSottocategoria(categoriaId) {
    const nome = (testoNuovaSottocategoria[categoriaId] || "").trim();
    if (!nome) return;
    const id = `${categoriaId}__${slugificaCosti(nome)}`;
    if (costiSottocategorie.some((v) => v.id === id)) { setMsg("Esiste già una sotto-voce con questo nome in questa categoria."); return; }
    const esistenti = sottocategorieDiCategoria(costiSottocategorie, categoriaId);
    const ordine = Math.max(0, ...esistenti.map((v) => v.ordine || 0)) + 1;
    const { error } = await supabase.from("costi_sottocategorie").insert({ id, categoria_id: categoriaId, nome, ordine });
    if (error) { setMsg("Errore: " + error.message); return; }
    setTestoNuovaSottocategoria((prev) => ({ ...prev, [categoriaId]: "" }));
    setMsg(""); ricarica();
  }
  async function rinominaSottocategoria(id, nome) { await supabase.from("costi_sottocategorie").update({ nome }).eq("id", id); ricarica(); }
  async function disattivaSottocategoria(v) { await supabase.from("costi_sottocategorie").update({ attiva: !v.attiva }).eq("id", v.id); ricarica(); }
  async function eliminaSottocategoria(v) {
    if (conteggioUsoSottocategoria(v.id) > 0) { window.alert("Questa sotto-voce è già usata da alcune spese: disattivala invece di eliminarla."); return; }
    if (!window.confirm(`Eliminare "${v.nome}"?`)) return;
    await supabase.from("costi_sottocategorie").delete().eq("id", v.id);
    ricarica();
  }
  async function spostaSottocategoria(v, direzione) {
    const lista = sottocategorieDiCategoria(costiSottocategorie, v.categoria_id);
    const idx = lista.findIndex((x) => x.id === v.id);
    const altro = lista[idx + direzione];
    if (!altro) return;
    await Promise.all([
      supabase.from("costi_sottocategorie").update({ ordine: altro.ordine ?? 0 }).eq("id", v.id),
      supabase.from("costi_sottocategorie").update({ ordine: v.ordine ?? 0 }).eq("id", altro.id),
    ]);
    ricarica();
  }

  async function aggiungiSoglia() {
    if (!nuovaSoglia.soglia || !nuovaSoglia.categoria_id) return;
    const { error } = await supabase.from("costi_soglie_allerta").insert({ ...nuovaSoglia, soglia: parseNum(nuovaSoglia.soglia) });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNuovaSoglia({ tipo_indicatore: "incidenza_categoria", categoria_id: "", soglia: "", operatore: ">" });
    ricarica();
  }
  async function eliminaSoglia(id) { await supabase.from("costi_soglie_allerta").delete().eq("id", id); ricarica(); }

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Catalogo delle categorie</div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 20 }}>Aggiungi, rinomina, riordina o disattiva le categorie e le sotto-voci di "Analisi costi di gestione".</div>

        <div style={{ ...cardStyle, display: "flex", gap: 10 }}>
          <input style={inputStyle} placeholder="Nome della nuova categoria" value={nuovaCategoria} onChange={(e) => setNuovaCategoria(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aggiungiCategoria()} />
          <Button onClick={aggiungiCategoria}>+ Categoria</Button>
        </div>
        {msg && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 14 }}>{msg}</div>}

        {categorieOrdinate.map((cat, i) => (
          <div key={cat.id} style={{ ...cardStyle, padding: 0, overflow: "hidden", opacity: cat.attiva === false ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer" }} onClick={() => setCategoriaAperta((c) => (c === cat.id ? "" : cat.id))}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, border: "none", background: "transparent", width: "100%", padding: 0 }}
                  value={cat.nome} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => rinominaCategoria(cat.id, e.target.value)}
                />
                <div style={{ ...fontBody, fontSize: 11, color: MUTED }}>{conteggioUsoCategoria(cat.id)} spese{cat.attiva === false ? " · disattivata" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => spostaCategoria(cat, -1)} disabled={i === 0} title="Sposta su" style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D8D3C4" : NAVY, padding: 4 }}>↑</button>
                <button onClick={() => spostaCategoria(cat, 1)} disabled={i === categorieOrdinate.length - 1} title="Sposta giù" style={{ border: "none", background: "none", cursor: i === categorieOrdinate.length - 1 ? "default" : "pointer", color: i === categorieOrdinate.length - 1 ? "#D8D3C4" : NAVY, padding: 4 }}>↓</button>
                <button onClick={() => disattivaCategoria(cat)} title={cat.attiva === false ? "Riattiva" : "Disattiva"} style={{ border: `1px solid ${CREAM_BORDER}`, background: "#fff", borderRadius: 8, cursor: "pointer", color: NAVY, padding: "5px 9px", ...fontBody, fontSize: 11.5 }}>{cat.attiva === false ? "Riattiva" : "Disattiva"}</button>
                <button onClick={() => eliminaCategoria(cat)} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                </button>
                <button onClick={() => setCategoriaAperta((c) => (c === cat.id ? "" : cat.id))} title={categoriaAperta === cat.id ? "Chiudi sotto-voci" : "Apri sotto-voci"} style={{ border: "none", background: "none", cursor: "pointer", color: NAVY, padding: 4, display: "flex" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: categoriaAperta === cat.id ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
            </div>
            {categoriaAperta === cat.id && (
              <div style={{ padding: "0 18px 16px" }}>
                {sottocategorieDiCategoria(costiSottocategorie, cat.id).map((v, j, lista) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${CREAM_BORDER}`, opacity: v.attiva === false ? 0.55 : 1 }}>
                    <input style={{ ...fontBody, fontSize: 13, color: NAVY, border: "none", background: "transparent", flex: 1, padding: 0 }} value={v.nome} onChange={(e) => rinominaSottocategoria(v.id, e.target.value)} />
                    <span style={{ ...fontBody, fontSize: 10.5, color: MUTED, whiteSpace: "nowrap" }}>{conteggioUsoSottocategoria(v.id)} spese</span>
                    <button onClick={() => spostaSottocategoria(v, -1)} disabled={j === 0} title="Su" style={{ border: "none", background: "none", cursor: j === 0 ? "default" : "pointer", color: j === 0 ? "#D8D3C4" : NAVY, padding: 3, fontSize: 12 }}>↑</button>
                    <button onClick={() => spostaSottocategoria(v, 1)} disabled={j === lista.length - 1} title="Giù" style={{ border: "none", background: "none", cursor: j === lista.length - 1 ? "default" : "pointer", color: j === lista.length - 1 ? "#D8D3C4" : NAVY, padding: 3, fontSize: 12 }}>↓</button>
                    <button onClick={() => disattivaSottocategoria(v)} style={{ border: `1px solid ${CREAM_BORDER}`, background: "#fff", borderRadius: 6, cursor: "pointer", color: NAVY, padding: "3px 7px", ...fontBody, fontSize: 10.5, whiteSpace: "nowrap" }}>{v.attiva === false ? "Riattiva" : "Disattiva"}</button>
                    <button onClick={() => eliminaSottocategoria(v)} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 3, display: "flex" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input style={{ ...inputStyle, fontSize: 13 }} placeholder="Nuova sotto-voce" value={testoNuovaSottocategoria[cat.id] || ""} onChange={(e) => setTestoNuovaSottocategoria((p) => ({ ...p, [cat.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && aggiungiSottocategoria(cat.id)} />
                  <button onClick={() => aggiungiSottocategoria(cat.id)} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "none", background: NAVY, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>+ Aggiungi</button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4, marginTop: 8 }}>Soglie di allerta</div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 }}>Genera una segnalazione quando una categoria supera la percentuale indicata sul totale dei costi.</div>
        <div style={{ ...cardStyle }}>
          {(costiSoglieAllerta || []).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
              <span style={{ flex: 1, ...fontBody, fontSize: 13, color: NAVY }}>{categoriaCostoDi(costiCategorie, s.categoria_id)?.nome || "—"}</span>
              <span style={{ ...fontBody, fontSize: 13, color: NAVY }}>{s.operatore} {s.soglia}%</span>
              <button onClick={() => eliminaSoglia(s.id)} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, flex: "1 1 180px" }} value={nuovaSoglia.categoria_id} onChange={(e) => setNuovaSoglia((p) => ({ ...p, categoria_id: e.target.value }))}>
              <option value="">Scegli categoria…</option>
              {categorieOrdinate.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select style={{ ...inputStyle, flex: "0 1 70px" }} value={nuovaSoglia.operatore} onChange={(e) => setNuovaSoglia((p) => ({ ...p, operatore: e.target.value }))}>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
            </select>
            <input style={{ ...inputStyle, flex: "0 1 100px" }} inputMode="decimal" placeholder="Soglia %" value={nuovaSoglia.soglia} onChange={(e) => setNuovaSoglia((p) => ({ ...p, soglia: e.target.value }))} />
            <Button onClick={aggiungiSoglia}>+ Aggiungi soglia</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// form completo "Nuova spesa"/"Modifica spesa": tutti i campi del
// brief (identificativi, stato, ambito con ripartizione multi-ambito,
// classificazione gestionale, ricorrenza, budget/soglia per-spesa,
// allegato). Pagina intera (non modale) vista la quantità di campi
function PaginaSpesaForm({ spesaId, prefill, corsi, location, corsiDate, eventi, fornitori, costiCategorie, costiSottocategorie, spese, speseAttribuzioni, ricarica, onBack }) {
  const spesaEsistente = spesaId ? spese.find((s) => s.id === spesaId) : null;
  const attribuzioniEsistenti = spesaId ? speseAttribuzioni.filter((a) => a.spesa_id === spesaId) : [];
  // aperta da una casella del Riepilogo amministrativo di una classe:
  // categoria/sotto-categoria/ambito sono fissi e non modificabili, per
  // essere certi che la spesa finisca esattamente in quella casella
  const ambitoBloccato = !!prefill;

  const [descrizione, setDescrizione] = useState(spesaEsistente?.descrizione || "");
  const [categoriaId, setCategoriaId] = useState(prefill?.categoriaId || spesaEsistente?.categoria_id || "");
  const [sottocategoriaId, setSottocategoriaId] = useState(prefill?.sottocategoriaId || spesaEsistente?.sottocategoria_id || "");
  const [fornitoreId, setFornitoreId] = useState(spesaEsistente?.fornitore_id || "");
  const [nuovoFornitore, setNuovoFornitore] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState(spesaEsistente?.numero_documento || "");
  const [dataDocumento, setDataDocumento] = useState(spesaEsistente?.data_documento || dataOggiStr());
  const [dataPagamento, setDataPagamento] = useState(spesaEsistente?.data_pagamento || "");
  const [competenzaDa, setCompetenzaDa] = useState(spesaEsistente?.competenza_da || "");
  const [competenzaA, setCompetenzaA] = useState(spesaEsistente?.competenza_a || "");
  const [imponibile, setImponibile] = useState(spesaEsistente?.imponibile != null ? String(spesaEsistente.imponibile) : "");
  const [totale, setTotale] = useState(spesaEsistente?.totale != null ? String(spesaEsistente.totale) : "");
  const [iva, setIva] = useState(spesaEsistente?.iva_percentuale ?? 22);
  const [esenteIva, setEsenteIva] = useState(spesaEsistente ? spesaEsistente.iva_percentuale === 0 : false);
  const [stato, setStato] = useState(spesaEsistente?.stato || "pagata");
  const [metodoPagamento, setMetodoPagamento] = useState(spesaEsistente?.metodo_pagamento || "");
  const [note, setNote] = useState(spesaEsistente?.note || "");

  const [tipoAmbito, setTipoAmbito] = useState(prefill ? "classe" : spesaEsistente?.tipo_ambito || "generale");
  const [sedeId, setSedeId] = useState(spesaEsistente?.sede_id || "");
  const [corsoId, setCorsoId] = useState(spesaEsistente?.corso_id || "");
  const [classeId, setClasseId] = useState(prefill?.classeId || spesaEsistente?.classe_id || "");
  const [eventoId, setEventoId] = useState(spesaEsistente?.evento_id || "");
  const [ripartisci, setRipartisci] = useState(attribuzioniEsistenti.length > 0);
  const [righeRipartizione, setRigheRipartizione] = useState(
    attribuzioniEsistenti.length > 0
      ? attribuzioniEsistenti.map((a) => ({ tipoAmbito: a.tipo_ambito, sedeId: a.sede_id || "", corsoId: a.corso_id || "", classeId: a.classe_id || "", eventoId: a.evento_id || "", percentuale: String(a.percentuale) }))
      : [{ tipoAmbito: "sede", sedeId: "", corsoId: "", classeId: "", eventoId: "", percentuale: "100" }]
  );

  const [direttoIndiretto, setDirettoIndiretto] = useState(spesaEsistente?.diretto_indiretto || "");
  const [fissoVariabile, setFissoVariabile] = useState(spesaEsistente?.fisso_variabile || "");
  const [ricorrenteOccasionale, setRicorrenteOccasionale] = useState(spesaEsistente?.ricorrente_occasionale || "");
  const [natura, setNatura] = useState(spesaEsistente?.natura || "operativo");
  const [beneDurevole, setBeneDurevole] = useState(spesaEsistente?.bene_durevole || false);
  const [controllabilita, setControllabilita] = useState(spesaEsistente?.controllabilita || "");
  const [riducibilita, setRiducibilita] = useState(spesaEsistente?.riducibilita || "");
  const [essenzialita, setEssenzialita] = useState(spesaEsistente?.essenzialita || "");
  const [origine, setOrigine] = useState(spesaEsistente?.origine || "manuale");
  const [includiAnalisiCosti, setIncludiAnalisiCosti] = useState(spesaEsistente?.includi_analisi_costi !== false);
  const [ricorrenza, setRicorrenza] = useState(spesaEsistente?.ricorrenza || "nessuna");

  const [budgetPrevisto, setBudgetPrevisto] = useState(spesaEsistente?.budget_previsto != null ? String(spesaEsistente.budget_previsto) : "");
  const [sogliaPersonalizzata, setSogliaPersonalizzata] = useState(spesaEsistente?.soglia_allerta_personalizzata != null ? String(spesaEsistente.soglia_allerta_personalizzata) : "");
  const [responsabileCosto, setResponsabileCosto] = useState(spesaEsistente?.responsabile_costo || "");

  const [piattaformaPagamento, setPiattaformaPagamento] = useState(spesaEsistente?.piattaforma_pagamento || "");
  const [numeroTransazioni, setNumeroTransazioni] = useState(spesaEsistente?.numero_transazioni != null ? String(spesaEsistente.numero_transazioni) : "");
  const [incassatoPiattaforma, setIncassatoPiattaforma] = useState(spesaEsistente?.incassato_tramite_piattaforma != null ? String(spesaEsistente.incassato_tramite_piattaforma) : "");
  const [percentualeCommissione, setPercentualeCommissione] = useState(spesaEsistente?.percentuale_commissione_effettiva != null ? String(spesaEsistente.percentuale_commissione_effettiva) : "");

  const [allegatoFile, setAllegatoFile] = useState(null);
  const [allegatoPathEsistente, setAllegatoPathEsistente] = useState(spesaEsistente?.allegato_path || "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const ivaBloccata = esenteIva;
  const ivaEffettiva = ivaBloccata ? 0 : iva;
  function totaleDaImponibile(v, ivaPct) { return v === "" ? "" : String(round2(parseNum(v) * (1 + ivaPct / 100))); }
  function imponibileDaTotale(v, ivaPct) { return v === "" ? "" : String(round2(parseNum(v) / (1 + ivaPct / 100))); }
  function onImponibileChange(v) { setImponibile(v); setTotale(ivaBloccata ? v : totaleDaImponibile(v, ivaEffettiva)); }
  function onTotaleChange(v) { setTotale(v); setImponibile(ivaBloccata ? v : imponibileDaTotale(v, ivaEffettiva)); }
  function onIvaChange(v) { setIva(v); if (!ivaBloccata) setTotale(totaleDaImponibile(imponibile, v)); }
  function onEsenteChange(checked) { setEsenteIva(checked); setTotale(checked ? imponibile : totaleDaImponibile(imponibile, iva)); }

  const sottocategorieDisponibili = sottocategorieDiCategoria(costiSottocategorie, categoriaId);
  const opzioniSede = location.map((l) => ({ id: l.id, nome: l.nome.toUpperCase() }));
  const opzioniCorso = corsi.map((c) => ({ id: c.id, nome: c.nome.toUpperCase() }));
  const opzioniClasse = corsiDate.map((cd) => ({ id: cd.id, nome: `${fmtData(cd.data_inizio)} — ${corsi.find((c) => c.id === cd.corso_id)?.nome || ""}`.toUpperCase() }));
  const opzioniEvento = eventi.map((e) => ({ id: e.id, nome: e.nome.toUpperCase() }));

  function selettoreAmbito(tipo, sedeVal, setSedeVal, corsoVal, setCorsoVal, classeVal, setClasseVal, eventoVal, setEventoVal) {
    if (tipo === "sede") return <select style={inputStyle} value={sedeVal} onChange={(e) => setSedeVal(e.target.value)}><option value="">— scegli sede —</option>{opzioniSede.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>;
    if (tipo === "corso") return <select style={inputStyle} value={corsoVal} onChange={(e) => setCorsoVal(e.target.value)}><option value="">— scegli corso —</option>{opzioniCorso.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>;
    if (tipo === "classe") return <select style={inputStyle} value={classeVal} onChange={(e) => setClasseVal(e.target.value)}><option value="">— scegli classe —</option>{opzioniClasse.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>;
    if (tipo === "evento") return <select style={inputStyle} value={eventoVal} onChange={(e) => setEventoVal(e.target.value)}><option value="">— scegli evento —</option>{opzioniEvento.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>;
    return null;
  }

  function aggiungiRigaRipartizione() { setRigheRipartizione((p) => [...p, { tipoAmbito: "sede", sedeId: "", corsoId: "", classeId: "", eventoId: "", percentuale: "" }]); }
  function modificaRigaRipartizione(idx, campo, valore) { setRigheRipartizione((p) => p.map((r, i) => (i === idx ? { ...r, [campo]: valore } : r))); }
  function rimuoviRigaRipartizione(idx) { setRigheRipartizione((p) => p.filter((_, i) => i !== idx)); }
  const sommaPercentuali = round2(righeRipartizione.reduce((s, r) => s + (parseNum(r.percentuale) || 0), 0));

  async function salva() {
    if (!categoriaId || !sottocategoriaId) { setMsg("Scegli categoria e sotto-categoria."); return; }
    const imp = parseNum(imponibile);
    if (!imp) { setMsg("Inserisci un imponibile."); return; }
    if (ripartisci && sommaPercentuali !== 100) { setMsg(`Le percentuali di ripartizione devono sommare 100% (ora ${sommaPercentuali}%).`); return; }

    setSalvando(true);
    let fornitoreIdFinale = fornitoreId;
    if (!fornitoreIdFinale && nuovoFornitore.trim()) {
      const { data, error } = await supabase.from("fornitori").insert({ nome: nuovoFornitore.trim() }).select().single();
      if (error) { setMsg("Errore fornitore: " + error.message); setSalvando(false); return; }
      fornitoreIdFinale = data.id;
    }

    let allegatoPath = allegatoPathEsistente;
    if (allegatoFile) {
      const nomeFile = `${Date.now()}-${allegatoFile.name}`;
      const { error: erroreUpload } = await supabase.storage.from("spese-allegati").upload(nomeFile, allegatoFile);
      if (erroreUpload) { setMsg("Errore allegato: " + erroreUpload.message); setSalvando(false); return; }
      const { data: pubData } = supabase.storage.from("spese-allegati").getPublicUrl(nomeFile);
      allegatoPath = pubData.publicUrl;
    }

    const payload = {
      descrizione: descrizione.trim() || null,
      categoria_id: categoriaId, sottocategoria_id: sottocategoriaId,
      fornitore_id: fornitoreIdFinale || null,
      numero_documento: numeroDocumento.trim() || null,
      data_documento: dataDocumento || null, data_pagamento: dataPagamento || null,
      competenza_da: competenzaDa || null, competenza_a: competenzaA || null,
      imponibile: imp, iva_percentuale: ivaEffettiva, totale: totale === "" ? imp : round2(parseNum(totale)),
      allegato_path: allegatoPath || null, note: note.trim() || null,
      stato, metodo_pagamento: metodoPagamento || null,
      tipo_ambito: ripartisci ? "generale" : tipoAmbito,
      sede_id: ripartisci ? null : (tipoAmbito === "sede" ? sedeId || null : null),
      corso_id: ripartisci ? null : (tipoAmbito === "corso" ? corsoId || null : null),
      classe_id: ripartisci ? null : (tipoAmbito === "classe" ? classeId || null : null),
      evento_id: ripartisci ? null : (tipoAmbito === "evento" ? eventoId || null : null),
      diretto_indiretto: direttoIndiretto || null, fisso_variabile: fissoVariabile || null,
      ricorrente_occasionale: ricorrenteOccasionale || null, natura: natura || null,
      bene_durevole: beneDurevole, controllabilita: controllabilita || null,
      riducibilita: riducibilita || null, essenzialita: essenzialita || null,
      origine, includi_analisi_costi: includiAnalisiCosti, ricorrenza,
      budget_previsto: budgetPrevisto === "" ? null : parseNum(budgetPrevisto),
      soglia_allerta_personalizzata: sogliaPersonalizzata === "" ? null : parseNum(sogliaPersonalizzata),
      responsabile_costo: responsabileCosto.trim() || null,
      piattaforma_pagamento: piattaformaPagamento.trim() || null,
      numero_transazioni: numeroTransazioni === "" ? null : parseInt(numeroTransazioni, 10),
      incassato_tramite_piattaforma: incassatoPiattaforma === "" ? null : parseNum(incassatoPiattaforma),
      percentuale_commissione_effettiva: percentualeCommissione === "" ? null : parseNum(percentualeCommissione),
    };

    let idSpesa = spesaId;
    if (spesaId) {
      const { error } = await supabase.from("spese").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", spesaId);
      if (error) { setMsg("Errore: " + error.message); setSalvando(false); return; }
    } else {
      const { data, error } = await supabase.from("spese").insert(payload).select().single();
      if (error) { setMsg("Errore: " + error.message); setSalvando(false); return; }
      idSpesa = data.id;
    }

    await supabase.from("spese_attribuzioni").delete().eq("spesa_id", idSpesa);
    if (ripartisci) {
      const righe = righeRipartizione.filter((r) => parseNum(r.percentuale) > 0).map((r) => ({
        spesa_id: idSpesa, tipo_ambito: r.tipoAmbito,
        sede_id: r.tipoAmbito === "sede" ? r.sedeId || null : null,
        corso_id: r.tipoAmbito === "corso" ? r.corsoId || null : null,
        classe_id: r.tipoAmbito === "classe" ? r.classeId || null : null,
        evento_id: r.tipoAmbito === "evento" ? r.eventoId || null : null,
        percentuale: parseNum(r.percentuale), importo: round2(imp * (parseNum(r.percentuale) / 100)),
      }));
      if (righe.length) await supabase.from("spese_attribuzioni").insert(righe);
    }

    setSalvando(false);
    ricarica();
    onBack();
  }

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 20 }}>{spesaId ? "Modifica spesa" : "Nuova spesa"}</div>

        {ambitoBloccato && (
          <div style={{ ...cardStyle, background: BG_CHIARO, border: `1px solid ${GOLD}`, ...fontBody, fontSize: 13, color: NAVY }}>
            Spesa per <b>{opzioniClasse.find((o) => o.id === classeId)?.nome || "questa classe"}</b> — categoria <b>{costiCategorie.find((c) => c.id === categoriaId)?.nome}</b> · <b>{sottocategorieDisponibili.find((v) => v.id === sottocategoriaId)?.nome}</b>
          </div>
        )}

        <div style={{ ...cardStyle }}>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Identificativi</div>
          <Field label="Descrizione"><input style={inputStyle} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></Field>
          {!ambitoBloccato && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Categoria">
                  <select style={inputStyle} value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setSottocategoriaId(""); }}>
                    <option value="">— scegli —</option>
                    {[...costiCategorie].sort((a, b) => (a.ordine || 0) - (b.ordine || 0)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Sotto-categoria">
                  <select style={inputStyle} value={sottocategoriaId} onChange={(e) => setSottocategoriaId(e.target.value)} disabled={!categoriaId}>
                    <option value="">— scegli —</option>
                    {sottocategorieDisponibili.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="Fornitore">
                <select style={inputStyle} value={fornitoreId} onChange={(e) => setFornitoreId(e.target.value)}>
                  <option value="">— nessuno —</option>
                  {fornitori.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Nuovo fornitore (opzionale)"><input style={inputStyle} placeholder="Nome fornitore" value={nuovoFornitore} onChange={(e) => setNuovoFornitore(e.target.value)} disabled={!!fornitoreId} /></Field>
            </div>
          </div>
          <Field label="Numero documento/fattura"><input style={inputStyle} value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} /></Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}><Field label="Data documento"><input type="date" style={inputStyle} value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} /></Field></div>
            <div style={{ flex: "1 1 140px" }}><Field label="Data pagamento"><input type="date" style={inputStyle} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></Field></div>
            <div style={{ flex: "1 1 140px" }}><Field label="Competenza dal"><input type="date" style={inputStyle} value={competenzaDa} onChange={(e) => setCompetenzaDa(e.target.value)} /></Field></div>
            <div style={{ flex: "1 1 140px" }}><Field label="Competenza al"><input type="date" style={inputStyle} value={competenzaA} onChange={(e) => setCompetenzaA(e.target.value)} /></Field></div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, margin: "12px 0 6px" }}>
            <input type="checkbox" checked={esenteIva} onChange={(e) => onEsenteChange(e.target.checked)} /> Importo esente IVA
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Field label="Imponibile"><input style={inputStyle} inputMode="decimal" value={imponibile} onChange={(e) => onImponibileChange(e.target.value)} /></Field></div>
            <div style={{ flex: 1 }}>
              <Field label="IVA">
                <select style={{ ...inputStyle, background: ivaBloccata ? "#EFEFEF" : "#fff", color: ivaBloccata ? MUTED : NAVY }} disabled={ivaBloccata} value={ivaEffettiva} onChange={(e) => onIvaChange(Number(e.target.value))}>
                  {ALIQUOTE_IVA_COSTI.map((a) => <option key={a} value={a}>{a}%</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1 }}><Field label="Totale"><input style={inputStyle} inputMode="decimal" value={totale} onChange={(e) => onTotaleChange(e.target.value)} /></Field></div>
          </div>

          <Field label="Stato">
            <select style={inputStyle} value={stato} onChange={(e) => setStato(e.target.value)}>
              {STATI_SPESA.map((s) => <option key={s.chiave} value={s.chiave}>{s.etichetta}</option>)}
            </select>
          </Field>
          <Field label="Metodo di pagamento">
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...fontBody, fontSize: 13, color: NAVY }}>
              {["Paypal", "Carta", "Bonifico", "Contanti", "Cash no iva"].map((opz) => (
                <label key={opz} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="metodo-spesa" checked={metodoPagamento === opz} onChange={() => setMetodoPagamento(opz)} /> {opz}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Allegato (fattura/ricevuta)">
            <input type="file" onChange={(e) => setAllegatoFile(e.target.files?.[0] || null)} />
            {allegatoPathEsistente && !allegatoFile && <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 4 }}>Allegato già presente — scegli un file per sostituirlo.</div>}
          </Field>
          <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>

        {categoriaId === "commissioni_pagamento" && (
          <div style={{ ...cardStyle }}>
            <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Commissioni di pagamento</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}><Field label="Piattaforma"><input style={inputStyle} value={piattaformaPagamento} onChange={(e) => setPiattaformaPagamento(e.target.value)} /></Field></div>
              <div style={{ flex: "1 1 140px" }}><Field label="N. transazioni"><input style={inputStyle} inputMode="numeric" value={numeroTransazioni} onChange={(e) => setNumeroTransazioni(e.target.value)} /></Field></div>
              <div style={{ flex: "1 1 160px" }}><Field label="Incassato tramite piattaforma"><input style={inputStyle} inputMode="decimal" value={incassatoPiattaforma} onChange={(e) => setIncassatoPiattaforma(e.target.value)} /></Field></div>
              <div style={{ flex: "1 1 140px" }}><Field label="% commissione effettiva"><input style={inputStyle} inputMode="decimal" value={percentualeCommissione} onChange={(e) => setPercentualeCommissione(e.target.value)} /></Field></div>
            </div>
          </div>
        )}

        {!ambitoBloccato && (
        <div style={{ ...cardStyle }}>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Ambito di attribuzione</div>
          {!ripartisci && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Ambito">
                  <select style={inputStyle} value={tipoAmbito} onChange={(e) => setTipoAmbito(e.target.value)}>
                    {AMBITI_SPESA.map((a) => <option key={a.chiave} value={a.chiave}>{a.etichetta}</option>)}
                  </select>
                </Field>
              </div>
              {["sede", "corso", "classe", "evento"].includes(tipoAmbito) && (
                <div style={{ flex: 1 }}>
                  <Field label={AMBITI_SPESA.find((a) => a.chiave === tipoAmbito)?.etichetta}>
                    {selettoreAmbito(tipoAmbito, sedeId, setSedeId, corsoId, setCorsoId, classeId, setClasseId, eventoId, setEventoId)}
                  </Field>
                </div>
              )}
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, margin: "8px 0" }}>
            <input type="checkbox" checked={ripartisci} onChange={(e) => setRipartisci(e.target.checked)} /> Ripartisci questa spesa su più ambiti
          </label>
          {ripartisci && (
            <div>
              {righeRipartizione.map((r, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 140px" }}>
                    <Field label="Ambito">
                      <select style={inputStyle} value={r.tipoAmbito} onChange={(e) => modificaRigaRipartizione(idx, "tipoAmbito", e.target.value)}>
                        {AMBITI_SPESA.filter((a) => ["sede", "corso", "classe", "evento"].includes(a.chiave)).map((a) => <option key={a.chiave} value={a.chiave}>{a.etichetta}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <Field label="Selezione">
                      {selettoreAmbito(r.tipoAmbito,
                        r.sedeId, (v) => modificaRigaRipartizione(idx, "sedeId", v),
                        r.corsoId, (v) => modificaRigaRipartizione(idx, "corsoId", v),
                        r.classeId, (v) => modificaRigaRipartizione(idx, "classeId", v),
                        r.eventoId, (v) => modificaRigaRipartizione(idx, "eventoId", v))}
                    </Field>
                  </div>
                  <div style={{ flex: "0 1 90px" }}>
                    <Field label="%"><input style={inputStyle} inputMode="decimal" value={r.percentuale} onChange={(e) => modificaRigaRipartizione(idx, "percentuale", e.target.value)} /></Field>
                  </div>
                  <button onClick={() => rimuoviRigaRipartizione(idx)} title="Rimuovi" style={{ width: 38, height: 38, marginBottom: 14, borderRadius: 8, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: "#C0392B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={aggiungiRigaRipartizione} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "transparent", border: "none", cursor: "pointer" }}>+ Aggiungi riga</button>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: sommaPercentuali === 100 ? "#2E7D32" : "#C0392B" }}>Totale: {sommaPercentuali}%</div>
              </div>
            </div>
          )}
        </div>
        )}

        <div style={{ ...cardStyle }}>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Classificazione gestionale</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0 14px" }}>
            <Field label="Diretto/indiretto"><select style={inputStyle} value={direttoIndiretto} onChange={(e) => setDirettoIndiretto(e.target.value)}><option value="">—</option>{DIRETTO_INDIRETTO_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Fisso/variabile"><select style={inputStyle} value={fissoVariabile} onChange={(e) => setFissoVariabile(e.target.value)}><option value="">—</option>{FISSO_VARIABILE_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Ricorrente/occasionale"><select style={inputStyle} value={ricorrenteOccasionale} onChange={(e) => setRicorrenteOccasionale(e.target.value)}><option value="">—</option>{RICORRENTE_OCCASIONALE_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Natura"><select style={inputStyle} value={natura} onChange={(e) => setNatura(e.target.value)}>{NATURA_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Controllabilità"><select style={inputStyle} value={controllabilita} onChange={(e) => setControllabilita(e.target.value)}><option value="">—</option>{CONTROLLABILITA_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Riducibilità"><select style={inputStyle} value={riducibilita} onChange={(e) => setRiducibilita(e.target.value)}><option value="">—</option>{RIDUCIBILITA_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Essenzialità"><select style={inputStyle} value={essenzialita} onChange={(e) => setEssenzialita(e.target.value)}><option value="">—</option>{ESSENZIALITA_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Origine"><select style={inputStyle} value={origine} onChange={(e) => setOrigine(e.target.value)}>{ORIGINE_OPZIONI.map((o) => <option key={o.chiave} value={o.chiave}>{o.etichetta}</option>)}</select></Field>
            <Field label="Ricorrenza"><select style={inputStyle} value={ricorrenza} onChange={(e) => setRicorrenza(e.target.value)}>{RICORRENZA_OPZIONI.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, margin: "10px 0 4px" }}>
            <input type="checkbox" checked={beneDurevole} onChange={(e) => setBeneDurevole(e.target.checked)} /> Bene durevole
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, marginBottom: 4 }}>
            <input type="checkbox" checked={includiAnalisiCosti} onChange={(e) => setIncludiAnalisiCosti(e.target.checked)} /> Incluso nell'analisi dei costi
          </label>
        </div>

        <div style={{ ...cardStyle }}>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Budget e controllo</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}><Field label="Budget previsto"><input style={inputStyle} inputMode="decimal" value={budgetPrevisto} onChange={(e) => setBudgetPrevisto(e.target.value)} /></Field></div>
            <div style={{ flex: "1 1 160px" }}><Field label="Soglia di allerta personalizzata"><input style={inputStyle} inputMode="decimal" value={sogliaPersonalizzata} onChange={(e) => setSogliaPersonalizzata(e.target.value)} /></Field></div>
            <div style={{ flex: "1 1 160px" }}><Field label="Responsabile del costo"><input style={inputStyle} value={responsabileCosto} onChange={(e) => setResponsabileCosto(e.target.value)} /></Field></div>
          </div>
        </div>

        {msg && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 10 }}>{msg}</div>}
        <Button onClick={salva} disabled={salvando} style={{ width: "100%" }}>{salvando ? "Salvo…" : spesaId ? "Salva modifiche" : "Salva spesa"}</Button>
      </div>
    </div>
  );
}

// gestione budget: importo previsto per categoria/mese-o-anno/sede/corso
function PaginaBudgetCosti({ costiCategorie, location, corsi, costiBudget, ricarica, onBack }) {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [mese, setMese] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [corsoId, setCorsoId] = useState("");
  const [importo, setImporto] = useState("");
  const [msg, setMsg] = useState("");

  const categorieOrdinate = [...costiCategorie].sort((a, b) => (a.ordine || 0) - (b.ordine || 0));

  async function aggiungiBudget() {
    if (!categoriaId || !importo) { setMsg("Scegli una categoria e un importo."); return; }
    const { error } = await supabase.from("costi_budget").insert({
      anno, mese: mese === "" ? null : Number(mese), categoria_id: categoriaId,
      sede_id: sedeId || null, corso_id: corsoId || null, importo_budget: parseNum(importo),
    });
    if (error) { setMsg("Errore: " + error.message); return; }
    setImporto(""); setMsg(""); ricarica();
  }
  async function eliminaBudget(id) { await supabase.from("costi_budget").delete().eq("id", id); ricarica(); }

  return (
    <div style={{ background: "#F7F5EF", minHeight: "100vh", padding: "40px 20px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={onBack} title="Indietro" style={{ background: "transparent", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4, marginLeft: -4 }}><IconaFrecciaSinistra size={20} /></button>
          <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1.2 }}>Contabilità</div>
        </div>
        <div style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, color: NAVY, marginBottom: 20 }}>Budget</div>

        <div style={{ ...cardStyle }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 100px" }}><Field label="Anno"><input style={inputStyle} inputMode="numeric" value={anno} onChange={(e) => setAnno(Number(e.target.value) || anno)} /></Field></div>
            <div style={{ flex: "1 1 120px" }}>
              <Field label="Mese (vuoto = annuale)">
                <select style={inputStyle} value={mese} onChange={(e) => setMese(e.target.value)}>
                  <option value="">Tutto l'anno</option>
                  {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <Field label="Categoria">
                <select style={inputStyle} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">— scegli —</option>
                  {categorieOrdinate.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Field label="Sede (opzionale)">
                <select style={inputStyle} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                  <option value="">Tutte</option>
                  {location.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Field label="Corso (opzionale)">
                <select style={inputStyle} value={corsoId} onChange={(e) => setCorsoId(e.target.value)}>
                  <option value="">Tutti</option>
                  {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: "1 1 140px" }}><Field label="Importo budget"><input style={inputStyle} inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} /></Field></div>
          </div>
          {msg && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 8 }}>{msg}</div>}
          <Button onClick={aggiungiBudget}>+ Aggiungi budget</Button>
        </div>

        <div style={{ ...cardStyle }}>
          {[...costiBudget].sort((a, b) => (b.anno - a.anno) || ((b.mese || 0) - (a.mese || 0))).map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
              <span style={{ ...fontBody, fontSize: 12.5, color: MUTED, minWidth: 90 }}>{b.mese ? `${MESI[b.mese - 1]} ${b.anno}` : `Anno ${b.anno}`}</span>
              <span style={{ flex: 1, ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>
                {categoriaCostoDi(costiCategorie, b.categoria_id)?.nome || "—"}
                {b.sede_id ? ` · ${location.find((l) => l.id === b.sede_id)?.nome || ""}` : ""}
                {b.corso_id ? ` · ${corsi.find((c) => c.id === b.corso_id)?.nome || ""}` : ""}
              </span>
              <span style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{fmtEuroErp(b.importo_budget)}</span>
              <button onClick={() => eliminaBudget(b.id)} title="Elimina" style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </div>
          ))}
          {costiBudget.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun budget impostato.</div>}
        </div>
      </div>
    </div>
  );
}

// esporta le spese incluse nel periodo/filtri correnti come CSV (con
// BOM, così Excel lo apre correttamente senza problemi di accenti)
function esportaCsvSpese(vociIncluse, costiCategorieById, costiSottocategorieById) {
  const intestazione = ["Data documento", "Categoria", "Sotto-categoria", "Descrizione", "Fornitore", "Imponibile", "Stato"];
  const righe = vociIncluse.map(({ spesa, importo }) => [
    spesa.data_documento || "", costiCategorieById[spesa.categoria_id]?.nome || "", costiSottocategorieById[spesa.sottocategoria_id]?.nome || "",
    spesa.descrizione || "", "", importo, etichettaOpzione(STATI_SPESA, spesa.stato),
  ]);
  const csv = [intestazione, ...righe].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `analisi-costi-${dataOggiStr()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// parsing minimale di un CSV con intestazione: descrizione,categoria_id,sottocategoria_id,imponibile,iva_percentuale,data_documento,fornitore
function parseCsvSpese(testo) {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim() !== "");
  if (righe.length < 2) return [];
  const intestazione = righe[0].split(",").map((h) => h.trim().toLowerCase());
  return righe.slice(1).map((riga) => {
    const valori = riga.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    intestazione.forEach((h, i) => { obj[h] = valori[i] || ""; });
    return obj;
  });
}
// pannello di import CSV: anteprima + controllo duplicati (stesso
// imponibile e stessa data già presenti) prima di confermare l'inserimento
function PannelloImportCsv({ costiCategorie, costiSottocategorie, spese, onClose, ricarica }) {
  const [righe, setRighe] = useState([]);
  const [msg, setMsg] = useState("");
  const [importando, setImportando] = useState(false);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsate = parseCsvSpese(String(reader.result));
      const conDuplicato = parsate.map((r) => ({
        ...r,
        possibileDuplicato: spese.some((s) => String(s.imponibile) === r.imponibile && s.data_documento === r.data_documento),
      }));
      setRighe(conDuplicato);
    };
    reader.readAsText(file);
  }
  async function confermaImport() {
    const daImportare = righe.filter((r) => !r.possibileDuplicato && r.categoria_id && r.imponibile);
    if (daImportare.length === 0) { setMsg("Nessuna riga valida da importare."); return; }
    setImportando(true);
    const { error } = await supabase.from("spese").insert(daImportare.map((r) => ({
      descrizione: r.descrizione || null, categoria_id: r.categoria_id, sottocategoria_id: r.sottocategoria_id || null,
      imponibile: parseNum(r.imponibile), iva_percentuale: r.iva_percentuale ? parseNum(r.iva_percentuale) : 22,
      totale: round2(parseNum(r.imponibile) * (1 + (r.iva_percentuale ? parseNum(r.iva_percentuale) : 22) / 100)),
      data_documento: r.data_documento || null, origine: "importato", stato: "pagata",
    })));
    setImportando(false);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
    onClose();
  }

  return (
    <Modal title="Importa spese da CSV" onClose={onClose}>
      <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 12 }}>
        Colonne attese: descrizione, categoria_id, sottocategoria_id, imponibile, iva_percentuale, data_documento
      </div>
      <input type="file" accept=".csv" onChange={onFile} style={{ marginBottom: 14 }} />
      {righe.length > 0 && (
        <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, marginBottom: 14 }}>
          {righe.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12.5, color: r.possibileDuplicato ? MUTED : NAVY }}>
              <span>{r.descrizione || r.categoria_id}{r.possibileDuplicato ? " — possibile duplicato, escluso" : ""}</span>
              <span style={{ fontWeight: 700 }}>{r.imponibile}</span>
            </div>
          ))}
        </div>
      )}
      {msg && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 10 }}>{msg}</div>}
      <Button onClick={confermaImport} disabled={importando || righe.length === 0} style={{ width: "100%" }}>{importando ? "Importo…" : `Importa ${righe.filter((r) => !r.possibileDuplicato).length} righe`}</Button>
    </Modal>
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
    const tipoBiglietti = new URLSearchParams(window.location.search).get("tipo");
    return <VistaBiglietti param={paramBiglietti} tipo={tipoBiglietti} />;
  }
  // se il link contiene ?modelle=<id>, mostro solo l'elenco dei trattamenti
  // richiesti per questa classe (nessun dato personale/di pagamento)
  const paramModelle = new URLSearchParams(window.location.search).get("modelle");
  if (paramModelle) {
    return <VistaRicercaModelle param={paramModelle} />;
  }

  const [ok, setOk] = useState(sessionStorage.getItem("edc_ok") === "1");
  // chi ha fatto accesso: "user" (password generica, tutti), "amministratore"
  // o "programmatore" (entra ovunque senza dover reinserire nessun'altra
  // password) — deciso dal Gate in base a quale delle password corrisponde
  const [ruoloUtente, setRuoloUtente] = useState(sessionStorage.getItem("edc_ruolo") || "user");
  const isMobile = useIsMobile();
  const [view, setView] = useState("home");
  // login venditore dalla home: vanno dichiarati qui (prima dei return
  // anticipati di Gate/Caricamento più sotto), altrimenti in alcuni render
  // questi due hook non verrebbero chiamati per niente, violando le regole
  // degli Hook e mandando in crash l'intera app con schermo bianco
  const [mostraLoginVenditore, setMostraLoginVenditore] = useState(false);
  // true quando si è entrati nella scheda direttamente da "Gestione
  // modelle" (apriDataModelle, che salta la lista allievi e apre subito
  // "Assegna modelle"): il tasto "torna" della scheda deve allora uscire
  // verso Gestione modelle invece che verso una lista mai mostrata
  const [vieneDaGestioneModelle, setVieneDaGestioneModelle] = useState(false);
  const [venditoreLoggato, setVenditoreLoggato] = useState(null);
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
  // "Analisi costi di gestione": catalogo categorie/sotto-categorie (amministrabile), registro spese, ripartizioni multi-ambito, budget, soglie di allerta, ambiti evento/fornitore
  const [costiCategorie, setCostiCategorie] = useState([]);
  const [costiSottocategorie, setCostiSottocategorie] = useState([]);
  const [eventi, setEventi] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [spese, setSpese] = useState([]);
  const [speseAttribuzioni, setSpeseAttribuzioni] = useState([]);
  const [costiBudget, setCostiBudget] = useState([]);
  const [costiSoglieAllerta, setCostiSoglieAllerta] = useState([]);
  // incassi occasionali non legati a un'iscrizione (es. vendita di un
  // prodotto in accademia), inseriti da "+ Nuova operazione" > "Entrata"
  const [entrateManuali, setEntrateManuali] = useState([]);
  // ordini importati automaticamente dallo shop WooCommerce (webhook +
  // import storico una tantum, entrambi via Edge Function)
  const [venditeShop, setVenditeShop] = useState([]);
  // catalogo prodotti WooCommerce (sincronizzato da woo-sync-catalogo)
  const [categorieProdotti, setCategorieProdotti] = useState([]);
  const [prodottiShop, setProdottiShop] = useState([]);
  const [prodottiCategorie, setProdottiCategorie] = useState([]);
  const [prodottiImmagini, setProdottiImmagini] = useState([]);
  // template dei giorni di ogni corso-tipo (Modella del Master/Allievi per giorno)
  const [corsiGiorni, setCorsiGiorni] = useState([]);
  // catalogo generale dei tipi di modella + quali sono selezionabili per ciascun corso
  const [tipiModella, setTipiModella] = useState([]);
  const [corsiTipiModella, setCorsiTipiModella] = useState([]);
  // venditori/tutor selezionabili in fase di iscrizione
  const [venditori, setVenditori] = useState([]);
  const [passwordMenu, setPasswordMenu] = useState([]);
  const [spesaInModifica, setSpesaInModifica] = useState(null);
  // quando "Nuova spesa" si apre da una casella del Riepilogo
  // amministrativo di una classe (non da "Analisi costi di gestione"):
  // precompila e blocca categoria/sotto-categoria/classe, e al termine
  // riporta alla scheda della classe invece che al catalogo costi
  const [spesaPrefill, setSpesaPrefill] = useState(null);
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
    const [c, l, cd, i, m, h, a, lv, fd, de, sg, li, lc, cc, cs, ev, fo, sp, sa, cb, csa, em, vs, cp, ps, pc, pi, cg, tm, ctm, ve, pm] = await Promise.all([
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
      supabase.from("costi_categorie").select("*").order("ordine"),
      supabase.from("costi_sottocategorie").select("*").order("ordine"),
      supabase.from("eventi").select("*").order("data_inizio", { ascending: false }),
      supabase.from("fornitori").select("*").order("nome"),
      supabase.from("spese").select("*").order("data_documento", { ascending: false }),
      supabase.from("spese_attribuzioni").select("*"),
      supabase.from("costi_budget").select("*"),
      supabase.from("costi_soglie_allerta").select("*"),
      supabase.from("entrate_manuali").select("*").order("data", { ascending: false }),
      supabase.from("vendite_shop").select("*").order("data_ordine", { ascending: false }),
      supabase.from("categorie_prodotti").select("*").order("nome"),
      supabase.from("prodotti_shop").select("*").order("nome"),
      supabase.from("prodotti_categorie").select("*"),
      supabase.from("prodotti_immagini").select("*"),
      supabase.from("corsi_giorni").select("*").order("numero_giorno"),
      supabase.from("tipi_modella").select("*").order("nome"),
      supabase.from("corsi_tipi_modella").select("*"),
      // niente password_hash/password_salt qui: quelle due colonne le
      // scrive solo l'Edge Function venditori-imposta-password, l'app non
      // le legge mai — così non finiscono nel browser di chi la usa
      // niente "telefono" qui: è una colonna a sé (Setting > Gestione
      // venditori la interroga da sola) — se in un futuro dovesse mai
      // mancare/dare errore, non deve poter svuotare l'elenco venditori
      // usato ovunque per login e selezione "Tutor"
      supabase.from("venditori").select("id, nome, ts").order("nome"),
      supabase.from("password_menu").select("*"),
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
    setCostiCategorie(cc.data || []);
    setCostiSottocategorie(cs.data || []);
    setEventi(ev.data || []);
    setFornitori(fo.data || []);
    setSpese(sp.data || []);
    setSpeseAttribuzioni(sa.data || []);
    setCostiBudget(cb.data || []);
    setCostiSoglieAllerta(csa.data || []);
    setEntrateManuali(em.data || []);
    setVenditeShop(vs.data || []);
    setCategorieProdotti(cp.data || []);
    setProdottiShop(ps.data || []);
    setProdottiCategorie(pc.data || []);
    setProdottiImmagini(pi.data || []);
    setCorsiGiorni(cg.data || []);
    setTipiModella(tm.data || []);
    setCorsiTipiModella(ctm.data || []);
    setVenditori(ve.data || []);
    setPasswordMenu(pm.data || []);
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

  // tasto/gesto "Indietro" fisico di Android: essendo una web app senza un
  // vero router, di default farebbe uscire dall'app (torna alla pagina
  // precedente nella cronologia del browser). Si tiene sempre un
  // "cuscinetto" nella cronologia del browser (una voce in più, aggiunta
  // subito dopo ogni pressione): quando arriva, invece di lasciar uscire,
  // si va indietro DENTRO l'app (stessa funzione di "Indietro" in alto) —
  // mai più un'uscita accidentale. Il ref tiene sempre l'ultima versione
  // di vaiIndietro (cambia ad ogni render), pur registrando l'ascoltatore
  // una sola volta sola al montaggio
  const vaiIndietroRef = React.useRef(vaiIndietro);
  vaiIndietroRef.current = vaiIndietro;
  useEffect(() => {
    window.history.pushState({ elitederma: true }, "");
    function onPopState() {
      window.history.pushState({ elitederma: true }, "");
      vaiIndietroRef.current();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  if (!ok) return <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}><Gate onOk={(ruolo) => { setRuoloUtente(ruolo); setOk(true); }} /></div>;

  if (loading) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  function apriData(cd) {
    setVieneDaGestioneModelle(false);
    setCorsoDataAperta(cd.id);
    setSottoVistaScheda({ vista: "lista", modificandoId: null, mostraGestione: false });
    setSchedaKey((k) => k + 1);
    setView("scheda");
  }
  // come apriData, ma entra direttamente nella tab "Assegna modelle"
  // invece che nella lista iscritti — usata da "Gestione modelle". Segna
  // anche la provenienza: da qui il tasto "torna" nella scheda deve
  // uscire verso Gestione modelle, non verso la lista allievi (che in
  // questo percorso non è mai stata mostrata)
  function apriDataModelle(cd) {
    setVieneDaGestioneModelle(true);
    setCorsoDataAperta(cd.id);
    setSottoVistaScheda({ vista: "modelle", modificandoId: null, mostraGestione: false });
    setSchedaKey((k) => k + 1);
    setView("scheda");
  }
  // login venditore dalla home: mostra la tendina nome+password; se il
  // venditore entra, venditoreLoggato blocca la Dashboard venditori sui
  // suoi soli dati; se entra con il codice amministratore, venditoreLoggato
  // resta null e la Dashboard si apre sbloccata (tendina "scegli venditore")
  // password di sistema (Amministratore/Programmatore/rotellina): valore
  // impostato dalla rotellina se presente, altrimenti quello di sempre
  function passwordSistema(chiave, fallback) {
    return passwordMenu.find((p) => p.vista === chiave)?.password || fallback;
  }
  function apriLoginVenditore() {
    // il Programmatore entra ovunque senza reinserire nessuna password
    if (ruoloUtente === "programmatore") { setVenditoreLoggato(null); setView("dashboardvenditori"); return; }
    setMostraLoginVenditore(true);
  }
  function onEntraVenditore({ modalitaAdmin, venditoreId, nome }) {
    setMostraLoginVenditore(false);
    setVenditoreLoggato(modalitaAdmin ? null : { id: venditoreId, nome });
    setView("dashboardvenditori");
  }
  // toglie l'accesso (sia quello generale che quello amministratore) e
  // mostra di nuovo il Gate: unico modo per "sloggarsi" in un'app senza
  // account individuali, un solo codice condiviso per l'intera sessione
  function esci() {
    sessionStorage.removeItem("edc_ok");
    sessionStorage.removeItem("edc_admin_ok");
    sessionStorage.removeItem("edc_ruolo");
    Object.keys(sessionStorage).filter((k) => k.startsWith("edc_ok_")).forEach((k) => sessionStorage.removeItem(k));
    setOk(false);
  }
  // Ogni voce protetta ha il proprio sblocco di sessione (edc_ok_<vista>):
  // entrare in una non sblocca automaticamente le altre. La password
  // richiesta è quella impostata per quella vista nella rotellina
  // (Impostazioni > password menù); se non è stata impostata, o se si
  // digita comunque il codice amministratore generale, funziona sempre
  // anche quello, come prima. Il Programmatore salta subito la richiesta.
  function apriViewProtetta(nomeView) {
    if (ruoloUtente === "programmatore") { setView(nomeView); return; }
    const chiaveSessione = "edc_ok_" + nomeView;
    if (sessionStorage.getItem(chiaveSessione) === "1") { setView(nomeView); return; }
    const rigaPassword = passwordMenu.find((p) => p.vista === nomeView);
    const codiceRichiesto = (rigaPassword?.password || "").trim();
    const codiceAdmin = passwordSistema("__admin", ADMIN_CODE);
    const codice = window.prompt("Codice per accedere:");
    if (codice === null) return;
    if (codiceRichiesto && codice === codiceRichiesto) {
      sessionStorage.setItem(chiaveSessione, "1");
      setView(nomeView);
    } else if (codiceAdmin && codice === codiceAdmin) {
      sessionStorage.setItem(chiaveSessione, "1");
      sessionStorage.setItem("edc_admin_ok", "1");
      setView(nomeView);
    } else {
      window.alert("Codice non corretto.");
    }
  }
  // rotellina in home: codice distinto da quello amministratore (anche lui
  // modificabile qui dentro), apre il pannello dove impostare tutte le
  // password di sistema e quelle delle singole voci del menù. Il
  // Programmatore salta subito la richiesta.
  function apriRotellinaPassword() {
    if (ruoloUtente === "programmatore") { setView("passwordmenu"); return; }
    const codiceRichiesto = passwordSistema("__rotellina", CODICE_ROTELLINA);
    const codice = window.prompt("Codice per impostare le password del menù:");
    if (codice === null) return;
    if (codice === codiceRichiesto) {
      setView("passwordmenu");
    } else {
      window.alert("Codice non corretto.");
    }
  }
  function apriStatistiche() { apriViewProtetta("statistiche"); }
  function apriImpostazioni() { apriViewProtetta("impostazioni"); }
  function apriGestioneDate() { apriViewProtetta("gestionedate"); }
  function apriErp() { apriViewProtetta("erp"); }
  function apriCostiOperativi() { apriViewProtetta("costioperativi"); }
  function apriVenditeShop() { apriViewProtetta("venditeshop"); }
  function apriMagazzino() { apriViewProtetta("magazzino"); }
  function apriGestioneShop() { apriViewProtetta("gestioneshop"); }
  function apriGenerazioneLoghi() { apriViewProtetta("generazioneloghi"); }
  function apriGestioneModelle() { apriViewProtetta("gestionemodelle"); }
  function apriCatalogoCategorieCosti() { apriViewProtetta("catalogocategoriecosti"); }
  function apriBudgetCosti() { apriViewProtetta("budgetcosti"); }
  function apriNuovaSpesa() { setSpesaInModifica(null); setSpesaPrefill(null); apriViewProtetta("spesaform"); }
  function apriModificaSpesa(id) { setSpesaInModifica(id); setSpesaPrefill(null); apriViewProtetta("spesaform"); }
  function apriNuovaSpesaPerClasse(classeId, categoriaId, sottocategoriaId) {
    setSpesaInModifica(null);
    setSpesaPrefill({ classeId, categoriaId, sottocategoriaId });
    apriViewProtetta("spesaform");
  }
  // apre direttamente la pagina di modifica di un iscritto (non solo
  // l'elenco della sua classe): usato da "Ultime iscrizioni", dove ogni
  // riga rappresenta un'iscrizione specifica su cui si vuole entrare subito
  function apriIscritto(i) {
    window.scrollTo(0, 0);
    setVieneDaGestioneModelle(false);
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
          <button
            onClick={apriRotellinaPassword}
            aria-label="Password menù"
            title="Password menù"
            style={{
              background: "#F1ECDF", color: NAVY, border: "none", borderRadius: "50%",
              width: 38, height: 38, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
      {/* riserva lo spazio occupato dalla barra fissa qui sopra, altrimenti
          (essendo "position:fixed") coprirebbe l'inizio del contenuto di
          ogni schermata invece di limitarsi ad affiancarlo */}
      <div style={{ height: 76 }} />
      {view === "home" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "12px 16px 16px" : "28px 28px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: isMobile ? 8 : 18, borderBottom: `1px solid ${CREAM_BORDER}`, marginBottom: isMobile ? 12 : 28 }}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: 1.2 }}>ELITEDERMA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY }}>{toTitleCase(ruoloUtente)}</span>
              <button onClick={esci} style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Esci</button>
            </div>
          </div>

          <div style={{ ...fontDisplay, fontSize: isMobile ? 21 : 34, fontWeight: 700, color: NAVY, marginBottom: isMobile ? 2 : 6 }}>Gestionale Academy</div>
          <div style={{ ...fontBody, fontSize: isMobile ? 12 : 14, color: MUTED, marginBottom: isMobile ? 12 : 26 }}>Scegli l'area da gestire.</div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 8 : 14 }}>
            <TileHome title="Gestione corsi" onClick={apriGestioneDate} />
            <TileHome title="Dashboard venditori" onClick={apriLoginVenditore} />
            <TileHome title="ERP / Magazzino" onClick={apriErp} />
            <TileHome title="Logistica prodotti" attivo={false} />
            <TileHome title="Assegna logo" onClick={apriGenerazioneLoghi} />
            <TileHome title="Gestione modelle" onClick={apriGestioneModelle} />
            <TileHome title="Statistiche" onClick={apriStatistiche} />
            <TileHome title="Setting" onClick={apriImpostazioni} />
          </div>
        </div>
      )}

      {mostraLoginVenditore && (
        <ModaleLoginVenditore venditori={venditori} onClose={() => setMostraLoginVenditore(false)} onEntra={onEntraVenditore} codiceAdmin={passwordSistema("__admin", ADMIN_CODE)} />
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
        <Impostazioni corsi={corsi} location={location} master={master} hotel={hotel} assistente={assistente} leva={leva} corsiGiorni={corsiGiorni} tipiModella={tipiModella} corsiTipiModella={corsiTipiModella} venditori={venditori} ricarica={fetchDati} onBack={() => setView("home")} onApriAssegnazioneMaster={() => setView("assegnazionemaster")} onApriFontDiplomi={() => setView("fontdiplomi")} onApriSettingLoghi={() => setView("settingloghi")} />
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

      {view === "erp" && (
        <PaginaErp
          corsi={corsi} location={location} master={master} corsiDate={corsiDate} iscritti={iscritti}
          spese={spese} costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie} entrateManuali={entrateManuali}
          ricarica={fetchDati}
          onBack={() => setView("home")}
          onApriGestioneDate={apriGestioneDate}
          onApriImpostazioni={apriImpostazioni}
          onApriCercaIscritto={() => setView("cercaiscritto")}
          onApriCostiOperativi={apriCostiOperativi}
          onApriNuovaSpesa={apriNuovaSpesa}
          onApriVenditeShop={apriVenditeShop}
          onApriMagazzino={apriMagazzino}
        />
      )}

      {view === "venditeshop" && (
        <PaginaVenditeShop venditeShop={venditeShop} onBack={() => setView("erp")} />
      )}

      {view === "magazzino" && (
        <PaginaMagazzino
          categorieProdotti={categorieProdotti} prodottiShop={prodottiShop} prodottiCategorie={prodottiCategorie}
          venditeShop={venditeShop} ricarica={fetchDati} onBack={() => setView("erp")}
          onApriGestioneShop={apriGestioneShop}
        />
      )}

      {view === "gestioneshop" && (
        <PaginaGestioneShop
          categorieProdotti={categorieProdotti} prodottiShop={prodottiShop} prodottiCategorie={prodottiCategorie}
          prodottiImmagini={prodottiImmagini} ricarica={fetchDati} onBack={() => setView("magazzino")}
        />
      )}

      {view === "costioperativi" && (
        <PaginaAnalisiCosti
          corsi={corsi} location={location} master={master} corsiDate={corsiDate} iscritti={iscritti}
          costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie} eventi={eventi} fornitori={fornitori}
          spese={spese} speseAttribuzioni={speseAttribuzioni} costiBudget={costiBudget} costiSoglieAllerta={costiSoglieAllerta}
          ricarica={fetchDati} onBack={() => setView("erp")}
          onApriCatalogo={apriCatalogoCategorieCosti} onApriBudget={apriBudgetCosti}
          onApriNuovaSpesa={apriNuovaSpesa} onApriModificaSpesa={apriModificaSpesa}
        />
      )}

      {view === "catalogocategoriecosti" && (
        <PaginaCatalogoCategorieCosti
          costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie} spese={spese} costiSoglieAllerta={costiSoglieAllerta}
          ricarica={fetchDati} onBack={() => setView("costioperativi")}
        />
      )}

      {view === "budgetcosti" && (
        <PaginaBudgetCosti
          costiCategorie={costiCategorie} location={location} corsi={corsi} costiBudget={costiBudget}
          ricarica={fetchDati} onBack={() => setView("costioperativi")}
        />
      )}

      {view === "spesaform" && (
        <PaginaSpesaForm
          spesaId={spesaInModifica}
          prefill={spesaPrefill}
          corsi={corsi} location={location} corsiDate={corsiDate} eventi={eventi} fornitori={fornitori}
          costiCategorie={costiCategorie} costiSottocategorie={costiSottocategorie}
          spese={spese} speseAttribuzioni={speseAttribuzioni}
          ricarica={fetchDati}
          onBack={() => { if (spesaPrefill) { setSpesaPrefill(null); setView("scheda"); } else { setView("costioperativi"); } }}
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

      {view === "dashboardvenditori" && (
        <PaginaDashboardVenditori
          corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master} venditori={venditori}
          ricarica={fetchDati} onBack={() => { setVenditoreLoggato(null); setView("home"); }} apriData={apriData}
          venditoreBloccato={venditoreLoggato}
          filtroCorsoHome={filtroCorsoHome} setFiltroCorsoHome={setFiltroCorsoHome}
          filtroCittaHome={filtroCittaHome} setFiltroCittaHome={setFiltroCittaHome}
          filtroMasterHome={filtroMasterHome} setFiltroMasterHome={setFiltroMasterHome}
          cronologicoHome={cronologicoHome} setCronologicoHome={setCronologicoHome}
          apriFiltroCorsoHome={apriFiltroCorsoHome} setApriFiltroCorsoHome={setApriFiltroCorsoHome}
          apriFiltroCittaHome={apriFiltroCittaHome} setApriFiltroCittaHome={setApriFiltroCittaHome}
          apriFiltroMasterHome={apriFiltroMasterHome} setApriFiltroMasterHome={setApriFiltroMasterHome}
          selectFiltroCorsoHomeRef={selectFiltroCorsoHomeRef} selectFiltroCittaHomeRef={selectFiltroCittaHomeRef} selectFiltroMasterHomeRef={selectFiltroMasterHomeRef}
        />
      )}

      {view === "gestionemodelle" && (
        <PaginaGestioneModelle
          corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master} corsiGiorni={corsiGiorni}
          ricarica={fetchDati} onBack={() => setView("home")} apriDataModelle={apriDataModelle}
          filtroCorsoHome={filtroCorsoHome} setFiltroCorsoHome={setFiltroCorsoHome}
          filtroCittaHome={filtroCittaHome} setFiltroCittaHome={setFiltroCittaHome}
          filtroMasterHome={filtroMasterHome} setFiltroMasterHome={setFiltroMasterHome}
          cronologicoHome={cronologicoHome} setCronologicoHome={setCronologicoHome}
          apriFiltroCorsoHome={apriFiltroCorsoHome} setApriFiltroCorsoHome={setApriFiltroCorsoHome}
          apriFiltroCittaHome={apriFiltroCittaHome} setApriFiltroCittaHome={setApriFiltroCittaHome}
          apriFiltroMasterHome={apriFiltroMasterHome} setApriFiltroMasterHome={setApriFiltroMasterHome}
          selectFiltroCorsoHomeRef={selectFiltroCorsoHomeRef} selectFiltroCittaHomeRef={selectFiltroCittaHomeRef} selectFiltroMasterHomeRef={selectFiltroMasterHomeRef}
        />
      )}

      {view === "passwordmenu" && (
        <PaginaPasswordMenu passwordMenu={passwordMenu} ricarica={fetchDati} onBack={() => setView("home")} />
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
          costiCategorie={costiCategorie}
          costiSottocategorie={costiSottocategorie}
          spese={spese}
          corsiGiorni={corsiGiorni}
          tipiModella={tipiModella}
          corsiTipiModella={corsiTipiModella}
          venditori={venditori}
          ricarica={fetchDati}
          onBack={() => setView("home")}
          sottoVistaIniziale={sottoVistaScheda}
          onCambiaSottoVista={setSottoVistaScheda}
          onApriNuovaSpesaPerClasse={apriNuovaSpesaPerClasse}
          origineGestioneModelle={vieneDaGestioneModelle}
          onTornaGestioneModelle={() => setView("gestionemodelle")}
        />
      )}
    </div>
  );
}
