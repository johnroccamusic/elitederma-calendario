// Il consenso, come lo vede la modella.
//
// Lei inquadra il codice e arriva qui. Non ha un account, non ha l'app,
// probabilmente e' in piedi in un corridoio e ha due minuti. Quindi:
// una colonna sola, campi grandi, e niente che si possa sbagliare in
// silenzio — chi non puo' inviare vede scritto cosa manca, non un tasto
// spento senza spiegazione.
//
// Le foto del documento si scattano dalla fotocamera posteriore
// (capture="environment"), che e' quella con cui si fotografa una carta
// d'identita' appoggiata al tavolo.
//
// I due consensi restano separati fino in fondo: quello al trattamento
// e' obbligatorio, quello a foto e video no. Metterli sotto una spunta
// sola vorrebbe dire estorcere il secondo col primo.

import { useEffect, useRef, useState } from "react";
import FirmaDito from "../ui/FirmaDito.jsx";
import { TIPI_DOCUMENTO } from "../tipi-documento.js";
import {
  NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, inputStyle,
} from "../ui/stile.js";
import { consensoDaCodice } from "../content/consensi";
import { salvaConsenso } from "./dati";


// LA VIA DEL RITORNO, ma solo per chi lavora.
//
// Questa pagina sostituisce l'applicazione: chi arriva col codice QR vede
// il modulo e nient'altro, ed e' giusto cosi'. Il guaio e' di chi il
// modulo lo apre DALL'APP per guardarlo: dentro l'app installata sulla
// schermata principale non c'e' nessuna barra del browser, quindi niente
// freccia indietro, e si resta chiusi dentro il consenso.
//
// Il tasto compare solo se in questa scheda c'e' una sessione di lavoro
// aperta (la stessa che il gate dell'app scrive entrando). Sul telefono
// della modella quel segno non c'e', e lei non vede niente.
function sessioneDiLavoroAperta() {
  try { return window.sessionStorage.getItem("edc_ok") === "1"; } catch { return false; }
}
function TornaAlGestionale() {
  if (!sessioneDiLavoroAperta()) return null;
  const casa = `${window.location.origin}${window.location.pathname}`;
  return (
    <div style={{ background: NAVY, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <a
        href={casa}
        style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Torna al gestionale
      </a>
      <span style={{ ...fontBody, fontSize: 11.5, color: "rgba(255,255,255,0.72)" }}>
        Questa riga la vedi solo tu: sul telefono della modella non c'è.
      </span>
    </div>
  );
}

function Sezione({ titolo, nota, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>
        {titolo}
      </div>
      {nota && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>{nota}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Campo({ etichetta, obbligatorio, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: MUTED }}>
        {etichetta}{obbligatorio && <span style={{ color: "#C0392B" }}> *</span>}
      </span>
      <div style={{ marginTop: 5 }}>{children}</div>
    </label>
  );
}

// campo alto 48: sotto i 44 un dito adulto sbaglia, e qui si sbaglia una
// volta sola perche' poi la pagina si chiude e non si torna indietro
const campo = { ...inputStyle, minHeight: 48, fontSize: 16 };

/**
 * Una domanda dell'anamnesi: la domanda e due tasti grossi, SÌ e NO.
 *
 * NON una spunta. Una casella non spuntata vuol dire due cose diverse —
 * "no" e "non ho ancora risposto" — e su venti domande, su un telefono,
 * in piedi in un corridoio, una saltata non si distingue da un no. Con
 * due tasti il vuoto si vede: la riga resta grigia e il tasto di invio
 * dice quante ne mancano.
 *
 * I tasti sono alti 48 come i campi: sotto i 44 un dito adulto sbaglia.
 */
// DOVE C'E' UNA DOMANDA, C'E' DOVE SCRIVERE. Sempre.
//
// Prima il campo libero compariva solo su alcune domande, e solo dopo
// aver premuto SÌ. Il risultato lo si vedeva sulla domanda degli
// interventi al seno: sotto c'era scritto «Quale intervento e in che
// mese e anno», e sotto ancora due bottoni e basta — una richiesta di
// dichiarare qualcosa senza nessun posto in cui dichiararlo. La casella
// arrivava dopo il SÌ, ma chi guardava non poteva saperlo.
//
// E non e' solo un problema di quando compare: una persona che risponde
// NO puo' avere lo stesso qualcosa da dire («l'herpes ce l'ho avuto, ma
// dieci anni fa»), e se non ha dove scriverlo quella cosa si perde.
//
// Adesso la nota c'e' su ogni domanda, sempre. Dove la risposta esatta
// serve davvero — «quali farmaci», «a cosa sei allergica» — e' quella
// richiesta a fare da suggerimento dentro la casella, invece di stare
// sopra i bottoni a sembrare una domanda senza risposta.
function RigaAnamnesi({ domanda, aiuto, specifica, valore, onCambia }) {
  const risposta = valore?.r;
  const scelto = (quale) => risposta === quale;
  const tasto = (quale, etichetta, colore) => (
    <button
      type="button"
      onClick={() => onCambia({ r: quale, s: valore?.s || "" })}
      style={{
        ...fontBody, flex: "1 1 0", minWidth: 0, minHeight: 48, borderRadius: 11, cursor: "pointer",
        fontSize: 15, fontWeight: 700, letterSpacing: 0.3,
        background: scelto(quale) ? colore.pieno : "#FFFFFF",
        color: scelto(quale) ? "#FFFFFF" : MUTED,
        border: `1px solid ${scelto(quale) ? colore.pieno : CREAM_BORDER}`,
      }}
      aria-pressed={scelto(quale)}
    >
      {etichetta}
    </button>
  );
  return (
    <div style={{
      background: "#fff", border: `1px solid ${risposta == null ? CREAM_BORDER : "#E4E9EF"}`,
      borderRadius: 12, padding: 12, marginBottom: 9,
    }}>
      <div style={{ ...fontBody, fontSize: 14, color: NAVY, lineHeight: 1.35, fontWeight: 600 }}>{domanda}</div>
      {/* l'aiuto resta sopra solo quando SPIEGA la domanda. Quando invece
          chiede di scrivere qualcosa scende dentro la casella, dov'e'
          l'unico posto in cui quella richiesta ha senso. */}
      {aiuto && !specifica && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>{aiuto}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {tasto(true, "SÌ", { pieno: "#B8860B" })}
        {tasto(false, "NO", { pieno: "#6E7391" })}
      </div>
      <input
        style={{ ...campo, marginTop: 9, minHeight: 42, fontSize: 13.5 }}
        value={valore?.s || ""}
        onChange={(e) => onCambia({ r: risposta ?? null, s: e.target.value })}
        placeholder={specifica && aiuto ? aiuto : (specifica ? "Specifica" : "Nota, se c'è qualcosa da aggiungere")}
        className="suggerimento-chiaro"
      />
    </div>
  );
}

/** Una foto del documento: si scatta, si rivede, si rifà. */
// LA FOTO DEL DOCUMENTO.
//
// Niente `capture`. Quell'attributo dice al telefono "apri la
// fotocamera e basta": su iPhone fa sparire la voce Libreria foto, e
// dentro i browser dentro le app (Instagram, WhatsApp) la scorciatoia a
// volte non apre proprio niente — il 15/10/2026 le modelle di un corso
// non riuscivano ne' a scattare ne' a scegliere dalla galleria.
//
// Senza, il telefono mostra la sua scelta di sempre — Fotocamera,
// Libreria, File — e quella funziona ovunque.
//
// Il campo non si nasconde con `display: none`: nascosto cosi' su Safari
// certi gesti non lo raggiungono. Resta nella pagina, invisibile, e si
// apre da un tasto vero col suo riferimento.
function FotoDocumento({ etichetta, blob, onCambia }) {
  const [anteprima, setAnteprima] = useState(null);
  const campoFile = useRef(null);
  useEffect(() => {
    if (!blob) { setAnteprima(null); return undefined; }
    const url = URL.createObjectURL(blob);
    setAnteprima(url);
    // l'anteprima tiene in vita un oggetto in memoria: senza questo, tre
    // scatti rifatti su un telefono vecchio si sentono
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>{etichetta}</div>
      {anteprima ? (
        <div>
          <img src={anteprima} alt={etichetta} style={{ width: "100%", borderRadius: 12, border: `1px solid ${CREAM_BORDER}`, display: "block" }} />
          <button
            type="button" onClick={() => onCambia(null)}
            style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "10px 14px", marginTop: 8, minHeight: 44, cursor: "pointer" }}
          >
            Rifai la foto
          </button>
        </div>
      ) : (
        <div>
          <input
            ref={campoFile}
            type="file" accept="image/*"
            onChange={(e) => {
              onCambia(e.target.files?.[0] || null);
              // si svuota: scegliendo DUE VOLTE la stessa foto, senza
              // questo il campo non cambia valore e non succede niente
              e.target.value = "";
            }}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
          <button
            type="button" onClick={() => campoFile.current?.click()}
            style={{ display: "block", width: "100%", border: `1px dashed ${CREAM_BORDER}`, borderRadius: 12, padding: "22px 14px", textAlign: "center", cursor: "pointer", background: "#fff", minHeight: 88 }}
          >
            <span style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>Scatta o scegli dalla galleria</span>
            <span style={{ display: "block", ...fontBody, fontSize: 12, color: MUTED, marginTop: 4 }}>
              Appoggialo su un piano, senza riflessi
            </span>
          </button>
        </div>
      )}
    </div>
  );
}


// Le due caselle di sempre, per i testi che non ne dichiarano di proprie.
// Un modello non aggiornato deve continuare a funzionare, non presentarsi
// senza niente da spuntare.
const CASELLE_DI_RIPIEGO = [
  {
    chiave: "trattamento", tipo: "obbligatoria", etichetta: "Consenso al trattamento",
    testo: "Ho letto e compreso, le informazioni che ho dato sul mio stato di salute sono vere, e acconsento al trattamento durante il corso.",
  },
  {
    chiave: "immagini", tipo: "facoltativa", etichetta: "Foto e video",
    testo: "Autorizzo l'uso di foto e video del trattamento.",
  },
];

function CasellaConsenso({ casella, segnata, onCambia, spenta }) {
  return (
    <label
      style={{
        display: "flex", gap: 11, alignItems: "flex-start", marginTop: 10,
        cursor: spenta ? "default" : "pointer", background: "#fff",
        border: `1px solid ${segnata ? "#BFE3C6" : CREAM_BORDER}`,
        borderRadius: 12, padding: 14, opacity: spenta ? 0.45 : 1,
      }}
    >
      <input
        type="checkbox" checked={segnata} disabled={spenta} onChange={onCambia}
        style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ ...fontDisplay, display: "block", fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 3 }}>
          {casella.etichetta}
          {casella.tipo !== "facoltativa" && <span style={{ color: "#B3261E" }}> *</span>}
        </span>
        <span style={{ fontSize: 13, color: NAVY, lineHeight: 1.55 }}>{casella.testo}</span>
      </span>
    </label>
  );
}

export default function PaginaConsenso({ codice, edizione = null }) {
  const modello = consensoDaCodice(codice);
  const [v, setV] = useState({
    nome: "", cognome: "", dataNascita: "", luogoNascita: "", residenza: "",
    telefono: "", email: "", documentoTipo: TIPI_DOCUMENTO[0], documentoNumero: "",
    // Alcuni modelli dichiarano gia' quale trattamento e': dove il corso
    // ne prevede uno solo, far scegliere da una tendina di una voce e'
    // un passaggio che non decide niente. Resta cambiabile.
    trattamento: modello?.contenuto?.trattamentoPredefinito || "",
    trattamentoAltro: "", esecutore: "", noteSalute: "",
  });
  // le risposte al questionario: { chiave: { r: true|false, s: "..." } }
  const [anamnesi, setAnamnesi] = useState({});
  const [fronte, setFronte] = useState(null);
  const [retro, setRetro] = useState(null);
  const [firma, setFirma] = useState(null);
  // LE SPUNTE SONO QUELLE DEL MODELLO, non due fisse.
  //
  // C'erano `accetto` e `fotoVideo`, e la prima diceva tre cose insieme:
  // "ho letto e compreso, le informazioni sulla mia salute sono vere, e
  // acconsento al trattamento". Tre consensi distinti in un gesto solo,
  // che e' esattamente quello che il GDPR non ammette — e mancava del
  // tutto l'art. 9 sui dati di salute, che e' poi quello che il
  // questionario qui sopra raccoglie.
  const [spunte, setSpunte] = useState({});
  // le risposte ai campi che il singolo modello chiede in piu'
  const [extra, setExtra] = useState({});
  const [testoAperto, setTestoAperto] = useState(false);
  // APERTO E RICHIUSO ALMENO UNA VOLTA.
  //
  // Finche' non succede, le spunte e la firma restano spente. Non
  // dimostra che l'abbia letto — niente lo dimostra — ma toglie il caso
  // in cui si firma un consenso informato senza aver visto che esiste un
  // testo: la tendina e' chiusa di suo, e si poteva scorrere fino in
  // fondo, spuntare "ho letto e compreso" e firmare senza aprirla mai.
  //
  // Si segna alla CHIUSURA e non all'apertura: aperto e lasciato aperto
  // vuol dire che ci si e' scorsi attraverso per arrivare alla firma.
  // E' la stessa regola del modulo di iscrizione, per lo stesso motivo.
  const [testoLetto, setTestoLetto] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState("");

  const cambia = (chiave) => (e) => setV((p) => ({ ...p, [chiave]: e.target.value }));

  if (!modello) {
    return (
      <div style={{ ...fontBody, minHeight: "100vh", background: "#FAF8F3" }}>
        <TornaAlGestionale />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: MUTED, minHeight: "60vh" }}>
          Questo codice non corrisponde a nessun consenso. Chiedi alla scuola il codice giusto.
        </div>
      </div>
    );
  }

  // cosa manca, detto a parole: un tasto spento e basta lascia la
  // persona a cercare l'errore da sola
  const mancanze = [];
  if (!v.nome.trim() || !v.cognome.trim()) mancanze.push("nome e cognome");
  if (!v.trattamento) mancanze.push("il trattamento");
  if (v.trattamento === "Altro" && !v.trattamentoAltro.trim()) mancanze.push("quale altro trattamento");
  // CHI ESEGUE, quando il modello lo chiede. Sul cartaceo del
  // microneedling sono tre righe vuote da riempire a mano: un consenso
  // che non nomina chi ha operato risponde a meta' della domanda per cui
  // esiste.
  if (modello?.contenuto?.esecutore?.obbligatorio && !v.esecutore.trim()) {
    mancanze.push("chi esegue il trattamento");
  }
  for (const campoExtra of modello?.contenuto?.campiExtra || []) {
    if (campoExtra.obbligatorio && !String(extra[campoExtra.chiave] || "").trim()) {
      mancanze.push(campoExtra.etichetta.toLowerCase());
    }
  }
  // Tutte le domande, nessuna esclusa. E' il punto del questionario: una
  // saltata e' proprio quella su cui l'operatore si sarebbe fermato.
  const domande = modello.contenuto.anamnesi || [];
  const senzaRisposta = domande.filter((d) => anamnesi[d.chiave]?.r == null);
  if (senzaRisposta.length > 0) {
    mancanze.push(senzaRisposta.length === 1
      ? "una domanda sulla salute"
      : `${senzaRisposta.length} domande sulla salute`);
  }
  if (!fronte) mancanze.push("la foto del documento");
  if (!testoLetto) mancanze.push("aprire il testo del consenso e richiuderlo");
  if (!firma) mancanze.push("la firma");
  const obbligatorie = (modello?.contenuto?.caselle || CASELLE_DI_RIPIEGO)
    .filter((x) => x.tipo !== "facoltativa");
  const nonSpuntate = obbligatorie.filter((x) => !spunte[x.chiave]);
  if (nonSpuntate.length) {
    mancanze.push(nonSpuntate.length === 1
      ? `la spunta «${nonSpuntate[0].etichetta}»`
      : `${nonSpuntate.length} spunte obbligatorie`);
  }

  async function invia() {
    setErrore("");
    setInviando(true);
    const esito = await salvaConsenso(
      {
        modelloCodice: modello.codice,
        versioneTesto: modello.contenuto.versione,
        nome: v.nome, cognome: v.cognome, dataNascita: v.dataNascita || null,
        luogoNascita: v.luogoNascita, residenza: v.residenza,
        telefono: v.telefono, email: v.email,
        documentoTipo: v.documentoTipo, documentoNumero: v.documentoNumero,
        trattamento: v.trattamento, trattamentoAltro: v.trattamentoAltro,
        esecutore: v.esecutore,
        campiExtra: extra,
        noteSalute: v.noteSalute,
        anamnesi,
        consensoTrattamento: true,
        // il booleano di sempre resta, e viene dalla casella delle
        // immagini: l'archivio e i consensi vecchi parlano quella lingua
        consensoFotoVideo: !!spunte.immagini?.r,
        consensi: spunte,
      },
      { fronte, retro, firma },
      // da quale classe arriva: lo dice il QR stampato dalla scheda corso.
      // Col QR generico appeso in aula resta null, e il consenso si trova
      // solo nell'archivio generale — li' ci sono tutti.
      edizione,
    );
    setInviando(false);
    if (esito.errore) { setErrore(esito.errore); return; }
    setInviato(true);
    window.scrollTo(0, 0);
  }

  if (inviato) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F3", ...fontBody }}>
        <TornaAlGestionale />
        <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 26, textAlign: "center", marginTop: 48 }}>
          <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Inviato</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55 }}>
            Grazie {v.nome.trim()}. Il consenso è arrivato alla scuola: non devi fare altro e non serve
            che tu tenga aperta questa pagina.
          </div>
        </div>
      </div>
    );
  }

  const c = modello.contenuto;
  // I testi piu' vecchi non hanno `caselle`: per loro valgono le due di
  // sempre, cosi' un modello non aggiornato continua a funzionare invece
  // di presentarsi senza niente da spuntare.
  const caselle = c.caselle || CASELLE_DI_RIPIEGO;
  // OGNI SPUNTA SI PORTA DIETRO IL SUO ISTANTE. Su un consenso non conta
  // solo che sia stata data, ma quando: e' la differenza fra "ha
  // acconsentito" e "ha acconsentito prima che cominciassimo".
  const segna = (chiave) => setSpunte((p) => (
    p[chiave]?.r ? { ...p, [chiave]: { r: false } } : { ...p, [chiave]: { r: true, il: new Date().toISOString() } }
  ));

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F3", ...fontBody }}>
      <TornaAlGestionale />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 18px 80px" }}>
        <div style={{ ...fontDisplay, fontSize: 21, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{c.titolo}</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>{c.sottotitolo}</div>

        <Sezione titolo="Chi sei">
          <Campo etichetta="Nome" obbligatorio><input style={campo} value={v.nome} onChange={cambia("nome")} autoComplete="given-name" /></Campo>
          <Campo etichetta="Cognome" obbligatorio><input style={campo} value={v.cognome} onChange={cambia("cognome")} autoComplete="family-name" /></Campo>
          <Campo etichetta="Data di nascita"><input type="date" style={campo} value={v.dataNascita} onChange={cambia("dataNascita")} /></Campo>
          <Campo etichetta="Luogo di nascita"><input style={campo} value={v.luogoNascita} onChange={cambia("luogoNascita")} /></Campo>
          <Campo etichetta="Residenza"><input style={campo} value={v.residenza} onChange={cambia("residenza")} autoComplete="street-address" /></Campo>
          <Campo etichetta="Telefono"><input type="tel" style={campo} value={v.telefono} onChange={cambia("telefono")} autoComplete="tel" /></Campo>
          <Campo etichetta="Email"><input type="email" style={campo} value={v.email} onChange={cambia("email")} autoComplete="email" /></Campo>
        </Sezione>

        <Sezione titolo="Il documento" nota="Serve a dire che sei tu, e che sei maggiorenne.">
          <Campo etichetta="Tipo">
            <select style={campo} value={v.documentoTipo} onChange={cambia("documentoTipo")}>
              {TIPI_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Numero"><input style={campo} value={v.documentoNumero} onChange={cambia("documentoNumero")} /></Campo>
          <FotoDocumento etichetta="Fronte" blob={fronte} onCambia={setFronte} />
          <FotoDocumento etichetta="Retro (se c'è)" blob={retro} onCambia={setRetro} />
        </Sezione>

        <Sezione titolo="Il trattamento">
          <Campo etichetta="Quale" obbligatorio>
            <select style={campo} value={v.trattamento} onChange={cambia("trattamento")}>
              <option value="">— scegli —</option>
              {c.trattamenti.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          {v.trattamento === "Altro" && (
            <Campo etichetta="Quale altro" obbligatorio>
              <input style={campo} value={v.trattamentoAltro} onChange={cambia("trattamentoAltro")} />
            </Campo>
          )}
          {/* QUELLO CHE QUESTO CONSENSO CHIEDE IN PIU'. Sta qui e non nel
              questionario perche' non e' una domanda a cui si risponde
              sì o no: e' un dato che si scrive. */}
          {(c.campiExtra || []).map((x) => (
            <Campo key={x.chiave} etichetta={x.etichetta} obbligatorio={!!x.obbligatorio}>
              {x.multilinea ? (
                <textarea
                  style={{ ...campo, minHeight: 72, resize: "vertical" }}
                  value={extra[x.chiave] || ""}
                  onChange={(e) => setExtra((p) => ({ ...p, [x.chiave]: e.target.value }))}
                  placeholder={x.aiuto || ""}
                  className="suggerimento-chiaro"
                />
              ) : (
                <input
                  style={campo}
                  value={extra[x.chiave] || ""}
                  onChange={(e) => setExtra((p) => ({ ...p, [x.chiave]: e.target.value }))}
                  placeholder={x.aiuto || ""}
                  className="suggerimento-chiaro"
                />
              )}
            </Campo>
          ))}

          {/* Le righe che sul cartaceo si riempiono a penna: «incarico
              ______ di eseguire su di me». Compare solo dove il modello
              lo prevede, perche' non tutti i moduli le hanno. */}
          {c.esecutore && (
            <Campo etichetta={c.esecutore.etichetta} obbligatorio={!!c.esecutore.obbligatorio}>
              <input
                style={campo} value={v.esecutore} onChange={cambia("esecutore")}
                placeholder={c.esecutore.aiuto || ""}
                className="suggerimento-chiaro"
                autoComplete="off" autoCorrect="off" spellCheck={false}
              />
            </Campo>
          )}
        </Sezione>

        {domande.length > 0 && (
          <Sezione
            titolo="Il tuo stato di salute"
            nota="Rispondi a tutte: l'operatore deve saperlo prima di cominciare, ed è il motivo per cui alcuni trattamenti si rimandano invece di andare storti. Resta fra te e la scuola."
          >
            {domande.map((d) => (
              <RigaAnamnesi
                key={d.chiave}
                domanda={d.domanda} aiuto={d.aiuto} specifica={d.specifica}
                valore={anamnesi[d.chiave]}
                onCambia={(r) => setAnamnesi((p) => ({ ...p, [d.chiave]: r }))}
              />
            ))}
            <Campo etichetta="ALTRO DA SEGNALARE: indicare se hai altre patologie e quali farmaci assumi">
              <textarea
                style={{ ...campo, minHeight: 88, resize: "vertical" }}
                value={v.noteSalute} onChange={cambia("noteSalute")}
                placeholder="Se non c'è altro, lascia vuoto"
              />
            </Campo>
          </Sezione>
        )}

        <Sezione titolo="Cosa stai firmando">
          {/* L'AVVISO STA SOPRA IL TASTO, E SI VEDE.
              La riga smorzata che c'era prima diceva la cosa giusta nel
              modo in cui non si legge: sotto un titolo di sezione, in
              grigio, della stessa misura di tutto il resto. Qui e'
              rosso, in grassetto, e dice per prima cosa che si sta per
              firmare — perche' il gesto che segue e' una firma, non la
              conferma di un ordine. */}
          <div style={{
            background: "#FDF1F0", border: "1px solid #E8BDB8", borderLeft: "5px solid #B3261E",
            borderRadius: 12, padding: "13px 15px", marginBottom: 12,
          }}>
            <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: "#8A2D2D", letterSpacing: 0.6, marginBottom: 5 }}>
              ATTENZIONE
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: NAVY }}>
              <b>Leggi con attenzione tutto il testo prima di firmare.</b> Firmando dichiari di averlo
              letto e compreso, e acconsenti al trattamento.
              {!testoLetto && <> Aprilo e richiudilo per proseguire: fino ad allora le spunte e la firma restano bloccate.</>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTestoAperto((x) => {
              // richiudendolo si segna come letto, e non si torna indietro
              if (x) setTestoLetto(true);
              return !x;
            })}
            style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "13px 16px", width: "100%", textAlign: "left", cursor: "pointer", minHeight: 48 }}
          >
            {testoAperto ? "Chiudi il testo" : "Leggi il testo completo"}
          </button>
          {testoAperto && (
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 16, marginTop: 10, maxHeight: 340, overflowY: "auto", fontSize: 13, lineHeight: 1.6, color: NAVY, whiteSpace: "pre-wrap" }}>
              {c.testo}
            </div>
          )}

          {/* UNA CASELLA PER OGNI COSA CHE SI ACCONSENTE.
              Le obbligatorie prima, la facoltativa in fondo e staccata:
              una spunta che si puo' lasciare vuota in mezzo a quelle che
              si devono dare si spunta per inerzia insieme alle altre, e
              un consenso dato per inerzia non e' un consenso. */}
          {caselle.filter((x) => x.tipo !== "facoltativa").map((x) => (
            <CasellaConsenso
              key={x.chiave} casella={x} spenta={!testoLetto}
              segnata={!!spunte[x.chiave]?.r}
              onCambia={() => segna(x.chiave)}
            />
          ))}

          {caselle.some((x) => x.tipo === "facoltativa") && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
                Facoltativo: puoi lasciarlo vuoto e il trattamento si fa lo stesso.
              </div>
              {caselle.filter((x) => x.tipo === "facoltativa").map((x) => (
                <CasellaConsenso
                  key={x.chiave} casella={x} spenta={!testoLetto}
                  segnata={!!spunte[x.chiave]?.r}
                  onCambia={() => segna(x.chiave)}
                />
              ))}
            </div>
          )}
        </Sezione>

        <Sezione titolo="La firma" nota="Tieni il telefono come ce l'hai adesso e firma col dito nello spazio qui sotto.">
          {/* La lavagna compare dopo il testo, non prima: uno spazio per
              firmare messo sotto a un documento mai aperto e' un invito a
              firmare senza leggere. */}
          {testoLetto ? <FirmaDito onCambia={setFirma} /> : (
            <div style={{
              fontSize: 12.5, lineHeight: 1.6, color: "#8A6A1B",
              background: "#FFFBF0", border: "1px dashed #E3D3AE", borderRadius: 12,
              padding: "18px 14px", textAlign: "center",
            }}>
              Qui comparirà lo spazio per firmare.<br />
              Prima apri «Leggi il testo completo» qui sopra e richiudilo.
            </div>
          )}
        </Sezione>

        {errore && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", background: "#FDECEC", border: "1px solid #F5C6C6", borderRadius: 12, padding: "12px 14px", marginBottom: 14, lineHeight: 1.45 }}>
            {errore}
          </div>
        )}

        {mancanze.length > 0 && (
          <div style={{ fontSize: 12.5, color: "#8A6A1B", background: "#F7EEDE", borderRadius: 12, padding: "12px 14px", marginBottom: 12, lineHeight: 1.45 }}>
            Manca ancora: {mancanze.join(", ")}.
          </div>
        )}

        <button
          type="button" onClick={invia} disabled={mancanze.length > 0 || inviando}
          style={{
            ...fontBody, fontSize: 16, fontWeight: 700, width: "100%", minHeight: 56, borderRadius: 14, border: "none",
            cursor: mancanze.length > 0 || inviando ? "default" : "pointer",
            background: mancanze.length > 0 || inviando ? "#D8D3C7" : NAVY,
            color: mancanze.length > 0 || inviando ? "#fff" : "#fff",
          }}
        >
          {inviando ? "Invio…" : "Invia il consenso"}
        </button>
        <div style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          Versione {c.versione} del testo · {modello.nome}
        </div>
      </div>
    </div>
  );
}
