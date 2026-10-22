// AMMINISTRAZIONE SI APRE, E I SUOI TASTI RISPONDONO.
//
// Scritta il 22/10/2026 dopo un «entro in amministrazione e non mi
// funziona niente»: due pagine grosse, nessuna delle due con un
// montaggio che le guardasse. Questo progetto non si rompe in
// compilazione — si rompe al montaggio e al clic, e senza una prova
// qui l'unico modo di saperlo è che qualcuno ci entri.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaErp, PaginaAmministrazione } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

describe("la pagina Amministrazione", () => {
  it("si apre, e ogni tasto porta dove dice", async () => {
    const aperte = [];
    const p = await monta(
      <PaginaErp
        ruoloUtente="amministratore"
        onBack={() => aperte.push("home")}
        onApriAmministrazione={() => aperte.push("contabilita")}
        onApriCatalogoCategorieCosti={() => aperte.push("categorie")}
        onApriAssegnazioneMaster={() => aperte.push("operativo")}
        onApriAnagrafiche={() => aperte.push("anagrafiche")}
        onApriGestioneIva={() => aperte.push("iva")}
        onApriFattureDaEmettere={() => aperte.push("fatture")}
      />
    );
    const tasti = [...p.nodo.querySelectorAll("button")];
    expect(tasti.length).toBeGreaterThanOrEqual(7);
    for (const t of tasti) await clicca(t);
    // un tasto che sembra un tasto e non fa niente è il guasto peggiore
    for (const dove of ["contabilita", "categorie", "operativo", "anagrafiche", "iva", "fatture"]) {
      expect(aperte, dove).toContain(dove);
    }
  });
});

describe("la Contabilità", () => {
  const VUOTI = {
    corsi: [], location: [], corsiDate: [], iscritti: [], master: [], masterCorsi: [],
    corsiDateDocenti: [], quoteVenditoriSplit: [], assistente: [], assistenteCorsi: [],
    leva: [], hotel: [], spese: [], venditeShop: [], costiCategorie: [], costiSottocategorie: [],
    categorieGruppi: [], fornitori: [], abbonamentiContratti: [], abbonamentiImporti: [],
    fattureRicevuteFic: [], noteCreditoFic: [], documentoFornitoreTabella: [],
    impegnoTabella: [], locationPrezzi: [],
  };

  // A MANI VUOTE, che è il caso in cui si rompe: un `.split` o un
  // `[0].qualcosa` su una lista vuota spegne tutta la pagina, e in
  // archivio le liste vuote capitano (un mese senza spese, una tabella
  // non ancora chiesta — vedi «Elenco vuoto = tabella non chiesta»).
  it("si apre anche senza un solo dato", async () => {
    const p = await monta(
      <PaginaAmministrazione {...VUOTI} ruoloUtente="amministratore"
        ricarica={() => {}} onBack={() => {}}
        onApriModificaSpesa={() => {}} onApriPrimaNotaCassa={() => {}} />
    );
    expect(p.testo()).toMatch(/Contabilità/);
    expect(p.nodo.querySelectorAll("button").length).toBeGreaterThan(10);
  });

  it("e nessuno dei suoi tasti spegne la pagina", async () => {
    const p = await monta(
      <PaginaAmministrazione {...VUOTI} ruoloUtente="amministratore"
        ricarica={() => {}} onBack={() => {}}
        onApriModificaSpesa={() => {}} onApriPrimaNotaCassa={() => {}} />
    );
    for (const t of [...p.nodo.querySelectorAll("button")]) await clicca(t);
    // se un clic avesse buttato giù la pagina, qui non ci sarebbe più niente
    expect(p.testo().length).toBeGreaterThan(50);
  });
});
