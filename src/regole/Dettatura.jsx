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
  const [avviso, setAvviso] = useState("");
  const ric = useRef(null);
  const voluto = useRef(false);     // true finche' chi detta non preme «ferma»
  const sentito = useRef(false);    // almeno un risultato in questa sessione
  const guardia = useRef(null);

  useEffect(() => () => { voluto.current = false; clearTimeout(guardia.current); try { ric.current?.stop(); } catch { /* gia' fermo */ } }, []);

  if (!dettaturaDisponibile()) return null;

  // iPhone e iPad: Safari ha il riconoscimento, ma `continuous` lo
  // rispetta male — si ferma alla prima pausa e a volte non consegna
  // niente. Si lavora a frasi: una sessione corta per volta, riavviata
  // finche' chi detta non preme «ferma». Trovato il 25/10/2026: il
  // titolare ha parlato e non e' comparso nulla.
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function avviaSessione() {
    const Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Riconoscitore();
    r.lang = "it-IT";
    r.continuous = !iOS;
    r.interimResults = true;
    r.onresult = (e) => {
      sentito.current = true; setAvviso("");
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
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        voluto.current = false;
        setErrore(iOS
          ? "Qui il microfono dell'app non è permesso. Usa quello della tastiera: tocca la casella e premi il microfono in basso a destra della tastiera."
          : "Il browser non permette il microfono: controlla i permessi del sito.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") setErrore(`Dettatura interrotta (${e.error}).`);
    };
    r.onend = () => {
      ric.current = null; setParziale("");
      // iOS chiude la sessione a ogni pausa: se non e' stato premuto
      // «ferma», se ne apre un'altra
      if (voluto.current) { try { avviaSessione(); return; } catch { /* si ferma sotto */ } }
      setAttivo(false); voluto.current = false;
    };
    ric.current = r;
    r.start();
  }

  function avvia() {
    setErrore(""); setAvviso(""); sentito.current = false; voluto.current = true;
    try { avviaSessione(); setAttivo(true); } catch { voluto.current = false; setErrore("Non riesco ad avviare il microfono."); return; }
    // se dopo otto secondi non e' arrivato niente, non e' chi detta che
    // sbaglia: si spiega l'alternativa invece di lasciare il tasto rosso
    clearTimeout(guardia.current);
    guardia.current = setTimeout(() => {
      if (!sentito.current && voluto.current) setAvviso(iOS
        ? "Non sento niente. Su iPhone funziona sempre il microfono della tastiera: tocca la casella e premi il microfono in basso a destra."
        : "Non sento niente: controlla che il microfono sia permesso per questo sito.");
    }, 8000);
  }
  function ferma() { voluto.current = false; clearTimeout(guardia.current); try { ric.current?.stop(); } catch { /* gia' fermo */ } setAttivo(false); }

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
      {avviso && !errore && <span data-campo="dettatura-avviso" style={{ ...fontBody, fontSize: 12, color: GRAFITE }}>{avviso}</span>}
      {errore && <span style={{ ...fontBody, fontSize: 12, color: "#B3261E" }}>{errore}</span>}
    </div>
  );
}
