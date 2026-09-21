// I mattoni condivisi dell'interfaccia: colori, font, misure e le due
// funzioncine sui numeri che servono ai campi.
//
// Stanno qui e non dentro App.jsx perche' da oggi li usa anche il modulo
// "rientro materiali corso", che vive in src/rientri/. Due copie degli
// stessi colori sarebbero due verita' sullo stesso blu, e prima o poi una
// delle due cambierebbe da sola.

// colori condivisi del tema, usati in tutta l'app
export const NAVY = "#0E1B33";
export const CREAM_BORDER = "#E8E3D6";
export const BG = "#EFE9DC";
export const BG_CHIARO = "#EFE9DC"; // stesso colore anche nei riquadri interni alle schede
export const MUTED = "#8B8FA3";
export const GRAFITE = "#54585F";
export const GOLD = "#C9A26D"; // accento per icone/badge (es. intestazione Contabilità classe)
// grigio freddo delle due tendine sotto nome e telefono in "Assegna
// modelle": stanno sotto due campi bianchi, e un fondo crema le faceva
// sembrare parte dell'intestazione invece che due caselle da compilare
export const GRIGIO_TENDINA_MODELLA = "#DCDFE6";
// i due turni in "Assegna modelle" da telefono: il giallo e' la mattina,
// l'arancio il pomeriggio. Due colori diversi si riconoscono con la coda
// dell'occhio scorrendo venti allievi, due rettangoli blu uguali no
export const GIALLO_MATTINA = "#F5C542";
export const ARANCIO_POMERIGGIO = "#E8873A";
// verde chiaro quando la modella c'e', rosso chiaro finche' manca
export const VERDE_TROVATA = "#E9F6EC";
export const ROSSO_DA_TROVARE = "#FDECEC";

export const fontDisplay = { fontFamily: "'Figtree',sans-serif", fontWeight: 500 };
// Il titolo di una pagina, sempre lo stesso: Figtree 700, 24 fissi,
// maiuscolo. Erano 19, 20, 21, 22, 24, 26, 28, 30, 32 — alcuni che si
// rimpicciolivano da telefono e altri no — e passando da una pagina
// all'altra il titolo cambiava taglia a ogni porta.
export const stileTitoloPagina = { fontFamily: "'Figtree',sans-serif", fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.15 };
export const fontBody = { fontFamily: "'Roboto',sans-serif" };
// serif elegante per il titolo del corso nell'intestazione scura
// (Contabilità classe / schede di inserimento allievo): unico punto dove
// si usa questo font, per dargli un peso più "editoriale" rispetto al
// sans-serif del resto dell'app
export const fontHero = { fontFamily: "'Playfair Display',serif", fontWeight: 700 };
// "Google Sans" non è distribuito su Google Fonts (è un font interno di
// Google, non licenziato per il web pubblico): Inter è la sostituzione più
// vicina, usata qui in grassetto bianco per i nomi dei corsi sulle barre
// del calendario
export const fontCondensato = { fontFamily: "'Inter',sans-serif", fontWeight: 700, color: "#fff" };
// La famiglia stretta del carrello sul telefono. Nel carrello ogni riga
// porta nome, quantita', prezzo, margine, sconto e punti su una larghezza
// da pollice: con un carattere normale le colonne si toccano e
// "AL PUBBLICO MARGINE SCONTO" si legge come una parola sola. Sofia Sans
// Condensed e' la riserva perche' e' gia' scaricata da sempre.
// Sofia Sans Condensed ha cinque pesi veri (400-800), quindi il
// grassetto e' disegnato e non sintetizzato dal browser: su un
// condensato si vede. Provato Special Gothic Condensed One il
// 21/09/2026 e scartato, ha un peso solo.
export const FAMIGLIA_STRETTA = "'Sofia Sans Condensed','Roboto Condensed',sans-serif";
// Il grigio spento del carrello sul telefono. MUTED (#8B8FA3) su bianco
// sta sotto il rapporto di contrasto che serve a un testo da leggere, e
// sul telefono, con la luce vera e il carattere piccolo, sparisce: SKU,
// prezzi barrati e percentuali diventavano ombre. Stessa tinta, piu' cupa.
export const GRIGIO_LEGGIBILE = "#5C6273";

export const inputStyle = {
  ...fontBody,
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${CREAM_BORDER}`,
  fontSize: 14,
};
// campi piccoli per liste fitte di righe con numeri corti (Riepilogo
// amministrativo → Costi della classe): inputStyle è pensato per form
// con pochi campi, troppo alto per una tabella di più righe
export const campoCompattoStyle = { ...inputStyle, padding: "5px 7px", fontSize: 12.5 };

// arrotondamento a due decimali: in questa app gli importi hanno
// sempre due cifre dopo la virgola, mai una di piu'.
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// il separatore decimale come lo scrive e lo legge chi usa l'app
export function numeroFascia(n) { return String(n).replace(".", ","); }

// Quanto grande puo' essere il testo dentro una fila di pulsanti che si
// dividono lo spazio in parti uguali.
//
// Serve dove una riga di tasti non va mai a capo — la scheda del corso
// sulla dashboard master — e quindi, stringendo lo schermo, ogni tasto
// diventa piu' stretto. A corpo fisso la parola piu' lunga esce dal
// pulsante: la si vede tagliata, o addosso a quella del tasto accanto.
//
// Qui il corpo scende insieme al pulsante, cosi' il rapporto fra testo e
// scatola resta quello di sempre e la riga si rimpicciolisce tutta
// intera invece di rompersi.
//
// La misura la decide la parola piu' lunga di TUTTA la riga, non quella
// di ogni tasto: se ogni pulsante scegliesse per conto suo, cinque
// pulsanti avrebbero cinque corpi diversi e la riga sembrerebbe una
// scaletta.
//
// 0,62 em per carattere e' la larghezza media reale di questo font a
// peso 700 — misurata sulle parole che ci finiscono davvero, non presa
// da una tabella.
export function corpoTestoInFila({
  larghezzaRiga,
  quanti,
  gap = 0,
  paddingOrizzontale = 0,
  parolaPiuLunga = 1,
  massimo = 15,
  fattoreCarattere = 0.62,
}) {
  // finche' non si conosce la larghezza vera (primo disegno, prima che
  // il righello abbia misurato) si usa la misura piena: meglio partire
  // giusti su schermo largo che far lampeggiare tutti i testi
  if (!(larghezzaRiga > 0) || !(quanti > 0)) return massimo;
  const perPulsante = (larghezzaRiga - gap * Math.max(0, quanti - 1)) / quanti;
  const dentro = perPulsante - paddingOrizzontale;
  if (!(dentro > 0)) return 1;
  const quanto = dentro / (Math.max(1, parolaPiuLunga) * fattoreCarattere);
  // mai sopra la misura di sempre: su schermo largo non deve cambiare
  // niente, e un testo che cresce oltre il suo corpo naturale e' brutto
  // quanto uno tagliato
  return Math.max(1, Math.min(massimo, quanto));
}
