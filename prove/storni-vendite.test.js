// RESI, ANNULLAMENTI E CAMBI: la riga negativa eredita corso, evento, metodo
// e fattura dalla vendita originale, cosi' busta, cassa, eventi e IVA la
// compensano. Regola del titolare (31/10/2026): una busta GIA' CHIUSA non si
// tocca — il rimborso esce dalla cassa nel giorno in cui si fa.
import { describe, it, expect } from "vitest";
import "./preparazione.js";
import { datiEreditatiDallaVendita, venditeDellaPrimaBusta, contiAppendici, ivaTrimestraleAnno, FUORI_BUSTA } from "../src/App.jsx";

const CD = { id: "cd1" };
const VENDITA = { id: "v1", tipo_movimento: "vendita", corso_data_id: "cd1", evento_id: null, metodo_pagamento: "contanti", richiede_fattura: false, busta_numero: null, totale: 100, totale_iva: 0, data_ordine: "2026-10-10T10:00:00" };
const storno = (originale, tipo = "annullamento", totale = -100) => ({
  id: "s1", tipo_movimento: tipo, vendita_collegata_id: originale.id, totale, totale_iva: 0, data_ordine: "2026-10-12T10:00:00",
  ...datiEreditatiDallaVendita(originale),
});

describe("datiEreditatiDallaVendita", () => {
  it("copia corso, evento, metodo e fattura dalla vendita originale", () => {
    const e = datiEreditatiDallaVendita({ ...VENDITA, evento_id: "ev1", richiede_fattura: true, metodo_pagamento: "pos" });
    expect(e).toMatchObject({ corso_data_id: "cd1", evento_id: "ev1", metodo_pagamento: "pos", richiede_fattura: true, busta_numero: null });
  });
  it("busta ancora aperta: la riga negativa resta nella busta (busta_numero vuoto)", () => {
    expect(datiEreditatiDallaVendita(VENDITA).busta_numero).toBeNull();
  });
  it("vendita gia' in una busta CHIUSA (numero valorizzato): la riga esce da ogni busta", () => {
    expect(datiEreditatiDallaVendita({ ...VENDITA, busta_numero: 1 }).busta_numero).toBe(FUORI_BUSTA);
    expect(datiEreditatiDallaVendita({ ...VENDITA, busta_numero: 2 }).busta_numero).toBe(FUORI_BUSTA);
  });
  it("una vendita al banco senza corso o con carta non e' mai 'in busta'", () => {
    expect(datiEreditatiDallaVendita({ ...VENDITA, corso_data_id: null, busta_numero: 1 }).busta_numero).toBeNull();
    expect(datiEreditatiDallaVendita({ ...VENDITA, metodo_pagamento: "pos", busta_numero: 1 }).busta_numero).toBeNull();
  });
});

describe("la busta compensa l'annullo finche' e' aperta, e non lo vede quando e' chiusa", () => {
  const somma = (l) => l.reduce((s, v) => s + (v.totale || 0), 0);
  it("busta aperta: vendita + annullo = 0", () => {
    const righe = [VENDITA, storno(VENDITA)];
    expect(somma(venditeDellaPrimaBusta(righe, CD))).toBe(0);
  });
  it("busta aperta: un reso parziale toglie solo la sua parte", () => {
    expect(somma(venditeDellaPrimaBusta([VENDITA, storno(VENDITA, "reso", -30)], CD))).toBe(70);
  });
  it("busta chiusa: l'annullo non tocca la busta ne' le appendici", () => {
    const chiusa = { ...CD, busta_rientrata_il: "2026-10-11" };
    const originale = { ...VENDITA, busta_numero: 1 };
    const righe = [originale, storno(originale)];
    expect(somma(venditeDellaPrimaBusta(righe, chiusa))).toBe(100); // congelata
    const { aperta, chiuse } = contiAppendici({ cd: chiusa, venditeShop: righe, spese: [], buste: [] });
    expect(aperta.vendite.length).toBe(0);
    expect(chiuse.length).toBe(0);
  });
  it("busta chiusa, vendita nell'appendice ancora aperta: l'annullo si compensa li'", () => {
    const chiusa = { ...CD, busta_rientrata_il: "2026-10-11" };
    const originale = { ...VENDITA, busta_numero: null };
    const { aperta } = contiAppendici({ cd: chiusa, venditeShop: [originale, storno(originale)], spese: [], buste: [] });
    expect(aperta.contanti).toBe(0);
  });
});

describe("l'IVA compensa anche gli annullamenti", () => {
  it("vendita con IVA e suo annullo nello stesso trimestre fanno zero", () => {
    const v = { ...VENDITA, metodo_pagamento: "pos", totale: 122, totale_iva: 22 };
    const a = { ...storno(v, "annullamento", -122), totale_iva: -22 };
    const t = ivaTrimestraleAnno({ anno: 2026, venditeShop: [v, a], spese: [], iscritti: [], corsiDate: [] });
    expect(t.trimestri[3].venditeShop).toBe(0); // ottobre = quarto trimestre
  });
});
