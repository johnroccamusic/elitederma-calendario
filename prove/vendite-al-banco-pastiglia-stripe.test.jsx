// LA PASTIGLIA «✓ STRIPE» SULLA RIGA DELLA VENDITA: la prova che i soldi
// sono arrivati si vede dall'elenco, non solo aprendo l'ordine.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaVenditeShop } from "../src/App.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const base = { stato: "completed", origine: "pos", tipo_movimento: "vendita", data_ordine: "2026-10-19T10:00:00Z", prodotti: [] };
const VENDITE = [
  { ...base, id: "v-qr", numero_ordine: "POS-1", totale: 50, metodo_pagamento: "pos", pagamento_codice: "ABC123" },
  { ...base, id: "v-link", numero_ordine: "POS-2", totale: 117.13, metodo_pagamento: "pos", pagamento_codice: null },
  { ...base, id: "v-cash", numero_ordine: "POS-3", totale: 20, metodo_pagamento: "contanti", pagamento_codice: null },
];

describe("vendite al banco", () => {
  it("segna ✓ Stripe sulle vendite con incasso ricevuto, per codice o per vendita", async () => {
    rispondiCon({ "pagamenti_pos": [
      { codice: "ABC123", vendita_id: null, pagato_il: "2026-10-19T11:00:00Z" },
      { codice: "JW8T7T", vendita_id: "v-link", pagato_il: "2026-10-23T14:37:00Z" },
    ] });
    const p = await monta(<PaginaVenditeShop venditeShop={VENDITE} origine="pos" ricarica={async () => {}} onBack={() => {}} ruoloUtente="programmatore" />);
    await attendi(100);
    const righe = [...p.nodo.querySelectorAll("tbody tr")];
    const conPastiglia = righe.filter((r) => r.querySelector('[data-campo="pastiglia-stripe"]')).map((r) => r.textContent.match(/#POS-\d/)[0]);
    expect(conPastiglia.sort()).toEqual(["#POS-1", "#POS-2"]);
    await p.smonta();
  });
});

describe("la correzione del metodo di pagamento", () => {
  const stripe = { "pagamenti_pos": [{ codice: "ABC123", vendita_id: null, pagato_il: "2026-10-19T11:00:00Z" }] };
  it("chi amministra ha la tendina, ma non sull'incasso Stripe", async () => {
    rispondiCon(stripe);
    const p = await monta(<PaginaVenditeShop venditeShop={VENDITE} origine="pos" ricarica={async () => {}} onBack={() => {}} ruoloUtente="amministratore" />);
    await attendi(150);
    const righe = [...p.nodo.querySelectorAll("tbody tr")];
    const rigaQr = righe.find((r) => r.textContent.includes("POS-1"));
    const rigaCash = righe.find((r) => r.textContent.includes("POS-3"));
    expect(rigaQr.querySelector("select")).toBeFalsy();
    expect(rigaQr.querySelector('[data-campo="metodo-fisso"]').title).toContain("Stripe");
    expect(rigaCash.querySelector("select")).toBeTruthy();
    await p.smonta();
  });
  it("una master vede il metodo scritto, senza tendina", async () => {
    rispondiCon(stripe);
    const p = await monta(<PaginaVenditeShop venditeShop={VENDITE} origine="pos" ricarica={async () => {}} onBack={() => {}} ruoloUtente="master" />);
    await attendi(150);
    expect(p.nodo.querySelectorAll("tbody select").length).toBe(0);
    expect(p.nodo.querySelectorAll('[data-campo="metodo-fisso"]').length).toBe(3);
    await p.smonta();
  });
});

describe("cambiare il metodo sistema anche la busta", () => {
  it("da contanti a POS su una busta già in cassa: la vendita esce e la busta si riapre", async () => {
    const scritture = [];
    rispondiCon({
      "pagamenti_pos": [],
      "rest/v1/vendite_shop": (corpo, url) => { if (corpo) scritture.push(["vendite_shop", corpo, url]); return corpo?.metodo_pagamento ? [{ id: "v-cash", metodo_pagamento: "pos", totale_imponibile: 16.39, totale_iva: 3.61 }] : []; },
      "rest/v1/corsi_date_buste": [],
      "rest/v1/corsi_date": (corpo, url) => { if (corpo) scritture.push(["corsi_date", corpo, url]); return []; },
    });
    const cd = { id: "cd1", busta_rientrata_il: "2026-10-20", busta_importo: 20 };
    const vendite = [{ ...base, id: "v-cash", numero_ordine: "POS-3", totale: 20, metodo_pagamento: "contanti", corso_data_id: "cd1", busta_numero: 1 }];
    const p = await monta(<PaginaVenditeShop venditeShop={vendite} corsiDate={[cd]} origine="pos" ricarica={async () => {}} onBack={() => {}} ruoloUtente="amministratore" />);
    await attendi(150);
    const sel = p.nodo.querySelector("tbody select");
    await (async () => { const { act } = await import("react"); await act(async () => { const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set; setter.call(sel, "pos"); sel.dispatchEvent(new Event("change", { bubbles: true })); }); })();
    await attendi(60);
    // prima di confermare si dice cosa succede alla busta
    expect(p.testo()).toContain("busta del corso già in cassa");
    await clicca(p.tasto("Conferma")); await attendi(200);
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].metodo_pagamento === "pos")).toBeTruthy();
    expect(scritture.find((x) => x[0] === "corsi_date" && x[1].busta_rientrata_il === null)).toBeTruthy();
    expect(p.testo()).toContain("Incasso cambiato da Contanti a POS");
    expect(p.testo()).toContain("busta del corso è uscita dalla cassa");
    await p.smonta();
  });
});
