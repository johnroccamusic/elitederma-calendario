// UN ELENCO LUNGO SI CERCA, NON SI SCORRE.
//
// Gli Stati sono 232 e stavano in una tendina sola: aperta sul
// telefono, per arrivare alla Svizzera si scorrevano duecento righe —
// e la Svizzera e' la seconda voce, quindi per il Portogallo si
// scorreva davvero fino in fondo. Il titolare, provandola: «metti la
// barra di ricerca dove posso scrivere almeno qualche lettera, per non
// farmi scorrere tutta la lista».
//
// Qui si scrive e sotto compaiono le voci che c'entrano, come fa gia'
// il comune di nascita (CampoComune.jsx). La differenza, che e' tutta:
// LI' QUELLO CHE SI SCRIVE E' IL VALORE, qui e' solo un filtro. Questo
// e' un elenco CHIUSO: finche' non si tocca una voce non si e' scelto
// niente, e «SVIZERA» battuto a mano non diventa un paese.
//
// Niente rete: l'elenco l'app se lo porta dietro.
import React, { useState } from "react";
import { normalizzaLuogo } from "../comuni-regioni.js";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "../ui/stile.js";

// Dodici righe: quante ne stanno sullo schermo di un telefono senza
// doverle scorrere. Oltre, si scrive un'altra lettera.
const QUANTE = 12;

// Si cerca come si scrive, con la stessa regola dei comuni: ogni parola
// scritta dev'essere l'inizio di una parola del nome. Cosi' «sud af»
// trova «Sudafrica» e «arab sa» trova «Arabia Saudita», e gli accenti
// e le maiuscole non vanno saputi.
export function filtraVoci(voci, scritto, quante = QUANTE) {
  const parole = normalizzaLuogo(scritto).split(" ").filter(Boolean);
  if (!parole.length) return voci.slice(0, quante);
  // SI CERCA ANCHE PER SIGLA. `normalizzaLuogo` butta via quello che sta
  // fra parentesi — serve per i nomi dei comuni — e cosi' «Valais /
  // Wallis (VS)» perdeva proprio la sigla, che e' quella che uno
  // scrive. Il valore della voce entra nel testo da cercare: per i
  // cantoni e le province e' la sigla, per le altre e' quello che e'
  // gia' scritto nel nome e non cambia niente.
  const trovate = voci.filter((v) => {
    const parti = `${normalizzaLuogo(v.testo)} ${normalizzaLuogo(v.valore)}`.split(" ").filter(Boolean);
    return parole.every((p) => parti.some((d) => d.startsWith(p)));
  });
  // chi comincia con quello che si e' scritto viene prima: scrivendo
  // «ita» si vuole Italia, non «Repubblica Democratica...»
  const primo = parole[0];
  trovate.sort((a, b) => {
    const da = normalizzaLuogo(a.testo).startsWith(primo) ? 0 : 1;
    const db = normalizzaLuogo(b.testo).startsWith(primo) ? 0 : 1;
    return da - db || a.testo.length - b.testo.length;
  });
  return trovate.slice(0, quante);
}

export default function CampoCerca({
  chiave, valore, voci = [], onScegli, stile, spenta = false,
  vuoto = "— scegli —",
  // CHIUSA, LA CASELLA PUO' MOSTRARE IL VALORE INVECE DEL TESTO.
  // Serve ai prefissi telefonici, dove lo stesso «+1» appartiene a
  // venti paesi: scegliendo «Canada +1» e riaprendo la scheda si
  // leggerebbe il primo paese con quel prefisso, cioe' una bugia.
  // Chiusa dice «+1», che e' l'unica cosa che sappiamo davvero;
  // aperta, l'elenco mostra i nomi e si cerca per nome o per cifre.
  mostraValore = false,
}) {
  const [aperto, setAperto] = useState(false);
  const [scritto, setScritto] = useState("");
  const scelta = voci.find((v) => String(v.valore) === String(valore || ""));
  // chiusa, la casella mostra quello che si e' scelto; aperta, quello
  // che si sta scrivendo per cercarlo
  const mostrato = aperto ? scritto : (scelta ? (mostraValore ? scelta.valore : scelta.testo) : "");
  const proposte = aperto && !spenta ? filtraVoci(voci, scritto) : [];

  function chiudi() { setAperto(false); setScritto(""); }

  return (
    <div style={{ position: "relative" }}>
      <input
        data-campo={chiave}
        value={mostrato}
        disabled={spenta}
        placeholder={spenta ? "" : (aperto ? "Scrivi le prime lettere…" : vuoto)}
        className="suggerimento-chiaro"
        autoComplete="off"
        onFocus={() => { setAperto(true); setScritto(""); }}
        onChange={(e) => { setAperto(true); setScritto(e.target.value); }}
        // il tocco su una proposta arriva DOPO il blur: senza il ritardo
        // l'elenco si chiude prima che il dito lo raggiunga
        onBlur={() => setTimeout(chiudi, 150)}
        style={stile}
      />
      {aperto && !spenta && (
        <div style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", marginTop: 2,
          background: "#FFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8,
          boxShadow: "0 6px 18px rgba(14,27,51,0.12)",
          maxHeight: 320, overflowY: "auto",
        }}>
          {proposte.map((v, i) => (
            <div
              key={`${v.valore}`}
              data-proposta={i}
              data-valore={v.valore}
              // `mousedown` e non `click`: il blur della casella arriva
              // prima del clic e chiuderebbe l'elenco a mezz'aria
              onMouseDown={() => { onScegli?.(v.valore); chiudi(); }}
              style={{
                ...fontBody, fontSize: 14, color: NAVY, padding: "11px 11px", cursor: "pointer",
                borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`,
              }}
            >
              {v.testo}
            </div>
          ))}
          {/* QUELLO CHE NON SI VEDE VA DETTO: dodici righe su
              duecentotrentadue sembrano l'elenco intero, e chi non
              trova il suo paese crede che non ci sia. */}
          {proposte.length === 0 && (
            <div style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "11px 11px" }}>
              Nessuna voce con queste lettere.
            </div>
          )}
          {proposte.length === QUANTE && (
            <div style={{
              ...fontBody, fontSize: 12, color: MUTED, padding: "8px 11px",
              borderTop: `1px solid ${CREAM_BORDER}`, background: "#FBF9F4",
            }}>
              Ce ne sono altre: scrivi un'altra lettera.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
