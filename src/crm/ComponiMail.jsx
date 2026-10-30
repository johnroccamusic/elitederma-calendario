// COMPONI MAIL (Fase 4 del CRM, 30/10/2026): dalla lista contatti
// filtrata nasce una campagna. Si scrive il testo, si guarda come arriva,
// la si manda a se stessi, si congelano i destinatari, si spedisce.
//
// L'EDITOR E' IL BROWSER. Niente librerie: un'area `contentEditable` con
// i comandi che un'email sopporta davvero (grassetto, corsivo, titolo,
// elenco, link, immagine da indirizzo). L'HTML che ne esce e' quello che
// parte, dentro la cornice di tutte le mail dell'app (APRE_HTML) e con il
// piede fisso: chi scrive, da dove, perche' e il link per non ricevere
// piu'. L'anteprima a destra e' la STESSA funzione che usa il server
// (componiCampagna), cosi' quello che si vede e' quello che arriva.
//
// L'INVIO E' A LOTTI. La edge function crm-campagna-invia spedisce cento
// mail per chiamata e dice quanti ne restano; questa pagina la richiama
// finche' la coda e' vuota, con la barra che avanza. Se si chiude a meta',
// la campagna resta «in invio» e da «Campagne» si riprende da dove era:
// quelli gia' spediti non si rispediscono.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { Button } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, BG, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import { componiCampagna, SEGNAPOSTI_CAMPAGNA } from "../../supabase/functions/_shared/email.js";

export const STATI_CAMPAGNA = {
  bozza: "Bozza", pronta: "Pronta", in_invio: "In invio", inviata: "Inviata", annullata: "Annullata",
};

const VALORI_ANTEPRIMA = { nome: "Giulia", cognome: "Rossi", comune: "Roma", provincia: "ROMA", regione: "LAZIO", corso: "Microblading" };

export function dataOraIt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
const numero = (n) => Number(n || 0).toLocaleString("it-IT");

// il nome che una campagna prende da sola: i filtri, o la data
export function nomeProposto(riassunto) {
  const oggi = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  return riassunto ? `${riassunto} · ${oggi}` : `Campagna del ${oggi}`;
}

// l'elenco di chi e' rimasto fuori e perche', in una frase
export function fraseEsclusi(e) {
  if (!e) return "";
  const pezzi = [];
  if (e.senza_email) pezzi.push(`${numero(e.senza_email)} senza email`);
  if (e.disiscritti) pezzi.push(`${numero(e.disiscritti)} disiscritt${e.disiscritti === 1 ? "o" : "i"}`);
  if (e.da_verificare) pezzi.push(`${numero(e.da_verificare)} da verificare`);
  if (e.rimbalzate_prima) pezzi.push(`${numero(e.rimbalzate_prima)} con un rimbalzo in passato`);
  if (e.doppioni_email) pezzi.push(`${numero(e.doppioni_email)} con la stessa email di un altro`);
  return pezzi.length ? `Fuori: ${pezzi.join(", ")}.` : "Nessuno escluso.";
}

const TASTI_EDITOR = [
  { comando: "bold", testo: "G", titolo: "Grassetto", stile: { fontWeight: 800 } },
  { comando: "italic", testo: "C", titolo: "Corsivo", stile: { fontStyle: "italic" } },
  { comando: "formatBlock", valore: "h2", testo: "Titolo", titolo: "Titolo" },
  { comando: "formatBlock", valore: "p", testo: "Testo", titolo: "Paragrafo normale" },
  { comando: "insertUnorderedList", testo: "• Elenco", titolo: "Elenco puntato" },
];

function Editor({ htmlIniziale, onCambia, disabilitato }) {
  const area = useRef(null);
  const seminato = useRef(false);
  useEffect(() => {
    if (area.current && !seminato.current) { area.current.innerHTML = htmlIniziale || "<p></p>"; seminato.current = true; }
  }, [htmlIniziale]);
  const esegui = (comando, valore = null) => {
    area.current?.focus();
    try { document.execCommand(comando, false, valore); } catch { /* jsdom non ce l'ha: pazienza */ }
    onCambia(area.current?.innerHTML || "");
  };
  const link = () => {
    const url = window.prompt("Indirizzo del link (con https://):");
    if (url) esegui("createLink", url.trim());
  };
  const immagine = () => {
    const url = window.prompt("Indirizzo dell'immagine (con https://). Dev'essere già online: le mail non portano file.");
    if (url) esegui("insertImage", url.trim());
  };
  const segnaposto = (k) => esegui("insertText", `{${k}}`);
  const tasto = (p, i) => (
    <button key={i} type="button" title={p.titolo} disabled={disabilitato} onMouseDown={(e) => e.preventDefault()} onClick={p.onClick || (() => esegui(p.comando, p.valore ?? null))}
      style={{ ...fontBody, fontSize: 12, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 7, padding: "4px 9px", cursor: "pointer", ...(p.stile || {}) }}>
      {p.testo}
    </button>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
        {TASTI_EDITOR.map(tasto)}
        {tasto({ testo: "Link", titolo: "Inserisci un link", onClick: link }, "link")}
        {tasto({ testo: "Immagine", titolo: "Inserisci un'immagine da un indirizzo", onClick: immagine }, "img")}
        <span style={{ ...fontBody, fontSize: 11, color: MUTED, marginLeft: 6 }}>Segnaposti:</span>
        {SEGNAPOSTI_CAMPAGNA.map((k) => tasto({ testo: `{${k}}`, titolo: `Mette ${k} della persona`, onClick: () => segnaposto(k), stile: { color: GOLD, fontWeight: 700 } }, k))}
      </div>
      <div
        ref={area} contentEditable={!disabilitato} suppressContentEditableWarning data-editor
        onInput={() => onCambia(area.current?.innerHTML || "")}
        onBlur={() => onCambia(area.current?.innerHTML || "")}
        style={{ ...fontBody, fontSize: 14.5, lineHeight: 1.55, color: NAVY, minHeight: 260, padding: "12px 14px", background: disabilitato ? "#FAF8F3" : "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, outline: "none", overflowWrap: "anywhere" }}
      />
    </div>
  );
}

export default function ComponiMail({ campagnaIniziale = null, filtri = {}, riassunto = "", totale = 0, utente = "", onChiudi, onSalvata, onSelezionaDestinatari = null, messaggioIniziale = null }) {
  const [campagna, setCampagna] = useState(campagnaIniziale);
  const [nome, setNome] = useState(campagnaIniziale?.nome || nomeProposto(riassunto));
  const [oggetto, setOggetto] = useState(campagnaIniziale?.oggetto || "");
  const [corpoHtml, setCorpoHtml] = useState(campagnaIniziale?.corpo_html || "");
  const [societa, setSocieta] = useState(null);
  const [msg, setMsg] = useState(messaggioIniziale);   // { tipo: "ok" | "errore", testo }
  const [salvando, setSalvando] = useState(false);
  const [preparazione, setPreparazione] = useState(null);
  const [invio, setInvio] = useState(null); // { inCorso, inviate, fallite, restanti, totale }
  const fermati = useRef(false);

  useEffect(() => {
    supabase.from("intestazione_societa").select("nome, indirizzo, indirizzo_2").limit(1).maybeSingle().then(({ data }) => setSocieta(data || null));
  }, []);
  // una campagna gia' esistente si rilegge dal database: conteggi e stato veri
  useEffect(() => {
    if (!campagnaIniziale?.id) return;
    supabase.from("crm_campagne").select("*").eq("id", campagnaIniziale.id).maybeSingle().then(({ data }) => { if (data) setCampagna(data); });
  }, [campagnaIniziale?.id]);

  const stato = campagna?.stato || "bozza";
  const bloccata = stato === "inviata" || stato === "annullata" || stato === "in_invio";
  const anteprima = useMemo(() => componiCampagna({
    oggetto, corpoHtml, valori: VALORI_ANTEPRIMA, societa, linkDisiscrizione: "#anteprima",
  }), [oggetto, corpoHtml, societa]);

  // la campagna si scrive al primo gesto che ne ha bisogno, non all'apertura:
  // chi apre e chiude senza scrivere niente non lascia bozze in giro
  async function assicuraCampagna() {
    const campi = { nome: nome.trim() || nomeProposto(riassunto), oggetto: oggetto.trim(), corpo_html: corpoHtml, aggiornata_il: new Date().toISOString() };
    if (campagna?.id) {
      const { data, error } = await supabase.from("crm_campagne").update(campi).eq("id", campagna.id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      setCampagna(data); return data;
    }
    const { data, error } = await supabase.from("crm_campagne")
      .insert({ ...campi, filtri: filtri || {}, riassunto_filtri: riassunto || null, creata_da: utente || null })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    setCampagna(data); onSalvata?.(data); return data;
  }

  async function salva() {
    setSalvando(true); setMsg(null);
    try { await assicuraCampagna(); setMsg({ tipo: "ok", testo: "Bozza salvata." }); }
    catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
    setSalvando(false);
  }

  async function prova() {
    if (!oggetto.trim() || !corpoHtml.replace(/<[^>]+>/g, "").trim()) { setMsg({ tipo: "errore", testo: "Scrivi oggetto e testo prima della prova." }); return; }
    const a = window.prompt("A quale indirizzo mando la prova?", campagna?.prova_inviata_a || "");
    if (!a) return;
    setSalvando(true); setMsg(null);
    try {
      const c = await assicuraCampagna();
      const { data, error } = await supabase.functions.invoke("crm-campagna-invia", { body: { campagna_id: c.id, prova: { a: a.trim() } } });
      if (error || !data?.ok) throw new Error(data?.errore || error?.message || "Invio di prova non riuscito.");
      setMsg({ tipo: "ok", testo: `Prova mandata a ${data.prova}. Guarda com'è arrivata prima di spedire.` });
      setCampagna((x) => ({ ...(x || c), prova_inviata_a: data.prova, prova_inviata_il: new Date().toISOString() }));
    } catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
    setSalvando(false);
  }

  async function prepara() {
    setSalvando(true); setMsg(null);
    try {
      const c = await assicuraCampagna();
      const { data, error } = await supabase.rpc("crm_campagna_prepara", { p_campagna: c.id });
      if (error) throw new Error(error.message);
      setPreparazione(data);
      const { data: agg } = await supabase.from("crm_campagne").select("*").eq("id", c.id).maybeSingle();
      if (agg) setCampagna(agg);
      setMsg({ tipo: "ok", testo: `Destinatari pronti: ${numero((agg || c).totale_destinatari)}. ${fraseEsclusi(data)}` });
    } catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
    setSalvando(false);
  }

  // I DESTINATARI SI SCELGONO ANCHE DOPO. Si puo' scrivere prima e decidere
  // poi a chi mandare: il tasto porta alla lista contatti con i filtri
  // della campagna gia' accesi, e «Usa questi N contatti» li congela. La
  // campagna si salva prima di uscire, cosi' il testo non si perde.
  async function scegliDestinatari() {
    setSalvando(true); setMsg(null);
    try { const c = await assicuraCampagna(); onSelezionaDestinatari?.(c); }
    catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
    setSalvando(false);
  }

  // «Cancella destinatari»: si svuota la coda e la campagna torna bozza.
  // Quelli gia' spediti non si toccano: una mail partita e' partita.
  async function cancellaDestinatari() {
    if (!campagna?.id) return;
    if (!window.confirm(`Togliere i ${numero(campagna.totale_destinatari)} destinatari in coda? Il testo resta, la campagna torna in bozza e i destinatari si scelgono di nuovo.`)) return;
    setSalvando(true); setMsg(null);
    try {
      const { error } = await supabase.from("crm_campagne_destinatari").delete().eq("campagna_id", campagna.id).eq("stato", "in_coda");
      if (error) throw new Error(error.message);
      const { count } = await supabase.from("crm_campagne_destinatari").select("id", { count: "exact", head: true }).eq("campagna_id", campagna.id);
      const campi = { totale_destinatari: count || 0, esclusi: {}, aggiornata_il: new Date().toISOString(), ...(count ? {} : { stato: "bozza" }) };
      const { data, error: e2 } = await supabase.from("crm_campagne").update(campi).eq("id", campagna.id).select("*").maybeSingle();
      if (e2) throw new Error(e2.message);
      setCampagna(data); setPreparazione(null);
      setMsg({ tipo: "ok", testo: "Destinatari tolti. Il testo è salvato: scegli a chi mandarla quando vuoi." });
    } catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
    setSalvando(false);
  }

  async function invia() {
    const c = campagna;
    if (!c?.id || !c.totale_destinatari) { setMsg({ tipo: "errore", testo: "Prima prepara i destinatari." }); return; }
    if (!oggetto.trim()) { setMsg({ tipo: "errore", testo: "Manca l'oggetto." }); return; }
    if (!window.confirm(`Spedire «${oggetto.trim()}» a ${numero(c.totale_destinatari)} destinatari?\n\nOgni mail porta il link per disiscriversi. Una volta partita non si ferma quella già consegnata.`)) return;
    setSalvando(true); setMsg(null); fermati.current = false;
    try {
      const salvata = await assicuraCampagna();
      let inviate = 0, fallite = 0, restanti = salvata.totale_destinatari;
      setInvio({ inCorso: true, inviate, fallite, restanti, totale: salvata.totale_destinatari });
      for (let giro = 0; giro < 10000 && !fermati.current; giro++) {
        const { data, error } = await supabase.functions.invoke("crm-campagna-invia", { body: { campagna_id: salvata.id, lotto: 100 } });
        if (error || (!data?.ok && !data?.stato)) throw new Error(data?.errore || error?.message || "Invio interrotto.");
        inviate += data.inviate || 0; fallite += data.fallite || 0; restanti = data.restanti || 0;
        setInvio({ inCorso: restanti > 0, inviate, fallite, restanti, totale: salvata.totale_destinatari });
        if (!data.ok) throw new Error(data.errore || "Resend ha rifiutato un lotto.");
        if (!restanti) break;
      }
      const { data: agg } = await supabase.from("crm_campagne").select("*").eq("id", salvata.id).maybeSingle();
      if (agg) setCampagna(agg);
      setMsg(fallite
        ? { tipo: "errore", testo: `Spedite ${numero(inviate)}, non riuscite ${numero(fallite)}. Le non riuscite restano segnate nei destinatari.` }
        : { tipo: "ok", testo: `Spedite ${numero(inviate)} mail. Consegne, aperture e rimbalzi arrivano da soli nelle prossime ore.` });
    } catch (e) {
      setMsg({ tipo: "errore", testo: `${e.message} La campagna resta «in invio»: da Campagne si riprende da dove era.` });
      setInvio((x) => x ? { ...x, inCorso: false } : x);
    }
    setSalvando(false);
  }

  const etichetta = { ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 3 };

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <button type="button" onClick={onChiudi} style={{ ...fontBody, fontSize: 13, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>← Contatti</button>
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{campagna?.id ? "Campagna" : "Componi mail"}</div>
          <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: stato === "inviata" ? "#2E7D32" : stato === "in_invio" ? "#8A6D1D" : GRAFITE, background: "#F3F0E8", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "3px 10px" }}>
            {STATI_CAMPAGNA[stato] || stato}
          </span>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
          {campagna?.riassunto_filtri || riassunto
            ? <>Destinatari dai filtri: <b style={{ color: NAVY }}>{campagna?.riassunto_filtri || riassunto}</b>{!campagna?.totale_destinatari && totale ? ` · ${numero(totale)} contatti in lista` : ""}</>
            : "Destinatari: tutti i contatti in archivio con un'email."}
          {campagna?.totale_destinatari ? ` · ${numero(campagna.totale_destinatari)} destinatari pronti` : ""}
          {campagna?.creata_da ? ` · scritta da ${campagna.creata_da}` : ""}
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
          {/* a sinistra si scrive */}
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <label>
              <span style={etichetta}>Nome della campagna (solo per voi)</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={bloccata} style={{ ...inputStyle, width: "100%", minWidth: 0 }} />
            </label>
            <label>
              <span style={etichetta}>Oggetto</span>
              <input value={oggetto} onChange={(e) => setOggetto(e.target.value)} disabled={bloccata} placeholder="Es. {nome}, a novembre il corso Microblading arriva a {comune}" style={{ ...inputStyle, width: "100%", minWidth: 0 }} data-oggetto />
            </label>
            <div>
              <span style={etichetta}>Testo</span>
              <Editor htmlIniziale={campagnaIniziale?.corpo_html || ""} onCambia={setCorpoHtml} disabilitato={bloccata} />
              <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                In fondo a ogni mail vanno da soli chi siamo, perché la persona la riceve e il link per non riceverne più: non si tolgono.
              </div>
            </div>
            {msg && (
              <div style={{ ...fontBody, fontSize: 12.5, lineHeight: 1.55, borderRadius: 10, padding: "9px 11px", color: msg.tipo === "errore" ? "#C0392B" : "#2E7D32", background: msg.tipo === "errore" ? "#FBEBE9" : "#EAF5EA", border: `1px solid ${msg.tipo === "errore" ? "#F0C8C2" : "#C7E3C7"}` }} data-messaggio>
                {msg.testo}
              </div>
            )}
            {invio && (
              <div style={{ ...fontBody, fontSize: 12.5, color: NAVY }}>
                <div style={{ height: 10, background: BG, borderRadius: 999, overflow: "hidden", marginBottom: 5 }}>
                  <div style={{ width: `${invio.totale ? Math.round(((invio.inviate + invio.fallite) / invio.totale) * 100) : 0}%`, height: "100%", background: invio.fallite ? "#C0392B" : "#2E7D32", transition: "width .3s" }} />
                </div>
                {invio.inCorso ? "Spedisco… " : ""}{numero(invio.inviate)} spedite{invio.fallite ? `, ${numero(invio.fallite)} non riuscite` : ""}, {numero(invio.restanti)} in coda su {numero(invio.totale)}
                {invio.inCorso && <button type="button" onClick={() => { fermati.current = true; }} style={{ ...fontBody, fontSize: 12, color: "#C0392B", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}>Ferma dopo questo lotto</button>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {!bloccata && <Button variant="ghost" onClick={salva} disabled={salvando}>Salva bozza</Button>}
              {!bloccata && <Button variant="ghost" onClick={prova} disabled={salvando}>Mandami una prova</Button>}
              {!bloccata && onSelezionaDestinatari && <Button variant="ghost" onClick={scegliDestinatari} disabled={salvando} title="Scegli dalla lista contatti, con i filtri">Seleziona destinatari</Button>}
              {!bloccata && <Button variant="ghost" onClick={prepara} disabled={salvando} title={campagna?.riassunto_filtri || riassunto ? `Con i filtri: ${campagna?.riassunto_filtri || riassunto}` : "Tutti i contatti con un'email"}>{campagna?.totale_destinatari ? "Rifai i destinatari" : "Prepara i destinatari"}</Button>}
              {!bloccata && campagna?.totale_destinatari > 0 && <Button variant="danger" onClick={cancellaDestinatari} disabled={salvando}>Cancella destinatari</Button>}
              {stato !== "inviata" && stato !== "annullata" && (
                <Button onClick={invia} disabled={salvando || !campagna?.totale_destinatari || invio?.inCorso}>
                  {stato === "in_invio" ? "Riprendi l'invio" : `Invia${campagna?.totale_destinatari ? ` a ${numero(campagna.totale_destinatari)}` : ""}`}
                </Button>
              )}
            </div>
            {preparazione && !msg && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{fraseEsclusi(preparazione)}</div>}
            {campagna?.prova_inviata_a && <div style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>Ultima prova a {campagna.prova_inviata_a}{campagna.prova_inviata_il ? ` il ${dataOraIt(campagna.prova_inviata_il)}` : ""}.</div>}
          </div>

          {/* a destra si vede com'e' */}
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 16 }}>
            <span style={etichetta}>Come arriva (con un nome di prova)</span>
            <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 10, overflowWrap: "anywhere" }} data-anteprima-oggetto>{anteprima.oggetto || "(senza oggetto)"}</div>
            <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, background: "#FCFBF8", overflowX: "auto" }} data-anteprima
              dangerouslySetInnerHTML={{ __html: anteprima.html }} />
            {campagna?.id && (campagna.inviate > 0 || campagna.fallite > 0) && (
              <div style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, marginTop: 12, lineHeight: 1.6 }}>
                <b style={{ color: NAVY }}>Com'è andata:</b> {numero(campagna.inviate)} spedite{campagna.fallite ? `, ${numero(campagna.fallite)} non riuscite` : ""} su {numero(campagna.totale_destinatari)}.
                {campagna.inviata_il ? ` Finita il ${dataOraIt(campagna.inviata_il)}.` : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------- le campagne fatte

export function ElencoCampagne({ onApri, onChiudi }) {
  const [campagne, setCampagne] = useState(null);
  const [esiti, setEsiti] = useState({});
  useEffect(() => {
    supabase.from("crm_campagne").select("*").order("creata_il", { ascending: false }).limit(200)
      .then(({ data }) => setCampagne(Array.isArray(data) ? data : []));
  }, []);
  // consegne, aperture e rimbalzi, contati dai destinatari
  useEffect(() => {
    if (!campagne?.length) return;
    supabase.from("crm_campagne_destinatari").select("campagna_id, stato").in("campagna_id", campagne.map((c) => c.id)).limit(100000)
      .then(({ data }) => {
        const per = {};
        (data || []).forEach((d) => { const e = (per[d.campagna_id] ||= {}); e[d.stato] = (e[d.stato] || 0) + 1; });
        setEsiti(per);
      });
  }, [campagne]);
  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" onClick={onChiudi} style={{ ...fontBody, fontSize: 13, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>← Contatti</button>
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Campagne</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "4px 16px" }}>
          {campagne === null && <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 0" }}>Carico…</div>}
          {campagne?.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 0" }}>Nessuna campagna ancora. Si parte da «Componi mail» nella lista contatti.</div>}
          {(campagne || []).map((c) => {
            const e = esiti[c.id] || {};
            const consegnate = (e.consegnata || 0) + (e.aperta || 0);
            return (
              <div key={c.id} onClick={() => onApri(c)} role="button" style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, cursor: "pointer", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }} data-campagna={c.id}>
                <span style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <span style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>{c.nome}</span>
                  <span style={{ display: "block", ...fontBody, fontSize: 11.5, color: MUTED }}>{c.oggetto || "(senza oggetto)"} · {dataOraIt(c.creata_il)}{c.creata_da ? ` · ${c.creata_da}` : ""}</span>
                </span>
                <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: c.stato === "inviata" ? "#2E7D32" : c.stato === "in_invio" ? "#8A6D1D" : GRAFITE, background: "#F3F0E8", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "3px 10px" }}>{STATI_CAMPAGNA[c.stato] || c.stato}</span>
                <span style={{ ...fontBody, fontSize: 12, color: GRAFITE, whiteSpace: "nowrap" }}>
                  {numero(c.totale_destinatari)} destinatari · {numero(c.inviate)} spedite
                  {consegnate ? ` · ${numero(consegnate)} consegnate` : ""}{e.aperta ? ` · ${numero(e.aperta)} aperte` : ""}
                  {e.rimbalzata ? ` · ${numero(e.rimbalzata)} rimbalzate` : ""}{c.fallite ? ` · ${numero(c.fallite)} non riuscite` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
