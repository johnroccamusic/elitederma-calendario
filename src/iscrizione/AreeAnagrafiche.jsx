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
  provinciaDiComune,
} from "../comuni-regioni.js";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "../ui/stile.js";
import { OBBLIGATORI_VENDITORE, NOTA_VENDITORE, avvisoLunghezza } from "./disposizione.js";

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

function Casella({ campo, valore, scrivi, esceDalCampo, venditori, spenta, cascata }) {
  const { chiave, tipo = "testo", maiuscolo, lunghezza, suggerimento } = campo;
  const stile = {
    ...campoAreaScheda,
    ...(maiuscolo ? { textTransform: "uppercase" } : {}),
    ...(spenta ? { background: "#F1EEE7" } : {}),
  };

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
      onChange={(e) => {
        let t = e.target.value;
        if (maiuscolo) t = t.toUpperCase();
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
                  <Field label={configurazione ? campo.etichetta : <EtichettaVenditore campo={campo} />}>
                    <Casella
                      campo={campo}
                      valore={configurazione ? "" : valori[campo.chiave]}
                      scrivi={scrivi}
                      esceDalCampo={esceDalCampo}
                      venditori={venditori}
                      spenta={configurazione}
                      cascata={cascata}
                    />
                  </Field>
                  {/* in configurazione le caselle sono vuote per forza:
                      li' un avviso sulla lunghezza non vorrebbe dire niente */}
                  {!configurazione && avvisoLunghezza(campo, valori[campo.chiave]) && (
                    <div style={{ ...fontBody, fontSize: 11, color: "#8A6A1B", marginTop: 3, lineHeight: 1.4 }}>
                      {avvisoLunghezza(campo, valori[campo.chiave])}
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
      {!serve && (
        <span style={{ color: CREAM_BORDER, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          {" "}{nota || "opzionale"}
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
