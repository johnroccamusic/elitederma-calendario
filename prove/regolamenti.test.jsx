// REGOLAMENTI: la pagina delle decisioni e l'assistente flottante.
import { describe, it, expect } from "vitest";
import React from "react";
import PaginaRegolamenti from "../src/regole/PaginaRegolamenti.jsx";
import AssistenteRegole from "../src/regole/AssistenteRegole.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const REGOLA = { id: "r1", titolo: "Sconti d'aula", argomento: "Sconti", testo: "In aula lo sconto è **8,5%** con carta e 12% in contanti.", visibile_a: ["tutti"], decisa_il: "2026-09-12", attivo: true, ordine: 0 };

describe("Regolamenti", () => {
  it("vuota dice che non c'è ancora niente, e chi scrive vede il tasto", async () => {
    rispondiCon({ "rest/v1/regolamenti": [] });
    const p = await monta(<PaginaRegolamenti puoScrivere chi="Admin" />);
    expect(p.nodo.querySelector('[data-campo="vuoto"]').textContent).toContain("Aggiungi regola");
    await clicca(p.tasto("Aggiungi regola"));
    expect(p.nodo.querySelector('[data-campo="form-regola"]')).toBeTruthy();
    await p.smonta();
  });
  it("chi legge vede la regola, la apre, e non ha tasti per scrivere", async () => {
    rispondiCon({ "rest/v1/regolamenti": [REGOLA] });
    const p = await monta(<PaginaRegolamenti puoScrivere={false} />);
    expect(p.testo()).toContain("Sconti d'aula");
    expect(p.tasto("Aggiungi regola")).toBeFalsy();
    await clicca(p.tasto("Sconti d'aula"));
    expect(p.nodo.querySelector('[data-campo="regola"] b').textContent).toBe("8,5%");
    expect(p.tasto("Modifica")).toBeFalsy();
    await p.smonta();
  });
  it("salvare una regola nuova manda la insert con i destinatari scelti", async () => {
    const scritture = [];
    rispondiCon({ "rest/v1/regolamenti": (corpo, url) => { if (corpo) scritture.push(corpo); return corpo ? [{ id: "nuova" }] : []; } });
    const p = await monta(<PaginaRegolamenti puoScrivere chi="Admin" />);
    await clicca(p.tasto("Aggiungi regola"));
    await scrivi(p.nodo.querySelector('[data-campo="titolo"]'), "Quota venditore");
    await scrivi(p.nodo.querySelector('[data-campo="testo"]'), "Il 7% del pattuito, minimo 50 euro.");
    await clicca(p.nodo.querySelector('[data-campo="vale-venditori"]'));
    await clicca(p.tasto("Salva la regola")); await attendi(80);
    expect(scritture[0].titolo).toBe("Quota venditore");
    expect(scritture[0].visibile_a).toEqual(["venditori"]);
    expect(scritture[0].creato_da).toBe("Admin");
    await p.smonta();
  });
});

describe("Assistente regolamenti", () => {
  it("si apre dall'icona, manda ruolo e domanda, mostra la risposta e le regole citate", async () => {
    const chiamate = [];
    rispondiCon({ "functions/v1/assistente-regole": (corpo) => { chiamate.push(corpo); return { ok: true, risposta: "In aula fai **8,5%** con carta.", citati: [{ id: "r1", titolo: "Sconti d'aula" }], senza_risposta: false }; } });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" />);
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), "quanto sconto in aula?");
    await clicca(p.tasto("Chiedi")); await attendi(80);
    expect(chiamate[0]).toMatchObject({ domanda: "quanto sconto in aula?", ruolo: "venditori", chi: "Olga" });
    const sc = p.nodo.querySelector('[data-campo="scambio"]');
    expect(sc.querySelector("b").textContent).toBe("8,5%");
    expect(sc.textContent).toContain("Da: Sconti d'aula");
    await p.smonta();
  });
});

describe("Dettatura", () => {
  it("il microfono accoda al testo le frasi definitive, e non compare dove il browser non lo ha", async () => {
    const { default: PaginaRegolamentiRic } = await import("../src/regole/PaginaRegolamenti.jsx");
    // senza riconoscitore: niente tasto
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    rispondiCon({ "rest/v1/regolamenti": [] });
    let p = await monta(<PaginaRegolamentiRic puoScrivere chi="Admin" />);
    await clicca(p.tasto("Aggiungi regola"));
    expect(p.nodo.querySelector('[data-campo="dettatura"]')).toBeFalsy();
    await p.smonta();

    // con un riconoscitore finto: la frase finisce nella casella
    let istanza = null;
    window.webkitSpeechRecognition = class { constructor() { istanza = this; } start() {} stop() { this.onend?.(); } };
    p = await monta(<PaginaRegolamentiRic puoScrivere chi="Admin" />);
    await clicca(p.tasto("Aggiungi regola"));
    await scrivi(p.nodo.querySelector('[data-campo="testo"]'), "In aula");
    await clicca(p.nodo.querySelector('[data-campo="dettatura"]'));
    expect(p.testo()).toContain("Sto ascoltando");
    const { act } = await import("react");
    await act(async () => {
      istanza.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "lo sconto è dell'otto e mezzo per cento" }], { isFinal: true })] });
    });
    expect(p.nodo.querySelector('[data-campo="testo"]').value).toBe("In aula lo sconto è dell'otto e mezzo per cento");
    await clicca(p.nodo.querySelector('[data-campo="dettatura"]'));
    expect(p.testo()).not.toContain("Sto ascoltando");
    await p.smonta();
    delete window.webkitSpeechRecognition;
  });
});

describe("Sistema il testo", () => {
  it("manda il testo al correttore e sostituisce solo se si preme «Usa questo testo»", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/regolamenti": [],
      "functions/v1/sistema-testo": (corpo) => { chiamate.push(corpo); return { ok: true, testo: "In aula lo sconto è dell'**8,5%** con carta.", note: "Aggiunta la punteggiatura." }; },
    });
    const p = await monta(<PaginaRegolamenti puoScrivere chi="Admin" />);
    await clicca(p.tasto("Aggiungi regola"));
    await scrivi(p.nodo.querySelector('[data-campo="testo"]'), "in aula lo sconto e dell otto e mezzo per cento con carta");
    await clicca(p.nodo.querySelector('[data-campo="sistema-testo"]')); await attendi(80);
    expect(chiamate[0].testo).toContain("otto e mezzo");
    const prop = p.nodo.querySelector('[data-campo="proposta-testo"]');
    expect(prop.textContent).toContain("Aggiunta la punteggiatura");
    // il testo scritto non e' stato toccato finche' non si sceglie
    expect(p.nodo.querySelector('[data-campo="testo"]').value).toContain("otto e mezzo");
    await clicca(p.tasto("Usa questo testo"));
    expect(p.nodo.querySelector('[data-campo="testo"]').value).toBe("In aula lo sconto è dell'**8,5%** con carta.");
    expect(p.nodo.querySelector('[data-campo="proposta-testo"]')).toBeFalsy();
    await p.smonta();
  });
});
