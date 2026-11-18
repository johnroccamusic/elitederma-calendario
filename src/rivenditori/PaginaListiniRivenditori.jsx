// LISTINI RIVENDITORI. 18/11/2026.
//
// Cinque schede sulla stessa configurazione: il listino di chi
// amministra, l'analisi dei margini, i rivenditori, il regolamento e il
// registro delle modifiche.
//
// IL CONTO NON STA QUI. Sconto cedibile, prezzi per livello, margine e
// nota li fa il database (`v_listino_rivenditori`): questa pagina li
// legge. Il motivo è il punto 6 della specifica — l'export per i
// rivenditori non deve ricevere i costi dal server — e se il prezzo lo
// calcolasse il browser il costo dovrebbe uscire per forza. Conseguenza
// voluta: correggendo un prezzo si risalva e si rilegge, invece di
// ricalcolare a mano una seconda volta in pagina.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, BG, MUTED, GOLD, FAMIGLIA_STRETTA, fontBody, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { scaricaPdf, datiSocieta } from "../prezzi/listinoPdf.js";
import { scaricaCsv } from "../prezzi/dati.js";
import {
  leggiLivelli, leggiParametri, parametro, salvaParametro, leggiListinoAdmin,
  leggiListinoDaEsportare, scriviPrezzoECosto, leggiModifiche, leggiRivenditori,
  salvaRivenditore, cancellaRivenditore, leggiOrdini, aggiungiOrdine, cancellaOrdine,
  leggiVerifiche, aggiungiVerifica, leggiRegolamenti, leggiLivelliScelti, salvaLivelliScelti,
  salvaLivello, leggiCategorieEscluse, salvaCategorieEscluse,
} from "./dati.js";
import { livelliAttivi, nominalePct, euroIt } from "./regole.js";
import {
  creaListinoRivenditoriPdf, csvListinoRivenditori, righeEsportabili, soglia, titoloListino,
  categorieDelListino, nomeCategoria,
} from "./listinoPdf.js";
import SchedaRivenditori from "./SchedaRivenditori.jsx";
import SchedaRegolamento from "./SchedaRegolamento.jsx";

const euro = (n) => (n == null ? "—" : `€ ${euroIt(n)}`);
const cifra = (n) => (n == null ? "—" : euroIt(n));
const pct = (n) => (n == null ? "—" : `${String(Math.round(Number(n) * 10) / 10).replace(".", ",")}%`);
const ROSSO = "#C0392B";

export const NOTE = [
  { chiave: "pieno", etichetta: "Scala piena", colore: "#2E6B3E", fondo: "#E9F6EC" },
  { chiave: "ridotto", etichetta: "Sconto ridotto", colore: "#8A6D1D", fondo: "#FDF8EC" },
  { chiave: "nessuno_sconto", etichetta: "Nessuno sconto possibile: rivedere prezzo", colore: ROSSO, fondo: "#FDECEC" },
  { chiave: "costo_mancante", etichetta: "Costo mancante", colore: "#3B6FA0", fondo: "#EEF4FA" },
];
export const notaDi = (c) => NOTE.find((n) => n.chiave === c) || NOTE[0];

const ETICHETTE_SOGLIA = {
  ingresso_eur: "la soglia d'ingresso",
  mantenimento_eur: "gli acquisti annui per mantenerlo",
  riassortimento_minimo_eur: "il riassortimento minimo",
};

// Il nome della scheda: quello che si legge in cima, nell'ordine della
// specifica.
const SCHEDE = [
  { v: "listino", l: "Listino" },
  { v: "margini", l: "Analisi margini" },
  { v: "rivenditori", l: "Rivenditori" },
  { v: "regolamento", l: "Regolamento" },
  { v: "registro", l: "Registro modifiche" },
];

export default function PaginaListiniRivenditori({
  getPdfLib, onBack, titoloIndietro = "Magazzino e shop", titolo = "Listini rivenditori",
  operatore = null,
}) {
  // i dati della società per il piede dei due PDF: la stessa lettura del
  // listino del 15/11, non una seconda
  const [righeSocieta, setRigheSocieta] = useState([]);
  useEffect(() => { let vivo = true; datiSocieta().then((r) => { if (vivo) setRigheSocieta(r || []); }); return () => { vivo = false; }; }, []);
  const [scheda, setScheda] = useState("listino");
  const [livelli, setLivelli] = useState([]);
  const [parametri, setParametri] = useState([]);
  const [righe, setRighe] = useState([]);
  const [rivenditori, setRivenditori] = useState([]);
  const [ordini, setOrdini] = useState([]);
  const [verifiche, setVerifiche] = useState([]);
  const [regolamenti, setRegolamenti] = useState([]);
  const [modifiche, setModifiche] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [giro, setGiro] = useState(0);

  const [cerca, setCerca] = useState("");
  const [repartoScelto, setRepartoScelto] = useState("");
  const [notaScelta, setNotaScelta] = useState("");
  const [scelti, setScelti] = useState(null); // codici dei livelli spuntati
  const [escluse, setEscluse] = useState([]); // categorie fuori dal listino
  const [bozzaPrezzo, setBozzaPrezzo] = useState({});
  const [bozzaCosto, setBozzaCosto] = useState({});
  const [salvando, setSalvando] = useState(null);
  const [esito, setEsito] = useState("");
  const [bozzaRicarico, setBozzaRicarico] = useState(null);
  const [soglieAperte, setSoglieAperte] = useState(false);
  const [bozzaSoglia, setBozzaSoglia] = useState({});

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCaricando(true);
      try {
        const [l, p, r, rv, o, v, rg, m] = await Promise.all([
          leggiLivelli(), leggiParametri(), leggiListinoAdmin(), leggiRivenditori(),
          leggiOrdini(), leggiVerifiche(), leggiRegolamenti(), leggiModifiche(200),
        ]);
        if (!vivo) return;
        setLivelli(l); setParametri(p); setRighe(r); setRivenditori(rv);
        setOrdini(o); setVerifiche(v); setRegolamenti(rg); setModifiche(m);
        setErrore(null);
      } catch (e) { if (vivo) setErrore(`Non sono riuscito a leggere il listino: ${e?.message || e}`); }
      if (vivo) setCaricando(false);
    })();
    return () => { vivo = false; };
  }, [giro]);

  // l'ultima spunta dei livelli si ricorda: chi prepara il listino di un
  // Professional lo rifà con la stessa selezione. Lo stesso per le
  // categorie escluse.
  useEffect(() => {
    let vivo = true;
    leggiLivelliScelti().then((c) => { if (vivo && scelti == null) setScelti(c); });
    leggiCategorieEscluse().then((c) => { if (vivo) setEscluse(c || []); });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const attivi = useMemo(() => livelliAttivi(livelli), [livelli]);
  const tettoPct = parametro(parametri, "tetto_sconto_pct", 50);
  const ricaricoPct = parametro(parametri, "ricarico_minimo_pct", 30);
  const parametriMappa = useMemo(() => Object.fromEntries((parametri || []).map((p) => [p.chiave, Number(p.numero)])), [parametri]);

  // Nessun livello spuntato = tutti, finché nessuno ha scelto. Scelto e
  // svuotato, invece, resta vuoto: il tasto si spegne e lo dice.
  const codiciScelti = scelti == null ? attivi.map((l) => l.codice) : scelti;
  const livelliScelti = attivi.filter((l) => codiciScelti.includes(l.codice));
  const unoSolo = livelliScelti.length === 1;

  const reparti = useMemo(() => {
    const m = new Map();
    righe.forEach((r) => { if (!m.has(r.blocco)) m.set(r.blocco, { nome: r.blocco, ordine: r.blocco_ordine ?? 99, quanti: 0 }); m.get(r.blocco).quanti += 1; });
    return [...m.values()].sort((a, b) => a.ordine - b.ordine);
  }, [righe]);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return righe.filter((r) =>
      (!q || String(r.nome).toLowerCase().includes(q))
      && (!repartoScelto || r.blocco === repartoScelto)
      && (!notaScelta || r.nota === notaScelta));
  }, [righe, cerca, repartoScelto, notaScelta]);

  // Le categorie che il listino può contenere, con quante righe
  // ESPORTABILI ha ognuna: le conta la stessa funzione che poi filtra il
  // PDF e il foglio, non un conto a parte.
  const categorie = useMemo(() => categorieDelListino(righe), [righe]);
  const fuori = useMemo(() => new Set(escluse), [escluse]);
  const prodottiFuori = useMemo(
    () => categorie.filter((c) => fuori.has(c.nome)).reduce((s, c) => s + c.quanti, 0), [categorie, fuori]);
  const nelListino = useMemo(() => righeEsportabili(righe, escluse).length, [righe, escluse]);

  // La tabella si legge per categoria (18/11/2026): una fila di duecento
  // righe non dice a che punto del catalogo si è, e la spunta per
  // escludere una categoria dal listino deve stare SULLA categoria, dove
  // la si guarda.
  const perCategoria = useMemo(() => {
    const m = new Map();
    visibili.forEach((r) => {
      const k = nomeCategoria(r);
      if (!m.has(k)) m.set(k, { nome: k, ordine: r.blocco_ordine ?? 99, righe: [] });
      m.get(k).righe.push(r);
    });
    return [...m.values()].sort((a, b) => a.ordine - b.ordine);
  }, [visibili]);

  const contatori = useMemo(() => {
    const c = {};
    NOTE.forEach((n) => { c[n.chiave] = righe.filter((r) => r.nota === n.chiave).length; });
    return c;
  }, [righe]);

  async function cambiaScelti(codici) {
    setScelti(codici);
    try { await salvaLivelliScelti(codici); } catch { /* una spunta che non si ricorda non ferma il listino */ }
  }

  // Una categoria esclusa resta VISIBILE qui dentro, in grigio: da questa
  // pagina si correggono prezzi e costi, e nascondere le righe vorrebbe
  // dire non poterle più toccare. Quello che cambia è il file che esce.
  async function cambiaEscluse(nomi) {
    setEscluse(nomi);
    try { await salvaCategorieEscluse(nomi); }
    catch { /* una spunta che non si ricorda non ferma il listino */ }
  }

  async function salvaRicarico() {
    const testo = bozzaRicarico;
    setBozzaRicarico(null);
    if (testo == null) return;
    const n = Number(String(testo).replace(",", ".").trim());
    if (!Number.isFinite(n) || n < 0 || n > 500) return;
    if (n === ricaricoPct) return;
    try {
      await salvaParametro("ricarico_minimo_pct", n, operatore);
      setGiro((g) => g + 1);
      setEsito(`Ricarico minimo portato al ${String(n).replace(".", ",")}%: tutti i prezzi per livello si sono rifatti.`);
    } catch (e) { setErrore(`Il ricarico minimo non è stato salvato: ${e?.message || e}`); }
  }

  // Le soglie di un livello: ingresso, mantenimento, riassortimento
  // minimo. Stanno in tabella e non nel codice proprio per essere
  // cambiate senza pubblicare niente — è la richiesta della specifica.
  //
  // Il riassortimento minimo fa due mestieri: è il minimo d'ordine del
  // livello ED è la fascia della tabella dei riassortimenti. Cambiandolo
  // si sposta anche quella, e la riga lo dice.
  async function salvaSoglia(livello, campo) {
    const chiave = `${livello.id}:${campo}`;
    const testo = bozzaSoglia[chiave];
    setBozzaSoglia((b) => { const c = { ...b }; delete c[chiave]; return c; });
    if (testo == null) return;
    const n = Number(String(testo).replace(",", ".").trim());
    if (!Number.isFinite(n) || n < 0) return;
    if (n === Number(livello[campo])) return;
    try {
      await salvaLivello(livello.id, { [campo]: n }, operatore);
      setGiro((g) => g + 1);
      setEsito(`${livello.nome}: ${ETICHETTE_SOGLIA[campo]} portat${campo === "mantenimento_eur" ? "i" : "a"} a € ${euroIt(n)}. Il registro lo ha scritto.`);
    } catch (e) { setErrore(`${livello.nome}: ${e?.message || e}`); }
  }

  // Prezzo pubblico e costo, corretti in linea.
  //
  // Il prezzo pubblico, su un prodotto pubblicato, CAMBIA ANCHE IL SITO:
  // la riga lo dice prima di scrivere, perché è una conseguenza che da
  // qui non si vede.
  async function salvaRiga(r) {
    const testoPrezzo = bozzaPrezzo[r.id];
    const testoCosto = bozzaCosto[r.id];
    setBozzaPrezzo((b) => { const c = { ...b }; delete c[r.id]; return c; });
    setBozzaCosto((b) => { const c = { ...b }; delete c[r.id]; return c; });
    const lordo = testoPrezzo == null || String(testoPrezzo).trim() === "" ? null : Number(String(testoPrezzo).replace(",", "."));
    const costo = testoCosto === undefined ? undefined
      : String(testoCosto).trim() === "" ? null : Number(String(testoCosto).replace(",", "."));
    if (lordo != null && (!Number.isFinite(lordo) || lordo <= 0)) return;
    if (costo != null && costo !== undefined && (!Number.isFinite(costo) || costo < 0)) return;
    const cambiaPrezzo = lordo != null && lordo !== Number(r.pubblico_lordo);
    if (cambiaPrezzo && r.sullo_shop && !window.confirm(
      `«${r.nome}» è pubblicato sullo shop: cambiare il prezzo al pubblico cambia anche il prezzo sul sito (da ${euro(r.pubblico_lordo)} a ${euro(lordo)}). Procedo?`)) return;
    setSalvando(r.id); setErrore(null);
    try {
      const fatto = await scriviPrezzoECosto({ prodotto: r, lordo, costo, chi: operatore });
      if (fatto.fatto) {
        setGiro((g) => g + 1);
        setEsito(`«${r.nome}»: ${[fatto.prezzo ? "prezzo al pubblico" : null, fatto.costo ? "costo" : null].filter(Boolean).join(" e ")} aggiornat${fatto.prezzo && fatto.costo ? "i" : "o"}. Il registro lo ha scritto.`);
      }
    } catch (e) { setErrore(`${r.nome}: ${e?.message || e}`); }
    setSalvando(null);
  }

  // ---------- l'export ----------
  const [facendo, setFacendo] = useState(null);

  async function generaPdf() {
    if (facendo || !livelliScelti.length) return;
    setFacendo("pdf"); setErrore(null); setEsito("");
    try {
      // SI RILEGGE DAL SERVER, e non si filtra quello che è già in
      // pagina: la lettura dell'admin porta costi e margini, questa no.
      // È la differenza fra «l'interfaccia non li mostra» e «non li
      // riceve».
      const daEsportare = await leggiListinoDaEsportare();
      const { bytes, prodotti, pagine } = await creaListinoRivenditoriPdf(daEsportare, livelliScelti, {
        tettoPct, getPdfLib, righeSocieta, escluse,
      });
      const nome = unoSolo
        ? `listino-rivenditori-${livelliScelti[0].codice}-${new Date().toISOString().slice(0, 10)}.pdf`
        : `listino-rivenditori-${new Date().toISOString().slice(0, 10)}.pdf`;
      scaricaPdf(bytes, nome);
      setEsito(`${titoloListino(livelliScelti)}: ${prodotti} prodotti su ${pagine} pagine.`);
    } catch (e) { setErrore(`Non sono riuscito a creare il listino: ${e?.message || e}`); }
    setFacendo(null);
  }

  async function generaExcel() {
    if (facendo || !livelliScelti.length) return;
    setFacendo("excel"); setErrore(null); setEsito("");
    try {
      const daEsportare = await leggiListinoDaEsportare();
      const testo = csvListinoRivenditori(daEsportare, livelliScelti, escluse);
      const nome = unoSolo
        ? `listino-rivenditori-${livelliScelti[0].codice}-${new Date().toISOString().slice(0, 10)}.csv`
        : `listino-rivenditori-${new Date().toISOString().slice(0, 10)}.csv`;
      scaricaCsv(testo, nome);
      setEsito(`Foglio creato: ${righeEsportabili(daEsportare, escluse).length} prodotti.`);
    } catch (e) { setErrore(`Non sono riuscito a creare il foglio: ${e?.message || e}`); }
    setFacendo(null);
  }

  const foglio = `
    .lr-tab { border-collapse: collapse; width: 100%; font-family: ${FAMIGLIA_STRETTA}; }
    .lr-tab thead tr { background: #FAF6EE; }
    .lr-tab th { font-size: 9.5px; font-weight: 700; color: ${MUTED}; text-transform: uppercase;
                 letter-spacing: .3px; padding: 7px 4px; text-align: center; line-height: 1.2; }
    .lr-tab td { font-size: 14px; color: ${NAVY}; padding: 5px 4px; text-align: center;
                 border-top: 1px solid ${CREAM_BORDER}; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .lr-nome { text-align: left !important; white-space: normal !important; font-weight: 600; line-height: 1.2; }
    .lr-liv { font-weight: 800; }
    .lr-costo { color: ${MUTED}; }
    .lr-campo { width: 68px; font-family: ${FAMIGLIA_STRETTA}; font-size: 13.5px; text-align: right;
                border: 1px solid ${CREAM_BORDER}; border-radius: 7px; padding: 3px 5px; background: #fff; }
    @media (max-width: 760px) {
      .lr-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .lr-tab { min-width: 720px; }
    }
  `;

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "16px 12px 60px" }}>
      <style>{foglio}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <TastoLivelloPrecedente titolo={titoloIndietro} onClick={onBack} />
        <h1 style={{ ...stileTitoloPagina, marginTop: 8, marginBottom: 2 }}>{titolo}</h1>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 14 }}>
          Il programma a livelli: prezzi ricavati dal costo, qualifica dei rivenditori, regolamento.
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          {SCHEDE.map((s) => (
            <button key={s.v} onClick={() => setScheda(s.v)} data-scheda={s.v}
              style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 18, border: "none",
                background: scheda === s.v ? NAVY : "#fff", color: scheda === s.v ? "#fff" : NAVY, cursor: "pointer" }}>
              {s.l}
            </button>
          ))}
        </div>

        {errore && (
          <div style={{ ...fontBody, fontSize: 13, color: ROSSO, background: "#FDECEC", border: "1px solid #F2C9C4",
            borderRadius: 10, padding: "8px 12px", marginBottom: 10 }} data-errore>{errore}</div>
        )}
        {esito && (
          <div style={{ ...fontBody, fontSize: 13, color: "#2E6B3E", background: "#E9F6EC", border: "1px solid #BFE3C8",
            borderRadius: 10, padding: "8px 12px", marginBottom: 10 }} data-esito>{esito}</div>
        )}
        {caricando && <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Leggo il listino…</div>}

        {!caricando && (scheda === "listino" || scheda === "margini") && (
          <>
            {/* IL RICARICO MINIMO, in alto: è il numero da cui dipende
                ogni prezzo di questa pagina, e sta dove si guarda prima */}
            <div style={{ background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 14, padding: "12px 16px", marginBottom: 12,
              display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...fontBody, fontSize: 13, color: NAVY, flex: "1 1 280px", lineHeight: 1.5 }}>
                Nessun prezzo scende sotto <b>costo × (1 + ricarico minimo)</b>: da lì nasce lo sconto cedibile, e i cinque
                livelli se ne prendono un quinto per volta. Cambiandolo si rifanno tutti i prezzi del listino.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>ricarico minimo</span>
                <input data-ricarico value={bozzaRicarico ?? String(ricaricoPct).replace(".", ",")}
                  onChange={(e) => setBozzaRicarico(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={salvaRicarico}
                  style={{ ...inputStyle, width: 72, textAlign: "right", fontSize: 14 }} />
                <span style={{ ...fontBody, fontSize: 14, color: NAVY, fontWeight: 700 }}>%</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca prodotto…"
                style={{ ...inputStyle, flex: "1 1 200px", minWidth: 150, fontSize: 14 }} />
              <select value={repartoScelto} onChange={(e) => setRepartoScelto(e.target.value)}
                style={{ ...inputStyle, flex: "0 1 220px", fontSize: 14, cursor: "pointer" }}>
                <option value="">Tutte le categorie ({righe.length})</option>
                {reparti.map((b) => <option key={b.nome} value={b.nome}>{b.nome} ({b.quanti})</option>)}
              </select>
              <select value={notaScelta} onChange={(e) => setNotaScelta(e.target.value)}
                style={{ ...inputStyle, flex: "0 1 240px", fontSize: 14, cursor: "pointer" }}>
                <option value="">Tutte le note</option>
                {NOTE.map((n) => <option key={n.chiave} value={n.chiave}>{n.etichetta} ({contatori[n.chiave] || 0})</option>)}
              </select>
            </div>
          </>
        )}

        {!caricando && scheda === "listino" && (
          <>
            {/* LA SPUNTA DEI LIVELLI, e vale anche per quello che si vede:
                così si guarda prima quello che verrà esportato. Con un
                livello solo la tabella non nomina più gli altri — un
                listino per un Professional non deve rivelare che esiste
                il Distributor. */}
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 8 }}>
                Livelli da mostrare e da esportare
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ ...fontBody, fontSize: 13, color: NAVY, display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" data-livello="tutti"
                    checked={codiciScelti.length === attivi.length}
                    onChange={(e) => cambiaScelti(e.target.checked ? attivi.map((l) => l.codice) : [])} />
                  <b>Tutti</b>
                </label>
                {attivi.map((l) => (
                  <label key={l.codice} style={{ ...fontBody, fontSize: 13, color: NAVY, display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}
                    title={`${l.nome}: fino a −${String(nominalePct(l, tettoPct)).replace(".", ",")}% · ingresso ${l.ingresso_cumulabile ? `${soglia(l.ingresso_eur)} cumulati` : `ordine ${soglia(l.ingresso_eur)}`} · mantenimento ${soglia(l.mantenimento_eur)}/anno · riassortimento minimo ${soglia(l.riassortimento_minimo_eur)}`}>
                    <input type="checkbox" data-livello={l.codice} checked={codiciScelti.includes(l.codice)}
                      onChange={(e) => cambiaScelti(e.target.checked
                        ? [...codiciScelti, l.codice]
                        : codiciScelti.filter((c) => c !== l.codice))} />
                    {l.nome} −{String(nominalePct(l, tettoPct)).replace(".", ",")}%
                  </label>
                ))}
                <div style={{ flex: 1 }} />
                <Button onClick={generaPdf} disabled={!livelliScelti.length || !!facendo}
                  style={{ fontSize: 13, padding: "8px 14px" }}
                  title={!livelliScelti.length ? "Spunta almeno un livello: un listino senza prezzi non serve a nessuno" : titoloListino(livelliScelti)}>
                  {facendo === "pdf" ? "Creo il listino…" : "Genera listino (PDF)"}
                </Button>
                <Button variant="ghost" onClick={generaExcel} disabled={!livelliScelti.length || !!facendo}
                  style={{ fontSize: 13, padding: "8px 14px" }}>
                  {facendo === "excel" ? "Creo il foglio…" : "Excel"}
                </Button>
              </div>
              {unoSolo && (
                <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6D1D", marginTop: 8, lineHeight: 1.5 }} data-un-livello>
                  Un livello solo: il file si intitola «{titoloListino(livelliScelti)}», porta la colonna
                  «Sconto applicato» al posto di «Sconto max sul prodotto» — che sarebbe lo sconto del livello più alto —
                  e non nomina nessun altro livello.
                </div>
              )}
              {!livelliScelti.length && (
                <div style={{ ...fontBody, fontSize: 12.5, color: ROSSO, marginTop: 8 }}>
                  Nessun livello spuntato: non c'è niente da esportare.
                </div>
              )}
              {/* CHE COSA RESTA FUORI, prima di premere. La spunta sta sulla
                  banda di ogni categoria, in fondo alla pagina: chi arriva
                  qui per generare il file deve poter leggere da subito che
                  qualcosa non ci sarà, senza scorrere duecento righe. */}
              <div style={{ ...fontBody, fontSize: 12.5, color: escluse.length ? "#8A6D1D" : MUTED, marginTop: 8, lineHeight: 1.5 }}
                data-escluse={escluse.length}>
                {escluse.length ? (
                  <>
                    <b>Fuori dal listino {escluse.length === 1 ? "una categoria" : `${escluse.length} categorie`}</b> ({prodottiFuori} prodotti):{" "}
                    {escluse.join(" · ")}. Il file ne conterrà <b>{nelListino}</b>.{" "}
                    <button onClick={() => cambiaEscluse([])} data-rimetti-categorie
                      style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "transparent",
                        border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                      Rimettile tutte
                    </button>
                  </>
                ) : (
                  <>Tutte le {categorie.length} categorie entrano nel listino ({nelListino} prodotti). Per escluderne una, togli la spunta sulla sua banda qui sotto.</>
                )}
              </div>
              <button onClick={() => setSoglieAperte((v) => !v)} data-apri-soglie
                style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "transparent",
                  border: "none", padding: "8px 0 0", cursor: "pointer" }}>
                {soglieAperte ? "▾" : "▸"} Le soglie dei livelli
              </button>
              {soglieAperte && (
                <div style={{ marginTop: 8 }} data-soglie>
                  <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                    Si cambiano da qui, senza pubblicare niente. Il <b>riassortimento minimo</b> fa due mestieri: è il
                    minimo d'ordine del livello ed è la sua fascia nella tabella dei riassortimenti — cambiandolo si
                    sposta anche quella, nel regolamento compreso.
                  </div>
                  <div className="lr-scroll">
                    <table className="lr-tab">
                      <thead><tr>
                        <th style={{ textAlign: "left", paddingLeft: 10 }}>Livello</th>
                        <th>Sconto<br />massimo</th><th>Ingresso</th>
                        <th>Acquisti annui<br />per mantenerlo</th><th>Riassortimento<br />minimo</th>
                      </tr></thead>
                      <tbody>
                        {attivi.map((l) => (
                          <tr key={l.codice} data-soglia={l.codice}>
                            <td className="lr-nome" style={{ paddingLeft: 10 }}>{l.nome}</td>
                            <td className="lr-liv" title={`${l.frazione} del cedibile, cioè ${String(nominalePct(l, tettoPct)).replace(".", ",")} per cento sui prodotti che reggono il tetto`}>
                              −{String(nominalePct(l, tettoPct)).replace(".", ",")}%
                            </td>
                            {["ingresso_eur", "mantenimento_eur", "riassortimento_minimo_eur"].map((campo) => (
                              <td key={campo}>
                                <input className="lr-campo" data-campo-soglia={`${l.codice}:${campo}`}
                                  value={bozzaSoglia[`${l.id}:${campo}`] ?? cifra(l[campo])}
                                  onChange={(e) => setBozzaSoglia((b) => ({ ...b, [`${l.id}:${campo}`]: e.target.value }))}
                                  onFocus={(e) => e.target.select()}
                                  onBlur={() => salvaSoglia(l, campo)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="lr-scroll" style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
              <table className="lr-tab">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingLeft: 10 }}>Prodotto</th>
                    <th title="Prezzo al pubblico, IVA inclusa. Si scrive qui: su un prodotto pubblicato cambia anche il sito.">Pubblico<br />IVA incl.</th>
                    <th>Netto<br />IVA escl.</th>
                    <th title="Costo d'acquisto, IVA esclusa. Non entra in nessun file per i rivenditori.">Costo<br />acquisto</th>
                    {livelliScelti.map((l) => (
                      <th key={l.codice} data-colonna={l.codice}
                        title={`${l.nome} (fino a -${String(nominalePct(l, tettoPct)).replace(".", ",")}%) – ingresso ${l.ingresso_cumulabile ? `${soglia(l.ingresso_eur)} cumulati` : `ordine ${soglia(l.ingresso_eur)}`}`}>
                        {l.nome}<br />
                        <span style={{ fontWeight: 400, textTransform: "none" }}>
                          −{String(nominalePct(l, tettoPct)).replace(".", ",")}% · {soglia(l.ingresso_eur)}
                        </span>
                      </th>
                    ))}
                    <th>{unoSolo ? <>Sconto<br />applicato</> : <>Sconto max<br />sul prodotto</>}</th>
                    <th style={{ textAlign: "left" }}>Nota</th>
                  </tr>
                </thead>
                {/* UNA CATEGORIA PER VOLTA, con la sua spunta (18/11/2026).
                    La spunta decide che cosa esce nel file, non che cosa si
                    vede: le righe di una categoria esclusa restano qui,
                    perche' da questa pagina si correggono prezzi e costi e
                    nasconderle vorrebbe dire non poterle piu' toccare. */}
                {perCategoria.map((c) => {
                  const esclusa = fuori.has(c.nome);
                  return (
                    <tbody key={c.nome} data-categoria={c.nome}>
                      <tr>
                        <td colSpan={4 + livelliScelti.length + 2}
                          style={{ padding: 0, borderTop: `1px solid ${CREAM_BORDER}`, textAlign: "left" }}>
                          <label data-banda={c.nome}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer",
                              background: esclusa ? "#EFEEEC" : NAVY, color: esclusa ? MUTED : "#fff" }}
                            title={esclusa
                              ? `«${c.nome}» non entra nel listino da consegnare: i suoi ${c.quanti ?? c.righe.length} prodotti restano qui per essere corretti.`
                              : `«${c.nome}» entra nel listino da consegnare. Togli la spunta per lasciarla fuori.`}>
                            <input type="checkbox" data-categoria-spunta={c.nome} checked={!esclusa}
                              onChange={(e) => cambiaEscluse(e.target.checked
                                ? escluse.filter((n) => n !== c.nome)
                                : [...escluse, c.nome])} />
                            <b style={{ ...fontBody, fontSize: 12.5, letterSpacing: 0.3, textTransform: "uppercase" }}>{c.nome}</b>
                            <span style={{ ...fontBody, fontSize: 11.5, opacity: 0.8 }}>{c.righe.length} prodotti</span>
                            <div style={{ flex: 1 }} />
                            {esclusa && (
                              <span data-fuori={c.nome} style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: ROSSO,
                                background: "#FDECEC", borderRadius: 9, padding: "2px 8px", whiteSpace: "nowrap" }}>
                                fuori dal listino
                              </span>
                            )}
                          </label>
                        </td>
                      </tr>
                      {c.righe.map((r) => {
                      const n = notaDi(r.nota);
                      return (
                        <tr key={r.id} data-riga={r.nome} style={{ background: r.nota === "nessuno_sconto" ? "#FFFBFB" : undefined, opacity: esclusa ? 0.55 : 1 }}>
                          <td className="lr-nome" style={{ paddingLeft: 10 }}>
                            {r.nome}
                            {r.tipo === "bundle" && (
                              <div style={{ ...fontBody, fontSize: 10.5, color: MUTED }}>kit · costo dalla distinta</div>
                            )}
                          </td>
                          <td>
                            <input className="lr-campo" data-prezzo={r.nome}
                              value={bozzaPrezzo[r.id] ?? cifra(r.pubblico_lordo)}
                              onChange={(e) => setBozzaPrezzo((b) => ({ ...b, [r.id]: e.target.value }))}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => salvaRiga(r)}
                              disabled={salvando === r.id} />
                          </td>
                          <td className="lr-costo">{cifra(r.pubblico_netto)}</td>
                          <td>
                            <input className="lr-campo" data-costo={r.nome}
                              value={bozzaCosto[r.id] ?? (r.costo == null ? "" : cifra(r.costo))}
                              placeholder={r.tipo === "bundle" ? "distinta" : "—"}
                              onChange={(e) => setBozzaCosto((b) => ({ ...b, [r.id]: e.target.value }))}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => salvaRiga(r)}
                              disabled={salvando === r.id || r.tipo === "bundle"}
                              title={r.tipo === "bundle" ? "Su un kit il costo è la somma della distinta: si corregge sui componenti, non qui." : "Costo d'acquisto, IVA esclusa"} />
                          </td>
                          {livelliScelti.map((l) => (
                            <td key={l.codice} className="lr-liv">{cifra(r.prezzi?.[l.codice])}</td>
                          ))}
                          <td style={{ fontWeight: 700, color: r.nota === "nessuno_sconto" ? ROSSO : NAVY }}>
                            {pct(unoSolo ? r.sconti_pct?.[livelliScelti[0].codice] : r.sconto_max_pct)}
                          </td>
                          <td style={{ textAlign: "left" }}>
                            <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: n.colore, background: n.fondo,
                              borderRadius: 9, padding: "2px 7px", whiteSpace: "nowrap" }}>{n.etichetta}</span>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              {visibili.length} prodotti in {perCategoria.length} categorie; nel listino da consegnare ne entrano <b>{nelListino}</b>.
              Il costo e il margine non entrano in nessun file: quel listino nasce da una lettura separata che quei campi
              non li riceve.
            </div>
          </>
        )}

        {!caricando && scheda === "margini" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {NOTE.map((n) => (
                <div key={n.chiave} style={{ background: n.fondo, border: `1px solid ${CREAM_BORDER}`, borderRadius: 12,
                  padding: "10px 14px", minWidth: 120 }} data-contatore={n.chiave}>
                  <div style={{ ...fontBody, fontSize: 24, fontWeight: 800, color: n.colore }}>{contatori[n.chiave] || 0}</div>
                  <div style={{ ...fontBody, fontSize: 11.5, color: n.colore }}>{n.etichetta}</div>
                </div>
              ))}
            </div>
            <div className="lr-scroll" style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
              <table className="lr-tab">
                <thead><tr>
                  <th style={{ textAlign: "left", paddingLeft: 10 }}>Prodotto</th>
                  <th>Netto</th><th>Costo</th><th>Pavimento<br />costo × ricarico</th>
                  <th>Sconto<br />cedibile</th><th>Prezzo<br />{attivi[attivi.length - 1]?.nome || "ultimo livello"}</th>
                  <th>Margine<br />in euro</th><th>Margine<br />in %</th><th style={{ textAlign: "left" }}>Nota</th>
                </tr></thead>
                <tbody>
                  {visibili.map((r) => {
                    const n = notaDi(r.nota);
                    return (
                      <tr key={r.id} data-margine={r.nome}>
                        <td className="lr-nome" style={{ paddingLeft: 10 }}>{r.nome}</td>
                        <td>{cifra(r.pubblico_netto)}</td>
                        <td className="lr-costo">{r.costo == null ? "—" : cifra(r.costo)}</td>
                        <td className="lr-costo">{r.costo == null ? "—" : cifra(Math.round(r.costo * (1 + ricaricoPct / 100) * 100) / 100)}</td>
                        <td style={{ fontWeight: 700, color: r.nota === "nessuno_sconto" ? ROSSO : NAVY }}>{pct(r.sconto_max_pct)}</td>
                        <td className="lr-liv">{cifra(r.prezzo_distributor)}</td>
                        <td>{r.margine_distributor_eur == null ? "—" : cifra(r.margine_distributor_eur)}</td>
                        <td style={{ fontWeight: 700 }}>{pct(r.margine_distributor_pct)}</td>
                        <td style={{ textAlign: "left" }}>
                          <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: n.colore, background: n.fondo, borderRadius: 9, padding: "2px 7px", whiteSpace: "nowrap" }}>{n.etichetta}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              Il margine è sul prezzo del livello più alto, cioè il meno caro per noi: su tutti gli altri livelli è più
              largo. Questa scheda non si esporta e non entra in nessun file.
            </div>
          </>
        )}

        {!caricando && scheda === "rivenditori" && (
          <SchedaRivenditori
            livelli={livelli} parametri={parametriMappa} rivenditori={rivenditori}
            ordini={ordini} verifiche={verifiche} tettoPct={tettoPct} chi={operatore}
            onSalva={async (id, campi) => { await salvaRivenditore(id, campi); setGiro((g) => g + 1); }}
            onCancella={async (id) => { await cancellaRivenditore(id); setGiro((g) => g + 1); }}
            onAggiungiOrdine={async (riga) => { await aggiungiOrdine(riga); setGiro((g) => g + 1); }}
            onCancellaOrdine={async (id) => { await cancellaOrdine(id); setGiro((g) => g + 1); }}
            onAggiungiVerifica={async (riga) => { await aggiungiVerifica(riga); setGiro((g) => g + 1); }}
          />
        )}

        {!caricando && scheda === "regolamento" && (
          <SchedaRegolamento livelli={livelli} tettoPct={tettoPct} regolamenti={regolamenti}
            getPdfLib={getPdfLib} righeSocieta={righeSocieta} />
        )}

        {!caricando && scheda === "registro" && (
          <>
            <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
              Ogni modifica a prezzi, costi e parametri, da qualunque pagina: lo scrive il database con un trigger, non
              questa pagina — un registro scritto dal listino avrebbe raccontato solo le modifiche fatte dal listino.
              Dove il nome manca, la modifica è arrivata da una strada che non lo dichiara.
            </div>
            <div className="lr-scroll" style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
              <table className="lr-tab">
                <thead><tr>
                  <th style={{ textAlign: "left", paddingLeft: 10 }}>Quando</th><th style={{ textAlign: "left" }}>Chi</th>
                  <th style={{ textAlign: "left" }}>Che cosa</th><th style={{ textAlign: "left" }}>Campo</th>
                  <th>Prima</th><th>Dopo</th>
                </tr></thead>
                <tbody>
                  {modifiche.map((m) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: "left", paddingLeft: 10, color: MUTED }}>
                        {new Date(m.quando).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ textAlign: "left", color: m.chi === "non registrato" ? MUTED : NAVY }}>{m.chi}</td>
                      <td className="lr-nome">{m.riferimento}</td>
                      <td style={{ textAlign: "left", color: MUTED }}>{m.campo}</td>
                      <td className="lr-costo">{m.valore_prima ?? "—"}</td>
                      <td className="lr-liv">{m.valore_dopo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {modifiche.length === 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginTop: 10 }}>
                Nessuna modifica registrata: il registro parte da oggi.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
