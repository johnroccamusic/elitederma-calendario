// Analisi dei consumi ai corsi.
//
// Tre viste sulla stessa cosa: quanto si consuma per allievo, chi si
// discosta dalla media, e quali corsi sono andati fuori riga.
//
// Quando i dati non bastano questa pagina lo dice e si ferma, invece di
// mostrare una media calcolata su un corso solo. E' la stessa regola
// dell'Advisor: una previsione sbagliata detta con sicurezza e' peggio
// del silenzio.

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { TastoLivelloPrecedente } from "../ui/base.jsx";
import { analizzaConsumi, CORSI_MINIMI_PER_MEDIA } from "./consumi";

const num = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const pct = (n) => `${n > 0 ? "+" : ""}${n}%`;

function Scostamento({ valore }) {
  const forte = Math.abs(valore) >= 30;
  const colore = valore > 0 ? (forte ? "#C0392B" : "#8A6A1B") : "#2E7D32";
  const sfondo = valore > 0 ? (forte ? "#FDECEC" : "#F7EEDE") : "#E9F6EC";
  return (
    <span style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: colore, background: sfondo, borderRadius: 8, padding: "3px 9px", whiteSpace: "nowrap" }}>
      {pct(valore)}
    </span>
  );
}

export default function AnalisiConsumi({ prodottiShop, corsi, corsiDate, master, location, isMobile = false, onBack }) {
  const [analisi, setAnalisi] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [vista, setVista] = useState("media");

  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  const corsoById = useMemo(() => Object.fromEntries((corsi || []).map((c) => [c.id, c])), [corsi]);
  const masterById = useMemo(() => Object.fromEntries((master || []).map((m) => [m.id, m])), [master]);
  const edizioneById = useMemo(() => Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd])), [corsiDate]);
  const locById = useMemo(() => Object.fromEntries((location || []).map((l) => [l.id, l])), [location]);

  useEffect(() => {
    let vivo = true;
    analizzaConsumi().then((a) => { if (!vivo) return; setAnalisi(a); setCaricando(false); });
    return () => { vivo = false; };
  }, []);

  const nomeProdotto = (id) => prodottoById[id]?.nome || "—";
  const nomeCorso = (id) => corsoById[id]?.nome || "—";
  const nomeMaster = (id) => masterById[id]?.nome || "—";
  const doveQuando = (corsoDataId) => {
    const cd = edizioneById[corsoDataId];
    if (!cd) return "";
    return `${locById[cd.location_id]?.nome || "—"} · ${cd.data_inizio || ""}`;
  };

  const linguetta = (chiave, testo) => (
    <button
      key={chiave} onClick={() => setVista(chiave)}
      style={{
        ...fontBody, fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer",
        background: vista === chiave ? NAVY : "#fff", color: vista === chiave ? "#fff" : NAVY,
        boxShadow: vista === chiave ? "none" : `inset 0 0 0 1px ${CREAM_BORDER}`, whiteSpace: "nowrap",
      }}
    >{testo}</button>
  );

  const scheda = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Gestione magazzino" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Consumi ai corsi</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          Quanto si consuma <b style={{ color: NAVY }}>per allievo</b>: è l'unico modo di confrontare una classe da otto con una da uno.
        </div>

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : !analisi || analisi.edizioniChiuse === 0 ? (
          <div style={{ ...scheda, ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.55 }}>
            Nessun inventario di fine corso è ancora stato chiuso, quindi non c'è niente da misurare.
            Questa pagina si riempie da sola: ogni corso chiuso aggiunge una riga, e dopo {CORSI_MINIMI_PER_MEDIA} corti
            dello stesso tipo comincia a dire qualcosa di affidabile.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {linguetta("media", "Consumo medio")}
              {linguetta("master", "Classifica master")}
              {linguetta("anomali", `Corsi fuori riga${analisi.anomali.length ? ` (${analisi.anomali.length})` : ""}`)}
            </div>

            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {analisi.edizioniChiuse} {analisi.edizioniChiuse === 1 ? "corso chiuso" : "corsi chiusi"} · {analisi.medie.length} combinazioni corso/prodotto
            </div>

            {vista === "media" && (
              <div style={scheda}>
                {analisi.medie.map((m) => (
                  <div key={`${m.corsoId}|${m.prodottoId}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 220px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                      {nomeProdotto(m.prodottoId)}
                      <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                        {nomeCorso(m.corsoId)} · {m.edizioni} {m.edizioni === 1 ? "corso" : "corsi"} · {m.totaleAllievi} allievi
                        {m.edizioni < CORSI_MINIMI_PER_MEDIA && " · troppo pochi per fidarsi"}
                      </span>
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: m.edizioni < CORSI_MINIMI_PER_MEDIA ? MUTED : NAVY }}>{num(m.media)}</span>
                      <span style={{ ...fontBody, fontSize: 11, color: MUTED }}> per allievo</span>
                      {m.deviazione > 0 && (
                        <span style={{ display: "block", ...fontBody, fontSize: 11, color: MUTED }}>± {num(m.deviazione)} fra un corso e l'altro</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {vista === "master" && (
              <div style={scheda}>
                {analisi.master.length === 0 ? (
                  <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
                    Non ci sono ancora abbastanza corsi dello stesso tipo per confrontare le master fra loro.
                    Servono almeno {CORSI_MINIMI_PER_MEDIA} corsi chiusi per ogni tipo.
                  </div>
                ) : (
                  <>
                    <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 10, lineHeight: 1.45 }}>
                      Lo scostamento è rispetto alla media del <b style={{ color: NAVY }}>proprio</b> tipo di corso:
                      una master che tiene solo corsi lunghi consumerebbe sempre "troppo" contro una media di tutti.
                    </div>
                    {analisi.master.map((m) => (
                      <div key={m.masterId || "?"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 200px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                          {m.masterId ? nomeMaster(m.masterId) : "Senza master"}
                          <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                            {m.edizioni} {m.edizioni === 1 ? "corso" : "corsi"} · {m.prodottiConfrontati} confronti
                          </span>
                        </span>
                        <Scostamento valore={m.scostamentoPct} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {vista === "anomali" && (
              <div style={scheda}>
                {analisi.anomali.length === 0 ? (
                  <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
                    Nessun corso si discosta dalla media più del 30%. O va tutto bene, o non ci sono ancora abbastanza corsi per accorgersene.
                  </div>
                ) : analisi.anomali.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 240px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                      {nomeProdotto(a.prodottoId)}
                      <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                        {nomeCorso(a.corsoId)} · {doveQuando(a.corsoDataId)}
                        {a.masterId && ` · ${nomeMaster(a.masterId)}`}
                      </span>
                      <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 1 }}>
                        {num(a.perAllievo)} per allievo contro una media di {num(a.media)}
                      </span>
                    </span>
                    <Scostamento valore={a.scostamentoPct} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
