// IL GESTO DELLE TRE TAPPE, col Riepilogo amministrativo montato per
// davvero: un tasto solo che cambia faccia e avanza.
//
//   giallo    «Spedisci busta»        chiude la contabilità e la manda via
//   arancione «Busta in viaggio»      si preme quando arriva
//   verde     «Ricevuta e in cassa»   non si preme più
//
// Quello che va inchiodato è cosa SCRIVE ogni passo, perché da quelle due
// date dipendono due cose diverse: la contabilità che si chiude (spedita) e
// il contante che entra nel cassetto (rientrata).
import { describe, it, expect } from "vitest";
import React from "react";
import { PannelloRiepilogoAmministrativo } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// jsdom non impagina e non ha ResizeObserver: il righello del Riepilogo
// Cash lo chiede al montaggio
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const VENDITA = { id: "v1", corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: "contanti", totale: 100, busta_numero: null, prodotti: [], data_ordine: "2026-11-02T10:00:00" };

async function montaPannello(cd, extra = {}) {
  const scritture = [];
  // il pannello non disegna i messaggi, li consegna a chi lo monta
  const messaggi = [];
  rispondiCon({
    "rest/v1/corsi_date_buste": (corpo) => { if (corpo) scritture.push(["corsi_date_buste", corpo]); return extra.buste || []; },
    "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(["corsi_date", corpo]); return []; },
    "rest/v1/vendite_shop": (corpo) => { if (corpo) scritture.push(["vendite_shop", corpo]); return []; },
    "rest/v1/spese": (corpo) => { if (corpo) scritture.push(["spese", corpo]); return []; },
  });
  const p = await monta(
    <PannelloRiepilogoAmministrativo
      corsoData={{ id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-11-01", data_fine: "2026-11-02", ...cd }}
      iscritti={[]} spese={[]} venditeShop={extra.vendite || [VENDITA]} prodottiShop={[]}
      corsi={[{ id: "co1", nome: "PMU" }]} corsiDateDocenti={[]} master={[]} masterCorsi={[]}
      assistente={[]} assistenteCorsi={[]} leva={[]} location={[{ id: "lo1", nome: "ROMA" }]} hotel={[]}
      costiCategorie={[]} costiSottocategorie={[]} quoteVenditoriSplit={[]} ricarica={async () => {}}
      onMessaggio={(m) => messaggi.push(m)}
    />
  );
  await attendi(200);
  return { p, scritture, messaggi };
}
const tastoConTesto = (p, testo) => [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === testo);

describe("il tasto avanza di una tappa alla volta", () => {
  it("giallo: spedire chiude la contabilità e congela l'importo", async () => {
    const { p, scritture } = await montaPannello({});
    const tasto = tastoConTesto(p, "Spedisci busta");
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(false);
    window.confirm = () => true;
    await clicca(tasto); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_spedita_il);
    expect(scritta).toBeTruthy();
    // l'importo si congela alla PARTENZA: è lì che qualcuno ha contato le
    // banconote e ha chiuso la busta
    expect(scritta[1].busta_importo).toBe(100);
    // e non entra in cassa: quella data non si scrive adesso
    expect(scritta[1].busta_rientrata_il).toBeUndefined();
    // le vendite di oggi prendono il numero 1, così quelle di domani
    // aprono l'appendice invece di sommarsi a una busta già partita
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === 1)).toBeTruthy();
    await p.smonta();
  });

  it("arancione: in viaggio si legge la data di partenza, e premerlo manda i soldi in cassa", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_importo: 100 }, { vendite: [{ ...VENDITA, busta_numero: 1 }] });
    expect(p.testo()).toContain("Busta in viaggio");
    expect(p.testo()).toMatch(/Partita il .*09\/11\/2026/);
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Busta in viaggio")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_rientrata_il);
    expect(scritta).toBeTruthy();
    // l'importo NON si ricalcola all'arrivo: si conferma quello che è
    // stato consegnato, non un numero cambiato mentre la busta viaggiava
    expect(scritta[1].busta_importo).toBeUndefined();
    await p.smonta();
  });

  it("verde: arrivata, il tasto non si preme più", async () => {
    const { p } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_importo: 100 }, { vendite: [{ ...VENDITA, busta_numero: 1 }] });
    const tasto = tastoConTesto(p, "Ricevuta e in cassa");
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(true);
    await p.smonta();
  });
});

describe("i due passi indietro, per correggere un errore appena fatto", () => {
  it("«non è partita» la riapre e toglie il numero alle sue vendite", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_importo: 100 }, { vendite: [{ ...VENDITA, busta_numero: 1 }] });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Non è partita, rimettila qui")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_spedita_il" in x[1]);
    expect(scritta[1].busta_spedita_il).toBe(null);
    expect(scritta[1].busta_importo).toBe(null);
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === null)).toBeTruthy();
    await p.smonta();
  });

  it("«rimettila fuori dalla cassa» la riporta in viaggio, non sul tavolo", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_importo: 100 }, { vendite: [{ ...VENDITA, busta_numero: 1 }] });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Rimettila fuori dalla cassa")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_rientrata_il" in x[1]);
    expect(scritta[1].busta_rientrata_il).toBe(null);
    // la contabilità resta chiusa: la busta è ancora per strada
    expect("busta_spedita_il" in scritta[1]).toBe(false);
    await p.smonta();
  });
});

describe("non si spedisce una busta con dentro dei soldi già promessi", () => {
  it("con dei pagamenti ancora da disporre il tasto rifiuta e dice cosa fare", async () => {
    // la sede costa 30 € al giorno e si paga in contanti: 30 € che devono
    // USCIRE dalla busta e che nessuno ha ancora disposto
    const { p, scritture, messaggi } = await montaPannello({ pagamento_sede: "cash", costo_giorno_sede_cash: 30, data_inizio: "2026-11-02", data_fine: "2026-11-02" });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Spedisci busta")); await attendi(150);
    expect(scritture.find((x) => x[0] === "corsi_date")).toBeFalsy();
    expect(messaggi.join(" ")).toContain("Prima disponi i pagamenti");
    expect(messaggi.join(" ")).toContain("scadenziario passivo");
    // e il tasto è ancora quello giallo: la busta non è partita
    expect(tastoConTesto(p, "Spedisci busta")).toBeTruthy();
    await p.smonta();
  });
});

describe("l'appendice si apre appena la busta parte, non quando arriva", () => {
  it("busta in viaggio e una vendita nuova: compare la busta 2 col suo tasto", async () => {
    const { p } = await montaPannello(
      { busta_spedita_il: "2026-11-09", busta_importo: 100 },
      { vendite: [{ ...VENDITA, busta_numero: 1 }, { ...VENDITA, id: "v2", totale: 40, busta_numero: null }] }
    );
    expect(p.testo()).toContain("Appendice vendite al corso");
    expect(p.testo()).toContain("Busta 2 — aperta");
    expect(tastoConTesto(p, "Spedisci busta 2")).toBeTruthy();
    await p.smonta();
  });
});
