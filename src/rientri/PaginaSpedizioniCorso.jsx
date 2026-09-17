// Lato Raffaele: cosa parte per ogni corso.
//
// La pagina non inventa niente da sola. Propone, e la proposta si vede da
// dove viene — una pastiglia su ogni riga dice se quel numero arriva dagli
// iscritti, dalla prelista del corso, o da una lista che qualcuno aveva
// gia' compilato a mano. Le ultime NON si ricalcolano mai: se per
// quell'edizione c'erano gia' dei prodotti scritti in logistica, o il
// pacco e' gia' partito, quelli sono i prodotti, con le loro quantita'.
//
// Alla conferma della partenza succede la cosa che regge tutto il resto
// del modulo: ogni kit di riserva diventa un'istanza numerata, con la
// fotografia di cosa c'era dentro.

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina, inputStyle } from "../ui/stile.js";
import { Button, CampoNumero, TastoLivelloPrecedente } from "../ui/base.jsx";
import { componiProposta, listaGiaCompilata } from "./composizione";
import { leggiSpedizione, leggiSpedizioniPerEdizione, creaSpedizione, salvaQuantitaRiga, aggiungiRiga, eliminaRiga, confermaPartenza } from "./dati";

const ETICHETTA_TIPO = {
  kit_allievo: "Kit allievo",
  kit_riserva: "Kit di riserva",
  sfuso: "Sfuso",
  dermografo: "Dermografo",
};

const ETICHETTA_FONTE = {
  iscritti: "dagli iscritti",
  prelista: "dalla prelista del corso",
  lista_esistente: "già in lista",
  riserva_logistica: "riserva già decisa",
};

const oggiStr = () => new Date().toISOString().slice(0, 10);

function Pastiglia({ testo, colore = MUTED, sfondo = "#F4F1EA" }) {
  return (
    <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: colore, background: sfondo, borderRadius: 8, padding: "2px 7px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {testo}
    </span>
  );
}

export default function PaginaSpedizioniCorso({
  corsi, corsiDate, location, iscritti, kitDefinizioni, corsiKitProdotti,
  prodottiShop, logisticaKitEdizioni, utenteLoggato, isMobile = false, onBack,
}) {
  const [spedizioniPerEdizione, setSpedizioniPerEdizione] = useState({});
  const [edizioneId, setEdizioneId] = useState(null);
  const [aperta, setAperta] = useState(null); // { spedizione, righe, istanze }
  const [caricando, setCaricando] = useState(true);
  const [messaggio, setMessaggio] = useState("");
  const [lavorando, setLavorando] = useState(false);
  const [prodottoDaAggiungere, setProdottoDaAggiungere] = useState("");

  const corsoById = useMemo(() => Object.fromEntries((corsi || []).map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries((location || []).map((l) => [l.id, l])), [location]);
  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  const kitById = useMemo(() => Object.fromEntries((kitDefinizioni || []).map((k) => [k.id, k])), [kitDefinizioni]);

  const edizione = (corsiDate || []).find((cd) => cd.id === edizioneId) || null;
  const corso = edizione ? corsoById[edizione.corso_id] : null;
  const statoLogistica = (logisticaKitEdizioni || []).find((l) => l.corso_data_id === edizioneId) || null;
  const iscrittiEdizione = useMemo(
    () => (iscritti || []).filter((i) => i.corso_data_id === edizioneId),
    [iscritti, edizioneId],
  );

  // le edizioni che hanno senso: da una settimana fa in avanti. Il pacco si
  // prepara prima del corso, non si va a caccia nello storico
  const edizioniInLista = useMemo(() => {
    const limite = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return (corsiDate || [])
      .filter((cd) => (cd.data_fine || cd.data_inizio) >= limite)
      .sort((a, b) => String(a.data_inizio).localeCompare(String(b.data_inizio)));
  }, [corsiDate]);

  useEffect(() => { leggiSpedizioniPerEdizione().then((m) => { setSpedizioniPerEdizione(m); setCaricando(false); }); }, []);

  useEffect(() => {
    if (!edizioneId) { setAperta(null); return; }
    setAperta(null);
    leggiSpedizione(edizioneId).then(setAperta);
  }, [edizioneId]);

  const proposta = useMemo(() => {
    if (!edizione) return [];
    return componiProposta({
      iscritti: iscrittiEdizione,
      kitDefinizioni: kitDefinizioni || [],
      corsiKitProdotti: corsiKitProdotti || [],
      corsoId: edizione.corso_id || null,
      stato: statoLogistica,
    });
  }, [edizione, iscrittiEdizione, kitDefinizioni, corsiKitProdotti, statoLogistica]);

  const ereditata = listaGiaCompilata(statoLogistica);

  async function ricaricaAperta() {
    const dati = await leggiSpedizione(edizioneId);
    setAperta(dati);
    setSpedizioniPerEdizione(await leggiSpedizioniPerEdizione());
  }

  async function creaDallaProposta() {
    if (!edizione) return;
    setLavorando(true); setMessaggio("");
    const { errore } = await creaSpedizione({
      corsoDataId: edizione.id,
      masterId: edizione.master_id || null,
      nAllieviPrevisti: iscrittiEdizione.length,
      creataDa: utenteLoggato?.nome || null,
      righe: proposta,
    });
    setLavorando(false);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricaricaAperta();
  }

  async function cambiaQuantita(rigaId, quantita) {
    const errore = await salvaQuantitaRiga(rigaId, quantita);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricaricaAperta();
  }

  async function togliRiga(rigaId) {
    const errore = await eliminaRiga(rigaId);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricaricaAperta();
  }

  async function aggiungiSfuso() {
    if (!prodottoDaAggiungere || !aperta?.spedizione) return;
    const errore = await aggiungiRiga(aperta.spedizione.id, {
      tipo: "sfuso", kit_id: null, prodotto_id: prodottoDaAggiungere, quantita_spedita: 1, fonte: "prelista",
    });
    setProdottoDaAggiungere("");
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricaricaAperta();
  }

  async function partenza() {
    if (!aperta?.spedizione) return;
    const kitRiserva = (aperta.righe || []).filter((r) => r.tipo === "kit_riserva" && r.quantita_spedita > 0);
    const quanti = kitRiserva.reduce((s, r) => s + r.quantita_spedita, 0);
    const conferma = quanti > 0
      ? `Il pacco parte. Nascono ${quanti} kit di riserva numerati, ognuno con la fotografia di cosa c'è dentro: da qui in poi il POS saprà che quella merce è in aula.\n\nSi fa una volta sola. Confermi?`
      : "Il pacco parte. Confermi?";
    if (!window.confirm(conferma)) return;
    setLavorando(true); setMessaggio("");
    const errore = await confermaPartenza({
      spedizioneId: aperta.spedizione.id,
      corsiKitProdotti: corsiKitProdotti || [],
      dataSpedizione: oggiStr(),
    });
    setLavorando(false);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricaricaAperta();
  }

  const nomeDi = (riga) =>
    riga.kit_id ? (kitById[riga.kit_id]?.nome || "Kit")
      : riga.prodotto_id ? (prodottoById[riga.prodotto_id]?.nome || "—")
        : "Dermografo di riserva";

  const partita = aperta?.spedizione && aperta.spedizione.stato !== "bozza";

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Logistica prodotti" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Spedizioni ai corsi</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 1.5 }}>
          Cosa parte per ogni corso. Quello che è già stato compilato o è già partito non si tocca: resta com'è.
        </div>

        {messaggio && (
          <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: "#C0392B", background: "#FDECEC", border: "1px solid #F5C6C6", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
            {messaggio}
          </div>
        )}

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : !edizioneId ? (
          <div>
            {edizioniInLista.length === 0 && (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun corso in arrivo.</div>
            )}
            {edizioniInLista.map((cd) => {
              const c = corsoById[cd.corso_id];
              const l = locById[cd.location_id];
              const sped = spedizioniPerEdizione[cd.id];
              const stato = (logisticaKitEdizioni || []).find((x) => x.corso_data_id === cd.id) || null;
              return (
                <div
                  key={cd.id}
                  onClick={() => setEdizioneId(cd.id)}
                  style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY }}>{c?.nome || "—"}</div>
                    <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>
                      {cd.data_inizio} · {l?.nome || "—"}
                    </div>
                  </div>
                  {listaGiaCompilata(stato) && <Pastiglia testo="lista già compilata" colore="#8A6A1B" sfondo="#F7EEDE" />}
                  {sped
                    ? <Pastiglia testo={sped.stato === "bozza" ? "bozza" : sped.stato} colore={sped.stato === "bozza" ? MUTED : "#2E7D32"} sfondo={sped.stato === "bozza" ? "#F4F1EA" : "#E9F6EC"} />
                    : <Pastiglia testo="da fare" />}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setEdizioneId(null)}
              style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12 }}
            >
              ← Tutti i corsi
            </button>

            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 18 }}>
              <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: NAVY }}>{corso?.nome || "—"}</div>
              <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 10 }}>
                {edizione?.data_inizio} · {locById[edizione?.location_id]?.nome || "—"} · {iscrittiEdizione.length} iscritti
              </div>
              {ereditata && (
                <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6A1B", background: "#F7EEDE", borderRadius: 10, padding: "9px 12px", lineHeight: 1.45 }}>
                  Per questa edizione c'è già una lista compilata in logistica. I prodotti che vedi sotto sono
                  <b> quelli, con le quantità che avevano</b> — non ricalcolati dalla prelista. Quello che è già partito resta partito.
                </div>
              )}
            </div>

            {!aperta ? (
              <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  Proposta — {proposta.length} righe
                </div>
                {proposta.length === 0 ? (
                  <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 }}>
                    Non c'è niente da proporre: nessun iscritto con un kit, nessun accessorio didattica sul corso, nessuna riserva decisa in logistica.
                  </div>
                ) : (
                  proposta.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                      <span style={{ ...fontBody, fontSize: 13, color: NAVY, flex: "1 1 200px", minWidth: 0 }}>{nomeDi(r)}</span>
                      <Pastiglia testo={ETICHETTA_TIPO[r.tipo]} />
                      <Pastiglia testo={ETICHETTA_FONTE[r.fonte]} colore={r.fonte === "lista_esistente" ? "#8A6A1B" : MUTED} sfondo={r.fonte === "lista_esistente" ? "#F7EEDE" : "#F4F1EA"} />
                      <span style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, width: 40, textAlign: "right" }}>{r.quantita_spedita}</span>
                    </div>
                  ))
                )}
                <div style={{ marginTop: 16 }}>
                  <Button onClick={creaDallaProposta} disabled={lavorando || proposta.length === 0}>
                    {lavorando ? "Creo…" : "Crea la spedizione"}
                  </Button>
                  <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>
                    Le quantità si correggono dopo, una per una. Niente si muove dal magazzino: questa è la lista, non lo scarico.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Spedizione — {aperta.righe.length} righe
                  </div>
                  <Pastiglia
                    testo={aperta.spedizione.stato}
                    colore={aperta.spedizione.stato === "bozza" ? MUTED : "#2E7D32"}
                    sfondo={aperta.spedizione.stato === "bozza" ? "#F4F1EA" : "#E9F6EC"}
                  />
                </div>

                {aperta.righe.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                    <span style={{ ...fontBody, fontSize: 13, color: NAVY, flex: "1 1 200px", minWidth: 0 }}>{nomeDi(r)}</span>
                    <Pastiglia testo={ETICHETTA_TIPO[r.tipo]} />
                    {partita ? (
                      <span style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, width: 60, textAlign: "right" }}>{r.quantita_spedita}</span>
                    ) : (
                      <>
                        <CampoNumero
                          valore={r.quantita_spedita} min={0}
                          titolo="Quanti pezzi partono"
                          onCambia={(n) => cambiaQuantita(r.id, n)}
                          style={{ ...inputStyle, width: 74, textAlign: "center", padding: "6px 8px", fontWeight: 700 }}
                        />
                        <button
                          onClick={() => togliRiga(r.id)} title="Togli dalla spedizione"
                          style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 14, padding: 4 }}
                        >✕</button>
                      </>
                    )}
                  </div>
                ))}

                {!partita && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <select
                      value={prodottoDaAggiungere}
                      onChange={(e) => setProdottoDaAggiungere(e.target.value)}
                      style={{ ...inputStyle, width: "auto", flex: "1 1 240px", minWidth: 0 }}
                    >
                      <option value="">Aggiungi un prodotto da mandare…</option>
                      {(prodottiShop || [])
                        .filter((p) => p.attivo !== false)
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <Button variant="ghost" onClick={aggiungiSfuso} disabled={!prodottoDaAggiungere}>Aggiungi</Button>
                  </div>
                )}

                {aperta.istanze.length > 0 && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}` }}>
                    <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      Kit di riserva partiti — {aperta.istanze.length}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {aperta.istanze.map((k) => (
                        <span key={k.id} style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#FBF6EA", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "6px 10px" }}>
                          {kitById[k.kit_id]?.nome || "Kit"} #{k.progressivo}
                          <span style={{ color: MUTED, fontWeight: 400 }}> · {k.stato}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!partita && (
                  <div style={{ marginTop: 18 }}>
                    <Button onClick={partenza} disabled={lavorando}>
                      {lavorando ? "Registro…" : "Il pacco è partito"}
                    </Button>
                    <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>
                      Da qui in poi i kit di riserva esistono uno per uno, e il POS sa che quella merce è in aula. Si fa una volta sola.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
