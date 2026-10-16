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
import React from "react";
import { Field } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "../ui/stile.js";
import { OBBLIGATORI_VENDITORE, NOTA_VENDITORE } from "./disposizione.js";

// un campo escluso dal modulo non si nasconde: resta dov'e', solo
// smorzato. Chi guarda la pagina deve vedere la scheda intera e capire
// a colpo d'occhio cosa parte e cosa no.
const SMORZATO = { opacity: 0.45 };

function Casella({ campo, valore, scrivi, esceDalCampo, venditori, spenta }) {
  const { chiave, tipo = "testo", maiuscolo, lunghezza, suggerimento } = campo;
  const stile = {
    ...campoAreaScheda,
    ...(maiuscolo ? { textTransform: "uppercase" } : {}),
    ...(spenta ? { background: "#F1EEE7" } : {}),
  };

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
      inputMode={tipo === "telefono" ? "tel" : undefined}
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
}) {
  function esceDalCampo(campo) {
    if (configurazione) return;
    if (campo.tipo === "telefono") scrivi(campo.chiave, normalizzaTelefono(valori[campo.chiave] || ""));
    if (campo.salvaUscendo || campo.tipo === "scelta") autosalva();
  }

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
                    />
                  </Field>
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
