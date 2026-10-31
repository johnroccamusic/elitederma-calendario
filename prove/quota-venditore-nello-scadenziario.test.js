// QUOTA VENDITORE NELLO SCADENZIARIO PASSIVO (31/10/2026): una voce PER
// PERSONA, col suo nome e la sua cifra a bonifico. Prima era una voce sola
// per classe ("Quota venditore — Katia, Gina") e il titolare non capiva di
// chi fosse ne' quanto spettasse a ciascuno.
import { describe, it, expect } from "vitest";
import "./preparazione.js";
import { calcolaVociScadenziario } from "../src/App.jsx";

const CD = { id: "cd1", corso_id: "c1", data_inizio: "2026-10-01", data_fine: "2026-10-02", master_id: null };
const ISCRITTI = [
  { id: "i1", corso_data_id: "cd1", tutor: "Katia", quota_venditore: 200 },
  { id: "i2", corso_data_id: "cd1", tutor: "Katia", quota_venditore: 100 },
  { id: "i3", corso_data_id: "cd1", tutor: "Gina", quota_venditore: 120 },
  { id: "i4", corso_data_id: "cd1", tutor: "Olga", quota_venditore: 50 },
];
const base = (extra = {}) => ({
  corsiDate: [CD], iscritti: ISCRITTI, corsiDateDocenti: [], master: [], masterCorsi: [], assistente: [], assistenteCorsi: [],
  leva: [], location: [], hotel: [], categorieGruppi: [], spese: [], impegnoTabella: [],
  quoteVenditoriSplit: [
    { corso_data_id: "cd1", venditore: "KATIA", modalita: "B" },
    { corso_data_id: "cd1", venditore: "GINA", modalita: "Mix" },
  ],
  ...extra,
});
const delVenditore = (r) => r.daPagareVirtuali.filter((v) => v.tipo === "venditore");

describe("Scadenzario passivo: la quota venditore ha una voce per persona", () => {
  it("una voce per chi ha una parte a bonifico, col nome e la sua cifra", () => {
    const voci = delVenditore(calcolaVociScadenziario(base()));
    expect(voci.map((v) => [v.nome, v.totale])).toEqual([
      ["Quota venditore — Katia", 300],   // tutto a bonifico
      ["Quota venditore — Gina", 60],     // meta' e meta'
    ]);
    expect(voci.map((v) => v.chiave)).toEqual(["venditore_cd1_KATIA", "venditore_cd1_GINA"]);
    expect(voci.map((v) => v.fornitore)).toEqual(["Katia", "Gina"]);
    // Olga e' in contanti (default): nessuna voce
  });

  it("pagare una persona non fa sparire le altre", () => {
    const spese = [{ origine_scadenziario_chiave: "venditore_cd1_KATIA", classe_id: "cd1" }];
    const voci = delVenditore(calcolaVociScadenziario(base({ spese })));
    expect(voci.map((v) => v.nome)).toEqual(["Quota venditore — Gina"]);
  });

  it("una spesa salvata con la vecchia chiave di classe vale per tutti", () => {
    const spese = [{ origine_scadenziario_chiave: "venditore_cd1", classe_id: "cd1" }];
    expect(delVenditore(calcolaVociScadenziario(base({ spese })))).toEqual([]);
  });

  it("l'importo vivo segue il Riepilogo: persona per persona", () => {
    const { importiRicalcolati } = calcolaVociScadenziario(base());
    expect(importiRicalcolati.get("venditore_cd1_KATIA")).toBe(300);
    expect(importiRicalcolati.get("venditore_cd1_GINA")).toBe(60);
    expect(importiRicalcolati.get("venditore_cd1_OLGA")).toBe(0);
    expect(importiRicalcolati.get("venditore_cd1")).toBe(360);
  });
});
