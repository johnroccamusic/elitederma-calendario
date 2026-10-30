// LA RACCOLTA DEL MATERIALE (30/10/2026): dal tasto «Prepara» della scheda
// di allestimento si apre a tutta pagina la lista di tutto quello che
// serve all'edizione, prodotto per prodotto con le quantita' gia'
// sommate sui kit, e si spunta col dito: la riga diventa verde e la
// spunta si salva sull'edizione.
import { describe, it, expect } from "vitest";
import React from "react";
import { listaRaccoltaMateriale, RaccoltaMateriale } from "../src/App.jsx";
import { monta, attendi, clicca } from "./aiuto.js";

const KIT_PRO = { id: "k1", nome: "Pacchetto PRO Nuovo", corso_id: "c1", tipo: "kit" };
const KIT_BASE = { id: "k2", nome: "Pacchetto BASE Nuovo", corso_id: "c1", tipo: "kit" };
const PRODOTTI = [
  { id: "p-aghi", nome: "Aghi 1RL (5 pz)", quantita: 100 },
  { id: "p-horus", nome: "Dermografo Horus Elitederma", quantita: 10 },
  { id: "p-pelle", nome: "Pelle sintetica", quantita: 50 },
  { id: "p-guanti", nome: "Guanti nitrile M", quantita: 200 },
];
const DISTINTE = [
  { id: "r1", kit_id: "k1", corso_id: "c1", prodotto_id: "p-aghi", quantita: 2, tipo: "kit" },
  { id: "r2", kit_id: "k1", corso_id: "c1", prodotto_id: "p-pelle", quantita: 1, tipo: "kit" },
  { id: "r3", kit_id: "k2", corso_id: "c1", prodotto_id: "p-aghi", quantita: 1, tipo: "kit" },
  // accessorio didattica del corso, con la sua quantita' di scheda
  { id: "r4", kit_id: null, corso_id: "c1", prodotto_id: "p-guanti", quantita: 3, tipo: "accessorio" },
];
const ISCRITTI = [
  { id: "a1", pacchetto_kit: "Pacchetto PRO Nuovo", kit_id: "k1", dermografo_scelta: "horus", dermografo: "horus" },
  { id: "a2", pacchetto_kit: "Pacchetto PRO Nuovo", kit_id: "k1" },
  { id: "a3", pacchetto_kit: "Pacchetto BASE Nuovo", kit_id: "k2", dermografo_scelta: "horus", dermografo: "horus", dermografo_consegna: "casa" },
];

describe("listaRaccoltaMateriale", () => {
  it("somma i prodotti su kit, riserva, accessori e dermografi, una riga per prodotto", () => {
    const righe = listaRaccoltaMateriale({
      iscrittiEdizione: ISCRITTI, kitDefinizioni: [KIT_PRO, KIT_BASE], corsiKitProdotti: DISTINTE, prodottiShop: PRODOTTI, corsoId: "c1",
      statoEdizione: { riserva_per_kit: { k1: 1 }, dermografi_riserva: { horus: 2 } },
      dataInizio: "2099-01-01",
    });
    const per = Object.fromEntries(righe.map((r) => [r.nome, r]));
    // 3 PRO (2 iscritti + 1 riserva) × 2 aghi + 1 BASE × 1 ago = 7, in una riga sola
    expect(per["Aghi 1RL (5 pz)"].quantita).toBe(7);
    expect(per["Aghi 1RL (5 pz)"].da).toEqual(["3 × Pacchetto PRO Nuovo", "1 × Pacchetto BASE Nuovo"]);
    expect(per["Pelle sintetica"].quantita).toBe(3);
    // il dermografo: uno comprato a parte da chi lo ritira al corso (non chi
    // se l'e' fatto mandare a casa) piu' due di riserva
    expect(per["Dermografo Horus Elitederma"].quantita).toBe(3);
    // l'accessorio parte con la quantita' di scheda
    expect(per["Guanti nitrile M"].quantita).toBe(3);
    expect(righe.map((r) => r.nome)).toEqual(["Aghi 1RL (5 pz)", "Dermografo Horus Elitederma", "Guanti nitrile M", "Pelle sintetica"]);
  });
  it("senza iscritti ne' accessori la lista e' vuota", () => {
    expect(listaRaccoltaMateriale({ iscrittiEdizione: [], kitDefinizioni: [KIT_PRO], corsiKitProdotti: DISTINTE.slice(0, 3), prodottiShop: PRODOTTI, corsoId: "c1", statoEdizione: {} })).toEqual([]);
  });
});

describe("la pagina di raccolta", () => {
  it("un tocco sulla riga la spunta e lo dice; l'avanzamento conta prodotti e pezzi", async () => {
    const spunte = [];
    const righe = [
      { chiave: "prodotto::p-aghi", prodottoId: "p-aghi", nome: "Aghi 1RL (5 pz)", quantita: 7, da: ["3 × Pacchetto PRO Nuovo"] },
      { chiave: "prodotto::p-horus", prodottoId: "p-horus", nome: "Dermografo Horus Elitederma", quantita: 3, da: ["dermografi degli allievi e di riserva"] },
    ];
    let stato = {};
    const p = await monta(
      <RaccoltaMateriale titolo="NEEDLING · Roma" sottotitolo="08/11/2026" righe={righe} spunte={stato}
        onSpunta={(chiave, acceso) => { spunte.push([chiave, acceso]); }} onAzzera={() => {}} onChiudi={() => {}} />,
    );
    expect(p.nodo.querySelector("[data-avanzamento]").textContent).toContain("0 / 2");
    expect(p.nodo.querySelectorAll('[data-riga-raccolta="da-prendere"]').length).toBe(2);
    await clicca(p.nodo.querySelector('[data-riga-raccolta]'));
    expect(spunte).toEqual([["prodotto::p-aghi", true]]);
    await p.smonta();
    // con la spunta salvata la riga e' verde, segnata come presa, e dice chi
    stato = { "prodotto::p-aghi": { il: "2026-10-30T10:00:00Z", da: "Raf" } };
    const p2 = await monta(
      <RaccoltaMateriale titolo="NEEDLING · Roma" righe={righe} spunte={stato} onSpunta={() => {}} onAzzera={() => {}} onChiudi={() => {}} />,
    );
    const presa = p2.nodo.querySelector('[data-riga-raccolta="presa"]');
    expect(presa.textContent).toContain("Aghi 1RL (5 pz)");
    expect(presa.textContent).toContain("preso da Raf");
    expect(presa.style.background).toBe("rgb(234, 245, 234)");
    expect(p2.nodo.querySelector("[data-avanzamento]").textContent).toContain("1 / 2");
    expect(p2.nodo.querySelector("[data-avanzamento]").textContent).toContain("7 di 10 pezzi");
    expect(p2.tasto("Azzera le spunte")).toBeTruthy();
    await p2.smonta();
  });
});
