// IL GIRO DI TUTTE LE SEZIONI, ruolo per ruolo.
//
// Monta l'app vera con una sessione addosso, guarda quali tessere
// compaiono sulla home per quei permessi, le apre una per una e
// controlla di essere finito in una pagina vera: non vuota, non ferma
// sulla scritta di attesa, e con il tasto per tornare a casa.
//
// I PROFILI SONO QUELLI VERI, letti dall'archivio il 22/10/2026: non
// combinazioni inventate, ma le persone che entrano davvero — chi
// amministra, chi vende, le master, le assistenti, il profilo kiosk.
// Un permesso in meno disegna una home diversa, e una pagina che si
// apre per chi amministra può non aprirsi per chi vende.
//
// Perché serve: in questo progetto una pagina non si rompe in
// compilazione, si rompe al montaggio. Senza questo giro, l'unico modo
// di sapere che una sezione non si apre è che qualcuno ci entri.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";

const TUTTI = ["gestionedate","dashboardvenditori","dashboardmaster","erp","magazzinoshop","pos",
  "logisticaprodotti","compensipremi","generazioneloghi","gestionemodelle","statistiche",
  "crmallievi","storicoallievi","impostazioni","prezzicorsi","normative","progettiincorso",
  "gestionieventi","assegnazionekit","qrconsensi","stampepackaging","iscrizioneallievi","agenda"];

function seduta(ruolo, permessi) {
  window.sessionStorage.clear();
  window.sessionStorage.setItem("edc_ok", "1");
  window.sessionStorage.setItem("edc_ruolo", ruolo);
  window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "PROVA", permessi, chiave_sistema: null }));
}

async function apri() {
  window.history.replaceState({}, "", "/");
  globalThis.fetch = vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
  window.fetch = globalThis.fetch;
  window.prompt = () => "";
  window.confirm = () => false;
  window.alert = () => {};
  const p = await monta(<App />);
  await attendi(250);
  return p;
}

const nome = (b) => (b.textContent || "").trim().split("\n")[0].slice(0, 42);
// il testo della pagina senza il blocco di stile e senza la barra in
// alto, che sono uguali ovunque e nascondono dove si e' finiti
const dove = (p) => {
  const n = p.nodo.cloneNode(true);
  n.querySelectorAll("style").forEach((x) => x.remove());
  return (n.textContent || "").replace(/\s+/g, " ").trim();
};

async function giro(ruolo, permessi) {
  seduta(ruolo, permessi);
  const p = await apri();
  const guasti = [];
  const visitate = [];
  const quante = [...p.nodo.querySelectorAll("button")].length;

  for (let i = 0; i < quante; i++) {
    // la home si ridisegna a ogni ritorno: si ripesca il tasto per indice
    const tasti = [...p.nodo.querySelectorAll("button")];
    const t = tasti[i];
    if (!t) continue;
    const etichetta = nome(t);
    if (!etichetta || /^(Esci|Stile|Vista telefono|Home|Carrelli|Impostazioni)$/.test(etichetta)) continue;
    // il tondo dell'assistente dei regolamenti sta su ogni pagina e apre
    // un pannello, non una sezione: non e' una tessera da visitare
    if (t.getAttribute("data-campo") === "assistente-regole") continue;
    try {
      await clicca(t);
      await attendi(220);
      const testo = dove(p);
      const tornaACasa = [...p.nodo.querySelectorAll("button")].some((b) => /^Home$/.test(nome(b)));
      if (testo.length < 60) guasti.push(`${etichetta} → PAGINA VUOTA`);
      else if (/Un momento…|Caricamento…/.test(testo)) guasti.push(`${etichetta} → RESTA IN ATTESA`);
      else if (!tornaACasa) guasti.push(`${etichetta} → NON SI APRE (si resta dov'era)`);
      else visitate.push(`${etichetta.padEnd(44)} → ${testo.slice(0, 90)}`);
    } catch (e) {
      guasti.push(`${etichetta} → ESPLODE: ${String(e.message).slice(0, 120)}`);
    }
    // torna a casa
    try {
      const casa = [...p.nodo.querySelectorAll("button")].find((b) => /^Home$/.test(nome(b)));
      if (casa) { await clicca(casa); await attendi(180); }
    } catch { /* si riparte comunque */ }
  }
  return { guasti, visitate };
}

// I PERMESSI VERI, letti dall'archivio il 22/10/2026: ogni riga è
// qualcuno che entra davvero. `+` = quello che il Gate aggiunge da sé
// (un venditore ottiene sempre "dashboardvenditori").
const RUOLI = [
  ["programmatore",            "programmatore",  TUTTI],
  ["amministrazione piena",    "amministratore", ["gestionedate","dashboardvenditori","dashboardmaster","erp","logisticaprodotti","generazioneloghi","gestionemodelle","impostazioni","magazzinoshop","statistiche","crmallievi","storicoallievi","pos","prezzicorsi","normative","progettiincorso","gestionieventi"]],
  ["Raffaele (admin ridotto)", "amministratore", ["logisticaprodotti","magazzinoshop","pos","normative","progettiincorso","prezzicorsi","gestionieventi"]],
  ["master base",              "user",           ["pos","prezzicorsi","normative","dashboardmaster"]],
  ["master che vende",         "user",           ["pos","prezzicorsi","normative","dashboardmaster","dashboardvenditori"]],
  ["master con eventi",        "user",           ["gestionemodelle","dashboardvenditori","pos","prezzicorsi","normative","dashboardmaster","gestionieventi","progettiincorso"]],
  ["assistente",               "user",           ["dashboardmaster","sch_cambi","sch_inventario","sch_consensi","sch_modelle","sch_dettaglicorso","normative","prezzicorsi","pos"]],
  ["venditore",                "user",           ["dashboardvenditori","prezzicorsi","normative"]],
  ["venditore minimo",         "user",           ["prezzicorsi","normative","dashboardvenditori"]],
  ["utente generico",          "user",           ["dashboardvenditori","logisticaprodotti","normative"]],
  ["Ruh (solo calendario)",    "user",           ["gestionedate","progettiincorso","prezzicorsi"]],
];

// STAMPE PACKAGING È CHIUSA A CHI NON AMMINISTRA (22/10/2026). Dentro
// ci sono i file per la tipografia, i materiali, i formati e i
// fornitori: roba di acquisto, non di aula. Era `attivo: true`, cioè
// visibile a chiunque fosse entrato — anche a un account senza un solo
// permesso.
describe("Stampe packaging", () => {
  const tessere = async (ruolo, permessi) => {
    const { visitate } = await giro(ruolo, permessi);
    return visitate.join(" | ");
  };

  it("la vede chi può entrare in Amministrazione", async () => {
    expect(await tessere("amministratore", ["erp", "normative"])).toMatch(/Stampe packaging/);
    expect(await tessere("programmatore", ["normative"])).toMatch(/Stampe packaging/);
    // e anche chi ha il permesso `erp` senza esserlo di grado — è il
    // caso di una master che amministra
    expect(await tessere("user", ["erp", "pos", "normative"])).toMatch(/Stampe packaging/);
  }, 180000);

  it("non la vede chi vende, né una master, né l'utente generico", async () => {
    expect(await tessere("user", ["dashboardvenditori", "prezzicorsi", "normative"])).not.toMatch(/Stampe packaging/);
    expect(await tessere("user", ["pos", "prezzicorsi", "normative", "dashboardmaster"])).not.toMatch(/Stampe packaging/);
    expect(await tessere("user", ["dashboardvenditori", "logisticaprodotti", "normative"])).not.toMatch(/Stampe packaging/);
  }, 180000);
});

describe("il giro di tutte le sezioni", () => {
  for (const [chi, ruolo, permessi] of RUOLI) {
    it(`${chi}: ogni tessera che vede si apre`, async () => {
      const { guasti, visitate } = await giro(ruolo, permessi);
      // il messaggio dice QUALE tessera e cosa è successo: un "atteso 0,
      // ricevuto 3" manderebbe a cercare a mano
      expect(guasti.join("\n")).toBe("");
      // e se la home non mostrasse più niente, il giro passerebbe per
      // il motivo sbagliato
      expect(visitate.length).toBeGreaterThan(1);
    }, 180000);
  }
});
