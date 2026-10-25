// DETTATURA (25/10/2026): un microfono accanto al testo della regola. Chi
// scrive i regolamenti li detta invece di batterli: il riconoscimento
// vocale e' quello del browser (Web Speech API, in italiano), quindi
// niente server e niente costi — e dove il browser non lo ha, il tasto
// non compare invece di promettere una cosa che non funziona.
//
// Il testo riconosciuto si AGGIUNGE a quello che c'e', una frase per
// volta quando il browser la da' per definitiva: cosi' si puo' dettare,
// fermarsi, correggere a mano e riprendere.
import React, { useEffect, useRef, useState } from "react";
import { NAVY, GRAFITE, CREAM_BORDER, fontBody } from "../ui/stile.js";

export function dettaturaDisponibile() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export default function TastoDettatura({ onTesto, compatto = false }) {
  const [attivo, setAttivo] = useState(false);
  const [parziale, setParziale] = useState("");
  const [errore, setErrore] = useState("");
  const ric = useRef(null);

  useEffect(() => () => { try { ric.current?.stop(); } catch { /* gia' fermo */ } }, []);

  if (!dettaturaDisponibile()) return null;

  function avvia() {
    const Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Riconoscitore();
    r.lang = "it-IT";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let definitivo = ""; let provvisorio = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript || "";
        if (e.results[i].isFinal) definitivo += t; else provvisorio += t;
      }
      if (definitivo.trim()) onTesto(definitivo.trim());
      setParziale(provvisorio);
    };
    r.onerror = (e) => {
      // «no-speech» e «aborted» sono silenzi, non guasti
      if (e.error === "not-allowed") setErrore("Il browser non permette il microfono: controlla i permessi del sito.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setErrore(`Dettatura interrotta (${e.error}).`);
    };
    r.onend = () => { setAttivo(false); setParziale(""); ric.current = null; };
    ric.current = r;
    setErrore("");
    try { r.start(); setAttivo(true); } catch { setErrore("Non riesco ad avviare il microfono."); }
  }
  function ferma() { try { ric.current?.stop(); } catch { /* gia' fermo */ } }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button type="button" data-campo="dettatura" onClick={attivo ? ferma : avvia} title={attivo ? "Ferma la dettatura" : "Detta il testo"} aria-pressed={attivo}
        style={{ ...fontBody, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: compatto ? "4px 9px" : "6px 12px", borderRadius: 999, cursor: "pointer",
          border: `1px solid ${attivo ? "#B3261E" : CREAM_BORDER}`, background: attivo ? "#FDECEC" : "#fff", color: attivo ? "#B3261E" : NAVY }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" />
        </svg>
        {attivo ? "Sto ascoltando… ferma" : "Detta"}
      </button>
      {attivo && parziale && <span style={{ ...fontBody, fontSize: 12, color: GRAFITE, fontStyle: "italic" }}>{parziale}</span>}
      {errore && <span style={{ ...fontBody, fontSize: 12, color: "#B3261E" }}>{errore}</span>}
    </div>
  );
}
