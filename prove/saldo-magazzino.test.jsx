// IL PANNELLO DEI CONTI CHE NON TORNANO.
//
// Dice una cosa sola, e deve dirla bene: la giacenza di quel prodotto
// non coincide con la somma dei suoi movimenti, quindi qualcuno l'ha
// scritta senza passare dall'app. Non e' "sotto scorta" e non e'
// "esaurito": quelli sono fatti normali del magazzino, questo e' il
// magazzino che contraddice la sua storia.
import { describe, it, expect } from "vitest";
import React from "react";
import { rispondiCon } from "./preparazione.js";
import { monta } from "./aiuto.js";
import { PannelloScostamenti } from "../src/App.jsx";

const PRODOTTI = {
  "p-1": { id: "p-1", nome: "Telini politenati monouso 50 pz" },
  "p-2": { id: "p-2", nome: "Squeezer" },
};

describe("il pannello dei conti che non tornano", () => {
  it("quando i conti tornano non si disegna affatto", async () => {
    rispondiCon({});
    const p = await monta(<PannelloScostamenti scostamenti={[]} prodottiPerId={PRODOTTI} />);
    // un riquadro che dice "tutto a posto" tutti i giorni diventa
    // invisibile esattamente il giorno in cui servirebbe
    expect(p.testo().trim()).toBe("");
    await p.smonta();
  });

  it("dice il nome, i due numeri e di quanto ballano", async () => {
    rispondiCon({});
    const p = await monta(
      <PannelloScostamenti
        prodottiPerId={PRODOTTI}
        scostamenti={[
          { prodotto_id: "p-1", atteso: 12, trovato: 5, differenza: -7, dal: "2026-10-19T05:15:00.000Z" },
        ]}
      />,
    );
    const t = p.testo();
    expect(t).toContain("Telini politenati monouso 50 pz");
    expect(t).toContain("registro 12");
    expect(t).toContain("magazzino 5");
    expect(t).toContain("-7");
    await p.smonta();
  });

  it("un prodotto cancellato non fa sparire la segnalazione", async () => {
    rispondiCon({});
    const p = await monta(
      <PannelloScostamenti
        prodottiPerId={{}}
        scostamenti={[{ prodotto_id: "p-ignoto", atteso: 3, trovato: 9, differenza: 6, dal: "2026-10-19T05:15:00.000Z" }]}
      />,
    );
    // il nome non c'e' piu', ma lo scarto si': nasconderlo vorrebbe dire
    // perdere proprio il caso in cui qualcosa e' stato toccato da fuori
    expect(p.testo()).toContain("prodotto non trovato");
    expect(p.testo()).toContain("+6");
    await p.smonta();
  });

  it("conta i prodotti al plurale e al singolare", async () => {
    rispondiCon({});
    const uno = await monta(<PannelloScostamenti prodottiPerId={PRODOTTI}
      scostamenti={[{ prodotto_id: "p-1", atteso: 1, trovato: 2, differenza: 1, dal: "2026-10-19T05:15:00.000Z" }]} />);
    expect(uno.testo()).toContain("SU 1 PRODOTTO");
    await uno.smonta();
    const due = await monta(<PannelloScostamenti prodottiPerId={PRODOTTI}
      scostamenti={[
        { prodotto_id: "p-1", atteso: 1, trovato: 2, differenza: 1, dal: "2026-10-19T05:15:00.000Z" },
        { prodotto_id: "p-2", atteso: 4, trovato: 1, differenza: -3, dal: "2026-10-19T05:15:00.000Z" },
      ]} />);
    expect(due.testo()).toContain("SU 2 PRODOTTI");
    await due.smonta();
  });
});
