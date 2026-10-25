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
