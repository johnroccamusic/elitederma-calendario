// LA BOLLA DI ACCOMPAGNAMENTO di un evento: chiede gli indirizzi, li
// salva sull'evento, genera il PDF dalle righe dei materiali; alla
// ristampa li ritrova.
import { describe, it, expect } from "vitest";
import React from "react";
import BollaEvento from "../src/eventi/BollaEvento.jsx";
import { creaBollaPdf, bollaIniziale } from "../src/eventi/bolla.js";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const EVENTO = { id: "ev1", nome: "Fiera di Tirana", data_inizio: "2026-11-10", data_fine: "2026-11-12", nome_luogo: "Palacongressi", indirizzo: "Bulevardi Dëshmorët", citta: "Tirana", bolla: null };
const SOCIETA = { nome: "ELITEDERMA Srl", indirizzo: "Via Terni 90/a, 00182 ROMA" };
const RIGHE = [{ id: "r1", nome: "Tokyo", quantita: 6, unita: "pz" }, { id: "r2", nome: "Ago 36 punte", quantita: 0 }, { id: "r3", nome: "Pelle sintetica 3 pz", quantita: 10 }];

describe("Bolla di accompagnamento", () => {
  it("gli indirizzi partono dalla sede e dal luogo dell'evento, e la ristampa trova quelli salvati", () => {
    const b = bollaIniziale(EVENTO, SOCIETA);
    expect(b.partenza).toContain("ELITEDERMA Srl");
    expect(b.destinazione).toContain("Palacongressi");
    const salvata = bollaIniziale({ ...EVENTO, bolla: { numero: "DDT 2026-11-09/ABC", partenza: "Magazzino Roma", destinazione: "Stand 12" } }, SOCIETA);
    expect(salvata.numero).toBe("DDT 2026-11-09/ABC");
    expect(salvata.partenza).toBe("Magazzino Roma");
  });

  it("il PDF esiste davvero e porta solo le righe con quantità", async () => {
    const bytes = await creaBollaPdf({ evento: EVENTO, righe: RIGHE, bolla: { ...bollaIniziale(EVENTO, SOCIETA), numero: "DDT 2026-11-09/ABC", colli: "4" }, societa: SOCIETA });
    expect(bytes.length).toBeGreaterThan(1500);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("il pannello chiede gli indirizzi, salva sull'evento e scarica il PDF", async () => {
    const scritture = []; let scaricato = null; let passatoAlPdf = null;
    rispondiCon({
      "rest/v1/intestazione_societa": SOCIETA,
      "rest/v1/eventi_materiali": RIGHE,
      "rest/v1/eventi": (corpo) => { if (corpo) scritture.push(corpo); return [{ id: "ev1" }]; },
    });
    const p = await monta(<BollaEvento evento={EVENTO} chi="Titolare" generaPdf={async (x) => { passatoAlPdf = x; return new Uint8Array([37, 80, 68, 70]); }} scarica={(b, nome) => { scaricato = nome; }} />);
    await clicca(p.tasto("Bolla di accompagnamento")); await attendi(100);
    expect(p.nodo.querySelector('[data-campo="bolla-partenza"]').value).toContain("ELITEDERMA");
    await scrivi(p.nodo.querySelector('[data-campo="bolla-destinazione"]'), "Fiera Tirana, Stand 12\nTirana");
    await clicca(p.tasto("Genera la bolla")); await attendi(200);
    expect(scritture[0].bolla.destinazione).toBe("Fiera Tirana, Stand 12\nTirana");
    expect(scritture[0].bolla.numero).toMatch(/^DDT \d{4}-\d{2}-\d{2}\//);
    expect(passatoAlPdf.righe.length).toBe(3);
    expect(scaricato).toMatch(/\.pdf$/);
    expect(p.testo()).toContain("generata con 2 righe");
    await p.smonta();
  });
});
