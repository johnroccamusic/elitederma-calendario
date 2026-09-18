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
// Due freccette appoggiate al campo, una sopra l'altra: la forma di
// sempre dei campi numerici, quella che il browser disegna da solo. Si
// usa dove le righe sono tante e vicine — una lista di accessori — e
// due quadrati da 44 per riga diventano un muro di piu' e meno che
// copre quello che si sta leggendo.
function Freccetta({ verso = "su", attiva, onClick }) {
  return (
    <button
      type="button" onClick={() => attiva && onClick()} aria-label={verso === "su" ? "Uno in piu'" : "Uno in meno"}
      style={{
        flex: 1, width: "100%", padding: 0, border: "none", background: "transparent",
        cursor: attiva ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center",
        color: attiva ? NAVY : "#C9C4B8", minHeight: 0,
      }}
    >
      <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true">
        <path
          d={verso === "su" ? "M1 5L4.5 1.5L8 5" : "M1 1L4.5 4.5L8 1"}
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function ContatoreQuantita({ valore, onCambia, min = 0, max = null, passo = 1, compatto = false, frecce = false, titolo }) {
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
  const campo = (stileExtra = {}) => (
    <input
      type="text" inputMode="numeric"
      value={bozza != null ? bozza : String(n)}
      onChange={(e) => setBozza(e.target.value)}
      onFocus={(e) => { setBozza(String(n)); e.target.select(); }}
      onBlur={fissa}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); return; }
        // le frecce della tastiera fanno quello che fanno le freccette
        // disegnate: chi scrive col tastierino non deve prendere il mouse
        if (e.key === "ArrowUp" && puoSalire) { e.preventDefault(); setBozza(null); onCambia(limita(n + passo)); }
        if (e.key === "ArrowDown" && puoScendere) { e.preventDefault(); setBozza(null); onCambia(limita(n - passo)); }
      }}
      style={{
        ...inputStyle, width: compatto ? 48 : 58, textAlign: "center",
        padding: compatto ? "6px 2px" : "10px 2px", fontWeight: 700,
        fontSize: compatto ? 13 : 15, height: lato, boxSizing: "border-box",
        ...stileExtra,
      }}
    />
  );

  if (frecce) {
    const altezza = compatto ? 30 : 34;
    return (
      <div style={{ display: "inline-flex", alignItems: "stretch", flexShrink: 0 }} title={titolo}>
        {campo({
          width: compatto ? 42 : 48, height: altezza,
          borderTopRightRadius: 0, borderBottomRightRadius: 0,
          padding: "4px 2px", fontSize: compatto ? 13 : 14,
        })}
        <span style={{
          display: "flex", flexDirection: "column", width: 20, height: altezza,
          border: `1px solid ${CREAM_BORDER}`, borderTopRightRadius: 8, borderBottomRightRadius: 8,
          overflow: "hidden", background: "#fff", flexShrink: 0,
          // la colonna scavalca di un pixel il bordo del campo: fra i due
          // resta una riga sola invece di due appiccicate. Si fa cosi' e
          // non togliendo il bordo destro al campo perche' quello e' un
          // bordo che arriva da inputStyle, e disfarlo da qui vorrebbe
          // dire ricordarsi di rifarlo ogni volta che inputStyle cambia
          marginLeft: -1,
        }}>
          <Freccetta verso="su" attiva={puoSalire} onClick={() => onCambia(limita(n + passo))} />
          <span style={{ height: 1, background: CREAM_BORDER, flexShrink: 0 }} />
          <Freccetta verso="giu" attiva={puoScendere} onClick={() => onCambia(limita(n - passo))} />
        </span>
      </div>
    );
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
