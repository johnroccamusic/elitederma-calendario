// IL RIQUADRO «DAL TUO DOCUMENTO LEGGIAMO…» nel modulo dell'allieva.
//
// Appena la foto del fronte e' pronta, la pagina la manda a
// `leggi-documento` e qui si mostra quello che e' stato letto, riga per
// riga, accanto a quello che c'e' nel modulo. Le righe uguali hanno la
// spunta; quelle diverse si vedono, e un tasto porta nel modulo i dati
// del documento — ma solo nei campi che lei puo' scrivere. Quelli che ha
// scritto il venditore restano suoi: si segnala e basta.
//
// Non blocca niente: si puo' spedire anche con differenze. Il venditore
// le vede nella scheda e verifica lui.
import React from "react";
import { confrontaDocumento, dataIso } from "./documento.js";
import { fontBody, NAVY, MUTED, GOLD } from "../ui/stile.js";

export default function LetturaDocumento({ lettura, valori, bloccati = {}, onUsa }) {
  if (!lettura) return null;
  const scatola = { ...fontBody, fontSize: 12.5, lineHeight: 1.55, borderRadius: 12, padding: "10px 12px", marginTop: 10 };
  if (lettura.stato === "leggo") {
    return <div data-campo="lettura-documento" style={{ ...scatola, color: MUTED, background: "#F7F7F5", border: "1px solid #E6E6E2" }}>Sto leggendo il documento…</div>;
  }
  if (lettura.stato === "errore") {
    return <div data-campo="lettura-documento" style={{ ...scatola, color: "#8A6D1D", background: "#FFF8E6", border: "1px solid #E6CF8C" }}>Non sono riuscito a leggere il documento ({lettura.errore}). Puoi mandare il modulo lo stesso: lo controlla chi ti ha iscritto.</div>;
  }
  const letto = lettura.letto || {};
  if (letto.leggibile === false) {
    return <div data-campo="lettura-documento" style={{ ...scatola, color: "#8A6D1D", background: "#FFF8E6", border: "1px solid #E6CF8C" }}>La foto non sembra leggibile{letto.note ? ` (${letto.note})` : ""}: prova a rifarla con più luce, oppure manda il modulo lo stesso.</div>;
  }
  const righe = confrontaDocumento(letto, valori);
  const diverse = righe.filter((r) => !r.uguale);
  const correggibili = diverse.filter((r) => !bloccati[r.chiave]);
  const bloccate = diverse.filter((r) => bloccati[r.chiave]);
  function usa() {
    const nuovi = {};
    for (const r of correggibili) nuovi[r.chiave] = r.chiave === "data_nascita" ? (dataIso(r.documento) || r.documento) : r.documento;
    onUsa?.(nuovi);
  }
  return (
    <div data-campo="lettura-documento" style={{ ...scatola, color: NAVY, background: "#FFFDF8", border: `1px solid ${GOLD}` }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Dal tuo documento leggiamo:</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 10, rowGap: 2 }}>
        {righe.map((r) => (
          <React.Fragment key={r.chiave}>
            <span style={{ color: MUTED }}>{r.etichetta}</span>
            <span data-riga={r.chiave} data-uguale={r.uguale ? "si" : "no"}>
              <b>{r.documento}</b>
              {r.uguale && <span style={{ color: "#2E7D32" }}> ✓</span>}
              {!r.uguale && !r.mancante && <span style={{ color: "#B3261E" }}> — nel modulo: {r.modulo}</span>}
              {!r.uguale && r.mancante && <span style={{ color: MUTED }}> — nel modulo manca</span>}
            </span>
          </React.Fragment>
        ))}
      </div>
      {letto.scadenza && <div style={{ color: MUTED, marginTop: 6 }}>Scadenza del documento: {letto.scadenza}{letto.scadenza < new Date().toISOString().slice(0, 10) ? " — sembra scaduto" : ""}</div>}
      {correggibili.length > 0 && (
        <button type="button" onClick={usa} data-campo="usa-dati-documento"
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#fff", background: NAVY, border: "none", borderRadius: 10, padding: "8px 12px", marginTop: 10, cursor: "pointer" }}>
          Usa i dati del documento ({correggibili.length})
        </button>
      )}
      {bloccate.length > 0 && (
        <div style={{ color: "#8A6D1D", marginTop: 8 }}>
          {bloccate.map((r) => r.etichetta).join(", ")}: nel documento {bloccate.length === 1 ? "è diverso" : "sono diversi"} da quello scritto da chi ti ha iscritto. Lo vedrà e lo correggerà lui.
        </div>
      )}
      {diverse.length === 0 && righe.length > 0 && <div style={{ color: "#2E7D32", marginTop: 6 }}>Tutto corrisponde.</div>}
    </div>
  );
}
