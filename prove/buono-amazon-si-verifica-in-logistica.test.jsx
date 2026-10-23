// IL BUONO AMAZON SI VERIFICA IN LOGISTICA.
//
// Al banco «Buono Amazon» e' una dichiarazione come il contante: nessuno
// controlla il codice, e il pacco poi parte. Deciso il 23/10/2026: in
// logistica l'ordine mostra «In attesa di verifica pagamento», «Spedita»
// resta spento finche' non lo si preme, e la verifica si scrive sulla
// vendita con chi e quando.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { PaginaOrdiniInArrivo } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

function vendita(extra = {}) {
  return {
    id: "v1", numero_ordine: "POS-1", data_ordine: "2026-10-23T10:00:00Z", origine: "pos",
    metodo_pagamento: "buono_amazon", totale: 48.5, tipo_movimento: "vendita", woo_order_id: null,
    prodotti: [{ nome: "Pigmento", quantita: 1, totale_riga: 48.5 }], ...extra,
  };
}
const PACCO = { id: "s1", vendita_id: "v1", stato: "da_spedire", destinatario_nome: "Lia", indirizzo: "Via Roma", civico: "1", cap: "00100", citta: "Roma", prodotti: [{ nome: "Pigmento", quantita: 1 }], ts: "2026-10-23T10:00:00Z" };

function banco() {
  const scritture = [];
  rispondiCon({
    "vendite_shop": (corpo, url) => { if (corpo) scritture.push({ tabella: "vendite_shop", url, corpo }); return [{ id: "v1" }]; },
    "spedizioni_pos": (corpo, url) => { if (corpo) scritture.push({ tabella: "spedizioni_pos", url, corpo }); return [{ id: "s1" }]; },
  });
  return scritture;
}

async function apri(v) {
  const ricarica = vi.fn(async () => {});
  const p = await monta(
    <PaginaOrdiniInArrivo
      venditeShop={[v]} venditeSimulate={[]} spedizioniPos={[PACCO]}
      corsi={[]} corsiDate={[]} location={[]} iscritti={[]}
      ruoloUtente="amministratore" utenteLoggato={{ nome: "Raffaele" }}
      ricarica={ricarica} onBack={() => {}}
    />
  );
  await attendi(80);
  return { p, ricarica };
}

describe("buono Amazon in logistica", () => {
  it("l'ordine con buono aspetta la verifica, e Spedita non parte", async () => {
    const scritture = banco();
    const { p } = await apri(vendita());
    const verifica = p.nodo.querySelector('[data-campo="verifica-pagamento"]');
    expect(verifica).toBeTruthy();
    expect(verifica.textContent).toContain("In attesa di verifica pagamento");
    const spedita = p.tasto("Spedita");
    expect(spedita.getAttribute("aria-disabled")).toBe("true");
    await clicca(spedita); await attendi(50);
    expect(scritture.filter((s) => s.tabella === "spedizioni_pos" && s.corpo?.stato === "spedito")).toHaveLength(0);
    await p.smonta();
  });

  it("premere la verifica la scrive sulla vendita, con chi e quando", async () => {
    const scritture = banco();
    const { p, ricarica } = await apri(vendita());
    await clicca(p.nodo.querySelector('[data-campo="verifica-pagamento"]')); await attendi(80);
    const scritta = scritture.find((s) => s.tabella === "vendite_shop" && s.url.includes("id=eq.v1"));
    expect(scritta).toBeTruthy();
    expect(scritta.corpo.pagamento_verificato_da).toBe("Raffaele");
    expect(scritta.corpo.pagamento_verificato_il).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // una verifica fatta non si riscrive: la condizione sta nell'indirizzo
    expect(scritta.url).toContain("pagamento_verificato_il=is.null");
    expect(ricarica).toHaveBeenCalledWith(["vendite_shop"]);
    await p.smonta();
  });

  it("verificato: compare chi l'ha fatto e il pacco parte", async () => {
    const scritture = banco();
    const { p } = await apri(vendita({ pagamento_verificato_il: "2026-10-23T11:00:00Z", pagamento_verificato_da: "Raffaele" }));
    expect(p.nodo.querySelector('[data-campo="verifica-pagamento"]')).toBeNull();
    const segno = p.nodo.querySelector('[data-campo="pagamento-verificato"]');
    expect(segno.textContent).toContain("Pagamento verificato da Raffaele");
    await clicca(p.tasto("Spedita")); await attendi(80);
    const partito = scritture.find((s) => s.tabella === "spedizioni_pos" && s.corpo?.stato === "spedito");
    expect(partito).toBeTruthy();
    await p.smonta();
  });

  it("con contanti non c'è niente da verificare", async () => {
    const scritture = banco();
    const { p } = await apri(vendita({ metodo_pagamento: "contanti" }));
    expect(p.nodo.querySelector('[data-campo="verifica-pagamento"]')).toBeNull();
    expect(p.nodo.querySelector('[data-campo="pagamento-verificato"]')).toBeNull();
    await clicca(p.tasto("Spedita")); await attendi(80);
    expect(scritture.find((s) => s.tabella === "spedizioni_pos" && s.corpo?.stato === "spedito")).toBeTruthy();
    await p.smonta();
  });
});
