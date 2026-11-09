// L'ASSISTENTE DELL'APP (25/10/2026; dal 3/11/2026 risponde anche sui
// dati): l'icona flottante, in tutta l'app, per chi ha fatto accesso. Si
// apre, si scrive la domanda — o si parla — e la risposta arriva dicendo
// SEMPRE da dove viene: dalle regole scritte (con il nome delle schede),
// dalla guida dell'app, dai dati (con i numeri e il conto sotto, da
// aprire), oppure come ragionamento, che e' l'unico caso in cui niente di
// deciso risponde. La funzione dietro e' `assistente-regole`.
//
// `permessi` sono le caselle delle aree della Home di chi ha fatto
// accesso, e vanno passati: decidono quali aree dell'app l'assistente
// puo' spiegare e quali dati puo' guardare. Senza, risponde solo su
// regole, calendario e catalogo dei corsi — le aree aperte a tutti.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay } from "../ui/stile.js";
import { voceDisponibile, leggi, leggiNaturale, zittisci, ascoltaUnaFrase } from "./voce.js";
import { DESTINATARI } from "./PaginaRegolamenti.jsx";
import { testoErroreFunzione } from "../errore-funzione.js";
import SfogliaLocandine from "./SfogliaLocandine.jsx";
import { nominaUnCorso, chiedeUnPrezzo, testoDelleLocandine } from "./locandina-corso.js";

// I NUMERI E IL CONTO, sotto una risposta presa dai dati. Chiusi, perche'
// chi chiede «che corso c'e' a Bari» vuole la risposta; apribili, perche'
// un numero che non si puo' controllare non vale niente — e' la stessa
// regola di «Chiedi ai dati» in Statistiche.
function Numeri({ righe, totale, sql, nota }) {
  const [apertoNumeri, setApertoNumeri] = useState(false);
  const [apertoConto, setApertoConto] = useState(false);
  const quante = righe?.length || 0;
  if (!sql && !quante) return null;
  const tasto = { all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 };
  return (
    <div data-campo="numeri-risposta" style={{ marginTop: 6, display: "grid", gap: 4 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {quante > 0 && (
          <button type="button" style={tasto} onClick={() => setApertoNumeri((v) => !v)}>
            {apertoNumeri ? "▾" : "▸"} I numeri ({totale ?? quante})
          </button>
        )}
        <button type="button" style={tasto} onClick={() => setApertoConto((v) => !v)}>
          {apertoConto ? "▾" : "▸"} Come l'ho calcolato
        </button>
      </div>
      {apertoNumeri && quante > 0 && (
        <div style={{ ...fontBody, fontSize: 11.5, color: GRAFITE, background: "#FAFAF7", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: 6, maxHeight: 180, overflow: "auto" }}>
          {righe.slice(0, 30).map((r, i) => (
            <div key={i} style={{ borderBottom: i < Math.min(quante, 30) - 1 ? `1px solid ${CREAM_BORDER}` : "none", padding: "3px 0" }}>
              {Object.entries(r).filter(([k]) => k !== "id").map(([k, v]) => `${k}: ${v === null || v === "" ? "—" : v}`).join(" · ")}
            </div>
          ))}
          {quante > 30 && <div style={{ paddingTop: 4, color: MUTED }}>…e altre {quante - 30}</div>}
        </div>
      )}
      {apertoConto && (
        <div style={{ ...fontBody, fontSize: 11, color: GRAFITE, background: "#FAFAF7", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8, padding: 6, overflowX: "auto" }}>
          {nota && <div style={{ marginBottom: 4 }}>{nota}</div>}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>{sql}</pre>
        </div>
      )}
    </div>
  );
}

function Testo({ testo }) {
  const righe = String(testo || "").split("\n");
  const pezzi = (r) => r.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>);
  return <div style={{ ...fontBody, fontSize: 13.5, color: NAVY, lineHeight: 1.55 }}>
    {righe.map((r, i) => !r.trim() ? <div key={i} style={{ height: 6 }} />
      : /^\s*[-•]\s+/.test(r) ? <div key={i} style={{ display: "flex", gap: 6, paddingLeft: 4 }}><span>•</span><span>{pezzi(r.replace(/^\s*[-•]\s+/, ""))}</span></div>
      : <div key={i}>{pezzi(r)}</div>)}
  </div>;
}

// Da dove viene una risposta si legge a colpo d'occhio, senza doverla
// rileggere: «dalle regole» e' oro (una decisione presa), i dati sono
// verdi (un numero vero, controllabile qui sotto), la guida e' navy, il
// ragionamento e' azzurro e dichiara di non essere una regola.
// La locandina e' ORO come le regole, e non e' pigrizia: un cartello dei
// prezzi e' una cosa DECISA e scritta da chi comanda, esattamente come
// una scheda di Regolamenti. I dati sono verdi perche' si possono
// ricontare; una locandina no, si legge.
const BORDO_REGISTRO = { regole: GOLD, misto: GOLD, dati: "#2F7D63", guida: NAVY, conversazione: CREAM_BORDER, ragionamento: "#8FA3C9", prezzo: "#2F7D63", locandina: GOLD };
const ETICHETTA_REGISTRO = {
  misto: "In parte dalle regole, in parte un ragionamento",
  ragionamento: "Un ragionamento, non una regola scritta",
  dati: "Dai dati dell'app, adesso",
  guida: "Come funziona l'app",
  prezzo: "I prezzi del banco, adesso",
  locandina: "La locandina dei prezzi del corso",
};
const COLORE_ETICHETTA = { dati: "#2F7D63", guida: NAVY, misto: "#4C6A9A", ragionamento: "#4C6A9A", prezzo: "#2F7D63", locandina: GOLD };

// ---------- I PREZZI DEL BANCO ----------
// Il conto non e' qui: arriva gia' fatto da `prezziAlBancoDi` (App.jsx),
// che e' il conto del POS. Qui si legge e si dice.
function euro(n) {
  return `${(Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20ac`;
}
function pct(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

// Quello che la voce legge: le stesse cifre della scheda, in una frase.
export function testoDeiPrezzi(prezzi) {
  const righe = (prezzi?.prodotti || []).map((p) => {
    const pezzi = [`${p.nome}: prezzo normale ${euro(p.listino)}`];
    if (p.contanti) pezzi.push(`in contanti meno ${pct(p.contanti.pct)}, ${euro(p.contanti.totale)}`);
    if (p.carta) pezzi.push(`col POS meno ${pct(p.carta.pct)}, ${euro(p.carta.totale)}`);
    return pezzi.join("; ");
  });
  const testa = prezzi?.fiera ? `Prezzi al banco di ${prezzi.fiera.nome}. ` : "Nessuna fiera aperta oggi, quindi il prezzo e' quello di listino. ";
  return testa + righe.join(". ");
}

function RigaPrezzo({ etichetta, percentuale, importo, forte = false }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
      <span style={{ flex: "1 1 auto", minWidth: 0, ...fontBody, fontSize: 12.5, color: MUTED }}>{etichetta}</span>
      {percentuale != null && (
        <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: "#2F7D63", whiteSpace: "nowrap" }}>-{pct(percentuale)}</span>
      )}
      <span style={{ ...fontDisplay, fontSize: forte ? 15 : 14, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{euro(importo)}</span>
    </div>
  );
}

function SchedaPrezzi({ prezzi }) {
  return (
    <div data-campo="prezzi-al-banco">
      {prezzi.fiera
        ? <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
            Al banco di <b style={{ color: NAVY }}>{prezzi.fiera.nome}</b>
          </div>
        : <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
            Nessuna fiera aperta oggi: al banco si paga il listino.
          </div>}
      {prezzi.prodotti.map((p) => (
        <div key={p.id} data-campo="prezzo-prodotto" style={{ borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 7, marginTop: 7 }}>
          <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY }}>{p.nome}</div>
          <RigaPrezzo etichetta="Prezzo normale" importo={p.listino} />
          {p.contanti && <RigaPrezzo etichetta="Fiera, in contanti" percentuale={p.contanti.pct} importo={p.contanti.totale} forte />}
          {p.carta && <RigaPrezzo etichetta="Fiera, POS o carta" percentuale={p.carta.pct} importo={p.carta.totale} forte />}
          {/* senza costo d'acquisto non c'e' margine da cedere: lo dice,
              invece di mostrare uno sconto a zero senza motivo */}
          {p.senzaMargine && (
            <div style={{ ...fontBody, fontSize: 11.5, color: "#B3261E", marginTop: 3 }}>
              Su questo nessuno sconto: non risulta il costo d'acquisto.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AssistenteRegole({ ruolo = "tutti", chi = "", permessi = [], isMobile = false, onApriRegolamenti = null, prezziAlBanco = null, locandineCorso = null }) {
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
  // IL NOME DI UN PRODOTTO SI RISPONDE QUI, SENZA IL MODELLO.
  //
  // Chiesto dal titolare l'8/11/2026: «una specie di simulazione del POS
  // banco». I prezzi li calcola il POS (`prezziAlBancoDi`), quindi non
  // c'e' niente da chiedere a un modello — e chiederglielo vorrebbe dire
  // aspettare, pagare, e far dire delle cifre a chi puo' sbagliarle.
  function prezziDelBanco(d) {
    try {
      const prezzi = prezziAlBanco?.(d);
      if (!prezzi?.prodotti?.length) return null;
      setScambi((s) => [...s, { domanda: d, prezzi, registro: "prezzo" }]);
      return testoDeiPrezzi(prezzi);
    } catch { return null; /* se la simulazione non riesce, risponde il modello */ }
  }
  // E IL PREZZO DI UN CORSO STA SU UN FOGLIO (9/11/2026).
  //
  // Il titolare: «quando chiedo prezzi corso di PMU, mostrami nella chat
  // la locandina». Quelle cifre non esistono nei dati, stanno sui
  // cartelli di «Prezzi corsi»: si mostra il foglio, che si sfoglia e si
  // allarga, e non si prova a dire a parole quello che c'e' scritto —
  // una cifra riscritta da qualcuno e' una cifra che un giorno sbaglia.
  async function locandinaDelCorso(d) {
    try {
      const trovate = await locandineCorso?.(d);
      if (!trovate?.pagine?.length) return null;
      const risposta = testoDelleLocandine(trovate.pagine);
      setScambi((s) => [...s, { domanda: d, pagine: trovate.pagine, risposta, registro: "locandina" }]);
      return risposta;
    } catch { return null; }
  }

  async function rispondi(d) {
    setOccupato(true);
    // CHI PARLA PRIMA FRA LE DUE SCORCIATOIE: lo decide la parola
    // «corso». «prezzi PMU» sono i quattro prodotti che si chiamano PMU
    // in anagrafica (Dispensa PMU, Specchio PMU...) e il banco deve
    // continuare a rispondere per quelli; «prezzi CORSO di PMU» e' la
    // locandina. Senza quella parola l'ordine resta quello di prima, e
    // la locandina ha comunque un secondo giro quando nessun prodotto
    // combacia e si sta chiedendo un prezzo.
    const scorciatoie = nominaUnCorso(d)
      ? [locandinaDelCorso, prezziDelBanco]
      : [prezziDelBanco, chiedeUnPrezzo(d) ? locandinaDelCorso : null];
    for (const scorciatoia of scorciatoie) {
      if (!scorciatoia) continue;
      const detto = await scorciatoia(d);
      if (detto) { setOccupato(false); return detto; }
    }
    const cronologia = scambiRef.current.filter((s) => s.risposta).slice(-3).map((s) => ({ domanda: s.domanda, risposta: s.risposta }));
    try {
      const { data, error } = await supabase.functions.invoke("assistente-regole", { body: { domanda: d, ruolo, chi, permessi, cronologia } });
      if (error || !data?.ok) {
        // il motivo vero sta nel corpo della risposta, non in
        // error.message: vedi errore-funzione.js
        const errore = data?.errore || (error ? await testoErroreFunzione(error) : "Nessuna risposta.");
        setScambi((s) => [...s, { domanda: d, errore }]); return errore;
      }
      setScambi((s) => [...s, {
        domanda: d, risposta: data.risposta, citati: data.citati || [], senza: !!data.senza_risposta,
        registro: data.registro || (data.citati?.length ? "regole" : "ragionamento"),
        // per le risposte dai dati: le righe e la query che le ha
        // calcolate. Un conto che non si puo' controllare non e' un conto
        sql: data.sql || null, nota: data.nota || null, righe: data.righe || null, totaleRighe: data.totale_righe ?? null,
      }]);
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
        <button type="button" data-campo="assistente-regole" onClick={() => setAperto(true)} title="Chiedi all'assistente" aria-label="Chiedi all'assistente"
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
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700 }}>Chiedi</div>
              <div style={{ ...fontBody, fontSize: 11, opacity: 0.75 }}>Regole, come funziona l'app, e i dati che vedi tu</div>
            </div>
            <button type="button" onClick={() => { spegniVoce(); setAperto(false); }} aria-label="Chiudi" style={{ all: "unset", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
            {scambi.length === 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: GRAFITE, lineHeight: 1.5 }}>
                Chiedi quello che ti serve, in tre direzioni:
                <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                  <div>• <b>le regole</b> — «quanto sconto posso fare in aula?»</div>
                  <div>• <b>come funziona l'app</b> — «dove segno il modulo ricevuto?»</div>
                  <div>• <b>i dati</b> — «che corso c'è a novembre a Bari?», «chi tiene il PMU di Milano?», «quanto costa il kit laminazione?»</div>
                  <div>• <b>i prezzi di un corso</b> — «prezzi corso di PMU»: ti mostro la locandina, da sfogliare e da allargare</div>
                </div>
                <div style={{ marginTop: 6 }}>Dice sempre da dove viene la risposta: dalle regole, dalla guida, dai dati (con i numeri sotto, da aprire) o come ragionamento. Vede solo le aree che vedi tu, e non ha i dati personali delle allieve.</div>
                {onApriRegolamenti && <div style={{ marginTop: 8 }}><button type="button" onClick={() => { setAperto(false); onApriRegolamenti(); }} style={{ all: "unset", cursor: "pointer", color: NAVY, textDecoration: "underline", fontSize: 12.5 }}>Leggi tutte le regole</button></div>}
              </div>
            )}
            {scambi.map((s, i) => (
              <div key={i} data-campo="scambio">
                <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Tu: {s.domanda}</div>
                {s.errore
                  ? <div style={{ ...fontBody, fontSize: 13, color: "#B3261E" }}>{s.errore}</div>
                  : <div style={{ borderLeft: `3px solid ${BORDO_REGISTRO[s.registro] || "#8FA3C9"}`, paddingLeft: 10 }}>
                      {/* quattro registri, sempre distinti: quello che e'
                          deciso, come funziona l'app, quello che dicono i
                          dati, e quello che e' solo un aiuto a ragionare */}
                      {ETICHETTA_REGISTRO[s.registro] && (
                        <div data-campo={`etichetta-${s.registro}`} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: COLORE_ETICHETTA[s.registro] || "#4C6A9A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          {ETICHETTA_REGISTRO[s.registro]}
                        </div>
                      )}
                      {s.pagine?.length
                        ? <><SfogliaLocandine pagine={s.pagine} /><div style={{ marginTop: 6 }}><Testo testo={s.risposta} /></div></>
                        : s.prezzi ? <SchedaPrezzi prezzi={s.prezzi} /> : <Testo testo={s.risposta} />}
                      {s.registro === "dati" && <Numeri righe={s.righe} totale={s.totaleRighe} sql={s.sql} nota={s.nota} />}
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
                {voce === "ascolto" ? (parziale ? `«${parziale}»` : "Ti ascolto…") : voce === "penso" ? "Ci penso…" : "Sto rispondendo… tocca per interrompere"}
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
