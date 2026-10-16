// LA FIRMA COL DITO, una sola per tutta l'app.
//
// Nata per il consenso della modella, serve identica sul modulo di
// iscrizione che compila l'allieva: due copie vorrebbero dire che fra
// sei mesi una delle due firma sgranato e nessuno se ne accorge finche'
// non la stampa.
//
// Torna un PNG (un Blob) a ogni tratto finito, e `null` quando si
// cancella: chi la usa guarda quello per sapere se c'e' una firma.
import React, { useEffect, useRef, useState } from "react";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "./stile.js";

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
export default function FirmaDito({ onCambia }) {
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
