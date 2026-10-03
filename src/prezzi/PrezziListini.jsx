// Prezzi e listini: il listino dei rivenditori, a blocchi.
//
// Quattro numeri per prodotto — pubblico lordo, pubblico netto, sconto
// massimo concedibile, prezzo che paga il rivenditore — divisi per
// reparto, nello stesso ordine del menu del sito.
//
// Sola lettura. Non tocca `prezzo_vendita`, non scrive su WooCommerce: il
// listino per i rivenditori è una cosa, il prezzo dello shop un'altra.
// Il conto sta tutto nella view `v_prezzi_listini`, così la stessa
// formula non finisce scritta due volte in due posti che poi divergono.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, BG, MUTED, GOLD, FAMIGLIA_STRETTA, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { leggiListino, csvListino, scaricaCsv, salvaPuntiProdotto, BLOCCHI, motivoSenzaSconto } from "./dati.js";
import { iconaDelBlocco } from "./icone.jsx";

const euro = (n) => (n == null ? "—" : `€ ${Number(n).toFixed(2).replace(".", ",")}`);
// dentro la tabella il simbolo non si ripete: lo dicono le intestazioni,
// e otto colonne di numeri su un telefono non possono permetterselo
const cifra = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(".", ","));
// le percentuali ora hanno il mezzo punto: 30 resta "30", 29,5 resta
// "29,5", e la coda di zeri del numeric non arriva mai in pagina
const pct = (n) => (n == null ? "—" : String(Math.round(Number(n) * 10) / 10).replace(".", ","));
const ROSSO = "#C0392B";

// `privato` accende le colonne che non si mostrano a nessuno fuori:
// il prezzo di acquisto in testa, e in coda quello che resta in tasca
// vendendo al pubblico o a un rivenditore. E' la stessa tabella, non una
// copia: due tabelle sugli stessi numeri finirebbero per divergere.
export default function PrezziListini({ privato = false, onApriProdotto, onBack, titoloIndietro = "Magazzino e shop", titolo = "Prezzi e listini" }) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState("");
  const [bloccoScelto, setBloccoScelto] = useState(null); // null = tutti
  // quello che si sta scrivendo nella casella della master, finche' non si
  // esce dal campo: il valore buono resta quello di `righe`, questo e' solo
  // il testo in corso di battitura
  const [bozzaPunti, setBozzaPunti] = useState({});

  // I punti hanno una formula viva — netto x sconto massimo x 2, calcolata
  // nella view a ogni lettura — e una scrittura a mano che la scavalca.
  // Svuotare la casella e' il modo per tornare alla formula, e quando un
  // costo cambiera' il numero si muovera' da solo: scriverlo a mano lo
  // congela, ed e' giusto che si veda (fondo azzurro).
  async function salvaPunti(r) {
    const testo = bozzaPunti[r.id];
    setBozzaPunti((b) => { const c = { ...b }; delete c[r.id]; return c; });
    if (testo == null) return;
    const pulito = String(testo).replace(",", ".").trim();
    const punti = pulito === "" ? null : Number(pulito);
    if (punti != null && (!Number.isFinite(punti) || punti < 0)) return;
    if (punti == null && !r.punti_manuali) return;
    setRighe((prev) => prev.map((x) => x.id !== r.id ? x : {
      ...x,
      punti_prodotto: punti == null ? x.punti_calcolati : punti,
      punti_manuali: punti != null,
    }));
    try { await salvaPuntiProdotto(r.id, punti); }
    catch (e) { setErrore(`Non sono riuscito a salvare i punti di ${r.nome}: ${e?.message || e}`); }
  }

  // I punti hanno una formula viva — netto x sconto massimo x 2, calcolata
  // nella view a ogni lettura — e una scrittura a mano che la scavalca.
  // Svuotare la casella e' il modo per tornare alla formula, e quando un
  // costo cambiera' il numero si muovera' da solo: scriverlo a mano lo
  // congela, ed e' giusto che si veda (fondo azzurro).
  async function salvaPunti(r) {
    const testo = bozzaPunti[r.id];
    setBozzaPunti((b) => { const c = { ...b }; delete c[r.id]; return c; });
    if (testo == null) return;
    const pulito = String(testo).replace(",", ".").trim();
    const punti = pulito === "" ? null : Number(pulito);
    if (punti != null && (!Number.isFinite(punti) || punti < 0)) return;
    if (punti == null && !r.punti_manuali) return;
    setRighe((prev) => prev.map((x) => x.id !== r.id ? x : {
      ...x,
      punti_prodotto: punti == null ? x.punti_calcolati : punti,
      punti_manuali: punti != null,
    }));
    try { await salvaPuntiProdotto(r.id, punti); }
    catch (e) { setErrore(`Non sono riuscito a salvare i punti di ${r.nome}: ${e?.message || e}`); }
  }

  useEffect(() => {
    (async () => {
      setCaricando(true);
      try {
        const dati = await leggiListino();
        setRighe(dati || []);
        if (!dati || dati.length === 0) setErrore("Nessun prodotto in vendita sullo shop. Se lo shop ha prodotti, la view v_prezzi_listini non è raggiungibile.");
      } catch (e) { setErrore(e?.message || "Errore di lettura"); }
      setCaricando(false);
    })();
  }, []);

  const q = cerca.trim().toLowerCase();
  const visibili = useMemo(
    () => righe.filter((r) => (!q || (r.nome || "").toLowerCase().includes(q)) && (bloccoScelto == null || r.blocco_ordine === bloccoScelto)),
    [righe, q, bloccoScelto]);

  // i reparti che hanno davvero qualcosa dentro, nell'ordine del menu
  const gruppi = useMemo(() => {
    const per = new Map();
    for (const r of visibili) {
      if (!per.has(r.blocco_ordine)) per.set(r.blocco_ordine, []);
      per.get(r.blocco_ordine).push(r);
    }
    return BLOCCHI.filter((b) => per.has(b.n)).map((b) => ({ ...b, prodotti: per.get(b.n) }));
  }, [visibili]);

  // i reparti della tendina: tutti quelli che esistono, anche quando la
  // ricerca li ha svuotati — spariscono solo se il reparto è vuoto di suo
  const reparti = useMemo(() => {
    const presenti = new Set(righe.map((r) => r.blocco_ordine));
    return BLOCCHI.filter((b) => presenti.has(b.n));
  }, [righe]);

  function esporta() {
    scaricaCsv(csvListino(visibili), `listino-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Il foglio della tabella. Sta qui e non negli stili inline perche' sotto
  // i 700px la tabella non e' piu' una tabella: diventa un blocco per
  // prodotto, col nome sopra e i quattro numeri in riga sotto. Cinque
  // colonne su un telefono non ci stanno, e farle scorrere di lato
  // significa nascondere meta' listino.
  //
  // Media query vere, non la larghezza letta da JavaScript: con la vista
  // scrivania forzata da iPad `screen.width` racconta un'altra cosa,
  // mentre il CSS segue i pixel veri della pagina.
  // Il foglio della tabella. Una riga per prodotto, sempre: anche da
  // telefono. Ci sta perche' il carattere e' condensato — Sofia Sans
  // Condensed, lo stesso delle tabelle strette dell'app — e perche' i
  // numeri hanno larghezza fissa (`tabular-nums`), cosi' le colonne non
  // ballano da una riga all'altra.
  //
  // Media query vere, non la larghezza letta da JavaScript: con la vista
  // scrivania forzata da iPad `screen.width` racconta un'altra cosa,
  // mentre il CSS segue i pixel veri della pagina.
  const foglio = `
    .lst-tab { border-collapse: collapse; width: 100%; table-layout: fixed;
               font-family: ${FAMIGLIA_STRETTA}; }
    .lst-tab thead tr { background: #FAF6EE; }
    .lst-tab th { font-size: 9.5px; font-weight: 700; color: ${MUTED}; text-transform: uppercase;
                  letter-spacing: .3px; padding: 7px 3px; text-align: center; line-height: 1.15; white-space: pre-line; }
    .lst-tab td { font-size: 14px; color: ${NAVY}; padding: 6px 3px; text-align: center;
                  border-top: 1px solid ${CREAM_BORDER}; white-space: nowrap;
                  font-variant-numeric: tabular-nums; }

    .lst-foto  { width: 40px; padding-left: 10px !important; padding-right: 0 !important; }
    .lst-foto img { width: 32px; height: 32px; object-fit: cover; border-radius: 7px;
                    display: block; background: #F3EFE6; }
    .lst-vuota { width: 32px; height: 32px; border-radius: 7px; background: #F3EFE6; display: block; }

    .lst-nome  { text-align: left !important; white-space: normal !important;
                 font-weight: 600; line-height: 1.15; padding-left: 8px !important; }
    .lst-riv   { font-weight: 800; padding-right: 10px !important; }
    /* lo sconto in euro: stesso oro della percentuale, e' la stessa cosa
       detta in soldi invece che in punti */
    .lst-tab td.lst-sconto-eur { color: #8A6D1D; font-weight: 800; }
    .lst-tab td.lst-punti { color: #3B6FA0; font-weight: 800; }
    .lst-manca { background: #FDFAF2; }

    /* le larghezze: il nome prende quello che resta, i numeri stanno stretti */
    .lst-tab col.c-foto { width: 42px; }
    .lst-tab col.c-nome { width: auto; }
    .lst-tab col.c-num  { width: 66px; }
    .lst-tab col.c-scon { width: 52px; }
    .lst-tab col.c-costo { width: 62px; }
    .lst-tab td.lst-costo, .lst-tab th.lst-costo { color: ${MUTED}; }
    /* Nel listino privato i numeri sono cinque: su un telefono una riga
       sola non basta, e farla scorrere di lato vorrebbe dire nascondere
       proprio le colonne che servono a decidere. Quindi sotto i 700px il
       nome prende la riga intera e i cinque numeri si dispongono sotto, in
       griglia, ciascuno con la sua etichetta. Tutto in una schermata,
       niente da trascinare. */
    @media (max-width: 700px) {
      .lst-privato .lst-tab thead { display: none; }
      .lst-privato .lst-tab, .lst-privato .lst-tab tbody,
      .lst-privato .lst-tab tr, .lst-privato .lst-tab td { display: block; }
      .lst-privato .lst-tab colgroup { display: none; }
      /* minmax(0, 1fr) e non 1fr: con "1fr" il minimo di ogni colonna e'
         la larghezza del suo contenuto, e le celle hanno white-space
         nowrap — cosi' le ultime finiscono fuori a destra. */
      .lst-privato .lst-tab tr { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
                                 gap: 0 2px; padding: 10px 6px; border-top: 1px solid ${CREAM_BORDER}; }
      .lst-privato .lst-tab td { border-top: none; padding: 0; font-size: 12.5px; text-align: center;
                                 min-width: 0; white-space: normal; overflow-wrap: anywhere; }
      /* da telefono la pillola intera non ci sta nella sua colonna e
         finiva sopra a quella accanto: resta il punto interrogativo, il
         perche' e' nel titolo della riga */
      .lst-privato .lst-tab .lst-manca-eti { font-size: 0; padding: 3px 7px; }
      .lst-privato .lst-tab .lst-manca-eti::after { content: "?"; font-size: 11px; }
      .lst-privato .lst-tab td::before { content: attr(data-eti); display: block; font-size: 7.5px;
                                         white-space: pre-line;
                                         font-weight: 700; letter-spacing: 0; text-transform: uppercase;
                                         color: ${MUTED}; margin-bottom: 1px; line-height: 1.05;
                                         white-space: normal; }
      /* nome e foto occupano insieme la riga di sopra */
      .lst-privato .lst-tab td.lst-foto { grid-column: 1 / 2; padding: 0 !important; }
      .lst-privato .lst-tab td.lst-foto::before { content: none; }
      .lst-privato .lst-tab td.lst-foto img, .lst-privato .lst-tab td.lst-foto .lst-vuota { width: 26px; height: 26px; }
      .lst-privato .lst-tab td.lst-nome { grid-column: 2 / -1; padding: 3px 0 8px 6px !important;
                                          font-size: 13.5px; text-align: left; }
      .lst-privato .lst-tab td.lst-nome::before { content: none; }
      .lst-privato .lst-tab td.lst-riv { padding-right: 0 !important; }
    }

    @media (max-width: 560px) {
      .lst-tab td { font-size: 13px; padding: 5px 2px; }
      .lst-tab th { font-size: 8.5px; padding: 6px 2px; }
      .lst-tab col.c-num  { width: 58px; }
      .lst-tab col.c-scon { width: 44px; }
      .lst-foto { width: 34px; padding-left: 7px !important; }
      .lst-foto img, .lst-vuota { width: 27px; height: 27px; }
      .lst-nome { padding-left: 6px !important; font-size: 12.5px; }
      .lst-riv { padding-right: 7px !important; }
    }
  `;

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "16px 12px 60px" }}>
      <style>{foglio}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <TastoLivelloPrecedente titolo={titoloIndietro} onClick={onBack} />
        <h1 style={{ ...stileTitoloPagina, marginTop: 8, marginBottom: 2 }}>{titolo}</h1>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 14 }}>{privato ? "Costi, prezzi e quello che resta in tasca — solo per uso interno" : "Gestione prezzi vendita e rivenditori"}</div>


        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca prodotto…"
            style={{ ...inputStyle, flex: "1 1 220px", minWidth: 160, fontSize: 14 }} />
          {/* il reparto si sceglie da qui: i tredici reparti in fila uno
              sotto l'altro erano uno schermo intero prima di arrivare al
              primo prezzo. Il numero accanto al nome dice quanti prodotti
              ci sono dentro, cosi' si sceglie senza aprire e richiudere */}
          {reparti.length > 0 && (
            <select value={bloccoScelto == null ? "" : String(bloccoScelto)}
              onChange={(e) => setBloccoScelto(e.target.value === "" ? null : Number(e.target.value))}
              style={{ ...inputStyle, flex: "0 1 260px", minWidth: 190, fontSize: 14, cursor: "pointer" }}>
              <option value="">Tutti i reparti ({righe.length})</option>
              {reparti.map((b) => (
                <option key={b.n} value={b.n}>
                  {b.nome} ({righe.filter((r) => r.blocco_ordine === b.n).length})
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" onClick={esporta} disabled={visibili.length === 0} style={{ fontSize: 13, padding: "8px 14px" }}>Esporta CSV</Button>
        </div>

        {errore && <div style={{ ...fontBody, fontSize: 13, color: ROSSO, background: "#FBEBE9", border: "1px solid #F0C8C2", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>{errore}</div>}
        {caricando && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Sto leggendo il listino…</div>}
        {!caricando && gruppi.length === 0 && !errore && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Nessun prodotto corrisponde alla ricerca.</div>}

        {gruppi.map((b) => {
          const Ico = iconaDelBlocco(b.n);
          return (
            <div key={b.n}
              style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, marginBottom: 16, overflow: "hidden", scrollMarginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                <span style={{ width: 44, height: 44, borderRadius: 14, background: "#F6EFE2", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico s={23} c={GOLD} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...fontDisplay, fontSize: 19, fontWeight: 800, color: NAVY, letterSpacing: 0.4, lineHeight: 1.1 }}>{b.nome}</div>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 2 }}>{b.descrizione}</div>
                </div>
                <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, whiteSpace: "nowrap" }}>{b.prodotti.length} prodotti</div>
              </div>

              <div className={privato ? "lst-privato" : undefined}>
                <table className="lst-tab">
                  <colgroup>
                    <col className="c-foto" /><col className="c-nome" />
                    {privato && <col className="c-costo" />}
                    <col className="c-num" /><col className="c-num" />
                    <col className="c-scon" /><col className="c-num" />
                    {privato && <><col className="c-num" /><col className="c-num" /><col className="c-num" /></>}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="lst-foto" />
                      <th className="lst-nome">Prodotto</th>
                      {privato && <th className="lst-costo">{"prezzo\nacquisto"}</th>}
                      <th>{"pubbl.\nlordo"}</th>
                      <th>{"pubbl.\nnetto"}</th>
                      <th>{"sconto\nmax"}</th>
                      <th>{"prezzo\nrivend."}</th>
                      {privato && <><th>{"sconto\nin euro"}</th><th>{"punti\nprodotto"}</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {b.prodotti.map((r) => {
                      const manca = r.sconto_max_pct == null;
                      return (
                        // la scheda del prodotto si apre dalla foto e dal
                        // nome, non da tutta la riga: con i numeri cliccabili
                        // ogni passaggio sui prezzi rischiava di portare
                        // altrove, e la casella della master non si poteva
                        // nemmeno mettere a fuoco
                        <tr key={r.id} className={manca ? "lst-manca" : undefined}
                          title={manca ? motivoSenzaSconto(r) : `Scontando il ${String(r.sconto_max_pct).replace(".", ",")}% il rivenditore paga ${euro(r.prezzo_rivenditore)}. Costo della merce ${euro(r.costo_acquisto)}.`}>
                          <td className="lst-foto"
                            onClick={() => onApriProdotto && onApriProdotto(r.id)}
                            style={{ cursor: onApriProdotto ? "pointer" : "default" }}>
                            {r.foto_url
                              ? <img src={r.foto_url} alt="" loading="lazy" decoding="async" />
                              : <span className="lst-vuota" />}
                          </td>
                          <td className="lst-nome"
                            onClick={() => onApriProdotto && onApriProdotto(r.id)}
                            title={onApriProdotto ? "Apri la scheda del prodotto" : undefined}
                            style={{ cursor: onApriProdotto ? "pointer" : "default" }}>
                            {r.nome}
                          </td>
                          {privato && <td className="lst-costo" data-eti="acq.">{cifra(r.costo_acquisto)}</td>}
                          <td data-eti="lordo">{cifra(r.pubblico_lordo)}</td>
                          <td data-eti="netto">{cifra(r.pubblico_netto)}</td>
                          <td data-eti="sconto">
                            {manca ? (
                              <span className="lst-manca-eti" style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>costo mancante</span>
                            ) : (
                              /* rosso = forzato: il conto dava zero (il
                                 margine non basta a dividere il guadagno) e
                                 il 5% e' una scelta commerciale, non un
                                 numero calcolato */
                              <span
                                title={r.sconto_forzato
                                  ? `Forzato al 5%. Il calcolo dava ${pct(r.sconto_esatto_pct ?? 0)}%: su questo prodotto il margine non basta a dividere il guadagno a metà, quindi il 5% lo stai cedendo e basta.`
                                  : undefined}
                                style={{ ...fontBody, fontSize: 12, fontWeight: 800, color: r.sconto_forzato ? ROSSO : "#8A6D1D", background: r.sconto_forzato ? "#FBEBE9" : "#F6EFE2", borderRadius: 999, padding: "4px 10px" }}>{pct(r.sconto_max_pct)}%</span>
                            )}
                          </td>
                          <td className="lst-riv" data-eti="paga">{cifra(r.prezzo_rivenditore)}</td>
                          {privato && (
                            <>
                              {/* quanto gli stai lasciando, in soldi: la
                                  percentuale si confronta fra prodotti, gli
                                  euro si contano a fine trattativa */}
                              <td className="lst-sconto-eur" data-eti={"sconto\neuro"}
                                title={r.prezzo_rivenditore != null
                                  ? `Da ${euro(r.pubblico_netto)} a ${euro(r.prezzo_rivenditore)}: gli lasci ${euro(r.pubblico_netto - r.prezzo_rivenditore)} a pezzo.`
                                  : undefined}>
                                {r.prezzo_rivenditore != null ? cifra(r.pubblico_netto - r.prezzo_rivenditore) : "—"}
                              </td>
                              {/* i punti del prodotto: sei decimi del prezzo
                                  netto, un punto un euro */}
                              <td className="lst-punti" data-eti={"punti\nprodotto"}
                                title={r.punti_manuali
                                  ? `Scritti a mano. La formula darebbe ${cifra(r.punti_calcolati)}: svuota la casella per tornarci.`
                                  : `${euro(r.pubblico_netto)} di netto × ${pct(r.sconto_max_pct)}% di sconto massimo × 2. Si ricalcola da sé quando cambiano i costi: scrivici dentro per fissarlo.`}>
                                <input
                                  value={bozzaPunti[r.id] ?? (r.punti_prodotto != null ? String(r.punti_prodotto).replace(".", ",") : "")}
                                  onChange={(e) => setBozzaPunti((b) => ({ ...b, [r.id]: e.target.value }))}
                                  onFocus={(e) => e.target.select()}
                                  onBlur={() => salvaPunti(r)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") { setBozzaPunti((b) => { const c = { ...b }; delete c[r.id]; return c; }); e.currentTarget.blur(); }
                                  }}
                                  inputMode="decimal"
                                  placeholder="—"
                                  style={{ ...fontBody, width: 52, textAlign: "center", fontSize: 12.5, fontWeight: 800,
                                    color: "#3B6FA0", background: r.punti_manuali ? "#E9F0F7" : "transparent",
                                    border: "1px solid transparent", borderBottom: `1px dashed ${r.punti_manuali ? "#3B6FA0" : "#CFCFC7"}`,
                                    borderRadius: 4, padding: "1px 3px", outline: "none" }}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {privato && (
          <p style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 4, background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 12, padding: "10px 13px" }}>
            <b>Solo per te.</b> Qui ci sono i costi di acquisto: è una pagina da non mostrare a
            clienti né rivenditori. <b>Ti resta</b> è quello che rimane in tasca su un pezzo, pagata
            la merce, tolti i costi aziendali ({righe[0]?.sicurezza_pct ?? 15}%) e le imposte sul
            reddito ({String(righe[0]?.imposte_pct ?? 27.9).replace(".", ",")}%, IRES più IRAP).
            L'IVA non compare perché non è tua: la incassi per conto dello Stato e la giri.
            Le imposte vere si calcolano sull'utile dell'anno, con ammortamenti e deduzioni: questo
            è un ordine di grandezza per pezzo, non il conto del commercialista. Passando su un
            numero vedi quanto era prima delle imposte.
            {" "}
          </p>
        )}
        <p style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 4 }}>
          Lo <b>sconto massimo</b> è la quota che divide il guadagno a metà fra te e il rivenditore:
          concedendola, pagata la merce e i costi aziendali, a te resta quanto a lui. È arrotondata
          al <b>mezzo punto più vicino</b>: 27,7% diventa 27,5%, 27,8% diventa 28%. I passi da
          cinque erano una scure — un prodotto a 29,7% finiva al 25% — e facevano sembrare il
          listino fermo quando il conto si era già mosso.
          Dove il calcolo darebbe <b>zero</b> la percentuale è <b>forzata al 5% e scritta in
          rosso</b>: lì il margine non basta a dividere il guadagno, e quel 5% non è un conto
          ma una scelta — lo stai cedendo e basta, perché senza nessuno sconto un rivenditore
          non avrebbe ragione di comprare. I <b>punti prodotto</b> sono prezzo netto × sconto
          massimo × 2: si ricalcolano da sé a ogni apertura, quindi seguono i costi quando
          cambiano. Scrivere un numero nella casella lo fissa — svuotarla rimette la formula. Il
          <b> prezzo rivenditore</b> è il pubblico netto meno quello sconto. Ci sono solo i prodotti
          in vendita sullo shop: fuori chi non ha prezzo, non è pubblicato o è solo interno.
        </p>
      </div>
    </div>
  );
}
