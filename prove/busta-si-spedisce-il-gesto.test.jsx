// IL GESTO DELLE QUATTRO TAPPE, col Riepilogo amministrativo montato per
// davvero. Due tasti, perché sono due storie della stessa busta:
//
//   a sinistra IL VIAGGIO   giallo «Spedisci busta» → arancione «Busta in
//                           viaggio» → verde chiaro «Ricevuta», che sta ferma
//   a destra   LA CASSA     navy «Deposita in cassa» → verde «In cassa»
//
// Quello che va inchiodato è cosa SCRIVE ogni passo, perché da quelle date
// dipendono tre cose diverse: la contabilità che si chiude (spedita), la
// busta che è arrivata in amministrazione (rientrata) e il contante che
// entra nel cassetto (depositata). E la busta che NON viaggia: «Deposita in
// cassa» premuto da subito chiude la contabilità e spegne il tasto giallo.
import { describe, it, expect } from "vitest";
import React from "react";
import { PannelloRiepilogoAmministrativo } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// jsdom non impagina e non ha ResizeObserver: il righello del Riepilogo
// Cash lo chiede al montaggio
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const VENDITA = { id: "v1", corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: "contanti", totale: 100, busta_numero: null, prodotti: [], data_ordine: "2026-11-02T10:00:00" };
// la vendita già dentro la prima busta: serve in tutti i casi di busta
// chiusa, o resterebbe senza numero e aprirebbe l'appendice
const DENTRO = [{ ...VENDITA, busta_numero: 1 }];

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
const tastiConTesto = (p, testo) => [...p.nodo.querySelectorAll("button")].filter((b) => b.textContent.trim() === testo);
const tastoConTesto = (p, testo) => tastiConTesto(p, testo)[0];

describe("il tasto del viaggio avanza di una tappa alla volta", () => {
  it("giallo: spedire chiude la contabilità e congela l'importo, senza mandare niente in cassa", async () => {
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
    // e in cassa non entra niente: nessuna delle altre due date si scrive
    expect(scritta[1].busta_rientrata_il).toBeUndefined();
    expect(scritta[1].busta_depositata_il).toBeUndefined();
    // le vendite di oggi prendono il numero 1, così quelle di domani
    // aprono l'appendice invece di sommarsi a una busta già partita
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === 1)).toBeTruthy();
    await p.smonta();
  });

  it("arancione: premerlo dice che è ARRIVATA, e i soldi non sono ancora in cassa", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_importo: 100 }, { vendite: DENTRO });
    expect(p.testo()).toContain("Busta in viaggio");
    expect(p.testo()).toMatch(/Partita il .*09\/11\/2026/);
    // mentre viaggia non si può depositare: il tasto di destra è spento
    expect(tastoConTesto(p, "Deposita in cassa").disabled).toBe(true);
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Busta in viaggio")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_rientrata_il);
    expect(scritta).toBeTruthy();
    // l'importo NON si ricalcola all'arrivo: si conferma quello che è
    // stato consegnato, non un numero cambiato mentre la busta viaggiava
    expect(scritta[1].busta_importo).toBeUndefined();
    // e l'arrivo non è il deposito: quella data la scrive l'altro tasto
    expect(scritta[1].busta_depositata_il).toBeUndefined();
    await p.smonta();
  });

  it("«Ricevuta» sta ferma, e accende «Deposita in cassa»", async () => {
    const { p } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_importo: 100 }, { vendite: DENTRO });
    const ricevuta = tastoConTesto(p, "Ricevuta");
    expect(ricevuta).toBeTruthy();
    expect(ricevuta.disabled).toBe(true);
    expect(p.testo()).toContain("da depositare in cassa");
    expect(tastoConTesto(p, "Deposita in cassa").disabled).toBe(false);
    await p.smonta();
  });
});

describe("il tasto della cassa", () => {
  it("da «ricevuta» scrive SOLO la data del deposito", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_importo: 100 }, { vendite: DENTRO });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Deposita in cassa")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_depositata_il);
    expect(scritta).toBeTruthy();
    expect(Object.keys(scritta[1])).toEqual(["busta_depositata_il"]);
    await p.smonta();
  });

  it("depositata: «In cassa» non si preme più", async () => {
    const { p } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_depositata_il: "2026-11-12", busta_importo: 100 }, { vendite: DENTRO });
    const inCassa = tastoConTesto(p, "In cassa");
    expect(inCassa).toBeTruthy();
    expect(inCassa.disabled).toBe(true);
    expect(p.testo()).toContain("entrati in cassa contanti");
    await p.smonta();
  });
});

describe("la busta che non viaggia: Stefano è già a Roma", () => {
  it("«Deposita in cassa» si preme anche con la busta sul tavolo, e chiude la contabilità", async () => {
    const { p, scritture } = await montaPannello({});
    const deposita = tastoConTesto(p, "Deposita in cassa");
    expect(deposita.disabled).toBe(false);
    window.confirm = () => true;
    await clicca(deposita); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_depositata_il);
    expect(scritta).toBeTruthy();
    // l'importo si congela qui, come alla spedizione
    expect(scritta[1].busta_importo).toBe(100);
    // ma la busta non è partita e non è arrivata da nessun posto: resta
    // scritto così, perché è quello che è successo
    expect(scritta[1].busta_spedita_il).toBeUndefined();
    expect(scritta[1].busta_rientrata_il).toBeUndefined();
    // e la contabilità si chiude lo stesso: le vendite prendono il numero 1
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === 1)).toBeTruthy();
    await p.smonta();
  });

  it("depositata senza spedirla, il tasto giallo si spegne", async () => {
    const { p } = await montaPannello({ busta_depositata_il: "2026-11-12", busta_importo: 100 }, { vendite: DENTRO });
    expect(tastoConTesto(p, "Spedisci busta").disabled).toBe(true);
    expect(tastoConTesto(p, "In cassa").disabled).toBe(true);
    expect(p.testo()).toContain("non è mai partita");
    await p.smonta();
  });

  it("e l'appendice si apre comunque: la contabilità è chiusa", async () => {
    const { p } = await montaPannello(
      { busta_depositata_il: "2026-11-12", busta_importo: 100 },
      { vendite: [{ ...VENDITA, busta_numero: 1 }, { ...VENDITA, id: "v2", totale: 40, busta_numero: null }] }
    );
    expect(p.testo()).toContain("Busta 2 — aperta");
    await p.smonta();
  });
});

describe("i passi indietro, per correggere un errore appena fatto", () => {
  it("«non è partita» la riapre e toglie il numero alle sue vendite", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_importo: 100 }, { vendite: DENTRO });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Non è partita, rimettila qui")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_spedita_il" in x[1]);
    expect(scritta[1].busta_spedita_il).toBe(null);
    expect(scritta[1].busta_depositata_il).toBe(null);
    expect(scritta[1].busta_importo).toBe(null);
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === null)).toBeTruthy();
    await p.smonta();
  });

  it("«non è ancora arrivata» la riporta in viaggio, non sul tavolo", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_importo: 100 }, { vendite: DENTRO });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Non è ancora arrivata")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_rientrata_il" in x[1]);
    expect(scritta[1].busta_rientrata_il).toBe(null);
    // la contabilità resta chiusa: la busta è ancora per strada
    expect("busta_spedita_il" in scritta[1]).toBe(false);
    await p.smonta();
  });

  it("«rimettila fuori dalla cassa» lascia la busta ricevuta", async () => {
    const { p, scritture } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_depositata_il: "2026-11-12", busta_importo: 100 }, { vendite: DENTRO });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Rimettila fuori dalla cassa")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_depositata_il" in x[1]);
    expect(scritta[1].busta_depositata_il).toBe(null);
    expect("busta_rientrata_il" in scritta[1]).toBe(false);
    await p.smonta();
  });

  it("ma su una busta mai partita rimetterla fuori riapre tutto: quel deposito era l'unica cosa che la chiudeva", async () => {
    const { p, scritture } = await montaPannello({ busta_depositata_il: "2026-11-12", busta_importo: 100 }, { vendite: DENTRO });
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Rimettila fuori dalla cassa")); await attendi(150);
    const scritta = scritture.find((x) => x[0] === "corsi_date" && "busta_depositata_il" in x[1]);
    expect(scritta[1].busta_depositata_il).toBe(null);
    expect(scritta[1].busta_spedita_il).toBe(null);
    expect(scritta[1].busta_importo).toBe(null);
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === null)).toBeTruthy();
    await p.smonta();
  });

  it("col contante già in cassa il viaggio non si corregge: prima si tira fuori", async () => {
    const { p, messaggi } = await montaPannello({ busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_depositata_il: "2026-11-12", busta_importo: 100 }, { vendite: DENTRO });
    // il passo indietro sul viaggio non c'è nemmeno, finché i soldi sono
    // nel cassetto: quello che si vede è solo quello della cassa
    expect(tastoConTesto(p, "Non è ancora arrivata")).toBeFalsy();
    expect(messaggi.length).toBe(0);
    await p.smonta();
  });
});

describe("non si chiude una busta con dentro dei soldi già promessi", () => {
  // la sede costa 30 € al giorno e si paga in contanti: 30 € che devono
  // USCIRE dalla busta e che nessuno ha ancora disposto
  const CONTANTI_PROMESSI = { pagamento_sede: "cash", costo_giorno_sede_cash: 30, data_inizio: "2026-11-02", data_fine: "2026-11-02" };
  it("spedire rifiuta e dice le due strade", async () => {
    const { p, scritture, messaggi } = await montaPannello(CONTANTI_PROMESSI);
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Spedisci busta")); await attendi(150);
    expect(scritture.find((x) => x[0] === "corsi_date")).toBeFalsy();
    expect(messaggi.join(" ")).toContain("Prima disponi i pagamenti");
    expect(messaggi.join(" ")).toContain("scadenziario passivo");
    // e il tasto è ancora quello giallo: la busta non è partita
    expect(tastoConTesto(p, "Spedisci busta")).toBeTruthy();
    await p.smonta();
  });
  it("e depositare direttamente rifiuta uguale: è la stessa chiusura", async () => {
    const { p, scritture, messaggi } = await montaPannello(CONTANTI_PROMESSI);
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Deposita in cassa")); await attendi(150);
    expect(scritture.find((x) => x[0] === "corsi_date")).toBeFalsy();
    expect(messaggi.join(" ")).toContain("Prima disponi i pagamenti");
    await p.smonta();
  });
});

describe("l'appendice si apre appena la busta è chiusa, non quando arriva", () => {
  it("busta in viaggio e una vendita nuova: compare la busta 2 con i suoi due tasti", async () => {
    const { p } = await montaPannello(
      { busta_spedita_il: "2026-11-09", busta_importo: 100 },
      { vendite: [{ ...VENDITA, busta_numero: 1 }, { ...VENDITA, id: "v2", totale: 40, busta_numero: null }] }
    );
    expect(p.testo()).toContain("Appendice vendite al corso");
    expect(p.testo()).toContain("Busta 2 — aperta");
    expect(tastoConTesto(p, "Spedisci busta 2")).toBeTruthy();
    // il suo tasto della cassa è il secondo della pagina: il primo è
    // quello della prima busta, spento perché sta viaggiando
    const depositi = tastiConTesto(p, "Deposita in cassa");
    expect(depositi.length).toBe(2);
    expect(depositi[0].disabled).toBe(true);
    expect(depositi[1].disabled).toBe(false);
    await p.smonta();
  });

  it("spedire la busta 2 scrive la sua riga senza data di deposito", async () => {
    const { p, scritture } = await montaPannello(
      { busta_spedita_il: "2026-11-09", busta_importo: 100 },
      { vendite: [{ ...VENDITA, busta_numero: 1 }, { ...VENDITA, id: "v2", totale: 40, busta_numero: null }] }
    );
    window.confirm = () => true;
    await clicca(tastoConTesto(p, "Spedisci busta 2")); await attendi(150);
    const riga = scritture.find((x) => x[0] === "corsi_date_buste" && x[1].numero === 2);
    expect(riga).toBeTruthy();
    expect(riga[1].spedita_il).toBeTruthy();
    expect(riga[1].depositata_il).toBe(null);
    expect(riga[1].importo).toBe(40);
    await p.smonta();
  });

  it("e depositarla direttamente scrive la riga senza data di spedizione", async () => {
    const { p, scritture } = await montaPannello(
      { busta_depositata_il: "2026-11-12", busta_importo: 100 },
      { vendite: [{ ...VENDITA, busta_numero: 1 }, { ...VENDITA, id: "v2", totale: 40, busta_numero: null }] }
    );
    window.confirm = () => true;
    const depositi = tastiConTesto(p, "Deposita in cassa");
    await clicca(depositi[depositi.length - 1]); await attendi(150);
    const riga = scritture.find((x) => x[0] === "corsi_date_buste" && x[1].numero === 2);
    expect(riga).toBeTruthy();
    expect(riga[1].depositata_il).toBeTruthy();
    expect(riga[1].spedita_il).toBe(null);
    await p.smonta();
  });
});
