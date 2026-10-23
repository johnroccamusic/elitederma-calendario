// LO STORICO DEL POS CONFERMA IL PAGAMENTO: la master che ha fatto
// inquadrare il QR vede «✓ Stripe» accanto alla sua vendita.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MASTER = { tipo: "master", masterId: "m1", nome: "VALENTINA PROVA" };
const base = { stato: "completed", origine: "pos", tipo_movimento: "vendita", operatore_tipo: "master", operatore_id: "m1", operatore_nome: "VALENTINA PROVA", data_ordine: "2026-10-19T10:00:00Z", prodotti: [{ nome: "Pigmento", quantita: 1, totale_riga: 50 }] };
const VENDITE = [
  { ...base, id: "v-qr", numero_ordine: "POS-1", totale: 50, metodo_pagamento: "pos", pagamento_codice: "ABC123" },
  { ...base, id: "v-no", numero_ordine: "POS-2", totale: 70, metodo_pagamento: "pos", pagamento_codice: "MAIPAG" },
  { ...base, id: "v-cash", numero_ordine: "POS-3", totale: 20, metodo_pagamento: "contanti", pagamento_codice: null },
];

describe("storico del POS", () => {
  it("segna ✓ Stripe solo sulla vendita il cui QR risulta incassato", async () => {
    rispondiCon({
      "/auth/v1/user": { id: "u1", email: "x@y.it" },
      "pagamenti_pos": [{ codice: "ABC123", vendita_id: null, pagato_il: "2026-10-19T11:00:00Z" }],
    });
    const p = await monta(
      <PaginaPOS prodottiShop={[]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
        venditeShop={VENDITE} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
        master={[{ id: "m1", nome: "VALENTINA PROVA" }]} ricarica={() => {}} onBack={() => {}}
        utenteLoggato={MASTER} venditoreLoggato={null} targetVenditeProdotti={[]} ruoloUtente="user" />
    );
    const storico = [...p.nodo.querySelectorAll("button")].find((b) => /storico|le tue vendite/i.test(b.textContent || ""));
    expect(storico, "il tasto dello storico").toBeTruthy();
    await clicca(storico); await attendi(120);
    const pastiglie = [...p.nodo.querySelectorAll('[data-campo="pastiglia-stripe"]')];
    expect(pastiglie).toHaveLength(1);
    const riga = pastiglie[0].closest("tr") || pastiglie[0].closest("button");
    expect(riga.textContent).toContain("POS-1");
    await p.smonta();
  });
});
