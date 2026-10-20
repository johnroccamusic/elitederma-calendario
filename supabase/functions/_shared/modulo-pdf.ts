// IL MODULO DI ISCRIZIONE, COMPLETO E FIRMATO, IN PDF.
//
// Lo costruisce il server — questa funzione — e non il telefono
// dell'allieva, al contrario di tutti gli altri PDF dell'app. La ragione
// e' che questo documento deve PARTIRE ALLEGATO a una mail che manda il
// server: se lo facesse il telefono, basterebbe che la pagina si chiuda
// un istante prima e la conferma uscirebbe senza allegato, cioe' senza
// la cosa per cui esiste. La deroga e' scritta anche nel CLAUDE.md.
//
// COSA CONGELA. Dati dell'allieva e del corso, le dichiarazioni spuntate
// con la loro data e ora, la firma, le foto del documento, e soprattutto
// IL TESTO DEL CONTRATTO COSI' COM'ERA quel giorno: arriva da
// `iscritti.contratto_firmato`, scritto al momento della firma dalla
// pagina che glielo aveva messo davanti. Correggere una clausola in
// Setting, domani, non cambia una virgola di questo foglio.
//
// LE FOTO SI COMPRIMONO. Un documento fotografato con un telefono di oggi
// pesa 3-4 MB: due facce fanno otto megabyte di allegato che qualche
// casella rifiuta e tutte fanno aspettare. Qui si ridimensionano a 1100
// punti di lato lungo e si riscrivono in JPEG di qualita' media: restano
// perfettamente leggibili — ci si leggono numero e scadenza — e il PDF
// intero sta sotto il mezzo megabyte.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { decode as decodeImmagine, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 48;
const NAVY = rgb(0.055, 0.106, 0.2);
const GRIGIO = rgb(0.33, 0.35, 0.37);
const CHIARO = rgb(0.62, 0.63, 0.66);

// Helvetica scrive in WinAnsi: le virgolette curve e i trattini lunghi
// che arrivano dal testo del contratto non ci stanno e fanno fallire il
// disegno. Si riportano ai loro equivalenti diritti invece di perdere la
// riga.
function soloCaratteriScrivibili(testo: unknown): string {
  return String(testo ?? "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // WinAnsi non e' Latin-1: ha una ventina di caratteri in piu' nella
    // fascia 0x80-0x9F, e fra questi c'e' l'euro. Tagliando tutto sopra
    // \xFF il simbolo spariva, e nell'elenco delle clausole la penale
    // diventava "penale di 150" — una cifra senza valuta, dentro un
    // documento che deve fare da prova. Quelli che Helvetica sa
    // scrivere si tengono; il resto si butta, come prima.
    .replace(/[^\x20-\xFF\n€•‰™ŒœŠšŸŽžƒˆ˜†‡‹›‚„]/g, "");
}

// CHE COS'E' QUESTO FILE, LETTO DAI PRIMI BYTE.
//
// Non dal nome e non dal mimetype dichiarato: il documento arriva da un
// telefono o da un PC, e il nome mente. L'allieva che ha compilato il
// modulo da computer ha caricato due PDF, non due fotografie — e per la
// prima versione di questa funzione erano "immagini non leggibili",
// scartate in silenzio.
function cheRobaE(byte: Uint8Array): "pdf" | "jpeg" | "png" | "ignoto" {
  if (byte.length < 4) return "ignoto";
  if (byte[0] === 0x25 && byte[1] === 0x50 && byte[2] === 0x44 && byte[3] === 0x46) return "pdf";
  if (byte[0] === 0xff && byte[1] === 0xd8) return "jpeg";
  if (byte[0] === 0x89 && byte[1] === 0x50 && byte[2] === 0x4e && byte[3] === 0x47) return "png";
  return "ignoto";
}

export async function comprimiPerIlPdf(byte: Uint8Array, latoMax = 1100, qualita = 55): Promise<{ byte: Uint8Array; jpeg: boolean }> {
  try {
    const immagine = await decodeImmagine(byte);
    if (!(immagine instanceof Image)) return { byte, jpeg: false };
    const lato = Math.max(immagine.width, immagine.height);
    if (lato > latoMax) {
      const scala = latoMax / lato;
      immagine.resize(Math.round(immagine.width * scala), Math.round(immagine.height * scala));
    }
    return { byte: await immagine.encodeJPEG(qualita), jpeg: true };
  } catch {
    // un formato che non sappiamo aprire (HEIC, un PDF scansionato): si
    // lascia stare e si prosegue senza quella foto, invece di non fare
    // partire niente
    return { byte, jpeg: false };
  }
}

type Foglio = { pagina: any; y: number };

export async function creaPdfModulo({ iscritto, corso, societa, firma, fronte, retro, timbro = null }: {
  iscritto: Record<string, any>;
  corso: Record<string, any> | null;
  societa: Record<string, any> | null;
  firma: Uint8Array | null;
  fronte: Uint8Array | null;
  retro: Uint8Array | null;
  /** timbro e firma della societa': chiude il documento dall'altra parte */
  timbro?: Uint8Array | null;
  // CHI GENERA DEVE POTER DIRE COSA MANCA.
  //
  // Le foto si saltano se non si aprono — giusto, un documento storto non
  // deve fermare la conferma — ma saltarle in silenzio vorrebbe dire
  // mandare all'allieva un modulo senza il suo documento senza che
  // nessuno se ne accorga. Quindi chi chiama riceve anche l'elenco di
  // quello che e' rimasto fuori, e in prova lo si legge.
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

  // pdf-lib non manda a capo da solo: senza questo, una clausola lunga
  // esce dal foglio e sparisce
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

  // `rientro` sposta il blocco a destra (serve al testo dei consensi, che
  // sta sotto la sua casella) e `larghezza` lo stringe, per non finire
  // sotto la colonna delle ore a destra.
  const scrivi = (testo: string, { misura = 9.5, font = tondo, colore = NAVY, interlinea = 1.45, dopo = 0, rientro = 0, larghezza = 0 } = {}) => {
    const quanto = larghezza || larghezzaUtile - rientro;
    for (const riga of aCapo(testo, font, misura, quanto)) {
      spazio(misura * interlinea);
      f.pagina.drawText(riga, { x: MARGINE + rientro, y: f.y, size: misura, font, color: colore });
    }
    if (dopo) spazio(dopo);
  };

  const titolo = (testo: string) => {
    spazio(12);
    scrivi(testo.toUpperCase(), { misura: 11, font: grassetto, dopo: 4 });
    spazio(2);
    f.pagina.drawLine({
      start: { x: MARGINE, y: f.y + 6 }, end: { x: A4.larghezza - MARGINE, y: f.y + 6 },
      thickness: 0.7, color: CHIARO,
    });
    spazio(6);
  };

  const riga = (etichetta: string, valore: unknown) => {
    const v = soloCaratteriScrivibili(valore).trim();
    if (!v) return;
    spazio(13);
    f.pagina.drawText(soloCaratteriScrivibili(etichetta), { x: MARGINE, y: f.y, size: 8.5, font: tondo, color: GRIGIO });
    f.pagina.drawText(v, { x: MARGINE + 150, y: f.y, size: 9.5, font: grassetto, color: NAVY });
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
  const giorno = (iso: unknown) => {
    if (!iso) return "";
    try {
      return new Date(String(iso).slice(0, 10) + "T00:00:00")
        .toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric" });
    } catch { return String(iso); }
  };

  // ---------------------------------------------------------------- testata
  scrivi(soloCaratteriScrivibili(societa?.ragione_sociale || societa?.nome || "ELITEDERMA S.R.L."), { misura: 13, font: grassetto });
  const sottoTestata = [societa?.indirizzo, societa?.citta, societa?.piva ? "P.IVA " + societa.piva : null]
    .filter(Boolean).join(" · ");
  if (sottoTestata) scrivi(sottoTestata, { misura: 8.5, colore: GRIGIO });
  spazio(10);
  scrivi("MODULO DI ISCRIZIONE AL CORSO — COPIA FIRMATA", { misura: 12, font: grassetto });
  scrivi("Ricevuto il " + quando(iscritto.modulo_ricevuto_il) + (iscritto.modulo_ricevuto_da === "online" ? " — compilato e firmato online dall'allievo/a" : ""), { misura: 8.5, colore: GRIGIO, dopo: 6 });

  // ------------------------------------------------------------------ corso
  titolo("Il corso");
  riga("Corso", corso?.nome);
  riga("Dal", giorno(corso?.inizio || corso?.data_inizio));
  riga("Al", giorno(corso?.fine || corso?.data_fine));
  riga("Citta", corso?.citta);
  riga("Sede", corso?.indirizzo);

  // --------------------------------------------------------------- allieva
  titolo("Dati dell'allievo/a");
  riga("Nome e cognome", [iscritto.nome, iscritto.cognome].filter(Boolean).join(" "));
  // la nascita sta accanto al codice fiscale perche' e' quello che lo
  // genera: su una copia firmata, un codice e la data da cui esce si
  // leggono insieme o non si controllano
  riga("Nata/o il", giorno(iscritto.data_nascita));
  riga("A", [iscritto.comune_nascita, iscritto.stato_nascita].filter(Boolean).join(" — "));
  riga("Codice fiscale", iscritto.codice_fiscale);
  riga("Residenza", [iscritto.indirizzo_residenza, iscritto.civico_residenza].filter(Boolean).join(" "));
  riga("", [iscritto.cap_residenza, iscritto.citta_residenza, iscritto.prov_residenza ? "(" + iscritto.prov_residenza + ")" : null, iscritto.stato_residenza].filter(Boolean).join(" "));
  riga("Email", iscritto.email);
  riga("Telefono", iscritto.telefono);
  riga("Documento", [iscritto.doc_tipo, iscritto.doc_numero].filter(Boolean).join(" n. "));
  if (iscritto.tipo_cliente === "azienda") {
    riga("Fatturazione", iscritto.fattura_ditta);
    riga("P. IVA", iscritto.fattura_piva);
    riga("Cod. destinatario", iscritto.fattura_cod_dest);
    riga("PEC", iscritto.fattura_pec);
  }

  // -------------------------------------------------- il contratto firmato
  const contratto = iscritto.contratto_firmato || {};
  const regolamento = contratto.regolamento || null;
  if (regolamento?.blocchi?.length) {
    titolo(regolamento.titolo || "Regolamento di partecipazione");
    for (const blocco of regolamento.blocchi) {
      spazio(4);
      scrivi(blocco.titolo || "", { misura: 9.5, font: grassetto });
      for (const punto of blocco.punti || []) scrivi(punto, { misura: 8.8, colore: GRIGIO });
    }
  } else {
    titolo("Regolamento di partecipazione");
    scrivi("Il testo del regolamento non e' stato registrato al momento della firma. Vale la versione in vigore alla data indicata in testa a questo documento.", { misura: 8.8, colore: GRIGIO });
  }

  // ---------------------------------------------------------- dichiarazioni
  //
  // QUELLO CHE SI STAMPA E' LA FRASE CHE HA ACCETTATO LEI, non un mio
  // riassunto. "Ha letto e accettato il regolamento" e' comodo da
  // leggere ma non e' quello che c'era scritto sopra la casella: davanti
  // a una contestazione conta la frase per intero, con la sua data e la
  // sua ora. Il riassunto resta solo per le iscrizioni vecchie, dove il
  // testo di quel giorno non era stato registrato.
  //
  // LA SPUNTA LA DECIDE LA MARCA TEMPORALE. Per i tre consensi
  // obbligatori non esiste una colonna vero/falso: la prova che sono
  // stati dati e' l'istante in cui sono stati dati. La prima versione di
  // questa funzione li dava per accettati scrivendo `true` a mano — cioe'
  // il foglio li avrebbe dichiarati sottoscritti anche se non lo erano,
  // che e' esattamente il contrario di quello per cui esiste.
  titolo("Dichiarazioni sottoscritte");
  const caselleFirmate: Record<string, Record<string, any>> = {};
  for (const casella of (contratto.consensi || []) as Record<string, any>[]) {
    if (casella?.chiave) caselleFirmate[casella.chiave] = casella;
  }
  // I RIASSUNTI SONO UN RIPIEGO, NON L'ATTO.
  //
  // Quando il contratto congelato ha la casella (`caselleFirmate`, qui
  // sotto) il PDF stampa la frase PER INTERO, quella che la persona ha
  // letto quel giorno. Questi riassunti di una riga compaiono solo
  // quando quella traccia non c'e': firme vecchie, o un contratto
  // salvato senza i consensi.
  //
  // Vanno comunque tenuti allineati alle parole del modulo: una copia
  // che riassume con parole diverse da quelle sottoscritte fa dubitare
  // di se stessa, e il dubbio nasce proprio quando la copia serve.
  const dichiarazioni: [string, string, unknown, unknown][] = [
    ["regolamento", "Ha letto e accettato il regolamento", iscritto.consenso_regolamento_il, iscritto.consenso_regolamento_il],
    ["clausole", "Approva specificamente le clausole indicate", iscritto.consenso_clausole_il, iscritto.consenso_clausole_il],
    ["privacy", "Ha letto l'informativa sul trattamento dei dati", iscritto.consenso_privacy_il, iscritto.consenso_privacy_il],
    ["avvio_immediato", "Chiede l'avvio immediato e rinuncia al recesso", iscritto.rinuncia_recesso, iscritto.rinuncia_recesso_il],
    ["promozionali", "Acconsente alle comunicazioni e agli aggiornamenti", iscritto.consenso_promozionali, iscritto.consenso_promozionali_il],
    ["immagini", "Acconsente all'uso di foto e video", iscritto.consenso_immagini, iscritto.consenso_immagini_il],
  ];
  for (const [chiave, riassunto, data, ora] of dichiarazioni) {
    spazio(12);
    const yRiga = f.y;
    f.pagina.drawText(data ? "[X]" : "[ ]", { x: MARGINE, y: yRiga, size: 9.5, font: grassetto, color: NAVY });
    if (ora) f.pagina.drawText(quando(ora), { x: A4.larghezza - MARGINE - 95, y: yRiga, size: 8, font: tondo, color: GRIGIO });
    const casella = caselleFirmate[chiave];
    if (casella?.testo) {
      // la frase per intero, a capo da sola, lasciando libera la colonna
      // di destra dove sta l'ora
      f.y += 12;
      scrivi(casella.testo, { misura: 8.2, colore: NAVY, rientro: 22, larghezza: larghezzaUtile - 22 - 100, dopo: 2 });
      // L'ELENCO DELLE CLAUSOLE APPROVATE SPECIFICAMENTE.
      //
      // Senza questo, la dichiarazione degli artt. 1341-1342 c.c. finisce
      // con "approvo specificamente le seguenti clausole:" e poi niente:
      // un'approvazione specifica di nulla.
      for (const voce of (casella.clausole || []) as string[]) {
        scrivi("- " + voce, { misura: 7.8, colore: GRIGIO, rientro: 34, larghezza: larghezzaUtile - 34, interlinea: 1.35 });
      }
      if (casella.clausole?.length) spazio(3);
    } else {
      f.pagina.drawText(soloCaratteriScrivibili(riassunto), { x: MARGINE + 22, y: yRiga, size: 9, font: tondo, color: NAVY });
    }
  }

  // ------------------------------------------------------------------ firma
  if (firma) {
    titolo("Firma dell'allievo/a");
    try {
      const immagine = cheRobaE(firma) === "jpeg" ? await pdf.embedJpg(firma) : await pdf.embedPng(firma);
      const larghezza = 190;
      const altezza = (immagine.height / immagine.width) * larghezza;
      spazio(altezza + 6);
      f.pagina.drawImage(immagine, { x: MARGINE, y: f.y, width: larghezza, height: altezza });
    } catch {
      scrivi("(firma non leggibile)", { misura: 8.5, colore: GRIGIO });
      scartate.push("firma");
    }
    spazio(6);
    scrivi("Firmato il " + quando(iscritto.modulo_ricevuto_il), { misura: 8.5, colore: GRIGIO });
  }

  // IL TIMBRO DELLA SOCIETA', DALL'ALTRA PARTE DEL FOGLIO.
  //
  // Finche' non c'era, la copia che l'allieva riceve portava una firma
  // sola: la sua. Un contratto sottoscritto da una parte e basta —
  // valido, ma da guardare monco: chi lo riapre fra un anno non ci trova
  // scritto da nessuna parte che dall'altra parte qualcuno l'ha
  // accettato, e in che giorno.
  //
  // Si innesta come PAGINA e non come immagine: il file e' un PDF, e
  // cosi' se ne conserva il disegno vettoriale invece di rasterizzarlo.
  // Un timbro sgranato su un documento che qualcuno conserva per anni e'
  // la differenza fra una copia e una fotocopia di fotocopia.
  //
  // SI RITAGLIA SULLA FINESTRA VISIBILE, E NON E' UN DETTAGLIO.
  //
  // Il file del timbro e' una pagina A4 intera (595x842) con sopra una
  // finestra di ritaglio di 162x107: aprendolo si vede solo il timbro,
  // ma sotto c'e' tutto il foglio da cui e' stato ricavato — nel nostro
  // caso un preventivo, con gli importi. `embedPdf` prende la pagina
  // intera e ignora il ritaglio: al primo provino, in fondo al contratto
  // e' comparso "Totale Formazione € 2.750,00" rimpicciolito.
  //
  // `embedPage` con il riquadro esplicito prende solo quella finestra.
  // Il riquadro si legge dal file e non si scrive qui: se un domani si
  // carica un timbro ritagliato diversamente, funziona lo stesso.
  //
  // Se manca o non si apre, il documento esce lo stesso: meglio una
  // copia senza timbro che nessuna copia. Lo scarto resta scritto.
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
      spazio(18);
      scrivi("Per " + (societa?.nome || "Elitederma Srl") + " — ricevuto e accettato", { misura: 8.5, colore: GRIGIO });
      spazio(altezza + 4);
      f.pagina.drawPage(pagina, { x: MARGINE, y: f.y, width: larghezza, height: altezza });
    } catch (e) {
      scartate.push(`timbro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // -------------------------------------------------------- il documento
  for (const [etichetta, byte] of [["Documento d'identita - fronte", fronte], ["Documento d'identita - retro", retro]] as [string, Uint8Array | null][]) {
    if (!byte) continue;
    try {
      // UN DOCUMENTO GIA' IN PDF SI TRAPIANTA, NON SI FOTOGRAFA.
      //
      // Chi carica da computer allega una scansione in PDF, e di solito
      // ha dentro tutte e due le facce. Le sue pagine entrano qui come
      // sono, con la loro definizione: trasformarle in immagine vorrebbe
      // dire peggiorare una scansione gia' buona. L'intestazione va su
      // una riga sopra, perche' sulla pagina trapiantata non si scrive.
      if (cheRobaE(byte) === "pdf") {
        const origine = await PDFDocument.load(byte, { ignoreEncryption: true });
        const copie = await pdf.copyPages(origine, origine.getPageIndices());
        if (!copie.length) throw new Error("PDF senza pagine");
        const intestazione = pdf.addPage([A4.larghezza, A4.altezza]);
        intestazione.drawText(etichetta, { x: MARGINE, y: A4.altezza - MARGINE, size: 10, font: grassetto, color: NAVY });
        intestazione.drawText(`Allegato dall'allievo/a in formato PDF - ${copie.length} ${copie.length === 1 ? "pagina" : "pagine"}, riportate qui di seguito.`,
          { x: MARGINE, y: A4.altezza - MARGINE - 18, size: 8.5, font: tondo, color: GRIGIO });
        for (const c of copie) pdf.addPage(c);
        continue;
      }

      const { byte: leggero, jpeg } = await comprimiPerIlPdf(byte);
      const tipo = jpeg ? "jpeg" : cheRobaE(leggero);
      if (tipo !== "jpeg" && tipo !== "png") throw new Error("formato non riconosciuto");
      const immagine = tipo === "jpeg" ? await pdf.embedJpg(leggero) : await pdf.embedPng(leggero);
      const pagina = pdf.addPage([A4.larghezza, A4.altezza]);
      pagina.drawText(etichetta, { x: MARGINE, y: A4.altezza - MARGINE, size: 10, font: grassetto, color: NAVY });
      const spazioLargo = larghezzaUtile;
      const spazioAlto = A4.altezza - MARGINE * 2 - 30;
      const scala = Math.min(spazioLargo / immagine.width, spazioAlto / immagine.height);
      pagina.drawImage(immagine, {
        x: MARGINE, y: A4.altezza - MARGINE - 24 - immagine.height * scala,
        width: immagine.width * scala, height: immagine.height * scala,
      });
    } catch (e) {
      // una foto che non si apre non deve impedire il documento, ma deve
      // risultare: la pagina non e' stata nemmeno aggiunta, quindi il PDF
      // non ha fogli bianchi
      scartate.push(`${etichetta}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { byte: await pdf.save(), pagine: pdf.getPageCount(), scartate };
}
