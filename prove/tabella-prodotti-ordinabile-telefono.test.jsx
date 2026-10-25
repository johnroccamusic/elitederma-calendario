// STATISTICHE VENDITE PRODOTTI, sul telefono: l'elenco si riordina
// premendo le intestazioni, come la tabella da computer.
import { describe, it, expect } from "vitest";
import React from "react";
import { TabellaProdottiVenditeProdotti } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

const RIGHE = [
  { nome: "Tokyo", pezzi: 12, ricavo: 377.25 },
  { nome: "Ago 1RLMT", pezzi: 14, ricavo: 264.94 },
  { nome: "Medical soap", pezzi: 11, ricavo: 62.6 },
];
const nomi = (p) => [...p.nodo.querySelectorAll('[data-campo="riga-prodotto"] span:first-child')].map((n) => n.textContent);

describe("Elenco prodotti sul telefono", () => {
  it("ha le intestazioni e riordina per prodotto, pezzi e ricavo nei due sensi", async () => {
    const p = await monta(<TabellaProdottiVenditeProdotti righe={RIGHE} isMobile messaggioVuoto="niente" />);
    expect(nomi(p)).toEqual(["Tokyo", "Ago 1RLMT", "Medical soap"]);
    await clicca(p.nodo.querySelector('[data-campo="ordina-prodotto"]'));
    expect(nomi(p)).toEqual(["Ago 1RLMT", "Medical soap", "Tokyo"]);
    await clicca(p.nodo.querySelector('[data-campo="ordina-prodotto"]'));
    expect(nomi(p)).toEqual(["Tokyo", "Medical soap", "Ago 1RLMT"]);
    await clicca(p.nodo.querySelector('[data-campo="ordina-pezzi"]'));
    expect(nomi(p)).toEqual(["Medical soap", "Tokyo", "Ago 1RLMT"]);
    await clicca(p.nodo.querySelector('[data-campo="ordina-ricavo"]'));
    await clicca(p.nodo.querySelector('[data-campo="ordina-ricavo"]'));
    expect(nomi(p)).toEqual(["Tokyo", "Ago 1RLMT", "Medical soap"]);
    expect(p.nodo.querySelector('[data-campo="ordina-ricavo"]').textContent).toContain("▼");
    await p.smonta();
  });
});
