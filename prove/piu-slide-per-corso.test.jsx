// PIÙ DI UNA SLIDE PER CORSO (14/11/2026).
//
// Il titolare: «in associa slide al corso avrei bisogno, una volta
// inserita la prima slide del corso, di un segno + che permetta di
// caricare una seconda slide per lo stesso corso».
//
// Il «+» è la punta: sotto, le slide hanno smesso di essere una colonna
// di `corsi` più una mappa nelle impostazioni condivise e sono diventate
// righe di `corsi_slide`. Qui si provano le due facce — la pagina che
// aggiunge, e la scheda della master che deve mostrarle tutte e
// distinguerle.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { PaginaSlideCorsi, CardDataMaster, slideDelCorso, nomeSlide } from "../src/App.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CORSI = [
  { id: "co1", nome: "PMU BASE", colore: "#123456" },
  { id: "co2", nome: "LAMINAZIONE", colore: "#654321" },
];
const SLIDE = [
  // fuori ordine apposta: a metterle in fila è `slideDelCorso`
  { id: "s2", corso_id: "co1", tipo: "link", url: "https://canva.link/due", ordine: 1, titolo: "Giorno 2" },
  { id: "s1", corso_id: "co1", tipo: "pdf", percorso: "co1/111.pdf", nome: "PMU parte 1.pdf", ordine: 0, caricato_il: "2026-11-01T09:00:00Z" },
  { id: "s9", corso_id: "co2", tipo: "link", url: "https://canva.link/lam", ordine: 0 },
];

const oggi = new Date().toISOString().slice(0, 10);
const CD_IN_CORSO = { id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: oggi, data_fine: oggi };
const CD_PASSATA = { id: "cd2", corso_id: "co1", location_id: "lo1", data_inizio: "2026-01-10", data_fine: "2026-01-11" };

describe("le slide di un corso, in fila", () => {
  it("si prendono per corso e si mettono in ordine", () => {
    const lista = slideDelCorso(SLIDE, "co1");
    expect(lista.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(slideDelCorso(SLIDE, "co2").map((s) => s.id)).toEqual(["s9"]);
    expect(slideDelCorso(SLIDE, "co3")).toEqual([]);
    expect(slideDelCorso(null, "co1")).toEqual([]);
  });

  it("PDF e link stanno nella stessa fila: per la master sono la stessa cosa", () => {
    const lista = slideDelCorso(SLIDE, "co1");
    expect(lista.map((s) => s.tipo)).toEqual(["pdf", "link"]);
  });

  it("come si chiama una slide: il titolo, poi il nome del file, poi il posto", () => {
    expect(nomeSlide({ tipo: "link", titolo: "Giorno 2" }, 1)).toBe("Giorno 2");
    expect(nomeSlide({ tipo: "pdf", nome: "PMU parte 1.pdf" }, 0)).toBe("PMU parte 1.pdf");
    // un link senza titolo non ha niente da mostrare che non sia un
    // indirizzo: resta il suo posto nella fila
    expect(nomeSlide({ tipo: "link", url: "https://x" }, 1)).toBe("Slide 2");
    expect(nomeSlide({ tipo: "pdf", nome: "   " }, 2)).toBe("Slide 3");
  });
});

describe("la pagina «Associa slide del corso»", () => {
  const pagina = () => monta(<PaginaSlideCorsi corsi={CORSI} corsiSlide={SLIDE} ricarica={() => {}} onBack={() => {}} />);
  const riga = (p, nome) => [...p.nodo.querySelectorAll("div")].find(
    (d) => d.querySelector('[data-campo="aggiungi-pdf"]') && (d.textContent || "").startsWith(nome)
  );

  it("conta i corsi che hanno almeno una slide", async () => {
    rispondiCon({});
    const p = await pagina();
    expect(p.testo()).toMatch(/2 corsi su 2 hanno le slide/);
    await p.smonta();
  });

  it("elenca TUTTE le slide del corso, numerate", async () => {
    rispondiCon({});
    const p = await pagina();
    const righe = [...p.nodo.querySelectorAll("[data-slide]")];
    expect(righe.length).toBe(3); // due su PMU BASE, una su LAMINAZIONE
    const pmu = riga(p, "PMU BASE");
    expect(pmu.textContent).toMatch(/PMU parte 1\.pdf/);
    expect(pmu.textContent).toMatch(/canva\.link\/due/);
    expect(pmu.textContent).toMatch(/2 slide/);
    await p.smonta();
  });

  it("il «+» c'è solo dove una slide c'è già: prima si legge «Carica»", async () => {
    rispondiCon({});
    const p = await monta(
      <PaginaSlideCorsi corsi={CORSI} corsiSlide={[SLIDE[2]]} ricarica={() => {}} onBack={() => {}} />
    );
    // LAMINAZIONE ha un link: i due tasti diventano «+»
    expect(riga(p, "LAMINAZIONE").textContent).toMatch(/\+ Link/);
    expect(riga(p, "LAMINAZIONE").textContent).toMatch(/\+ PDF/);
    // PMU BASE è vuoto: si legge quello che si è sempre letto
    expect(riga(p, "PMU BASE").textContent).toMatch(/Carica link/);
    expect(riga(p, "PMU BASE").textContent).toMatch(/Carica PDF/);
    expect(riga(p, "PMU BASE").textContent).toMatch(/Nessuna slide caricata/);
    await p.smonta();
  });

  it("aggiungere un secondo link scrive una RIGA NUOVA, in fondo alla fila", async () => {
    const scritte = [];
    rispondiCon({
      "/rest/v1/corsi_slide": (corpo) => { if (corpo) scritte.push(corpo); return [{ id: "nuova" }]; },
    });
    const p = await pagina();
    await clicca(riga(p, "PMU BASE").querySelector('[data-campo="aggiungi-link"]'));
    await scrivi(p.nodo.querySelector('[data-campo="link-nuovo"]'), "canva.link/tre");
    await clicca(p.tasto("Salva link"));
    await attendi(80);

    expect(scritte.length).toBe(1);
    expect(scritte[0]).toEqual({
      corso_id: "co1", tipo: "link", url: "https://canva.link/tre", ordine: 2,
    });
    await p.smonta();
  });

  it("togliere una slide si chiede, e tocca solo quella", async () => {
    const vecchiaConferma = window.confirm;
    window.confirm = vi.fn(() => true);
    const chiamato = rispondiCon({ "/rest/v1/corsi_slide": () => [{ id: "s2" }] });
    const p = await pagina();
    const righe = [...riga(p, "PMU BASE").querySelectorAll("[data-slide]")];
    await clicca(righe[1].querySelector('[data-campo="rimuovi-slide"]'));
    await attendi(80);

    expect(window.confirm).toHaveBeenCalled();
    // la domanda nomina QUALE slide: davanti a tre righe «sei sicuro» non
    // dice niente
    expect(String(window.confirm.mock.calls[0][0])).toMatch(/Giorno 2/);
    const cancellata = chiamato.mock.calls.find(([, o]) => o?.method === "DELETE");
    expect(cancellata, "la DELETE").toBeTruthy();
    expect(String(cancellata[0])).toMatch(/id=eq\.s2/);
    window.confirm = vecchiaConferma;
    await p.smonta();
  });

  it("e col «no» non si cancella niente", async () => {
    const vecchiaConferma = window.confirm;
    window.confirm = vi.fn(() => false);
    const chiamato = rispondiCon({ "/rest/v1/corsi_slide": () => [] });
    const p = await pagina();
    const righe = [...riga(p, "PMU BASE").querySelectorAll("[data-slide]")];
    await clicca(righe[0].querySelector('[data-campo="rimuovi-slide"]'));
    await attendi(80);
    expect(chiamato.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false);
    window.confirm = vecchiaConferma;
    await p.smonta();
  });

  it("il nome si scrive e si salva uscendo dalla casella", async () => {
    const scritte = [];
    rispondiCon({
      "/rest/v1/corsi_slide": (corpo, indirizzo) => { if (corpo) scritte.push([corpo, indirizzo]); return [{ id: "s1" }]; },
    });
    const p = await pagina();
    const casella = [...riga(p, "PMU BASE").querySelectorAll('[data-campo="nome-slide"]')][0];
    await scrivi(casella, "Giorno 1");
    // React ascolta alla radice e sente «focusout», non «blur»: un blur
    // non bolle, e la prova aspetterebbe per sempre una scrittura che non
    // è mai partita
    casella.dispatchEvent(new window.Event("focusout", { bubbles: true }));
    await attendi(120);
    expect(scritte.length).toBe(1);
    expect(scritte[0][0]).toEqual({ titolo: "Giorno 1" });
    expect(scritte[0][1]).toMatch(/id=eq\.s1/);
    await p.smonta();
  });
});

describe("la scheda del corso nella dashboard della master", () => {
  const card = (corsoData, slide) => (
    <CardDataMaster corsoData={corsoData} corso={{ id: "co1", nome: "PMU BASE" }} loc={{ id: "lo1", nome: "ROMA" }} iscrittiEdizione={[]} slide={slide} />
  );

  it("un link solo e senza nome si legge «Apri link», come è sempre stato", async () => {
    const p = await monta(card(CD_IN_CORSO, [{ id: "s9", corso_id: "co1", tipo: "link", url: "https://canva.link/lam", ordine: 0 }]));
    expect([...p.nodo.querySelectorAll("[data-slide-link]")].length).toBe(1);
    expect(p.testo()).toMatch(/Apri link/);
    await p.smonta();
  });

  it("due link si distinguono per nome: due «Apri link» uguali non dicono quale sia quale", async () => {
    const p = await monta(card(CD_IN_CORSO, slideDelCorso([
      { id: "a", corso_id: "co1", tipo: "link", url: "https://x/1", ordine: 0, titolo: "Giorno 1" },
      { id: "b", corso_id: "co1", tipo: "link", url: "https://x/2", ordine: 1, titolo: "Giorno 2" },
    ], "co1")));
    const link = [...p.nodo.querySelectorAll("[data-slide-link]")];
    expect(link.length).toBe(2);
    expect(link[0].textContent).toMatch(/Giorno 1/);
    expect(link[1].textContent).toMatch(/Giorno 2/);
    expect(p.testo()).not.toMatch(/Apri link/);
    await p.smonta();
  });

  it("i PDF sono uno per tasto, dentro la finestra del corso", async () => {
    const due = slideDelCorso([
      { id: "p1", corso_id: "co1", tipo: "pdf", percorso: "co1/1.pdf", nome: "Parte 1.pdf", ordine: 0 },
      { id: "p2", corso_id: "co1", tipo: "pdf", percorso: "co1/2.pdf", nome: "Parte 2.pdf", ordine: 1 },
    ], "co1");
    const p = await monta(card(CD_IN_CORSO, due));
    const tasti = [...p.nodo.querySelectorAll("[data-slide-pdf]")];
    expect(tasti.length).toBe(2);
    expect(tasti[0].textContent).toMatch(/Parte 1\.pdf/);
    expect(tasti[1].textContent).toMatch(/Parte 2\.pdf/);
    await p.smonta();
  });

  it("un PDF solo e senza nome resta «Scarica le slide»", async () => {
    const p = await monta(card(CD_IN_CORSO, [{ id: "p1", corso_id: "co1", tipo: "pdf", percorso: "co1/1.pdf", nome: "x.pdf", ordine: 0 }]));
    expect(p.nodo.querySelector("[data-slide-pdf]").textContent).toMatch(/Scarica le slide/);
    await p.smonta();
  });

  it("fuori dalla finestra i PDF spariscono, i link no", async () => {
    const miste = slideDelCorso([
      { id: "p1", corso_id: "co1", tipo: "pdf", percorso: "co1/1.pdf", nome: "Parte 1.pdf", ordine: 0 },
      { id: "l1", corso_id: "co1", tipo: "link", url: "https://x/1", ordine: 1 },
    ], "co1");
    const p = await monta(card(CD_PASSATA, miste));
    expect([...p.nodo.querySelectorAll("[data-slide-pdf]")].length).toBe(0);
    expect([...p.nodo.querySelectorAll("[data-slide-link]")].length).toBe(1);
    await p.smonta();
  });

  it("senza slide non c'è nessun riquadro", async () => {
    const p = await monta(card(CD_IN_CORSO, []));
    expect([...p.nodo.querySelectorAll("[data-slide-link]")].length).toBe(0);
    expect([...p.nodo.querySelectorAll("[data-slide-pdf]")].length).toBe(0);
    expect(p.testo()).not.toMatch(/Slide\s*corso/);
    await p.smonta();
  });
});
