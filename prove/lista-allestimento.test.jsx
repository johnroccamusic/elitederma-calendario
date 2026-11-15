// LA LISTA DI ALLESTIMENTO, RIDISEGNATA SUL MOCKUP DEL TITOLARE
// (15/11/2026): «rifai il design della pagina rispettando a perfezione
// la mia proposta, con particolare attenzione alla grandezza delle
// icone e dei numeri rispetto al testo e al rispetto della grandezza
// dei titoli».
//
// Quello che si prova qui non è il gusto: è la GERARCHIA. Un numero più
// piccolo del nome che gli sta accanto, o un titolo di sezione più
// piccolo di una riga, è esattamente il difetto che questo lavoro è
// venuto a togliere — e si rimette da solo alla prima modifica
// distratta, se nessuno lo guarda.
import { describe, it, expect } from "vitest";
import React from "react";
import { PannelloPreparazioneKit } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

const CORSO = { id: "c1", nome: "COLORI E CORREZIONI", colore: "#0E6B6B", prevede_dermografi_sicurezza: true };
const SENZA_DERMOGRAFI = { ...CORSO, prevede_dermografi_sicurezza: false };
const LOC = { id: "l1", nome: "MILANO" };
const CORSO_DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-11-14", data_fine: "2099-11-15" };
const KIT = { id: "k1", nome: "Kit Colori", corso_id: "c1", tipo: "kit", ordine: 1 };
const PRODOTTI = [
  { id: "p1", nome: "Pelle sintetica Premium" },
  { id: "p2", nome: "Ruota colori" },
  { id: "p3", nome: "Cuffie monouso TNT - 1pz" },
  { id: "p4", nome: "Aghi 1RL" },
  { id: "p5", nome: "Telini monouso" },
];
const DISTINTA = [
  { id: "r1", kit_id: "k1", corso_id: "c1", prodotto_id: "p1", quantita: 2, tipo: "kit" },
  { id: "r2", kit_id: "k1", corso_id: "c1", prodotto_id: "p2", quantita: 1, tipo: "kit" },
  // gli accessori didattica del corso: non stanno in nessun kit, e sulla
  // scheda sono scritti nell'ordine in cui qualcuno li ha aggiunti
  { id: "r3", kit_id: null, corso_id: "c1", prodotto_id: "p3", quantita: 20, tipo: "accessorio" },
  { id: "r4", kit_id: null, corso_id: "c1", prodotto_id: "p5", quantita: 4, tipo: "accessorio" },
  { id: "r5", kit_id: null, corso_id: "c1", prodotto_id: "p4", quantita: 1, tipo: "accessorio" },
];
// otto allievi, sei taglia M e due taglia L, come nel mockup
const ISCRITTI = Array.from({ length: 8 }, (_, i) => ({
  id: `a${i}`, nome: `ALLIEVA${i}`, cognome: "PROVA", pacchetto_kit: "Kit Colori", kit_id: "k1",
  taglia_divisa: i < 6 ? "M" : "L",
}));

function pannello(extra = {}) {
  return monta(
    <PannelloPreparazioneKit
      corsoData={CORSO_DATA} corso={CORSO} loc={LOC}
      statoEdizione={{ corso_data_id: "cd1", riserva_per_kit: {}, accessori_quantita: {} }}
      kitDefinizioni={[KIT]} corsiKitProdotti={DISTINTA} prodottiShop={PRODOTTI}
      iscrittiEdizione={ISCRITTI} inventarioSede={[]} prodottiApertiMagazzino={[]}
      nomeUtente="Raf" onSalvaCampi={() => {}} onCambiaTagliaIscritto={() => {}}
      {...extra}
    />
  );
}

const misura = (el) => Number(String(el.style.fontSize).replace("px", ""));

describe("la pagina di allestimento segue il mockup", () => {
  it("in cima ci sono i due conti, grandi: allievi iscritti e kit da preparare", async () => {
    const p = await pannello();
    const testo = p.testo();
    expect(testo).toContain("Allievi iscritti");
    expect(testo).toContain("Kit da preparare");
    // otto iscritti, otto kit: nessuna riserva
    expect(testo).toMatch(/Allievi iscritti\s*8/);
    expect(testo).toMatch(/Kit da preparare\s*8/);
    await p.smonta();
  });

  it("le sezioni sono numerate e si chiamano come nel mockup", async () => {
    const p = await pannello();
    const sezioni = [...p.nodo.querySelectorAll("[data-sezione-allestimento]")];
    expect(sezioni.map((s) => s.getAttribute("data-sezione-allestimento")))
      .toEqual(["Kit didattici", "Dermografi", "Abbigliamento", "Accessori per il corso"]);
    expect(sezioni[0].textContent).toContain("01");
    expect(sezioni[1].textContent).toContain("02");
    expect(sezioni[2].textContent).toContain("03");
    // e le colonne delle prime due
    expect(sezioni[0].textContent).toContain("Articolo");
    expect(sezioni[0].textContent).toContain("Totale");
    expect(sezioni[1].textContent).toContain("Modello");
    expect(sezioni[1].textContent).toContain("Allievi");
    await p.smonta();
  });

  it("senza dermografi la numerazione non salta: l'abbigliamento diventa 02", async () => {
    // saltare da 01 a 03 fa cercare una sezione che non esiste
    const p = await pannello({ corso: SENZA_DERMOGRAFI });
    const sezioni = [...p.nodo.querySelectorAll("[data-sezione-allestimento]")];
    expect(sezioni.map((s) => s.getAttribute("data-sezione-allestimento")))
      .toEqual(["Kit didattici", "Abbigliamento", "Accessori per il corso"]);
    expect(sezioni[1].textContent).toContain("02");
    await p.smonta();
  });

  it("ogni riga ha il suo totale, e il totale è iscritti più riserva", async () => {
    const p = await pannello();
    const riga = p.nodo.querySelector('[data-riga-allestimento="Kit Colori"]');
    const celle = [...riga.children];
    // nome · iscritti · contatore della riserva · totale
    expect(celle.length).toBe(4);
    expect(celle[0].textContent).toContain("Kit Colori");
    expect(celle[1].textContent).toBe("8");
    expect(celle[3].textContent).toBe("8");
    await p.smonta();
    // con due di riserva il totale diventa dieci
    const p2 = await pannello({ statoEdizione: { corso_data_id: "cd1", riserva_per_kit: { k1: 2 }, accessori_quantita: {} } });
    const celle2 = [...p2.nodo.querySelector('[data-riga-allestimento="Kit Colori"]').children];
    expect(celle2[1].textContent).toBe("8");
    expect(celle2[3].textContent).toBe("10");
    expect(p2.testo()).toMatch(/Kit da preparare\s*10/);
    await p2.smonta();
  });

  it("i numeri sono più grandi del testo che accompagnano", async () => {
    const p = await pannello();
    const riga = p.nodo.querySelector('[data-riga-allestimento="Kit Colori"]');
    const celle = [...riga.children];
    const nome = celle[0].querySelector("span span span");
    expect(misura(celle[1])).toBeGreaterThanOrEqual(22);
    expect(misura(celle[3])).toBeGreaterThanOrEqual(22);
    expect(misura(celle[1])).toBeGreaterThan(misura(nome));
    await p.smonta();
  });

  it("i titoli hanno il loro gradino: pagina, sezione, riga", async () => {
    const p = await pannello();
    const titoloPagina = p.nodo.querySelector("h2");
    const titoloSezione = p.nodo.querySelector("h3");
    const riga = p.nodo.querySelector('[data-riga-allestimento="Kit Colori"]');
    const nome = riga.children[0].querySelector("span span span");
    expect(titoloPagina.textContent).toBe("Lista di allestimento");
    expect(misura(titoloPagina)).toBeGreaterThan(misura(titoloSezione));
    expect(misura(titoloSezione)).toBeGreaterThan(misura(nome));
    await p.smonta();
  });

  it("l'abbigliamento dice il totale e le taglie, come nel mockup", async () => {
    const p = await pannello();
    const sezione = p.nodo.querySelector('[data-sezione-allestimento="Abbigliamento"]');
    expect(sezione.textContent).toContain("Magliette totali");
    expect(sezione.textContent).toContain("Taglia M: 6");
    expect(sezione.textContent).toContain("Taglia L: 2");
    await p.smonta();
  });

  it("le specifiche degli allievi stanno in una barra chiusa, che si apre", async () => {
    const p = await pannello();
    const barra = p.nodo.querySelector("[data-specifiche]");
    expect(barra.textContent).toContain("Specifiche degli allievi");
    expect(barra.textContent).toContain("8 allievi");
    // chiusa: nessun nome di allieva in vista
    expect(barra.textContent).not.toContain("Allieva0");
    await clicca(barra.querySelector("button"));
    expect(p.nodo.querySelector("[data-specifiche]").textContent).toContain("Allieva0");
    await p.smonta();
  });
});

// LA QUARTA SEZIONE (15/11/2026, secondo mockup): gli accessori
// didattica, le consulenze e i prodotti extra erano tre blocchi di fila
// senza niente che li tenesse insieme, con due tasti tratteggiati
// sparsi in mezzo. Per chi prepara sono la stessa cosa: quello che va
// nella scatola oltre ai kit.
describe("04 Accessori per il corso", () => {
  it("è una sezione sola, numerata dopo l'abbigliamento", async () => {
    const p = await pannello();
    const sezioni = [...p.nodo.querySelectorAll("[data-sezione-allestimento]")];
    expect(sezioni.map((x) => x.getAttribute("data-sezione-allestimento")))
      .toEqual(["Kit didattici", "Dermografi", "Abbigliamento", "Accessori per il corso"]);
    expect(sezioni[3].textContent).toContain("04");
    await p.smonta();
    // senza dermografi scala di uno, come le altre
    const p2 = await pannello({ corso: SENZA_DERMOGRAFI });
    const quarta = [...p2.nodo.querySelectorAll("[data-sezione-allestimento]")].at(-1);
    expect(quarta.getAttribute("data-sezione-allestimento")).toBe("Accessori per il corso");
    expect(quarta.textContent).toContain("03");
    await p2.smonta();
  });

  it("l'accessorio del corso è una riga con la sua foto e il suo contatore", async () => {
    const p = await pannello();
    const riga = p.nodo.querySelector('[data-riga-corredo="Cuffie monouso TNT - 1pz"]');
    expect(riga).toBeTruthy();
    // la quantità della scheda dell'accessorio, già scritta
    expect(riga.querySelector("input").value).toBe("20");
    // e sta dentro la sezione 04, non per conto suo in fondo alla pagina
    const sezione = p.nodo.querySelector('[data-sezione-allestimento="Accessori per il corso"]');
    expect(sezione.contains(riga)).toBe(true);
    await p.smonta();
  });

  it("i due tasti che aggiungono stanno in fondo, affiancati", async () => {
    const p = await pannello();
    const sezione = p.nodo.querySelector('[data-sezione-allestimento="Accessori per il corso"]');
    const consulenze = p.tasto("+ Aggiungi consulenze");
    const extra = p.tasto("+ Aggiungi prodotti extra o da vendita");
    expect(sezione.contains(consulenze)).toBe(true);
    expect(sezione.contains(extra)).toBe(true);
    // stanno nella stessa riga: due celle dello stesso contenitore
    expect(consulenze.parentElement.parentElement).toBe(extra.parentElement.parentElement);
    await p.smonta();
  });

  it("aprendo una ricerca l'altro tasto resta dov'è", async () => {
    const p = await pannello();
    await clicca(p.tasto("+ Aggiungi consulenze"));
    expect([...p.nodo.querySelectorAll("input")].some((i) => i.placeholder === "Cerca consulenza…")).toBe(true);
    // chi cerca una consulenza non ha smesso di poter aggiungere un extra
    expect(p.tasto("+ Aggiungi prodotti extra o da vendita")).toBeTruthy();
    await p.smonta();
  });
});

// IL TASTO «COMPONI KIT» STA IN UN POSTO SOLO (15/11/2026, detto dal
// titolare davanti alla scheda: «togli il tasto "componi kit": quel
// tasto si trova solo nella sezione prepara, dopo che hai messo da
// parte tutti i materiali»). Comporre le buste è il gesto DOPO la
// raccolta, e un tasto che lo offre prima invita a cominciare dalla
// fine.
describe("dove sta «Componi kit»", () => {
  it("nella scheda del corso c'è solo «Prepara»", async () => {
    const p = await pannello();
    expect(p.tasto("Prepara")).toBeTruthy();
    expect(p.tasto("Componi kit")).toBeFalsy();
    await p.smonta();
  });

  it("ci si arriva da dentro «Prepara», e dice a che punto sono i kit", async () => {
    const p = await pannello();
    await clicca(p.tasto("Prepara"));
    const vai = p.nodo.querySelector("[data-vai-composizione]");
    expect(vai).toBeTruthy();
    expect(vai.textContent).toContain("Componi i kit");
    // nessun kit composto ancora: 0 su 1
    expect(vai.textContent).toContain("0/1");
    // la raccolta non è finita, quindi il tasto non è ancora quello acceso
    expect(vai.getAttribute("data-vai-composizione")).toBe("si");
    await p.smonta();
  });

  it("raccolto tutto, il tasto si accende: è il passo dopo", async () => {
    // ogni riga della raccolta spuntata
    const tutte = {};
    ["p1", "p2", "p3", "p4", "p5"].forEach((id) => { tutte[`prodotto::${id}`] = { il: "2026-11-15T10:00:00Z", da: "Raf" }; });
    const p = await pannello({ statoEdizione: { corso_data_id: "cd1", riserva_per_kit: {}, accessori_quantita: {}, checklist: tutte } });
    await clicca(p.tasto("Prepara"));
    expect(p.nodo.querySelector("[data-vai-composizione]").getAttribute("data-vai-composizione")).toBe("pronto");
    await p.smonta();
  });
});

// L'ORDINE ALFABETICO (15/11/2026, chiesto dal titolare: «questi
// accessori vanno in ordine alfabetico»). Arrivavano nell'ordine in cui
// le righe erano state scritte sulla scheda del corso, cioè in nessun
// ordine: con quindici righe fra cui tre tipi di guanti che si
// somigliano, trovare quello che si ha in mano voleva dire leggerle
// tutte.
describe("gli accessori in ordine alfabetico", () => {
  it("l'elenco segue i nomi, non l'ordine in cui sono stati scritti", async () => {
    const p = await pannello();
    const nomi = [...p.nodo.querySelectorAll("[data-riga-corredo]")].map((r) => r.getAttribute("data-riga-corredo"));
    expect(nomi).toEqual(["Aghi 1RL", "Cuffie monouso TNT - 1pz", "Telini monouso"]);
    await p.smonta();
  });
});

// TOGLIERE UNA CONSULENZA CHIEDEVA NIENTE (15/11/2026, trovato di
// fianco al cestino di «Tipologie di kit»). Il guardiano delle
// cancellazioni dell'11/11 riconosce i gesti dal nome della funzione, e
// questa si chiama «imposta la quantità»: un nome che non dice che a
// zero la riga sparisce.
describe("togliere una consulenza", () => {
  const conConsulenza = {
    corso_data_id: "cd1", riserva_per_kit: {}, accessori_quantita: {},
    consulenze_edizione: [{ id: "c-1", prodotto_id: "p1", livello: 5 }],
  };

  it("chiede, e con «no» non toglie niente", async () => {
    const salvataggi = [];
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await pannello({ statoEdizione: conConsulenza, onSalvaCampi: (c) => salvataggi.push(c) });
    const riga = p.nodo.querySelector('[data-riga-corredo="Pelle sintetica Premium"]');
    const cestino = [...riga.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").includes("Togli"));
    expect(cestino.querySelector("svg"), "l'icona del cestino").toBeTruthy();
    await clicca(cestino);
    expect(domande.length).toBe(1);
    expect(domande[0]).toContain("Pelle sintetica Premium");
    expect(salvataggi).toEqual([]);
    window.confirm = () => true;
    await p.smonta();
  });

  it("con «sì» la consulenza se ne va", async () => {
    const salvataggi = [];
    window.confirm = () => true;
    const p = await pannello({ statoEdizione: conConsulenza, onSalvaCampi: (c) => salvataggi.push(c) });
    const riga = p.nodo.querySelector('[data-riga-corredo="Pelle sintetica Premium"]');
    const cestino = [...riga.querySelectorAll("button")].find((b) => (b.getAttribute("title") || "").includes("Togli"));
    await clicca(cestino);
    expect(salvataggi).toEqual([{ consulenze_edizione: [] }]);
    await p.smonta();
  });
});
