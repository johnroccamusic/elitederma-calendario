// GLI IMPEGNI SEGUONO LA RIGA CHE LI HA GENERATI, IN TEMPO REALE.
//
// Il titolare, 10/11/2026: «devi vincolare sempre gli impegni di spesa
// indissolubilmente alla riga che li ha generati e modificarli in tempo
// reale, mai lasciare relitti».
//
// Il caso da cui viene: Udine, LAMINAZIONE BASE del 28/10/2026. Compenso
// master 300 €, diviso a metà; «Disponi pagamenti» rinvia 150 € di
// contanti allo scadenziario; poi il bonifico viene portato a 300 e il
// cash a 0. Fino al 30/10 l'importo mostrato seguiva già la riga, ma
// quello scritto restava, e il relitto lo doveva togliere una persona.
import { describe, it, expect } from "vitest";
import { allineaImpegniAllaClasse } from "../src/App.jsx";

const CLASSE = "f74559cf-0000-0000-0000-000000000001";
const ALTRA = "aaaaaaaa-0000-0000-0000-000000000002";
const CHIAVE = `cash_master_${CLASSE}`;
const impegno = (extra = {}) => ({
  id: "i1", origine_id: CLASSE, chiave_origine: CHIAVE, stato: "aperto",
  descrizione: "Costo Master — ANGELICA BURELLI — contanti non coperti",
  importo_previsto: 150, importo_coperto: 0, ...extra,
});
const allinea = (impegni, cash, protette) => allineaImpegniAllaClasse({
  impegni, corsoDataId: CLASSE, cashDiOggi: new Map(cash), protette,
});

describe("un impegno segue la sua riga", () => {
  it("cash a zero: l'impegno si annulla, e dice perché", () => {
    const { daAnnullare, daRiscrivere, intoccabili } = allinea([impegno()], [[CHIAVE, 0]]);
    expect(daRiscrivere).toEqual([]);
    expect(intoccabili).toEqual([]);
    expect(daAnnullare).toHaveLength(1);
    expect(daAnnullare[0].impegno.id).toBe("i1");
    expect(daAnnullare[0].motivo).toContain("non prevede più contanti");
  });

  it("la riga non c'è più: si annulla, con l'altro motivo", () => {
    // una quota di venditore tolta a un'allieva, o il tutor cambiato:
    // la chiave non compare nemmeno fra quelle della classe
    const { daAnnullare } = allinea([impegno()], []);
    expect(daAnnullare).toHaveLength(1);
    expect(daAnnullare[0].motivo).toContain("non c'è più");
  });

  it("cash cambiato: si riscrive l'importo, non si annulla", () => {
    const { daAnnullare, daRiscrivere } = allinea([impegno()], [[CHIAVE, 80]]);
    expect(daAnnullare).toEqual([]);
    expect(daRiscrivere).toEqual([{ impegno: expect.objectContaining({ id: "i1" }), da: 150, a: 80 }]);
  });

  it("cash uguale: non si tocca niente", () => {
    const esito = allinea([impegno()], [[CHIAVE, 150]]);
    expect(esito.daAnnullare).toEqual([]);
    expect(esito.daRiscrivere).toEqual([]);
    expect(esito.intoccabili).toEqual([]);
  });

  it("già coperto in parte: NON si tocca, e si dice quanto è coperto", () => {
    // quei soldi sono in parte usciti davvero: annullarlo o riscriverlo
    // di nascosto vorrebbe dire muovere una cassa da un'altra pagina
    const { daAnnullare, daRiscrivere, intoccabili } = allinea([impegno({ importo_coperto: 50 })], [[CHIAVE, 0]]);
    expect(daAnnullare).toEqual([]);
    expect(daRiscrivere).toEqual([]);
    expect(intoccabili).toHaveLength(1);
    expect(intoccabili[0].motivo).toContain("50");
  });

  it("coperto in parte e riga sparita: resta intoccabile, non annullato", () => {
    const { daAnnullare, intoccabili } = allinea([impegno({ importo_coperto: 50 })], []);
    expect(daAnnullare).toEqual([]);
    expect(intoccabili[0].motivo).toContain("non c'è più");
  });

  it("la quota è già una spesa pagata: la chiave è protetta e non si tocca", () => {
    const esito = allinea([impegno()], [[CHIAVE, 0]], new Set([CHIAVE]));
    expect(esito.daAnnullare).toEqual([]);
    expect(esito.daRiscrivere).toEqual([]);
    expect(esito.intoccabili).toEqual([]);
  });

  it("gli impegni di un'altra classe non si toccano", () => {
    const esito = allinea([impegno({ origine_id: ALTRA })], []);
    expect(esito.daAnnullare).toEqual([]);
    expect(esito.intoccabili).toEqual([]);
  });

  it("gli impegni che non sono contanti del corso non si toccano", () => {
    // location_… e alloggio_… sono la parte a BONIFICO: lì l'importo lo
    // ricalcola lo Scadenzario da sé (importiRicalcolati), e la riga non
    // è un impegno in contanti
    const esito = allinea([impegno({ chiave_origine: `location_${CLASSE}` })], []);
    expect(esito.daAnnullare).toEqual([]);
    expect(esito.intoccabili).toEqual([]);
  });

  it("un impegno già chiuso o annullato resta com'è", () => {
    for (const stato of ["chiuso", "coperto", "annullato"]) {
      const esito = allinea([impegno({ stato })], [[CHIAVE, 0]]);
      expect(esito.daAnnullare).toEqual([]);
      expect(esito.daRiscrivere).toEqual([]);
      expect(esito.intoccabili).toEqual([]);
    }
  });

  it("i centesimi non fanno scattare una riscrittura", () => {
    const esito = allinea([impegno({ importo_previsto: "150.00" })], [[CHIAVE, 150.001]]);
    expect(esito.daRiscrivere).toEqual([]);
  });

  it("il caso di Udine, per intero", () => {
    // 300 di compenso, metà e metà, 150 rinviati; poi tutto a bonifico
    const prima = allinea([impegno()], [[CHIAVE, 150]]);
    expect(prima.daAnnullare).toEqual([]);
    const dopo = allinea([impegno()], [[CHIAVE, 0]]);
    expect(dopo.daAnnullare).toHaveLength(1);
  });
});
