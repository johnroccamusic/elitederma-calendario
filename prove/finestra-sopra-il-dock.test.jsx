// LA FINESTRA NON FINISCE SOTTO IL DOCK, E LA PAGINA SOTTO NON SCORRE.
//
// 23/10/2026: il dettaglio ordine su iPhone aveva le ultime righe sotto
// il dock, e arrivati in fondo il dito scorreva la pagina dietro. Il
// padding in fondo all'overlay Safari lo ignora (flex che scorre): lo
// spazio e' un elemento. E il body resta chiuso finche' la finestra c'e'.
import { describe, it, expect } from "vitest";
import React from "react";
import { Modal } from "../src/App.jsx";
import { monta } from "./aiuto.js";

describe("la finestra modale", () => {
  it("ha un divisorio vuoto dopo la scheda, e chiude lo scroll della pagina", async () => {
    document.body.style.overflow = "";
    const p = await monta(<Modal title="Prova" onClose={() => {}}><div>contenuto</div></Modal>);
    const spazio = p.nodo.querySelector('[data-campo="spazio-sotto-la-finestra"]');
    expect(spazio).toBeTruthy();
    expect(spazio.style.height).not.toBe("");
    expect(document.body.style.overflow).toBe("hidden");
    await p.smonta();
    expect(document.body.style.overflow).toBe("");
  });

  it("con due finestre, chiudere quella sopra non riapre lo scroll", async () => {
    document.body.style.overflow = "";
    const sotto = await monta(<Modal title="Sotto" onClose={() => {}}><div>a</div></Modal>);
    const sopra = await monta(<Modal title="Sopra" onClose={() => {}}><div>b</div></Modal>);
    await sopra.smonta();
    expect(document.body.style.overflow).toBe("hidden");
    await sotto.smonta();
    expect(document.body.style.overflow).toBe("");
  });
});
