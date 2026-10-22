// IL DETTAGLIO DELLE VENDITE DI UNA FIERA.
//
// Il Conto dice se l'evento è andato in pari — ricavi meno spese, in
// imponibile — ma non dice COSA è passato dal banco. Dopo una fiera è
// la prima domanda: quanti scontrini, quanto il più grosso, e di cosa
// portare di più la prossima volta.
import { describe, it, expect } from "vitest";
import React from "react";
import { SchedaDettaglioVendite } from "../src/eventi/GestioneEventi.jsx";
import { prodottiPiuVenduti, totaliVendite } from "../src/eventi/dati.js";
import { monta, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PELLICOLA = { id: "p1", nome: "Pellicola per laminazione" };
const PASTA = { id: "p2", nome: "Pasta Bianca" };

const VENDITE = [
  {
    id: "v1", numero_ordine: "POS-1", data_ordine: "2026-09-25T22:06:09Z", totale: 24,
    metodo_pagamento: "contanti", tipo_movimento: "vendita", operatore_nome: "ANDREA PAURA",
    prodotti: [
      { prodotto_id: "p1", nome: "Pellicola", quantita: 2, totale_riga: 4, sconto_pct: 0 },
      { prodotto_id: "p2", nome: "Pasta", quantita: 1, totale_riga: 20, sconto_pct: 10 },
    ],
  },
  {
    id: "v2", numero_ordine: "POS-2", data_ordine: "2026-09-26T13:03:36Z", totale: 6,
    metodo_pagamento: "pos", tipo_movimento: "vendita", operatore_nome: "ANDREA PAURA",
    prodotti: [{ prodotto_id: "p1", nome: "Pellicola", quantita: 3, totale_riga: 6, sconto_pct: 0 }],
  },
  {
    id: "v3", numero_ordine: "POS-3", data_ordine: "2026-09-26T15:00:00Z", totale: 0,
    metodo_pagamento: "contanti", tipo_movimento: "omaggio", operatore_nome: "ANDREA PAURA",
    prodotti: [{ prodotto_id: "p2", nome: "Pasta", quantita: 4, totale_riga: 0, sconto_pct: 0 }],
  },
];

const apri = (vendite = VENDITE) => {
  rispondiCon({ "vendite_shop": vendite });
  return monta(<SchedaDettaglioVendite eventoId="e1" prodotti={[PELLICOLA, PASTA]} />);
};

describe("i conti della fiera", () => {
  it("gli omaggi non entrano nell'incasso, ma i pezzi si contano", () => {
    const t = totaliVendite(VENDITE);
    expect(t.incassato).toBe(30);      // 24 + 6, non il terzo
    expect(t.quante).toBe(2);
    expect(t.omaggi).toBe(1);
    expect(t.pezzi).toBe(6);           // 2 + 1 + 3
    expect(t.pezziOmaggio).toBe(4);
    expect(t.medio).toBe(15);
  });

  it("i metodi di pagamento si separano", () => {
    expect(totaliVendite(VENDITE).perMetodo).toEqual([["contanti", 24], ["pos", 6]]);
  });

  // RAGGRUPPA PER prodotto_id, MAI PER NOME. Sulla riga della vendita
  // c'è il nome che il prodotto aveva quel giorno: se è stato
  // rinominato, per nome la sua storia si spezza in due righe che
  // sembrano due prodotti.
  it("raggruppa per prodotto e usa il nome di adesso", () => {
    const c = prodottiPiuVenduti(VENDITE, { p1: PELLICOLA, p2: PASTA });
    expect(c).toHaveLength(2);
    // la pellicola: 2 + 3 pezzi, in cima
    expect(c[0].nome).toBe("Pellicola per laminazione");
    expect(c[0].pezzi).toBe(5);
    expect(c[0].incasso).toBe(10);
    // la pasta: un pezzo venduto e quattro omaggiati, contati a parte
    expect(c[1].nome).toBe("Pasta Bianca");
    expect(c[1].pezzi).toBe(1);
    expect(c[1].omaggiati).toBe(4);
    expect(c[1].incasso).toBe(20);
  });

  it("un prodotto cancellato tiene il nome che aveva sulla riga", () => {
    const c = prodottiPiuVenduti(VENDITE, {});
    expect(c.map((x) => x.nome)).toContain("Pellicola");
  });

  it("una riga venduta a mano non si perde, e si vede che è a mano", () => {
    const c = prodottiPiuVenduti([{
      tipo_movimento: "vendita",
      prodotti: [{ nome: "Campioncino", quantita: 2, totale_riga: 5 }],
    }], {});
    expect(c[0].nome).toBe("Campioncino");
    expect(c[0].prodottoId).toBe(null);
  });
});

describe("la scheda", () => {
  it("mostra incasso, scontrino medio e classifica", async () => {
    const p = await apri();
    expect(p.testo()).toMatch(/30,00 €/);
    expect(p.testo()).toMatch(/Scontrino medio/);
    expect(p.testo()).toMatch(/15,00 €/);
    expect(p.testo()).toMatch(/I più venduti/);
    expect(p.testo()).toMatch(/Pellicola per laminazione/);
  });

  // un elenco con dentro tutti i prodotti di tutte le vendite è un
  // muro, e si cerca sempre una vendita sola
  it("le righe di una vendita si aprono premendola", async () => {
    const p = await apri();
    expect(p.testo()).not.toMatch(/POS-1/);
    const righe = [...p.nodo.querySelectorAll("button")]
      .filter((b) => (b.textContent || "").includes("prodotti"));
    await clicca(righe[0]);
    expect(p.testo()).toMatch(/POS-1/);
    expect(p.testo()).toMatch(/−10%/);
  });

  it("senza vendite spiega perché, invece di dire solo zero", async () => {
    const p = await apri([]);
    expect(p.testo()).toMatch(/nessuna vendita/i);
    expect(p.testo()).toMatch(/Sei a un evento/);
  });
});
