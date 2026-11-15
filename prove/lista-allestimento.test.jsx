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
const PRODOTTI = [{ id: "p1", nome: "Pelle sintetica Premium" }, { id: "p2", nome: "Ruota colori" }];
const DISTINTA = [
  { id: "r1", kit_id: "k1", corso_id: "c1", prodotto_id: "p1", quantita: 2, tipo: "kit" },
  { id: "r2", kit_id: "k1", corso_id: "c1", prodotto_id: "p2", quantita: 1, tipo: "kit" },
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
      .toEqual(["Kit didattici", "Dermografi", "Abbigliamento"]);
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
    expect(sezioni.map((s) => s.getAttribute("data-sezione-allestimento"))).toEqual(["Kit didattici", "Abbigliamento"]);
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
