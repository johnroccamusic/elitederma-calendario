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
import {
  NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, inputStyle,
} from "../ui/stile.js";
import { consensoDaCodice } from "../content/consensi";
import { salvaConsenso } from "./dati";

const TIPI_DOCUMENTO = ["Carta d'identità", "Patente", "Passaporto"];

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

/** Una foto del documento: si scatta, si rivede, si rifà. */
function FotoDocumento({ etichetta, blob, onCambia }) {
  const [anteprima, setAnteprima] = useState(null);
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
        <label style={{ display: "block", border: `1px dashed ${CREAM_BORDER}`, borderRadius: 12, padding: "22px 14px", textAlign: "center", cursor: "pointer", background: "#fff" }}>
          <input
            type="file" accept="image/*" capture="environment"
            onChange={(e) => onCambia(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <span style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>Scatta o scegli</span>
          <span style={{ display: "block", ...fontBody, fontSize: 12, color: MUTED, marginTop: 4 }}>
            Appoggialo su un piano, senza riflessi
          </span>
        </label>
      )}
    </div>
  );
}

/**
 * La firma col dito.
 *
 * Alta, non larga: il telefono resta in verticale come lo si tiene, e
 * lo spazio per firmare e' tutto quello che ci sta. Una striscia bassa
 * costringerebbe a girare il telefono, e chi lo gira in piedi in un
 * corridoio poi non trova piu' il tasto per inviare.
 *
 * Il disegno va su una tela a risoluzione doppia: una firma sgranata,
 * ingrandita su un foglio, non e' piu' una firma.
 */
function FirmaDito({ onCambia }) {
  const tela = useRef(null);
  const disegnando = useRef(false);
  const scritto = useRef(false);
  const [vuota, setVuota] = useState(true);

  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const rapporto = window.devicePixelRatio || 1;
    const larghezza = c.clientWidth;
    const altezza = c.clientHeight;
    c.width = larghezza * rapporto;
    c.height = altezza * rapporto;
    const ctx = c.getContext("2d");
    // se la tela non da' un contesto (browser antico, canvas disattivata)
    // la pagina deve restare in piedi: senza questo controllo la modella
    // si trova davanti una schermata bianca e il consenso non si firma
    if (!ctx) return;
    ctx.scale(rapporto, rapporto);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = NAVY;
  }, []);

  const punto = (e) => {
    const r = tela.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function giu(e) {
    e.preventDefault();
    const ctx = tela.current?.getContext("2d");
    if (!ctx) return;
    tela.current.setPointerCapture?.(e.pointerId);
    disegnando.current = true;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function muovi(e) {
    if (!disegnando.current) return;
    e.preventDefault();
    const ctx = tela.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!scritto.current) { scritto.current = true; setVuota(false); }
  }
  function su() {
    if (!disegnando.current) return;
    disegnando.current = false;
    if (scritto.current) tela.current?.toBlob?.((b) => onCambia(b), "image/png");
  }

  function cancella() {
    const c = tela.current;
    const ctx = c?.getContext("2d");
    if (ctx) {
      const rapporto = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, c.width / rapporto, c.height / rapporto);
    }
    scritto.current = false;
    setVuota(true);
    onCambia(null);
  }

  return (
    <div>
      <canvas
        ref={tela}
        onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerLeave={su} onPointerCancel={su}
        style={{
          width: "100%", height: 260, background: "#fff", borderRadius: 12,
          border: `1px solid ${CREAM_BORDER}`, display: "block",
          // senza questo il dito che firma trascina la pagina invece di
          // lasciare il segno
          touchAction: "none", cursor: "crosshair",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
        <span style={{ ...fontBody, fontSize: 12, color: vuota ? MUTED : "#2E7D32", fontWeight: 700 }}>
          {vuota ? "Firma qui dentro col dito" : "✓ firmato"}
        </span>
        <button
          type="button" onClick={cancella}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 14px", minHeight: 44, cursor: "pointer" }}
        >
          Cancella
        </button>
      </div>
    </div>
  );
}

export default function PaginaConsenso({ codice }) {
  const modello = consensoDaCodice(codice);
  const [v, setV] = useState({
    nome: "", cognome: "", dataNascita: "", luogoNascita: "", residenza: "",
    telefono: "", email: "", documentoTipo: TIPI_DOCUMENTO[0], documentoNumero: "",
    trattamento: "", trattamentoAltro: "", noteSalute: "",
  });
  const [fronte, setFronte] = useState(null);
  const [retro, setRetro] = useState(null);
  const [firma, setFirma] = useState(null);
  const [accetto, setAccetto] = useState(false);
  const [fotoVideo, setFotoVideo] = useState(false);
  const [testoAperto, setTestoAperto] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState("");

  const cambia = (chiave) => (e) => setV((p) => ({ ...p, [chiave]: e.target.value }));

  if (!modello) {
    return (
      <div style={{ ...fontBody, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: MUTED }}>
        Questo codice non corrisponde a nessun consenso. Chiedi alla scuola il codice giusto.
      </div>
    );
  }

  // cosa manca, detto a parole: un tasto spento e basta lascia la
  // persona a cercare l'errore da sola
  const mancanze = [];
  if (!v.nome.trim() || !v.cognome.trim()) mancanze.push("nome e cognome");
  if (!v.trattamento) mancanze.push("il trattamento");
  if (v.trattamento === "Altro" && !v.trattamentoAltro.trim()) mancanze.push("quale altro trattamento");
  if (!fronte) mancanze.push("la foto del documento");
  if (!firma) mancanze.push("la firma");
  if (!accetto) mancanze.push("la spunta del consenso");

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
        noteSalute: v.noteSalute,
        consensoTrattamento: true, consensoFotoVideo: fotoVideo,
      },
      { fronte, retro, firma },
    );
    setInviando(false);
    if (esito.errore) { setErrore(esito.errore); return; }
    setInviato(true);
    window.scrollTo(0, 0);
  }

  if (inviato) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F3", padding: "48px 20px", ...fontBody }}>
        <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
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

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F3", ...fontBody }}>
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
          <Campo etichetta="Allergie, terapie, interventi recenti, altro da segnalare">
            <textarea
              style={{ ...campo, minHeight: 96, resize: "vertical" }}
              value={v.noteSalute} onChange={cambia("noteSalute")}
              placeholder="Se non c'è niente, lascia vuoto"
            />
          </Campo>
        </Sezione>

        <Sezione titolo="Cosa stai firmando">
          <button
            type="button" onClick={() => setTestoAperto((x) => !x)}
            style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "13px 16px", width: "100%", textAlign: "left", cursor: "pointer", minHeight: 48 }}
          >
            {testoAperto ? "Chiudi il testo" : "Leggi il testo completo"}
          </button>
          {testoAperto && (
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 16, marginTop: 10, maxHeight: 340, overflowY: "auto", fontSize: 13, lineHeight: 1.6, color: NAVY, whiteSpace: "pre-wrap" }}>
              {c.testo}
            </div>
          )}

          <label style={{ display: "flex", gap: 11, alignItems: "flex-start", marginTop: 14, cursor: "pointer", background: "#fff", border: `1px solid ${accetto ? "#BFE3C6" : CREAM_BORDER}`, borderRadius: 12, padding: 14 }}>
            <input type="checkbox" checked={accetto} onChange={(e) => setAccetto(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: NAVY, lineHeight: 1.5 }}>
              Ho letto e compreso, le informazioni che ho dato sul mio stato di salute sono vere, e
              acconsento al trattamento durante il corso.
            </span>
          </label>

          <label style={{ display: "flex", gap: 11, alignItems: "flex-start", marginTop: 10, cursor: "pointer", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 14 }}>
            <input type="checkbox" checked={fotoVideo} onChange={(e) => setFotoVideo(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: NAVY, lineHeight: 1.5 }}>
              Autorizzo l'uso di foto e video del trattamento.
              <span style={{ display: "block", fontSize: 12, color: MUTED, marginTop: 3 }}>
                Facoltativo: puoi lasciarlo vuoto e il trattamento si fa lo stesso.
              </span>
            </span>
          </label>
        </Sezione>

        <Sezione titolo="La firma" nota="Tieni il telefono come ce l'hai adesso e firma col dito nello spazio qui sotto.">
          <FirmaDito onCambia={setFirma} />
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
