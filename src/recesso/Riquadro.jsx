// IL RECESSO DENTRO L'APP: il riquadro nella scheda e l'elenco dei
// rimborsi da fare.
//
// Due viste sulla stessa cosa, in un file solo perche' leggono le stesse
// due tabelle e hanno la stessa regola per la scadenza: un rimborso e'
// dovuto entro 14 giorni dal recesso, e quando mancano pochi giorni si
// deve vedere senza cercarlo.
//
// L'ATTO NON SI MODIFICA. Qui dentro si scrive solo su
// `recessi_rimborsi`, che e' il lavoro d'ufficio. Data, ora, motivo e
// indirizzo IP del recesso si leggono e basta: il database li rifiuta
// comunque, ma e' giusto che anche l'interfaccia non offra un campo che
// non esiste.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, GRAFITE, CREAM_BORDER, fontBody, fontDisplay } from "../ui/stile.js";

const GIORNI_RIMBORSO = 14;
const euro = (n) => `€ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
const dataOra = (iso) => (iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" }) : "");
const soloData = (iso) => (iso ? new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }) : "");

// quanti giorni restano per rimborsare. Negativo = il termine e' passato.
export function giorniPerRimborsare(avvenutoIl) {
  if (!avvenutoIl) return null;
  const scade = new Date(avvenutoIl).getTime() + GIORNI_RIMBORSO * 86400000;
  return Math.ceil((scade - Date.now()) / 86400000);
}

function coloreScadenza(giorni) {
  if (giorni === null) return MUTED;
  if (giorni < 0) return "#B3261E";
  if (giorni <= 3) return "#C07C14";
  return MUTED;
}
function frasePerScadenza(giorni) {
  if (giorni === null) return "";
  if (giorni < 0) return `in ritardo di ${Math.abs(giorni)} giorn${Math.abs(giorni) === 1 ? "o" : "i"}`;
  if (giorni === 0) return "scade oggi";
  return `${giorni} giorn${giorni === 1 ? "o" : "i"} al termine`;
}

// ------------------------------------------------- il riquadro in scheda

export function RiquadroRecesso({ iscrittoId, onCambiato }) {
  const [recesso, setRecesso] = useState(null);
  const [rimborso, setRimborso] = useState(null);
  const [bozza, setBozza] = useState(null);
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function ricarica() {
    if (!iscrittoId) return;
    const { data, error } = await supabase
      .from("recessi").select("*, recessi_rimborsi(*)").eq("iscritto_id", iscrittoId).maybeSingle();
    if (error) { setErrore(error.message); return; }
    setRecesso(data || null);
    setRimborso(data?.recessi_rimborsi || null);
  }
  useEffect(() => { ricarica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [iscrittoId]);

  if (!recesso) return null;

  const v = bozza || rimborso || { effettuato_il: "", importo: recesso.importo, metodo: "", note: "" };
  const scrivi = (campo, valore) => setBozza((b) => ({ ...(b || rimborso || { importo: recesso.importo }), [campo]: valore }));
  const giorni = giorniPerRimborsare(recesso.avvenuto_il);
  const fatto = !!rimborso?.effettuato_il;

  async function salva() {
    setSalvando(true); setErrore("");
    const { data: utente } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("recessi_rimborsi").upsert({
      recesso_id: recesso.id,
      effettuato_il: v.effettuato_il || null,
      importo: v.importo === "" || v.importo === null ? null : Number(v.importo),
      metodo: (v.metodo || "").trim() || null,
      note: (v.note || "").trim() || null,
      segnato_da: utente?.user?.email || null,
      aggiornato_il: new Date().toISOString(),
    }, { onConflict: "recesso_id" }).select("recesso_id");
    setSalvando(false);
    if (error) { setErrore("Non riesco a salvare: " + error.message); return; }
    if (!data?.length) { setErrore("Nessuna riga aggiornata: controlla i permessi."); return; }
    setBozza(null);
    await ricarica();
    onCambiato?.();
  }

  const campo = { ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 };
  const voci = Array.isArray(recesso.dettaglio) ? recesso.dettaglio : [];

  return (
    <div style={{ ...areaSchedaIscritto, borderLeft: "4px solid #B3261E", marginBottom: 14 }}>
      <IntestazioneArea>Recesso</IntestazioneArea>
      <div style={{ fontSize: 13, color: GRAFITE, lineHeight: 1.7 }}>
        Esercitato il <b style={{ color: NAVY }}>{dataOra(recesso.avvenuto_il)}</b>
        {recesso.ip ? <span style={{ color: MUTED }}> · da {recesso.ip}</span> : null}
      </div>
      {recesso.motivo && (
        <div style={{ marginTop: 8, fontSize: 13, color: GRAFITE, lineHeight: 1.6 }}>
          <span style={{ color: MUTED }}>Motivo indicato: </span>{recesso.motivo}
        </div>
      )}
      {!recesso.motivo && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: MUTED }}>Nessun motivo indicato — non era tenuta a darlo.</div>
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
        <div style={{ ...fontDisplay, fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Da rimborsare: {euro(recesso.importo)}
        </div>
        {voci.map((x, i) => (
          <div key={i} style={{ fontSize: 12.5, color: MUTED }}>{x.voce}: {euro(x.importo)}</div>
        ))}
        {!fatto && (
          <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: coloreScadenza(giorni) }}>
            {frasePerScadenza(giorni)}
          </div>
        )}
        {fatto && (
          <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#2E7D32" }}>
            Rimborsato il {soloData(rimborso.effettuato_il)}
            {rimborso.importo != null ? ` · ${euro(rimborso.importo)}` : ""}
            {rimborso.segnato_da ? <span style={{ fontWeight: 400, color: MUTED }}> · segnato da {rimborso.segnato_da}</span> : null}
          </div>
        )}
      </div>

      {errore && <div style={{ marginTop: 10, fontSize: 12.5, color: "#B3261E" }}>{errore}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <Field label="Rimborso effettuato il">
            <input type="date" style={campo} value={v.effettuato_il || ""}
              onChange={(e) => scrivi("effettuato_il", e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: "1 1 120px", minWidth: 0 }}>
          <Field label="Importo">
            <input style={campo} inputMode="decimal" value={v.importo ?? ""}
              onChange={(e) => scrivi("importo", e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <Field label="Come">
            <input style={campo} value={v.metodo || ""} placeholder="bonifico"
              onChange={(e) => scrivi("metodo", e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Note">
        <input style={campo} value={v.note || ""} onChange={(e) => scrivi("note", e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button onClick={salva} disabled={!bozza || salvando}>{salvando ? "Salvo…" : "Salva il rimborso"}</Button>
        {bozza && <Button variant="ghost" onClick={() => setBozza(null)}>Annulla</Button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------- l'elenco

export function ElencoRecessi({ onApriIscritto }) {
  const [righe, setRighe] = useState([]);
  const [soloDaRimborsare, setSoloDaRimborsare] = useState(true);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    supabase.from("recessi")
      .select("*, recessi_rimborsi(*), iscritti(nome, cognome, email)")
      .order("avvenuto_il", { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return;
        setCaricando(false);
        if (error) { setErrore(error.message); return; }
        setRighe(data || []);
      });
    return () => { vivo = false; };
  }, []);

  const daRimborsare = (r) => !r.recessi_rimborsi?.effettuato_il;
  const mostrate = soloDaRimborsare ? righe.filter(daRimborsare) : righe;

  if (caricando) return <div style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Un attimo…</div>;

  return (
    <div style={{ ...areaSchedaIscritto }}>
      <IntestazioneArea>Recessi</IntestazioneArea>
      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 10 }}>{errore}</div>}

      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginBottom: 12 }}>
        <input type="checkbox" checked={soloDaRimborsare} onChange={() => setSoloDaRimborsare((v) => !v)}
          style={{ width: 16, height: 16, accentColor: NAVY }} />
        <span style={{ fontSize: 12.5, color: GRAFITE, fontWeight: 700 }}>Solo quelli da rimborsare</span>
        <span style={{ fontSize: 12, color: MUTED }}>({righe.filter(daRimborsare).length} su {righe.length})</span>
      </label>

      {!mostrate.length && (
        <div style={{ fontSize: 12.5, color: MUTED }}>
          {righe.length ? "Nessun rimborso in sospeso." : "Nessun recesso, per ora."}
        </div>
      )}

      {mostrate.map((r) => {
        const giorni = giorniPerRimborsare(r.avvenuto_il);
        const fatto = !!r.recessi_rimborsi?.effettuato_il;
        const chi = [r.iscritti?.nome, r.iscritti?.cognome].filter(Boolean).join(" ");
        return (
          <div key={r.id}
            onClick={() => onApriIscritto?.(r.iscritto_id)}
            style={{
              display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline",
              padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
              cursor: onApriIscritto ? "pointer" : "default",
            }}>
            <span style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, flex: "1 1 160px" }}>{chi || "—"}</span>
            <span style={{ fontSize: 12.5, color: GRAFITE, flex: "1 1 150px" }}>{r.corso_nome}</span>
            <span style={{ fontSize: 12.5, color: MUTED, flex: "0 1 150px" }}>{dataOra(r.avvenuto_il)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, flex: "0 0 90px", textAlign: "right" }}>{euro(r.importo)}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, flex: "0 0 150px", textAlign: "right",
              color: fatto ? "#2E7D32" : coloreScadenza(giorni),
            }}>
              {fatto ? `rimborsato il ${soloData(r.recessi_rimborsi.effettuato_il)}` : frasePerScadenza(giorni)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default RiquadroRecesso;
