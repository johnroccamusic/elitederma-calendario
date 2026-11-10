// LA REGOLA DEL BACK ORDER SUI BUNDLE (4/11/2026).
//
// Segnalato dal titolare: «nonostante con il mascara abbia attivato il
// backorders, il relativo bundle del mascara da 10 pezzi, non leggendo
// disponibili i pezzi necessari per comporsi, mi risulta sempre
// indisponibile nonostante sul pezzo singolo ci sia il back order».
//
// Aveva ragione, e il caso era esatto: Mascara Kerafill 1pz, 7 pezzi in
// casa e back order ACCESO (quindi ordinabile a scorte zero); Espositore
// 10pz, bundle virtuale, 7 / 10 = ZERO componibili. Il conto della
// disponibilita' guardava solo le giacenze, quindi per lui un componente
// a back order era un componente che non c'e': il pezzo singolo si
// ordinava a zero e l'espositore no, senza nessuna ragione perche'
// fossero diversi.
//
// LA DECISIONE DEL TITOLARE (4/11/2026): il bundle **eredita** il back
// order dai componenti. Se tutti quelli che lo bloccano sono a loro volta
// ordinabili a scorte zero, il bundle va sul sito come ordinabile; si
// accende e si spegne da se' seguendo i componenti, senza una casella da
// ricordare su ogni espositore.
//
// E LA DISPONIBILITA' RESTA IL NUMERO VERO. Non si gonfia la quantita'
// per far comparire il tasto: il sito riceve zero — che e' quanti
// espositori si compongono davvero — e il back order di WooCommerce fa
// il resto («su ordinazione» e si compra). Dichiarare due espositori che
// non esistono vorrebbe dire prometterli a chi paga.
//
// PERCHE' STA QUI E NON IN UNA DELLE DUE FUNZIONI CHE LA USANO. Il conto
// dei bundle vive in due posti: `sincronizzaDisponibilitaBundle`
// (_shared/woo.ts), che gira quando un ordine ONLINE muove i componenti,
// e `woo-riallinea-shop`, che gira ogni notte e dopo ogni movimento di
// magazzino — cioe' dopo le vendite al banco. Una regola scritta in uno
// dei due sarebbe giusta soltanto per meta' delle vendite, e nessuno si
// accorgerebbe di quale meta'.

// LA FRASE CHE IL CLIENTE LEGGE QUANDO I PEZZI SONO FINITI (10/11/2026).
//
// Dettata dal titolare, che sulla scheda dell'Espositore del Siero
// leggeva ancora «Disponibile su ordinazione»: «puoi cambiare Disponibile
// su ordinazione in "Disponibile in 4 giorni"?».
//
// «Disponibile su ordinazione» non l'abbiamo scritta noi: e' la frase di
// WooCommerce, e compare ogni volta che il prodotto non porta la nostra.
// Sta QUI, in un posto solo, perche' la stessa frase la dicono tre
// strade — la scheda prodotto del gestionale, il salvataggio verso il
// sito (`woo-gestisci-prodotto`) e il riallineamento notturno
// (`woo-riallinea-shop`) — e tre copie vorrebbero dire tre promesse
// diverse sullo stesso scaffale.
export const BACKORDER_TESTO_PREDEFINITO = "Disponibile in 4 giorni";

/**
 * La frase da mandare al sito per un prodotto: la sua, se qualcuno ne ha
 * scritta una, altrimenti quella predefinita. Mai una stringa vuota: il
 * vuoto non lascia il prodotto senza frase, lo lascia con QUELLA DI
 * WOOCOMMERCE, che e' il motivo per cui questa funzione esiste.
 */
export function messaggioBackorder(scritto) {
  return String(scritto || "").trim() || BACKORDER_TESTO_PREDEFINITO;
}

/**
 * Il bundle e' ordinabile anche quando i pezzi non bastano a comporlo?
 *
 * Lo e' quando OGNI componente che lo blocca — quello che finisce prima,
 * cioe' quello che decide il minimo — e' a sua volta ordinabile a scorte
 * zero. Se uno solo dei componenti che mancano non si puo' riordinare,
 * il bundle non si puo' comporre e non si vende: prometterlo sarebbe
 * prometterlo senza avere come mantenerlo.
 *
 * @param {{ per: number|string, giacenza: number|string, backorder: boolean }[]} componenti
 *   la distinta: quanti pezzi per bundle, quanti in casa (gia' al netto
 *   di cio' che chi chiama considera impegnato) e se quel componente e'
 *   ordinabile a scorte zero.
 * @returns {boolean}
 */
export function bundleOrdinabileAZero(componenti) {
  const righe = (componenti || []).filter((c) => Number(c?.per) > 0);
  // un bundle senza distinta non si compone con niente: non c'e' nessun
  // componente da riordinare, quindi non c'e' niente da promettere
  if (righe.length === 0) return false;
  const possibili = righe.map((c) => componibiliDa(c));
  const minimo = Math.min(...possibili);
  // I LIMITANTI, non tutti. Un componente che ne ha cinquanta non blocca
  // niente, e pretendere il back order anche da lui vorrebbe dire
  // tenere fermo un espositore per colpa di un pezzo che abbonda.
  return righe.every((c, i) => possibili[i] > minimo || c.backorder === true);
}

/** Quanti bundle si compongono con quel componente, mai sotto zero. */
export function componibiliDa(componente) {
  const per = Number(componente?.per) || 0;
  if (per <= 0) return 0;
  const giacenza = Number(componente?.giacenza);
  if (!Number.isFinite(giacenza)) return 0;
  return Math.floor(Math.max(0, giacenza) / per);
}

/**
 * I tre campi che WooCommerce vuole insieme per il back order di un
 * bundle virtuale. Sono gli stessi che manda `woo-gestisci-prodotto` per
 * un prodotto normale (vedi la sua `campiBackorder`), e devono restare
 * gli stessi: due modi di accendere la stessa cosa sarebbero due
 * comportamenti diversi sullo stesso sito.
 *
 * `notify` e non `yes`: con `yes` il cliente puo' ordinare ma non legge
 * niente, con `notify` WooCommerce glielo dice.
 *
 * Il messaggio si scrive SEMPRE, anche vuoto: spegnere il back order
 * deve cancellare anche la frase, o sulla scheda resterebbe scritto
 * «su ordinazione» su un prodotto che non si ordina piu'.
 */
export function campiBackorderBundle(ordinabile, messaggio) {
  return {
    manage_stock: true,
    backorders: ordinabile ? "notify" : "no",
    meta_data: [{ key: "_elitederma_backorder_messaggio", value: ordinabile ? String(messaggio || "") : "" }],
  };
}

/**
 * La frase da mostrare. Quella scritta sul bundle comanda — se qualcuno
 * l'ha scritta la' e' perche' per l'espositore vale una cosa diversa —
 * altrimenti vale quella del componente che lo blocca, che e' la stessa
 * che il cliente legge sul pezzo singolo. Dove non c'e'
 * scritto niente vale la frase predefinita: al sito non deve mai arrivare
 * un vuoto, o il cliente legge quella di WooCommerce.
 */
export function messaggioBackorderBundle(delBundle, componenti) {
  const mio = String(delBundle || "").trim();
  if (mio) return mio;
  const righe = (componenti || []).filter((c) => Number(c?.per) > 0);
  const possibili = righe.map((c) => componibiliDa(c));
  const minimo = righe.length ? Math.min(...possibili) : 0;
  const bloccante = righe.find((c, i) => possibili[i] === minimo && c.backorder === true);
  return messaggioBackorder(bloccante?.messaggio);
}
