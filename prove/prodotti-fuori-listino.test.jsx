// UN PRODOTTO CHE NON SI VENDE PIÙ SI TOGLIE DAL LISTINO, NON SI CANCELLA.
// 19/11/2026.
//
// Il titolare, davanti all'«Ago 5 Magnum Universale 0.35 Cheyenne»: «quell'ago
// non lo vendiamo più». E poi: «non ho una funzione per spegnere i prodotti
// senza cancellarli … in modo che non vengano più elencati nei listini ma
// magari siano validi ancora per le statistiche di vendita».
//
// Il cestino non era una strada: in Gestione magazzino esiste SOLO per i
// prodotti mai venduti, perché una scheda cancellata spezza le vendite che la
// citano. Il flag `prodotti_shop.attivo` invece c'era già e faceva esattamente
// quel lavoro — verificato sulle viste e non sui commenti:
//
//   v_prezzi_listini        WHERE p.attivo IS NOT FALSE  → esce dai listini
//   analisi_vendite_righe   `attivo` è una COLONNA        → le vendite restano
//
// Mancavano il gesto e la pagina. Il gesto sta nella tendina «Disponibilità»
// della scheda, come quarta voce accanto a Pubblicato/Privato/Bozza (scelta
// del titolare: «aggiungere "Fuori listino" e il prodotto finisce nella
// cartella storico prodotti fuori listino»).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { campiFuoriListino, PaginaProdottiFuoriListino } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi } from "./aiuto.js";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

const ADESSO = new Date("2026-11-19T10:00:00.000Z");

describe("cosa si scrive quando un prodotto esce o rientra", () => {
  it("uscendo scrive lo spegnimento con la data e chi l'ha tolto", () => {
    const c = campiFuoriListino({ fuoriListino: true, eraFuoriListino: false }, "GianLuca Rocca", ADESSO);
    expect(c.attivo).toBe(false);
    expect(c.fuori_listino_il).toBe("2026-11-19T10:00:00.000Z");
    expect(c.fuori_listino_da).toBe("GianLuca Rocca");
  });

  it("su un prodotto GIÀ fuori listino la data non si riscrive", () => {
    // riaprire la scheda per correggere una descrizione non deve far
    // dire allo storico «uscito oggi» su un prodotto uscito mesi fa
    const c = campiFuoriListino({ fuoriListino: true, eraFuoriListino: true }, "Chi Che Sia", ADESSO);
    expect(c.attivo).toBe(false);
    expect(c).not.toHaveProperty("fuori_listino_il");
    expect(c).not.toHaveProperty("fuori_listino_da");
  });

  it("rientrando riaccende E azzera la data, in tutti e due i versi", () => {
    const c = campiFuoriListino({ fuoriListino: false, eraFuoriListino: true }, "X", ADESSO);
    expect(c).toEqual({ attivo: true, fuori_listino_il: null, fuori_listino_da: null });
  });

  it("un prodotto normale salvato resta acceso: `attivo` si scrive sempre", () => {
    // scrivendolo solo quando si spegne, un prodotto rimesso in listino
    // resterebbe spento per sempre senza che nessuno capisca perché
    expect(campiFuoriListino({ fuoriListino: false, eraFuoriListino: false }).attivo).toBe(true);
  });

  it("senza operatore scrive null, non «undefined»", () => {
    expect(campiFuoriListino({ fuoriListino: true }, null, ADESSO).fuori_listino_da).toBeNull();
  });
});

// LA TENDINA. Il quarto valore non è uno stato di WooCommerce: è `attivo`.
// Questa guardia c'è perché i primi tre arrivano dal sito e il quarto no —
// il giorno che qualcuno "ripulisce" la tendina riallineandola a Woo, la
// funzione sparisce e non se ne accorge nessuno.
describe("la tendina Disponibilità", () => {
  it("offre anche «Fuori listino», accanto ai tre stati del sito", () => {
    expect(SORGENTE).toContain('<option value="fuori_listino">Fuori listino</option>');
    expect(SORGENTE).toContain('<option value="publish">Pubblicato</option>');
  });

  it("sul sito un prodotto fuori listino va in privato, come fa il riallineamento notturno", () => {
    // `woo-riallinea-shop` scrive `private` sui prodotti spenti: mandare
    // «draft» di qua vorrebbe dire due verdetti che si rimbalzano ogni notte
    expect(SORGENTE).toContain('stato: f.fuoriListino ? "private" : f.stato');
  });
});

// LA PAGINA, premuta per davvero.
const PRODOTTI = [
  { id: "p-ago", nome: "Ago 5 Magnum Universale 0.35 Cheyenne", attivo: false, fuori_listino_il: "2026-11-19T09:30:00.000Z", fuori_listino_da: "GianLuca Rocca" },
  { id: "p-vecchio", nome: "Kit henne business", attivo: false, fuori_listino_il: null, fuori_listino_da: null },
  { id: "p-vivo", nome: "Arizona", attivo: true, fuori_listino_il: null, fuori_listino_da: null },
];

describe("la pagina «Prodotti fuori listino»", () => {
  it("elenca solo quelli usciti, e non i prodotti in vendita", async () => {
    rispondiCon({});
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={PRODOTTI} ricarica={() => {}} onBack={() => {}} />);
    expect(p.nodo.querySelector('[data-fuori-listino="Ago 5 Magnum Universale 0.35 Cheyenne"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-fuori-listino="Kit henne business"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-fuori-listino="Arizona"]')).toBeFalsy();
    await p.smonta();
  });

  it("chi è uscito prima che questa pagina esistesse dice «data non nota»", async () => {
    // inventare un giorno sarebbe peggio che non averlo: è la regola
    // delle 16.327 richieste del CRM nate il giorno del caricamento
    rispondiCon({});
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={PRODOTTI} ricarica={() => {}} onBack={() => {}} />);
    expect(p.testo()).toContain("data non nota");
    expect(p.testo()).toContain("GianLuca Rocca");
    await p.smonta();
  });

  it("«Rimetti in listino» riaccende e azzera le date, su QUEL prodotto", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let scritto = null;
    let indirizzo = "";
    rispondiCon({
      "/rest/v1/prodotti_shop": (corpo, url) => { scritto = corpo; indirizzo = url; return [{ id: "p-ago" }]; },
    });
    const ricaricate = [];
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={PRODOTTI} ricarica={(t) => ricaricate.push(t)} onBack={() => {}} />);
    const riga = p.nodo.querySelector('[data-fuori-listino="Ago 5 Magnum Universale 0.35 Cheyenne"]');
    await clicca([...riga.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Rimetti")));
    await attendi(80);
    expect(scritto).toEqual({ attivo: true, fuori_listino_il: null, fuori_listino_da: null });
    expect(indirizzo).toContain("p-ago");
    expect(ricaricate.flat()).toContain("prodotti_shop");
    window.confirm.mockRestore();
    await p.smonta();
  });

  it("col «no» alla domanda non scrive niente", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    let scritto = false;
    rispondiCon({ "/rest/v1/prodotti_shop": () => { scritto = true; return []; } });
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={PRODOTTI} ricarica={() => {}} onBack={() => {}} />);
    const riga = p.nodo.querySelector('[data-fuori-listino="Ago 5 Magnum Universale 0.35 Cheyenne"]');
    await clicca([...riga.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Rimetti")));
    await attendi(80);
    expect(scritto).toBe(false);
    window.confirm.mockRestore();
    await p.smonta();
  });

  it("a zero righe cambiate lo dice, invece di far finta", async () => {
    // un update che non tocca niente risponde «va bene» (regola del 9/11)
    vi.spyOn(window, "confirm").mockReturnValue(true);
    rispondiCon({ "/rest/v1/prodotti_shop": () => [] });
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={PRODOTTI} ricarica={() => {}} onBack={() => {}} />);
    const riga = p.nodo.querySelector('[data-fuori-listino="Kit henne business"]');
    await clicca([...riga.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Rimetti")));
    await attendi(80);
    expect(p.nodo.querySelector("[data-msg-fuori-listino]")?.textContent || "").toContain("nessuna riga");
    window.confirm.mockRestore();
    await p.smonta();
  });

  it("senza nessun prodotto uscito lo dice, invece di mostrare una pagina vuota", async () => {
    rispondiCon({});
    const p = await monta(<PaginaProdottiFuoriListino prodottiShop={[PRODOTTI[2]]} ricarica={() => {}} onBack={() => {}} />);
    expect(p.nodo.querySelector("[data-nessun-fuori-listino]")).toBeTruthy();
    await p.smonta();
  });
});

// E SI GUARDANO ANCHE DA GESTIONE MAGAZZINO (19/11/2026, subito dopo: «vorrei
// vederlo in questa pagina ma non lo trovo»). La tessera stava un livello
// sopra, nel pannello Magazzino/Shop; chi cerca un prodotto che «non c'è più»
// lo cerca invece nella tabella del magazzino.
//
// Queste sono guardie sul sorgente, e lo dicono: il filtro vive dentro una
// pagina che nessuna prova monta: quello che si può inchiodare è che la
// pastiglia esista e che i segnalatori NON contino i ritirati.
describe("il filtro «Fuori listino» in Gestione magazzino", () => {
  it("la pastiglia c'è, accanto agli altri filtri rapidi", () => {
    expect(SORGENTE).toContain('{ v: "fuorilistino", l: "Fuori listino" }');
  });

  it("acceso, la tabella cambia SORGENTE invece di restringere quella di sempre", () => {
    // i ritirati non stanno nell'elenco normale: mostrarli insieme agli
    // altri vorrebbe dire rimetterli in catalogo
    expect(SORGENTE).toContain('let prodottiVisti = filtroRapido === "fuorilistino" ? fuoriListino : inListino;');
  });

  it("i segnalatori in cima contano solo i prodotti in listino", () => {
    // un prodotto che non si vende più non è «sotto scorta» né «fermo da
    // 90 giorni»: è fermo apposta. Se questi quattro tornassero a leggere
    // `prodottiConStato` — che adesso comprende i ritirati — i numeri in
    // cima alla pagina salirebbero senza che nessuno abbia comprato o
    // smesso di comprare niente.
    for (const riga of [
      "const sottoScorta = inListino.filter((p) => p.sottoScorta);",
      "const senzaCosto = inListino.filter((p) => p.conta_magazzino !== false && p.costo_acquisto == null);",
      "const kitSenzaCosto = inListino.filter((p) => p.isBundle && p.costo_acquisto == null);",
      "const fermi = inListino.filter((p) => p.inVenditaReale && p.giorniFermo > 90);",
    ]) expect(SORGENTE).toContain(riga);
  });

  it("col filtro acceso la pagina dice che cosa si sta guardando", () => {
    // le righe hanno la stessa forma di sempre: senza la frase
    // sembrerebbero prodotti in vendita con lo stock a zero
    expect(SORGENTE).toContain("data-avviso-elenco-fuori-listino");
  });
});
