// LA CASELLA DEL TELEFONO: prefisso che si scegli, numero che si scrive.
//
// Il prefisso parte da quello del paese di residenza — che sta due
// righe sopra, nella stessa scheda — e si puo' sempre cambiare: chi
// vive in Svizzera puo' avere un numero italiano, e chi vive in Italia
// un numero straniero.
//
// IN ARCHIVIO RESTA UNA STRINGA SOLA, «+41791234567»: la tendina legge
// e riscrive quella (vedi prefissi-telefonici.js). Nessuna colonna
// nuova, nessuna migrazione, e i numeri gia' scritti si riaprono come
// sono.
import React from "react";
import CampoCerca from "./CampoCerca.jsx";
import { separaPrefisso, componiTelefono, vociPrefisso } from "../prefissi-telefonici.js";

export default function CampoTelefono({
  chiave, valore, statoResidenza, spenta = false, stile = {},
  suggerimento = "333 1234567",
  onCambia = () => {}, onEsce = () => {},
}) {
  const { prefisso: daArchivio, numero } = separaPrefisso(valore, statoResidenza);
  const voci = React.useMemo(() => vociPrefisso(statoResidenza), [statoResidenza]);

  // IL PREFISSO SCELTO SI RICORDA ANCHE A NUMERO VUOTO.
  //
  // In archivio va una stringa sola, e senza cifre quella stringa e'
  // vuota: quindi scegliere «Francia +33» PRIMA di scrivere il numero
  // non lasciava traccia, la casella tornava al prefisso della
  // residenza e il numero battuto dopo nasceva col paese sbagliato.
  // Chi compila fa esattamente quel gesto: prima il paese, poi il
  // numero.
  //
  // Quando le cifre ci sono comanda l'archivio — e' il dato vero; nel
  // frattempo vale la scelta fatta qui, che resta anche cancellando il
  // numero (altrimenti svuotare la casella riporterebbe il prefisso
  // indietro senza che nessuno l'abbia chiesto).
  const [scelto, setScelto] = React.useState(null);
  const prefisso = numero ? daArchivio : (scelto || daArchivio);

  // UN NUMERO INCOLLATO PER INTERO SPOSTA ANCHE IL PREFISSO. Chi copia
  // un contatto incolla «+41 79 123 45 67» dentro la casella del
  // numero: senza questo, quel «+41» verrebbe buttato via dal filtro
  // delle cifre e il numero resterebbe attaccato al prefisso sbagliato.
  function scriviNumero(testo) {
    const grezzo = String(testo || "");
    if (grezzo.trim().startsWith("+") || grezzo.replace(/\D/g, "").startsWith("00")) {
      const pezzi = separaPrefisso(grezzo, statoResidenza);
      if (pezzi.prefisso) {
        setScelto(pezzi.prefisso);
        return onCambia(componiTelefono(pezzi.prefisso, pezzi.numero));
      }
    }
    setScelto(prefisso);
    onCambia(componiTelefono(prefisso, grezzo));
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      {/* stretto quanto basta a «+1264», che e' il piu' lungo */}
      <div style={{ flex: "0 0 96px", minWidth: 0 }}>
        <CampoCerca
          chiave={`${chiave}_prefisso`}
          valore={prefisso}
          voci={voci}
          mostraValore
          spenta={spenta}
          vuoto="+--"
          onScegli={(p) => { setScelto(p); onCambia(componiTelefono(p, numero)); }}
          stile={{ ...stile, textAlign: "center" }}
        />
      </div>
      <input
        data-campo={chiave}
        value={numero}
        disabled={spenta}
        placeholder={spenta ? "" : suggerimento}
        className="suggerimento-chiaro"
        inputMode="tel"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-form-type="other"
        onChange={(e) => scriviNumero(e.target.value)}
        onBlur={onEsce}
        style={{ ...stile, flex: "1 1 auto", minWidth: 0 }}
      />
    </div>
  );
}
