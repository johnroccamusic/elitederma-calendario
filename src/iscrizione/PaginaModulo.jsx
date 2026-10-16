// IL MODULO CHE APRE L'ALLIEVA: ?modulo=<gettone>
//
// Chi arriva qui non ha e non avra' mai un account. Apre il link, legge,
// compila quello che manca, firma e invia.
//
// NON TOCCA LE TABELLE. Tutto passa da `modulo_vista`, una funzione
// `security definer` che prende il gettone e torna solo questa
// iscrizione. In `iscritti` ci sono anagrafiche, residenze, pagamenti e
// allegati di tutti gli allievi: una pagina pubblica che ci arriva
// direttamente vorrebbe dire che chiunque abbia la chiave del bundle li
// legge tutti. E' lo stesso motivo per cui esiste `master_vista`.
//
// QUESTA E' LA PRIMA TAPPA: si vede e non si scrive. Serve a guardare il
// modulo come lo vedra' lei — coi dati del venditore gia' dentro e i
// suoi campi vuoti — prima di renderlo scrivibile. La compilazione, il
// documento e la firma arrivano dopo.
//
// COSA SI LEGGE DA DOVE. I valori, l'ordine e le etichette non vengono
// inventati qui: l'ordine e le larghezze stanno in disposizione.js — gli
// stessi che disegnano la scheda del venditore — e le etichette in
// campi-scheda.js. Il testo del contratto arriva dalla funzione insieme
// al resto, perche' la tabella dei testi e' riservata a chi ha fatto
// accesso e lei non ce l'ha: senza questo firmerebbe la versione del
// codice mentre in ufficio se ne legge un'altra.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { AREA_ALLIEVO, AREA_FATTURAZIONE, GRUPPI_LETTURA } from "./disposizione.js";
import { PER_CHIAVE, SUOI } from "./campi-scheda.js";
import { DAL_CODICE } from "./testi.js";

const giorno = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("it-IT",
      { timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
};

const etichettaDi = (chiave) => PER_CHIAVE[chiave]?.etichetta || chiave;

/** Una schermata intera con un messaggio solo: link sbagliato, scaduto, errore. */
function Avviso({ titolo, testo }) {
  return (
    <div style={{ ...fontBody, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{titolo}</div>
        <div style={{ fontSize: 13.5, color: GRAFITE, lineHeight: 1.65 }}>{testo}</div>
      </div>
    </div>
  );
}

/** Un dato che il venditore ha gia' scritto: si legge, non si tocca. */
function Letto({ etichetta, valore }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 0, marginBottom: 12 }}>
      <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {etichetta}
      </div>
      <div style={{ ...fontBody, fontSize: 14, color: NAVY, fontWeight: 600, wordBreak: "break-word" }}>
        {valore || "—"}
      </div>
    </div>
  );
}

/** Un campo che tocca a lei. Per ora spento: questa tappa non scrive. */
function DaRiempire({ etichetta, obbligatorio, larghezza = "1 1 180px" }) {
  return (
    <div style={{ flex: larghezza, minWidth: 0, marginBottom: 12 }}>
      <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {etichetta}{obbligatorio && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      </div>
      <input
        disabled readOnly value=""
        placeholder="lo compili tu"
        style={{
          ...fontBody, width: "100%", boxSizing: "border-box", minWidth: 0,
          padding: "10px 11px", fontSize: 14, borderRadius: 8,
          border: `1px dashed ${GOLD}`, background: "#FFFDF8", color: NAVY,
        }}
      />
    </div>
  );
}

export default function PaginaModulo({ token }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    supabase.rpc("modulo_vista", { p_token: token }).then(({ data, error }) => {
      if (!vivo) return;
      setCaricando(false);
      if (error) { setErrore(error.message); return; }
      setDati(data || null);
    });
    return () => { vivo = false; };
  }, [token]);

  if (caricando) return <Avviso titolo="Un momento" testo="Sto aprendo il tuo modulo." />;
  if (errore) return <Avviso titolo="Qualcosa non ha funzionato" testo={`Riprova fra poco. Se continua, scrivici. (${errore})`} />;
  if (!dati) {
    return <Avviso
      titolo="Questo link non è valido"
      testo="Può essere scaduto, oppure copiato male. Chiedi all'accademia di rimandartelo." />;
  }
  if (dati.scaduto) {
    return <Avviso
      titolo="Iscrizione già confermata"
      testo={`${dati.nome}, la tua iscrizione a ${dati.corso?.nome || "questo corso"} è già completa: non serve più compilare niente. A presto!`} />;
  }

  const perChiave = Object.fromEntries((dati.campi || []).map((c) => [c.chiave, c]));
  const c = (k) => perChiave[k];
  const testi = {
    intro:       dati.contratto?.intro       || DAL_CODICE.intro,
    regolamento: dati.contratto?.regolamento || DAL_CODICE.regolamento,
    consensi:    dati.contratto?.consensi    || DAL_CODICE.consensi,
  };

  // una riga di campi: chi ha gia' un valore si legge, gli altri sono suoi
  const Riga = ({ campi }) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {campi.map((campo) => {
        const d = c(campo.chiave);
        if (!d) return null;   // spento in Setting: non esiste su questo modulo
        return d.bloccato
          ? <Letto key={campo.chiave} etichetta={campo.etichetta || etichettaDi(campo.chiave)} valore={d.valore} />
          : <DaRiempire key={campo.chiave} etichetta={campo.etichetta || etichettaDi(campo.chiave)}
                        obbligatorio={d.obbligatorio} larghezza={campo.larghezza || "1 1 180px"} />;
      })}
    </div>
  );

  const pannello = { ...areaSchedaIscritto, marginBottom: 14 };
  const paragrafo = { fontSize: 12.5, color: GRAFITE, lineHeight: 1.65, margin: "8px 0" };
  const quantiSuoi = (dati.campi || []).filter((x) => !x.bloccato && x.obbligatorio).length;

  return (
    <div style={{ ...fontBody, minHeight: "100vh", padding: "20px 14px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.35, marginBottom: 6 }}>
          {testi.intro.titolo}
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>
          {testi.intro.sottotitolo}
        </div>

        {/* l'avviso che questa e' un'anteprima: sparira' alla prossima tappa */}
        <div style={{ border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
                      padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: GRAFITE, lineHeight: 1.55 }}>
          <b style={{ color: NAVY }}>Anteprima.</b> Il modulo si vede ma non si compila ancora: i campi con il bordo
          tratteggiato sono quelli che toccheranno a te, e sono <b style={{ color: NAVY }}>{quantiSuoi}</b> obbligatori.
        </div>

        <div style={pannello}>
          <IntestazioneArea>Il tuo corso</IntestazioneArea>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Letto etichetta="Corso" valore={dati.corso?.nome} />
            <Letto etichetta="Dal" valore={giorno(dati.corso?.inizio)} />
            <Letto etichetta="Al" valore={giorno(dati.corso?.fine)} />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Letto etichetta="Città" valore={dati.corso?.citta} />
            <Letto etichetta="Dove" valore={[dati.corso?.sede, dati.corso?.indirizzo].filter(Boolean).join(" — ")} />
          </div>
        </div>

        <div style={pannello}>
          <IntestazioneArea>I tuoi dati</IntestazioneArea>
          {AREA_ALLIEVO.righe.map((r, i) => <Riga key={i} campi={r.campi} />)}
        </div>

        {(c("fattura_ditta") || c("fattura_piva")) && (
          <div style={pannello}>
            <IntestazioneArea>Dati per la fattura</IntestazioneArea>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
              Servono solo se l'intestazione è <b style={{ color: NAVY }}>Azienda</b>.
            </div>
            {AREA_FATTURAZIONE.righe.map((r, i) => <Riga key={i} campi={r.campi} />)}
          </div>
        )}

        <div style={pannello}>
          <IntestazioneArea>Il tuo documento</IntestazioneArea>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
            Le foto del documento restano riservate: non sono visibili da nessun indirizzo pubblico.
          </div>
          <Riga campi={SUOI.map((k) => ({ chiave: k }))} />
        </div>

        {/* "Il corso" salta: quei campi sono gia' il riquadro in cima,
            scritti per esteso. Ripeterli piu' sotto in una riga di
            etichette voleva dire dire due volte la stessa cosa nella
            stessa pagina. */}
        {GRUPPI_LETTURA.filter((g) => g.titolo !== "Il corso").map((g) => {
          const presenti = g.chiavi.filter((k) => c(k));
          if (!presenti.length) return null;
          return (
            <div key={g.titolo} style={pannello}>
              <IntestazioneArea>{g.titolo}</IntestazioneArea>
              <Riga campi={presenti.map((k) => ({ chiave: k }))} />
            </div>
          );
        })}

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.regolamento.titolo || "Regolamento di partecipazione"}</IntestazioneArea>
          {(testi.regolamento.blocchi || []).map((b, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{b.titolo}</div>
              {(b.punti || []).map((p, j) => <p key={j} style={paragrafo}>{p}</p>)}
            </div>
          ))}
        </div>

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.consensi.informativaEtichetta}</IntestazioneArea>
          {(testi.consensi.informativaTesto || []).map((p, i) => <p key={i} style={paragrafo}>{p}</p>)}
          <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, margin: "18px 0 4px" }}>
            Autorizzazione alle immagini
          </div>
          <p style={{ ...paragrafo, whiteSpace: "pre-line" }}>{testi.consensi.immaginiTesto}</p>
        </div>

        <div style={{ textAlign: "center", padding: "20px 0 0", borderTop: `1px solid ${CREAM_BORDER}`,
                      fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {testi.consensi.notaObbligatori}
          <div style={{ marginTop: 10, fontWeight: 700, color: NAVY }}>
            La firma e l'invio arrivano alla prossima tappa.
          </div>
        </div>
      </div>
    </div>
  );
}
