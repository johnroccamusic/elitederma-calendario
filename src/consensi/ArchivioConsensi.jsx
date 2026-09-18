// L'archivio dei consensi raccolti, dentro Gestione modelle.
//
// Due cose in una pagina: in cima il codice da far inquadrare, sotto
// tutto quello che e' arrivato. Stanno insieme perche' si usano insieme
// — si mostra il QR alla modella e dopo un minuto la sua riga compare
// qui sotto.
//
// I documenti non si vedono in elenco: si aprono uno per volta, con un
// indirizzo che scade in dieci minuti. Non e' teatro, e' l'unica cosa
// che si puo' fare con un bucket privato — e vuol dire che una schermata
// lasciata aperta sul bancone non e' un archivio di carte d'identita'.

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { qrSvg } from "../ui/qr.js";
import { CONSENSI } from "../content/consensi";
import { leggiConsensi, filtraConsensi, urlFirmato } from "./dati";

const quando = (iso) => {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
    });
  } catch { return "—"; }
};

const soloData = (g) => {
  if (!g) return null;
  const [a, m, d] = String(g).split("-");
  return d ? `${d}/${m}/${a}` : g;
};

/** Il codice da far inquadrare, uno per consenso. */
function Codice({ modello, isMobile }) {
  const indirizzo = `${window.location.origin}${window.location.pathname}?consenso=${modello.codice}`;
  const svg = useMemo(() => qrSvg(indirizzo, { lato: isMobile ? 190 : 220 }), [indirizzo, isMobile]);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 18 }}>
      {svg && (
        <div
          style={{ flexShrink: 0, lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY }}>{modello.nome}</div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
          Fallo inquadrare alla modella: si apre il modulo, lo compila lei, firma col dito e invia.
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: NAVY, marginTop: 8, wordBreak: "break-all", background: "#FAF8F3", borderRadius: 8, padding: "8px 10px" }}>
          {indirizzo}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <a
            href={indirizzo} target="_blank" rel="noreferrer"
            style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 14px", textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}
          >
            Apri il modulo
          </a>
          <button
            type="button"
            onClick={() => {
              const f = window.open("", "_blank");
              if (!f) return;
              f.document.write(`<title>${modello.nome}</title><body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">${qrSvg(indirizzo, { lato: 420 })}<div style="margin-top:18px;font-size:20px;font-weight:700">${modello.nome}</div><div style="margin-top:6px;font-size:13px;color:#666">Inquadra il codice per compilare il consenso</div></body>`);
              f.document.close();
              f.print?.();
            }}
            style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer", minHeight: 40 }}
          >
            Stampa il codice
          </button>
        </div>
      </div>
    </div>
  );
}

/** Un allegato del bucket privato: si apre solo quando lo chiedi. */
function Allegato({ etichetta, percorso }) {
  const [url, setUrl] = useState(null);
  const [aprendo, setAprendo] = useState(false);
  if (!percorso) return null;

  async function guarda() {
    setAprendo(true);
    const u = await urlFirmato(percorso);
    setAprendo(false);
    if (u) setUrl(u);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {url ? (
        <div>
          <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, marginBottom: 5 }}>{etichetta}</div>
          <img src={url} alt={etichetta} style={{ maxWidth: 320, width: "100%", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, display: "block" }} />
        </div>
      ) : (
        <button
          type="button" onClick={guarda} disabled={aprendo}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer", minHeight: 40 }}
        >
          {aprendo ? "Apro…" : `Guarda ${etichetta.toLowerCase()}`}
        </button>
      )}
    </div>
  );
}

function Riga({ c, isMobile }) {
  const [aperta, setAperta] = useState(false);
  const voce = (etichetta, valore) => (valore ? (
    <div style={{ ...fontBody, fontSize: 12.5, color: NAVY, marginTop: 3 }}>
      <span style={{ color: MUTED }}>{etichetta}: </span>{valore}
    </div>
  ) : null);

  return (
    <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 13 : 16, marginBottom: 10 }}>
      <button
        type="button" onClick={() => setAperta((x) => !x)}
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ ...fontDisplay, fontSize: 15.5, fontWeight: 700, color: NAVY }}>
          {c.nome} {c.cognome}
        </span>
        <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>
          {c.trattamento === "Altro" && c.trattamentoAltro ? c.trattamentoAltro : c.trattamento || "—"} · {quando(c.ts)}
        </span>
      </button>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {c.consensoFotoVideo
          ? <Pastiglia testo="foto e video: sì" colore="#2E7D32" sfondo="#E9F6EC" />
          : <Pastiglia testo="foto e video: no" />}
        <Pastiglia testo={`testo ${c.versioneTesto}`} />
        {c.frontePath && <Pastiglia testo="documento allegato" />}
        {c.firmaPath && <Pastiglia testo="firmato" colore="#2E7D32" sfondo="#E9F6EC" />}
      </div>

      {aperta && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 12 }}>
          {voce("Nata il", soloData(c.dataNascita))}
          {voce("A", c.luogoNascita)}
          {voce("Residenza", c.residenza)}
          {voce("Telefono", c.telefono)}
          {voce("Email", c.email)}
          {voce("Documento", [c.documentoTipo, c.documentoNumero].filter(Boolean).join(" n. "))}
          {c.noteSalute && (
            <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6A1B", background: "#F7EEDE", borderRadius: 10, padding: "10px 12px", marginTop: 8, lineHeight: 1.45 }}>
              <b>Da sapere:</b> {c.noteSalute}
            </div>
          )}
          <Allegato etichetta="Documento, fronte" percorso={c.frontePath} />
          <Allegato etichetta="Documento, retro" percorso={c.retroPath} />
          <Allegato etichetta="Firma" percorso={c.firmaPath} />
        </div>
      )}
    </div>
  );
}

function Pastiglia({ testo, colore = MUTED, sfondo = "#F4F1EA" }) {
  return (
    <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: colore, background: sfondo, borderRadius: 8, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {testo}
    </span>
  );
}

export default function ArchivioConsensi({ isMobile = false, CampoRicerca }) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [ricerca, setRicerca] = useState("");

  useEffect(() => {
    let vivo = true;
    leggiConsensi().then((r) => { if (!vivo) return; setRighe(r); setCaricando(false); });
    return () => { vivo = false; };
  }, []);

  const trovate = useMemo(() => filtraConsensi(righe, ricerca), [righe, ricerca]);

  return (
    <div>
      <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        {CONSENSI.map((m) => <Codice key={m.codice} modello={m} isMobile={isMobile} />)}
      </div>

      {CampoRicerca ? (
        <CampoRicerca
          value={ricerca} onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca nome, telefono, documento, trattamento…"
          style={{ marginBottom: 12 }}
        />
      ) : (
        <input
          value={ricerca} onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca nome, telefono, documento, trattamento…"
          style={{ ...fontBody, width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${CREAM_BORDER}`, fontSize: 14, marginBottom: 12 }}
        />
      )}

      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 10 }}>
        {caricando ? "Carico…"
          : righe.length === 0 ? "Nessun consenso raccolto finora."
            : `${trovate.length} ${trovate.length === 1 ? "consenso" : "consensi"}${ricerca ? ` su ${righe.length}` : ""}`}
      </div>

      {trovate.map((c) => <Riga key={c.id} c={c} isMobile={isMobile} />)}

      {!caricando && righe.length > 0 && trovate.length === 0 && (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 18 }}>
          Nessun consenso con queste parole.
        </div>
      )}
    </div>
  );
}
