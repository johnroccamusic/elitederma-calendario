// LA QUOTA COORDINATORE: una percentuale sul pattuito di ogni iscrizione,
// intestata a una persona, dai corsi che iniziano da una data in poi.
import { describe, it, expect } from "vitest";
import { quotaCoordinatorePerMese } from "../src/App.jsx";

const CD = [
  { id: "a", data_inizio: "2026-09-20" },
  { id: "b", data_inizio: "2026-10-04" },
  { id: "c", data_inizio: "2026-10-25" },
];
const ISC = [
  { corso_data_id: "a", totale_pattuito: 1000 },
  { corso_data_id: "b", totale_pattuito: 1490 },
  { corso_data_id: "b", totale_pattuito: 1290 },
  { corso_data_id: "c", totale_pattuito: 1190 },
];

describe("quota coordinatore", () => {
  it("conta solo i corsi dalla data in poi, per mese, allo 0,5% del pattuito", () => {
    const mesi = quotaCoordinatorePerMese(ISC, CD, { personaNome: "ELENA", percentuale: 0.5, dal: "2026-10-01" });
    expect(mesi).toEqual([{ chiave: "2026-10", iscritti: 3, pattuito: 3970, quota: 19.85 }]);
  });
  it("senza persona o con lo zero non c'e' niente", () => {
    expect(quotaCoordinatorePerMese(ISC, CD, { personaNome: "", percentuale: 0.5, dal: "" })).toEqual([]);
    expect(quotaCoordinatorePerMese(ISC, CD, { personaNome: "ELENA", percentuale: 0, dal: "" })).toEqual([]);
  });
  it("senza data vale per tutti i corsi", () => {
    const mesi = quotaCoordinatorePerMese(ISC, CD, { personaNome: "ELENA", percentuale: 1, dal: "" });
    expect(mesi.map((m) => [m.chiave, m.quota])).toEqual([["2026-09", 10], ["2026-10", 39.7]]);
  });
});
