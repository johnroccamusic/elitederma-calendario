// La ricevuta che vede chi ha pagato col QR al banco.
//
// E' l'unica pagina dell'app che guarda un cliente, e arriva subito
// dopo che ha dato i soldi: deve dire chi ha incassato, quanto, quando
// e per cosa. Niente altro.
//
// Prima al suo posto c'era una pagina servita dall'edge function, e sul
// telefono si scaricava come file col sorgente dentro: le edge function
// di Supabase rispondono "text/plain" con una CSP "sandbox", e
// l'HTML non lo disegna nessuno. Qui invece siamo dentro l'app, che e'
// un sito vero.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

const NAVY = "#0E1B33";
const GOLD = "#C6A45C";
const CREMA = "#F7F4EC";
const GRIGIO = "#5E5039";

const euro = (n) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
function quando(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return null; }
}

export default function Ricevuta({ codice }) {
  const [dati, setDati] = useState(undefined); // undefined = sto leggendo

  useEffect(() => {
    let vivo = true;
    supabase.rpc("ricevuta_pos", { p_codice: codice })
      .then(({ data, error }) => { if (vivo) setDati(error ? null : (data || null)); });
    return () => { vivo = false; };
  }, [codice]);

  const cornice = {
    minHeight: "100vh", background: CREMA, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 22, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxSizing: "border-box",
  };
  const foglio = {
    width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18,
    border: "1px solid #E7E0CE", boxShadow: "0 14px 36px -18px rgba(14,27,51,0.4)",
    padding: "26px 22px", boxSizing: "border-box",
  };

  if (dati === undefined) {
    return <div style={cornice}><div style={{ ...foglio, textAlign: "center", color: GRIGIO, fontSize: 15 }}>Un istante…</div></div>;
  }
  if (!dati) {
    return (
      <div style={cornice}>
        <div style={{ ...foglio, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, color: NAVY, margin: "0 0 8px" }}>Ricevuta non trovata</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: GRIGIO, margin: 0 }}>
            Questo codice non corrisponde a nessun pagamento. Chiedi al banco di rigenerarlo.
          </p>
        </div>
      </div>
    );
  }

  const s = dati.societa || {};
  const pagato = dati.stato === "da_verificare" || dati.stato === "fatturato";
  const righe = Array.isArray(dati.righe) ? dati.righe : [];

  return (
    <div style={cornice}>
      <div style={foglio}>
        {/* l'intestazione: chi ha incassato. Su una ricevuta e' la prima
            cosa che deve esserci, prima ancora della cifra */}
        <div style={{ textAlign: "center", paddingBottom: 16, borderBottom: `1px solid #EFE8D8` }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, letterSpacing: 0.3 }}>{s.nome || "Elitederma"}</div>
          {[s.indirizzo, s.indirizzo_2, s.riga_4, s.riga_5].filter(Boolean).map((r, i) => (
            <div key={i} style={{ fontSize: 11.5, color: GRIGIO, lineHeight: 1.5, marginTop: i === 0 ? 4 : 1 }}>{r}</div>
          ))}
        </div>

        {pagato ? (
          <>
            <div style={{ textAlign: "center", padding: "20px 0 6px" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "#E8F5E9", color: "#2E7D32",
                display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: GRIGIO }}>Pagamento ricevuto</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: NAVY, lineHeight: 1.15, marginTop: 4 }}>{euro(dati.importo)}</div>
              {quando(dati.pagato_il) && (
                <div style={{ fontSize: 12.5, color: GRIGIO, marginTop: 6 }}>{quando(dati.pagato_il)}</div>
              )}
            </div>

            {righe.length > 0 && (
              <div style={{ borderTop: `1px solid #EFE8D8`, marginTop: 14, paddingTop: 12 }}>
                {righe.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: NAVY, padding: "5px 0", lineHeight: 1.35 }}>
                    <span style={{ minWidth: 0 }}>{r.nome || "Articolo"}</span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{euro((Number(r.prezzo) || 0) * (Number(r.quantita) || 1))}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: `2px solid ${GOLD}`, marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>Totale pagato</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{euro(dati.importo)}</span>
            </div>

            <div style={{ fontSize: 12, color: GRIGIO, lineHeight: 1.6, marginTop: 16, textAlign: "center" }}>
              Pagato con carta. La fattura arriva separatamente, ai dati che hai appena inserito.
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "22px 0 6px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
              {dati.stato === "annullato" ? "Richiesta annullata"
                : dati.stato === "scaduto" ? "Richiesta scaduta"
                : "Pagamento non ancora ricevuto"}
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: GRIGIO, margin: 0 }}>
              {dati.stato === "in_attesa"
                ? "Se hai appena pagato, aspetta qualche secondo e ricarica questa pagina."
                : "Chiedi al banco di generare una nuova richiesta di pagamento."}
            </p>
          </div>
        )}

        <div style={{ fontSize: 10.5, color: "#A69E8C", marginTop: 18, textAlign: "center", letterSpacing: 0.5 }}>
          Ricevuta n. {dati.codice}
        </div>
      </div>
    </div>
  );
}
