// SETTING > MODULO DI ISCRIZIONE.
//
// E' una pagina intera, non una finestra sospesa. Era un modale, e per
// un modulo lungo quasi due schermi non andava: si leggeva dentro un
// riquadro che galleggiava sopra la pagina sotto, con due barre di
// scorrimento una dentro l'altra. Qui invece si scorre come si scorre
// una pagina.
//
// Tre linguette:
//   I campi      quali voci della scheda vanno sul modulo dell'allieva
//   Il contratto regolamento, privacy e consensi, da leggere e correggere
//   La mail      il testo che accompagna il modulo quando glielo si manda
//
// La mail sta QUI e non in Setting > Modelli email, dove pure si
// potrebbe scrivere: chi prepara il modulo pensa al modulo, e la lettera
// che lo accompagna e' parte di quello. Andarla a cercare in un'altra
// pagina voleva dire dimenticarsela.
//
// Si decide qui, una volta per tutti, quali campi della scheda di
// iscrizione finiscono sul modulo che riceve l'allieva.
//
// NON E' UNA COPIA DELLA SCHEDA: i due riquadri in alto — "Dati
// dell'allievo" e "Dati di fatturazione" — sono lo STESSO componente che
// disegna la scheda vera (AreaAnagrafica, su src/iscrizione/disposizione.js),
// montato con `configurazione` acceso. Non c'e' un secondo disegno da
// tenere allineato: se domani cambia un campo, una larghezza o un
// colore nella scheda, qui cambia da solo.
//
// La versione precedente di questo file era invece una riproduzione
// scritta a mano, e si era disallineata dalla scheda in tre punti.
//
// COME SI LEGGE. Ogni campo ha nell'angolo una spunta: accesa, il campo
// parte sul modulo dell'allieva. L'asterisco accanto dice se, lasciato
// vuoto dal venditore, lei DEVE riempirlo per poter spedire. I campi
// esclusi non si nascondono: restano al loro posto, smorzati, cosi' la
// scheda si legge sempre per intera.
//
// LE AGGIUNTE IN FONDO sono le tre cose che sul modulo dell'allieva
// servono e nella scheda del venditore non esistono: il documento che
// carica lei, la firma, e i testi di regolamento e privacy. Stanno
// sotto, in un blocco a parte, perche' non appartengono alla scheda.
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea, RigaLettura } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { CAMPI_MODULO, PER_CHIAVE, SUOI } from "./campi-scheda.js";
import { leggiScelte, salvaScelta } from "./campi.js";
import { AreaAnagrafica } from "./AreeAnagrafiche.jsx";
import { AREA_ALLIEVO, AREA_FATTURAZIONE, CHIAVI_ANAGRAFICHE, GRUPPI_LETTURA as DA_TRASFERIRE } from "./disposizione.js";
import TestoContratto from "./TestoContratto.jsx";
import ImpostazioniRecesso from "../recesso/Impostazioni.jsx";
import { ElencoRecessi } from "../recesso/Riquadro.jsx";
import ModelliEmail from "../email/ModelliEmail.jsx";
import { componiMailModulo, linkModulo } from "../iscrizioni/invio.js";
import { valoriCorso } from "../../supabase/functions/_shared/email.js";

// L'ANTEPRIMA DELLA MAIL, con la stessa funzione che la compone quando
// parte per davvero: se fossero due scritture, un giorno l'anteprima
// mostrerebbe una mail e l'allieva ne riceverebbe un'altra.
//
// Il link e' quello vero dell'iscritta scelta nell'anteprima, cosi' si
// vede quanto e' lungo in mezzo al testo — che e' la cosa che si sbaglia
// a immaginare scrivendo.
function anteprimaMailModulo({ nome, corso, corsoData, loc, token, societa, modello }) {
  // due cose, non una: vedi la nota in invio.js
  const { valori, righe } = valoriCorso({
    nome,
    nomeCorso: corso?.nome,
    dataInizio: corsoData?.data_inizio,
    dataFine: corsoData?.data_fine,
    citta: corsoData?.citta || loc?.citta || loc?.nome,
    sede: loc?.nome_sede,
    indirizzo: corsoData?.indirizzo || loc?.indirizzo,
  });
  return componiMailModulo({ valori, righe, link: linkModulo(token || "IL-GETTONE-DI-QUESTA-ISCRIZIONE"), modello, societa });
}


export default function ModuloIscrizione({ icone = {}, amministratore = true, onBack, titolo = "Modulo di iscrizione" }) {
  const [linguetta, setLinguetta] = useState("campi");
  const [scelte, setScelte] = useState({});
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState("");
  const [chi, setChi] = useState("");

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

  async function scrivi(chiave, campi, ripristino) {
    setSalvando(chiave);
    const e = await salvaScelta(chiave, campi, chi);
    setSalvando("");
    if (e) { setErrore(e); setScelte((s) => ({ ...s, [chiave]: ripristino })); }
    else setErrore("");
  }

  async function cambia(chiave) {
    if (!amministratore) return;
    const valore = !acceso(chiave);
    const prima = scelte[chiave];
    setScelte((s) => ({ ...s, [chiave]: { ...(prima || { chiave }), incluso: valore } }));
    await scrivi(chiave, { incluso: valore, obbligatorio: obbligatorio(chiave) }, prima);
  }

  async function cambiaObbligo(chiave) {
    if (!amministratore) return;
    const valore = !obbligatorio(chiave);
    const prima = scelte[chiave];
    setScelte((s) => ({ ...s, [chiave]: { ...(prima || { chiave, incluso: true }), obbligatorio: valore } }));
    await scrivi(chiave, { incluso: acceso(chiave), obbligatorio: valore }, prima);
  }

  // LA SENTINELLA. Un campo dichiarato in campi-scheda.js che nessun
  // riquadro disegna sarebbe invisibile: la sua spunta non esisterebbe e
  // nessuno saprebbe che c'e'. E uno disegnato ma non dichiarato non
  // avrebbe un valore predefinito. Il controllo e' sui due elenchi, e
  // quello che non torna si vede in pagina.
  const disallineati = useMemo(() => {
    const disegnate = new Set([...CHIAVI_ANAGRAFICHE, ...DA_TRASFERIRE.flatMap((b) => b.chiavi), ...SUOI]);
    const dichiarate = new Set(CAMPI_MODULO.map((c) => c.chiave));
    return {
      senzaSpunta: [...dichiarate].filter((k) => !disegnate.has(k)),
      senzaScheda: [...disegnate].filter((k) => !dichiarate.has(k)),
    };
  }, []);

  // la spunta per i riquadri di sola lettura, dove non c'e' una casella
  // su cui appoggiarla: qui sta attaccata all'etichetta
  function Etichetta({ chiave }) {
    const on = acceso(chiave);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <input
          type="checkbox" checked={on} disabled={salvando === chiave || !amministratore}
          onChange={() => cambia(chiave)}
          title={on ? "Va sul modulo dell'allieva" : "Non viene trasferito"}
          style={{ width: 13, height: 13, margin: 0, cursor: "pointer", accentColor: NAVY }}
        />
        <span style={{ color: on ? undefined : MUTED }}>{PER_CHIAVE[chiave]?.etichetta || chiave}</span>
        <span
          onClick={() => on && cambiaObbligo(chiave)}
          title={!on ? "Il campo non va sul modulo" : obbligatorio(chiave)
            ? "Obbligatorio: se il venditore lo lascia vuoto, l'allieva deve riempirlo per poter spedire"
            : "Facoltativo: può restare vuoto e il modulo si spedisce lo stesso"}
          style={{
            cursor: on ? "pointer" : "default", fontSize: 13, lineHeight: 1, fontWeight: 700,
            color: !on ? CREAM_BORDER : obbligatorio(chiave) ? "#B3261E" : MUTED,
            userSelect: "none", width: 8, textAlign: "center",
          }}
        >
          *
        </span>
      </span>
    );
  }

  function CampoSpento({ chiave, larghezza = "1 1 140px" }) {
    const on = acceso(chiave);
    return (
      <div style={{ flex: larghezza, minWidth: 0, ...(on ? null : { opacity: 0.45 }) }}>
        <Field label={<Etichetta chiave={chiave} />}>
          <input style={{ ...campoAreaScheda, background: "#F1EEE7" }} value="" disabled readOnly />
        </Field>
      </div>
    );
  }

  const pannello = { ...areaSchedaIscritto, marginBottom: 15 };
  const quantiAccesi = CAMPI_MODULO.filter((c) => acceso(c.chiave)).length;
  const quantiObbligatori = CAMPI_MODULO.filter((c) => acceso(c.chiave) && obbligatorio(c.chiave)).length;
  const I = icone;

  const comuni = {
    configurazione: true,
    acceso, obbligatorio,
    onCambiaIncluso: cambia, onCambiaObbligo: cambiaObbligo,
    inAttesa: salvando,
    modificabile: amministratore,
    stileArea: pannello,
  };

  const LINGUETTE = [
    { chiave: "campi", etichetta: "I campi del modulo" },
    { chiave: "contratto", etichetta: "Il contratto" },
    { chiave: "mail", etichetta: "La mail che lo accompagna" },
    { chiave: "recesso", etichetta: "Il recesso" },
  ];

  return (
    <div style={{ background: "transparent", minHeight: "100vh", ...fontBody }}>
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <TastoLivelloPrecedente titolo="Setting" onClick={onBack} />
        <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {LINGUETTE.map((l) => {
          const qui = linguetta === l.chiave;
          return (
            <button
              key={l.chiave} type="button" onClick={() => setLinguetta(l.chiave)}
              style={{
                ...fontBody, fontSize: 13, fontWeight: 700, padding: "9px 16px",
                borderRadius: 10, cursor: "pointer",
                background: qui ? NAVY : "#fff", color: qui ? "#fff" : NAVY,
                border: `1px solid ${qui ? NAVY : CREAM_BORDER}`,
              }}
            >
              {l.etichetta}
            </button>
          );
        })}
      </div>

      {linguetta === "recesso" && (
        <>
          <ImpostazioniRecesso Icona={I.documento} amministratore={amministratore} />
          {/* l'elenco sta qui, sotto gli indirizzi, perche' e' lo stesso
              argomento e non serve una pagina nuova per una lista che —
              se tutto va bene — resta quasi sempre vuota */}
          <ElencoRecessi />
        </>
      )}

      {linguetta === "contratto" && (
        <TestoContratto Icona={I.documento} amministratore={amministratore} />
      )}

      {/* E' lo stesso editor di Setting > Modelli email, bloccato sul
          modello "invio_modulo": una seconda schermata che scrive nella
          stessa riga sarebbe il modo di avere due testi diversi con lo
          stesso nome. */}
      {linguetta === "mail" && (
        <>
          <div style={{
            border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
            padding: "10px 12px", marginBottom: 15, fontSize: 12.5, color: GRAFITE, lineHeight: 1.55,
          }}>
            È la lettera che l'allieva riceve <b style={{ color: NAVY }}>insieme al link del modulo</b>, quando
            si preme «Invia modulo» sulla sua scheda.
            <div style={{ marginTop: 6 }}>
              Il segnaposto <b style={{ color: NAVY }}>{"{link}"}</b> è l'indirizzo del modulo. Mettilo dove
              vuoi: se te ne dimentichi viene aggiunto in fondo lo stesso — una mail che dice «compila qui»
              senza dire dove non servirebbe a niente.
            </div>
            <div style={{ marginTop: 6, color: MUTED }}>
              Finché non scrivi niente parte il testo di serie, quello scritto nel codice.
            </div>
          </div>
          <ModelliEmail soloChiave="invio_modulo" componi={anteprimaMailModulo} />
        </>
      )}

      {linguetta === "campi" && <>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 15, fontSize: 12.5, color: GRAFITE, lineHeight: 1.5,
      }}>
        Questa è la scheda di iscrizione del venditore, quella vera.
        <b style={{ color: NAVY }}> Spunta le voci che vuoi trasferire</b> sul modulo che riceve l'allieva:
        quelle spuntate le arriveranno già compilate, e lei le legge senza poterle cambiare.
        <div style={{ marginTop: 6, lineHeight: 1.5 }}>
          L'asterisco <b style={{ color: "#B3261E" }}>*</b> accanto a una voce vuol dire che, se il venditore
          la lascia vuota, lei deve riempirla per poter spedire: toccalo per renderla facoltativa.
          Le voci spente restano al loro posto, smorzate.
        </div>
        <div style={{ marginTop: 6, fontWeight: 700, color: NAVY }}>
          {quantiAccesi} voci su {CAMPI_MODULO.length} vanno sul modulo · {quantiObbligatori} obbligatorie
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
          La scelta è una sola per tutta l'accademia: vale per ogni corso e per ogni venditore.
        </div>
      </div>

      {!amministratore && (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, background: "#F7F4EC", borderRadius: 10, padding: "9px 12px", marginBottom: 15, fontSize: 12.5, color: GRAFITE }}>
          Sola lettura: le spunte le cambia chi amministra.
        </div>
      )}
      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 10 }}>Non riesco a salvare: {errore}</div>}
      {(disallineati.senzaSpunta.length > 0 || disallineati.senzaScheda.length > 0) && (
        <div style={{ border: "1px solid #B3261E", background: "#FDF1F0", borderRadius: 10, padding: "9px 12px", marginBottom: 15, fontSize: 12.5, color: GRAFITE }}>
          <b style={{ color: "#B3261E" }}>Qualcosa non torna fra l'elenco dei campi e i riquadri disegnati.</b>
          {disallineati.senzaSpunta.length > 0 && <div style={{ marginTop: 4 }}>Dichiarati ma non disegnati (nessuno può spuntarli): {disallineati.senzaSpunta.join(", ")}</div>}
          {disallineati.senzaScheda.length > 0 && <div style={{ marginTop: 4 }}>Disegnati ma non dichiarati (senza stato predefinito): {disallineati.senzaScheda.join(", ")}</div>}
        </div>
      )}

      {/* I DUE RIQUADRI VERI: lo stesso componente della scheda */}
      <AreaAnagrafica area={AREA_ALLIEVO} icona={I.persona} {...comuni} />
      <div style={{ fontSize: 12, color: MUTED, margin: "-8px 0 10px", lineHeight: 1.5, paddingLeft: 2 }}>
        I dati di fatturazione qui sotto compaiono sulla scheda — e sul modulo — solo scegliendo
        <b style={{ color: NAVY }}> Azienda</b>. A un privato non vengono nemmeno chiesti; a un'azienda
        servono tutti, o la fattura non si emette.
      </div>
      <AreaAnagrafica area={AREA_FATTURAZIONE} icona={I.ricevuta} {...comuni} />

      {/* IL RESTO DELLA SCHEDA: l'allieva lo legge, non lo compila */}
      {DA_TRASFERIRE.map((b) => (
        <div key={b.titolo} style={pannello}>
          <IntestazioneArea Icona={I[b.icona]}>{b.titolo}</IntestazioneArea>
          <RigaLettura>
            {b.chiavi.map((k) => <CampoSpento key={k} chiave={k} />)}
          </RigaLettura>
        </div>
      ))}

      {/* LE AGGIUNTE: sul modulo dell'allieva servono, nella scheda del
          venditore non esistono. Per questo stanno qui sotto e non in
          mezzo ai riquadri della scheda. */}
      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, margin: "26px 0 12px" }}>
        Aggiunte per il modulo dell'allieva
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
        Le tre cose che nella scheda del venditore non ci sono: quello che carica lei, la firma, e i testi
        da leggere. Arrivano dal modulo che era sul sito.
      </div>

      <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
        <IntestazioneArea Icona={I.documento}>Lo compila l'allieva</IntestazioneArea>
        <RigaLettura>
          {SUOI.map((k) => <CampoSpento key={k} chiave={k} />)}
        </RigaLettura>
      </div>

      <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
        <IntestazioneArea Icona={I.documento}>Firma</IntestazioneArea>
        <div style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.5 }}>
          <b style={{ color: NAVY }}>La firma dell'allieva</b> — sempre presente e non si toglie: senza firma
          il modulo non vale niente. Per questo non ha una spunta. Come si chiama sul modulo si cambia
          dalla linguetta <b style={{ color: NAVY }}>Il contratto</b>.
        </div>
      </div>

      {/* il regolamento non sta piu' qui: ha una linguetta sua, dove si
          legge per intero e si corregge */}
      <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
        <IntestazioneArea Icona={I.documento}>Regolamento, privacy e consensi</IntestazioneArea>
        {/* niente numero di punti: da quando il regolamento si corregge
            dall'app, un conteggio scritto qui diventerebbe falso al primo
            punto aggiunto, e nessuno andrebbe a cercarlo */}
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
          Il regolamento di partecipazione, l'informativa sul trattamento dei dati e l'autorizzazione alle
          immagini. Vanno sempre sul modulo, e nemmeno questi hanno una spunta.
        </div>
        <Button variant="ghost" onClick={() => setLinguetta("contratto")}>Leggi e correggi il contratto</Button>
      </div>
      </>}
    </div>
    </div>
  );
}
