// CHIEDI AI DATI: la barra in Statistiche. Si scrive, si preme Chiedi, la
// risposta arriva coi numeri e con il calcolo da controllare.
import { describe, it, expect } from "vitest";
import React from "react";
import ChiediAiDati, { DOMANDE_PRONTE } from "../src/statistiche/ChiediAiDati.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

describe("Chiedi ai dati", () => {
  it("manda la domanda alla funzione e mostra risposta, numeri e calcolo", async () => {
    const chiamate = [];
    rispondiCon({ "functions/v1/analisi-domanda": (corpo) => { chiamate.push(corpo); return {
      ok: true, risposta: "A maggio il più venduto è **Tokyo** con 12 pezzi.\n- Tokyo: 12\n- Ago 1RLMT: 14 pezzi ma 264,94 €",
      sql: "select prodotto, sum(quantita) pezzi from analisi_vendite_righe where mese = 5 group by 1 order by 2 desc limit 10",
      nota: "vendite completate di maggio 2026", righe: [{ prodotto: "Tokyo", pezzi: 12, incasso: 377.25 }], totale_righe: 1,
    }; } });
    const p = await monta(<ChiediAiDati chi="amministratore" />);
    await scrivi(p.nodo.querySelector('[data-campo="domanda"]'), "i prodotti più venduti a maggio");
    await clicca(p.tasto("Chiedi")); await attendi(80);
    expect(chiamate[0].domanda).toBe("i prodotti più venduti a maggio");
    expect(chiamate[0].chi).toBe("amministratore");
    const esito = p.nodo.querySelector('[data-campo="esito-domanda"]');
    expect(esito.textContent).toContain("il più venduto è");
    expect(esito.querySelector("b").textContent).toBe("Tokyo");
    await clicca(p.tasto("I numeri (1 righe)"));
    expect(esito.querySelector("table").textContent).toContain("377,25");
    await clicca(p.tasto("Come l'ho calcolato"));
    expect(esito.querySelector("pre").textContent).toContain("analisi_vendite_righe");
    await p.smonta();
  });
  it("le domande pronte si premono, e un errore si legge", async () => {
    rispondiCon({ "functions/v1/analisi-domanda": { ok: false, errore: "Non sono riuscito a tradurre la domanda in un calcolo." } });
    const p = await monta(<ChiediAiDati />);
    await clicca(p.tasto(DOMANDE_PRONTE[0])); await attendi(80);
    expect(p.testo()).toContain("Non sono riuscito a tradurre");
    await p.smonta();
  });
});
