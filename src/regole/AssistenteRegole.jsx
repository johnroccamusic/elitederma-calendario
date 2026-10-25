// L'ASSISTENTE DEI REGOLAMENTI (25/10/2026): l'icona flottante in basso a
// destra, in tutta l'app, per chi ha fatto accesso. Si apre, si scrive la
// domanda, la risposta arriva con il nome delle regole da cui viene. Se
// nessuna regola risponde lo dice — e la domanda resta registrata per chi
// scrive le regole. La funzione dietro e' `assistente-regole`.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay } from "../ui/stile.js";
import { voceDisponibile, leggi, leggiNaturale, zittisci, ascoltaUnaFrase } from "./voce.js";
import { DESTINATARI } from "./PaginaRegolamenti.jsx";

function Testo({ testo }) {
  const righe = String(testo || "").split("\n");
  const pezzi = (r) => r.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>);
  return <div style={{ ...fontBody, fontSize: 13.5, color: NAVY, lineHeight: 1.55 }}>
    {righe.map((r, i) => !r.trim() ? <div key={i} style={{ height: 6 }} />
      : /^\s*[-•]\s+/.test(r) ? <div key={i} style={{ display: "flex", gap: 6, paddingLeft: 4 }}><span>•</span><span>{pezzi(r.replace(/^\s*[-•]\s+/, ""))}</span></div>
      : <div key={i}>{pezzi(r)}</div>)}
  </div>;
}

export default function AssistenteRegole({ ruolo = "tutti", chi = "", isMobile = false, onApriRegolamenti = null }) {
  const [aperto, setAperto] = useState(false);
  // LA SCHEDA PROPOSTA: quando chi amministra da' una disposizione in
  // dialogo, l'assistente la rimanda gia' scritta come regola. Resta qui,
  // modificabile, finche' non la si salva o la si scarta. A voce basta
  // dire «si'» / «salva».
  const [proposta, setProposta] = useState(null); // { titolo, argomento, testo, vale_per, sostituisce }
  const [salvandoRegola, setSalvandoRegola] = useState(false);
  const propostaRef = useRef(null);
  useEffect(() => { propostaRef.current = proposta; }, [proposta]);
  async function salvaProposta() {
    const pr = propostaRef.current; if (!pr || salvandoRegola) return null;
    setSalvandoRegola(true);
    const riga = { titolo: pr.titolo.trim(), argomento: pr.argomento?.trim() || null, testo: pr.testo.trim(), visibile_a: pr.vale_per?.length ? pr.vale_per : ["tutti"], decisa_il: new Date().toISOString().slice(0, 10), attivo: true, creato_da: chi || null, aggiornato_da: chi || null };
    const { data, error } = await supabase.from("regolamenti").insert(riga).select("id");
    let esito;
    if (error || !data?.length) esito = `Non sono riuscito a salvare la regola: ${error?.message || "nessuna riga scritta"}.`;
    else {
      // la scheda che contraddiceva si spegne, non si cancella: resta la storia
      if (pr.sostituisce?.id) await supabase.from("regolamenti").update({ attivo: false, aggiornato_da: chi || null, aggiornato_il: new Date().toISOString() }).eq("id", pr.sostituisce.id);
      esito = `Regola salvata: «${riga.titolo}».${pr.sostituisce ? ` La vecchia «${pr.sostituisce.titolo}» è stata spenta.` : ""}`;
    }
    setScambi((s) => [...s, { domanda: "(salva la regola)", risposta: esito, citati: [], registro: "conversazione" }]);
    setProposta(null); setSalvandoRegola(false);
    return esito;
  }
  const [domanda, setDomanda] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [scambi, setScambi] = useState([]); // { domanda, risposta, citati, senza, errore }
  const fondo = useRef(null);
  // LA CONVERSAZIONE A VOCE: "ascolto" | "penso" | "parlo" | null (spenta).
  // Un giro solo, che si ripete finche' chi parla non lo chiude.
  const [voce, setVoce] = useState(null);
  const [parziale, setParziale] = useState("");
  const voceAccesa = useRef(false);
  const fermaAscolto = useRef(null);
  const scambiRef = useRef(scambi);
  useEffect(() => { scambiRef.current = scambi; }, [scambi]);
  useEffect(() => () => { voceAccesa.current = false; fermaAscolto.current?.(); zittisci(); }, []);

  useEffect(() => { if (aperto) fondo.current?.scrollIntoView?.({ block: "end" }); }, [scambi, aperto]);

  // manda una domanda e torna il testo della risposta (o dell'errore):
  // lo usano sia il tasto «Chiedi» sia la conversazione a voce
  async function rispondi(d) {
    setOccupato(true);
    const cronologia = scambiRef.current.filter((s) => s.risposta).slice(-3).map((s) => ({ domanda: s.domanda, risposta: s.risposta }));
    try {
      const { data, error } = await supabase.functions.invoke("assistente-regole", { body: { domanda: d, ruolo, chi, cronologia } });
      if (error || !data?.ok) {
        const errore = data?.errore || error?.message || "Nessuna risposta.";
        setScambi((s) => [...s, { domanda: d, errore }]); return errore;
      }
      setScambi((s) => [...s, { domanda: d, risposta: data.risposta, citati: data.citati || [], senza: !!data.senza_risposta, registro: data.registro || (data.citati?.length ? "regole" : "ragionamento") }]);
      if (data.proposta_regola) setProposta(data.proposta_regola);
      return data.risposta;
    } catch (err) {
      const errore = String(err?.message || err);
      setScambi((s) => [...s, { domanda: d, errore }]); return errore;
    } finally { setOccupato(false); }
  }
  async function chiedi(e) {
    e?.preventDefault?.();
    const d = domanda.trim();
    if (d.length < 3 || occupato) return;
    setDomanda("");
    await rispondi(d);
  }

  // IL GIRO A VOCE. Ogni passo controlla `voceAccesa`: un tocco su «chiudi»
  // in qualunque momento spegne tutto, anche a meta' di una risposta.
  function giroAscolto() {
    if (!voceAccesa.current) return;
    setVoce("ascolto"); setParziale("");
    fermaAscolto.current = ascoltaUnaFrase({
      suParziale: setParziale,
      suFrase: async (frase) => {
        if (!voceAccesa.current) return;
        setVoce("penso"); setParziale("");
        let testo;
        if (propostaRef.current && /^\s*(s[iì]|ok|va bene|salva|salvala|confermo|esatto|certo)\b/i.test(frase)) testo = await salvaProposta();
        else if (propostaRef.current && /^\s*(no|non salvare|lascia|annulla|scarta)\b/i.test(frase)) { setProposta(null); testo = "Va bene, non la salvo."; setScambi((s) => [...s, { domanda: frase, risposta: testo, citati: [], registro: "conversazione" }]); }
        else testo = await rispondi(frase);
        if (!voceAccesa.current) return;
        setVoce("parlo");
        // prima la voce naturale; se non c'e', quella del telefono
        const letto = await leggiNaturale(testo, supabase);
        if (!voceAccesa.current) return;
        if (!letto) await leggi(testo);
        giroAscolto();
      },
      suErrore: (err) => {
        if (!voceAccesa.current) return;
        if (err === "not-allowed" || err === "service-not-allowed") { spegniVoce(); setScambi((s) => [...s, { domanda: "(voce)", errore: "Il microfono non è permesso qui. Su iPhone scrivi la domanda, o usa il microfono della tastiera." }]); }
      },
      // finita senza una frase (silenzio): si riascolta
      suFine: (consegnata) => { if (!consegnata && voceAccesa.current) setTimeout(giroAscolto, 150); },
    });
  }
  function accendiVoce() {
    if (!voceDisponibile()) return;
    voceAccesa.current = true;
    // sbloccare la sintesi vocale su iPhone richiede un primo speak dentro
    // il gesto dell'utente: una frase corta che dice cosa sta succedendo
    leggi("Ti ascolto.").then(() => giroAscolto());
    setVoce("parlo");
  }
  function spegniVoce() {
    voceAccesa.current = false;
    fermaAscolto.current?.(); fermaAscolto.current = null;
    zittisci(); setVoce(null); setParziale("");
  }
  // mentre l'assistente parla, un tocco lo interrompe e torna ad ascoltare
  function interrompi() { if (voce === "parlo") { zittisci(); giroAscolto(); } }

  // Sul telefono il dock e' una barra in basso a tutta larghezza, e la sua
  // altezza cambia col rullo dei preferiti: messo in basso, il tondo ci
  // finiva sotto (trovato dal titolare il 25/10/2026). Quindi sul telefono
  // sta in ALTO a destra, sotto la tacca; da scrivania in basso a destra,
  // lontano dal dock che sta al centro.
  const base = isMobile
    // In alto a destra c'erano gia' il tastino della vista scrivania e,
    // appena sotto, i tasti delle pagine («Esci» della scheda classe): il
    // tondo copriva ora l'uno ora l'altro. A meta' altezza, sul bordo
    // destro, non c'e' niente di fisso in nessuna pagina.
    ? { position: "fixed", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 1900 }
    : { position: "fixed", right: 20, bottom: 24, zIndex: 1900 };

  return (
    <>
      {!aperto && (
        <button type="button" data-campo="assistente-regole" onClick={() => setAperto(true)} title="Chiedi ai regolamenti" aria-label="Chiedi ai regolamenti"
          style={{ ...base, width: 48, height: 48, borderRadius: "50%", border: "2px solid #fff", cursor: "pointer", background: NAVY, color: "#fff", boxShadow: "0 6px 20px rgba(14,27,51,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          {/* un punto interrogativo bianco, grande e tondo: e' quello che
              il titolare ha chiesto, e si capisce da lontano */}
          <span aria-hidden="true" style={{ ...fontDisplay, fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#fff", transform: "translateY(-1px)" }}>?</span>
        </button>
      )}
      {aperto && (
        <div data-campo="pannello-assistente" style={{ ...base, ...(isMobile ? { top: "calc(env(safe-area-inset-top, 0px) + 56px)", transform: "none", right: 8 } : {}), width: "min(380px, calc(100vw - 32px))", maxHeight: isMobile ? "calc(100dvh - 150px)" : "min(560px, calc(100dvh - 48px))", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 18, border: `1px solid ${CREAM_BORDER}`, boxShadow: "0 16px 48px rgba(14,27,51,0.28)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: NAVY, color: "#fff" }}>
            <div>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700 }}>Chiedi ai regolamenti</div>
              <div style={{ ...fontBody, fontSize: 11, opacity: 0.75 }}>Risponde solo con le regole scritte</div>
            </div>
            <button type="button" onClick={() => { spegniVoce(); setAperto(false); }} aria-label="Chiudi" style={{ all: "unset", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
            {scambi.length === 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: GRAFITE, lineHeight: 1.5 }}>
                Chiedi come ci si comporta: «quanto sconto posso fare in aula?», «l'allieva vuole le modelle dopo aver firmato, cosa faccio?». Quello che è deciso te lo dice dalle regole; sul resto ragiona con te, e ti dice che è un ragionamento.
                {onApriRegolamenti && <div style={{ marginTop: 8 }}><button type="button" onClick={() => { setAperto(false); onApriRegolamenti(); }} style={{ all: "unset", cursor: "pointer", color: NAVY, textDecoration: "underline", fontSize: 12.5 }}>Leggi tutte le regole</button></div>}
              </div>
            )}
            {scambi.map((s, i) => (
              <div key={i} data-campo="scambio">
                <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Tu: {s.domanda}</div>
                {s.errore
                  ? <div style={{ ...fontBody, fontSize: 13, color: "#B3261E" }}>{s.errore}</div>
                  : <div style={{ borderLeft: `3px solid ${s.registro === "regole" || s.registro === "misto" ? GOLD : s.registro === "conversazione" ? CREAM_BORDER : "#8FA3C9"}`, paddingLeft: 10 }}>
                      {/* due registri, sempre distinti: quello che e' deciso e
                          quello che e' un aiuto a ragionare */}
                      {(s.registro === "ragionamento" || s.registro === "misto") && (
                        <div data-campo="etichetta-ragionamento" style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: "#4C6A9A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          {s.registro === "misto" ? "In parte dalle regole, in parte un ragionamento" : "Un ragionamento, non una regola scritta"}
                        </div>
                      )}
                      <Testo testo={s.risposta} />
                      {s.citati?.length > 0 && (
                        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
                          Dalle regole: {s.citati.map((c) => c.titolo).join(" · ")}
                        </div>
                      )}
                    </div>}
              </div>
            ))}
            {voce && (
              <div data-campo="stato-voce" onClick={interrompi} style={{ ...fontBody, fontSize: 12.5, color: voce === "ascolto" ? "#B3261E" : GRAFITE, fontStyle: "italic", cursor: voce === "parlo" ? "pointer" : "default" }}>
                {voce === "ascolto" ? (parziale ? `«${parziale}»` : "Ti ascolto…") : voce === "penso" ? "Cerco nelle regole…" : "Sto rispondendo… tocca per interrompere"}
              </div>
            )}
            <div ref={fondo} />
          </div>
          {proposta && (
            <div data-campo="proposta-regola" style={{ borderTop: `2px solid ${GOLD}`, background: "#FFFDF8", padding: 10, display: "grid", gap: 6, maxHeight: "45%", overflowY: "auto" }}>
              <div style={{ ...fontDisplay, fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.5 }}>Scheda proposta: la salvo così?</div>
              <input value={proposta.titolo} onChange={(e) => setProposta({ ...proposta, titolo: e.target.value })} style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, padding: "6px 8px", borderRadius: 8, border: `1px solid ${CREAM_BORDER}` }} />
              <input value={proposta.argomento || ""} onChange={(e) => setProposta({ ...proposta, argomento: e.target.value })} placeholder="Argomento" style={{ ...fontBody, fontSize: 12.5, padding: "5px 8px", borderRadius: 8, border: `1px solid ${CREAM_BORDER}` }} />
              <textarea value={proposta.testo} onChange={(e) => setProposta({ ...proposta, testo: e.target.value })} rows={4} style={{ ...fontBody, fontSize: 13, padding: "6px 8px", borderRadius: 8, border: `1px solid ${CREAM_BORDER}`, resize: "vertical", lineHeight: 1.45 }} />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DESTINATARI.map((d) => { const on = proposta.vale_per?.includes(d.chiave); return (
                  <button key={d.chiave} type="button" onClick={() => setProposta((p) => { const senza = (p.vale_per || []).filter((v) => v !== "tutti"); const nuovo = d.chiave === "tutti" ? ["tutti"] : (senza.includes(d.chiave) ? senza.filter((v) => v !== d.chiave) : [...senza, d.chiave]); return { ...p, vale_per: nuovo.length ? nuovo : ["tutti"] }; })}
                    style={{ ...fontBody, fontSize: 11, padding: "3px 9px", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? NAVY : CREAM_BORDER}`, background: on ? NAVY : "#fff", color: on ? "#fff" : GRAFITE }}>{d.etichetta}</button>
                ); })}
              </div>
              {proposta.sostituisce && <div style={{ ...fontBody, fontSize: 11.5, color: "#B3261E" }}>Sostituisce «{proposta.sostituisce.titolo}», che verrà spenta.</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setProposta(null)} style={{ ...fontBody, fontSize: 12.5, padding: "6px 12px", borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: GRAFITE, cursor: "pointer" }}>Non salvare</button>
                <button type="button" data-campo="salva-proposta" onClick={salvaProposta} disabled={salvandoRegola || proposta.titolo.trim().length < 3 || proposta.testo.trim().length < 10}
                  style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 10, border: "none", background: NAVY, color: "#fff", cursor: "pointer" }}>{salvandoRegola ? "Salvo…" : "Salva come regola"}</button>
              </div>
            </div>
          )}
          <form onSubmit={chiedi} style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${CREAM_BORDER}` }}>
            {voceDisponibile() && (
              <button type="button" data-campo="voce" onClick={voce ? spegniVoce : accendiVoce} title={voce ? "Chiudi la conversazione a voce" : "Parla con l'assistente"} aria-pressed={!!voce}
                style={{ width: 40, height: 40, borderRadius: 20, border: `1px solid ${voce ? "#B3261E" : CREAM_BORDER}`, background: voce ? "#FDECEC" : "#fff", color: voce ? "#B3261E" : NAVY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                {voce
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" /></svg>}
              </button>
            )}
            <input data-campo="domanda-regole" value={domanda} onChange={(e) => setDomanda(e.target.value)} disabled={occupato} placeholder="Scrivi la domanda…"
              style={{ ...fontBody, flex: 1, minWidth: 0, fontSize: 14, padding: "9px 12px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}` }} />
            <button type="submit" disabled={occupato || domanda.trim().length < 3}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, padding: "0 14px", borderRadius: 12, border: "none", background: NAVY, color: "#fff", cursor: "pointer", opacity: occupato || domanda.trim().length < 3 ? 0.5 : 1 }}>
              {occupato ? "…" : "Chiedi"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
