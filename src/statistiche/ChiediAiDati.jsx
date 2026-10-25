// CHIEDI AI DATI (25/10/2026): una barra in Statistiche dove chi
// amministra scrive una domanda in italiano e riceve la risposta coi
// numeri. La fa la edge function `analisi-domanda`: il modello traduce la
// domanda in una SELECT sulle viste di analisi (niente dati personali),
// Postgres la esegue, il modello scrive la risposta dalle righe. Sotto
// la risposta si vedono «i numeri» (le righe) e «come l'ho calcolato»
// (la query): chi legge puo' controllare, e un conto che non si puo'
// controllare non e' un conto.
import React, { useState } from "react";
import { supabase } from "../supabase.js";
import { fontBody, fontDisplay, NAVY, MUTED, GOLD, CREAM_BORDER } from "../ui/stile.js";
import { Button } from "../ui/base.jsx";

export const DOMANDE_PRONTE = [
  "I 10 prodotti più venduti a maggio",
  "Quale master vende di più quest'anno?",
  "Ricavi da settembre a oggi, divisi per fonte",
  "Quali spese potremmo abbassare per guadagnare di più?",
];

// il testo del modello: «**grassetto**» e righe che iniziano con «- »
function Testo({ testo }) {
  const righe = String(testo || "").split("\n");
  const pezzi = (r) => r.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**")
    ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>);
  return (
    <div style={{ ...fontBody, fontSize: 14, color: NAVY, lineHeight: 1.6 }}>
      {righe.map((r, i) => {
        if (!r.trim()) return <div key={i} style={{ height: 8 }} />;
        if (/^\s*[-•]\s+/.test(r)) return <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 6 }}><span>•</span><span>{pezzi(r.replace(/^\s*[-•]\s+/, ""))}</span></div>;
        return <div key={i}>{pezzi(r)}</div>;
      })}
    </div>
  );
}

function fmt(v) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "sì" : "no";
  return String(v);
}

export default function ChiediAiDati({ chi = "" }) {
  const [domanda, setDomanda] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [esiti, setEsiti] = useState([]); // [{ domanda, risposta, sql, righe, errore }]
  const [aperti, setAperti] = useState({}); // indice -> { righe, sql }

  async function chiedi(testo) {
    const d = String(testo || domanda).trim();
    if (d.length < 3 || occupato) return;
    setOccupato(true);
    const cronologia = esiti.filter((e) => e.risposta).slice(-3).map((e) => ({ domanda: e.domanda, risposta: e.risposta }));
    try {
      const { data, error } = await supabase.functions.invoke("analisi-domanda", { body: { domanda: d, cronologia, chi } });
      if (error || !data?.ok) setEsiti((e) => [...e, { domanda: d, errore: data?.errore || error?.message || "Nessuna risposta." }]);
      else setEsiti((e) => [...e, { domanda: d, risposta: data.risposta, sql: data.sql, righe: data.righe || [], totale: data.totale_righe, nota: data.nota }]);
      setDomanda("");
    } catch (e) {
      setEsiti((x) => [...x, { domanda: d, errore: String(e?.message || e) }]);
    } finally { setOccupato(false); }
  }

  return (
    <div data-campo="chiedi-ai-dati" style={{ border: `1px solid ${GOLD}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 16, padding: "14px 16px", marginBottom: 22, background: "#FFFDF8" }}>
      <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY }}>Chiedi ai dati</div>
      <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, margin: "2px 0 10px" }}>
        Una domanda in italiano, la risposta coi numeri dell'app. Vendite, incassi, iscrizioni, spese e classi; mai dati personali degli allievi.
      </div>
      <form onSubmit={(e) => { e.preventDefault(); chiedi(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          data-campo="domanda" value={domanda} onChange={(e) => setDomanda(e.target.value)} disabled={occupato}
          placeholder="Es. quale corso ha incassato di più a ottobre?"
          style={{ ...fontBody, flex: "1 1 260px", minWidth: 0, fontSize: 14, padding: "10px 12px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}`, background: "#fff" }}
        />
        <Button type="submit" disabled={occupato || domanda.trim().length < 3}>{occupato ? "Calcolo…" : "Chiedi"}</Button>
      </form>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {DOMANDE_PRONTE.map((d) => (
          <button key={d} type="button" onClick={() => chiedi(d)} disabled={occupato}
            style={{ ...fontBody, fontSize: 11.5, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>
            {d}
          </button>
        ))}
      </div>
      {esiti.map((e, i) => (
        <div key={i} data-campo="esito-domanda" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
          <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 6 }}>Tu: {e.domanda}</div>
          {e.errore
            ? <div style={{ ...fontBody, fontSize: 13, color: "#B3261E" }}>{e.errore}</div>
            : <>
                <Testo testo={e.risposta} />
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  {e.righe?.length > 0 && (
                    <button type="button" onClick={() => setAperti((a) => ({ ...a, [i]: { ...(a[i] || {}), righe: !a[i]?.righe } }))}
                      style={{ ...fontBody, fontSize: 11.5, color: NAVY, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                      {aperti[i]?.righe ? "Nascondi i numeri" : `I numeri (${e.totale ?? e.righe.length} righe)`}
                    </button>
                  )}
                  {e.sql && (
                    <button type="button" onClick={() => setAperti((a) => ({ ...a, [i]: { ...(a[i] || {}), sql: !a[i]?.sql } }))}
                      style={{ ...fontBody, fontSize: 11.5, color: MUTED, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                      {aperti[i]?.sql ? "Nascondi il calcolo" : "Come l'ho calcolato"}
                    </button>
                  )}
                </div>
                {aperti[i]?.righe && e.righe?.length > 0 && (
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table style={{ borderCollapse: "collapse", ...fontBody, fontSize: 12 }}>
                      <thead><tr>{Object.keys(e.righe[0]).map((k) => <th key={k} style={{ textAlign: "left", padding: "4px 8px", borderBottom: `1px solid ${CREAM_BORDER}`, color: MUTED, fontSize: 10.5, textTransform: "uppercase" }}>{k}</th>)}</tr></thead>
                      <tbody>{e.righe.map((r, j) => <tr key={j}>{Object.keys(e.righe[0]).map((k) => <td key={k} style={{ padding: "4px 8px", borderBottom: `1px solid #F1EEE4`, color: NAVY, whiteSpace: "nowrap" }}>{fmt(r[k])}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {aperti[i]?.sql && (
                  <pre style={{ ...fontBody, fontSize: 11, color: MUTED, background: "#F7F7F5", borderRadius: 8, padding: "8px 10px", marginTop: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{e.nota ? `${e.nota}\n\n` : ""}{e.sql}</pre>
                )}
              </>}
        </div>
      ))}
    </div>
  );
}
