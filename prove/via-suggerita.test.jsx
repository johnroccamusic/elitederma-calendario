// I SUGGERIMENTI DELLA VIA.
//
// Qui si prova il gesto: si scrive, si aspetta, compare l'elenco, si
// clicca e la casella si riempie. La ricerca e' finta — quello che va
// provato e' il comportamento del campo, non Photon.
import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { monta, scrivi, attendi, premi } from "./aiuto.js";

function Scheda({ iniziali = {}, cercaVie }) {
  const [valori, setValori] = useState(iniziali);
  return (
    <AreaAnagrafica
      area={AREA_ALLIEVO} valori={valori} cercaVie={cercaVie}
      scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
    />
  );
}
const campoVia = (p) => p.nodo.querySelector('input[data-campo="indirizzo_residenza"]');
const apri = (iniziali, cercaVie) => monta(<Scheda iniziali={iniziali} cercaVie={cercaVie} />);

// una residenza col comune gia' scelto: e' la condizione in cui la
// ricerca ha senso
const A_ROMA = { prov_residenza: "RM", citta_residenza: "Roma", cap_residenza: "00166" };

describe("i suggerimenti della via", () => {
  it("si cerca solo dopo tre lettere, e una volta sola", async () => {
    const cerca = vi.fn(async () => []);
    const p = await apri(A_ROMA, cerca);
    await scrivi(campoVia(p), "VI");
    await attendi(700);
    expect(cerca).not.toHaveBeenCalled();
    await scrivi(campoVia(p), "VIA CARLO");
    await attendi(700);
    expect(cerca).toHaveBeenCalledTimes(1);
    expect(cerca).toHaveBeenCalledWith("VIA CARLO", "Roma", "00166");
  });

  it("senza comune non si cerca niente", async () => {
    const cerca = vi.fn(async () => []);
    const p = await apri({}, cerca);
    await scrivi(campoVia(p), "VIA CARLO SEVERINI");
    await attendi(700);
    expect(cerca).not.toHaveBeenCalled();
  });

  it("cliccando la proposta si riempiono via e civico", async () => {
    const cerca = async () => [{ via: "Via Carlo Severini", civico: "46", cap: "00163", comune: "Roma" }];
    const p = await apri(A_ROMA, cerca);
    await scrivi(campoVia(p), "VIA CARLO");
    await attendi(700);
    expect(p.testo()).toMatch(/Via Carlo Severini/);
    const riga = p.nodo.querySelector('[data-proposta="0"]');
    expect(riga.textContent).toMatch(/Via Carlo Severini 46/);
    await premi(riga);
    expect(campoVia(p).value).toBe("VIA CARLO SEVERINI");
    expect(p.nodo.querySelector('input[data-campo="civico_residenza"]')?.value).toBe("46");
  });

  it("un CAP diverso da quello scelto si segnala, e non riscrive niente", async () => {
    const cerca = async () => [{ via: "Via Carlo Severini", civico: "", cap: "00163", comune: "Roma" }];
    const p = await apri(A_ROMA, cerca);
    await scrivi(campoVia(p), "VIA CARLO");
    await attendi(700);
    expect(p.testo()).toMatch(/00163/);
    expect(p.testo()).toMatch(/⚠/);
    // il CAP della cascata non si tocca
    expect(p.tendina("cap_residenza").value).toBe("00166");
  });

  it("nessun suggerimento non e' un errore: non si dice niente", async () => {
    const p = await apri(A_ROMA, async () => []);
    await scrivi(campoVia(p), "VIA CHE NON ESISTE");
    await attendi(700);
    expect(p.testo()).not.toMatch(/nessun|errore|non trovat/i);
    expect(campoVia(p).value).toBe("VIA CHE NON ESISTE");
  });

  it("se la ricerca si rompe, la via si scrive comunque", async () => {
    const p = await apri(A_ROMA, async () => { throw new Error("rete giu'"); });
    await scrivi(campoVia(p), "VIA CARLO SEVERINI");
    await attendi(700);
    expect(campoVia(p).value).toBe("VIA CARLO SEVERINI");
  });

  // IL DIFETTO DEL 20/10/2026: l'elenco restava aperto a suggerire la
  // via che era appena stata scelta, e si apriva anche su una scheda
  // gia' compilata. La ricerca ripartiva a ogni cambio del valore,
  // quindi anche quando a cambiarlo era la scelta stessa.
  it("su una scheda già compilata non si cerca niente", async () => {
    const cerca = vi.fn(async () => []);
    await apri({ ...A_ROMA, indirizzo_residenza: "VIA CARLO SEVERINI" }, cerca);
    await attendi(700);
    expect(cerca).not.toHaveBeenCalled();
  });

  it("scelta la proposta, l'elenco si chiude e non si riapre", async () => {
    const cerca = async () => [{ via: "Via Carlo Severini", civico: "46", cap: "00163", comune: "Roma" }];
    const p = await apri(A_ROMA, cerca);
    await scrivi(campoVia(p), "VIA CARLO");
    await attendi(700);
    expect(p.nodo.querySelector('[data-proposta="0"]')).not.toBe(null);
    await premi(p.nodo.querySelector('[data-proposta="0"]'));
    // il valore e' cambiato per effetto della scelta: la ricerca NON
    // deve ripartire e riproporre la stessa via
    await attendi(700);
    expect(p.nodo.querySelector('[data-proposta="0"]')).toBe(null);
  });

  it("una proposta identica a quello che c'è già non si mostra", async () => {
    const cerca = async () => [{ via: "Via Carlo Severini", civico: "", cap: "00163", comune: "Roma" }];
    const p = await apri({ ...A_ROMA, civico_residenza: "46" }, cerca);
    // si scrive la via per intero: la ricerca trova quella e basta
    await scrivi(campoVia(p), "VIA CARLO SEVERINI");
    await attendi(700);
    expect(p.nodo.querySelector('[data-proposta="0"]')).toBe(null);
  });

  it("ma se la proposta porta un civico che manca, si mostra", async () => {
    const cerca = async () => [{ via: "Via Carlo Severini", civico: "46", cap: "00163", comune: "Roma" }];
    const p = await apri(A_ROMA, cerca);
    await scrivi(campoVia(p), "VIA CARLO SEVERINI");
    await attendi(700);
    expect(p.nodo.querySelector('[data-proposta="0"]')).not.toBe(null);
  });

  it("fuori Italia non si cerca", async () => {
    const cerca = vi.fn(async () => []);
    const p = await apri({ stato_residenza: "SVIZZERA", citta_residenza: "SION" }, cerca);
    await scrivi(campoVia(p), "AVENUE DE TOURBILLON");
    await attendi(700);
    expect(cerca).not.toHaveBeenCalled();
  });
});
