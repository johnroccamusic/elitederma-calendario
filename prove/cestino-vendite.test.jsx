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
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /metti la vendita nel cestino/i.test(b.title || ""))));
    await attendi(60);
    await clicca(p.tasto("Sì, cancella")); await attendi(200);
    const cestina = chiamate.find((c) => c[0] === "cestina");
    expect(cestina).toBeTruthy();
    expect(cestina[1]).toMatchObject({ p_id: "v1", p_chi: "Titolare" });
    expect(chiamate.find((c) => c[0] === "delete")).toBeFalsy();
    await p.smonta();
  });

  it("dal cestino si ripristina e il magazzino si riscarica", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/rpc/vendita_ripristina": (corpo) => { chiamate.push(["ripristina", corpo]); return VENDITA; },
      "rest/v1/vendite_cestino": [{ id: "v1", numero_ordine: "POS-1", data_ordine: "2026-10-08T10:00:00", operatore_nome: "ELIA CITO", totale: 44.9, metodo_pagamento: "contanti", origine: "pos", riga: VENDITA, cestinata_il: "2026-10-26T09:18:00", cestinata_da: "Titolare" }],
      "rest/v1/prodotti_shop": (corpo, url) => { if (corpo) chiamate.push(["stock", corpo]); return url.includes("maybeSingle") || url.includes("id=eq.") ? PRODOTTO : [PRODOTTO]; },
      "rest/v1/movimenti_magazzino": (corpo) => { chiamate.push(["movimento", corpo]); return corpo; },
    });
    const p = await monta(<CestinoVendite origine="pos" prodottiShop={[PRODOTTO]} ricarica={() => {}} />);
    expect(p.testo()).toContain("POS-1");
    expect(p.testo()).toContain("da Titolare");
    await clicca(p.tasto("Ripristina")); await attendi(200);
    expect(chiamate.find((c) => c[0] === "ripristina")[1]).toEqual({ p_id: "v1" });
    const mov = chiamate.find((c) => c[0] === "movimento");
    expect(mov[1]).toMatchObject({ delta: -1, origine: "vendita" });
    expect(mov[1].nota).toContain("ripristinata dal cestino");
    await p.smonta();
  });
});
