// «Verifica sul totale»: il terzo modo di pattuire (6/11/2026).
//
// Regola del titolare, parola per parola: «L'henne' funziona cosi'. Costa
// un tot e non e' importante se lo paghi con iva o cash senza iva. Devi
// il totale pattuito. Qualsiasi somma pagata con qualsiasi sistema somma
// per raggiungere il totale.»
//
// Fino al 6/11/2026 quella regola si poteva dire solo sull'intero corso.
// Adesso la puo' dire anche la singola scheda — ma solo per AGGIUNGERLA.
// Queste prove stanno addosso a quel "solo", perche' e' li' che si
// rischiano soldi: se bastasse scegliere «netto» su una scheda di un
// corso che si paga a totale, le iscrizioni gia' salvate cambierebbero
// da sole il residuo che mostrano.
import { describe, it, expect } from "vitest";
import { siVerificaSulTotale } from "../src/App.jsx";

const HENNE = { nome: "HENNE", saldo_su_totale_pagato: true, prezzo_iva_inclusa: true };
const PMU = { nome: "PMU BASE", saldo_su_totale_pagato: false, prezzo_iva_inclusa: false };

describe("siVerificaSulTotale", () => {
  it("un corso normale e una scheda normale: si toglie l'imponibile, come sempre", () => {
    expect(siVerificaSulTotale("netto", PMU)).toBe(false);
    expect(siVerificaSulTotale("lordo", PMU)).toBe(false);
    expect(siVerificaSulTotale(null, PMU)).toBe(false);
  });

  it("la singola scheda puo' accendere la regola su un corso qualunque", () => {
    expect(siVerificaSulTotale("totale", PMU)).toBe(true);
  });

  it("il corso resta il pavimento: una scheda non puo' spegnere la sua regola", () => {
    // le due iscrizioni salvate come 'lordo' e le 189 senza niente stanno
    // tutte qui dentro: nessuna deve cambiare il residuo che mostra
    expect(siVerificaSulTotale("netto", HENNE)).toBe(true);
    expect(siVerificaSulTotale("lordo", HENNE)).toBe(true);
    expect(siVerificaSulTotale(null, HENNE)).toBe(true);
    expect(siVerificaSulTotale(undefined, HENNE)).toBe(true);
  });

  it("una scheda senza corso non inventa la regola", () => {
    expect(siVerificaSulTotale("netto", null)).toBe(false);
    expect(siVerificaSulTotale("totale", null)).toBe(true);
  });

  it("i 550 dell'henne' tornano: il residuo e' zero, non 99,18", () => {
    // 550 pattuiti a prezzo finito, 550 incassati con un metodo che l'IVA
    // ce l'ha (imponibile 450,82). Togliendo l'imponibile la scheda ne
    // chiederebbe ancora 99,18 che nessuno deve.
    const quota = { totale: "550", imponibile: "450.82" };
    const quantoTogliere = (q, sulTotale) => (sulTotale ? Number(q.totale) : Number(q.imponibile));
    expect(550 - quantoTogliere(quota, siVerificaSulTotale("totale", PMU))).toBe(0);
    expect(550 - quantoTogliere(quota, siVerificaSulTotale("netto", PMU))).toBeCloseTo(99.18, 2);
  });
});
