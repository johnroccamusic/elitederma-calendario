// I RIVENDITORI: chi sono, a che livello stanno, come va il loro ciclo.
// 18/11/2026.
//
// PRIMA DI OGGI UN RIVENDITORE NON ESISTEVA COME DATO: nessuna tabella, e
// nessun ordine marcato come «di un rivenditore». Per questo l'elenco si
// cura a mano e gli acquisti validi si scrivono qui, uno per uno, invece
// di essere indovinati dagli ordini dello shop: fra i 1.888 clienti dello
// shop i rivenditori e i clienti finali sono mescolati, e attribuire a un
// rivenditore un ordine che non è suo vorrebbe dire fargli salire un
// livello che non ha comprato.
//
// I conti — ciclo, verifiche, revisione, rientro — stanno in `regole.js`,
// provati senza database. Qui si disegna.
import React, { useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, inputStyle } from "../ui/stile.js";
import { Button } from "../ui/base.jsx";
import { confermaCancellazione, confermaRimozione } from "../ui/conferma.js";
import {
  livelliAttivi, nominalePct, fineCiclo, giorniAllaFine, volumeDelCiclo,
  tappeTrimestrali, revisioneAnnuale, rientro, scontoMaster, euroIt,
} from "./regole.js";

const euro = (n) => (n == null ? "—" : `€ ${euroIt(n)}`);

export default function SchedaRivenditori({
  livelli, parametri, rivenditori, ordini, verifiche, tettoPct,
  onSalva, onCancella, onAggiungiOrdine, onCancellaOrdine, onAggiungiVerifica, chi,
}) {
  const [apertoId, setApertoId] = useState(null);
  const [inModifica, setInModifica] = useState(null); // null | "nuovo" | id
  const [bozza, setBozza] = useState({});
  const [errore, setErrore] = useState(null);
  const oggi = new Date().toISOString().slice(0, 10);
  const attivi = livelliAttivi(livelli);
  const basePct = parametri.master_base_pct ?? 10;
  const promoPct = parametri.master_promo_pct ?? 20;

  const ordiniDi = useMemo(() => {
    const m = new Map();
    (ordini || []).forEach((o) => {
      if (!m.has(o.rivenditore_id)) m.set(o.rivenditore_id, []);
      m.get(o.rivenditore_id).push(o);
    });
    return m;
  }, [ordini]);
  const verificheDi = useMemo(() => {
    const m = new Map();
    (verifiche || []).forEach((v) => {
      if (!m.has(v.rivenditore_id)) m.set(v.rivenditore_id, []);
      m.get(v.rivenditore_id).push(v);
    });
    return m;
  }, [verifiche]);

  function apriNuovo() {
    setInModifica("nuovo");
    setBozza({ nome: "", livello_id: "", inizio_ciclo: oggi, master: false, ambassador: false, email: "", partita_iva: "", note: "" });
  }
  function apriModifica(r) {
    setInModifica(r.id);
    setBozza({ ...r, livello_id: r.livello_id ?? "", inizio_ciclo: r.inizio_ciclo || "" });
  }
  async function salva() {
    setErrore(null);
    const nome = String(bozza.nome || "").trim();
    if (!nome) { setErrore("Il nome non può restare vuoto: è l'unica cosa che distingue una scheda dall'altra."); return; }
    const campi = {
      nome,
      email: String(bozza.email || "").trim() || null,
      telefono: String(bozza.telefono || "").trim() || null,
      partita_iva: String(bozza.partita_iva || "").trim() || null,
      livello_id: bozza.livello_id === "" ? null : Number(bozza.livello_id),
      inizio_ciclo: bozza.inizio_ciclo || null,
      master: !!bozza.master,
      ambassador: !!bozza.ambassador,
      ambassador_note: String(bozza.ambassador_note || "").trim() || null,
      note: String(bozza.note || "").trim() || null,
    };
    try {
      await onSalva(inModifica === "nuovo" ? null : inModifica, inModifica === "nuovo" ? { ...campi, creato_da: chi || null } : campi);
      setInModifica(null);
    } catch (e) { setErrore(`Non sono riuscito a salvare: ${e?.message || e}`); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...fontBody, fontSize: 13.5, color: MUTED, flex: "1 1 260px", lineHeight: 1.5 }}>
          Il livello cambia alla <b style={{ color: NAVY }}>revisione annuale</b>, non a metà ciclo: le verifiche a
          tre, sei e nove mesi dicono quanto manca e non declassano nessuno.
        </span>
        <Button onClick={apriNuovo} style={{ fontSize: 13, padding: "8px 14px" }}>+ Rivenditore</Button>
      </div>

      {errore && (
        <div style={{ ...fontBody, fontSize: 13, color: "#C0392B", background: "#FDECEC", border: "1px solid #F2C9C4",
          borderRadius: 10, padding: "8px 12px", marginBottom: 10 }} data-errore-rivenditori>{errore}</div>
      )}

      {inModifica != null && (
        <div style={{ background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, marginBottom: 14 }} data-scheda-rivenditore>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: 10 }}>
            <label style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nome o ragione sociale
              <input value={bozza.nome || ""} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></label>
            <label style={{ ...fontBody, fontSize: 12, color: MUTED }}>Livello
              <select value={bozza.livello_id} onChange={(e) => setBozza({ ...bozza, livello_id: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                <option value="">Nessuna qualifica</option>
                {attivi.map((l) => <option key={l.id} value={l.id}>{l.nome} (-{String(nominalePct(l, tettoPct)).replace(".", ",")}%)</option>)}
              </select></label>
            <label style={{ ...fontBody, fontSize: 12, color: MUTED }}>Inizio del ciclo
              <input type="date" value={bozza.inizio_ciclo || ""} onChange={(e) => setBozza({ ...bozza, inizio_ciclo: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></label>
            <label style={{ ...fontBody, fontSize: 12, color: MUTED }}>Email
              <input value={bozza.email || ""} onChange={(e) => setBozza({ ...bozza, email: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></label>
            <label style={{ ...fontBody, fontSize: 12, color: MUTED }}>Partita IVA
              <input value={bozza.partita_iva || ""} onChange={(e) => setBozza({ ...bozza, partita_iva: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></label>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
            <label style={{ ...fontBody, fontSize: 13, color: NAVY, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={!!bozza.master} onChange={(e) => setBozza({ ...bozza, master: e.target.checked })} /> È una master
            </label>
            {/* Ambassador NON è un livello di sconto: è uno status su
                invito che si aggiunge al livello. Metterlo fra i livelli
                avrebbe fatto credere a uno sconto che non c'è. */}
            <label style={{ ...fontBody, fontSize: 13, color: NAVY, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={!!bozza.ambassador} onChange={(e) => setBozza({ ...bozza, ambassador: e.target.checked })} /> Ambassador (nessuno sconto in più)
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button onClick={salva} style={{ fontSize: 13, padding: "8px 14px" }}>Salva</Button>
            <Button variant="ghost" onClick={() => setInModifica(null)} style={{ fontSize: 13, padding: "8px 14px" }}>Annulla</Button>
          </div>
        </div>
      )}

      {(rivenditori || []).length === 0 && (
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, background: "#fff", border: `1px solid ${CREAM_BORDER}`,
          borderRadius: 14, padding: "14px 16px" }} data-nessun-rivenditore>
          Nessun rivenditore in elenco. Si aggiungono a mano: in archivio nessun ordine dice «questo è di un
          rivenditore», quindi l'elenco lo decide chi amministra e non un conto.
        </div>
      )}

      {(rivenditori || []).map((r) => {
        const livello = attivi.find((l) => l.id === r.livello_id) || null;
        const suoiOrdini = ordiniDi.get(r.id) || [];
        const volume = volumeDelCiclo(suoiOrdini, r.inizio_ciclo);
        const tappe = tappeTrimestrali(livello, volume, r.inizio_ciclo, oggi);
        const fine = fineCiclo(r.inizio_ciclo);
        const giorni = giorniAllaFine(r.inizio_ciclo, oggi);
        const revisione = livello ? revisioneAnnuale(volume, livello, livelli) : null;
        const ilRientro = revisione?.perso ? rientro(revisione.perso, volume, livelli) : null;
        const master = r.master ? scontoMaster(verificheDi.get(r.id) || [], basePct, promoPct) : null;
        const aperto = apertoId === r.id;
        return (
          <div key={r.id} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }} data-rivenditore={r.nome}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setApertoId(aperto ? null : r.id)}>
              <span style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: NAVY, flex: "1 1 180px" }}>{r.nome}</span>
              <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 11,
                background: livello ? NAVY : "#F3EFE6", color: livello ? "#fff" : MUTED }}>
                {livello ? `${livello.nome} −${String(nominalePct(livello, tettoPct)).replace(".", ",")}%` : "Nessuna qualifica"}
              </span>
              {r.master && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 10, padding: "2px 8px" }}>Master {master ? `−${String(master.pct).replace(".", ",")}%` : ""}</span>}
              {r.ambassador && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 10, padding: "2px 8px" }}>Ambassador</span>}
              <span style={{ ...fontBody, fontSize: 13.5, color: NAVY, fontWeight: 700 }}>{euro(volume)}</span>
              <span style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>
                {r.inizio_ciclo ? `ciclo ${r.inizio_ciclo.slice(8, 10)}/${r.inizio_ciclo.slice(5, 7)} → ${fine?.slice(8, 10)}/${fine?.slice(5, 7)}${giorni != null ? ` · ${giorni >= 0 ? `${giorni} giorni` : "scaduto"}` : ""}` : "ciclo non ancora aperto"}
              </span>
            </div>

            {livello && tappe.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {tappe.map((t) => (
                  <div key={t.mese} style={{ ...fontBody, fontSize: 11.5, padding: "4px 9px", borderRadius: 10,
                    border: `1px solid ${t.raggiunta ? "#BFE3C8" : t.passata ? "#F2C9C4" : CREAM_BORDER}`,
                    background: t.raggiunta ? "#E9F6EC" : t.passata ? "#FDECEC" : "#FAF6EE",
                    color: t.raggiunta ? "#2E6B3E" : t.passata ? "#C0392B" : MUTED }}
                    title={`Obiettivo al ${t.mese}° mese: ${euro(t.obiettivo)} (${t.quota * 100}% di ${euro(livello.mantenimento_eur)})`}>
                    {t.mese}º mese: {euro(t.obiettivo)} {t.raggiunta ? "✓" : `· mancano ${euro(t.mancano)}`}
                  </div>
                ))}
              </div>
            )}

            {aperto && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 10 }}>
                {revisione && (
                  <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginBottom: 8, lineHeight: 1.5 }} data-revisione>
                    Alla revisione, con {euro(revisione.volume)} spetta <b>{revisione.livello ? revisione.livello.nome : "nessuna qualifica"}</b> ({revisione.esito}).
                    {ilRientro && (
                      <> Per rientrare in {revisione.perso.nome}: mancavano {euro(ilRientro.mancavano)}, minimo {euro(ilRientro.minimo)},
                      massimo {euro(ilRientro.massimo)} → <b>ordine di rientro {euro(ilRientro.ordine)}</b>.</>
                    )}
                  </div>
                )}
                <RigaNuovoOrdine onAggiungi={async (riga) => { await onAggiungiOrdine({ ...riga, rivenditore_id: r.id, creato_da: chi || null }); }} />
                {suoiOrdini.length === 0
                  ? <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 8 }}>Nessun acquisto scritto. Un reso si scrive con l'importo negativo: abbassa il volume e resta leggibile.</div>
                  : (
                    <div style={{ marginTop: 8 }}>
                      {suoiOrdini.map((o) => (
                        <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", ...fontBody, fontSize: 12.5, color: NAVY, padding: "4px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
                          <span style={{ width: 86, color: MUTED }}>{o.data?.slice(8, 10)}/{o.data?.slice(5, 7)}/{o.data?.slice(0, 4)}</span>
                          <span style={{ width: 90, fontWeight: 700, color: Number(o.importo_netto) < 0 ? "#C0392B" : NAVY }}>{euro(o.importo_netto)}</span>
                          <span style={{ flex: 1, color: MUTED }}>{o.nota || o.origine}</span>
                          <button onClick={async () => {
                            if (!confermaRimozione(`l'acquisto del ${o.data} da ${euro(o.importo_netto)}`, "il volume del ciclo si abbassa di quella cifra")) return;
                            await onCancellaOrdine(o.id);
                          }} title="Togli questo acquisto" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 15 }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )}

                {r.master && (
                  <div style={{ marginTop: 12, background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6D1D", lineHeight: 1.5, marginBottom: 8 }}>
                      La verifica dei criteri la fa una persona, a trimestre: tag della pagina e prodotti citati in ogni lavoro,
                      almeno due post al mese, prodotti usati in aula. Vale l'ultima scritta —
                      oggi <b style={{ color: NAVY }}>{master.pct}%</b> ({master.motivo === "nessuna_verifica" ? "nessuna verifica" : master.motivo.replace("_", " ")}).
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["rispettato", "non_rispettato"].map((esito) => (
                        <Button key={esito} variant="ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}
                          onClick={async () => {
                            const al = oggi;
                            const d = new Date(`${al}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 3);
                            await onAggiungiVerifica({ rivenditore_id: r.id, periodo_dal: d.toISOString().slice(0, 10), periodo_al: al, esito, chi: chi || null });
                          }}>
                          Verifica: {esito === "rispettato" ? "rispettato" : "non rispettato"}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button variant="ghost" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => apriModifica(r)}>Modifica la scheda</Button>
                  <Button variant="ghost" style={{ fontSize: 12.5, padding: "6px 12px", color: "#C0392B" }}
                    onClick={async () => {
                      if (!confermaCancellazione(`il rivenditore «${r.nome}»`, "spariscono anche i suoi acquisti e le sue verifiche")) return;
                      await onCancella(r.id);
                    }}>🗑 Cancella</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RigaNuovoOrdine({ onAggiungi }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(oggi);
  const [importo, setImporto] = useState("");
  const [nota, setNota] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} data-nuovo-ordine>
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 140, fontSize: 12.5 }} />
      <input value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="Importo netto"
        style={{ ...inputStyle, width: 120, fontSize: 12.5 }} />
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (facoltativa)"
        style={{ ...inputStyle, flex: "1 1 140px", fontSize: 12.5 }} />
      <Button variant="ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}
        onClick={async () => {
          const n = Number(String(importo).replace(",", "."));
          if (!Number.isFinite(n) || n === 0) return;
          await onAggiungi({ data, importo_netto: n, nota: nota.trim() || null, origine: "manuale" });
          setImporto(""); setNota("");
        }}>+ Acquisto</Button>
    </div>
  );
}
