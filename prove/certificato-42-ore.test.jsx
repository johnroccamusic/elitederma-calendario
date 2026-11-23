// IL CERTIFICATO 42 ORE (23/11/2026).
//
// Tre cose da difendere:
//
// 1. IL PDF E' DEFINITIVO. Il modello ha nove note rosse appoggiate sopra
//    la pagina e un modulo vuoto: se ne restasse anche una, il certificato
//    uscirebbe con i bordi rossi e con una casella che chiunque riscrive.
//    Il modello vero non sta nel repo (e' un foglio firmato, e il repo e'
//    pubblico): qui se ne costruisce uno finto con le stesse note.
// 2. SI GENERA SOLO QUANDO C'E' TUTTO, e la pagina dice cosa manca.
// 3. LA CARTELLA. «Loghi e Certificati» apre «Assegna loghi» (la procedura
//    di prima, intatta) e «Crea certificato» → «Certificato 42 ore».
import { describe, it, expect } from "vitest";
import React from "react";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi, scrivi } from "./aiuto.js";
import {
  RIQUADRI_42_ORE, mancanti42, testiDelCertificato, generaPdfCertificato42, nomeFileCertificato, datiVuoti42, riquadriDelModello,
} from "../src/certificati/certificato-42-ore.js";
import { datiDaIscritto } from "../src/certificati/dati.js";
import LoghiECertificati from "../src/certificati/LoghiECertificati.jsx";
import { CAMPI_PDF_NEEDLING, generaPdfCertificatoNeedling, datiVuotiNeedling, mancantiNeedling, testiNeedling, riquadriNeedlingDelModello } from "../src/certificati/certificato-needling.js";
import { nomeFileCertificato as nomeFileDiTipo } from "../src/certificati/dati.js";

async function modelloFinto() {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const note = Object.values(RIQUADRI_42_ORE).map((r) => doc.context.register(doc.context.obj({
    Type: "Annot", Subtype: "FreeText", Rect: r, Contents: PDFString.of(""), DA: PDFString.of("/Helv 10 Tf 0 g"),
  })));
  pagina.node.set(PDFName.of("Annots"), doc.context.obj(note));
  doc.catalog.set(PDFName.of("AcroForm"), doc.context.obj({ Fields: [] }));
  return await doc.save();
}

const COMPLETI = {
  ...datiVuoti42(new Date("2026-11-23T10:00:00Z")),
  nome: "Maria", cognome: "Rossi", luogo_nascita: "Napoli", data_nascita: "1990-04-02",
  indirizzo: "Via Roma 1", comune: "Roma", provincia: "rm", corso_dal: "2026-11-01", corso_al: "2026-11-08",
};

describe("il certificato 42 ore", () => {
  it("toglie le note e il modulo, e porta il nome nel titolo", async () => {
    const modello = await modelloFinto();
    const prima = await PDFDocument.load(modello);
    expect(riquadriDelModello(prima).nome).toEqual(RIQUADRI_42_ORE.nome);
    const bytes = await generaPdfCertificato42(modello, COMPLETI);
    const dopo = await PDFDocument.load(bytes);
    expect(dopo.getPageCount()).toBe(1);
    const annots = dopo.getPage(0).node.Annots();
    expect(annots ? annots.size() : 0).toBe(0);
    expect(dopo.catalog.get(PDFName.of("AcroForm"))).toBeUndefined();
    expect(dopo.getTitle()).toBe("Certificato di abilitazione - Maria Rossi");
  });

  it("compone i testi come sul foglio", () => {
    const t = testiDelCertificato(COMPLETI);
    expect(t.periodo).toBe("01/11/2026 al 08/11/2026");
    expect(t.luogoData).toBe("Roma, 23/11/2026");
    expect(t.dataNascita).toBe("02/04/1990");
    expect(t.provincia).toBe("RM");
    expect(nomeFileCertificato(COMPLETI)).toBe("Certificato-42-ore-Rossi-Maria.pdf");
  });

  it("dice cosa manca, e un corso che finisce prima di cominciare", () => {
    expect(mancanti42(COMPLETI)).toEqual([]);
    expect(mancanti42({ ...COMPLETI, cognome: " " })).toEqual(["Cognome"]);
    expect(mancanti42({ ...COMPLETI, corso_al: "2026-10-01" })).toContain("il corso finisce prima di cominciare");
  });

  it("dall'iscrizione prende solo quello che sa", () => {
    const r = { id: "i1", nome: "MARIA", cognome: "D'ANGELO", data_nascita: "1990-04-02", comune_nascita: "NAPOLI", stato_nascita: "", indirizzo_residenza: "via roma", civico_residenza: "3", citta_residenza: "", prov_residenza: "na", classe: { data_inizio: "2026-11-01", data_fine: "2026-11-08" } };
    const d = datiDaIscritto(r, { ...datiVuoti42(), comune: "Pozzuoli" });
    expect(d.nome).toBe("Maria");
    expect(d.cognome).toBe("D'Angelo");
    expect(d.indirizzo).toBe("Via Roma 3");
    expect(d.comune).toBe("Pozzuoli"); // l'iscrizione non lo sa: resta com'era
    expect(d.provincia).toBe("NA");
    expect(d.corso_dal).toBe("2026-11-01");
    expect(d.iscritto_id).toBe("i1");
  });
});

describe("la cartella Loghi e Certificati", () => {
  it("apre Assegna loghi e Crea certificato → Certificato 42 ore", async () => {
    rispondiCon({
      "_modelli/certificato-42-ore.pdf": new Response(JSON.stringify({ error: "not_found" }), { status: 400, headers: { "Content-Type": "application/json" } }),
      certificati_generati: [{ id: "c1", nome: "Anna", cognome: "Bianchi", corso_dal: "2026-10-01", corso_al: "2026-10-08", luogo_rilascio: "Roma", data_rilascio: "2026-10-09", creato_il: "2026-10-09T10:00:00Z", percorso: "42-ore/x.pdf" }],
    });
    let tornato = 0;
    const p = await monta(<LoghiECertificati onBack={() => {}} renderLoghi={(torna) => <button onClick={() => { tornato += 1; torna(); }}>PROCEDURA LOGHI</button>} />);
    expect(p.testo()).toContain("Assegna loghi");
    expect(p.testo()).toContain("Crea certificato");

    await clicca(p.tasto("Assegna loghi"));
    expect(p.testo()).toContain("PROCEDURA LOGHI");
    await clicca(p.tasto("PROCEDURA LOGHI"));
    expect(tornato).toBe(1);

    await clicca(p.tasto("Crea certificato"));
    await clicca(p.tasto("Certificato 42 ore"));
    await attendi(150);
    expect(p.testo()).toContain("Manca il modello del certificato");
    expect(p.testo()).toContain("Anna Bianchi");
    const genera = p.tasto("Genera Certificato");
    expect(genera.disabled).toBe(true);
    expect(p.testo()).toContain("Manca ancora: Nome, Cognome");

    await scrivi(p.nodo.querySelector('input[aria-label="Nome"]'), "Maria");
    expect(p.testo()).not.toContain("Manca ancora: Nome,");
    await p.smonta();
  });
});

// Il modello needling ha campi di un modulo vero, con un nome ciascuno:
// se ne costruisce uno finto con gli stessi nomi.
async function modelloNeedlingFinto() {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const form = doc.getForm();
  let y = 700;
  for (const nome of Object.values(CAMPI_PDF_NEEDLING)) {
    const campo = form.createTextField(nome);
    campo.addToPage(pagina, { x: 100, y, width: 200, height: 19 });
    y -= 30;
  }
  return await doc.save();
}

describe("il certificato needling", () => {
  const DATI = { ...datiVuotiNeedling(new Date("2026-11-23T10:00:00Z")), nome: "Maria", cognome: "Rossi", luogo_nascita: "Napoli", data_nascita: "1990-04-02", indirizzo: "Via Roma 1", comune: "Roma", provincia: "rm", codice_fiscale: "rssmra90d42f839x", corso_dal: "2026-11-01", corso_al: "2026-11-02" };

  it("legge i campi per nome, poi toglie il modulo e lascia la pagina", async () => {
    const modello = await modelloNeedlingFinto();
    const prima = await PDFDocument.load(modello);
    expect(riquadriNeedlingDelModello(prima).nome.map(Math.round)).toEqual([100, 700, 301, 720]);
    const dopo = await PDFDocument.load(await generaPdfCertificatoNeedling(modello, DATI));
    const annots = dopo.getPage(0).node.Annots();
    expect(annots ? annots.size() : 0).toBe(0);
    expect(dopo.catalog.get(PDFName.of("AcroForm"))).toBeUndefined();
    expect(dopo.getTitle()).toBe("Certificato di abilitazione needling - Maria Rossi");
  });

  it("chiede anche il codice fiscale, e lo scrive maiuscolo", () => {
    expect(mancantiNeedling(DATI)).toEqual([]);
    expect(mancantiNeedling({ ...DATI, codice_fiscale: "" })).toEqual(["Cod. fis."]);
    const t = testiNeedling(DATI);
    expect(t.codiceFiscale).toBe("RSSMRA90D42F839X");
    expect(t.corsoDal).toBe("01/11/2026");
    expect(t.luogoData).toBe("Roma, 23/11/2026");
    expect(nomeFileDiTipo({ ...DATI, tipo: "needling" })).toBe("Certificato-needling-Rossi-Maria.pdf");
    expect(nomeFileDiTipo({ ...DATI, tipo: "pmu_42_ore" })).toBe("Certificato-42-ore-Rossi-Maria.pdf");
  });

  it("dall'iscrizione prende anche il codice fiscale", () => {
    const d = datiDaIscritto({ id: "i2", nome: "ANNA", cognome: "BIANCHI", codice_fiscale: "bncnna80a41h501z" }, datiVuotiNeedling());
    expect(d.codice_fiscale).toBe("BNCNNA80A41H501Z");
    // il 42 ore quella voce non ce l'ha, e non gliela si aggiunge
    expect("codice_fiscale" in datiDaIscritto({ id: "i3", codice_fiscale: "X" }, datiVuoti42())).toBe(false);
  });

  it("in Crea certificato c'e' anche Certificato needling, con le sue voci", async () => {
    rispondiCon({
      "_modelli/certificato-needling.pdf": new Response(JSON.stringify({ error: "not_found" }), { status: 400, headers: { "Content-Type": "application/json" } }),
      certificati_generati: [],
    });
    const p = await monta(<LoghiECertificati onBack={() => {}} renderLoghi={() => null} />);
    await clicca(p.tasto("Crea certificato"));
    expect(p.testo()).toContain("Certificato 42 ore");
    await clicca(p.tasto("Certificato needling"));
    await attendi(150);
    expect(p.testo()).toContain("Manca il modello del certificato");
    expect(p.testo()).toContain("certificato abilitazione PMU 16 ore compilabile");
    expect(p.nodo.querySelector('input[aria-label="Cod. fis."]')).not.toBeNull();
    expect(p.testo()).toContain("Nessun certificato ancora.");
    await p.smonta();
  });
});

// IL CESTINO E IL MODELLO DA SOSTITUIRE (23/11/2026). Il titolare: «metti
// il cestino, con la domanda di sicurezza, ad ogni certificato che generi
// nel caso ci fosse un errore», e la possibilità di sostituire il modello.
describe("cancellare un certificato e sostituire il modello", () => {
  const MARIA = { id: "cg1", tipo: "needling", nome: "Maria", cognome: "Rossi", corso_dal: "2026-11-01", corso_al: "2026-11-02", percorso: "needling/x.pdf", creato_il: "2026-11-23T10:00:00Z" };

  function finto({ cancellate = [{ id: "cg1" }] } = {}) {
    const chiamate = [];
    let elenco = [MARIA];
    globalThis.fetch = globalThis.window.fetch = async (url, op = {}) => {
      const u = String(url); const metodo = (op.method || "GET").toUpperCase();
      chiamate.push({ u, metodo, corpo: op.body });
      const json = (x) => new Response(JSON.stringify(x), { status: 200, headers: { "Content-Type": "application/json" } });
      if (u.includes("_modelli/")) {
        if (metodo === "GET") return new Response(new Uint8Array([37, 80, 68, 70, 45]), { status: 200, headers: { "Content-Type": "application/pdf" } });
        return json([{ name: "x" }]);
      }
      if (u.includes("/storage/v1/object/certificati")) return json([{ name: "needling/x.pdf" }]);
      if (u.includes("certificati_generati")) {
        if (metodo === "DELETE") { elenco = []; return json(cancellate); }
        return json(elenco);
      }
      return json([]);
    };
    return chiamate;
  }

  async function apri() {
    const { default: PaginaCertificato } = await import("../src/certificati/PaginaCertificato.jsx");
    const { CERTIFICATI } = await import("../src/certificati/tipi.js");
    const p = await monta(<PaginaCertificato onBack={() => {}} certificato={CERTIFICATI.needling} />);
    await attendi(150);
    return p;
  }

  it("il cestino chiede col nome davanti, e col «no» non cancella niente", async () => {
    const chiamate = finto();
    const chiesto = [];
    window.confirm = (t) => { chiesto.push(t); return false; };
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-cestino="cg1"]'));
    expect(chiesto[0]).toContain("Sei sicuro di voler cancellare il certificato di Maria Rossi?");
    expect(chiamate.some((c) => c.metodo === "DELETE")).toBe(false);
    await p.smonta();
  });

  it("col «sì» cancella la riga e poi il file, e l'elenco si svuota", async () => {
    const chiamate = finto();
    window.confirm = () => true;
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-cestino="cg1"]'));
    await attendi(100);
    const delRiga = chiamate.findIndex((c) => c.metodo === "DELETE" && c.u.includes("certificati_generati") && c.u.includes("cg1"));
    const delFile = chiamate.findIndex((c) => c.metodo === "DELETE" && c.u.includes("/storage/v1/object/certificati") && !c.u.includes("_modelli"));
    expect(delRiga).toBeGreaterThan(-1);
    expect(delFile).toBeGreaterThan(delRiga);
    expect(p.testo()).toContain("Certificato di Maria Rossi cancellato.");
    expect(p.testo()).toContain("Nessun certificato ancora.");
    await p.smonta();
  });

  it("zero righe cancellate si dice, e il file non si tocca", async () => {
    const chiamate = finto({ cancellate: [] });
    window.confirm = () => true;
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-cestino="cg1"]'));
    await attendi(100);
    expect(p.testo()).toContain("non ha cancellato nessuna riga");
    expect(chiamate.some((c) => c.metodo === "DELETE" && c.u.includes("/storage/"))).toBe(false);
    await p.smonta();
  });

  it("col modello caricato si può sostituire o togliere, e togliere chiede", async () => {
    const chiamate = finto();
    const chiesto = [];
    window.confirm = (t) => { chiesto.push(t); return false; };
    const p = await apri();
    expect(p.testo()).toContain("Modello in uso");
    expect(p.nodo.querySelector("[data-sostituisci-modello]")).not.toBeNull();
    await clicca(p.nodo.querySelector('[aria-label="Togli il modello"]'));
    expect(chiesto[0]).toContain("il modello del certificato needling");
    expect(chiamate.some((c) => c.metodo === "DELETE" && c.u.includes("_modelli"))).toBe(false);
    window.confirm = () => true;
    await clicca(p.nodo.querySelector('[aria-label="Togli il modello"]'));
    await attendi(100);
    expect(chiamate.some((c) => c.metodo === "DELETE" && c.u.includes("/storage/"))).toBe(true);
    expect(p.testo()).toContain("Manca il modello del certificato");
    await p.smonta();
  });
});
