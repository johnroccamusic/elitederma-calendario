// La pagina dei QR dei consensi, aperta a tutti.
//
// L'archivio dei consensi firmati sta dentro Gestione modelle, che non
// tutti possono aprire — ma il QR da far inquadrare serve a chi sta in
// aula con la modella davanti, che spesso e' proprio chi in Gestione
// modelle non entra. Qui ci sono solo i codici: nessun documento,
// nessun dato di nessuno, niente che valga la pena proteggere. Per
// questo il tasto in home non chiede permessi.
//
// L'elenco e' CONSENSI: aggiungendo una riga la' dentro, il codice
// compare anche qui senza toccare questa pagina.
import React from "react";
import { CONSENSI } from "../content/consensi";
import { Codice } from "./ArchivioConsensi.jsx";
import { NAVY, MUTED, CREAM_BORDER, fontBody, fontDisplay } from "../ui/stile.js";

export default function QrConsensi({ isMobile, onBack, TastoIndietro, titolo = "QR consensi modelle" }) {
  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          {TastoIndietro ? <TastoIndietro titolo="Home" onClick={onBack} /> : null}
          <div style={{ ...fontDisplay, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: isMobile ? 13 : 14, color: MUTED, marginBottom: 14, lineHeight: 1.5, maxWidth: "60ch" }}>
          Un codice per ogni tipo di consenso. Lo fai inquadrare alla modella: si apre il modulo sul suo telefono, lo compila lei, firma col dito e invia.
          Il consenso firmato finisce nell’archivio, dentro Gestione modelle.
        </div>

        {/* L'AVVISO CHE MANCAVA.
            Questi codici non sanno a quale corso appartengono: chi li usa
            in aula si ritrova i consensi solo nell'archivio generale, e in
            "Consensi modelle" della classe non compare niente. E' successo
            con i primi sette, raccolti fra l'11 e il 14/10/2026 mentre
            giravano due PMU BASE insieme — Roma e Pescara, stesse date —
            e nessuno dei due poteva piu' rivendicarli.
            Sta in cima e in rosso perche' la strada sbagliata e' quella
            comoda: questa pagina ha un tasto in home, la scheda corso no. */}
        <div style={{ ...fontBody, fontSize: isMobile ? 12.5 : 13.5, color: "#8A2D2D", background: "#FBEDEC", border: "1px solid #F0D3D0", borderRadius: 12, padding: "12px 14px", marginBottom: 20, lineHeight: 1.55, maxWidth: "60ch" }}>
          <b>Per un consenso durante un corso non usare questi codici.</b> Non sanno a quale corso appartengono: il consenso finisce nell’archivio e la master non lo trova nella sua classe.
          <div style={{ marginTop: 6 }}>
            Il codice giusto sta nella scheda della classe, in <b>Consensi modelle → Mostra il codice da far inquadrare</b>. È lo stesso modulo, ma porta con sé il corso.
          </div>
          <div style={{ marginTop: 6 }}>
            Questi restano buoni per un consenso fuori da un corso.
          </div>
        </div>

        {CONSENSI.length === 0 ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 18, background: "#fff" }}>
            Non c’è ancora nessun consenso.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CONSENSI.map((modello) => (
              <Codice key={modello.codice} modello={modello} isMobile={isMobile} />
            ))}
          </div>
        )}

        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 18, lineHeight: 1.5, maxWidth: "60ch" }}>
          Il codice si può anche stampare: resta valido, non scade e non cambia. In aula però conviene quello della classe, o i consensi di quel corso non si vedranno dalla sua scheda.
        </div>
      </div>
    </div>
  );
}
