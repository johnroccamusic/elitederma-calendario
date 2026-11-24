// CALCOLO CONSUMI (24/11/2026, chiesto dal titolare).
//
// «Si seleziona uno dei prodotti del magazzino e gli diciamo calcola i
// consumi teorici dal al, in modo che in base ai consumi che ci sono
// stati ci fa una stima delle necessità fino ad arrivare a X mesi — da
// settembre 2026 a settembre 2027 — in funzione dei corsi che ci sono
// stati… delle magliette taglia M o di tutta la categoria.»
//
// La pagina non calcola niente da sé: i conti stanno in
// `consumi-previsti.js` (puri, provati senza database) e i pezzi di ogni
// classe li conta `quantitaInviataPerProdotto`, la funzione che riempie
// la lista di allestimento e scarica il magazzino — arriva come prop,
// perché un secondo conto darebbe un consumo diverso da quello che il
// magazzino ha visto uscire.
//
// DUE SCENARI, SEMPRE TUTTI E DUE, ed è la cosa da capire di questa
// pagina: il calendario lontano è mezzo vuoto (misurato il 24/11:
// settembre 2027 ha una classe a calendario, settembre 2026 ne aveva
// quindici) e le allieve dei corsi futuri non si sono ancora iscritte.
// Un numero solo sarebbe falso con l'aria di essere un dato: si leggono
// il pavimento e il ritmo normale, e si ordina in mezzo.
import React, { useEffect, useMemo, useState } from "react";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import { Button, CampoRicerca, TastoLivelloPrecedente } from "../ui/base.jsx";
import { consumoPerAllieva, proiezione, nomeMese, mesiFra, MESI_NOMI, TREND_PIENO } from "./consumi-previsti.js";
import { leggiTrend, salvaTrend } from "./trend-dati.js";

const num = (n) => {
  const v = Number(n) || 0;
  return (Math.round(v * 10) / 10).toLocaleString("it-IT", { maximumFractionDigits: 1 });
};
const oggiIso = () => new Date().toISOString().slice(0, 10);
const meseDi = (iso) => String(iso || "").slice(0, 7);
function meseFraMesi(daMese, quanti) {
  const [y, m] = (daMese || oggiIso().slice(0, 7)).split("-").map(Number);
  const tot = (y * 12 + (m - 1)) + quanti;
  return `${Math.floor(tot / 12)}-${String((tot % 12) + 1).padStart(2, "0")}`;
}

export default function CalcoloConsumi({
  prodottiShop = [], corsi = [], corsiDate = [], iscritti = [],
  repartoDi = null,
  quantitaPerEdizione,
  pezziVendutiNelPeriodo = null,
  giacenzaDi = null,
  utente = "", isMobile = false, onBack, titolo = "Calcolo consumi",
}) {
  const [modo, setModo] = useState("prodotto"); // prodotto | reparto
  const [prodottoId, setProdottoId] = useState("");
  const [reparto, setReparto] = useState("");
  const [cerca, setCerca] = useState("");
  const [dal, setDal] = useState("2026-09-01");
  const [al, setAl] = useState(oggiIso());
  const [finoAl, setFinoAl] = useState(meseFraMesi(meseDi(oggiIso()), 12));
  const [conVendite, setConVendite] = useState(true);
  const [trend, setTrend] = useState({ ...TREND_PIENO });
  const [trendScritto, setTrendScritto] = useState(false);
  const [trendAperto, setTrendAperto] = useState(false);
  const [salvandoTrend, setSalvandoTrend] = useState(false);
  const [msgTrend, setMsgTrend] = useState(null);
  const [esito, setEsito] = useState(null);
  const [calcolando, setCalcolando] = useState(false);

  useEffect(() => {
    let vivo = true;
    leggiTrend().then(({ trend: t, scritto }) => {
      if (!vivo) return;
      setTrend(t); setTrendScritto(scritto);
    }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const corsoById = useMemo(() => Object.fromEntries((corsi || []).map((c) => [c.id, c])), [corsi]);
  const inListino = (p) => p?.attivo !== false;
  const prodottiOrdinati = useMemo(
    () => (prodottiShop || []).filter(inListino).slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "it", { numeric: true })),
    [prodottiShop],
  );
  const prodottiTrovati = useMemo(() => {
    const parole = cerca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!parole.length) return prodottiOrdinati.slice(0, 40);
    return prodottiOrdinati.filter((p) => {
      const testo = `${p.nome || ""} ${p.sku || ""}`.toLowerCase();
      return parole.every((x) => testo.includes(x));
    }).slice(0, 40);
  }, [prodottiOrdinati, cerca]);
  const reparti = useMemo(() => {
    if (!repartoDi) return [];
    const nomi = new Set();
    (prodottiShop || []).filter(inListino).forEach((p) => {
      const r = repartoDi.get ? repartoDi.get(p.id) : null;
      if (r?.nome) nomi.add(r.nome);
    });
    return [...nomi].sort((a, b) => a.localeCompare(b, "it"));
  }, [prodottiShop, repartoDi]);

  // QUALI PRODOTTI entrano nel conto: uno, o tutti quelli di un reparto.
  // «Di tutta la categoria» l'ha chiesto il titolare, e il reparto è la
  // categoria RADICE: la stessa regola del 9/11/2026, perché è lo
  // scaffale — un pigmento sta in «TUTTI I PIGMENTI», non in quattro
  // sottocategorie che lo spezzerebbero in quattro righe.
  const prodottiScelti = useMemo(() => {
    if (modo === "prodotto") return prodottoId ? [prodottoId] : [];
    if (!reparto || !repartoDi) return [];
    return (prodottiShop || []).filter(inListino)
      .filter((p) => (repartoDi.get ? repartoDi.get(p.id)?.nome : null) === reparto)
      .map((p) => p.id);
  }, [modo, prodottoId, reparto, prodottiShop, repartoDi]);

  const nomeScelta = modo === "prodotto"
    ? (prodottiShop.find((p) => p.id === prodottoId)?.nome || "—")
    : (reparto || "—");

  function calcola() {
    if (!prodottiScelti.length) { setEsito({ errore: "Scegli prima un prodotto o un reparto." }); return; }
    if (!dal || !al || dal > al) { setEsito({ errore: "Il periodo da misurare non è valido: la data «dal» deve venire prima della «al»." }); return; }
    const daMese = meseFraMesi(meseDi(oggiIso()), 0);
    if (!finoAl || finoAl < daMese) { setEsito({ errore: "Il mese fino a cui stimare deve essere questo o uno successivo." }); return; }
    setCalcolando(true);
    try {
      const scelti = new Set(prodottiScelti);
      const iscrittiPerEdizione = {};
      (iscritti || []).forEach((i) => {
        if (!i?.corso_data_id) return;
        iscrittiPerEdizione[i.corso_data_id] = (iscrittiPerEdizione[i.corso_data_id] || 0) + 1;
      });
      const pezziDi = (cd) => {
        const corso = corsoById[cd.corso_id];
        const mappa = quantitaPerEdizione ? quantitaPerEdizione(cd, corso) : {};
        let somma = 0;
        Object.entries(mappa || {}).forEach(([pid, q]) => { if (scelti.has(pid)) somma += Number(q) || 0; });
        return somma;
      };

      // LE CLASSI MISURATE SONO QUELLE GIA' COMINCIATE nel periodo. Una
      // classe che parte domani ha i pezzi della sua distinta ma non è un
      // consumo avvenuto: contarla fra i consumi «che ci sono stati»
      // gonfierebbe la media con una scatola che nessuno ha ancora aperto.
      const oggi = oggiIso();
      const misurate = (corsiDate || [])
        .filter((cd) => cd.data_inizio && cd.data_inizio >= dal && cd.data_inizio <= al && cd.data_inizio <= oggi)
        .map((cd) => ({
          id: cd.id, corsoId: cd.corso_id, dataInizio: cd.data_inizio,
          allieve: iscrittiPerEdizione[cd.id] || 0,
          pezzi: pezziDi(cd),
        }));
      const storico = consumoPerAllieva(misurate);

      const future = (corsiDate || [])
        .filter((cd) => cd.data_inizio && cd.data_inizio > oggi)
        .map((cd) => ({
          id: cd.id, corsoId: cd.corso_id, dataInizio: cd.data_inizio,
          iscritteOra: iscrittiPerEdizione[cd.id] || 0,
          postiMax: cd.posti_max ?? corsoById[cd.corso_id]?.posti_max ?? null,
        }));

      // le classi mese per mese nel periodo misurato: da qui esce sia il
      // livello di un mese di punta (con le percentuali del trend) sia la
      // regola «per i mesi per cui esiste una statistica valgono i mesi»
      const mesiMisurati = Math.max(1, mesiFra(meseDi(dal), meseDi(al)).length);
      const classiPerMeseMisurato = {};
      mesiFra(meseDi(dal), meseDi(al)).forEach((m) => { classiPerMeseMisurato[m] = 0; });
      misurate.forEach((c) => {
        const m = meseDi(c.dataInizio);
        classiPerMeseMisurato[m] = (classiPerMeseMisurato[m] || 0) + 1;
      });
      const classiAlMese = misurate.length / mesiMisurati;

      // le vendite seguono il tempo, non i corsi: media al mese. Si
      // leggono dalle VENDITE e non dai movimenti di magazzino, e il
      // motivo è un difetto vivo: dal 31/10/2026 gli ordini dello shop
      // non scrivono più il loro movimento (61 ordini pagati a novembre,
      // zero righe), quindi i movimenti direbbero «lo shop non vende».
      const vendutoNelPeriodo = conVendite && pezziVendutiNelPeriodo
        ? Number(pezziVendutiNelPeriodo(prodottiScelti, dal, al)) || 0 : 0;
      const venditeAlMese = conVendite ? vendutoNelPeriodo / mesiMisurati : 0;

      const giacenza = prodottiScelti.reduce((s, pid) => s + (giacenzaDi ? Number(giacenzaDi(pid)) || 0 : 0), 0);

      const p = proiezione({
        storico, classiFuture: future, daMese, aMese: finoAl,
        venditeAlMese, giacenza, trend, classiPerMeseMisurato,
      });
      setEsito({
        storico, proiezione: p, misurate: misurate.length, mesiMisurati,
        vendutoNelPeriodo, classiAlMese, nome: nomeScelta, quantiProdotti: prodottiScelti.length,
        classiPerMeseMisurato,
      });
    } catch (e) {
      setEsito({ errore: e.message });
    }
    setCalcolando(false);
  }

  const etichetta = { ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 3 };
  const scheda = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 12 : 18 };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: isMobile ? "16px 12px 70px" : "24px 16px 80px" }}>
      {onBack && <TastoLivelloPrecedente onClick={onBack} />}
      <div style={{ ...stileTitoloPagina, color: NAVY, fontSize: isMobile ? 19 : 24, marginBottom: 4 }}>{titolo}</div>
      <div style={{ ...fontBody, fontSize: isMobile ? 12 : 13.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
        Quanto servirà di un prodotto da qui a qualche mese, <b style={{ color: NAVY }}>in funzione dei corsi</b>: si
        misura quanto consuma una allieva nel periodo che scegli, e si moltiplica per le allieve che avranno i corsi
        a calendario.
      </div>

      {/* IL TREND DELL'ANNO, chiesto dal titolare: «una sezione all'inizio
          della pagina in cui si definisce annualmente qual è il trend
          mensile; per i mesi per cui esiste una statistica valgono i mesi,
          per i mesi che non esiste valgono le percentuali che esprimo io».
          100% è un mese di punta, non la media: 40% vuol dire il 40% di
          quello. */}
      <div style={{ ...scheda, marginBottom: 16, borderColor: trendScritto ? GOLD : CREAM_BORDER }} data-trend>
        <button type="button" onClick={() => setTrendAperto((a) => !a)}
          style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          {trendAperto ? "▾" : "▸"} Il trend dei mesi {trendScritto ? "" : "— tutti al 100%"}
        </button>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
          Quanto si lavora in ogni mese dell’anno, rispetto a un mese di punta: <b>100%</b> è un mese pieno, 60% un mese
          che ne fa poco più della metà. Serve <b>solo per i mesi di cui non c’è uno storico</b>: dove un mese è già
          stato misurato, valgono i numeri veri.
        </div>
        {trendAperto && (
          <>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", marginTop: 12 }}>
              {MESI_NOMI.map((nome, i) => (
                <label key={nome} style={{ display: "block" }}>
                  <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 2 }}>{nome.slice(0, 3)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" min="0" max="200" value={trend[i + 1] ?? 100} data-trend-mese={i + 1}
                      onChange={(e) => { setTrend((t) => ({ ...t, [i + 1]: e.target.value === "" ? "" : Number(e.target.value) })); setMsgTrend(null); }}
                      style={{ ...inputStyle, width: "100%", minWidth: 0, textAlign: "right", padding: "6px 6px" }} />
                    <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>%</span>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              <Button onClick={async () => {
                setSalvandoTrend(true); setMsgTrend(null);
                try {
                  const pulito = {};
                  for (let m = 1; m <= 12; m += 1) pulito[m] = Number(trend[m]) > 0 ? Number(trend[m]) : 100;
                  await salvaTrend(pulito, utente);
                  setTrend(pulito); setTrendScritto(true); setEsito(null);
                  setMsgTrend({ tipo: "ok", testo: "Trend salvato: vale per ogni calcolo, anche quello di domani." });
                } catch (e) { setMsgTrend({ tipo: "errore", testo: e.message }); }
                setSalvandoTrend(false);
              }} disabled={salvandoTrend}>{salvandoTrend ? "Salvo…" : "Salva il trend"}</Button>
              <Button variant="ghost" onClick={() => { setTrend({ ...TREND_PIENO }); setMsgTrend(null); }} disabled={salvandoTrend}>
                Rimetti tutti al 100%
              </Button>
              {msgTrend && (
                <span style={{ ...fontBody, fontSize: 12.5, color: msgTrend.tipo === "ok" ? "#2E7D32" : "#C0392B" }}>{msgTrend.testo}</span>
              )}
            </div>
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              Niente si salva da sé: si scrive e si preme. Un mese lasciato vuoto vale 100%.
            </div>
          </>
        )}
      </div>

      <div style={{ ...scheda, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[["prodotto", "Un prodotto"], ["reparto", "Tutto un reparto"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => { setModo(k); setEsito(null); }} data-modo={k}
              style={{ ...fontBody, fontSize: 13, fontWeight: modo === k ? 700 : 500, color: modo === k ? "#fff" : NAVY, background: modo === k ? NAVY : "#fff", border: `1px solid ${modo === k ? NAVY : CREAM_BORDER}`, borderRadius: 999, padding: "7px 16px", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>

        {modo === "prodotto" ? (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            <div>
              <span style={etichetta}>Cerca il prodotto</span>
              {/* LA LENTE, come in tutte le trenta ricerche dell'app
                  (`CampoRicerca`): la casella qui era un input nudo, e una
                  ricerca che non si riconosce come tale la scavalca chi
                  arriva — si finisce a scorrere la tendina. Chiesto dal
                  titolare il 24/11/2026: «inserisci pure la lente di
                  ricerca». */}
              <CampoRicerca value={cerca} onChange={(e) => setCerca(e.target.value)}
                placeholder="magliette, pigmento, ago…" />
            </div>
            <div>
              <span style={etichetta}>Prodotto</span>
              <select value={prodottoId} onChange={(e) => { setProdottoId(e.target.value); setEsito(null); }} data-prodotto
                style={{ ...inputStyle, width: "100%", minWidth: 0 }}>
                <option value="">— scegli il prodotto —</option>
                {prodottiTrovati.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 4 }}>
                {prodottiTrovati.length === 40
                  ? `Ne mostro 40 su ${prodottiOrdinati.length}: scrivi qui accanto per trovare il tuo.`
                  : cerca.trim()
                  ? `${prodottiTrovati.length} ${prodottiTrovati.length === 1 ? "prodotto trovato" : "prodotti trovati"}.`
                  : `${prodottiOrdinati.length} prodotti in listino.`}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <span style={etichetta}>Reparto</span>
            <select value={reparto} onChange={(e) => { setReparto(e.target.value); setEsito(null); }} data-reparto
              style={{ ...inputStyle, width: isMobile ? "100%" : 360, minWidth: 0 }}>
              <option value="">— scegli il reparto —</option>
              {reparti.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {prodottiScelti.length > 0 && (
              <div style={{ ...fontBody, fontSize: 12, color: GRAFITE, marginTop: 6 }}>
                {num(prodottiScelti.length)} prodotti in questo reparto: il conto li somma tutti insieme.
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", marginTop: 14 }}>
          <div>
            <span style={etichetta}>Misura i consumi dal</span>
            <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} data-dal style={{ ...inputStyle, width: "100%", minWidth: 0 }} />
          </div>
          <div>
            <span style={etichetta}>al</span>
            <input type="date" value={al} onChange={(e) => setAl(e.target.value)} data-al style={{ ...inputStyle, width: "100%", minWidth: 0 }} />
          </div>
          <div>
            <span style={etichetta}>Stima fino a</span>
            <input type="month" value={finoAl} onChange={(e) => setFinoAl(e.target.value)} data-fino-al style={{ ...inputStyle, width: "100%", minWidth: 0 }} />
          </div>
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
          I movimenti di magazzino partono dal <b>27 agosto 2026</b>: prima di quella data non c’è niente da misurare.
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }} data-con-vendite>
          <input type="checkbox" checked={conVendite} onChange={(e) => setConVendite(e.target.checked)} style={{ marginTop: 3 }} />
          <span style={{ ...fontBody, fontSize: 12.5, color: NAVY }}>
            Conta anche quello che si <b>vende</b> (banco e shop)
            <span style={{ display: "block", color: MUTED, fontSize: 11.5 }}>
              Le vendite non seguono i corsi ma il tempo: entrano come media al mese, in una colonna loro.
            </span>
          </span>
        </label>

        <div style={{ marginTop: 14 }}>
          <Button onClick={calcola} disabled={calcolando || !prodottiScelti.length}>
            {calcolando ? "Calcolo…" : "Calcola i consumi"}
          </Button>
        </div>
      </div>

      {esito?.errore && (
        <div style={{ ...scheda, borderColor: "#F0C8C2", background: "#FBEBE9", ...fontBody, fontSize: 13, color: "#C0392B" }}>{esito.errore}</div>
      )}

      {esito && !esito.errore && <Risultato esito={esito} corsoById={corsoById} isMobile={isMobile} />}
    </div>
  );
}

function Risultato({ esito, corsoById, isMobile }) {
  const { storico, proiezione: p } = esito;
  const scheda = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 12 : 18, marginBottom: 16 };
  const cella = { ...fontBody, fontSize: 12.5, color: NAVY, padding: "7px 8px", borderBottom: `1px solid ${CREAM_BORDER}`, textAlign: "right", whiteSpace: "nowrap" };
  const intesta = { ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, padding: "7px 8px", textAlign: "right", borderBottom: `2px solid ${CREAM_BORDER}` };

  if (!storico.classi) {
    return (
      <div style={{ ...scheda, borderColor: GOLD, background: "#FBF3E4" }}>
        <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>In quel periodo non c’è niente da misurare</div>
        <div style={{ ...fontBody, fontSize: 13, color: GRAFITE, lineHeight: 1.5 }}>
          Nessuna classe già cominciata fra le date scelte. Senza classi non c’è un consumo per allieva, e una stima
          senza base sarebbe un numero inventato: allarga il periodo.
        </div>
      </div>
    );
  }
  const senzaConsumo = storico.pezzi === 0;

  return (
    <>
      <div style={scheda} data-misurato>
        <div style={{ ...fontDisplay, fontSize: isMobile ? 15 : 17, fontWeight: 700, color: NAVY, marginBottom: 2 }}>
          Quello che è stato: {esito.nome}
        </div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 12 }}>
          {num(storico.classi)} classi cominciate · {num(storico.allieve)} allieve · {num(esito.mesiMisurati)} mesi
          {esito.quantiProdotti > 1 ? ` · ${num(esito.quantiProdotti)} prodotti insieme` : ""}
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)" }}>
          {[
            ["Pezzi usciti nei kit", num(storico.pezzi)],
            ["Per allieva", num(storico.perAllieva)],
            ["Allieve per classe", num(storico.allievePerClasse)],
            ["Classi al mese", num(esito.classiAlMese)],
          ].map(([t, v]) => (
            <div key={t} style={{ background: "#FBF3E4", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>{t}</div>
              <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }}>{v}</div>
            </div>
          ))}
        </div>
        {esito.vendutoNelPeriodo > 0 && (
          <div style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, marginTop: 10 }}>
            E <b style={{ color: NAVY }}>{num(esito.vendutoNelPeriodo)}</b> pezzi venduti nello stesso periodo, cioè{" "}
            {num(esito.vendutoNelPeriodo / esito.mesiMisurati)} al mese.
          </div>
        )}
        {senzaConsumo && (
          <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6A1B", background: "#FBF3E4", border: `1px solid ${GOLD}`, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
            Nei kit di quelle classi questo prodotto <b>non compare</b>: la stima sui corsi è zero, e quello che resta
            sotto sono le vendite. Se dovrebbe esserci, va messo nella distinta del kit.
          </div>
        )}

        {/* il per-corso: è la ragione per cui un mese di laminazioni non
            fa ordinare pigmenti */}
        {Object.values(storico.perCorso).filter((v) => v.pezzi > 0).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Per corso</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead><tr>
                  <th style={{ ...intesta, textAlign: "left" }}>Corso</th>
                  <th style={intesta}>Classi</th><th style={intesta}>Allieve</th>
                  <th style={intesta}>Pezzi</th><th style={intesta}>Per allieva</th>
                </tr></thead>
                <tbody>
                  {Object.values(storico.perCorso).filter((v) => v.pezzi > 0)
                    .sort((a, b) => b.pezzi - a.pezzi).map((v) => (
                    <tr key={v.corsoId || "—"} data-corso-misurato={v.corsoId || ""}>
                      <td style={{ ...cella, textAlign: "left" }}>
                        {corsoById[v.corsoId]?.nome || "—"}
                        {!v.affidabile && <span style={{ ...fontBody, fontSize: 10.5, color: "#8A6A1B", marginLeft: 6 }}>una classe sola: media debole</span>}
                      </td>
                      <td style={cella}>{num(v.classi)}</td>
                      <td style={cella}>{num(v.allieve)}</td>
                      <td style={cella}>{num(v.pezzi)}</td>
                      <td style={{ ...cella, fontWeight: 700 }}>{num(v.perAllieva)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...scheda, borderColor: GOLD }} data-stima>
        <div style={{ ...fontDisplay, fontSize: isMobile ? 15 : 17, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
          Quello che servirà, fino a {nomeMese(p.righe[p.righe.length - 1]?.mese)}
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginBottom: 12 }}>
          <div style={{ background: "#F7F6F2", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>Con quello che è a calendario</div>
            <div style={{ ...fontDisplay, fontSize: 30, fontWeight: 700, color: NAVY }}>{num(p.totaleCalendario)}</div>
            <div style={{ ...fontBody, fontSize: 12, color: GRAFITE }}>
              pezzi · in casa {num(p.giacenza)} ·{" "}
              {p.daOrdinareCalendario ? <b style={{ color: "#C0392B" }}>da ordinare {num(p.daOrdinareCalendario)}</b> : <b style={{ color: "#2E7D32" }}>bastano</b>}
            </div>
          </div>
          <div style={{ background: "#FBF3E4", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#8A6A1B", textTransform: "uppercase", letterSpacing: 0.4 }}>Al ritmo dei mesi misurati</div>
            <div style={{ ...fontDisplay, fontSize: 30, fontWeight: 700, color: NAVY }}>{num(p.totaleAlRitmo)}</div>
            <div style={{ ...fontBody, fontSize: 12, color: GRAFITE }}>
              pezzi ·{" "}
              {p.daOrdinareAlRitmo ? <b style={{ color: "#C0392B" }}>da ordinare {num(p.daOrdinareAlRitmo)}</b> : <b style={{ color: "#2E7D32" }}>bastano</b>}
            </div>
          </div>
        </div>
        <div style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.55, marginBottom: 14 }}>
          I due numeri non si contraddicono: il primo conta <b>solo le classi già scritte in calendario</b> — ed è un
          pavimento, perché più si va lontano più il calendario è da riempire. Il secondo aggiunge, in ogni mese, le
          classi che mancano per arrivare a quante ce ne si aspetta: <b>{num(p.livelloPieno)} classi</b> in un mese di
          punta{p.conTrend ? ", ridotte dalla percentuale che hai scritto nel trend" : ""}.
          {p.finisceCalendario || p.finisceRitmo ? (
            <>
              {" "}La giacenza di oggi finisce intorno a{" "}
              <b style={{ color: "#C0392B" }}>{nomeMese(p.finisceRitmo || p.finisceCalendario)}</b>
              {p.finisceCalendario && p.finisceRitmo && p.finisceCalendario !== p.finisceRitmo
                ? <> nello scenario pieno, a {nomeMese(p.finisceCalendario)} con il solo calendario</> : null}.
            </>
          ) : " Con la giacenza di oggi si arriva in fondo al periodo in tutti e due gli scenari."}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead><tr>
              <th style={{ ...intesta, textAlign: "left" }}>Mese</th>
              <th style={intesta}>Classi a cal.</th>
              <th style={intesta}>Attese</th>
              <th style={intesta}>Dai corsi</th>
              <th style={intesta}>Vendite</th>
              <th style={intesta}>Totale</th>
              <th style={intesta}>Cumulato</th>
              <th style={{ ...intesta, color: "#8A6A1B" }}>Al ritmo</th>
              <th style={{ ...intesta, color: "#8A6A1B" }}>Cum. ritmo</th>
            </tr></thead>
            <tbody>
              {p.righe.map((r) => {
                const finito = r.cumulatoCalendario > p.giacenza;
                return (
                  <tr key={r.mese} data-mese={r.mese}>
                    <td style={{ ...cella, textAlign: "left", fontWeight: 600 }}>{nomeMese(r.mese)}</td>
                    <td style={cella}>
                      {r.classiACalendario}
                      {r.classiStimateInPiu > 0 && <span style={{ color: "#8A6A1B" }}> +{num(r.classiStimateInPiu)}</span>}
                    </td>
                    <td style={{ ...cella, color: r.fonteAttese === "storico" ? "#2E7D32" : MUTED }} data-attese={r.fonteAttese}>
                      {num(r.classiAttese)}
                      <span style={{ ...fontBody, fontSize: 10, display: "block", lineHeight: 1.1 }}>
                        {r.fonteAttese === "storico" ? "da storico" : `${r.percentualeTrend}%`}
                      </span>
                    </td>
                    <td style={cella}>{num(r.daiCorsiCalendario)}</td>
                    <td style={{ ...cella, color: MUTED }}>{num(r.dalleVendite)}</td>
                    <td style={{ ...cella, fontWeight: 700 }}>{num(r.totaleCalendario)}</td>
                    <td style={{ ...cella, color: finito ? "#C0392B" : NAVY }}>{num(r.cumulatoCalendario)}</td>
                    <td style={{ ...cella, color: "#8A6A1B" }}>{num(r.totaleAlRitmo)}</td>
                    <td style={{ ...cella, color: "#8A6A1B", fontWeight: 600 }}>{num(r.cumulatoAlRitmo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
          «Classi a cal.» è quante classi sono <b>scritte</b> in quel mese; il <span style={{ color: "#8A6A1B" }}>+n</span> in oro
          sono quelle che mancano per arrivare alle «Attese». Le attese di un mese <span style={{ color: "#2E7D32" }}>già
          misurato in un altro anno</span> sono il numero vero di quel mese; per gli altri è un mese di punta ridotto
          dalla percentuale del trend. Le allieve di una classe futura sono le iscritte di oggi, o la
          media di quel corso se è più alta — mai più dei posti: le classi di marzo si riempiono a marzo, e contare le
          iscritte di oggi farebbe ordinare troppo poco.
          {p.righe.some((r) => r.corsiSenzaMisura > 0) && " Dove un corso futuro non compare nel periodo misurato si usa la media di tutti i corsi."}
        </div>
      </div>
    </>
  );
}
