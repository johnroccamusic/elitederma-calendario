// IL REFERRAL DELLE MASTER DURA UN MESE.
// Il primo del mese ne nasce uno nuovo, il vecchio si spegne e sparisce.
// Qui le regole che decidono cosa fare: il mese di Roma e non di Londra,
// chi ruota, chi no, e quale codice si mostra.
import { describe, it, expect } from "vitest";
import {
  giornoRoma, ultimoGiornoDelMese, primoDelMeseDopo, eReferralPersonale,
  referralDiOggi, pianoDelGiorno, rigaCodiceNuovo,
} from "../supabase/functions/_shared/referralMensile.js";

const ANDREA = "m-andrea";
const TOMMASO = "m-tommaso";
const referral = (over = {}) => ({
  id: "r1", codice: "ap47u9", master_id: ANDREA, corsi_date_id: null, serie_regole: null,
  ambito: "tutto", categorie_ids: null, prodotti_ids: null, stato: "attivo",
  valido_da: null, valido_fino_a: null, woo_coupon_id: 10231, created_at: "2026-09-03T10:00:00Z",
  tipo_sconto: "percent", base_sconto: "lordo", valore: 4.38, tipo_regola_sconto: "fasce",
  fasce_sconto: [{ da: 0, a: 16.5, percentuale: 0 }], utilizzi_max_per_utente: 1, non_cumulabile: true,
  ...over,
});

describe("il mese e' quello di Roma", () => {
  it("a mezzanotte e cinque del primo, in Italia e' gia' il mese nuovo", () => {
    // 31/10 23:05 UTC = 01/11 00:05 a Roma (ora solare)
    expect(giornoRoma(new Date("2026-10-31T23:05:00Z"))).toBe("2026-11-01");
    // 31/05 22:05 UTC = 01/06 00:05 a Roma (ora legale)
    expect(giornoRoma(new Date("2026-05-31T22:05:00Z"))).toBe("2026-06-01");
    expect(giornoRoma(new Date("2026-10-31T22:05:00Z"))).toBe("2026-10-31");
  });
  it("fine mese e scadenza sul sito", () => {
    expect(ultimoGiornoDelMese("2026-10-28")).toBe("2026-10-31");
    expect(ultimoGiornoDelMese("2028-02-03")).toBe("2028-02-29");
    expect(ultimoGiornoDelMese("2026-11-01")).toBe("2026-11-30");
    // WooCommerce spegne il coupon alle 00:00 del giorno scritto
    expect(primoDelMeseDopo("2026-10-28")).toBe("2026-11-01");
    expect(primoDelMeseDopo("2026-12-15")).toBe("2027-01-01");
  });
});

describe("cosa ruota e cosa no", () => {
  it("il codice d'acquisto, need30 e i codici d'aula restano fuori", () => {
    expect(eReferralPersonale(referral())).toBe(true);
    expect(eReferralPersonale(referral({ serie_regole: "acquisto_master" }))).toBe(false);
    expect(eReferralPersonale(referral({ master_id: TOMMASO, ambito: "categorie", categorie_ids: [77] }))).toBe(false);
    expect(eReferralPersonale(referral({ corsi_date_id: "cd-1" }))).toBe(false);
    expect(eReferralPersonale(referral({ master_id: null }))).toBe(false);
  });

  it("il 28 ottobre: i codici di sempre prendono la fine del mese, niente nasce e niente muore", () => {
    const piano = pianoDelGiorno([referral()], "2026-10-28");
    expect(piano.adottare.map((c) => c.codice)).toEqual(["ap47u9"]);
    expect(piano.ruotare).toEqual([]);
    expect(piano.ritirare).toEqual([]);
    expect(piano.validoFinoA).toBe("2026-10-31");
    expect(piano.scadenzaSito).toBe("2026-11-01");
  });

  it("il 31 ottobre il codice vale ancora", () => {
    const piano = pianoDelGiorno([referral({ valido_fino_a: "2026-10-31" })], "2026-10-31");
    expect(piano.ruotare).toEqual([]);
    expect(piano.ritirare).toEqual([]);
  });

  it("il primo novembre: nasce il nuovo, si ritira il vecchio", () => {
    const vecchio = referral({ valido_fino_a: "2026-10-31" });
    const piano = pianoDelGiorno([vecchio], "2026-11-01");
    expect(piano.ruotare).toHaveLength(1);
    expect(piano.ruotare[0].masterId).toBe(ANDREA);
    expect(piano.ruotare[0].modello.codice).toBe("ap47u9");
    expect(piano.ritirare.map((c) => c.codice)).toEqual(["ap47u9"]);
    expect(piano.validoFinoA).toBe("2026-11-30");
  });

  it("se il nuovo c'e' gia' (giro ripetuto), si ritira il vecchio e basta", () => {
    const vecchio = referral({ valido_fino_a: "2026-10-31" });
    const nuovo = referral({ id: "r2", codice: "ap88kk", valido_fino_a: "2026-11-30", woo_coupon_id: 11000 });
    const piano = pianoDelGiorno([vecchio, nuovo], "2026-11-01");
    expect(piano.ruotare).toEqual([]);
    expect(piano.ritirare.map((c) => c.codice)).toEqual(["ap47u9"]);
  });

  it("un codice gia' ritirato non torna nel piano", () => {
    const piano = pianoDelGiorno([referral({ valido_fino_a: "2026-10-31", stato: "scaduto" })], "2026-11-01");
    expect(piano.ruotare).toEqual([]);
    expect(piano.ritirare).toEqual([]);
    expect(piano.adottare).toEqual([]);
  });

  it("chi e' rimasta senza codice valido torna nel piano al giro dopo", () => {
    // il nuovo non e' nato (sito giu'): il vecchio non si ritira, e da
    // lui il giro dopo copia l'accordo e riprova
    const vecchio = referral({ valido_fino_a: "2026-10-31" });
    expect(pianoDelGiorno([vecchio], "2026-11-01").ruotare).toHaveLength(1);
    expect(pianoDelGiorno([vecchio], "2026-11-02").ruotare).toHaveLength(1);
  });
});

describe("quale codice si mostra", () => {
  it("quello del mese, non il ritirato e non il codice d'acquisto", () => {
    const coupon = [
      referral({ valido_fino_a: "2026-10-31", stato: "scaduto" }),
      referral({ id: "r2", codice: "ap88kk", valido_fino_a: "2026-11-30" }),
      referral({ id: "a1", codice: "ap683q", serie_regole: "acquisto_master" }),
    ];
    expect(referralDiOggi(coupon, ANDREA, "2026-11-10").codice).toBe("ap88kk");
  });
  it("finito il mese senza un nuovo, non c'e' niente da mostrare", () => {
    expect(referralDiOggi([referral({ valido_fino_a: "2026-10-31" })], ANDREA, "2026-11-01")).toBe(null);
  });
  it("nell'istante in cui sono accesi tutti e due, vince il nuovo", () => {
    const coupon = [
      referral({ valido_fino_a: "2026-11-30", codice: "vecchio" }),
      referral({ id: "r2", codice: "nuovo", valido_fino_a: "2026-12-31" }),
    ];
    expect(referralDiOggi(coupon, ANDREA, "2026-11-30").codice).toBe("nuovo");
  });
});

describe("il codice nuovo", () => {
  it("copia l'accordo, cambia codice e scadenza, nasce bozza", () => {
    const riga = rigaCodiceNuovo(referral(), "ap88kk", "2026-11-30", "ANDREA PAURA");
    expect(riga).toMatchObject({
      codice: "ap88kk", valido_fino_a: "2026-11-30", valido_da: null, stato: "bozza",
      master_id: ANDREA, valore: 4.38, tipo_regola_sconto: "fasce",
      utilizzi_max_per_utente: 1, non_cumulabile: true, ambito: "tutto", generato_da_cron: false,
    });
    expect(riga.fasce_sconto).toEqual(referral().fasce_sconto);
    expect(riga.descrizione).toBe("Referral — ANDREA PAURA");
  });
});
