// UNA PUBBLICAZIONE NUOVA SPEZZA LE SCHEDE RIMASTE APERTE.
//
// I pezzi staccati dell'app hanno il nome col codice del contenuto
// (GestioneEventi-Bl0S8LbT.js): a ogni pubblicazione quel codice cambia
// e il file di prima sparisce dal server — verificato il 22/10/2026, un
// nome della build precedente risponde 404.
//
// Una scheda lasciata aperta tiene il file d'avvio vecchio, che quei
// nomi vecchi li conosce ancora. Al primo pezzo non ancora caricato
// chiede un file che non c'è più: l'import fallisce, e sotto l'unica
// Suspense resta «Un momento…» che non finisce mai. Chi guarda vede una
// pagina che gira, e non ha modo di sapere che basterebbe ricaricare.
//
// È il caso peggiore per l'app intera: `Accesso.jsx` carica `App.jsx`
// proprio così, quindi un file d'avvio vecchio non apre più niente.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pezzo } from "../src/pezzo.js";

// `pezzo` chiama il caricatore solo quando React monta il componente:
// qui si prende il promise interno senza passare da React, che è
// l'unico modo di guardare cosa succede al fallimento.
const carica = (p) => p._payload._result ? p._payload._result() : p._payload._init(p._payload);

describe("un pezzo che non arriva più", () => {
  beforeEach(() => {
    try { window.sessionStorage.removeItem("edc_ricarica_per_pezzo"); } catch { /* vuoto */ }
  });

  it("se arriva, non succede niente di strano", async () => {
    const ricarica = vi.fn();
    Object.defineProperty(window, "location", { value: { reload: ricarica }, writable: true });
    const P = pezzo(async () => ({ default: () => null }));
    await carica(P);
    expect(ricarica).not.toHaveBeenCalled();
  });

  it("se non arriva, la pagina si ricarica", async () => {
    const ricarica = vi.fn();
    Object.defineProperty(window, "location", { value: { reload: ricarica }, writable: true });
    const P = pezzo(async () => { throw new Error("Failed to fetch dynamically imported module"); });
    await expect(carica(P)).rejects.toThrow();
    expect(ricarica).toHaveBeenCalledTimes(1);
  });

  // RICARICARE IN CERCHIO È PEGGIO DEL GUASTO. Se il pezzo manca per un
  // motivo vero — rete giù, file rotto — una pagina che si ricarica
  // all'infinito non si può nemmeno chiudere con calma: meglio lasciar
  // vedere l'errore.
  it("ma una volta sola, non in cerchio", async () => {
    const ricarica = vi.fn();
    Object.defineProperty(window, "location", { value: { reload: ricarica }, writable: true });
    const rotto = async () => { throw new Error("Failed to fetch dynamically imported module"); };
    await expect(carica(pezzo(rotto))).rejects.toThrow();
    await expect(carica(pezzo(rotto))).rejects.toThrow();
    await expect(carica(pezzo(rotto))).rejects.toThrow();
    expect(ricarica).toHaveBeenCalledTimes(1);
  });

  it("e il guasto non viene nascosto: chi sta sopra lo vede", async () => {
    Object.defineProperty(window, "location", { value: { reload: () => {} }, writable: true });
    const P = pezzo(async () => { throw new Error("niente rete"); });
    await expect(carica(P)).rejects.toThrow(/niente rete/);
  });
});
