// UNA DATA O UN ISTANTE, NELLA STESSA CASELLA.
//
// `fmtData` era `d.split("-")` e basta: passandogli un istante il terzo
// pezzo diventava "14T15:21:07.653+00:00" e in Fatture da emettere si
// leggeva «14T15:21:07.653+00:00/10/2026». Quella pagina legge
// `pagato_il`, che e' un istante e non una data.
import { describe, it, expect } from "vitest";
import { fmtData } from "../src/App.jsx";

describe("fmtData", () => {
  it("una data resta quella di prima", () => {
    expect(fmtData("2026-10-14")).toBe("14/10/2026");
  });

  it("un istante non si spezza più a metà", () => {
    expect(fmtData("2026-10-14T15:21:07.653+00:00")).toBe("14/10/2026");
  });

  it("e un istante si legge col fuso di Roma, non in UTC", () => {
    // le 23:30 del 14 a Roma sono le 21:30 UTC: il giorno e' il 14
    expect(fmtData("2026-10-14T21:30:00Z")).toBe("14/10/2026");
    // ma le 23:30 UTC sono gia' l'1:30 del 15 a Roma
    expect(fmtData("2026-10-14T23:30:00Z")).toBe("15/10/2026");
  });

  it("niente dentro, niente fuori", () => {
    expect(fmtData("")).toBe("");
    expect(fmtData(null)).toBe("");
  });
});
