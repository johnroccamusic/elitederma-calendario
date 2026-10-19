// IL CONSENSO NEEDLING, montato come lo vede la modella.
//
// Il secondo modello di consenso e' il primo che puo' sbagliare bersaglio:
// finche' ce n'era uno solo, qualunque codice portava allo stesso testo e
// alle stesse domande. Da adesso no, e quello che si prova qui e' proprio
// che i due non si scambino — un foglio di microneedling che chiede
// l'emofilia, o un PMU che chiede dell'acne in fase attiva, sarebbero
// sbagliati tutti e due e nessuno se ne accorgerebbe guardando lo schermo.
import { describe, it, expect } from "vitest";
import React from "react";
import { rispondiCon } from "./preparazione.js";
import { monta } from "./aiuto.js";
import PaginaConsenso from "../src/consensi/PaginaConsenso.jsx";
import { CONSENSI, consensoDaCodice, contenutoDaVersione } from "../src/content/consensi";

describe("l'elenco dei modelli di consenso", () => {
  it("il needling c'e', e ha un codice suo", () => {
    const m = consensoDaCodice("needling");
    expect(m).toBeTruthy();
    expect(m.contenuto.titolo).toContain("MICRONEEDLING");
  });

  it("nessun codice e' ripetuto: il codice E' il QR", () => {
    const codici = CONSENSI.map((c) => c.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("nessuna versione e' ripetuta fra modelli diversi", () => {
    const versioni = CONSENSI.map((c) => c.contenuto.versione);
    expect(new Set(versioni).size).toBe(versioni.length);
  });

  it("dentro un modello, due domande non hanno la stessa chiave", () => {
    for (const m of CONSENSI) {
      const chiavi = (m.contenuto.anamnesi || []).map((d) => d.chiave);
      expect(new Set(chiavi).size, `doppione in ${m.codice}`).toBe(chiavi.length);
    }
  });
});

describe("risalire al testo con cui una firma e' stata data", () => {
  it("un consenso needling non prende le domande del PMU", () => {
    const c = contenutoDaVersione("needling-v1", "needling");
    expect(c.titolo).toContain("MICRONEEDLING");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("acne_attiva");
    expect(chiavi).not.toContain("emofilia");
  });

  it("e un PMU non prende quelle del needling", () => {
    const c = contenutoDaVersione("v2", "pmu-micro");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("emofilia");
    expect(chiavi).not.toContain("acne_attiva");
  });

  it("i consensi vecchi, senza codice, restano come prima", () => {
    // raccolti quando il needling non esisteva: per loro la versione da
    // sola bastava, ed e' giusto che continui a bastare
    expect(contenutoDaVersione("v1").versione).toBe("v1");
    expect(contenutoDaVersione("v2").versione).toBe("v2");
  });
});

describe("la pagina che apre il QR del needling", () => {
  it("mostra il titolo giusto e le condizioni del cartaceo", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    const t = p.testo();
    expect(t).toContain("MICRONEEDLING");
    expect(t).toContain("Acne in fase attiva");
    expect(t).toContain("Cure oncologiche negli ultimi 5 anni");
    // e NON le domande dell'altro modello
    expect(t).not.toContain("Emofilia");
    await p.smonta();
  });

  it("non si invia finche' il questionario non e' completo", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    expect(p.testo()).toContain("Manca ancora");
    const invia = p.tasto("Invia");
    expect(invia?.disabled).toBe(true);
    await p.smonta();
  });

  it("un codice che non esiste non apre un modulo a caso", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="questo-non-esiste" />);
    expect(p.testo()).not.toContain("MICRONEEDLING");
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
    await p.smonta();
  });
});
