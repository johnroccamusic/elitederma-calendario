// LA FIRMA DEL CONTRATTO, DALLA DASHBOARD DELLA MASTER.
//
// È il gesto del modulo di iscrizione, con le stesse caselle e gli
// stessi mattoni: si legge il contratto per intero, si compilano i
// propri dati, si allegano le due foto del documento, si spuntano le tre
// dichiarazioni, si firma col dito. Da qui parte la copia firmata, che
// torna a lei per email e arriva all'Accademia.
//
// LA DIFFERENZA, ed è una semplificazione: la master non arriva da un
// link pubblico. È già dentro il gestionale con la sua password, quindi
// ha una sessione — i file vanno in `master-documenti`, privato, e le
// funzioni che scrivono sono aperte a chi ha fatto accesso e non a
// chiunque.
//
// QUELLO CHE SI RIUSA, E PERCHÉ. `DaRiempire`, `Foto`, `Dichiarazione`,
// `Letto` e `Avviso` arrivano da `PaginaModulo.jsx`, e la cascata della
// residenza da `cascata-residenza.js`. Riscriverli qui vorrebbe dire due
// modi di scattare la foto di un documento e due idee di dove abita una
// persona — e il giorno in cui una delle due impara qualcosa, l'altra
// resta indietro senza che nessuno lo veda.
//
// IL TESTO VA APERTO E RICHIUSO PRIMA DI FIRMARE, e si segna alla
// CHIUSURA: aperto e lasciato aperto vuol dire che ci si è scorsi
// attraverso. Vale per il contratto e, a parte, per l'Allegato A — sono
// due documenti, e la terza dichiarazione è la ricevuta del secondo.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { areaSchedaIscritto, IntestazioneArea } from "../ui/scheda.jsx";
import FirmaDito from "../ui/FirmaDito.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { Avviso, Letto, DaRiempire, Foto, Dichiarazione } from "../iscrizione/PaginaModulo.jsx";
import { cascataResidenza } from "../iscrizione/cascata-residenza.js";
import { avvisoCampo } from "../iscrizione/disposizione.js";
import { RIGHE, OBBLIGATORI } from "./disposizione.js";
import { leggiContratto, salvaBozza, caricaFile, firmaContratto, segnaLettura } from "./dati.js";
import { DAL_CODICE } from "./testi.js";
import { creaPdfContrattoDaLeggere, nomeFileContrattoDaLeggere } from "./contrattoPdf.js";
import { scaricaPdf } from "../file/pdf.js";
import { urlAllegato } from "../file/allegati.js";
import {
  blocchiContratto, casellePronte, epigrafeMaster, luogoEData, mancantiPerFirmare,
} from "../../supabase/functions/_shared/contratto-master.js";

const pannello = { ...areaSchedaIscritto, marginBottom: 16 };
const quando = (iso) => {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
};

/**
 * UN DOCUMENTO CHE SI APRE E SI RICHIUDE.
 *
 * Chiuso di suo: un contratto di ventitré articoli aperto in cima alla
 * pagina è un muro, e chi lo trova aperto scorre fino in fondo senza
 * sapere di aver attraversato qualcosa. `onLetto` scatta alla CHIUSURA.
 */
function Documento({ titolo, sottotitolo, blocchi, letto, onLetto, segno, pdf = null }) {
  const [aperto, setAperto] = useState(false);
  // DA QUANDO E' APERTO. Serve a una cosa sola, e non e' un controllo:
  // dire a chi amministra quanto quel testo e' stato tenuto aperto. Un
  // contratto di ventitre' articoli richiuso dopo quattro secondi non
  // prova niente, ma si vede (27/11/2026).
  const apertoDa = useRef(0);
  const apri = () => { apertoDa.current = Date.now(); setAperto(true); };
  const chiudi = () => {
    const secondi = apertoDa.current ? Math.round((Date.now() - apertoDa.current) / 1000) : 0;
    apertoDa.current = 0;
    setAperto(false);
    onLetto(secondi);
  };
  return (
    <div style={pannello}>
      <IntestazioneArea>{titolo}</IntestazioneArea>
      {sottotitolo && (
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>{sottotitolo}</div>
      )}
      {/* I DUE TASTI IN FILA, e sono due cose diverse: uno apre il testo
          qui dentro — ed e' quello che la pagina conta come lettura — e
          l'altro te lo da' da portare via. Il PDF NON apre nessuna
          porta: se bastasse scaricarlo per poter firmare, la regola
          «non si firma un documento che non si e' aperto» diventerebbe
          «non si firma un documento che non si e' scaricato». */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        <button
          type="button"
          data-campo={`apri-${segno}`}
          onClick={() => (aperto ? chiudi() : apri())}
          style={{
            ...fontBody, fontSize: 13, fontWeight: 700, flex: "1 1 200px", minHeight: 44,
            color: NAVY, background: letto ? "#F2F9F3" : "#FFFDF8",
            border: `1px ${letto ? "solid" : "dashed"} ${letto ? "#CFE6D5" : GOLD}`,
            borderRadius: 10, padding: "11px 14px", cursor: "pointer",
          }}
        >
          {aperto ? "Ho finito di leggere — chiudi" : letto ? "✓ letto — riapri" : "Apri e leggi"}
        </button>
        {pdf && (
          <button
            type="button"
            data-campo={`pdf-${segno}`}
            onClick={pdf.onScarica}
            aria-disabled={pdf.inCorso ? "true" : "false"}
            style={{
              ...fontBody, fontSize: 13, fontWeight: 700, minHeight: 44, flex: "0 1 auto",
              color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`,
              borderRadius: 10, padding: "11px 14px", cursor: pdf.inCorso ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {pdf.inCorso ? "Preparo il PDF…" : "Scarica il PDF"}
          </button>
        )}
      </div>
      {pdf && (
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
          {pdf.nota}
        </div>
      )}
      {aperto && (
        <div style={{ marginTop: 12, maxHeight: "60vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
                      border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "14px 14px 4px", background: "#fff" }}>
          {blocchi.map((b, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              {b.titolo && (
                <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{b.titolo}</div>
              )}
              {(b.punti || []).map((p, j) => {
                const voce = String(p).trim().startsWith("•");
                return (
                  <div key={j} style={{
                    ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.65,
                    marginBottom: 6, paddingLeft: voce ? 14 : 0,
                  }}>{p}</div>
                );
              })}
            </div>
          ))}
          <div style={{ position: "sticky", bottom: 0, background: "#fff", paddingBottom: 10 }}>
            <button
              type="button" onClick={chiudi}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, width: "100%", minHeight: 44,
                       color: "#fff", background: NAVY, border: "none", borderRadius: 10, cursor: "pointer" }}
            >
              Ho finito di leggere
            </button>
          </div>
        </div>
      )}
      {!letto && !aperto && (
        <div style={{ ...fontBody, fontSize: 11.5, color: "#8A6A1B", marginTop: 6, lineHeight: 1.45 }}>
          Va aperto e richiuso: fino ad allora non si può firmare.
        </div>
      )}
    </div>
  );
}

export default function FirmaContratto({
  masterId, nomeMaster = "", onBack, TastoIndietro = null, isMobile = false,
  // IL PDF SI PUO' INIETTARE, come nella bolla di accompagnamento: una
  // prova che monta la pagina preme il tasto per davvero senza comporre
  // trecento chili di documento a ogni giro, e una prova a parte compone
  // il PDF vero e lo apre.
  generaPdf = creaPdfContrattoDaLeggere,
  scarica = scaricaPdf,
}) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [erroreFirma, setErroreFirma] = useState("");
  const [risposte, setRisposte] = useState({});
  const [firma, setFirma] = useState(null);
  const [docFronte, setDocFronte] = useState(null);
  const [docRetro, setDocRetro] = useState(null);
  const [spunte, setSpunte] = useState({});
  const [contrattoLetto, setContrattoLetto] = useState(false);
  const [manifestoLetto, setManifestoLetto] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [fatto, setFatto] = useState(null);
  const [linkCopia, setLinkCopia] = useState("");
  const [pdfInCorso, setPdfInCorso] = useState(false);
  const [errorePdf, setErrorePdf] = useState("");
  // DICHIARATA PRIMA DI CHI LA USA: `ricarica` la scrive, e una `const`
  // usata sopra la sua riga qui non da' un avviso, da' la pagina che non
  // si apre (la trappola di App.jsx, pagata tre volte).
  const ultimaBozza = useRef("");

  const ricarica = useCallback(async () => {
    const { dati: d, errore: e } = await leggiContratto(masterId);
    setCaricando(false);
    if (e) { setErrore(e); return; }
    setDati(d);
    if (d?.dati) {
      setRisposte(d.dati);
      // LA BOZZA PARTE SOLO DOPO UN TOCCO SUO, e questa riga e' tutta la
      // differenza: fino al 27/11/2026 la pagina salvava al montaggio i
      // dati PRECOMPILATI dall'anagrafica, e in archivio nascevano
      // dodici righe su cui «Contratti master» scriveva «Ha cominciato a
      // compilarlo» senza che nessuno avesse battuto un tasto.
      ultimaBozza.current = JSON.stringify(d.dati);
    }
    // APERTO E RICHIUSO IERI RESTA APERTO E RICHIUSO. Le due spunte
    // vivevano solo nello stato del browser: chi tornava il giorno dopo
    // doveva riaprire il testo per poter firmare. Adesso la lettura e'
    // scritta, e la regola («non si firma un documento che non si e'
    // aperto») resta soddisfatta da quella volta.
    if (d?.contratto?.testo_letto_il) setContrattoLetto(true);
    if (d?.contratto?.manifesto_letto_il) setManifestoLetto(true);
  }, [masterId]);

  useEffect(() => { ricarica(); }, [ricarica]);

  // CHE LA PAGINA SIA STATA APERTA, una volta per visita. E' il primo
  // gradino di «chi ha posto attenzione»: senza, di chi apre e non
  // firma non resta niente da nessuna parte. Non si aspetta la risposta
  // e un rifiuto non si mostra: chi sta per firmare non ha niente da
  // correggere.
  const aperturaSegnata = useRef(false);
  useEffect(() => {
    if (!dati || dati.firmato || dati.master?.escluso || dati.aperta === false) return;
    if (aperturaSegnata.current) return;
    aperturaSegnata.current = true;
    segnaLettura(masterId, "pagina");
  }, [dati, masterId]);

  // LA BOZZA, CON UN RESPIRO. Il contratto è lungo e si compila in più
  // volte: quello che si scrive va nel database dopo un secondo di
  // silenzio, non a ogni lettera — e non si dice «salvato», perché
  // dirlo prima di saperlo è il guasto dei carrelli sospesi del 7/11.
  useEffect(() => {
    if (!dati || dati.firmato || dati.master?.escluso) return;
    const corpo = JSON.stringify(risposte);
    if (corpo === ultimaBozza.current || corpo === "{}") return;
    const t = setTimeout(() => {
      ultimaBozza.current = corpo;
      salvaBozza(masterId, risposte);
    }, 1200);
    return () => clearTimeout(t);
  }, [risposte, dati, masterId]);

  const testi = useMemo(() => {
    const t = dati?.testi && Object.keys(dati.testi).length ? dati.testi : {};
    return {
      intestazione: t.intestazione || DAL_CODICE.intestazione,
      parti:        t.parti        || DAL_CODICE.parti,
      premesse:     t.premesse     || DAL_CODICE.premesse,
      articoli:     t.articoli     || DAL_CODICE.articoli,
      clausole:     t.clausole     || DAL_CODICE.clausole,
      manifesto:    t.manifesto    || DAL_CODICE.manifesto,
      caselle:      t.caselle      || DAL_CODICE.caselle,
    };
  }, [dati]);

  const valoreDi = (k) => String(risposte[k] ?? "").trim();
  const { campoConElenco } = cascataResidenza(valoreDi);
  const scrivi = (k, v) => setRisposte((r) => ({ ...r, [k]: v }));

  const blocchi = useMemo(() => blocchiContratto(testi, risposte), [testi, risposte]);
  const caselle = useMemo(() => casellePronte(testi), [testi]);

  const mancanti = useMemo(() => {
    const m = mancantiPerFirmare({
      dati: risposte, spunte, firma, docFronte, docRetro,
      letto: contrattoLetto && manifestoLetto,
    });
    if (contrattoLetto && !manifestoLetto) m.push("Aprire l'Allegato A e richiuderlo");
    return m;
  }, [risposte, spunte, firma, docFronte, docRetro, contrattoLetto, manifestoLetto]);

  const puoFirmare = mancanti.length === 0 && !firmando;

  async function firmo() {
    setFirmando(true); setErroreFirma("");
    try {
      const sali = async (file, nome) => {
        const { percorso, errore: e } = await caricaFile(masterId, file, nome);
        if (e) throw new Error(e);
        return percorso;
      };
      const pFronte = await sali(docFronte, "fronte");
      const pRetro = await sali(docRetro, "retro");
      const pFirma = await sali(new File([firma], "firma.png", { type: "image/png" }), "firma");

      const esito = await firmaContratto({
        masterId, dati: risposte, firma: pFirma, docFronte: pFronte, docRetro: pRetro,
        spunte, testi,
      });
      if (!esito.ok) throw new Error(esito.errore);

      setFatto({ id: esito.id });

      // LA COPIA FIRMATA, DOPO E NON PRIMA. La compone il server e la
      // manda per email: da qui non si può, perché `invia-email` non
      // accetta la chiave del bundle e perché un PDF fatto dal telefono
      // non arriva allegato a niente. Se non parte, la firma È
      // REGISTRATA: si dice, e la copia si rigenera da «Contratti
      // master». Dire «errore» dopo che il contratto è al sicuro
      // spingerebbe a rifirmare.
      try {
        const { data, error } = await supabase.functions.invoke("contratto-master-firmato", {
          body: { contrattoId: esito.id },
        });
        if (error || !data?.ok) {
          setFatto({ id: esito.id, copia: false, perche: data?.errore || error?.message || "" });
        } else {
          setFatto({ id: esito.id, copia: true });
        }
      } catch (e) {
        setFatto({ id: esito.id, copia: false, perche: String(e?.message || e) });
      }
      await ricarica();
    } catch (e) {
      setErroreFirma(String(e?.message || e));
    } finally {
      setFirmando(false);
    }
  }

  /**
   * IL TESTO DA PORTARE VIA. Lo compone il browser con pdf-lib, come
   * ogni altro PDF di questa app tranne i due che devono partire
   * allegati a una mail del server.
   *
   * LA TRACCIA SI SCRIVE, e non e' un dettaglio: dal 27/11/2026
   * «Contratti master» dice chi ha posto attenzione al contratto, e una
   * master che si scarica il testo e lo legge sul computer, senza
   * questa riga, risulterebbe fra quelle che non l'hanno nemmeno
   * aperto — cioe' il segnalatore direbbe il contrario del vero proprio
   * di chi ci ha messo piu' cura. Si segna DOPO che il file e' uscito:
   * dirlo prima di saperlo e' il guasto dei carrelli sospesi del 7/11.
   */
  async function scaricaIlTesto() {
    if (pdfInCorso) return;
    setPdfInCorso(true); setErrorePdf("");
    try {
      const bytes = await generaPdf({ testi, dati: risposte });
      scarica(bytes, nomeFileContrattoDaLeggere());
      segnaLettura(masterId, "pdf");
    } catch (e) {
      setErrorePdf("Il PDF non è stato composto: " + String(e?.message || e)
        + ". Il testo lo leggi comunque qui sopra, con «Apri e leggi».");
    } finally {
      setPdfInCorso(false);
    }
  }

  async function apriLaCopia(percorso) {
    const { url, errore: e } = await urlAllegato("master-documenti", percorso);
    if (e || !url) { setErroreFirma(e || "Non riesco ad aprire la copia."); return; }
    setLinkCopia(url);
    window.open(url, "_blank", "noopener");
  }

  const testata = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      {TastoIndietro && <TastoIndietro titolo="Indietro" onClick={onBack} />}
      <div style={{ ...fontDisplay, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: NAVY, textTransform: "uppercase", lineHeight: 1.15 }}>
        Firma del contratto
      </div>
    </div>
  );

  const guscio = (dentro) => (
    <div style={{ ...fontBody, padding: isMobile ? "20px 14px 60px" : "24px 20px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>{testata}{dentro}</div>
    </div>
  );

  if (caricando) return guscio(<Avviso titolo="Un momento" testo="Sto aprendo il tuo contratto." />);
  if (errore) return guscio(<Avviso titolo="Qualcosa non ha funzionato" testo={`Riprova fra poco. (${errore})`} />);
  if (!dati) return guscio(<Avviso titolo="Non trovo la tua scheda" testo="Scrivi all'amministrazione: senza la scheda il contratto non si può preparare." />);

  // LA PORTA CHIUSA SI DICE, e si dice QUI e non dopo aver fatto
  // compilare tutto. Normalmente a porta chiusa la nuvola non compare
  // nemmeno; questa pagina però si apre anche da chi amministra, che
  // guarda la dashboard di una master, e un modulo che lascia firmare e
  // poi si sente dire no dal database è peggio di un modulo che non c'è.
  //
  // Il contratto già firmato invece si continua a leggere: chiudere la
  // porta vuol dire «per ora non si firma», non «quello che è stato
  // firmato non si vede più».
  if (dati.aperta === false && !dati.firmato) {
    return guscio(
      <Avviso
        titolo="La firma non è ancora aperta"
        testo="L'Accademia sta ancora sistemando il contratto: quando si potrà firmare lo troverai qui, e te lo diremo."
      />,
    );
  }

  // CHI RESTA FUORI LO LEGGE, col motivo. Una nuvola che si apre su una
  // pagina vuota è peggio di una nuvola che non c'è.
  if (dati.master?.escluso) {
    return guscio(
      <Avviso
        titolo="Il tuo contratto non è ancora pronto"
        testo={`${dati.master.escluso_motivo || "L'Accademia sta preparando le tue condizioni."} Quando è pronto lo trovi qui.`}
      />,
    );
  }

  // GIÀ FIRMATO: niente da rifirmare, e la copia si rilegge da qui.
  if (dati.firmato && !fatto) {
    const f = dati.firmato;
    return guscio(
      <>
        <Avviso
          buono
          titolo="Contratto firmato"
          testo={`Hai firmato il contratto il ${quando(f.firmato_il)}${f.luogo_firma ? ` a ${f.luogo_firma}` : ""}. Ne hai ricevuto copia per email: se non la trovi, chiedila all'amministrazione.`}
        />
        <div style={pannello}>
          <IntestazioneArea>Quello che hai sottoscritto</IntestazioneArea>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Letto etichetta="Luogo e data" valore={luogoEData(f.dati, f.firmato_il)} />
            <Letto etichetta="Contratto" valore={quando(f.consenso_contratto_il)} />
            <Letto etichetta="Clausole (artt. 1341-1342 c.c.)" valore={quando(f.consenso_clausole_il)} />
            <Letto etichetta="Ricevuta dell'Allegato A" valore={quando(f.consenso_manifesto_il)} />
          </div>
          <div style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, marginTop: 10 }}>
            {epigrafeMaster(f.dati)}
          </div>
          {f.pdf_path ? (
            <button
              type="button" onClick={() => apriLaCopia(f.pdf_path)}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, background: "#fff",
                       border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "11px 16px",
                       cursor: "pointer", marginTop: 12, minHeight: 44 }}
            >
              Apri la copia firmata →
            </button>
          ) : (
            <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
              La copia in PDF non è ancora stata composta: la rigenera l'amministrazione da «Contratti master».
            </div>
          )}
          {linkCopia && (
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
              Se non si è aperta: <a href={linkCopia} target="_blank" rel="noopener noreferrer" style={{ color: NAVY }}>scaricala da qui</a>
            </div>
          )}
        </div>
      </>,
    );
  }

  if (fatto) {
    return guscio(
      <>
        <Avviso
          buono
          titolo="Contratto firmato"
          testo={fatto.copia
            ? "È registrato e la copia firmata ti è stata mandata per email, con l'Allegato A. L'Accademia l'ha ricevuta."
            : "È registrato: la firma e il documento sono al sicuro. La copia in PDF non è ancora partita — l'amministrazione la rigenera e te la manda, non devi rifare niente."}
        />
        {!fatto.copia && fatto.perche && (
          <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>Motivo tecnico: {fatto.perche}</div>
        )}
      </>,
    );
  }

  const riaperto = !!dati.contratto?.riaperto_il;

  return guscio(
    <>
      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, lineHeight: 1.35, marginBottom: 4 }}>
        {testi.intestazione.titolo}
      </div>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>
        {testi.intestazione.sottotitolo} · {testi.intestazione.versione}
      </div>

      {riaperto && (
        <div data-campo="avviso-riaperto" style={{
          ...fontBody, fontSize: 12.5, lineHeight: 1.6, color: "#6B4E00",
          background: "#FFF8E6", border: "1px solid #E6CF8C", borderRadius: 10,
          padding: "10px 12px", marginBottom: 16,
        }}>
          Il contratto è stato riaperto{dati.contratto.riaperto_perche ? `: ${dati.contratto.riaperto_perche}` : ""}.
          Trovi i dati che avevi scritto: correggi quello che serve, poi rileggi, rifirma e invia.
        </div>
      )}

      <Documento
        segno="contratto"
        titolo="Il contratto"
        sottotitolo="Le parti, le premesse e gli articoli da 1 a 23. L'epigrafe si compone da sé con i dati che scrivi qui sotto: rileggila prima di firmare."
        blocchi={blocchi}
        letto={contrattoLetto}
        onLetto={(secondi) => { setContrattoLetto(true); segnaLettura(masterId, "contratto", secondi); }}
        pdf={{
          onScarica: scaricaIlTesto,
          inCorso: pdfInCorso,
          // LA NOTA DICE COSA C'E' DENTRO E COSA NON C'E'. Un «scarica il
          // PDF» accanto a un contratto, senza questa riga, si legge come
          // «ecco la tua copia»: e la copia del contratto sottoscritto e'
          // un'altra cosa, arriva per email dopo la firma.
          nota: errorePdf || "Nel PDF ci sono il contratto per intero, le clausole da approvare e l'Allegato A: "
            + "serve per leggerlo con calma o stamparlo. Non è la copia firmata — quella ti arriva per email dopo la firma.",
        }}
      />

      <Documento
        segno="manifesto"
        titolo={testi.manifesto.titolo}
        sottotitolo={`${testi.manifesto.versione} — non contiene obblighi, divieti o sanzioni: esprime valori e stile dell'Accademia (art. 23.2). È anche dentro il PDF che si scarica qui sopra.`}
        blocchi={testi.manifesto.blocchi}
        letto={manifestoLetto}
        onLetto={(secondi) => { setManifestoLetto(true); segnaLettura(masterId, "manifesto", secondi); }}
      />

      <div style={pannello}>
        <IntestazioneArea>I tuoi dati</IntestazioneArea>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
          Sono quelli che vanno nell'epigrafe del contratto. Quello che l'Accademia sa già è precompilato,
          e si può correggere tutto: qui l'unica che li sa per certo sei tu.
        </div>
        {RIGHE.map((r, i) => (
          <React.Fragment key={i}>
            {r.titolo && (
              <div style={{ ...fontDisplay, fontSize: 12, fontWeight: 700, color: NAVY,
                            textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 8px" }}>
                {r.titolo}
              </div>
            )}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {r.campi.map((campo) => {
                const pronto = campoConElenco(campo);
                // il comune italiano non si chiede a chi è nata all'estero
                const spento = campo.chiave === "comune_nascita" && !!valoreDi("stato_nascita");
                return (
                  <DaRiempire
                    key={campo.chiave}
                    campo={pronto}
                    valore={risposte[campo.chiave]}
                    onCambia={scrivi}
                    obbligatorio={OBBLIGATORI.has(campo.chiave)}
                    spento={spento}
                    tutte={risposte}
                  />
                );
              })}
            </div>
          </React.Fragment>
        ))}
        {/* L'EPIGRAFE COM'È ADESSO. È la frase che finisce in testa al
            contratto: mostrarla mentre si compila fa vedere subito un
            dato storto, invece di scoprirlo su un PDF firmato. */}
        <div style={{ marginTop: 10, padding: "10px 12px", background: "#FFFDF8",
                      border: `1px dashed ${GOLD}`, borderRadius: 10 }}>
          <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase",
                        letterSpacing: 0.5, marginBottom: 4 }}>Come comparirai nel contratto</div>
          <div data-campo="epigrafe" style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.6 }}>
            {epigrafeMaster(risposte)}
          </div>
        </div>
        {avvisoCampo({ chiave: "email", tipo: "email" }, risposte.email) && (
          <div style={{ ...fontBody, fontSize: 11.5, color: "#8A6A1B", marginTop: 6, lineHeight: 1.45 }}>
            {avvisoCampo({ chiave: "email", tipo: "email" }, risposte.email)}
          </div>
        )}
      </div>

      <div style={pannello}>
        <IntestazioneArea>Il tuo documento</IntestazioneArea>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
          Fronte e retro di un documento valido. Restano in un archivio privato: si caricano e non si rileggono da fuori.
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Foto etichetta="Fronte" file={docFronte} onCambia={setDocFronte} obbligatorio />
          <Foto etichetta="Retro" file={docRetro} onCambia={setDocRetro} obbligatorio />
        </div>
      </div>

      <div style={pannello}>
        <IntestazioneArea>Le dichiarazioni</IntestazioneArea>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 6 }}>
          Sono tre atti distinti, come le tre firme del cartaceo: il contratto, l'approvazione specifica
          delle clausole e la ricevuta dell'Allegato A. Ognuna si spunta per sé.
        </div>
        {caselle.map((c) => (
          <Dichiarazione
            key={c.chiave}
            casella={c}
            segnata={!!spunte[c.chiave]}
            spenta={!contrattoLetto || !manifestoLetto}
            onCambia={() => setSpunte((s) => ({ ...s, [c.chiave]: !s[c.chiave] }))}
          />
        ))}
      </div>

      <div style={pannello}>
        <IntestazioneArea>La tua firma</IntestazioneArea>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
          <Letto etichetta="Luogo e data" valore={luogoEData(risposte, new Date().toISOString()) || "— scrivi il comune di residenza"} />
        </div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
          La firma è una, e vale per tutte e tre: nella copia compare in fondo al contratto, in fondo
          all'approvazione delle clausole e in fondo all'Allegato A, come sul cartaceo.
        </div>
        {contrattoLetto && manifestoLetto ? <FirmaDito onCambia={setFirma} /> : (
          <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6A1B", background: "#FFF8E6",
                        border: "1px solid #E6CF8C", borderRadius: 10, padding: "12px 14px", lineHeight: 1.55 }}>
            Prima apri e richiudi il contratto e l'Allegato A: non si firma un documento che non si è aperto.
          </div>
        )}
      </div>

      <div style={{ ...fontBody, fontSize: 12.5, color: "#B3261E", lineHeight: 1.6, marginBottom: 10, fontWeight: 700 }}>
        ATTENZIONE: firmando sottoscrivi un contratto. Quello che leggi qui sopra è il testo che vale.
      </div>

      {mancanti.length > 0 && (
        <div data-campo="manca-ancora" style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, marginBottom: 10 }}>
          Manca ancora: <b style={{ color: NAVY }}>{mancanti.join(", ")}</b>.
        </div>
      )}

      {erroreFirma && (
        <div style={{ ...fontBody, fontSize: 12.5, color: "#B3261E", lineHeight: 1.6, marginBottom: 10 }}>{erroreFirma}</div>
      )}

      <button
        type="button"
        data-campo="firmo"
        onClick={firmo}
        aria-disabled={puoFirmare ? "false" : "true"}
        style={{
          ...fontBody, fontSize: 15, fontWeight: 700, width: "100%", minHeight: 52,
          color: "#fff", background: puoFirmare ? NAVY : "#B9BCC6", border: "none",
          borderRadius: 12, cursor: puoFirmare ? "pointer" : "default",
        }}
      >
        {firmando ? "Sto registrando…" : "Firmo il contratto"}
      </button>
    </>,
  );
}
