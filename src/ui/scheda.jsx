// I MATTONI DELLA SCHEDA DI ISCRIZIONE: i riquadri color crema col
// bordo oro, i titoli maiuscoli e i campi.
//
// Stavano dentro App.jsx. Sono usciti qui il 16/10/2026 perche' li usa
// anche Setting > Modulo di iscrizione, che deve mostrare il modulo del
// venditore IDENTICO a com'e'. Ricopiarli avrebbe voluto dire che fra
// sei mesi le due pagine si sarebbero somigliate e basta: la prima volta
// che qualcuno cambia un bordo, la copia resta indietro e non e' piu' lo
// stesso modulo.
import React from "react";
import { Field } from "./base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GOLD, fontBody, inputStyle } from "./stile.js";

export const areaSchedaIscritto = {
  background: "#FBF6EA",
  border: `1px solid ${CREAM_BORDER}`,
  borderLeft: `4px solid ${GOLD}`,
  borderRadius: 12,
  padding: 16,
};

export const campoAreaScheda = { ...inputStyle, background: "#fff", border: "1px solid #E6DFCE", borderRadius: 8 };

// il titolo in cima a ogni area: icona a sinistra, testo maiuscolo e
// spaziato. Le icone stanno solo qui — accanto ai metodi di pagamento no,
// li' bastano i cerchietti
export const titoloAreaScheda = { ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.8 };

export function IntestazioneArea({ Icona, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, color: GOLD }}>
      {Icona && <Icona size={18} color={GOLD} />}
      <span style={titoloAreaScheda}>{children}</span>
    </div>
  );
}

export function RigaLettura({ children }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>;
}

export function CampoLettura({ label, valore, larghezza = "1 1 140px", minLabelHeight }) {
  const vuoto = valore == null || valore === "";
  return (
    <div style={{ flex: larghezza, minWidth: 0 }}>
      <Field label={label} minLabelHeight={minLabelHeight}>
        <input
          style={{ ...campoAreaScheda, background: "#EDF1F4", color: vuoto ? MUTED : NAVY, fontWeight: 600 }}
          value={vuoto ? "—" : String(valore)}
          disabled
        />
      </Field>
    </div>
  );
}
