// L'ALLOGGIO PROVVISORIO da «Gestisci»: una scheda completa che crea un
// hotel occasionale e lo aggancia alla riga del corso, con le tariffe.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleGestisciAlloggio } from "../src/App.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CD = { id: "cd1", data_inizio: "2026-11-16", data_fine: "2026-11-17" };

describe("Alloggio occasionale da Gestisci", () => {
  it("crea l'hotel con i suoi dati e aggancia la riga del corso", async () => {
    const hotelScritti = []; const righeScritte = [];
    rispondiCon({
      "rest/v1/hotel": (corpo) => { if (corpo) hotelScritti.push(corpo); return { id: "h-nuovo" }; },
      "rest/v1/corsi_date": (corpo) => { if (corpo) righeScritte.push(corpo); return [{ id: "cd1" }]; },
    });
    let salvato = false;
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={CD} tabella="corsi_date" hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => { salvato = true; }} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /Provvisorio/.test(b.textContent)));
    await scrivi(p.nodo.querySelector('[data-campo="occ-nome"]'), "B&B Da Maria");
    await scrivi(p.nodo.querySelector('[data-campo="occ-telefono"]'), "333 1234567");
    await scrivi(p.nodo.querySelector('[data-campo="occ-costo-cash"]'), "60");
    await scrivi(p.campi().find((i) => i.getAttribute("inputmode") === "numeric"), "2");
    await clicca(p.tasto("Salva")); await attendi(150);
    expect(hotelScritti[0]).toMatchObject({ nome: "B&B Da Maria", telefono: "333 1234567", costo_notte_cash: 60, solo_edizione: true, ricorrente_occasionale: "occasionale" });
    expect(righeScritte[0]).toMatchObject({ alloggio_id: "h-nuovo", notti_prenotate: 2, pattuito_a_notte_cash: 60, pattuito_periodo_cash: 120 });
    expect(salvato).toBe(true);
    await p.smonta();
  });
  it("senza il nome non crea niente", async () => {
    const hotelScritti = [];
    rispondiCon({ "rest/v1/hotel": (corpo) => { if (corpo) hotelScritti.push(corpo); return { id: "x" }; }, "rest/v1/corsi_date": [] });
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={CD} tabella="corsi_date" hotel={[]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => {}} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /Provvisorio/.test(b.textContent)));
    await clicca(p.tasto("Salva")); await attendi(100);
    expect(hotelScritti.length).toBe(0);
    expect(p.testo()).toContain("Serve almeno il nome");
    await p.smonta();
  });
});
