// SETTING > MODULO DI ISCRIZIONE.
//
// E' il modulo di iscrizione del venditore, riprodotto tale e quale —
// stessi riquadri crema col bordo oro, stesse righe, stesse etichette —
// con accanto a ogni voce la spunta che dice se quel campo viene
// trasferito sul modulo che riceve l'allieva.
//
// NON E' UNA SOMIGLIANZA: i riquadri, i titoli e i campi sono gli stessi
// mattoni della scheda vera (src/ui/scheda.jsx). Se un giorno cambia un
// bordo o un colore nella scheda, cambia anche qui, da solo.
//
// Del modulo vecchio del sito resta solo quello che l'allieva deve
// leggere o fornire: regolamento, privacy, documento e firma.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea, RigaLettura } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { SEZIONI, CONSENSI, INTRO } from "./contenuto.js";
import { CAMPI_MODULO, PER_CHIAVE, SUOI } from "./campi-scheda.js";
import { leggiScelte, salvaScelta } from "./campi.js";

const REGOLAMENTO = SEZIONI.find((s) => s.tipo === "testo");

export default function ModuloIscrizione({ icone = {} }) {
  const [scelte, setScelte] = useState({});
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState("");
  const [chi, setChi] = useState("");
  const [regolamentoAperto, setRegolamentoAperto] = useState(false);

  useEffect(() => {
    let vivo = true;
    leggiScelte().then(({ scelte: s, errore: e }) => {
      if (!vivo) return;
      if (e) setErrore(e); else setScelte(s);
    });
    supabase.auth.getUser().then(({ data }) => { if (vivo) setChi(data?.user?.email || ""); });
    return () => { vivo = false; };
  }, []);

  // Una chiave senza riga nel database vale quello che dice il codice:
  // cosi' un campo aggiunto domani compare subito col suo stato, senza
  // che qualcuno debba andare a scriverlo a mano.
  function acceso(chiave) {
    const r = scelte[chiave];
    if (r) return r.incluso !== false;
    return PER_CHIAVE[chiave]?.predefinito !== false;
  }

  // Obbligatorio vuol dire: se il venditore l'ha lasciato vuoto, l'allieva
  // DEVE riempirlo o non puo' spedire. Non tutti i campi lo sopportano —
  // l'interno non ce l'hanno tutti, la PEC serve solo a chi fattura — e
  // per questo si decide campo per campo invece di dedurlo dal vuoto.
  function obbligatorio(chiave) {
    const r = scelte[chiave];
    return r ? r.obbligatorio !== false : true;
  }

  async function cambiaObbligo(chiave) {
    const valore = !obbligatorio(chiave);
    const prima = scelte[chiave];
    setScelte((s) => ({ ...s, [chiave]: { ...(prima || { chiave, incluso: true }), obbligatorio: valore } }));
    setSalvando(chiave);
    const e = await salvaScelta(chiave, { incluso: acceso(chiave), obbligatorio: valore }, chi);
    setSalvando("");
    if (e) { setErrore(e); setScelte((s) => ({ ...s, [chiave]: prima })); }
    else setErrore("");
  }

  async function cambia(chiave) {
    const valore = !acceso(chiave);
    const prima = scelte[chiave];
    setScelte((s) => ({ ...s, [chiave]: { chiave, incluso: valore } }));
    setSalvando(chiave);
    const e = await salvaScelta(chiave, { incluso: valore }, chi);
    setSalvando("");
    if (e) { setErrore(e); setScelte((s) => ({ ...s, [chiave]: prima })); }
    else setErrore("");
  }

  // L'etichetta del campo con la spunta attaccata: e' la "voce" e il suo
  // flag, uno accanto all'altra, come chiesto.
  function Etichetta({ chiave }) {
    const c = PER_CHIAVE[chiave];
    const on = acceso(chiave);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox" checked={on} disabled={salvando === chiave}
          onChange={() => cambia(chiave)}
          title={on ? "Va sul modulo dell'allieva" : "Non viene trasferito"}
          style={{ cursor: "pointer", margin: 0 }}
        />
        <span style={{ color: on ? undefined : MUTED, textDecoration: on ? "none" : "line-through" }}>
          {c?.etichetta || chiave}
        </span>
        {on && (
          <span
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); cambiaObbligo(chiave); }}
            title={obbligatorio(chiave)
              ? "Obbligatorio: se il venditore lo lascia vuoto, l'allieva deve riempirlo per poter spedire"
              : "Facoltativo: può restare vuoto e il modulo si spedisce lo stesso"}
            style={{
              cursor: "pointer", fontSize: 14, lineHeight: 1,
              color: obbligatorio(chiave) ? "#B3261E" : CREAM_BORDER,
              fontWeight: 700, userSelect: "none", paddingLeft: 2,
            }}
          >
            *
          </span>
        )}
      </span>
    );
  }

  // un campo del modulo: l'etichetta con la spunta, e sotto la casella
  // vuota com'e' sul modulo del venditore
  function Campo({ chiave, larghezza = "1 1 140px", minLabelHeight }) {
    return (
      <div style={{ flex: larghezza, minWidth: 0 }}>
        <Field label={<Etichetta chiave={chiave} />} minLabelHeight={minLabelHeight}>
          <input style={{ ...campoAreaScheda, background: acceso(chiave) ? "#fff" : "#F1EEE7" }} value="" disabled readOnly />
        </Field>
      </div>
    );
  }

  const pannello = { ...areaSchedaIscritto, marginBottom: 15 };
  const quantiAccesi = CAMPI_MODULO.filter((c) => acceso(c.chiave)).length;
  const quantiObbligatori = CAMPI_MODULO.filter((c) => acceso(c.chiave) && obbligatorio(c.chiave)).length;
  const I = icone;

  return (
    <div style={{ ...fontBody }}>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 15, fontSize: 12.5, color: GRAFITE, lineHeight: 1.5,
      }}>
        Questo è il modulo di iscrizione del venditore. <b style={{ color: NAVY }}>Spunta le voci che vuoi
        trasferire</b> sul modulo che riceve l'allieva: quelle spuntate le arriveranno già compilate.
        <div style={{ marginTop: 6, lineHeight: 1.5 }}>
          Quello che il venditore ha gia' scritto l'allieva lo legge e basta, non lo puo' cambiare.
          L'asterisco <b style={{ color: "#B3261E" }}>*</b> accanto a una voce vuol dire che, se il venditore
          la lascia vuota, lei deve riempirla per poter spedire: toccalo per renderla facoltativa.
        </div>
        <div style={{ marginTop: 6, fontWeight: 700, color: NAVY }}>
          {quantiAccesi} voci su {CAMPI_MODULO.length} vanno sul modulo · {quantiObbligatori} obbligatorie
        </div>
      </div>
      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 10 }}>Non riesco a salvare: {errore}</div>}

      <div style={pannello}>
        <IntestazioneArea Icona={I.persona}>Dati dell'allievo</IntestazioneArea>
        <RigaLettura><Campo chiave="nome" /><Campo chiave="cognome" /></RigaLettura>
        <RigaLettura>
          <Campo chiave="indirizzo_residenza" larghezza="1 1 200px" />
          <Campo chiave="civico_residenza" larghezza="0 1 90px" />
          <Campo chiave="interno_residenza" larghezza="0 1 90px" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="cap_residenza" larghezza="0 1 90px" />
          <Campo chiave="citta_residenza" larghezza="1 1 140px" />
          <Campo chiave="prov_residenza" larghezza="0 1 80px" />
          <Campo chiave="stato_residenza" larghezza="1 1 120px" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="email" larghezza="1 1 200px" />
          <Campo chiave="telefono" larghezza="1 1 150px" />
        </RigaLettura>
        <RigaLettura><Campo chiave="tutor" larghezza="1 1 180px" /></RigaLettura>
        <RigaLettura><Campo chiave="tipo_cliente" larghezza="1 1 100%" /></RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.ricevuta}>Dati di fatturazione</IntestazioneArea>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
          Compaiono solo scegliendo <b style={{ color: NAVY }}>Azienda</b>. A un privato non vengono nemmeno
          chiesti; a un'azienda servono tutti, o la fattura non si emette.
        </div>
        <RigaLettura><Campo chiave="fattura_ditta" larghezza="1 1 100%" /></RigaLettura>
        <RigaLettura>
          <Campo chiave="fattura_indirizzo" larghezza="1 1 200px" />
          <Campo chiave="fattura_civico" larghezza="0 1 110px" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="fattura_citta" larghezza="1 1 140px" />
          <Campo chiave="fattura_prov" larghezza="0 1 90px" />
          <Campo chiave="fattura_cap" larghezza="0 1 90px" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="fattura_piva" /><Campo chiave="fattura_cod_dest" /><Campo chiave="fattura_pec" />
        </RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.calendario}>Il corso</IntestazioneArea>
        <RigaLettura><Campo chiave="corso_nome" larghezza="1 1 100%" /></RigaLettura>
        <RigaLettura>
          <Campo chiave="corso_data_inizio" /><Campo chiave="corso_data_fine" /><Campo chiave="corso_master" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="corso_citta" larghezza="1 1 140px" />
          <Campo chiave="corso_indirizzo" larghezza="1 1 200px" />
        </RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.ricevuta}>Dati di vendita</IntestazioneArea>
        <RigaLettura>
          <Campo chiave="totale_pattuito" minLabelHeight={34} />
          <Campo chiave="quota_venditore" minLabelHeight={34} />
          <Campo chiave="quota_speciale" minLabelHeight={34} />
        </RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.scatola}>Pacchetto / Kit</IntestazioneArea>
        <RigaLettura><Campo chiave="pacchetto_kit" /><Campo chiave="tipo_offerta" /></RigaLettura>
        <RigaLettura><Campo chiave="dermografo" larghezza="1 1 100%" /></RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.calendario}>Presenza al corso</IntestazioneArea>
        <RigaLettura><Campo chiave="giorni_presenza" larghezza="1 1 100%" /></RigaLettura>
      </div>

      {[
        { chiave: "acconto", titolo: "Quota acconto", Icona: I.banconota },
        { chiave: "precorso", titolo: "Quota pre corso", Icona: I.clipboard },
      ].map((q) => (
        <div key={q.chiave} style={pannello}>
          <IntestazioneArea Icona={q.Icona}>{q.titolo}</IntestazioneArea>
          <RigaLettura>
            <Campo chiave={`${q.chiave}_imponibile`} larghezza="1 1 110px" />
            <Campo chiave={`${q.chiave}_totale`} larghezza="1 1 110px" />
          </RigaLettura>
          <RigaLettura>
            <Campo chiave={`${q.chiave}_pagato_il`} larghezza="1 1 120px" />
            <Campo chiave={`${q.chiave}_metodo`} larghezza="1 1 150px" />
            <Campo chiave={`${q.chiave}_pagato`} larghezza="1 1 150px" />
          </RigaLettura>
        </div>
      ))}

      <div style={pannello}>
        <IntestazioneArea Icona={I.portafoglio}>Da avere al corso</IntestazioneArea>
        <RigaLettura>
          <Campo chiave="saldo_imponibile" larghezza="1 1 110px" />
          <Campo chiave="saldo_totale" larghezza="1 1 110px" />
          <Campo chiave="saldo_metodo" larghezza="1 1 150px" />
        </RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.portafoglio}>Pagherà in totale</IntestazioneArea>
        <RigaLettura>
          <Campo chiave="totale_senza_iva" minLabelHeight={34} />
          <Campo chiave="totale_con_interessi" minLabelHeight={34} />
        </RigaLettura>
      </div>

      <div style={pannello}>
        <IntestazioneArea Icona={I.clipboard}>Dati organizzativi</IntestazioneArea>
        <RigaLettura><Campo chiave="accordi_commerciali" larghezza="1 1 100%" /></RigaLettura>
        <RigaLettura>
          <Campo chiave="richiede_modelle" larghezza="1 1 200px" minLabelHeight={34} />
          <Campo chiave="numero_modelle" larghezza="1 1 120px" minLabelHeight={34} />
          <Campo chiave="prezzo_speciale_modelle" larghezza="1 1 120px" minLabelHeight={34} />
        </RigaLettura>
        <RigaLettura><Campo chiave="taglia_divisa" larghezza="1 1 160px" /></RigaLettura>
        <RigaLettura><Campo chiave="note" larghezza="1 1 100%" /></RigaLettura>
      </div>

      {/* Quello che il venditore non ha e chiede l'allieva: resta dal
          modulo del sito, dove veniva gia' chiesto. */}
      <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
        <IntestazioneArea Icona={I.documento}>Lo compila l'allieva</IntestazioneArea>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
          Le uniche cose che in scheda non ci sono. Arrivano dal modulo del sito.
        </div>
        <RigaLettura>
          <Campo chiave="doc_tipo" /><Campo chiave="doc_numero" /><Campo chiave="codice_fiscale" />
        </RigaLettura>
        <RigaLettura>
          <Campo chiave="doc_fronte" /><Campo chiave="doc_retro" />
        </RigaLettura>
        <div style={{ fontSize: 12.5, color: GRAFITE, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
          <b style={{ color: NAVY }}>{CONSENSI.firmaEtichetta}</b> — sempre presente e non si toglie: senza firma
          il modulo non vale niente.
        </div>
      </div>

      <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
        <IntestazioneArea Icona={I.documento}>Regolamento, privacy e consensi</IntestazioneArea>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
          {REGOLAMENTO.blocchi.length} punti più l'informativa sul trattamento dei dati e l'autorizzazione alle
          immagini. Vanno sempre sul modulo.
        </div>
        <Button variant="ghost" onClick={() => setRegolamentoAperto((v) => !v)}>
          {regolamentoAperto ? "Chiudi il regolamento" : "Leggi il regolamento completo"}
        </Button>
        {regolamentoAperto && (
          <div style={{ marginTop: 12, maxHeight: 420, overflowY: "auto", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{INTRO.titolo}</div>
            {REGOLAMENTO.blocchi.map((b) => (
              <div key={b.titolo} style={{ marginBottom: 16 }}>
                <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{b.titolo}</div>
                {b.punti.map((p, i) => <p key={i} style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "8px 0" }}>{p}</p>)}
              </div>
            ))}
            <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, margin: "18px 0 6px" }}>{CONSENSI.informativaEtichetta}</div>
            {CONSENSI.informativaTesto.map((p, i) => <p key={i} style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "8px 0" }}>{p}</p>)}
            <p style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "14px 0 0", whiteSpace: "pre-line" }}>{CONSENSI.immaginiTesto}</p>
          </div>
        )}
      </div>
    </div>
  );
}
