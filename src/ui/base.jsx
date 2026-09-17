// I componenti base riusati ovunque: un bottone, l'etichetta sopra un
// campo, e il campo numerico in cui si riesce davvero a scrivere.
//
// Modal NON e' qui: dipende da useIsMobile, che legge la vista forzata
// (desktop simulato dal telefono e viceversa) da una variabile mutabile
// interna ad App.jsx. Portarlo via significava rifare quella macchina, e
// non e' questo il momento.

import { useState } from "react";
import { NAVY, MUTED, fontBody, round2, numeroFascia } from "./stile.js";

export function Button({ children, onClick, variant = "primary", style = {}, disabled }) {
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
// "compatto": etichetta e margini ridotti, per le file di filtri che da
// mobile devono stare tutte su una riga
export function Field({ label, children, minLabelHeight, compatto = false, etichettaFontSize = null }) {
  return (
    <div style={{ marginBottom: compatto ? 8 : 14 }}>
      <div style={{ ...fontBody, fontSize: etichettaFontSize ?? (compatto ? 8.5 : 12), color: MUTED, marginBottom: compatto ? 3 : 5, textTransform: "uppercase", letterSpacing: compatto ? 0.2 : 0.5, lineHeight: 1.15, minHeight: minLabelHeight, display: minLabelHeight ? "flex" : undefined, alignItems: minLabelHeight ? "flex-end" : undefined }}>{label}</div>
      {children}
    </div>
  );
}

export function CampoNumero({ valore, onCambia, min = 0, max = null, step = "any", style, titolo }) {
  const [bozza, setBozza] = useState(null);
  const testo = bozza != null ? bozza : (valore == null ? "" : numeroFascia(valore));
  function fissa() {
    if (bozza == null) return;
    const pulito = String(bozza).trim().replace(",", ".");
    let n = pulito === "" ? 0 : Number(pulito);
    if (!isFinite(n)) n = Number(valore) || 0;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    setBozza(null);
    onCambia(round2(n));
  }
  return (
    <input
      type="text" inputMode="decimal" title={titolo}
      value={testo}
      onChange={(e) => setBozza(e.target.value)}
      onFocus={(e) => { setBozza(testo); e.target.select(); }}
      onBlur={fissa}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={style}
    />
  );
}
