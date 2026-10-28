// IL POS SI APRE ANCHE A UN'ASSISTENTE. Il 28/10/2026 Martina Tora
// premeva la tessera in Home e vedeva una sfilza di errori: il POS
// leggeva `corsiDateDocentiPos` 350 righe prima di dichiararlo, e solo
// il ramo dell'assistente lo legge. Il giro delle sezioni non lo
// prendeva perche' il suo profilo "assistente" non aveva assistenteId.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";

describe("POS di un'assistente", () => {
  it("la tessera in Home apre il POS, senza errori", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem("edc_ok", "1");
    window.sessionStorage.setItem("edc_ruolo", "user");
    window.sessionStorage.setItem("edc_utente", JSON.stringify({
      id: "807f0125-a1e7-4e1d-b6d0-beedc2fcaa20", nome: "MARTINA TORA", assistenteId: "807f0125-a1e7-4e1d-b6d0-beedc2fcaa20",
      permessi: ["dashboardmaster", "sch_cambi", "sch_inventario", "sch_consensi", "sch_modelle", "sch_dettaglicorso", "normative", "prezzicorsi", "pos"], chiave_sistema: null,
    }));
    window.history.replaceState({}, "", "/");
    globalThis.fetch = vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    window.fetch = globalThis.fetch;
    const errori = [];
    const orig = console.error; console.error = (...a) => { errori.push(a.map(String).join(" ")); };
    try {
      const p = await monta(<App />); await attendi(300);
      const tessera = [...p.nodo.querySelectorAll("button")].find((b) => /POS Vendita diretta/i.test(b.textContent || ""));
      expect(tessera).toBeTruthy();
      await clicca(tessera); await attendi(400);
      expect(p.testo()).toContain("Vendita al pubblico");
      expect(errori.filter((e) => /before initialization|is not defined|Cannot read/.test(e))).toEqual([]);
      await p.smonta();
    } finally { console.error = orig; }
  });
});
