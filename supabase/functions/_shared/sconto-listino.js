// SOPRA LA SOGLIA, LO SCONTO DI UN COUPON LO DECIDE IL LISTINO
// RIVENDITORI. 19/11/2026.
//
// Il titolare: «quando faccio un coupon che genera uno sconto del 20%,
// deve seguire cmq i listini dei rivenditori con il 20% di sconto,
// ovvero il tetto e' 20 ma non tutto ha 20... da oggi non sara' piu'
// possibile creare sconti liberi di qualsiasi percentuale perche' sopra
// al 10% subentreranno i calcoli che fanno i listini attuali dei
// rivenditori». E, sulla legge: «il riferimento, la legge deve essere il
// listino rivenditori».
//
// LA REGOLA, scelta da lui fra le due possibili:
//
//     frazione = valore_coupon / tetto_sconto          (30 / 50 = 0,6)
//     sconto_del_prodotto = cedibile_del_prodotto x frazione
//
// cioe' la PROPORZIONE e non il minimo fra i due. Un coupon al 30% vale
// tre quinti di quello che ogni prodotto puo' cedere: su Arizona
// (cedibile 50%) fa 30%, sul Kit laminazione ciglia (14,7%) fa 8,82%, su
// N2 Fixa (cedibile 0%) fa zero.
//
// E' la stessa forma del codice di acquisto delle master, che da
// settembre cede una quota del cedibile: non si inventa un meccanismo,
// se ne estende uno che gira.
//
// QUESTO FILE STA IN `_shared` PERCHE' LO LEGGONO IN TRE: il banco e il
// modulo del coupon (da App.jsx), e le edge function che scrivono il
// coupon su WooCommerce (da Deno). Due copie vorrebbero dire una
// percentuale detta in pagina e un'altra incassata dal sito — ed e'
// esattamente il guasto del 7/11/2026, quando le due copie della
// formula del carrello si sono staccate per davvero.

// Due decimali, come le percentuali che il POS scrive sulle righe.
function dueDecimali(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/**
 * Questo coupon passa dal listino, o sconta libero come prima?
 *
 * Forzato vuol dire che una persona ha deciso di scontare piatto contro
 * il listino, col motivo scritto: li' il listino non comanda piu'.
 */
/**
 * @param {{ valore?: number|string|null, soglia?: number|string|null, forzato?: boolean }} [arg]
 *   La firma e' dichiarata perche' Deno, senza, deduce il tipo dal valore
 *   di default `{}` e vede soltanto `forzato`: le edge function che
 *   chiamano questa funzione non passavano il controllo dei tipi.
 * @returns {boolean}
 */
export function passaDalListino({ valore, soglia, forzato = false } = {}) {
  if (forzato) return false;
  const v = Number(valore), s = Number(soglia);
  if (!(v > 0)) return false;
  // soglia non leggibile = si passa dal listino. Il verso prudente e'
  // questo: il contrario vorrebbe dire scontare libero perche' una
  // lettura non e' andata a buon fine.
  if (!Number.isFinite(s)) return true;
  return v > s;
}

/**
 * Quanta parte del tetto chiede questo coupon. 30 su 50 = 0,6.
 *
 * Si ferma a 1: chiedere piu' di tutto il cedibile non e' una frazione,
 * e' una forzatura — e se un coupon oltre il tetto arrivasse qui senza
 * essere stato forzato (scritto da un'altra strada, o da una scheda
 * aperta da ieri), il verso sicuro e' concedere il cedibile intero e non
 * piu' di quello.
 */
export function frazioneDelTetto(valore, tetto) {
  const v = Number(valore), t = Number(tetto);
  if (!(v > 0) || !(t > 0)) return 0;
  return Math.min(1, v / t);
}

/** Lo sconto, in percentuale, che questo coupon fa su QUESTO prodotto. */
export function scontoListinoPct(cedibilePct, valore, tetto) {
  const ced = Number(cedibilePct);
  if (!(ced > 0)) return 0;
  const fr = frazioneDelTetto(valore, tetto);
  if (!(fr > 0)) return 0;
  return dueDecimali(ced * fr);
}

/**
 * Che cosa fara' questo coupon sul catalogo: quanti prodotti prendono la
 * percentuale piena, quanti meno, quanti niente.
 *
 * E' il conto che il modulo del coupon scrive PRIMA di salvare — perche'
 * «sconto del 20%» su un catalogo in cui sedici prodotti ne prendono
 * zero e' una frase che non dice il vero.
 *
 * Le righe arrivano da `v_listino_rivenditori` gia' filtrate per l'ambito
 * del coupon: qui non si sa niente di categorie e prodotti esclusi.
 */
export function effettoSulCatalogo(righe, { valore, tetto } = {}) {
  const dettaglio = (righe || []).map((r) => {
    const cedibile = Number(r?.sconto_max_pct) || 0;
    const sconto = scontoListinoPct(cedibile, valore, tetto);
    return {
      id: r?.id, nome: r?.nome, blocco: r?.blocco,
      cedibile, sconto,
      // «pieno» vuol dire che quel prodotto prende la percentuale
      // dichiarata sul coupon, non che prende tutto il suo cedibile
      pieno: sconto >= Number(valore) - 0.005,
    };
  });
  const pieno = dettaglio.filter((d) => d.pieno);
  const nessuno = dettaglio.filter((d) => d.sconto <= 0);
  const ridotto = dettaglio.filter((d) => !d.pieno && d.sconto > 0);
  return {
    quanti: dettaglio.length,
    pieno, ridotto, nessuno,
    dettaglio,
    // la percentuale media EFFETTIVA, pesata sui prezzi: e' quella che
    // va scritta sul coupon di WooCommerce quando il sito non sa i
    // margini, con la stessa logica di `percentualeWooDaFasce`
    mediaPesata: mediaPesataSuiPrezzi(righe, dettaglio),
  };
}

function mediaPesataSuiPrezzi(righe, dettaglio) {
  let lordo = 0, sconto = 0;
  (righe || []).forEach((r, i) => {
    const l = Number(r?.pubblico_lordo);
    if (!(l > 0)) return;
    lordo += l;
    sconto += (l * (dettaglio[i]?.sconto || 0)) / 100;
  });
  return lordo > 0 ? dueDecimali((sconto / lordo) * 100) : 0;
}

/**
 * QUELLO CHE COSTA FORZARE. Richiesta del titolare, con il suo esempio:
 * «se un giorno decido di mettere il 30% sui prodotti di laminazione per
 * sbarazzarmene e quindi venderli sotto prezzo, tu mi devi segnalare che
 * io non ho quel margine e io ti devo confermare la forzatura».
 *
 * Forzare vuol dire scontare PIATTO: la percentuale dichiarata su tutto
 * quello che il coupon copre, margine o non margine. Qui si misura dove
 * va a finire, e si nominano i casi uno per uno — «sei prodotti sotto
 * costo» senza i nomi e gli euro non e' una segnalazione, e' un allarme
 * che si impara a premere via.
 *
 * Due soglie diverse, perche' sono due cose diverse: sotto il margine
 * minimo si guadagna meno del dovuto, SOTTO COSTO si perdono soldi a
 * ogni pezzo.
 */
export function dannoDellaForzatura(righe, { valore, ricarico } = {}) {
  const pct = Number(valore) || 0;
  const righeDanno = (righe || []).map((r) => {
    const netto = Number(r?.pubblico_netto) || 0;
    const costo = r?.costo == null ? null : Number(r.costo);
    const nettoForzato = dueDecimali(netto * (1 - pct / 100));
    // senza il costo non si sa dove si finisce, e non si inventa: si
    // dice che non si sa, che e' un'informazione a sua volta
    if (costo == null || !(costo > 0)) {
      return { id: r?.id, nome: r?.nome, blocco: r?.blocco, nettoForzato, costo: null, senzaCosto: true, margine: null, sottoCosto: false, sottoPavimento: false };
    }
    const pavimento = dueDecimali(costo * (1 + (Number(ricarico) || 0) / 100));
    return {
      id: r?.id, nome: r?.nome, blocco: r?.blocco,
      nettoForzato, costo, pavimento, senzaCosto: false,
      margine: dueDecimali(nettoForzato - costo),
      sottoCosto: nettoForzato < costo,
      sottoPavimento: nettoForzato < pavimento,
    };
  });
  // i peggiori per primi: chi perde piu' soldi per pezzo
  const perMargine = [...righeDanno].sort((a, b) => (a.margine ?? Infinity) - (b.margine ?? Infinity));
  const sottoCosto = perMargine.filter((d) => d.sottoCosto);
  return {
    quanti: righeDanno.length,
    sottoCosto,
    sottoPavimento: perMargine.filter((d) => d.sottoPavimento && !d.sottoCosto),
    senzaCosto: righeDanno.filter((d) => d.senzaCosto),
    reggono: righeDanno.filter((d) => !d.senzaCosto && !d.sottoPavimento),
    // quanto si perde per un pezzo di ognuno dei prodotti sotto costo
    perditaPerPezzo: dueDecimali(sottoCosto.reduce((t, d) => t + Math.min(0, d.margine || 0), 0)),
    righe: perMargine,
  };
}
