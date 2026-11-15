// LE FASI DI UN CORSO SONO UNA LINEA (15/11/2026).
//
// Il titolare, con un mockup: «in spedizioni corsi ridisegna le celle
// dei corsi con questa grafica e con questo criterio. Come vedi i
// pulsanti rossi esistono solo per le fasi ancora da fare, poi
// diventano cerchietti verdi».
//
// Erano quattro pastiglie affiancate, tutte colorate e tutte della
// stessa misura: per sapere a che punto fosse un corso bisognava
// leggerle tutte. Qui si prova il criterio, non il disegno: chi e'
// verde, chi e' rosso, chi non e' ne' l'uno ne' l'altro, e che cosa
// risponde al dito.
import { describe, it, expect } from "vitest";
import React from "react";
import { RigaCorsoLogistica } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

const CORSO_DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-10", data_fine: "2099-01-11" };
const CORSO = { id: "c1", nome: "PMU BASE", colore: "#123456" };
const MILANO = { id: "l1", nome: "MILANO", sede_centrale: false };
const SEDE = { id: "l2", nome: "ROMA", sede_centrale: true };
const ISCRITTI = [{ id: "a1", pacchetto_kit: "PMU Pro" }, { id: "a2", pacchetto_kit: "PMU Pro" }];

const comuni = {
  corsoData: CORSO_DATA, corso: CORSO, iscrittiEdizione: ISCRITTI, selezionato: false,
  onSeleziona: () => {}, onCambiaFase: () => {}, onTornaIndietroFase: () => {},
  onToggleGestioneRientro: () => {}, onCambiaFaseRientro: () => {}, onTornaIndietroFaseRientro: () => {},
  onAllestisci: () => {}, onPrepara: () => {}, onApriInventarioSede: () => {}, onAnnullaInventario: () => {},
};
const stati = (nodo) => [...nodo.querySelectorAll("[data-tappa-fase]")].map((t) => t.getAttribute("data-tappa-fase"));

describe("la linea delle fasi di una spedizione", () => {
  it("le fatte sono verdi, una sola è rossa, le altre restano grigie", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="ritirato_corriere" />);
    // due fasi superate, quella corrente, e l'ultima ancora di là da venire
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "corrente", "futuro"]);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    expect(tappe[0].textContent).toContain("Pacco preparato");
    expect(tappe[2].textContent).toContain("Pacco da ritirare");
    await p.smonta();
  });

  it("un corso appena nato ha UNA rossa, non tre", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    const s = stati(p.nodo);
    expect(s.filter((x) => x === "corrente").length).toBe(1);
    expect(s).toEqual(["corrente", "futuro", "futuro", "futuro"]);
    await p.smonta();
  });

  it("tutte fatte: nessuna rossa", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="completato" />);
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "fatto", "fatto"]);
    await p.smonta();
  });

  it("si preme la rossa e si avanza; una futura non fa niente", async () => {
    const avanzamenti = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" onCambiaFase={(f) => avanzamenti.push(f)} />);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    await clicca(tappe[2]);
    expect(avanzamenti).toEqual([]);
    await clicca(tappe[0]);
    expect(avanzamenti).toEqual(["bolla_stampata"]);
    await p.smonta();
  });

  it("«Indietro» torna di una fase, e sul corso appena nato non c'è", async () => {
    const indietro = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata" onTornaIndietroFase={(f) => indietro.push(f)} />);
    await clicca(p.nodo.querySelector("[data-indietro-fase]"));
    expect(indietro).toEqual(["da_preparare"]);
    await p.smonta();

    const q = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    expect(q.nodo.querySelector("[data-indietro-fase]")).toBeFalsy();
    await q.smonta();
  });

  // 15/11/2026, corretto dal titolare: «hai spostato la freccetta
  // indietro sotto la linea dello stato mentre prima doveva stare alla
  // destra dei cerchietti». Sotto, in mezzo alle etichette, sembrava
  // l'etichetta di una quinta tappa.
  it("«Indietro» sta nella riga dei cerchietti, non sotto", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata" />);
    const riga = p.nodo.querySelector("[data-tappa-fase]").parentElement;
    expect(p.nodo.querySelector("[data-indietro-fase]").parentElement).toBe(riga);
    await p.smonta();
  });

  // «ci sono testi ora troppo piccoli e vanno aumentati di 2 punti e le
  // righe di testo troppo lunghe messe a capo su due righe»: il tetto
  // di larghezza e' quello che manda a capo, e senza di lui una tappa
  // dal nome lungo si allarga e storce la linea.
  it("l'etichetta è 13 e non si allarga oltre il suo spazio", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="completato" />);
    const etichetta = [...p.nodo.querySelectorAll("[data-tappa-fase] span")]
      .find((x) => (x.textContent || "").includes("Pacco ritirato dal corriere"));
    expect(etichetta.style.fontSize).toBe("13px");
    expect(etichetta.style.maxWidth).toBe("112px");
    await p.smonta();
  });

  it("la freccia della testata apre il corso, e non è il passo indietro", async () => {
    let aperto = 0;
    const indietro = [];
    const p = await monta(
      <RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata"
        onSeleziona={() => { aperto += 1; }} onTornaIndietroFase={(f) => indietro.push(f)} />
    );
    await clicca(p.nodo.querySelector("[data-apri-corso]"));
    expect(aperto).toBe(1);
    expect(indietro).toEqual([]);
    await p.smonta();
  });
});

describe("la linea di un corso in sede centrale", () => {
  it("tre tappe, e la prima da fare è quella rossa", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare" preparatoTs="2099-01-01T10:00:00Z" />);
    expect(stati(p.nodo)).toEqual(["fatto", "corrente", "futuro"]);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    expect(tappe[0].textContent).toContain("Materiale preparato");
    expect(tappe[1].textContent).toContain("Materiale da consegnare");
    await p.smonta();
  });

  it("consegnato, si legge «Cosa torna in magazzino»", async () => {
    const p = await monta(
      <RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare"
        preparatoTs="2099-01-01T10:00:00Z" allestitoTs="2099-01-02T10:00:00Z" />
    );
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "corrente"]);
    expect(p.tasto("Cosa torna in magazzino")).toBeTruthy();
    await p.smonta();
  });

  it("mentre il magazzino si muove la linea sparisce e lo dice", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare" inLavorazione avanzamento={{ fatti: 3, totale: 9 }} />);
    expect(stati(p.nodo)).toEqual([]);
    expect(p.nodo.textContent).toContain("Magazzino in movimento: 3 di 9 prodotti");
    await p.smonta();
  });
});
