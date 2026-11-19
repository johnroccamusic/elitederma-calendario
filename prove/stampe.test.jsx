// «STAMPE» (3/11/2026), chiesta dal titolare per Raffaele: l'elenco dei
// corsi in ordine cronologico, e accanto a ogni nome due tasti — stampa
// diplomi e stampa nomi. Nient'altro: non si entra nelle classi, non si
// modifica, non si cancella, non c'è il calendario.
//
// Quello che queste prove difendono è soprattutto ciò che NON deve
// esserci: una pagina pensata per fare una cosa sola, se lascia aperta
// una porta, la porta la trova qualcuno.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi } from "./aiuto.js";

const OGGI = new Date();
const fraGiorni = (n) => {
  const d = new Date(OGGI);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const CORSI = [
  { id: "c1", nome: "PMU BASE", colore: "#0E1B33", posti_max: 8 },
  { id: "c2", nome: "LAMINAZIONE BASE", colore: "#C9A26D", posti_max: 8 },
];
const LOCATION = [
  { id: "l1", nome: "BARI", citta: "BARI" },
  { id: "l2", nome: "MILANO", citta: "MILANO" },
];
// due classi future: la seconda parte dopo, quindi in ordine cronologico
// viene dopo anche se la città viene prima in alfabeto
const CORSI_DATE = [
  { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: fraGiorni(10), data_fine: fraGiorni(12), posti_max: 8, master_id: null },
  { id: "cd2", corso_id: "c2", location_id: "l2", data_inizio: fraGiorni(30), data_fine: fraGiorni(31), posti_max: 8, master_id: null },
];
// un'iscritta senza pacchetto: il diploma non si può stampare, e il
// motivo va detto
const ISCRITTI = [
  { id: "i1", corso_data_id: "cd1", nome: "MARIA", cognome: "ROSSI", stato: "confermato", kit_id: null, pacchetto_kit: "" },
];

// i permessi veri di Raffaele, piu' «stampe»
const RAFFAELE = ["logisticaprodotti", "magazzinoshop", "pos", "normative", "progettiincorso", "prezzicorsi", "gestionieventi", "registrazioneclienti", "stampe"];

function seduta(permessi, ruolo = "amministratore") {
  window.sessionStorage.clear();
  window.sessionStorage.setItem("edc_ok", "1");
  window.sessionStorage.setItem("edc_ruolo", ruolo);
  window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "Raffaele Villanno", permessi, chiave_sistema: null }));
}

function preparaDati() {
  rispondiCon({
    corsi_date: CORSI_DATE,
    corsi: CORSI,
    location: LOCATION,
    iscritti: ISCRITTI,
  });
}

async function apri(permessi = RAFFAELE) {
  seduta(permessi);
  preparaDati();
  window.history.replaceState({}, "", "/");
  const p = await monta(<App />);
  await attendi(300);
  return p;
}

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");
// la tessera si cerca per nome ESATTO: «Stampe» è contenuto anche in
// «Stampe packaging», e cercando per sottostringa si finisce nell'area
// della tipografia senza accorgersene
const tessera = (p, nome) => [...p.nodo.querySelectorAll("button")]
  .find((b) => {
    const t = (b.textContent || "").trim();
    // il titolo della tessera e la sua descrizione finiscono attaccati in
    // textContent: si cerca chi COMINCIA col nome, escludendo le tessere
    // il cui titolo e' piu' lungo («Stampe packaging»)
    return t.startsWith(nome) && !t.slice(nome.length).match(/^[a-z ]*[a-z]{3}/i);
  });

describe("Stampe", () => {
  it("la tessera c'è per chi ha il permesso, e dentro ci sono i corsi coi due tasti", async () => {
    const p = await apri();
    const t0 = tessera(p, "Stampe");
    expect(t0).toBeTruthy();
    await clicca(t0);
    await attendi(300);

    const t = pulito(p);
    expect(t).toContain("Pmu Base");
    expect(t).toContain("Laminazione Base");
    // due tasti per ogni riga
    expect(p.nodo.querySelectorAll('[data-campo="stampa-diplomi"]').length).toBe(2);
    expect(p.nodo.querySelectorAll('[data-campo="stampa-nomi"]').length).toBe(2);
    expect(t).toContain("Diplomi");
    expect(t).toContain("Nomi");
    await p.smonta();
  });

  it("non c'è niente per entrare, modificare o cancellare, e nemmeno il calendario", async () => {
    const p = await apri();
    await clicca(tessera(p, "Stampe"));
    await attendi(300);
    const t = pulito(p);
    // i tasti di Gestione corsi non ci sono
    expect(t).not.toContain("Aggiungi corso");
    expect(t).not.toContain("Ultime iscrizioni");
    expect(t).not.toContain("Prossime contabilità");
    expect(t).not.toContain("Verifica acconti");
    // niente matita né cestino sulle righe
    expect(p.nodo.querySelector('[title="Modifica"]')).toBeFalsy();
    expect(p.nodo.querySelector('[title="Elimina"]')).toBeFalsy();
    // la pillola del calendario non c'è: solo l'elenco
    expect([...p.nodo.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Calendario")).toBe(false);
    await p.smonta();
  });

  it("premendo il nome del corso non si entra nella classe", async () => {
    const p = await apri();
    await clicca(tessera(p, "Stampe"));
    await attendi(300);
    const riga = [...p.nodo.querySelectorAll("div")].find((d) => (d.textContent || "").includes("Pmu Base") && d.children.length > 0 && !d.textContent.includes("Laminazione"));
    await clicca(riga);
    await attendi(250);
    // si resta nell'elenco: la scheda della classe aprirebbe «Iscrivi»
    const t = pulito(p);
    expect(t).toContain("Diplomi");
    expect(t).not.toContain("Iscrivi");
    expect(t).not.toContain("Contabilità classe");
    await p.smonta();
  });

  it("i filtri e la ricerca sono quelli di Gestione corsi", async () => {
    const p = await apri();
    await clicca(tessera(p, "Stampe"));
    await attendi(300);
    const t = pulito(p);
    // gli stessi tre filtri di Gestione corsi, con le stesse parole
    expect(t).toContain("Filtra corso");
    expect(t).toContain("Filtra città");
    expect(t).toContain("Filtra master");
    // e la stessa ricerca
    expect([...p.nodo.querySelectorAll("input")].some((i) => /Cerca allievo, corso, sede o master/i.test(i.placeholder || ""))).toBe(true);
    // le due tab restano: i diplomi si stampano a corso finito, quindi
    // «Passati» è la tab che serve di più
    expect(t).toContain("Programmati");
    expect(t).toContain("Passati");
    await p.smonta();
  });

  it("stampa diplomi dice perché non esce un diploma, invece di non fare niente", async () => {
    const detti = [];
    window.alert = (t) => detti.push(String(t));
    const p = await apri();
    await clicca(tessera(p, "Stampe"));
    await attendi(300);
    // la prima riga in ordine cronologico è PMU BASE, con Maria Rossi
    // senza pacchetto
    const tasti = [...p.nodo.querySelectorAll('[data-campo="stampa-diplomi"]')];
    await clicca(tasti[0]);
    await attendi(250);
    const detto = detti.join("\n");
    expect(detto).toContain("Nessun diploma da stampare");
    expect(detto).toContain("MARIA ROSSI");
    expect(detto).toContain("non ha nessun pacchetto");
    // e dice a chi rivolgersi, perché da qui non si può sistemare
    expect(detto).toContain("chi amministra");
    await p.smonta();
  });

  it("su una classe vuota lo dice e non genera niente", async () => {
    const detti = [];
    window.alert = (t) => detti.push(String(t));
    const p = await apri();
    await clicca(tessera(p, "Stampe"));
    await attendi(300);
    const tasti = [...p.nodo.querySelectorAll('[data-campo="stampa-nomi"]')];
    // la seconda classe (LAMINAZIONE) non ha iscritti
    await clicca(tasti[1]);
    await attendi(250);
    expect(detti.join("\n")).toMatch(/Non ci sono iscritti|foglio segnaposti/);
    await p.smonta();
  });

  it("senza il permesso la tessera non c'è, nemmeno per chi amministra", async () => {
    const p = await apri(RAFFAELE.filter((x) => x !== "stampe"));
    expect(tessera(p, "Stampe")).toBeFalsy();
    await p.smonta();
  });
});
