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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NAVY, CREAM_BORDER, BG, MUTED, GOLD, FAMIGLIA_STRETTA, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import { leggiListino, csvListino, scaricaCsv, BLOCCHI, motivoSenzaSconto, FASI, faseDi, scenario } from "./dati.js";
import { iconaDelBlocco } from "./icone.jsx";

const euro = (n) => (n == null ? "—" : `€ ${Number(n).toFixed(2).replace(".", ",")}`);
// dentro la tabella il simbolo non si ripete: lo dicono le intestazioni,
// e otto colonne di numeri su un telefono non possono permetterselo
const cifra = (n) => (n == null ? "—" : Number(n).toFixed(2).replace(".", ","));
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
  const [faseId, setFaseId] = useState("bilanciato");
  const fase = faseDi(faseId);
  const riferimenti = useRef({});

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
  // ogni riga porta con se' i numeri della fase scelta: sconto, prezzo al
  // rivenditore e quello che resta. Cambiando linguetta cambiano questi,
  // non i dati — il listino e' sempre lo stesso
  const conFase = useMemo(() => righe.map((r) => {
    const sc = scenario(r, fase.k);
    return { ...r, sconto_fase_pct: sc.scontoPct, prezzo_fase: sc.prezzoRivenditore,
             guadagno_riv_fase: sc.guadagnoRivenditore, utile_fase: sc.utile, ti_resta_fase: sc.tiResta,
             quota_fase_pct: sc.quotaPct, sotto_fase: sc.sotto };
  }), [righe, fase.k]);
  const visibili = useMemo(
    () => conFase.filter((r) => (!q || (r.nome || "").toLowerCase().includes(q)) && (bloccoScelto == null || r.blocco_ordine === bloccoScelto)),
    [conFase, q, bloccoScelto]);

  // i reparti che hanno davvero qualcosa dentro, nell'ordine del menu
  const gruppi = useMemo(() => {
    const per = new Map();
    for (const r of visibili) {
      if (!per.has(r.blocco_ordine)) per.set(r.blocco_ordine, []);
      per.get(r.blocco_ordine).push(r);
    }
    return BLOCCHI.filter((b) => per.has(b.n)).map((b) => ({ ...b, prodotti: per.get(b.n) }));
  }, [visibili]);

  // le pastiglie in alto: tutti i reparti che esistono, anche quando la
  // ricerca li ha svuotati — spariscono solo se il reparto è vuoto di suo
  const reparti = useMemo(() => {
    const presenti = new Set(righe.map((r) => r.blocco_ordine));
    return BLOCCHI.filter((b) => presenti.has(b.n));
  }, [righe]);

  function vaiAl(n) {
    setBloccoScelto(null);
    setTimeout(() => riferimenti.current[n]?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }
  function esporta() {
    scaricaCsv(csvListino(visibili), `listino-${fase.id}-${new Date().toISOString().slice(0, 10)}.csv`);
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
    .lst-manca { background: #FDFAF2; }

    /* le larghezze: il nome prende quello che resta, i numeri stanno stretti */
    .lst-tab col.c-foto { width: 42px; }
    .lst-tab col.c-nome { width: auto; }
    .lst-tab col.c-num  { width: 66px; }
    .lst-tab col.c-scon { width: 52px; }
    .lst-tab col.c-costo { width: 62px; }
    .lst-tab td.lst-costo, .lst-tab th.lst-costo { color: ${MUTED}; }
    .lst-tab td.lst-resta { font-weight: 800; }
    .lst-tab td.lst-resta-riv { color: #8A6D1D; font-weight: 800; }
    .lst-tab td.lst-lui, .lst-tab th.lst-lui { color: ${MUTED}; }
    /* Nel listino privato i numeri sono sette: su un telefono una riga
       sola non basta, e farla scorrere di lato vorrebbe dire nascondere
       proprio le colonne che servono a decidere. Quindi sotto i 700px il
       nome prende la riga intera e i sette numeri si dispongono sotto, in
       griglia, ciascuno con la sua etichetta. Tutto in una schermata,
       niente da trascinare. */
    @media (max-width: 700px) {
      .lst-privato .lst-tab thead { display: none; }
      .lst-privato .lst-tab, .lst-privato .lst-tab tbody,
      .lst-privato .lst-tab tr, .lst-privato .lst-tab td { display: block; }
      .lst-privato .lst-tab colgroup { display: none; }
      /* minmax(0, 1fr) e non 1fr: con "1fr" il minimo di ogni colonna e'
         la larghezza del suo contenuto, e le celle hanno white-space
         nowrap — otto colonne cosi' sfondano lo schermo e le ultime
         finiscono fuori a destra. Proprio "a lui", che e' quella che
         serve a vedere se il bilanciato bilancia. */
      .lst-privato .lst-tab tr { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr));
                                 gap: 0 2px; padding: 10px 6px; border-top: 1px solid ${CREAM_BORDER}; }
      .lst-privato .lst-tab td { border-top: none; padding: 0; font-size: 12.5px; text-align: center;
                                 min-width: 0; white-space: normal; overflow-wrap: anywhere; }
      .lst-privato .lst-tab td::before { content: attr(data-eti); display: block; font-size: 7.5px;
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

        {/* Le tre fasi. Lo sconto E' la divisione del prezzo: meta', un
            terzo, un quarto. Niente da calcolare, solo da scegliere. */}
        <div style={{ display: "flex", gap: 6, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 5, marginBottom: 10 }}>
          {FASI.map((f) => {
            const attiva = f.id === faseId;
            return (
              <button key={f.id} onClick={() => setFaseId(f.id)} title={f.spiega}
                style={{ flex: 1, cursor: "pointer", borderRadius: 10, border: "none", padding: "9px 6px",
                  background: attiva ? NAVY : "transparent", color: attiva ? "#fff" : NAVY, ...fontBody }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 0.3 }}>{f.nome}</div>
                <div style={{ fontSize: 10.5, opacity: attiva ? 0.85 : 0.6, marginTop: 1 }}>{f.quota}</div>
              </button>
            );
          })}
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 12, lineHeight: 1.45 }}>{fase.spiega}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca prodotto…"
            style={{ ...inputStyle, flex: "1 1 220px", minWidth: 160, fontSize: 14 }} />
          <Button variant="ghost" onClick={esporta} disabled={visibili.length === 0} style={{ fontSize: 13, padding: "8px 14px" }}>Esporta CSV</Button>
        </div>

        {/* L'indice dei reparti: i nomi in chiaro, uno sotto l'altro, col
            numero di prodotti. Cliccato porta al blocco; ricliccato lascia
            solo quello. Niente tendina: un elenco si legge tutto insieme,
            una tendina nasconde quello che c'e' finche' non la apri. */}
        {reparti.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: "6px 4px", marginBottom: 16 }}>
            {reparti.map((b, i) => {
              const Ico = iconaDelBlocco(b.n);
              const attivo = bloccoScelto === b.n;
              const quanti = righe.filter((r) => r.blocco_ordine === b.n).length;
              return (
                <button key={b.n} onClick={() => (attivo ? setBloccoScelto(null) : (setBloccoScelto(null), vaiAl(b.n)))}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
                    background: attivo ? "#F6EFE2" : "transparent", border: "none",
                    borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`, padding: "11px 12px" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: "#F6EFE2", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico s={18} c={GOLD} />
                  </span>
                  <span style={{ ...fontDisplay, fontSize: 15.5, fontWeight: 800, color: NAVY, letterSpacing: 0.5, flex: 1, minWidth: 0 }}>{b.nome}</span>
                  <span style={{ ...fontBody, fontSize: 12.5, color: MUTED, whiteSpace: "nowrap" }}>{quanti}</span>
                </button>
              );
            })}
          </div>
        )}

        {errore && <div style={{ ...fontBody, fontSize: 13, color: ROSSO, background: "#FBEBE9", border: "1px solid #F0C8C2", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>{errore}</div>}
        {caricando && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Sto leggendo il listino…</div>}
        {!caricando && gruppi.length === 0 && !errore && <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, padding: "24px 4px" }}>Nessun prodotto corrisponde alla ricerca.</div>}

        {gruppi.map((b) => {
          const Ico = iconaDelBlocco(b.n);
          return (
            <div key={b.n} ref={(el) => { riferimenti.current[b.n] = el; }}
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
                      <th>{"sconto\n" + fase.nome.toLowerCase()}</th>
                      <th>{"prezzo\nrivend."}</th>
                      {privato && <><th>{"a te\nsenza riv."}</th><th>{"a te\ncon riv."}</th><th>{"a lui"}</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {b.prodotti.map((r) => {
                      const manca = r.sconto_fase_pct == null;
                      return (
                        <tr key={r.id} className={manca ? "lst-manca" : undefined} onClick={() => onApriProdotto && onApriProdotto(r.id)}
                          style={{ cursor: onApriProdotto ? "pointer" : "default" }}
                          title={manca ? motivoSenzaSconto(r)
                            : r.sotto_fase
                              ? `${fase.nome} vorrebbe il ${String(r.quota_fase_pct).replace(".", ",")}%, ma a quel prezzo vendi sottocosto: il massimo qui è ${String(r.sconto_fase_pct).replace(".", ",")}%. Lui paga ${euro(r.prezzo_fase)} e ci guadagna ${euro(r.guadagno_riv_fase)}; a te resta ${euro(r.ti_resta_fase)} netto. Merce ${euro(r.costo_acquisto)}.`
                              : `${fase.nome}: gli lasci ${euro(r.guadagno_riv_fase)} e ne incassi ${euro(r.prezzo_fase)} — il ${String(r.sconto_fase_pct).replace(".", ",")}% del netto. Di quello che incassi, pagata la merce (${euro(r.costo_acquisto)}) e i costi, ti resta ${euro(r.utile_fase)} prima delle imposte e ${euro(r.ti_resta_fase)} dopo.`}>
                          <td className="lst-foto">
                            {r.foto_url
                              ? <img src={r.foto_url} alt="" loading="lazy" decoding="async" />
                              : <span className="lst-vuota" />}
                          </td>
                          <td className="lst-nome">{r.nome}</td>
                          {privato && <td className="lst-costo" data-eti="acq.">{cifra(r.costo_acquisto)}</td>}
                          <td data-eti="lordo">{cifra(r.pubblico_lordo)}</td>
                          <td data-eti="netto">{cifra(r.pubblico_netto)}</td>
                          <td data-eti="sconto">
                            {manca ? (
                              <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>costo mancante</span>
                            ) : (
                              <span style={{ ...fontBody, fontSize: 12, fontWeight: 800, color: r.sotto_fase ? ROSSO : "#8A6D1D", background: r.sotto_fase ? "#FBEBE9" : "#F6EFE2", borderRadius: 999, padding: "4px 10px" }}>{String(r.sconto_fase_pct).replace(".", ",")}%</span>
                            )}
                          </td>
                          <td className="lst-riv" data-eti="paga">{cifra(r.prezzo_fase)}</td>
                          {privato && (
                            <>
                              <td className="lst-resta" data-eti="a te\nsenza" title={r.utile_diretto != null ? `Vendendo tu al pubblico: ${euro(r.utile_diretto)} prima delle imposte, ${euro(r.ti_resta_diretto)} dopo.` : undefined}>{cifra(r.ti_resta_diretto)}</td>
                              <td className="lst-resta-riv" data-eti="a te\ncon" title={r.utile_fase != null ? `${fase.nome}: a te ${euro(r.ti_resta_fase)} dopo le imposte (${euro(r.utile_fase)} prima), a lui ${euro(r.guadagno_riv_fase)}.` : undefined}>{cifra(r.ti_resta_fase)}</td>
                              <td className="lst-lui" data-eti="a lui" title="Quello che il rivenditore guadagna rivendendo al prezzo di listino: la differenza fra quanto paga lui e quanto incassa dal cliente.">{cifra(r.guadagno_riv_fase)}</td>
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
          </p>
        )}
        <p style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 4 }}>
          Lo <b>sconto</b> non è calcolato: è la divisione. In Bilanciato il prezzo netto si taglia a
          metà, e la cifra che lasci a lui è la stessa che incassi tu; in Fase 2 ne tieni due terzi,
          in Fase 1 tre quarti. Cosa ciascuno faccia poi con la sua parte — merce, spese, imposte —
          è affare suo, e per la tua parte lo dicono le colonne «a te». L'unico limite è il fondo:
          dove metà prezzo non copre la merce e il margine di sicurezza lo sconto si ferma prima e
          diventa <span style={{ color: ROSSO, fontWeight: 700 }}>rosso</span>. Ci sono solo i prodotti
          in vendita sullo shop: fuori chi non ha prezzo, non è pubblicato o è solo interno.
        </p>
      </div>
    </div>
  );
}
