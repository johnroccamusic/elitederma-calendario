// "Consensi compilati": i consensi delle modelle di UNA classe.
//
// Chi guarda e' la master, in aula, con la modella davanti: vuole sapere
// se quella ragazza ha firmato e cosa ha dichiarato, prima di toccarla.
// Non e' l'archivio — li' ci sono tutti i consensi di tutte le classi, e
// serve a chi amministra.
//
// ORDINATI PER DATA, la data sopra e i nomi sotto: in aula si ragiona
// per giornata ("le modelle di martedi'"), non per ordine alfabetico.
// Il piu' recente in cima, perche' quello che serve e' quasi sempre oggi.
//
// La scheda di ogni consenso e' la stessa dell'archivio (`Riga`): gli
// stessi campi, gli stessi allegati, lo stesso elenco dei si'. Due
// schede diverse per la stessa cosa vorrebbero dire due posti dove
// ricordarsi di aggiungere un campo, e uno dei due resterebbe indietro.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { CONSENSI } from "../content/consensi";
import { leggiConsensiDelCorso } from "./dati";
import { Riga, Codice } from "./ArchivioConsensi.jsx";

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "martedì 3 giugno 2026" da un timestamp. Niente librerie. */
function giornoEsteso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Senza data";
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
const soloGiorno = (iso) => String(iso || "").slice(0, 10);

export default function ConsensiDelCorso({ corsoData, isMobile = false, titoloClasse = "" }) {
  const [righe, setRighe] = useState(null);
  const [qrAperto, setQrAperto] = useState(false);

  useEffect(() => {
    let vivo = true;
    setRighe(null);
    leggiConsensiDelCorso(corsoData?.id).then((r) => { if (vivo) setRighe(r); });
    return () => { vivo = false; };
  }, [corsoData?.id]);

  // raggruppate per giornata, dalla piu' recente
  const giornate = useMemo(() => {
    const per = new Map();
    (righe || []).forEach((c) => {
      const chiave = soloGiorno(c.ts);
      if (!per.has(chiave)) per.set(chiave, { chiave, ts: c.ts, consensi: [] });
      per.get(chiave).consensi.push(c);
    });
    return [...per.values()].sort((a, b) => b.chiave.localeCompare(a.chiave));
  }, [righe]);

  const modello = CONSENSI[0] || null;

  return (
    <div>
      {/* Il QR di QUESTA classe. Sta in cima e non in fondo: se la lista e'
          vuota e' perche' nessuna ha ancora inquadrato, e la prima cosa da
          fare e' farglielo inquadrare. */}
      {modello && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button" onClick={() => setQrAperto((x) => !x)}
            style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "13px 16px", width: "100%", textAlign: "left", cursor: "pointer", minHeight: 48 }}
          >
            {qrAperto ? "Chiudi il codice" : "Mostra il codice da far inquadrare"}
          </button>
          {qrAperto && (
            <div style={{ marginTop: 10 }}>
              <Codice
                modello={modello} isMobile={isMobile} edizione={corsoData?.id}
                sottotitolo={`Questo codice lega il consenso a ${titoloClasse || "questa classe"}: chi lo inquadra compare qui sotto.`}
              />
            </div>
          )}
        </div>
      )}

      {righe === null && (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "18px 0" }}>Sto leggendo…</div>
      )}

      {righe !== null && giornate.length === 0 && (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 18, background: "#fff", lineHeight: 1.55 }}>
          Nessuna modella ha ancora firmato per questa classe.
          <div style={{ marginTop: 6 }}>
            Compaiono qui solo i consensi firmati inquadrando il codice qui sopra. Quelli firmati dal codice generico appeso in aula stanno nell’archivio, dentro Gestione modelle.
          </div>
        </div>
      )}

      {giornate.map((g) => (
        <div key={g.chiave} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
            <div style={{ ...fontDisplay, fontSize: isMobile ? 15 : 17, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {giornoEsteso(g.ts)}
            </div>
            <div style={{ ...fontBody, fontSize: 12, color: GOLD, fontWeight: 700 }}>
              {g.consensi.length} modell{g.consensi.length === 1 ? "a" : "e"}
            </div>
          </div>
          {/* il riepilogo dei si' e delle note sta SOTTO IL NOME, senza
              aprire: la master scorre l'elenco e vede subito su chi
              fermarsi. Aprire serve per il documento e la firma. */}
          {g.consensi.map((c) => <Riga key={c.id} c={c} isMobile={isMobile} riepilogoSempre />)}
        </div>
      ))}
    </div>
  );
}
