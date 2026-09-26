// Gestione eventi: fiere, congressi, giornate fuori sede.
//
// Due schermate. L'elenco, in ordine cronologico, e la scheda del
// singolo evento — che somiglia a quella di un corso perche' chi la usa
// e' la stessa persona: nome, date e luogo in cima, e sotto le quattro
// cose da organizzare. Team, materiali, trasferimenti, hotel.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, BG, BG_CHIARO, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import {
  STATI_EVENTO, leggiEventi, creaEvento, salvaEvento, eliminaEvento,
  leggiRighe, aggiungiRiga, salvaRiga, eliminaRiga, leggiHotelEvento,
  periodoEvento, quantiGiorni,
} from "./dati.js";
import { supabase } from "../supabase.js";

const euro = (n) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
const oggi = () => new Date().toISOString().slice(0, 10);

const COLORE_STATO = {
  programmato: { testo: "#8A6D1D", sfondo: "#FDF8EC", bordo: "#EBD9AE" },
  concluso: { testo: "#2E7D32", sfondo: "#EAF5EA", bordo: "#C7E3C7" },
  annullato: { testo: "#C0392B", sfondo: "#FBEBE9", bordo: "#F0C8C2" },
};

function Pastiglia({ stato }) {
  const c = COLORE_STATO[stato] || COLORE_STATO.programmato;
  const l = (STATI_EVENTO.find((s) => s.v === stato) || STATI_EVENTO[0]).l;
  return (
    <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: c.testo, background: c.sfondo, border: `1px solid ${c.bordo}`, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>{l}</span>
  );
}

// ---------------------------------------------------------------- l'elenco

function ElencoEventi({ eventi, onApri, onNuovo, caricando }) {
  const [filtro, setFiltro] = useState("prossimi");
  const adesso = oggi();
  const prossimi = eventi.filter((e) => (e.data_fine || e.data_inizio || "9999") >= adesso && e.stato !== "annullato");
  const passati = eventi.filter((e) => (e.data_fine || e.data_inizio || "0000") < adesso && e.stato !== "annullato");
  const annullati = eventi.filter((e) => e.stato === "annullato");
  const lista = filtro === "prossimi" ? prossimi : filtro === "passati" ? passati : annullati;
  // i prossimi dal piu' vicino, i passati dal piu' recente: in tutti e
  // due i casi in cima c'e' quello di cui si sta parlando
  const ordinata = [...lista].sort((a, b) => filtro === "prossimi"
    ? String(a.data_inizio || "").localeCompare(String(b.data_inizio || ""))
    : String(b.data_inizio || "").localeCompare(String(a.data_inizio || "")));

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        {[["prossimi", `In arrivo (${prossimi.length})`], ["passati", `Passati (${passati.length})`], ["annullati", `Annullati (${annullati.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} style={{
            ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "9px 15px", borderRadius: 18, cursor: "pointer", minHeight: 40,
            border: `1px solid ${filtro === v ? NAVY : CREAM_BORDER}`, background: filtro === v ? NAVY : "#fff", color: filtro === v ? "#fff" : NAVY,
          }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <Button onClick={onNuovo}>+ Nuovo evento</Button>
      </div>

      {caricando && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>}
      {!caricando && ordinata.length === 0 && (
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.6, padding: "24px 0" }}>
          {filtro === "prossimi" ? "Nessun evento in programma. Creane uno col tasto qui sopra." : "Niente qui."}
        </div>
      )}

      {ordinata.map((e) => (
        <button
          key={e.id} onClick={() => onApri(e.id)}
          style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", minHeight: 44,
            background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "12px 14px",
            marginBottom: 10, cursor: "pointer",
          }}
        >
          {/* il quadratino della data, come nelle righe della contabilita' */}
          <span style={{ flex: "0 0 58px", textAlign: "center" }}>
            <span style={{ display: "block", ...fontDisplay, fontSize: 19, fontWeight: 700, color: NAVY, lineHeight: 1.05 }}>
              {e.data_inizio ? e.data_inizio.slice(8, 10) : "—"}
            </span>
            <span style={{ display: "block", ...fontBody, fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase" }}>
              {e.data_inizio ? new Date(`${e.data_inizio}T12:00:00`).toLocaleDateString("it-IT", { month: "short" }) : ""}
            </span>
            <span style={{ display: "block", ...fontBody, fontSize: 10, color: MUTED }}>{e.data_inizio ? e.data_inizio.slice(0, 4) : ""}</span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", ...fontDisplay, fontSize: 15.5, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{e.nome}</span>
            <span style={{ display: "block", ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>
              {[periodoEvento(e), [e.nome_luogo, e.citta].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </span>
          </span>
          <Pastiglia stato={e.stato} />
          <span style={{ ...fontBody, fontSize: 18, color: MUTED, flexShrink: 0 }}>›</span>
        </button>
      ))}
    </>
  );
}

// ------------------------------------------------------- il modulo nuovo

function ModuloEvento({ evento, location, onSalvato, onAnnulla }) {
  const [f, setF] = useState(() => ({
    nome: evento?.nome || "",
    data_inizio: evento?.data_inizio || oggi(),
    data_fine: evento?.data_fine || "",
    citta: evento?.citta || "",
    nome_luogo: evento?.nome_luogo || "",
    indirizzo: evento?.indirizzo || "",
    location_id: evento?.location_id || "",
    stato: evento?.stato || "programmato",
    note: evento?.note || "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const cambia = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salva() {
    if (!f.nome.trim()) { setMsg("Serve un nome per l'evento."); return; }
    if (!f.data_inizio) { setMsg("Serve almeno la data di inizio."); return; }
    if (f.data_fine && f.data_fine < f.data_inizio) { setMsg("La data di fine viene prima di quella di inizio."); return; }
    setSalvando(true);
    try {
      const campi = {
        ...f,
        nome: f.nome.trim(),
        data_fine: f.data_fine || f.data_inizio,
        location_id: f.location_id || null,
        citta: f.citta.trim() || null,
        nome_luogo: f.nome_luogo.trim() || null,
        indirizzo: f.indirizzo.trim() || null,
        note: f.note.trim() || null,
      };
      if (evento?.id) { await salvaEvento(evento.id, campi); onSalvato(evento.id); }
      else { const nuovo = await creaEvento(campi); onSalvato(nuovo.id); }
    } catch (e) { setMsg("Errore: " + e.message); }
    setSalvando(false);
  }

  // scegliendo una sede fra quelle che gia' esistono, citta' e indirizzo
  // si compilano da soli: sono gia' scritti li'
  function scegliSede(id) {
    cambia("location_id", id);
    const l = (location || []).find((x) => x.id === id);
    if (!l) return;
    setF((p) => ({
      ...p, location_id: id,
      citta: p.citta || (l.nome ? l.nome.charAt(0) + l.nome.slice(1).toLowerCase() : ""),
      nome_luogo: p.nome_luogo || l.nome_sede || "",
      indirizzo: p.indirizzo || l.indirizzo || "",
    }));
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
      <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
        {evento?.id ? "Modifica evento" : "Nuovo evento"}
      </div>
      <Field label="Nome dell'evento">
        <input style={inputStyle} value={f.nome} onChange={(e) => cambia("nome", e.target.value)} placeholder="es. Cosmoprof Bologna" />
      </Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px" }}><Field label="Dal"><input type="date" style={inputStyle} value={f.data_inizio} onChange={(e) => cambia("data_inizio", e.target.value)} /></Field></div>
        <div style={{ flex: "1 1 150px" }}><Field label="Al (vuoto = un giorno solo)"><input type="date" style={inputStyle} value={f.data_fine} onChange={(e) => cambia("data_fine", e.target.value)} /></Field></div>
      </div>
      <Field label="Sede già in anagrafica (opzionale)">
        <select style={inputStyle} value={f.location_id} onChange={(e) => scegliSede(e.target.value)}>
          <option value="">— nessuna, la scrivo a mano —</option>
          {[...(location || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map((l) => (
            <option key={l.id} value={l.id}>{l.nome_sede ? `${l.nome_sede} · ${l.nome}` : l.nome}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px" }}><Field label="Città"><input style={inputStyle} value={f.citta} onChange={(e) => cambia("citta", e.target.value)} /></Field></div>
        <div style={{ flex: "1 1 150px" }}><Field label="Luogo"><input style={inputStyle} value={f.nome_luogo} onChange={(e) => cambia("nome_luogo", e.target.value)} placeholder="es. Fiera di Bologna, pad. 32" /></Field></div>
      </div>
      <Field label="Indirizzo"><input style={inputStyle} value={f.indirizzo} onChange={(e) => cambia("indirizzo", e.target.value)} /></Field>
      <Field label="Stato">
        <select style={inputStyle} value={f.stato} onChange={(e) => cambia("stato", e.target.value)}>
          {STATI_EVENTO.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </Field>
      <Field label="Note (opzionale)"><input style={inputStyle} value={f.note} onChange={(e) => cambia("note", e.target.value)} /></Field>
      {msg && <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#C0392B", marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={salva} disabled={salvando}>{salvando ? "Salvo…" : evento?.id ? "Salva le modifiche" : "Crea l'evento"}</Button>
        <Button variant="ghost" onClick={onAnnulla}>Annulla</Button>
      </div>
    </div>
  );
}

// --------------------------------------------- i mattoni delle quattro liste

const campoRiga = { ...inputStyle, padding: "8px 10px", fontSize: 13 };

function TastoCestino({ onClick, titolo = "Elimina" }) {
  return (
    <button type="button" onClick={onClick} title={titolo} style={{
      width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer",
      color: "#C0392B", display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14" />
      </svg>
    </button>
  );
}

function Vuoto({ children }) {
  return <div style={{ ...fontBody, fontSize: 13, color: MUTED, lineHeight: 1.6, padding: "16px 0" }}>{children}</div>;
}

// --------------------------------------------------------------- 1. il team

function SchedaTeam({ eventoId, persone }) {
  const [righe, setRighe] = useState(null);
  const [scelta, setScelta] = useState("");
  const [nomeLibero, setNomeLibero] = useState("");

  const ricarica = () => leggiRighe("eventi_team", eventoId).then(setRighe).catch(() => setRighe([]));
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [eventoId]);

  const giaDentro = new Set((righe || []).map((r) => r.persona_id).filter(Boolean));
  const disponibili = (persone || []).filter((p) => !giaDentro.has(p.id));

  async function aggiungiDaAnagrafica() {
    const p = (persone || []).find((x) => x.id === scelta);
    if (!p) return;
    await aggiungiRiga("eventi_team", { evento_id: eventoId, persona_tipo: p.tipo, persona_id: p.id, nome: p.nome, ordine: (righe || []).length });
    setScelta(""); ricarica();
  }
  async function aggiungiAMano() {
    if (!nomeLibero.trim()) return;
    await aggiungiRiga("eventi_team", { evento_id: eventoId, persona_tipo: "libero", nome: nomeLibero.trim(), ordine: (righe || []).length });
    setNomeLibero(""); ricarica();
  }

  if (righe === null) return <Vuoto>Carico…</Vuoto>;
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Field label="Chi viene (dalle anagrafiche)">
            <select style={inputStyle} value={scelta} onChange={(e) => setScelta(e.target.value)}>
              <option value="">— scegli —</option>
              {disponibili.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.tipo}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}><Button onClick={aggiungiDaAnagrafica} disabled={!scelta}>Aggiungi</Button></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          {/* a una fiera viene anche chi in anagrafica non c'e' */}
          <Field label="Oppure scrivi un nome">
            <input style={inputStyle} value={nomeLibero} onChange={(e) => setNomeLibero(e.target.value)} placeholder="es. hostess, fotografo…" />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}><Button variant="ghost" onClick={aggiungiAMano} disabled={!nomeLibero.trim()}>Aggiungi</Button></div>
      </div>

      {righe.length === 0 && <Vuoto>Non c'è ancora nessuno nel team.</Vuoto>}
      {righe.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
          <span style={{ flex: "1 1 160px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY }}>{r.nome}</span>
          <input
            style={{ ...campoRiga, flex: "1 1 140px", minWidth: 0 }} defaultValue={r.ruolo || ""} placeholder="ruolo all'evento"
            onBlur={(e) => { if (e.target.value !== (r.ruolo || "")) salvaRiga("eventi_team", r.id, { ruolo: e.target.value.trim() || null }).then(ricarica); }}
          />
          <TastoCestino onClick={() => eliminaRiga("eventi_team", r.id).then(ricarica)} />
        </div>
      ))}
    </>
  );
}

// ----------------------------------------------------------- 2. i materiali

function SchedaMateriali({ eventoId, prodotti }) {
  const [righe, setRighe] = useState(null);
  const [cerca, setCerca] = useState("");
  const [nomeLibero, setNomeLibero] = useState("");

  const ricarica = () => leggiRighe("eventi_materiali", eventoId).then(setRighe).catch(() => setRighe([]));
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [eventoId]);

  const trovati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (q.length < 2) return [];
    return (prodotti || []).filter((p) => String(p.nome || "").toLowerCase().includes(q)).slice(0, 8);
  }, [cerca, prodotti]);

  async function aggiungiProdotto(p) {
    await aggiungiRiga("eventi_materiali", { evento_id: eventoId, prodotto_id: p.id, nome: p.nome, quantita: 1, ordine: (righe || []).length });
    setCerca(""); ricarica();
  }
  async function aggiungiVoce() {
    if (!nomeLibero.trim()) return;
    await aggiungiRiga("eventi_materiali", { evento_id: eventoId, nome: nomeLibero.trim(), quantita: 1, ordine: (righe || []).length });
    setNomeLibero(""); ricarica();
  }

  if (righe === null) return <Vuoto>Carico…</Vuoto>;
  const preparati = righe.filter((r) => r.preparato).length;

  return (
    <>
      {/* Detto chiaro, perche' la differenza conta: qui si scrive cosa
          portare, non si scarica il magazzino. Le giacenze non si
          toccano da questa pagina. */}
      <div style={{ ...fontBody, fontSize: 12, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 10, padding: "9px 11px", marginBottom: 14, lineHeight: 1.5 }}>
        Questo è l'elenco di cosa preparare. Le giacenze di magazzino non si muovono da qui.
      </div>

      <Field label="Cerca un prodotto a catalogo">
        <input style={inputStyle} value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="scrivi almeno due lettere…" />
      </Field>
      {trovati.length > 0 && (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
          {trovati.map((p) => (
            <button key={p.id} onClick={() => aggiungiProdotto(p)} style={{
              display: "block", width: "100%", textAlign: "left", minHeight: 44, padding: "10px 12px",
              background: "#fff", border: "none", borderBottom: `1px solid ${CREAM_BORDER}`, cursor: "pointer",
              ...fontBody, fontSize: 13, color: NAVY,
            }}>{p.nome}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Field label="Oppure una voce libera">
            <input style={inputStyle} value={nomeLibero} onChange={(e) => setNomeLibero(e.target.value)} placeholder="es. roll-up, brochure, proiettore" />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}><Button variant="ghost" onClick={aggiungiVoce} disabled={!nomeLibero.trim()}>Aggiungi</Button></div>
      </div>

      {righe.length === 0 && <Vuoto>Non c'è ancora niente da portare.</Vuoto>}
      {righe.length > 0 && (
        <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: preparati === righe.length ? "#2E7D32" : MUTED, marginBottom: 8 }}>
          {preparati} di {righe.length} già preparat{righe.length === 1 ? "o" : "i"}
        </div>
      )}
      {righe.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
          <input
            type="checkbox" checked={!!r.preparato} title="Preparato"
            onChange={(e) => salvaRiga("eventi_materiali", r.id, { preparato: e.target.checked }).then(ricarica)}
            style={{ width: 20, height: 20, flexShrink: 0, cursor: "pointer" }}
          />
          <span style={{ flex: "1 1 160px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 700, color: r.preparato ? MUTED : NAVY, textDecoration: r.preparato ? "line-through" : "none" }}>
            {r.nome}
            {r.prodotto_id && <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: GOLD, marginLeft: 8 }}>a catalogo</span>}
          </span>
          <input
            type="number" min="0" step="1" style={{ ...campoRiga, width: 82, flexShrink: 0, textAlign: "right" }} defaultValue={r.quantita ?? 1}
            onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.quantita)) salvaRiga("eventi_materiali", r.id, { quantita: v }).then(ricarica); }}
          />
          <TastoCestino onClick={() => eliminaRiga("eventi_materiali", r.id).then(ricarica)} />
        </div>
      ))}
    </>
  );
}

// ------------------------------------------------------ 3. i trasferimenti

const TIPI_TRASFERIMENTO = [
  { v: "treno", l: "Treno" }, { v: "aereo", l: "Aereo" }, { v: "auto", l: "Auto propria" },
  { v: "noleggio", l: "Noleggio" }, { v: "altro", l: "Altro" },
];

function SchedaTrasferimenti({ eventoId, team }) {
  const [righe, setRighe] = useState(null);
  const [caricando, setCaricando] = useState(null);
  const ricarica = () => leggiRighe("eventi_trasferimenti", eventoId, "partenza").then(setRighe).catch(() => setRighe([]));
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [eventoId]);

  async function nuovo() {
    await aggiungiRiga("eventi_trasferimenti", { evento_id: eventoId, tipo: "treno" });
    ricarica();
  }

  // il biglietto si carica e resta attaccato alla riga di chi viaggia
  async function caricaBiglietto(riga, file) {
    if (!file) return;
    setCaricando(riga.id);
    const percorso = `eventi/${eventoId}/${riga.id}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file, { upsert: true });
    if (!error) await salvaRiga("eventi_trasferimenti", riga.id, { allegato_path: percorso, allegato_nome: file.name });
    setCaricando(null);
    ricarica();
  }
  const urlBiglietto = (p) => supabase.storage.from("allegati-iscritti").getPublicUrl(p).data.publicUrl;

  if (righe === null) return <Vuoto>Carico…</Vuoto>;
  return (
    <>
      <div style={{ marginBottom: 14 }}><Button onClick={nuovo}>+ Aggiungi un viaggio</Button></div>
      {righe.length === 0 && <Vuoto>Nessun viaggio ancora. Treni, aerei, noleggi: si segnano qui, col biglietto attaccato.</Vuoto>}
      {righe.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 12, marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 140px" }}>
              <Field label="Come">
                <select style={campoRiga} defaultValue={r.tipo || "treno"} onChange={(e) => salvaRiga("eventi_trasferimenti", r.id, { tipo: e.target.value }).then(ricarica)}>
                  {TIPI_TRASFERIMENTO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <Field label="Chi">
                <input style={campoRiga} defaultValue={r.chi || ""} list={`team-${eventoId}`} placeholder="nome"
                  onBlur={(e) => { if (e.target.value !== (r.chi || "")) salvaRiga("eventi_trasferimenti", r.id, { chi: e.target.value.trim() || null }).then(ricarica); }} />
              </Field>
            </div>
            <TastoCestino onClick={() => eliminaRiga("eventi_trasferimenti", r.id).then(ricarica)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}><Field label="Da"><input style={campoRiga} defaultValue={r.da_dove || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { da_dove: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "1 1 140px" }}><Field label="A"><input style={campoRiga} defaultValue={r.a_dove || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { a_dove: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 170px" }}><Field label="Partenza"><input type="datetime-local" style={campoRiga} defaultValue={r.partenza ? String(r.partenza).slice(0, 16) : ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { partenza: e.target.value || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "1 1 170px" }}><Field label="Arrivo"><input type="datetime-local" style={campoRiga} defaultValue={r.arrivo ? String(r.arrivo).slice(0, 16) : ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { arrivo: e.target.value || null }).then(ricarica)} /></Field></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}><Field label="Riferimento (biglietto, targa, prenotazione)"><input style={campoRiga} defaultValue={r.riferimento || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { riferimento: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "0 0 110px" }}><Field label="Costo"><input type="number" min="0" step="0.01" style={campoRiga} defaultValue={r.costo ?? ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { costo: e.target.value === "" ? null : Number(e.target.value) }).then(ricarica)} /></Field></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {r.allegato_path ? (
              <a href={urlBiglietto(r.allegato_path)} target="_blank" rel="noreferrer" style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                📎 {r.allegato_nome || "biglietto"}
              </a>
            ) : (
              <label style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, cursor: "pointer", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                {caricando === r.id ? "Carico…" : "📎 Allega il biglietto"}
                <input type="file" style={{ display: "none" }} onChange={(e) => caricaBiglietto(r, e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
      ))}
      <datalist id={`team-${eventoId}`}>
        {(team || []).map((t) => <option key={t.id} value={t.nome} />)}
      </datalist>
    </>
  );
}

// ---------------------------------------------------------------- 4. hotel

const TIPI_STANZA_EVENTO = ["matrimoniale", "doppia", "singola", "tripla"];

function SchedaHotel({ eventoId, evento, team, hotel }) {
  const [gruppi, setGruppi] = useState(null);
  const [stanze, setStanze] = useState([]);

  const ricarica = () => leggiHotelEvento(eventoId).then(({ gruppi: g, stanze: s }) => { setGruppi(g); setStanze(s); }).catch(() => setGruppi([]));
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [eventoId]);

  async function nuovoGruppo() {
    await aggiungiRiga("eventi_hotel_gruppi", {
      evento_id: eventoId, nome: `Gruppo ${(gruppi || []).length + 1}`,
      check_in: evento?.data_inizio || null, check_out: evento?.data_fine || evento?.data_inizio || null,
      ordine: (gruppi || []).length,
    });
    ricarica();
  }
  async function nuovaStanza(gruppo) {
    const quante = stanze.filter((s) => s.gruppo_id === gruppo.id).length;
    const { error } = await supabase.from("eventi_hotel_stanze").insert({
      gruppo_id: gruppo.id, nome: `Stanza ${quante + 1}`, tipo: "matrimoniale", ordine: quante,
    });
    if (!error) ricarica();
  }
  const salvaStanza = (id, campi) => supabase.from("eventi_hotel_stanze").update(campi).eq("id", id).then(ricarica);
  const togliStanza = (id) => supabase.from("eventi_hotel_stanze").delete().eq("id", id).then(ricarica);

  // chi dorme dove: si spunta dalla lista del team, cosi' non si scrive
  // due volte lo stesso nome in due modi diversi
  function cambiaOccupante(stanza, nome, dentro) {
    const attuali = Array.isArray(stanza.occupanti) ? stanza.occupanti : [];
    const nuovi = dentro ? [...attuali.filter((o) => o.nome !== nome), { nome }] : attuali.filter((o) => o.nome !== nome);
    salvaStanza(stanza.id, { occupanti: nuovi });
  }
  const dorme = (stanza, nome) => (Array.isArray(stanza.occupanti) ? stanza.occupanti : []).some((o) => o.nome === nome);

  if (gruppi === null) return <Vuoto>Carico…</Vuoto>;
  return (
    <>
      <div style={{ marginBottom: 14 }}><Button onClick={nuovoGruppo}>+ Aggiungi un gruppo</Button></div>
      {gruppi.length === 0 && <Vuoto>Nessuna sistemazione. Un gruppo è una prenotazione: un hotel e un periodo. Dentro ci vanno le stanze, e in ogni stanza le persone.</Vuoto>}

      {gruppi.map((g) => {
        const sue = stanze.filter((s) => s.gruppo_id === g.id);
        return (
          <div key={g.id} style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 14, marginBottom: 12, background: "#fff" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 130px" }}><Field label="Gruppo"><input style={campoRiga} defaultValue={g.nome || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { nome: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <Field label="Hotel">
                  <input style={campoRiga} defaultValue={g.hotel_nome || ""} list={`hotel-${eventoId}`} placeholder="nome dell'hotel"
                    onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { hotel_nome: e.target.value.trim() || null }).then(ricarica)} />
                </Field>
              </div>
              <TastoCestino titolo="Elimina il gruppo e le sue stanze" onClick={() => { if (window.confirm(`Elimino "${g.nome || "questo gruppo"}" e le sue stanze?`)) supabase.from("eventi_hotel_gruppi").delete().eq("id", g.id).then(ricarica); }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px" }}><Field label="Dal"><input type="date" style={campoRiga} defaultValue={g.check_in || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { check_in: e.target.value || null }).then(ricarica)} /></Field></div>
              <div style={{ flex: "1 1 140px" }}><Field label="Al"><input type="date" style={campoRiga} defaultValue={g.check_out || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { check_out: e.target.value || null }).then(ricarica)} /></Field></div>
              <div style={{ flex: "1 1 140px" }}><Field label="Prenotazione"><input style={campoRiga} defaultValue={g.riferimento || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { riferimento: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
            </div>

            {sue.map((s) => (
              <div key={s.id} style={{ background: BG, borderRadius: 10, padding: 10, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...campoRiga, flex: "1 1 110px", minWidth: 0 }} defaultValue={s.nome || ""} onBlur={(e) => salvaStanza(s.id, { nome: e.target.value.trim() || null })} />
                  <select style={{ ...campoRiga, flex: "0 0 140px" }} defaultValue={s.tipo || "matrimoniale"} onChange={(e) => salvaStanza(s.id, { tipo: e.target.value })}>
                    {TIPI_STANZA_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <TastoCestino titolo="Elimina la stanza" onClick={() => togliStanza(s.id)} />
                </div>
                {/* chi ci dorme: si spuntano i nomi del team */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {(team || []).length === 0 && <span style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>Prima metti qualcuno nel team.</span>}
                  {(team || []).map((p) => {
                    const dentro = dorme(s, p.nome);
                    return (
                      <button key={p.id} type="button" onClick={() => cambiaOccupante(s, p.nome, !dentro)} style={{
                        ...fontBody, fontSize: 11.5, fontWeight: 700, minHeight: 34, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${dentro ? NAVY : CREAM_BORDER}`, background: dentro ? NAVY : "#fff", color: dentro ? "#fff" : NAVY,
                      }}>{p.nome}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><Button variant="ghost" onClick={() => nuovaStanza(g)}>+ Stanza</Button></div>
          </div>
        );
      })}
      <datalist id={`hotel-${eventoId}`}>
        {(hotel || []).map((h) => <option key={h.id} value={h.nome} />)}
      </datalist>
    </>
  );
}

// -------------------------------------------------------- la scheda evento

const SEZIONI = [
  { v: "team", l: "Team" },
  { v: "materiali", l: "Materiali" },
  { v: "trasferimenti", l: "Trasferimenti" },
  { v: "hotel", l: "Hotel" },
];

function SchedaEvento({ evento, location, persone, prodotti, hotel, onIndietro, onCambiato }) {
  const [sezione, setSezione] = useState("team");
  const [inModifica, setInModifica] = useState(false);
  const [team, setTeam] = useState([]);

  // il team serve anche alle altre due schede (chi viaggia, chi dorme
  // dove): si legge qui una volta e si passa giu'
  useEffect(() => {
    leggiRighe("eventi_team", evento.id).then(setTeam).catch(() => setTeam([]));
  }, [evento.id, sezione]);

  if (inModifica) {
    return (
      <ModuloEvento
        evento={evento} location={location}
        onSalvato={() => { setInModifica(false); onCambiato(); }}
        onAnnulla={() => setInModifica(false)}
      />
    );
  }

  return (
    <>
      {/* la testata: nome, quando e dove. Le stesse tre cose della scheda
          di un corso, nello stesso ordine */}
      <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderLeft: `5px solid ${GOLD}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...fontDisplay, fontSize: 21, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{evento.nome}</div>
            <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginTop: 5, lineHeight: 1.5 }}>
              {periodoEvento(evento)} · {quantiGiorni(evento)} giorn{quantiGiorni(evento) === 1 ? "o" : "i"}
            </div>
            {[evento.nome_luogo, evento.indirizzo, evento.citta].filter(Boolean).length > 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 4, lineHeight: 1.5 }}>
                {[evento.nome_luogo, evento.indirizzo, evento.citta].filter(Boolean).join(" · ")}
              </div>
            )}
            {evento.note && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{evento.note}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Pastiglia stato={evento.stato} />
            <Button variant="ghost" onClick={() => setInModifica(true)}>Modifica</Button>
          </div>
        </div>
      </div>

      {/* i quattro tasti: le quattro cose da organizzare */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {SEZIONI.map((s) => (
          <button key={s.v} onClick={() => setSezione(s.v)} style={{
            flex: "1 1 120px", minHeight: 46, borderRadius: 12, cursor: "pointer",
            border: `1px solid ${sezione === s.v ? NAVY : CREAM_BORDER}`,
            background: sezione === s.v ? NAVY : "#fff", color: sezione === s.v ? "#fff" : NAVY,
            ...fontBody, fontSize: 13.5, fontWeight: 700,
          }}>{s.l}</button>
        ))}
      </div>

      <div style={{ background: BG_CHIARO, border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: 16 }}>
        {sezione === "team" && <SchedaTeam eventoId={evento.id} persone={persone} />}
        {sezione === "materiali" && <SchedaMateriali eventoId={evento.id} prodotti={prodotti} />}
        {sezione === "trasferimenti" && <SchedaTrasferimenti eventoId={evento.id} team={team} />}
        {sezione === "hotel" && <SchedaHotel eventoId={evento.id} evento={evento} team={team} hotel={hotel} />}
      </div>
    </>
  );
}

// --------------------------------------------------------------- la pagina

export default function GestioneEventi({ location = [], master = [], assistente = [], venditori = [], prodottiShop = [], hotel = [], onBack, titolo = "Gestione eventi" }) {
  const [eventi, setEventi] = useState(null);
  const [apertoId, setApertoId] = useState(null);
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState("");

  const ricarica = () => leggiEventi().then(setEventi).catch((e) => { setMsg("Non riesco a leggere gli eventi: " + e.message); setEventi([]); });
  useEffect(() => { ricarica(); }, []);

  // chi puo' far parte di un team: tutte le anagrafiche di persone che
  // l'app gia' conosce, in un elenco solo
  const persone = useMemo(() => [
    ...(master || []).map((m) => ({ id: m.id, nome: m.nome, tipo: "master" })),
    ...(assistente || []).map((a) => ({ id: a.id, nome: a.nome, tipo: "assistente" })),
    ...(venditori || []).map((v) => ({ id: v.id, nome: v.nome, tipo: "venditore" })),
  ].filter((p) => p.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [master, assistente, venditori]);

  const aperto = (eventi || []).find((e) => e.id === apertoId) || null;

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <TastoLivelloPrecedente titolo={aperto || creando ? titolo : "Home"} onClick={() => { if (creando) setCreando(false); else if (aperto) setApertoId(null); else onBack(); }} />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{aperto ? aperto.nome : titolo}</div>
        </div>
        {!aperto && !creando && (
          <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 18, lineHeight: 1.6 }}>
            Fiere, congressi, giornate fuori sede: chi ci va, cosa si porta, come ci si arriva e dove si dorme.
          </div>
        )}
        {msg && <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#C0392B", marginBottom: 12 }}>{msg}</div>}

        {creando && (
          <ModuloEvento
            location={location}
            onSalvato={(id) => { setCreando(false); ricarica().then(() => setApertoId(id)); }}
            onAnnulla={() => setCreando(false)}
          />
        )}

        {!creando && aperto && (
          <SchedaEvento
            evento={aperto} location={location} persone={persone} prodotti={prodottiShop} hotel={hotel}
            onIndietro={() => setApertoId(null)}
            onCambiato={ricarica}
          />
        )}

        {!creando && !aperto && (
          <ElencoEventi
            eventi={eventi || []} caricando={eventi === null}
            onApri={setApertoId} onNuovo={() => setCreando(true)}
          />
        )}
      </div>
    </div>
  );
}
