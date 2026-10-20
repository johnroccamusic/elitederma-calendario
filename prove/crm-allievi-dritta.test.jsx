// CRM ALLIEVI STA DRITTA.
//
// Col telefono in verticale la pagina veniva disegnata RUOTATA di 90
// gradi, per costringere a girare il telefono e far stare la tabella
// larga. Ma chi apre una pagina e la trova di traverso pensa che si sia
// rotta qualcosa — e il resto dell'app, dove di tabelle larghe ce ne
// sono tante, non fa niente di simile: le fa scorrere di lato.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { PaginaCrmAllievi } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta } from "./aiuto.js";

const ISCRITTI = [
  { id: "i1", nome: "ANNA", cognome: "VERDI", telefono: "3331112222", email: "anna@x.it",
    corso_data_id: "cd1", totale_pattuito: 1200, ts: "2026-05-01T10:00:00Z" },
];
const CORSI = [{ id: "co1", nome: "PMU BASE" }];
const CLASSI = [{ id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-05-01", data_fine: "2026-05-05" }];
const LOCATION = [{ id: "lo1", nome: "ROMA" }];

beforeEach(() => {
  // telefono in verticale: e' la condizione in cui si coricava
  window.innerWidth = 390;
  window.innerHeight = 844;
});

async function apri() {
  rispondiCon({});
  return monta(
    <PaginaCrmAllievi iscritti={ISCRITTI} allieviCrm={[]} corsi={CORSI} corsiDate={CLASSI} location={LOCATION}
      ricarica={() => {}} onBack={() => {}} onApriStoricoAllievi={() => {}} onCoricata={() => {}} />,
  );
}

describe("CRM allievi", () => {
  it("non ruota più niente di 90 gradi", async () => {
    const p = await apri();
    const girati = [...p.nodo.querySelectorAll("*")]
      .filter((n) => (n.style?.transform || "").includes("rotate(90deg)"));
    expect(girati).toEqual([]);
  });

  it("e al dock dice di stare dritto", async () => {
    let coricato = null;
    rispondiCon({});
    await monta(
      <PaginaCrmAllievi iscritti={ISCRITTI} allieviCrm={[]} corsi={CORSI} corsiDate={CLASSI} location={LOCATION}
        ricarica={() => {}} onBack={() => {}} onApriStoricoAllievi={() => {}} onCoricata={(v) => { coricato = v; }} />,
    );
    expect(coricato).toBe(false);
  });

  it("la tabella si legge lo stesso: scorre di lato", async () => {
    const p = await apri();
    const scorrevoli = [...p.nodo.querySelectorAll("div")]
      .filter((n) => n.style?.overflowX === "auto");
    expect(scorrevoli.length).toBeGreaterThan(0);
    expect(p.testo()).toContain("Verdi");
  });
});
