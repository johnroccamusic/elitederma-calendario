// "Punti master": l'elenco delle master con i punti maturati e il tasto
// per scaricarli quando glieli si paga.
//
// COSA VUOL DIRE SCARICARE. Non azzera niente: segna una data. I punti
// "da pagare" sono quelli delle vendite fatte dopo l'ultimo scarico, e
// lo storico resta intero — si puo' sempre tornare indietro e capire
// perche' un numero era quello che era. Un contatore azzerato perde
// proprio quello.
//
// LE STAGIONI vanno da settembre ad agosto dell'anno dopo, perche' e' il
// ciclo dei corsi: serve a fissare gli obiettivi annuali su un periodo
// che somiglia all'anno di lavoro e non all'anno solare. Il totale di
// stagione comprende anche i punti gia' scaricati.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, GOLD, MUTED, CREAM_BORDER, BG, fontBody, fontDisplay } from "../ui/stile.js";

const punti = (n) =>
  Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// la stagione di oggi, con la stessa regola della funzione sul database
export function stagioneCorrente(d = new Date()) {
  const anno = d.getMonth() + 1 >= 9 ? d.getFullYear() : d.getFullYear() - 1;
  return `${anno}/${String((anno + 1) % 100).padStart(2, "0")}`;
}

export default function PaginaPuntiMaster({ onBack, titolo = "Punti master", ruoloUtente, utenteLoggato }) {
  const [righe, setRighe] = useState([]);
  const [stagioni, setStagioni] = useState([]);
  const [scarichi, setScarichi] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [scaricando, setScaricando] = useState(null);
  const [daConfermare, setDaConfermare] = useState(null);
  // Le vendite fatte con un codice che non ha dato punti a nessuno. In
  // condizioni normali questo elenco e' vuoto; una riga vuol dire che
  // qualcosa si e' scollegato fra app, WooCommerce e listino privato.
  // Serve perche' un punto che non arriva non si vede: non compare da
  // nessuna parte, e l'assenza non si nota finche' qualcuno non protesta.
  const [scoperte, setScoperte] = useState([]);
  const stagione = stagioneCorrente();

  const leggi = useCallback(async () => {
    setCaricando(true);
    try {
      const [a, b, c, d] = await Promise.all([
        supabase.from("v_punti_master").select("*").order("punti_totali", { ascending: false }),
        supabase.from("v_punti_master_stagioni").select("*"),
        supabase.from("punti_master_scarichi").select("*").order("scaricato_fino_a", { ascending: false }),
        supabase.from("v_punti_codici_scoperti").select("*").order("data", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      setRighe(a.data || []);
      setStagioni(b.data || []);
      setScarichi(c.data || []);
      // un errore qui non deve impedire di vedere i punti: il controllo e'
      // un di piu', la pagina serve anche senza
      setScoperte(d.error ? [] : (d.data || []));
      setErrore(null);
    } catch (e) { setErrore(e?.message || "Errore di lettura"); }
    setCaricando(false);
  }, []);

  useEffect(() => { leggi(); }, [leggi]);

  const perStagione = useMemo(() => {
    const m = {};
    (stagioni || []).forEach((s) => {
      if (!m[s.master_id]) m[s.master_id] = {};
      m[s.master_id][s.stagione] = s;
    });
    return m;
  }, [stagioni]);

  const ultimoScarico = useMemo(() => {
    const m = {};
    (scarichi || []).forEach((s) => { if (!m[s.master_id]) m[s.master_id] = s; });
    return m;
  }, [scarichi]);

  async function scarica(r) {
    setScaricando(r.master_id);
    setDaConfermare(null);
    try {
      // il taglio e' ADESSO: le vendite registrate da questo istante in poi
      // ripartono da zero. Si scrive anche quanto si e' scaricato, perche'
      // ricalcolarlo a posteriori darebbe un numero diverso il giorno che
      // cambia un costo d'acquisto
      const { error } = await supabase.from("punti_master_scarichi").insert({
        master_id: r.master_id,
        scaricato_fino_a: new Date().toISOString(),
        punti_shop_pos: Number(r.punti_shop_pos || 0),
        punti_cash: Number(r.punti_cash || 0),
        punti_totali: Number(r.punti_totali || 0),
        stagione: stagioneCorrente(),
        creato_da: utenteLoggato?.nome || ruoloUtente || null,
      });
      if (error) throw error;
      await leggi();
    } catch (e) { setErrore(`Non sono riuscito a scaricare i punti di ${r.master}: ${e?.message || e}`); }
    setScaricando(null);
  }

  const th = { ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase",
    letterSpacing: 0.6, padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" };
  const td = { ...fontBody, fontSize: 14, color: NAVY, padding: "10px 10px", textAlign: "right",
    borderTop: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: "32px 28px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff",
          border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "7px 14px", cursor: "pointer", marginBottom: 10 }}>
          ← Amministrazione
        </button>
        <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 2 }}>{titolo}</div>
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 16 }}>
          Punti maturati da ogni master e non ancora pagati. Scaricandoli si segna la data del pagamento:
          le vendite successive ripartono da zero, lo storico resta. Stagione in corso: <b>{stagione}</b> (settembre → agosto).
        </div>

        {errore && (
          <div style={{ ...fontBody, fontSize: 13, color: "#C0392B", background: "#FBEBE9", border: "1px solid #F0C8C2",
            borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>{errore}</div>
        )}
        {caricando && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Sto leggendo i punti…</div>}

        {!caricando && (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr style={{ background: "#FAF6EE" }}>
                    <th style={{ ...th, textAlign: "left" }}>Master</th>
                    <th style={th}>Punti shop/POS</th>
                    <th style={th}>Punti cash</th>
                    <th style={th}>Da pagare</th>
                    <th style={th}>Stagione {stagione}</th>
                    <th style={th}>Ultimo scarico</th>
                    <th style={{ ...th, textAlign: "center" }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => {
                    const st = perStagione[r.master_id]?.[stagione];
                    const ult = ultimoScarico[r.master_id];
                    const haPunti = Number(r.punti_totali || 0) > 0;
                    return (
                      <tr key={r.master_id}>
                        <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{r.master}</td>
                        <td style={{ ...td, color: NAVY, fontWeight: 700 }}>{punti(r.punti_shop_pos)}</td>
                        <td style={{ ...td, color: "#8A6D1D", fontWeight: 700 }}>{punti(r.punti_cash)}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{punti(r.punti_totali)}</td>
                        <td style={{ ...td, color: MUTED }}>{st ? punti(st.punti_totali) : "—"}</td>
                        <td style={{ ...td, color: MUTED, fontSize: 12 }}>
                          {ult ? `${new Date(ult.scaricato_fino_a).toLocaleDateString("it-IT")} · ${punti(ult.punti_totali)}` : "mai"}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {daConfermare === r.master_id ? (
                            <span style={{ display: "inline-flex", gap: 6 }}>
                              <button onClick={() => scarica(r)} disabled={scaricando === r.master_id}
                                style={{ ...fontBody, fontSize: 12, fontWeight: 800, color: "#fff", background: "#C0392B",
                                  border: "none", borderRadius: 20, padding: "7px 14px", cursor: "pointer" }}>
                                {scaricando === r.master_id ? "Scarico…" : "Confermo"}
                              </button>
                              <button onClick={() => setDaConfermare(null)}
                                style={{ ...fontBody, fontSize: 12, color: MUTED, background: "none", border: "none",
                                  textDecoration: "underline", cursor: "pointer" }}>annulla</button>
                            </span>
                          ) : (
                            <button onClick={() => setDaConfermare(r.master_id)} disabled={!haPunti}
                              title={haPunti ? "Segna i punti come pagati: da qui in poi riparte da zero" : "Non ci sono punti da scaricare"}
                              style={{ ...fontBody, fontSize: 12, fontWeight: 800,
                                color: haPunti ? "#fff" : MUTED, background: haPunti ? NAVY : "#F2F2F0",
                                border: "none", borderRadius: 20, padding: "7px 16px",
                                cursor: haPunti ? "pointer" : "default" }}>
                              Scarica
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!caricando && stagioni.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Storico per stagione</div>
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 10 }}>
              Tutti i punti generati, scaricati o no: è la base su cui fissare gli obiettivi annuali.
            </div>
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: "#FAF6EE" }}>
                      <th style={{ ...th, textAlign: "left" }}>Stagione</th>
                      <th style={{ ...th, textAlign: "left" }}>Master</th>
                      <th style={th}>Shop/POS</th>
                      <th style={th}>Cash</th>
                      <th style={th}>Totale</th>
                      <th style={th}>Vendite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...stagioni]
                      .sort((a, b) => String(b.stagione).localeCompare(String(a.stagione)) || Number(b.punti_totali) - Number(a.punti_totali))
                      .map((s) => (
                        <tr key={`${s.master_id}-${s.stagione}`}>
                          <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{s.stagione}</td>
                          <td style={{ ...td, textAlign: "left" }}>{s.master}</td>
                          <td style={{ ...td, color: NAVY }}>{punti(s.punti_shop_pos)}</td>
                          <td style={{ ...td, color: "#8A6D1D" }}>{punti(s.punti_cash)}</td>
                          <td style={{ ...td, fontWeight: 800 }}>{punti(s.punti_totali)}</td>
                          <td style={{ ...td, color: MUTED }}>{s.vendite}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!caricando && (
          <div style={{ marginTop: 22, background: scoperte.length ? "#FBEBE9" : "#fff",
            border: `1px solid ${scoperte.length ? "#F0C8C2" : CREAM_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 800, color: scoperte.length ? "#C0392B" : NAVY }}>
                {scoperte.length ? `Codici senza padrone (${scoperte.length})` : "Codici senza padrone: nessuno"}
              </div>
              <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                {scoperte.length
                  ? "Vendite fatte con un codice che non ha dato punti a nessuno. Vanno guardate: o il codice non e nato nell app, o gli manca la master."
                  : "Ogni vendita con un codice sconto ha trovato la sua master. Se un giorno compare qualcosa qui, e qui che si vede."}
              </div>
            </div>
            {scoperte.length > 0 && (
              <div style={{ overflowX: "auto", background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr style={{ background: "#FAF6EE" }}>
                      <th style={{ ...th, textAlign: "left" }}>Data</th>
                      <th style={{ ...th, textAlign: "left" }}>Ordine</th>
                      <th style={{ ...th, textAlign: "left" }}>Codice</th>
                      <th style={{ ...th, textAlign: "left" }}>Cliente</th>
                      <th style={th}>Totale</th>
                      <th style={{ ...th, textAlign: "left" }}>Perche</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoperte.map((r) => (
                      <tr key={r.vendita_id}>
                        <td style={{ ...td, textAlign: "left" }}>
                          {new Date(r.data).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ ...td, textAlign: "left", color: MUTED }}>{r.numero_ordine || "—"}</td>
                        <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{r.codice}</td>
                        <td style={{ ...td, textAlign: "left" }}>{r.cliente_nome || "—"}</td>
                        <td style={td}>{punti(r.totale)} &euro;</td>
                        <td style={{ ...td, textAlign: "left", color: "#C0392B", whiteSpace: "normal" }}>{r.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
