// «Progetti Ruh»: il tasto filtra l'elenco sui progetti di Ruh, anche
// quando non cambia nessun altro filtro (dal telefono mostrava tutti).
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaProgetti } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const P = (id, nome, chi) => ({ id, nome, priorita: "normale", stato: "todo", incaricati: [{ id: chi.toLowerCase(), nome: chi, tipo: "utente" }], incaricato_nome: chi, creato_il: "2026-10-01T00:00:00Z" });

describe("Progetti Ruh", () => {
  it("accendendo il tasto restano solo i progetti di Ruh, e spegnendolo tornano tutti", async () => {
    // gli allegati PRIMA: «rest/v1/progetti» e' contenuto anche in
    // «rest/v1/progetti_allegati», e la finta risponde al primo che combacia
    rispondiCon({ "rest/v1/progetti_allegati": [], "rest/v1/progetti": [P("1", "Locandine master", "Ruh"), P("2", "Sito nuovo", "Andrea"), P("3", "Catalogo", "Ruh")] });
    const p = await monta(<PaginaProgetti utentiApp={[{ id: "ruh", nome: "Ruh", permessi: ["progettiincorso"] }]} master={[]} venditori={[]} ricarica={() => {}} onBack={() => {}} />);
    await attendi(150);
    expect(p.testo()).toContain("Sito nuovo");
    await clicca(p.nodo.querySelector('[data-campo="progetti-ruh"]')); await attendi(80);
    expect(p.testo()).toContain("Progetti Ruh");
    expect(p.testo()).toContain("Locandine master");
    expect(p.testo()).toContain("Catalogo");
    expect(p.testo()).not.toContain("Sito nuovo");
    await clicca(p.nodo.querySelector('[data-campo="progetti-ruh"]')); await attendi(80);
    expect(p.testo()).toContain("Sito nuovo");
    await p.smonta();
  });
});
