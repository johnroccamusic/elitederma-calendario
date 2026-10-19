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
import QrConsensi from "../src/consensi/QrConsensi.jsx";
import { collegaConsensoACorso } from "../src/consensi/dati";
import { CONSENSI, consensoDaCodice, contenutoDaVersione, versioniRegistrate } from "../src/content/consensi";

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

  it("la laminazione c'e', col suo codice", () => {
    const m = consensoDaCodice("laminazione");
    expect(m).toBeTruthy();
    expect(m.contenuto.sottotitolo).toContain("Laminazione Ciglia");
  });

  it("ogni modello ha la sua versione registrata", () => {
    // senza, una firma di oggi domani non sa piu' dire cosa diceva il
    // foglio: e' il controllo che serve il giorno in cui si aggiunge il
    // quarto modello e ci si dimentica la riga in VERSIONI
    const registrate = versioniRegistrate();
    for (const m of CONSENSI) {
      expect(registrate, `manca ${m.contenuto.versione}`).toContain(m.contenuto.versione);
    }
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

  it("una laminazione non prende le domande del needling", () => {
    const c = contenutoDaVersione("laminazione-v1", "laminazione");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("patologie_oculari");
    expect(chiavi).not.toContain("acne_attiva");
  });

  it("se la versione non la conosciamo, vale il modello e non un testo a caso", () => {
    // un consenso piu' vecchio dei testi che abbiamo in casa
    const c = contenutoDaVersione("laminazione-v0", "laminazione");
    expect(c.sottotitolo).toContain("Laminazione Ciglia");
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

// UN CORSO STA SU UN CONSENSO SOLO.
//
// Nella scheda di una classe compaiono i consensi del suo corso: due
// consensi sullo stesso corso vorrebbero dire due QR accanto, inquadrati
// in aula a caso. Non e' disordine, e' il documento sbagliato sotto la
// firma giusta.
const CORSI = [
  { id: "c-pmu", nome: "PMU BASE" },
  { id: "c-need", nome: "NEEDLING" },
  { id: "c-libero", nome: "TRICO BASE" },
];
const LEGAMI = [
  { id: "l1", modello_codice: "pmu-micro", corso_id: "c-pmu" },
  { id: "l2", modello_codice: "needling", corso_id: "c-need" },
];

describe("quali corsi la tendina propone", () => {
  it("non propone un corso gia' preso da un altro consenso", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": LEGAMI });
    const p = await monta(<QrConsensi corsi={CORSI} />);

    const sceglibili = [...p.nodo.querySelectorAll("option")]
      .filter((o) => o.value && !o.disabled)
      .map((o) => o.textContent.trim());

    // NEEDLING e' sul consenso needling: nella tendina del PMU non deve
    // essere scegliibile, e viceversa
    expect(sceglibili.filter((t) => t.startsWith("NEEDLING"))).toHaveLength(0);
    expect(sceglibili.filter((t) => t.startsWith("PMU BASE"))).toHaveLength(0);
    // quello libero invece si', una volta per consenso
    expect(sceglibili.filter((t) => t.startsWith("TRICO BASE")).length).toBe(CONSENSI.length);
    await p.smonta();
  });

  it("li mostra spenti, dicendo di chi sono", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": LEGAMI });
    const p = await monta(<QrConsensi corsi={CORSI} />);
    const spenti = [...p.nodo.querySelectorAll("option")].filter((o) => o.disabled);
    const testi = spenti.map((o) => o.textContent.trim());
    // chi cerca NEEDLING nella tendina sbagliata deve capire perche' non
    // puo' prenderlo, non pensare che l'elenco sia rotto
    expect(testi.some((t) => t.includes("NEEDLING") && t.includes("Consenso Needling"))).toBe(true);
    expect(testi.some((t) => t.includes("PMU BASE") && t.includes("Consenso PMU e Micro"))).toBe(true);
    await p.smonta();
  });
});

describe("la serratura sta nella funzione che scrive", () => {
  it("rifiuta un corso gia' su un altro consenso, anche se la tendina non lo proponeva", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [{ modello_codice: "pmu-micro" }] });
    const errore = await collegaConsensoACorso("needling", "c-pmu");
    expect(errore).toBeTruthy();
    expect(errore).toContain("già sul consenso");
  });

  it("lascia passare un corso libero", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [] });
    const errore = await collegaConsensoACorso("needling", "c-libero");
    expect(errore).toBeNull();
  });

  it("rimettere lo stesso corso sullo stesso consenso non e' un errore", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [{ modello_codice: "needling" }] });
    const errore = await collegaConsensoACorso("needling", "c-need");
    expect(errore).toBeNull();
  });
});
