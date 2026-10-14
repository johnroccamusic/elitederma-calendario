// "Consensi modelle, impostazioni": a quali corsi vale ogni consenso, e i
// codici senza corso.
//
// SOLO PROGRAMMATORE, dal 14/10/2026. Prima aveva un tasto in home per
// tutti, e mostrava i codici generici: quelli non sanno a quale corso
// appartengono, e chi li usava in aula si ritrovava i consensi
// nell'archivio e niente nella scheda della classe. E' successo con i
// primi sette, mentre giravano due PMU BASE insieme — Roma e Pescara,
// stesse date — e nessuno dei due poteva piu' rivendicarli.
//
// Il codice da far inquadrare in aula sta nella scheda della classe,
// dentro "Consensi modelle": quello porta con se' l'edizione.
import React, { useEffect, useMemo, useState } from "react";
import { CONSENSI } from "../content/consensi";
import { Codice } from "./ArchivioConsensi.jsx";
import { leggiConsensiCorsi, collegaConsensoACorso, scollegaConsensoDaCorso } from "./dati";
import { NAVY, MUTED, CREAM_BORDER, GOLD, fontBody, fontDisplay } from "../ui/stile.js";

// A quali corsi vale questo consenso: si scelgono da una tendina e si
// aggiungono uno alla volta. Una tendina a scelta multipla sembrava piu'
// corta, ma con trenta corsi diventa una lista da tenere premuta senza
// mai vedere cosa si e' gia' preso.
function CorsiDelConsenso({ modello, corsi, legami, onCambiato, isMobile }) {
  const [scelto, setScelto] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [msg, setMsg] = useState("");

  const miei = useMemo(
    () => legami.filter((l) => l.modelloCodice === modello.codice)
      .map((l) => ({ ...l, corso: corsi.find((c) => c.id === l.corsoId) }))
      .filter((x) => x.corso)
      .sort((a, b) => String(a.corso.nome).localeCompare(String(b.corso.nome))),
    [legami, corsi, modello.codice],
  );
  const giaPresi = new Set(miei.map((x) => x.corsoId));
  const liberi = corsi.filter((c) => !giaPresi.has(c.id))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  async function aggiungi() {
    if (!scelto) return;
    setOccupato(true); setMsg("");
    const errore = await collegaConsensoACorso(modello.codice, scelto);
    setOccupato(false);
    if (errore) { setMsg(`Non aggiunto: ${errore}`); return; }
    setScelto("");
    await onCambiato();
  }
  async function togli(id) {
    setOccupato(true); setMsg("");
    const errore = await scollegaConsensoDaCorso(id);
    setOccupato(false);
    if (errore) { setMsg(`Non tolto: ${errore}`); return; }
    await onCambiato();
  }

  const campo = {
    ...fontBody, fontSize: 14, minHeight: 44, borderRadius: 11,
    border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, padding: "0 10px",
  };

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 12 }}>
      <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Vale per questi corsi
      </div>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>
        Nella scheda di una classe di questi corsi compare il codice di questo consenso.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <select
          value={scelto} onChange={(e) => setScelto(e.target.value)}
          disabled={occupato || liberi.length === 0}
          style={{ ...campo, flex: "1 1 220px", minWidth: 0 }}
        >
          <option value="">{liberi.length === 0 ? "— li hai aggiunti tutti —" : "— scegli un corso —"}</option>
          {liberi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button
          type="button" onClick={aggiungi} disabled={!scelto || occupato}
          style={{
            ...fontBody, fontSize: 13.5, fontWeight: 700, minHeight: 44, borderRadius: 11,
            padding: "0 18px", cursor: !scelto || occupato ? "default" : "pointer",
            background: !scelto || occupato ? "#F1EDE4" : NAVY,
            color: !scelto || occupato ? MUTED : "#fff",
            border: `1px solid ${!scelto || occupato ? CREAM_BORDER : NAVY}`,
          }}
        >
          Aggiungi
        </button>
      </div>

      {miei.length === 0 ? (
        <div style={{ ...fontBody, fontSize: 12.5, color: "#8A2D2D", background: "#FBEDEC", border: "1px solid #F0D3D0", borderRadius: 10, padding: "9px 11px", marginTop: 10, lineHeight: 1.5 }}>
          Nessun corso: le classi non mostrano il codice di questo consenso, e le modelle non possono firmarlo dalla scheda.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
          {miei.map((x) => (
            <span key={x.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#FAF8F3", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "6px 7px 6px 12px" }}>
              <span style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY }}>{x.corso.nome}</span>
              <button
                type="button" onClick={() => togli(x.id)} disabled={occupato}
                title={`Togli ${x.corso.nome}`}
                style={{ ...fontBody, width: 26, height: 26, borderRadius: 999, border: "none", background: "#EFE7D8", color: NAVY, fontSize: 15, lineHeight: 1, cursor: occupato ? "default" : "pointer", flexShrink: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {msg && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

export default function QrConsensi({ isMobile, onBack, TastoIndietro, corsi = [], titolo = "Consensi modelle, impostazioni" }) {
  const [legami, setLegami] = useState([]);
  const carica = React.useCallback(async () => { setLegami(await leggiConsensiCorsi()); }, []);
  useEffect(() => { carica(); }, [carica]);

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          {TastoIndietro ? <TastoIndietro titolo="Home" onClick={onBack} /> : null}
          <div style={{ ...fontDisplay, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: isMobile ? 13 : 14, color: MUTED, marginBottom: 14, lineHeight: 1.5, maxWidth: "60ch" }}>
          Per ogni consenso: a quali corsi vale, e il codice generico. Il consenso firmato finisce nell’archivio, dentro Gestione modelle.
        </div>

        <div style={{ ...fontBody, fontSize: isMobile ? 12.5 : 13.5, color: "#8A2D2D", background: "#FBEDEC", border: "1px solid #F0D3D0", borderRadius: 12, padding: "12px 14px", marginBottom: 20, lineHeight: 1.55, maxWidth: "60ch" }}>
          <b>In aula non si usano i codici di questa pagina.</b> Non sanno a quale corso appartengono: il consenso finisce nell’archivio e la master non lo trova nella sua classe.
          <div style={{ marginTop: 6 }}>
            Il codice giusto sta nella scheda della classe, in <b>Consensi modelle → Mostra il codice da far inquadrare</b>. È lo stesso modulo, ma porta con sé il corso.
          </div>
          <div style={{ marginTop: 6 }}>Questi restano buoni per un consenso fuori da un corso.</div>
        </div>

        {CONSENSI.length === 0 ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 18, background: "#fff" }}>
            Non c’è ancora nessun consenso.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CONSENSI.map((modello) => (
              <div key={modello.codice} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 18 }}>
                <Codice modello={modello} isMobile={isMobile} nudo />
                <CorsiDelConsenso
                  modello={modello} corsi={corsi} legami={legami}
                  onCambiato={carica} isMobile={isMobile}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 18, lineHeight: 1.5, maxWidth: "60ch" }}>
          Il codice generico si può stampare: resta valido, non scade e non cambia. In aula però conviene quello della classe, o i consensi di quel corso non si vedranno dalla sua scheda.
        </div>
      </div>
    </div>
  );
}
