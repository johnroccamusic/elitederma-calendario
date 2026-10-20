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

// un secondo cliente, che ha anche fatto un corso
const ALTRA = {
  id: "v9", origine: "woocommerce", numero_ordine: "W-9", data_ordine: "2026-02-02T10:00:00Z",
  totale: 300, stato: "completed", cliente_nome: "Anna Verdi", cliente_email: "anna@esempio.it",
  prodotti: [], payload_raw: { customer_id: 77, billing: { phone: "3451112222" } },
};
const ISCRITTI = [{ id: "i1", nome: "ANNA", cognome: "VERDI", email: "ANNA@esempio.it " }];

const VENDITE = [
  ordine(1, "2025-03-02T10:00:00Z", 120),
  ordine(2, "2026-01-10T10:00:00Z", 80),
  ALTRA,
  // un ordine del POS non e' un cliente dello shop: non deve entrare
  { id: "p1", origine: "pos", numero_ordine: "POS-1", data_ordine: "2026-02-01T10:00:00Z", totale: 50, prodotti: [] },
];

async function apri() {
  rispondiCon({});
  return monta(
    <PaginaCrmShop venditeShop={VENDITE} vociShopClassificazione={[]} prodottiShop={[]} iscritti={ISCRITTI}
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
    expect(righe.length).toBe(2);
    const giulia = righe.find((r) => r.textContent.includes("Giulia Bianchi"));
    // due ordini, 200 € in tutto
    expect(giulia.textContent).toContain("200,00");
  });

  it("le vendite al banco non sono clienti dello shop", async () => {
    const p = await apri();
    expect(p.testo()).not.toContain("POS-1");
  });

  it("aprendo il cliente si vede quello che l'ordine porta con sé", async () => {
    const p = await apri();
    const riga = [...p.nodo.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Giulia"));
    await clicca(riga);
    const testo = p.testo();
    expect(testo).toContain("VIA TERNI 90");
    expect(testo).toContain("00182 ROMA (RM)");
    expect(testo).toContain("3339876543");
    // e gli ordini restano, uno per riga
    expect(testo).toContain("W-1");
    expect(testo).toContain("W-2");
  });

  it("si separa chi non ha mai fatto un corso, incrociando per email", async () => {
    const p = await apri();
    // i conti stanno sui tasti: si sa quanti sono prima di premerli
    expect(p.testo()).toContain("Mai stato allievo (1)");
    expect(p.testo()).toContain("Anche allievo (1)");
    // e chi ha fatto un corso porta la pastiglia, anche se l'email in
    // archivio è scritta con le maiuscole e uno spazio in coda
    const diAnna = [...p.nodo.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Anna Verdi"));
    expect(diAnna.textContent).toContain("allieva");
  });

  it("il filtro «mai stato allievo» lascia passare solo loro", async () => {
    const p = await apri();
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.startsWith("Mai stato allievo"));
    await clicca(tasto);
    const righe = [...p.nodo.querySelectorAll("tbody tr")];
    expect(righe.length).toBe(1);
    expect(righe[0].textContent).toContain("Giulia Bianchi");
  });
});
