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

// LO SCADENZARIO SI ALLINEA DA SÉ (11/11/2026).
//
// Il titolare, vedendo «Costo Alloggio — CASA MANUELA» a zero in fondo
// allo scadenziario: «a cosa serve, se ti ho detto che negli impegni ci
// voglio solo spese collegate alla riga che le generano e un software che
// aggiorna in tempo reale queste spese».
//
// Aveva ragione: l'allineamento del 10/11 lo faceva solo il Riepilogo
// della classe, quindi finché nessuno apriva QUELLA classe il relitto
// restava nello scadenziario — a zero, con scritto «si toglie dal
// Riepilogo», cioè un compito dato a una persona. Ora si allinea anche la
// pagina in cui si guarda, che ha appena rifatto il conto di tutte le
// classi.
//
// Il caso vero: NEEDLING Roma 8-9/11, Casa Manuela, 2 notti, 180 € — il
// pagamento dell'alloggio è passato a bonifico, quindi in contanti oggi
// non è più dovuto niente.
describe("lo scadenziario allinea gli impegni di tutte le classi che ha ricalcolato", () => {
  const CASA_MANUELA = `cash_alloggio_${CLASSE}`;
  const casaManuela = (extra = {}) => ({
    id: "casa", origine_id: CLASSE, chiave_origine: CASA_MANUELA, stato: "aperto",
    descrizione: "Costo Alloggio — CASA MANUELA (RM), per TOMMASO GIUMBINI — contanti non coperti",
    importo_previsto: 180, importo_coperto: 0, ...extra,
  });
  const dalloScadenziario = (impegni, cash, classi) => allineaImpegniAllaClasse({
    impegni, classi: new Set(classi), cashDiOggi: new Map(cash), soloAnnullamenti: true,
  });

  it("annulla la voce che oggi non prevede più contanti", () => {
    const { daAnnullare, daRiscrivere } = dalloScadenziario([casaManuela()], [[CASA_MANUELA, 0]], [CLASSE]);
    expect(daAnnullare).toHaveLength(1);
    expect(daAnnullare[0].impegno.id).toBe("casa");
    expect(daAnnullare[0].motivo).toContain("non prevede più contanti");
    expect(daRiscrivere).toEqual([]);
  });

  it("NON riscrive nessun importo: quello lo fa il Riepilogo della classe", () => {
    // due pagine che riscrivono lo stesso numero lo rimbalzerebbero
    // avanti e indietro a ogni visita
    const { daAnnullare, daRiscrivere } = dalloScadenziario([casaManuela()], [[CASA_MANUELA, 90]], [CLASSE]);
    expect(daRiscrivere).toEqual([]);
    expect(daAnnullare).toEqual([]);
  });

  it("una classe che non è stata ricalcolata non si tocca", () => {
    // è il guasto peggiore che si potesse fare: la chiave manca perché
    // quella classe è troppo in là nel tempo, non perché la riga è
    // sparita — annullarla sarebbe cancellare un debito che nessuno ha
    // deciso di cancellare
    const esito = dalloScadenziario([casaManuela()], [], []);
    expect(esito.daAnnullare).toEqual([]);
    expect(esito.intoccabili).toEqual([]);
  });

  it("dentro una classe ricalcolata, una chiave che non c'è è una riga sparita", () => {
    const { daAnnullare } = dalloScadenziario([casaManuela()], [[`cash_master_${CLASSE}`, 200]], [CLASSE]);
    expect(daAnnullare).toHaveLength(1);
    expect(daAnnullare[0].motivo).toContain("non c'è più");
  });

  it("allinea più classi in un colpo, e solo quelle ricalcolate", () => {
    const altroImpegno = { ...casaManuela(), id: "altra", origine_id: ALTRA, chiave_origine: `cash_master_${ALTRA}` };
    const { daAnnullare } = dalloScadenziario(
      [casaManuela(), altroImpegno],
      [[CASA_MANUELA, 0], [`cash_master_${ALTRA}`, 0]],
      [CLASSE],
    );
    expect(daAnnullare.map((x) => x.impegno.id)).toEqual(["casa"]);
  });

  it("quello già coperto in parte resta da togliere a mano, anche da qui", () => {
    const { daAnnullare, intoccabili } = dalloScadenziario([casaManuela({ importo_coperto: 50 })], [[CASA_MANUELA, 0]], [CLASSE]);
    expect(daAnnullare).toEqual([]);
    expect(intoccabili).toHaveLength(1);
    expect(intoccabili[0].motivo).toContain("già stati coperti");
  });

  it("una chiave già pagata come spesa è protetta", () => {
    const esito = dalloScadenziario([casaManuela()], [[CASA_MANUELA, 0]], [CLASSE]);
    expect(esito.daAnnullare).toHaveLength(1);
    const protetto = allineaImpegniAllaClasse({
      impegni: [casaManuela()], classi: new Set([CLASSE]), cashDiOggi: new Map([[CASA_MANUELA, 0]]),
      protette: new Set([CASA_MANUELA]), soloAnnullamenti: true,
    });
    expect(protetto.daAnnullare).toEqual([]);
  });
});
