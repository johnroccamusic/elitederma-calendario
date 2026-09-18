// "Cambi e integrazioni": il quadro delle scorte in aula.
//
// Si compila col pezzo rotto ancora in mano, non a fine corso quando non
// se lo ricorda piu' nessuno. Tre tap: che pezzo prendi, perche', per chi.
//
// Quello che la master NON deve fare qui e' dichiarare le vendite: quelle
// le ha gia' scritte il POS nel momento in cui le ha battute, e compaiono
// in fondo in sola lettura, per completezza.

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { caricaScorte, registraSostituzione, leggiSostituzioni, annullaSostituzione, MOTIVI_PRELIEVO } from "./scorte";

const ETICHETTA_MOTIVO = Object.fromEntries(MOTIVI_PRELIEVO.map((m) => [m.chiave, m.titolo]));

function Sezione({ titolo, sottotitolo, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</div>
      {sottotitolo && <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{sottotitolo}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export default function QuadroSostituzioni({
  corsoData, corso, location, iscritti, prodottiShop, venditeShop, kitDefinizioni, isMobile = false, onBack,
}) {
  const [scorte, setScorte] = useState(null);
  const [dichiarate, setDichiarate] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [scelta, setScelta] = useState(null); // { voce }
  const [motivo, setMotivo] = useState(null);
  const [iscrittoId, setIscrittoId] = useState("");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  const kitById = useMemo(() => Object.fromEntries((kitDefinizioni || []).map((k) => [k.id, k])), [kitDefinizioni]);
  const iscrittiEdizione = useMemo(
    () => (iscritti || []).filter((i) => i.corso_data_id === corsoData?.id),
    [iscritti, corsoData],
  );
  const loc = (location || []).find((l) => l.id === corsoData?.location_id) || null;
  const nomeDi = (v) => (v.prodottoId ? (prodottoById[v.prodottoId]?.nome || "—") : (v.modello || "Dermografo"));
  const nomeIscritto = (id) => {
    const i = iscrittiEdizione.find((x) => x.id === id);
    return i ? `${i.nome || ""} ${i.cognome || ""}`.trim() : null;
  };

  async function ricarica() {
    const s = await caricaScorte(corsoData?.id || null);
    setScorte(s);
    setDichiarate(s ? await leggiSostituzioni(s.spedizioneId) : []);
    setCaricando(false);
  }
  useEffect(() => { ricarica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [corsoData?.id]);

  // le vendite gia' battute su questo corso, prese dai kit: non si
  // dichiarano qui, si mostrano e basta
  const vendutiDaiKit = useMemo(() => {
    const righe = [];
    (venditeShop || [])
      .filter((v) => v.corso_data_id === corsoData?.id && v.provenienza === "kit_riserva" && v.tipo_movimento !== "annullamento")
      .forEach((v) => {
        (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
          righe.push({ nome: r.nome || prodottoById[r.prodotto_id]?.nome || "—", quantita: r.quantita || 0, ordine: v.numero_ordine });
        });
      });
    return righe;
  }, [venditeShop, corsoData, prodottoById]);

  const gruppi = useMemo(() => {
    const perGruppo = {};
    (scorte?.voci || []).forEach((v) => {
      const chiave = v.provenienza.tipo === "kit"
        ? `kit:${v.provenienza.kitRiservaId}`
        : v.tipo === "dermografo" ? "dermografi" : "sfusi";
      const titolo = v.provenienza.tipo === "kit"
        ? `${kitById[v.provenienza.kitId]?.nome || "Kit di riserva"} ${v.etichettaKit}`
        : v.tipo === "dermografo" ? "Dermografi di riserva" : "Materiale extra";
      if (!perGruppo[chiave]) perGruppo[chiave] = { titolo, voci: [] };
      perGruppo[chiave].voci.push(v);
    });
    return Object.values(perGruppo);
  }, [scorte, kitById]);

  function apri(voce) {
    if (voce.residuo <= 0) return;
    setScelta({ voce });
    setMotivo(null); setIscrittoId(""); setNota(""); setMessaggio("");
  }

  async function conferma() {
    if (!scelta || !motivo || !scorte) return;
    setSalvando(true);
    const errore = await registraSostituzione({
      spedizioneId: scorte.spedizioneId,
      voce: scelta.voce,
      motivo,
      iscrittoId: iscrittoId || null,
      prodottoSostituitoId: null,
      nota: nota.trim() || null,
    });
    setSalvando(false);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    setScelta(null);
    await ricarica();
  }

  async function togli(id) {
    if (!window.confirm("Annulli questa dichiarazione? Il pezzo torna disponibile nella scorta.")) return;
    const errore = await annullaSostituzione(id);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricarica();
  }

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Dashboard master" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Cambi e integrazioni</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
          {corso?.nome || "—"} · {loc?.nome || "—"}. Quando prendi un pezzo dalle scorte, segnalo qui: a fine corso l'inventario è già compilato.
        </div>

        {messaggio && (
          <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: "#C0392B", background: "#FDECEC", border: "1px solid #F5C6C6", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
            {messaggio}
          </div>
        )}

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : !scorte ? (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 20, ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
            Per questo corso non risulta partito nessun pacco, quindi non ci sono scorte da cui prendere.
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
            {gruppi.length === 0 ? (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nel pacco non è partita nessuna scorta.</div>
            ) : gruppi.map((g) => (
              <Sezione key={g.titolo} titolo={g.titolo}>
                {g.voci.map((v) => {
                  const finito = v.residuo <= 0;
                  return (
                    <button
                      key={v.chiave} onClick={() => apri(v)} disabled={finito}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
                        textAlign: "left", background: finito ? "#FAF8F3" : "#fff", border: `1px solid ${CREAM_BORDER}`,
                        borderRadius: 12, padding: isMobile ? "12px 12px" : "13px 14px", marginBottom: 6,
                        cursor: finito ? "default" : "pointer", opacity: finito ? 0.5 : 1, minHeight: 48,
                      }}
                    >
                      <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY, minWidth: 0 }}>{nomeDi(v)}</span>
                      <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: finito ? MUTED : "#2E7D32", whiteSpace: "nowrap" }}>
                        {finito ? "finito" : `restano ${v.residuo}`}
                      </span>
                    </button>
                  );
                })}
              </Sezione>
            ))}

            {dichiarate.length > 0 && (
              <Sezione titolo={`Già dichiarati — ${dichiarate.length}`} sottotitolo="Questi pezzi non rientreranno: l'inventario di fine corso li trova già scritti.">
                {dichiarate.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                    <span style={{ ...fontBody, fontSize: 13, color: NAVY, flex: "1 1 180px", minWidth: 0 }}>
                      {prodottoById[s.prodotto_prelevato_id]?.nome || "—"}
                      {s.iscritto_id && <span style={{ color: MUTED }}> · {nomeIscritto(s.iscritto_id) || "allieva"}</span>}
                      {s.nota && <span style={{ display: "block", ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2 }}>{s.nota}</span>}
                    </span>
                    <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: s.difettoso_rientra ? "#C0392B" : "#8A6A1B", background: s.difettoso_rientra ? "#FDECEC" : "#F7EEDE", borderRadius: 8, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                      {ETICHETTA_MOTIVO[s.motivo] || s.motivo}
                    </span>
                    <button onClick={() => togli(s.id)} title="Annulla" style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
                  </div>
                ))}
              </Sezione>
            )}

            {vendutiDaiKit.length > 0 && (
              <Sezione titolo={`Venduti dalle scorte — ${vendutiDaiKit.length}`} sottotitolo="Scritti dal POS al momento della vendita: non c'è niente da dichiarare qui.">
                {vendutiDaiKit.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${CREAM_BORDER}` }}>
                    <span style={{ ...fontBody, fontSize: 13, color: MUTED, minWidth: 0 }}>{r.nome}</span>
                    <span style={{ ...fontBody, fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{r.quantita} pz</span>
                  </div>
                ))}
              </Sezione>
            )}
          </div>
        )}
      </div>

      {scelta && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 1100, overflowY: "auto" }}
          onClick={() => setScelta(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 18, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}
          >
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Perché lo prendi</div>
            <div style={{ ...fontDisplay, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: NAVY, marginBottom: 14 }}>{nomeDi(scelta.voce)}</div>

            {MOTIVI_PRELIEVO.map((m) => (
              <button
                key={m.chiave} onClick={() => setMotivo(m.chiave)}
                style={{
                  display: "block", width: "100%", textAlign: "left", marginBottom: 8, minHeight: 60,
                  ...fontBody, fontSize: isMobile ? 14 : 15, fontWeight: 700, padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                  background: motivo === m.chiave ? NAVY : "#fff", color: motivo === m.chiave ? "#fff" : NAVY,
                  border: `1px solid ${motivo === m.chiave ? NAVY : CREAM_BORDER}`,
                }}
              >
                {m.titolo}
                <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: motivo === m.chiave ? "rgba(255,255,255,0.75)" : MUTED, marginTop: 2 }}>
                  {m.sottotitolo}{m.difettoRientra ? " · il pezzo guasto torna indietro" : " · non torna indietro niente"}
                </span>
              </button>
            ))}

            <div style={{ marginTop: 12 }}>
              <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Per chi</div>
              <select value={iscrittoId} onChange={(e) => setIscrittoId(e.target.value)} style={{ ...inputStyle, height: 44 }}>
                <option value="">— non serve dirlo —</option>
                {iscrittiEdizione.map((i) => (
                  <option key={i.id} value={i.id}>{`${i.nome || ""} ${i.cognome || ""}`.trim()}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Nota</div>
              <input
                value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Facoltativa"
                style={{ ...inputStyle, height: 44 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Button onClick={conferma} disabled={!motivo || salvando} style={{ flex: "1 1 160px" }}>
                {salvando ? "Salvo…" : "Conferma"}
              </Button>
              <Button variant="ghost" onClick={() => setScelta(null)} style={{ flex: "0 0 auto" }}>Annulla</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
