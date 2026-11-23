// IL CERTIFICATO DI ABILITAZIONE «42 ORE» (23/11/2026).
//
// Il modello e' il PDF del titolare: una pagina A4 con il testo, le due
// firme gia' stampate e nove riquadri rossi dove scrivere i dati dello
// studente. Quei riquadri NON sono campi di un modulo: sono note di
// testo (annotazioni «FreeText») appoggiate sopra la pagina. Per questo
// il certificato si fa cosi':
//
//   1. si apre il modello e si TOLGONO le nove note (e il modulo vuoto
//      che le accompagna): senza, il certificato uscirebbe con i bordi
//      rossi e con delle caselle che chiunque puo' riscrivere;
//   2. i dati si DISEGNANO nella pagina, nei rettangoli delle note.
//
// Disegnati, non scritti in un campo: e' questo che rende il PDF
// definitivo. Una casella di un modulo si cambia con qualunque lettore;
// un testo stampato nella pagina no.
//
// I rettangoli sono quelli misurati sul modello (in punti, origine in
// basso a sinistra). Se un giorno il modello cambia, vanno rimisurati:
// `riquadriDelModello` li rilegge dal file, e la generazione usa quelli
// del file quando ci sono — i numeri scritti qui sono il ripiego.
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";

export const RIQUADRI_42_ORE = {
  nome: [90, 403, 287, 419],
  cognome: [349, 404, 546, 420],
  luogoNascita: [91, 381, 409, 397],
  dataNascita: [459, 381, 547, 397],
  indirizzo: [116, 359, 265, 375],
  comune: [328, 359, 476, 375],
  provincia: [510, 359, 547, 375],
  periodo: [212, 164, 402, 180],
  luogoData: [118, 121, 249, 137],
};

// Le voci del modulo, nell'ordine del certificato. Sono quelle che il
// modello lascia da riempire, e nessun'altra: il resto del foglio
// (docente, ore, firme) e' scritto e non si tocca.
export const CAMPI_42_ORE = [
  { chiave: "nome", etichetta: "Nome", obbligatorio: true },
  { chiave: "cognome", etichetta: "Cognome", obbligatorio: true },
  { chiave: "luogo_nascita", etichetta: "Nata a", obbligatorio: true },
  { chiave: "data_nascita", etichetta: "In data (nascita)", tipo: "date", obbligatorio: true },
  { chiave: "indirizzo", etichetta: "Residente in via", obbligatorio: true },
  { chiave: "comune", etichetta: "Comune", obbligatorio: true },
  { chiave: "provincia", etichetta: "Prov", obbligatorio: true, massimo: 2 },
  { chiave: "corso_dal", etichetta: "Corso svolto dal", tipo: "date", obbligatorio: true },
  { chiave: "corso_al", etichetta: "al", tipo: "date", obbligatorio: true },
  { chiave: "luogo_rilascio", etichetta: "Luogo", obbligatorio: true },
  { chiave: "data_rilascio", etichetta: "Data", tipo: "date", obbligatorio: true },
];

export function datiVuoti42(oggi = new Date()) {
  const d = {};
  for (const c of CAMPI_42_ORE) d[c.chiave] = "";
  d.luogo_rilascio = "Roma";
  d.data_rilascio = isoGiorno(oggi);
  return d;
}

export function isoGiorno(d) {
  // il giorno di Roma, non quello UTC: un certificato fatto alle 00:30
  // e' gia' del giorno dopo per chi lo firma
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(d);
}

// "2026-11-23" -> "23/11/2026". Una data scritta in un altro modo si
// lascia com'e': meglio la cifra di chi l'ha scritta che una sbagliata.
export function dataItaliana(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

// Quello che manca per poter generare, con il nome della voce: un
// certificato con una riga vuota non e' un certificato, e «manca
// qualcosa» senza dire cosa fa rileggere tutto il modulo.
export function mancanti42(dati) {
  const fuori = CAMPI_42_ORE.filter((c) => c.obbligatorio && !String(dati?.[c.chiave] || "").trim()).map((c) => c.etichetta);
  if (dati?.corso_dal && dati?.corso_al && dati.corso_al < dati.corso_dal) fuori.push("il corso finisce prima di cominciare");
  return fuori;
}

// Cosa va scritto in ogni riquadro, gia' composto
export function testiDelCertificato(dati) {
  return {
    nome: String(dati.nome || "").trim(),
    cognome: String(dati.cognome || "").trim(),
    luogoNascita: String(dati.luogo_nascita || "").trim(),
    dataNascita: dataItaliana(dati.data_nascita),
    indirizzo: String(dati.indirizzo || "").trim(),
    comune: String(dati.comune || "").trim(),
    provincia: String(dati.provincia || "").trim().toUpperCase(),
    periodo: `${dataItaliana(dati.corso_dal)} al ${dataItaliana(dati.corso_al)}`,
    luogoData: `${String(dati.luogo_rilascio || "").trim()}, ${dataItaliana(dati.data_rilascio)}`,
  };
}

// I font di serie di pdf-lib scrivono solo WinAnsi: un carattere fuori
// (un apostrofo tipografico incollato, un emoji) fa fallire il documento
// a meta' strada. Si riducono ai loro gemelli semplici, e quello che non
// ha un gemello si toglie.
export function soloWinAnsi(t) {
  return String(t || "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^ -~ -ÿ€]/g, "");
}

// Rilegge i rettangoli delle nove note dal modello, nell'ordine in cui
// stanno sulla pagina, e li assegna alle voci per posizione: chi e' piu'
// vicino al rettangolo atteso. Se il modello non ha note, null.
export function riquadriDelModello(doc) {
  const pagina = doc.getPage(0);
  const note = pagina.node.Annots();
  if (!note || note.size() === 0) return null;
  const rett = [];
  for (let i = 0; i < note.size(); i++) {
    const a = doc.context.lookup(note.get(i));
    if (String(a?.get(PDFName.of("Subtype"))) !== "/FreeText") continue;
    const r = doc.context.lookup(a.get(PDFName.of("Rect")));
    if (!r?.asArray) continue;
    rett.push(r.asArray().map((n) => Number(doc.context.lookup(n)?.asNumber?.() ?? doc.context.lookup(n)?.numberValue ?? 0)));
  }
  if (rett.length === 0) return null;
  const esito = {};
  for (const [chiave, atteso] of Object.entries(RIQUADRI_42_ORE)) {
    let migliore = null, distanza = Infinity;
    for (const r of rett) {
      const d = Math.abs(r[0] - atteso[0]) + Math.abs(r[1] - atteso[1]);
      if (d < distanza) { distanza = d; migliore = r; }
    }
    // oltre 30 punti non e' lo stesso riquadro: si resta sul numero scritto
    esito[chiave] = migliore && distanza < 30 ? migliore.map((n) => Math.min(n, 9999)) : atteso;
  }
  return esito;
}

const COLORE_TESTO = rgb(0.09, 0.11, 0.2);
// il foglio del modello non e' bianco pieno ma 254/255: col bianco puro le
// toppe sotto i dati si vedrebbero, a guardarle da vicino
const FONDO_FOGLIO = rgb(254 / 255, 254 / 255, 254 / 255);

// Il cuore: dal modello e dai dati, i byte del certificato definitivo.
export async function generaPdfCertificato42(modelloBytes, dati) {
  const doc = await PDFDocument.load(modelloBytes);
  const riquadri = riquadriDelModello(doc) || RIQUADRI_42_ORE;
  const pagina = doc.getPage(0);
  // via le note (i bordi rossi) e il modulo che le accompagna: quello
  // che resta e' una pagina sola, senza niente da riempire
  pagina.node.delete(PDFName.of("Annots"));
  doc.catalog.delete(PDFName.of("AcroForm"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const testi = testiDelCertificato(dati);
  for (const [chiave, r] of Object.entries(riquadri)) {
    const [x1, y1, x2, y2] = r;
    // sotto le note rosse il modello ha un riquadrino grigio chiaro, che
    // stampato sembra una casella lasciata da riempire: si copre col
    // bianco del foglio, appena piu' largo del riquadro
    pagina.drawRectangle({ x: Math.min(x1, x2) - 3, y: Math.min(y1, y2) - 3, width: Math.abs(x2 - x1) + 7.5, height: Math.abs(y2 - y1) + 6, color: FONDO_FOGLIO });
    const testo = soloWinAnsi(testi[chiave]);
    if (!testo) continue;
    const larghezza = Math.abs(x2 - x1) - 6;
    // corpo 10,5, che rimpicciolisce se il testo e' lungo: un nome tagliato
    // su un certificato e' peggio di un nome scritto piccolo
    let corpo = 10.5;
    while (corpo > 6 && font.widthOfTextAtSize(testo, corpo) > larghezza) corpo -= 0.5;
    pagina.drawText(testo, {
      x: Math.min(x1, x2) + 3,
      // sulla stessa riga delle etichette stampate accanto («Nome:»)
      y: Math.min(y1, y2) + 0.3,
      size: corpo,
      font,
      color: COLORE_TESTO,
    });
  }
  doc.setTitle(soloWinAnsi(`Certificato di abilitazione - ${testi.nome} ${testi.cognome}`));
  doc.setProducer("Elitederma");
  doc.setCreator("Elitederma");
  return await doc.save();
}

export function nomeFileCertificato(dati) {
  const pulito = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Certificato-42-ore-${pulito(dati.cognome)}-${pulito(dati.nome)}.pdf`;
}
