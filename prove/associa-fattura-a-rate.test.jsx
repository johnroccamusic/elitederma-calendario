// La fattura Orthostetica n. 846 (18/11/2026): due rate da 921,79 € da
// associare a due spese gia' scritte a mano. La finestra «Associa a una
// spesa» restava a girare per sempre: il salvataggio non aveva un
// `finally`, l'errore finiva sotto la finestra e «Annulla» era spento.
// E le due spese prendevano tutte e due la scadenza della prima rata.
//
// Qui si guardano le tre cose: ogni rata la sua data, un aggiornamento
// che non tocca nessuna riga che lo dice DENTRO la finestra, e
// un'eccezione che non lascia il tasto in «Salvo…».
import { it, expect } from "vitest";
import React from "react";
import { PaginaAmministrazione } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const F = "c6f2303e-5cc1-49df-afa3-92562f119535";
const DOC = {
  id: "f91eddf2", iva: 332.45, note: null,
  rate: [{ amount: 921.79, due_date: "2026-11-29" }, { amount: 921.79, due_date: "2026-12-29" }],
  tipo: "fattura", stato: "da_riconciliare", fic_id: 444240786, numero: "846",
  totale: 1843.58, imponibile: 1511.13, fornitore_id: F, data_documento: "2026-10-29",
  importo_allocato: 0, data_scadenza_prevista: "2026-11-29",
};
const sp = (id, sc) => ({
  id, stato: "fatturata", totale: 921.79, imponibile: 755.57,
  descrizione: "Riassortimento prodotti needling", tipo_ambito: "generale",
  categoria_id: "prodotti_vendita", fornitore_id: F, data_documento: "2026-10-30",
  scadenza_pagamento: sc, sottocategoria_id: "x", numero_documento: null,
  iva_percentuale: 22, origine: "manuale",
});

async function apriEConferma() {
  const p = await monta(
    <PaginaAmministrazione tabIniziale="documenti" ruoloUtente="programmatore" corsi={[]} location={[]}
      corsiDate={[]} iscritti={[]} master={[]} masterCorsi={[]} corsiDateDocenti={[]} quoteVenditoriSplit={[]}
      assistente={[]} assistenteCorsi={[]} leva={[]} hotel={[]}
      spese={[sp("s1", "2026-11-23"), sp("s2", "2026-12-21")]} venditeShop={[]} costiCategorie={[]}
      costiSottocategorie={[]} categorieGruppi={[]} fornitori={[{ id: F, nome: "ORTHOSTETICA SRL" }]}
      abbonamentiContratti={[]} abbonamentiImporti={[]}
      fattureRicevuteFic={[{ id: "fr1", fic_id: 444240786, fornitore_nome: "ORTHOSTETICA SRL", numero_documento: "846", data_documento: "2026-10-29", totale: 1843.58, imponibile: 1511.13, tipo: "fattura" }]}
      noteCreditoFic={[]} documentoFornitoreTabella={[DOC]} ricarica={async () => {}} />,
  );
  await attendi(300);
  const ott = [...p.nodo.querySelectorAll("button")].find((b) => /^Ott/i.test(b.textContent.trim()));
  if (ott) await clicca(ott);
  await clicca(p.tasto("Associa a una spesa"));
  const righe = [...p.nodo.querySelectorAll("button")].filter((b) => b.textContent.includes("Riassortimento"));
  expect(righe.length).toBe(2);
  for (const r of righe) await clicca(r);
  await clicca(p.tasto("Associa le"));
  await attendi(300);
  return p;
}

it("ogni spesa prende la scadenza della sua rata", async () => {
  const scritte = [];
  rispondiCon({
    "rest/v1/spese": (c, url) => { if (c) scritte.push({ url, c }); const id = /id=eq\.([^&]+)/.exec(url)?.[1]; return id ? [{ id }] : []; },
    "rest/v1/documento_fornitore": (c) => (c ? [{ id: "f91eddf2" }] : []),
  });
  await apriEConferma();
  const perSpesa = Object.fromEntries(scritte.map((s) => [/id=eq\.([^&]+)/.exec(s.url)?.[1], s.c.scadenza_pagamento]));
  expect(perSpesa).toEqual({ s1: "2026-11-29", s2: "2026-12-29" });
});

it("se il database non cambia nessuna riga lo dice dentro la finestra, e la finestra si sblocca", async () => {
  rispondiCon({ "rest/v1/spese": () => [] });
  const p = await apriEConferma();
  const avviso = p.nodo.querySelector('[role="alert"]');
  expect(avviso?.textContent).toMatch(/non si e' aggiornata/);
  expect(p.testo()).not.toMatch(/Salvo/);
});

it("un'eccezione durante il salvataggio non lascia la finestra a girare", async () => {
  rispondiCon({ "rest/v1/spese": () => { throw new Error("rete giu'"); } });
  const p = await apriEConferma();
  expect(p.nodo.querySelector('[role="alert"]')?.textContent).toMatch(/interrotto|Errore/);
  expect(p.testo()).not.toMatch(/Salvo/);
});
