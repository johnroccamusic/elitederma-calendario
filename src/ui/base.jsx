// I componenti base riusati ovunque: un bottone, l'etichetta sopra un
// campo, e il campo numerico in cui si riesce davvero a scrivere.
//
// Modal NON e' qui: dipende da useIsMobile, che legge la vista forzata
// (desktop simulato dal telefono e viceversa) da una variabile mutabile
// interna ad App.jsx. Portarlo via significava rifare quella macchina, e
// non e' questo il momento.

import { useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, fontBody, inputStyle, round2, numeroFascia } from "./stile.js";

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


// Il tondo che riporta al livello di sopra: sta SEMPRE a sinistra del
// titolo, col titolo centrato sulla sua altezza. Vive qui perche' ogni
// pagina nuova deve poter avere la stessa intestazione senza rifarsela.
export function IconaCasa({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function IconaCartellaShop({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function TastoLivelloPrecedente({ titolo, onClick, soloIcona = false }) {
  const versoHome = String(titolo || "").trim().toLowerCase() === "home";
  const Icona = versoHome ? IconaCasa : IconaCartellaShop;
  // "soloIcona": dove il tondo sta in fila col titolo il nome scritto
  // dentro non serve — lo dice gia' il titolo della pagina accanto, e
  // senza quelle tre righe minuscole il cerchio si stringe e si allinea
  // al testo invece di sbordarci sotto. Il nome resta nel tooltip.
  const lato = soloIcona ? 48 : 68;
  return (
    <button
      onClick={onClick}
      title={titolo}
      style={{
        width: lato, height: lato, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        background: "#fff", border: `1px solid ${CREAM_BORDER}`, padding: "0 6px", cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <Icona size={soloIcona ? 20 : 16} color={NAVY} />
      {/* il nome sta DENTRO il tondo e va a capo dove capita, anche in
          mezzo a una parola: in un cerchio da 68 "Amministrazione" non ci
          sta su una riga, e tagliarla con i puntini vorrebbe dire non
          leggerla affatto */}
      {!soloIcona && (
        <span style={{
          ...fontBody, fontSize: 8.5, fontWeight: 700, color: NAVY, lineHeight: 1.1, textAlign: "center",
          overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%",
        }}>{titolo}</span>
      )}
    </button>
  );
}
// Un contatore di pezzi: meno, il numero, piu'.
//
// Le frecce di un <input type="number"> sono due triangolini da sei pixel
// che col dito non si prendono, e sul telefono in aula non ci sono
// proprio. Qui i tasti sono quadrati veri, distanziati, e il numero resta
// scrivibile: chi deve mandare quaranta dischetti li scrive, non clicca
// quaranta volte.
export function ContatoreQuantita({ valore, onCambia, min = 0, max = null, passo = 1, compatto = false, titolo }) {
  const n = Number(valore) || 0;
  const [bozza, setBozza] = useState(null);
  const lato = compatto ? 34 : 44;
  const limita = (v) => {
    let x = Math.round(Number(v) || 0);
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };
  const tasto = (attivo) => ({
    width: lato, height: lato, flexShrink: 0, borderRadius: 10,
    border: `1px solid ${CREAM_BORDER}`, background: "#fff",
    color: attivo ? NAVY : "#C9C4B8", cursor: attivo ? "pointer" : "default",
    ...fontBody, fontSize: compatto ? 16 : 19, fontWeight: 700, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  });
  const puoScendere = min == null || n > min;
  const puoSalire = max == null || n < max;
  function fissa() {
    if (bozza == null) return;
    const pulito = String(bozza).trim();
    setBozza(null);
    onCambia(limita(pulito === "" ? 0 : pulito.replace(",", ".")));
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} title={titolo}>
      <button type="button" style={tasto(puoScendere)} onClick={() => puoScendere && onCambia(limita(n - passo))} aria-label="Uno in meno">−</button>
      <input
        type="text" inputMode="numeric"
        value={bozza != null ? bozza : String(n)}
        onChange={(e) => setBozza(e.target.value)}
        onFocus={(e) => { setBozza(String(n)); e.target.select(); }}
        onBlur={fissa}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{
          ...inputStyle, width: compatto ? 48 : 58, textAlign: "center",
          padding: compatto ? "6px 2px" : "10px 2px", fontWeight: 700,
          fontSize: compatto ? 13 : 15, height: lato, boxSizing: "border-box",
        }}
      />
      <button type="button" style={tasto(puoSalire)} onClick={() => puoSalire && onCambia(limita(n + passo))} aria-label="Uno in piu'">+</button>
    </div>
  );
}
