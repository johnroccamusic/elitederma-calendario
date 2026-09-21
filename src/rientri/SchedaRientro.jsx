// L'inventario di fine corso, come lo vede la master.
//
// Si compila dal telefono, in aula, in piedi, di fretta. Quindi: quasi
// solo tap, target grandi, e tutto quello che non si tocca vale
// "rientrato integro". L'unica cosa che si scrive sono le quantita' degli
// sfusi, e per quelle ci sono i tasti piu' e meno.
//
// La scheda nasce gia' piena: le vendite dalle scorte le ha scritte il POS
// al momento della vendita, i cambi li ha scritti la master col pezzo in
// mano. Qui si conferma.

import { useEffect, useMemo, useRef, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, BG_CHIARO, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { Button, ContatoreQuantita, TastoLivelloPrecedente } from "../ui/base.jsx";
import { caricaRientro, segnaDestinoKit, chiudiRientro, dermografiNonQuadrano, salvaBozzaRientro, associaVenditaAKit, disassociaVenditaDaKit, dissociaVenditeDaKit, materializzaKitAllievoNonConsegnato, smaterializzaKitAllievoNonConsegnato } from "./rientro";

// La scialuppa.
//
// La bozza vera sta sul server: e' quella che si rilegge riaprendo la
// scheda, anche da un altro telefono. Questo qui tiene SOLO cio' che sul
// server non e' ancora arrivato — la linea che cade a meta' conteggio, e
// la pagina che iOS butta via mentre il telefono e' in tasca. Si svuota
// nell'istante in cui il server conferma, quindi non e' una seconda
// verita': e' una busta con dentro la posta non ancora spedita.
const CHIAVE_SCIALUPPA = (spedizioneId) => `bozza-rientro:${spedizioneId}`;

function leggiScialuppa(spedizioneId) {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_SCIALUPPA(spedizioneId));
    return grezzo ? JSON.parse(grezzo) : null;
  } catch { return null; }
}
function scriviScialuppa(spedizioneId, contenuto) {
  // in incognito localStorage esiste e tira un'eccezione: che la
  // scialuppa non ci sia e' un peccato, che faccia saltare il
  // conteggio sarebbe un disastro
  try {
    if (contenuto) window.localStorage.setItem(CHIAVE_SCIALUPPA(spedizioneId), JSON.stringify(contenuto));
    else window.localStorage.removeItem(CHIAVE_SCIALUPPA(spedizioneId));
  } catch { /* pazienza */ }
}

const oraBreve = (iso) => {
  try { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }); }
  catch { return ""; }
};

function Blocco({ numero, titolo, sottotitolo, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: GOLD }}>{numero}</span>
        <span style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</span>
      </div>
      {sottotitolo && <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{sottotitolo}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Pastiglia({ testo, colore = MUTED, sfondo = "#F4F1EA" }) {
  return (
    <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: colore, background: sfondo, borderRadius: 8, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {testo}
    </span>
  );
}

const DESTINI = [
  { chiave: "rientrato_chiuso", testo: "Rientra chiuso", nota: "Non è mai stato aperto" },
  { chiave: "aperto", testo: "L'ho aperto", nota: "Ne è uscito qualcosa" },
  { chiave: "consegnato_intero", testo: "Dato intero a un'allieva", nota: "Un'iscritta non prevista" },
];

export default function SchedaRientro({
  corsoData, corso, location, iscritti, prodottiShop, kitDefinizioni, masterLoggataId, venditeShop = [], ricaricaApp, isMobile = false, onBack,
}) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [valori, setValori] = useState({}); // rigaId -> { rientrata, guasta, consegnata }
  const [consegne, setConsegne] = useState({}); // iscrittoId -> bool
  const [sceltaKit, setSceltaKit] = useState(null);
  // la tendina per attribuire i venduti dal POS a una scatola aperta:
  // { kit, righe: [{ venditaId, prodottoId, quantita, giaAssociato, scelto }] }
  const [assocKit, setAssocKit] = useState(null);
  // il nome libero di chi ha ricevuto un kit intero, quando non e' una delle
  // iscritte del corso
  const [nomeAltra, setNomeAltra] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [salvando, setSalvando] = useState(false);
  // "fermo" | "salvo" | "salvato" | "in_ritardo": lo stato della bozza,
  // che e' l'unica cosa che la master deve poter controllare a colpo
  // d'occhio mentre conta
  const [statoBozza, setStatoBozza] = useState("fermo");
  const [bozzaTs, setBozzaTs] = useState(null);
  // cresce a ogni nuovo tentativo dopo un errore: e' cio' che rimette in
  // moto il ciclo di salvataggio senza fingere una modifica che non c'e'
  const [tentativo, setTentativo] = useState(0);
  // finche' non si tocca niente non si salva niente: riaprire una scheda
  // per guardarla non deve scrivere sul database
  const toccata = useRef(false);
  const timerBozza = useRef(null);

  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  // i pezzi venduti col POS per questo corso e dichiarati presi dai kit,
  // non ancora attribuiti a un kit preciso: sono quelli che la master
  // dovra' associare, uno per uno, alla scatola da cui li ha tirati fuori.
  //
  // Il conto e' semplice: per ogni riga di vendita "dal kit" si guarda
  // quanto e' gia' stato attribuito con un prelievo, e resta da associare
  // solo la differenza. Cosi' quando un kit rimesso su "rientra chiuso"
  // ritratta i suoi prelievi, i pezzi ricompaiono qui da soli.
  const vendutiDaAssociare = useMemo(() => {
    if (!corsoData?.id) return [];
    const associato = {};
    (dati?.prelieviVendita || []).forEach((p) => {
      if (!p.venditaId || !p.prodottoId) return;
      const k = `${p.venditaId}|${p.prodottoId}`;
      associato[k] = (associato[k] || 0) + (p.quantita || 0);
    });
    const righe = [];
    (venditeShop || []).forEach((v) => {
      if (v.corso_data_id !== corsoData.id) return;
      if (v.tipo_movimento === "omaggio" || v.tipo_movimento === "annullamento") return;
      (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
        if (!r?.dal_kit || !r.prodotto_id) return;
        const venduti = Number(r.quantita) || 0;
        if (venduti <= 0) return;
        const resta = venduti - (associato[`${v.id}|${r.prodotto_id}`] || 0);
        if (resta > 0) righe.push({ venditaId: v.id, prodottoId: r.prodotto_id, quantita: resta, numeroOrdine: v.numero_ordine || null });
      });
    });
    return righe;
  }, [venditeShop, corsoData, dati]);
  const kitById = useMemo(() => Object.fromEntries((kitDefinizioni || []).map((k) => [k.id, k])), [kitDefinizioni]);
  const iscrittiEdizione = useMemo(
    () => (iscritti || []).filter((i) => i.corso_data_id === corsoData?.id),
    [iscritti, corsoData],
  );
  const iscrittoById = useMemo(() => Object.fromEntries((iscritti || []).map((i) => [i.id, i])), [iscritti]);
  const loc = (location || []).find((l) => l.id === corsoData?.location_id) || null;
  const nomeProdotto = (id) => prodottoById[id]?.nome || "—";
  const nomeIscritto = (i) => `${i.nome || ""} ${i.cognome || ""}`.trim();

  async function ricarica() {
    const d = await caricaRientro(corsoData?.id || null);
    setDati(d);
    if (d) {
      const iniziali = {};
      d.righe.forEach((r) => {
        const gia = d.dichiarazioni[r.rigaId];
        // quello che non si tocca vale "rientrato": l'atteso e' gia' al
        // netto di cio' che il sistema sa essere uscito
        iniziali[r.rigaId] = gia
          ? { rientrata: gia.rientrata, guasta: gia.guasta, consegnata: gia.consegnata }
          : { rientrata: r.atteso, guasta: 0, consegnata: 0 };
      });
      setConsegne(d.bozzaConsegne || {});
      setBozzaTs(d.bozzaTs || null);

      // se nella scialuppa c'e' qualcosa, un salvataggio non era andato
      // a buon fine: quello che c'e' li' e' piu' recente di quello sul
      // server, e vince
      const rimasta = d.rientro?.stato === "chiuso" ? null : leggiScialuppa(d.spedizioneId);
      if (rimasta) {
        Object.entries(rimasta.valori || {}).forEach(([rigaId, v]) => {
          if (iniziali[rigaId]) iniziali[rigaId] = { ...iniziali[rigaId], ...v };
        });
        setConsegne(rimasta.consegne || {});
        // c'e' della posta da spedire: il ciclo di salvataggio riparte
        // da solo e la manda appena c'e' linea
        toccata.current = true;
        setStatoBozza("in_ritardo");
      }
      // un kit gia' materializzato come scatola "non consegnata" tiene il suo
      // flag anche dopo un ricarico, che la bozza sia arrivata o no: la
      // scatola sul database e' la verita'
      const nonConsegnatiDaIstanze = {};
      (d.istanze || []).forEach((k) => {
        if (k.origine === "allievo_non_consegnato" && k.iscrittoId) nonConsegnatiDaIstanze[k.iscrittoId] = false;
      });
      if (Object.keys(nonConsegnatiDaIstanze).length > 0) setConsegne((prev) => ({ ...prev, ...nonConsegnatiDaIstanze }));
      setValori(iniziali);
    }
    setCaricando(false);
  }
  useEffect(() => { ricarica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [corsoData?.id]);

  // di suo ogni allieva ha ricevuto il suo kit: si tocca solo chi non l'ha
  // avuto, che e' l'eccezione
  const consegnato = (id) => consegne[id] !== false;

  const righePerTipo = (tipo) => (dati?.righe || []).filter((r) => r.tipo === tipo);
  const valore = (rigaId) => valori[rigaId] || { rientrata: 0, guasta: 0, consegnata: 0 };
  function cambia(rigaId, campo, n) {
    toccata.current = true;
    setValori((prev) => ({ ...prev, [rigaId]: { ...valore(rigaId), [campo]: Math.max(0, Math.round(n) || 0) } }));
  }

  const dichiarazioni = useMemo(() => (dati?.righe || []).map((r) => ({
    rigaId: r.rigaId, tipo: r.tipo, spediti: r.spediti, venduti: r.venduti,
    ...valore(r.rigaId),
    consegnata: r.tipo === "kit_allievo"
      ? iscrittiEdizione.filter((i) => consegnato(i.id) && (i.kit_id === r.kitId || !i.kit_id)).length
      : valore(r.rigaId).consegnata,
  })), [dati, valori, consegne, iscrittiEdizione]);

  const nonQuadrano = dermografiNonQuadrano(dichiarazioni);
  const chiusa = dati?.rientro?.stato === "chiuso";

  // Il salvataggio progressivo.
  //
  // Un secondo e mezzo dopo l'ultimo tocco, non a ogni tocco: sui +/-
  // degli sfusi la master preme quattro volte di fila, e quattro
  // scritture per arrivare a "4" sono tre di troppo.
  //
  // Prima di partire il contenuto va nella scialuppa, non dopo: se la
  // richiesta non arriva mai — linea caduta, telefono in tasca, pagina
  // buttata via dal sistema — quello che la master aveva contato e'
  // gia' al sicuro. Si toglie solo quando il server ha confermato.
  useEffect(() => {
    if (caricando || chiusa || !dati || !toccata.current) return;
    scriviScialuppa(dati.spedizioneId, { valori, consegne, ts: Date.now() });
    setStatoBozza((s) => (s === "in_ritardo" ? s : "salvo"));
    clearTimeout(timerBozza.current);
    timerBozza.current = setTimeout(async () => {
      const esito = await salvaBozzaRientro({
        spedizioneId: dati.spedizioneId,
        masterId: masterLoggataId || null,
        righe: dichiarazioni,
        consegne,
      });
      if (esito.errore === "chiusa") {
        // qualcuno ha chiuso la scheda mentre era aperta anche qui: la
        // bozza non ha piu' senso, e insistere riscriverebbe righe da
        // cui il magazzino e' gia' stato ripristinato
        scriviScialuppa(dati.spedizioneId, null);
        setStatoBozza("fermo");
        setMessaggio("Questa scheda e' stata chiusa da un altro dispositivo: ricaricala per vederla aggiornata.");
        return;
      }
      if (esito.errore) { setStatoBozza("in_ritardo"); return; }
      scriviScialuppa(dati.spedizioneId, null);
      setBozzaTs(esito.ts || null);
      setStatoBozza("salvato");
    }, 1500);
    return () => clearTimeout(timerBozza.current);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [dichiarazioni, consegne, caricando, chiusa, tentativo]);

  // quando non c'e' linea il tentativo fallisce e basta: si riprova da
  // soli ogni otto secondi, perche' la master sta contando e non deve
  // accorgersene. Si smette quando il salvataggio passa, o quando la
  // scheda viene chiusa
  useEffect(() => {
    if (statoBozza !== "in_ritardo" || !dati || chiusa) return;
    const t = setTimeout(() => setTentativo((n) => n + 1), 8000);
    return () => clearTimeout(t);
  }, [statoBozza, tentativo, dati, chiusa]);

  async function destino(istanza, chiave, opts = {}) {
    setSceltaKit(null);
    const materializzato = istanza.origine === "allievo_non_consegnato";
    const errore = await segnaDestinoKit(istanza.id, chiave, {
      iscrittoId: opts.iscrittoId || null,
      consegnatoANome: opts.nome || null,
      preservaIscritto: materializzato,
    });
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    // "rientra chiuso" vuol dire "non ne e' uscito niente": se a questo kit
    // erano stati attribuiti dei venduti, era uno sbaglio e vanno rimessi
    // fra i "da associare".
    if (chiave === "rientrato_chiuso") {
      const err = await dissociaVenditeDaKit(istanza.id);
      if (err) { setMessaggio("Stato cambiato, ma non ho potuto sciogliere le attribuzioni: " + err); }
      else ricaricaApp?.(["vendite_shop"]);
    }
    await ricarica();
  }

  // Aprire una scatola vuol dire dire cosa ne e' uscito: si apre la tendina
  // coi venduti dal POS. In alto quelli gia' presi da questo kit (spuntati);
  // sotto quelli ancora da attribuire che QUESTO kit contiene davvero e in
  // numero sufficiente — gli altri non si possono spuntare, perche' da qui
  // non potevano uscire.
  function apriAssociazione(k) {
    setSceltaKit(null);
    const residuo = {};
    (k.componenti || []).forEach((c) => { residuo[c.prodottoId] = (c.iniziale || 0) - (c.prelevata || 0); });
    const associati = Object.values((dati?.prelieviVendita || []).reduce((acc, p) => {
      if (p.kitRiservaId !== k.id || !p.venditaId || !p.prodottoId) return acc;
      const key = `${p.venditaId}|${p.prodottoId}`;
      (acc[key] || (acc[key] = { venditaId: p.venditaId, prodottoId: p.prodottoId, quantita: 0 })).quantita += p.quantita || 0;
      return acc;
    }, {}));
    const candidati = vendutiDaAssociare.filter((r) => (residuo[r.prodottoId] || 0) >= r.quantita);
    const righe = [
      ...associati.map((a) => ({ venditaId: a.venditaId, prodottoId: a.prodottoId, quantita: a.quantita, giaAssociato: true, scelto: true })),
      ...candidati.map((r) => ({ venditaId: r.venditaId, prodottoId: r.prodottoId, quantita: r.quantita, giaAssociato: false, scelto: false })),
    ];
    setAssocKit({ kit: k, righe });
  }
  function toggleSelezioneAssoc(venditaId, prodottoId) {
    setAssocKit((prev) => prev && ({
      ...prev,
      righe: prev.righe.map((x) => (x.venditaId === venditaId && x.prodottoId === prodottoId ? { ...x, scelto: !x.scelto } : x)),
    }));
  }
  // Confermare la tendina: la scatola passa ad "aperto" e si applica la
  // differenza — si attribuisce quello che e' stato spuntato ora, si stacca
  // quello che e' stato tolto. Poi i venduti sotto calano da soli.
  async function confermaAssociazione() {
    if (!assocKit) return;
    const { kit, righe } = assocKit;
    setAssocKit(null);
    setMessaggio("");
    if (kit.stato !== "aperto") {
      const e = await segnaDestinoKit(kit.id, "aperto", { preservaIscritto: kit.origine === "allievo_non_consegnato" });
      if (e) { setMessaggio("Non riesco ad aprire il kit: " + e); return; }
    }
    let intoppo = "";
    for (const r of righe) {
      if (r.scelto && !r.giaAssociato) {
        const e = await associaVenditaAKit({ istanzaId: kit.id, prodottoId: r.prodottoId, quantita: r.quantita, venditaId: r.venditaId });
        if (e) intoppo = `${nomeProdotto(r.prodottoId)}: ${e}`;
      } else if (!r.scelto && r.giaAssociato) {
        const e = await disassociaVenditaDaKit({ istanzaId: kit.id, prodottoId: r.prodottoId, venditaId: r.venditaId });
        if (e) intoppo = `${nomeProdotto(r.prodottoId)}: ${e}`;
      }
    }
    if (intoppo) setMessaggio("Qualcosa non è andato — " + intoppo);
    ricaricaApp?.(["vendite_shop"]);
    await ricarica();
  }

  // Flag "consegnato" di un'allieva. Toglierlo non e' solo una spunta: quel
  // kit diventa una scatola a se', da aprire o dare ad altri, con le sue
  // vendite. Rimetterlo consegnato la fa sparire — ma non se ci sono gia'
  // vendite attaccate.
  async function toggleConsegna(i) {
    if (chiusa) return;
    toccata.current = true;
    const eraConsegnato = consegnato(i.id);
    setConsegne((p) => ({ ...p, [i.id]: !eraConsegnato }));
    const kitId = i.kit_id || righePerTipo("kit_allievo")[0]?.kitId || null;
    if (!dati || !kitId) return;
    if (eraConsegnato) {
      const err = await materializzaKitAllievoNonConsegnato({ spedizioneId: dati.spedizioneId, kitId, iscrittoId: i.id });
      if (err) setMessaggio("Segnato non consegnato, ma non ho creato la scheda del kit: " + err);
      await ricarica();
    } else {
      const esito = await smaterializzaKitAllievoNonConsegnato({ spedizioneId: dati.spedizioneId, kitId, iscrittoId: i.id });
      if (esito.bloccato) {
        setConsegne((p) => ({ ...p, [i.id]: false }));
        setMessaggio("Questo kit ha delle vendite associate: staccale prima di rimetterlo come consegnato.");
        return;
      }
      if (esito.errore) setMessaggio("Non riesco a togliere la scheda del kit: " + esito.errore);
      await ricarica();
    }
  }

  async function chiudi() {
    if (!dati) return;
    if (!window.confirm("Chiudi l'inventario? Da qui in poi la scheda la vede chi riceve il pacco.")) return;
    setSalvando(true);
    const esito = await chiudiRientro({
      spedizioneId: dati.spedizioneId,
      corsoDataId: corsoData.id,
      masterId: masterLoggataId || null,
      righe: dichiarazioni,
    });
    setSalvando(false);
    if (esito.errore) { setMessaggio(esito.errore); return; }
    // la chiusura ha riscritto le righe da capo: la posta e' arrivata
    clearTimeout(timerBozza.current);
    scriviScialuppa(dati.spedizioneId, null);
    setStatoBozza("fermo");
    setMessaggio(esito.anomalie ? "Inventario chiuso. Ci sono differenze da verificare, le vedrà chi riceve il pacco." : "Inventario chiuso.");
    await ricarica();
  }

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Dashboard master" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Inventario di fine corso</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
          {corso?.nome || "—"} · {loc?.nome || "—"}. È già compilato con quello che il sistema sa: controlla e correggi solo dove serve.
        </div>

        {/* Quello che hai contato non vive nel telefono: la master deve
            poterlo vedere senza chiederlo, perché è l'unica ragione per
            cui può permettersi di non avere fretta. */}
        {!caricando && dati && !chiusa && (statoBozza !== "fermo" || bozzaTs) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7, marginBottom: 14,
            ...fontBody, fontSize: 11.5, fontWeight: 700,
            color: statoBozza === "in_ritardo" ? "#8A6A1B" : MUTED,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 4, flexShrink: 0,
              background: statoBozza === "in_ritardo" ? "#C89A2B" : statoBozza === "salvo" ? GOLD : "#2E7D32",
            }} />
            {statoBozza === "in_ritardo"
              ? "Non riesco a salvare: quello che hai contato è al sicuro sul telefono, riprovo da solo."
              : statoBozza === "salvo"
                ? "Salvo…"
                : `Salvato${bozzaTs ? ` alle ${oraBreve(bozzaTs)}` : ""}. Puoi chiudere la pagina e riprendere da qui.`}
          </div>
        )}

        {messaggio && (
          <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: messaggio.startsWith("Inventario chiuso") ? "#2E7D32" : "#C0392B", background: messaggio.startsWith("Inventario chiuso") ? "#E9F6EC" : "#FDECEC", border: `1px solid ${messaggio.startsWith("Inventario chiuso") ? "#BFE3C6" : "#F5C6C6"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
            {messaggio}
          </div>
        )}

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : !dati ? (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 20, ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
            Per questo corso non risulta partito nessun pacco: non c'è niente da far rientrare.
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
            {chiusa && (
              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#2E7D32", background: "#E9F6EC", borderRadius: 10, padding: "9px 12px", marginBottom: 16 }}>
                Inventario già chiuso. Ora tocca a chi riceve il pacco.
              </div>
            )}

            {/* 1 — i kit degli allievi */}
            {righePerTipo("kit_allievo").length > 0 && (
              <Blocco numero="1" titolo="Kit degli allievi" sottotitolo="Di suo li hanno ricevuti tutti: tocca solo chi non l'ha avuto.">
                {iscrittiEdizione.map((i) => (
                  <button
                    key={i.id} disabled={chiusa}
                    onClick={() => toggleConsegna(i)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
                      textAlign: "left", background: consegnato(i.id) ? "#E9F6EC" : "#fff",
                      border: `1px solid ${consegnato(i.id) ? "#BFE3C6" : CREAM_BORDER}`,
                      borderRadius: 12, padding: "12px 14px", marginBottom: 6, minHeight: 48, cursor: chiusa ? "default" : "pointer",
                    }}
                  >
                    <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY, minWidth: 0 }}>{nomeIscritto(i)}</span>
                    <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: consegnato(i.id) ? "#2E7D32" : MUTED, whiteSpace: "nowrap" }}>
                      {consegnato(i.id) ? "✓ consegnato" : "non consegnato"}
                    </span>
                  </button>
                ))}
              </Blocco>
            )}

            {/* 2 — i kit di riserva */}
            {dati.istanze.length > 0 && (
              <Blocco numero="2" titolo="Kit di riserva" sottotitolo="Uno per uno: che fine ha fatto.">
                {dati.istanze.map((k) => {
                  const usciti = k.componenti.filter((c) => c.prelevata > 0);
                  return (
                    <div key={k.id} style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      {(() => {
                        const nonConsegnato = k.origine === "allievo_non_consegnato";
                        const nomeAllieva = nonConsegnato ? nomeIscritto(iscrittoById[k.iscrittoId] || {}) : "";
                        const base = DESTINI.find((d) => d.chiave === k.stato)?.testo || k.stato;
                        const chi = k.stato === "consegnato_intero"
                          ? (k.consegnatoANome || (!nonConsegnato ? nomeIscritto(iscrittoById[k.iscrittoId] || {}) : ""))
                          : "";
                        return (
                          <div style={{ textAlign: "center", marginBottom: 6 }}>
                            <div style={{ ...fontDisplay, fontSize: 30, fontWeight: 800, color: "#000", lineHeight: 1.15 }}>
                              {kitById[k.kitId]?.nome || "Kit"}{nonConsegnato ? "" : ` #${k.progressivo}`}
                            </div>
                            {nonConsegnato && (
                              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 800, color: "#8A6A1B", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>
                                Non consegnato{nomeAllieva ? ` · ${nomeAllieva}` : ""}
                              </div>
                            )}
                            <div style={{ marginTop: 5 }}>
                              {k.stato === "sigillato"
                                ? <Pastiglia testo="da dichiarare" colore="#8A6A1B" sfondo="#F7EEDE" />
                                : <Pastiglia testo={chi ? `${base}: ${chi}` : base} colore="#2E7D32" sfondo="#E9F6EC" />}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Cosa e' uscito da questa scatola: sola lettura. Le
                          vendite si attribuiscono/tolgono dalla tendina che si
                          apre con "L'ho aperto", non da qui. */}
                      {usciti.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                            Venduti presi da questo kit
                          </div>
                          {usciti.map((c) => (
                            <div key={c.prodottoId} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0", ...fontBody, fontSize: 12.5, color: NAVY }}>
                              <span>{nomeProdotto(c.prodottoId)}</span>
                              <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{c.prelevata} {c.prelevata === 1 ? "pezzo" : "pezzi"}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!chiusa && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          {k.stato === "aperto" && (
                            <button
                              onClick={() => apriAssociazione(k)}
                              style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "#2E7D32", border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer", flex: "1 1 160px", minHeight: 44 }}
                            >
                              Venduti presi da qui
                            </button>
                          )}
                          <button
                            onClick={() => { setNomeAltra(""); setSceltaKit(k); }}
                            style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer", flex: "1 1 120px", minHeight: 44 }}
                          >
                            {k.stato === "sigillato" ? "Che fine ha fatto?" : "Cambia"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Solo un promemoria: i pezzi venduti dal POS e dichiarati
                    presi dai kit che nessun kit si e' ancora preso. Non si
                    associano da qui — lo si fa aprendo la scatola giusta,
                    sopra, dov'e' anche il tasto per togliere un pezzo messo
                    li' per sbaglio. */}
                {vendutiDaAssociare.length > 0 && (
                  <div style={{ marginTop: 10, border: `1px dashed ${GOLD}`, borderRadius: 12, padding: 12, background: "#FDF8EC" }}>
                    <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#8A6A1B", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                      Venduti dal POS, presi dai kit — ancora da attribuire
                    </div>
                    <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginBottom: 8, lineHeight: 1.4 }}>
                      Questi li hai venduti e dichiarati presi dai kit. Aprendo la scatola giusta qui sopra (“L’ho aperto”) li assegni da lì.
                    </div>
                    {vendutiDaAssociare.map((r) => (
                      <div key={`${r.venditaId}|${r.prodottoId}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", ...fontBody, fontSize: 12.5, color: NAVY }}>
                        <span>{nomeProdotto(r.prodottoId)}</span>
                        <span style={{ color: "#8A6A1B", fontWeight: 700, whiteSpace: "nowrap" }}>{r.quantita} {r.quantita === 1 ? "pezzo" : "pezzi"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Blocco>
            )}

            {/* 3 — gli sfusi */}
            {righePerTipo("sfuso").length > 0 && (
              <Blocco numero="3" titolo="Materiale sfuso" sottotitolo="Quanti pezzi rimandi indietro. Il consumo lo calcola l'app.">
                {righePerTipo("sfuso").map((r) => {
                  const v = valore(r.rigaId);
                  const consumato = Math.max(0, r.spediti - v.rientrata - r.usciti);
                  return (
                    <div key={r.rigaId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                      <span style={{ flex: "1 1 160px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                        {nomeProdotto(r.prodottoId)}
                        <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                          partiti {r.spediti}
                          {r.usciti > 0 && ` · ${r.usciti} già usciti`}
                          {v.rientrata <= r.spediti && ` · consumati ${consumato}`}
                        </span>
                      </span>
                      <ContatoreQuantita
                        valore={v.rientrata} min={0} compatto={isMobile}
                        titolo="Quanti pezzi rimandi indietro"
                        onCambia={(n) => cambia(r.rigaId, "rientrata", n)}
                      />
                    </div>
                  );
                })}
              </Blocco>
            )}

            {/* 4 — i dermografi */}
            {righePerTipo("dermografo").length > 0 && (
              <Blocco numero="4" titolo="Dermografi" sottotitolo="Qui i conti devono tornare: è l'unica cosa che blocca la chiusura.">
                {righePerTipo("dermografo").map((r) => {
                  const v = valore(r.rigaId);
                  const somma = v.rientrata + v.guasta + r.venduti;
                  const quadra = somma === r.spediti;
                  return (
                    <div key={r.rigaId} style={{ border: `1px solid ${quadra ? CREAM_BORDER : "#F5C6C6"}`, background: quadra ? "#fff" : "#FDECEC", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                        {r.modello || nomeProdotto(r.prodottoId)}
                        <span style={{ ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginLeft: 8 }}>partiti {r.spediti}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ ...fontBody, fontSize: 12.5, color: NAVY }}>Rientrano funzionanti</span>
                        <ContatoreQuantita valore={v.rientrata} min={0} compatto onCambia={(n) => cambia(r.rigaId, "rientrata", n)} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ ...fontBody, fontSize: 12.5, color: "#C0392B" }}>Rientrano guasti</span>
                        <ContatoreQuantita valore={v.guasta} min={0} compatto onCambia={(n) => cambia(r.rigaId, "guasta", n)} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>Venduti</span>
                        <span style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: MUTED }}>{r.venduti}</span>
                      </div>
                      {!quadra && (
                        <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#C0392B", marginTop: 8, lineHeight: 1.4 }}>
                          {somma} su {r.spediti}: {somma < r.spediti ? `ne mancano ${r.spediti - somma}` : `ne avanzano ${somma - r.spediti}`}.
                        </div>
                      )}
                    </div>
                  );
                })}
              </Blocco>
            )}

            {dati.difettosiAttesi.length > 0 && (
              <Blocco numero="•" titolo={`Pezzi guasti che tornano — ${dati.difettosiAttesi.length}`} sottotitolo="Dichiarati durante il corso: non c'è niente da fare qui.">
                {dati.difettosiAttesi.map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12.5, color: NAVY }}>
                    <span>{nomeProdotto(g.prodottoId)}{g.nota && <span style={{ color: MUTED }}> · {g.nota}</span>}</span>
                    <Pastiglia testo="registrato" />
                  </div>
                ))}
              </Blocco>
            )}

            {!chiusa && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${CREAM_BORDER}` }}>
                <Button onClick={chiudi} disabled={salvando || nonQuadrano.length > 0} style={{ width: "100%", minHeight: 52 }}>
                  {salvando ? "Chiudo…" : "Chiudi l'inventario"}
                </Button>
                <div style={{ ...fontBody, fontSize: 11.5, color: nonQuadrano.length > 0 ? "#C0392B" : MUTED, marginTop: 8, lineHeight: 1.45 }}>
                  {nonQuadrano.length > 0
                    ? "Prima fai quadrare i dermografi: è l'unica cosa che blocca."
                    : "Se qualcosa non torna la scheda si chiude lo stesso e la differenza viene segnalata a chi riceve il pacco."}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {sceltaKit && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 1100, overflowY: "auto" }}
          onClick={() => setSceltaKit(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 18, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 460, margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ ...fontDisplay, fontSize: 19, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
              {kitById[sceltaKit.kitId]?.nome || "Kit"}{sceltaKit.origine === "allievo_non_consegnato" ? " — non consegnato" : ` #${sceltaKit.progressivo}`}
            </div>
            {DESTINI.map((d) => (
              <button
                key={d.chiave}
                onClick={() => {
                  if (d.chiave === "consegnato_intero") { setSceltaKit({ ...sceltaKit, chiediAllieva: true }); return; }
                  if (d.chiave === "aperto") { apriAssociazione(sceltaKit); return; }
                  destino(sceltaKit, d.chiave);
                }}
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, minHeight: 60, ...fontBody, fontSize: 15, fontWeight: 700, padding: "14px 16px", borderRadius: 14, cursor: "pointer", background: "#fff", color: NAVY, border: `1px solid ${CREAM_BORDER}` }}
              >
                {d.chiave === "consegnato_intero" && sceltaKit.origine === "allievo_non_consegnato" ? "Data ad un'altra allieva" : d.testo}
                <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>{d.nota}</span>
              </button>
            ))}
            {sceltaKit.chiediAllieva && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>A chi</div>
                {iscrittiEdizione.map((i) => (
                  <button
                    key={i.id} onClick={() => destino(sceltaKit, "consegnato_intero", { iscrittoId: i.id })}
                    style={{ display: "block", width: "100%", textAlign: "left", ...fontBody, fontSize: 13.5, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "11px 12px", marginBottom: 6, cursor: "pointer", minHeight: 44 }}
                  >{nomeIscritto(i)}</button>
                ))}
                {/* anche a qualcuno che non e' fra le iscritte del corso: nome a mano */}
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 6px" }}>Oppure un altro nome</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={nomeAltra}
                    onChange={(e) => setNomeAltra(e.target.value)}
                    placeholder="Nome e cognome"
                    style={{ flex: "1 1 160px", minWidth: 0, ...fontBody, fontSize: 13.5, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "11px 12px", minHeight: 44 }}
                  />
                  <button
                    disabled={!nomeAltra.trim()}
                    onClick={() => { const n = nomeAltra.trim(); setNomeAltra(""); destino(sceltaKit, "consegnato_intero", { nome: n }); }}
                    style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: "#fff", background: nomeAltra.trim() ? "#2E7D32" : "#B7C3BA", border: "none", borderRadius: 10, padding: "11px 16px", minHeight: 44, cursor: nomeAltra.trim() ? "pointer" : "default" }}
                  >Conferma</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* La tendina dei venduti dal POS da attribuire alla scatola aperta.
          Spunta cio' che e' uscito da qui; puoi spuntare solo quello che
          questo kit contiene davvero e in numero sufficiente. */}
      {assocKit && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 1100, overflowY: "auto" }}
          onClick={() => setAssocKit(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 18, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 460, margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ ...fontDisplay, fontSize: 19, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
              {kitById[assocKit.kit.kitId]?.nome || "Kit"}{assocKit.kit.origine === "allievo_non_consegnato" ? " — non consegnato" : ` #${assocKit.kit.progressivo}`}
            </div>
            <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 14, lineHeight: 1.4 }}>
              Quali venduti dal POS sono usciti da questa scatola? Spunta i pezzi.
            </div>
            {assocKit.righe.length === 0 ? (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED, background: BG_CHIARO, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                Nessun venduto dal POS che questa scatola potesse contenere.
              </div>
            ) : (
              assocKit.righe.map((r) => (
                <button
                  key={`${r.venditaId}|${r.prodottoId}`}
                  onClick={() => toggleSelezioneAssoc(r.venditaId, r.prodottoId)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: r.scelto ? "#E9F6EC" : "#fff", border: `1px solid ${r.scelto ? "#BFE3C6" : CREAM_BORDER}`, borderRadius: 12, padding: "11px 12px", marginBottom: 8, minHeight: 48, cursor: "pointer" }}
                >
                  <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: `2px solid ${r.scelto ? "#2E7D32" : "#C7CBD4"}`, background: r.scelto ? "#2E7D32" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>
                    {r.scelto ? "✓" : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                    {nomeProdotto(r.prodottoId)}
                    <span style={{ color: MUTED, fontWeight: 700 }}> · {r.quantita} {r.quantita === 1 ? "pezzo" : "pezzi"}</span>
                  </span>
                </button>
              ))
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                onClick={() => setAssocKit(null)}
                style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "12px 16px", minHeight: 48, cursor: "pointer", flex: "1 1 0" }}
              >Annulla</button>
              <button
                onClick={confermaAssociazione}
                style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: "#fff", background: "#2E7D32", border: "none", borderRadius: 12, padding: "12px 16px", minHeight: 48, cursor: "pointer", flex: "1 1 0" }}
              >Conferma</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
