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

// ---------------------------------------------------------------------
// IL MATERIALE DEI KIT E' UNA SPESA DEL CORSO (2/11/2026).
//
// Il kit consegnato all'allieva e' merce comprata: non ha una riga in
// "spese" — si e' comprata prima, a magazzino — ma esce per quella
// classe. Senza, una classe risulta piu' ricca di quanto sia.
import { costoKitDellaClasse } from "../src/App.jsx";

const CLASSE = { id: "cd1", corso_id: "c1" };
const CORSO = { id: "c1" };
const KIT = [{ id: "k1", corso_id: "c1", nome: "KIT BASE" }];
const ALLIEVE = [
  { id: "a1", corso_data_id: "cd1", pacchetto_kit: "KIT BASE" },
  { id: "a2", corso_data_id: "cd1", pacchetto_kit: "KIT BASE" },
];
// un kit da due prodotti: due pigmenti da 10 e un ago da 2,50
const DISTINTA = [
  { kit_id: "k1", tipo: "kit", prodotto_id: "p1", quantita: 2 },
  { kit_id: "k1", tipo: "kit", prodotto_id: "p2", quantita: 1 },
];
const PRODOTTI = [
  { id: "p1", nome: "Pigmento", costo_acquisto: 10 },
  { id: "p2", nome: "Ago 1RL", costo_acquisto: 2.5 },
];

describe("il costo dei kit di una classe", () => {
  it("conta il contenuto dei kit di ogni allieva, al costo d'acquisto", () => {
    const k = costoKitDellaClasse(CLASSE, CORSO, KIT, DISTINTA, [], ALLIEVE, PRODOTTI);
    // 2 allieve x (2 pigmenti da 10 + 1 ago da 2,50) = 45
    expect(k.netto).toBe(45);
    expect(k.pezzi).toBe(6);
    expect(k.senzaCosto).toEqual([]);
  });

  it("un prodotto senza costo d'acquisto resta FUORI e viene nominato", () => {
    // sommare zeri farebbe sembrare la classe piu' redditizia di quello che e'
    const senzaCosto = [{ id: "p1", nome: "Pigmento", costo_acquisto: 10 }, { id: "p2", nome: "Ago 1RL", costo_acquisto: null }];
    const k = costoKitDellaClasse(CLASSE, CORSO, KIT, DISTINTA, [], ALLIEVE, senzaCosto);
    expect(k.netto).toBe(40);
    expect(k.senzaCosto).toContain("Ago 1RL");
  });

  it("chi non ha scelto un pacchetto non porta kit", () => {
    const k = costoKitDellaClasse(CLASSE, CORSO, KIT, DISTINTA, [], [{ id: "a3", corso_data_id: "cd1" }], PRODOTTI);
    expect(k.netto).toBe(0);
    expect(k.pezzi).toBe(0);
  });

  it("entra nelle spese del bilancio, e il guadagno scende di altrettanto", () => {
    const senza = conti();
    const con = conti({ costoKitClasse: 45 });
    expect(con.speseNettePienoIva).toBe(senza.speseNettePienoIva + 45);
    expect(con.margineCorso).toBe(round2(senza.margineCorso - 45));
    expect(con.costoKitClasse).toBe(45);
    // i ricavi non si toccano
    expect(con.ricaviPienoNetto).toBe(senza.ricaviPienoNetto);
  });

  it("senza kit il conto resta quello di prima", () => {
    expect(conti({ costoKitClasse: 0 }).margineCorso).toBe(conti().margineCorso);
  });
});

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
