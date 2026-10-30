// IL MATERIALE DI UN EVENTO RESTA IN MAGAZZINO (30/10/2026, deciso dal
// titolare): «Partito» non scarica niente, al rientro non si scrive un
// numero ma si spunta «venduti all'evento N, ne riporti in magazzino M».
// Scende solo quando il POS lo vende sul posto.
import { describe, it, expect } from "vitest";
import React from "react";
import { SchedaMateriali } from "../src/eventi/GestioneEventi.jsx";
import { rientroAtteso } from "../src/eventi/dati.js";
import { calcolaConto, problemiDiChiusura } from "../src/eventi/conto.js";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PRODOTTO = { id: "p1", nome: "Remover Exelash 15g", quantita: 20, stato: "publish", costo_acquisto: 4 };
const EVENTO = { id: "e1", nome: "Fiera di Napoli", stato: "programmato" };
const RIGA = { id: "m1", evento_id: "e1", prodotto_id: "p1", nome: "Remover Exelash 15g", quantita: 20, quantita_portata: null, quantita_rientrata: null, quantita_scaricata: 0, quantita_ricaricata: 0, rientro_verificato_il: null, ordine: 0 };
// tre venduti e uno regalato al banco della fiera
const VENDITE = [
  { prodotti: [{ prodotto_id: "p1", quantita: 3 }], tipo_movimento: "vendita" },
  { prodotti: [{ prodotto_id: "p1", quantita: 1 }], tipo_movimento: "omaggio" },
];

function preparaScheda(righe, scritture) {
  rispondiCon({
    "rest/v1/eventi_materiali": (corpo, indirizzo) => {
      if (corpo) scritture.push({ indirizzo, corpo });
      return corpo ? [{ ...righe[0], ...corpo }] : righe;
    },
    "rest/v1/vendite_shop": VENDITE,
    "rest/v1/prodotti_shop": (corpo, indirizzo) => { scritture.push({ indirizzo, corpo }); return []; },
    "rest/v1/movimenti_magazzino": (corpo, indirizzo) => { scritture.push({ indirizzo, corpo }); return []; },
    "impostazioni_layout_tabelle": null,
    "rest/v1/eventi?": [{ id: "e1", stato: "programmato" }],
  });
}

describe("il materiale di un evento resta in magazzino", () => {
  it("«Partito» segna la quantità e non muove né giacenze né movimenti", async () => {
    const scritture = [];
    preparaScheda([RIGA], scritture);
    const p = await monta(<SchedaMateriali eventoId="e1" evento={EVENTO} prodotti={[PRODOTTO]} onStockCambiato={() => {}} />);
    await attendi(150);
    expect(p.testo()).not.toContain("Rimetti in magazzino");
    expect(p.testo()).toContain("resta in magazzino");
    await clicca(p.tasto("Partito"));
    await attendi(150);
    const suiMateriali = scritture.filter((s) => s.indirizzo.includes("eventi_materiali"));
    expect(suiMateriali.length).toBe(1);
    expect(suiMateriali[0].corpo).toEqual({ quantita_portata: 20 });
    // niente su prodotti_shop, niente in movimenti_magazzino
    expect(scritture.filter((s) => s.indirizzo.includes("prodotti_shop") || s.indirizzo.includes("movimenti_magazzino"))).toEqual([]);
    expect(p.testo()).toContain("il magazzino non è cambiato");
    await p.smonta();
  });

  it("al posto della casella «Rientrato» c'è la spunta: venduti all'evento 4, ne riporti in magazzino 16", async () => {
    const scritture = [];
    preparaScheda([{ ...RIGA, quantita_portata: 20 }], scritture);
    const p = await monta(<SchedaMateriali eventoId="e1" evento={EVENTO} prodotti={[PRODOTTO]} onStockCambiato={() => {}} />);
    await attendi(150);
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("Venduti all'evento 4 (di cui 1 in omaggio), ne riporti in magazzino 16");
    // le caselle numeriche sono due: Da portare e Partito. «Rientrato» non c'è più
    const numeriche = p.campi().filter((c) => c.type === "number");
    expect(numeriche.length).toBe(2);
    expect(t).not.toContain("Rientrato");
    const spunta = p.nodo.querySelector('input[data-campo="rientro_verificato"]');
    expect(spunta.checked).toBe(false);
    await clicca(spunta);
    await attendi(150);
    const scrittura = scritture.find((s) => s.indirizzo.includes("eventi_materiali"));
    expect(Object.keys(scrittura.corpo)).toEqual(["rientro_verificato_il"]);
    expect(scrittura.corpo.rientro_verificato_il).toBeTruthy();
    expect(scritture.filter((s) => s.indirizzo.includes("prodotti_shop") || s.indirizzo.includes("movimenti_magazzino"))).toEqual([]);
    await p.smonta();
  });

  it("rientroAtteso: senza «Partito» vale il da portare, e il POS oltre il partito si segnala", () => {
    const uscite = { venduto: { p1: 3 }, omaggiato: { p1: 1 } };
    expect(rientroAtteso(RIGA, uscite)).toMatchObject({ portata: 20, venduti: 3, omaggiati: 1, usciti: 4, attesi: 16, inEccesso: 0 });
    expect(rientroAtteso({ ...RIGA, quantita_portata: 2 }, uscite)).toMatchObject({ attesi: 0, inEccesso: 2 });
    // una voce libera non ha vendite al POS: deve tornare tutta
    expect(rientroAtteso({ ...RIGA, prodotto_id: null, quantita_portata: 5 }, uscite)).toMatchObject({ usciti: 0, attesi: 5 });
  });

  it("il conto valorizza il venduto al POS e, prima di chiudere, chiede la spunta del rientro", () => {
    const dati = { vendite: VENDITE.map((v, i) => ({ id: `v${i}`, totale: 10, totale_imponibile: 8.2, totale_iva: 1.8, metodo_pagamento: "contanti", ...v })),
      spese: [], attribuzioni: [], trasferimenti: [], gruppi: [], stanze: [],
      materiali: [{ ...RIGA, quantita_portata: 20 }] };
    const conto = calcolaConto(dati, "e1", { prodottiShop: [PRODOTTO] });
    expect(conto.merce[0]).toMatchObject({ portata: 20, venduto: 3, omaggiata: 1, daRiportare: 16, rientroVerificato: false, valore: 16 });
    expect(problemiDiChiusura(conto).some((m) => m.includes("nessuno ha ancora spuntato il rientro"))).toBe(true);
    const verificato = calcolaConto({ ...dati, materiali: [{ ...RIGA, quantita_portata: 20, rientro_verificato_il: "2026-10-30T10:00:00Z" }] }, "e1", { prodottiShop: [PRODOTTO] });
    expect(problemiDiChiusura(verificato).some((m) => m.includes("rientro"))).toBe(false);
  });
});
