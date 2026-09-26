// Prezzi e listini: a quanto andrebbe venduto ogni prodotto dello shop
// perché al venditore si possa dare la sua quota senza intaccare costi
// aziendali e margine di sicurezza.
//
// Sola lettura. Non tocca `prezzo_vendita`, non scrive su WooCommerce: il
// listino per i venditori è separato dal prezzo dello shop, e questa
// pagina serve a vedere quanto sono distanti. Il conto sta tutto nella
// view `v_prezzi_listini`, così la stessa formula non finisce scritta due
// volte in due posti che poi divergono.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  NAVY, CREAM_BORDER, BG, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle,
} from "../ui/stile.js";
import { Button, CampoNumero, TastoLivelloPrecedente } from "../ui/base.jsx";
import {
  leggiPrezziListini, csvPrezziListini, scaricaCsv, etichettaTipo, motivoCostoMancante,
  TIPI_PRODOTTO, QUOTA_VENDITORE_DEFAULT,
} from "./dati.js";

const euro = (n) => (n == null ? "—" : `${Number(n).toFixed(2).replace(".", ",")} €`);
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(1).replace(".", ",")}%`);
const volte = (n) => (n == null ? "—" : `×${Number(n).toFixed(2).replace(".", ",")}`);

const ROSSO = "#C0392B";
const VERDE = "#2E7D32";

const COLONNE = [
  { campo: "nome", label: "Prodotto", allinea: "left", larghezza: 260 },
  { campo: "costo_acquisto", label: "Costo acquisto", numero: true, larghezza: 108 },
  { campo: "listino_netto", label: "Listino netto", numero: true, larghezza: 104 },
  { campo: "listino_ivato", label: "Listino IVA incl.", numero: true, larghezza: 112, forte: true },
  { campo: "quota_venditore", label: "Quota venditore", numero: true, larghezza: 116 },
  { campo: "prezzo_shop_ivato", label: "Prezzo shop attuale", numero: true, larghezza: 122 },
  { campo: "scarto", label: "Scarto", numero: true, larghezza: 100 },
  { campo: "moltiplicatore_attuale", label: "Moltiplicatore attuale", numero: true, larghezza: 118 },
];

// il filtro per stato: "solo rossi" è la domanda vera che si fa aprendo
// questa pagina — su quali prodotti oggi non ce la faccio
const FILTRI_STATO = [
  { v: "tutti", l: "Tutti" },
  { v: "sotto", l: "Solo rossi" },
  { v: "sopra", l: "Solo verdi" },
  { v: "costo_mancante", l: "Solo costo mancante" },
];

function Pastiglia({ testo, colore, sfondo, bordo, titolo }) {
  return (
    <span title={titolo} style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: colore, background: sfondo, border: `1px solid ${bordo}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{testo}</span>
  );
}

function CardRiepilogo({ numero, etichetta, colore, attiva, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: "1 1 130px", minWidth: 120, textAlign: "left", cursor: "pointer", background: attiva ? "#fff" : "#FBF8F1", border: `${attiva ? 2 : 1}px solid ${attiva ? colore : CREAM_BORDER}`, borderRadius: 14, padding: "10px 14px" }}>
      <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 800, color: colore, lineHeight: 1.1 }}>{numero}</div>
      <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{etichetta}</div>
    </button>
  );
}

export default function PrezziListini({
  quotaVenditorePct = QUOTA_VENDITORE_DEFAULT,
  onCambiaQuotaVenditore,
  onApriProdotto,
  onApriImpostazioni,
  onBack,
  titoloIndietro = "Magazzino e shop",
  titolo = "Prezzi e listini",
}) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState("");
  const [tipo, setTipo] = useState("tutti");
  const [statoFiltro, setStatoFiltro] = useState("tutti");
  const [ordine, setOrdine] = useState({ campo: "scarto", direzione: "desc" });

  // Il conto lo fa la view, che legge la quota dal database: qui non c'è
  // una seconda copia della formula. Ma il salvataggio di quel parametro
  // è differito di 600 ms, quindi rileggere subito riporterebbe i numeri
  // di prima e sembrerebbe che la manopola non serva a niente. Si
  // rilegge finché la view non risponde con la percentuale che ci si
  // aspetta — al massimo per qualche secondo, poi si mostra quel che c'è.
  async function carica(attesa = null, tentativo = 0) {
    setCaricando(true);
    setErrore(null);
    try {
      const dati = await leggiPrezziListini();
      // il confronto va fatto su una riga che usa la quota generale: un
      // prodotto con la sua quota propria risponderebbe sempre "no"
      const generale = (dati || []).find((r) => !r.quota_propria);
      if (attesa != null && generale && Number(generale.quota_venditore_pct) !== Number(attesa) && tentativo < 8) {
        setTimeout(() => carica(attesa, tentativo + 1), 400);
        return;
      }
      setRighe(dati || []);
      // una view che risponde vuota quando ci sono prodotti pubblicati è
      // quasi sempre un permesso mancante, non un listino vuoto: dirlo
      if (!dati || dati.length === 0) setErrore("Nessun prodotto pubblicato trovato. Se lo shop ha prodotti, la view v_prezzi_listini non è raggiungibile.");
    } catch (e) {
      setErrore(e?.message || "Errore di lettura");
    }
    setCaricando(false);
  }
  useEffect(() => { carica(); }, []);
  // al primo giro la pagina ha già letto: non si rilegge due volte
  const primoGiro = useRef(true);
  useEffect(() => {
    if (primoGiro.current) { primoGiro.current = false; return; }
    carica(quotaVenditorePct);
  }, [quotaVenditorePct]);

  const conteggi = useMemo(() => ({
    rossi: righe.filter((r) => r.stato_prezzo === "sotto").length,
    verdi: righe.filter((r) => r.stato_prezzo === "sopra").length,
    mancanti: righe.filter((r) => r.stato_prezzo === "costo_mancante").length,
  }), [righe]);

  const parametri = righe[0] || null;

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const filtrate = righe.filter((r) => {
      if (q && !(r.nome || "").toLowerCase().includes(q)) return false;
      if (tipo !== "tutti" && r.tipo !== tipo) return false;
      if (statoFiltro !== "tutti" && r.stato_prezzo !== statoFiltro) return false;
      return true;
    });
    const { campo, direzione } = ordine;
    const segno = direzione === "asc" ? 1 : -1;
    return filtrate.slice().sort((a, b) => {
      const x = a[campo], y = b[campo];
      // i valori che non esistono stanno sempre in fondo, in qualunque
      // verso si ordini: altrimenti "ordina per scarto" apre su dieci
      // righe vuote e sembra che il conto non funzioni
      if (x == null && y == null) return (a.nome || "").localeCompare(b.nome || "", "it");
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * segno;
      return String(x).localeCompare(String(y), "it") * segno;
    });
  }, [righe, cerca, tipo, statoFiltro, ordine]);

  function ordinaPer(campo) {
    setOrdine((o) => (o.campo === campo
      ? { campo, direzione: o.direzione === "asc" ? "desc" : "asc" }
      : { campo, direzione: campo === "nome" ? "asc" : "desc" }));
  }

  function esporta() {
    const quando = new Date().toISOString().slice(0, 10);
    scaricaCsv(csvPrezziListini(visibili), `prezzi-listini-${quando}.csv`);
  }

  const th = { ...fontBody, fontSize: 10.5, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6, padding: "8px 8px", borderBottom: `2px solid ${CREAM_BORDER}`, background: "#F6F1E6", position: "sticky", top: 0, cursor: "pointer", userSelect: "none", whiteSpace: "normal", lineHeight: 1.2 };
  const td = { ...fontBody, fontSize: 13.5, color: NAVY, padding: "7px 8px", borderBottom: `1px solid ${CREAM_BORDER}`, textAlign: "center", whiteSpace: "nowrap" };

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "18px 16px 60px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <TastoLivelloPrecedente titolo={titoloIndietro} onClick={onBack} />
        <h1 style={{ ...stileTitoloPagina, marginTop: 10 }}>{titolo}</h1>
        <p style={{ ...fontBody, fontSize: 13.5, color: MUTED, maxWidth: 780, marginTop: -4 }}>
          A quanto andrebbe venduto ogni prodotto dello shop perché al venditore si possa dare
          la sua quota <b>pulita</b>, cioè dopo i costi aziendali e il margine di sicurezza.
          È una pagina di sola lettura: non cambia il prezzo dello shop e non scrive sul sito.
        </p>

        {/* il riepilogo fa anche da filtro: il numero che colpisce è
            quello su cui si vuole cliccare subito */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <CardRiepilogo numero={conteggi.rossi} etichetta="sotto il listino" colore={ROSSO} attiva={statoFiltro === "sotto"} onClick={() => setStatoFiltro(statoFiltro === "sotto" ? "tutti" : "sotto")} />
          <CardRiepilogo numero={conteggi.verdi} etichetta="sopra il listino" colore={VERDE} attiva={statoFiltro === "sopra"} onClick={() => setStatoFiltro(statoFiltro === "sopra" ? "tutti" : "sopra")} />
          <CardRiepilogo numero={conteggi.mancanti} etichetta="costo mancante" colore={GOLD} attiva={statoFiltro === "costo_mancante"} onClick={() => setStatoFiltro(statoFiltro === "costo_mancante" ? "tutti" : "costo_mancante")} />

          <div style={{ flex: "2 1 320px", minWidth: 280, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>La regola attiva</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ ...fontBody, fontSize: 13, color: NAVY }}>Al venditore</span>
              <CampoNumero valore={quotaVenditorePct} min={0} max={99} onCambia={(n) => onCambiaQuotaVenditore && onCambiaQuotaVenditore(n)}
                titolo="Percentuale del listino che va al venditore. Si salva in Impostazioni e vale per tutti i prodotti che non hanno una quota propria"
                style={{ ...fontBody, width: 48, fontSize: 14, fontWeight: 800, color: NAVY, textAlign: "center", padding: "3px 4px", border: `1px solid ${CREAM_BORDER}`, borderRadius: 6, background: "#fff", boxSizing: "border-box" }} />
              <span style={{ ...fontBody, fontSize: 13, color: NAVY }}>
                %, poi costi aziendali <b>{parametri ? pct(parametri.costi_aziendali_pct) : "—"}</b> e
                sicurezza <b>{parametri ? pct(parametri.sicurezza_pct) : "—"}</b>
              </span>
            </div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
              listino netto = costo ÷ ((1 − quota) × (1 − costi − sicurezza))
              {onApriImpostazioni && (
                <>
                  {" — "}
                  <button onClick={onApriImpostazioni} style={{ ...fontBody, fontSize: 11.5, color: NAVY, fontWeight: 700, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                    le altre due si cambiano in Dettaglio prodotti
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ricerca e filtri */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14 }}>
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca un prodotto…"
            style={{ ...inputStyle, flex: "1 1 240px", minWidth: 180, maxWidth: 360, fontSize: 14 }} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 14 }}>
            <option value="tutti">Tutti i tipi</option>
            {TIPI_PRODOTTO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select value={statoFiltro} onChange={(e) => setStatoFiltro(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 14 }}>
            {FILTRI_STATO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <span style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>
            {visibili.length} {visibili.length === 1 ? "prodotto" : "prodotti"}
            {visibili.length !== righe.length ? ` su ${righe.length}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={esporta} disabled={visibili.length === 0} style={{ fontSize: 13 }}>Esporta CSV</Button>
        </div>

        {errore && (
          <div style={{ ...fontBody, fontSize: 13, color: ROSSO, background: "#FBEBE9", border: "1px solid #F0C8C2", borderRadius: 12, padding: "10px 14px", marginTop: 12 }}>{errore}</div>
        )}

        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, overflow: "auto", maxHeight: "68vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1080 }}>
            <colgroup>{COLONNE.map((c) => <col key={c.campo} style={{ width: c.larghezza }} />)}</colgroup>
            <thead>
              <tr>
                {COLONNE.map((c) => (
                  <th key={c.campo} style={{ ...th, textAlign: c.allinea || "center" }} onClick={() => ordinaPer(c.campo)}
                    title={c.campo === "scarto" ? "Listino IVA inclusa meno prezzo shop: positivo vuol dire che lo shop è sotto" : c.campo === "moltiplicatore_attuale" ? "Prezzo shop netto diviso costo di acquisto: quante volte il costo si sta incassando oggi" : "Clicca per ordinare"}>
                    {c.label}{ordine.campo === c.campo ? (ordine.direzione === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caricando && (
                <tr><td colSpan={COLONNE.length} style={{ ...td, padding: "26px 10px", color: MUTED }}>Sto leggendo il listino…</td></tr>
              )}
              {!caricando && visibili.length === 0 && (
                <tr><td colSpan={COLONNE.length} style={{ ...td, padding: "26px 10px", color: MUTED }}>Nessun prodotto corrisponde ai filtri.</td></tr>
              )}
              {!caricando && visibili.map((r) => {
                const manca = r.stato_prezzo === "costo_mancante";
                const sotto = r.stato_prezzo === "sotto";
                const coloreScarto = manca ? MUTED : (sotto ? ROSSO : VERDE);
                return (
                  <tr key={r.id} onClick={() => onApriProdotto && onApriProdotto(r.id)}
                    style={{ cursor: onApriProdotto ? "pointer" : "default", background: manca ? "#FDFAF2" : undefined }}
                    title="Apri la scheda del prodotto">
                    <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>
                      <div style={{ fontWeight: 700 }}>{r.nome}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ ...fontBody, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{etichettaTipo(r.tipo)}</span>
                        {manca && <Pastiglia testo="Costo mancante" colore="#8A6D1D" sfondo="#FDF8EC" bordo="#EBD9AE" titolo={motivoCostoMancante(r)} />}
                        {r.quota_propria && <Pastiglia testo={`quota ${pct(r.quota_venditore_pct)}`} colore={NAVY} sfondo="#F2F4F8" bordo="#D8DEE9" titolo="Questo prodotto ha una sua quota venditore, che vince sul predefinito" />}
                        {r.aliquota_iva === 0 && <Pastiglia testo="IVA 0" colore={NAVY} sfondo="#F2F4F8" bordo="#D8DEE9" titolo="Aliquota zero: listino netto e lordo coincidono" />}
                      </div>
                    </td>
                    <td style={td}>{euro(r.costo_acquisto)}</td>
                    <td style={td}>{euro(r.listino_netto)}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{euro(r.listino_ivato)}</td>
                    <td style={td}>{euro(r.quota_venditore)}</td>
                    <td style={td}>{euro(r.prezzo_shop_ivato)}</td>
                    <td style={{ ...td, fontWeight: 800, color: coloreScarto }}
                      title={manca ? motivoCostoMancante(r) : (sotto ? `Mancano ${euro(r.scarto)} al listino: a questo prezzo non si può dare ${pct(r.quota_venditore_pct)} al venditore senza intaccare costi e sicurezza` : `Il prezzo dello shop è ${euro(Math.abs(Number(r.scarto)))} sopra il listino: c'è margine oltre la regola`)}>
                      {r.scarto == null ? "—" : `${Number(r.scarto) > 0 ? "+" : ""}${euro(r.scarto)}`}
                    </td>
                    <td style={{ ...td, color: r.moltiplicatore_attuale == null ? MUTED : NAVY }}>{volte(r.moltiplicatore_attuale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
          Rosso: il prezzo dello shop è <b>sotto</b> il listino calcolato — su quel prodotto non si
          può dare al venditore la sua quota senza intaccare costi e sicurezza. Verde: c'è margine
          oltre la regola. I bundle prendono il costo dalla distinta base; se a un solo componente
          manca il costo non si calcola niente, perché la somma sarebbe più bassa del vero.
          "Spese di spedizione" e le vetrine restano fuori.
        </p>
      </div>
    </div>
  );
}
