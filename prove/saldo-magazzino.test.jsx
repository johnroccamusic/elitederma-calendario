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
import { PannelloScostamenti, PannelloScartiShop } from "../src/App.jsx";

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

// LO SCARTO COL SITO: un allarme diverso, e va tenuto diverso.
//
// Nel pannello dei saldi il magazzino contraddice la propria storia:
// qualcuno ha scritto un numero da fuori, ed e' un guasto. Qui sono due
// database che dicono cose diverse — succede, e la domanda non e' chi ha
// sbagliato ma di quanto, e da che parte.
describe("il pannello dello scarto col sito", () => {
  it("quando i due numeri coincidono non si disegna", async () => {
    rispondiCon({});
    const p = await monta(<PannelloScartiShop scarti={[]} prodottiPerId={PRODOTTI} />);
    expect(p.testo().trim()).toBe("");
    await p.smonta();
  });

  it("avverte quando e' il SITO ad averne di piu': e' il verso che fa male", async () => {
    rispondiCon({});
    const p = await monta(
      <PannelloScartiShop
        prodottiPerId={PRODOTTI}
        scarti={[{ prodotto_id: "p-1", qui: 2, sul_sito: 40, differenza: 38 }]}
      />,
    );
    // il sito continua a vendere roba che qui non c'e'
    expect(p.testo()).toContain("il sito crede di averne di più");
    expect(p.testo()).toContain("+38");
    await p.smonta();
  });

  it("e lo dice in modo diverso quando il sito ne ha di meno", async () => {
    rispondiCon({});
    const p = await monta(
      <PannelloScartiShop
        prodottiPerId={PRODOTTI}
        scarti={[{ prodotto_id: "p-1", qui: 40, sul_sito: 2, differenza: -38 }]}
      />,
    );
    expect(p.testo()).toContain("sta vendendo meno");
    expect(p.testo()).not.toContain("crede di averne di più");
    await p.smonta();
  });

  it("con molti prodotti non srotola una lista infinita", async () => {
    rispondiCon({});
    const tanti = Array.from({ length: 20 }, (_, i) => ({
      prodotto_id: `p-${i}`, qui: 1, sul_sito: 2, differenza: 1,
    }));
    const p = await monta(<PannelloScartiShop scarti={tanti} prodottiPerId={{}} />);
    expect(p.testo()).toContain("SU 20 PRODOTTI");
    expect(p.testo()).toContain("e altri 8");
    await p.smonta();
  });
});
