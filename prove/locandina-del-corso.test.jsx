// «PREZZI CORSO DI PMU»: L'ASSISTENTE MOSTRA LA LOCANDINA (9/11/2026).
//
// Il titolare: «quando all'agente AI gli chiedo prezzi corso di PMU,
// vorrei che mi mostrasse nella chat la locandina, che se e' composta di
// piu' pagine posso sfogliare col dito facendo slide da destra verso
// sinistra, e col pinch posso zoomare per vedere i prezzi».
//
// Due cose tengono ferme queste prove. La prima e' il RICONOSCIMENTO:
// una domanda vera («come registro un cliente») non deve far comparire
// sei cartelli di prezzi, e «prezzi PMU» deve restare dei prodotti che
// si chiamano PMU. La seconda e' IL GESTO: sfogliare e allargare si
// provano toccando per davvero, perche' sono l'unica ragione per cui
// questa cosa esiste — una galleria che non si sfoglia e' una foto.
import { describe, it, expect } from "vitest";
import React from "react";
import { act } from "react";
import AssistenteRegole from "../src/regole/AssistenteRegole.jsx";
import SfogliaLocandine from "../src/regole/SfogliaLocandine.jsx";
import { cercaLocandinePerTesto, nominaUnCorso, chiedeUnPrezzo, testoDelleLocandine } from "../src/regole/locandina-corso.js";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// I NOMI VERI dei file del secchio `locandine-corsi`, letti il 9/11/2026:
// sono loro a dire se la ricerca funziona, non dei nomi inventati per
// farla funzionare.
const NOMI = [
  "Airstrokes.png", "Areola-prezzi.png", "Colori-e-correzioni-prezzi.png", "Elite-pmu-advanced.png",
  "Evolution-Hairstrokes-prezzi.png", "Extension-One-to-One.png", "Extension-Volume.png", "HENNE-prezzi.png",
  "Lamazione-individuale-Sopracciglia-Koreana.png", "Laminazione-base-590.png", "Microblading-base-individuale.png",
  "PMU-BASE-Elite.png", "PMU-BASE-KIT-BASE.png", "PMU-BASE-KIT-PRO.png", "PMU-BASE-Vip-individuale.png",
  "Prezzi-Microblading.pdf", "Prezzi-Needling.pdf", "RIEPILOGO-PMU.png", "tricopigmentazione.png",
];
const titoloDa = (n) => n.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim()
  .split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
const LOCANDINE = NOMI.map((n) => ({ nome: n, titolo: titoloDa(n), pdf: /\.pdf$/.test(n), url: `https://esempio/${n}` }));
const nomiTrovati = (testo) => cercaLocandinePerTesto(testo, LOCANDINE).map((l) => l.nome);

// le pagine come le costruisce App.jsx: un'immagine e' una pagina, un PDF
// di tre pagine sono tre pagine
const PAGINE_PMU = ["RIEPILOGO-PMU.png", "PMU-BASE-Elite.png", "PMU-BASE-KIT-PRO.png"]
  .map((n) => ({ chiave: n, titolo: titoloDa(n), pagina: 1, di: 1, url: `https://esempio/${n}` }));
const PAGINE_PDF = [1, 2, 3].map((n) => ({ chiave: `Prezzi-Microblading.pdf#${n}`, titolo: "Prezzi Microblading", pagina: n, di: 3, url: `https://esempio/mb-${n}.jpg` }));

// IL DITO. jsdom non ha il costruttore di TouchEvent: si manda un evento
// normale con sopra l'elenco dei tocchi, che e' quello che il codice
// legge (`e.touches`).
function tocco(tipo, punti) {
  const e = new window.Event(tipo, { bubbles: true, cancelable: true });
  const lista = punti.map((p, i) => ({ clientX: p.x, clientY: p.y, identifier: i }));
  e.touches = lista; e.changedTouches = lista; e.targetTouches = lista;
  return e;
}
async function trascinaDito(el, da, a, { y = 100, yFine = null } = {}) {
  await act(async () => {
    el.dispatchEvent(tocco("touchstart", [{ x: da, y }]));
    el.dispatchEvent(tocco("touchmove", [{ x: Math.round((da + a) / 2), y: yFine == null ? y : Math.round((y + yFine) / 2) }]));
    el.dispatchEvent(tocco("touchmove", [{ x: a, y: yFine == null ? y : yFine }]));
    el.dispatchEvent(tocco("touchend", []));
  });
  await attendi();
}
async function pizzica(el, da, a) {
  await act(async () => {
    el.dispatchEvent(tocco("touchstart", [{ x: 200 - da / 2, y: 200 }, { x: 200 + da / 2, y: 200 }]));
    el.dispatchEvent(tocco("touchmove", [{ x: 200 - a / 2, y: 200 }, { x: 200 + a / 2, y: 200 }]));
  });
  await attendi();
}
const trasformaDi = (p, indice = 0) => p.nodo.querySelectorAll('[data-campo="pagina-locandina"] img')[indice]?.style.transform || "";

describe("riconoscere la locandina dal testo", () => {
  it("«prezzi corso di PMU» trova le locandine del PMU, il riepilogo per primo", () => {
    expect(nomiTrovati("prezzi corso di PMU")).toEqual([
      "RIEPILOGO-PMU.png", "Elite-pmu-advanced.png", "PMU-BASE-Elite.png",
      "PMU-BASE-KIT-BASE.png", "PMU-BASE-KIT-PRO.png", "PMU-BASE-Vip-individuale.png",
    ]);
  });

  it("una parola che in un nome di file non c'e' non manda a mani vuote", () => {
    // «a Milano» non sta nel nome di nessun foglio e non ci starà mai:
    // una domanda che chiede chiaramente il prezzo di un corso si
    // accontenta delle parole che combaciano
    expect(nomiTrovati("quanto costa il corso di PMU a Milano")).toContain("RIEPILOGO-PMU.png");
  });

  it("ma quel secondo giro NON si fa senza «corso» e senza «prezzo»", () => {
    // qui «pmu» combacia, ma non si sta chiedendo un prezzo: la domanda
    // deve andare al modello, che sa spiegare come funziona un corso
    expect(nomiTrovati("come funziona il PMU base rispetto all'advanced")).toEqual([]);
  });

  it("una domanda vera non e' una locandina", () => {
    expect(nomiTrovati("come registro un cliente")).toEqual([]);
    expect(nomiTrovati("quanto sconto posso fare in aula")).toEqual([]);
    expect(nomiTrovati("")).toEqual([]);
    expect(nomiTrovati("prezzi corso")).toEqual([]);
  });

  it("si cerca a pezzi di parola, come in tutta l'app", () => {
    expect(nomiTrovati("locandina lamin")).toEqual(["Laminazione-base-590.png"]);
    expect(nomiTrovati("prezzi corso henne")).toEqual(["HENNE-prezzi.png"]);
  });

  it("«corso» e' la parola che distingue le due domande", () => {
    expect(nominaUnCorso("prezzi corso di pmu")).toBe(true);
    expect(nominaUnCorso("mostrami la locandina del microblading")).toBe(true);
    expect(nominaUnCorso("prezzi pmu")).toBe(false);
    expect(chiedeUnPrezzo("quanto costa il corso")).toBe(true);
    expect(chiedeUnPrezzo("dove segno il modulo ricevuto")).toBe(false);
  });

  it("quello che la voce legge dice quante pagine sono, e non inventa cifre", () => {
    const detto = testoDelleLocandine(PAGINE_PDF);
    expect(detto).toContain("Prezzi Microblading");
    expect(detto).toContain("3 pagine");
    expect(detto).not.toMatch(/\d+[,.]\d\d/); // nessun prezzo riscritto a parole
  });
});

describe("sfogliare la locandina", () => {
  it("il dito da destra verso sinistra passa alla pagina dopo", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 3");
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 240, 60);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("2 / 3");
    expect(p.testo()).toContain("pagina 2 di 3");
    // e tornare indietro, nell'altro verso
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 60, 240);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 3");
    await p.smonta();
  });

  it("IL DITO IN VERTICALE RESTA DELLA CHAT: non sfoglia niente", async () => {
    // il pannello dell'assistente scorre, e una conversazione che non si
    // puo' far scorrere passando sopra una locandina e' peggio del
    // problema che questa galleria risolve
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 200, 170, { y: 240, yFine: 40 });
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 3");
    await p.smonta();
  });

  it("un tocco appena mosso non sfoglia", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 200, 180);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 3");
    await p.smonta();
  });

  it("l'ultima pagina non si sfoglia oltre", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    const box = () => p.nodo.querySelector('[data-campo="sfoglia-locandina"]');
    await trascinaDito(box(), 240, 60);
    await trascinaDito(box(), 240, 60);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("3 / 3");
    await trascinaDito(box(), 240, 60);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("3 / 3");
    await p.smonta();
  });

  it("le frecce fanno la stessa cosa del dito", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PMU} />);
    await clicca(p.nodo.querySelector('[data-campo="pagina-dopo"]'));
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("2 / 3");
    await clicca(p.nodo.querySelector('[data-campo="pagina-prima"]'));
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 3");
    await p.smonta();
  });

  it("una locandina sola non ha ne' frecce ne' conteggio", async () => {
    const p = await monta(<SfogliaLocandine pagine={[PAGINE_PMU[0]]} />);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]')).toBe(null);
    expect(p.nodo.querySelector('[data-campo="pagina-dopo"]')).toBe(null);
    await p.smonta();
  });
});

describe("allargare con due dita", () => {
  it("due dita che si allontanano ingrandiscono la pagina", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    expect(trasformaDi(p)).toContain("scale(1)");
    await pizzica(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 100, 300);
    expect(trasformaDi(p)).toMatch(/scale\(3\)/);
    await p.smonta();
  });

  it("non si rimpicciolisce sotto la pagina intera", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    await pizzica(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 300, 60);
    expect(trasformaDi(p)).toContain("scale(1)");
    await p.smonta();
  });

  it("cambiando pagina si riparte da intera", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    await pizzica(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 100, 250);
    expect(trasformaDi(p)).not.toContain("scale(1)");
    await clicca(p.nodo.querySelector('[data-campo="pagina-dopo"]'));
    expect(trasformaDi(p, 1)).toContain("scale(1)");
    await p.smonta();
  });

  it("il tocco apre a tutto schermo, dove i prezzi si leggono", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    expect(p.nodo.querySelector('[data-campo="locandina-a-tutto-schermo"]')).toBe(null);
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 200, 200);
    expect(p.nodo.querySelector('[data-campo="locandina-a-tutto-schermo"]')).toBeTruthy();
    await clicca(p.nodo.querySelector('[data-campo="chiudi-locandina"]'));
    expect(p.nodo.querySelector('[data-campo="locandina-a-tutto-schermo"]')).toBe(null);
    await p.smonta();
  });
});

describe("l'assistente, chiesti i prezzi di un corso", () => {
  const regolamenti = { "rest/v1/regolamenti": [] };
  const locandineCorso = async (testo) => {
    const trovate = cercaLocandinePerTesto(testo, LOCANDINE);
    if (!trovate.length) return null;
    return { pagine: trovate.flatMap((l) => (l.pdf ? PAGINE_PDF : [{ chiave: l.nome, titolo: l.titolo, pagina: 1, di: 1, url: l.url }])) };
  };

  async function chiediAll(p, domanda) {
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), domanda);
    await clicca(p.tasto("Chiedi"));
    await attendi(100);
  }

  it("mostra la locandina e NON disturba il modello", async () => {
    const chiamate = [];
    rispondiCon({ ...regolamenti, "functions/v1/assistente-regole": (c) => { chiamate.push(c); return { ok: true, risposta: "non dovrei essere qui" }; } });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" locandineCorso={locandineCorso} />);
    await chiediAll(p, "prezzi corso di PMU");
    expect(p.nodo.querySelector('[data-campo="locandine-del-corso"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-campo="etichetta-locandina"]').textContent).toContain("locandina");
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("1 / 6");
    expect(chiamate.length).toBe(0);
    // e si sfoglia dentro la chat
    await trascinaDito(p.nodo.querySelector('[data-campo="sfoglia-locandina"]'), 240, 60);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("2 / 6");
    await p.smonta();
  });

  it("una domanda vera continua ad andare al modello", async () => {
    const chiamate = [];
    rispondiCon({ ...regolamenti, "functions/v1/assistente-regole": (c) => { chiamate.push(c); return { ok: true, risposta: "Si fa da Gestione utenti.", citati: [] }; } });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" locandineCorso={locandineCorso} />);
    await chiediAll(p, "come registro un cliente");
    expect(chiamate.length).toBe(1);
    expect(p.nodo.querySelector('[data-campo="locandine-del-corso"]')).toBe(null);
    await p.smonta();
  });

  it("«prezzi PMU» resta dei prodotti del banco: la parola che cambia tutto e' «corso»", async () => {
    rispondiCon({ ...regolamenti, "functions/v1/assistente-regole": { ok: true, risposta: "x" } });
    const prezziAlBanco = (testo) => (/pmu/i.test(testo)
      ? { fiera: null, prodotti: [{ id: "p1", nome: "Dispensa PMU", listino: 20, contanti: null, carta: null, senzaMargine: false }] }
      : null);
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" prezziAlBanco={prezziAlBanco} locandineCorso={locandineCorso} />);
    await chiediAll(p, "prezzi PMU");
    expect(p.nodo.querySelector('[data-campo="prezzi-al-banco"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-campo="locandine-del-corso"]')).toBe(null);
    await chiediAll(p, "prezzi corso di PMU");
    expect(p.nodo.querySelector('[data-campo="locandine-del-corso"]')).toBeTruthy();
    await p.smonta();
  });

  it("senza il permesso di Prezzi corsi la domanda va al modello", async () => {
    // e' quello che fa `locandineDellaDomanda` in App.jsx quando la
    // tessera non c'e': torna null, e il pannello non deve inventarsi
    // niente
    const chiamate = [];
    rispondiCon({ ...regolamenti, "functions/v1/assistente-regole": (c) => { chiamate.push(c); return { ok: true, risposta: "I prezzi stanno in Prezzi corsi.", citati: [] }; } });
    const p = await monta(<AssistenteRegole ruolo="master" chi="Chiara" locandineCorso={async () => null} />);
    await chiediAll(p, "prezzi corso di PMU");
    expect(chiamate.length).toBe(1);
    expect(p.nodo.querySelector('[data-campo="locandine-del-corso"]')).toBe(null);
    await p.smonta();
  });

  it("senza la ricerca delle locandine il pannello funziona come prima", async () => {
    const chiamate = [];
    rispondiCon({ ...regolamenti, "functions/v1/assistente-regole": (c) => { chiamate.push(c); return { ok: true, risposta: "Eccolo.", citati: [] }; } });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" />);
    await chiediAll(p, "prezzi corso di PMU");
    expect(chiamate.length).toBe(1);
    await p.smonta();
  });
});

// Trovata dal banco di prova, non dall'uso: nel riquadro della chat il
// tocco apre lo schermo pieno, e una freccia e' dentro quel riquadro.
// Premerla faceva due cose con un dito solo.
describe("le frecce non sono la foto", () => {
  it("premere «›» nella chat cambia pagina e NON apre lo schermo pieno", async () => {
    const p = await monta(<SfogliaLocandine pagine={PAGINE_PDF} />);
    const freccia = p.nodo.querySelector('[data-campo="pagina-dopo"]');
    await act(async () => {
      freccia.dispatchEvent(tocco("touchstart", [{ x: 300, y: 100 }]));
      freccia.dispatchEvent(tocco("touchend", []));
    });
    await clicca(freccia);
    expect(p.nodo.querySelector('[data-campo="conta-pagine"]').textContent).toBe("2 / 3");
    expect(p.nodo.querySelector('[data-campo="locandina-a-tutto-schermo"]')).toBe(null);
    await p.smonta();
  });
});
