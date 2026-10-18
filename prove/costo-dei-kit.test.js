// IL COSTO DI UN KIT VIENE DALLA SUA DISTINTA.
//
// E se manca il costo di un solo componente, il kit resta SENZA costo: meglio
// "non lo so" che un numero per difetto, che farebbe sembrare il margine piu'
// grasso di quello che e' e regalerebbe sconto e punti su un margine
// inventato. Fino al 18/10/2026 Dettaglio prodotti faceva il contrario.
import { describe, it, expect } from "vitest";
import { conCostoDeiBundle, costoAcquistoDi, marginePercentualeDi } from "../src/App.jsx";

const pigmento = (id, costo) => ({ id, nome: "Pigmento " + id, tipo_prodotto: "semplice", costo_acquisto: costo, prezzo_vendita: 40 });
const KIT = {
  id: "kit", nome: "Kit 3 colori", tipo_prodotto: "bundle", bundle_con_giacenza_fisica: false,
  costo_acquisto: null, prezzo_vendita: 106.47541, aliquota_iva_vendita: 22,
};
const distinta = ["a", "b", "c"].map((c) => ({ bundle_id: "kit", componente_id: c, quantita_per_bundle: 1 }));
const kitDa = (prodotti, righe = distinta) => conCostoDeiBundle([KIT, ...prodotti], righe).find((p) => p.id === "kit");

describe("costo dei kit", () => {
  it("somma i componenti quando la distinta e' intera", () => {
    const kit = kitDa([pigmento("a", 10), pigmento("b", 10), pigmento("c", 10)]);
    expect(costoAcquistoDi(kit)).toBe(30);
    expect(marginePercentualeDi(kit)).toBeCloseTo(71.8, 1);
  });

  it("se manca il costo di un componente, il kit NON ha un costo per difetto", () => {
    const kit = kitDa([pigmento("a", 10), pigmento("b", 10), pigmento("c", null)]);
    expect(costoAcquistoDi(kit)).toBeNull();
    expect(marginePercentualeDi(kit)).toBeNull();
    // la vecchia somma avrebbe detto 20, cioe' un margine del 59% invece di niente
    expect(costoAcquistoDi(kit)).not.toBe(20);
  });

  it("senza distinta non si inventa niente", () => {
    const kit = kitDa([], []);
    expect(costoAcquistoDi(kit)).toBeNull();
  });

  it("un prodotto normale tiene il costo suo", () => {
    const semplice = pigmento("z", 7);
    expect(costoAcquistoDi(semplice)).toBe(7);
  });
});
