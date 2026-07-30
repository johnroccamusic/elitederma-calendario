import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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

const fontDisplay = { fontFamily: "'Roboto',sans-serif", fontWeight: 500 };
const fontBody = { fontFamily: "'Roboto',sans-serif" };

// larghezze di default delle colonne della tabella "Assegnazione Master"
// (l'utente può trascinarle: la scelta resta salvata in localStorage)
const LARGHEZZE_COLONNE_DEFAULT = [54, 100, 70, 60, 100, 90, 100, 90, 150, 100, 100];
const CHIAVE_LARGHEZZE_COLONNE = "assegnazioneMaster_larghezzeColonne";
const ETICHETTE_COLONNE_MASTER = ["Data", "Corso", "Città", "Sede OK?", "Master", "Note", "Assistenti", "Leve", "Viaggio", "Alloggio", "Note viaggio"];

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
const COLORE_SABATO = "#F4F9FD"; // celeste tenuissimo, indice 5 = S
const COLORE_DOMENICA = "#FBEAEA"; // rosso tenuissimo, indice 6 = D

function fmtData(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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
// etichetta breve per le barre del calendario: nome corso (max 10 caratteri) + sigla città
function etichettaBarra(corso, loc) {
  const nome = (corso?.nome || "").toUpperCase().slice(0, 10);
  return `${nome} ${siglaCitta(loc?.nome)}`;
}

// ---------- Card / pulsanti base ----------
function CardHome({ title, sub, onClick }) {
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

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
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
function ivaDiQuota(q) {
  if (q.imponibile === "" && q.totale === "") return "";
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

function TopBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
      <button onClick={onBack} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", fontSize: 20, color: NAVY }}>
        &larr;
      </button>
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

  const filtriAttivi = filtroCorso || filtroCitta || filtroMaster || filtroAssistente || filtroLeva;

  const righe = corsiDate
    .filter((cd) => cd.data_fine >= dataOggiStr())
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

  // quanti corsi (tra le edizioni future, indipendentemente dai filtri attivi)
  // ha già ricevuto ciascuna master, per la barra riassuntiva in alto
  const conteggioMaster = {};
  corsiDate.filter((cd) => cd.data_fine >= dataOggiStr() && cd.master_id).forEach((cd) => {
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
function Statistiche({ onBack, onApriVenditori }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Statistiche" onBack={onBack} />
      <CardHome title="Statistica venditori" sub="Iscrizioni fatte da ciascun venditore, per corso" onClick={onApriVenditori} />
    </div>
  );
}

// quante iscrizioni ha fatto ciascun venditore (campo "Tutor" nella scheda
// iscritto), nel periodo scelto, con il dettaglio corso per corso
function StatisticaVenditori({ corsi, corsiDate, iscritti, onBack }) {
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [periodoSel, setPeriodoSel] = useState("");

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
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Venditore</th>
                <th style={thStyle}>Totale</th>
                {colonneCorsi.map((c) => <th key={c} style={thStyle}>{c} {totaliCorso[c]}</th>)}
              </tr>
            </thead>
            <tbody>
              {righeVenditori.map((r) => (
                <tr key={r.nome}>
                  <td style={{ ...celStyle, ...fontBody, fontSize: 13, color: NAVY, fontWeight: 600 }}>{r.nome}</td>
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
      )}
    </div>
  );
}

// ---------- Impostazioni ----------
function Impostazioni({ corsi, location, corsiDate, iscritti, master, hotel, assistente, leva, ricarica, onBack, onApriAssegnazioneMaster }) {
  const [nomeCorso, setNomeCorso] = useState("");
  const [colore, setColore] = useState("#4A90D9");
  const [postiMax, setPostiMax] = useState(10);
  const [nomeLoc, setNomeLoc] = useState("");
  const [postiMaxLoc, setPostiMaxLoc] = useState("");
  const [popupNuovaData, setPopupNuovaData] = useState(null);
  const [popupEliminaData, setPopupEliminaData] = useState(null);
  const corsoByIdImp = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locByIdImp = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
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

  const [locInModifica, setLocInModifica] = useState(null);
  const [modNomeLoc, setModNomeLoc] = useState("");
  const [modPostiMaxLoc, setModPostiMaxLoc] = useState("");

  const [filtroCorsoDate, setFiltroCorsoDate] = useState("");
  const [filtroCittaDate, setFiltroCittaDate] = useState("");
  const [filtroMasterDate, setFiltroMasterDate] = useState("");
  const [apriFiltroCorsoDate, setApriFiltroCorsoDate] = useState(false);
  const [apriFiltroCittaDate, setApriFiltroCittaDate] = useState(false);
  const [apriFiltroMasterDate, setApriFiltroMasterDate] = useState(false);

  const [dataInModifica, setDataInModifica] = useState(null);
  const [modDataInizio, setModDataInizio] = useState("");
  const [modDataFine, setModDataFine] = useState("");
  const [modPostiData, setModPostiData] = useState("");
  const [modMasterSel, setModMasterSel] = useState("");

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
  async function eliminaData(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Data eliminata.");
    ricarica();
  }
  function apriModificaCorso(c) {
    setCorsoInModifica(c.id);
    setModNomeCorso(c.nome.toUpperCase());
    setModColoreCorso(c.colore);
    setModPostiCorso(String(c.posti_max));
  }
  async function salvaModificaCorso(id) {
    if (!modNomeCorso.trim()) { setMsg("Il nome del corso non può essere vuoto."); return; }
    const { error } = await supabase.from("corsi").update({
      nome: modNomeCorso.trim().toUpperCase(),
      colore: modColoreCorso,
      posti_max: Number(modPostiCorso) || 10,
    }).eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setCorsoInModifica(null);
    setMsg("Corso aggiornato.");
    ricarica();
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

  async function aggiungiCorso() {
    if (!nomeCorso.trim()) return;
    if (coloriUsati.includes(colore.toLowerCase())) {
      setMsg("Questo colore è già usato da un altro corso: scegline un altro.");
      return;
    }
    const { error } = await supabase.from("corsi").insert({ nome: nomeCorso.trim().toUpperCase(), colore, posti_max: Number(postiMax) || 10 });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNomeCorso(""); setMsg("Corso aggiunto.");
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
      <TopBar title="Setting" onBack={onBack} />

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <Button onClick={() => setShowCorsoModal(true)}>Aggiungi corso</Button>
        <Button onClick={() => setShowLocModal(true)}>Aggiungi location</Button>
        <Button onClick={() => setShowMasterModal(true)}>Aggiungi Master</Button>
        <Button onClick={() => setShowHotelModal(true)}>Aggiungi Hotel</Button>
        <Button onClick={() => setShowAssistenteModal(true)}>Aggiungi Assistente</Button>
        <Button onClick={() => setShowLevaModal(true)}>Aggiungi Leva</Button>
        <Button variant="ghost" onClick={onApriAssegnazioneMaster}>Assegnazione Master</Button>
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Aggiungi data</div>
        <div style={subStyle}>Clicca un giorno vuoto per creare una nuova edizione (corso, città, durata). Clicca due volte un corso già esistente per eliminarlo.</div>
        <SelettoreCalendario
          corsi={corsi} location={location} corsiDate={corsiDate}
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

      <div style={cardStyle}>
        <div style={{ ...hStyle, textAlign: "center" }}>PANNELLO DI GESTIONE DATE</div>
        <div style={subStyle}>Solo le edizioni future, divise per città e corso. Clicca la matita per modificarne una (anche per spostarla), il cestino per eliminarla (rimuove anche i suoi iscritti).</div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Button
              variant={filtroCorsoDate ? "primary" : "ghost"}
              onClick={() => { setApriFiltroCorsoDate((v) => !v); setApriFiltroCittaDate(false); setApriFiltroMasterDate(false); }}
            >
              {filtroCorsoDate ? corsi.find((c) => c.id === filtroCorsoDate)?.nome.toUpperCase() : "Filtra per corso"}
            </Button>
            {apriFiltroCorsoDate && (
              <select
                autoFocus
                style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                value={filtroCorsoDate}
                onChange={(e) => { setFiltroCorsoDate(e.target.value); setApriFiltroCorsoDate(false); }}
                onBlur={() => setApriFiltroCorsoDate(false)}
              >
                <option value="">Tutti i corsi</option>
                {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
              </select>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <Button
              variant={filtroCittaDate ? "primary" : "ghost"}
              onClick={() => { setApriFiltroCittaDate((v) => !v); setApriFiltroCorsoDate(false); setApriFiltroMasterDate(false); }}
            >
              {filtroCittaDate ? location.find((l) => l.id === filtroCittaDate)?.nome.toUpperCase() : "Filtra per città"}
            </Button>
            {apriFiltroCittaDate && (
              <select
                autoFocus
                style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                value={filtroCittaDate}
                onChange={(e) => { setFiltroCittaDate(e.target.value); setApriFiltroCittaDate(false); }}
                onBlur={() => setApriFiltroCittaDate(false)}
              >
                <option value="">Tutte le città</option>
                {location.map((l) => <option key={l.id} value={l.id}>{l.nome.toUpperCase()}</option>)}
              </select>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <Button
              variant={filtroMasterDate ? "primary" : "ghost"}
              onClick={() => { setApriFiltroMasterDate((v) => !v); setApriFiltroCorsoDate(false); setApriFiltroCittaDate(false); }}
            >
              {filtroMasterDate ? master.find((m) => m.id === filtroMasterDate)?.nome.toUpperCase() : "Filtra per master"}
            </Button>
            {apriFiltroMasterDate && (
              <select
                autoFocus
                style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                value={filtroMasterDate}
                onChange={(e) => { setFiltroMasterDate(e.target.value); setApriFiltroMasterDate(false); }}
                onBlur={() => setApriFiltroMasterDate(false)}
              >
                <option value="">Tutte le master</option>
                {master.map((m) => <option key={m.id} value={m.id}>{m.nome.toUpperCase()}</option>)}
              </select>
            )}
          </div>
          {(filtroCorsoDate || filtroCittaDate || filtroMasterDate) && (
            <Button
              variant="ghost"
              onClick={() => { setFiltroCorsoDate(""); setFiltroCittaDate(""); setFiltroMasterDate(""); setApriFiltroCorsoDate(false); setApriFiltroCittaDate(false); setApriFiltroMasterDate(false); }}
            >
              Cancella filtri
            </Button>
          )}
        </div>

        <DateRaggruppatePerCitta
          corsi={corsi}
          location={location}
          corsiDate={corsiDate.filter((cd) =>
            cd.data_fine >= dataOggiStr() &&
            (!filtroCorsoDate || cd.corso_id === filtroCorsoDate) &&
            (!filtroCittaDate || cd.location_id === filtroCittaDate) &&
            (!filtroMasterDate || cd.master_id === filtroMasterDate)
          )}
          iscritti={iscritti}
          master={master}
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
                  cdId={dataInModifica}
                  valore={{ inizio: modDataInizio, fine: modDataFine }}
                  onCambia={({ inizio, fine }) => { setModDataInizio(inizio); setModDataFine(fine); }}
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
          <Button onClick={aggiungiCorso}>Aggiungi corso</Button>

          <div style={{ ...hStyle, marginTop: 24 }}>Corsi esistenti</div>
          <div style={subStyle}>Clicca la matita per modificare, il cestino per eliminare (rimuove anche le sue date e i relativi iscritti).</div>
          {corsi.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun corso ancora.</div>}
          {corsi.map((c) => (
            <div key={c.id}>
              <RigaEliminabile
                label={<span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: c.colore, marginRight: 8 }} />{c.nome.toUpperCase()}</span>}
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
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button onClick={() => salvaModificaCorso(c.id)}>Salva</Button>
                    <Button variant="ghost" onClick={() => setCorsoInModifica(null)}>Annulla</Button>
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

const cardStyle = { background: "#FFFFFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 22, marginBottom: 18 };
const hStyle = { ...fontDisplay, fontSize: 20, color: NAVY, margin: "0 0 4px" };
const subStyle = { ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 };

function Modal({ title, onClose, children }) {
  return (
    <div
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
function GestioneListaSemplice({ nomeSingolare, nomeArticolo, tabella, elementi, ricarica, msg, setMsg, placeholder }) {
  const [nome, setNome] = useState("");
  const [inModifica, setInModifica] = useState(null);
  const [modNome, setModNome] = useState("");

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
function DateRaggruppatePerCitta({ corsi, location, corsiDate, iscritti, master, onApriData, onDelete, onEdit, idInModifica, renderModifica }) {
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

  return (
    <div>
      {cittaOrdinate.map((c, idx) => (
        <div key={c.nome} style={{ marginBottom: 24, paddingTop: idx > 0 ? 20 : 0, borderTop: idx > 0 ? `2px solid ${MUTED}` : "none" }}>
          <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 14, textAlign: "center" }}>{c.nome.toUpperCase()}</div>
          {Object.keys(c.mesi)
            .sort()
            .map((chiaveMese) => {
              const gruppoMese = c.mesi[chiaveMese];
              return (
                <div key={chiaveMese} style={{ marginBottom: 14 }}>
                  <div style={{ ...fontBody, fontSize: 14, fontWeight: 600, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 8, borderBottom: `1px solid ${CREAM_BORDER}`, textAlign: "center" }}>
                    {gruppoMese.etichetta}
                  </div>
                  {gruppoMese.voci
                    .slice()
                    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                    .map((cd) => {
                      const corso = corsoById[cd.corso_id];
                      return onEdit ? (
                        <div key={cd.id} style={{ padding: "9px 4px", borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <div style={{ ...fontBody, fontSize: 15, color: NAVY, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: "1 1 auto" }}>
                              <span style={{ width: 14, height: 14, borderRadius: 4, background: corso?.colore || NAVY, flexShrink: 0 }} />
                              <b style={{ color: NAVY, fontWeight: 700, whiteSpace: "nowrap" }}>{corso?.nome?.toUpperCase() || "?"}</b>
                              {cd.master_id && (
                                <span style={{ fontSize: 12, fontWeight: 400, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  · {masterById[cd.master_id]?.nome?.toUpperCase() || "?"}
                                </span>
                              )}
                            </span>
                            <span style={{ flexShrink: 0 }}>{fmtDataCompatta(cd.data_inizio, cd.data_fine)}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              {iscritti && (() => {
                                const max = postiMaxEffettivi(cd, corso, locById[cd.location_id]);
                                const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
                                const liberi = Math.max(0, max - occupati);
                                return (
                                  <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap" }}>
                                    {liberi} POST{liberi === 1 ? "O" : "I"}
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
                            </span>
                          </div>
                          {idInModifica === cd.id && renderModifica && renderModifica(cd)}
                        </div>
                      ) : (
                        <div
                          key={cd.id}
                          onClick={() => onApriData?.(cd)}
                          style={{ padding: "9px 4px", cursor: onApriData ? "pointer" : "default" }}
                        >
                          <div style={{ ...fontBody, fontSize: 15, color: NAVY, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: "1 1 auto" }}>
                              <span style={{ width: 14, height: 14, borderRadius: 4, background: corso?.colore || NAVY, flexShrink: 0 }} />
                              <b style={{ color: NAVY, fontWeight: 700 }}>{corso?.nome?.toUpperCase() || "?"}</b>
                            </span>
                            <span style={{ flexShrink: 0 }}>{fmtDataCompatta(cd.data_inizio, cd.data_fine)}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              {iscritti && (() => {
                                const max = postiMaxEffettivi(cd, corso, locById[cd.location_id]);
                                const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
                                const liberi = Math.max(0, max - occupati);
                                return (
                                  <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap" }}>
                                    {liberi} POST{liberi === 1 ? "O" : "I"}
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
                            </span>
                          </div>
                          {cd.master_id && (
                            <div style={{ ...fontBody, fontSize: 11, color: MUTED, opacity: 0.75, paddingLeft: 20 }}>
                              Master: {masterById[cd.master_id]?.nome?.toUpperCase() || "?"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
        </div>
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


const LANE_H = 20; // altezza di ogni "corsia" di eventi (px)
const HEADER_H = 26; // spazio per il numero del giorno

// un singolo mese: titolo + griglia con le barre degli eventi
// idEvidenziato/overrideInizio/overrideFine/onDragBarra/refEvidenziato sono
// opzionali: servono solo quando questo mese è usato dentro CalendarioModifica
// per rendere trascinabile/ridimensionabile la barra dell'edizione in modifica.
// Il trascinamento vero e proprio (move/up) è gestito dal contenitore stabile
// in CalendarioModifica, non da questa barra: se lo spostamento la fa
// comparire in una settimana diversa, React distrugge e ricrea il suo nodo
// DOM, e qualunque cattura del puntore impostata su di essa andrebbe persa.
function MeseGriglia({ anno, mese, corsi, location, corsiDate, onApriData, corsoById, locById, idEvidenziato, overrideInizio, overrideFine, onDragBarra, refEvidenziato, onClickGiornoVuoto, onDoppioClickEvento }) {
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {GIORNI.map((g, i) => <div key={i} style={{ ...fontBody, fontSize: 11, color: MUTED, textAlign: "center" }}>{g}</div>)}
      </div>

      {settimane.map((settimana, wi) => {
        const giorniValidi = settimana.filter((d) => d !== null);
        if (giorniValidi.length === 0) return null;
        const inizioRiga = dateStr(giorniValidi[0]);
        const fineRiga = dateStr(giorniValidi[giorniValidi.length - 1]);
        const eventiRiga = eventiMese.filter((ev) => ev.data_inizio <= fineRiga && ev.data_fine >= inizioRiga);
        const eventiConLane = assegnaLane(eventiRiga);
        const maxLane = eventiConLane.reduce((m, e) => Math.max(m, e.lane), -1);
        const rowHeight = HEADER_H + (maxLane + 1) * LANE_H + 6;

        return (
          <div key={wi} style={{ position: "relative", marginBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {settimana.map((d, i) => (
                <div
                  key={i}
                  data-data={d ? dateStr(d) : undefined}
                  onClick={d && onClickGiornoVuoto ? () => onClickGiornoVuoto(dateStr(d)) : undefined}
                  style={{
                    border: d ? `1px solid ${CREAM_BORDER}` : "none", borderRadius: 8, height: rowHeight,
                    background: !d ? "transparent" : i === 5 ? COLORE_SABATO : i === 6 ? COLORE_DOMENICA : "#fff",
                    boxSizing: "border-box", cursor: d && onClickGiornoVuoto ? "pointer" : undefined,
                  }}
                >
                  {d && <div style={{ ...fontBody, fontSize: 12, color: NAVY, padding: "4px 6px" }}>{d}</div>}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", top: HEADER_H, left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: LANE_H, gap: 4, pointerEvents: "none" }}>
              {eventiConLane.map((ev) => {
                const primoIdxValido = settimana.findIndex((d) => d !== null);
                const startIdx = settimana.findIndex((d) => d && dateStr(d) === ev.data_inizio);
                const colStart = startIdx >= 0 ? startIdx : primoIdxValido;
                const endIdx = settimana.reduce((acc, d, idx) => (d && dateStr(d) <= ev.data_fine ? idx : acc), colStart);
                const colSpan = endIdx - colStart + 1;
                const evidenziata = ev.id === idEvidenziato;
                return (
                  <div
                    key={ev.id}
                    ref={evidenziata ? refEvidenziato : null}
                    onClick={() => gestisciClickBarra(ev)}
                    onPointerDown={evidenziata && onDragBarra ? (e) => onDragBarra(e, "sposta") : undefined}
                    title={`${corsoById[ev.corso_id]?.nome?.toUpperCase()} · ${locById[ev.location_id]?.nome?.toUpperCase()}`}
                    style={{
                      position: "relative",
                      pointerEvents: "auto",
                      gridColumn: `${colStart + 1} / span ${colSpan}`,
                      gridRow: ev.lane + 1,
                      alignSelf: "center",
                      height: LANE_H - 4,
                      background: corsoById[ev.corso_id]?.colore || NAVY,
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 500,
                      ...fontBody,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 6px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      cursor: evidenziata ? "grab" : "pointer",
                      touchAction: evidenziata ? "none" : undefined,
                      userSelect: evidenziata ? "none" : undefined,
                      boxShadow: evidenziata ? "0 0 0 2px #fff, 0 0 0 4px " + NAVY : "none",
                      zIndex: evidenziata ? 5 : 1,
                    }}
                  >
                    {evidenziata && onDragBarra && (
                      <div
                        onPointerDown={(e) => { e.stopPropagation(); onDragBarra(e, "inizio"); }}
                        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, cursor: "ew-resize", touchAction: "none" }}
                      />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {etichettaBarra(corsoById[ev.corso_id], locById[ev.location_id])}
                    </span>
                    {evidenziata && onDragBarra && (
                      <div
                        onPointerDown={(e) => { e.stopPropagation(); onDragBarra(e, "fine"); }}
                        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 10, cursor: "ew-resize", touchAction: "none" }}
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

function Calendario({ corsi, location, corsiDate, onApriData, onBack, ricarica }) {
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
        <div key={`${anno}-${mese}`} ref={anno === oggi.getFullYear() && mese === oggi.getMonth() ? refOggi : null}>
          <MeseGriglia
            anno={anno} mese={mese} corsi={corsi} location={location} corsiDate={corsiDate}
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
function CalendarioModifica({ corsi, location, corsiDate, cdId, valore, onCambia }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

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
          corsi={corsi} location={location} corsiDate={corsiDate}
          corsoById={corsoById} locById={locById}
          onApriData={() => {}}
          idEvidenziato={cdId}
          overrideInizio={posizione.inizio} overrideFine={posizione.fine}
          onDragBarra={iniziaDrag}
          refEvidenziato={refEvidenziato}
        />
      ))}
    </div>
  );
}

// ---------- Selettore date dal calendario (per Aggiungi data) ----------
function SelettoreCalendario({ corsi, location, corsiDate, onClickGiorno, onDoppioClickEvento }) {
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
        const rowHeight = 20 + Math.max(0, maxLane + 1) * barH + 4;

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
                return (
                  <div
                    key={ev.id}
                    onDoubleClick={() => onDoppioClickEvento(ev)}
                    title={`${corsoById[ev.corso_id]?.nome?.toUpperCase()} · ${locById[ev.location_id]?.nome?.toUpperCase()}`}
                    style={{
                      pointerEvents: "auto",
                      gridColumn: `${colStart + 1} / span ${colSpan}`,
                      gridRow: ev.lane + 1,
                      alignSelf: "center",
                      height: barH - 3,
                      background: corsoById[ev.corso_id]?.colore || NAVY,
                      borderRadius: 3,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 500,
                      ...fontBody,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 4px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                    }}
                  >
                    {etichettaBarra(corsoById[ev.corso_id], locById[ev.location_id])}
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
function AllegatoLink({ percorso, etichetta }) {
  const { data } = supabase.storage.from("allegati-iscritti").getPublicUrl(percorso);
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

function SchedaData({ corsoData, corsi, location, corsiDate, iscritti, master, ricarica, onBack }) {
  const [vista, setVista] = useState("lista"); // 'lista' | 'form'
  const [modificandoId, setModificandoId] = useState(null); // id dell'iscritto in modifica, null se è una nuova iscrizione

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [note, setNote] = useState("");
  const [tutor, setTutor] = useState("");
  const [telefono, setTelefono] = useState("");
  const QUOTA_VUOTA = { imponibile: "", totale: "", metodo: "", interessi: "" };
  const [pagAcconto, setPagAcconto] = useState(QUOTA_VUOTA);
  const [pagPrecorso, setPagPrecorso] = useState(QUOTA_VUOTA);
  const [pagSaldo, setPagSaldo] = useState(QUOTA_VUOTA);
  const [accordiCommerciali, setAccordiCommerciali] = useState("");
  const [richiedeModelle, setRichiedeModelle] = useState("");
  const [numeroModelle, setNumeroModelle] = useState("");
  const [prezzoSpecialeModelle, setPrezzoSpecialeModelle] = useState("");
  const [pacchettoKit, setPacchettoKit] = useState("");
  const [tagliaDivisa, setTagliaDivisa] = useState("");
  const [totalePattuito, setTotalePattuito] = useState("");
  const [fileIscrizione, setFileIscrizione] = useState(null);
  const [fileScreenAcconto, setFileScreenAcconto] = useState(null);
  const [fileScreenRecap, setFileScreenRecap] = useState(null);
  const [caricando, setCaricando] = useState(false);

  const [spostaIscrittoId, setSpostaIscrittoId] = useState(null); // id dell'iscritto per cui si sta scegliendo la nuova data
  const [msg, setMsg] = useState("");
  const [adminSbloccato, setAdminSbloccato] = useState(sessionStorage.getItem("edc_admin_ok") === "1");
  const [mostraGestione, setMostraGestione] = useState(false);
  const [linkMaster, setLinkMaster] = useState("");

  const corso = corsi.find((c) => c.id === corsoData.corso_id);
  const loc = location.find((l) => l.id === corsoData.location_id);
  const listaIscritti = iscritti.filter((i) => i.corso_data_id === corsoData.id);
  const max = postiMaxEffettivi(corsoData, corso, loc);
  const liberi = Math.max(0, max - listaIscritti.length);

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

  // carica un file nello storage "allegati-iscritti" e restituisce il percorso salvato
  async function caricaAllegato(file, prefisso) {
    if (!file) return null;
    const percorso = `${corsoData.id}/${prefisso}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file);
    if (error) throw error;
    return percorso;
  }

  function resetCampi() {
    setNome(""); setCognome(""); setNote(""); setTutor(""); setTelefono("");
    setPagAcconto(QUOTA_VUOTA); setPagPrecorso(QUOTA_VUOTA); setPagSaldo(QUOTA_VUOTA);
    setAccordiCommerciali(""); setRichiedeModelle(""); setNumeroModelle(""); setPrezzoSpecialeModelle(""); setTotalePattuito("");
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
    setPacchettoKit(i.pacchetto_kit || "");
    setTagliaDivisa(i.taglia_divisa || "");
    setTotalePattuito(i.totale_pattuito != null ? String(i.totale_pattuito) : "");
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
        pacchetto_kit: pacchettoKit.trim() || null,
        taglia_divisa: tagliaDivisa || null,
        totale_pattuito: totalePattuito === "" ? null : parseNum(totalePattuito),
        quota_venditore: totalePattuito === "" ? null : quotaVenditoreDi(totalePattuito),
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
  async function gestisciFileModulo(file) {
    setFileIscrizione(file);
    if (!file || file.type !== "application/pdf") return;
    try {
      const dati = await estraiDatiModuloPdf(file);
      if (!dati) { setMsg("Non ho trovato i dati attesi nel modulo PDF: da compilare a mano."); return; }

      if (dati.tutor && !tutor.trim()) setTutor(dati.tutor.toUpperCase());
      if (dati.nome && !nome.trim()) setNome(dati.nome.toUpperCase());
      if (dati.cognome && !cognome.trim()) setCognome(dati.cognome.toUpperCase());
      if (dati.telefono && !telefono.trim()) setTelefono(dati.telefono.toUpperCase());

      if (dati.tagliaDivisa && !tagliaDivisa) {
        const taglia = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].find((t) => t.toLowerCase() === dati.tagliaDivisa.toLowerCase());
        if (taglia) setTagliaDivisa(taglia);
      }

      if (dati.tipoCorso && !pacchettoKit.trim()) setPacchettoKit(dati.tipoCorso.toUpperCase());

      if (dati.tipoPagamentoSaldo && !accordiCommerciali.trim()) setAccordiCommerciali(dati.tipoPagamentoSaldo.toUpperCase());

      if (dati.scelteModelle && richiedeModelle === "") {
        const testoModelle = dati.scelteModelle.toLowerCase();
        if (testoModelle.includes("cercherò io") || testoModelle.includes("cerchero io")) setRichiedeModelle("no");
      }

      if ((dati.accontoMetodo || dati.accontoImporto) && pagAcconto.totale === "") {
        const metodo = ["Sito", "Bonifico", "Pos", "Contanti", "Rate"].find((m) => m.toLowerCase() === (dati.accontoMetodo || "").toLowerCase());
        setPagAcconto((prev) => {
          let next = metodo ? { ...prev, metodo } : prev;
          if (dati.accontoImporto) next = conTotaleAggiornato(next, dati.accontoImporto.replace(",", "."), true);
          return next;
        });
      }

      setMsg("Dati letti dal modulo PDF e inseriti nel form: controllali prima di salvare.");
    } catch (e) {
      setMsg("Errore nella lettura del modulo PDF: " + e.message);
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

  async function salvaNotaRicontatto(id, valore) {
    const { error } = await supabase.from("iscritti").update({ note_ricontatto: valore.trim() || null }).eq("id", id);
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
      <TopBar title={`${(corso?.nome || "").toUpperCase()} · ${(loc?.nome || "").toUpperCase()}`} onBack={onBack} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ ...fontBody, color: MUTED, fontSize: 14 }}>
            {corsoData.data_inizio === corsoData.data_fine ? fmtData(corsoData.data_inizio) : `${fmtData(corsoData.data_inizio)} → ${fmtData(corsoData.data_fine)}`} — {liberi} posti liberi su {max}
          </div>
          {corsoData.master_id && (
            <div style={{ ...fontBody, color: MUTED, fontSize: 13 }}>
              Master: {(master || []).find((m) => m.id === corsoData.master_id)?.nome?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        {vista === "lista" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={mostraGestione ? "primary" : "ghost"} onClick={apriGestioneClasse}>
              {mostraGestione ? "Esci da contabilità classe" : "Contabilità classe"}
            </Button>
            {!mostraGestione && (
              <Button onClick={apriIscrizione} disabled={liberi <= 0} title={liberi <= 0 ? "Nessun posto disponibile" : ""}>
                {liberi <= 0 ? "Completo" : "Iscrivi"}
              </Button>
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

      {vista === "form" && (
        <div style={cardStyle} onBlur={() => { if (modificandoId) autosalva(); }}>
          <div style={hStyle}>{modificandoId ? "Modifica iscritto" : "Iscrivi allievo"}</div>
          {modificandoId && (
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 14 }}>
              Le modifiche si salvano da sole appena esci da un campo — non serve premere alcun pulsante per ogni singola modifica.
            </div>
          )}
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
                <Field label="Totale pattuito per la vendita (senza IVA)">
                  <input style={inputStyle} inputMode="decimal" value={totalePattuito} onChange={(e) => setTotalePattuito(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Quota venditore (7%)">
                  <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={totalePattuito === "" ? "" : quotaVenditoreDi(totalePattuito).toFixed(2)} disabled />
                </Field>
              </div>
            </div>
          </div>
          <Field label="Pacchetto/Kit">
            <input value={pacchettoKit} onChange={(e) => setPacchettoKit(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} />
          </Field>
          <BloccoQuota
            titolo="Quota acconto"
            valori={pagAcconto}
            opzioniMetodo={["Sito", "Bonifico", "Pos", "Contanti", "Rate"]}
            totaleBloccato={false}
            onImponibile={(v) => setPagAcconto((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagAcconto((prev) => conTotaleAggiornato(prev, v, true))}
            onMetodo={(v) => setPagAcconto((prev) => ({ ...prev, metodo: v, interessi: v === "Rate" ? prev.interessi : "" }))}
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
          <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10, background: BG_CHIARO }}>
            <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Totale pagato</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 100px" }}>
                <Field label="Totale senza Iva">
                  <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={(parseNum(pagAcconto.imponibile) + parseNum(pagPrecorso.imponibile) + parseNum(pagSaldo.imponibile)).toFixed(2)} disabled />
                </Field>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <Field label="Totale con Iva">
                  <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={(parseNum(pagAcconto.totale) + parseNum(pagPrecorso.totale) + parseNum(pagSaldo.totale)).toFixed(2)} disabled />
                </Field>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <Field label="Totale con interessi">
                  <input
                    style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }}
                    value={(() => {
                      const intAcconto = pagAcconto.metodo === "Rate" ? parseNum(pagAcconto.interessi) : 0;
                      const intPrecorso = pagPrecorso.metodo === "Rate" ? parseNum(pagPrecorso.interessi) : 0;
                      if (intAcconto <= 0 && intPrecorso <= 0) return "";
                      return (parseNum(pagAcconto.totale) + intAcconto + parseNum(pagPrecorso.totale) + intPrecorso + parseNum(pagSaldo.totale)).toFixed(2);
                    })()}
                    disabled
                  />
                </Field>
              </div>
            </div>
          </div>
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
            </>
          )}

          <Field label="Taglia divisa">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...fontBody, fontSize: 14, color: NAVY }}>
              {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((taglia) => (
                <label key={taglia} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="tagliaDivisa" checked={tagliaDivisa === taglia} onChange={() => setTagliaDivisa(taglia)} />
                  {taglia}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Modulo iscrizione (PDF)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_iscrizione && !fileIscrizione && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_iscrizione} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="application/pdf,image/*" style={inputStyle} onChange={(e) => gestisciFileModulo(e.target.files?.[0] || null)} />
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 4 }}>Caricando il PDF del modulo, tutor/nome/cognome/telefono/acconto/taglia/pacchetto/modelle/accordi commerciali vengono letti e inseriti automaticamente nei campi ancora vuoti.</div>
          </Field>
          <Field label="Screen acconto (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_acconto && !fileScreenAcconto && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_acconto} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setFileScreenAcconto(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Screen di recap (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_recap && !fileScreenRecap && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_recap} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setFileScreenRecap(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Note (opzionale)"><input value={note} onChange={(e) => setNote(e.target.value.toUpperCase())} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={salvaIscritto} disabled={caricando}>
              {caricando ? "Caricamento…" : modificandoId ? "Fatto, torna alla lista" : "Aggiungi iscritto"}
            </Button>
            <Button variant="ghost" onClick={annullaForm}>Annulla</Button>
          </div>
          {msg && !msgErrore && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
        </div>
      )}

      {vista === "lista" && (
        <>
          <div style={{ ...hStyle, marginBottom: 12 }}>Iscritti ({listaIscritti.length})</div>
          {listaIscritti.length === 0 && (
            <div style={{ ...cardStyle, ...fontBody, color: MUTED, fontSize: 14 }}>Nessun iscritto ancora. Usa "Iscrivi" in alto per aggiungerne uno.</div>
          )}
          {listaIscritti.map((i, idx) => (
            <div key={i.id} style={{ ...cardStyle, padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div
                    onClick={() => apriModificaCompleta(i)}
                    title="Clicca per modificare i dati dell'iscritto"
                    style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: NAVY, cursor: "pointer", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, minWidth: 0 }}
                  >
                    <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>{idx + 1}.</span>
                    <span>{i.nome.toUpperCase()} {i.cognome.toUpperCase()}</span>
                    {i.tutor && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· Tutor: {i.tutor}</span>}
                    {i.telefono && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· {i.telefono}</span>}
                    {i.note && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>({i.note})</span>}
                  </div>
                  {mostraGestione && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <Button variant="ghost" onClick={() => setSpostaIscrittoId(spostaIscrittoId === i.id ? null : i.id)} style={{ padding: "6px 12px", fontSize: 13 }}>
                        Sposta
                      </Button>
                      <button
                        onClick={() => elimina(i.id)}
                        title="Elimina"
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, flexShrink: 0, display: "flex", alignItems: "center" }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" /><path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {mostraGestione && (
                  <div
                    onClick={() => toggleRicontattato(i)}
                    style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, ...fontBody, fontSize: 14, color: NAVY }}>
                      <input type="checkbox" checked={!!i.ricontattato} readOnly style={{ width: 20, height: 20, pointerEvents: "none" }} />
                      Ricontattato
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#E0E0E0" : "#C0392B", border: "1px solid rgba(0,0,0,0.1)" }} />
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: i.ricontattato ? "#2E7D32" : "#E0E0E0", border: "1px solid rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                )}
                {mostraGestione && (
                  <div style={{ marginTop: 6 }}>
                    <input
                      type="text"
                      defaultValue={(i.note_ricontatto || "").toUpperCase()}
                      placeholder="Note dopo il ricontatto"
                      onBlur={(e) => salvaNotaRicontatto(i.id, e.target.value.toUpperCase())}
                      style={{ ...inputStyle, fontSize: 13, textTransform: "uppercase" }}
                    />
                  </div>
                )}
                {mostraGestione && spostaIscrittoId === i.id && (
                  <div style={{ marginTop: 10, padding: 14, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, background: BG_CHIARO }}>
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
                {mostraGestione && (
                  <>
                    <div style={{ marginTop: 8, padding: "12px 14px", background: BG_CHIARO, borderRadius: 8, ...fontBody, fontSize: 15, color: NAVY }}>

                      {i.pacchetto_kit && (
                        <div style={{ marginBottom: 6 }}><span style={{ color: GRAFITE }}>Pacchetto/Kit:</span> <b style={{ color: NAVY }}>{i.pacchetto_kit}</b></div>
                      )}
                      {i.totale_pattuito != null && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: GRAFITE }}>Totale pattuito:</span> <b style={{ color: NAVY }}>{i.totale_pattuito} €</b>{i.quota_venditore != null && <> — <span style={{ color: GRAFITE }}>quota venditore:</span> <b style={{ color: NAVY }}>{i.quota_venditore} €</b></>}
                        </div>
                      )}
                      {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (() => {
                        const netto = round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0));
                        const conRate = round2(totQuota(i, "acconto") + totQuota(i, "precorso") + (i.saldo_totale || 0));
                        return (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ color: GRAFITE }}>Totale pagato:</span> <b style={{ color: NAVY }}>{netto} €</b>{conRate !== netto && <> — <span style={{ color: GRAFITE }}>totale con interessi:</span> <b style={{ color: NAVY }}>{conRate} €</b></>}
                          </div>
                        );
                      })()}

                      {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
                        <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Pagamenti</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {i.acconto_totale != null && <div><span style={{ color: GRAFITE }}>Pagato in acconto:</span> <b style={{ color: NAVY }}>{totQuota(i, "acconto")} €</b> ({i.acconto_metodo || "?"}{i.acconto_interessi ? `, interessi ${i.acconto_interessi} €` : ""})</div>}
                            {i.precorso_totale != null && <div><span style={{ color: GRAFITE }}>Pagato pre corso:</span> <b style={{ color: NAVY }}>{totQuota(i, "precorso")} €</b> ({i.precorso_metodo || "?"}{i.precorso_interessi ? `, interessi ${i.precorso_interessi} €` : ""})</div>}
                            {i.saldo_totale != null && <div><span style={{ color: GRAFITE }}>Importo da pagare al corso:</span> <b style={{ color: NAVY }}>{i.saldo_totale} €</b> ({i.saldo_metodo || "?"})</div>}
                          </div>
                        </div>
                      )}

                      {i.richiede_modelle && (
                        <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Modelle</div>
                          {i.numero_modelle != null && (
                            <div><span style={{ color: GRAFITE }}>Modelle da pagare:</span> <b style={{ color: NAVY }}>{i.numero_modelle} modell{i.numero_modelle === 1 ? "a" : "e"} → {modelleTotaleDi(i)} €</b>{i.prezzo_speciale_modelle != null ? " (prezzo speciale)" : ""}</div>
                          )}
                        </div>
                      )}
                      {i.taglia_divisa && (
                        <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}><span style={{ color: GRAFITE }}>Taglia divisa:</span> <b style={{ color: NAVY }}>{i.taglia_divisa}</b></div>
                      )}

                      {i.accordi_commerciali && (
                        <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <span style={{ color: GRAFITE }}>Accordi commerciali:</span> <b style={{ color: NAVY }}>{i.accordi_commerciali}</b>
                        </div>
                      )}

                      {(i.file_iscrizione || i.file_screen_acconto || i.file_screen_recap) && (
                        <div style={{ paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Allegati</div>
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            {i.file_iscrizione && <AllegatoLink percorso={i.file_iscrizione} etichetta="Modulo iscrizione" />}
                            {i.file_screen_acconto && <AllegatoLink percorso={i.file_screen_acconto} etichetta="Screen acconto" />}
                            {i.file_screen_recap && <AllegatoLink percorso={i.file_screen_recap} etichetta="Screen recap" />}
                          </div>
                        </div>
                      )}

                      {i.totale_pattuito == null && i.acconto_totale == null && i.precorso_totale == null && i.saldo_totale == null && !i.accordi_commerciali && !i.file_iscrizione && (
                        <div>Nessun dato di vendita registrato per questo iscritto.</div>
                      )}
                    </div>
                    {(i.saldo_totale != null || i.numero_modelle != null) && (() => {
                      const daIncassare = round2((i.saldo_totale || 0) + modelleTotaleDi(i));
                      const aPosto = i.incassato || daIncassare === 0;
                      const colore = aPosto ? "#2E7D32" : "#C0392B";
                      return (
                        <div
                          onClick={() => toggleIncassato(i)}
                          style={{
                            marginTop: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: aPosto ? "#E8F5E9" : "#FDECEC",
                            border: `1px solid ${colore}`,
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: colore }}>
                            DA INCASSARE {daIncassare} €
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 14, color: colore }}>
                            <input type="checkbox" checked={!!i.incassato} readOnly style={{ width: 22, height: 22, pointerEvents: "none" }} />
                            incassato
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ))}
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
                {i.telefono && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· {i.telefono}</span>}
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
                  DA INCASSARE {daIncassare} €
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
  const [loading, setLoading] = useState(true);
  const [filtroCorsoHome, setFiltroCorsoHome] = useState("");
  const [filtroCittaHome, setFiltroCittaHome] = useState("");
  const [filtroMasterHome, setFiltroMasterHome] = useState("");
  const [apriFiltroCorsoHome, setApriFiltroCorsoHome] = useState(false);
  const [apriFiltroCittaHome, setApriFiltroCittaHome] = useState(false);
  const [apriFiltroMasterHome, setApriFiltroMasterHome] = useState(false);

  // fetch "silenzioso": ricarica i dati senza mostrare la schermata di caricamento
  // (usato dopo ogni modifica, così l'app non "sparisce" per un attimo)
  async function fetchDati() {
    const [c, l, cd, i, m, h, a, lv] = await Promise.all([
      supabase.from("corsi").select("*").order("nome"),
      supabase.from("location").select("*").order("nome"),
      supabase.from("corsi_date").select("*").order("data_inizio"),
      supabase.from("iscritti").select("*").order("ts"),
      supabase.from("master").select("*").order("nome"),
      supabase.from("hotel").select("*").order("nome"),
      supabase.from("assistente").select("*").order("nome"),
      supabase.from("leva").select("*").order("nome"),
    ]);
    setCorsi(ordinaCorsi(c.data));
    setLocation(l.data || []);
    setCorsiDate(cd.data || []);
    setIscritti(i.data || []);
    setMaster(m.data || []);
    setHotel(h.data || []);
    setAssistente(a.data || []);
    setLeva(lv.data || []);
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

  // swipe da sinistra a destra su mobile → torna alla home (come i pulsanti "indietro")
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
      if (view !== "home" && dx > 80 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        setView("home");
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [view]);

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
    setView("scheda");
  }
  const corsoDataApertaObj = corsiDate.find((cd) => cd.id === corsoDataAperta) || null;

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      {view === "home" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px" }}>
          <div style={{ ...fontDisplay, fontSize: 28, color: NAVY, textAlign: "center", letterSpacing: 0.5 }}>CALENDARIO CORSI</div>
          <div style={{ ...fontDisplay, fontSize: 17, color: NAVY, marginBottom: 30, textAlign: "center", letterSpacing: 0.5 }}>ELITEDERMA</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20 }}>
            <Button onClick={() => setView("impostazioni")}>Setting</Button>
            <Button onClick={() => setView("statistiche")}>Statistiche</Button>
          </div>
          <CardHome title="Calendario" sub="Vista mensile con tutte le edizioni" onClick={() => setView("calendario")} />
          <CardHome title="Cerca iscritto" sub="Trova in quale corso è iscritto" onClick={() => setView("cercaiscritto")} />
          <CardHome title="Archivio corsi passati" sub="Corsi con date già concluse" onClick={() => setView("archivio")} />

          <div style={{ fontFamily: "'Roboto',sans-serif", fontWeight: 700, fontSize: 20, color: NAVY, margin: "34px 0 14px", textAlign: "center", letterSpacing: 1, lineHeight: 1.25 }}>
            DATE IN<br />PROGRAMMAZIONE
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 28 }}>
            <div style={{ position: "relative" }}>
              <Button
                variant={filtroCorsoHome ? "primary" : "ghost"}
                onClick={() => { setApriFiltroCorsoHome((v) => !v); setApriFiltroCittaHome(false); }}
              >
                {filtroCorsoHome ? corsi.find((c) => c.id === filtroCorsoHome)?.nome.toUpperCase() : "Filtra per corso"}
              </Button>
              {apriFiltroCorsoHome && (
                <select
                  autoFocus
                  style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                  value={filtroCorsoHome}
                  onChange={(e) => { setFiltroCorsoHome(e.target.value); setApriFiltroCorsoHome(false); }}
                  onBlur={() => setApriFiltroCorsoHome(false)}
                >
                  <option value="">Tutti i corsi</option>
                  {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
                </select>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <Button
                variant={filtroCittaHome ? "primary" : "ghost"}
                onClick={() => { setApriFiltroCittaHome((v) => !v); setApriFiltroCorsoHome(false); }}
              >
                {filtroCittaHome ? location.find((l) => l.id === filtroCittaHome)?.nome.toUpperCase() : "Filtra per città"}
              </Button>
              {apriFiltroCittaHome && (
                <select
                  autoFocus
                  style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                  value={filtroCittaHome}
                  onChange={(e) => { setFiltroCittaHome(e.target.value); setApriFiltroCittaHome(false); }}
                  onBlur={() => setApriFiltroCittaHome(false)}
                >
                  <option value="">Tutte le città</option>
                  {location.map((l) => <option key={l.id} value={l.id}>{l.nome.toUpperCase()}</option>)}
                </select>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <Button
                variant={filtroMasterHome ? "primary" : "ghost"}
                onClick={() => { setApriFiltroMasterHome((v) => !v); setApriFiltroCorsoHome(false); setApriFiltroCittaHome(false); }}
              >
                {filtroMasterHome ? master.find((m) => m.id === filtroMasterHome)?.nome.toUpperCase() : "Filtra per master"}
              </Button>
              {apriFiltroMasterHome && (
                <select
                  autoFocus
                  style={{ ...inputStyle, position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, width: "auto" }}
                  value={filtroMasterHome}
                  onChange={(e) => { setFiltroMasterHome(e.target.value); setApriFiltroMasterHome(false); }}
                  onBlur={() => setApriFiltroMasterHome(false)}
                >
                  <option value="">Tutte le master</option>
                  {master.map((m) => <option key={m.id} value={m.id}>{m.nome.toUpperCase()}</option>)}
                </select>
              )}
            </div>
            {(filtroCorsoHome || filtroCittaHome || filtroMasterHome) && (
              <Button
                variant="ghost"
                onClick={() => { setFiltroCorsoHome(""); setFiltroCittaHome(""); setFiltroMasterHome(""); setApriFiltroCorsoHome(false); setApriFiltroCittaHome(false); setApriFiltroMasterHome(false); }}
              >
                Cancella filtri
              </Button>
            )}
          </div>

          <DateRaggruppatePerCitta
            corsi={corsi}
            location={location}
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
        <Impostazioni corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} master={master} hotel={hotel} assistente={assistente} leva={leva} ricarica={fetchDati} onBack={() => setView("home")} onApriAssegnazioneMaster={() => setView("assegnazionemaster")} />
      )}

      {view === "statistiche" && (
        <Statistiche onBack={() => setView("home")} onApriVenditori={() => setView("statisticavenditori")} />
      )}

      {view === "statisticavenditori" && (
        <StatisticaVenditori corsi={corsi} corsiDate={corsiDate} iscritti={iscritti} onBack={() => setView("statistiche")} />
      )}

      {view === "assegnazionemaster" && (
        <AssegnazioneMaster corsi={corsi} location={location} corsiDate={corsiDate} master={master} hotel={hotel} assistente={assistente} leva={leva} ricarica={fetchDati} onBack={() => setView("impostazioni")} />
      )}

      {view === "calendario" && (
        <Calendario corsi={corsi} location={location} corsiDate={corsiDate} onApriData={apriData} onBack={() => setView("home")} ricarica={fetchDati} />
      )}

      {view === "cerca" && (
        <CercaCorso corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "cercaiscritto" && (
        <CercaIscritto corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "scheda" && corsoDataApertaObj && (
        <SchedaData
          corsoData={corsoDataApertaObj}
          corsi={corsi}
          location={location}
          corsiDate={corsiDate}
          iscritti={iscritti}
          master={master}
          ricarica={fetchDati}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
}
