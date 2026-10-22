// Le funzioni del dettaglio vendite misurate sulle righe VERE della
// fiera di Tirana (settembre 2026), confrontate con quello che dice il
// database. Non si misura il numero che sembra giusto: si misura
// quello che scrive la funzione che lo scrive, e lo si confronta con
// la somma fatta da un'altra parte.
import { describe, it, expect } from "vitest";
import { totaliVendite, prodottiPiuVenduti } from "../src/eventi/dati.js";
import RIGHE from "./tirana-righe.json";

describe("Tirana, settembre 2026", () => {
  it("l'incassato è quello del database, al centesimo", () => {
    const t = totaliVendite(RIGHE);
    expect(t.incassato).toBe(798.18);
    expect(t.quante).toBe(13);
    expect(t.omaggi).toBe(0);
    expect(t.medio).toBe(61.4);
  });

  it("contanti e POS quadrano col totale", () => {
    const t = totaliVendite(RIGHE);
    const perMetodo = Object.fromEntries(t.perMetodo);
    expect(perMetodo.contanti).toBe(594.76);
    expect(perMetodo.pos).toBe(203.42);
    expect(Math.round((perMetodo.contanti + perMetodo.pos) * 100) / 100).toBe(t.incassato);
  });

  // LA SOMMA DELLE RIGHE DEVE FARE IL TOTALE DEGLI SCONTRINI. Se non
  // tornasse, la classifica e il riquadro in cima direbbero due cose
  // diverse sulla stessa fiera — ed è il modo più rapido per non essere
  // creduti su nessuna delle due.
  it("la classifica somma esattamente quanto gli scontrini", () => {
    const t = totaliVendite(RIGHE);
    const c = prodottiPiuVenduti(RIGHE, {});
    const sommaRighe = Math.round(c.reduce((s, x) => s + x.incasso, 0) * 100) / 100;
    expect(sommaRighe).toBe(t.incassato);
  });

  it("i pezzi della classifica sono quelli dei totali", () => {
    const t = totaliVendite(RIGHE);
    const c = prodottiPiuVenduti(RIGHE, {});
    expect(c.reduce((s, x) => s + x.pezzi, 0)).toBe(t.pezzi);
  });

  // lo stesso ago comprato in quattro scontrini diversi è UNA riga di
  // classifica, non quattro
  it("il prodotto comprato più volte si raggruppa", () => {
    const c = prodottiPiuVenduti(RIGHE, {});
    const ago = c.find((x) => x.nome.startsWith("Ago 1RL 0.30"));
    expect(ago.pezzi).toBe(3);
    expect(ago.vendite).toBe(3);
  });
});
