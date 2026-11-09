// I PRODOTTI DI UN KIT, DIVISI PER REPARTO E CON LA FOTO (9/11/2026).
//
// Il titolare: «quando creo un kit e inserisco i prodotti li devi
// dividere per categorie e assegnare l'immagine, la lista è una
// confusione sia per noi che per la logistica. Sia nella Dashboard di
// creazione che in logistica per la preparazione».
//
// La regola delicata è QUALE categoria: sui dati veri 47 prodotti dei
// kit su 174 stanno in più di una, e quasi sempre sono una radice più
// una sua figlia («Aghi» + «Aghi Universali»). Si raggruppa per la
// RADICE — il reparto, cioè lo scaffale — perché per la figlia i
// pigmenti si spaccherebbero in Eyebrows/Lips/Eyeliner e un prodotto che
// sta in quattro figlie insieme non avrebbe una risposta giusta.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaContenutoKit, repartoPerProdotto, raggruppaPerReparto, SENZA_REPARTO } from "../src/App.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// l'albero vero dello shop, in piccolo: due radici, due figlie
const CATEGORIE = [
  { id: "cat-aghi", nome: "Aghi", categoria_padre_id: null },
  { id: "cat-aghi-uni", nome: "Aghi Universali", categoria_padre_id: "cat-aghi" },
  { id: "cat-pig", nome: "TUTTI I PIGMENTI", categoria_padre_id: null },
  { id: "cat-brows", nome: "Eyebrows", categoria_padre_id: "cat-pig" },
  { id: "cat-acc", nome: "Accessori", categoria_padre_id: null },
];

describe("il reparto di un prodotto", () => {
  it("è la RADICE dell'albero, non la sottocategoria", () => {
    const m = repartoPerProdotto([{ prodotto_id: "p1", categoria_id: "cat-aghi-uni" }], CATEGORIE);
    expect(m.get("p1").nome).toBe("Aghi");
  });

  it("radice e figlia insieme danno lo stesso reparto, non due", () => {
    // è il caso normale in archivio: il prodotto è legato alla radice E
    // alla figlia. Se contassero come due, lo stesso ago comparirebbe
    // sotto due intestazioni diverse nella stessa lista
    const m = repartoPerProdotto([
      { prodotto_id: "p1", categoria_id: "cat-aghi" },
      { prodotto_id: "p1", categoria_id: "cat-aghi-uni" },
    ], CATEGORIE);
    expect(m.get("p1").nome).toBe("Aghi");
  });

  it("in più reparti vince il primo in ordine alfabetico, sempre lo stesso", () => {
    const righe = [
      { prodotto_id: "p1", categoria_id: "cat-pig" },
      { prodotto_id: "p1", categoria_id: "cat-acc" },
    ];
    expect(repartoPerProdotto(righe, CATEGORIE).get("p1").nome).toBe("Accessori");
    // e l'ordine in cui arrivano le righe non cambia la risposta: una
    // lista di raccolta che riordina le righe fa perdere il segno
    expect(repartoPerProdotto([...righe].reverse(), CATEGORIE).get("p1").nome).toBe("Accessori");
  });

  it("una categoria che si dichiara figlia di sé stessa non blocca la pagina", () => {
    const anello = [{ id: "c1", nome: "Anello", categoria_padre_id: "c1" }];
    expect(repartoPerProdotto([{ prodotto_id: "p1", categoria_id: "c1" }], anello).get("p1").nome).toBe("Anello");
  });

  it("senza categoria il prodotto non sparisce: va in fondo, nel suo gruppo", () => {
    const m = repartoPerProdotto([{ prodotto_id: "p1", categoria_id: "cat-pig" }], CATEGORIE);
    const gruppi = raggruppaPerReparto(
      [{ prodottoId: "p9" }, { prodottoId: "p1" }], m
    );
    expect(gruppi.map((g) => g.nome)).toEqual(["TUTTI I PIGMENTI", SENZA_REPARTO]);
  });

  it("i reparti sono in ordine alfabetico", () => {
    const m = repartoPerProdotto([
      { prodotto_id: "p1", categoria_id: "cat-pig" },
      { prodotto_id: "p2", categoria_id: "cat-aghi" },
    ], CATEGORIE);
    const gruppi = raggruppaPerReparto([{ prodottoId: "p1" }, { prodottoId: "p2" }], m);
    expect(gruppi.map((g) => g.nome)).toEqual(["Aghi", "TUTTI I PIGMENTI"]);
  });
});

// ---------------------------------------------------------------------
// e la pagina vera: si apre un pacchetto e si guarda cosa si legge
const CORSI = [{ id: "c1", nome: "PMU BASE" }];
const KIT = [{ id: "k1", nome: "KIT BASE", corso_id: "c1", ordine: 1, tipo: "kit" }];
const RIGHE = [
  { id: "r1", kit_id: "k1", prodotto_id: "p1", tipo: "kit", quantita: 2 },
  { id: "r2", kit_id: "k1", prodotto_id: "p2", tipo: "kit", quantita: 1 },
  { id: "r3", kit_id: "k1", prodotto_id: "p3", tipo: "kit", quantita: 5 },
  // gli ACCESSORI DIDATTICA sono una lista a parte, del corso e non del
  // pacchetto: e' quella che il titolare aveva davanti il 9/11 quando ha
  // detto «non vedo categorie nella lista» — trenta righe in fila
  { id: "a1", kit_id: null, corso_id: "c1", prodotto_id: "p2", tipo: "accessorio", quantita: 1 },
  { id: "a2", kit_id: null, corso_id: "c1", prodotto_id: "p4", tipo: "accessorio", quantita: 1 },
];
const PRODOTTI = [
  { id: "p1", nome: "Pigmento Arizona", quantita: 10 },
  { id: "p2", nome: "Ago 3RL LT - 0,25 - ago singolo", quantita: 50 },
  { id: "p3", nome: "Cartine misuratrici", quantita: 7 },
  { id: "p4", nome: "Guanti in nitrile pacco da 100 pz - Taglia M", quantita: 3 },
];
const LEGAMI = [
  { prodotto_id: "p1", categoria_id: "cat-brows" },
  { prodotto_id: "p1", categoria_id: "cat-pig" },
  { prodotto_id: "p2", categoria_id: "cat-aghi-uni" },
  { prodotto_id: "p4", categoria_id: "cat-acc" },
  // p3 senza categoria, di proposito
];
const IMMAGINI = [{ prodotto_id: "p1", url: "https://esempio/arizona.jpg", ordine: 1 }];

async function pagina() {
  return monta(
    <PaginaContenutoKit
      corsi={CORSI} kitDefinizioni={KIT} setKitDefinizioni={() => {}}
      corsiKitProdotti={RIGHE} prodottiShop={PRODOTTI}
      categorieProdotti={CATEGORIE} prodottiCategorie={LEGAMI} prodottiImmagini={IMMAGINI}
      onBack={() => {}} ricarica={() => {}}
    />
  );
}
const apri = async (p) => clicca(p.tasto("prodotti"));

describe("il contenuto del kit, nella pagina", () => {
  it("è diviso per reparto, con «Senza categoria» in fondo", async () => {
    rispondiCon({});
    const p = await pagina();
    await apri(p);
    const testo = p.testo();
    const posizione = (s) => testo.indexOf(s);
    expect(posizione("Aghi")).toBeGreaterThan(-1);
    expect(posizione("TUTTI I PIGMENTI")).toBeGreaterThan(-1);
    expect(posizione(SENZA_REPARTO)).toBeGreaterThan(-1);
    expect(posizione("Aghi")).toBeLessThan(posizione("TUTTI I PIGMENTI"));
    expect(posizione("TUTTI I PIGMENTI")).toBeLessThan(posizione(SENZA_REPARTO));
    // il pigmento sta sotto la radice e non sotto «Eyebrows»
    expect(testo).not.toMatch(/Eyebrows/);
    await p.smonta();
  });

  it("ogni prodotto ha il suo riquadro, e chi ha una foto la mostra", async () => {
    rispondiCon({});
    const p = await pagina();
    await apri(p);
    const righe = [...p.nodo.querySelectorAll("[data-riga-kit]")];
    expect(righe.length).toBe(3);
    const foto = p.nodo.querySelectorAll("[data-riga-kit] img");
    expect(foto.length).toBe(1);
    expect(foto[0].getAttribute("src")).toBe("https://esempio/arizona.jpg");
    await p.smonta();
  });

  it("il nome non viene più tagliato: va a capo", async () => {
    // quello che si perdeva era la FINE del nome, che su questi prodotti
    // è il formato della confezione («Box 10 pz», «ago singolo»)
    rispondiCon({});
    const p = await pagina();
    await apri(p);
    const riga = [...p.nodo.querySelectorAll("[data-riga-kit]")]
      .find((d) => (d.textContent || "").includes("ago singolo"));
    expect(riga, "la riga dell'ago").toBeTruthy();
    const nome = [...riga.querySelectorAll("span")]
      .find((x) => (x.textContent || "").includes("ago singolo"));
    expect(nome.style.textOverflow).not.toBe("ellipsis");
    expect(nome.style.whiteSpace).not.toBe("nowrap");
    await p.smonta();
  });

  it("le quantità restano accanto al loro prodotto", async () => {
    rispondiCon({});
    const p = await pagina();
    await apri(p);
    const riga = [...p.nodo.querySelectorAll("[data-riga-kit]")]
      .find((d) => (d.textContent || "").includes("Cartine misuratrici"));
    expect(riga.querySelector("input").value).toBe("5");
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// GLI ACCESSORI DIDATTICA, che sono una lista a parte (9/11/2026).
//
// Il titolare, dopo la prima versione: «non vedo categorie nella lista»,
// con davanti «Accessori didattica» — trentuno righe in fila indiana.
// Era vero: quella lista non e' il contenuto di un pacchetto, e' del
// CORSO, e la disegna un altro componente che era rimasto com'era. La
// lezione e' che «la lista dei prodotti di un kit» per chi la usa e'
// UNA cosa, anche quando nel codice sono due.
describe("gli accessori didattica", () => {
  const apriAccessori = async (p) => clicca(p.tasto("Accessori didattica"));

  it("sono divisi per reparto come il contenuto del kit", async () => {
    rispondiCon({});
    const p = await pagina();
    await apriAccessori(p);
    const righe = [...p.nodo.querySelectorAll("[data-riga-accessorio]")];
    expect(righe.length).toBe(2);
    // i guanti stanno in «Accessori», l'ago in «Aghi»: due intestazioni,
    // nella scheda degli accessori e non da qualche altra parte
    const scheda = righe[0].closest("div[style]").parentElement.closest("div");
    const titoli = [...p.nodo.querySelectorAll("[data-reparto]")].map((x) => x.getAttribute("data-reparto"));
    expect(titoli).toContain("Accessori");
    expect(titoli).toContain("Aghi");
    expect(scheda).toBeTruthy();
    await p.smonta();
  });

  it("ogni accessorio ha il suo riquadro per la foto", async () => {
    rispondiCon({});
    const p = await pagina();
    await apriAccessori(p);
    const righe = [...p.nodo.querySelectorAll("[data-riga-accessorio]")];
    for (const r of righe) expect(r.querySelector("span")).toBeTruthy();
    await p.smonta();
  });

  it("il nome lungo non si taglia più", async () => {
    rispondiCon({});
    const p = await pagina();
    await apriAccessori(p);
    const riga = [...p.nodo.querySelectorAll("[data-riga-accessorio]")]
      .find((d) => (d.textContent || "").includes("Taglia M"));
    expect(riga, "la riga dei guanti").toBeTruthy();
    const nome = [...riga.querySelectorAll("span")]
      .find((x) => (x.textContent || "").includes("Taglia M"));
    expect(nome.style.textOverflow).not.toBe("ellipsis");
    expect(nome.style.whiteSpace).not.toBe("nowrap");
    await p.smonta();
  });
});

// QUANTO SI LEGGE (9/11/2026). Le misure le ha decise il titolare
// guardando la pagina: «il titolo della categoria grande il doppio,
// grassetto e al centro», poi «anche i caratteri dei prodotti sono
// troppo piccoli, raddoppiali e triplica quelli del titolo». Erano 11 e
// 13. Stanno in due costanti sole, e questa prova le inchioda: queste
// liste si leggono in piedi con lo scatolone in mano, e il giorno che
// qualcuno le rimpicciolisce «per far stare più righe» se ne accorge
// qui invece che in magazzino.
describe("quanto si legge", () => {
  it("il titolo del reparto è grande, in grassetto e al centro", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    const titolo = p.nodo.querySelector('[data-reparto="Aghi"] span');
    expect(titolo.style.fontSize).toBe("33px");
    expect(Number(titolo.style.fontWeight)).toBeGreaterThanOrEqual(700);
    expect(titolo.style.textAlign).toBe("center");
    // e va a capo invece di uscire dal riquadro: «TUTTI I PIGMENTI» a 33
    // su un telefono non ci sta
    expect(titolo.style.overflowWrap).toBe("anywhere");
    await p.smonta();
  });

  it("il nome del prodotto è il doppio di prima", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    const riga = [...p.nodo.querySelectorAll("[data-riga-kit]")]
      .find((d) => (d.textContent || "").includes("Arizona"));
    const nome = [...riga.querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Pigmento Arizona");
    expect(nome.style.fontSize).toBe("26px");
    await p.smonta();
  });

  it("e negli accessori didattica si legge uguale", async () => {
    // tre scale diverse per la stessa lista si notano passando da una
    // pagina all'altra
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("Accessori didattica"));
    const riga = [...p.nodo.querySelectorAll("[data-riga-accessorio]")]
      .find((d) => (d.textContent || "").includes("Taglia M"));
    const nome = [...riga.querySelectorAll("span")].find((x) => (x.textContent || "").includes("Taglia M"));
    expect(nome.style.fontSize).toBe("26px");
    await p.smonta();
  });
});
