// REGOLAMENTI (25/10/2026): le decisioni prese, scritte una volta e
// consultabili da chi ha la tessera in Home. Chi amministra le scrive;
// gli altri le leggono. Sono anche l'UNICA fonte da cui l'assistente
// flottante risponde (AssistenteRegole.jsx): una regola che non sta qui
// per l'assistente non esiste, e lo dice.
//
// Nasce vuota per scelta del titolare: la riempie lui, scheda per scheda.
// In fondo, per chi scrive, l'elenco delle domande rimaste senza risposta:
// e' da li' che si capisce quale scheda manca.
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import TastoDettatura from "./Dettatura.jsx";

export const DESTINATARI = [
  { chiave: "tutti", etichetta: "Tutti" },
  { chiave: "venditori", etichetta: "Venditori" },
  { chiave: "master", etichetta: "Master" },
  { chiave: "assistenti", etichetta: "Assistenti" },
  { chiave: "amministrazione", etichetta: "Amministrazione" },
];

const VUOTA = { titolo: "", argomento: "", testo: "", visibile_a: ["tutti"], decisa_il: "", attivo: true };

function dataIt(d) {
  if (!d) return "";
  const [a, m, g] = String(d).slice(0, 10).split("-");
  return `${g}/${m}/${a}`;
}

function Testo({ testo }) {
  return (
    <div style={{ ...fontBody, fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
      {String(testo || "").split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>)}
    </div>
  );
}

function FormScheda({ iniziale, onSalva, onAnnulla, salvando }) {
  const [s, setS] = useState({ ...VUOTA, ...iniziale, decisa_il: iniziale?.decisa_il || "", argomento: iniziale?.argomento || "" });
  const toggle = (k) => setS((x) => {
    if (k === "tutti") return { ...x, visibile_a: ["tutti"] };
    const senza = x.visibile_a.filter((v) => v !== "tutti");
    const nuovo = senza.includes(k) ? senza.filter((v) => v !== k) : [...senza, k];
    return { ...x, visibile_a: nuovo.length ? nuovo : ["tutti"] };
  });
  const valida = s.titolo.trim().length >= 3 && s.testo.trim().length >= 10;
  return (
    <form data-campo="form-regola" onSubmit={(e) => { e.preventDefault(); if (valida) onSalva(s); }}
      style={{ border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, background: "#FFFDF8", display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,100%), 1fr))", gap: 10 }}>
        <Field label="Titolo"><input data-campo="titolo" value={s.titolo} onChange={(e) => setS({ ...s, titolo: e.target.value })} style={inputStyle} placeholder="Es. Sconti d'aula" /></Field>
        <Field label="Argomento"><input data-campo="argomento" value={s.argomento} onChange={(e) => setS({ ...s, argomento: e.target.value })} style={inputStyle} placeholder="Prezzi, Sconti, Modelle, Kit…" /></Field>
        <Field label="Decisa il"><input type="date" value={s.decisa_il} onChange={(e) => setS({ ...s, decisa_il: e.target.value })} style={inputStyle} /></Field>
      </div>
      <Field label="La regola, come la spiegheresti a chi la deve applicare">
        <textarea data-campo="testo" value={s.testo} onChange={(e) => setS({ ...s, testo: e.target.value })} rows={6}
          style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.5 }} placeholder="Cosa si fa, con quali cifre, e cosa NON si fa. Oppure premi «Detta» e parla." />
        <div style={{ marginTop: 6 }}>
          {/* la frase dettata si accoda a quello che c'e', con uno spazio */}
          <TastoDettatura onTesto={(frase) => setS((x) => ({ ...x, testo: (x.testo ? x.testo.replace(/\s+$/, "") + " " : "") + frase }))} />
        </div>
      </Field>
      <Field label="Vale per">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DESTINATARI.map((d) => {
            const acceso = s.visibile_a.includes(d.chiave);
            return <button key={d.chiave} type="button" data-campo={`vale-${d.chiave}`} onClick={() => toggle(d.chiave)}
              style={{ ...fontBody, fontSize: 12, padding: "5px 11px", borderRadius: 999, cursor: "pointer", border: `1px solid ${acceso ? NAVY : CREAM_BORDER}`, background: acceso ? NAVY : "#fff", color: acceso ? "#fff" : GRAFITE }}>{d.etichetta}</button>;
          })}
        </div>
      </Field>
      <label style={{ ...fontBody, fontSize: 13, color: GRAFITE, display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={!!s.attivo} onChange={(e) => setS({ ...s, attivo: e.target.checked })} /> In vigore (spenta, l'assistente non la usa)
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onAnnulla} style={{ ...fontBody, fontSize: 13, padding: "8px 14px", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: GRAFITE, cursor: "pointer" }}>Annulla</button>
        <Button type="submit" disabled={!valida || salvando}>{salvando ? "Salvo…" : "Salva la regola"}</Button>
      </div>
    </form>
  );
}

export default function PaginaRegolamenti({ puoScrivere = false, chi = "", onBack, titolo = "Regolamenti" }) {
  const [schede, setSchede] = useState([]);
  const [domande, setDomande] = useState([]);
  const [caricato, setCaricato] = useState(false);
  const [inModifica, setInModifica] = useState(null); // "nuova" | id
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [aperte, setAperte] = useState({});
  const [errore, setErrore] = useState("");

  async function carica() {
    const { data, error } = await supabase.from("regolamenti").select("*").order("ordine").order("argomento").order("titolo");
    if (error) setErrore(error.message); else setSchede(data || []);
    if (puoScrivere) {
      const { data: d } = await supabase.from("regolamenti_domande").select("id, ts, chi, ruolo, domanda").eq("senza_risposta", true).order("ts", { ascending: false }).limit(50);
      setDomande(d || []);
    }
    setCaricato(true);
  }
  useEffect(() => { carica(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibili = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return schede.filter((s) => (puoScrivere || s.attivo) && (!f || `${s.titolo} ${s.argomento || ""} ${s.testo}`.toLowerCase().includes(f)));
  }, [schede, filtro, puoScrivere]);
  const argomenti = useMemo(() => {
    const m = new Map();
    visibili.forEach((s) => { const k = s.argomento?.trim() || "Altro"; if (!m.has(k)) m.set(k, []); m.get(k).push(s); });
    return [...m.entries()];
  }, [visibili]);

  async function salva(s) {
    setSalvando(true); setErrore("");
    const riga = { titolo: s.titolo.trim(), argomento: s.argomento.trim() || null, testo: s.testo.trim(), visibile_a: s.visibile_a, decisa_il: s.decisa_il || null, attivo: !!s.attivo, aggiornato_da: chi || null, aggiornato_il: new Date().toISOString() };
    const q = inModifica === "nuova"
      ? supabase.from("regolamenti").insert({ ...riga, creato_da: chi || null }).select("id")
      : supabase.from("regolamenti").update(riga).eq("id", inModifica).select("id");
    const { data, error } = await q;
    setSalvando(false);
    if (error || !data?.length) { setErrore(error?.message || "Non salvata."); return; }
    setInModifica(null); carica();
  }
  async function elimina(s) {
    if (!window.confirm(`Eliminare la regola «${s.titolo}»? Se vuoi solo sospenderla, spegnila.`)) return;
    const { error } = await supabase.from("regolamenti").delete().eq("id", s.id);
    if (error) setErrore(error.message); else carica();
  }
  async function archiviaDomanda(d) {
    await supabase.from("regolamenti_domande").delete().eq("id", d.id);
    setDomande((x) => x.filter((y) => y.id !== d.id));
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        {onBack && <TastoLivelloPrecedente titolo="Home" onClick={onBack} />}
        <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
      </div>
      <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 16 }}>
        Le decisioni prese: prezzi, sconti, procedure, cosa fare quando. L'assistente risponde solo con quello che è scritto qui.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca una regola…" style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }} />
        {puoScrivere && inModifica === null && <Button onClick={() => setInModifica("nuova")}>Aggiungi regola</Button>}
      </div>
      {errore && <div style={{ ...fontBody, fontSize: 13, color: "#B3261E", marginBottom: 10 }}>{errore}</div>}

      {inModifica === "nuova" && <div style={{ marginBottom: 16 }}><FormScheda iniziale={VUOTA} onSalva={salva} onAnnulla={() => setInModifica(null)} salvando={salvando} /></div>}

      {caricato && schede.length === 0 && inModifica === null && (
        <div data-campo="vuoto" style={{ ...fontBody, fontSize: 14, color: GRAFITE, border: `1px dashed ${CREAM_BORDER}`, borderRadius: 14, padding: 24, textAlign: "center" }}>
          Non c'è ancora nessuna regola scritta.{puoScrivere ? " Premi «Aggiungi regola» e scrivi la prima." : " Chiedi a chi amministra."}
        </div>
      )}

      {argomenti.map(([arg, lista]) => (
        <div key={arg} style={{ marginBottom: 18 }}>
          <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{arg}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {lista.map((s) => inModifica === s.id
              ? <FormScheda key={s.id} iniziale={s} onSalva={salva} onAnnulla={() => setInModifica(null)} salvando={salvando} />
              : (
                <div key={s.id} data-campo="regola" style={{ border: `1px solid ${CREAM_BORDER}`, borderLeft: `4px solid ${s.attivo ? GOLD : CREAM_BORDER}`, borderRadius: 12, padding: "10px 14px", background: "#fff", opacity: s.attivo ? 1 : 0.6 }}>
                  <button type="button" onClick={() => setAperte((a) => ({ ...a, [s.id]: !a[s.id] }))}
                    style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{ ...fontDisplay, fontSize: 15.5, fontWeight: 700, color: NAVY }}>{s.titolo}</span>
                    <span style={{ ...fontBody, fontSize: 11.5, color: MUTED, whiteSpace: "nowrap" }}>
                      {!s.attivo ? "spenta · " : ""}{s.decisa_il ? `decisa il ${dataIt(s.decisa_il)}` : ""}{!s.visibile_a?.includes("tutti") ? ` · ${s.visibile_a.map((v) => DESTINATARI.find((d) => d.chiave === v)?.etichetta || v).join(", ")}` : ""}
                    </span>
                  </button>
                  {aperte[s.id] && (
                    <div style={{ marginTop: 8 }}>
                      <Testo testo={s.testo} />
                      {puoScrivere && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <Button variant="ghost" onClick={() => setInModifica(s.id)}>Modifica</Button>
                          <Button variant="ghost" onClick={() => elimina(s)}>Elimina</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {puoScrivere && domande.length > 0 && (
        <div data-campo="senza-risposta" style={{ marginTop: 28, border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 14, background: "#fff" }}>
          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>Domande rimaste senza risposta ({domande.length})</div>
          <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 10 }}>Qualcuno ha chiesto e nessuna regola rispondeva: sono le schede che mancano. Quando l'hai scritta, togli la domanda dall'elenco.</div>
          <div style={{ display: "grid", gap: 6 }}>
            {domande.map((d) => (
              <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid #F1EEE4` }}>
                <div style={{ ...fontBody, fontSize: 13.5, color: NAVY }}>
                  «{d.domanda}» <span style={{ color: MUTED, fontSize: 11.5 }}>· {d.chi || d.ruolo || "qualcuno"}, {dataIt(d.ts)}</span>
                </div>
                <Button variant="ghost" onClick={() => archiviaDomanda(d)}>Fatto</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
