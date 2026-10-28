// La dashboard sfogliata da un'assistente arriva ai punti con l'id
// «ass:<id>»: non si chiede niente alla vista (era un 400 a ogni
// apertura, 28/10/2026) e si mostrano gli zeri.
import { describe, it, expect } from "vitest";
import React from "react";
import { usePuntiMaster, useCarrelliPuntiMaster } from "../src/punti/RiquadriPuntiMaster.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

function Sonda({ id }) {
  const d = usePuntiMaster(id); const c = useCarrelliPuntiMaster(id, true);
  return <div data-campo="sonda">{d ? `punti:${d.punti_totali}` : "nulla"}|{c ? `carrelli:${c.length}` : "nulla"}</div>;
}

describe("punti di un'assistente", () => {
  it("con «ass:» non parte nessuna richiesta e i riquadri dicono zero", async () => {
    const richieste = [];
    rispondiCon({ "v_punti_master": (c, url) => { richieste.push(url); return []; } });
    const p = await monta(<Sonda id="ass:807f0125-a1e7-4e1d-b6d0-beedc2fcaa20" />);
    await attendi(100);
    expect(richieste.length).toBe(0);
    expect(p.testo()).toBe("punti:0|carrelli:0");
    await p.smonta();
  });
});
