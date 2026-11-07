// «MODELLE FIERA»: i consensi delle modelle al banco di una fiera.
//
// Richiesta del titolare (7/11/2026), con la fiera di Napoli aperta: «a
// quelli in fiera nella home devi mettere un tasto con i consensi
// informati da poter far compilare alle modelle in fiera».
//
// PERCHE' NON BASTAVA QUELLO CHE C'ERA. Un consenso si firma inquadrando
// un QR, e i QR sono di due specie: quello della scheda di una CLASSE,
// che porta con se' l'edizione, e quello generico, che non porta niente.
// In fiera una classe non c'e', quindi restava solo il generico — cioe'
// il guasto di ottobre scritto in QrConsensi.jsx: sette consensi che non
// sapevano a quale corso appartenessero e che nessuno poteva piu'
// rivendicare. In fiera sarebbe peggio: le modelle sono molte, di
// nessuna classe, e se una domani contesta un trattamento quel foglio va
// ritrovato. Da qui il QR porta la FIERA (`&evento=`), e la colonna
// `consensi_modelle.evento_id` la scrive.
//
// COME SI USA, in piedi, con la modella davanti: si controlla che la
// fiera sia quella giusta, si preme il trattamento che le si fa, e si
// gira il telefono — oppure si stampa il codice e si appende al banco.
// Il modulo lo compila lei, dal suo telefono: documento, questionario di
// salute, firma col dito.
//
// UN TRATTAMENTO PER VOLTA, e non sei QR in fila. In aula i QR sono
// quelli del corso e sono uno; qui i modelli sono tutti e sei, e sei
// codici accanto su un banco vogliono dire una modella trattata a
// microneedling che firma il modulo del trucco permanente. Si scegli
// prima il trattamento, poi compare il suo codice, grande e da solo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { CONSENSI } from "../content/consensi";
import { Riga, Codice } from "./ArchivioConsensi.jsx";
import { leggiConsensiDellEvento, filtraConsensi } from "./dati";
import { NAVY, MUTED, CREAM_BORDER, GOLD, fontBody, fontDisplay, inputStyle } from "../ui/stile.js";

// Quanti giorni attorno a oggi si considerano "la fiera di adesso". Sette
// per parte come la lettura del POS: il montaggio e lo smontaggio sono
// giorni in cui al banco si lavora, e un consenso firmato il giorno
// prima dell'apertura appartiene comunque a quella fiera.
const GIORNI_ATTORNO = 7;

const giorno = (scarto) => new Date(Date.now() + scarto * 86400000).toISOString().slice(0, 10);

/** Le fiere aperte in questi giorni, dalla piu' vicina. */
export async function leggiFiereDiAdesso() {
  const { data } = await supabase
    .from("eventi").select("id, nome, citta, data_inizio, data_fine, stato")
    .lte("data_inizio", giorno(GIORNI_ATTORNO))
    .gte("data_fine", giorno(-GIORNI_ATTORNO))
    .not("stato", "in", "(concluso,annullato)")
    .order("data_inizio");
  return data || [];
}

const nomeFiera = (ev) => [ev?.nome, ev?.citta].filter(Boolean).join(" · ");

export default function ModelleFiera({ isMobile = false, onBack, TastoIndietro, titolo = "Modelle fiera" }) {
  // `null` vuol dire "non ancora letto", e si distingue da "nessuna
  // fiera": sono due frasi diverse, e mostrare la seconda mentre vale la
  // prima manda a cercare un guasto che non c'e'
  const [fiere, setFiere] = useState(null);
  const [eventoId, setEventoId] = useState("");
  const [codice, setCodice] = useState("");
  const [firmati, setFirmati] = useState(null);
  const [cerca, setCerca] = useState("");

  useEffect(() => {
    let vivo = true;
    leggiFiereDiAdesso().then((lista) => {
      if (!vivo) return;
      setFiere(lista);
      // una sola fiera aperta: e' quella, e farla scegliere sarebbe un
      // tocco in piu' per una domanda senza alternative
      if (lista.length === 1) setEventoId(lista[0].id);
    });
    return () => { vivo = false; };
  }, []);

  const rileggiFirmati = useCallback(async () => {
    if (!eventoId) { setFirmati(null); return; }
    setFirmati(null);
    setFirmati(await leggiConsensiDellEvento(eventoId));
  }, [eventoId]);
  useEffect(() => { rileggiFirmati(); }, [rileggiFirmati]);

  const evento = fiere?.find((e) => e.id === eventoId) || null;
  const modello = CONSENSI.find((m) => m.codice === codice) || null;
  const visibili = useMemo(() => filtraConsensi(firmati || [], cerca), [firmati, cerca]);

  const scatola = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 18 };
  const etichetta = { ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          {TastoIndietro ? <TastoIndietro titolo="Home" onClick={onBack} /> : null}
          <div style={{ ...fontDisplay, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: isMobile ? 13 : 14, color: MUTED, marginBottom: 16, lineHeight: 1.5, maxWidth: "60ch" }}>
          Il consenso informato da far compilare alle modelle al banco. Scegli il trattamento,
          fai inquadrare il codice: il modulo lo compila lei dal suo telefono e resta legato a questa fiera.
        </div>

        {fiere === null && (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "18px 0" }}>Sto leggendo le fiere…</div>
        )}

        {/* NESSUNA FIERA APERTA: non si mostra un codice "per adesso".
            Un consenso senza la sua fiera e' un consenso che fra un mese
            non si sa di chi era, ed e' proprio la cosa che questa pagina
            esiste per evitare. */}
        {fiere !== null && fiere.length === 0 && (
          <div style={{ ...fontBody, fontSize: 13, color: "#8A2D2D", background: "#FBEDEC", border: "1px solid #F0D3D0", borderRadius: 12, padding: "13px 15px", lineHeight: 1.55 }}>
            <b>In questi giorni non c’è nessuna fiera aperta.</b>
            <div style={{ marginTop: 6 }}>
              Qui i consensi si legano alla fiera, e senza una fiera non c’è niente a cui legarli: fra un mese
              quel foglio non si saprebbe più di quale evento era. Se l’evento esiste ma non compare, controlla
              le sue date e il suo stato in Gestione eventi.
            </div>
          </div>
        )}

        {fiere !== null && fiere.length > 0 && (
          <>
            <div style={{ ...scatola, marginBottom: 14 }}>
              <div style={etichetta}>La fiera</div>
              {fiere.length === 1 ? (
                <div style={{ ...fontDisplay, fontSize: isMobile ? 17 : 19, fontWeight: 700, color: NAVY, marginTop: 6 }}>
                  {nomeFiera(fiere[0])}
                </div>
              ) : (
                <select
                  data-campo="fiera"
                  value={eventoId} onChange={(e) => { setEventoId(e.target.value); setCodice(""); }}
                  style={{ ...inputStyle, marginTop: 8, minHeight: 44, width: "100%" }}
                >
                  <option value="">— scegli la fiera —</option>
                  {fiere.map((e) => <option key={e.id} value={e.id}>{nomeFiera(e)}</option>)}
                </select>
              )}
              <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
                Il consenso firmato da qui resta legato a questa fiera, e si rilegge qui sotto.
              </div>
            </div>

            {!eventoId && fiere.length > 1 && (
              <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Scegli la fiera per vedere i codici.</div>
            )}

            {eventoId && (
              <>
                <div style={{ ...scatola, marginBottom: 14 }}>
                  <div style={etichetta}>Che trattamento le fai?</div>
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 4, marginBottom: 10, lineHeight: 1.45 }}>
                    Ogni trattamento ha il suo modulo: le domande sulla salute non sono le stesse, e il foglio
                    sbagliato sotto una firma giusta non vale niente.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CONSENSI.map((m) => {
                      const scelto = m.codice === codice;
                      return (
                        <button
                          key={m.codice} type="button" onClick={() => setCodice(scelto ? "" : m.codice)}
                          style={{
                            ...fontBody, fontSize: 13.5, fontWeight: 700, minHeight: 48, borderRadius: 12,
                            padding: "0 16px", cursor: "pointer", textAlign: "left",
                            background: scelto ? NAVY : "#fff", color: scelto ? "#fff" : NAVY,
                            border: `1px solid ${scelto ? NAVY : CREAM_BORDER}`,
                            flex: isMobile ? "1 1 100%" : "0 1 auto",
                          }}
                        >
                          {m.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {modello && (
                  <div style={{ marginBottom: 18 }}>
                    <Codice
                      modello={modello} isMobile={isMobile} evento={eventoId}
                      sottotitolo={`Questo codice lega il consenso a ${nomeFiera(evento) || "questa fiera"}: chi lo inquadra compare qui sotto. Si può anche stampare e appendere al banco.`}
                    />
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 18, marginBottom: 10 }}>
                  <div style={{ ...fontDisplay, fontSize: isMobile ? 16 : 18, fontWeight: 700, color: NAVY }}>
                    Hanno firmato a questa fiera
                  </div>
                  {firmati !== null && (
                    <div style={{ ...fontBody, fontSize: 12, color: GOLD, fontWeight: 700 }}>
                      {firmati.length} modell{firmati.length === 1 ? "a" : "e"}
                    </div>
                  )}
                  {/* La modella firma dal SUO telefono: questa pagina non
                      se ne accorge da sola, e chi sta al banco deve poter
                      chiedere «ha firmato?» senza riaprire tutto. */}
                  <button
                    type="button" onClick={rileggiFirmati}
                    style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "8px 13px", cursor: "pointer", minHeight: 40 }}
                  >
                    Aggiorna
                  </button>
                </div>

                {firmati !== null && firmati.length > 2 && (
                  <input
                    value={cerca} onChange={(e) => setCerca(e.target.value)}
                    placeholder="Cerca per nome, telefono, documento…"
                    className="suggerimento-chiaro"
                    style={{ ...inputStyle, minHeight: 44, width: "100%", marginBottom: 10 }}
                  />
                )}

                {firmati === null && (
                  <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "14px 0" }}>Sto leggendo…</div>
                )}
                {firmati !== null && firmati.length === 0 && (
                  <div style={{ ...fontBody, fontSize: 13, color: MUTED, ...scatola, lineHeight: 1.55 }}>
                    Nessuna modella ha ancora firmato a questa fiera.
                    <div style={{ marginTop: 6 }}>
                      Compaiono qui solo i consensi firmati inquadrando un codice di questa pagina. Quelli
                      firmati col codice generico stanno nell’archivio, dentro Gestione modelle.
                    </div>
                  </div>
                )}
                {/* il riepilogo dei «sì» sta sotto il nome senza aprire:
                    si scorre l'elenco e si vede su chi fermarsi */}
                {visibili.map((c) => <Riga key={c.id} c={c} isMobile={isMobile} riepilogoSempre />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
