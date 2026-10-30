// UN IMPEGNO IN CONTANTI RINVIATO DAL CORSO VALE QUELLO CHE IL RIEPILOGO
// DICE OGGI, NON QUELLO CHE DICEVA IL GIORNO DEL RINVIO.
//
// Udine, LAMINAZIONE BASE del 28/10/2026: compenso master 300 €, diviso a
// metà di default. «Disponi pagamenti» ha rinviato 150 € di contanti allo
// scadenziario; poi il bonifico è stato portato a 300 e il cash a 0, ma
// l'impegno dei 150 è rimasto aperto, e lo scadenziario lo mostrava come
// dovuto accanto ai 300. Trovato dal titolare il 30/10/2026.
import { describe, it, expect } from "vitest";
import { calcolaVociScadenziario, vociCashRinviate } from "../src/App.jsx";

const CLASSE = "f74559cf-0000-0000-0000-000000000001";
const MASTER = { id: "m1", nome: "ANGELICA BURELLI", iban: "IT00X" };
const base = {
  // due allieve: la fascia 1-4 vale 300 € al giorno, un giorno di corso
  iscritti: [{ id: "a1", corso_data_id: CLASSE }, { id: "a2", corso_data_id: CLASSE }], corsiDateDocenti: [], master: [MASTER], assistente: [], assistenteCorsi: [], leva: [],
  location: [], hotel: [], categorieGruppi: [], spese: [], quoteVenditoriSplit: [], impegnoTabella: [], locationPrezzi: [],
  masterCorsi: [{ master_id: "m1", corso_id: "c1", fasce_compenso: [{ da: 1, a: 4, compenso: 300 }] }],
};
const classe = (split) => ({ id: CLASSE, corso_id: "c1", master_id: "m1", data_inizio: "2026-10-28", data_fine: "2026-10-28", ...split });
const IMPEGNO = { id: "i1", origine_id: CLASSE, chiave_origine: `cash_master_${CLASSE}`, descrizione: "Costo Master — ANGELICA BURELLI — contanti non coperti", importo_previsto: 150, importo_coperto: 0, stato: "aperto", data_prevista: "2026-10-28" };

describe("il cash rinviato segue il Riepilogo", () => {
  it("con il compenso tutto a bonifico, i 150 rinviati non sono più dovuti", () => {
    const corsiDate = [classe({ quota_bonifico: 300, quota_cash: 0 })];
    const { cashRicalcolati, daPagareVirtuali } = calcolaVociScadenziario({ ...base, corsiDate });
    expect(cashRicalcolati.get(`cash_master_${CLASSE}`)).toBe(0);
    // la parte a bonifico vale 300, una volta sola
    expect(daPagareVirtuali.filter((r) => r.tipo === "master").map((r) => r.totale)).toEqual([300]);
    const [riga] = vociCashRinviate({ impegnoTabella: [IMPEGNO], corsiDate, categorieGruppi: [], cashRicalcolati });
    expect(riga.totale).toBe(0);
    expect(riga.nonPiuDovuto).toBe(true);
    expect(riga.importoScritto).toBe(150);
    expect(riga.oggetto).toContain("non è più dovuto");
  });
  it("con il compenso ancora a metà, i 150 restano dovuti", () => {
    const corsiDate = [classe({ quota_bonifico: null, quota_cash: null })];
    const { cashRicalcolati } = calcolaVociScadenziario({ ...base, corsiDate });
    const [riga] = vociCashRinviate({ impegnoTabella: [IMPEGNO], corsiDate, categorieGruppi: [], cashRicalcolati });
    expect(riga.totale).toBe(150);
    expect(riga.nonPiuDovuto).toBe(false);
  });
  it("se il Riepilogo cambia la cifra, lo scadenziario la segue e lo dice", () => {
    const corsiDate = [classe({ quota_bonifico: 200, quota_cash: 100 })];
    const { cashRicalcolati } = calcolaVociScadenziario({ ...base, corsiDate });
    const [riga] = vociCashRinviate({ impegnoTabella: [IMPEGNO], corsiDate, categorieGruppi: [], cashRicalcolati });
    expect(riga.totale).toBe(100);
    expect(riga.oggetto).toContain("rinviata per 150,00 €");
  });
  it("un impegno già coperto in parte tiene la cifra scritta", () => {
    const corsiDate = [classe({ quota_bonifico: 300, quota_cash: 0 })];
    const { cashRicalcolati } = calcolaVociScadenziario({ ...base, corsiDate });
    const [riga] = vociCashRinviate({ impegnoTabella: [{ ...IMPEGNO, importo_coperto: 50, stato: "parzialmente_coperto" }], corsiDate, categorieGruppi: [], cashRicalcolati });
    expect(riga.totale).toBe(150);
    expect(riga.nonPiuDovuto).toBe(false);
  });
});
