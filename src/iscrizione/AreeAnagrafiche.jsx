// I DUE RIQUADRI ANAGRAFICI, GLI STESSI IN DUE POSTI.
//
// Questo componente e' quello che disegna "Dati dell'allievo" e "Dati di
// fatturazione" nella scheda di iscrizione del venditore. La pagina
// Impostazioni → Modulo di iscrizione monta lo stesso componente con
// `configurazione` acceso: stessi riquadri, stesse righe, stesse
// etichette, stesse larghezze — perche' sono letteralmente lo stesso
// codice, non una copia somigliante. Se domani si aggiunge un campo
// nella disposizione, compare da solo in tutti e due i posti.
//
// LE DUE MODALITA'
//   normale        caselle vere, legate allo stato della scheda
//   configurazione caselle spente e vuote, e su ognuna una spunta che
//                  dice se quel campo va sul modulo dell'allieva
//
// LA SPUNTA NON SPOSTA NIENTE. Sta in un angolo, appoggiata sopra la
// casella (`position: absolute`), non infilata nell'etichetta: le
// etichette restano della stessa lunghezza e le righe della stessa
// altezza, cosi' i due disegni si possono sovrapporre e combaciano.
import React, { useState, useEffect } from "react";
import { Field } from "../ui/base.jsx";
import {
  REGIONI, provinceDiRegione, comuniDiProvincia, capDiComune, regioneDiProvincia,
  provinciaDiComune, codiceCatastale, nomiStati,
} from "../comuni-regioni.js";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "../ui/stile.js";
import { OBBLIGATORI_VENDITORE, NOTA_VENDITORE, avvisoCampo } from "./disposizione.js";
import { filtraCodiceFiscale, calcolaCodiceFiscale } from "./codice-fiscale.js";
import CampoComuneNascita from "./CampoComune.jsx";

// un campo escluso dal modulo non si nasconde: resta dov'e', solo
// smorzato. Chi guarda la pagina deve vedere la scheda intera e capire
// a colpo d'occhio cosa parte e cosa no.
const SMORZATO = { opacity: 0.45 };

// LA RESIDENZA NON SI SCRIVE, SI SCEGLIE.
//
// Regione -> provincia -> comune -> CAP, e ogni gradino apre il
// successivo. Non e' una preferenza di stile: dai moduli compilati a
// mano libera sono arrivati «Vollw» per Volla, «Rome», CAP «148» senza
// lo zero davanti, e una modella che nel campo citta' aveva riscritto
// «Via chiari 29». Un elenco chiuso non puo' produrre niente di tutto
// questo, e la provincia — che il modulo del sito non chiedeva mai e
// che mancava su 257 schede su 260 — esce da se' dalla scelta.
//
// Il valore in archivio resta citta' + CAP + sigla provincia: la
// regione non si salva, si ricava dalla provincia. Una colonna in meno
// che puo' contraddire le altre.
function normalizzaNome(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\([^)]*\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
}

// Un valore che in archivio c'e' ma nell'elenco non esiste NON si butta:
// compare in coda marcato, cosi' chi guarda la scheda lo vede e lo
// corregge. Cancellarlo di nascosto vorrebbe dire perdere l'unico
// indirizzo che quella persona ci ha dato.
function conFuoriElenco(opzioni, valore) {
  const v = (valore || "").trim();
  if (!v) return opzioni;
  const c = normalizzaNome(v);
  if (opzioni.some((o) => normalizzaNome(o.valore) === c)) return opzioni;
  return [...opzioni, { valore: v, testo: `${v} — fuori elenco` }];
}

function Tendina({ valore, opzioni, onCambia, spenta, stile, vuoto, campo }) {
  return (
    // `data-campo` e' l'unico aggancio stabile per ritrovare questa
    // tendina: cercarla per la forma del DOM si rompe appena una riga si
    // sposta, e si rompe nella prova, cioe' nel posto che dovrebbe dire
    // se il codice funziona.
    <select data-campo={campo} value={valore || ""} disabled={spenta} onChange={(e) => onCambia(e.target.value)} style={stile}>
      <option value="">{vuoto}</option>
      {opzioni.map((o) => <option key={o.valore} value={o.valore}>{o.testo}</option>)}
    </select>
  );
}

// LA VIA SI SUGGERISCE, NON SI IMPONE.
//
// Comune e CAP si scelgono da un elenco chiuso perche' l'elenco e'
// completo. Le vie no: quelle di OpenStreetMap coprono bene le citta' e
// male i paesi — «Via Circondario» a Castelfranci, 1.900 abitanti, non
// c'e', ed e' la residenza di un'allieva vera. Un elenco chiuso
// incompleto impedirebbe di registrare chi esiste.
//
// Quindi: si scrive come prima, e se la ricerca ha qualcosa da dire lo
// mette sotto. Nessun suggerimento non e' un errore e non si annuncia.
function CampoVia({ valore, scrivi, esceDalCampo, campo, stile, cascata, cercaVie, spenta }) {
  const [proposte, setProposte] = useState([]);
  const [aperto, setAperto] = useState(false);
  // SI CERCA SOLO MENTRE QUALCUNO SCRIVE.
  //
  // Senza questo, la ricerca ripartiva a ogni cambio del valore: quindi
  // anche aprendo una scheda gia' compilata, e anche SUBITO DOPO aver
  // scelto una proposta — il valore cambia, la ricerca riparte, trova
  // la stessa via e la ripropone sotto. L'elenco restava li' a
  // suggerire quello che era appena stato messo, e sembrava che l'app
  // non si fosse accorta della scelta.
  const [digitando, setDigitando] = useState(false);
  const comune = cascata?.comuneScelto || "";
  const cap = cascata?.cap || "";
  const civico = (cascata?.civico || "").trim();
  const scritto = valore || "";

  useEffect(() => {
    // SENZA COMUNE SI CERCA IN TUTTA ITALIA, e la proposta porta con se'
    // il paese: «Via Terni» da' Roma, Viterbo, Milano… e si sceglie la
    // propria leggendo il nome accanto. Scelta, si riempie tutto il
    // resto. Col comune gia' scelto la ricerca si restringe a lui, che
    // da' risultati migliori: e' lo stesso campo, due comportamenti.
    //
    // Fuori Italia non si cerca affatto: li' questa ricerca non copre.
    if (!digitando || spenta || !cercaVie || cascata?.fuoriItalia || scritto.trim().length < 3) {
      setProposte([]); return;
    }
    let vivo = true;
    // Mezzo secondo di attesa: Photon e' un servizio gratuito e una
    // richiesta a ogni lettera e' esattamente l'uso che fa chiudere i
    // servizi gratuiti.
    const t = setTimeout(async () => {
      // La ricerca puo' rompersi, e questo componente non deve fidarsi
      // che chi la passa l'abbia protetta: dentro un setTimeout un
      // errore non lo prende nessuno e resta un rifiuto senza padrone.
      // Qui vale la regola di sempre — un suggerimento che manca non
      // ferma chi sta compilando.
      let trovate = [];
      try { trovate = await cercaVie(scritto, comune, cap); } catch { trovate = []; }
      if (vivo) { setProposte(Array.isArray(trovate) ? trovate : []); setAperto(true); }
    }, 500);
    return () => { vivo = false; clearTimeout(t); };
  }, [scritto, comune, cap, spenta, cascata?.fuoriItalia, cercaVie, digitando]);

  // UNA PROPOSTA CHE NON AGGIUNGE NIENTE NON SI MOSTRA.
  //
  // Scritta la via per intero, la ricerca trova quella e la ripropone
  // identica: un elenco di una voce uguale a quello che si sta
  // guardando. Si tiene solo se porta un civico che nella scheda manca.
  const utili = proposte.filter((x) => {
    // SENZA COMUNE LA PROPOSTA AGGIUNGE SEMPRE QUALCOSA: porta il paese,
    // il CAP e la provincia, che sono tutto cio' che manca. Qui la
    // regola del "non aggiunge niente" la nascondeva proprio quando
    // serviva di piu' — scritta "Via Terni" per intero, le tre proposte
    // di Viterbo, Roma e Milano sparivano tutte.
    if (!comune) return true;
    if (normalizzaNome(x.via) !== normalizzaNome(scritto)) return true;
    return !!x.civico && !civico;
  });

  return (
    <div style={{ position: "relative" }}>
      <input
        data-campo={campo.chiave}
        value={scritto} disabled={spenta}
        onChange={(e) => { scrivi(campo.chiave, e.target.value.toUpperCase()); setDigitando(true); setAperto(true); }}
        // il clic su una proposta arriva DOPO il blur: senza il ritardo
        // l'elenco si chiude prima che il clic lo raggiunga
        onBlur={() => { setTimeout(() => { setAperto(false); setDigitando(false); }, 150); esceDalCampo(campo); }}
        style={stile}
      />
      {aperto && utili.length > 0 && (
        <div style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", marginTop: 2,
          background: "#FFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8,
          boxShadow: "0 6px 18px rgba(14,27,51,0.12)", overflow: "hidden",
        }}>
          {utili.map((x, i) => (
            <div
              key={`${x.via}|${x.civico}|${i}`}
              // marcata, come le tendine: cercare questa riga per il
              // testo prende il contenitore, che comincia con le stesse
              // parole, e il gesto finisce nel vuoto
              data-proposta={i}
              onMouseDown={() => {
                scrivi("indirizzo_residenza", (x.via || "").toUpperCase());
                // il civico arriva solo se la ricerca l'ha trovato: non
                // si cancella quello che qualcuno ha gia' scritto
                if (x.civico) scrivi("civico_residenza", x.civico.toUpperCase());
                // QUI SI CHIUDE IL CERCHIO: se il comune non era ancora
                // stato scelto, la proposta lo porta con se' insieme al
                // CAP, e provincia e regione escono da soli. Un tocco
                // invece di cinque.
                if (!comune) cascata?.riempiDaVia?.(x);
                setDigitando(false);
                setAperto(false);
                setProposte([]);
              }}
              style={{
                ...fontBody, fontSize: 13.5, color: NAVY, padding: "9px 11px", cursor: "pointer",
                borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`,
              }}
            >
              {x.via}{x.civico ? ` ${x.civico}` : ""}
              <span style={{ color: MUTED }}>
                {" — "}{x.comune}
                {/* la sigla si ricava dal nostro elenco, non da quello
                    della ricerca: li' la provincia di Roma si chiama
                    "Roma Capitale", e una sigla inventata e' peggio di
                    nessuna sigla */}
                {provinciaDiComune(x.comune, x.cap) ? ` (${provinciaDiComune(x.comune, x.cap)})` : ""}
                {x.cap ? ` ${x.cap}` : ""}
                {/* un CAP diverso da quello scelto si dice: non si
                    riscrive la scheda, si fa vedere che non torna */}
                {x.cap && cap && x.cap !== cap ? " ⚠︎" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Casella({ campo, valore, scrivi, esceDalCampo, venditori, spenta, cascata, cercaVie }) {
  const { chiave, tipo = "testo", maiuscolo, lunghezza, suggerimento } = campo;
  const stile = {
    ...campoAreaScheda,
    ...(maiuscolo ? { textTransform: "uppercase" } : {}),
    ...(spenta ? { background: "#F1EEE7" } : {}),
  };

  // --- data e luogo di nascita --------------------------------------
  if (tipo === "data") {
    return (
      <input
        data-campo={campo.chiave} type="date" value={valore || ""} disabled={spenta}
        onChange={(e) => scrivi(campo.chiave, e.target.value)}
        onBlur={() => esceDalCampo(campo)} style={stile}
      />
    );
  }
  if (tipo === "statoNascita") {
    // 232 Stati in una tendina: si scorre, ma e' un elenco chiuso e
    // scritto a mano darebbe "Romania", "ROMANIA" e "Rumania" come tre
    // posti diversi. Vuoto = Italia, che e' il caso normale.
    //
    // La voce vuota dice «Italia» e basta. Diceva «nata in Italia»: al
    // banco si iscrivono anche uomini — otto su 242 — e una casella che
    // da' del femminile a chiunque la apra e' sbagliata per tutti e
    // otto. Il genere qui non serve a niente, e nemmeno i trattini: il
    // campo si chiama «Stato di nascita» e la voce vuota deve dire solo
    // quale Stato.
    return (
      <Tendina
        valore={spenta ? "" : (valore || "")}
        opzioni={nomiStati().map((x) => ({ valore: x, testo: x }))}
        onCambia={(v) => { scrivi("stato_nascita", v); if (v) scrivi("comune_nascita", ""); }}
        spenta={spenta} stile={stile} vuoto="Italia" campo="stato_nascita"
      />
    );
  }
  if (tipo === "comuneNascita") {
    // Nata all'estero: il comune italiano non c'entra piu'
    const allEstero = !!String(cascata?.statoNascita || "").trim();
    return (
      <CampoComuneNascita
        chiave={campo.chiave} valore={allEstero ? "" : valore}
        scrivi={scrivi} esceDalCampo={() => esceDalCampo(campo)}
        spenta={spenta || allEstero}
        suggerimento={allEstero ? "" : "Reggio di Calabria"}
        stile={{ ...stile, ...(allEstero ? { background: "#F1EEE7" } : {}) }}
      />
    );
  }

  if (tipo === "via") {
    return <CampoVia
      valore={spenta ? "" : valore} scrivi={scrivi} esceDalCampo={esceDalCampo}
      campo={campo} stile={stile} cascata={cascata} cercaVie={cercaVie} spenta={spenta} />;
  }

  // --- i gradini della residenza -------------------------------------
  if (tipo === "stato") {
    const fuori = cascata?.fuoriItalia;
    return (
      <>
        <Tendina
          valore={spenta ? "" : (fuori ? "ALTRO" : "ITALIA")}
          opzioni={[{ valore: "ITALIA", testo: "Italia" }, { valore: "ALTRO", testo: "Altro stato" }]}
          onCambia={(v) => cascata.scegliStato(v)}
          spenta={spenta} stile={stile} vuoto="— scegli —" campo="stato_residenza"
        />
        {/* Fuori Italia la regione e la provincia non esistono: il nome
            dello stato si scrive, ed e' l'unica cosa che si scrive. */}
        {fuori && !spenta && (
          <input
            value={valore || ""}
            placeholder="Svizzera, Francia…"
            onChange={(e) => scrivi("stato_residenza", e.target.value.toUpperCase())}
            onBlur={() => esceDalCampo(campo)}
            style={{ ...stile, marginTop: 6 }}
          />
        )}
      </>
    );
  }
  if (tipo === "regione" || tipo === "provincia" || tipo === "comune" || tipo === "cap") {
    if (cascata?.fuoriItalia) {
      // la regione italiana di un indirizzo estero non vuol dire niente
      if (tipo === "regione") return <div style={{ ...stile, color: MUTED }}>—</div>;
      return (
        <input
          value={valore || ""} disabled={spenta}
          onChange={(e) => scrivi(campo.chiave, e.target.value.toUpperCase())}
          onBlur={() => esceDalCampo(campo)}
          style={stile}
        />
      );
    }
    const c = cascata || {};
    if (tipo === "regione") {
      return <Tendina
        valore={spenta ? "" : c.regione}
        opzioni={REGIONI.map((r) => ({ valore: r, testo: r }))}
        onCambia={c.scegliRegione} spenta={spenta} stile={stile}
        vuoto="— scegli la regione —" campo="regione_residenza" />;
    }
    if (tipo === "provincia") {
      const opz = (c.regione ? provinceDiRegione(c.regione) : []).map((p) => ({ valore: p.sigla, testo: `${p.nome} (${p.sigla})` }));
      // la provincia mostrata e' quella della cascata, non solo quella
      // in archivio: su una scheda vecchia e' ricavata dal comune, e se
      // qui si guardasse solo l'archivio resterebbe vuota
      return <Tendina
        valore={spenta ? "" : (c.provincia || "")}
        opzioni={conFuoriElenco(opz, spenta ? "" : c.provincia)}
        onCambia={c.scegliProvincia} spenta={spenta || !c.regione} stile={stile}
        vuoto={c.regione ? "— scegli la provincia —" : "prima la regione"} campo="prov_residenza" />;
    }
    if (tipo === "comune") {
      const opz = (valore || c.provincia ? comuniDiProvincia(c.provincia) : []).map((x) => ({ valore: x, testo: x }));
      return <Tendina
        valore={spenta ? "" : (c.comuneScelto || "")}
        opzioni={conFuoriElenco(opz, spenta ? "" : valore)}
        onCambia={c.scegliComune} spenta={spenta || !c.provincia} stile={stile}
        vuoto={c.provincia ? "— scegli il comune —" : "prima la provincia"} campo="citta_residenza" />;
    }
    const opz = (c.capDisponibili || []).map((x) => ({ valore: x, testo: x }));
    return <Tendina
      valore={spenta ? "" : (valore || "")}
      opzioni={conFuoriElenco(opz, spenta ? "" : valore)}
      onCambia={(v) => scrivi("cap_residenza", v)}
      spenta={spenta || !c.comuneScelto} stile={stile}
      vuoto={c.comuneScelto ? "— scegli il CAP —" : "prima il comune"} campo="cap_residenza" />;
  }

  if (tipo === "scelta") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {campo.opzioni.map((o) => {
          const scelto = valore === o.valore;
          return (
            <button
              key={o.valore} type="button" disabled={spenta}
              data-campo={chiave} data-valore={o.valore}
              onClick={() => { scrivi(chiave, o.valore); esceDalCampo(campo); }}
              style={{
                ...fontBody, flex: 1, minHeight: 40, borderRadius: 10,
                cursor: spenta ? "default" : "pointer", fontSize: 13, fontWeight: 700,
                background: scelto ? NAVY : "#fff",
                color: scelto ? "#fff" : NAVY,
                border: `1px solid ${scelto ? NAVY : CREAM_BORDER}`,
              }}
            >
              {o.etichetta}
            </button>
          );
        })}
      </div>
    );
  }

  if (tipo === "venditori") {
    return (
      <select
        value={valore || ""} disabled={spenta}
        onChange={(e) => scrivi(chiave, e.target.value)}
        style={stile}
      >
        <option value="">— scegli venditore —</option>
        {(venditori || []).map((v) => <option key={v.id} value={v.nome.toUpperCase()}>{v.nome.toUpperCase()}</option>)}
        {/* valore già presente ma non (più) in elenco: resta visibile
            invece di sparire silenziosamente */}
        {valore && !(venditori || []).some((v) => v.nome.toUpperCase() === String(valore).toUpperCase()) && (
          <option value={valore}>{valore} (non in elenco)</option>
        )}
      </select>
    );
  }

  return (
    <input
      value={valore || ""} disabled={spenta}
      maxLength={lunghezza}
      placeholder={suggerimento}
      // il suggerimento in grigio chiaro: vedi la regola in index.html
      className="suggerimento-chiaro"
      inputMode={tipo === "telefono" ? "tel" : undefined}
      // IL RIEMPIMENTO AUTOMATICO DEL BROWSER STA FUORI DA QUI.
      //
      // Questi campi non sono i dati di chi usa l'app: sono quelli
      // dell'allieva che ha davanti. Lasciati liberi, il browser e il
      // gestore di password ci mettono i dati del titolare dell'account e
      // indovinano male — e' cosi' che nome e cognome si sono trovati
      // invertiti in una scheda vera. I due `data-` non sono standard: li
      // leggono LastPass e 1Password, che `autoComplete="off"` da solo non
      // fermerebbe.
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize={maiuscolo ? "characters" : "off"}
      spellCheck={false}
      data-lpignore="true"
      data-form-type="other"
      // ogni casella porta la sua chiave: e' l'unico modo di ritrovarla
      // in una prova senza dipendere da quante righe ci sono sopra
      data-campo={chiave}
      onChange={(e) => {
        let t = e.target.value;
        if (maiuscolo) t = t.toUpperCase();
        // IL CODICE FISCALE HA UNA FORMA, E LA CASELLA LA FA RISPETTARE.
        // Vale anche sull'incollatura, che e' come la maggioranza lo
        // scrive: `onChange` scatta anche li'.
        if (chiave === "codice_fiscale") t = filtraCodiceFiscale(t);
        if (lunghezza) t = t.slice(0, lunghezza);
        scrivi(chiave, t);
      }}
      onBlur={() => esceDalCampo(campo)}
      style={stile}
    />
  );
}

export function AreaAnagrafica({
  area, icona, valori = {}, scrivi = () => {}, autosalva = () => {},
  normalizzaTelefono = (x) => x, venditori = [],
  // La ricerca della via arriva da fuori: cosi' questo componente non
  // sa niente di Photon ne' del client Supabase, e la pagina delle
  // impostazioni lo monta senza portarsi dietro una ricerca in rete.
  cercaVie = null,
  // modalita' configurazione
  configurazione = false, acceso = () => true, obbligatorio = () => false,
  onCambiaIncluso = () => {}, onCambiaObbligo = () => {}, inAttesa = "",
  // chi non amministra la pagina la guarda: le spunte si vedono ma non
  // si toccano. Senza questo restavano cliccabili e tornavano indietro
  // da sole, che sembra un difetto dell'app.
  modificabile = true,
  stileArea = null,
  // Quale scheda si sta guardando. Serve a una cosa sola: azzerare la
  // regione scelta a mano quando si passa a un'altra iscritta, o
  // resterebbe li' a indicare una regione che non e' la sua.
  chiaveScheda = null,
}) {
  // IL CODICE FISCALE SI CALCOLA, MA NON SI IMPONE.
  //
  // Riempie la casella solo quando e' VUOTA, e una volta sola per ogni
  // valore calcolato: se chi compila lo cancella, resta cancellato.
  // Serve per l'omocodia — quando due persone otterrebbero lo stesso
  // codice l'Agenzia ne cambia alcune cifre, e un calcolo non puo'
  // saperlo. Quindi il calcolo e' una proposta, scritta e correggibile,
  // e si dichiara sotto la casella.
  const [codiceProposto, setCodiceProposto] = useState("");
  useEffect(() => { setCodiceProposto(""); }, [chiaveScheda]);
  const codiceScritto = (valori.codice_fiscale || "").trim();
  useEffect(() => {
    if (configurazione) return;
    if (codiceScritto) return;
    const calcolato = calcolaCodiceFiscale({
      cognome: valori.cognome, nome: valori.nome, sesso: valori.sesso,
      dataNascita: valori.data_nascita,
      comuneNascita: valori.comune_nascita, statoNascita: valori.stato_nascita,
    });
    if (!calcolato || calcolato === codiceProposto) return;
    setCodiceProposto(calcolato);
    scrivi("codice_fiscale", calcolato);
    autosalva();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurazione, codiceScritto, valori.cognome, valori.nome, valori.sesso,
      valori.data_nascita, valori.comune_nascita, valori.stato_nascita]);

  function esceDalCampo(campo) {
    if (configurazione) return;
    if (campo.tipo === "telefono") scrivi(campo.chiave, normalizzaTelefono(valori[campo.chiave] || ""));
    if (campo.salvaUscendo || campo.tipo === "scelta") autosalva();
  }

  // LA CASCATA DELLA RESIDENZA.
  //
  // La regione non sta in archivio: si ricava dalla provincia, ed e'
  // giusto cosi' — due colonne per la stessa cosa prima o poi si
  // contraddicono. Resta da tenere a mente solo il caso in cui la
  // regione e' stata scelta e la provincia no: quello vive qui, e dura
  // il tempo di scegliere.
  const [regioneScelta, setRegioneScelta] = useState("");
  const [altroStato, setAltroStato] = useState(false);
  useEffect(() => { setRegioneScelta(""); setAltroStato(false); }, [chiaveScheda]);

  // LA PROVINCIA MANCANTE SI RICAVA DAL COMUNE, O LA CASCATA NASCONDE
  // QUELLO CHE C'E' GIA'. Una scheda vecchia con «SORSO» e la provincia
  // vuota — e ce ne sono — aprirebbe la tendina dei comuni spenta, e di
  // quella residenza non si vedrebbe piu' niente. Qui si ricava per
  // mostrarla; in archivio ci finisce solo quando qualcuno conferma il
  // comune, non di nascosto.
  const provScritta = (valori.prov_residenza || "").trim().toUpperCase();
  const provincia = provScritta
    || provinciaDiComune(valori.citta_residenza, valori.cap_residenza);
  const statoScritto = (valori.stato_residenza || "").trim();
  const fuoriItalia = altroStato || (statoScritto !== "" && normalizzaNome(statoScritto) !== "ITALIA");
  const regione = regioneDiProvincia(provincia) || regioneScelta;
  const comuni = provincia ? comuniDiProvincia(provincia) : [];
  const comuneInArchivio = (valori.citta_residenza || "").trim();
  // il comune si riconosce senza badare ad accenti e maiuscole: in
  // archivio c'e' "PATERNO", nell'elenco "Paternò", ed e' lo stesso posto
  const comuneScelto = comuni.find((x) => normalizzaNome(x) === normalizzaNome(comuneInArchivio)) || comuneInArchivio;
  const capDisponibili = comuneScelto ? capDiComune(provincia, comuneScelto) : [];

  const cascata = {
    regione, provincia, comuneScelto, capDisponibili, fuoriItalia,
    statoNascita: (valori.stato_nascita || "").trim(),
    cap: (valori.cap_residenza || "").trim(),
    civico: (valori.civico_residenza || "").trim(),
    scegliStato(v) {
      if (v === "ALTRO") {
        setAltroStato(true); setRegioneScelta("");
        // una sigla italiana sotto un indirizzo svizzero non vuol dire
        // niente: va via con la scelta, non dopo
        scrivi("prov_residenza", ""); scrivi("stato_residenza", "");
      } else {
        setAltroStato(false); scrivi("stato_residenza", v ? "ITALIA" : "");
      }
      autosalva();
    },
    scegliRegione(v) {
      setRegioneScelta(v);
      // cambiata la regione, quello che stava sotto non vale piu'
      scrivi("prov_residenza", ""); scrivi("citta_residenza", ""); scrivi("cap_residenza", "");
      autosalva();
    },
    scegliProvincia(v) {
      scrivi("prov_residenza", v);
      scrivi("citta_residenza", ""); scrivi("cap_residenza", "");
      autosalva();
    },
    // Dalla proposta della ricerca ai campi della scheda.
    //
    // Il comune e il CAP arrivano da fuori, ma provincia e nome
    // ufficiale si risolvono contro il dataset ISTAT che spediamo gia':
    // cosi' la tendina dei comuni trova il suo valore e non resta
    // "fuori elenco", e la provincia e' quella vera e non "Roma
    // Capitale".
    riempiDaVia(proposta) {
      const sigla = provinciaDiComune(proposta?.comune, proposta?.cap);
      const ufficiale = sigla
        ? comuniDiProvincia(sigla).find((x) => normalizzaNome(x) === normalizzaNome(proposta?.comune))
        : null;
      if (sigla) scrivi("prov_residenza", sigla);
      scrivi("citta_residenza", ufficiale || (proposta?.comune || ""));
      if (proposta?.cap) scrivi("cap_residenza", proposta.cap);
      // se lo Stato non era stato toccato, una via italiana lo dice
      if (!statoScritto) scrivi("stato_residenza", "ITALIA");
      autosalva();
    },
    scegliComune(v) {
      scrivi("citta_residenza", v);
      // se la provincia era solo ricavata, scegliendo il comune la si
      // conferma: da qui in poi e' un dato, non una deduzione
      if (!provScritta && provincia) scrivi("prov_residenza", provincia);
      // Un comune su 7904 ne ha uno solo in 7860 casi: scriverlo da se'
      // risparmia un gesto che non ha alternative. Dove i CAP sono
      // tanti — Roma ne ha 82 — la scelta resta.
      const caps = v ? capDiComune(provincia, v) : [];
      scrivi("cap_residenza", caps.length === 1 ? caps[0] : "");
      autosalva();
    },
  };

  return (
    <div style={stileArea || { ...areaSchedaIscritto, flex: 1 }}>
      <IntestazioneArea Icona={icona}>{area.titolo}</IntestazioneArea>
      {area.righe.map((riga, i) => (
        <div
          key={i}
          style={{
            display: "flex", gap: 14,
            ...(riga.aCapo === false ? {} : { flexWrap: "wrap" }),
            ...(riga.inBasso ? { alignItems: "flex-end" } : {}),
          }}
        >
          {riga.campi.map((campo) => {
            const va = configurazione ? acceso(campo.chiave) : true;
            return (
              <div key={campo.chiave} style={{ flex: campo.larghezza, minWidth: 0, ...(va ? null : SMORZATO) }}>
                <div style={{ position: "relative" }}>
                  {configurazione && (
                    <Spunta
                      chiave={campo.chiave} acceso={va}
                      obbligatorio={obbligatorio(campo.chiave)}
                      inAttesa={inAttesa === campo.chiave}
                      modificabile={modificabile}
                      onCambiaIncluso={onCambiaIncluso}
                      onCambiaObbligo={onCambiaObbligo}
                    />
                  )}
                  <Field
                    label={configurazione ? campo.etichetta : <EtichettaVenditore campo={campo} />}
                    // LE CASELLE DI UNA RIGA PARTONO TUTTE DALLA STESSA
                    // ALTEZZA. «opzionale» va a capo da se' su «Stato» e
                    // «Provincia» e non su «Regione», che e' piu' corta:
                    // tre etichette alte diverse, e le tre tendine
                    // sfalsate di mezza riga l'una dall'altra. Qui si
                    // riserva lo spazio di due righe a tutte, cosi' quello
                    // che sta sotto comincia allo stesso punto — anche
                    // sulle quattro etichette con l'asterisco, che di
                    // righe ne occupano una sola.
                    //
                    // Solo dove le caselle sono affiancate: su una riga
                    // da sola non c'e' niente con cui allinearsi, e la
                    // riga vuota sarebbe spazio e basta.
                    minLabelHeight={!configurazione && riga.campi.length > 1 ? 28 : undefined}
                  >
                    <Casella
                      campo={campo}
                      valore={configurazione ? "" : valori[campo.chiave]}
                      scrivi={scrivi}
                      esceDalCampo={esceDalCampo}
                      venditori={venditori}
                      spenta={configurazione}
                      cascata={cascata}
                      cercaVie={configurazione ? null : cercaVie}
                    />
                  </Field>
                  {/* in configurazione le caselle sono vuote per forza:
                      li' un avviso sulla lunghezza non vorrebbe dire niente */}
                  {!configurazione && avvisoCampo(campo, valori[campo.chiave], valori) && (
                    <div style={{ ...fontBody, fontSize: 11, color: "#8A6A1B", marginTop: 3, lineHeight: 1.4 }}>
                      {avvisoCampo(campo, valori[campo.chiave], valori)}
                    </div>
                  )}
                  {/* il codice calcolato lo dice: chi guarda la scheda
                      deve sapere che quello non l'ha scritto nessuno */}
                  {!configurazione && campo.chiave === "codice_fiscale"
                    && codiceProposto && codiceScritto === codiceProposto && (
                    <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>
                      Calcolato da data e luogo di nascita. Controllalo sul documento: se è un codice da omocodia, correggilo a mano.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// L'ETICHETTA NELLA SCHEDA DEL VENDITORE.
//
// Quattro campi hanno l'asterisco rosso e senza di loro non si salva;
// tutti gli altri dicono "opzionale", perche' il guasto da cui si viene
// e' che il venditore non riusciva a salvare un'iscrizione presa in
// fiera con mezzo pacchetto ancora da decidere, e non capiva perche'.
//
// Nella pagina di configurazione questa roba non compare: li' gli
// asterischi vogliono dire un'altra cosa — cosa deve riempire l'allieva
// — e due significati sullo stesso segno sarebbero peggio di niente.
function EtichettaVenditore({ campo }) {
  const serve = OBBLIGATORI_VENDITORE.includes(campo.chiave);
  const nota = NOTA_VENDITORE[campo.chiave];
  return (
    <span>
      {campo.etichetta}
      {serve && <span style={{ color: "#B3261E", fontWeight: 700 }}> *</span>}
      {/* «opzionale» su una riga sua, sempre. Lasciato in coda al nome
          andava a capo solo quando non ci stava, cioe' su alcune
          etichette si' e su altre no, e la stessa riga finiva con le
          caselle a tre altezze diverse. Una regola che vale sempre non
          dipende da quanto e' larga la finestra. */}
      {!serve && (
        <span style={{ display: "block", color: CREAM_BORDER, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          {nota || "opzionale"}
        </span>
      )}
    </span>
  );
}

// la spunta e l'asterisco, appoggiati nell'angolo in alto a destra del
// campo: non entrano nel flusso, quindi non allargano l'etichetta ne'
// alzano la riga.
function Spunta({ chiave, acceso, obbligatorio, inAttesa, modificabile = true, onCambiaIncluso, onCambiaObbligo }) {
  return (
    <span
      style={{
        position: "absolute", top: -2, right: 0, zIndex: 2,
        display: "inline-flex", alignItems: "center", gap: 3,
        background: "#FDFBF6", borderRadius: 5, padding: "0 2px",
      }}
    >
      <input
        type="checkbox" checked={acceso} disabled={inAttesa || !modificabile}
        onChange={() => onCambiaIncluso(chiave)}
        title={!modificabile ? "La scelta la cambia chi amministra" : acceso ? "Va sul modulo dell'allieva" : "Non viene trasferito"}
        style={{ width: 13, height: 13, margin: 0, cursor: modificabile ? "pointer" : "default", accentColor: NAVY }}
      />
      <span
        onClick={() => acceso && modificabile && onCambiaObbligo(chiave)}
        title={!modificabile
          ? "La scelta la cambia chi amministra"
          : !acceso
          ? "Il campo non va sul modulo"
          : obbligatorio
            ? "Obbligatorio: se il venditore lo lascia vuoto, l'allieva deve riempirlo per poter spedire"
            : "Facoltativo: può restare vuoto e il modulo si spedisce lo stesso"}
        style={{
          cursor: acceso && modificabile ? "pointer" : "default", fontSize: 13, lineHeight: 1, fontWeight: 700,
          color: !acceso ? CREAM_BORDER : obbligatorio ? "#B3261E" : MUTED,
          userSelect: "none", width: 8, textAlign: "center",
        }}
      >
        *
      </span>
    </span>
  );
}

export default AreaAnagrafica;
