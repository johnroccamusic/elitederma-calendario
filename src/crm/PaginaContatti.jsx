// CONTATTI (Fase 4 del CRM, 30/10/2026): tutti quelli che hanno scritto a
// Elitederma, importati da Vetta — anche gli scartati, chi non ha risposto,
// chi ha risposto e non ha chiuso. Una persona, molte richieste: il
// contatto e' uno, e sotto ha la cronologia di quello che ha chiesto.
//
// La lista non si carica nel browser: sono 23.757 contatti e 23.847
// richieste. Ogni cambio di filtro chiede al database UNA pagina e il
// totale (`crm_cerca_contatti`), e il conteggio in cima e' quello vero.
// I filtri di periodo e di corso lavorano sulle richieste, non sul
// contatto: "chi ha chiesto Microblading nel 2025" e' chi ha almeno una
// richiesta cosi'.
//
// Chi si e' disiscritto resta in archivio con la data: di default e' fuori
// dai risultati, e col filtro «Disiscritti» si vedono solo loro. Dalle
// campagne e' fuori sempre, qualunque filtro ci sia.
//
// LA DATA NON E' SEMPRE VERA. 16.327 record su 23.847 sono nati in Vetta il
// 9 marzo 2026, il giorno del caricamento in blocco: la loro data e' quella,
// non quella della richiesta, e Vetta non ne conserva un'altra. Quelle
// richieste si mostrano come «data non nota», e il filtro per anno le
// ignora e guarda anche le vendite (che una data vera ce l'hanno):
// «2024» e' chi ha chiesto nel 2024 con data certa, o ha comprato nel 2024.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import SelettorePeriodo, { etichettaPeriodo } from "../ui/SelettorePeriodo.jsx";

export const PER_PAGINA = 50;

// le qualifiche di Vetta, come si leggono qui
export const QUALIFICHE = {
  CLIENTI: "Cliente",
  CONTATTI_SCARTATI: "Scartato",
  CONTATTI_DA_RICHIAMARE: "Da richiamare",
  NUOVI_CONTATTI: "Nuovo",
  DA_ASSENGNARE: "Da assegnare",
};
export const STATI = {
  venduto: "Venduto",
  in_trattativa: "In trattativa",
  nessuna: "Nessuna trattativa",
};
export const COLLEGAMENTI = {
  certo: "Collegato a Genion",
  dubbio: "Collegamento dubbio",
  nessuno: "Non in Genion",
};
export const etichettaQualifica = (q) => QUALIFICHE[q] || (q ? q.replace(/_/g, " ").toLowerCase() : "—");
export const etichettaStato = (s) => STATI[s] || s || "—";

const FILTRI_VUOTI = {
  cerca: "", anno: "", dal: "", al: "", corso: "", regione: "", provincia: "", comune: "",
  qualifica: "", stato: "", trattato_da: "", mestiere: "", collegamento: "",
  disiscritti: false, da_verificare: false, con_email: false, senza_data: false,
};

// "03/2024 Microblading · 05/2025 Laminazione": la storia di una persona
// in una riga, in ordine di tempo. Ogni richiesta porta i suoi corsi; una
// richiesta senza corso riconosciuto dice "richiesta" e basta.
export function cronologiaRichieste(richieste) {
  return [...(richieste || [])]
    .sort((a, b) => String(a.richiesta_il || "").localeCompare(String(b.richiesta_il || "")))
    .map((r) => `${r.data_certa === false ? "data non nota" : meseAnno(r.richiesta_il)} ${(r.corsi || []).length ? r.corsi.join(", ") : "richiesta"}`)
    .join(" · ");
}

export function meseAnno(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const p = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "2-digit", year: "numeric" }).formatToParts(d);
  const prendi = (t) => p.find((x) => x.type === t)?.value || "";
  return `${prendi("month")}/${prendi("year")}`;
}

export function dataIt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

// Le frasi che riassumono i filtri accesi: servono in testa alla lista e
// daranno il nome alla campagna ("Microblading · Lazio · 2025").
export function riassuntoFiltri(f) {
  const pezzi = [];
  if (f.cerca) pezzi.push(`«${f.cerca}»`);
  if (f.corso) pezzi.push(f.corso);
  if (f.anno) pezzi.push(String(f.anno));
  if (f.dal || f.al) pezzi.push(etichettaPeriodo(f.dal, f.al || f.dal));
  if (f.comune) pezzi.push(f.comune);
  else if (f.provincia) pezzi.push(f.provincia);
  else if (f.regione) pezzi.push(f.regione);
  if (f.qualifica) pezzi.push(etichettaQualifica(f.qualifica));
  if (f.stato) pezzi.push(etichettaStato(f.stato));
  if (f.trattato_da) pezzi.push(`trattati da ${f.trattato_da}`);
  if (f.mestiere) pezzi.push(f.mestiere);
  if (f.collegamento) pezzi.push(COLLEGAMENTI[f.collegamento] || f.collegamento);
  if (f.da_verificare) pezzi.push("da verificare");
  if (f.con_email) pezzi.push("con email");
  if (f.senza_data) pezzi.push("data non nota");
  if (f.disiscritti) pezzi.push("disiscritti");
  return pezzi.join(" · ");
}

// quello che si manda al database: solo le chiavi piene
export function filtriPerIlDatabase(f) {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === "" || v == null || v === false) continue;
    out[k] = v;
  }
  return out;
}

function useIsMobile(limite = 700) {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= limite);
  useEffect(() => {
    const agg = () => setMobile(window.innerWidth <= limite);
    window.addEventListener("resize", agg);
    return () => window.removeEventListener("resize", agg);
  }, [limite]);
  return mobile;
}

const numero = (n) => Number(n || 0).toLocaleString("it-IT");

function Pastiglia({ children, colore = GRAFITE, sfondo = "#F3F0E8", bordo = CREAM_BORDER, titolo }) {
  return (
    <span title={titolo} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: colore, background: sfondo, border: `1px solid ${bordo}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function PastigliaStato({ stato }) {
  if (stato === "venduto") return <Pastiglia colore="#2E7D32" sfondo="#EAF5EA" bordo="#C7E3C7">Venduto</Pastiglia>;
  if (stato === "in_trattativa") return <Pastiglia colore="#8A6D1D" sfondo="#FDF8EC" bordo="#EBD9AE">In trattativa</Pastiglia>;
  return null;
}

function Tendina({ etichetta, valore, onCambia, opzioni, tutto = "Tutti", larghezza = 170, disabilitata = false }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, width: larghezza, minWidth: 0 }}>
      <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{etichetta}</span>
      <select value={valore} onChange={(e) => onCambia(e.target.value)} disabled={disabilitata} data-filtro={etichetta}
        style={{ ...inputStyle, padding: "7px 8px", fontSize: 12.5, width: "100%", minWidth: 0, opacity: disabilitata ? 0.6 : 1 }}>
        <option value="">{tutto}</option>
        {opzioni.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta || o.valore}{o.quanti != null ? ` (${numero(o.quanti)})` : ""}</option>)}
      </select>
    </label>
  );
}

function Spunta({ etichetta, valore, onCambia }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, ...fontBody, fontSize: 12.5, color: NAVY, cursor: "pointer" }}>
      <input type="checkbox" checked={!!valore} onChange={(e) => onCambia(e.target.checked)} style={{ width: 15, height: 15, margin: 0, accentColor: GOLD }} />
      {etichetta}
    </label>
  );
}

// ------------------------------------------------------- la scheda aperta

function SchedaContatto({ c, onCambiato }) {
  const [richieste, setRichieste] = useState(null);
  const [opportunita, setOpportunita] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let vivo = true;
    supabase.from("crm_richieste").select("id, richiesta_il, data_certa, corsi, corsi_vetta, canale, form_origine, trattato_da, qualifica, gestione_chiamata, citta_originale, comune, provincia, regione, preferenza_giorno, preferenza_ora")
      .eq("contatto_id", c.id).order("richiesta_il")
      .then(({ data, error }) => { if (vivo) setRichieste(error ? [] : data || []); });
    supabase.from("crm_contatti").select("opportunita, email_aggiuntive, telefoni_aggiuntivi").eq("id", c.id).maybeSingle()
      .then(({ data }) => { if (vivo) setOpportunita(data || { opportunita: [] }); });
    return () => { vivo = false; };
  }, [c.id]);

  async function disiscrivi(riattiva) {
    const frase = riattiva
      ? `Riattivare ${nomeDi(c)}? Tornerà a ricevere le campagne.`
      : `Segnare ${nomeDi(c)} come disiscritto? Non riceverà più nessuna campagna, finché qualcuno non lo riattiva da qui.`;
    if (!window.confirm(frase)) return;
    const campi = riattiva ? { disiscritto_il: null, disiscritto_come: null } : { disiscritto_il: new Date().toISOString(), disiscritto_come: "staff" };
    const { error } = await supabase.from("crm_contatti").update(campi).eq("id", c.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    onCambiato?.();
  }

  const riga = (etichetta, valore) => valore ? (
    <div style={{ display: "flex", gap: 8, ...fontBody, fontSize: 12.5, lineHeight: 1.5 }}>
      <span style={{ color: MUTED, minWidth: 110, flexShrink: 0 }}>{etichetta}</span>
      <span style={{ color: NAVY, overflowWrap: "anywhere" }}>{valore}</span>
    </div>
  ) : null;

  const luogo = [c.comune, c.provincia, c.regione].filter(Boolean).join(" · ");
  const originale = [c.citta_originale, c.provincia_originale, c.regione_originale].filter(Boolean).join(" · ");
  const opp = Array.isArray(opportunita?.opportunita) ? opportunita.opportunita : [];

  return (
    <div style={{ marginTop: 10, padding: 14, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>Chi è</div>
        {riga("Email", c.email)}
        {riga("Altre email", (opportunita?.email_aggiuntive || []).join(", "))}
        {riga("Telefono", c.telefono)}
        {riga("Altri telefoni", (opportunita?.telefoni_aggiuntivi || []).join(", "))}
        {riga("Mestiere", c.mestiere)}
        {riga("Settore", (c.settore || []).join(", "))}
        {riga("Dove", luogo)}
        {originale && originale !== luogo && riga("Scritto in Vetta", originale)}
        {c.luogo_nota && riga("Nota sul luogo", c.luogo_nota)}
        {riga("Canale", c.canale)}
        {riga("Origine", c.origine_contatto)}
        {riga("Trattato da", c.trattato_da)}
        {riga("Gestione chiamata", c.gestione_chiamata)}
        {c.nome_nota && riga("Nome", c.nome_nota)}
        {c.da_verificare && riga("Da verificare", c.da_verificare_motivo)}
        {c.collegamento_nota && riga("Collegamento", c.collegamento_nota)}
      </div>
      <div style={{ display: "grid", gap: 4, alignContent: "start" }}>
        <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>
          Le richieste {richieste ? `(${richieste.length})` : ""}
        </div>
        {richieste === null && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Carico…</div>}
        {richieste && richieste.length > 0 && (
          <div style={{ ...fontBody, fontSize: 12.5, color: NAVY, fontWeight: 700, marginBottom: 4 }} data-cronologia>{cronologiaRichieste(richieste)}</div>
        )}
        {(richieste || []).map((r) => (
          <div key={r.id} style={{ ...fontBody, fontSize: 12, color: GRAFITE, lineHeight: 1.5, padding: "4px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
            <b style={{ color: NAVY }}>{r.data_certa === false ? "Data non nota" : dataIt(r.richiesta_il)}</b>
            {r.data_certa === false && <span style={{ color: MUTED }} title="Caricata in Vetta il 9 marzo 2026 insieme a tutto lo storico: la data della richiesta non c'è"> (in Vetta dal {dataIt(r.richiesta_il)})</span>}
            {" · "}{(r.corsi || []).length ? r.corsi.join(", ") : (r.corsi_vetta || []).join(", ") || "senza corso"}
            {r.form_origine ? ` · ${r.form_origine}` : ""}
            {r.canale ? ` · ${r.canale}` : ""}
            {r.trattato_da ? ` · ${r.trattato_da}` : ""}
            {r.qualifica ? ` · ${etichettaQualifica(r.qualifica)}` : ""}
            {r.citta_originale ? ` · ${r.citta_originale}` : ""}
          </div>
        ))}
        {opp.length > 0 && (
          <>
            <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 10, marginBottom: 2 }}>Opportunità in Vetta ({opp.length})</div>
            {opp.map((o, i) => (
              <div key={o.vetta_id || i} style={{ ...fontBody, fontSize: 12, color: GRAFITE, lineHeight: 1.5 }}>
                <b style={{ color: o.stato === "CLOSED_WON" ? "#2E7D32" : NAVY }}>{o.stato === "CLOSED_WON" ? "Venduto" : "In trattativa"}</b>
                {o.corso ? ` · ${o.corso}` : ""}
                {o.importo != null ? ` · ${Number(o.importo).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : ""}
                {o.chiusa_il ? ` · ${dataIt(o.chiusa_il)}` : ""}
                {o.agganciata_per === "nome" ? " · agganciata per nome" : ""}
              </div>
            ))}
          </>
        )}
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {c.disiscritto_il
            ? <>
                <Pastiglia colore="#C0392B" sfondo="#FBEBE9" bordo="#F0C8C2">Disiscritto il {dataIt(c.disiscritto_il)}{c.disiscritto_come ? ` · ${c.disiscritto_come}` : ""}</Pastiglia>
                <Button variant="ghost" onClick={() => disiscrivi(true)} style={{ padding: "5px 10px", fontSize: 12 }}>Riattiva</Button>
              </>
            : <Button variant="ghost" onClick={() => disiscrivi(false)} style={{ padding: "5px 10px", fontSize: 12 }}>Segna come disiscritto</Button>}
          {msg && <span style={{ ...fontBody, fontSize: 12, color: "#C0392B" }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

export function nomeDi(c) {
  const n = [c.nome, c.cognome].filter(Boolean).join(" ").trim();
  return n || c.nome_originale || c.email || "(senza nome)";
}

// ----------------------------------------------------------------- la pagina

export default function PaginaContatti({ onBack, titolo = "Contatti", onComponiMail = null }) {
  const isMobile = useIsMobile();
  const [filtri, setFiltri] = useState(FILTRI_VUOTI);
  const [cercaScritto, setCercaScritto] = useState("");
  const [da, setDa] = useState(0);
  const [valori, setValori] = useState(null);
  const [esito, setEsito] = useState({ totale: null, righe: [] });
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState("");
  const [apertoId, setApertoId] = useState(null);
  const [giro, setGiro] = useState(0);
  const ultimaRichiesta = useRef(0);

  useEffect(() => {
    supabase.rpc("crm_filtri_valori").then(({ data, error }) => {
      if (error) { setErrore("Non riesco a leggere i filtri: " + error.message); return; }
      setValori(data || {});
    });
  }, []);

  // la ricerca libera aspetta che si smetta di scrivere
  useEffect(() => {
    const t = setTimeout(() => { setFiltri((f) => (f.cerca === cercaScritto ? f : { ...f, cerca: cercaScritto })); setDa(0); }, 300);
    return () => clearTimeout(t);
  }, [cercaScritto]);

  const filtriDb = useMemo(() => filtriPerIlDatabase(filtri), [filtri]);
  useEffect(() => {
    const n = ++ultimaRichiesta.current;
    setCaricando(true); setErrore("");
    supabase.rpc("crm_cerca_contatti", { filtri: filtriDb, da, quanti: PER_PAGINA }).then(({ data, error }) => {
      if (n !== ultimaRichiesta.current) return;   // e' arrivata prima una richiesta piu' nuova
      setCaricando(false);
      if (error) { setErrore("Non riesco a leggere i contatti: " + error.message); return; }
      setEsito({ totale: Number(data?.totale) || 0, righe: Array.isArray(data?.righe) ? data.righe : [] });
    });
  }, [filtriDb, da, giro]);

  const cambia = (k, v) => {
    setDa(0); setApertoId(null);
    setFiltri((f) => {
      const n = { ...f, [k]: v };
      // scegliendo la regione si azzerano provincia e comune, e cosi' via
      if (k === "regione") { n.provincia = ""; n.comune = ""; }
      if (k === "provincia") n.comune = "";
      if (k === "anno" && v) { n.dal = ""; n.al = ""; }
      if ((k === "dal" || k === "al") && v) n.anno = "";
      return n;
    });
  };
  const azzera = () => { setFiltri(FILTRI_VUOTI); setCercaScritto(""); setDa(0); setApertoId(null); };

  const province = useMemo(() => (valori?.province || []).filter((p) => !filtri.regione || p.regione === filtri.regione), [valori, filtri.regione]);
  const comuni = useMemo(() => (valori?.comuni || []).filter((c) => !filtri.provincia || c.provincia === filtri.provincia).filter((c) => filtri.provincia || !filtri.regione || province.some((p) => p.valore === c.provincia)), [valori, filtri.provincia, filtri.regione, province]);
  const riassunto = riassuntoFiltri(filtri);
  const filtriAccesi = Object.keys(filtriDb).length > 0;
  const totale = esito.totale;
  const fine = Math.min(da + PER_PAGINA, totale || 0);

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: isMobile ? "24px 16px 80px" : "32px 32px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <TastoLivelloPrecedente titolo="CRM" onClick={onBack} />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: isMobile ? 12 : 13.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          Chi ha scritto a Elitederma, importato da Vetta: una scheda a persona, con tutte le richieste sotto.
          {valori?.totale != null && ` In archivio ${numero(valori.totale)} contatti${valori.disiscritti ? `, di cui ${numero(valori.disiscritti)} disiscritti` : ""}.`}
          {valori?.senza_data > 0 && ` Per ${numero(valori.senza_data)} la data della richiesta non è nota: sono stati caricati in Vetta in blocco il 9 marzo 2026, e il filtro per anno li lascia fuori.`}
        </div>

        {/* I FILTRI. Periodo e corso guardano le richieste; il resto il
            contatto. Tutti insieme restringono, e il conteggio sotto e'
            quello del database, non della pagina. */}
        <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 12 : 16, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 220px", minWidth: 0 }}>
              <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Cerca</span>
              <input value={cercaScritto} onChange={(e) => setCercaScritto(e.target.value)} placeholder="nome, email, telefono, comune"
                style={{ ...inputStyle, padding: "7px 9px", fontSize: 12.5, width: "100%", minWidth: 0 }} />
            </label>
            {/* gli anni delle richieste con data certa e delle vendite:
                2022-2026, non solo l'anno del caricamento in Vetta */}
            <Tendina etichetta="Anno" larghezza={110} valore={filtri.anno} onCambia={(v) => cambia("anno", v)} opzioni={(valori?.anni || []).map((a) => ({ valore: String(a.valore), quanti: a.quanti }))} tutto="Tutti" />
            <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Periodo (dal → al)</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <SelettorePeriodo da={filtri.dal} a={filtri.al || filtri.dal} vuoto="Scegli le date"
                  onCambia={({ da: d, a }) => { setDa(0); setFiltri((f) => ({ ...f, dal: d, al: a, anno: "" })); }} />
                {(filtri.dal || filtri.al) && (
                  <button type="button" onClick={() => { cambia("dal", ""); cambia("al", ""); }} title="Togli il periodo"
                    style={{ ...fontBody, fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 4 }}>✕</button>
                )}
              </div>
            </label>
            <Tendina etichetta="Corso richiesto" valore={filtri.corso} onCambia={(v) => cambia("corso", v)} opzioni={valori?.corsi || []} />
            <Tendina etichetta="Regione" valore={filtri.regione} onCambia={(v) => cambia("regione", v)} opzioni={valori?.regioni || []} tutto="Tutte" />
            <Tendina etichetta="Provincia" valore={filtri.provincia} onCambia={(v) => cambia("provincia", v)} opzioni={province} tutto="Tutte" />
            <Tendina etichetta="Comune" valore={filtri.comune} onCambia={(v) => cambia("comune", v)} opzioni={comuni} tutto="Tutti" />
            <Tendina etichetta="Qualifica" valore={filtri.qualifica} onCambia={(v) => cambia("qualifica", v)} opzioni={(valori?.qualifiche || []).map((q) => ({ ...q, etichetta: etichettaQualifica(q.valore) }))} tutto="Tutte" />
            <Tendina etichetta="Stato trattativa" valore={filtri.stato} onCambia={(v) => cambia("stato", v)} opzioni={(valori?.stati || []).map((s) => ({ ...s, etichetta: etichettaStato(s.valore) }))} tutto="Tutti" />
            <Tendina etichetta="Trattato da" valore={filtri.trattato_da} onCambia={(v) => cambia("trattato_da", v)} opzioni={valori?.trattati_da || []} tutto="Chiunque" />
            <Tendina etichetta="Mestiere" valore={filtri.mestiere} onCambia={(v) => cambia("mestiere", v)} opzioni={valori?.mestieri || []} tutto="Tutti" />
            <Tendina etichetta="Genion" larghezza={180} valore={filtri.collegamento} onCambia={(v) => cambia("collegamento", v)} opzioni={Object.entries(COLLEGAMENTI).map(([valore, etichetta]) => ({ valore, etichetta }))} tutto="Tutti" />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <Spunta etichetta="Solo con email" valore={filtri.con_email} onCambia={(v) => cambia("con_email", v)} />
            <Spunta etichetta="Solo da verificare" valore={filtri.da_verificare} onCambia={(v) => cambia("da_verificare", v)} />
            <Spunta etichetta="Data non nota" valore={filtri.senza_data} onCambia={(v) => cambia("senza_data", v)} />
            <Spunta etichetta="Disiscritti" valore={filtri.disiscritti} onCambia={(v) => cambia("disiscritti", v)} />
            {filtriAccesi && (
              <button type="button" onClick={azzera} style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: GOLD, background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto" }}>
                Azzera i filtri
              </button>
            )}
          </div>
        </div>

        {/* IL CONTEGGIO, e il tasto per scrivere a chi e' in lista */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY }} data-conteggio>
            {totale == null ? "…" : `${numero(totale)} contatt${totale === 1 ? "o" : "i"}`}
            {caricando && <span style={{ ...fontBody, fontSize: 12, color: MUTED, marginLeft: 8 }}>aggiorno…</span>}
          </div>
          {riassunto && <span style={{ ...fontBody, fontSize: 12.5, color: GRAFITE }}>{riassunto}</span>}
          {onComponiMail && (
            <Button onClick={() => onComponiMail({ filtri: filtriDb, riassunto, totale })} disabled={!totale || filtri.disiscritti} style={{ marginLeft: "auto" }}>
              Componi mail
            </Button>
          )}
        </div>
        {errore && <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", marginBottom: 10 }}>{errore}</div>}

        {/* LA LISTA: una riga per contatto, la scheda si apre premendo */}
        <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? "4px 12px" : "6px 16px" }}>
          {totale === 0 && !caricando && <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 0" }}>Nessun contatto con questi filtri.</div>}
          {esito.righe.map((c) => {
            const aperto = apertoId === c.id;
            const luogo = c.comune || c.provincia || c.regione || (c.citta_originale ? `${c.citta_originale} (?)` : "");
            return (
              <div key={c.id} style={{ padding: "9px 0", borderTop: `1px solid ${CREAM_BORDER}` }} data-contatto={c.id}>
                <div onClick={() => setApertoId(aperto ? null : c.id)} role="button" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }}>
                  <span style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, overflowWrap: "anywhere" }}>{nomeDi(c)}</span>
                    <span style={{ display: "block", ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 1 }}>
                      {[luogo, c.mestiere, c.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: "2 1 240px", minWidth: 0 }}>
                    {(c.corsi_interesse || []).map((k) => <Pastiglia key={k} colore={NAVY} sfondo="#F3F0E8">{k}</Pastiglia>)}
                  </span>
                  <span style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", justifyContent: isMobile ? "flex-start" : "flex-end", flex: "1 1 220px", minWidth: 0 }}>
                    <Pastiglia>{etichettaQualifica(c.qualifica)}</Pastiglia>
                    <PastigliaStato stato={c.stato_trattativa} />
                    {c.collegamento === "certo" && <Pastiglia colore="#2E7D32" sfondo="#EAF5EA" bordo="#C7E3C7" titolo={c.collegamento_nota}>Genion</Pastiglia>}
                    {c.collegamento === "dubbio" && <Pastiglia colore="#8A6D1D" sfondo="#FDF8EC" bordo="#EBD9AE" titolo={c.collegamento_nota}>Genion?</Pastiglia>}
                    {c.da_verificare && <Pastiglia colore="#C0392B" sfondo="#FBEBE9" bordo="#F0C8C2" titolo={c.da_verificare_motivo}>da verificare</Pastiglia>}
                    {c.disiscritto_il && <Pastiglia colore="#C0392B" sfondo="#FBEBE9" bordo="#F0C8C2">disiscritto</Pastiglia>}
                    <span style={{ ...fontBody, fontSize: 11.5, color: MUTED, whiteSpace: "nowrap" }} title={c.con_data_certa === false ? "La data della richiesta non è nota: caricata in Vetta in blocco il 9 marzo 2026" : "Ultimo contatto"}>
                      {c.numero_richieste > 1 ? `${c.numero_richieste} richieste · ` : ""}
                      {c.con_data_certa === false ? (c.ultima_vendita_il ? `venduto ${dataIt(c.ultima_vendita_il)}` : "data non nota") : dataIt(c.ultimo_contatto_il)}
                      {c.trattato_da ? ` · ${c.trattato_da}` : ""}
                    </span>
                  </span>
                </div>
                {aperto && <SchedaContatto c={c} onCambiato={() => setGiro((g) => g + 1)} />}
              </div>
            );
          })}
        </div>

        {/* LE PAGINE */}
        {totale > PER_PAGINA && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => { setDa(Math.max(0, da - PER_PAGINA)); setApertoId(null); }} disabled={da === 0}>← Precedenti</Button>
            <span style={{ ...fontBody, fontSize: 12.5, color: GRAFITE }}>{numero(da + 1)}–{numero(fine)} di {numero(totale)}</span>
            <Button variant="ghost" onClick={() => { setDa(da + PER_PAGINA); setApertoId(null); }} disabled={fine >= totale}>Successivi →</Button>
          </div>
        )}
      </div>
    </div>
  );
}
