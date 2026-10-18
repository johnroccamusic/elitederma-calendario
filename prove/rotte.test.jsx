// CHI DECIDE LA STRADA sta sopra al gestionale.
//
// `App` legge l'indirizzo e basta: se e' una rotta pubblica mostra quella
// pagina e si ferma, altrimenti monta `Gestionale`. Prima le due cose
// stavano nello stesso componente, con gli hook del gestionale sotto i
// `return` delle rotte: per React erano due componenti diversi con lo
// stesso nome, e reggeva solo perche' l'indirizzo non cambia mai a pagina
// aperta.
//
// Questa prova guarda la cosa che conta: aprendo il modulo di iscrizione si
// vede il modulo, e NON si mette in moto il gestionale.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta } from "./aiuto.js";

const VISTA = {
  nome: "ANNA PROVA", stato: "modulo_inviato", scaduto: false, ricevuto: false, contratto: {},
  corso: { nome: "PMU BASE", citta: "BARI", inizio: "2027-05-23", fine: "2027-05-28" },
  campi: [{ chiave: "nome", valore: "ANNA", bloccato: true, obbligatorio: true }],
};

async function apri(indirizzo) {
  window.history.replaceState({}, "", indirizzo);
  const chiamate = [];
  globalThis.fetch = async (url) => {
    chiamate.push(String(url));
    const corpo = String(url).includes("rpc/modulo_vista") ? VISTA : [];
    return new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  window.fetch = globalThis.fetch;
  const p = await monta(<App />);
  return { ...p, chiamate };
}

describe("la scelta della rotta", () => {
  it("col modulo in indirizzo mostra il modulo dell'allieva", async () => {
    const p = await apri("/?modulo=" + "g".repeat(40));
    expect(p.testo()).toContain("ANNA");
    expect(p.testo()).toMatch(/MODULO ISCRIZIONE/i);
  });

  it("e non mette in moto il gestionale: chiede il modulo, non le tabelle", async () => {
    const p = await apri("/?modulo=" + "g".repeat(40));
    const tabelleChieste = p.chiamate.filter((c) => c.includes("/rest/v1/") && !c.includes("/rpc/"));
    expect(tabelleChieste).toHaveLength(0);
    expect(p.chiamate.some((c) => c.includes("rpc/modulo_vista"))).toBe(true);
  });

  it("con un indirizzo qualunque non mostra una pagina pubblica", async () => {
    const p = await apri("/");
    expect(p.testo()).not.toMatch(/MODULO ISCRIZIONE AL CORSO/i);
  });
});
