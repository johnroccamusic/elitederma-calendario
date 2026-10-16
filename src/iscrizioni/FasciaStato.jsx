// LA FASCIA DELLO STATO: tre pallini collegati, uno acceso.
//
// Sta sulla striscia di ogni iscritto, cosi' si legge senza aprire la
// scheda — che e' il punto: un'iscrizione ferma in attesa del modulo
// deve saltare all'occhio scorrendo l'elenco, non dopo tre clic.
//
// Il pallino acceso e' quello dello stato attuale, e la linea che ci
// ARRIVA e' colorata: si vede da dove si e' passati. "Confermato" e'
// taupe e sta zitto; gli altri due sono ocra e blu, e si vedono.
//
// Su schermo stretto le etichette sparirebbero una sull'altra (tre
// parole in fila non stanno in 375 px), quindi resta solo quella del
// pallino acceso: tanto e' l'unica che serve leggere.
import React from "react";
import { STATI, ORDINE } from "./stato.js";

const GRIGIO = "#CFC9BE";
const GRIGIO_SCURO = "#8C8578";

function IconaAereo({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21.4 3.1 2.9 10.3c-.9.4-.8 1.6.1 1.9l4.6 1.4 1.7 5.1c.3.8 1.4.9 1.9.2l2.3-3 4.4 3.3c.7.5 1.7.1 1.9-.7l2.6-13.6c.2-1-.8-1.8-1-1.8Z" />
    </svg>
  );
}
function IconaFoglio({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
function IconaSpunta({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}
const ICONE = { modulo_inviato: IconaAereo, modulo_ricevuto: IconaFoglio, confermato: IconaSpunta };

export default function FasciaStato({ stato, compatto = false, larghezzaMax = 330 }) {
  const attuale = STATI[stato] ? stato : "modulo_inviato";
  const indice = ORDINE.indexOf(attuale);
  const colore = STATI[attuale].colore;
  const palla = compatto ? 24 : 32;
  const icona = compatto ? 12 : 15;

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start",
        width: "100%", maxWidth: larghezzaMax, minWidth: 0,
        fontFamily: "'Roboto',sans-serif",
      }}
    >
      {ORDINE.map((chiave, i) => {
        const acceso = i === indice;
        const Icona = ICONE[chiave];
        // la linea che ARRIVA a questo pallino: colorata se ci siamo
        // passati o ci siamo adesso
        const lineaAccesa = i > 0 && i <= indice;
        return (
          <React.Fragment key={chiave}>
            {i > 0 && (
              <div
                aria-hidden
                style={{
                  flex: "1 1 0", minWidth: 8, height: 3, borderRadius: 2,
                  background: lineaAccesa ? colore : GRIGIO,
                  marginTop: palla / 2 - 1.5,
                  opacity: lineaAccesa ? 1 : 0.6,
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 0 }}>
              <div
                title={STATI[chiave].etichetta}
                style={{
                  width: palla, height: palla, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: acceso ? colore : GRIGIO,
                  boxShadow: acceso ? `0 0 0 ${compatto ? 3 : 5}px ${STATI[chiave].sfondo}` : "none",
                  flex: "0 0 auto",
                }}
              >
                <Icona size={icona} color={acceso ? "#fff" : GRIGIO_SCURO} />
              </div>
              {(!compatto || acceso) && (
                <div
                  style={{
                    fontSize: compatto ? 10.5 : 11.5,
                    fontWeight: acceso ? 700 : 500,
                    color: acceso ? colore : GRIGIO_SCURO,
                    marginTop: 5, whiteSpace: "nowrap", lineHeight: 1.2,
                  }}
                >
                  {STATI[chiave].etichetta}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// La versione minuscola: una pastiglia con pallino e parola, per quando
// la fascia intera non ci sta (dentro la scheda, accanto al titolo).
export function PastigliaStato({ stato }) {
  const attuale = STATI[stato] ? stato : "modulo_inviato";
  const s = STATI[attuale];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: s.sfondo, color: s.colore,
        border: `1px solid ${s.colore}33`,
        borderRadius: 999, padding: "4px 10px",
        fontFamily: "'Roboto',sans-serif", fontSize: 12, fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.colore, flex: "0 0 auto" }} />
      {s.etichetta}
    </span>
  );
}
