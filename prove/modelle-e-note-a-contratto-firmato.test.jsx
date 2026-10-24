// MODELLE E NOTE SI CAMBIANO ANCHE A CONTRATTO FIRMATO, e la firma si
// ricomincia (24/10/2026). L'allieva firma senza modelle e due giorni
// dopo le vuole: il venditore cambia quelle quattro cose da solo, e il
// contratto si riapre e si rispedisce per la nuova firma.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { SchedaData } from "../src/App.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MARIO = { id: "v1", nome: "MARIO", permessi: ["dashboardvenditori"] };
const CORSO = { id: "c1", nome: "LAMINAZIONE BASE", posti_max: 10 };
const SEDE = { id: "l1", nome: "SEDE ROMA", citta: "ROMA" };
const CD = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2026-11-14", data_fine: "2026-11-14" };
const FIRMATA = {
  id: "i1", nome: "LIA", cognome: "PATANIA", corso_data_id: "cd1", tutor: "MARIO", stato: "confermato",
  modulo_inviato_il: "2026-10-20T10:00:00Z", modulo_ricevuto_il: "2026-10-21T10:00:00Z", acconto_pagato: true,
  richiede_modelle: false, note: null, email: "lia@esempio.it",
};

function banco(iscritto) {
  const scritture = []; const rpc = [];
  rispondiCon({
    "rpc/modulo_riapri": (corpo) => { rpc.push(corpo); return { ok: true }; },
    "iscritti": (corpo, url) => { if (corpo) scritture.push({ url, corpo }); return [{ id: "i1", modulo_ricevuto_il: corpo?.note !== undefined ? iscritto.modulo_ricevuto_il : null }]; },
  });
  window.prompt = () => "Vuole le modelle";
  return { scritture, rpc };
}
async function apri(iscritto) {
  const p = await monta(
    <SchedaData
      ruoloUtente="user" venditoreLoggato={MARIO} chiOpera="MARIO"
      corsoData={CD} corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]}
      iscritti={[iscritto]} master={[]} utentiApp={[]} masterCorsi={[]} corsiDateDocenti={[]}
      quoteVenditoriSplit={[]} locationPrezzi={[]} assistente={[]} assistenteCorsi={[]}
      leva={[]} hotel={[]} layoutIscrizioni={null} fontDiplomi={[]} segnaposti={[]}
      costiCategorie={[]} costiSottocategorie={[]} spese={[]} impegni={[]}
      corsiGiorni={[]} tipiModella={[]} corsiTipiModella={[]} venditori={[MARIO]}
      kitDefinizioni={[]} prodottiShop={[]} venditeShop={[]} accontiDaVerificare={[]}
      ricarica={vi.fn(async () => {})} onBack={() => {}} codiceAmministratoreAttuale="ED26"
      sottoVistaIniziale={{ vista: "form", modificandoId: "i1", mostraGestione: false }}
      onCambiaSottoVista={() => {}}
    />
  );
  await attendi(120);
  return p;
}

describe("contratto già firmato", () => {
  it("nella fotografia del venditore modelle e note restano aperte, e salvarle riapre il modulo", async () => {
    const { scritture, rpc } = banco(FIRMATA);
    const p = await apri(FIRMATA);
    // il venditore vede la fotografia dell'iscrizione, non la scheda
    expect(p.testo()).toContain("Riepilogo all'iscrizione");
    const riquadro = p.nodo.querySelector('[data-campo="modelle-note-sbloccate"]');
    expect(riquadro, "il riquadro modelle e note").toBeTruthy();
    await scrivi(riquadro.querySelector('[data-campo="note-sbloccate"]'), "vuole due modelle");
    await clicca(p.tasto("Salva modelle e note")); await attendi(150);
    const patch = scritture.find((s) => s.url.includes("iscritti?id=eq.i1"));
    expect(patch).toBeTruthy();
    expect(Object.keys(patch.corpo).sort()).toEqual(["note", "numero_modelle", "prezzo_speciale_modelle", "richiede_modelle"]);
    expect(patch.corpo.note).toBe("VUOLE DUE MODELLE");
    // confermato (window.confirm vale true nel banco): il modulo si riapre e la scheda si apre in modifica
    expect(rpc).toHaveLength(1);
    expect(rpc[0].p_iscritto_id).toBe("i1");
    expect(rpc[0].p_chi).toBe("MARIO");
    expect(p.tasto("Leggi dati dal modulo"), "la scheda aperta").toBeTruthy();
    await p.smonta();
  });

  it("in cima c'è «Ricomincia procedura di firma»: riapre e apre la scheda in modifica, tutta", async () => {
    const { rpc } = banco(FIRMATA);
    const p = await apri(FIRMATA);
    const tasto = p.tasto("Ricomincia procedura di firma");
    expect(tasto, "il tasto in cima").toBeTruthy();
    // sta prima del riepilogo dei dati, non in fondo
    const testo = p.testo();
    expect(testo.indexOf("Ricomincia procedura di firma")).toBeLessThan(testo.indexOf("Dati dell'allievo"));
    await clicca(tasto); await attendi(150);
    expect(rpc).toHaveLength(1);
    expect(rpc[0].p_motivo).toBe("Vuole le modelle");
    // la fotografia si chiude e la scheda si apre in modifica: i dati in alto si possono rifare
    expect(p.tasto("Leggi dati dal modulo"), "la scheda aperta").toBeTruthy();
    expect(p.campi().some((c) => c.value === "LIA")).toBe(true);
    await p.smonta();
  });

  it("senza modulo ricevuto il tasto non c'è, e il venditore apre la scheda vera", async () => {
    const aperta = { ...FIRMATA, stato: "modulo_inviato", modulo_ricevuto_il: null, acconto_pagato: false };
    banco(aperta);
    const p = await apri(aperta);
    expect(p.tasto("Ricomincia procedura di firma")).toBeUndefined();

    expect(p.tasto("Leggi dati dal modulo"), "la scheda aperta").toBeTruthy();
    await p.smonta();
  });
});
