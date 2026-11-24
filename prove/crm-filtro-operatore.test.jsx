// IL FILTRO PER OPERATORE (24/11/2026): «Trattato da» guarda TUTTE le
// richieste della persona, e accanto c'e' l'esito del lead con quell'
// operatore — chiusi, non chiusi, da richiamare, scartati. Serve a fare la
// mailing list dei clienti di un operatore che esce.
import { describe, it, expect } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import PaginaContatti, { riassuntoFiltri } from "../src/crm/PaginaContatti.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MIGRAZIONE = readFileSync(process.cwd() + "/supabase/migrations/20261124090000_crm_filtro_per_operatore.sql", "utf8");

const VALORI = {
  regioni: [], province: [], comuni: [], qualifiche: [], stati: [], mestieri: [], corsi: [], anni: [], reparti: [],
  trattati_da: [{ valore: "Katia", quanti: 5620 }, { valore: "Olga", quanti: 5181 }],
  totale: 23757, disiscritti: 0, senza_data: 0,
};

async function scegliTendina(nodo, valore) {
  const { act } = await import("react");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(nodo, valore);
    nodo.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

describe("il filtro per operatore", () => {
  it("l'esito si sceglie solo dopo l'operatore, e va al database insieme a lui", async () => {
    const chiamate = [];
    rispondiCon({
      "rpc/crm_filtri_valori": VALORI,
      "rpc/crm_cerca_contatti": (corpo) => { chiamate.push(corpo); return { totale: 0, righe: [] }; },
    });
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    const esito = () => p.nodo.querySelector(`select[data-filtro="Esito con l'operatore"]`);
    expect(esito().disabled).toBe(true);

    await scegliTendina(p.nodo.querySelector('select[data-filtro="Operatore (trattato da)"]'), "Katia");
    await attendi(150);
    expect(esito().disabled).toBe(false);
    await scegliTendina(esito(), "chiusi");
    await attendi(250);
    expect(chiamate[chiamate.length - 1].filtri).toEqual({ trattato_da: "Katia", esito_operatore: "chiusi" });

    // tolto l'operatore, l'esito non resta appeso a nessuno
    await scegliTendina(p.nodo.querySelector('select[data-filtro="Operatore (trattato da)"]'), "");
    await attendi(250);
    expect(chiamate[chiamate.length - 1].filtri).toEqual({});
    await p.smonta();
  });

  it("il riassunto dice chi e come", () => {
    expect(riassuntoFiltri({ trattato_da: "Katia" })).toBe("trattati da Katia");
    expect(riassuntoFiltri({ trattato_da: "Olga", esito_operatore: "chiusi" })).toBe("chiusi da Olga");
    expect(riassuntoFiltri({ trattato_da: "Olga", esito_operatore: "da_richiamare" })).toBe("da richiamare da Olga");
  });

  it("nel database: tutte le richieste, non l'ultima, e l'esito dalla stessa richiesta", () => {
    expect(MIGRAZIONE).toContain("filtri->>'esito_operatore'");
    expect(MIGRAZIONE).not.toContain("c.trattato_da = f_trattato");
    const i = MIGRAZIONE.indexOf("f_trattato is null or exists");
    expect(i).toBeGreaterThan(-1);
    const blocco = MIGRAZIONE.slice(i, i + 900);
    expect(blocco).toContain("r.trattato_da = f_trattato");
    for (const e of ["chiusi", "non_chiusi", "da_richiamare", "scartati"]) expect(blocco).toContain(`f_esito = '${e}'`);
    // e i filtri di prima ci sono ancora tutti
    for (const chiave of ["cerca", "anno", "dal", "al", "corso", "regione", "provincia", "comune", "qualifica", "stato",
      "mestiere", "collegamento", "disiscritti", "da_verificare", "con_email", "senza_data", "cliente_shop", "non_in_crm",
      "acquisto_dal", "acquisto_al", "reparto", "speso_da"]) {
      expect(MIGRAZIONE, chiave).toContain(`filtri->>'${chiave}'`);
    }
  });
});
