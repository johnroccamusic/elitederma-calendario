// LA PORTA D'INGRESSO: si scrive la password e si entra in Home.
//
// Fino al 21/10/2026 chi entrava con la sola password venditore saltava
// la Home e atterrava dritto sulla Dashboard venditori. Aveva senso
// quando le password erano poche e non c'erano permessi — quella
// dashboard era tutto quello che un venditore poteva vedere. Adesso ogni
// persona ha la sua password e le sue aree, e saltare la Home vuol dire
// non sapere di averle.
//
// Qui si fa il gesto per intero: si scrive la password di un venditore,
// si preme Entra, e si guarda dove si finisce.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, scrivi, clicca, attendi } from "./aiuto.js";

const MARIO = { id: "v1", nome: "MARIO", password: "mario123", permessi: ["dashboardvenditori", "prezzicorsi", "normative"] };

async function entraCon(password) {
  window.history.replaceState({}, "", "/");
  try { window.sessionStorage.clear(); } catch { /* navigazione privata */ }
  rispondiCon({
    "/venditori?": [MARIO],
    "/utenti_app?": [],
    "/master?": [],
    "/assistente?": [],
  });
  const p = await monta(<App />);
  await scrivi(p.nodo.querySelector('input[type="password"]'), password);
  await clicca(p.tasto("Entra"));
  await attendi(400);
  return p;
}

describe("l'ingresso", () => {
  it("il venditore entra in Home, non nella sua dashboard", async () => {
    const p = await entraCon(MARIO.password);
    // la Home: le tessere delle aree che gli spettano
    expect(p.testo()).toMatch(/Dashboard venditori/);
    expect(p.testo()).toMatch(/Prezzi corsi/);
    // e NON l'intestazione della Dashboard venditori, che dice il suo nome
    expect(p.testo()).not.toMatch(/Dashboard Mario/);
    expect(p.testo()).not.toMatch(/Area venditore/);
  });

  it("in Home ci sono anche le aree che non sono la sua dashboard", async () => {
    const p = await entraCon(MARIO.password);
    // se si atterrasse sulla dashboard, queste non si vedrebbero mai —
    // ed e' il motivo per cui il salto e' stato tolto
    expect(p.testo()).toMatch(/Normative/);
  });

  it("con la password sbagliata non si entra", async () => {
    const p = await entraCon("non-e-questa");
    expect(p.testo()).toMatch(/Codice non corretto/);
  });
});
