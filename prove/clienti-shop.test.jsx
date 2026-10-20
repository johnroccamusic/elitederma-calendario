// I CLIENTI DELLO SHOP.
//
// Non esiste un'anagrafica clienti: lo shop non ci ha mandato una
// rubrica, ci ha mandato ordini — 4.206 — e il cliente e' scritto su
// ognuno. L'elenco si RICAVA da li', e cosi' un cliente che compra
// domani compare da solo, senza una seconda tabella da tenere allineata.
//
// Mancavano due cose che servono per chiamarlo davvero un elenco
// clienti: il telefono (c'era solo l'email) e i dati che l'ordine porta
// con se' — indirizzo, ditta, dove spedisce.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaCrmShop } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const ordine = (n, quando, totale, extra = {}) => ({
  id: `v${n}`, origine: "woocommerce", numero_ordine: `W-${n}`, data_ordine: quando,
  totale, stato: "completed", cliente_nome: "Giulia Bianchi", cliente_email: "giulia@esempio.it",
  prodotti: [{ nome: "Ago Nano", quantita: 1, totale_riga: totale }],
  payload_raw: {
    customer_id: 42,
    billing: {
      phone: "3339876543", address_1: "VIA TERNI 90", postcode: "00182", city: "ROMA", state: "RM",
      country: "IT", company: "", ...(extra.billing || {}),
    },
    shipping: extra.shipping || {},
  },
});

const VENDITE = [
  ordine(1, "2025-03-02T10:00:00Z", 120),
  ordine(2, "2026-01-10T10:00:00Z", 80),
  // un ordine del POS non e' un cliente dello shop: non deve entrare
  { id: "p1", origine: "pos", numero_ordine: "POS-1", data_ordine: "2026-02-01T10:00:00Z", totale: 50, prodotti: [] },
];

async function apri() {
  rispondiCon({});
  return monta(
    <PaginaCrmShop venditeShop={VENDITE} vociShopClassificazione={[]} prodottiShop={[]}
      onApriClassificazioneVoci={() => {}} onBack={() => {}} />,
  );
}

describe("clienti shop", () => {
  it("il telefono si legge dall'elenco, non solo l'email", async () => {
    const p = await apri();
    expect(p.testo()).toContain("giulia@esempio.it");
    expect(p.testo()).toContain("3339876543");
  });

  it("gli ordini dello stesso cliente fanno una riga sola", async () => {
    const p = await apri();
    const righe = [...p.nodo.querySelectorAll("tbody tr")];
    expect(righe.length).toBe(1);
    expect(righe[0].textContent).toContain("Giulia Bianchi");
    // due ordini, 200 € in tutto
    expect(righe[0].textContent).toContain("200,00");
  });

  it("le vendite al banco non sono clienti dello shop", async () => {
    const p = await apri();
    expect(p.testo()).not.toContain("POS-1");
  });

  it("aprendo il cliente si vede quello che l'ordine porta con sé", async () => {
    const p = await apri();
    const riga = [...p.nodo.querySelectorAll("tbody tr")][0];
    await clicca(riga);
    const testo = p.testo();
    expect(testo).toContain("VIA TERNI 90");
    expect(testo).toContain("00182 ROMA (RM)");
    expect(testo).toContain("3339876543");
    // e gli ordini restano, uno per riga
    expect(testo).toContain("W-1");
    expect(testo).toContain("W-2");
  });
});
