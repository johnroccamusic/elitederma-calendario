// «LOGHI E CERTIFICATI» (23/11/2026). Era «Assegna logo»: il titolare
// l'ha fatta diventare una cartella con due aree dentro. La procedura dei
// loghi non cambia di una riga e si apre da «Assegna loghi»; accanto c'e'
// «Crea certificato», che oggi ha un certificato solo — il 42 ore del PMU —
// e dal 23/11 sera anche il needling: per questo e' un elenco, e ogni
// certificato e' una voce di `tipi.js`.
//
// I livelli vivono qui dentro e non nella `view` dell'app: l'Indietro in
// alto (e il gesto, e il tasto di Android) li vede solo attraverso
// `registraInterceptaIndietro`, come le sotto-viste dei Contatti — senza,
// da «Certificato 42 ore» si tornerebbe dritti alla Home saltando la
// cartella.
import React, { useEffect, useState } from "react";
import { TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, fontBody, stileTitoloPagina } from "../ui/stile.js";
import PaginaCertificato from "./PaginaCertificato.jsx";
import { CERTIFICATI, ORDINE_CERTIFICATI } from "./tipi.js";

// il livello sopra a ognuno: e' l'unica cosa che l'Indietro deve sapere.
// Ogni certificato e' un livello col suo tipo, e sta sotto «Crea certificato».
const SOPRA = { loghi: "menu", certificati: "menu" };

export default function LoghiECertificati({ onBack, titolo = "Loghi e Certificati", renderLoghi, chi = "", registraInterceptaIndietro = null }) {
  const [livello, setLivello] = useState("menu");

  useEffect(() => {
    if (!registraInterceptaIndietro) return undefined;
    if (livello === "menu") { registraInterceptaIndietro(null); return undefined; }
    registraInterceptaIndietro(() => setLivello(SOPRA[livello] || (CERTIFICATI[livello] ? "certificati" : "menu")));
    return () => registraInterceptaIndietro(null);
  }, [livello, registraInterceptaIndietro]);

  if (livello === "loghi") return renderLoghi(() => setLivello("menu"));
  if (CERTIFICATI[livello]) return <PaginaCertificato key={livello} certificato={CERTIFICATI[livello]} onBack={() => setLivello("certificati")} chi={chi} />;

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
            ORDINE_CERTIFICATI.map((t) => (
              <Tessera key={t} titolo={CERTIFICATI[t].titolo} testo={CERTIFICATI[t].tessera} onClick={() => setLivello(t)} />
            ))
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
