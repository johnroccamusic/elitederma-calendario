// IL MODULO CHE APRE L'ALLIEVA: ?modulo=<gettone>
//
// Chi arriva qui non ha e non avra' mai un account. Apre il link, legge,
// compila quello che manca, firma col dito e invia.
//
// NON TOCCA LE TABELLE. Tutto passa da `modulo_vista` e `modulo_salva`,
// due funzioni `security definer` che prendono il gettone e lavorano su
// quella sola iscrizione. In `iscritti` ci sono anagrafiche, residenze,
// pagamenti e allegati di tutti gli allievi: una pagina pubblica che ci
// arriva direttamente vorrebbe dire che chiunque abbia la chiave del
// bundle li legge tutti.
//
// CHI PUO' SCRIVERE COSA
//   - quello che ha scritto il venditore si legge e basta: il prezzo e
//     il pacchetto devono arrivare in fondo come sono partiti;
//   - i riquadri commerciali (vendita, kit, presenza, quote, dati
//     organizzativi) sono di sola lettura PER INTERO, anche quando un
//     campo e' vuoto: non sono cose che decide lei;
//   - Privato/Azienda invece e' sempre sua, e i dati di fatturazione si
//     sbloccano solo se sceglie Azienda.
// L'elenco di cosa si puo' scrivere davvero non sta qui ma dentro
// `modulo_salva`: questa pagina e' comodita', quella e' la serratura.
//
// IL DOCUMENTO non va in un secchio pubblico: sale su `moduli-iscrizione`,
// privato, dove l'allieva puo' solo caricare e non rileggere.
//
// LA FOTO: niente `capture`. Con quell'attributo il telefono apre dritto
// la fotocamera e non lascia scegliere; senza, iPhone e Android offrono
// galleria, fotocamera e file. E si accettano anche i PDF, perche' da
// computer un documento scansionato e' quasi sempre un PDF.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import FirmaDito from "../ui/FirmaDito.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { AREA_ALLIEVO, AREA_FATTURAZIONE, GRUPPI_LETTURA } from "./disposizione.js";
import { PER_CHIAVE, SUOI } from "./campi-scheda.js";
import { DAL_CODICE } from "./testi.js";
import { serveAvvioImmediato } from "./regole-recesso.js";

const etichettaDi = (k) => PER_CHIAVE[k]?.etichetta || k;

// UN VALORE C'E' O NON C'E'.
//
// Serve a non mandare all'allieva righe vuote: "Presenza al corso —",
// "Quante modelle —". Su un modulo che si firma un trattino non e'
// un'informazione, e' una riga che non doveva partire.
//
// Attenzione: `false` E' una risposta ("non richiede modelle"), e lo
// zero pure. Vuoto e' solo null, undefined o una stringa di spazi.
const pieno = (v) => v != null && String(v).trim() !== "";

const giorno = (iso) => {
  if (!iso) return "";
  try {
    return new Date(String(iso).slice(0, 10) + "T00:00:00")
      .toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
};

// COME SI LEGGE UN VALORE.
//
// Dal database arriva tutto come testo: un sì diventa "false", un importo
// diventa "152.5". Scritti cosi' su un modulo che qualcuno firma sembrano
// un errore dell'app, e in parte lo sono.
function mostra(chiave, valore) {
  if (valore == null || valore === "") return "—";
  const t = String(valore);
  if (t === "true")  return "Sì";
  if (t === "false") return "No";
  if (chiave === "tipo_cliente") return t === "azienda" ? "Azienda" : "Privato";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return giorno(t);
  if (/(totale|imponibile|prezzo|quota|pattuito)/.test(chiave)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  return t;
}

function Avviso({ titolo, testo, buono = false }) {
  return (
    <div style={{ ...fontBody, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: buono ? "#2E7D32" : NAVY, marginBottom: 10 }}>{titolo}</div>
        <div style={{ fontSize: 13.5, color: GRAFITE, lineHeight: 1.65 }}>{testo}</div>
      </div>
    </div>
  );
}

const etichettaStile = { ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 };

/** Un dato gia' scritto: si legge, non si tocca. */
function Letto({ etichetta, valore, larghezza = "1 1 180px" }) {
  return (
    <div style={{ flex: larghezza, minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>{etichetta}</div>
      <div style={{ ...fontBody, fontSize: 14, color: NAVY, fontWeight: 600, wordBreak: "break-word" }}>{valore}</div>
    </div>
  );
}

/** Un campo che compila lei: casella, oppure tendina se ha un elenco. */
function DaRiempire({ campo, valore, onCambia, obbligatorio, spento = false }) {
  const { chiave, maiuscolo, lunghezza, suggerimento, tipo } = campo;
  // un elenco chiuso si sceglie, non si scrive: cosi' "patente",
  // "Patente" e "pat." non diventano tre cose diverse in archivio
  const opzioni = campo.opzioni || PER_CHIAVE[chiave]?.opzioni || null;
  const stileComune = {
    ...fontBody, width: "100%", boxSizing: "border-box", minWidth: 0,
    padding: "11px 11px", fontSize: 16, borderRadius: 8, minHeight: 44,
    border: `1px ${spento ? "solid" : "dashed"} ${spento ? CREAM_BORDER : GOLD}`,
    background: spento ? "#F3F0E9" : "#FFFDF8", color: NAVY,
  };
  return (
    <div style={{ flex: campo.larghezza || "1 1 180px", minWidth: 0, marginBottom: 12, ...(spento ? { opacity: 0.45 } : null) }}>
      <div style={etichettaStile}>
        {campo.etichetta || etichettaDi(chiave)}
        {obbligatorio && !spento && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      </div>
      {opzioni ? (
        <select
          value={valore || ""} disabled={spento}
          onChange={(e) => onCambia(chiave, e.target.value)}
          style={stileComune}
        >
          <option value="">— scegli —</option>
          {opzioni.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
      <input
        value={valore || ""} disabled={spento}
        maxLength={lunghezza}
        placeholder={spento ? "" : (suggerimento || "")}
        inputMode={tipo === "telefono" ? "tel" : chiave === "email" ? "email" : undefined}
        onChange={(e) => {
          let v = e.target.value;
          if (maiuscolo) v = v.toUpperCase();
          if (lunghezza) v = v.slice(0, lunghezza);
          onCambia(chiave, v);
        }}
        style={stileComune}
      />
      )}
    </div>
  );
}

/** Privato o Azienda: due tasti, e li decide lei. */
function SceltaIntestazione({ valore, onCambia }) {
  return (
    <div style={{ flex: "1 1 260px", minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>Intestazione<span style={{ color: "#B3261E", fontWeight: 700 }}> *</span></div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ v: "privato", l: "Privato" }, { v: "azienda", l: "Azienda" }].map((o) => {
          const scelto = (valore || "privato") === o.v;
          return (
            <button
              key={o.v} type="button" onClick={() => onCambia("tipo_cliente", o.v)}
              style={{
                ...fontBody, flex: 1, minHeight: 46, borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700,
                background: scelto ? NAVY : "#fff", color: scelto ? "#fff" : NAVY,
                border: `1px solid ${scelto ? NAVY : CREAM_BORDER}`,
              }}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Una foto del documento: galleria, fotocamera o file del computer. */
function Foto({ etichetta, file, onCambia, obbligatorio }) {
  const campo = useRef(null);
  return (
    <div style={{ flex: "1 1 160px", minWidth: 0, marginBottom: 12 }}>
      <div style={etichettaStile}>
        {etichetta}{obbligatorio && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      </div>
      <input
        ref={campo} type="file" accept="image/*,application/pdf"
        onChange={(e) => {
          onCambia(e.target.files?.[0] || null);
          // si svuota: scegliendo DUE VOLTE lo stesso file, senza questo
          // il campo non cambia valore e non succede niente
          e.target.value = "";
        }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      <button
        type="button" onClick={() => campo.current?.click()}
        style={{
          ...fontBody, display: "block", width: "100%", boxSizing: "border-box", minHeight: 96,
          border: `1px dashed ${file ? "#2E7D32" : GOLD}`, borderRadius: 12, padding: "16px 12px",
          background: file ? "#F2F9F3" : "#FFFDF8", cursor: "pointer", textAlign: "center",
          fontSize: 13, color: file ? "#2E7D32" : NAVY, fontWeight: file ? 700 : 400, lineHeight: 1.5,
        }}
      >
        {file ? `✓ ${file.name.length > 26 ? file.name.slice(0, 24) + "…" : file.name}` : "Scegli o scatta"}
        {!file && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>galleria, fotocamera o file</div>}
      </button>
    </div>
  );
}

// UNA DICHIARAZIONE. Sta qui fuori, non dentro PaginaModulo: un
// componente dichiarato nel corpo di un altro nasce nuovo a ogni
// disegno e si porta via quello che c'e' dentro — e' il guasto che
// chiudeva la tastiera a ogni lettera.
//
// Tutta la riga e' cliccabile, etichetta compresa: su un telefono
// centrare una casella di 18 pixel col pollice non funziona.
function Dichiarazione({ casella, segnata, onCambia }) {
  return (
    <label
      style={{
        display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer",
        padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`,
      }}
    >
      <input
        type="checkbox" checked={segnata} onChange={onCambia}
        style={{ width: 20, height: 20, flex: "0 0 auto", marginTop: 2, accentColor: NAVY }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ ...fontDisplay, display: "block", fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 2 }}>
          {casella.etichetta}
          {casella.tipo !== "facoltativa" && <span style={{ color: "#B3261E" }}> *</span>}
        </span>
        <span style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6 }}>{casella.testo}</span>
        {casella.clausole && (
          <span style={{ display: "block", marginTop: 6, fontSize: 12, color: GRAFITE, lineHeight: 1.7 }}>
            {casella.clausole.map((r, i) => <span key={i} style={{ display: "block" }}>– {r}</span>)}
          </span>
        )}
      </span>
    </label>
  );
}

export default function PaginaModulo({ token }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(true);
  const [risposte, setRisposte] = useState({});
  const [firma, setFirma] = useState(null);
  const [docFronte, setDocFronte] = useState(null);
  const [docRetro, setDocRetro] = useState(null);
  // nessuna spunta in partenza: una casella gia' segnata non e' un
  // consenso, e per quelle facoltative sarebbe proprio quello che il
  // GDPR non ammette
  const [spunte, setSpunte] = useState({});
  const [spedendo, setSpedendo] = useState(false);
  const [spedito, setSpedito] = useState(false);
  // IL REGOLAMENTO PARTE CHIUSO. Era stato aperto per intero, perche'
  // una tendina nasconde dietro un gesto in piu' il testo che si firma;
  // ma undici punti in mezzo al modulo li si scorre via senza leggerli,
  // e allontanano la firma e il tasto d'invio. Il titolare l'ha chiesto
  // chiuso (17/10/2026). Che si firmi quel testo resta detto due volte:
  // sul tasto stesso e nel riquadro della firma.
  const [regolamentoAperto, setRegolamentoAperto] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.rpc("modulo_vista", { p_token: token }).then(({ data, error }) => {
      if (!vivo) return;
      setCaricando(false);
      if (error) { setErrore(error.message); return; }
      setDati(data || null);
      if (data) {
        const d = {};
        for (const c of data.campi || []) if (!c.bloccato && c.valore) d[c.chiave] = c.valore;
        if (!d.tipo_cliente) {
          const t = (data.campi || []).find((c) => c.chiave === "tipo_cliente");
          if (t?.valore) d.tipo_cliente = t.valore;
        }
        setRisposte(d);
      }
    });
    return () => { vivo = false; };
  }, [token]);

  if (caricando) return <Avviso titolo="Un momento" testo="Sto aprendo il tuo modulo." />;
  if (errore) return <Avviso titolo="Qualcosa non ha funzionato" testo={`Riprova fra poco. Se continua, scrivici. (${errore})`} />;
  if (!dati) return <Avviso titolo="Questo link non è valido" testo="Può essere scaduto, oppure copiato male. Chiedi all'accademia di rimandartelo." />;
  if (dati.scaduto) return <Avviso buono titolo="Iscrizione già confermata"
    testo={`${dati.nome}, la tua iscrizione a ${dati.corso?.nome || "questo corso"} è già completa: non serve più compilare niente. A presto!`} />;
  if (spedito) return <Avviso buono titolo="Ricevuto, grazie!"
    testo={`${dati.nome}, abbiamo il tuo modulo firmato. Ci vediamo a ${dati.corso?.citta || "presto"}.`} />;

  const perChiave = Object.fromEntries((dati.campi || []).map((c) => [c.chiave, c]));
  const c = (k) => perChiave[k];
  const scrivi = (k, v) => setRisposte((r) => ({ ...r, [k]: v }));
  const testi = {
    intro:       dati.contratto?.intro       || DAL_CODICE.intro,
    regolamento: dati.contratto?.regolamento || DAL_CODICE.regolamento,
    consensi:    dati.contratto?.consensi    || DAL_CODICE.consensi,
  };
  const eAzienda = (risposte.tipo_cliente || c("tipo_cliente")?.valore) === "azienda";

  // cosa manca per poter spedire
  const mancanti = [];
  const serve = (campo, spento) => {
    const d = c(campo.chiave);
    if (!d || !d.obbligatorio || d.bloccato || spento) return;
    if (!String(risposte[campo.chiave] || "").trim()) mancanti.push(campo.etichetta || etichettaDi(campo.chiave));
  };
  AREA_ALLIEVO.righe.forEach((r) => r.campi.forEach((campo) => { if (campo.chiave !== "tipo_cliente") serve(campo, false); }));
  AREA_FATTURAZIONE.righe.forEach((r) => r.campi.forEach((campo) => serve(campo, !eAzienda)));
  if (c("doc_tipo"))   serve({ chiave: "doc_tipo" }, false);
  if (c("doc_numero")) serve({ chiave: "doc_numero" }, false);
  if (c("doc_fronte")?.obbligatorio && !c("doc_fronte")?.bloccato && !docFronte) mancanti.push("Foto del documento — fronte");
  if (c("doc_retro")?.obbligatorio  && !c("doc_retro")?.bloccato  && !docRetro)  mancanti.push("Foto del documento — retro");
  if (!firma) mancanti.push("La firma");

  // QUALI CASELLE SI MOSTRANO. Le tre obbligatorie e le due facoltative
  // sempre; quella dell'avvio immediato solo se al corso mancano meno
  // giorni del termine di recesso — vedi regole-recesso.js, che e'
  // l'unico posto dove quel numero e' scritto.
  const caselle = (testi.consensi.caselle || []).filter(
    (c) => c.tipo !== "avvio" || serveAvvioImmediato(dati.corso?.inizio),
  );
  for (const c of caselle) {
    if (c.tipo !== "facoltativa" && !spunte[c.chiave]) mancanti.push(c.etichetta);
  }
  const puoSpedire = mancanti.length === 0 && !spedendo;

  async function spedisci() {
    setSpedendo(true); setErrore("");
    try {
      const cartella = token.slice(0, 16);
      const sali = async (file, nome) => {
        if (!file) return null;
        const est = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const percorso = `${cartella}/${nome}-${Date.now()}.${est}`;
        const { error } = await supabase.storage.from("moduli-iscrizione")
          .upload(percorso, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(`Non riesco a caricare ${nome}: ${error.message}`);
        return percorso;
      };
      const pFronte = await sali(docFronte, "fronte");
      const pRetro  = await sali(docRetro, "retro");
      const pFirma  = await sali(firma && new File([firma], "firma.png", { type: "image/png" }), "firma");

      const { data, error } = await supabase.rpc("modulo_salva", {
        p_token: token, p_risposte: risposte,
        p_firma: pFirma, p_doc_fronte: pFronte, p_doc_retro: pRetro,
        // le spunte vanno al database come le ha lasciate lei: la
        // funzione rifiuta il modulo se le tre obbligatorie non ci sono,
        // e scrive la data accanto a ognuna di quelle date
        p_consensi: spunte,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.errore || "Non è stato possibile inviare il modulo.");
      setSpedito(true);

      // LA CONFERMA DI RICEZIONE, dopo e non prima.
      //
      // Parte solo a modulo scritto: quella mail dice "abbiamo ricevuto",
      // e mandarla prima del salvataggio vorrebbe dire prometterlo senza
      // saperlo. La manda il server — vedi la funzione `modulo-ricevuto`:
      // da questa pagina nessuno ha una sessione, e `invia-email` non
      // accetta la chiave pubblicabile.
      //
      // Se non parte, qui non succede niente: il modulo E' arrivato, e
      // dirle "errore" dopo che il suo documento e' al sicuro la
      // spingerebbe a rimandare tutto. Il guasto resta scritto nel
      // registro degli invii, dove qualcuno lo vede.
      try {
        await supabase.functions.invoke("modulo-ricevuto", { body: { token } });
      } catch (e) {
        console.error("conferma di ricezione non partita:", e?.message || e);
      }
    } catch (e) {
      setErrore(e.message || String(e));
    } finally {
      setSpedendo(false);
    }
  }

  const pannello = { ...areaSchedaIscritto, marginBottom: 14 };
  const paragrafo = { fontSize: 12.5, color: GRAFITE, lineHeight: 1.65, margin: "8px 0" };
  const quantiPunti = (testi.regolamento.blocchi || []).length;

  // UNA RIGA DELL'ANAGRAFICA: chi ha gia' un valore si legge, gli altri
  // sono suoi.
  //
  // E' una funzione che restituisce JSX, e si chiama — `{rigaSua(...)}` —
  // invece di essere montata come componente — `<RigaSua .../>`. La
  // differenza non e' di stile: dichiarata qui dentro, a ogni disegno
  // nasceva una funzione nuova, e per React una funzione diversa e' un
  // componente diverso. Quindi a ogni lettera battuta smontava l'intera
  // riga e ne costruiva un'altra: il campo in cui si stava scrivendo
  // veniva distrutto sotto il dito, il fuoco se ne andava senza nemmeno
  // un evento di uscita, e sul telefono si chiudeva la tastiera.
  // Misurato il 17/10/2026 sul modulo vero: sedici caselle rifatte in
  // tre lettere. Chiamandola, i figli restano `Letto`/`DaRiempire`, che
  // stanno fuori di qui e non cambiano mai identita'.
  const rigaSua = (campi, spenti = false) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {campi.map((campo) => {
        const d = c(campo.chiave);
        if (!d) return null;
        if (campo.chiave === "tipo_cliente") {
          return <SceltaIntestazione key={campo.chiave} valore={risposte.tipo_cliente || d.valore} onCambia={scrivi} />;
        }
        if (d.bloccato) {
          return <Letto key={campo.chiave} etichetta={campo.etichetta || etichettaDi(campo.chiave)}
                        valore={mostra(campo.chiave, d.valore)} larghezza={campo.larghezza} />;
        }
        return <DaRiempire key={campo.chiave} campo={campo} valore={risposte[campo.chiave]}
                           onCambia={scrivi} obbligatorio={d.obbligatorio} spento={spenti} />;
      })}
    </div>
  );

  // un riquadro commerciale: di sola lettura per intero, e senza le
  // righe che il venditore ha lasciato vuote
  const rigaLetta = (chiavi) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {chiavi.map((k) => <Letto key={k} etichetta={etichettaDi(k)} valore={mostra(k, c(k)?.valore)} />)}
    </div>
  );
  // le chiavi di un gruppo che hanno davvero qualcosa da dire
  const scritte = (chiavi) => chiavi.filter((k) => c(k) && pieno(c(k).valore));

  return (
    <div style={{ ...fontBody, minHeight: "100vh", padding: "20px 14px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div style={{ ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, lineHeight: 1.35, marginBottom: 6 }}>
          {testi.intro.titolo}
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>{testi.intro.sottotitolo}</div>

        <div style={pannello}>
          <IntestazioneArea>Il tuo corso</IntestazioneArea>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              ["Corso", dati.corso?.nome],
              ["Dal",   giorno(dati.corso?.inizio)],
              ["Al",    giorno(dati.corso?.fine)],
              ["Città", dati.corso?.citta],
              ["Dove",  [dati.corso?.sede, dati.corso?.indirizzo].filter(Boolean).join(" — ")],
            ].filter(([, v]) => pieno(v)).map(([e, v]) => <Letto key={e} etichetta={e} valore={v} />)}
          </div>
        </div>

        <div style={pannello}>
          <IntestazioneArea>I tuoi dati</IntestazioneArea>
          {AREA_ALLIEVO.righe.map((r, i) => <React.Fragment key={i}>{rigaSua(r.campi)}</React.Fragment>)}
        </div>

        <div style={pannello}>
          <IntestazioneArea>Dati per la fattura</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            {eAzienda
              ? "Servono tutti, altrimenti la fattura non si può emettere."
              : "Si compilano solo se sopra scegli Azienda. Da privata non servono."}
          </div>
          {AREA_FATTURAZIONE.righe.map((r, i) => <React.Fragment key={i}>{rigaSua(r.campi, !eAzienda)}</React.Fragment>)}
        </div>

        <div style={pannello}>
          <IntestazioneArea>Il tuo documento</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            Carta d'identità o patente. Le foto restano riservate: non sono raggiungibili da nessun indirizzo pubblico.
          </div>
          {rigaSua(["doc_tipo", "doc_numero"].filter((k) => c(k)).map((k) => ({ chiave: k })))}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {c("doc_fronte") && <Foto etichetta="Fronte" file={docFronte} onCambia={setDocFronte} obbligatorio={c("doc_fronte").obbligatorio} />}
            {c("doc_retro")  && <Foto etichetta="Retro"  file={docRetro}  onCambia={setDocRetro}  obbligatorio={c("doc_retro").obbligatorio} />}
          </div>
        </div>

        {/* I riquadri commerciali: li ha decisi il venditore, lei li legge.
            "Il corso" salta, e' gia' il riquadro in cima. */}
        {GRUPPI_LETTURA.filter((g) => g.titolo !== "Il corso").map((g) => {
          // niente di scritto, niente riquadro: un "Presenza al corso"
          // con dentro un trattino non va mandato a nessuno
          const presenti = scritte(g.chiavi);
          if (!presenti.length) return null;
          return (
            <div key={g.titolo} style={pannello}>
              <IntestazioneArea>{g.titolo}</IntestazioneArea>
              {rigaLetta(presenti)}
            </div>
          );
        })}

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.regolamento.titolo || "Regolamento di partecipazione"}</IntestazioneArea>
          <button
            type="button" onClick={() => setRegolamentoAperto((v) => !v)}
            aria-expanded={regolamentoAperto}
            style={{
              ...fontBody, width: "100%", boxSizing: "border-box", minHeight: 48, borderRadius: 10,
              border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, cursor: "pointer",
              fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: 10, padding: "0 14px", textAlign: "left",
            }}
          >
            <span>
              {regolamentoAperto ? "Chiudi il regolamento" : "Leggi il regolamento"}
              <span style={{ display: "block", fontWeight: 400, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                {quantiPunti} {quantiPunti === 1 ? "punto" : "punti"} · lo accetti firmando qui sotto
              </span>
            </span>
            <span style={{ fontSize: 16, color: MUTED, transform: regolamentoAperto ? "rotate(180deg)" : "none" }}>⌄</span>
          </button>
          {regolamentoAperto && (
            <div style={{ marginTop: 14 }}>
              {(testi.regolamento.blocchi || []).map((b, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{b.titolo}</div>
                  {(b.punti || []).map((p, j) => <p key={j} style={paragrafo}>{p}</p>)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...pannello, borderLeft: `4px solid ${NAVY}` }}>
          <IntestazioneArea>{testi.consensi.informativaEtichetta}</IntestazioneArea>
          <p style={paragrafo}>{testi.consensi.informativaRimando}</p>
        </div>

        <div style={pannello}>
          <IntestazioneArea>Dichiarazioni</IntestazioneArea>
          {caselle.filter((c) => c.tipo !== "facoltativa").map((c) => (
            <Dichiarazione key={c.chiave} casella={c} segnata={!!spunte[c.chiave]}
              onCambia={() => setSpunte((v) => ({ ...v, [c.chiave]: !v[c.chiave] }))} />
          ))}
          {caselle.some((c) => c.tipo === "facoltativa") && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${CREAM_BORDER}` }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{testi.consensi.titoloFacoltative}</div>
              {caselle.filter((c) => c.tipo === "facoltativa").map((c) => (
                <Dichiarazione key={c.chiave} casella={c} segnata={!!spunte[c.chiave]}
                  onCambia={() => setSpunte((v) => ({ ...v, [c.chiave]: !v[c.chiave] }))} />
              ))}
            </div>
          )}
        </div>

        <div style={pannello}>
          <IntestazioneArea>{testi.consensi.firmaEtichetta || "Firma"}</IntestazioneArea>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.55 }}>
            Firmando accetti il regolamento e l'informativa qui sopra.
          </div>
          <FirmaDito onCambia={setFirma} />
        </div>

        {errore && (
          <div style={{ border: "1px solid #B3261E", background: "#FDF1F0", borderRadius: 10,
                        padding: "10px 12px", marginBottom: 12, fontSize: 13, color: GRAFITE }}>
            {errore}
          </div>
        )}

        {mancanti.length > 0 && (
          <div style={{ fontSize: 12.5, color: GRAFITE, marginBottom: 10, lineHeight: 1.6 }}>
            Manca ancora: <b style={{ color: NAVY }}>{mancanti.join(", ")}</b>.
          </div>
        )}

        <button
          type="button" onClick={spedisci} disabled={!puoSpedire}
          style={{
            ...fontBody, width: "100%", minHeight: 52, borderRadius: 12, border: "none",
            fontSize: 15, fontWeight: 700, cursor: puoSpedire ? "pointer" : "default",
            background: puoSpedire ? NAVY : "#C9C2B4", color: "#fff",
          }}
        >
          {spedendo ? "Invio in corso…" : (testi.consensi.tastoInvio || "Accetto e Invio")}
        </button>
        <div style={{ textAlign: "center", fontSize: 11.5, color: MUTED, marginTop: 10 }}>
          {testi.consensi.notaObbligatori}
        </div>
      </div>
    </div>
  );
}
