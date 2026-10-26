// GLI ALLEGATI DI UN PROGETTO e il tasto «Progetti Ruh».
import { describe, it, expect } from "vitest";
import React from "react";
import AllegatiProgetto from "../src/progetti/AllegatiProgetto.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";
import { act } from "react";

describe("Allegati di un progetto", () => {
  it("carica due file in un colpo, li elenca, e li cancella file prima e riga dopo", async () => {
    const chiamate = [];
    let righe = [];
    rispondiCon({
      // il caricamento manda un FormData, che la finta non sa leggere
      // come JSON: si risponde con un oggetto fisso e si conta la riga
      "storage/v1/object/progetti-allegati": { Key: "x" },
      "rest/v1/progetti_allegati": (corpo, url) => {
        if (corpo && !url.includes("?id=")) { const r = { id: "a" + (righe.length + 1), ...corpo }; righe.push(r); chiamate.push("insert"); return r; }
        return righe;
      },
    });
    const p = await monta(<AllegatiProgetto progettoId="p1" chi="Ruh" />);
    expect(p.testo()).toContain("Allega file");
    const input = p.nodo.querySelector('[data-campo="allega"] input');
    const f1 = new File(["a"], "bozza.pdf", { type: "application/pdf" });
    const f2 = new File(["bb"], "foto.jpg", { type: "image/jpeg" });
    await act(async () => {
      Object.defineProperty(input, "files", { value: [f1, f2], configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await attendi(150);
    expect(chiamate.filter((c) => c === "insert").length).toBe(2);
    expect(righe.map((r) => r.nome)).toEqual(["bozza.pdf", "foto.jpg"]);
    expect(righe[0].progetto_id).toBe("p1");
    expect(p.nodo.querySelectorAll('[data-campo="allegato"]').length).toBe(2);
    expect(p.testo()).toContain("bozza.pdf");
    await p.smonta();
  });
});
