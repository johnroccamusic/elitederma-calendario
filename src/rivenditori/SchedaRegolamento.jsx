// IL REGOLAMENTO, in sola lettura, e il PDF da consegnare. 18/11/2026.
//
// Quello che si legge qui si compone dalla configurazione dei livelli
// (`regolamento-testo.js`), quindi non può promettere soglie vecchie. Il
// TESTO INTEGRALE degli articoli non è ancora stato consegnato: finché
// manca, la pagina lo dice in alto e il PDF porta un riquadro al posto
// degli articoli. Scriverlo io vorrebbe dire inventare clausole
// contrattuali e farle firmare a qualcuno.
import React, { useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody } from "../ui/stile.js";
import { Button } from "../ui/base.jsx";
import { composizioneRegolamento } from "./regolamento-testo.js";
import { creaRegolamentoPdf } from "./regolamentoPdf.js";
import { scaricaPdf } from "../prezzi/listinoPdf.js";

export default function SchedaRegolamento({ livelli, tettoPct, regolamenti, getPdfLib, righeSocieta }) {
  const [esito, setEsito] = useState("");
  const [errore, setErrore] = useState(null);
  const [facendo, setFacendo] = useState(false);
  const inVigore = (regolamenti || []).find((r) => r.attivo) || null;
  const composizione = useMemo(
    () => composizioneRegolamento({ livelli, tettoPct, regolamento: inVigore }),
    [livelli, tettoPct, inVigore]);

  async function genera() {
    if (facendo) return;
    setFacendo(true); setErrore(null); setEsito("");
    try {
      const { bytes, pagine } = await creaRegolamentoPdf(composizione, {
        getPdfLib, righeSocieta,
        versione: inVigore?.versione || null,
        inVigoreDal: inVigore?.in_vigore_dal || null,
      });
      scaricaPdf(bytes, `regolamento-rivenditori-${new Date().toISOString().slice(0, 10)}.pdf`);
      setEsito(`Regolamento creato: ${pagine} pagine.`);
    } catch (e) { setErrore(`Non sono riuscito a creare il regolamento: ${e?.message || e}`); }
    setFacendo(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...fontBody, fontSize: 13.5, color: MUTED, flex: "1 1 240px", lineHeight: 1.5 }}>
          {inVigore
            ? <>Versione <b style={{ color: NAVY }}>{inVigore.versione}</b>, in vigore dal {inVigore.in_vigore_dal}. Le versioni precedenti restano in archivio.</>
            : <>Tabelle, soglie e regole si leggono dalla configurazione: il foglio è sempre aggiornato.</>}
        </span>
        <Button onClick={genera} disabled={facendo} style={{ fontSize: 13, padding: "8px 14px" }}>
          {facendo ? "Creo il regolamento…" : "Genera regolamento"}
        </Button>
      </div>

      {!inVigore && (
        <div style={{ ...fontBody, fontSize: 13, color: "#8A6D1D", background: "#FDF8EC", border: `1px solid ${GOLD}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 14, lineHeight: 1.55 }} data-segnaposto-regolamento>
          <b>Il testo integrale del regolamento non è ancora caricato.</b> Serve il «Regolamento Commerciale
          Rivenditori Elitederma 2026» (in vigore dal 1° dicembre 2026, foro di Roma): finché non arriva, questo
          documento vale come prospetto delle condizioni commerciali e non come regolamento da far sottoscrivere.
          Tutto il resto — livelli, soglie, ciclo, rientro, riassortimenti, condizioni generali — c'è già e si
          aggiorna da sé.
        </div>
      )}

      {esito && <div style={{ ...fontBody, fontSize: 13, color: "#2E6B3E", background: "#E9F6EC", border: "1px solid #BFE3C8", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>{esito}</div>}
      {errore && <div style={{ ...fontBody, fontSize: 13, color: "#C0392B", background: "#FDECEC", border: "1px solid #F2C9C4", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>{errore}</div>}

      {composizione.blocchi.map((b) => (
        <div key={b.titolo} style={{ background: "#fff", border: `1px solid ${b.segnaposto ? GOLD : CREAM_BORDER}`, borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ ...fontBody, fontSize: 14.5, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{b.titolo}</div>
          {b.tabella && (
            <div style={{ overflowX: "auto", marginBottom: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", ...fontBody, fontSize: 12.5 }}>
                <thead><tr style={{ background: NAVY, color: "#fff" }}>
                  {b.tabella.testata.map((t) => <th key={t} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{t}</th>)}
                </tr></thead>
                <tbody>
                  {b.tabella.righe.map((riga, i) => (
                    <tr key={i} style={{ background: i % 2 ? "#fff" : "#FAF6EE" }}>
                      {riga.map((c, j) => <td key={j} style={{ padding: "5px 8px", color: NAVY, fontWeight: j === 0 ? 700 : 400, borderTop: `1px solid ${CREAM_BORDER}` }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(b.paragrafi || []).map((p, i) => (
            <div key={i} style={{ ...fontBody, fontSize: 13, color: b.segnaposto ? MUTED : NAVY, lineHeight: 1.6, marginBottom: 6 }}>{p}</div>
          ))}
          {b.firme && (
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 8 }}>
              Nel PDF, qui ci sono le righe per ragione sociale, luogo e data, firma — e, a parte, la doppia firma
              delle clausole degli artt. 1341-1342 c.c.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
