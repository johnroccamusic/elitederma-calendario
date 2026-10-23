// LA PASTIGLIA «✓ STRIPE» SULLA RIGA DELLA VENDITA: la prova che i soldi
// sono arrivati si vede dall'elenco, non solo aprendo l'ordine.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaVenditeShop } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";
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
