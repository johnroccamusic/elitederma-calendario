// LA SEDE OCCASIONALE ANCHE SU UNA CLASSE GIÀ A CALENDARIO (11/11/2026).
//
// Il titolare, in Operativo corsi: «quando per un corso non è stato
// assegnato, come succede per le sedi, che si può scegliere sede
// occasionale o sede già registrata, deve accadere la stessa cosa». E,
// premendo il tasto: «clicco su gestisci, si apre una finestra che si
// chiama gestisci sede e dalla tendina ci sono solo le sedi registrate».
//
// Era vero: la strada occasionale esisteva soltanto creando il corso,
// quindi una classe già a calendario che si spostava in uno studio non
// registrato non aveva dove dirlo.
//
// Le due cose che queste prove difendono, oltre al gesto: la CITTÀ non
// cambia (è quella del calendario, e di lei dipendono le statistiche per
// zona e quello che le allieve hanno letto), e la FOTOGRAFIA sulla
// classe — città, indirizzo, telefono — si riscrive, perché è quella che
// legge la mail di conferma: cambiare sede scrivendo il solo
// `location_id` manderebbe l'allieva all'indirizzo di prima.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleGestisciSede } from "../src/App.jsx";
import { monta, clicca, scrivi, scegli, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CD = {
  id: "cd1", location_id: "lo1", data_inizio: "2026-11-20", data_fine: "2026-11-22",
  citta: "ROMA", regione: "Lazio", indirizzo: "Via Giolitti 10", telefono: "06 1111",
};
const SEDI = [
  { id: "lo1", nome: "ROMA", nome_sede: "Centrale", citta: "ROMA", regione: "Lazio", indirizzo: "Via Giolitti 10", telefono: "06 1111", costo_giornaliero_cash: 100, costo_giornaliero_bonifico: 120 },
  { id: "lo2", nome: "ROMA", nome_sede: "Eur", citta: "ROMA", regione: "Lazio", indirizzo: "Viale Europa 5", telefono: "06 2222" },
  { id: "lo3", nome: "MILANO", nome_sede: "Navigli", citta: "MILANO", regione: "Lombardia" },
];

function finta() {
  const sediScritte = []; const righeScritte = []; const cancellate = [];
  rispondiCon({
    "rest/v1/location": (corpo, { metodo } = {}) => {
      if (metodo === "DELETE") cancellate.push("location");
      else if (corpo) sediScritte.push(corpo);
      return { id: "lo-nuova" };
    },
    "rest/v1/corsi_date": (corpo) => { if (corpo) righeScritte.push(corpo); return [{ id: "cd1" }]; },
  });
  return { sediScritte, righeScritte, cancellate };
}

function apri(cd = CD, onSalvato = () => {}) {
  return monta(<ModaleGestisciSede cd={cd} location={SEDI} locationPrezzi={[]} onClose={() => {}} onSalvato={onSalvato} />);
}

describe("Sede occasionale da Gestisci sede", () => {
  it("le due strade ci sono, come nella creazione corso", async () => {
    finta();
    const p = await apri();
    expect(p.nodo.querySelector('[data-campo="sede-registrata"]')).toBeTruthy();
    const occ = p.nodo.querySelector('[data-campo="sede-occasionale"]');
    expect(occ).toBeTruthy();
    // alti 44 come di là: sono la prima scelta, non una rifinitura
    expect(occ.getAttribute("style")).toContain("min-height: 44px");
    // di partenza si resta su quella registrata: la tendina delle due
    // sedi di Roma è quella di sempre
    expect(p.testo()).toContain("Centrale");
    await p.smonta();
  });

  it("crea la sede di questa volta nella città della classe e riscrive la fotografia", async () => {
    const { sediScritte, righeScritte } = finta();
    let salvato = false;
    const p = await apri(CD, () => { salvato = true; });
    await clicca(p.nodo.querySelector('[data-campo="sede-occasionale"]'));
    await scrivi(p.nodo.querySelector('[data-campo="sede-occ-nome"]'), "Studio Bellezza");
    await scrivi(p.nodo.querySelector('[data-campo="sede-occ-indirizzo"]'), "Via dei Mille 4");
    await scrivi(p.nodo.querySelector('[data-campo="sede-occ-telefono"]'), "06 3333");
    await clicca(p.tasto("Salva")); await attendi(150);
    expect(sediScritte[0]).toMatchObject({
      nome: "ROMA", nome_sede: "Studio Bellezza", citta: "ROMA", regione: "Lazio",
      indirizzo: "Via dei Mille 4", telefono: "06 3333",
      solo_edizione: true, ricorrente_occasionale: "occasionale",
    });
    expect(righeScritte[0]).toMatchObject({
      location_id: "lo-nuova", sede_occasionale: true,
      citta: "ROMA", regione: "Lazio", indirizzo: "Via dei Mille 4", telefono: "06 3333",
    });
    expect(salvato).toBe(true);
    await p.smonta();
  });

  it("la città non si può cambiare: si vede e non si scrive", async () => {
    finta();
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-campo="sede-occasionale"]'));
    // nessuna casella dove battere una città, e quella della classe si legge
    const caselle = p.campi().filter((i) => /citt/i.test(i.getAttribute("placeholder") || ""));
    expect(caselle.length).toBe(0);
    expect(p.testo()).toContain("Roma");
    expect(p.testo()).toContain("Resta la città del calendario");
    await p.smonta();
  });

  it("senza il nome del posto non nasce niente", async () => {
    const { sediScritte, righeScritte } = finta();
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-campo="sede-occasionale"]'));
    await clicca(p.tasto("Salva")); await attendi(120);
    expect(sediScritte.length).toBe(0);
    expect(righeScritte.length).toBe(0);
    expect(p.testo()).toContain("Serve almeno il nome del posto");
    await p.smonta();
  });

  it("la tariffa della sede di prima non segue su un altro posto", async () => {
    const { righeScritte } = finta();
    const p = await apri();
    // la finestra riempie da sé il costo a giorno con la tariffa di ROMA Centrale
    const cash = p.campi().find((i) => (i.getAttribute("inputmode") || "") === "decimal");
    expect(cash.value).toBe("100");
    await clicca(p.nodo.querySelector('[data-campo="sede-occasionale"]'));
    expect(p.campi().find((i) => (i.getAttribute("inputmode") || "") === "decimal").value).toBe("");
    await scrivi(p.nodo.querySelector('[data-campo="sede-occ-nome"]'), "Studio Bellezza");
    await clicca(p.tasto("Salva")); await attendi(150);
    expect(righeScritte[0].costo_giorno_sede_cash).toBe(null);
    expect(righeScritte[0].costo_giorno_sede_bonifico).toBe(null);
    await p.smonta();
  });

  it("tornando sulla sede registrata la tariffa torna", async () => {
    finta();
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-campo="sede-occasionale"]'));
    await clicca(p.nodo.querySelector('[data-campo="sede-registrata"]'));
    expect(p.campi().find((i) => (i.getAttribute("inputmode") || "") === "decimal").value).toBe("100");
    await p.smonta();
  });

  it("cambiando sede registrata la fotografia segue la sede scelta", async () => {
    const { righeScritte } = finta();
    const p = await apri();
    const tendina = p.tendine().find((t) => [...t.options].some((o) => /Eur/.test(o.textContent)));
    await scegli(tendina, "lo2");
    await clicca(p.tasto("Salva")); await attendi(150);
    // senza questo, l'allieva riceveva per mail l'indirizzo della sede di prima
    expect(righeScritte[0]).toMatchObject({ location_id: "lo2", indirizzo: "Viale Europa 5", telefono: "06 2222", citta: "ROMA", sede_occasionale: false });
    await p.smonta();
  });
});
