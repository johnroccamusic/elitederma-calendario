// La striscia dei salvataggi, disegnata una volta sola da App.
//
// Sta appoggiata in alto, sopra a tutto, e segue chi ha premuto Salva
// ovunque vada: era il difetto che si voleva chiudere. Compare solo
// quando c'è qualcosa da dire e sparisce da sola quando il lavoro
// finisce bene — un salvataggio riuscito non merita un cartello.
import React from "react";
import { NAVY, GOLD, fontBody } from "../ui/stile.js";
import { useSalvataggi, scartaFallito, chiediRiapertura } from "./stato.js";

export default function StrisciaSalvataggi({ onRiapri }) {
  const { lavori, falliti } = useSalvataggi();
  if (!lavori.length && !falliti.length) return null;

  // sopra le finestre modali (9999): se un salvataggio fallisce mentre è
  // aperta una modale, l'avviso non deve finirle sotto
  const contenitore = {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
    display: "flex", flexDirection: "column", gap: 6,
    padding: "8px 10px", pointerEvents: "none",
  };
  const comune = {
    ...fontBody, fontSize: 12.5, borderRadius: 10, padding: "8px 12px",
    maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box",
    pointerEvents: "auto", boxShadow: "0 6px 20px rgba(14,27,51,.14)",
  };

  return (
    <div style={contenitore}>
      {lavori.length > 0 && (
        <div style={{ ...comune, display: "flex", alignItems: "center", gap: 8, color: NAVY, background: "#FBF3E4", border: `1px solid ${GOLD}55` }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
          Sto salvando {lavori.map((l) => l.nome).join(", ")}… puoi continuare a lavorare.
        </div>
      )}
      {falliti.map((l) => (
        <div key={l.chiave} style={{ ...comune, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#C0392B", background: "#FBEAEA", border: "1px solid #F0C8C2" }}>
          <span style={{ flex: "1 1 240px", minWidth: 0 }}><b>{l.nome}</b> non è stato salvato: {l.errore}</span>
          {l.form && (
            <button
              onClick={() => { chiediRiapertura(l.form); scartaFallito(l.chiave); if (onRiapri) onRiapri(); }}
              style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: "#fff", background: NAVY, border: "none", borderRadius: 14, padding: "6px 12px", cursor: "pointer", flexShrink: 0 }}
            >
              Riapri la scheda
            </button>
          )}
          <button
            onClick={() => scartaFallito(l.chiave)}
            title="Nascondi l'avviso"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
