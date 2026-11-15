// L'AGGANCIO FRA LA SCHEDA DEL CORSO E LA SUA LISTA (15/11/2026).
//
// Il titolare: «quando selezioni un corso, la lista di preparazione
// relativa sia graficamente collegata al corso e parta sempre da quel
// corso a scendere». Pubblicato, e dalla sua schermata non succedeva
// niente: il pannello restava in cima.
//
// jsdom non impagina — offsetTop e offsetHeight valgono zero — ma le
// misure si possono dettare: qui si finge un'impaginazione vera e si
// guarda se il pannello scende davvero.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { PaginaLogisticaProdotti } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";

const CORSI = [{ id: "c1", nome: "PMU BASE" }, { id: "c2", nome: "LAMINAZIONE" }, { id: "c3", nome: "HENNE" }];
const LOC = [{ id: "l1", nome: "MILANO", sede_centrale: false }];
const DATE = [
  { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-10", data_fine: "2099-01-11" },
  { id: "cd2", corso_id: "c2", location_id: "l1", data_inizio: "2099-01-20", data_fine: "2099-01-21" },
  { id: "cd3", corso_id: "c3", location_id: "l1", data_inizio: "2099-01-30", data_fine: "2099-01-31" },
];
// ogni scheda alta 200, la prima a 30 (sotto il titolo «Corsi in arrivo»)
const ALTEZZA = 200;
const PRIMA = 30;
const TOP = { cd1: PRIMA, cd2: PRIMA + ALTEZZA, cd3: PRIMA + ALTEZZA * 2 };

const origine = {};
beforeAll(() => {
  for (const chiave of ["offsetTop", "offsetHeight", "offsetWidth", "offsetParent"]) {
    origine[chiave] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, chiave);
  }
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get() { return TOP[this.getAttribute?.("data-riga-corso")] ?? 0; },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() { return this.hasAttribute?.("data-riga-corso") ? ALTEZZA : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() { return this.hasAttribute?.("data-riga-corso") ? 600 : 0; },
  });
});
afterAll(() => {
  for (const [chiave, desc] of Object.entries(origine)) {
    if (desc) Object.defineProperty(HTMLElement.prototype, chiave, desc);
  }
});

const dati = {
  corsi: CORSI, location: LOC, corsiDate: DATE, iscritti: [],
  corsiKitProdotti: [], kitDefinizioni: [], logisticaKitEdizioni: [],
  prodottiShop: [], prodottiImmagini: [], categorieProdotti: [], prodottiCategorie: [],
  bundleComponenti: [], inventarioSede: [], prodottiApertiMagazzino: [],
  utenteLoggato: { nome: "Raf" }, ruoloUtente: "programmatore",
  onApriMagazziniLocali: () => {}, onBack: () => {}, ricarica: () => {},
};

const colonnaDestra = (nodo) => nodo.querySelector("[data-ponte-corso]")?.parentElement?.lastElementChild;

describe("la lista scende fino al corso scelto", () => {
  // 15/11/2026, corretto dal titolare: «la giunzione tra le due nuvole è
  // brutta». Erano due riquadri arrotondati con in mezzo un rettangolo
  // piatto: tre forme invece di una.
  // 15/11/2026, scelto dal titolare fra tre disegni: la scheda resta
  // tonda da tutte e quattro le parti, e la striscia le passa DIETRO
  // come un nastro. Squadrarle il fianco faceva un vassoio a elle, e
  // quello è stato scartato.
  it("le schede restano tonde e la striscia passa dietro", async () => {
    const p = await monta(<PaginaLogisticaProdotti {...dati} />);
    await clicca(p.nodo.querySelector('[data-riga-corso="cd2"]'));
    await attendi();
    const scelta = p.nodo.querySelector('[data-riga-corso="cd2"]');
    expect(scelta.style.borderRightColor).not.toBe("transparent");
    expect(scelta.style.borderTopRightRadius).toBe("");
    const ponte = p.nodo.querySelector("[data-ponte-corso]");
    expect(ponte.style.borderTop).toBe("");
    expect(ponte.style.zIndex).toBe("0");
    // le due colonne stanno davanti al nastro
    expect(colonnaDestra(p.nodo).style.zIndex).toBe("1");
    expect(colonnaDestra(p.nodo).firstElementChild.style.borderTopLeftRadius).toBe("");
    await p.smonta();
  });

  // «avevo fatto delle modifiche al contenuto delle schede eliminando
  // la doppia data»: da quando il pannello è attaccato alla scheda del
  // suo corso, data, nome e città stanno a cinque centimetri di
  // distanza. Ripeterli è un'intestazione che non dice niente di nuovo.
  it("il pannello agganciato non ripete la data né il nome del corso", async () => {
    const p = await monta(<PaginaLogisticaProdotti {...dati} />);
    await clicca(p.nodo.querySelector('[data-riga-corso="cd2"]'));
    await attendi();
    const destra = colonnaDestra(p.nodo);
    // la scheda di sinistra la dice una volta
    expect(p.nodo.querySelector('[data-riga-corso="cd2"]').textContent).toContain("LAMINAZIONE");
    // il pannello no, e nemmeno la data
    expect(destra.textContent).not.toContain("LAMINAZIONE");
    expect(destra.textContent).not.toContain("GEN");
    // ma il tasto che apre la raccolta c'è ancora
    expect(destra.textContent).toContain("PREPARA");
    await p.smonta();
  });


  it("premendo il terzo corso, il pannello parte dalla sua riga", async () => {
    const p = await monta(<PaginaLogisticaProdotti {...dati} />);
    await clicca(p.nodo.querySelector('[data-riga-corso="cd3"]'));
    await attendi();
    const ponte = p.nodo.querySelector("[data-ponte-corso]");
    expect(ponte).toBeTruthy();
    expect(ponte.style.top).toBe(`${TOP.cd3}px`);
    expect(ponte.style.height).toBe(`${ALTEZZA}px`);
    expect(colonnaDestra(p.nodo).style.marginTop).toBe(`${TOP.cd3}px`);
    await p.smonta();
  });
});
