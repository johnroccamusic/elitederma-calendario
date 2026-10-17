// I NUMERI DEL RECESSO, IN UN POSTO SOLO.
//
// Sono tre cifre di legge, e vanno confermate dal legale. Stanno qui
// perche' il giorno in cui una cambia non si debba andare a cercarla in
// mezzo a una pagina: si cambia la riga e basta, e tutto quello che la
// usa — il modulo, la casella dell'avvio immediato, la pagina di
// recesso — si allinea da solo.
//
// GIORNI_RECESSO        art. 52 e ss. del Codice del Consumo: quanti
//                       giorni dalla conclusione del contratto per
//                       recedere. Il contratto si conclude con la firma
//                       del modulo.
// GIORNI_AVVIO_IMMEDIATO  art. 59, lett. a): sotto questa soglia il
//                       corso comincia prima che il termine scada, e
//                       l'allievo puo' chiedere l'avvio immediato
//                       perdendo il recesso. E' la casella che il
//                       modulo mostra da solo.
export const GIORNI_RECESSO = 14;
export const GIORNI_AVVIO_IMMEDIATO = 15;

// Quanti giorni mancano all'inizio del corso. Null se la data non c'e':
// una data mancante non deve diventare "mancano NaN giorni" e far
// comparire o sparire una casella di legge per sbaglio.
export function giorniAllInizio(dataInizio, oggi = new Date()) {
  if (!dataInizio) return null;
  const [a, m, g] = String(dataInizio).split("-").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(m) || !Number.isFinite(g)) return null;
  const inizio = Date.UTC(a, m - 1, g);
  const adesso = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((inizio - adesso) / 86400000);
}

// La casella dell'avvio immediato si mostra — ed e' obbligatoria — solo
// quando al corso mancano meno giorni del termine di recesso stesso.
// Senza data del corso non si mostra: meglio una casella in meno che una
// rinuncia al recesso raccolta quando non serviva.
export function serveAvvioImmediato(dataInizio, oggi = new Date()) {
  const giorni = giorniAllInizio(dataInizio, oggi);
  if (giorni === null) return false;
  return giorni < GIORNI_AVVIO_IMMEDIATO;
}
