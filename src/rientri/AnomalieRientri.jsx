// Le schede di fine corso chiuse con qualcosa che non torna.
//
// La master chiude sempre, anche quando i conti non quadrano: ferma in
// aula davanti a una scheda bloccata non risolverebbe la discrepanza, la
// inventerebbe. Le differenze finiscono qui, e le guarda chi riceve il
// pacco — l'unico che ha lo scaffale davanti e il tempo di contare.
//
// "Verificata" non corregge niente e non tocca il magazzino: dice solo che
// qualcuno l'ha guardata, e la toglie dalla lista di quelle da guardare.

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { TastoLivelloPrecedente } from "../ui/base.jsx";
import { leggiAnomalie, segnaAnomaliaRisolta } from "./rientro";

export default function AnomalieRientri({ corsi, corsiDate, location, master, isMobile = false, onBack }) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);

  const corsoById = useMemo(() => Object.fromEntries((corsi || []).map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries((location || []).map((l) => [l.id, l])), [location]);
  const masterById = useMemo(() => Object.fromEntries((master || []).map((m) => [m.id, m])), [master]);
  const edizioneById = useMemo(() => Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd])), [corsiDate]);

  async function ricarica() {
    setRighe(await leggiAnomalie());
    setCaricando(false);
  }
  useEffect(() => { ricarica(); }, []);

  async function verificata(id) {
    await segnaAnomaliaRisolta(id);
    await ricarica();
  }

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Logistica prodotti" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Rientri da verificare</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
          Inventari chiusi in cui qualcosa non tornava. La scheda si chiude sempre: la differenza si guarda qui, con il pacco davanti.
        </div>

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : righe.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 20, ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
            Nessuna differenza da verificare. Tutti gli inventari chiusi finora tornavano.
          </div>
        ) : righe.map((r) => {
          const cd = edizioneById[r.corsoDataId];
          return (
            <div key={r.rientroId} style={{ background: "#fff", border: "1px solid #EAD9B0", borderRadius: 14, padding: isMobile ? 14 : 18, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY }}>
                  {cd ? (corsoById[cd.corso_id]?.nome || "—") : "Corso non trovato"}
                </span>
                <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>
                  {cd ? `${locById[cd.location_id]?.nome || "—"} · ${cd.data_inizio || ""}` : ""}
                  {cd?.master_id && ` · ${masterById[cd.master_id]?.nome || ""}`}
                </span>
              </div>
              {r.note.map((n, i) => (
                <div key={i} style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: "#8A6A1B", background: "#F7EEDE", borderRadius: 10, padding: "10px 12px", marginBottom: 6, lineHeight: 1.45 }}>
                  {n.testo}
                </div>
              ))}
              <button
                onClick={() => verificata(r.rientroId)}
                style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", marginTop: 6, minHeight: 44 }}
              >
                L'ho verificata
              </button>
              <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 6 }}>
                Non corregge niente e non tocca il magazzino: la toglie da questa lista.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
