// SCONTARE SUL NETTO E SCONTARE SUL LORDO SONO LA STESSA CIFRA.
//
// L'IVA e' proporzionale: 0,70 × netto × 1,22 fa 0,70 × lordo. Una
// percentuale non cambia secondo il lato da cui la si guarda.
//
// Prima qui si calcolava il 30% DEL NETTO e lo si toglieva DAL LORDO —
// due lati diversi nella stessa operazione — e sui prodotti coperti
// usciva uno sconto del 24,59%. Su un carrello vero da 220,70 € si
// incassavano 187,01 invece di 179,60: 7,41 € di troppo, cioe' esatta-
// mente l'IVA sullo sconto.
import { describe, it, expect } from "vitest";
import { scontoCouponCarrello, percentualeWooEquivalente } from "../src/App.jsx";

// i numeri del carrello del 20/10/2026, quello che ha fatto scoprire il
// guasto: 137,01 € di prodotti needling e 83,69 € di altri
const NEEDLING = { id: "n", prezzo_vendita: 112.303279, aliquota_iva_vendita: 22 };
const ALTRO = { id: "a", prezzo_vendita: 68.598361, aliquota_iva_vendita: 22 };
const perId = { n: NEEDLING, a: ALTRO };
const CARRELLO = [
  { prodottoId: "n", prezzo: 137.01, quantita: 1 },
  { prodottoId: "a", prezzo: 83.69, quantita: 1 },
];
const soloNeedling = (id) => id === "n";

describe("lo sconto sul netto", () => {
  it("vale quanto lo stesso sconto sul lordo", () => {
    const netto = scontoCouponCarrello(CARRELLO, perId, 30, "netto");
    const lordo = scontoCouponCarrello(CARRELLO, perId, 30, "lordo");
    expect(netto).toBe(lordo);
    expect(netto).toBe(66.21);
  });

  it("sui soli prodotti coperti fa 41,10 e non 33,69", () => {
    // 33,69 era il 30% del netto tolto dal lordo: il conto vecchio
    const sconto = scontoCouponCarrello(CARRELLO, perId, 30, "netto", soloNeedling);
    expect(sconto).toBe(41.1);
    // e il totale torna: 220,70 − 41,10
    expect(Math.round((220.70 - sconto) * 100) / 100).toBe(179.60);
  });

  it("e il conto si legge anche dall'altro lato", () => {
    // netto coperto 112,30 scontato del 30% fa 78,61; piu' il netto che
    // non si tocca (68,60) fa l'imponibile; piu' l'IVA fa il totale
    const nettoCoperto = 137.01 / 1.22;
    const imponibile = nettoCoperto * 0.70 + 83.69 / 1.22;
    expect(Math.round(imponibile * 100) / 100).toBe(147.21);
    expect(Math.round(imponibile * 1.22 * 100) / 100).toBe(179.60);
  });

  it("al sito va la stessa percentuale, non una convertita", () => {
    // mandava 24,59%, e il sito scontava meno del banco
    expect(percentualeWooEquivalente(30, "netto", 0)).toBe(30);
    expect(percentualeWooEquivalente(30, "lordo", 0)).toBe(30);
  });
});
