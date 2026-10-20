// LA FATTURA DEVE FARE ESATTAMENTE QUELLO CHE SI E' INCASSATO.
//
// Tre emissioni rifiutate di fila le ha pagate il titolare premendo
// «Emetti la fattura» e mandandomi lo schermo. Questa prova esiste
// perche' non succeda una quarta volta: rifa' il conto di Fatture in
// Cloud su duemila carrelli e controlla il totale, che e' l'unica cosa
// su cui quel 422 si pronuncia.
//
// COME ARROTONDA FATTURE IN CLOUD, misurato sui due rifiuti veri del
// 20/10/2026: moltiplica il netto unitario per la quantita' e arrotonda
// IL TOTALE DI RIGA; poi somma, e sull'imponibile calcola l'IVA
// arrotondata. Le due risposte ricevute — 258,17 col netto gia'
// arrotondato, 258,19 col netto intero — corrispondono esattamente alle
// due ipotesi, e solo questa le spiega tutte e due.
import { describe, it, expect } from "vitest";
import { righeFattura, nettoPiuVicinoAlLordo } from "../supabase/functions/_shared/righe-fattura.js";

const c = (x) => Math.round(x * 100);
// il conto che fa Fatture in Cloud, in centesimi
function comeFaFic(righe, aliquotaPct) {
  const netto = righe.reduce((s, r) => s + Math.round(c(r.prezzoNetto * r.quantita)), 0);
  const iva = Math.round(netto * (aliquotaPct / 100));
  return { netto, iva, lordo: netto + iva };
}

// la vendita vera che ha rifiutato tre volte: POS-1792504763483
const ARETANO = [
  { nome: "Ago 36 punte Universale", quantita: 3, prezzo: 119.7 / 3 },
  { nome: "Ago Nano Needling", quantita: 3, prezzo: 119.7 / 3 },
  { nome: "Burro dermatologico 125ml", quantita: 1, prezzo: 27.3 },
  { nome: "Sensitive Cream 50 ml", quantita: 1, prezzo: 48.3 },
];

describe("le righe della fattura", () => {
  it("sulla vendita che ha rifiutato tre volte il totale torna", () => {
    const f = righeFattura(ARETANO, 315, 22);
    const fic = comeFaFic(f.righe, 22);
    expect(fic.lordo).toBe(c(315));
    expect(fic.netto).toBe(c(258.2));
    expect(fic.iva).toBe(c(56.8));
    // e quello che si scrive sulla fattura come pagato e' il suo totale
    expect(f.totale).toBe(315);
    expect(f.scartoDallIncassato).toBe(0);
  });

  it("e il conto di FIC rifatto sui due rifiuti veri da' i numeri che ha dato lui", () => {
    // col netto unitario arrotondato: 258,17 (primo rifiuto)
    const arrotondate = ARETANO.map((r) => ({
      nome: r.nome, quantita: r.quantita,
      prezzoNetto: Math.round((r.prezzo / 1.22) * 100) / 100,
    }));
    expect(comeFaFic(arrotondate, 22).netto).toBe(c(258.17));
    // col netto unitario intero: 258,19 (secondo rifiuto)
    const intere = ARETANO.map((r) => ({
      nome: r.nome, quantita: r.quantita, prezzoNetto: r.prezzo / 1.22,
    }));
    expect(comeFaFic(intere, 22).netto).toBe(c(258.19));
  });

  it("i nomi e le quantità restano quelli, non si impasticciano", () => {
    const { righe } = righeFattura(ARETANO, 315, 22);
    expect(righe.map((r) => r.nome)).toEqual(ARETANO.map((r) => r.nome));
    expect(righe.map((r) => r.quantita)).toEqual([3, 3, 1, 1]);
  });

  it("quello che manca nelle righe diventa una riga sua, non si spalma", () => {
    // spedizione da 7 €: il carrello fa 315, incassati 322
    const f = righeFattura(ARETANO, 322, 22);
    const righe = f.righe;
    expect(righe.length).toBe(5);
    expect(righe[4].nome).toBe("Spese di spedizione");
    // 322,00 e' uno dei totali che NON esistono: 321,99 e 322,01 si
    // fanno, 322,00 no. Il documento sta a un centesimo e torna con se'
    expect(comeFaFic(righe, 22).lordo).toBe(c(f.totale));
    expect(Math.abs(comeFaFic(righe, 22).lordo - c(322))).toBeLessThanOrEqual(1);
    // e i prodotti non si sono mossi di un centesimo in più del dovuto
    const soli = righeFattura(ARETANO, 315, 22).righe;
    for (let i = 0; i < 4; i += 1) {
      expect(Math.abs(righe[i].prezzoNetto - soli[i].prezzoNetto)).toBeLessThan(0.02);
    }
  });

  it("due centesimi di scarto restano arrotondamento e non diventano una riga", () => {
    const { righe } = righeFattura(ARETANO, 315.02, 22);
    expect(righe.length).toBe(4);
    expect(comeFaFic(righe, 22).lordo).toBe(c(315.02));
  });

  it("su duemila carrelli a caso il totale torna sempre", () => {
    // il seme e' fisso: una prova che fallisce una volta su mille e poi
    // non si riproduce non serve a niente
    let seme = 20261020;
    const caso = (n) => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme % n; };
    const falliti = [];
    for (let giro = 0; giro < 2000; giro += 1) {
      const quante = 1 + caso(6);
      const prodotti = [];
      for (let i = 0; i < quante; i += 1) {
        const quantita = 1 + caso(5);
        // prezzi lordi come quelli veri: da 1,90 a 499,90
        const lordoUnitario = (190 + caso(49800)) / 100;
        prodotti.push({ nome: `Prodotto ${i}`, quantita, prezzo: lordoUnitario });
      }
      const incassato = Math.round(prodotti.reduce((s, r) => s + r.prezzo * r.quantita, 0) * 100) / 100;
      const f = righeFattura(prodotti, incassato, 22);
      const fic = comeFaFic(f.righe, 22);
      // il documento deve essere coerente con se' stesso…
      if (fic.lordo !== c(f.totale)) falliti.push({ incassato, documento: f.totale, ficDice: fic.lordo / 100 });
      // …e non allontanarsi dall'incasso piu' di un centesimo
      if (Math.abs(fic.lordo - c(incassato)) > 1) falliti.push({ incassato, uscito: fic.lordo / 100 });
    }
    expect(falliti).toEqual([]);
  });

  it("vale anche al 10% e al 4%", () => {
    for (const aliquota of [10, 4, 22]) {
      for (const incassato of [315, 9.9, 1234.56, 0.5, 777.77]) {
        const f = righeFattura([{ nome: "X", quantita: 1, prezzo: incassato }], incassato, aliquota);
        const fic = comeFaFic(f.righe, aliquota);
        expect(fic.lordo).toBe(c(f.totale));
        expect(Math.abs(fic.lordo - c(incassato))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("quando il totale esiste lo trova, quando non esiste resta a un centesimo", () => {
    // NON TUTTI I TOTALI ESISTONO: l'IVA e' round(imponibile × 0,22), e
    // quella mappa salta. 315,00 si fa, 315,01 no. Su 200.000 centesimi
    // il 18% e' irraggiungibile, e inseguirli voleva dire farsi
    // rifiutare il documento una volta su sei.
    let mai = 0;
    for (let lordo = 1; lordo <= 200000; lordo += 1) {
      const netto = nettoPiuVicinoAlLordo(lordo, 0.22);
      const uscito = netto + Math.round(netto * 0.22);
      expect(Math.abs(uscito - lordo)).toBeLessThanOrEqual(1);
      if (uscito !== lordo) mai += 1;
    }
    // e quando non esiste si fattura di meno, non di piu'
    expect(nettoPiuVicinoAlLordo(31501, 0.22) + Math.round(nettoPiuVicinoAlLordo(31501, 0.22) * 0.22)).toBe(31500);
    expect(mai).toBeGreaterThan(0);
    expect(mai / 200000).toBeLessThan(0.2);
  });

  it("senza righe non inventa niente", () => {
    expect(righeFattura([], 100, 22).righe).toEqual([]);
    expect(righeFattura(null, 100, 22).righe).toEqual([]);
  });
});
