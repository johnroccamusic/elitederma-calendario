// Prezzi e listini: il listino dei rivenditori, a blocchi.
//
// Quattro numeri per prodotto — pubblico lordo, pubblico netto, sconto
// massimo concedibile, prezzo che paga il rivenditore — divisi per
// reparto, nello stesso ordine del menu del sito.
//
// Sola lettura. Non tocca `prezzo_vendita`, non scrive su WooCommerce: il
// listino per i rivenditori è una cosa, il prezzo dello shop un'altra.
// Il conto sta tutto nella view `v_prezzi_listini`, così la stessa
// formula non finisce scritta due volte in due posti che poi divergono.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NAVY, CREAM_BORDER, BG, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { leggiListino, csvListino, scaricaCsv, BLOCCHI, motivoSenzaSconto } from "./dati.js";
import { iconaDelBlocco } from "./icone.jsx";

const euro = (n) => (n == null ? "—" : `€ ${Number(n).toFixed(2).replace(".", ",")}`);
const ROSSO = "#C0392B";

export default function PrezziListini({ onApriProdotto, onBack, titoloIndietro = "Magazzino e shop", titolo = "Prezzi e listini" }) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState("");
  const [bloccoScelto, setBloccoScelto] = useState(null); // null = tutti
  const riferimenti = useRef({});

  useEffect(() => {
    (async () => {
      setCaricando(true);
      try {
        const dati = await leggiListino();
        setRighe(dati || []);
        if (!dati || dati.length === 0) setErrore("Nessun prodotto in vendita sullo shop. Se lo shop ha prodotti, la view v_prezzi_listini non è raggiungibile.");
      } catch (e) { setErrore(e?.message || "Errore di lettura"); }
      setCaricando(false);
    })();
  }, []);

  const q = cerca.trim().toLowerCase();
  const visibili = useMemo(
    () => righe.filter((r) => (!q || (r.nome || "").toLowerCase().includes(q)) && (bloccoScelto == null || r.blocco_ordine === bloccoScelto)),
    [righe, q, bloccoScelto]);

  // i reparti che hanno davvero qualcosa dentro, nell'ordine del menu
  const gruppi = useMemo(() => {
    const per = new Map();
    for (const r of visibili) {
      if (!per.has(r.blocco_ordine)) per.set(r.blocco_ordine, []);
      per.get(r.blocco_ordine).push(r);
    }
    return BLOCCHI.filter((b) => per.has(b.n)).map((b) => ({ ...b, prodotti: per.get(b.n) }));
  }, [visibili]);

  // le pastiglie in alto: tutti i reparti che esistono, anche quando la
  // ricerca li ha svuotati — spariscono solo se il reparto è vuoto di suo
  const reparti = useMemo(() => {
    const presenti = new Set(righe.map((r) => r.blocco_ordine));
    return BLOCCHI.filter((b) => presenti.has(b.n));
  }, [righe]);

  function vaiAl(n) {
    setBloccoScelto(null);
    setTimeout(() => riferimenti.current[n]?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }
  function esporta() {
    scaricaCsv(csvListino(visibili), `listino-rivenditori-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const th = { ...fontBody, fontSize: 9.5, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, padding: "9px 6px", textAlign: "center", lineHeight: 1.2, whiteSpace: "pre-line" };
  const td = { ...fontBody, fontSize: 13, color: NAVY, padding: "9px 6px", borderTop: `1px solid ${CREAM_BORDER}`, textAlign: "center", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "16px 12px 60px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <TastoLivelloPrecedente titolo={titoloIndietro} onClick={onBack} />
        <h1 style={{ ...stileTitoloPagina, marginTop: 8, marginBottom: 2 }}>{titolo}</h1>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 14 }}>Gestione prezzi vendita e rivenditori</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca prodotto…"
            style={{ ...inputStyle, flex: "1 1 220px", minWidth: 160, fontSize: 14 }} />
          <Button variant="ghost" onClick={esporta} disabled={visibili.length === 0} style={{ fontSize: 13, padding: "8px 14px" }}>Esporta CSV</Button>
        </div>

        {/* L'indice dei reparti: i nomi in chiaro, uno sotto l'altro, col
            numero di prodotti. Cliccato porta al blocco; ricliccato lascia
            solo quello. Niente tendina: un elenco si legge tutto insieme,
            una tendina nasconde quello che c'e' finche' non la apri. */}
        {reparti.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: "6px 4px", marginBottom: 16 }}>
            {reparti.map((b, i) => {
              const Ico = iconaDelBlocco(b.n);
              const attivo = bloccoScelto === b.n;
              const quanti = righe.filter((r) => r.blocco_ordine === b.n).length;
              return (
                <button key={b.n} onClick={() => (attivo ? setBloccoScelto(null) : (setBloccoScelto(null), vaiAl(b.n)))}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
                    background: attivo ? "#F6EFE2" : "transparent", border: "none",
                    borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`, padding: "11px 12px" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: "#F6EFE2", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico s={18} c={GOLD} />
                  </span>
                  <span style={{ ...fontDisplay, fontSize: 15.5, fontWeight: 800, color: NAVY, letterSpacing: 0.5, flex: 1, minWidth: 0 }}>{b.nome}</span>
                  <span style={{ ...fontBody, fontSize: 12.5, color: MUTED, whiteSpace: "nowrap" }}>{quanti}</span>
                </button>
              );
            })}
          </div>
        )}

        {errore && <div style={{ ...fontBody, fontSize: 13, color: ROSSO, background: "#FBEBE9", border: "1px solid #F0C8C2", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>{errore}</div>}
        {caricando && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Sto leggendo il listino…</div>}
        {!caricando && gruppi.length === 0 && !errore && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Nessun prodotto corrisponde alla ricerca.</div>}

        {gruppi.map((b) => {
          const Ico = iconaDelBlocco(b.n);
          return (
            <div key={b.n} ref={(el) => { riferimenti.current[b.n] = el; }}
              style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, marginBottom: 16, overflow: "hidden", scrollMarginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                <span style={{ width: 44, height: 44, borderRadius: 14, background: "#F6EFE2", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico s={23} c={GOLD} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...fontDisplay, fontSize: 19, fontWeight: 800, color: NAVY, letterSpacing: 0.4, lineHeight: 1.1 }}>{b.nome}</div>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>{b.descrizione}</div>
                </div>
                <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, whiteSpace: "nowrap" }}>{b.prodotti.length} prodotti</div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: "#FAF6EE" }}>
                      <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Prodotto</th>
                      <th style={th}>{"pubblico\nlordo"}</th>
                      <th style={th}>{"pubblico\nnetto"}</th>
                      <th style={th}>{"sconto\nmax"}</th>
                      <th style={{ ...th, paddingRight: 16 }}>{"prezzo\nrivenditore"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.prodotti.map((r) => {
                      const manca = r.sconto_max_pct == null;
                      return (
                        <tr key={r.id} onClick={() => onApriProdotto && onApriProdotto(r.id)}
                          style={{ cursor: onApriProdotto ? "pointer" : "default", background: manca ? "#FDFAF2" : undefined }}
                          title={manca ? motivoSenzaSconto(r) : `Costo ${euro(r.costo_acquisto)}. Scontando il ${r.sconto_max_pct}% incassi ${euro(r.prezzo_rivenditore)}: pagata la merce e i costi aziendali, a te resta quanto al rivenditore. Il calcolo esatto darebbe ${String(r.sconto_esatto_pct).replace(".", ",")}%, arrotondato per difetto.`}>
                          <td style={{ ...td, textAlign: "left", whiteSpace: "normal", paddingLeft: 16, fontWeight: 600 }}>{r.nome}</td>
                          <td style={td}>{euro(r.pubblico_lordo)}</td>
                          <td style={td}>{euro(r.pubblico_netto)}</td>
                          <td style={td}>
                            {manca ? (
                              <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>costo mancante</span>
                            ) : (
                              <span style={{ ...fontBody, fontSize: 12, fontWeight: 800, color: r.sconto_max_pct === 0 ? ROSSO : "#8A6D1D", background: r.sconto_max_pct === 0 ? "#FBEBE9" : "#F6EFE2", borderRadius: 999, padding: "4px 10px" }}>{r.sconto_max_pct}%</span>
                            )}
                          </td>
                          <td style={{ ...td, fontWeight: 800, paddingRight: 16 }}>{euro(r.prezzo_rivenditore)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <p style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 4 }}>
          Lo <b>sconto massimo</b> è la quota che divide il guadagno a metà fra te e il rivenditore:
          concedendola, pagata la merce e i costi aziendali, a te resta quanto a lui. È arrotondata
          per difetto a passi di cinque — meglio concedere un punto in meno che uno in più. Il
          <b> prezzo rivenditore</b> è il pubblico netto meno quello sconto. Ci sono solo i prodotti
          in vendita sullo shop: fuori chi non ha prezzo, non è pubblicato o è solo interno.
        </p>
      </div>
    </div>
  );
}
