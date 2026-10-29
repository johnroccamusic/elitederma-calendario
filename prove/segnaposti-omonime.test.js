// I SEGNAPOSTI DELLE OMONIME: due Vanesse con il cognome che inizia per
// B non possono avere due cartellini «VANESSA B.» uguali.
import { describe, it, expect } from "vitest";
import { testiSegnaposto } from "../src/App.jsx";

describe("testi dei segnaposti", () => {
  it("chi ha un nome solo sta col nome e basta", () => {
    const t = testiSegnaposto([{ id: 1, nome: "GIULIA", cognome: "ROSSI" }, { id: 2, nome: "MARTA", cognome: "BIANCHI" }]);
    expect(t.get(1)).toBe("GIULIA");
    expect(t.get(2)).toBe("MARTA");
  });

  it("due omonime con iniziali diverse prendono una lettera", () => {
    const t = testiSegnaposto([{ id: 1, nome: "GIULIA", cognome: "ROSSI" }, { id: 2, nome: "GIULIA", cognome: "BIANCHI" }]);
    expect(t.get(1)).toBe("GIULIA R.");
    expect(t.get(2)).toBe("GIULIA B.");
  });

  it("Vanessa Barigelli e Vanessa Biagioni: due lettere, tutte e due", () => {
    const t = testiSegnaposto([
      { id: 1, nome: "VANESSA", cognome: "BARIGELLI" },
      { id: 2, nome: "VANESSA", cognome: "BIAGIONI" },
      { id: 3, nome: "SARA", cognome: "BRUNI" },
    ]);
    expect(t.get(1)).toBe("VANESSA BA.");
    expect(t.get(2)).toBe("VANESSA BI.");
    expect(t.get(3)).toBe("SARA");
  });

  it("tre omonime: tante lettere quante servono a separarle tutte", () => {
    const t = testiSegnaposto([
      { id: 1, nome: "ANNA", cognome: "ROSSI" },
      { id: 2, nome: "ANNA", cognome: "ROSSETTI" },
      { id: 3, nome: "ANNA", cognome: "VERDI" },
    ]);
    expect(t.get(1)).toBe("ANNA ROSSI.");
    expect(t.get(2)).toBe("ANNA ROSSE.");
    expect(t.get(3)).toBe("ANNA VERDI.");
  });
});
