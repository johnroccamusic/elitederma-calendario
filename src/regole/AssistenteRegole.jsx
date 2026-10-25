// L'ASSISTENTE DEI REGOLAMENTI (25/10/2026): l'icona flottante in basso a
// destra, in tutta l'app, per chi ha fatto accesso. Si apre, si scrive la
// domanda, la risposta arriva con il nome delle regole da cui viene. Se
// nessuna regola risponde lo dice — e la domanda resta registrata per chi
// scrive le regole. La funzione dietro e' `assistente-regole`.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay } from "../ui/stile.js";

function Testo({ testo }) {
  const righe = String(testo || "").split("\n");
  const pezzi = (r) => r.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>);
  return <div style={{ ...fontBody, fontSize: 13.5, color: NAVY, lineHeight: 1.55 }}>
    {righe.map((r, i) => !r.trim() ? <div key={i} style={{ height: 6 }} />
      : /^\s*[-•]\s+/.test(r) ? <div key={i} style={{ display: "flex", gap: 6, paddingLeft: 4 }}><span>•</span><span>{pezzi(r.replace(/^\s*[-•]\s+/, ""))}</span></div>
      : <div key={i}>{pezzi(r)}</div>)}
  </div>;
}

export default function AssistenteRegole({ ruolo = "tutti", chi = "", isMobile = false, onApriRegolamenti = null }) {
  const [aperto, setAperto] = useState(false);
  const [domanda, setDomanda] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [scambi, setScambi] = useState([]); // { domanda, risposta, citati, senza, errore }
  const fondo = useRef(null);

  useEffect(() => { if (aperto) fondo.current?.scrollIntoView?.({ block: "end" }); }, [scambi, aperto]);

  async function chiedi(e) {
    e?.preventDefault?.();
    const d = domanda.trim();
    if (d.length < 3 || occupato) return;
    setOccupato(true);
    const cronologia = scambi.filter((s) => s.risposta).slice(-3).map((s) => ({ domanda: s.domanda, risposta: s.risposta }));
    try {
      const { data, error } = await supabase.functions.invoke("assistente-regole", { body: { domanda: d, ruolo, chi, cronologia } });
      if (error || !data?.ok) setScambi((s) => [...s, { domanda: d, errore: data?.errore || error?.message || "Nessuna risposta." }]);
      else setScambi((s) => [...s, { domanda: d, risposta: data.risposta, citati: data.citati || [], senza: !!data.senza_risposta }]);
      setDomanda("");
    } catch (err) {
      setScambi((s) => [...s, { domanda: d, errore: String(err?.message || err) }]);
    } finally { setOccupato(false); }
  }

  // sotto il dock del telefono (che sta di lato) e sopra quello da
  // scrivania (in basso al centro): a destra non da' fastidio a nessuno
  const base = { position: "fixed", right: 16, bottom: isMobile ? 84 : 24, zIndex: 1900 };

  return (
    <>
      {!aperto && (
        <button type="button" data-campo="assistente-regole" onClick={() => setAperto(true)} title="Chiedi ai regolamenti" aria-label="Chiedi ai regolamenti"
          style={{ ...base, width: 52, height: 52, borderRadius: 26, border: "none", cursor: "pointer", background: NAVY, color: "#fff", boxShadow: "0 8px 24px rgba(14,27,51,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M12 7v4" /><circle cx="12" cy="13.5" r="0.6" fill="currentColor" />
          </svg>
        </button>
      )}
      {aperto && (
        <div data-campo="pannello-assistente" style={{ ...base, width: "min(380px, calc(100vw - 32px))", maxHeight: isMobile ? "calc(100dvh - 120px)" : "min(560px, calc(100dvh - 48px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 18, border: `1px solid ${CREAM_BORDER}`, boxShadow: "0 16px 48px rgba(14,27,51,0.28)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: NAVY, color: "#fff" }}>
            <div>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700 }}>Chiedi ai regolamenti</div>
              <div style={{ ...fontBody, fontSize: 11, opacity: 0.75 }}>Risponde solo con le regole scritte</div>
            </div>
            <button type="button" onClick={() => setAperto(false)} aria-label="Chiudi" style={{ all: "unset", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
            {scambi.length === 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: GRAFITE, lineHeight: 1.5 }}>
                Esempi: «quanto sconto posso fare in aula?», «cosa faccio se l'allieva vuole le modelle dopo aver firmato?», «chi verifica un buono Amazon?».
                {onApriRegolamenti && <div style={{ marginTop: 8 }}><button type="button" onClick={() => { setAperto(false); onApriRegolamenti(); }} style={{ all: "unset", cursor: "pointer", color: NAVY, textDecoration: "underline", fontSize: 12.5 }}>Leggi tutte le regole</button></div>}
              </div>
            )}
            {scambi.map((s, i) => (
              <div key={i} data-campo="scambio">
                <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Tu: {s.domanda}</div>
                {s.errore
                  ? <div style={{ ...fontBody, fontSize: 13, color: "#B3261E" }}>{s.errore}</div>
                  : <div style={{ borderLeft: `3px solid ${s.senza ? CREAM_BORDER : GOLD}`, paddingLeft: 10 }}>
                      <Testo testo={s.risposta} />
                      {s.citati?.length > 0 && (
                        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
                          Da: {s.citati.map((c) => c.titolo).join(" · ")}
                        </div>
                      )}
                    </div>}
              </div>
            ))}
            <div ref={fondo} />
          </div>
          <form onSubmit={chiedi} style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
            <input data-campo="domanda-regole" value={domanda} onChange={(e) => setDomanda(e.target.value)} disabled={occupato} placeholder="Scrivi la domanda…"
              style={{ ...fontBody, flex: 1, minWidth: 0, fontSize: 14, padding: "9px 12px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}` }} />
            <button type="submit" disabled={occupato || domanda.trim().length < 3}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, padding: "0 14px", borderRadius: 12, border: "none", background: NAVY, color: "#fff", cursor: "pointer", opacity: occupato || domanda.trim().length < 3 ? 0.5 : 1 }}>
              {occupato ? "…" : "Chiedi"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
