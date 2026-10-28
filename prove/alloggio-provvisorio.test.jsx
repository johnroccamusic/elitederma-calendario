// L'ALLOGGIO PROVVISORIO da «Gestisci» della colonna Hotel: si scrive a
// mano quando l'hotel vero non c'e' ancora, e sparisce scegliendo l'hotel.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleGestisciAlloggio } from "../src/App.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CD = { id: "cd1", data_inizio: "2026-11-16", data_fine: "2026-11-17" };

describe("Alloggio provvisorio", () => {
  it("senza hotel scelto si salva il testo provvisorio", async () => {
    const scritture = [];
    rispondiCon({ "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(corpo); return [{ id: "cd1" }]; } });
    let salvato = false;
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={CD} tabella="corsi_date" hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => { salvato = true; }} />);
    await scrivi(p.nodo.querySelector('[data-campo="alloggio-provvisorio"]'), "B&B Da Maria, da confermare");
    await clicca(p.tasto("Salva")); await attendi(120);
    expect(scritture[0]).toMatchObject({ alloggio_id: null, alloggio_provvisorio: "B&B Da Maria, da confermare" });
    expect(salvato).toBe(true);
    await p.smonta();
  });
  it("scegliendo un hotel il provvisorio si svuota, e il campo sparisce", async () => {
    const scritture = [];
    rispondiCon({ "rest/v1/corsi_date_docenti": (corpo) => { if (corpo) scritture.push(corpo); return [{ id: "d1" }]; } });
    const riga = { id: "d1", alloggio_provvisorio: "B&B Da Maria" };
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={riga} tabella="corsi_date_docenti" hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => {}} />);
    expect(p.nodo.querySelector('[data-campo="alloggio-provvisorio"]').value).toBe("B&B Da Maria");
    const { act } = await import("react");
    const sel = p.tendine()[0];
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, "h1"); sel.dispatchEvent(new Event("change", { bubbles: true })); });
    await attendi(60);
    expect(p.nodo.querySelector('[data-campo="alloggio-provvisorio"]')).toBeFalsy();
    await clicca(p.tasto("Salva")); await attendi(120);
    expect(scritture[0]).toMatchObject({ alloggio_id: "h1", alloggio_provvisorio: null });
    await p.smonta();
  });
});
