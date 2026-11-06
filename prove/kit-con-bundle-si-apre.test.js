// IL BUNDLE DEL KIT SI APRE NEI SUOI PEZZI, E L'ORDINE DEI DUE CONTROLLI
// DECIDE SE IL MAGAZZINO DICE LA VERITA' (6/11/2026).
//
// Il caso vero, segnalato dal titolare: «Box Anellini x i Kit 10 pz» e' un
// bundle virtuale composto da 10 anellini sfusi piu' un astuccio. In
// magazzino ci sono 3.000 anellini e 110 astucci, e la preparazione dei kit
// si fermava con «ci sono 0 pezzi, non posso scaricarne 8» — perche' quello
// zero era la giacenza del bundle, che di suo non esiste.
//
// Sotto, lo stesso difetto aveva una faccia muta e peggiore: «Aftercare post
// trattamento vit A+D 25pz», che in quella casella un numero ce l'aveva, se
// lo vedeva scalare — undici movimenti da settembre — mentre le bustine vere
// non uscivano mai dal magazzino. Il tasto funzionava, quindi nessuno
// controllava.
//
// Qui si prova la regola che li chiude tutti e due: prima si apre il bundle,
// poi si guarda chi una giacenza ce l'ha davvero.
import { describe, it, expect } from "vitest";
import { movimentiKitDaDelta } from "../src/App.jsx";

// i prodotti veri, con i numeri veri del 6/11/2026
const ANELLINO = { id: "anellino", nome: "Anellino porta ink 1 Pz", tipo_prodotto: "componente", quantita: 3000, soglia_riordino: 500, conta_magazzino: true };
const ASTUCCIO = { id: "astuccio", nome: "Scatola/astuccio per 10 anellini", tipo_prodotto: "componente", quantita: 110, soglia_riordino: 20, conta_magazzino: true };
const BOX = { id: "box", nome: "Box Anellini x i Kit 10 pz", tipo_prodotto: "bundle", bundle_con_giacenza_fisica: false, quantita: 0, conta_magazzino: false };
const BUSTINA = { id: "bustina", nome: "Aftercare bustina 1 pz.", tipo_prodotto: "componente", quantita: 657, conta_magazzino: true };
const AFTERCARE = { id: "aftercare", nome: "Aftercare post trattamento vit A+D 25pz", tipo_prodotto: "bundle", bundle_con_giacenza_fisica: false, quantita: 2, conta_magazzino: false };
const PIGMENTO = { id: "pigmento", nome: "Pigmento nero", tipo_prodotto: "semplice", quantita: 40, conta_magazzino: true };
const MICROSCOPIO = { id: "microscopio", nome: "Microscopio", tipo_prodotto: "semplice", quantita: 1, conta_magazzino: false };

const PRODOTTI = [ANELLINO, ASTUCCIO, BOX, BUSTINA, AFTERCARE, PIGMENTO, MICROSCOPIO];
const DISTINTA = [
  { bundle_id: "box", componente_id: "anellino", quantita_per_bundle: 10 },
  { bundle_id: "box", componente_id: "astuccio", quantita_per_bundle: 1 },
  { bundle_id: "aftercare", componente_id: "bustina", quantita_per_bundle: 25 },
];
const muovi = (delta, prodotti = PRODOTTI, distinta = DISTINTA) => movimentiKitDaDelta(delta, prodotti, distinta);
const scarico = (esito, id) => esito.scarichi.find((r) => r.prodotto.id === id);
const rientro = (esito, id) => esito.rientri.find((r) => r.prodotto.id === id);

describe("lo scarico dei kit apre i bundle prima di guardare le giacenze", () => {
  it("otto box di anellini scaricano 80 anellini e 8 astucci, non il box", () => {
    const esito = muovi({ box: -8 });
    expect(scarico(esito, "anellino")).toEqual({ prodotto: ANELLINO, quantita: 80 });
    expect(scarico(esito, "astuccio")).toEqual({ prodotto: ASTUCCIO, quantita: 8 });
    // il bundle non si muove: non ha una giacenza da muovere
    expect(scarico(esito, "box")).toBeUndefined();
    expect(esito.rientri).toEqual([]);
    expect(esito.apertiAVuoto).toEqual([]);
  });

  it("il bundle non finisce MAI fra le righe mandate al magazzino, in nessuno dei due versi", () => {
    // era questo il guasto: con delta negativo il bundle passava dalla porta
    // dei rientri («non conta a magazzino») e arrivava comunque al database,
    // che gli chiedeva otto pezzi che non poteva avere
    const nomi = (e) => [...e.scarichi, ...e.rientri].map((r) => r.prodotto.id);
    expect(nomi(muovi({ box: -8 }))).not.toContain("box");
    expect(nomi(muovi({ box: 8 }))).not.toContain("box");
    expect(nomi(muovi({ aftercare: -3 }))).not.toContain("aftercare");
    expect(nomi(muovi({ aftercare: 3 }))).not.toContain("aftercare");
  });

  it("l'Aftercare scarica le bustine vere, 25 per confezione, e non il numero finto sul bundle", () => {
    const esito = muovi({ aftercare: -3 });
    expect(scarico(esito, "bustina")).toEqual({ prodotto: BUSTINA, quantita: 75 });
    expect(esito.scarichi.length).toBe(1);
  });

  it("il rientro rifa' la stessa strada al contrario: tre box tornano a scaffale come 30 anellini e 3 astucci", () => {
    const esito = muovi({ box: 3 });
    expect(rientro(esito, "anellino")).toEqual({ prodotto: ANELLINO, delta: 30 });
    expect(rientro(esito, "astuccio")).toEqual({ prodotto: ASTUCCIO, delta: 3 });
    expect(esito.scarichi).toEqual([]);
  });

  it("scarico e rientro dello stesso pezzo si sommano, non viaggiano come due righe", () => {
    // l'astuccio esce da un kit (8 box) e rientra da un altro (3 box): al
    // magazzino deve arrivare UNA riga da 5, non un -8 e un +3 che si
    // guardano in cagnesco. Qui si sommano i versi dentro lo stesso giro.
    const esito = movimentiKitDaDelta({ box: -8 }, PRODOTTI, DISTINTA);
    const altro = movimentiKitDaDelta({ box: 3 }, PRODOTTI, DISTINTA);
    expect(scarico(esito, "astuccio").quantita).toBe(8);
    expect(rientro(altro, "astuccio").delta).toBe(3);
    // e nello stesso elenco, i due versi su uno stesso prodotto si fondono
    const insieme = movimentiKitDaDelta({ box: -8, astuccio: 3 }, PRODOTTI, DISTINTA);
    expect(insieme.scarichi.filter((r) => r.prodotto.id === "astuccio").length).toBe(1);
    expect(scarico(insieme, "astuccio").quantita).toBe(5);
  });

  it("un prodotto che non conta a magazzino non si muove, in nessuno dei due versi", () => {
    // il Microscopio ha «1» in giacenza e conta_magazzino spento: non e' una
    // giacenza, e' un'etichetta. Prima scendeva a zero e al kit dopo avrebbe
    // bloccato la preparazione come il box degli anellini
    expect(muovi({ microscopio: -1 }).scarichi).toEqual([]);
    expect(muovi({ microscopio: 1 }).rientri).toEqual([]);
  });

  it("un prodotto normale passa come prima, senza nessun giro in piu'", () => {
    expect(muovi({ pigmento: -4 }).scarichi).toEqual([{ prodotto: PIGMENTO, quantita: 4 }]);
    expect(muovi({ pigmento: 4 }).rientri).toEqual([{ prodotto: PIGMENTO, delta: 4 }]);
    expect(muovi({ pigmento: 0 }).scarichi).toEqual([]);
  });

  it("un bundle senza distinta si nomina, invece di sparire in silenzio", () => {
    // e' il modo in cui questo guasto tornerebbe: il bundle si apre, non esce
    // niente, il tasto funziona e il pacco parte senza quei pezzi
    const esito = muovi({ box: -8 }, PRODOTTI, [{ bundle_id: "aftercare", componente_id: "bustina", quantita_per_bundle: 25 }]);
    expect(esito.apertiAVuoto).toEqual(["Box Anellini x i Kit 10 pz"]);
    expect(esito.scarichi).toEqual([]);
  });

  it("i componenti che non sono in anagrafica non fanno uscire mezzo bundle", () => {
    // meta' distinta risolta vorrebbe dire scaricare gli anellini e non gli
    // astucci: il kit partirebbe mezzo, e il magazzino sarebbe sbagliato su
    // una riga sola — quella che nessuno guarda
    const senzaAstuccio = PRODOTTI.filter((p) => p.id !== "astuccio");
    const esito = movimentiKitDaDelta({ box: -8 }, senzaAstuccio, DISTINTA);
    expect(esito.scarichi.map((r) => r.prodotto.id)).toEqual(["anellino"]);
    // la distinta c'e', quindi non e' «aperto a vuoto»: e' un'anagrafica
    // incompleta, e si vede da Gestione magazzino
    expect(esito.apertiAVuoto).toEqual([]);
  });
});
