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

// Le stesse percentuali della dashboard della master, lette dalla
// stessa impostazione: se qui dicessero un'altra cosa, la master e chi
// la paga leggerebbero due cifre diverse per lo stesso lavoro.
const PERCENTUALI_DEFAULT = { posShop: 15, cash: 20, eventoPosShop: 8, eventoCash: 10 };
const CHIAVE_PERCENTUALI = "puntiMaster_percentualiEuro";
const euro = (n) =>
  `${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// la stagione di oggi, con la stessa regola della funzione sul database
export function stagioneCorrente(d = new Date()) {
  const anno = d.getMonth() + 1 >= 9 ? d.getFullYear() : d.getFullYear() - 1;
  return `${anno}/${String((anno + 1) % 100).padStart(2, "0")}`;
}

// `titoloIndietro` e' il nome di dove si torna: lo dice chi apre la
// pagina. Era scritto qui dentro — "Amministrazione" — e quando la
// pagina ha traslocato in "Coupon e punti" il tasto ha continuato a
// dire, e a fare, la cosa vecchia.
export default function PaginaPuntiMaster({ onBack, titolo = "Punti master", titoloIndietro = "Indietro", ruoloUtente, utenteLoggato }) {
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
  const [perc, setPerc] = useState(PERCENTUALI_DEFAULT);
  const stagione = stagioneCorrente();

  const leggi = useCallback(async () => {
    setCaricando(true);
    try {
      const [a, b, c, d, e] = await Promise.all([
        supabase.from("v_punti_master").select("*").order("punti_totali", { ascending: false }),
        supabase.from("v_punti_master_stagioni").select("*"),
        supabase.from("punti_master_scarichi").select("*").order("scaricato_fino_a", { ascending: false }),
        supabase.from("v_punti_codici_scoperti").select("*").order("data", { ascending: false }),
        supabase.from("impostazioni_layout_tabelle").select("valore").eq("chiave", CHIAVE_PERCENTUALI).maybeSingle(),
      ]);
      setPerc({ ...PERCENTUALI_DEFAULT, ...(e.error ? {} : (e.data?.valore || {})) });
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

  // DUE SCARICHI, NON UNO.
  // "Periodici" segna i punti come pagati: shop/POS, cash, eventi e
  // personali ripartono da zero. "Carriera" azzera il totale di sempre,
  // ed e' un'altra decisione — si fa a inizio percorso o per rimettere
  // in pari un conto sbagliato, non ogni volta che si paga. Finche'
  // erano un tasto solo, pagare una master le cancellava la carriera.
  async function scarica(r, tipo = "periodici") {
    setScaricando(r.master_id);
    setDaConfermare(null);
    try {
      // il taglio e' ADESSO: le vendite registrate da questo istante in poi
      // ripartono da zero. Si scrive anche quanto si e' scaricato, perche'
      // ricalcolarlo a posteriori darebbe un numero diverso il giorno che
      // cambia un costo d'acquisto
      const { error } = await supabase.from("punti_master_scarichi").insert({
        master_id: r.master_id,
        tipo,
        scaricato_fino_a: new Date().toISOString(),
        punti_shop_pos: Number(r.punti_shop_pos || 0),
        punti_cash: Number(r.punti_cash || 0),
        // quanto si e' scaricato DAVVERO: sui periodici il totale da
        // pagare, sulla carriera il totale di sempre
        punti_totali: Number((tipo === "carriera" ? r.punti_carriera : r.punti_totali) || 0),
        stagione: stagioneCorrente(),
        creato_da: utenteLoggato?.nome || ruoloUtente || null,
      });
      if (error) throw error;
      await leggi();
    } catch (e) { setErrore(`Non sono riuscito a scaricare i punti di ${r.master}: ${e?.message || e}`); }
    setScaricando(null);
  }

  const th = { ...fontBody, fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase",
    letterSpacing: 0.3, padding: "8px 7px", textAlign: "right", lineHeight: 1.2 };
  const td = { ...fontBody, fontSize: 13, color: NAVY, padding: "10px 7px", textAlign: "right",
    borderTop: `1px solid ${CREAM_BORDER}`, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: "32px 28px 60px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff",
          border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "7px 14px", cursor: "pointer", marginBottom: 10 }}>
          ← {titoloIndietro}
        </button>
        <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 2 }}>{titolo}</div>
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 16 }}>
          Le stesse caselle che la master vede nella sua dashboard, con quanto ha maturato in euro.
          <b> Scarica punti periodici</b> segna i punti come pagati — shop/POS, cash, eventi e personali ripartono da zero —
          e <b>non tocca la carriera</b>, che è quanto ha mosso da quando c'è.
          <b> Scarica punti carriera</b> azzera quella: si fa a inizio percorso o per rimettere in pari un conto, non per pagare.
          Niente si cancella davvero: ogni scarico è una data, e lo storico resta. Stagione in corso: <b>{stagione}</b> (settembre → agosto).
        </div>

        {errore && (
          <div style={{ ...fontBody, fontSize: 13, color: "#C0392B", background: "#FBEBE9", border: "1px solid #F0C8C2",
            borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>{errore}</div>
        )}
        {caricando && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Sto leggendo i punti…</div>}

        {!caricando && (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              {/* niente minWidth: la tabella sta dentro lo spazio bianco e
                  non si scorre di lato. Le intestazioni sono corte per lo
                  stesso motivo — "Punti" davanti a ognuna delle sette era
                  una parola ripetuta sette volte che rubava larghezza ai
                  numeri, che sono quello che si viene a leggere. */}
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#FAF6EE" }}>
                    <th style={{ ...th, textAlign: "left", width: "16%" }}>Master</th>
                    <th style={{ ...th, width: "8%" }} title="Punti shop/POS">Shop<br />POS</th>
                    <th style={{ ...th, width: "8%" }} title="Punti cash">Cash</th>
                    <th style={{ ...th, width: "8%" }} title="Punti shop/POS eventi">Eventi<br />carta</th>
                    <th style={{ ...th, width: "8%" }} title="Punti cash eventi">Eventi<br />cash</th>
                    <th style={{ ...th, width: "8%" }} title="Punti personali: comprati da lei col suo codice">Perso<br />nali</th>
                    <th style={{ ...th, width: "9%" }} title="Punti carriera: tutto quello che ha mosso">Carriera</th>
                    <th style={{ ...th, width: "10%" }} title="Quanto ha maturato in euro">Provvigioni</th>
                    <th style={{ ...th, width: "9%" }}>Ultimo<br />scarico</th>
                    <th style={{ ...th, textAlign: "center", width: "16%" }}>Scarica</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => {
                    const ult = ultimoScarico[r.master_id];
                    const haPunti = Number(r.punti_totali || 0) > 0;
                    const haCarriera = Number(r.punti_carriera || 0) > 0;
                    // ogni canale alla sua percentuale: i punti non si
                    // sommano prima e si moltiplicano dopo
                    const provvigioni = Math.round((
                      (Number(r.punti_shop_pos || 0) * perc.posShop) / 100
                      + (Number(r.punti_cash || 0) * perc.cash) / 100
                      + (Number(r.punti_evento_pos || 0) * perc.eventoPosShop) / 100
                      + (Number(r.punti_evento_cash || 0) * perc.eventoCash) / 100
                    ) * 100) / 100;
                    const conferma = daConfermare?.id === r.master_id ? daConfermare.tipo : null;
                    const tastoScarica = (tipo, testo, attivo, spiega) => (
                      <button onClick={() => setDaConfermare({ id: r.master_id, tipo })} disabled={!attivo}
                        title={attivo ? spiega : "Non c'è niente da scaricare"}
                        style={{ ...fontBody, fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap", flex: "1 1 0", minWidth: 0,
                          color: attivo ? (tipo === "carriera" ? NAVY : "#fff") : MUTED,
                          background: attivo ? (tipo === "carriera" ? "#fff" : NAVY) : "#F2F2F0",
                          border: tipo === "carriera" ? `1px solid ${attivo ? NAVY : CREAM_BORDER}` : "none",
                          borderRadius: 20, padding: "6px 8px", cursor: attivo ? "pointer" : "default" }}>
                        {testo}
                      </button>
                    );
                    return (
                      <tr key={r.master_id}>
                        <td style={{ ...td, textAlign: "left", fontWeight: 700, whiteSpace: "normal", lineHeight: 1.2 }}>{r.master}</td>
                        <td style={{ ...td, color: NAVY, fontWeight: 700 }}>{punti(r.punti_shop_pos)}</td>
                        <td style={{ ...td, color: "#8A6D1D", fontWeight: 700 }}>{punti(r.punti_cash)}</td>
                        <td style={{ ...td, color: NAVY }}>{punti(r.punti_evento_pos)}</td>
                        <td style={{ ...td, color: "#8A6D1D" }}>{punti(r.punti_evento_cash)}</td>
                        <td style={{ ...td, color: MUTED }} title="Comprati da lei col suo codice: contano nella carriera, non maturano soldi">{punti(r.punti_personali)}</td>
                        <td style={{ ...td, color: GOLD, fontWeight: 800 }}>{punti(r.punti_carriera)}</td>
                        <td style={{ ...td, fontWeight: 800 }} title={`shop/POS ${perc.posShop}% · cash ${perc.cash}% · eventi carta ${perc.eventoPosShop}% · eventi contanti ${perc.eventoCash}%`}>{euro(provvigioni)}</td>
                        <td style={{ ...td, color: MUTED, fontSize: 12 }}>
                          {ult ? `${new Date(ult.scaricato_fino_a).toLocaleDateString("it-IT")} · ${ult.tipo === "carriera" ? "carriera" : "periodici"}` : "mai"}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {conferma ? (
                            <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                              <span style={{ ...fontBody, fontSize: 10.5, color: MUTED, lineHeight: 1.2 }}>
                                {conferma === "carriera" ? `Azzero la carriera (${punti(r.punti_carriera)})?` : `Pago ${euro(provvigioni)}?`}
                              </span>
                              <button onClick={() => scarica(r, conferma)} disabled={scaricando === r.master_id}
                                style={{ ...fontBody, fontSize: 12, fontWeight: 800, color: "#fff", background: "#C0392B",
                                  border: "none", borderRadius: 20, padding: "7px 14px", cursor: "pointer" }}>
                                {scaricando === r.master_id ? "Scarico…" : "Confermo"}
                              </button>
                              <button onClick={() => setDaConfermare(null)}
                                style={{ ...fontBody, fontSize: 12, color: MUTED, background: "none", border: "none",
                                  textDecoration: "underline", cursor: "pointer" }}>annulla</button>
                            </span>
                          ) : (
                            <span style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                              {tastoScarica("periodici", "Periodici", haPunti, "Scarica punti periodici — segna i punti come pagati: shop/POS, cash, eventi e personali ripartono da zero. La carriera non si tocca.")}
                              {tastoScarica("carriera", "Carriera", haCarriera, "Scarica punti carriera — azzera il totale di sempre. Si fa a inizio percorso o per rimettere in pari un conto: non serve per pagare.")}
                            </span>
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
