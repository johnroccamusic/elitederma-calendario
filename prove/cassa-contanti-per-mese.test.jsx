// LA CASSA CONTANTI SI LEGGE UN MESE ALLA VOLTA (28/10/2026): riporto dal
// mese prima, parziali del mese, saldo a fine mese. Niente totali di
// entrate e uscite dall'apertura in poi. Il saldo in cassa resta.
import { describe, it, expect } from "vitest";
import React from "react";
import { PannelloCassaContanti } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const vuoti = { corsiDate: [], iscritti: [], corsiDateDocenti: [], master: [], masterCorsi: [], assistente: [], assistenteCorsi: [], leva: [], location: [], hotel: [], quoteVenditoriSplit: [], spese: [], venditeShop: [], corsi: [] };

describe("Cassa contanti per mese", () => {
  it("mostra riporto, parziali e saldo del mese, e scorrendo indietro il mese prima", async () => {
    rispondiCon({
      "cassa_contanti_impostazioni": { aperta_il: "2026-09-01", saldo_iniziale: 1000 },
      "cassa_contanti_movimenti": [
        { id: "m1", data: "2026-10-05", tipo: "versamento", motivo: "Restituzione", importo: 100 },
        { id: "m2", data: "2026-09-15", tipo: "prelievo", motivo: "Prelevati", importo: 200 },
      ],
      "corsi_date_buste": [],
      "corsi_date": [{ id: "cd1", busta_rientrata_il: "2026-09-20", busta_importo: 500 }],
      "vendite_shop": [{ totale: 50, evento_id: null, data_ordine: "2026-10-10T10:00:00" }],
      "spese": [{ id: "s1", descrizione: "Cancelleria", totale: 30, metodo_pagamento: "Cassa contanti", stato: "pagata", data_pagamento: "2026-10-12", classe_id: null, evento_id: null, origine: "manuale", origine_scadenziario_chiave: null }],
      "cassa_spese_ricorrenti": [],
      "eventi": [],
    });
    const p = await monta(<PannelloCassaContanti {...vuoti} ricarica={() => {}} />);
    await attendi(200);
    const mese = p.nodo.querySelector('[data-campo="cassa-mese"]');
    expect(p.nodo.querySelector('[data-campo="mese-vista"]').textContent).toMatch(/ottobre 2026/i);
    expect(mese.textContent).toContain("Riporto dal mese precedente");
    expect(mese.textContent).toContain("1300,00");         // 1000 − 200 + 500
    expect(p.nodo.querySelector('[data-campo="saldo-fine-mese"]').textContent).toContain("1420,00"); // + 50 + 100 − 30
    // il totale dall'apertura non compare piu' da nessuna parte
    expect(p.testo()).not.toContain("Come si compone");
    // lo storico ha solo ottobre
    expect(p.testo()).toContain("Restituzione");
    expect(p.testo()).not.toContain("Prelevati");
    // indietro a settembre: saldo all'apertura, la busta, il prelievo
    await clicca(p.nodo.querySelector('button[aria-label="Mese precedente"]')); await attendi(60);
    expect(p.nodo.querySelector('[data-campo="mese-vista"]').textContent).toMatch(/settembre 2026/i);
    expect(mese.textContent).toContain("Saldo all'apertura");
    expect(p.nodo.querySelector('[data-campo="saldo-fine-mese"]').textContent).toContain("1300,00");
    expect(p.testo()).toContain("Prelevati");
    expect(p.testo()).not.toContain("Restituzione");
    await p.smonta();
  });
});
