// IL CERTIFICATO DI ABILITAZIONE «NEEDLING» (23/11/2026).
//
// Il secondo certificato di «Crea certificato», chiesto dal titolare
// subito dopo il 42 ore. Il modello e' «Certificato abilitazione PMU 16
// ore compilabile»: stessa intestazione e stesse firme del 42 ore, ma
// sedici ore e una voce in piu', il codice fiscale dello studente.
//
// A differenza del 42 ore qui le caselle SONO campi di un modulo vero
// (undici, con un nome ciascuno). Il certificato si fa comunque allo
// stesso modo — via il modulo, i dati disegnati nella pagina — perche'
// un campo compilato si riscrive con qualunque lettore di PDF, e un
// certificato che si corregge da se' non e' un certificato.
//
// I rettangoli si leggono dal modello per NOME del campo, che e' piu'
// solido della posizione; quelli scritti qui sotto sono il ripiego, se un
// giorno il modello arrivasse senza modulo.
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import { dataItaliana, soloWinAnsi, isoGiorno } from "./certificato-42-ore.js";

// voce del certificato -> nome del campo nel modello
export const CAMPI_PDF_NEEDLING = {
  nome: "studente_nome",
  cognome: "studente_cognome",
  luogoNascita: "studente_nato_a",
  dataNascita: "studente_data_nascita",
  indirizzo: "studente_residenza_via",
  comune: "studente_comune",
  provincia: "studente_provincia",
  codiceFiscale: "studente_codice_fiscale",
  corsoDal: "corso_data_inizio",
  corsoAl: "corso_data_fine",
  luogoData: "luogo_e_data",
};

export const RIQUADRI_NEEDLING = {
  nome: [87, 383.89, 269, 402.89],
  cognome: [349, 383.89, 548, 402.89],
  luogoNascita: [104, 358.89, 341, 377.89],
  dataNascita: [401, 358.89, 548, 377.89],
  indirizzo: [159, 333.89, 310, 352.89],
  comune: [376, 333.89, 485, 352.89],
  provincia: [530, 333.89, 548, 352.89],
  codiceFiscale: [111, 308.89, 351, 327.89],
  corsoDal: [246, 139.89, 365, 158.89],
  corsoAl: [394, 139.89, 488, 158.89],
  luogoData: [139, 88.89, 352, 107.89],
};

// Le voci, con le parole del foglio
export const CAMPI_NEEDLING = [
  { chiave: "nome", etichetta: "Nome", obbligatorio: true },
  { chiave: "cognome", etichetta: "Cognome", obbligatorio: true },
  { chiave: "luogo_nascita", etichetta: "Nato/a", obbligatorio: true },
  { chiave: "data_nascita", etichetta: "In data (nascita)", tipo: "date", obbligatorio: true },
  { chiave: "indirizzo", etichetta: "Residente in via", obbligatorio: true },
  { chiave: "comune", etichetta: "Comune", obbligatorio: true },
  { chiave: "provincia", etichetta: "Prov", obbligatorio: true, massimo: 2 },
  { chiave: "codice_fiscale", etichetta: "Cod. fis.", obbligatorio: true, massimo: 16 },
  { chiave: "corso_dal", etichetta: "Corso svolto dal", tipo: "date", obbligatorio: true },
  { chiave: "corso_al", etichetta: "al", tipo: "date", obbligatorio: true },
  { chiave: "luogo_rilascio", etichetta: "Luogo", obbligatorio: true },
  { chiave: "data_rilascio", etichetta: "Data", tipo: "date", obbligatorio: true },
];

export function datiVuotiNeedling(oggi = new Date()) {
  const d = {};
  for (const c of CAMPI_NEEDLING) d[c.chiave] = "";
  d.luogo_rilascio = "Roma";
  d.data_rilascio = isoGiorno(oggi);
  return d;
}

export function mancantiNeedling(dati) {
  const fuori = CAMPI_NEEDLING.filter((c) => c.obbligatorio && !String(dati?.[c.chiave] || "").trim()).map((c) => c.etichetta);
  if (dati?.corso_dal && dati?.corso_al && dati.corso_al < dati.corso_dal) fuori.push("il corso finisce prima di cominciare");
  return fuori;
}

export function testiNeedling(dati) {
  const t = (v) => String(v || "").trim();
  return {
    nome: t(dati.nome),
    cognome: t(dati.cognome),
    luogoNascita: t(dati.luogo_nascita),
    dataNascita: dataItaliana(dati.data_nascita),
    indirizzo: t(dati.indirizzo),
    comune: t(dati.comune),
    provincia: t(dati.provincia).toUpperCase(),
    codiceFiscale: t(dati.codice_fiscale).toUpperCase(),
    corsoDal: dataItaliana(dati.corso_dal),
    corsoAl: dataItaliana(dati.corso_al),
    luogoData: `${t(dati.luogo_rilascio)}, ${dataItaliana(dati.data_rilascio)}`,
  };
}

// I rettangoli dei campi, letti dal modello per nome
export function riquadriNeedlingDelModello(doc) {
  let form;
  try { form = doc.getForm(); } catch { return null; }
  const esito = {};
  let trovati = 0;
  for (const [chiave, nomeCampo] of Object.entries(CAMPI_PDF_NEEDLING)) {
    try {
      const r = form.getTextField(nomeCampo).acroField.getWidgets()[0].getRectangle();
      esito[chiave] = [r.x, r.y, r.x + r.width, r.y + r.height];
      trovati += 1;
    } catch {
      esito[chiave] = RIQUADRI_NEEDLING[chiave];
    }
  }
  return trovati > 0 ? esito : null;
}

const COLORE_TESTO = rgb(0.09, 0.11, 0.2);

export async function generaPdfCertificatoNeedling(modelloBytes, dati) {
  const doc = await PDFDocument.load(modelloBytes);
  const riquadri = riquadriNeedlingDelModello(doc) || RIQUADRI_NEEDLING;
  const pagina = doc.getPage(0);
  // via i campi (le caselle azzurre) e il modulo: resta la pagina, con i
  // dati stampati sopra e niente da riscrivere
  pagina.node.delete(PDFName.of("Annots"));
  doc.catalog.delete(PDFName.of("AcroForm"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const testi = testiNeedling(dati);
  for (const [chiave, r] of Object.entries(riquadri)) {
    const testo = soloWinAnsi(testi[chiave]);
    if (!testo) continue;
    const [x1, y1, x2, y2] = r;
    const larghezza = Math.abs(x2 - x1) - 4;
    let corpo = 10.5;
    while (corpo > 6 && font.widthOfTextAtSize(testo, corpo) > larghezza) corpo -= 0.5;
    pagina.drawText(testo, {
      x: Math.min(x1, x2) + 2,
      // la riga di base delle etichette stampate («Nome:») sta tre punti
      // sopra il fondo della casella
      y: Math.min(y1, y2) + 3.2,
      size: corpo,
      font,
      color: COLORE_TESTO,
    });
  }
  doc.setTitle(soloWinAnsi(`Certificato di abilitazione needling - ${testi.nome} ${testi.cognome}`));
  doc.setProducer("Elitederma");
  doc.setCreator("Elitederma");
  return await doc.save();
}
