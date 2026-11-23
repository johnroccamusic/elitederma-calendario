// «LOGHI E CERTIFICATI» (23/11/2026). Era «Assegna logo»: il titolare
// l'ha fatta diventare una cartella con due aree dentro. La procedura dei
// loghi non cambia di una riga e si apre da «Assegna loghi»; accanto c'e'
// «Crea certificato», che oggi ha un certificato solo — il 42 ore del PMU —
// e domani ne avra' altri, per questo e' un elenco e non un tasto diretto.
//
// I livelli vivono qui dentro e non nella `view` dell'app: l'Indietro in
// alto (e il gesto, e il tasto di Android) li vede solo attraverso
// `registraInterceptaIndietro`, come le sotto-viste dei Contatti — senza,
// da «Certificato 42 ore» si tornerebbe dritti alla Home saltando la
// cartella.
import React, { useEffect, useState } from "react";
import { TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, fontBody, stileTitoloPagina } from "../ui/stile.js";
import PaginaCertificato42 from "./PaginaCertificato42.jsx";

// il livello sopra a ognuno: e' l'unica cosa che l'Indietro deve sapere
const SOPRA = { loghi: "menu", certificati: "menu", "42ore": "certificati" };

export default function LoghiECertificati({ onBack, titolo = "Loghi e Certificati", renderLoghi, chi = "", registraInterceptaIndietro = null }) {
  const [livello, setLivello] = useState("menu");

  useEffect(() => {
    if (!registraInterceptaIndietro) return undefined;
    if (livello === "menu") { registraInterceptaIndietro(null); return undefined; }
    registraInterceptaIndietro(() => setLivello(SOPRA[livello] || "menu"));
    return () => registraInterceptaIndietro(null);
  }, [livello, registraInterceptaIndietro]);

  if (livello === "loghi") return renderLoghi(() => setLivello("menu"));
  if (livello === "42ore") return <PaginaCertificato42 onBack={() => setLivello("certificati")} chi={chi} />;

  const certificati = livello === "certificati";
  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <TastoLivelloPrecedente titolo={certificati ? titolo : "Home"} onClick={certificati ? () => setLivello("menu") : onBack} />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{certificati ? "Crea certificato" : titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 20, lineHeight: 1.5 }}>
          {certificati
            ? "Scegli il certificato da compilare. Quello che esce è un PDF definitivo, con le firme, e resta nell'elenco dei certificati fatti."
            : "I loghi da assegnare alle allieve e alle master, e i certificati da rilasciare a fine corso."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {certificati ? (
            <Tessera titolo="Certificato 42 ore" testo="Abilitazione PMU: dati dello studente, periodo del corso, luogo e data." onClick={() => setLivello("42ore")} />
          ) : (
            <>
              <Tessera titolo="Assegna loghi" testo="Personalizza loghi, watermark e materiali ufficiali." onClick={() => setLivello("loghi")} />
              <Tessera titolo="Crea certificato" testo="Compila e genera i certificati, e ritrova quelli già fatti." onClick={() => setLivello("certificati")} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tessera({ titolo, testo, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderLeft: `4px solid ${GOLD}`,
        borderRadius: 14, padding: "18px 18px", cursor: "pointer", minHeight: 96,
      }}
    >
      <div style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{titolo}</div>
      <div style={{ ...fontBody, fontSize: 13, color: MUTED, lineHeight: 1.4 }}>{testo}</div>
    </button>
  );
}
