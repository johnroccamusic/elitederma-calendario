// «CONTRATTI MASTER»: chi ha firmato, chi deve, e con quale testo.
//
// La tessera in Home per chi amministra. Non è il posto dove si firma —
// quello è la nuvola nella dashboard di ciascuna master — è il posto da
// cui si guarda a che punto siamo, si rilegge una copia firmata, si
// riapre un contratto quando serve rifarlo, e si vede qual è il testo
// che il database sta facendo firmare.
//
// TRE SEZIONI, e la terza è quella che nessuno guarda finché non serve:
//
//   - «I contratti» — una riga per master, con lo stato e la copia;
//   - «Chi resta fuori» — le esclusioni, col loro motivo. È un dato
//     sulla riga della master e non un nome scritto nel codice: si
//     toglie e si rimette da qui, senza pubblicare niente;
//   - «Il testo del contratto» — quali righe il database ha, e se
//     coincidono con quelle del repo. Si confronta l'impronta invece di
//     crederlo: un contratto che si firma non può dipendere dal fatto
//     che qualcuno ricordi di aver caricato il testo.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { confermaRimozione } from "../ui/conferma.js";
import { urlAllegato } from "../file/allegati.js";
import { leggiTuttiIContratti, riapriContratto, cambiaEsclusione, leggiApertura, cambiaApertura } from "./dati.js";
import { CHIAVI, NOMI, DAL_CODICE, PARTENZA, impronta, leggiTesti, caricaDiPartenza } from "./testi.js";

const pannello = { ...areaSchedaIscritto, marginBottom: 16 };
const quando = (iso) => {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
};

const PASTIGLIE = {
  firmato:    { testo: "Firmato",      fondo: "#F2F9F3", bordo: "#CFE6D5", colore: "#1C5E33" },
  da_firmare: { testo: "Da firmare",   fondo: "#FFF8E6", bordo: "#E6CF8C", colore: "#6B4E00" },
  niente:     { testo: "Non iniziato", fondo: "#F3F0E9", bordo: CREAM_BORDER, colore: MUTED },
  escluso:    { testo: "Fuori",        fondo: "#FDECEC", bordo: "#F0C9C9", colore: "#B3261E" },
};

function Pastiglia({ tipo }) {
  const p = PASTIGLIE[tipo] || PASTIGLIE.niente;
  return (
    <span style={{
      ...fontBody, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
      background: p.fondo, border: `1px solid ${p.bordo}`, color: p.colore, whiteSpace: "nowrap",
    }}>{p.testo}</span>
  );
}

const tastino = {
  ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff",
  border: `1px solid ${CREAM_BORDER}`, borderRadius: 9, padding: "8px 12px",
  cursor: "pointer", minHeight: 38,
};

export default function PaginaContrattiMaster({
  onBack, TastoIndietro = null, isMobile = false, titolo = "Contratti master",
  chiOpera = "",
}) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [avviso, setAvviso] = useState("");
  const [testi, setTesti] = useState(null);
  const [impronteDb, setImpronteDb] = useState({});
  const [impronteCodice, setImpronteCodice] = useState({});
  const [mancanti, setMancanti] = useState([]);
  const [caricandoTesti, setCaricandoTesti] = useState(false);
  const [alLavoro, setAlLavoro] = useState("");
  const [motivoNuovo, setMotivoNuovo] = useState({});
  const [porta, setPorta] = useState({ aperta: false, cambiato: null });

  const ricarica = useCallback(async () => {
    setCaricando(true);
    const [elenco, t, apertura] = await Promise.all([leggiTuttiIContratti(), leggiTesti(), leggiApertura()]);
    setCaricando(false);
    setPorta(apertura);
    if (elenco.errore) { setErrore(elenco.errore); return; }
    setRighe(elenco.righe);
    setTesti(t);
    setMancanti(t.mancanti);
    // LE DUE IMPRONTE, calcolate sul posto. Se `crypto.subtle` non c'è
    // tornano vuote e la pagina scrive «non confrontabile»: far credere
    // che due testi coincidano senza averli confrontati sarebbe peggio
    // che non dirlo.
    const db = {}; const cod = {};
    for (const k of CHIAVI) {
      db[k] = await impronta(t.testi[k]);
      cod[k] = await impronta(DAL_CODICE[k]);
    }
    setImpronteDb(db); setImpronteCodice(cod);
  }, []);

  useEffect(() => { ricarica(); }, [ricarica]);

  const conti = useMemo(() => {
    let firmati = 0, daFirmare = 0, esclusi = 0;
    for (const r of righe) {
      if (r.master.contratto_escluso) esclusi += 1;
      else if (r.contratto?.stato === "firmato") firmati += 1;
      else daFirmare += 1;
    }
    return { firmati, daFirmare, esclusi };
  }, [righe]);

  async function apri(percorso) {
    const { url, errore: e } = await urlAllegato("master-documenti", percorso);
    if (e || !url) { setErrore(e || "Non riesco ad aprire la copia."); return; }
    window.open(url, "_blank", "noopener");
  }

  async function riapri(riga) {
    const nome = riga.master.nome;
    // NON È UNA CANCELLAZIONE, ed è il motivo per cui la domanda dice
    // «togliere» e non «cancellare»: la firma non si distrugge, viene
    // archiviata e il contratto torna da firmare. Chiamarla
    // cancellazione farebbe credere a chi legge di distruggere un
    // documento, e nessuno premerebbe più.
    const perche = window.prompt(`Perché si riapre il contratto di ${nome}?\n\nLa firma di adesso resta archiviata e lei dovrà rifirmare il testo di oggi.`);
    if (perche === null) return;
    if (!confermaRimozione(`la firma dal contratto di ${nome}`,
      "La firma, i documenti e il testo di quel giorno restano archiviati; il contratto torna «da firmare» e lei rifirma il testo di adesso.")) return;
    setAlLavoro(riga.master.id);
    const { ok, errore: e } = await riapriContratto(riga.contratto.id, chiOpera || null, perche || null);
    setAlLavoro("");
    if (!ok) { setErrore(e); return; }
    setAvviso(`Il contratto di ${nome} è tornato da firmare. La firma di prima è archiviata.`);
    await ricarica();
  }

  async function rigenera(riga) {
    setAlLavoro(riga.master.id);
    setAvviso(""); setErrore("");
    const { data, error } = await supabase.functions.invoke("contratto-master-firmato", {
      body: { contrattoId: riga.contratto.id, rimanda: true },
    });
    setAlLavoro("");
    if (error || !data?.ok) {
      setErrore(`La copia non è stata composta: ${data?.errore || error?.message || "nessuna risposta"}`);
      return;
    }
    setAvviso(`Copia rifatta e rimandata a ${riga.master.nome}.`);
    await ricarica();
  }

  async function cambia(riga, escluso) {
    const motivo = escluso
      ? (motivoNuovo[riga.master.id] || "").trim()
      : "";
    if (escluso && !motivo) { setErrore("Scrivi perché resta fuori: una riga senza motivo, fra sei mesi, non si spiega."); return; }
    setAlLavoro(riga.master.id);
    const e = await cambiaEsclusione(riga.master.id, escluso, motivo);
    setAlLavoro("");
    if (e) { setErrore(e); return; }
    setAvviso(escluso ? `${riga.master.nome} resta fuori: ${motivo}` : `${riga.master.nome} può firmare il contratto.`);
    await ricarica();
  }

  async function muoviLaPorta(aperta) {
    // APRIRE LA FIRMA NON È UN DETTAGLIO: da quel momento diciotto
    // persone possono sottoscrivere un contratto. Si chiede, e la
    // domanda dice quante sono — «sei sicuro?» da solo non dice cosa si
    // sta aprendo.
    //
    // E CHIUDERE NON SI CHIEDE: chiudere non fa sparire niente e si
    // disfa con lo stesso dito; una domanda a cui si risponde sempre sì
    // insegna a premere a occhi chiusi, e allora anche quella
    // dell'apertura smette di proteggere.
    if (aperta) {
      const quante = righe.filter((r) => !r.master.contratto_escluso).length;
      if (mancanti.length > 0 && !window.confirm(
        `Il testo del contratto non è ancora nel database (${mancanti.length} ${mancanti.length === 1 ? "parte" : "parti"} su ${CHIAVI.length}).\n\n`
        + "Aprendo adesso, un contratto firmato verrebbe congelato col testo che la pagina mostra invece che con quello del database. Conviene prima premere «Carica il testo di partenza».\n\n"
        + "Aprire comunque?")) return;
      if (!window.confirm(`Da adesso ${quante} master potranno firmare il contratto dalla loro dashboard.\n\nConfermi?`)) return;
    }
    setAlLavoro("porta"); setErrore(""); setAvviso("");
    const e = await cambiaApertura(aperta, chiOpera);
    setAlLavoro("");
    if (e) { setErrore(e); return; }
    setAvviso(aperta
      ? "La firma è aperta. Le master la trovano nella loro dashboard: chi ha già l'app aperta la vede dopo aver ricaricato la pagina."
      : "La firma è chiusa. La nuvola non compare più a nessuna, e il database rifiuta comunque qualunque firma.");
    await ricarica();
  }

  async function carica(chiavi) {
    setCaricandoTesti(true); setErrore(""); setAvviso("");
    const e = await caricaDiPartenza(chiavi);
    setCaricandoTesti(false);
    if (e) { setErrore(e); return; }
    setAvviso("Il testo di partenza è nel database: da adesso è quello che il server congela alla firma.");
    await ricarica();
  }

  return (
    <div style={{ ...fontBody, padding: isMobile ? "20px 14px 60px" : "24px 20px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          {TastoIndietro && <TastoIndietro titolo="Home" onClick={onBack} />}
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, lineHeight: 1.55, marginBottom: 18 }}>
          Il contratto di collaborazione lo firma ogni master dalla sua dashboard, dalla nuvola «Firma del
          contratto». Da qui si guarda a che punto siamo, si rilegge una copia e si riapre un contratto
          quando va rifatto.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: isMobile ? 8 : 14, marginBottom: 18 }}>
          {[["Firmati", conti.firmati, "#1C5E33"], ["Da firmare", conti.daFirmare, "#6B4E00"], ["Fuori", conti.esclusi, "#B3261E"]].map(([t, n, col]) => (
            <div key={t} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{t}</div>
              <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: col }}>{n}</div>
            </div>
          ))}
        </div>

        {avviso && (
          <div style={{ ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#1C5E33", background: "#F2F9F3",
                        border: "1px solid #CFE6D5", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>{avviso}</div>
        )}
        {errore && (
          <div style={{ ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#B3261E", background: "#FDECEC",
                        border: "1px solid #F0C9C9", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>{errore}</div>
        )}

        {/* LA PORTA, PRIMA DI TUTTO IL RESTO. È la cosa che decide se
            quella nuvola esiste per qualcuno: leggerla in fondo alla
            pagina vorrebbe dire scoprire solo dopo aver guardato
            diciannove righe che nessuna di quelle persone può firmare. */}
        {/* `borderLeft` dopo `border` e non solo `border`: il pannello
            porta la striscia oro a sinistra (`areaSchedaIscritto`), e
            riscrivere la sola scorciatoia lascia React a litigare fra le
            due — «don't mix shorthand and non-shorthand», e la striscia
            compare o sparisce secondo l'ordine in cui si disegna. */}
        <div data-campo="porta" style={{
          ...pannello,
          background: porta.aperta ? "#F2F9F3" : "#FFF8E6",
          border: `1px solid ${porta.aperta ? "#CFE6D5" : "#E6CF8C"}`,
          borderLeft: `4px solid ${porta.aperta ? "#1C5E33" : "#E6CF8C"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: porta.aperta ? "#1C5E33" : "#6B4E00" }}>
                {porta.aperta ? "La firma è aperta alle master" : "La firma è chiusa alle master"}
              </div>
              <div style={{ ...fontBody, fontSize: 12, color: GRAFITE, lineHeight: 1.55, marginTop: 4 }}>
                {porta.aperta
                  ? "Ognuna trova «Firma del contratto» nella sua dashboard. Chi è fra «Chi resta fuori» non la vede."
                  : "La nuvola «Firma del contratto» non compare a nessuna, e il database rifiuta comunque qualunque firma: non è un tasto nascosto."}
                {porta.cambiato?.il && (
                  <> {porta.aperta ? "Aperta" : "Chiusa"} il {quando(porta.cambiato.il)}
                    {porta.cambiato.da ? ` da ${porta.cambiato.da}` : ""}.</>
                )}
              </div>
            </div>
            <button
              type="button" data-campo="muovi-porta" disabled={alLavoro === "porta"}
              onClick={() => muoviLaPorta(!porta.aperta)}
              style={{
                ...fontBody, fontSize: 13, fontWeight: 700, minHeight: 44, padding: "11px 16px",
                borderRadius: 10, cursor: "pointer", color: "#fff", border: "none",
                background: porta.aperta ? "#B3261E" : NAVY,
              }}
            >
              {alLavoro === "porta" ? "…" : porta.aperta ? "Chiudi la firma" : "Apri la firma alle master"}
            </button>
          </div>
        </div>

        {/* IL TESTO PRIMA DELL'ELENCO, e non è un vezzo: se il database
            non ha le righe, il server non può congelare niente e alla
            firma si ricadrebbe sul testo mandato dal browser. È la prima
            cosa da sistemare, quindi è la prima che si legge. */}
        {mancanti.length > 0 && (
          <div data-campo="testo-mancante" style={{
            ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#6B4E00", background: "#FFF8E6",
            border: "1px solid #E6CF8C", borderRadius: 10, padding: "12px 14px", marginBottom: 16,
          }}>
            <b>Il testo del contratto non è ancora nel database</b> ({mancanti.length} {mancanti.length === 1 ? "parte" : "parti"} su {CHIAVI.length}).
            Finché manca, il server non può congelare alla firma il testo che una master ha letto.
            <button type="button" onClick={() => carica()} disabled={caricandoTesti}
              style={{ ...tastino, display: "block", marginTop: 10 }}>
              {caricandoTesti ? "Sto caricando…" : "Carica il testo di partenza"}
            </button>
          </div>
        )}

        <div style={pannello}>
          <IntestazioneArea>I contratti</IntestazioneArea>
          {caricando && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Un momento…</div>}
          {!caricando && righe.length === 0 && (
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Non c'è nessuna master in anagrafica.</div>
          )}
          {righe.filter((r) => !r.master.contratto_escluso).map((r) => {
            const stato = r.contratto?.stato === "firmato" ? "firmato" : r.contratto ? "da_firmare" : "niente";
            return (
              <div key={r.master.id} data-riga={r.master.id} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
              }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: NAVY }}>{r.master.nome}</div>
                  <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
                    {stato === "firmato"
                      ? `Firmato il ${quando(r.contratto.firmato_il)}${r.contratto.luogo_firma ? ` a ${r.contratto.luogo_firma}` : ""}`
                      : stato === "da_firmare"
                        ? (r.contratto.riaperto_il
                            ? `Riaperto il ${quando(r.contratto.riaperto_il)}${r.contratto.riaperto_perche ? `: ${r.contratto.riaperto_perche}` : ""}`
                            : "Ha cominciato a compilarlo")
                        : "Non l'ha ancora aperto"}
                    {stato === "firmato" && r.contratto.contratto_firmato?.origine === "client" && (
                      <> · <span style={{ color: "#B3261E" }}>testo preso dal browser, non dal database</span></>
                    )}
                    {stato === "firmato" && r.contratto.contratto_firmato?.uguale_a_quello_mostrato === false && (
                      <> · <span style={{ color: "#8A6A1B" }}>il testo era stato corretto mentre firmava</span></>
                    )}
                  </div>
                </div>
                <Pastiglia tipo={stato} />
                {stato === "firmato" && r.contratto.pdf_path && (
                  <button type="button" style={tastino} onClick={() => apri(r.contratto.pdf_path)}>Copia firmata →</button>
                )}
                {stato === "firmato" && (
                  <button type="button" style={tastino} disabled={alLavoro === r.master.id}
                    onClick={() => rigenera(r)}>
                    {alLavoro === r.master.id ? "…" : r.contratto.pdf_path ? "Rimanda la copia" : "Fai la copia"}
                  </button>
                )}
                {stato === "firmato" && (
                  <button type="button" style={{ ...tastino, color: "#B3261E" }} disabled={alLavoro === r.master.id}
                    onClick={() => riapri(r)}>Riapri</button>
                )}
              </div>
            );
          })}
        </div>

        <div style={pannello}>
          <IntestazioneArea>Chi resta fuori</IntestazioneArea>
          <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
            A chi è qui dentro la nuvola «Firma del contratto» non compare, e al suo posto legge il motivo.
            È un dato sulla sua riga, non un nome scritto nel codice: si toglie e si rimette da qui.
          </div>
          {righe.filter((r) => r.master.contratto_escluso).map((r) => (
            <div key={r.master.id} data-riga={r.master.id} style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
            }}>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: NAVY }}>{r.master.nome}</div>
                <div style={{ ...fontBody, fontSize: 11.5, color: GRAFITE, lineHeight: 1.5 }}>
                  {r.master.contratto_escluso_motivo || "Senza motivo scritto."}
                </div>
              </div>
              <Pastiglia tipo="escluso" />
              <button type="button" style={tastino} disabled={alLavoro === r.master.id}
                onClick={() => cambia(r, false)}>Rimettila dentro</button>
            </div>
          ))}
          <details style={{ marginTop: 12 }}>
            <summary style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, cursor: "pointer" }}>
              Togli una master dal contratto
            </summary>
            <div style={{ marginTop: 10 }}>
              {righe.filter((r) => !r.master.contratto_escluso).map((r) => (
                <div key={r.master.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ ...fontBody, fontSize: 12.5, color: NAVY, flex: "0 0 160px", minWidth: 0 }}>{r.master.nome}</div>
                  <input
                    value={motivoNuovo[r.master.id] || ""}
                    onChange={(e) => setMotivoNuovo((m) => ({ ...m, [r.master.id]: e.target.value }))}
                    placeholder="perché resta fuori"
                    style={{ ...inputStyle, flex: "1 1 200px", minWidth: 0, fontSize: 12.5 }}
                  />
                  <button type="button" style={{ ...tastino, color: "#B3261E" }} disabled={alLavoro === r.master.id}
                    onClick={() => cambia(r, true)}>Togli</button>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div style={pannello}>
          <IntestazioneArea>Il testo del contratto</IntestazioneArea>
          <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
            Alla firma il testo lo congela il server leggendolo da qui, non dal browser di chi firma.
            Accanto a ogni parte ci sono due impronte: quella del database e quella del repo. Se
            coincidono, si sta facendo firmare il testo che sta nel codice.
          </div>
          {CHIAVI.map((k) => {
            const p = testi?.provenienza?.[k];
            const nelDb = !!p;
            const uguali = impronteDb[k] && impronteCodice[k] && impronteDb[k] === impronteCodice[k];
            return (
              <div key={k} data-testo={k} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "9px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
              }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY }}>{NOMI[k]}</div>
                  <div style={{ ...fontBody, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                    {!nelDb ? "non è nel database: alla firma si ricadrebbe sul testo del browser"
                      : p.diPartenza ? "testo di partenza, mai corretto"
                      : `corretto${p.da ? ` da ${p.da}` : ""} il ${quando(p.il)}`}
                  </div>
                </div>
                <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, fontFamily: "monospace" }}>
                  {!impronteDb[k] || !impronteCodice[k]
                    ? "non confrontabile"
                    : uguali ? `= ${impronteCodice[k]}` : `db ${impronteDb[k]} · repo ${impronteCodice[k]}`}
                </div>
                {nelDb && impronteDb[k] && !uguali && (
                  <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#6B4E00", background: "#FFF8E6",
                                 border: "1px solid #E6CF8C", borderRadius: 999, padding: "3px 9px" }}>diverso dal repo</span>
                )}
                <button type="button" style={tastino} disabled={caricandoTesti} onClick={() => carica([k])}>
                  {nelDb ? "Rimetti com'era" : "Carica"}
                </button>
              </div>
            );
          })}
          <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginTop: 10 }}>
            «{PARTENZA}» vuol dire che quella parte è quella consegnata il 14 novembre 2026 e non l'ha
            corretta nessuno. Ogni correzione archivia da sé la versione precedente, così una firma vecchia
            risale sempre al foglio che le stava davanti.
          </div>
          <div style={{ ...fontBody, fontSize: 11.5, color: GRAFITE, lineHeight: 1.5, marginTop: 8,
                        borderTop: `1px dashed ${GOLD}`, paddingTop: 8 }}>
            Il testo si corregge ancora a mano nel repo e si ricarica da qui: una schermata per riscriverlo
            dall'app, come quella del modulo di iscrizione, non c'è ancora.
          </div>
        </div>
      </div>
    </div>
  );
}
