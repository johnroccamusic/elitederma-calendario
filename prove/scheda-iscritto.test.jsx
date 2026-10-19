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
  // Il suggerimento "ITALIA" non c'e' piu' e non doveva restare: dal
  // 19/10/2026 lo stato si scegle da una tendina, e un suggerimento
  // dentro una tendina non vuol dire niente. Vedi residenza-a-cascata.
  it("il suggerimento del telefono c'e' ed e' smorzato", async () => {
    const p = await conValori({});
    const conSuggerimento = p.campi().filter((i) => (i.getAttribute("placeholder") || "").trim() !== "");
    const scritte = conSuggerimento.map((i) => i.getAttribute("placeholder"));
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
    const p = await conValori({ indirizzo_residenza: "VIA ROMA 1", codice_fiscale: "RZZMNL90L42I452E" });
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("VIA ROMA 1");
    expect(valori).toContain("RZZMNL90L42I452E");
  });

  // La residenza non e' piu' una casella di testo: il comune arriva da
  // una tendina, e che un valore vecchio si veda lo prova
  // residenza-a-cascata. Qui basta sapere che la tendina c'e'.
  it("il comune non si scrive a mano", async () => {
    const p = await conValori({ citta_residenza: "SORSO" });
    expect(p.tendina("citta_residenza")).not.toBe(null);
    expect(p.campi().map((i) => i.value)).not.toContain("SORSO");
  });
});
