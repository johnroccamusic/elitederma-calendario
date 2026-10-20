// CHI PUO' INCASSARE COME.
//
// Il terminale fisico sta in amministrazione: una master non ce l'ha, e
// la scelta «POS esterno» le offriva una strada che non puo' percorrere
// — e che per di piu' non chiede conferma a nessuno, perche' la vendita
// la si dichiara incassata a mano.
//
// Qui si monta il banco vero con due cappelli diversi e si guarda cosa
// c'e' scritto: e' una regola di permessi, e le regole di permessi si
// rompono in silenzio.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta } from "./aiuto.js";

const oggi = new Date().toISOString().slice(0, 10);
const CORSO = { id: "co1", nome: "PMU BASE" };
const CORSO_DATA = {
  id: "cd1", corso_id: "co1", location_id: null, master_id: null,
  data_inizio: oggi, data_fine: oggi, citta: "ROMA",
};

// due codici: uno generico e attivo, uno di una master. In tendina deve
// finire solo il primo — quello della master non e' di tutti.
const COUPON = [
  { id: "cp1", codice: "need30", valore: "30.00", tipo_sconto: "percent", ambito: "categorie",
    stato: "attivo", master_id: null, corsi_date_id: null, categorie_ids: [64] },
  { id: "cp2", codice: "TG997U", valore: "20.00", tipo_sconto: "percent", ambito: "tutto",
    stato: "attivo", master_id: "m1", corsi_date_id: null },
  { id: "cp3", codice: "e10", valore: "10.00", tipo_sconto: "percent", ambito: "tutto",
    stato: "bozza", master_id: null, corsi_date_id: null },
];

async function apriBanco(ruoloUtente) {
  rispondiCon({});
  return monta(
    <PaginaPOS
      prodottiShop={[]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[CORSO_DATA]} corsi={[CORSO]} location={[]}
      iscritti={[]} coupon={COUPON} bundleComponenti={[]} master={[]}
      ricarica={() => {}} onBack={() => {}} utenteLoggato={null} venditoreLoggato={null}
      targetVenditeProdotti={[]} ruoloUtente={ruoloUtente}
    />,
  );
}

describe("il POS esterno e' solo dell'amministrazione", () => {
  it("al banco di una master non compare", async () => {
    const p = await apriBanco("user");
    expect(p.testo()).not.toContain("POS esterno");
    expect(p.testo()).not.toContain("Batti tu sul terminale");
    // e nemmeno il titolo della scelta: un tasto solo non e' una scelta
    expect(p.testo()).not.toContain("Tipo di incasso carta");
  });

  it("al banco dell'amministrazione resta", async () => {
    const p = await apriBanco("amministratore");
    expect(p.testo()).toContain("POS esterno");
    expect(p.testo()).toContain("Tipo di incasso carta");
  });

  it("alla master la carta e' il QR, e si vede subito", async () => {
    // senza la scelta, il banco deve nascere gia' sul QR: nascere
    // sull'«esterno» nascosto vorrebbe dire una schermata che non offre
    // nessun modo di incassare
    const p = await apriBanco("user");
    expect(p.testo()).toContain("Mostra il QR");
    expect(p.testo()).toContain("Apri link sul tuo telefono per pagare");
  });

  it("il tasto del link chiede prima se serve fattura", async () => {
    // a carrello vuoto il tasto e' spento, e la domanda non e' ancora
    // comparsa: il patto e' quello — prima la fattura, poi il pagamento.
    // Si guarda dal banco di una master perche' li' la carta nasce gia'
    // sul QR; in amministrazione il banco nasce sul terminale.
    const p = await apriBanco("user");
    expect(p.testo()).not.toContain("Il cliente ha bisogno di fattura?");
    const tasto = p.tasto("Apri link sul tuo telefono per pagare");
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(true);
  });

  it("il link non si copia piu' di nascosto: si apre", async () => {
    const p = await apriBanco("user");
    expect(p.testo()).not.toContain("Copia il link");
  });

  it("chi amministra ha dove scrivere il codice sconto", async () => {
    // il campo del codice stava SOLO nel ramo di chi non puo' scontare a
    // mano: chi amministra vedeva «Sconto vendita», «%» e «Coupon (%)» —
    // tre percentuali — e nessun posto dove battere `need30`. Per
    // applicarlo bisognava sapere a memoria che fa 24,59% sul lordo.
    const p = await apriBanco("amministratore");
    expect(p.testo()).toContain("Codice sconto extra");
  });

  it("e anche chi non amministra ce l'ha, come prima", async () => {
    const p = await apriBanco("user");
    expect(p.testo()).toContain("Codice sconto extra");
  });

  it("i codici generici si scelgono da una tendina, non si sanno a memoria", async () => {
    const p = await apriBanco("amministratore");
    const tendina = [...p.nodo.querySelectorAll("select")]
      .find((x) => [...x.options].some((o) => o.value === "need30"));
    expect(tendina).toBeTruthy();
    const voci = [...tendina.options].map((o) => o.textContent);
    // il codice porta con se' quanto sconta e che non vale su tutto
    expect(voci.join(" ")).toContain("NEED30 · −30%");
    expect(voci.join(" ")).toContain("solo su certi prodotti");
    // il codice di una master non e' di tutti, e una bozza non e' nata
    expect(voci.join(" ")).not.toContain("TG997U");
    expect(voci.join(" ")).not.toContain("E10");
  });
});
