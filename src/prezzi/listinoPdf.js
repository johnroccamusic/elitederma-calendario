// Il LISTINO RIVENDITORE in PDF, formato A4.
//
// Una pagina per leggere, non per consultare: i prodotti divisi per
// reparto, nello stesso ordine del menu del sito, ognuno con la sua foto,
// il prezzo al pubblico e quello che paga il rivenditore.
//
// Si costruisce nel browser come tutti gli altri PDF dell'app. L'unica
// cosa che passa dal server sono le foto: stanno sul sito, e il sito non
// manda l'intestazione che permette al browser di leggerne i byte (vedi
// l'edge function "immagine-prodotto", che fa da ponte e basta).
import { supabase } from "../supabase.js";
import { BLOCCHI } from "./dati.js";

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 34;
const LATO_FOTO = 30;          // il quadrato della foto nella riga
const ALTEZZA_RIGA = 38;
const LATO_FOTO_SCARICATA = 120; // pixel: oltre, il PDF diventa pesante e nessuno se ne accorge

// I colori del gestionale, in forma 0-1 come li vuole pdf-lib
const NAVY = [0.055, 0.106, 0.200];
const ORO = [0.722, 0.569, 0.333];
const GRIGIO = [0.42, 0.45, 0.52];
const RIGA_CHIARA = [0.976, 0.969, 0.953];
const BORDO = [0.886, 0.867, 0.835];

// pdf-lib con i font di serie scrive solo in WinAnsi: un trattino lungo o
// un "×" copiati da una scheda prodotto farebbero fallire tutto il PDF a
// meta' strada. Si sostituiscono quelli che capitano e si butta il resto.
const SOSTITUZIONI = { "—": "-", "–": "-", "×": "x", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "™": "", "®": "", "°": "o", "€": "EUR" };
export function soloWinAnsi(testo) {
  let t = String(testo ?? "");
  for (const [da, a] of Object.entries(SOSTITUZIONI)) t = t.split(da).join(a);
  // eslint-disable-next-line no-control-regex
  return t.replace(/[^\x20-\xFF]/g, "");
}

const euro = (n) => (n == null ? "-" : `${Number(n).toFixed(2).replace(".", ",")}`);

// Il testo che non ci sta si taglia con i puntini, misurando davvero la
// larghezza con il font che lo disegnera': tagliare a numero di caratteri
// sbaglia di parecchio fra "IIII" e "MMMM".
function accorcia(testo, font, dimensione, larghezza) {
  const t = soloWinAnsi(testo);
  if (font.widthOfTextAtSize(t, dimensione) <= larghezza) return t;
  let taglio = t;
  while (taglio.length > 1 && font.widthOfTextAtSize(`${taglio}...`, dimensione) > larghezza) {
    taglio = taglio.slice(0, -1);
  }
  return `${taglio}...`;
}

// La foto, pronta da mettere nel PDF. Torna { bytes, tipo } oppure null:
// una foto che non arriva non ferma il listino, lascia il suo quadrato
// vuoto e basta.
async function fotoPerPdf(url) {
  if (!url) return null;
  try {
    const indirizzo = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/immagine-prodotto?url=${encodeURIComponent(url)}`;
    const risposta = await fetch(indirizzo, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
    if (!risposta.ok) return null;
    const blob = await risposta.blob();

    // Il passaggio dal canvas serve a due cose: rimpicciolire (duecento
    // foto a piena risoluzione fanno un PDF che non si manda per email) e
    // uniformare il formato, perche' meta' catalogo e' in webp e pdf-lib
    // sa mettere dentro solo jpeg e png.
    const ridotta = await aJpegRidotto(blob);
    if (ridotta) return { bytes: ridotta, tipo: "jpg" };

    // Senza canvas (succede nei banchi di prova) si usa il file com'e',
    // ma solo se e' un formato che pdf-lib accetta e solo se e' piccolo.
    // Senza questo tetto una prova ha prodotto un PDF da 182 MB: duecento
    // foto a piena risoluzione dentro duecento quadrati da mezzo
    // centimetro.
    const tipo = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : null;
    if (!tipo || blob.size > 200 * 1024) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo };
  } catch {
    return null;
  }
}

async function aJpegRidotto(blob) {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
    const tela = document.createElement("canvas");
    if (typeof tela.toBlob !== "function" || typeof tela.getContext !== "function") return null;
    const bitmap = await createImageBitmap(blob);
    const scala = Math.min(1, LATO_FOTO_SCARICATA / Math.max(bitmap.width, bitmap.height));
    tela.width = Math.max(1, Math.round(bitmap.width * scala));
    tela.height = Math.max(1, Math.round(bitmap.height * scala));
    const ctx = tela.getContext("2d");
    if (!ctx) return null;
    // il fondo bianco: un png trasparente, sopra il bianco della pagina,
    // altrimenti diventa nero quando si appiattisce in jpeg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
    const jpeg = await new Promise((r) => tela.toBlob(r, "image/jpeg", 0.78));
    if (!jpeg) return null;
    return new Uint8Array(await jpeg.arrayBuffer());
  } catch {
    return null;
  }
}

// Le righe del listino, raggruppate per reparto nell'ordine del menu del
// sito.
//
// Fuori restano due cose. I prodotti senza prezzo rivenditore: su un
// listino una riga con un trattino al posto del prezzo non serve a
// nessuno. E quelli che si vendono SOLO AL BANCO — i "solo POS" — che
// sullo shop non ci sono: offrirli a un rivenditore vorrebbe dire
// promettere una merce che poi non si sa come fargli avere.
export function raggruppaPerReparto(righe) {
  const dentro = (righe || []).filter((r) =>
    r.prezzo_rivenditore != null && r.pubblico_lordo != null && r.sullo_shop !== false);
  const perBlocco = new Map();
  dentro.forEach((r) => {
    const n = r.blocco_ordine ?? 99;
    if (!perBlocco.has(n)) perBlocco.set(n, []);
    perBlocco.get(n).push(r);
  });
  return [...perBlocco.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, prodotti]) => ({
      numero: n,
      nome: (BLOCCHI.find((b) => b.n === n) || {}).nome || "ALTRI PRODOTTI",
      prodotti: [...prodotti].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "it")),
    }));
}

// pdf-lib pesa, quindi arriva solo quando serve davvero. App.jsx ha gia'
// il suo caricatore con la cache: se lo passa si usa quello, altrimenti
// ci si arrangia qui.
let _pdfLibLocale = null;
async function caricaPdfLibLocale() {
  if (!_pdfLibLocale) {
    const pdfLib = await import("pdf-lib");
    _pdfLibLocale = { PDFDocument: pdfLib.PDFDocument, StandardFonts: pdfLib.StandardFonts, rgb: pdfLib.rgb };
  }
  return _pdfLibLocale;
}

// Le foto si scaricano a gruppi. Una per volta, duecento prodotti sono
// minuti di attesa: ogni foto e' un viaggio fino al sito e ritorno, e
// stare in fila non serve a niente. Otto insieme tengono occupata la rete
// senza sommergere il ponte.
const INSIEME = 8;
async function inParallelo(elementi, quanti, lavoro) {
  let prossimo = 0;
  async function operaio() {
    while (prossimo < elementi.length) {
      const mio = prossimo;
      prossimo += 1;
      await lavoro(elementi[mio], mio);
    }
  }
  await Promise.all(Array.from({ length: Math.min(quanti, elementi.length) }, operaio));
}

// I dati della societa' stanno in Setting, una riga sola
// (`intestazione_societa`). Si leggono qui: se non arrivano, il listino si
// fa lo stesso — un piede senza partita IVA e' meno grave di un listino
// che non esce.
async function datiSocieta() {
  try {
    const { data } = await supabase.from("intestazione_societa").select("*").maybeSingle();
    if (!data) return [];
    return ["nome", "indirizzo", "indirizzo_2", "riga_4", "riga_5"]
      .map((c) => String(data[c] || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  } catch { return []; }
}

export async function creaListinoPdf(righe, { getPdfLib, onAvanzamento } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await (getPdfLib || caricaPdfLibLocale)();
  const reparti = raggruppaPerReparto(righe);
  const quanti = reparti.reduce((s, r) => s + r.prodotti.length, 0);

  // Tutte le foto prima, poi si disegna: cosi' l'attesa e' una sola e la
  // barra di avanzamento dice una cosa vera.
  const righeSocieta = await datiSocieta();
  const fotoPerProdotto = new Map();
  const tutti = reparti.flatMap((r) => r.prodotti);
  let scaricate = 0;
  await inParallelo(tutti, INSIEME, async (p) => {
    fotoPerProdotto.set(p.id, await fotoPerPdf(p.foto_url));
    scaricate += 1;
    onAvanzamento?.(scaricate, quanti);
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle("Listino rivenditore Elitederma");
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  // il nome della ditta vuole le grazie, come sulla carta intestata
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifGrassetto = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const colore = (c) => rgb(c[0], c[1], c[2]);

  // le colonne: x di partenza e larghezza utile. I prezzi si scrivono
  // allineati a destra, perche' incolonnati si confrontano con l'occhio
  const xFoto = MARGINE;
  const xNome = MARGINE + LATO_FOTO + 10;
  const destraPagina = A4.larghezza - MARGINE;
  // Due colonne, non tre. Lo sconto in percentuale c'era e se n'e' andato
  // l'08/10/2026: a chi compra interessa quanto paga, e una percentuale
  // scritta accanto al prezzo e' un invito a contrattare su quella invece
  // che sul prezzo. Resta nel listino dentro l'app, dove serve a decidere.
  const colonne = [
    { titolo: "Prezzo al pubblico", destra: destraPagina - 160 },
    { titolo: "Prezzo rivenditore", destra: destraPagina },
  ];
  const larghezzaNome = colonne[0].destra - 92 - xNome;

  let pagina = null;
  let y = 0;
  let numeroPagina = 0;

  const scriviDestra = (testo, destra, yRiga, font, dimensione, c) => {
    const t = soloWinAnsi(testo);
    pagina.drawText(t, { x: destra - font.widthOfTextAtSize(t, dimensione), y: yRiga, size: dimensione, font, color: colore(c) });
  };

  // Le lettere distanziate. pdf-lib non sa spaziare un testo, quindi si
  // disegna una lettera alla volta: su un titolo di dieci caratteri costa
  // niente, e senza quello spazio fra le lettere il nome non ha l'aria che
  // ha sulla carta intestata.
  function larghezzaSpaziata(testo, font, dimensione, extra) {
    const t = soloWinAnsi(testo);
    if (!t) return 0;
    return font.widthOfTextAtSize(t, dimensione) + extra * (t.length - 1);
  }
  function scriviSpaziato(testo, x, yRiga, font, dimensione, extra, c) {
    let cursore = x;
    for (const lettera of soloWinAnsi(testo)) {
      pagina.drawText(lettera, { x: cursore, y: yRiga, size: dimensione, font, color: colore(c) });
      cursore += font.widthOfTextAtSize(lettera, dimensione) + extra;
    }
    return cursore - extra - x;
  }

  function nuovaPagina() {
    pagina = pdf.addPage([A4.larghezza, A4.altezza]);
    numeroPagina += 1;
    y = A4.altezza - MARGINE;
    const data = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Rome" });

    if (numeroPagina === 1) {
      // LA TESTATA. Il nome comanda: grande, in grazie, con le lettere
      // distanziate, e sotto una riga d'oro larga quanto lui. "Listino
      // rivenditore" viene dopo, piu' piccolo: e' cosa e', non chi e'.
      const yNome = y - 30;
      const larghezzaNomeDitta = scriviSpaziato("ELITEDERMA", MARGINE, yNome, serifGrassetto, 30, 2.6, NAVY);
      // il cerchietto della registrazione, alzato e piccolo come su una
      // carta intestata vera
      pagina.drawText("®", { x: MARGINE + larghezzaNomeDitta + 5, y: yNome + 17, size: 8, font: serif, color: colore(NAVY) });
      pagina.drawLine({
        start: { x: MARGINE, y: yNome - 9 }, end: { x: MARGINE + larghezzaNomeDitta, y: yNome - 9 },
        thickness: 1.6, color: colore(ORO),
      });
      scriviSpaziato("LISTINO RIVENDITORE", MARGINE, yNome - 27, normale, 14, 2.2, NAVY);

      // la riga verticale e, a destra, la data: piccola, distanziata, con
      // il suo trattino d'oro sotto
      const xRiga = MARGINE + larghezzaNomeDitta + 46;
      pagina.drawLine({ start: { x: xRiga, y: yNome + 22 }, end: { x: xRiga, y: yNome - 30 }, thickness: 0.8, color: colore(BORDO) });
      const righeData = ["AGGIORNATO AL", data.toUpperCase()];
      righeData.forEach((t, i) => {
        const larg = larghezzaSpaziata(t, grassetto, 8, 1.4);
        scriviSpaziato(t, destraPagina - larg, yNome + 4 - i * 12, grassetto, 8, 1.4, i === 0 ? GRIGIO : NAVY);
        if (i === 1) {
          pagina.drawLine({ start: { x: destraPagina - larg, y: yNome - 14 }, end: { x: destraPagina, y: yNome - 14 }, thickness: 1.2, color: colore(ORO) });
        }
      });
      y = yNome - 52;
    } else {
      // le pagine dopo: la stessa testata in piccolo, perche' un foglio
      // staccato dal mazzo deve dire da solo di chi e'
      const larg = scriviSpaziato("ELITEDERMA", MARGINE, y - 12, serifGrassetto, 13, 1.4, NAVY);
      pagina.drawLine({ start: { x: MARGINE, y: y - 17 }, end: { x: MARGINE + larg, y: y - 17 }, thickness: 1, color: colore(ORO) });
      scriviSpaziato("LISTINO RIVENDITORE", MARGINE + larg + 14, y - 12, normale, 9, 1.2, GRIGIO);
      scriviDestra(data.toUpperCase(), destraPagina, y - 12, grassetto, 8, GRIGIO);
      y -= 34;
    }
    intestazioneColonne();
  }

  function intestazioneColonne() {
    pagina.drawText("PRODOTTO", { x: xNome, y: y - 9, size: 7.5, font: grassetto, color: colore(GRIGIO) });
    colonne.forEach((c) => scriviDestra(c.titolo.toUpperCase(), c.destra, y - 9, grassetto, 7.5, GRIGIO));
    pagina.drawLine({ start: { x: MARGINE, y: y - 16 }, end: { x: destraPagina, y: y - 16 }, thickness: 0.8, color: colore(BORDO) });
    y -= 24;
  }

  function spazio(quanto) {
    if (y - quanto < MARGINE + 16) nuovaPagina();
  }

  nuovaPagina();

  for (const reparto of reparti) {
    // il titolo del reparto non resta mai solo in fondo alla pagina: con
    // meno di due righe sotto si passa alla successiva
    spazio(28 + ALTEZZA_RIGA * 2);
    pagina.drawRectangle({ x: MARGINE, y: y - 18, width: destraPagina - MARGINE, height: 20, color: colore(NAVY) });
    pagina.drawText(soloWinAnsi(reparto.nome), { x: MARGINE + 8, y: y - 12, size: 9.5, font: grassetto, color: rgb(1, 1, 1) });
    scriviDestra(`${reparto.prodotti.length} prodotti`, destraPagina - 8, y - 12, normale, 8, [1, 1, 1]);
    y -= 28;

    let dispari = false;
    for (const p of reparto.prodotti) {
      spazio(ALTEZZA_RIGA);
      dispari = !dispari;
      if (dispari) {
        pagina.drawRectangle({ x: MARGINE, y: y - ALTEZZA_RIGA + 6, width: destraPagina - MARGINE, height: ALTEZZA_RIGA, color: colore(RIGA_CHIARA) });
      }

      const foto = fotoPerProdotto.get(p.id);
      if (foto) {
        try {
          const immagine = foto.tipo === "png" ? await pdf.embedPng(foto.bytes) : await pdf.embedJpg(foto.bytes);
          const scala = Math.min(LATO_FOTO / immagine.width, LATO_FOTO / immagine.height);
          const w = immagine.width * scala, h = immagine.height * scala;
          pagina.drawImage(immagine, {
            x: xFoto + (LATO_FOTO - w) / 2,
            y: y - ALTEZZA_RIGA + 10 + (LATO_FOTO - h) / 2,
            width: w, height: h,
          });
        } catch { /* una foto che pdf-lib rifiuta lascia il posto vuoto */ }
      }

      const yTesto = y - 14;
      pagina.drawText(accorcia(p.nome, normale, 9, larghezzaNome), { x: xNome, y: yTesto, size: 9, font: normale, color: colore(NAVY) });
      scriviDestra(euro(p.pubblico_lordo), colonne[0].destra, yTesto, normale, 9.5, GRIGIO);
      scriviDestra(euro(p.prezzo_rivenditore), colonne[1].destra, yTesto, grassetto, 10.5, NAVY);

      y -= ALTEZZA_RIGA;
    }
    y -= 6;
  }

  // IL PIEDE, su tutte le pagine. Qui stanno i dati della societa': un
  // listino gira, viene stampato, finisce in mano a qualcuno che magari
  // vuole ordinare — e deve poter leggere chi siamo e dove scrivere senza
  // tornare a cercare la mail con cui gliel'abbiamo mandato.
  const data = new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const rigaSocieta = righeSocieta.length
    ? righeSocieta.join("  \u00B7  ")
    : "Elitederma";
  pdf.getPages().forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGINE, y: 34 }, end: { x: destraPagina, y: 34 }, thickness: 0.6, color: colore(BORDO) });
    pg.drawText(soloWinAnsi(rigaSocieta), { x: MARGINE, y: 24, size: 7, font: normale, color: colore(GRIGIO) });
    pg.drawText(soloWinAnsi(`Listino rivenditore del ${data} - prezzi IVA inclusa`), {
      x: MARGINE, y: 15, size: 7, font: normale, color: colore(GRIGIO),
    });
    const n = `${i + 1} / ${pdf.getPageCount()}`;
    pg.drawText(n, { x: destraPagina - grassetto.widthOfTextAtSize(n, 8), y: 15, size: 8, font: grassetto, color: colore(NAVY) });
  });

  return { bytes: await pdf.save(), prodotti: quanti, pagine: pdf.getPageCount() };
}

export function scaricaPdf(bytes, nomeFile) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// usato solo dal banco di prova: tiene fuori supabase da chi vuole
// provare l'impaginazione senza rete
export const _soloPerProve = { fotoPerPdf, supabase };
