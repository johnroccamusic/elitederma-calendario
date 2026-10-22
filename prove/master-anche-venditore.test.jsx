// LA MASTER CHE VENDE È UN FLAG SULLA MASTER, non una seconda riga.
//
// Fino al 22/10/2026 una master che faceva anche il venditore stava in
// due liste, con due password e due elenchi di permessi, e un pezzo di
// codice ricopiava la password dall'una all'altra. Da oggi in Password
// Master si accende «è anche venditore»: entra con la sua password, coi
// suoi permessi, e compare fra i venditori — tendina, Dashboard
// venditori, commissioni — senza una riga in Gestione venditori.
//
// Qui si fa il giro per intero montando l'app vera: si scrive la
// password della master, si preme Entra, e si guarda dove si finisce e
// chi c'è negli elenchi.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, scrivi, clicca, attendi } from "./aiuto.js";

const FLAGGATA = { id: "m-flag", nome: "GIULIA PROVA", password: "giulia123", permessi: ["pos", "dashboardmaster"], venditore_id: null, e_venditore: true, ts: 1 };
const SOLO_MASTER = { id: "m-solo", nome: "STELLA PROVA", password: "stella123", permessi: ["pos", "dashboardmaster"], venditore_id: null, e_venditore: false, ts: 2 };
// flaggata MA con gia' una riga venditori con lo stesso nome: deve
// restare quella riga, una volta sola
const DOPPIA = { id: "m-doppia", nome: "ELIA PROVA", password: "elia123", permessi: ["pos", "dashboardmaster"], venditore_id: null, e_venditore: true, ts: 3 };
const VENDITORE_ELIA = { id: "v-elia", nome: "ELIA PROVA", password: "elia-vend", permessi: ["dashboardvenditori"], ts: 4 };
const MARIO = { id: "v-mario", nome: "MARIO", password: "mario123", permessi: ["dashboardvenditori", "prezzicorsi", "normative"], ts: 5 };
const ADMIN = { id: "u-admin", nome: "Amministratore", password: "admin123", permessi: ["dashboardvenditori", "dashboardmaster"], chiave_sistema: "__admin" };

async function entraCon(password) {
  window.history.replaceState({}, "", "/");
  try { window.sessionStorage.clear(); } catch { /* navigazione privata */ }
  rispondiCon({
    "/venditori?": [VENDITORE_ELIA, MARIO],
    "/master?": [FLAGGATA, SOLO_MASTER, DOPPIA],
    // LA FINTA RISPETTA IL FILTRO. Dopo il login l'app rilegge
    // `utenti_app` per l'id di chi e' entrato, e una master non ci sta:
    // deve tornare vuoto. Rispondere sempre [ADMIN] regalava a Stella i
    // permessi dell'amministratore, e la prova diceva che una master
    // senza flag aveva la Dashboard venditori — colpa del banco, non
    // dell'app.
    "/utenti_app?": (_corpo, url) => (String(url).includes("id=eq.") && !String(url).includes(`id=eq.${ADMIN.id}`) ? [] : [ADMIN]),
    "/assistente?": [],
  });
  const p = await monta(<App />);
  await scrivi(p.nodo.querySelector('input[type="password"]'), password);
  await clicca(p.tasto("Entra"));
  await attendi(400);
  return p;
}

const vociTendina = (p) => [...p.nodo.querySelectorAll("select option")].map((o) => o.textContent.trim());
// le tessere della home: i tasti col loro nome, non il testo della pagina
const tessere = (p) => [...p.nodo.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
const haTessera = (p, nome) => tessere(p).some((t) => t.startsWith(nome));

describe("la master che vende", () => {
  it("entra con la SUA password e ha la Dashboard venditori", async () => {
    const p = await entraCon(FLAGGATA.password);
    expect(haTessera(p, "Dashboard venditori")).toBe(true);
    expect(haTessera(p, "Dashboard master")).toBe(true);
    await p.smonta();
  });

  it("e la dashboard si apre bloccata su di lei, senza selettore", async () => {
    const p = await entraCon(FLAGGATA.password);
    const tessera = [...p.nodo.querySelectorAll("button")].find((b) => /Dashboard venditori/.test(b.textContent || ""));
    await clicca(tessera); await attendi(300);
    expect(p.testo()).toMatch(/Dashboard Giulia Prova/);
    expect(p.testo()).not.toMatch(/scegli venditore/);
    await p.smonta();
  });

  it("una master senza il flag NON ha la Dashboard venditori", async () => {
    const p = await entraCon(SOLO_MASTER.password);
    expect(haTessera(p, "Dashboard master")).toBe(true);
    expect(haTessera(p, "Dashboard venditori")).toBe(false);
    await p.smonta();
  });
});

describe("l'elenco dei venditori che l'app usa", () => {
  async function selettoreVenditori() {
    const p = await entraCon(ADMIN.password);
    const tessera = [...p.nodo.querySelectorAll("button")].find((b) => /Dashboard venditori/.test(b.textContent || ""));
    await clicca(tessera); await attendi(300);
    const voci = vociTendina(p);
    await p.smonta();
    return voci;
  }

  it("contiene la master flaggata accanto ai venditori veri", async () => {
    const voci = await selettoreVenditori();
    expect(voci).toContain("MARIO");
    expect(voci).toContain("GIULIA PROVA");
  });

  it("non contiene la master senza flag", async () => {
    const voci = await selettoreVenditori();
    expect(voci).not.toContain("STELLA PROVA");
  });

  // niente doppioni: chi ha gia' una riga in venditori resta quella
  // riga, che e' la sua storia
  it("chi sta già in venditori compare una volta sola", async () => {
    const voci = await selettoreVenditori();
    expect(voci.filter((v) => v === "ELIA PROVA")).toHaveLength(1);
  });
});
