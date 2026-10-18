// LO SCONTO DELLA FIERA.
//
// Le tabelle sono quelle vere, copiate dal database il 18/10/2026, e i
// prodotti sono due presi dall'archivio: un dermografo (margine altissimo) e
// una consulenza (margine medio). Se qualcuno cambia la regola delle fasce
// senza accorgersene, queste cifre si muovono e la prova lo dice.
import { describe, it, expect } from "vitest";
import { scontoAFasceCarrello, percentualeFasciaDi, fasceCorsiPerPagamento } from "../src/App.jsx";

const sei = (p) => [
  { da: 0, a: 16.5, percentuale: p[0] }, { da: 16.5, a: 33, percentuale: p[1] },
  { da: 33, a: 49.5, percentuale: p[2] }, { da: 49.5, a: 66, percentuale: p[3] },
  { da: 66, a: 82.5, percentuale: p[4] }, { da: 82.5, a: 100, percentuale: p[5] },
];
const CARTA = { soglie: [80, 120, 200], gruppi: Array(4).fill(sei([6, 8, 10, 10, 10, 10])) };
const CONTANTI = { soglie: [80, 120, 200], gruppi: Array(4).fill(sei([8, 10, 12, 12, 12, 12])) };

const HORUS = { id: "h", prezzo_vendita: 491.803279, costo_acquisto: 45.9, aliquota_iva_vendita: 22 };
const CONSULENZA = { id: "c", prezzo_vendita: 180, costo_acquisto: 65, aliquota_iva_vendita: 0 };
const perId = { h: HORUS, c: CONSULENZA };

const carrello = (id, prezzo, quantita = 1) => [{ prodottoId: id, prezzo, quantita }];

describe("sconto fiera", () => {
  it("con la carta sconta la percentuale della fascia di margine", () => {
    const fasce = fasceCorsiPerPagamento(CARTA, CONTANTI, false);
    expect(percentualeFasciaDi(HORUS, fasce, 600, false)).toBe(10);
    expect(scontoAFasceCarrello(carrello("h", 600), perId, fasce, false)).toBe(60);
  });

  it("in contanti sconta di piu', perche' l'IVA resta in cassa", () => {
    const fasce = fasceCorsiPerPagamento(CARTA, CONTANTI, true);
    expect(percentualeFasciaDi(HORUS, fasce, 600, true)).toBe(12);
    expect(scontoAFasceCarrello(carrello("h", 600), perId, fasce, true)).toBe(72);
  });

  it("un prodotto a margine piu' basso prende la fascia piu' bassa", () => {
    const fasce = fasceCorsiPerPagamento(CARTA, CONTANTI, false);
    // consulenza: 180 - 65 su 180 = 63,9% di margine -> terza fascia in su
    expect(percentualeFasciaDi(CONSULENZA, fasce, 180, false)).toBe(10);
    expect(scontoAFasceCarrello(carrello("c", 180), perId, fasce, false)).toBe(18);
  });

  it("un prodotto senza costo d'acquisto non si sconta: il margine non si sa", () => {
    const misterioso = { id: "x", prezzo_vendita: 100, costo_acquisto: null, aliquota_iva_vendita: 22 };
    const fasce = fasceCorsiPerPagamento(CARTA, CONTANTI, false);
    expect(percentualeFasciaDi(misterioso, fasce, 122, false)).toBe(0);
    expect(scontoAFasceCarrello(carrello("x", 122), { x: misterioso }, fasce, false)).toBe(0);
  });

  it("lo sconto non supera mai il carrello", () => {
    const fasce = fasceCorsiPerPagamento(CARTA, CONTANTI, true);
    const totale = 600;
    expect(scontoAFasceCarrello(carrello("h", totale), perId, fasce, true)).toBeLessThan(totale);
  });
});
