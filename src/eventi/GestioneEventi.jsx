// Gestione eventi: fiere, congressi, giornate fuori sede.
//
// Due schermate. L'elenco, in ordine cronologico, e la scheda del
// singolo evento — che somiglia a quella di un corso perche' chi la usa
// e' la stessa persona: nome, date e luogo in cima, e sotto le quattro
// cose da organizzare. Team, materiali, trasferimenti, hotel.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, BG, BG_CHIARO, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import SelettorePeriodo from "../ui/SelettorePeriodo.jsx";
import {
  STATI_EVENTO, leggiEventi, creaEvento, salvaEvento, eliminaEvento,
  leggiRighe, aggiungiRiga, salvaRiga, eliminaRiga, leggiHotelEvento,
  periodoEvento, quantiGiorni, usciteAllEvento,
  impegniMagazzino, segnaPartito, segnaRientro, tieneGiacenza,
  leggiCategoriePrincipali, leggiImmaginiProdotti,
} from "./dati.js";
import { leggiConto, calcolaConto, problemiDiChiusura, incassiSenzaEvento, agganciaIncassi } from "./conto.js";
import { supabase } from "../supabase.js";

const euro = (n) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
// "2026-09-26" -> "26/09". Le date qui sono giorni, non istanti: si
// spezza la stringa invece di passare da Date, o il fuso sposta il
// giorno indietro di uno (vedi date-nulle-fanno-schermata-bianca)
const fmtGiorno = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}` : "—");
// l'orario di una vendita, letto a Roma: e' un istante vero
const fmtQuando = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
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
        {/* un controllo solo: si tocca il primo giorno e poi l'ultimo,
            e in mezzo si vede la striscia. Due caselle costringevano a
            capire da soli se la seconda veniva dopo la prima */}
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <Field label="Quando">
            <SelettorePeriodo
              da={f.data_inizio} a={f.data_fine || f.data_inizio}
              vuoto="Tocca qui e scegli i giorni"
              onCambia={({ da, a }) => setF((p) => ({ ...p, data_inizio: da, data_fine: a }))}
            />
          </Field>
        </div>
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
        <div style={{ flex: "1 1 150px", minWidth: 0 }}><Field label="Città"><input style={inputStyle} value={f.citta} onChange={(e) => cambia("citta", e.target.value)} /></Field></div>
        <div style={{ flex: "1 1 150px", minWidth: 0 }}><Field label="Luogo"><input style={inputStyle} value={f.nome_luogo} onChange={(e) => cambia("nome_luogo", e.target.value)} placeholder="es. Fiera di Bologna, pad. 32" /></Field></div>
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

function SchedaMateriali({ eventoId, evento, prodotti, onStockCambiato }) {
  const [righe, setRighe] = useState(null);
  const [uscite, setUscite] = useState({ venduto: {}, omaggiato: {} });
  const [impegni, setImpegni] = useState({ carrelli: {}, perEvento: {} });
  // la categoria con cui ogni prodotto si raggruppa, e la sua foto
  const [categorie, setCategorie] = useState({ principale: {} });
  const [immagini, setImmagini] = useState({});
  const [cerca, setCerca] = useState("");
  const [nomeLibero, setNomeLibero] = useState("");
  // la ricerca DENTRO l'elenco gia' composto: con ottanta righe su
  // diciassette gruppi, trovare se un prodotto c'e' gia' richiedeva di
  // scorrere tutto. E' un'altra cosa dalla ricerca a catalogo qui
  // sopra, che serve ad aggiungerne di nuovi
  const [filtroElenco, setFiltroElenco] = useState("");
  const [inCorso, setInCorso] = useState("");
  const [avanzamento, setAvanzamento] = useState(null);   // [fatte, totali]

  // Gli errori si leggono se sono pochi. Con ottanta righe sotto scorta
  // diventerebbe un muro di testo in cui non si trova niente: se ne
  // mostrano tre e si dice quanti sono gli altri.
  const primiErrori = (errori) => errori.slice(0, 3).join(" · ") + (errori.length > 3 ? ` · e altri ${errori.length - 3}` : "");
  const [msg, setMsg] = useState(null);   // { tipo: "ok" | "errore", testo }

  const ricarica = () => {
    leggiRighe("eventi_materiali", eventoId).then(setRighe).catch(() => setRighe([]));
    usciteAllEvento(eventoId).then(setUscite).catch(() => setUscite({ venduto: {}, omaggiato: {} }));
    impegniMagazzino().then(setImpegni).catch(() => setImpegni({ carrelli: {}, perEvento: {} }));
  };
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [eventoId]);
  useEffect(() => {
    leggiCategoriePrincipali().then(setCategorie).catch(() => setCategorie({ principale: {} }));
    leggiImmaginiProdotti().then(setImmagini).catch(() => setImmagini({}));
  }, []);

  const trovati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (q.length < 2) return [];
    return (prodotti || []).filter((p) => String(p.nome || "").toLowerCase().includes(q)).slice(0, 8);
  }, [cerca, prodotti]);

  // Il nome come si chiama OGGI. Sulla riga ne resta scritto uno, da
  // quando la riga e' nata, e invecchia: rinominato un prodotto, qui
  // restava il nome di prima. Si rilegge dall'anagrafica per id; quello
  // salvato serve solo alle voci scritte a mano, che un id non ce l'hanno.
  const perId = useMemo(() => new Map((prodotti || []).map((p) => [p.id, p])), [prodotti]);
  const nomeVivo = (r) => (r.prodotto_id && perId.get(r.prodotto_id)?.nome) || r.nome;

  // Quanti pezzi si possono ancora promettere a questo evento: la
  // giacenza vera meno i pezzi di qualcun altro. Non e' un limite che
  // blocca — in elenco si puo' scrivere anche di piu', perche' fra oggi
  // e la fiera puo' arrivare un ordine — ma si vede prima di scrivere,
  // che era tutto il punto.
  function impegnatoAltrove(prodottoId) {
    const daiCarrelli = impegni.carrelli[prodottoId] || 0;
    const daAltriEventi = Object.entries(impegni.perEvento)
      .reduce((s, [id, mappa]) => (id === eventoId ? s : s + (mappa[prodottoId] || 0)), 0);
    return { daiCarrelli, daAltriEventi, totale: daiCarrelli + daAltriEventi };
  }
  function disponibile(prodottoId) {
    const p = perId.get(prodottoId);
    if (!tieneGiacenza(p)) return null;
    const impegnato = impegnatoAltrove(prodottoId);
    return {
      ...impegnato,
      giacenza: Number(p.quantita) || 0,
      soglia: p.soglia_riordino == null ? null : Number(p.soglia_riordino) || 0,
      libera: Math.max(0, (Number(p.quantita) || 0) - impegnato.totale),
    };
  }

  async function aggiungiProdotto(p) {
    await aggiungiRiga("eventi_materiali", { evento_id: eventoId, prodotto_id: p.id, nome: p.nome, quantita: 1, ordine: (righe || []).length });
    // il nome si scrive lo stesso, ma come rete: se un domani il prodotto
    // esce dall'anagrafica la riga non resta senza nome. A schermo comanda
    // sempre quello vivo
    setCerca(""); ricarica();
  }
  async function aggiungiVoce() {
    if (!nomeLibero.trim()) return;
    await aggiungiRiga("eventi_materiali", { evento_id: eventoId, nome: nomeLibero.trim(), quantita: 1, ordine: (righe || []).length });
    setNomeLibero(""); ricarica();
  }

  // quanti pezzi stanno ancora fuori: usciti dal magazzino per questo
  // evento e non ancora rimessi dentro
  const fuoriAdesso = (righe || []).reduce((s, r) => s + Math.max(0, (Number(r.quantita_scaricata) || 0) - (Number(r.quantita_ricaricata) || 0)), 0);
  const giaPartito = (righe || []).some((r) => (Number(r.quantita_scaricata) || 0) > 0);
  const daRimettere = (righe || []).some((r) => r.quantita_rientrata != null && (Number(r.quantita_rientrata) || 0) !== (Number(r.quantita_ricaricata) || 0));

  async function premiPartito() {
    const conto = (righe || []).filter((r) => {
      const obiettivo = r.quantita_portata == null ? (Number(r.quantita) || 0) : (Number(r.quantita_portata) || 0);
      return obiettivo !== (Number(r.quantita_scaricata) || 0);
    }).length;
    if (conto === 0) { setMsg({ tipo: "ok", testo: "Il magazzino è già allineato a quello che è partito: non c'è niente da muovere." }); return; }
    if (!window.confirm(`Segnare partito il materiale di questo evento?\n\n${conto} rig${conto === 1 ? "a" : "he"} da allineare: quello che è da portare diventa partito ed esce dalle giacenze. Le righe dove hai già scritto a mano un numero in "Partito" lo tengono.`)) return;
    setInCorso("partito"); setMsg(null); setAvanzamento([0, righe.length]);
    try {
      const esito = await segnaPartito({ righe, prodottiPerId: perId, nomeEvento: evento?.nome, onAvanzamento: (f, t) => setAvanzamento([f, t]) });
      ricarica(); onStockCambiato?.();
      setMsg(esito.errori.length
        ? { tipo: "errore", testo: `${esito.mosse} prodott${esito.mosse === 1 ? "o" : "i"} scaricat${esito.mosse === 1 ? "o" : "i"}. Non è riuscito: ${primiErrori(esito.errori)}` }
        : { tipo: "ok", testo: `Partito. ${esito.mosse} prodott${esito.mosse === 1 ? "o è uscito" : "i sono usciti"} dal magazzino.` });
    } catch (e) { setMsg({ tipo: "errore", testo: e?.message || String(e) }); }
    setInCorso(""); setAvanzamento(null);
  }

  async function premiRientro() {
    if (!daRimettere) { setMsg({ tipo: "ok", testo: "Non c'è niente da rimettere dentro: compila prima la colonna «Rientrato»." }); return; }
    if (!window.confirm("Rimettere in magazzino quello che è scritto nella colonna «Rientrato»?\n\nI pezzi tornano nelle giacenze e tornano vendibili.")) return;
    setInCorso("rientro"); setMsg(null); setAvanzamento([0, 0]);
    try {
      const esito = await segnaRientro({ righe, prodottiPerId: perId, nomeEvento: evento?.nome, onAvanzamento: (f, t) => setAvanzamento([f, t]) });
      ricarica(); onStockCambiato?.();
      setMsg(esito.errori.length
        ? { tipo: "errore", testo: `${esito.mosse} prodott${esito.mosse === 1 ? "o" : "i"} rimess${esito.mosse === 1 ? "o" : "i"} dentro. Non è riuscito: ${primiErrori(esito.errori)}` }
        : { tipo: "ok", testo: `Rientrati. ${esito.mosse} prodott${esito.mosse === 1 ? "o è tornato" : "i sono tornati"} in magazzino.` });
    } catch (e) { setMsg({ tipo: "errore", testo: e?.message || String(e) }); }
    setInCorso(""); setAvanzamento(null);
  }

  // L'ELENCO RAGGRUPPATO PER CATEGORIA.
  //
  // Ottantaquattro righe di fila sono un muro: per reparto si cerca con
  // l'occhio invece che scorrendo. Dentro ogni gruppo l'ordine resta
  // quello in cui le righe sono state aggiunte, che e' l'ordine con cui
  // si prepara lo scatolone.
  //
  // Due gruppi non vengono da una categoria: le voci scritte a mano, che
  // a catalogo non ci sono proprio, e i prodotti che una categoria non
  // ce l'hanno. Stanno in fondo col loro nome — in mezzo agli altri
  // confonderebbero chi cerca un reparto.
  const gruppi = useMemo(() => {
    const per = new Map();
    const gruppoDi = (r) => {
      if (!r.prodotto_id) return { chiave: "__libere", nome: "Voci libere", coda: 3 };
      const c = categorie.principale?.[r.prodotto_id];
      if (!c) return { chiave: "__senza", nome: "Senza categoria", coda: 2 };
      return { chiave: c.id, nome: c.nome, coda: 0, dentro: c.ordine ?? 9999 };
    };
    const q = filtroElenco.trim().toLowerCase();
    const viste = q ? (righe || []).filter((r) => String(nomeVivo(r) || "").toLowerCase().includes(q)) : (righe || []);
    viste.forEach((r) => {
      const g = gruppoDi(r);
      if (!per.has(g.chiave)) per.set(g.chiave, { ...g, righe: [] });
      per.get(g.chiave).righe.push(r);
    });
    return [...per.values()].sort((a, b) => (a.coda !== b.coda ? a.coda - b.coda
      : (a.dentro ?? 0) !== (b.dentro ?? 0) ? (a.dentro ?? 0) - (b.dentro ?? 0)
      : String(a.nome).localeCompare(String(b.nome))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [righe, categorie, filtroElenco, perId]);

  // la foto in testa alla riga, come nei listini: dentro per intero su
  // fondo bianco, perche' quasi tutte sono verticali e ritagliate al
  // quadrato mostrerebbero solo il manico
  const foto = (r) => {
    const p = r.prodotto_id ? perId.get(r.prodotto_id) : null;
    const url = (r.prodotto_id && immagini[r.prodotto_id]) || p?.foto_url || null;
    return (
      <span style={{ width: 34, height: 34, borderRadius: 9, background: url ? "#fff" : BG, border: `1px solid ${CREAM_BORDER}`, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: url ? 2 : 0 }}>
        {url
          ? <img src={url} alt="" loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          : <span style={{ ...fontBody, fontSize: 14, color: MUTED }}>·</span>}
      </span>
    );
  };

  if (righe === null) return <Vuoto>Carico…</Vuoto>;

  return (
    <>
      {/* La regola, scritta dove si lavora. Fino al 08/10/2026 diceva
          l'opposto — "non esce dal magazzino, resta nostro solo in un
          altro posto" — ed era comodo da dire e falso da usare: quei
          pezzi al banco non c'erano, ma il magazzino continuava a
          prometterli ai corsi e allo shop. */}
      <div style={{ ...fontBody, fontSize: 12, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 10, padding: "9px 11px", marginBottom: 12, lineHeight: 1.55 }}>
        Quello che metti in elenco è <b>impegnato</b>: resta in giacenza ma non lo promette più nessun altro, e l'Advisor lo conta.
        Con <b>Partito</b> esce davvero dal magazzino; con <b>Rimetti in magazzino</b> torna dentro quello che è scritto in «Rientrato».
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Button onClick={premiPartito} disabled={!!inCorso || righe.length === 0}>
          {inCorso === "partito" ? `Esco dal magazzino… ${avanzamento ? `${avanzamento[0]}/${avanzamento[1]}` : ""}` : "Partito"}
        </Button>
        <Button variant="ghost" onClick={premiRientro} disabled={!!inCorso || !giaPartito}>
          {inCorso === "rientro" ? `Rimetto dentro… ${avanzamento && avanzamento[1] ? `${avanzamento[0]}/${avanzamento[1]}` : ""}` : "Rimetti in magazzino"}
        </Button>
        {fuoriAdesso > 0 && (
          <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: "#8A6D1D" }}>
            {fuoriAdesso} pz fuori dal magazzino per questo evento
          </span>
        )}
      </div>
      {msg && (
        <div style={{
          ...fontBody, fontSize: 12.5, lineHeight: 1.55, borderRadius: 10, padding: "9px 11px", marginBottom: 14,
          color: msg.tipo === "errore" ? "#C0392B" : "#2E7D32",
          background: msg.tipo === "errore" ? "#FBEBE9" : "#EAF5EA",
          border: `1px solid ${msg.tipo === "errore" ? "#F0C8C2" : "#C7E3C7"}`,
        }}>{msg.testo}</div>
      )}

      <Field label="Cerca un prodotto a catalogo">
        <input style={inputStyle} value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="scrivi almeno due lettere…" />
      </Field>
      {trovati.length > 0 && (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
          {trovati.map((p) => {
            const d = disponibile(p.id);
            return (
              <button key={p.id} onClick={() => aggiungiProdotto(p)} style={{
                display: "flex", width: "100%", textAlign: "left", minHeight: 44, padding: "10px 12px", gap: 10,
                alignItems: "center", justifyContent: "space-between",
                background: "#fff", border: "none", borderBottom: `1px solid ${CREAM_BORDER}`, cursor: "pointer",
                ...fontBody, fontSize: 13, color: NAVY,
              }}>
                <span style={{ minWidth: 0 }}>{p.nome}</span>
                {d && <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: d.libera > 0 ? MUTED : "#C0392B", whiteSpace: "nowrap" }}>{d.libera} disp.</span>}
              </button>
            );
          })}
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }}
            value={filtroElenco} onChange={(e) => setFiltroElenco(e.target.value)}
            placeholder="Cerca fra quelli già in elenco…"
          />
          <span style={{ ...fontBody, fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
            {filtroElenco.trim()
              ? `${gruppi.reduce((n, g) => n + g.righe.length, 0)} di ${righe.length}`
              : `${righe.length} prodott${righe.length === 1 ? "o" : "i"}`}
          </span>
        </div>
      )}
      {righe.length > 0 && gruppi.length === 0 && (
        <Vuoto>Nessun prodotto in elenco con queste parole.</Vuoto>
      )}

      {gruppi.map((g) => (
        <div key={g.chiave} style={{ marginBottom: 14 }}>
          {/* la barra del reparto: sta attaccata alle sue righe e si
              riconosce da lontano, senza doverla leggere */}
          <div style={{
            ...fontBody, fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 1,
            background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10,
            padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>{g.nome}</span>
            <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: 0 }}>
              {g.righe.length} prodott{g.righe.length === 1 ? "o" : "i"}
            </span>
          </div>
          {g.righe.map((r) => {
        const portata = r.quantita_portata == null ? null : Number(r.quantita_portata);
        const rientrata = r.quantita_rientrata == null ? null : Number(r.quantita_rientrata);
        const vendutoQui = r.prodotto_id ? (uscite.venduto[r.prodotto_id] || 0) : 0;
        const omaggiatoQui = r.prodotto_id ? (uscite.omaggiato[r.prodotto_id] || 0) : 0;
        // il conto della consegna: quello che e' partito meno quello che
        // e' tornato deve fare quello che e' uscito — venduto PIU'
        // omaggiato, perche' anche un pezzo regalato non e' tornato
        const mancante = portata != null && rientrata != null ? Math.round((portata - rientrata - vendutoQui - omaggiatoQui) * 100) / 100 : null;
        const d = r.prodotto_id ? disponibile(r.prodotto_id) : null;
        const scaricata = Number(r.quantita_scaricata) || 0;
        // i pezzi che questa riga impegna sono gia' dentro "impegnato
        // altrove"? No: impegniMagazzino salta l'evento aperto. Quindi
        // il confronto e' fra quello che si chiede e quello che resta
        const chiesti = Number(r.quantita) || 0;
        const scoperti = d ? Math.max(0, chiesti - scaricata - d.libera) : 0;
        return (
          /* TUTTO SU UNA RIGA.
             Il nome prende lo spazio che resta, le quantita' ne
             occupano tre cifre e basta. Prima il nome stava su una riga
             sua e sotto quattro caselle larghe un quarto di schermo:
             dieci prodotti erano trenta righe, e per leggerne uno
             bisognava scorrere. Da telefono le caselle vanno a capo
             sotto al nome, che e' l'unico modo di tenerle leggibili. */
          <div key={r.id} style={{ padding: "7px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <span style={{ alignSelf: "center", display: "inline-flex" }}>{foto(r)}</span>
              <span style={{ flex: "1 1 150px", minWidth: 0 }}>
                <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, overflowWrap: "anywhere" }}>
                  {nomeVivo(r)}
                  {r.prodotto_id && <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: GOLD, marginLeft: 7 }}>a catalogo</span>}
                  {scaricata > 0 && <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: "#2E7D32", marginLeft: 7 }}>{scaricata} fuori</span>}
                </span>
                {/* quanto se ne puo' ancora prendere, sulla stessa riga
                    del nome: era un blocco di tre righe sotto */}
                {d && (
                  <span style={{ display: "block", ...fontBody, fontSize: 10.5, color: scoperti > 0 ? "#C0392B" : MUTED, marginTop: 2, lineHeight: 1.35 }}>
                    {d.libera} liberi
                    {d.totale > 0 && ` (${d.giacenza} in casa, −${d.totale} impegnati)`}
                    {scoperti > 0 && <b> · ne mancano {scoperti}</b>}
                  </span>
                )}
              </span>
              {[
                ["Da portare", "quantita", r.quantita],
                ["Partito", "quantita_portata", r.quantita_portata],
                ["Rientrato", "quantita_rientrata", r.quantita_rientrata],
              ].map(([etichetta, campo, valore]) => (
                <label key={campo} style={{ flex: "0 0 auto", width: 78 }}>
                  <span style={{ display: "block", ...fontBody, fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{etichetta}</span>
                  <input
                    type="number" min="0" step="1"
                    style={{ ...campoRiga, width: "100%", boxSizing: "border-box", textAlign: "right", padding: "6px 6px", fontSize: 13 }}
                    defaultValue={valore ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== (valore == null ? null : Number(valore))) salvaRiga("eventi_materiali", r.id, { [campo]: v }).then(ricarica);
                    }}
                  />
                </label>
              ))}
              <span style={{ flex: "0 0 auto", width: 54, textAlign: "right" }} title={omaggiatoQui > 0 ? `${vendutoQui} venduti e ${omaggiatoQui} in omaggio` : "Venduto al POS all'evento"}>
                <span style={{ display: "block", ...fontBody, fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2, whiteSpace: "nowrap" }}>Al POS</span>
                <span style={{ display: "block", ...fontBody, fontSize: 13.5, fontWeight: 700, color: (vendutoQui + omaggiatoQui) > 0 ? "#2E7D32" : MUTED, padding: "6px 0" }}>
                  {vendutoQui + omaggiatoQui}
                </span>
              </span>
              <span style={{ flex: "0 0 auto", paddingBottom: 4 }}>
                <TastoCestino onClick={() => eliminaRiga("eventi_materiali", r.id).then(ricarica)} />
              </span>
            </div>
            {mancante != null && mancante !== 0 && (
              <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#C0392B", marginTop: 3 }}>
                {mancante > 0
                  ? `Non torna: ${mancante} pz partiti che non sono né rientrati né usciti al POS.`
                  : `Non torna: sono rientrati ${-mancante} pz più di quanti ne fossero partiti.`}
              </div>
            )}
          </div>
        );
          })}
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
            <div style={{ flex: "0 0 140px", minWidth: 0 }}>
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
            <div style={{ flex: "1 1 140px", minWidth: 0 }}><Field label="Da"><input style={campoRiga} defaultValue={r.da_dove || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { da_dove: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "1 1 140px", minWidth: 0 }}><Field label="A"><input style={campoRiga} defaultValue={r.a_dove || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { a_dove: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 170px", minWidth: 0 }}><Field label="Partenza"><input type="datetime-local" style={campoRiga} defaultValue={r.partenza ? String(r.partenza).slice(0, 16) : ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { partenza: e.target.value || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "1 1 170px", minWidth: 0 }}><Field label="Arrivo"><input type="datetime-local" style={campoRiga} defaultValue={r.arrivo ? String(r.arrivo).slice(0, 16) : ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { arrivo: e.target.value || null }).then(ricarica)} /></Field></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}><Field label="Riferimento (biglietto, targa, prenotazione)"><input style={campoRiga} defaultValue={r.riferimento || ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { riferimento: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
            <div style={{ flex: "0 0 110px", minWidth: 0 }}><Field label="Costo"><input type="number" min="0" step="0.01" style={campoRiga} defaultValue={r.costo ?? ""} onBlur={(e) => salvaRiga("eventi_trasferimenti", r.id, { costo: e.target.value === "" ? null : Number(e.target.value) }).then(ricarica)} /></Field></div>
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
              <div style={{ flex: "1 1 130px", minWidth: 0 }}><Field label="Gruppo"><input style={campoRiga} defaultValue={g.nome || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { nome: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <Field label="Hotel">
                  <input style={campoRiga} defaultValue={g.hotel_nome || ""} list={`hotel-${eventoId}`} placeholder="nome dell'hotel"
                    onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { hotel_nome: e.target.value.trim() || null }).then(ricarica)} />
                </Field>
              </div>
              <TastoCestino titolo="Elimina il gruppo e le sue stanze" onClick={() => { if (window.confirm(`Elimino "${g.nome || "questo gruppo"}" e le sue stanze?`)) supabase.from("eventi_hotel_gruppi").delete().eq("id", g.id).then(ricarica); }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <Field label="Notti">
                  <SelettorePeriodo
                    da={g.check_in || ""} a={g.check_out || ""}
                    vuoto="Check-in e check-out"
                    stile={{ padding: "8px 10px", fontSize: 13 }}
                    onCambia={({ da, a }) => salvaRiga("eventi_hotel_gruppi", g.id, { check_in: da || null, check_out: a || null }).then(ricarica)}
                  />
                </Field>
              </div>
              <div style={{ flex: "1 1 140px", minWidth: 0 }}><Field label="Prenotazione"><input style={campoRiga} defaultValue={g.riferimento || ""} onBlur={(e) => salvaRiga("eventi_hotel_gruppi", g.id, { riferimento: e.target.value.trim() || null }).then(ricarica)} /></Field></div>
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

// ------------------------------------------------------------- il conto

const CAT_ORDINE = ["Trasferimenti", "Hotel"];

function VoceConto({ etichetta, valore, forte = false, colore = NAVY, nota }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "6px 0" }}>
      <span style={{ ...fontBody, fontSize: forte ? 13.5 : 12.5, fontWeight: forte ? 700 : 400, color: forte ? NAVY : MUTED, minWidth: 0 }}>
        {etichetta}
        {nota && <span style={{ display: "block", ...fontBody, fontSize: 11, fontWeight: 400, color: MUTED, marginTop: 1, lineHeight: 1.4 }}>{nota}</span>}
      </span>
      <span style={{ ...fontDisplay, fontSize: forte ? 16 : 13.5, fontWeight: 700, color: colore, whiteSpace: "nowrap" }}>{valore}</span>
    </div>
  );
}

function Riquadro({ titolo, children, sfondo = "#fff", bordo = CREAM_BORDER }) {
  return (
    <div style={{ background: sfondo, border: `1px solid ${bordo}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>{titolo}</div>
      {children}
    </div>
  );
}

// Gli incassi del POS rimasti senza evento. Al banco di una fiera si
// vende e basta: la tendina "Sei a un evento?" ci si dimentica di
// sceglierla. Invece di rincorrerli uno a uno, si chiede all'app quali
// vendite di quei giorni non sono ancora di nessuno.
function PannelloIncassi({ evento, onFatto }) {
  const [giorniPrima, setGiorniPrima] = useState(1);
  const [trovate, setTrovate] = useState(null);
  const [scelte, setScelte] = useState({});
  const [cerco, setCerco] = useState(false);
  const [msg, setMsg] = useState("");

  async function cerca() {
    setCerco(true); setMsg("");
    try {
      const r = await incassiSenzaEvento(evento, giorniPrima, 0);
      setTrovate(r);
      // tutte spuntate: chi apre questo pannello le vuole agganciare,
      // semmai toglie quella di troppo
      setScelte(Object.fromEntries(r.righe.map((v) => [v.id, true])));
    } catch (e) { setMsg(e.message); }
    setCerco(false);
  }
  async function aggancia() {
    const ids = Object.entries(scelte).filter(([, s]) => s).map(([id]) => id);
    if (!ids.length) return;
    setCerco(true);
    try {
      await agganciaIncassi(ids, evento.id);
      setTrovate(null); setScelte({});
      setMsg(`${ids.length} vendit${ids.length === 1 ? "a agganciata" : "e agganciate"} all'evento.`);
      if (onFatto) onFatto();
    } catch (e) { setMsg(e.message); }
    setCerco(false);
  }

  const quante = Object.values(scelte).filter(Boolean).length;
  const somma = trovate ? trovate.righe.filter((v) => scelte[v.id]).reduce((s, v) => s + (Number(v.totale) || 0), 0) : 0;

  return (
    <Riquadro titolo="Incassi rimasti senza evento">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <label style={{ flex: "0 1 120px", minWidth: 0 }}>
          <span style={{ display: "block", ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Giorni di allestimento</span>
          <input type="number" min="0" max="10" value={giorniPrima} onChange={(e) => setGiorniPrima(Number(e.target.value) || 0)}
            style={{ ...inputStyle, textAlign: "right" }} />
        </label>
        <Button variant="ghost" onClick={cerca} disabled={cerco || !evento.data_inizio}>{cerco ? "Cerco…" : "Cerca"}</Button>
        <span style={{ flex: 1, minWidth: 140, ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>
          Si guarda dai giorni di allestimento fino alla fine dell'evento. Le vendite già legate a un corso non si toccano.
        </span>
      </div>

      {msg && <div style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: msg.includes("aggancia") ? "#2E7D32" : "#C0392B", marginTop: 8 }}>{msg}</div>}

      {trovate && trovate.righe.length === 0 && (
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
          Dal {fmtGiorno(trovate.inizio)} al {fmtGiorno(trovate.fine)} non c'è nessuna vendita POS orfana: o sono già su questo evento, o non ce ne sono state.
        </div>
      )}

      {trovate && trovate.righe.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
            Dal {fmtGiorno(trovate.inizio)} al {fmtGiorno(trovate.fine)}:
          </div>
          {trovate.righe.map((v) => (
            <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderTop: `1px solid ${CREAM_BORDER}`, cursor: "pointer" }}>
              <input type="checkbox" checked={!!scelte[v.id]} onChange={(e) => setScelte((p) => ({ ...p, [v.id]: e.target.checked }))} style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fmtQuando(v.data_ordine)} · {v.operatore_nome || "?"}
                {v.tipo_movimento === "omaggio" && <span style={{ color: "#8A6D1D", fontWeight: 700 }}> · omaggio</span>}
              </span>
              <span style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{euro(v.totale)}</span>
            </label>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY }}>
              {quante} selezionat{quante === 1 ? "a" : "e"} · {euro(somma)}
            </span>
            <Button onClick={aggancia} disabled={cerco || quante === 0}>Aggancia all'evento</Button>
          </div>
        </div>
      )}
    </Riquadro>
  );
}

function SchedaConto({ evento, prodotti, bundleComponenti, categorieNome, onNuovaSpesa, onCambiato }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [chiedeConferma, setChiedeConferma] = useState(false);
  const [chiudendo, setChiudendo] = useState(false);

  const [giro, setGiro] = useState(0);
  const rileggi = () => setGiro((n) => n + 1);
  useEffect(() => {
    let vivo = true;
    setDati(null); setErrore("");
    leggiConto(evento.id)
      .then((d) => { if (vivo) setDati(d); })
      .catch((e) => { if (vivo) setErrore(e.message); });
    return () => { vivo = false; };
  }, [evento.id, giro]);

  const conto = useMemo(
    () => (dati ? calcolaConto(dati, evento.id, { prodottiShop: prodotti, bundleComponenti, categorieNome }) : null),
    [dati, evento.id, prodotti, bundleComponenti, categorieNome],
  );

  if (errore) return <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#C0392B" }}>Non riesco a leggere il conto: {errore}</div>;
  if (!conto) return <Vuoto>Sto facendo i conti…</Vuoto>;

  const { entrate, omaggi, uscitePerCategoria, usciteTotale, uscite, merce, costoMerce, merceSenzaCosto, righeScartate, risultato, completo } = conto;

  const problemi = problemiDiChiusura(conto);

  async function cambiaStato(nuovo) {
    setChiudendo(true);
    try {
      await salvaEvento(evento.id, { stato: nuovo });
      setChiedeConferma(false);
      if (onCambiato) onCambiato();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setChiudendo(false);
    }
  }
  const categorie = Object.keys(uscitePerCategoria)
    .sort((a, b) => (CAT_ORDINE.indexOf(a) - CAT_ORDINE.indexOf(b)) || a.localeCompare(b));
  const inUtile = risultato >= 0;

  return (
    <div>
      {/* Il risultato in cima: è la domanda per cui si apre questa
          scheda. Sotto ci sono i pezzi che lo compongono. */}
      <div style={{
        background: inUtile ? "linear-gradient(110deg, #F2FAF2 0%, #E4F3E6 100%)" : "linear-gradient(110deg, #FDF3F1 0%, #FAE6E2 100%)",
        border: `1px solid ${inUtile ? "#C7E3C7" : "#F0C8C2"}`, borderRadius: 16, padding: "14px 18px", marginBottom: 14,
      }}>
        <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: inUtile ? "#2E7D32" : "#C0392B", textTransform: "uppercase", letterSpacing: 0.7 }}>
          {inUtile ? "Risultato dell'evento" : "L'evento è in perdita"}
        </div>
        <div style={{ ...fontDisplay, fontSize: 30, fontWeight: 700, color: inUtile ? "#2E7D32" : "#C0392B", lineHeight: 1.15, marginTop: 3 }}>
          {euro(risultato)}
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 5, lineHeight: 1.5 }}>
          Incassato al netto dell'IVA ({euro(entrate.imponibile)}), meno le spese ({euro(usciteTotale)}) e il costo della merce uscita ({euro(costoMerce)}).
        </div>
        {!completo && (
          <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#C0392B", marginTop: 7, lineHeight: 1.5 }}>
            Attenzione: {merceSenzaCosto.length} riga{merceSenzaCosto.length === 1 ? "" : "e"} di materiale non ha un costo di acquisto.
            Quella merce è contata zero, quindi il risultato qui sopra è più bello del vero.
          </div>
        )}
      </div>

      <Riquadro titolo="Entrate — vendite al POS">
        {entrate.quante === 0 ? (
          <Vuoto>Nessuna vendita registrata a questo evento. Al POS si sceglie l'evento dalla tendina "Sei a un evento?".</Vuoto>
        ) : (
          <>
            <VoceConto etichetta={`Incassato lordo · ${entrate.quante} vendit${entrate.quante === 1 ? "a" : "e"}`} valore={euro(entrate.lordo)} forte />
            <VoceConto etichetta="di cui imponibile" valore={euro(entrate.imponibile)} />
            <VoceConto etichetta="di cui IVA" valore={euro(entrate.iva)} nota="Non è un ricavo: si incassa per conto dello Stato e si gira." />
            <div style={{ height: 1, background: CREAM_BORDER, margin: "8px 0" }} />
            {Object.entries(entrate.perMetodo).map(([m, v]) => (
              <VoceConto key={m} etichetta={m === "pos" ? "Carta" : m === "contanti" ? "Contanti" : m === "buono_amazon" ? "Buono Amazon" : m} valore={euro(v)} />
            ))}
          </>
        )}
      </Riquadro>

      {omaggi.quanti > 0 && (
        <Riquadro titolo="Omaggi" sfondo="#FDF8EC" bordo="#EBD9AE">
          <VoceConto etichetta={`${omaggi.quanti} omaggi, a listino`} valore={euro(omaggi.valore)} forte colore="#8A6D1D"
            nota="Non è un ricavo mancato: è merce data via. Nel risultato entra il suo costo, insieme al resto della merce uscita." />
        </Riquadro>
      )}

      <Riquadro titolo="Uscite">
        {uscite.length === 0 ? (
          <Vuoto>Nessuna spesa imputata a questo evento. Si imputano da Contabilità scegliendo l'ambito "evento".</Vuoto>
        ) : (
          <>
            {categorie.map((c) => <VoceConto key={c} etichetta={c} valore={euro(uscitePerCategoria[c])} />)}
            <div style={{ height: 1, background: CREAM_BORDER, margin: "8px 0" }} />
            <VoceConto etichetta="Totale uscite" valore={euro(usciteTotale)} forte />
            <div style={{ marginTop: 10 }}>
              {uscite.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, ...fontBody, fontSize: 11.5, color: MUTED, padding: "3px 0" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.descrizione}
                    {v.parziale && <span title="Spesa divisa fra più ambiti: qui c'è solo la quota dell'evento" style={{ color: "#8A6D1D", fontWeight: 700 }}> · quota</span>}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>{euro(v.importo)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Riquadro>

      <Riquadro titolo="Merce uscita dalla scatola">
        {merce.length === 0 ? (
          <Vuoto>Nessun materiale in elenco. Si aggiunge dalla scheda Materiali.</Vuoto>
        ) : (
          <>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
              Il materiale portato a un evento non esce dal magazzino: resta roba nostra, solo in un altro posto.
              Scende quando si vende o si regala. Qui si valorizza a costo di acquisto quello che non è tornato indietro.
            </div>
            {merce.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
                <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>
                <span style={{ ...fontBody, fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
                  {r.portata != null ? `${r.portata} portati` : "partenza non contata"}
                  {r.venduto > 0 ? ` · ${r.venduto} venduti` : ""}
                  {r.omaggiata > 0 ? ` · ${r.omaggiata} omaggio` : ""}
                </span>
                {r.senzaCosto ? (
                  <span title="Senza costo di acquisto questa merce vale zero nel conto: mettilo nella scheda del prodotto."
                    style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: "#C0392B", background: "#FBEBE9", border: "1px solid #F0C8C2", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
                    costo mancante
                  </span>
                ) : (
                  <span style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" }}>{euro(r.valore || 0)}</span>
                )}
              </div>
            ))}
            <div style={{ height: 1, background: CREAM_BORDER, margin: "8px 0" }} />
            <VoceConto etichetta="Costo della merce uscita" valore={euro(costoMerce)} forte />
          </>
        )}
      </Riquadro>

      <PannelloIncassi evento={evento} onFatto={rileggi} />

      {/* La spesa si scrive con lo STESSO modulo della Contabilita', non
          con una copia ridotta: una copia diverge al primo campo nuovo, e
          qui ci sono di mezzo IVA, stato del pagamento e ripartizioni.
          Si apre quello, gia' puntato su questo evento. */}
      <Riquadro titolo="Spese di questo evento">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            Si apre il modulo spese della Contabilità, già puntato su questo evento e sulla
            categoria «Fiere ed eventi». Finito, torni qui.
          </span>
          <Button onClick={() => onNuovaSpesa && onNuovaSpesa(evento)} disabled={!onNuovaSpesa}>Aggiungi una spesa</Button>
        </div>
      </Riquadro>

      {evento.stato === "concluso" ? (
        <Riquadro titolo="Evento chiuso" sfondo="#EAF5EA" bordo="#C7E3C7">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, color: "#2E7D32", lineHeight: 1.5 }}>
              Questo evento è chiuso. Il conto resta leggibile e continua ad aggiornarsi se arrivano altre spese.
            </span>
            <Button variant="ghost" onClick={() => cambiaStato("programmato")} disabled={chiudendo}>Riapri</Button>
          </div>
        </Riquadro>
      ) : evento.stato !== "annullato" && (
        <Riquadro titolo="Chiusura" sfondo={problemi.length ? "#FDF8EC" : "#fff"} bordo={problemi.length ? "#EBD9AE" : CREAM_BORDER}>
          {problemi.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                Tutto quadra: la merce partita torna col venduto, le spese sono pagate e hanno un importo.
              </span>
              <Button onClick={() => cambiaStato("concluso")} disabled={chiudendo}>{chiudendo ? "Chiudo…" : "Chiudi l'evento"}</Button>
            </div>
          ) : (
            <>
              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#8A6D1D", lineHeight: 1.5, marginBottom: 6 }}>
                Prima di chiudere, {problemi.length === 1 ? "c'è una cosa" : `ci sono ${problemi.length} cose`} da guardare:
              </div>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
                {problemi.map((p, i) => (
                  <li key={i} style={{ ...fontBody, fontSize: 12, color: NAVY, lineHeight: 1.6 }}>{p}</li>
                ))}
              </ul>
              {chiedeConferma ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#8A6D1D", lineHeight: 1.5 }}>
                    Chiudo lo stesso? Il conto resterà com'è adesso.
                  </span>
                  <Button variant="ghost" onClick={() => setChiedeConferma(false)} disabled={chiudendo}>No, vado a sistemare</Button>
                  <Button onClick={() => cambiaStato("concluso")} disabled={chiudendo}>{chiudendo ? "Chiudo…" : "Sì, chiudi"}</Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setChiedeConferma(true)}>Chiudi l'evento lo stesso</Button>
              )}
            </>
          )}
        </Riquadro>
      )}

      {righeScartate.length > 0 && (
        <Riquadro titolo="Non torna" sfondo="#FBEBE9" bordo="#F0C8C2">
          <div style={{ ...fontBody, fontSize: 11.5, color: "#C0392B", lineHeight: 1.5, marginBottom: 6 }}>
            Quello che è partito meno quello che è tornato deve fare quello che si è venduto o regalato. Qui non torna:
          </div>
          {righeScartate.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, ...fontBody, fontSize: 12, color: "#C0392B", padding: "3px 0" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>
              <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                {r.scarto > 0 ? `${r.scarto} in meno del venduto` : `${-r.scarto} venduti più di quanti ne risultino partiti`}
              </span>
            </div>
          ))}
        </Riquadro>
      )}
    </div>
  );
}

const SEZIONI = [
  { v: "team", l: "Team" },
  { v: "materiali", l: "Materiali" },
  { v: "trasferimenti", l: "Trasferimenti" },
  { v: "hotel", l: "Hotel" },
  { v: "conto", l: "Conto" },
];

function SchedaEvento({ evento, location, persone, prodotti, bundleComponenti, categorieNome, hotel, onNuovaSpesa, onIndietro, onCambiato, onStockCambiato }) {
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
        {sezione === "materiali" && <SchedaMateriali eventoId={evento.id} evento={evento} prodotti={prodotti} onStockCambiato={onStockCambiato} />}
        {sezione === "trasferimenti" && <SchedaTrasferimenti eventoId={evento.id} team={team} />}
        {sezione === "hotel" && <SchedaHotel eventoId={evento.id} evento={evento} team={team} hotel={hotel} />}
        {sezione === "conto" && <SchedaConto evento={evento} prodotti={prodotti} bundleComponenti={bundleComponenti} categorieNome={categorieNome} onNuovaSpesa={onNuovaSpesa} onCambiato={onCambiato} />}
      </div>
    </>
  );
}

// --------------------------------------------------------------- la pagina

export default function GestioneEventi({ location = [], master = [], assistente = [], venditori = [], prodottiShop = [], bundleComponenti = [], costiCategorie = [], hotel = [], onBack, titolo = "Gestione eventi", eventoIniziale = null, onNuovaSpesa, onStockCambiato }) {
  const [eventi, setEventi] = useState(null);
  // `eventoIniziale` arriva da chi ci ha portati qui — oggi la barra
  // dell'evento nel calendario. Non e' uno stato che cambia da solo:
  // entrati, l'evento e' aperto, e da li' si naviga come sempre
  const [apertoId, setApertoId] = useState(eventoIniziale || null);
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

  // i nomi leggibili delle categorie di spesa: nel conto le uscite si
  // raggruppano per categoria, e "viaggi_corsi" non e' un titolo
  const categorieNome = useMemo(() => {
    const m = {};
    (costiCategorie || []).forEach((c) => { m[c.id] = c.nome; });
    return m;
  }, [costiCategorie]);

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
            bundleComponenti={bundleComponenti} categorieNome={categorieNome} onNuovaSpesa={onNuovaSpesa}
            onIndietro={() => setApertoId(null)}
            onCambiato={ricarica}
            onStockCambiato={onStockCambiato}
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
