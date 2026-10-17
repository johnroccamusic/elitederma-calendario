// LA PAGINA DEL RECESSO. Pubblica, si apre con ?recesso=<gettone>.
//
// Chi la apre non ha un account e non deve averne uno: recedere non puo'
// costare una registrazione. Il gettone e' il lasciapassare, come per il
// modulo, la master e le modelle.
//
// NON TOCCA LE TABELLE. Legge da `recesso_vista` e scrive passando dalla
// funzione `modulo-recesso`, che registra l'atto e manda le mail. Da qui
// non si puo' fare nient'altro che recedere dal proprio contratto.
//
// TRE SCHERMATE: il riepilogo con il tasto, la conferma con il motivo
// facoltativo, e l'esito. Piu' i casi in cui il tasto non c'e': termine
// scaduto, rinuncia al recesso gia' dichiarata, contratto non ancora
// firmato, recesso gia' registrato. In quei casi la pagina lo dice e da'
// i recapiti, invece di mostrare un tasto che non funziona.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { TASTO_RECEDI, TASTO_CONFERMA, TASTO_ANNULLA } from "./diciture.js";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Le date si scrivono per esteso e in italiano. Una data mancante non
// deve diventare "NaN": qui dentro una riga vuota sparisce, e basta.
function dataEstesa(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
function dataOra(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" });
}
const euro = (n) => `€ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

function Riquadro({ titolo, children, bordo = NAVY }) {
  return (
    <div style={{ ...areaSchedaIscritto, marginBottom: 14, borderLeft: `4px solid ${bordo}` }}>
      {titolo && <IntestazioneArea>{titolo}</IntestazioneArea>}
      {children}
    </div>
  );
}

function Riga({ etichetta, valore }) {
  if (!valore) return null;
  return (
    <div style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13, flexWrap: "wrap" }}>
      <span style={{ color: MUTED, flex: "0 0 128px" }}>{etichetta}</span>
      <span style={{ color: NAVY, fontWeight: 700, minWidth: 0 }}>{valore}</span>
    </div>
  );
}

export default function PaginaRecesso({ token }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [schermata, setSchermata] = useState("riepilogo");  // riepilogo | conferma | fatto
  const [motivo, setMotivo] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase.rpc("recesso_vista", { p_token: token }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setErrore(error.message); return; }
      if (!data) { setErrore("Questo link non è valido."); return; }
      setDati(data);
    });
    return () => { vivo = false; };
  }, [token]);

  const paragrafo = { fontSize: 13, color: GRAFITE, lineHeight: 1.65, margin: "8px 0" };
  const guscio = { ...fontBody, minHeight: "100vh", padding: "20px 14px 60px" };
  const dentro = { maxWidth: 560, margin: "0 auto" };

  if (errore) {
    return (
      <div style={guscio}><div style={dentro}>
        <Riquadro titolo="Link non valido" bordo="#B3261E">
          <p style={paragrafo}>{errore}</p>
          <p style={paragrafo}>Se ti serve aiuto scrivi a Elitederma Srl.</p>
        </Riquadro>
      </div></div>
    );
  }
  if (!dati) {
    return <div style={guscio}><div style={dentro}><p style={paragrafo}>Un attimo…</p></div></div>;
  }

  const corso = dati.corso || {};
  const periodo = corso.inizio
    ? (corso.fine && corso.fine !== corso.inizio
        ? `${dataEstesa(corso.inizio)} – ${dataEstesa(corso.fine)}`
        : dataEstesa(corso.inizio))
    : "";

  const riepilogoContratto = (
    <Riquadro titolo="Il tuo contratto">
      <Riga etichetta="Allievo/a" valore={dati.nome} />
      <Riga etichetta="Corso" valore={corso.nome} />
      <Riga etichetta="Date" valore={periodo} />
      <Riga etichetta="Città" valore={corso.citta} />
      <Riga etichetta="Sede" valore={corso.sede} />
      <Riga etichetta="Firmato il" valore={dataOra(dati.firmato_il)} />
    </Riquadro>
  );

  // ------------------------------------------------ il recesso non c'è
  if (!dati.disponibile && schermata !== "fatto") {
    const spiegazione = {
      scaduto: `Il termine per recedere era di ${dati.giorni_recesso} giorni dalla firma del contratto ed è scaduto il ${dataOra(dati.scadenza)}.`,
      rinuncia: "Al momento dell'iscrizione hai chiesto espressamente che Elitederma Srl avviasse subito l'organizzazione del corso, dichiarando di voler rinunciare al diritto di recesso: è la casella «Avvio immediato» del modulo, prevista dall'art. 59, lett. a) del Codice del Consumo e richiamata al Punto 3, lett. d) del regolamento.",
      non_firmato: "Questa iscrizione non risulta ancora completata con la firma del modulo, quindi non c'è un contratto da sciogliere.",
      gia_recesso: `Il recesso per questa iscrizione è già stato registrato il ${dataOra(dati.gia_recesso_il)}.`,
    }[dati.motivo] || "Il recesso non è disponibile per questa iscrizione.";

    return (
      <div style={guscio}><div style={dentro}>
        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
          Recesso dal contratto
        </div>
        {riepilogoContratto}
        <Riquadro titolo={dati.motivo === "gia_recesso" ? "Già registrato" : "Recesso non disponibile"} bordo={GOLD}>
          <p style={paragrafo}>{spiegazione}</p>
          <p style={{ ...paragrafo, marginTop: 14 }}>
            Per qualsiasi cosa puoi scrivere a Elitederma Srl{dati.pec ? <> — PEC <b style={{ color: NAVY }}>{dati.pec}</b></> : null}.
          </p>
        </Riquadro>
      </div></div>
    );
  }

  // ------------------------------------------------------------ fatto
  if (schermata === "fatto") {
    const voci = esito?.rimborso?.voci || [];
    return (
      <div style={guscio}><div style={dentro}>
        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
          Recesso registrato
        </div>
        <Riquadro titolo="È fatto" bordo="#2E7D32">
          <p style={paragrafo}>
            Abbiamo registrato il tuo recesso il <b style={{ color: NAVY }}>{dataOra(esito?.avvenuto_il)}</b>.
            Ti abbiamo mandato la ricevuta per email.
          </p>
          {Number(esito?.rimborso?.totale) > 0 && (
            <>
              <p style={paragrafo}>
                Ti rimborseremo <b style={{ color: NAVY }}>{euro(esito.rimborso.totale)}</b> entro 14 giorni.
              </p>
              {voci.map((v, i) => <Riga key={i} etichetta={v.voce} valore={euro(v.importo)} />)}
            </>
          )}
          {!Number(esito?.rimborso?.totale) && (
            <p style={paragrafo}>Non risultano somme versate da rimborsare.</p>
          )}
        </Riquadro>
        {riepilogoContratto}
      </div></div>
    );
  }

  // --------------------------------------------------------- conferma
  async function conferma() {
    setInCorso(true); setErrore("");
    const { data, error } = await supabase.functions.invoke("modulo-recesso", {
      body: { token, motivo },
    });
    setInCorso(false);
    const guasto = error ? (error.message || String(error)) : data?.errore;
    if (guasto || !data?.ok) { setErrore(guasto || "Non è stato possibile registrare il recesso."); return; }
    setEsito(data);
    setSchermata("fatto");
  }

  const tasto = {
    ...fontBody, width: "100%", minHeight: 52, borderRadius: 12, border: "none",
    fontSize: 15, fontWeight: 700, cursor: "pointer", background: NAVY, color: "#fff",
  };

  return (
    <div style={guscio}><div style={dentro}>
      <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
        Recesso dal contratto
      </div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>
        Puoi recedere entro {dati.giorni_recesso} giorni dalla firma, senza dare spiegazioni.
      </div>

      {riepilogoContratto}

      {schermata === "riepilogo" && (
        <>
          <Riquadro titolo="Fino a quando" bordo={GOLD}>
            <p style={paragrafo}>
              Hai tempo fino al <b style={{ color: NAVY }}>{dataOra(dati.scadenza)}</b>.
            </p>
            {Number(dati.rimborso?.totale) > 0 && (
              <p style={paragrafo}>
                Se recedi ti rimborseremo <b style={{ color: NAVY }}>{euro(dati.rimborso.totale)}</b> entro 14 giorni.
              </p>
            )}
          </Riquadro>
          <button type="button" style={tasto} onClick={() => setSchermata("conferma")}>
            {TASTO_RECEDI}
          </button>
        </>
      )}

      {schermata === "conferma" && (
        <>
          <Riquadro titolo="Conferma" bordo="#B3261E">
            <p style={paragrafo}>
              Stai per recedere dal contratto di iscrizione a <b style={{ color: NAVY }}>{corso.nome}</b>
              {periodo ? <> del {periodo}</> : null}. Il termine scade il <b style={{ color: NAVY }}>{dataOra(dati.scadenza)}</b>.
            </p>
            {Number(dati.rimborso?.totale) > 0 && (
              <p style={paragrafo}>
                Ti rimborseremo <b style={{ color: NAVY }}>{euro(dati.rimborso.totale)}</b> entro 14 giorni dalla comunicazione.
              </p>
            )}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}>
                Motivo (facoltativo — non sei tenuto/a a indicarlo)
              </div>
              <textarea
                value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                style={{
                  ...fontBody, width: "100%", boxSizing: "border-box", minWidth: 0, fontSize: 13,
                  borderRadius: 10, border: `1px solid ${CREAM_BORDER}`, padding: 10, resize: "vertical",
                }}
              />
            </div>
          </Riquadro>

          {errore && (
            <div style={{ border: "1px solid #B3261E", background: "#FDF1F0", borderRadius: 10,
                          padding: "10px 12px", marginBottom: 12, fontSize: 13, color: GRAFITE }}>
              {errore}
            </div>
          )}

          <button type="button" style={{ ...tasto, background: inCorso ? "#C9C2B4" : "#B3261E" }}
                  onClick={conferma} disabled={inCorso}>
            {inCorso ? "Registro…" : TASTO_CONFERMA}
          </button>
          <button type="button" disabled={inCorso}
                  onClick={() => { setSchermata("riepilogo"); setErrore(""); }}
                  style={{ ...tasto, background: "#fff", color: NAVY, border: `1px solid ${CREAM_BORDER}`, marginTop: 10 }}>
            {TASTO_ANNULLA}
          </button>
        </>
      )}
    </div></div>
  );
}
