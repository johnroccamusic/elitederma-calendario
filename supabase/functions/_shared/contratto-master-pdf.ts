// IL CONTRATTO MASTER, COMPLETO E FIRMATO, IN PDF.
//
// Lo costruisce il server e non il telefono di chi firma, per la stessa
// ragione dichiarata nel CLAUDE.md per il modulo di iscrizione: questo
// documento deve PARTIRE ALLEGATO a una mail che manda il server — a lei
// e all'Accademia. Se lo facesse il browser, basterebbe che la pagina si
// chiuda un istante prima e la copia non arriverebbe a nessuno, cioe' si
// perderebbe la cosa per cui esiste.
//
// COSA CONGELA. Le parti con l'epigrafe composta dai dati che lei ha
// dichiarato, le premesse, i ventitre articoli, «Luogo e data», le TRE
// FIRME del cartaceo — contratto, approvazione specifica delle clausole
// degli artt. 1341 e 1342 c.c., ricevuta dell'Allegato A — l'Allegato A
// per intero, le tre dichiarazioni con la loro ora, e le due foto del
// documento. Il testo arriva da `master_contratti.contratto_firmato`,
// scritto dal server al momento della firma: correggere una clausola
// domani non cambia una virgola di questo foglio.
//
// LA FIRMA E' UNA E SI STAMPA TRE VOLTE. Sul cartaceo ci sono tre righe
// di firma, e tre atti distinti vogliono tre righe; ma chiedere a una
// persona di disegnare tre volte lo stesso tratto col dito non aggiunge
// niente e fa perdere la pazienza. Quello che distingue i tre atti e' la
// spunta con il suo istante, non il tratto.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { comprimiPerIlPdf, soloCaratteriScrivibili } from "./modulo-pdf.ts";
import {
  ARTICOLI, CASELLE, CHIUSURA, CLAUSOLE, INTESTAZIONE, MANIFESTO, PARTI, PREMESSE,
  blocchiContratto, casellePronte, giornoLungo, luogoEData,
} from "./contratto-master.js";

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 48;
const NAVY = rgb(0.055, 0.106, 0.2);
const GRIGIO = rgb(0.33, 0.35, 0.37);
const CHIARO = rgb(0.62, 0.63, 0.66);

function cheRobaE(byte: Uint8Array): "pdf" | "jpeg" | "png" | "ignoto" {
  if (byte.length < 4) return "ignoto";
  if (byte[0] === 0x25 && byte[1] === 0x50 && byte[2] === 0x44 && byte[3] === 0x46) return "pdf";
  if (byte[0] === 0xff && byte[1] === 0xd8) return "jpeg";
  if (byte[0] === 0x89 && byte[1] === 0x50 && byte[2] === 0x4e && byte[3] === 0x47) return "png";
  return "ignoto";
}

type Foglio = { pagina: any; y: number };

export async function creaPdfContrattoMaster({ contratto, societa, firma, fronte, retro, timbro = null }: {
  contratto: Record<string, any>;
  societa: Record<string, any> | null;
  firma: Uint8Array | null;
  fronte: Uint8Array | null;
  retro: Uint8Array | null;
  timbro?: Uint8Array | null;
}): Promise<{ byte: Uint8Array; pagine: number; scartate: string[] }> {
  const pdf = await PDFDocument.create();
  const scartate: string[] = [];
  const tondo = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);

  let f: Foglio = { pagina: pdf.addPage([A4.larghezza, A4.altezza]), y: A4.altezza - MARGINE };
  const larghezzaUtile = A4.larghezza - MARGINE * 2;

  const spazio = (quanto: number) => {
    if (f.y - quanto < MARGINE + 24) {
      f = { pagina: pdf.addPage([A4.larghezza, A4.altezza]), y: A4.altezza - MARGINE };
    }
    f.y -= quanto;
  };

  const aCapo = (testo: string, font: any, misura: number, larghezza: number) => {
    const righe: string[] = [];
    for (const paragrafo of soloCaratteriScrivibili(testo).split("\n")) {
      let riga = "";
      for (const parola of paragrafo.split(/\s+/)) {
        const prova = riga ? riga + " " + parola : parola;
        if (font.widthOfTextAtSize(prova, misura) > larghezza && riga) { righe.push(riga); riga = parola; }
        else riga = prova;
      }
      righe.push(riga);
    }
    return righe;
  };

  const scrivi = (testo: string, { misura = 9, font = tondo, colore = NAVY, interlinea = 1.45, dopo = 0, rientro = 0 } = {}) => {
    for (const riga of aCapo(testo, font, misura, larghezzaUtile - rientro)) {
      spazio(misura * interlinea);
      f.pagina.drawText(riga, { x: MARGINE + rientro, y: f.y, size: misura, font, color: colore });
    }
    if (dopo) spazio(dopo);
  };

  const titolo = (testo: string) => {
    spazio(12);
    scrivi(testo.toUpperCase(), { misura: 10.5, font: grassetto, dopo: 4 });
    spazio(2);
    f.pagina.drawLine({
      start: { x: MARGINE, y: f.y + 6 }, end: { x: A4.larghezza - MARGINE, y: f.y + 6 },
      thickness: 0.7, color: CHIARO,
    });
    spazio(6);
  };

  const quando = (iso: unknown) => {
    if (!iso) return "";
    try {
      return new Date(String(iso)).toLocaleString("it-IT", {
        timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return String(iso); }
  };

  // LA FIRMA, DISEGNATA DOVE SERVE. Si prepara una volta sola e si posa
  // tre volte: tre `embedPng` dello stesso file sarebbero tre copie
  // dell'immagine dentro il PDF, cioe' un allegato piu' pesante per
  // niente.
  let immagineFirma: any = null;
  if (firma) {
    try {
      immagineFirma = cheRobaE(firma) === "jpeg" ? await pdf.embedJpg(firma) : await pdf.embedPng(firma);
    } catch { scartate.push("firma"); }
  }
  const rigaDiFirma = (etichetta: string, quandoFirmata: unknown) => {
    spazio(14);
    scrivi(etichetta, { misura: 8.5, colore: GRIGIO });
    if (immagineFirma) {
      const larghezza = 190;
      const altezza = (immagineFirma.height / immagineFirma.width) * larghezza;
      spazio(altezza + 4);
      f.pagina.drawImage(immagineFirma, { x: MARGINE, y: f.y, width: larghezza, height: altezza });
    } else {
      scrivi("(firma non leggibile)", { misura: 8.5, colore: GRIGIO });
    }
    f.pagina.drawLine({
      start: { x: MARGINE, y: f.y - 4 }, end: { x: MARGINE + 230, y: f.y - 4 },
      thickness: 0.7, color: CHIARO,
    });
    spazio(10);
    if (quandoFirmata) scrivi("Sottoscritta il " + quando(quandoFirmata), { misura: 8, colore: GRIGIO });
  };

  const congelato = contratto.contratto_firmato || {};
  const testi = {
    intestazione: congelato.intestazione || INTESTAZIONE,
    parti: congelato.parti || PARTI,
    premesse: congelato.premesse || PREMESSE,
    articoli: congelato.articoli || ARTICOLI,
    clausole: congelato.clausole || CLAUSOLE,
    manifesto: congelato.manifesto || MANIFESTO,
    caselle: congelato.caselle || CASELLE,
  };
  const dati = contratto.dati || {};

  // ---------------------------------------------------------------- testata
  scrivi(soloCaratteriScrivibili(societa?.ragione_sociale || societa?.nome || "ELITEDERMA S.R.L."), { misura: 13, font: grassetto });
  const sottoTestata = [societa?.indirizzo, societa?.citta, societa?.piva ? "P.IVA " + societa.piva : null]
    .filter(Boolean).join(" · ");
  if (sottoTestata) scrivi(sottoTestata, { misura: 8.5, colore: GRIGIO });
  spazio(10);
  scrivi(testi.intestazione.titolo + " — COPIA FIRMATA", { misura: 12, font: grassetto });
  scrivi([testi.intestazione.sottotitolo, testi.intestazione.versione].filter(Boolean).join(" · "), { misura: 8.5, colore: GRIGIO });
  scrivi("Sottoscritto il " + quando(contratto.firmato_il) + " — compilato e firmato online dal/dalla Master",
    { misura: 8.5, colore: GRIGIO, dopo: 6 });

  // ------------------------------------------------- il contratto per intero
  for (const blocco of blocchiContratto(testi, dati)) {
    titolo(blocco.titolo || "");
    for (const punto of blocco.punti || []) {
      const voce = String(punto).trim().startsWith("•");
      spazio(3);
      scrivi(punto, { misura: 8.6, colore: voce ? GRIGIO : NAVY, rientro: voce ? 12 : 0 });
    }
  }

  // ---------------------------------------------------- luogo, data e firme
  titolo("Luogo e data");
  scrivi(CHIUSURA.luogoData + " " + (luogoEData(dati, contratto.firmato_il) || giornoLungo(contratto.firmato_il)),
    { misura: 9.5, font: grassetto });

  titolo(CHIUSURA.perMaster);
  rigaDiFirma(CHIUSURA.firma, contratto.consenso_contratto_il);

  // IL TIMBRO DELLA SOCIETA'. Un contratto sottoscritto da una parte
  // sola e' valido e si guarda monco: chi lo riapre fra un anno non ci
  // trova scritto da nessuna parte che dall'altra parte qualcuno
  // l'abbia accettato. Si innesta come PAGINA e si RITAGLIA sulla
  // finestra visibile: il file e' un A4 intero con sopra un CropBox, e
  // `embedPdf` ignorerebbe il ritaglio portandosi dietro quello che c'e'
  // sotto (nel modulo di iscrizione era un preventivo con gli importi).
  titolo(CHIUSURA.perAccademia);
  if (timbro) {
    try {
      const origineTimbro = await PDFDocument.load(timbro, { ignoreEncryption: true });
      const paginaTimbro = origineTimbro.getPage(0);
      const r = paginaTimbro.getCropBox();
      const pagina = await pdf.embedPage(paginaTimbro, {
        left: r.x, bottom: r.y, right: r.x + r.width, top: r.y + r.height,
      });
      const larghezza = 170;
      const altezza = (pagina.height / pagina.width) * larghezza;
      spazio(altezza + 4);
      f.pagina.drawPage(pagina, { x: MARGINE, y: f.y, width: larghezza, height: altezza });
    } catch (e) {
      scrivi("(timbro non disponibile)", { misura: 8.5, colore: GRIGIO });
      scartate.push(`timbro: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    scrivi("(timbro non disponibile)", { misura: 8.5, colore: GRIGIO });
  }

  // ---------------------------- l'approvazione specifica delle clausole
  //
  // E' UNA SECONDA SOTTOSCRIZIONE, con l'elenco per intero: senza le
  // sedici voci, «approva specificamente le seguenti clausole:» e'
  // un'approvazione specifica di nulla.
  f = { pagina: pdf.addPage([A4.larghezza, A4.altezza]), y: A4.altezza - MARGINE };
  titolo(testi.clausole.titolo);
  for (const punto of testi.clausole.punti || []) {
    const voce = String(punto).trim().startsWith("•");
    spazio(3);
    scrivi(punto, { misura: 8.6, colore: voce ? GRIGIO : NAVY, rientro: voce ? 12 : 0 });
  }
  rigaDiFirma(CHIUSURA.firmaClausole, contratto.consenso_clausole_il);

  // ------------------------------------------------------- l'Allegato A
  f = { pagina: pdf.addPage([A4.larghezza, A4.altezza]), y: A4.altezza - MARGINE };
  scrivi(testi.manifesto.titolo, { misura: 12, font: grassetto });
  scrivi(testi.manifesto.versione, { misura: 8.5, colore: GRIGIO, dopo: 6 });
  for (const blocco of testi.manifesto.blocchi || []) {
    titolo(blocco.titolo || "");
    for (const punto of blocco.punti || []) {
      spazio(3);
      scrivi(punto, { misura: 8.6, colore: NAVY });
    }
  }
  rigaDiFirma(CHIUSURA.firmaManifesto, contratto.consenso_manifesto_il);

  // --------------------------------------------------- le dichiarazioni
  //
  // QUELLO CHE SI STAMPA E' LA FRASE CHE HA ACCETTATO LEI, non un
  // riassunto: davanti a una contestazione conta la frase per intero,
  // con la sua data e la sua ora. E LA SPUNTA LA DECIDE LA MARCA
  // TEMPORALE — non esiste una colonna vero/falso, la prova che un
  // consenso e' stato dato e' l'istante in cui e' stato dato.
  f = { pagina: pdf.addPage([A4.larghezza, A4.altezza]), y: A4.altezza - MARGINE };
  titolo("Dichiarazioni sottoscritte");
  const ore: Record<string, unknown> = {
    contratto: contratto.consenso_contratto_il,
    clausole: contratto.consenso_clausole_il,
    manifesto: contratto.consenso_manifesto_il,
  };
  for (const casella of casellePronte(testi)) {
    spazio(12);
    const yRiga = f.y;
    const ora = ore[casella.chiave];
    f.pagina.drawText(ora ? "[X]" : "[ ]", { x: MARGINE, y: yRiga, size: 9.5, font: grassetto, color: NAVY });
    if (ora) f.pagina.drawText(quando(ora), { x: A4.larghezza - MARGINE - 95, y: yRiga, size: 8, font: tondo, color: GRIGIO });
    f.y += 12;
    scrivi(casella.etichetta, { misura: 8.6, font: grassetto, rientro: 22 });
    scrivi(casella.testo, { misura: 8.2, colore: GRIGIO, rientro: 22 });
    for (const voce of (casella.clausole || []) as string[]) {
      scrivi("- " + voce, { misura: 7.6, colore: GRIGIO, rientro: 34, interlinea: 1.35 });
    }
    spazio(4);
  }
  if (contratto.testo_letto_il) {
    spazio(8);
    scrivi("Il contratto e l'Allegato A sono stati aperti e richiusi prima della firma, il "
      + quando(contratto.testo_letto_il) + ".", { misura: 8, colore: GRIGIO });
  }
  if (congelato.origine === "client") {
    spazio(8);
    scrivi("Nota tecnica: il testo di questa copia e' quello che la pagina mostrava al momento della firma; le righe del database non erano disponibili.",
      { misura: 7.6, colore: GRIGIO });
  }
  if (congelato.uguale_a_quello_mostrato === false) {
    spazio(6);
    scrivi("Nota tecnica: il testo nel database risultava diverso da quello mostrato nella pagina al momento della firma: qui vale il testo del database.",
      { misura: 7.6, colore: GRIGIO });
  }

  // ----------------------------------------------------- il documento
  for (const [etichetta, byte] of [["Documento d'identita - fronte", fronte], ["Documento d'identita - retro", retro]] as [string, Uint8Array | null][]) {
    if (!byte) continue;
    try {
      if (cheRobaE(byte) === "pdf") {
        const origine = await PDFDocument.load(byte, { ignoreEncryption: true });
        const copie = await pdf.copyPages(origine, origine.getPageIndices());
        if (!copie.length) throw new Error("PDF senza pagine");
        const intestazione = pdf.addPage([A4.larghezza, A4.altezza]);
        intestazione.drawText(etichetta, { x: MARGINE, y: A4.altezza - MARGINE, size: 10, font: grassetto, color: NAVY });
        for (const c of copie) pdf.addPage(c);
        continue;
      }
      const { byte: leggero, jpeg } = await comprimiPerIlPdf(byte);
      const tipo = jpeg ? "jpeg" : cheRobaE(leggero);
      if (tipo !== "jpeg" && tipo !== "png") throw new Error("formato non riconosciuto");
      const immagine = tipo === "jpeg" ? await pdf.embedJpg(leggero) : await pdf.embedPng(leggero);
      const pagina = pdf.addPage([A4.larghezza, A4.altezza]);
      pagina.drawText(etichetta, { x: MARGINE, y: A4.altezza - MARGINE, size: 10, font: grassetto, color: NAVY });
      const scala = Math.min(larghezzaUtile / immagine.width, (A4.altezza - MARGINE * 2 - 30) / immagine.height);
      pagina.drawImage(immagine, {
        x: MARGINE, y: A4.altezza - MARGINE - 24 - immagine.height * scala,
        width: immagine.width * scala, height: immagine.height * scala,
      });
    } catch (e) {
      // una foto che non si apre non deve impedire la copia, ma deve
      // risultare: la pagina non e' stata nemmeno aggiunta, quindi il
      // PDF non ha fogli bianchi
      scartate.push(`${etichetta}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { byte: await pdf.save(), pagine: pdf.getPageCount(), scartate };
}
