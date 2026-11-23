// LA PAGINA DI UN CERTIFICATO (23/11/2026): le voci del modello, il tasto
// «Genera Certificato» e sotto l'elenco di quelli gia' fatti. E' una sola
// per tutti i certificati (42 ore, needling…): cosa cambia lo dice la voce
// di `tipi.js` che riceve.
//
// Il tasto resta spento finche' manca qualcosa, e dice COSA: un
// certificato con una riga vuota non si consegna, e «manca qualcosa»
// senza il nome della voce fa rileggere tutto il modulo.
import React, { useEffect, useState } from "react";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GOLD, fontBody, stileTitoloPagina, inputStyle, campoDataStyle } from "../ui/stile.js";
import { dataItaliana } from "./certificato-42-ore.js";
import { CERTIFICATI } from "./tipi.js";
import { leggiModello, caricaModello, eliminaModello, leggiCertificati, generaECertifica, eliminaCertificato, scaricaCertificato, salvaFile, cercaIscritti, datiDaIscritto } from "./dati.js";
import { confermaCancellazione } from "../ui/conferma.js";

export default function PaginaCertificato({ onBack, chi = "", certificato = CERTIFICATI.pmu_42_ore }) {
  // undefined = sto guardando, null = il modello non c'e' ancora
  const [modello, setModello] = useState(undefined);
  const [dati, setDati] = useState(() => certificato.datiVuoti());
  const [elenco, setElenco] = useState(null);
  const [msg, setMsg] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [caricando, setCaricando] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [trovati, setTrovati] = useState([]);
  const [filtroElenco, setFiltroElenco] = useState("");

  async function rileggiElenco() {
    try { setElenco(await leggiCertificati(certificato.tipo)); } catch (e) { setElenco([]); setMsg({ errore: true, testo: "Non riesco a leggere i certificati fatti: " + e.message }); }
  }

  useEffect(() => {
    leggiModello(certificato.modello).then(setModello).catch(() => setModello(null));
    rileggiElenco();
  }, []);

  // la ricerca parte da sola dopo una pausa nella battitura: una
  // richiesta per lettera sarebbe una coda di risposte fuori ordine
  useEffect(() => {
    if (String(ricerca).trim().length < 2) { setTrovati([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      cercaIscritti(ricerca).then((r) => { if (vivo) setTrovati(r); }).catch(() => { if (vivo) setTrovati([]); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [ricerca]);

  const mancano = certificato.mancanti(dati);
  const cambia = (chiave, valore) => setDati((d) => ({ ...d, [chiave]: valore }));

  async function genera() {
    if (mancano.length > 0 || !modello) return;
    setGenerando(true); setMsg(null);
    try {
      const { bytes, nomeFile } = await generaECertifica(certificato, modello, dati, chi);
      salvaFile(bytes, nomeFile);
      setMsg({ testo: `Certificato di ${dati.nome} ${dati.cognome} generato e archiviato. Lo trovi qui sotto.` });
      setDati(certificato.datiVuoti());
      setRicerca("");
      await rileggiElenco();
    } catch (e) {
      setMsg({ errore: true, testo: e.message });
    } finally {
      setGenerando(false);
    }
  }

  // SOSTITUIRE IL MODELLO (23/11/2026): il file nuovo prende il posto di
  // quello di prima, che non si recupera. Si chiede, e si dice che i
  // certificati gia' fatti restano come sono.
  async function sostituisciIlModello(file) {
    if (!file) return;
    if (!confermaCancellazione(`il modello attuale del ${certificato.titolo.toLowerCase()}`, `Al suo posto va «${file.name}». I certificati già generati restano come sono; da adesso i nuovi escono dal file nuovo.`)) return;
    await caricaIlModello(file, "Modello sostituito: da adesso i certificati si generano dal file nuovo.");
  }

  async function togliIlModello() {
    if (!confermaCancellazione(`il modello del ${certificato.titolo.toLowerCase()}`, "Finché non ne carichi un altro non si potranno generare certificati di questo tipo. Quelli già generati restano come sono.")) return;
    setCaricando(true); setMsg(null);
    try {
      await eliminaModello(certificato.modello);
      setModello(null);
      setMsg({ testo: "Modello tolto. Carica il nuovo PDF qui sopra." });
    } catch (e) {
      setMsg({ errore: true, testo: e.message });
    } finally {
      setCaricando(false);
    }
  }

  async function eliminaIlCertificato(riga) {
    const chiDice = `${riga.nome || ""} ${riga.cognome || ""}`.trim() || "questa persona";
    if (!confermaCancellazione(`il certificato di ${chiDice}`, "Il PDF archiviato non sarà più recuperabile. Se serve, lo rigeneri compilando di nuovo le voci.")) return;
    setMsg(null);
    try {
      const { fileRimasto } = await eliminaCertificato(riga);
      setMsg({ testo: fileRimasto ? `Certificato di ${chiDice} tolto dall'elenco (il file in archivio non sono riuscito a cancellarlo, ma non è più raggiungibile).` : `Certificato di ${chiDice} cancellato.` });
    } catch (e) {
      setMsg({ errore: true, testo: e.message });
    }
    await rileggiElenco();
  }

  async function caricaIlModello(file, testoRiuscito = "Modello caricato: da adesso i certificati si generano da questo.") {
    if (!file) return;
    setCaricando(true); setMsg(null);
    try {
      await caricaModello(file, certificato.modello);
      const letto = await leggiModello(certificato.modello);
      setModello(letto);
      setMsg({ testo: letto ? testoRiuscito : "Il modello è stato caricato ma non riesco a rileggerlo: ricarica la pagina." , errore: !letto });
    } catch (e) {
      setMsg({ errore: true, testo: e.message });
    } finally {
      setCaricando(false);
    }
  }

  const testoFiltro = filtroElenco.trim().toLowerCase();
  const elencoVisto = (elenco || []).filter((r) => !testoFiltro || `${r.nome} ${r.cognome}`.toLowerCase().includes(testoFiltro));

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <TastoLivelloPrecedente titolo="Crea certificato" onClick={onBack} />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{certificato.titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
          {certificato.descrizione} Compila le voci e premi «Genera Certificato»: esce il PDF uguale al modello, con le firme, e non si può più modificare.
        </div>

        {modello === null && (
          <div style={{ ...riquadro, borderColor: "#E8B04A", background: "#FFF8EA" }}>
            <div style={{ ...fontBody, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Manca il modello del certificato</div>
            <div style={{ ...fontBody, fontSize: 13, color: NAVY, lineHeight: 1.5, marginBottom: 10 }}>
              Va caricato una volta sola: è il PDF vuoto con le firme («{certificato.nomeModello}»). Resta in un archivio privato, perché un foglio firmato e vuoto non deve poterlo scaricare chiunque.
            </div>
            <label style={{ display: "inline-block", background: NAVY, color: "#fff", borderRadius: 10, padding: "10px 16px", cursor: caricando ? "default" : "pointer", ...fontBody, fontWeight: 700, fontSize: 14, opacity: caricando ? 0.6 : 1 }}>
              {caricando ? "Carico…" : "Carica il modello (PDF)"}
              <input type="file" accept="application/pdf,.pdf" disabled={caricando} style={{ display: "none" }} onChange={(e) => { caricaIlModello(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        )}

        {modello && (
          <div style={{ ...riquadro, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", ...fontBody, fontSize: 13, color: NAVY, lineHeight: 1.5 }}>
              <b>Modello in uso</b>
              <div style={{ color: MUTED, fontSize: 12.5 }}>Per cambiarlo carica il PDF nuovo: prende il posto di questo. I certificati già fatti non cambiano.</div>
            </div>
            <label style={{ display: "inline-block", border: `1px solid ${CREAM_BORDER}`, color: NAVY, background: "#fff", borderRadius: 10, padding: "8px 14px", cursor: caricando ? "default" : "pointer", ...fontBody, fontWeight: 700, fontSize: 13.5, opacity: caricando ? 0.6 : 1 }}>
              {caricando ? "Carico…" : "Sostituisci il modello (PDF)"}
              <input type="file" accept="application/pdf,.pdf" disabled={caricando} data-sostituisci-modello style={{ display: "none" }} onChange={(e) => { sostituisciIlModello(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={togliIlModello} disabled={caricando} aria-label="Togli il modello" title="Togli il modello"
              style={{ ...tastoCestino, opacity: caricando ? 0.6 : 1 }}>
              <IconaCestino />
            </button>
          </div>
        )}

        <div style={riquadro}>
          <div style={{ ...fontBody, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Prendi i dati da un'iscrizione</div>
          <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Facoltativo: scrivi nome o cognome, scegli la persona e le voci si riempiono. Si possono correggere tutte.</div>
          <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca un allievo…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          {trovati.length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {trovati.map((r) => (
                <button key={r.id} onClick={() => { setDati((d) => datiDaIscritto(r, d)); setTrovati([]); setRicerca(`${r.nome || ""} ${r.cognome || ""}`.trim()); }}
                  style={{ textAlign: "left", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", ...fontBody, fontSize: 13.5, color: NAVY }}>
                  <b>{r.nome} {r.cognome}</b>
                  <span style={{ color: MUTED }}>{r.citta_residenza ? ` · ${r.citta_residenza}` : ""}{r.classe?.data_inizio ? ` · corso dal ${dataItaliana(r.classe.data_inizio)}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={riquadro}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {certificato.campi.map((c) => (
              <Field key={c.chiave} label={c.etichetta}>
                <input
                  type={c.tipo === "date" ? "date" : "text"}
                  value={dati[c.chiave] || ""}
                  maxLength={c.massimo || undefined}
                  onChange={(e) => cambia(c.chiave, c.massimo ? e.target.value.toUpperCase() : e.target.value)}
                  style={{ ...(c.tipo === "date" ? campoDataStyle : inputStyle), width: "100%", boxSizing: "border-box" }}
                  aria-label={c.etichetta}
                />
              </Field>
            ))}
          </div>
          {mancano.length > 0 && (
            <div style={{ ...fontBody, fontSize: 12.5, color: "#9A5B00", marginTop: 12 }}>
              Manca ancora: {mancano.join(", ")}.
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={genera} disabled={generando || mancano.length > 0 || !modello} title={!modello ? "Prima va caricato il modello" : undefined}>
              {generando ? "Genero…" : "Genera Certificato"}
            </Button>
            {modello === undefined && <span style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Cerco il modello…</span>}
          </div>
          {msg && (
            <div role="status" style={{ ...fontBody, fontSize: 13, marginTop: 10, color: msg.errore ? "#B3261E" : "#1E6B3A" }}>{msg.testo}</div>
          )}
        </div>

        <div style={{ ...fontBody, fontWeight: 700, color: NAVY, fontSize: 16, margin: "26px 0 10px" }}>
          Certificati generati{elenco ? ` (${elenco.length})` : ""}
        </div>
        {elenco && elenco.length > 6 && (
          <input value={filtroElenco} onChange={(e) => setFiltroElenco(e.target.value)} placeholder="Cerca per nome…" style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        )}
        {elenco === null && <div style={{ ...fontBody, color: MUTED }}>Carico…</div>}
        {elenco && elenco.length === 0 && <div style={{ ...fontBody, color: MUTED }}>Nessun certificato ancora.</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {elencoVisto.map((r) => <RigaCertificato key={r.id} riga={r} onErrore={(t) => setMsg({ errore: true, testo: t })} onElimina={() => eliminaIlCertificato(r)} />)}
        </div>
      </div>
    </div>
  );
}

function RigaCertificato({ riga, onErrore, onElimina }) {
  const [apro, setApro] = useState(false);
  const creato = riga.creato_il ? new Date(riga.creato_il).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ ...fontBody, fontWeight: 700, color: NAVY }}>{riga.nome} {riga.cognome}</div>
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>
          Corso dal {dataItaliana(riga.corso_dal)} al {dataItaliana(riga.corso_al)} · rilasciato a {riga.luogo_rilascio || "—"} il {dataItaliana(riga.data_rilascio)}
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>Generato il {creato}{riga.creato_da ? ` da ${riga.creato_da}` : ""}</div>
      </div>
      <Button variant="ghost" style={{ border: `1px solid ${CREAM_BORDER}` }} disabled={apro} onClick={async () => {
        setApro(true);
        try { await scaricaCertificato(riga); } catch (e) { onErrore(e.message); } finally { setApro(false); }
      }}>{apro ? "Apro…" : "Scarica"}</Button>
      <button type="button" onClick={onElimina} data-cestino={riga.id} aria-label={`Cancella il certificato di ${riga.nome || ""} ${riga.cognome || ""}`.trim()} title="Cancella il certificato" style={tastoCestino}>
        <IconaCestino />
      </button>
    </div>
  );
}

function IconaCestino({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

const tastoCestino = { width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #F1C9C5", color: "#B3261E", borderRadius: 10, cursor: "pointer", flex: "0 0 auto" };

const riquadro = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 };
