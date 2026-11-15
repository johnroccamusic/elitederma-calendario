// IL LISTINO RIVENDITORE DICE SU CHE BASE STA OGNI PREZZO (15/11/2026).
//
// Il titolare: «non mi ricordo più se quando si genera il listino del
// rivenditore il suo prezzo è IVA inclusa o IVA esclusa», e poi: «quel
// listino genera una lista che è contraddittoria… dovremmo elencare i
// prezzi per entrambe le colonne IVA esclusa e IVA inclusa».
//
// Era vero: al pubblico si stampava il LORDO, al rivenditore il NETTO,
// e in fondo alla pagina c'era scritto «prezzi IVA inclusa» — falso
// proprio sulla colonna che il rivenditore guarda. Sul Dermografo Horus
// voleva dire 290,16 letti come totale e 354,00 in fattura.
import { describe, it, expect } from "vitest";
import { conIva, notaIvaListino, raggruppaPerReparto } from "../src/prezzi/listinoPdf.js";

// i due dermografi veri, come li restituisce v_prezzi_listini
const HORUS = {
  id: "p1", nome: "Dermografo Horus Elitederma", blocco_ordine: 3, sullo_shop: true,
  pubblico_netto: 491.8, pubblico_lordo: 600, prezzo_rivenditore: 290.16, aliquota_iva: 22,
};
const TEKNA = {
  id: "p2", nome: "Dermografo Tekna Elitederma", blocco_ordine: 3, sullo_shop: true,
  pubblico_netto: 729.51, pubblico_lordo: 890, prezzo_rivenditore: 426.76, aliquota_iva: 22,
};

describe("il lordo del prezzo rivenditore", () => {
  it("è il netto più la sua aliquota, arrotondato al centesimo", () => {
    expect(conIva(290.16, 22)).toBe(354);
    expect(conIva(426.76, 22)).toBe(520.65);
  });

  it("senza aliquota scritta vale il 22%, non zero", () => {
    // un prodotto senza aliquota stamperebbe lo stesso numero in tutte e
    // due le colonne, cioè direbbe che l'IVA non si paga
    expect(conIva(100, null)).toBe(122);
    expect(conIva(100, undefined)).toBe(122);
  });

  it("niente prezzo, niente lordo", () => {
    expect(conIva(null, 22)).toBe(null);
  });

  // lo sconto vero si legge solo confrontando due cifre della stessa
  // base: 600 contro 290,16 ne dice uno che non esiste
  it("sulla stessa base lo sconto del rivenditore è quello vero", () => {
    const scontoSuNetto = 1 - HORUS.prezzo_rivenditore / HORUS.pubblico_netto;
    const scontoApparente = 1 - HORUS.prezzo_rivenditore / HORUS.pubblico_lordo;
    expect(Math.round(scontoSuNetto * 1000) / 10).toBe(41);
    expect(Math.round(scontoApparente * 1000) / 10).toBe(51.6);
  });
});

describe("la nota in fondo alla pagina", () => {
  it("con un'aliquota sola la dice in cifra", () => {
    expect(notaIvaListino([HORUS, TEKNA])).toBe("prezzi in euro, IVA 22%");
  });

  it("con aliquote diverse non ne inventa una", () => {
    expect(notaIvaListino([HORUS, { ...TEKNA, aliquota_iva: 10 }]))
      .toBe("prezzi in euro, IVA secondo l'aliquota di ciascun prodotto");
  });

  it("non dice più «IVA inclusa», che era falso sulla colonna del rivenditore", () => {
    expect(notaIvaListino([HORUS])).not.toContain("inclusa");
  });
});

describe("chi entra nel listino", () => {
  it("resta fuori chi non ha un prezzo rivenditore o non sta sullo shop", () => {
    const reparti = raggruppaPerReparto([
      HORUS, TEKNA,
      { ...HORUS, id: "p3", nome: "Senza prezzo", prezzo_rivenditore: null },
      { ...HORUS, id: "p4", nome: "Solo al banco", sullo_shop: false },
    ]);
    const nomi = reparti.flatMap((r) => r.prodotti.map((p) => p.nome));
    expect(nomi).toEqual(["Dermografo Horus Elitederma", "Dermografo Tekna Elitederma"]);
  });
});
