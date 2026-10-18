// LA FASCIA DELLO STATO: quattro pallini collegati, uno acceso.
//
// Sta sulla striscia di ogni iscritto, cosi' si legge senza aprire la
// scheda — che e' il punto: un'iscrizione ferma in attesa del modulo
// deve saltare all'occhio scorrendo l'elenco, non dopo tre clic.
//
// VERDE QUELLO CHE C'E', ROSSO QUELLO CHE MANCA.
//
// Scorrendo un elenco di dieci allievi non interessa "a che punto e'
// questa": interessa cosa manca. Quindi le tappe gia' fatte — compresa
// quella di adesso — sono verdi, e quelle che si aspettano ancora sono
// rosse. Il pallino di ADESSO si riconosce dall'alone intorno e dalla
// scritta in grassetto, non da un colore suo.
//
// Prima ogni stato aveva il suo colore (ocra, blu, taupe) e tutto il
// resto era grigio: diceva dove si era arrivati, ma non cosa restava da
// fare — che e' la domanda vera davanti a una lista.
//
// Su schermo stretto le etichette sparirebbero una sull'altra (quattro
// parole in fila non stanno in 375 px), quindi resta solo quella del
// pallino acceso: tanto e' l'unica che serve leggere.
import React from "react";
import { STATI, ORDINE, VERDE, ROSSO } from "./stato.js";
import { fontBody } from "../ui/stile.js";

const VERDE_TENUE = "#E9F6EC";
const ROSSO_TENUE = "#FDECEC";

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
function IconaMatita({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
const ICONE = { dati_inseriti: IconaMatita, modulo_inviato: IconaAereo, modulo_ricevuto: IconaFoglio, confermato: IconaSpunta };

// LA TAPPA "MODULO INVIATO" E' ANCHE IL COMANDO.
//
// Finche' il modulo non e' partito quel pallino non dice uno stato, dice
// cosa fare: "Invia modulo". Premuto, diventa "Modulo inviato" — ed e'
// la stessa cosa, guardata prima e dopo.
//
// Resta premibile anche dopo: se la scheda cambia, il modulo che
// l'allieva ha in mano non e' piu' quello giusto, e si rimanda. Ma non
// di sfuggita: chiede conferma, perche' le arriva una mail.
//
// Senza `onInvia` la fascia e' quella di prima e non si tocca: nelle
// liste serve a leggere, non a spedire.
// DUE TAPPE SI PREMONO, e fanno la cosa che dicono.
//
//   Dati inseriti   riapre la scheda per correggerla
//   Invia modulo    lo manda (o lo rimanda, chiedendo prima)
//
// Senza i rispettivi gestori la fascia e' solo da leggere e non si
// tocca: e' il caso delle liste di sola lettura. Un pallino che sembra
// un tasto e non fa niente e' il guasto peggiore, ed e' gia' successo.
export default function FasciaStato({ stato, compatto = false, larghezzaMax = 330, onInvia = null, inviando = false, onModifica = null }) {
  const attuale = STATI[stato] ? stato : "dati_inseriti";

  // IL RECESSO NON E' UNA TAPPA DELLA SCALA, ed e' per questo che qui
  // c'e' un'uscita anticipata.
  //
  // Non sta in ORDINE, quindi `indexOf` darebbe -1 e la fascia
  // mostrerebbe tutti e quattro i pallini rossi: un'iscrizione sciolta
  // sembrerebbe appena nata, con tutto ancora da fare. Dice invece
  // quello che e' successo, con lo stesso vestito degli altri stati —
  // la pasticca, i suoi colori — e si vede scorrendo l'elenco.
  if (attuale === "recesso") {
    const s = STATI.recesso;
    return (
      <span
        title="L'allieva ha esercitato il diritto di recesso"
        style={{
          ...fontBody, display: "inline-flex", alignItems: "center", gap: 6,
          background: s.sfondo, color: s.colore, border: `1px solid ${s.colore}33`,
          borderRadius: 999, padding: compatto ? "3px 10px" : "5px 13px",
          fontSize: compatto ? 11 : 12, fontWeight: 700, letterSpacing: 0.2,
        }}
      >
        <svg width={compatto ? 11 : 13} height={compatto ? 11 : 13} viewBox="0 0 24 24" fill="none"
             stroke={s.colore} strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
        {s.etichetta}
      </span>
    );
  }

  const indice = ORDINE.indexOf(attuale);
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
        const acceso = i === indice;          // dove siamo adesso
        const fatto = i <= indice;            // gia' passato (o e' questo)
        const tinta = fatto ? VERDE : ROSSO;
        const Icona = ICONE[chiave];
        // la linea che ARRIVA a questo pallino: verde se il passo c'e'
        // gia', rossa se si aspetta ancora
        const lineaFatta = i > 0 && i <= indice;
        return (
          <React.Fragment key={chiave}>
            {i > 0 && (
              <div
                aria-hidden
                style={{
                  flex: "1 1 0", minWidth: 8, height: 3, borderRadius: 2,
                  background: lineaFatta ? VERDE : ROSSO,
                  marginTop: palla / 2 - 1.5,
                  opacity: lineaFatta ? 1 : 0.35,
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 0 }}>
              {(() => {
                const eInvio = !!onInvia && chiave === "modulo_inviato" && !inviando;
                const eModifica = !!onModifica && chiave === "dati_inseriti";
                const siPreme = eInvio || eModifica;
                const giaPartito = indice >= ORDINE.indexOf("modulo_inviato");
                const Palla = siPreme ? "button" : "div";
                return (
                  <Palla
                    type={siPreme ? "button" : undefined}
                    onClick={eModifica ? onModifica : eInvio ? () => onInvia(giaPartito) : undefined}
                    title={eModifica
                      ? "Riapri la scheda per correggere i dati"
                      : eInvio
                        ? (giaPartito ? "Il modulo è già partito: premi per rimandarlo" : "Manda il modulo all'allieva")
                        : STATI[chiave].etichetta}
                    style={{
                      width: palla, height: palla, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: tinta,
                      // `opacity` era scritta due volte: questa e quella
                      // dell'invio in corso, e nell'oggetto vince l'ultima.
                      // Risultato: i gradini non ancora fatti non si
                      // smorzavano, e la fascia li mostrava tutti uguali.
                      // Le due condizioni ora stanno in una riga sola.
                      opacity: (inviando && chiave === "modulo_inviato") ? 0.5 : (fatto ? 1 : 0.45),
                      boxShadow: acceso ? `0 0 0 ${compatto ? 3 : 5}px ${fatto ? VERDE_TENUE : ROSSO_TENUE}` : "none",
                      flex: "0 0 auto",
                      border: siPreme && !fatto ? `2px solid ${ROSSO}` : "none",
                      padding: 0,
                      cursor: siPreme ? "pointer" : "default",
                    }}
                  >
                    <Icona size={icona} color="#fff" />
                  </Palla>
                );
              })()}
              {(!compatto || acceso || (onInvia && chiave === "modulo_inviato")) && (
                <div
                  style={{
                    fontSize: compatto ? 10.5 : 11.5,
                    fontWeight: acceso ? 700 : 500,
                    color: fatto ? VERDE : ROSSO,
                    opacity: fatto ? 1 : 0.8,
                    marginTop: 5, whiteSpace: "nowrap", lineHeight: 1.2,
                  }}
                >
                  {/* finche' il modulo non e' partito quel passo non e'
                      uno stato raggiunto, e' una cosa da fare: lo dice
                      anche negli elenchi, dove non si puo' premere */}
                  {chiave === "modulo_inviato" && indice < ORDINE.indexOf("modulo_inviato")
                    ? (inviando ? "Invio…" : "Invia modulo")
                    : STATI[chiave].etichetta}
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
  const attuale = STATI[stato] ? stato : "dati_inseriti";
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
