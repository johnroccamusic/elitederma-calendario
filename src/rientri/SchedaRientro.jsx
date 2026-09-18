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

import { useEffect, useMemo, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { Button, ContatoreQuantita, TastoLivelloPrecedente } from "../ui/base.jsx";
import { caricaRientro, segnaDestinoKit, chiudiRientro, dermografiNonQuadrano } from "./rientro";

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
  corsoData, corso, location, iscritti, prodottiShop, kitDefinizioni, masterLoggataId, isMobile = false, onBack,
}) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [valori, setValori] = useState({}); // rigaId -> { rientrata, guasta, consegnata }
  const [consegne, setConsegne] = useState({}); // iscrittoId -> bool
  const [sceltaKit, setSceltaKit] = useState(null);
  const [messaggio, setMessaggio] = useState("");
  const [salvando, setSalvando] = useState(false);

  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  const kitById = useMemo(() => Object.fromEntries((kitDefinizioni || []).map((k) => [k.id, k])), [kitDefinizioni]);
  const iscrittiEdizione = useMemo(
    () => (iscritti || []).filter((i) => i.corso_data_id === corsoData?.id),
    [iscritti, corsoData],
  );
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

  async function destino(istanza, chiave, iscrittoId = null) {
    setSceltaKit(null);
    const errore = await segnaDestinoKit(istanza.id, chiave, iscrittoId);
    if (errore) { setMessaggio("Non è andata: " + errore); return; }
    await ricarica();
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
    setMessaggio(esito.anomalie ? "Inventario chiuso. Ci sono differenze da verificare, le vedrà chi riceve il pacco." : "Inventario chiuso.");
    await ricarica();
  }

  const chiusa = dati?.rientro?.stato === "chiuso";

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
                    onClick={() => setConsegne((p) => ({ ...p, [i.id]: !consegnato(i.id) }))}
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY }}>
                          {kitById[k.kitId]?.nome || "Kit"} #{k.progressivo}
                        </span>
                        {k.stato === "sigillato"
                          ? <Pastiglia testo="da dichiarare" colore="#8A6A1B" sfondo="#F7EEDE" />
                          : <Pastiglia testo={DESTINI.find((d) => d.chiave === k.stato)?.testo || k.stato} colore="#2E7D32" sfondo="#E9F6EC" />}
                      </div>
                      {usciti.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                            Già uscito da questo kit
                          </div>
                          {usciti.map((c) => (
                            <div key={c.prodottoId} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", ...fontBody, fontSize: 12.5, color: NAVY }}>
                              <span>{nomeProdotto(c.prodottoId)}</span>
                              <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{c.prelevata} di {c.iniziale} · registrato</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!chiusa && (
                        <button
                          onClick={() => setSceltaKit(k)}
                          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 12px", marginTop: 8, cursor: "pointer", width: "100%", minHeight: 44 }}
                        >
                          {k.stato === "sigillato" ? "Che fine ha fatto?" : "Cambia"}
                        </button>
                      )}
                    </div>
                  );
                })}
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
              {kitById[sceltaKit.kitId]?.nome || "Kit"} #{sceltaKit.progressivo}
            </div>
            {DESTINI.map((d) => (
              <button
                key={d.chiave}
                onClick={() => (d.chiave === "consegnato_intero" ? setSceltaKit({ ...sceltaKit, chiediAllieva: true }) : destino(sceltaKit, d.chiave))}
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, minHeight: 60, ...fontBody, fontSize: 15, fontWeight: 700, padding: "14px 16px", borderRadius: 14, cursor: "pointer", background: "#fff", color: NAVY, border: `1px solid ${CREAM_BORDER}` }}
              >
                {d.testo}
                <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>{d.nota}</span>
              </button>
            ))}
            {sceltaKit.chiediAllieva && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>A chi</div>
                {iscrittiEdizione.map((i) => (
                  <button
                    key={i.id} onClick={() => destino(sceltaKit, "consegnato_intero", i.id)}
                    style={{ display: "block", width: "100%", textAlign: "left", ...fontBody, fontSize: 13.5, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "11px 12px", marginBottom: 6, cursor: "pointer", minHeight: 44 }}
                  >{nomeIscritto(i)}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
