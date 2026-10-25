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
import { confrontaDocumento, dataIso, tipoDocumentoDelModulo } from "./documento.js";
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
  const problemi = Array.isArray(letto.problemi) ? letto.problemi.filter(Boolean) : [];
  // ILLEGGIBILE: la foto non va bene e non si manda. Si dice cosa non va
  // e si chiede di rifarla — con piu' luce, dritta, tutto il documento
  // dentro. E' l'unico caso in cui la lettura ferma qualcosa.
  if (letto.leggibile === false || letto.qualita === "illeggibile") {
    return (
      <div data-campo="lettura-documento" data-esito="illeggibile" style={{ ...scatola, color: "#B3261E", background: "#FDECEC", border: "1px solid #F0C0BC" }}>
        <b>Questa foto non si legge: va rifatta.</b>
        {problemi.length > 0 && <div style={{ marginTop: 4 }}>Cosa non va: {problemi.join(", ")}.</div>}
        {!problemi.length && letto.note && <div style={{ marginTop: 4 }}>{letto.note}</div>}
        <div style={{ marginTop: 4 }}>Scatta di nuovo con più luce, senza riflessi, con tutto il documento dentro l'inquadratura: tocca «Scegli o scatta» qui sopra.</div>
      </div>
    );
  }
  const righe = confrontaDocumento(letto, valori);
  const diverse = righe.filter((r) => !r.uguale);
  const correggibili = diverse.filter((r) => !bloccati[r.chiave]);
  const bloccate = diverse.filter((r) => bloccati[r.chiave]);
  function usa() {
    const nuovi = {};
    for (const r of correggibili) {
      if (r.chiave === "doc_tipo") { const t = tipoDocumentoDelModulo(r.documento); if (t) nuovi.doc_tipo = t; continue; }
      nuovi[r.chiave] = r.chiave === "data_nascita" ? (dataIso(r.documento) || r.documento) : r.documento;
    }
    onUsa?.(nuovi);
  }
  return (
    <div data-campo="lettura-documento" style={{ ...scatola, color: NAVY, background: "#FFFDF8", border: `1px solid ${GOLD}` }}>
      {letto.qualita === "scarsa" && (
        <div data-esito="scarsa" style={{ color: "#8A6D1D", background: "#FFF8E6", border: "1px solid #E6CF8C", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
          La foto si legge, ma a fatica{problemi.length ? ` (${problemi.join(", ")})` : ""}: se puoi, rifalla con più luce. Altrimenti va bene così.
        </div>
      )}
      {righe.some((r) => r.chiave === "doc_tipo" && !r.uguale && !r.mancante) && (
        <div data-esito="tipo-diverso" style={{ color: "#B3261E", fontWeight: 700, marginBottom: 6 }}>
          Hai indicato «{righe.find((r) => r.chiave === "doc_tipo").modulo}», ma la foto sembra {righe.find((r) => r.chiave === "doc_tipo").documento === "Carta d'identità" ? "una carta d'identità" : `un${/^[AEIOU]/i.test(righe.find((r) => r.chiave === "doc_tipo").documento) ? "'" : "a "}${righe.find((r) => r.chiave === "doc_tipo").documento.toLowerCase()}`}: correggi il tipo, oppure carica il documento giusto.
        </div>
      )}
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
