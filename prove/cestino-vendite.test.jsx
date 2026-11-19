// IL CESTINO DELLE VENDITE: cancellare passa da vendita_cestina con il
// nome di chi preme; dal cestino si ripristina e il magazzino si
// riscarica.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaVenditeShop, CestinoVendite } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PRODOTTO = { id: "p-orange", nome: "Orange", quantita: 10, tipo_prodotto: "semplice" };
const VENDITA = { id: "v1", numero_ordine: "POS-1", data_ordine: "2026-10-08T10:00:00", stato: "completed", origine: "pos", tipo_movimento: "vendita", metodo_pagamento: "contanti", operatore_nome: "ELIA CITO", operatore_id: "e", totale: 44.9, prodotti: [{ nome: "Orange", prodotto_id: "p-orange", quantita: 1, totale_riga: 44.9 }] };

describe("Cestino delle vendite", () => {
  it("cancellare chiama vendita_cestina con chi preme, non una delete", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/rpc/vendita_cestina": (corpo) => { chiamate.push(["cestina", corpo]); return { id: "v1" }; },
      "rest/v1/prodotti_shop": (corpo, url) => { if (corpo) chiamate.push(["stock", corpo]); return url.includes("select=id,nome,quantita") || url.includes("select=id%2Cnome") ? PRODOTTO : [PRODOTTO]; },
      "rest/v1/movimenti_magazzino": (corpo) => { chiamate.push(["movimento", corpo]); return corpo; },
      "rest/v1/vendite_cestino": [],
      "rest/v1/vendite_shop": (corpo, url) => { if (url.includes("DELETE") ) chiamate.push(["delete"]); return []; },
    });
    // prelevata dai kit: il magazzino non si tocca, e la prova guarda solo
    // che la cancellazione passi dal cestino con il nome di chi preme
    const p = await monta(<PaginaVenditeShop venditeShop={[{ ...VENDITA, prelevato_dai_kit: true }]} prodottiShop={[PRODOTTO]} origine="pos" chi="Titolare" ricarica={() => {}} onBack={() => {}} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /metti la vendita nel cestino/i.test(b.title || "")));
    await attendi(60);
    await clicca(p.tasto("Sì, cancella")); await attendi(200);
    const cestina = chiamate.find((c) => c[0] === "cestina");
    expect(cestina).toBeTruthy();
    expect(cestina[1]).toMatchObject({ p_id: "v1", p_chi: "Titolare" });
    expect(chiamate.find((c) => c[0] === "delete")).toBeFalsy();
    await p.smonta();
  });

  it("dal cestino si ripristina e il magazzino si riscarica, in un blocco, prima della vendita", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/rpc/vendita_ripristina": (corpo) => { chiamate.push(["ripristina", corpo]); return VENDITA; },
      "rest/v1/rpc/stock_muovi": (corpo) => { chiamate.push(["stock_muovi", corpo]); return { ok: true, quantita: {} }; },
      "rest/v1/vendite_cestino": [{ id: "v1", numero_ordine: "POS-1", data_ordine: "2026-10-08T10:00:00", operatore_nome: "ELIA CITO", totale: 44.9, metodo_pagamento: "contanti", origine: "pos", riga: VENDITA, cestinata_il: "2026-10-26T09:18:00", cestinata_da: "Titolare", motivo: null }],
    });
    const p = await monta(<CestinoVendite origine="pos" prodottiShop={[PRODOTTO]} ricarica={() => {}} />);
    expect(p.testo()).toContain("POS-1");
    expect(p.testo()).toContain("da Titolare");
    await clicca(p.tasto("Ripristina")); await attendi(200);
    expect(chiamate.map((c) => c[0]).slice(0, 2)).toEqual(["stock_muovi", "ripristina"]);
    expect(chiamate[0][1]).toMatchObject({ p_origine: "vendita", p_righe: [{ prodotto_id: "p-orange", delta: -1 }] });
    expect(chiamate[0][1].p_nota).toContain("ripristinata dal cestino");
    expect(chiamate.find((c) => c[0] === "ripristina")[1]).toEqual({ p_id: "v1" });
    await p.smonta();
  });

  it("se il magazzino non basta, la vendita resta nel cestino e non cambia niente", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/rpc/vendita_ripristina": (corpo) => { chiamate.push(["ripristina", corpo]); return VENDITA; },
      "rest/v1/rpc/stock_muovi": () => ({ ok: false, motivo: "insufficiente", prodotti: [{ prodotto_id: "p-orange", nome: "Orange", disponibili: 0, richiesti: 1 }] }),
      "rest/v1/vendite_cestino": [{ id: "v1", numero_ordine: "POS-1", data_ordine: "2026-10-08T10:00:00", operatore_nome: "ELIA CITO", totale: 44.9, metodo_pagamento: "contanti", origine: "pos", riga: VENDITA, cestinata_il: "2026-10-26T09:18:00", cestinata_da: "Titolare", motivo: null }],
    });
    const p = await monta(<CestinoVendite origine="pos" prodottiShop={[PRODOTTO]} ricarica={() => {}} />);
    await clicca(p.tasto("Ripristina")); await attendi(200);
    expect(chiamate.find((c) => c[0] === "ripristina")).toBeFalsy();
    expect(p.testo()).toContain("Non ripristinata");
    expect(p.testo()).toContain("il magazzino non e' stato toccato");
    await p.smonta();
  });

  it("cancellando una vendita, i pezzi tornano in UN blocco e, se la cancellazione fallisce, vengono ritolti", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/rpc/stock_muovi": (corpo) => { chiamate.push(["stock_muovi", corpo]); return { ok: true, quantita: {} }; },
      "rest/v1/vendite_cestino": [],
      "rest/v1/vendite_shop": [],
    });
    // vendita_cestina risponde con un errore vero (400): rispondiCon risponde sempre 200
    const base = globalThis.fetch;
    const conErrore = async (url, opz) => String(url).includes("rpc/vendita_cestina")
      ? new Response(JSON.stringify({ code: "P0001", message: "cestina rotta" }), { status: 400, headers: { "Content-Type": "application/json" } })
      : base(url, opz);
    globalThis.fetch = conErrore; globalThis.window.fetch = conErrore;
    const p = await monta(<PaginaVenditeShop venditeShop={[VENDITA]} prodottiShop={[PRODOTTO]} origine="pos" chi="Titolare" ricarica={() => {}} onBack={() => {}} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /metti la vendita nel cestino/i.test(b.title || "")));
    await attendi(60);
    await clicca(p.tasto("Sì, cancella")); await attendi(300);
    const blocchi = chiamate.filter((c) => c[0] === "stock_muovi");
    expect(blocchi[0][1]).toMatchObject({ p_origine: "reso", p_righe: [{ prodotto_id: "p-orange", delta: 1 }] });
    expect(blocchi.length).toBe(2); // reso + ritiro
    expect(blocchi[1][1].p_righe).toEqual([{ prodotto_id: "p-orange", delta: -1 }]);
    await p.smonta();
  });
});
