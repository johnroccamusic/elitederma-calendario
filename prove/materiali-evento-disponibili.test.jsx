// I PRODOTTI DI UN EVENTO DICONO QUANTI SE NE POSSONO PORTARE DAVVERO:
// «In stock 20, di cui 4 necessari per i corsi; disponibili per l'evento
// 16» (chiesto il 24/10/2026). Il «4» lo conta l'Advisor, non la scheda.
import { describe, it, expect } from "vitest";
import React from "react";
import { SchedaMateriali } from "../src/eventi/GestioneEventi.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PRODOTTO = { id: "p1", nome: "Remover Exelash 15g", quantita: 20, stato: "publish" };
const EVENTO = { id: "e1", nome: "Fiera di Napoli", stato: "programmato" };

describe("materiali di un evento", () => {
  it("scrive stock, necessari per i corsi e disponibili per l'evento", async () => {
    rispondiCon({
      "eventi_materiali": [{ id: "m1", evento_id: "e1", prodotto_id: "p1", nome: "Remover Exelash 15g", quantita: 20, quantita_portata: null, quantita_rientrata: null, quantita_scaricata: 0, ordine: 0 }],
      "impostazioni_layout_tabelle": null,
      "eventi": [{ id: "e1", stato: "programmato" }],
    });
    const p = await monta(<SchedaMateriali eventoId="e1" evento={EVENTO} prodotti={[PRODOTTO]} onStockCambiato={() => {}} fabbisognoCorsi={{ p1: 4 }} />);
    await attendi(150);
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("In stock 20, di cui 4 necessari per i corsi; disponibili per l'evento 16");
    await p.smonta();
  });
  it("senza corsi che lo chiedono, dice solo stock e disponibili", async () => {
    rispondiCon({
      "eventi_materiali": [{ id: "m1", evento_id: "e1", prodotto_id: "p1", nome: "Remover Exelash 15g", quantita: 5, quantita_portata: null, quantita_rientrata: null, quantita_scaricata: 0, ordine: 0 }],
      "impostazioni_layout_tabelle": null,
      "eventi": [{ id: "e1", stato: "programmato" }],
    });
    const p = await monta(<SchedaMateriali eventoId="e1" evento={EVENTO} prodotti={[PRODOTTO]} onStockCambiato={() => {}} />);
    await attendi(150);
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("In stock 20; disponibili per l'evento 20");
    expect(t).not.toContain("necessari per i corsi");
    await p.smonta();
  });
});
