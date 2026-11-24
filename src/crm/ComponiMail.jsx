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
import { testoErroreFunzione } from "../errore-funzione.js";
import { Button } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, BG, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import { componiCampagna, SEGNAPOSTI_CAMPAGNA } from "../../supabase/functions/_shared/email.js";

export const STATI_CAMPAGNA = {
  bozza: "Bozza", pronta: "Pronta", in_invio: "In invio", inviata: "Inviata", annullata: "Annullata",
};
// lo stato di ogni destinatario: lo scrive la funzione d'invio (in coda,
// spedita, non riuscita) e poi il webhook di Resend (consegnata, aperta,
// rimbalzata, segnalata). «Aperta» arriva solo se su Resend il
// tracciamento delle aperture e' acceso sul dominio: lo e' dal 30/10/2026
// `in_spedizione` e' lo stato che `crm_campagna_prendi_lotto` scrive sulle
// cento righe che sta spedendo: dura dei secondi, ma va nominato comunque —
// una riga senza etichetta mostrerebbe la chiave grezza a chi guarda, e per
// quindici minuti (il tempo dopo cui torna in coda) e' quello che si legge
// se la pagina si chiude a meta' invio
export const STATI_DESTINATARIO = {
  in_coda: "in coda", in_spedizione: "in spedizione", inviata: "spedita",
  consegnata: "consegnata", aperta: "aperta",
  rimbalzata: "rimbalzata", segnalata: "segnalata come spam", fallita: "non riuscita",
};
export const COLORE_STATO_DESTINATARIO = {
  aperta: { colore: "#2E7D32", sfondo: "#EAF5EA", bordo: "#C7E3C7" },
  consegnata: { colore: "#1F4E8C", sfondo: "#EEF3FA", bordo: "#C9D7EC" },
  inviata: { colore: GRAFITE, sfondo: "#F3F0E8", bordo: CREAM_BORDER },
  in_coda: { colore: MUTED, sfondo: "#F7F6F2", bordo: CREAM_BORDER },
  in_spedizione: { colore: GRAFITE, sfondo: "#F7F6F2", bordo: CREAM_BORDER },
  rimbalzata: { colore: "#C0392B", sfondo: "#FBEBE9", bordo: "#F0C8C2" },
  segnalata: { colore: "#C0392B", sfondo: "#FBEBE9", bordo: "#F0C8C2" },
  fallita: { colore: "#C0392B", sfondo: "#FBEBE9", bordo: "#F0C8C2" },
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
  if (e.gia_ricevute) pezzi.push(`${numero(e.gia_ricevute)} che hanno già ricevuto un'altra campagna`);
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

export default function ComponiMail({ campagnaIniziale = null, filtri = {}, riassunto = "", totale = 0, utente = "", onChiudi, onSalvata, onSelezionaDestinatari = null, onApriCampagne = null, onUsaTesto = null, messaggioIniziale = null }) {
  const [campagna, setCampagna] = useState(campagnaIniziale);
  const [nome, setNome] = useState(campagnaIniziale?.nome || nomeProposto(riassunto));
  const [oggetto, setOggetto] = useState(campagnaIniziale?.oggetto || "");
  const [corpoHtml, setCorpoHtml] = useState(campagnaIniziale?.corpo_html || "");
  const [societa, setSocieta] = useState(null);
  const [msg, setMsg] = useState(messaggioIniziale);   // { tipo: "ok" | "errore", testo }
  const [salvando, setSalvando] = useState(false);
  const [preparazione, setPreparazione] = useState(null);
  const [invio, setInvio] = useState(null); // { inCorso, inviate, fallite, restanti, totale }
  // «ESCLUDI QUELLE GIA' SPEDITE» (24/11/2026, chiesto dal titolare per
  // dividere il pubblico a gruppi). La regola vive in
  // `crm_campagna_prepara`: qui si accende e si spegne, e si scrive nei
  // filtri della campagna perche' deve restare insieme a lei.
  // NASCE SPENTA: una campagna nuova, con un testo nuovo, deve poter
  // arrivare a tutti — accesa di suo salterebbe in silenzio chiunque
  // abbia ricevuto la mail di prima.
  const [escludiGiaSpedite, setEscludiGiaSpedite] = useState(!!campagnaIniziale?.filtri?.escludi_gia_spedite);
  const [giaServiti, setGiaServiti] = useState(null);   // quante mail risultano spedite in altre campagne
  const fermati = useRef(false);

  useEffect(() => {
    supabase.from("intestazione_societa").select("nome, indirizzo, indirizzo_2").limit(1).maybeSingle().then(({ data }) => setSocieta(data || null));
  }, []);

  // il numero accanto alla spunta: quante mail risultano GIA' SPEDITE in
  // altre campagne. Si chiede il conto al database (`head: true`) e non le
  // righe: sono decine di migliaia, e PostgREST ne servirebbe mille
  useEffect(() => {
    let vivo = true;
    (async () => {
      let q = supabase.from("crm_campagne_destinatari").select("id", { count: "exact", head: true })
        .in("stato", ["inviata", "consegnata", "aperta"]);
      if (campagna?.id) q = q.neq("campagna_id", campagna.id);
      const { count } = await q;
      if (vivo) setGiaServiti(typeof count === "number" ? count : null);
    })();
    return () => { vivo = false; };
  }, [campagna?.id]);
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
    // i filtri si riscrivono perche' la spunta «escludi quelle gia'
    // spedite» vive la' dentro: la legge `crm_campagna_prepara`, che e'
    // l'unico posto in cui si decide chi entra fra i destinatari
    const filtriVivi = { ...(campagna?.filtri || filtri || {}), escludi_gia_spedite: escludiGiaSpedite };
    const campi = { nome: nome.trim() || nomeProposto(riassunto), oggetto: oggetto.trim(), corpo_html: corpoHtml, filtri: filtriVivi, aggiornata_il: new Date().toISOString() };
    if (campagna?.id) {
      const { data, error } = await supabase.from("crm_campagne").update(campi).eq("id", campagna.id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      setCampagna(data); return data;
    }
    const { data, error } = await supabase.from("crm_campagne")
      .insert({ ...campi, riassunto_filtri: riassunto || null, creata_da: utente || null })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    setCampagna(data); onSalvata?.(data); return data;
  }

  // SALVARE UNA CAMPAGNA NON E' SALVARE UNA BOZZA (24/11/2026, il
  // titolare: «un tasto salva campagna, che non e' bozza»). Una campagna a
  // meta' invio e' una cosa viva, e il tasto deve dire dove la si ritrova:
  // l'area «Campagne» tiene anche quelle sospese, da cui si rientra e si
  // finisce la spedizione.
  async function salva() {
    setSalvando(true); setMsg(null);
    try {
      const c = await assicuraCampagna();
      setMsg({ tipo: "ok", testo: `Campagna salvata${c?.nome ? `: «${c.nome}»` : ""}. La ritrovi in «Campagne», anche a invio sospeso.` });
    } catch (e) { setMsg({ tipo: "errore", testo: e.message }); }
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
      if (error || !data?.ok) throw new Error(data?.errore || (error ? await testoErroreFunzione(error) : "Invio di prova non riuscito."));
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
      let rifiutiDiFila = 0;
      setInvio({ inCorso: true, inviate, fallite, restanti, totale: salvata.totale_destinatari });
      for (let giro = 0; giro < 10000 && !fermati.current; giro++) {
        const { data, error } = await supabase.functions.invoke("crm-campagna-invia", { body: { campagna_id: salvata.id, lotto: 100 } });
        // rifiuto TEMPORANEO di Resend (limite di velocita', servizio giu'): le
        // righe sono tornate in coda, si aspetta e si riprova; dopo cinque
        // volte di fila ci si ferma e la campagna si riprende da Campagne
        if (data?.temporaneo) {
          if (++rifiutiDiFila >= 5) throw new Error(data.errore || "Resend non risponde.");
          setInvio((x) => x ? { ...x, restanti: data.restanti ?? x.restanti, attendo: true } : x);
          await new Promise((ok) => setTimeout(ok, (data.riprova_tra || 20) * 1000));
          continue;
        }
        rifiutiDiFila = 0;
        // un'altra chiamata sta spedendo le righe rimaste: si aspetta
        if (data?.attesa) { await new Promise((ok) => setTimeout(ok, 3000)); continue; }
        // il motivo vero sta nel CORPO della risposta, non in error.message:
        // «Edge Function returned a non-2xx status code» ha mandato a cercare
        // un guasto nella funzione quando era il database a rifiutare (24/11)
        if (error || (!data?.ok && !data?.stato)) throw new Error(data?.errore || (error ? await testoErroreFunzione(error) : "Invio interrotto."));
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
            {/* IL FILTRO IN PIU', chiesto il 24/11/2026: dividere il pubblico a
                gruppi senza riscrivere a chi e' gia' stato servito. Dentro la
                STESSA campagna il doppione era gia' impossibile, e la riga
                sotto lo dice: la paura era quella, e una spunta non la toglie
                se nessuno spiega come funziona. */}
            {!bloccata && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", background: "#FCFBF8", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 11px" }} data-escludi-gia-spedite>
                <input type="checkbox" checked={escludiGiaSpedite} onChange={(e) => setEscludiGiaSpedite(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, flex: "0 0 auto" }} />
                <span style={{ ...fontBody, fontSize: 12.5, color: NAVY, lineHeight: 1.5 }}>
                  <b>Escludi quelle già spedite</b>
                  {giaServiti ? <span style={{ color: MUTED }}> — {numero(giaServiti)} mail già spedite in altre campagne</span> : null}
                  <span style={{ display: "block", color: MUTED, fontSize: 11.5 }}>
                    Chi ha già ricevuto un’altra campagna resta fuori quando prepari i destinatari. Serve a mandarla a gruppi.
                    Dentro <i>questa</i> campagna non serve: chi ha già ricevuto è segnato uno per uno, e riprendendo l’invio non riceve due volte.
                  </span>
                </span>
              </label>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {!bloccata && <Button variant="ghost" onClick={salva} disabled={salvando}>Salva campagna</Button>}
              {onApriCampagne && <Button variant="ghost" onClick={onApriCampagne} disabled={invio?.inCorso} title="Le campagne in corso, anche sospese: da lì si rientra e si finisce">Campagne</Button>}
              {/* su una campagna CHIUSA in scrittura (in invio, spedita,
                  annullata) il testo si legge e non si tocca: l'unico modo
                  di riusarlo e' portarselo in una campagna nuova, e il
                  tasto sta qui perche' qui il testo si ha davanti */}
              {bloccata && onUsaTesto && campagna?.id && (
                <Button variant="ghost" onClick={() => onUsaTesto(campagna)} disabled={invio?.inCorso} title="Scrive una campagna nuova con questo oggetto e questo testo, da mandare a un altro gruppo" data-usa-testo-qui>
                  Usa questo testo
                </Button>
              )}
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
        {campagna?.id && campagna.totale_destinatari > 0 && <DestinatariCampagna campagnaId={campagna.id} aggiornamento={(campagna.inviate || 0) + (invio?.inviate || 0)} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------- chi ha ricevuto cosa

// I DESTINATARI DI UNA CAMPAGNA, uno per uno, con il loro stato. E' qui
// che si risponde a «chi ha aperto?»: si sceglie lo stato in alto (le
// aperte, le rimbalzate, quelle ancora in coda) e si cerca per nome o
// email. Cinquanta alla volta, dal database, come la lista contatti.
const PER_PAGINA_DESTINATARI = 50;
export function DestinatariCampagna({ campagnaId, aggiornamento = 0 }) {
  const [statoScelto, setStatoScelto] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [cercaScritto, setCercaScritto] = useState("");
  const [da, setDa] = useState(0);
  const [conteggi, setConteggi] = useState(null);
  const [righe, setRighe] = useState([]);
  const [totale, setTotale] = useState(0);
  const [aperto, setAperto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setCerca(cercaScritto.trim()); setDa(0); }, 300);
    return () => clearTimeout(t);
  }, [cercaScritto]);
  useEffect(() => {
    if (!campagnaId || !aperto) return;
    let vivo = true;
    Promise.all(Object.keys(STATI_DESTINATARIO).map((st) =>
      supabase.from("crm_campagne_destinatari").select("id", { count: "exact", head: true }).eq("campagna_id", campagnaId).eq("stato", st)
        .then(({ count }) => [st, count || 0]),
    )).then((coppie) => { if (vivo) setConteggi(Object.fromEntries(coppie)); });
    return () => { vivo = false; };
  }, [campagnaId, aperto, aggiornamento]);
  useEffect(() => {
    if (!campagnaId || !aperto) return;
    let vivo = true;
    let q = supabase.from("crm_campagne_destinatari")
      .select("id, nome, email, stato, inviata_il, ultimo_evento, ultimo_evento_il, errore", { count: "exact" })
      .eq("campagna_id", campagnaId);
    if (statoScelto !== "tutti") q = q.eq("stato", statoScelto);
    if (cerca) q = q.or(`nome.ilike.%${cerca.replace(/[%,()]/g, "")}%,email.ilike.%${cerca.replace(/[%,()]/g, "")}%`);
    q.order("ultimo_evento_il", { ascending: false, nullsFirst: false }).order("nome").range(da, da + PER_PAGINA_DESTINATARI - 1)
      .then(({ data, count }) => { if (vivo) { setRighe(Array.isArray(data) ? data : []); setTotale(count || 0); } });
    return () => { vivo = false; };
  }, [campagnaId, aperto, statoScelto, cerca, da, aggiornamento]);

  if (!campagnaId) return null;
  const totaleTutti = conteggi ? Object.values(conteggi).reduce((s, n) => s + n, 0) : null;
  const linguetta = (chiave, testo, n) => (
    <button key={chiave} type="button" onClick={() => { setStatoScelto(chiave); setDa(0); }}
      style={{ ...fontBody, fontSize: 12, fontWeight: statoScelto === chiave ? 700 : 500, color: statoScelto === chiave ? "#fff" : NAVY, background: statoScelto === chiave ? NAVY : "#fff", border: `1px solid ${statoScelto === chiave ? NAVY : CREAM_BORDER}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
      {testo}{n != null ? ` ${numero(n)}` : ""}
    </button>
  );
  return (
    <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 16, marginTop: 16 }} data-destinatari>
      <button type="button" onClick={() => setAperto((a) => !a)} style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
        {aperto ? "▾" : "▸"} Destinatari, uno per uno {totaleTutti != null ? `(${numero(totaleTutti)})` : ""}
      </button>
      {!aperto && <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 4 }}>Chi ha ricevuto, chi ha aperto, chi è rimbalzato: premi per vedere i nomi.</div>}
      {aperto && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
            {linguetta("tutti", "Tutti", totaleTutti)}
            {Object.entries(STATI_DESTINATARIO).map(([k, v]) => linguetta(k, v.charAt(0).toUpperCase() + v.slice(1), conteggi?.[k] || 0))}
          </div>
          <input value={cercaScritto} onChange={(e) => setCercaScritto(e.target.value)} placeholder="cerca per nome o email" style={{ ...inputStyle, width: "100%", minWidth: 0, marginBottom: 8 }} />
          <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
            «Aperta» la segna il programma di posta quando scarica le immagini: Mail di iPhone lo fa da solo per tutti, Gmail solo se le mostra. È una tendenza, non una prova di lettura.
          </div>
          {righe.length === 0 && <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, padding: "8px 0" }}>Nessun destinatario con questo stato.</div>}
          {righe.map((r) => {
            const c = COLORE_STATO_DESTINATARIO[r.stato] || COLORE_STATO_DESTINATARIO.inviata;
            return (
              <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${CREAM_BORDER}` }} data-destinatario={r.stato}>
                <span style={{ flex: "1 1 220px", minWidth: 0, ...fontBody, fontSize: 13, color: NAVY, overflowWrap: "anywhere" }}>
                  <b>{r.nome || "(senza nome)"}</b> <span style={{ color: MUTED }}>{r.email}</span>
                </span>
                <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: c.colore, background: c.sfondo, border: `1px solid ${c.bordo}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{STATI_DESTINATARIO[r.stato] || r.stato}</span>
                <span style={{ ...fontBody, fontSize: 11.5, color: MUTED, whiteSpace: "nowrap" }} title={r.errore || ""}>
                  {r.ultimo_evento_il ? dataOraIt(r.ultimo_evento_il) : r.inviata_il ? dataOraIt(r.inviata_il) : ""}
                </span>
              </div>
            );
          })}
          {totale > PER_PAGINA_DESTINATARI && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setDa(Math.max(0, da - PER_PAGINA_DESTINATARI))} disabled={da === 0} style={{ padding: "6px 12px", fontSize: 12 }}>← Precedenti</Button>
              <span style={{ ...fontBody, fontSize: 12, color: GRAFITE }}>{numero(da + 1)}–{numero(Math.min(da + PER_PAGINA_DESTINATARI, totale))} di {numero(totale)}</span>
              <Button variant="ghost" onClick={() => setDa(da + PER_PAGINA_DESTINATARI)} disabled={da + PER_PAGINA_DESTINATARI >= totale} style={{ padding: "6px 12px", fontSize: 12 }}>Successivi →</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------- le campagne fatte

// «USA QUESTO TESTO PER UNA CAMPAGNA NUOVA» (24/11/2026, chiesto dal
// titolare: «nelle campagne già usate… nello storico delle campagne»).
// Serve a mandare la STESSA mail a un altro gruppo: si scrive una volta e
// si spedisce a scaglioni — i clienti, poi chi è da richiamare, poi gli
// altri — invece di riscrivere il testo ogni volta o di rimetterlo in
// mezzo a una campagna già partita, che è chiusa in scrittura apposta.
//
// Tre decisioni:
//   * si copiano SOLO oggetto e testo. Il pubblico no: il senso del gesto
//     è cambiare gruppo, e portarsi dietro i filtri di prima vorrebbe
//     dire ritrovarsi davanti le stesse persone;
//   * nasce con «escludi quelle già spedite» ACCESA. È l'unico caso in
//     cui accenderla da sé è giusto: il testo è lo stesso di una mail già
//     partita, e riceverla due volte non è mai quello che si vuole. Si
//     spegne con un tocco;
//   * nasce BOZZA e senza destinatari, quindi non può partire niente per
//     sbaglio: prima si scelgono le persone, poi si prepara, poi si manda.
export async function creaCampagnaDaTesto(c, utente = "") {
  const campi = {
    nome: `Copia di ${c?.nome || "campagna"}`.slice(0, 200),
    oggetto: c?.oggetto || "",
    corpo_html: c?.corpo_html || "",
    filtri: { escludi_gia_spedite: true },
    creata_da: utente || null,
    aggiornata_il: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("crm_campagne").insert(campi).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La campagna non è stata scritta: ricarica la pagina e riprova.");
  return data;
}

// La riga di una campagna, scritta una volta sola: la usano l'elenco «da
// finire» e quello delle altre. Due copie si scosterebbero al primo
// ritocco, e stanno una sotto l'altra nella stessa schermata.
function RigaCampagna({ c, e, onApri, onUsaTesto = null, daFinire = false }) {
  const consegnate = (e.consegnate || 0) + (e.aperte || 0);
  return (
    <div onClick={() => onApri(c)} role="button" style={{ padding: "10px 0", borderTop: `1px solid ${CREAM_BORDER}`, cursor: "pointer", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }} data-campagna={c.id}>
      <span style={{ flex: "1 1 240px", minWidth: 0 }}>
        <span style={{ ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY }}>{c.nome}</span>
        <span style={{ display: "block", ...fontBody, fontSize: 11.5, color: MUTED }}>{c.oggetto || "(senza oggetto)"} · {dataOraIt(c.creata_il)}{c.creata_da ? ` · ${c.creata_da}` : ""}</span>
      </span>
      <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: c.stato === "inviata" ? "#2E7D32" : c.stato === "in_invio" ? "#8A6D1D" : GRAFITE, background: "#F3F0E8", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "3px 10px" }}>{STATI_CAMPAGNA[c.stato] || c.stato}</span>
      <span style={{ ...fontBody, fontSize: 12, color: GRAFITE, whiteSpace: "nowrap" }}>
        {numero(c.totale_destinatari)} destinatari · {numero(c.inviate)} spedite
        {consegnate ? ` · ${numero(consegnate)} consegnate` : ""}{e.aperte ? ` · ${numero(e.aperte)} aperte` : ""}
        {e.rimbalzate ? ` · ${numero(e.rimbalzate)} rimbalzate` : ""}{c.fallite ? ` · ${numero(c.fallite)} non riuscite` : ""}
        {e.in_coda ? ` · ${numero(e.in_coda)} ancora in coda` : ""}
      </span>
      {/* il tasto NON spedisce: apre. Spedire da un elenco con un tocco
          vorrebbe dire far partire mail vere senza vedere il testo */}
      {daFinire && <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: "#fff", background: NAVY, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>Riprendi →</span>}
      {/* il tasto sta DENTRO una riga che si preme: senza fermare il
          tocco, premerlo aprirebbe anche la campagna di prima */}
      {onUsaTesto && !!String(c.corpo_html || c.oggetto || "").trim() && (
        <button
          type="button"
          onClick={(ev) => { ev.stopPropagation(); onUsaTesto(c); }}
          title="Scrive una campagna nuova con questo oggetto e questo testo, da mandare a un altro gruppo"
          style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap", cursor: "pointer" }}
          data-usa-testo={c.id}
        >
          Usa questo testo
        </button>
      )}
    </div>
  );
}

export function ElencoCampagne({ onApri, onChiudi, onUsaTesto = null }) {
  const [campagne, setCampagne] = useState(null);
  const [esiti, setEsiti] = useState({});
  useEffect(() => {
    supabase.from("crm_campagne").select("*").order("creata_il", { ascending: false }).limit(200)
      .then(({ data }) => setCampagne(Array.isArray(data) ? data : []));
  }, []);
  // IL CONTO LO FA IL DATABASE (24/11/2026). Prima si leggevano le righe
  // dei destinatari con `.limit(100000)` e si contavano qui: ma PostgREST
  // ne serve MILLE, e su 58.000 righe consegnate, aperte, rimbalzate e
  // «quante restano in coda» erano i numeri delle prime mille — falsi
  // senza dirlo, proprio nella pagina da cui si riprende una spedizione.
  useEffect(() => {
    if (!campagne?.length) return;
    supabase.from("crm_campagne_riepilogo").select("*").in("campagna_id", campagne.map((c) => c.id))
      .then(({ data }) => {
        const per = {};
        (data || []).forEach((r) => { per[r.campagna_id] = r; });
        setEsiti(per);
      });
  }, [campagne]);

  // UNA CAMPAGNA «DA FINIRE» ha ancora gente in coda e non e' chiusa.
  // `annullata` e `inviata` restano fuori per definizione; una bozza senza
  // destinatari non e' «da finire», e' da scrivere.
  const daFinire = (campagne || []).filter((c) => ["pronta", "in_invio"].includes(c.stato) && (esiti[c.id]?.in_coda || 0) > 0);
  const finite = (campagne || []).filter((c) => !daFinire.includes(c));

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" onClick={onChiudi} style={{ ...fontBody, fontSize: 13, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>← Contatti</button>
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Campagne</div>
        </div>
        {campagne === null && <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 2px" }}>Carico…</div>}
        {campagne?.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 2px" }}>Nessuna campagna ancora. Si parte da «Componi mail» nella lista contatti.</div>}

        {/* DA FINIRE IN CIMA (24/11/2026, il titolare: «un'area in cui ci
            sono le campagne in corso, anche se stoppate, dove posso
            rientrare e terminare la spedizione»). L'area c'era: quello che
            mancava era che una campagna a meta' si riconoscesse a colpo
            d'occhio, invece di stare in mezzo alle altre con la sola
            pastiglia dello stato. */}
        {!!daFinire.length && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }} data-da-finire>
              Da finire — {daFinire.length === 1 ? "una campagna" : `${daFinire.length} campagne`}, {numero(daFinire.reduce((t, c) => t + (esiti[c.id]?.in_coda || 0), 0))} mail ancora in coda
            </div>
            <div style={{ background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "4px 16px" }}>
              {daFinire.map((c) => <RigaCampagna key={c.id} c={c} e={esiti[c.id] || {}} onApri={onApri} onUsaTesto={onUsaTesto} daFinire />)}
            </div>
          </div>
        )}

        {!!finite.length && (
          <>
            {!!daFinire.length && <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Le altre</div>}
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "4px 16px" }}>
              {finite.map((c) => <RigaCampagna key={c.id} c={c} e={esiti[c.id] || {}} onApri={onApri} onUsaTesto={onUsaTesto} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
