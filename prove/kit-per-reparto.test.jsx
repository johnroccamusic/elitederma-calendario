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

  // 15/11/2026, chiesto dal titolare: «tutti i prodotti nelle varie
  // categorie del materiale presente dei kit deve essere in ordine
  // alfabetico sotto ad ogni categoria». Dentro LAMINAZIONE c'erano
  // tredici boccette nell'ordine in cui le righe erano state scritte.
  it("dentro un reparto i prodotti sono in ordine alfabetico", () => {
    const m = repartoPerProdotto([
      { prodotto_id: "p1", categoria_id: "cat-pig" },
      { prodotto_id: "p2", categoria_id: "cat-pig" },
      { prodotto_id: "p3", categoria_id: "cat-pig" },
    ], CATEGORIE);
    const nomi = { p1: "Tinta nera", p2: "Colla ciglia", p3: "N10 Fixa" };
    const gruppi = raggruppaPerReparto(
      [{ prodottoId: "p1" }, { prodottoId: "p2" }, { prodottoId: "p3" }],
      m, (r) => r.prodottoId, (r) => nomi[r.prodottoId],
    );
    expect(gruppi[0].righe.map((r) => nomi[r.prodottoId])).toEqual(["Colla ciglia", "N10 Fixa", "Tinta nera"]);
  });

  it("«N2» viene prima di «N10», non dopo", () => {
    const m = repartoPerProdotto([
      { prodotto_id: "p1", categoria_id: "cat-pig" },
      { prodotto_id: "p2", categoria_id: "cat-pig" },
    ], CATEGORIE);
    const nomi = { p1: "N10 Hydra", p2: "N2 Fixa" };
    const gruppi = raggruppaPerReparto(
      [{ prodottoId: "p1" }, { prodottoId: "p2" }],
      m, (r) => r.prodottoId, (r) => nomi[r.prodottoId],
    );
    expect(gruppi[0].righe.map((r) => nomi[r.prodottoId])).toEqual(["N2 Fixa", "N10 Hydra"]);
  });

  // chi non passa i nomi tiene l'ordine che gli arriva: le tre liste lo
  // passano, ma la funzione non deve pretenderlo per funzionare
  it("senza i nomi l'ordine di arrivo non si tocca", () => {
    const m = repartoPerProdotto([
      { prodotto_id: "p1", categoria_id: "cat-pig" },
      { prodotto_id: "p2", categoria_id: "cat-pig" },
    ], CATEGORIE);
    const gruppi = raggruppaPerReparto([{ prodottoId: "p2" }, { prodottoId: "p1" }], m);
    expect(gruppi[0].righe.map((r) => r.prodottoId)).toEqual(["p2", "p1"]);
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

  it("sono divisi per reparto, e ogni reparto è una banda che si apre", async () => {
    // dal 15/11/2026 (mockup del titolare): trenta accessori di fila
    // sono tre schermate da scorrere per arrivare al tasto sotto. Le
    // bande ci sono tutte, aperta la prima.
    rispondiCon({});
    const p = await pagina();
    await apriAccessori(p);
    const bande = [...p.nodo.querySelectorAll("[data-banda-reparto]")];
    expect(bande.map((b) => b.getAttribute("data-banda-reparto"))).toEqual(["Accessori", "Aghi"]);
    // ognuna dice quanti prodotti contiene, anche da chiusa
    expect(bande[1].textContent).toContain("1 prodotto");
    // aperta la prima: si vede una riga sola, quella dei guanti
    const righe = [...p.nodo.querySelectorAll("[data-riga-accessorio]")];
    expect(righe.length).toBe(1);
    expect(righe[0].getAttribute("data-riga-accessorio")).toContain("Taglia M");
    // premendo la seconda banda compare anche l'ago
    await clicca(bande[1].querySelector("button"));
    const dopo = [...p.nodo.querySelectorAll("[data-riga-accessorio]")]
      .map((r) => r.getAttribute("data-riga-accessorio"));
    expect(dopo.length).toBe(2);
    expect(dopo.some((x) => x.includes("ago singolo"))).toBe(true);
    await p.smonta();
  });

  it("la quantità di un accessorio si scrive da qui", async () => {
    // è il numero che la logistica si ritrova già scritto nella casella
    // di ogni edizione: prima nasceva a 1 e da qui non si poteva toccare
    const chiamato = rispondiCon({ corsi_kit_prodotti: [{ id: "a1" }] });
    const p = await pagina();
    await apriAccessori(p);
    const riga = p.nodo.querySelector("[data-riga-accessorio]");
    const su = [...riga.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").includes("più"))
      || riga.querySelectorAll("button")[0];
    await clicca(su);
    const patch = chiamato.mock.calls.find(([, o]) => o?.method === "PATCH");
    expect(patch, "la scrittura della quantità").toBeTruthy();
    expect(JSON.parse(patch[1].body).quantita).toBeGreaterThan(0);
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
// guardando la pagina e correggendo due volte: «grande il doppio,
// grassetto e al centro», poi «raddoppiali e triplica quelli del
// titolo» (33 e 26), infine «ora è troppo, riducili del 40%». Da 11 e
// 13 si arriva a 20 e 16. Stanno in due costanti sole, e questa prova
// le inchioda: queste
// liste si leggono in piedi con lo scatolone in mano, e il giorno che
// qualcuno le rimpicciolisce «per far stare più righe» se ne accorge
// qui invece che in magazzino.
describe("quanto si legge", () => {
  it("il titolo del reparto è grande, in grassetto e al centro", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    const titolo = p.nodo.querySelector('[data-reparto="Aghi"] span');
    expect(titolo.style.fontSize).toBe("20px");
    expect(Number(titolo.style.fontWeight)).toBeGreaterThanOrEqual(700);
    expect(titolo.style.textAlign).toBe("center");
    // e va a capo invece di uscire dal riquadro: «TUTTI I PIGMENTI» a 33
    // su un telefono non ci sta
    expect(titolo.style.overflowWrap).toBe("anywhere");
    await p.smonta();
  });

  it("il nome del prodotto è più grande di prima, ma non enorme", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    const riga = [...p.nodo.querySelectorAll("[data-riga-kit]")]
      .find((d) => (d.textContent || "").includes("Arizona"));
    const nome = [...riga.querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Pigmento Arizona");
    expect(nome.style.fontSize).toBe("16px");
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
    expect(nome.style.fontSize).toBe("16px");
    await p.smonta();
  });
});

// IL CESTINO, E LA DOMANDA PRIMA DI CANCELLARE (15/11/2026, chiesto dal
// titolare: «qui sulle liste sostituisci la X rossa con l'iconcina del
// cestino e prima di eliminare il prodotto chiedi conferma»).
//
// La domanda c'era già — `confermaCancellazione`, dall'11/11 — e queste
// prove la inchiodano: finché nessuna prova preme quel tasto, «chiede»
// resta una cosa che si crede, non una che si sa.
describe("togliere un prodotto da una lista", () => {
  const tastoCestino = (riga) => [...riga.querySelectorAll("button")]
    .find((b) => (b.getAttribute("title") || "").toLowerCase().includes("elimina"));

  it("il tasto è un cestino, non una crocetta", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    const riga = p.nodo.querySelector("[data-riga-kit]");
    const tasto = tastoCestino(riga);
    expect(tasto, "il tasto per eliminare").toBeTruthy();
    expect(tasto.textContent).not.toContain("✕");
    expect(tasto.querySelector("svg"), "l'icona del cestino").toBeTruthy();
    await p.smonta();
  });

  it("chiede prima di eliminare, e con «no» non cancella niente", async () => {
    const chiamato = rispondiCon({});
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await pagina();
    await clicca(p.tasto("prodotti"));
    await clicca(tastoCestino(p.nodo.querySelector("[data-riga-kit]")));
    expect(domande.length).toBe(1);
    expect(domande[0]).toMatch(/cancellare/i);
    expect(chiamato.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false);
    window.confirm = () => true;
    await p.smonta();
  });

  it("vale anche per la lista degli accessori didattica", async () => {
    const chiamato = rispondiCon({});
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await pagina();
    await clicca(p.tasto("Accessori didattica"));
    const riga = p.nodo.querySelector("[data-riga-accessorio]");
    const tasto = tastoCestino(riga);
    expect(tasto.querySelector("svg")).toBeTruthy();
    await clicca(tasto);
    // la domanda nomina il prodotto: davanti a quindici righe «sei
    // sicuro» da solo non dice quale si è premuta
    expect(domande[0]).toContain("Taglia M");
    expect(chiamato.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false);
    window.confirm = () => true;
    await p.smonta();
  });

  it("con «sì» il prodotto se ne va davvero", async () => {
    const chiamato = rispondiCon({});
    window.confirm = () => true;
    const p = await pagina();
    await clicca(p.tasto("Accessori didattica"));
    await clicca(tastoCestino(p.nodo.querySelector("[data-riga-accessorio]")));
    expect(chiamato.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(true);
    await p.smonta();
  });
});

// «AGGIUNGI ACCESSORIO» (15/11/2026, chiesto dal titolare: «qui, in
// accessori didattica, crea il tasto "Aggiungi accessorio"»). La casella
// per cercare un prodotto stava sempre aperta in cima alla scheda: chi
// arrivava per guardare l'elenco si trovava davanti una ricerca, e chi
// voleva aggiungere non aveva un gesto da cercare.
describe("aggiungere un accessorio", () => {
  const cercaCasella = (p) => [...p.nodo.querySelectorAll("input")]
    .find((i) => (i.placeholder || "").includes("Cerca accessorio"));

  it("la ricerca non è più sempre in vista: c'è un tasto che la apre", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("Accessori didattica"));
    expect(cercaCasella(p)).toBeFalsy();
    const tasto = p.nodo.querySelector('[data-campo="aggiungi-accessorio"]');
    expect(tasto).toBeTruthy();
    expect(tasto.textContent).toContain("Aggiungi accessorio");
    await clicca(tasto);
    expect(cercaCasella(p)).toBeTruthy();
    await p.smonta();
  });

  it("premendolo di nuovo si richiude, e l'elenco resta dov'era", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(p.tasto("Accessori didattica"));
    await clicca(p.nodo.querySelector('[data-campo="aggiungi-accessorio"]'));
    await clicca(p.nodo.querySelector('[data-campo="aggiungi-accessorio"]'));
    expect(cercaCasella(p)).toBeFalsy();
    expect(p.nodo.querySelectorAll("[data-banda-reparto]").length).toBe(2);
    await p.smonta();
  });
});
