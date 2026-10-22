// SENZA PACCHETTO VUOL DIRE SENZA PACCHETTO.
//
// Fino al 22/10/2026 in questo elenco finiva anche chi il pacchetto ce
// l'aveva, se al pacchetto mancava il modello di diploma: il titolo
// diceva «senza pacchetto», la scheda mostrava il pacchetto, e si
// salvava tre volte cercando l'errore nel posto sbagliato. Il diploma si
// carica prima del corso: non è un motivo per stare qui.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaAssegnazioneKit } from "../src/App.jsx";
import { monta } from "./aiuto.js";

const CORSO = { id: "c1", nome: "LAMIN IND SOPRA+IKE" };
const SEDE = { id: "l1", nome: "NAPOLI" };
const DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-30", data_fine: "2099-01-30" };
const KIT_SENZA_DIPLOMA = { id: "k1", corso_id: "c1", nome: "Kit Individuale Soprac. + ike", diploma_path: null };
const KIT_CON_DIPLOMA = { id: "k2", corso_id: "c1", nome: "Kit Base", diploma_path: "diplomi/base.pdf" };

const pagina = (iscritti, kit = [KIT_SENZA_DIPLOMA, KIT_CON_DIPLOMA]) => monta(
  <PaginaAssegnazioneKit iscritti={iscritti} corsiDate={[DATA]} corsi={[CORSO]} location={[SEDE]}
    kitDefinizioni={kit} onApriIscritto={() => {}} ricarica={() => {}} onBack={() => {}} />
);

describe("chi sta in Assegnazione kit", () => {
  it("chi ha il pacchetto non c'è, anche se al pacchetto manca il diploma", async () => {
    const p = await pagina([{ id: "i1", nome: "GAETANA", cognome: "DICASOLA", corso_data_id: "cd1", kit_id: "k1", pacchetto_kit: "Kit Individuale Soprac. + ike" }]);
    expect(p.testo()).not.toMatch(/DICASOLA/);
    expect(p.testo()).toMatch(/Tutti gli allievi hanno un pacchetto/);
    expect(p.testo()).not.toMatch(/non ha un diploma/);
  });

  it("chi non ha nessun pacchetto c'è", async () => {
    const p = await pagina([{ id: "i2", nome: "ANNA", cognome: "PROVA", corso_data_id: "cd1", kit_id: null, pacchetto_kit: null }]);
    expect(p.testo()).toMatch(/1 allievi senza pacchetto/);
    expect(p.testo()).toMatch(/ANNA/);
    expect(p.testo()).toMatch(/nessun pacchetto/);
  });

  // il nome scritto ma non collegato resta un caso vero: il diploma legge
  // il collegamento, non il nome — e ora si collega anche senza diploma
  it("il pacchetto scritto ma non collegato c'è, e si può collegare anche senza diploma", async () => {
    const p = await pagina([{ id: "i3", nome: "LIA", cognome: "PROVA", corso_data_id: "cd1", kit_id: null, pacchetto_kit: "Kit Individuale Soprac. + ike" }]);
    expect(p.testo()).toMatch(/LIA/);
    expect(p.testo()).toMatch(/scritto ma non collegato/);
    expect(p.tasto("Collega tutti")).toBeTruthy();
  });

  it("i pacchetti proposti sono quelli del corso, non solo quelli col diploma", async () => {
    const p = await pagina([{ id: "i2", nome: "ANNA", cognome: "PROVA", corso_data_id: "cd1", kit_id: null }]);
    expect(p.testo()).toMatch(/Pacchetti del corso: Kit Base · Kit Individuale Soprac\. \+ ike/);
  });
});
