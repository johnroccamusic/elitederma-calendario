// IL BILANCIO DI UNA CLASSE SI LEGGE PRIMA CHE TUTTI ABBIANO PAGATO.
//
// Il riquadro "Incassi" dice quello che e' entrato: il saldo di chi non ha
// ancora pagato non c'e', e finche' il corso non e' finito ogni classe
// sembra in perdita. Chiesto dal titolare il 2/11/2026: sapere se la
// classe e' attiva o passiva sul pattuito, non sull'incassato.
import { describe, it, expect } from "vitest";
import { contiRiepilogoClasse } from "../src/App.jsx";

// due allieve: la prima ha versato l'acconto e deve ancora il saldo (e una
// modella), la seconda ha pagato tutto. Gli imponibili sono quelli scritti
// sulle schede, non uno scorporo rifatto qui.
const ISCRITTI = [
  { acconto_totale: 500, acconto_imponibile: 409.84, acconto_metodo: "Bonifico", saldo_totale: 1500, saldo_imponibile: 1229.51, saldo_metodo: "Bonifico", incassato: false, numero_modelle: 1 },
  { acconto_totale: 500, acconto_imponibile: 409.84, acconto_metodo: "Bonifico", saldo_totale: 1000, saldo_imponibile: 819.67, saldo_metodo: "Bonifico", incassato: true },
];
const conti = (extra = {}) => contiRiepilogoClasse({ listaIscritti: ISCRITTI, totaleSpeseAutomaticheClasse: 1000, speseClasse: [{ totale: 244, imponibile: 200 }], ...extra });

describe("il bilancio del corso", () => {
  it("conta il pattuito di tutti, anche il saldo non ancora incassato", () => {
    const c = conti();
    // quello che e' entrato: l'acconto di tutte e due, il saldo della sola seconda
    expect(c.incassoNetto).toBe(1639.35);
    // quello che la classe vale: i due acconti, i due saldi, la modella
    expect(c.ricaviPienoNetto).toBe(2928.86);
    expect(c.ricaviPienoLordo).toBe(3560);
  });

  it("le spese contano pagate o no, e la classe risulta attiva", () => {
    const c = conti();
    expect(c.speseNettePienoIva).toBe(1200); // 1000 di righe automatiche + 200 di imponibile della spesa
    expect(c.margineCorso).toBe(1728.86);
  });

  it("quando le spese superano il pattuito, la classe e' passiva", () => {
    const c = conti({ totaleSpeseAutomaticheClasse: 3000 });
    expect(c.speseNettePienoIva).toBe(3200);
    expect(c.margineCorso).toBe(-271.14);
  });

  it("una spesa disposta dallo scadenziario non si conta due volte", () => {
    // il suo costo sta gia' in totaleSpeseAutomaticheClasse: qui e' il
    // pagamento della stessa riga, non un costo in piu'
    const c = conti({ speseClasse: [{ totale: 244, imponibile: 200 }, { totale: 1000, imponibile: 1000, origine_scadenziario_chiave: "cash_master_x" }] });
    expect(c.speseNettePienoIva).toBe(1200);
  });

  it("una spesa senza imponibile vale il suo totale", () => {
    const c = conti({ speseClasse: [{ totale: 244 }] });
    expect(c.speseNettePienoIva).toBe(1244);
  });
});
