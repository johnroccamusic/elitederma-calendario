// RISCUOTERE UN ORDINE GIÀ FATTO: il link deve sapere a quale.
//
// Il 22/10/2026: una vendita al banco non pagata, il link rimandato dal
// dettaglio ordine, la cliente paga — e il pagamento resta senza
// vendita. Il recupero notturno prova allora a crearne una NUOVA dalle
// righe della richiesta, ma lì dentro c'è una riga sola che si chiama
// «Ordine POS-1792489505013»: a catalogo non esiste, e fallisce. Ogni
// cinque minuti, in silenzio, per due giorni. Intanto l'Advisor
// continuava a dire «incasso rimasto indietro» senza dire perché, e la
// vendita vera restava lì come non pagata.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ModaleDettaglioOrdine } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const ORDINE = {
  id: "v-1", numero_ordine: "POS-1792489505013", data_ordine: "2026-10-20T09:45:05Z",
  totale: 212.92, totale_imponibile: 174.52, stato: "completed", origine: "pos",
  metodo_pagamento: "pos", operatore_nome: "DEBORA FUMAGALLI", tipo_movimento: "vendita",
  operatore_tipo: "master", operatore_id: "m-1", corso_data_id: null,
  pagamento_codice: null, cliente_nome: null,
  prodotti: [{ prodotto_id: "p1", nome: "Pigmento", quantita: 1, totale_riga: 212.92 }],
};

async function apriERiscuoti(vuoleFattura) {
  const chiamate = [];
  rispondiCon({
    "functions/v1/stripe-crea-pagamento": (corpo) => {
      chiamate.push(corpo);
      return { codice: "AADTJZ", indirizzo: "https://esempio/paga/AADTJZ", scadeIl: "2026-10-23T11:06:50Z" };
    },
    "pagamenti_pos": [],
    "vendite_shop": [],
  });
  window.open = () => ({ location: "", close() {} });
  const p = await monta(<ModaleDettaglioOrdine vendita={ORDINE} onChiudi={() => {}} puoRiscuotere />);
  const riscuoti = [...p.nodo.querySelectorAll("button")]
    .find((b) => /Genera un link di pagamento/i.test(b.textContent || ""));
  if (riscuoti) { await clicca(riscuoti); await attendi(80); }
  const scelta = [...p.nodo.querySelectorAll("button")]
    .find((b) => (vuoleFattura ? /Sì, serve fattura/i : /No, paga e basta/i).test((b.textContent || "").trim()));
  if (scelta) { await clicca(scelta); await attendi(120); }
  return { ...p, chiamate };
}

describe("il link per riscuotere un ordine", () => {
  it("porta con sé l'id della vendita che sta riscuotendo", async () => {
    const { chiamate } = await apriERiscuoti(false);
    expect(chiamate.length).toBeGreaterThan(0);
    expect(chiamate[0].venditaId).toBe("v-1");
  });

  // l'incasso appartiene a chi ha venduto, non a chi manda il link:
  // è la stessa vendita, ripresa
  it("e l'operatore resta quello della vendita", async () => {
    const { chiamate } = await apriERiscuoti(false);
    expect(chiamate[0].operatore).toMatchObject({ nome: "DEBORA FUMAGALLI", id: "m-1" });
  });

  // una riga sola col totale: le righe dei prodotti non fanno il totale
  // (spedizione, sconti di carrello, centesimi di arrotondamento) e
  // `stripe-crea-pagamento` pretende che tornino esatte
  it("una riga sola, col totale dell'ordine", async () => {
    const { chiamate } = await apriERiscuoti(false);
    expect(chiamate[0].righe).toHaveLength(1);
    expect(chiamate[0].righe[0].prezzo).toBe(212.92);
    expect(chiamate[0].importo).toBe(212.92);
  });
});
