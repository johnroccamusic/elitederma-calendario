// IL MODULO CHE APRE L'ALLIEVA: ?modulo=<gettone>
//
// Chi arriva qui non ha e non avra' mai un account. Apre il link, legge,
// compila quello che manca, firma col dito e invia.
//
// NON TOCCA LE TABELLE. Tutto passa da `modulo_vista` e `modulo_salva`,
// due funzioni `security definer` che prendono il gettone e lavorano su
// quella sola iscrizione. In `iscritti` ci sono anagrafiche, residenze,
// pagamenti e allegati di tutti gli allievi: una pagina pubblica che ci
// arriva direttamente vorrebbe dire che chiunque abbia la chiave del
// bundle li legge tutti.
//
// CHI PUO' SCRIVERE COSA
//   - quello che ha scritto il venditore si legge e basta: il prezzo e
//     il pacchetto devono arrivare in fondo come sono partiti;
//   - i riquadri commerciali (vendita, kit, presenza, quote, dati
//     organizzativi) sono di sola lettura PER INTERO, anche quando un
//     campo e' vuoto: non sono cose che decide lei;
//   - Privato/Azienda invece e' sempre sua, e i dati di fatturazione si
//     sbloccano solo se sceglie Azienda.
// L'elenco di cosa si puo' scrivere davvero non sta qui ma dentro
// `modulo_salva`: questa pagina e' comodita', quella e' la serratura.
//
// IL DOCUMENTO non va in un secchio pubblico: sale su `moduli-iscrizione`,
// privato, dove l'allieva puo' solo caricare e non rileggere.
//
// LA FOTO: niente `capture`. Con quell'attributo il telefono apre dritto
// la fotocamera e non lascia scegliere; senza, iPhone e Android offrono
// galleria, fotocamera e file. E si accettano anche i PDF, perche' da
// computer un documento scansionato e' quasi sempre un PDF.
import { leggiRifiuto } from "./rifiuti.js";
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import FirmaDito from "../ui/FirmaDito.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay, campoDataStyle } from "../ui/stile.js";
import { AREA_ALLIEVO, AREA_FATTURAZIONE, GRUPPI_LETTURA, avvisoCampo } from "./disposizione.js";
import { filtraCodiceFiscale } from "./codice-fiscale.js";
import { PER_CHIAVE, SUOI } from "./campi-scheda.js";
import { calcolaCodiceFiscale } from "./codice-fiscale.js";
import CampoComuneNascita from "./CampoComune.jsx";
import RitaglioFoto, { tipoVero, perchePuoiNonMandarlo, FORMATI, ritaglia } from "./RitaglioFoto.jsx";
import LetturaDocumento from "./LetturaDocumento.jsx";
import { CAMPI_DOCUMENTO, scadenzaDocumento } from "./documento.js";
import { nomiStati, comuniDiProvincia, capDiComune, provinciaDiComune } from "../comuni-regioni.js";
// lo stesso confronto della cascata della scheda: "PATERNO" e
// "Paternò" sono lo stesso posto, e due copie di questa regola
// prima o poi direbbero cose diverse
import { normalizzaNome } from "./AreeAnagrafiche.jsx";
import { DAL_CODICE } from "./testi.js";
import { serveAvvioImmediato } from "./regole-recesso.js";

const etichettaDi = (k) => PER_CHIAVE[k]?.etichetta || k;

// UN VALORE C'E' O NON C'E'.
//
// Serve a non mandare all'allieva righe vuote: "Presenza al corso —",
// "Quante modelle —". Su un modulo che si firma un trattino non e'
// un'informazione, e' una riga che non doveva partire.
//
// Attenzione: `false` E' una risposta ("non richiede modelle"), e lo
// zero pure. Vuoto e' solo null, undefined o una stringa di spazi.
const pieno = (v) => v != null && String(v).trim() !== "";

// LA BOZZA, SUL TELEFONO DI CHI COMPILA.
//
// Serve per un guasto che non possiamo impedire: il modulo si apre
// quasi sempre dall'app di posta, dentro la sua finestra interna, e
// quella finestra puo' chiudersi da sola — basta aprire la fotocamera
// per allegare il documento e cambiare idea. Capitato davvero: si
// tornava nella mail e il modulo era da rifare da capo.
//
// Qui dentro restano solo le risposte e le spunte, sul dispositivo di
// chi sta compilando e non altrove, e vengono cancellate appena il
// modulo parte. Le foto no: un file non si puo' mettere da parte, e
// quelle vanno riscelte.
const chiaveBozza = (token) => `modulo-bozza-${String(token).slice(0, 16)}`;

function leggiBozza(token) {
  try { return JSON.parse(window.localStorage.getItem(chiaveBozza(token)) || "null"); }
  catch { return null; }
}
function scriviBozza(token, bozza) {
  try { window.localStorage.setItem(chiaveBozza(token), JSON.stringify(bozza)); } catch { /* finestra privata */ }
}
function cancellaBozza(token) {
  try { window.localStorage.removeItem(chiaveBozza(token)); } catch { /* finestra privata */ }
}

const quandoEsteso = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
};

const giorno = (iso) => {
  if (!iso) return "";
  try {
    return new Date(String(iso).slice(0, 10) + "T00:00:00")
      .toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
};

// COME SI LEGGE UN VALORE.
//
// Dal database arriva tutto come testo: un sì diventa "false", un importo
// diventa "152.5". Scritti cosi' su un modulo che qualcuno firma sembrano
// un errore dell'app, e in parte lo sono.
function mostra(chiave, valore) {
  if (valore == null || valore === "") return "—";
  const t = String(valore);
  if (t === "true")  return "Sì";
  if (t === "false") return "No";
  if (chiave === "tipo_cliente") return t === "azienda" ? "Azienda" : "Privato";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return giorno(t);
  if (/(totale|imponibile|prezzo|quota|pattuito)/.test(chiave)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  return t;
}

function Avviso({ titolo, testo, buono = false }) {
  return (
    <div style={{ ...fontBody, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: buono ? "#2E7D32" : NAVY, marginBottom: 10 }}>{titolo}</div>
        <div style={{ fontSize: 13.5, color: GRAFITE, lineHeight: 1.65 }}>{testo}</div>
      </div>
    </div>
  );
}

const etichettaStile = { ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 };

/** Un dato gia' scritto: si legge, non si tocca. */
function Letto({ etichetta, valore, larghezza = "1 1 180px" }) {
  return (
    <div style={{ flex: larghezza, minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>{etichetta}</div>
      <div style={{ ...fontBody, fontSize: 14, color: NAVY, fontWeight: 600, wordBreak: "break-word" }}>{valore}</div>
    </div>
  );
}

/** Un campo che compila lei: casella, oppure tendina se ha un elenco. */
// Il valore che il venditore ha gia' scritto, per una chiave sola.
// Serve al calcolo del codice fiscale: nome e cognome di solito
// arrivano dalla scheda e sono bloccati, quindi non stanno in
// `risposte`.
function perChiaveValore(dati, chiave) {
  return (dati?.campi || []).find((x) => x.chiave === chiave)?.valore || "";
}

function DaRiempire({ campo, valore, onCambia, obbligatorio, spento = false, tutte = null, nota = null }) {
  const { chiave, maiuscolo, lunghezza, suggerimento, tipo } = campo;
  // un elenco chiuso si sceglie, non si scrive: cosi' "patente",
  // "Patente" e "pat." non diventano tre cose diverse in archivio
  // le opzioni arrivano in due forme: stringhe (elenchi del modulo) e
  // { valore, etichetta } (i campi della scheda, che qui si riusano).
  // Normalizzarle qui evita di tenere due elenchi della stessa cosa.
  const grezze = campo.opzioni
    || (tipo === "statoNascita" ? nomiStati() : null)
    || PER_CHIAVE[chiave]?.opzioni || null;
  const opzioni = grezze
    ? grezze.map((o) => (typeof o === "string"
        ? { valore: o, etichetta: o }
        // nella scheda l'etichetta sta su un tasto largo tre dita e "F"
        // basta; qui e' una voce di tendina, e una lettera sola non si
        // capisce
        : { valore: o.valore, etichetta: o.esteso || o.etichetta }))
    : null;
  const stileComune = {
    ...fontBody, width: "100%", boxSizing: "border-box", minWidth: 0,
    padding: "11px 11px", fontSize: 16, borderRadius: 8, minHeight: 44,
    border: `1px ${spento ? "solid" : "dashed"} ${spento ? CREAM_BORDER : GOLD}`,
    background: spento ? "#F3F0E9" : "#FFFDF8", color: NAVY,
  };
  return (
    <div style={{ flex: campo.larghezza || "1 1 180px", minWidth: 0, marginBottom: 12, ...(spento ? { opacity: 0.45 } : null) }}>
      <div style={etichettaStile}>
        {campo.etichetta || etichettaDi(chiave)}
        {obbligatorio && !spento && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      </div>
      {tipo === "comuneNascita" ? (
        // stesso elenco della scheda: il comune si sceglie, non si
        // indovina, e il nome ufficiale e' quello che fa uscire il
        // codice fiscale
        <CampoComuneNascita
          chiave={chiave} valore={valore} spenta={spento}
          scrivi={onCambia} suggerimento={spento ? "" : "Inserisci la tua città"}
          stile={stileComune}
        />
      ) : tipo === "data" ? (
        <input
          data-campo={chiave}
          type="date" value={valore || ""} disabled={spento}
          onChange={(e) => onCambia(chiave, e.target.value)}
          style={{ ...stileComune, ...campoDataStyle }}
        />
      ) : opzioni ? (
        <select
          data-campo={chiave}
          value={valore || ""} disabled={spento}
          onChange={(e) => onCambia(chiave, e.target.value)}
          style={stileComune}
        >
          <option value="">{tipo === "statoNascita" ? "Italia" : "— scegli —"}</option>
          {opzioni.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
        </select>
      ) : (
      <input
        // la chiave sulla casella: e' l'unico aggancio che non si
        // sposta quando una riga del modulo cambia posto
        data-campo={chiave}
        value={valore || ""} disabled={spento}
        maxLength={lunghezza}
        placeholder={spento ? "" : (suggerimento || "")}
        // il suggerimento in grigio chiaro: vedi la regola in index.html
        className="suggerimento-chiaro"
        inputMode={tipo === "telefono" ? "tel" : chiave === "email" ? "email" : undefined}
        onChange={(e) => {
          let v = e.target.value;
          if (maiuscolo) v = v.toUpperCase();
          // stessa regola della scheda: il codice fiscale ha una forma,
          // e la casella la fa rispettare anche qui
          if (chiave === "codice_fiscale") v = filtraCodiceFiscale(v);
          if (lunghezza) v = v.slice(0, lunghezza);
          onCambia(chiave, v);
        }}
        style={stileComune}
      />
      )}
      {!spento && avvisoCampo(campo, valore, tutte) && (
        <div style={{ ...fontBody, fontSize: 11.5, color: "#8A6A1B", marginTop: 4, lineHeight: 1.4 }}>
          {avvisoCampo(campo, valore, tutte)}
        </div>
      )}
      {!spento && nota && (
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{nota}</div>
      )}
    </div>
  );
}

/** Privato o Azienda: due tasti, e li decide lei. */
function SceltaIntestazione({ valore, onCambia }) {
  return (
    <div style={{ flex: "1 1 260px", minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>Intestazione<span style={{ color: "#B3261E", fontWeight: 700 }}> *</span></div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ v: "privato", l: "Privato" }, { v: "azienda", l: "Azienda" }].map((o) => {
          const scelto = (valore || "privato") === o.v;
          return (
            <button
              key={o.v} type="button" onClick={() => onCambia("tipo_cliente", o.v)}
              style={{
                ...fontBody, flex: 1, minHeight: 46, borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700,
                background: scelto ? NAVY : "#fff", color: scelto ? "#fff" : NAVY,
                border: `1px solid ${scelto ? NAVY : CREAM_BORDER}`,
              }}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Una foto del documento: galleria, fotocamera o file del computer.
 *
 * NIENTE `.click()` DA CODICE, e non e' una questione di eleganza.
 *
 * Prima c'era un campo file nascosto (1x1, opacita' zero, pointer-events
 * none) e un tasto che gli faceva `campo.current.click()`. Sull'iPhone
 * funzionava la prima volta e basta: chi apriva la fotocamera e poi
 * tornava indietro senza scattare non riusciva piu' ad aprirla: il tasto
 * non rispondeva, e l'unico modo era chiudere la pagina e ricominciare
 * il modulo da capo. Succede perche' iOS accetta l'apertura del
 * selettore solo come conseguenza diretta di un tocco dell'utente, e un
 * `click()` partito da JavaScript su un elemento che di fatto non si
 * vede, dopo il primo annullamento, non vale piu' come tale.
 *
 * Adesso il tasto E' il campo: una `label` che lo contiene. Il tocco
 * arriva al campo file senza passare da nessuna riga di codice, quindi
 * non c'e' niente che possa smettere di valere. Il campo resta invisibile
 * ma presente e raggiungibile — niente `pointer-events: none`, niente
 * misure da un pixel.
 */
// IL DOCUMENTO SI GUARDA E SI RITAGLIA PRIMA DI MANDARLO.
//
// Prima: si sceglieva un file e via, senza vederlo. Chi caricava da PC
// non aveva modo di accorgersi che era storto, scuro o che era partito
// lo scatto sbagliato — e il primo a cui e' successo e' stato il
// titolare. Adesso si apre il ritaglio: anteprima, rotazione, riquadro
// intorno al documento, e quello che parte e' il ritaglio in JPEG.
//
// SOLO PNG E JPG (20/10/2026). Il formato si legge dai PRIMI BYTE e non
// dal nome: su iPhone un HEIC rinominato `.jpg` arriva lo stesso, e un
// `accept` nell'input non e' una garanzia, e' un suggerimento al
// selettore dei file. Quello che non si accetta SI DICE, con il rimedio
// accanto: scartare in silenzio e' il modo migliore per ricevere moduli
// senza documento senza che nessuno se ne accorga.
function Foto({ etichetta, file, onCambia, obbligatorio }) {
  const [daRitagliare, setDaRitagliare] = useState(null);
  const [rifiutato, setRifiutato] = useState("");

  // IL RITAGLIO E' FACOLTATIVO (25/10/2026). Scelta la foto, la si
  // rimpicciolisce e comprime da sola (1600 px, JPEG) e la si da' per
  // pronta: cosi' la lettura automatica parte subito, e all'allieva non si
  // chiede un passaggio che serviva a noi e non a lei. Il tavolo intorno
  // al documento non disturba chi legge. «Guarda, gira o ritaglia» resta
  // un tasto, per chi vuole. Se la preparazione fallisce (immagine che
  // non si apre), si torna alla schermata del ritaglio di prima.
  async function scelto(grezzo) {
    setRifiutato("");
    if (!grezzo) { onCambia(null); return; }
    const tipo = await tipoVero(grezzo);
    if (!FORMATI.includes(tipo)) { setRifiutato(perchePuoiNonMandarlo(tipo)); return; }
    try {
      const url = URL.createObjectURL(grezzo);
      const immagine = new Image();
      immagine.src = url;
      await immagine.decode();
      const pronta = await ritaglia(immagine, { giri: 0, box: { x: 0, y: 0, w: 1, h: 1 } });
      URL.revokeObjectURL(url);
      if (!pronta) throw new Error("tela vuota");
      onCambia(new File([pronta], `${etichetta.toLowerCase()}.jpg`, { type: "image/jpeg" }));
    } catch {
      setDaRitagliare(grezzo);
    }
  }

  if (daRitagliare) {
    return (
      <div style={{ flex: "1 1 100%", minWidth: 0, marginBottom: 12 }}>
        <div style={etichettaStile}>{etichetta}</div>
        <RitaglioFoto
          file={daRitagliare} etichetta={etichetta}
          onAnnulla={() => setDaRitagliare(null)}
          onConferma={(pronto) => { onCambia(pronto); setDaRitagliare(null); }}
        />
      </div>
    );
  }

  return (
    <div style={{ flex: "1 1 160px", minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>
        {etichetta}{obbligatorio && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      </div>
      <label
        style={{
          ...fontBody, display: "flex", flexDirection: "column", justifyContent: "center",
          width: "100%", boxSizing: "border-box", minHeight: 96,
          border: `1px dashed ${(file?.illeggibile || file?.scaduto) ? "#B3261E" : file ? "#2E7D32" : GOLD}`, borderRadius: 12, padding: "16px 12px",
          background: (file?.illeggibile || file?.scaduto) ? "#FDECEC" : file ? "#F2F9F3" : "#FFFDF8", cursor: "pointer", textAlign: "center",
          fontSize: 13, color: (file?.illeggibile || file?.scaduto) ? "#B3261E" : file ? "#2E7D32" : NAVY, fontWeight: file ? 700 : 400, lineHeight: 1.5,
        }}
      >
        <input
          type="file" accept="image/jpeg,image/png"
          data-foto={etichetta}
          onChange={(e) => {
            scelto(e.target.files?.[0] || null);
            // si svuota: scegliendo DUE VOLTE lo stesso file, senza questo
            // il campo non cambia valore e non succede niente
            e.target.value = "";
          }}
          // invisibile ma vivo: zero dimensioni e basta. Nascondendolo con
          // `display:none` alcuni browser smettono di aprirlo dalla label.
          style={{ width: 0, height: 0, opacity: 0, position: "absolute" }}
        />
        <span>{file?.scaduto ? "✗ documento scaduto: caricane uno valido" : file?.illeggibile ? "✗ non si legge: scatta di nuovo" : file ? "✓ pronta da mandare" : "Scegli o scatta"}</span>
        {!file && <span style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>va bene anche con il tavolo intorno</span>}
        {!file && <span style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>foto JPG o PNG</span>}
      </label>
      {file && (
        <button type="button" onClick={() => setDaRitagliare(file)}
          style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: NAVY, background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", textDecoration: "underline" }}>
          guarda o ritaglia di nuovo
        </button>
      )}
      {rifiutato && (
        <div style={{ ...fontBody, fontSize: 11.5, color: "#C0392B", marginTop: 6, lineHeight: 1.45 }}>{rifiutato}</div>
      )}
    </div>
  );
}

// UNA DICHIARAZIONE. Sta qui fuori, non dentro PaginaModulo: un
// componente dichiarato nel corpo di un altro nasce nuovo a ogni
// disegno e si porta via quello che c'e' dentro — e' il guasto che
// chiudeva la tastiera a ogni lettera.
//
// Tutta la riga e' cliccabile, etichetta compresa: su un telefono
// centrare una casella di 18 pixel col pollice non funziona.
function Dichiarazione({ casella, segnata, onCambia, spenta = false }) {
  return (
    <label
      style={{
        display: "flex", gap: 12, alignItems: "flex-start", cursor: spenta ? "default" : "pointer",
        padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
        opacity: spenta ? 0.45 : 1,
      }}
    >
      <input
        type="checkbox" checked={segnata} onChange={onCambia} disabled={spenta}
        style={{ width: 20, height: 20, flex: "0 0 auto", marginTop: 2, accentColor: NAVY }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ ...fontDisplay, display: "block", fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 2 }}>
          {casella.etichetta}
          {casella.tipo !== "facoltativa" && <span style={{ color: "#B3261E" }}> *</span>}
        </span>
        <span style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6 }}>{casella.testo}</span>
        {casella.clausole && (
          <span style={{ display: "block", marginTop: 6, fontSize: 12, color: GRAFITE, lineHeight: 1.7 }}>
            {casella.clausole.map((r, i) => <span key={i} style={{ display: "block" }}>– {r}</span>)}
          </span>
        )}
      </span>
    </label>
  );
}

export default function PaginaModulo({ token }) {
  const [dati, setDati] = useState(null);
  // DUE GUASTI DIVERSI, E NON VANNO NELLA STESSA SCATOLA.
  //
  // `errore` e' "non sono riuscito ad aprire il modulo": li' non c'e'
  // niente da mostrare e la pagina diventa un avviso. `erroreInvio` e'
  // "ho provato a spedire e non e' andata": il modulo compilato deve
  // restare dov'e'.
  //
  // Prima erano la stessa variabile, e siccome il controllo su `errore`
  // esce PRIMA di disegnare il modulo, un invio fallito cancellava dallo
  // schermo tutto quello che l'allieva aveva scritto e firmato,
  // lasciandole "Qualcosa non ha funzionato. Riprova fra poco" e niente
  // da riprovare.
  const [errore, setErrore] = useState("");
  const [erroreInvio, setErroreInvio] = useState("");
  const [chiusoDopo, setChiusoDopo] = useState("");
  const [caricando, setCaricando] = useState(true);
  const [risposte, setRisposte] = useState({});
  const [firma, setFirma] = useState(null);
  const [docFronte, setDocFronte] = useState(null);
  const [docRetro, setDocRetro] = useState(null);
  // nessuna spunta in partenza: una casella gia' segnata non e' un
  // consenso, e per quelle facoltative sarebbe proprio quello che il
  // GDPR non ammette
  const [spunte, setSpunte] = useState({});
  const [spedendo, setSpedendo] = useState(false);
  const [spedito, setSpedito] = useState(false);
  // LA LETTURA DEL DOCUMENTO (25/10/2026): appena il fronte e' pronto
  // parte da sola; il risultato si mostra sotto le foto e si confronta
  // con quello che c'e' nel modulo. Se fallisce non ferma niente.
  const [letturaDoc, setLetturaDoc] = useState(null);
  // IL RITAGLIO LO FA IL LETTORE (25/10/2026): il modello dice anche dove
  // sta il documento nella foto e di quanto va girato; la pagina lo
  // ritaglia e lo raddrizza da sola, e quello che parte e' il documento
  // e non il tavolo. La foto ritagliata porta il segno `giaLetta` cosi'
  // non si rilegge: la lettura e' quella appena fatta.
  async function ritagliaDaLettura(file, letto) {
    const r = letto?.riquadro;
    const giri = { 0: 0, 90: 1, 180: 2, 270: 3 }[Number(letto?.rotazione) || 0] || 0;
    const boxValido = r && [r.x, r.y, r.w, r.h].every((n) => typeof n === "number" && n >= 0 && n <= 1) && r.w >= 0.2 && r.h >= 0.2 && (r.w < 0.97 || r.h < 0.97);
    if (!boxValido && giri === 0) return null;
    try {
      const url = URL.createObjectURL(file);
      const immagine = new Image();
      immagine.src = url;
      await immagine.decode();
      // un filo di margine intorno al riquadro: un bordo tagliato e' peggio di un po' di tavolo
      const m = 0.02;
      const box = boxValido
        ? { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m), w: Math.min(1 - Math.max(0, r.x - m), r.w + 2 * m), h: Math.min(1 - Math.max(0, r.y - m), r.h + 2 * m) }
        : { x: 0, y: 0, w: 1, h: 1 };
      const pronta = await ritaglia(immagine, { giri, box });
      URL.revokeObjectURL(url);
      if (!pronta) return null;
      const nuova = new File([pronta], file.name || "fronte.jpg", { type: "image/jpeg" });
      nuova.giaLetta = true;
      return nuova;
    } catch { return null; }
  }
  useEffect(() => {
    if (!docFronte) { setLetturaDoc(null); return; }
    if (docFronte.giaLetta) return; // e' il ritaglio della foto gia' letta
    let vivo = true;
    setLetturaDoc({ stato: "leggo" });
    const lettore = new FileReader();
    lettore.onload = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("leggi-documento", { body: { token, lato: "fronte", immagine: String(lettore.result) } });
        if (!vivo) return;
        if (error || !data?.ok) { setLetturaDoc({ stato: "errore", errore: data?.errore || error?.message || "nessuna risposta" }); return; }
        setLetturaDoc({ stato: "ok", letto: data.letto });
        // ILLEGGIBILE: la foto resta nel campo per mostrare il perche', ma
        // porta il segno `illeggibile` e il modulo non parte finche' non
        // la si rifa' (vedi `mancanti`)
        const scaduto = scadenzaDocumento(data.letto).scaduto;
        if (data.letto?.leggibile === false || data.letto?.qualita === "illeggibile" || scaduto) {
          const bocciata = new File([docFronte], docFronte.name || "fronte.jpg", { type: docFronte.type || "image/jpeg" });
          bocciata.giaLetta = true;
          if (scaduto) bocciata.scaduto = true; else bocciata.illeggibile = true;
          if (vivo) setDocFronte(bocciata);
          return;
        }
        // letto: si ritaglia e si raddrizza da soli, senza rileggere
        const ritagliata = await ritagliaDaLettura(docFronte, data.letto);
        if (vivo && ritagliata) setDocFronte(ritagliata);
      } catch (e) {
        if (vivo) setLetturaDoc({ stato: "errore", errore: String(e?.message || e) });
      }
    };
    lettore.onerror = () => { if (vivo) setLetturaDoc({ stato: "errore", errore: "foto non leggibile" }); };
    lettore.readAsDataURL(docFronte);
    return () => { vivo = false; };
  }, [docFronte, token]);
  // il regolamento parte chiuso: vedi il blocco piu' sotto
  const [regolamentoAperto, setRegolamentoAperto] = useState(false);
  // APERTO E RICHIUSO ALMENO UNA VOLTA.
  //
  // Finche' non succede, le dichiarazioni e la firma restano spente. Non
  // dimostra che l'abbia letto — niente lo dimostra — ma toglie il caso
  // in cui qualcuno firma senza aver nemmeno visto che esiste un
  // regolamento, che e' esattamente quello che poteva succedere prima:
  // la tendina e' chiusa di suo, e si poteva scorrere, spuntare "ho
  // letto" e firmare senza aprirla mai.
  //
  // Si segna alla CHIUSURA e non all'apertura: aperto e lasciato aperto
  // vuol dire che si e' scorso il modulo fino in fondo passandoci
  // attraverso, ed e' la situazione da cui si veniva.
  const [regolamentoLetto, setRegolamentoLetto] = useState(false);
  // per dirle che non deve riscrivere tutto: vedi `chiaveBozza`
  const [bozzaRipresa, setBozzaRipresa] = useState(false);
  // l'ultimo codice fiscale calcolato: serve a non riscriverlo addosso
  // a chi l'ha cancellato di proposito
  const [cfProposto, setCfProposto] = useState("");

  useEffect(() => {
    let vivo = true;
    supabase.rpc("modulo_vista", { p_token: token }).then(({ data, error }) => {
      if (!vivo) return;
      setCaricando(false);
      if (error) { setErrore(error.message); return; }
      setDati(data || null);
      if (data) {
        const d = {};
        for (const c of data.campi || []) if (!c.bloccato && c.valore) d[c.chiave] = c.valore;
        if (!d.tipo_cliente) {
          const t = (data.campi || []).find((c) => c.chiave === "tipo_cliente");
          if (t?.valore) d.tipo_cliente = t.valore;
        }
        // la bozza vince sui valori di partenza: e' quello che aveva
        // gia' scritto lei prima che la pagina si chiudesse
        const bozza = leggiBozza(token);
        setRisposte(bozza?.risposte ? { ...d, ...bozza.risposte } : d);
        if (bozza?.spunte) setSpunte(bozza.spunte);
        if (bozza?.regolamentoLetto) setRegolamentoLetto(true);
        if (bozza) setBozzaRipresa(true);
      }
    });
    return () => { vivo = false; };
  }, [token]);

  // si riscrive a ogni tocco, non ogni tanto: la finestra interna
  // dell'app di posta non avvisa prima di chiudersi
  useEffect(() => {
    if (!dati || spedito) return;
    const qualcosa = Object.keys(risposte).length || Object.keys(spunte).length || regolamentoLetto;
    if (qualcosa) scriviBozza(token, { risposte, spunte, regolamentoLetto });
  }, [token, dati, spedito, risposte, spunte, regolamentoLetto]);

  // IL CODICE FISCALE SI CALCOLA DA SE'.
  //
  // Stessa regola della scheda: si scrive solo se la casella e' vuota,
  // una volta sola per ogni valore calcolato. Se lo cancella — perche'
  // il suo e' un codice da omocodia — resta cancellato.
  useEffect(() => {
    if (!dati || spedito) return;
    const d = (dati.campi || []).find((x) => x.chiave === "codice_fiscale");
    if (!d || d.bloccato) return;
    // stessa regola della scheda: si rifa' solo il codice che abbiamo
    // proposto noi. Quello che ha scritto lei non si tocca.
    const scritto = String(risposte.codice_fiscale || "").trim();
    if (scritto && scritto !== cfProposto) return;
    const calcolato = calcolaCodiceFiscale({
      cognome: risposte.cognome || perChiaveValore(dati, "cognome"),
      nome: risposte.nome || perChiaveValore(dati, "nome"),
      sesso: risposte.sesso,
      dataNascita: risposte.data_nascita,
      comuneNascita: risposte.comune_nascita,
      statoNascita: risposte.stato_nascita,
    });
    if (!calcolato || calcolato === cfProposto) return;
    setCfProposto(calcolato);
    setRisposte((r) => ({ ...r, codice_fiscale: calcolato }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, spedito, risposte.codice_fiscale, risposte.cognome, risposte.nome,
      risposte.sesso, risposte.data_nascita, risposte.comune_nascita, risposte.stato_nascita]);

  if (caricando) return <Avviso titolo="Un momento" testo="Sto aprendo il tuo modulo." />;
  if (errore) return <Avviso titolo="Qualcosa non ha funzionato" testo={`Riprova fra poco. Se continua, scrivici. (${errore})`} />;
  if (!dati) return <Avviso titolo="Questo link non è valido" testo="Può essere scaduto, oppure copiato male. Chiedi all'accademia di rimandartelo." />;
  // IL LINK VALE UNA VOLTA SOLA, e i due modi di averlo gia' usato non
  // sono la stessa cosa: "l'iscrizione e' confermata" e "il modulo l'hai
  // gia' mandato" vogliono due risposte diverse. Chi ha appena spedito e
  // riapre la mail non deve leggere una frase che non c'entra, e
  // soprattutto non deve trovarsi davanti il modulo da rifare: rifirmare
  // sostituiva la firma e il documento gia' archiviati.
  if (dati.scaduto && dati.motivo === "gia_inviato") return <Avviso buono titolo="Modulo già inviato"
    testo={`${dati.nome}, il tuo modulo è arrivato${dati.ricevuto_il ? " il " + quandoEsteso(dati.ricevuto_il) : ""} e non va rifatto. Ne hai ricevuto una copia firmata per email: se non la trovi, scrivici e te la rimandiamo.`} />;
  if (dati.scaduto) return <Avviso buono titolo="Iscrizione già confermata"
    testo={`${dati.nome}, la tua iscrizione a ${dati.corso?.nome || "questo corso"} è già completa: non serve più compilare niente. A presto!`} />;
  if (chiusoDopo === "gia_inviato") return <Avviso buono titolo="Modulo già inviato"
    testo={`${dati.nome}, il tuo modulo risulta già arrivato: non serve rimandarlo. Ne ricevi una copia firmata per email.`} />;
  if (chiusoDopo) return <Avviso buono titolo="Iscrizione già confermata"
    testo={`${dati.nome}, la tua iscrizione è già completa: non serve più compilare niente.`} />;
  if (spedito) return <Avviso buono titolo="Ricevuto, grazie!"
    testo={`${dati.nome}, abbiamo il tuo modulo firmato. Ci vediamo a ${dati.corso?.citta || "presto"}.`} />;

  const perChiave = Object.fromEntries((dati.campi || []).map((c) => [c.chiave, c]));
  const c = (k) => perChiave[k];

  // LA RESIDENZA SI SCEGLIE ANCHE QUI, NON SOLO NELLA SCHEDA.
  //
  // La cascata (stato -> provincia -> comune -> CAP) viveva solo dalla
  // parte del venditore. Di qua erano quattro caselle di testo libero, e
  // il caso peggiore e' proprio quello normale: il venditore ha gia'
  // scritto «Roma», l'allieva trova il comune bloccato e il CAP vuoto, e
  // il CAP di Roma lo deve sapere a memoria — mentre noi li abbiamo
  // tutti e ottantadue qui nel bundle.
  //
  // Le liste si ricavano da quello che c'e' gia': la provincia da quella
  // scritta o dal comune, i comuni dalla provincia, i CAP dal comune. Se
  // non si ricava niente — comune fuori elenco, residenza all'estero —
  // la casella resta di testo libero com'era: un elenco chiuso
  // incompleto impedirebbe di registrare chi esiste.
  const valoreDi = (k) => String(risposte[k] ?? c(k)?.valore ?? "").trim();
  const statoScritto = valoreDi("stato_residenza");
  const fuoriItaliaModulo = statoScritto !== "" && normalizzaNome(statoScritto) !== "ITALIA";
  const comuneScritto = valoreDi("citta_residenza");
  const provinciaModulo = (valoreDi("prov_residenza") || provinciaDiComune(comuneScritto) || "").toUpperCase();
  // UN ELENCO CHIUSO NON PUO' CANCELLARE QUELLO CHE C'E' GIA'. Se il
  // valore in casella non e' fra le voci, la tendina lo mostrerebbe
  // vuoto e basterebbe spedire per perderlo: li' si resta sul testo.
  const elencoBuono = (voci, valore) => voci.length > 0
    && (!valore || voci.some((x) => normalizzaNome(x) === normalizzaNome(valore)));
  const comuniModulo = !fuoriItaliaModulo && provinciaModulo ? comuniDiProvincia(provinciaModulo) : [];
  const capModulo = !fuoriItaliaModulo && comuneScritto ? capDiComune(provinciaModulo, comuneScritto) : [];
  function campoConElenco(campo) {
    if (campo.chiave === "stato_residenza") {
      return { ...campo, opzioni: [{ valore: "ITALIA", etichetta: "Italia" }, ...nomiStati().map((x) => ({ valore: x, etichetta: x }))] };
    }
    if (campo.chiave === "citta_residenza" && elencoBuono(comuniModulo, comuneScritto)) {
      return { ...campo, opzioni: comuniModulo };
    }
    if (campo.chiave === "cap_residenza" && elencoBuono(capModulo, valoreDi("cap_residenza"))) {
      return { ...campo, opzioni: capModulo };
    }
    return campo;
  }
  const scrivi = (k, v) => setRisposte((r) => ({ ...r, [k]: v }));
  const testi = {
    intro:       dati.contratto?.intro       || DAL_CODICE.intro,
    regolamento: dati.contratto?.regolamento || DAL_CODICE.regolamento,
    consensi:    dati.contratto?.consensi    || DAL_CODICE.consensi,
  };
  const eAzienda = (risposte.tipo_cliente || c("tipo_cliente")?.valore) === "azienda";

  // cosa manca per poter spedire
  const mancanti = [];
  const serve = (campo, spento) => {
    const d = c(campo.chiave);
    if (!d || !d.obbligatorio || d.bloccato || spento) return;
    if (!String(risposte[campo.chiave] || "").trim()) mancanti.push(campo.etichetta || etichettaDi(campo.chiave));
  };
  // il comune di nascita non si chiede a chi e' nato all'estero: la
  // casella e' spenta, e pretenderla vorrebbe dire un modulo che non si
  // puo' spedire
  const natoFuori = !!String(risposte.stato_nascita || "").trim();
  AREA_ALLIEVO.righe.forEach((r) => r.campi.forEach((campo) => {
    if (campo.chiave === "tipo_cliente") return;
    serve(campo, campo.chiave === "comune_nascita" && natoFuori);
  }));
  AREA_FATTURAZIONE.righe.forEach((r) => r.campi.forEach((campo) => serve(campo, !eAzienda)));
  if (c("taglia_divisa")) serve({ chiave: "taglia_divisa", etichetta: "Taglia divisa" }, false);
  if (c("doc_tipo"))   serve({ chiave: "doc_tipo" }, false);
  if (c("doc_numero")) serve({ chiave: "doc_numero" }, false);
  if (c("doc_fronte")?.obbligatorio && !c("doc_fronte")?.bloccato && !docFronte) mancanti.push("Foto del documento — fronte");
  if (docFronte?.illeggibile) mancanti.push("Foto del documento — fronte: non si legge, va rifatta");
  if (docFronte?.scaduto) mancanti.push("Documento scaduto: serve un documento valido");
  if (c("doc_retro")?.obbligatorio  && !c("doc_retro")?.bloccato  && !docRetro)  mancanti.push("Foto del documento — retro");
  if (!regolamentoLetto) mancanti.push("Aprire il regolamento e richiuderlo");
  if (!firma) mancanti.push("La firma");

  // QUALI CASELLE SI MOSTRANO. Le tre obbligatorie e le due facoltative
  // sempre; quella dell'avvio immediato solo se al corso mancano meno
  // giorni del termine di recesso — vedi regole-recesso.js, che e'
  // l'unico posto dove quel numero e' scritto.
  const caselle = (testi.consensi.caselle || []).filter(
    (c) => c.tipo !== "avvio" || serveAvvioImmediato(dati.corso?.inizio),
  );
  for (const c of caselle) {
    if (c.tipo !== "facoltativa" && !spunte[c.chiave]) mancanti.push(c.etichetta);
  }
  const puoSpedire = mancanti.length === 0 && !spedendo;

  async function spedisci() {
    setSpedendo(true); setErroreInvio("");
    try {
      const cartella = token.slice(0, 16);
      const sali = async (file, nome) => {
        if (!file) return null;
        const est = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const percorso = `${cartella}/${nome}-${Date.now()}.${est}`;
        const { error } = await supabase.storage.from("moduli-iscrizione")
          .upload(percorso, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(`Non riesco a caricare ${nome}: ${error.message}`);
        return percorso;
      };
      const pFronte = await sali(docFronte, "fronte");
      const pRetro  = await sali(docRetro, "retro");
      const pFirma  = await sali(firma && new File([firma], "firma.png", { type: "image/png" }), "firma");

      const { data, error } = await supabase.rpc("modulo_salva", {
        p_token: token, p_risposte: risposte,
        p_firma: pFirma, p_doc_fronte: pFronte, p_doc_retro: pRetro,
        // le spunte vanno al database come le ha lasciate lei: la
        // funzione rifiuta il modulo se le tre obbligatorie non ci sono,
        // e scrive la data accanto a ognuna di quelle date
        p_consensi: spunte,
        // QUELLO CHE AVEVA DAVANTI, CONGELATO ADESSO.
        //
        // `testi` e' esattamente cio' che questa pagina le ha mostrato —
        // il regolamento e le frasi sopra ogni casella, presi da
        // `modulo_iscrizione_testi` o, se la riga manca, dal codice. Qui
        // finisce in `iscritti.contratto_firmato` e da li' lo ricopia il
        // PDF della conferma.
        //
        // Senza questo passaggio il documento che lei riceve direbbe
        // soltanto "vale la versione in vigore": vero, ma inservibile fra
        // due anni, quando quella versione sara' stata corretta tre volte
        // da Setting → Il contratto e nessuno potra' piu' dire quale
        // avesse letto. Si registra solo ora, alla firma, e non si
        // riscrive mai piu' — la funzione usa `coalesce`.
        p_contratto: {
          regolamento: testi.regolamento,
          // le caselle INTERE, non quattro campi scelti da me: quella
          // dell'approvazione specifica si porta dietro l'elenco delle
          // clausole degli artt. 1341-1342 c.c., ed e' proprio l'elenco
          // che rende l'approvazione specifica. Copiandone solo il
          // "testo" il documento si fermerebbe ai due punti.
          //
          // Solo quelle che le sono state davvero mostrate: la casella
          // dell'avvio immediato compare solo a ridosso del corso.
          consensi: caselle,
          informativa: {
            etichetta: testi.consensi.informativaEtichetta,
            rimando: testi.consensi.informativaRimando,
          },
          firmato_il: new Date().toISOString(),
        },
      });
      if (error) throw new Error(error.message);
      // il modulo risulta gia' arrivato (due dita sul tasto, o la stessa
      // pagina aperta due volte): non e' un errore da mostrare in rosso,
      // e' la stessa risposta che si da' a chi riapre il link
      // SOLO questi due motivi chiudono la pagina. Prima bastava un motivo
      // qualunque: `senza_firma`, `senza_taglia` e, dal 31/10/2026,
      // `senza_documento`, `senza_contratto` e `percorso_non_valido`
      // facevano comparire «Iscrizione già confermata» al posto del
      // modulo, cioe' l'allieva perdeva la pagina per una cosa che
      // poteva correggere. Gli altri restano errori sopra il modulo.
      const rifiuto = leggiRifiuto(data);
      if (rifiuto?.chiude) { setChiusoDopo(rifiuto.motivo); return; }
      if (!data?.ok) throw new Error(data?.errore || "Non è stato possibile inviare il modulo.");
      // il modulo e' scritto: la bozza non serve piu' e non deve restare
      // su un telefono che magari non e' nemmeno suo
      cancellaBozza(token);
      setSpedito(true);

      // LA CONFERMA DI RICEZIONE, dopo e non prima.
      //
      // Parte solo a modulo scritto: quella mail dice "abbiamo ricevuto",
      // e mandarla prima del salvataggio vorrebbe dire prometterlo senza
      // saperlo. La manda il server — vedi la funzione `modulo-ricevuto`:
      // da questa pagina nessuno ha una sessione, e `invia-email` non
      // accetta la chiave pubblicabile.
      //
      // Se non parte, qui non succede niente: il modulo E' arrivato, e
      // dirle "errore" dopo che il suo documento e' al sicuro la
      // spingerebbe a rimandare tutto. Il guasto resta scritto nel
      // registro degli invii, dove qualcuno lo vede.
      try {
        await supabase.functions.invoke("modulo-ricevuto", { body: { token } });
      } catch (e) {
        console.error("conferma di ricezione non partita:", e?.message || e);
      }
    } catch (e) {
      setErroreInvio(e.message || String(e));
    } finally {
      setSpedendo(false);
    }
  }

  const pannello = { ...areaSchedaIscritto, marginBottom: 14 };
  const paragrafo = { fontSize: 12.5, color: GRAFITE, lineHeight: 1.65, margin: "8px 0" };
  const quantiPunti = (testi.regolamento.blocchi || []).length;

  // UNA RIGA DELL'ANAGRAFICA: chi ha gia' un valore si legge, gli altri
  // sono suoi.
  //
  // E' una funzione che restituisce JSX, e si chiama — `{rigaSua(...)}` —
  // invece di essere montata come componente — `<RigaSua .../>`. La
  // differenza non e' di stile: dichiarata qui dentro, a ogni disegno
  // nasceva una funzione nuova, e per React una funzione diversa e' un
  // componente diverso. Quindi a ogni lettera battuta smontava l'intera
  // riga e ne costruiva un'altra: il campo in cui si stava scrivendo
  // veniva distrutto sotto il dito, il fuoco se ne andava senza nemmeno
  // un evento di uscita, e sul telefono si chiudeva la tastiera.
  // Misurato il 17/10/2026 sul modulo vero: sedici caselle rifatte in
  // tre lettere. Chiamandola, i figli restano `Letto`/`DaRiempire`, che
  // stanno fuori di qui e non cambiano mai identita'.
  const rigaSua = (riga, spenti = false) => (
    // `aCapo: false` vale anche qui: una riga tenuta insieme nella
    // scheda e spezzata nel modulo e' la stessa riga disegnata in due
    // modi, cioe' due disposizioni da mantenere invece di una
    <div style={{ display: "flex", gap: 14, flexWrap: riga.aCapo === false ? "nowrap" : "wrap" }}>
      {riga.campi.map((campo) => {
        const d = c(campo.chiave);
        if (!d) return null;
        if (campo.chiave === "tipo_cliente") {
          return <SceltaIntestazione key={campo.chiave} valore={risposte.tipo_cliente || d.valore} onCambia={scrivi} />;
        }
        if (d.bloccato) {
          return <Letto key={campo.chiave} etichetta={campo.etichetta || etichettaDi(campo.chiave)}
                        valore={mostra(campo.chiave, d.valore)} larghezza={campo.larghezza} />;
        }
        // nato all'estero: il comune italiano non si chiede piu'
        const fuori = campo.chiave === "comune_nascita"
          && !!String(risposte.stato_nascita || "").trim();
        return <DaRiempire key={campo.chiave} campo={campoConElenco(campo)} valore={fuori ? "" : risposte[campo.chiave]}
                           onCambia={scrivi} obbligatorio={d.obbligatorio} spento={spenti || fuori}
                           tutte={risposte}
                           nota={campo.chiave === "codice_fiscale" && cfProposto
                             && risposte.codice_fiscale === cfProposto
                             ? "L'abbiamo calcolato dalla tua data e dal tuo luogo di nascita: confrontalo con quello sul documento e, se è diverso, correggilo."
                             : null} />;
      })}
    </div>
  );

  // un riquadro commerciale: di sola lettura per intero, e senza le
  // righe che il venditore ha lasciato vuote
  const rigaLetta = (chiavi) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {chiavi.map((k) => <Letto key={k} etichetta={etichettaDi(k)} valore={mostra(k, c(k)?.valore)} />)}
    </div>
  );
  // le chiavi di un gruppo che hanno davvero qualcosa da dire
  const scritte = (chiavi) => chiavi.filter((k) => c(k) && pieno(c(k).valore));

  return (
    <div style={{ ...fontBody, minHeight: "100vh", padding: "20px 14px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.35, marginBottom: 6 }}>
          {testi.intro.titolo}
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>{testi.intro.sottotitolo}</div>

        {/* Chi rientra dopo che la pagina si e' chiusa da sola deve
            capire perche' i campi sono gia' pieni — e sapere subito che
            le foto invece no, quelle vanno riprese. */}
        {bozzaRipresa && (
          <div style={{
            ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#1C5E33",
            background: "#F2F9F3", border: "1px solid #CFE6D5", borderRadius: 10,
            padding: "10px 12px", marginBottom: 16,
          }}>
            Abbiamo ritrovato quello che avevi già scritto, non devi rifarlo.
            Le foto del documento vanno riscelte.
          </div>
        )}

        {/* MODULO RIAPERTO (24/10/2026): i campi sono precompilati con quello
            che aveva scritto la prima volta, e si possono correggere tutti.
            Va detto, o si pensa che «non si possa toccare». */}
        {dati.riaperto && (
          <div data-campo="avviso-riaperto" style={{
            ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#6B4E00",
            background: "#FFF8E6", border: "1px solid #E6CF8C", borderRadius: 10,
            padding: "10px 12px", marginBottom: 16,
          }}>
            Il modulo è stato riaperto: trovi i dati che avevi scritto la prima volta. Correggi quello che serve, poi rifirma e invia.
          </div>
        )}

        <div style={pannello}>
          <IntestazioneArea>Il tuo corso</IntestazioneArea>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              ["Corso", dati.corso?.nome],
              ["Dal",   giorno(dati.corso?.inizio)],
              ["Al",    giorno(dati.corso?.fine)],
              ["Città", dati.corso?.citta],
              ["Dove",  [dati.corso?.sede, dati.corso?.indirizzo].filter(Boolean).join(" — ")],
            ].filter(([, v]) => pieno(v)).map(([e, v]) => <Letto key={e} etichetta={e} valore={v} />)}
          </div>
        </div>

        <div style={pannello}>
          <IntestazioneArea>I tuoi dati</IntestazioneArea>
          {AREA_ALLIEVO.righe.map((r, i) => <React.Fragment key={i}>{rigaSua(r)}</React.Fragment>)}
        </div>

        {/* LA TAGLIA LA SCEGLIE LEI (29/10/2026). Stava nei «Dati
            organizzativi», di sola lettura per intero, e la scheda
            obbligava il venditore a sceglierla: arrivava sempre piena e
            sempre bloccata, cioe' una «M» tirata a indovinare che
            l'allieva non poteva correggere. Qui e' una tendina sua, e
            se il venditore aveva scritto qualcosa lo trova gia' scelto. */}
        {c("taglia_divisa") && (
          <div style={pannello}>
            <IntestazioneArea>La tua divisa</IntestazioneArea>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
              La taglia della divisa che riceverai al corso. Se non la vuoi, scegli «NO DIVISA».
            </div>
            {rigaSua({ campi: [{ chiave: "taglia_divisa", etichetta: "Taglia divisa" }] })}
          </div>
        )}

        <div style={pannello}>
          <IntestazioneArea>Dati per la fattura</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            {eAzienda
              ? "Servono tutti, altrimenti la fattura non si può emettere."
              : "Si compilano solo se sopra scegli Azienda. Da privata non servono."}
          </div>
          {AREA_FATTURAZIONE.righe.map((r, i) => <React.Fragment key={i}>{rigaSua(r, !eAzienda)}</React.Fragment>)}
        </div>

        <div style={pannello}>
          <IntestazioneArea>Il tuo documento</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            Carta d'identità o patente. Le foto restano riservate: non sono raggiungibili da nessun indirizzo pubblico.
          </div>
          {rigaSua({ campi: ["doc_tipo", "doc_numero"].filter((k) => c(k)).map((k) => ({ chiave: k })) })}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {c("doc_fronte") && <Foto etichetta="Fronte" file={docFronte} onCambia={setDocFronte} obbligatorio={c("doc_fronte").obbligatorio} />}
            {c("doc_retro")  && <Foto etichetta="Retro"  file={docRetro}  onCambia={setDocRetro}  obbligatorio={c("doc_retro").obbligatorio} />}
          </div>
          <LetturaDocumento
            lettura={letturaDoc}
            valori={Object.fromEntries(CAMPI_DOCUMENTO.map((k) => [k.chiave, valoreDi(k.chiave)]))}
            bloccati={Object.fromEntries(CAMPI_DOCUMENTO.map((k) => [k.chiave, !!c(k.chiave)?.bloccato]))}
            onUsa={(nuovi) => { for (const [k, v] of Object.entries(nuovi)) scrivi(k, v); }}
          />
        </div>

        {/* I riquadri commerciali: li ha decisi il venditore, lei li legge.
            "Il corso" salta, e' gia' il riquadro in cima. */}
        {GRUPPI_LETTURA.filter((g) => g.titolo !== "Il corso").map((g) => {
          // niente di scritto, niente riquadro: un "Presenza al corso"
          // con dentro un trattino non va mandato a nessuno
          // la taglia ha il suo riquadro sopra, dove si sceglie
          const presenti = scritte(g.chiavi.filter((k) => k !== "taglia_divisa"));
          if (!presenti.length) return null;
          return (
            <div key={g.titolo} style={pannello}>
              <IntestazioneArea>{g.titolo}</IntestazioneArea>
              {rigaLetta(presenti)}
            </div>
          );
        })}

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.regolamento.titolo || "Regolamento di partecipazione"}</IntestazioneArea>
          {/* IL REGOLAMENTO PARTE CHIUSO, e lo apre chi lo vuole leggere.
              Deciso il 18/10/2026, ed e' la seconda volta che si cambia
              idea: era a tendina, poi fu aperto perche' una tendina
              chiusa nasconde il testo che si firma dietro un gesto in
              piu'. Aperto pero' sono due schermate buone di clausole
              piantate fra i dati e la firma, e chi scorre per arrivare
              in fondo le passa tutte senza leggerne una: il modulo
              sembra lungo il doppio e il regolamento non viene letto
              comunque.
              Quello che NON cambia: la riga qui sotto dice sempre quanti
              punti sono e che firmando li accetta, il testo e' per
              intero a un dito di distanza, e la dichiarazione "ho letto
              il regolamento" resta obbligatoria e controllata da
              `modulo_salva`. Cambia solo chi decide quando leggerlo. */}
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
            {quantiPunti} {quantiPunti === 1 ? "punto" : "punti"} · lo accetti firmando qui sotto
          </div>
          {/* L'AVVISO SI VEDE, e dice per prima cosa che si sta per
              firmare. Una riga smorzata sotto il titolo della sezione
              dice la cosa giusta nel modo in cui non si legge. */}
          <div style={{
            background: "#FDF1F0", border: "1px solid #E8BDB8", borderLeft: "5px solid #B3261E",
            borderRadius: 10, padding: "12px 14px", marginBottom: 12,
          }}>
            <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: "#8A2D2D", letterSpacing: 0.6, marginBottom: 5 }}>
              ATTENZIONE
            </div>
            <div style={{ ...fontBody, fontSize: 13, lineHeight: 1.55, color: NAVY }}>
              <b>Leggi con attenzione il regolamento prima di firmare.</b> Firmando lo accetti in ogni
              sua parte, comprese le clausole che approvi specificamente più sotto.
              {!regolamentoLetto && <> Aprilo e richiudilo per proseguire: fino ad allora le dichiarazioni e la firma restano bloccate.</>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRegolamentoAperto((v) => {
              // richiudendolo si segna come letto, e non si torna indietro
              if (v) setRegolamentoLetto(true);
              return !v;
            })}
            aria-expanded={regolamentoAperto}
            style={{
              ...fontBody, width: "100%", minHeight: 44, borderRadius: 10,
              border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY,
              fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}
          >
            <span>{regolamentoAperto ? "Chiudi il regolamento" : "Leggi il regolamento"}</span>
            <span style={{ fontSize: 10, color: MUTED }}>{regolamentoAperto ? "▲" : "▼"}</span>
          </button>
          {regolamentoAperto && (
            <div style={{ marginTop: 16 }}>
              {(testi.regolamento.blocchi || []).map((b, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{b.titolo}</div>
                  {(b.punti || []).map((p, j) => <p key={j} style={paragrafo}>{p}</p>)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.consensi.informativaEtichetta}</IntestazioneArea>
          <p style={paragrafo}>{testi.consensi.informativaRimando}</p>
        </div>

        <div style={pannello}>
          <IntestazioneArea>Dichiarazioni</IntestazioneArea>
          {!regolamentoLetto && (
            <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6A1B", lineHeight: 1.55, marginBottom: 12 }}>
              Prima apri il regolamento qui sopra e richiudilo. Quello che si firma va guardato almeno una volta.
            </div>
          )}
          {caselle.filter((c) => c.tipo !== "facoltativa").map((c) => (
            <Dichiarazione key={c.chiave} casella={c} segnata={!!spunte[c.chiave]}
              spenta={!regolamentoLetto}
              onCambia={() => setSpunte((v) => ({ ...v, [c.chiave]: !v[c.chiave] }))} />
          ))}
          {caselle.some((c) => c.tipo === "facoltativa") && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}` }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{testi.consensi.titoloFacoltative}</div>
              {caselle.filter((c) => c.tipo === "facoltativa").map((c) => (
                <Dichiarazione key={c.chiave} casella={c} segnata={!!spunte[c.chiave]}
                  spenta={!regolamentoLetto}
                  onCambia={() => setSpunte((v) => ({ ...v, [c.chiave]: !v[c.chiave] }))} />
              ))}
            </div>
          )}
        </div>

        <div style={pannello}>
          <IntestazioneArea>{testi.consensi.firmaEtichetta || "Firma"}</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            Firmando accetti il regolamento e l'informativa qui sopra.
          </div>
          {/* La firma compare dopo il regolamento, non prima. Una lavagna
              per firmare messa sotto a un testo mai aperto e' un invito a
              firmare senza leggere. */}
          {regolamentoLetto ? <FirmaDito onCambia={setFirma} /> : (
            <div style={{
              ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#8A6A1B",
              background: "#FFFBF0", border: "1px dashed #E3D3AE", borderRadius: 12,
              padding: "18px 14px", textAlign: "center",
            }}>
              Qui comparirà lo spazio per firmare.<br />
              Prima apri il regolamento qui sopra e richiudilo.
            </div>
          )}
        </div>

        {erroreInvio && (
          <div style={{ border: "1px solid #B3261E", background: "#FDF1F0", borderRadius: 10,
                        padding: "10px 12px", marginBottom: 12, fontSize: 13, color: GRAFITE }}>
            {erroreInvio}
          </div>
        )}

        {mancanti.length > 0 && (
          <div style={{ fontSize: 12.5, color: GRAFITE, marginBottom: 10, lineHeight: 1.6 }}>
            Manca ancora: <b style={{ color: NAVY }}>{mancanti.join(", ")}</b>.
          </div>
        )}

        <button
          type="button" onClick={spedisci} disabled={!puoSpedire}
          style={{
            ...fontBody, width: "100%", minHeight: 52, borderRadius: 12, border: "none",
            fontSize: 15, fontWeight: 700, cursor: puoSpedire ? "pointer" : "default",
            background: puoSpedire ? NAVY : "#C9C2B4", color: "#fff",
          }}
        >
          {spedendo ? "Invio in corso…" : (testi.consensi.tastoInvio || "Accetto e Invio")}
        </button>
        <div style={{ textAlign: "center", fontSize: 11.5, color: MUTED, marginTop: 10 }}>
          {testi.consensi.notaObbligatori}
        </div>
      </div>
    </div>
  );
}
