// LA SCHEDA DELL'ISCRITTO, quella che compila il venditore.
//
// Stessi campi che vede l'allieva sul modulo: il disegno e' lo stesso
// componente, quindi quello che si prova qui vale per tutti e due i posti.
import { describe, it, expect } from "vitest";
import React from "react";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { monta } from "./aiuto.js";

const conValori = (valori) => monta(<AreaAnagrafica area={AREA_ALLIEVO} valori={valori} />);
describe("scheda dell'iscritto", () => {
  it("i suggerimenti sono ITALIA e il telefono, e sono smorzati", async () => {
    const p = await conValori({});
    const conSuggerimento = p.campi().filter((i) => (i.getAttribute("placeholder") || "").trim() !== "");
    const scritte = conSuggerimento.map((i) => i.getAttribute("placeholder"));
    expect(scritte).toContain("ITALIA");
    expect(scritte.some((s) => s.startsWith("+39"))).toBe(true);
    for (const c of conSuggerimento) expect(c.className).toContain("suggerimento-chiaro");
  });

  it("col codice fiscale corto dice quanti caratteri mancano", async () => {
    const p = await conValori({ codice_fiscale: "RZZMNL90L42I452" });
    expect(p.testo()).toMatch(/Manca 1 carattere/);
    expect(p.testo()).toMatch(/codice fiscale ne ha 16/);
  });

  it("col codice fiscale giusto non dice niente", async () => {
    const p = await conValori({ codice_fiscale: "RZZMNL90L42I452E" });
    expect(p.testo()).not.toMatch(/Manca|Mancano/);
  });

  it("sulla casella vuota non dice niente", async () => {
    const p = await conValori({});
    expect(p.testo()).not.toMatch(/Manca|Mancano/);
  });

  it("il valore gia' scritto si vede nella sua casella", async () => {
    const p = await conValori({ citta_residenza: "SORSO", codice_fiscale: "RZZMNL90L42I452E" });
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("SORSO");
    expect(valori).toContain("RZZMNL90L42I452E");
  });
});
