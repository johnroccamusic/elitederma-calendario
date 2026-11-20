// IL LISTINO PER I RIVENDITORI: PDF ed Excel. 18/11/2026.
//
// Nasce dalla lettura `listino_rivenditori_export()`, che costo, margine
// e sconto cedibile non li restituisce. Quindi qui non c'è niente da
// nascondere: quei campi non arrivano. È la differenza chiesta dal punto
// 6 della specifica fra «l'interfaccia non li mostra» e «il server non li
// manda».
//
// Il PDF si costruisce nel browser come tutti gli altri dell'app. Le
// foto dei prodotti qui non ci sono: con cinque colonne di prezzi non
// resta larghezza, e questo foglio si legge per confrontare numeri.
import { soloWinAnsi } from "../prezzi/winansi.js";
import { caricaLogoTestata, innestaLogo, disegnaTestata, disegnaTestatina } from "../prezzi/intestazione.js";
import { spezzaInRighe } from "./regolamentoPdf.js";

const A4 = { corto: 595.28, lungo: 841.89 };
const MARGINE = 34;
const ALTEZZA_RIGA = 17;

const NAVY = [0.055, 0.106, 0.2];
// l'oro del filo sotto il marchio sta in `../prezzi/intestazione.js`
const GRIGIO = [0.42, 0.45, 0.52];
const RIGA_CHIARA = [0.976, 0.969, 0.953];
const BORDO = [0.886, 0.867, 0.835];

export const NOTA_PIEDE = "Prezzi IVA esclusa; prezzo al pubblico consigliato IVA inclusa e non vincolante";

const cifra = (n) => (n == null ? "-" : Number(n).toFixed(2).replace(".", ","));
const pct = (n) => (n == null ? "-" : `${String(Math.round(Number(n) * 10) / 10).replace(".", ",")}%`);
// Una soglia si legge in euro tondi: «ingresso ordine € 3.000».
//
// `useGrouping: "always"` non e' un vezzo: in italiano il CLDR non
// raggruppa i numeri di quattro cifre (`minimumGroupingDigits: 2`), e
// senza quell'opzione su un listino da consegnare si leggerebbe «€ 3000»
// — che sembra un errore di battitura. Lo stesso inciampo del 17/11 sui
// 1.888 clienti dello shop, dall'altra parte.
export const soglia = (n) => `€ ${Number(n || 0).toLocaleString("it-IT", { maximumFractionDigits: 0, useGrouping: "always" })}`;

// Le righe che entrano in un listino.
//
// Fuori restano i prodotti senza prezzo e quelli che si vendono SOLO AL
// BANCO: offrirli a un rivenditore vorrebbe dire promettere merce che non
// si sa come fargli avere. È la stessa regola del listino del 15/11.
//
// E fuori restano LE CATEGORIE ESCLUSE (18/11/2026, chiesto dal titolare:
// «un flag che mi consenta di escluderne alcune dalla generazione del
// listino»). L'esclusione si applica QUI, in un posto solo, perché da
// questa funzione passano tutti e tre gli usi — il PDF, il foglio e il
// conteggio che la pagina scrive — e tre filtri scritti a parte
// direbbero tre numeri diversi sullo stesso listino.
//
// Il nome della categoria è la chiave, non un id: `blocco` arriva da
// `v_prezzi_listini` ed è testo. Una categoria rinominata torna dentro al
// listino da sé, ed è il male minore — l'alternativa è che resti esclusa
// per sempre senza comparire in nessun elenco.
export const nomeCategoria = (r) => r.blocco || "ALTRI PRODOTTI";

//
// E fuori restano I PRODOTTI TOLTI UNO PER UNO (18/11/2026, chiesto dal
// titolare: «se ne deflaggo uno esce dal listino definitivamente»), per id.
// Stesso posto e stesso motivo delle categorie: un filtro solo per i tre
// usi.
export function righeEsportabili(righe, escluse = [], prodottiEsclusi = []) {
  const fuori = new Set((escluse || []).map(String));
  const tolti = new Set((prodottiEsclusi || []).map(String));
  return (righe || [])
    .filter((r) => r.pubblico_netto != null && r.pubblico_lordo != null && r.sullo_shop !== false)
    .filter((r) => !fuori.has(nomeCategoria(r)))
    .filter((r) => !tolti.has(String(r.id)))
    .slice()
    .sort((a, b) => (a.blocco_ordine - b.blocco_ordine) || String(a.nome).localeCompare(String(b.nome), "it"));
}

// Le categorie del listino con quante righe esportabili contiene ognuna:
// serve alla pagina per disegnare le spunte e per dire che cosa resta
// fuori. Conta le righe ESPORTABILI, non tutte: una categoria fatta di
// soli prodotti da banco non entrerebbe comunque, e offrirla da escludere
// sarebbe una spunta che non fa niente.
export function categorieDelListino(righe) {
  const m = new Map();
  righeEsportabili(righe).forEach((r) => {
    const k = nomeCategoria(r);
    if (!m.has(k)) m.set(k, { nome: k, ordine: r.blocco_ordine ?? 99, quanti: 0 });
    m.get(k).quanti += 1;
  });
  return [...m.values()].sort((a, b) => a.ordine - b.ordine);
}

export function perReparto(righe, escluse = [], prodottiEsclusi = []) {
  const mappa = new Map();
  righeEsportabili(righe, escluse, prodottiEsclusi).forEach((r) => {
    const k = nomeCategoria(r);
    if (!mappa.has(k)) mappa.set(k, { nome: k, ordine: r.blocco_ordine ?? 99, prodotti: [] });
    mappa.get(k).prodotti.push(r);
  });
  return [...mappa.values()].sort((a, b) => a.ordine - b.ordine);
}

// IL TITOLO, e il motivo per cui con un livello solo cambia.
//
// Un listino con una colonna sola va a UN rivenditore, che non deve
// vedere che esistono livelli più convenienti del suo: «per un
// rivenditore Professional spunto solo Professional e il file non deve
// rivelare nulla degli altri livelli». Quindi il titolo lo nomina, e in
// testa si scrivono il suo sconto e la sua soglia d'ingresso.
export function titoloListino(livelliScelti) {
  return livelliScelti.length === 1
    ? `Listino rivenditori - livello ${livelliScelti[0].nome}`
    : "Listino rivenditori";
}

// Le colonne, nell'ordine della specifica. Con un livello solo l'ultima
// colonna NON è «Sconto max sul prodotto» — mostrerebbe lo sconto del
// Distributor, cioè proprio l'informazione che quel file non deve dare —
// ma «Sconto applicato», la percentuale di quel livello su quel prodotto.
export function colonneListino(livelliScelti) {
  const uno = livelliScelti.length === 1;
  const colonne = [
    { chiave: "pubblico_lordo", titolo: "Pubblico consigliato", sotto: "IVA inclusa", valore: (r) => cifra(r.pubblico_lordo) },
    { chiave: "pubblico_netto", titolo: "Prezzo netto", sotto: "IVA esclusa", valore: (r) => cifra(r.pubblico_netto) },
  ];
  livelliScelti.forEach((l) => {
    colonne.push({
      chiave: `livello_${l.codice}`,
      titolo: uno ? `Prezzo ${l.nome}` : l.nome,
      sotto: "IVA esclusa",
      grassetto: true,
      valore: (r) => cifra(r.prezzi?.[l.codice]),
    });
  });
  colonne.push(uno
    ? { chiave: "sconto_applicato", titolo: "Sconto applicato", sotto: "su questo prodotto", valore: (r) => pct(r.sconti_pct?.[livelliScelti[0].codice]) }
    : { chiave: "sconto_max", titolo: "Sconto max", sotto: "sul prodotto", valore: (r) => pct(r.sconto_max_pct) });
  return colonne;
}

// L'intestazione: che cosa si promette a chi legge. Con più livelli, uno
// per riga con sconto e soglia; con un livello solo, quello e basta.
export function righeIntestazione(livelliScelti, tettoPct) {
  return livelliScelti.map((l) => {
    const sconto = Math.round(Number(l.frazione) * Number(tettoPct) * 10) / 10;
    return `${l.nome} (fino a -${String(sconto).replace(".", ",")}%) - ingresso ${l.ingresso_cumulabile ? `${soglia(l.ingresso_eur)} di acquisti cumulati` : `ordine ${soglia(l.ingresso_eur)}`}`;
  });
}

// COME FUNZIONANO GLI SCONTI: la prima cosa del listino (18/11/2026,
// chiesto dal titolare: «all'inizio le regole per ottenere la scontistica
// e per diventare uno degli aventi diritto agli sconti»).
//
// Non è un testo scritto a mano: è il riassunto del regolamento, composto
// dalle stesse soglie (`rivenditori_livelli`) da cui nascono il
// regolamento e i prezzi. Scritto a parte, il giorno che l'admin alza una
// soglia il listino prometterebbe quella vecchia.
//
// E vale la regola del listino a un livello solo: NON NOMINA GLI ALTRI.
// Chi riceve il listino Professional legge come si entra, come si resta e
// che ordine minimo serve per il Professional, e basta. Per questo la
// frase sui riassortimenti cambia: con più livelli dice che si applica il
// più alto raggiunto, con uno dice solo che sotto il minimo lo sconto è
// più basso — senza dire di quale livello sarebbe.
export function regoleSconti(livelliScelti, tettoPct = 50) {
  const livelli = (livelliScelti || []).slice().sort((a, b) => a.ordine - b.ordine);
  if (!livelli.length) return [];
  const uno = livelli.length === 1;
  const scontoDi = (l) => String(Math.round(Number(l.frazione) * Number(tettoPct) * 10) / 10).replace(".", ",");

  const livelloPerLivello = livelli.map((l) => {
    const entra = l.ingresso_cumulabile
      ? `si entra con ${soglia(l.ingresso_eur)} di acquisti cumulati, anche su più ordini, e lo sconto vale dagli ordini successivi`
      : `si entra con un singolo ordine da ${soglia(l.ingresso_eur)}, già scontato`;
    return `${l.nome} - sconto fino al ${scontoDi(l)}%: ${entra}; per mantenerlo servono ${soglia(l.mantenimento_eur)} di acquisti in dodici mesi; ogni riassortimento deve essere di almeno ${soglia(l.riassortimento_minimo_eur)}.`;
  });

  const riassortimento = uno
    ? `Ogni ordine si valuta da solo: i prezzi di questo listino valgono per ordini da almeno ${soglia(livelli[0].riassortimento_minimo_eur)} netti; sotto quella cifra lo sconto è più basso.`
    : "Ogni ordine si valuta da solo: si applica il livello più alto il cui riassortimento minimo è raggiunto dal totale dell'ordine, senza superare il livello che il rivenditore possiede.";

  return [
    {
      titolo: uno ? `Come si ottiene il livello ${livelli[0].nome}` : "Come si diventa rivenditore e si ottengono gli sconti",
      righe: livelloPerLivello,
    },
    {
      titolo: "Come si conserva lo sconto",
      righe: [
        "Il livello vale per un ciclo di dodici mesi dalla data d'ingresso. A fine ciclo si guarda il totale degli acquisti del ciclo: se raggiunge la soglia annua il livello si conferma, altrimenti si scende.",
        "Chi scende può rientrare con un ordine pari a quanto mancava alla soglia, mai meno dell'ordine d'ingresso e mai più del doppio.",
        riassortimento,
      ],
    },
    {
      titolo: "Da sapere",
      righe: [
        "La percentuale del livello è lo sconto massimo: su alcuni prodotti è più bassa, e vale il prezzo scritto accanto al prodotto.",
        "Tutti gli importi sono IVA esclusa, al netto degli sconti e senza spedizione. Resi e note di credito riducono gli acquisti del ciclo. Gli sconti non si sommano ad altre promozioni.",
        "Le condizioni complete sono nel Regolamento commerciale rivenditori Elitederma.",
      ],
    },
  ];
}

// ---------- Excel ----------
//
// È un CSV con il punto e virgola e la virgola decimale, come l'altro
// export del listino: si apre in Excel con un doppio clic. Un vero .xlsx
// vorrebbe dire una libreria per scrivere uno zip, e questo progetto ha
// sei dipendenze per scelta.
export function csvListinoRivenditori(righe, livelliScelti, escluse = [], prodottiEsclusi = []) {
  const colonne = colonneListino(livelliScelti);
  const cella = (v) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const testata = ["Categoria", "Prodotto", ...colonne.map((c) => `${c.titolo} (${c.sotto})`)].map(cella).join(";");
  const corpo = righeEsportabili(righe, escluse, prodottiEsclusi).map((r) =>
    [nomeCategoria(r), r.nome, ...colonne.map((c) => c.valore(r))].map(cella).join(";"));
  return "﻿" + [testata, ...corpo].join("\r\n") + "\r\n";
}

// UN'INTESTAZIONE CHE NON STA NELLA SUA COLONNA VA A CAPO (18/11/2026,
// visto generando il documento vero). Le colonne del listino sono larghe
// 66 punti e i titoli si scrivono allineati a destra: «PREZZO
// PROFESSIONAL» ne misura 85 e finiva stampato sopra «PREZZO NETTO». Due
// titoli sovrapposti su un listino di prezzi non sono un difetto
// estetico — non si capisce più quale numero sta sotto quale colonna.
//
// Due righe al massimo: la terza mangerebbe la prima riga di prodotti, e
// quello che non ci sta si taglia coi puntini. La larghezza si misura col
// font vero, perché fra "IIII" e "MMMM" contare i caratteri sbaglia di
// parecchio.
export function intestazioneACapo(testo, font, dimensione, larghezza) {
  const parole = soloWinAnsi(testo).split(" ").filter(Boolean);
  const righe = [];
  parole.forEach((parola) => {
    const unita = righe.length ? `${righe[righe.length - 1]} ${parola}` : null;
    if (unita && font.widthOfTextAtSize(unita, dimensione) <= larghezza) righe[righe.length - 1] = unita;
    else righe.push(parola);
  });
  return righe.slice(0, 2).map((r) => {
    if (font.widthOfTextAtSize(r, dimensione) <= larghezza) return r;
    let taglio = r;
    while (taglio.length > 1 && font.widthOfTextAtSize(`${taglio}...`, dimensione) > larghezza) taglio = taglio.slice(0, -1);
    return `${taglio}...`;
  });
}

let _pdfLibLocale = null;
async function caricaPdfLibLocale() {
  if (!_pdfLibLocale) {
    const pdfLib = await import("pdf-lib");
    _pdfLibLocale = { PDFDocument: pdfLib.PDFDocument, StandardFonts: pdfLib.StandardFonts, rgb: pdfLib.rgb };
  }
  return _pdfLibLocale;
}

// ---------- PDF ----------
export async function creaListinoRivenditoriPdf(righe, livelliScelti, {
  tettoPct = 50, getPdfLib, righeSocieta = [], dataDi = null, escluse = [], prodottiEsclusi = [], logo,
} = {}) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLibLocale)();
  const reparti = perReparto(righe, escluse, prodottiEsclusi);
  // il marchio: chi chiama puo' passarne i byte (le prove lo fanno),
  // altrimenti si legge da `public/`. Se non arriva, la testata scrive il
  // nome come prima — un listino senza logo e' meno grave di un listino
  // che non esce.
  const bytesLogo = logo === undefined ? await caricaLogoTestata() : logo;
  const colonne = colonneListino(livelliScelti);
  // con molte colonne si gira il foglio: nove colonne di numeri su un A4
  // in verticale si schiacciano fino a toccarsi
  const larghezzaPagina = colonne.length > 4 ? A4.lungo : A4.corto;
  const altezzaPagina = colonne.length > 4 ? A4.corto : A4.lungo;

  const pdf = await PDFDocument.create();
  pdf.setTitle(titoloListino(livelliScelti));
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifGrassetto = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const colore = (c) => rgb(c[0], c[1], c[2]);
  const immagineLogo = await innestaLogo(pdf, bytesLogo);
  const caratteri = { normale, grassetto, serif, serifGrassetto };

  const destra = larghezzaPagina - MARGINE;
  const LARG_COLONNA = 66;
  const xColonne = colonne.map((_, i) => destra - (colonne.length - 1 - i) * LARG_COLONNA);
  const larghezzaNome = xColonne[0] - LARG_COLONNA - MARGINE - 6;

  let pagina = null;
  let y = 0;
  let numeroPagina = 0;
  const data = (dataDi || new Date()).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" });

  const scriviDestra = (testo, x, yRiga, font, dim, c) => {
    const t = soloWinAnsi(testo);
    pagina.drawText(t, { x: x - font.widthOfTextAtSize(t, dim), y: yRiga, size: dim, font, color: colore(c) });
  };
  function accorcia(testo, font, dim, larghezza) {
    const t = soloWinAnsi(testo);
    if (font.widthOfTextAtSize(t, dim) <= larghezza) return t;
    let taglio = t;
    while (taglio.length > 1 && font.widthOfTextAtSize(`${taglio}...`, dim) > larghezza) taglio = taglio.slice(0, -1);
    return `${taglio}...`;
  }

  // UN'INTESTAZIONE CHE NON STA NELLA SUA COLONNA VA A CAPO (18/11/2026,
  // visto generando il documento vero). Le colonne sono larghe 66 e
  // scritte allineate a destra: «PREZZO PROFESSIONAL» ne misura 85 e
  // finiva stampato sopra «PREZZO NETTO». Due titoli sovrapposti su un
  // listino di prezzi non sono un difetto estetico — non si capisce più
  // quale numero sta sotto quale colonna.
  function intestazioneColonne() {
    const titoli = colonne.map((c) => intestazioneACapo(c.titolo.toUpperCase(), grassetto, 7, LARG_COLONNA - 4));
    // le righe del titolo si contano UNA VOLTA PER TUTTE le colonne: se
    // ogni colonna si appoggiasse sulle proprie, "IVA esclusa" starebbe a
    // un'altezza diversa in ognuna e la testata sembrerebbe storta
    const quante = Math.max(1, ...titoli.map((r) => r.length));
    const yTitolo = y - 6;
    const ySotto = yTitolo - quante * 8;
    pagina.drawText("PRODOTTO", { x: MARGINE, y: ySotto, size: 7.5, font: grassetto, color: colore(GRIGIO) });
    colonne.forEach((c, i) => {
      titoli[i].forEach((riga, n) => scriviDestra(riga, xColonne[i], yTitolo - n * 8, grassetto, 7, GRIGIO));
      scriviDestra(c.sotto, xColonne[i], ySotto, normale, 6.5, GRIGIO);
    });
    const yFilo = ySotto - 7;
    pagina.drawLine({ start: { x: MARGINE, y: yFilo }, end: { x: destra, y: yFilo }, thickness: 0.8, color: colore(BORDO) });
    y = yFilo - 8;
  }

  function nuovaPagina() {
    pagina = pdf.addPage([larghezzaPagina, altezzaPagina]);
    numeroPagina += 1;
    y = altezzaPagina - MARGINE;
    // LA TESTATA è quella del listino del 15/11, e sta in
    // `intestazione.js`: stesso marchio, stesso filo d'oro, stessa data in
    // alto a destra. Due fogli che arrivano alla stessa persona nella
    // stessa settimana non possono avere due carte intestate.
    const comune = {
      logo: immagineLogo, titolo: titoloListino(livelliScelti), data,
      margine: MARGINE, destra, font: caratteri, colore, y,
    };
    if (numeroPagina === 1) {
      y = disegnaTestata(pagina, comune);
      // COME FUNZIONANO GLI SCONTI, prima dei prezzi: è la prima cosa che
      // un rivenditore cerca sul foglio che gli arriva, e una tabella di
      // prezzi scontati senza le regole per averli è una promessa a metà.
      // Sostituisce la riga per livello che stava qui: il riassunto la
      // contiene già, e due elenchi delle stesse soglie uno sotto l'altro
      // sono uno di troppo.
      const regole = regoleSconti(livelliScelti, tettoPct);
      if (regole.length) {
        pagina.drawText("COME FUNZIONANO GLI SCONTI", { x: MARGINE, y, size: 9.5, font: grassetto, color: colore(NAVY) });
        y -= 14;
        regole.forEach((blocco) => {
          pagina.drawText(soloWinAnsi(blocco.titolo), { x: MARGINE, y, size: 8.5, font: grassetto, color: colore(NAVY) });
          y -= 11;
          blocco.righe.forEach((riga) => {
            spezzaInRighe(riga, normale, 8, destra - MARGINE - 10).forEach((pezzo, i) => {
              if (i === 0) pagina.drawText("-", { x: MARGINE + 2, y, size: 8, font: normale, color: colore(GRIGIO) });
              pagina.drawText(pezzo, { x: MARGINE + 10, y, size: 8, font: normale, color: colore(GRIGIO) });
              y -= 10;
            });
          });
          y -= 4;
        });
        pagina.drawLine({ start: { x: MARGINE, y: y + 2 }, end: { x: destra, y: y + 2 }, thickness: 0.8, color: colore(BORDO) });
        y -= 8;
      }
    } else {
      y = disegnaTestatina(pagina, comune);
    }
    intestazioneColonne();
  }

  function spazio(quanto) { if (y - quanto < MARGINE + 22) nuovaPagina(); }

  nuovaPagina();

  for (const reparto of reparti) {
    spazio(26 + ALTEZZA_RIGA * 2);
    pagina.drawRectangle({ x: MARGINE, y: y - 16, width: destra - MARGINE, height: 18, color: colore(NAVY) });
    pagina.drawText(soloWinAnsi(reparto.nome), { x: MARGINE + 7, y: y - 11, size: 9, font: grassetto, color: rgb(1, 1, 1) });
    scriviDestra(`${reparto.prodotti.length} prodotti`, destra - 7, y - 11, normale, 7.5, [1, 1, 1]);
    y -= 24;

    let dispari = false;
    for (const p of reparto.prodotti) {
      spazio(ALTEZZA_RIGA);
      dispari = !dispari;
      if (dispari) {
        pagina.drawRectangle({ x: MARGINE, y: y - ALTEZZA_RIGA + 5, width: destra - MARGINE, height: ALTEZZA_RIGA, color: colore(RIGA_CHIARA) });
      }
      const yT = y - 7;
      pagina.drawText(accorcia(p.nome, normale, 8.5, larghezzaNome), { x: MARGINE, y: yT, size: 8.5, font: normale, color: colore(NAVY) });
      colonne.forEach((c, i) => {
        scriviDestra(c.valore(p), xColonne[i], yT, c.grassetto ? grassetto : normale, c.grassetto ? 9 : 8.5,
          c.grassetto ? NAVY : GRIGIO);
      });
      y -= ALTEZZA_RIGA;
    }
    y -= 5;
  }

  const rigaSocieta = righeSocieta.length ? righeSocieta.join("  ·  ") : "Elitederma";
  pdf.getPages().forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGINE, y: 32 }, end: { x: destra, y: 32 }, thickness: 0.6, color: colore(BORDO) });
    pg.drawText(soloWinAnsi(rigaSocieta), { x: MARGINE, y: 22, size: 7, font: normale, color: colore(GRIGIO) });
    pg.drawText(soloWinAnsi(NOTA_PIEDE), { x: MARGINE, y: 13, size: 7, font: normale, color: colore(GRIGIO) });
    const n = `${i + 1} / ${pdf.getPageCount()}`;
    pg.drawText(n, { x: destra - grassetto.widthOfTextAtSize(n, 8), y: 13, size: 8, font: grassetto, color: colore(NAVY) });
  });

  return { bytes: await pdf.save(), prodotti: reparti.reduce((s, r) => s + r.prodotti.length, 0), pagine: pdf.getPageCount() };
}
