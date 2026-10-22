// «ASSEGNAZIONE KIT» È UNA CASELLA COME LE ALTRE.
//
// Era «provvisoria, senza permesso»: visibile a chiunque finché qualcuno
// era senza pacchetto. Risultato: stava anche sulla home delle master, a
// cui non spetta, e in Password Master non c'era nessuna casella per
// toglierla. Dal 22/10/2026 la vede chi amministra — è un lavoro
// d'ufficio — o chi ha la casella accesa.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { TASTI_HOME } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";

// un allievo senza pacchetto su una classe futura: la condizione per cui
// la tessera compare
const DATA = { id: "cd1", data_inizio: "2099-01-10", data_fine: "2099-01-11" };
const SENZA_KIT = { id: "i1", kit_id: null, corso_data_id: "cd1" };

async function homeDi(ruolo, permessi) {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  window.sessionStorage.setItem("edc_ok", "1");
  window.sessionStorage.setItem("edc_ruolo", ruolo);
  window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "PROVA", permessi, chiave_sistema: null }));
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    const corpo = u.includes("/iscritti?") ? [SENZA_KIT]
      : u.includes("/corsi_date?") ? [DATA]
      : [];
    return new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  window.fetch = globalThis.fetch;
  const p = await monta(<App />);
  await attendi(350);
  const tessere = [...p.nodo.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
  await p.smonta();
  // `includes` e non `startsWith`: il testo di questa tessera comincia col
  // CSS del pallino che lampeggia (il badge porta un <style> dentro)
  return tessere.some((t) => t.includes("Assegnazione kit"));
}

describe("la tessera Assegnazione kit", () => {
  it("non sta sulla home di una master", async () => {
    expect(await homeDi("user", ["pos", "prezzicorsi", "normative", "dashboardmaster"])).toBe(false);
  });

  it("compare se la casella è accesa", async () => {
    expect(await homeDi("user", ["pos", "dashboardmaster", "assegnazionekit"])).toBe(true);
  });

  it("chi amministra la vede senza doverla accendere", async () => {
    expect(await homeDi("amministratore", ["erp"])).toBe(true);
  });

  // la casella esiste davvero: Password Master e le altre liste di
  // permessi disegnano una casella per ogni voce di TASTI_HOME
  it("ed è fra le caselle dei permessi", () => {
    expect(TASTI_HOME.some((t) => t.chiave === "assegnazionekit")).toBe(true);
  });
});
