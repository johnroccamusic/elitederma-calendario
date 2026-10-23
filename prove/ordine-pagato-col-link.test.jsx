// L'ORDINE SA SE IL LINK È STATO PAGATO.
//
// 23/10/2026: la cliente di POS-1792423132290 aveva pagato col link alle
// 16:37, e il dettaglio ordine proponeva ancora «Genera un link». Il
// pagamento stava su pagamenti_pos, legato per vendita_id, e la scheda
// non lo guardava. Adesso lo dice, con ora e codice; e un link ancora in
// attesa si rimostra invece di farne un secondo.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleDettaglioOrdine } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const ORDINE = {
  id: "v-lia", numero_ordine: "POS-1792423132290", data_ordine: "2026-10-19T15:18:52Z",
  totale: 117.13, totale_imponibile: 96.01, origine: "pos", metodo_pagamento: "pos",
  operatore_nome: "VALENTINA CALASCIBETTA", tipo_movimento: "vendita", pagamento_codice: null,
  prodotti: [{ prodotto_id: "p1", nome: "Pelle sintetica", quantita: 1, totale_riga: 117.13 }],
};

async function apriCon(pagamenti) {
  rispondiCon({ "pagamenti_pos": pagamenti, "vendite_shop": [] });
  const p = await monta(<ModaleDettaglioOrdine vendita={ORDINE} onChiudi={() => {}} puoRiscuotere />);
  await attendi(80);
  return p;
}

describe("il dettaglio ordine e il link di pagamento", () => {
  it("pagato: lo dice con ora e codice, e il tasto del link sparisce", async () => {
    const p = await apriCon([{ codice: "JW8T7T", stato: "da_verificare", importo: 117.13, pagato_il: "2026-10-23T14:37:24Z", scade_il: "2026-10-24T08:19:59Z", stripe_session_url: "https://stripe/x", richiede_fattura: false, fattura_numero: null, creato_il: "2026-10-23T08:20:00Z" }]);
    const riquadro = p.nodo.querySelector('[data-campo="pagamento-ricevuto"]');
    expect(riquadro).toBeTruthy();
    expect(riquadro.textContent).toContain("Pagamento ricevuto");
    expect(riquadro.textContent).toContain("JW8T7T");
    expect(riquadro.textContent).toContain("23/10/2026");
    expect(riquadro.textContent).toContain("16:37");
    expect(p.tasto("Genera un link di pagamento")).toBeUndefined();
    expect(p.testo()).not.toContain("Il pagamento non è arrivato?");
    // e in cima, accanto a «Completato», la pastiglia: si vede senza scorrere
    const pastiglia = p.nodo.querySelector('[data-campo="pastiglia-pagato"]');
    expect(pastiglia.textContent).toContain("Pagato");
    expect(pastiglia.textContent).toContain("16:37");
    await p.smonta();
  });

  it("link in attesa: si rimostra quello, senza farne un altro", async () => {
    const p = await apriCon([{ codice: "AB12CD", stato: "in_attesa", importo: 117.13, pagato_il: null, scade_il: "2099-01-01T00:00:00Z", stripe_session_url: "https://stripe/attesa", richiede_fattura: false, fattura_numero: null, creato_il: "2026-10-23T08:20:00Z" }]);
    expect(p.nodo.querySelector('[data-campo="pagamento-ricevuto"]')).toBeNull();
    expect(p.nodo.querySelector('[data-campo="pastiglia-pagato"]')).toBeNull();
    expect(p.testo()).toContain("già stato generato");
    expect(p.testo()).toContain("AB12CD");
    expect(p.testo()).toContain("https://stripe/attesa");
    expect(p.tasto("Genera un link di pagamento")).toBeUndefined();
    await p.smonta();
  });

  it("link scaduto e mai pagato: si può generarne uno nuovo", async () => {
    const p = await apriCon([{ codice: "OLD111", stato: "in_attesa", importo: 117.13, pagato_il: null, scade_il: "2026-01-01T00:00:00Z", stripe_session_url: "https://stripe/vecchio", richiede_fattura: false, fattura_numero: null, creato_il: "2026-10-01T08:20:00Z" }]);
    expect(p.nodo.querySelector('[data-campo="pagamento-ricevuto"]')).toBeNull();
    expect(p.tasto("Genera un link di pagamento")).toBeTruthy();
    await p.smonta();
  });
});
