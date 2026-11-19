// SOPRA LA SOGLIA LO SCONTO DI UN COUPON LO DECIDE IL LISTINO
// RIVENDITORI. 19/11/2026.
//
// Il titolare: «quando faccio un coupon che genera uno sconto del 20%, deve
// seguire cmq i listini dei rivenditori con il 20% di sconto, ovvero il
// tetto è 20 ma non tutto ha 20... da oggi non sarà più possibile creare
// sconti liberi di qualsiasi percentuale perché sopra al 10% subentreranno
// i calcoli che fanno i listini attuali dei rivenditori». E, sulla legge da
// seguire: «il riferimento, la legge deve essere il listino rivenditori».
//
// Fra le due letture possibili ha scelto la PROPORZIONE e non il minimo:
// un coupon al 30% vale tre quinti (30/50) di quello che ogni prodotto può
// cedere. Più la forzatura: «se un giorno decido di mettere il 30% sui
// prodotti di laminazione per sbarazzarmene e quindi venderli sotto prezzo,
// tu mi devi segnalare che io non ho quel margine e io ti devo confermare
// la forzatura».
//
// I numeri di queste prove sono quelli veri del catalogo, letti il
// 19/11/2026: Arizona cede il 50%, il Kit laminazione ciglia il 14,7%,
// N2 Fixa lo 0% (costo 13,93 su 24,80 al pubblico).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  passaDalListino, frazioneDelTetto, scontoListinoPct,
  effettoSulCatalogo, dannoDellaForzatura,
} from "../supabase/functions/_shared/sconto-listino.js";
import { scontoCouponCarrello, scontiPerRigaCarrello } from "../src/App.jsx";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
const TETTO = 50, SOGLIA = 10, RICARICO = 67;

// tre prodotti veri, uno per caso
const ARIZONA = { id: "a", nome: "Arizona", sconto_max_pct: 50, pubblico_lordo: 44.90, pubblico_netto: 36.80, costo: 10 };
const KIT = { id: "k", nome: "Kit laminazione ciglia", sconto_max_pct: 14.7, pubblico_lordo: 234.90, pubblico_netto: 192.54, costo: 98.34 };
const FIXA = { id: "f", nome: "N2 Fixa", sconto_max_pct: 0, pubblico_lordo: 24.80, pubblico_netto: 20.33, costo: 13.93 };

describe("quando comanda il listino", () => {
  it("sotto la soglia lo sconto resta libero", () => {
    expect(passaDalListino({ valore: 9, soglia: SOGLIA })).toBe(false);
    expect(passaDalListino({ valore: 10, soglia: SOGLIA })).toBe(false);
    expect(passaDalListino({ valore: 10.01, soglia: SOGLIA })).toBe(true);
  });

  it("forzato, il listino non comanda più", () => {
    expect(passaDalListino({ valore: 30, soglia: SOGLIA, forzato: true })).toBe(false);
  });

  it("una soglia che non si legge NON apre lo sconto libero", () => {
    // il verso prudente: il contrario vorrebbe dire scontare libero
    // perché una lettura non è andata a buon fine
    expect(passaDalListino({ valore: 30, soglia: null })).toBe(true);
    expect(passaDalListino({ valore: 30, soglia: undefined })).toBe(true);
  });
});

describe("la proporzione, scelta dal titolare", () => {
  it("30 su un tetto di 50 è tre quinti del cedibile", () => {
    expect(frazioneDelTetto(30, 50)).toBe(0.6);
    expect(scontoListinoPct(50, 30, 50)).toBe(30);      // Arizona: il tetto pieno
    expect(scontoListinoPct(14.7, 30, 50)).toBe(8.82);  // il Kit: meno
    expect(scontoListinoPct(0, 30, 50)).toBe(0);        // N2 Fixa: niente
  });

  it("NON è il minimo fra i due, ed è la differenza che ha scelto lui", () => {
    // col minimo il Kit prenderebbe 14,7; con la proporzione 8,82
    expect(scontoListinoPct(14.7, 30, 50)).not.toBe(14.7);
  });

  it("un coupon pari al tetto concede tutto il cedibile", () => {
    expect(scontoListinoPct(14.7, 50, 50)).toBe(14.7);
  });

  it("oltre il tetto non si concede più del cedibile", () => {
    // chiedere più di tutto non è una frazione: è una forzatura, e se un
    // coupon oltre il tetto arrivasse qui il verso sicuro è fermarsi
    expect(frazioneDelTetto(60, 50)).toBe(1);
    expect(scontoListinoPct(14.7, 60, 50)).toBe(14.7);
  });
});

describe("cosa farà il coupon sul catalogo", () => {
  const e = () => effettoSulCatalogo([ARIZONA, KIT, FIXA], { valore: 20, tetto: TETTO });

  it("divide i prodotti in pieno, ridotto e niente", () => {
    const r = e();
    expect(r.quanti).toBe(3);
    expect(r.pieno.map((x) => x.nome)).toEqual(["Arizona"]);
    expect(r.ridotto.map((x) => x.nome)).toEqual(["Kit laminazione ciglia"]);
    expect(r.nessuno.map((x) => x.nome)).toEqual(["N2 Fixa"]);
  });

  it("la media è PESATA sui prezzi, perché è quella che va su WooCommerce", () => {
    // il sito non sa i margini e il coupon porta una percentuale sola:
    // la media pesata è la stessa logica delle fasce
    const r = e();
    const atteso = (44.90 * 20 / 100 + 234.90 * 5.88 / 100 + 0) / (44.90 + 234.90 + 24.80) * 100;
    expect(r.mediaPesata).toBeCloseTo(Math.round(atteso * 100) / 100, 2);
  });
});

describe("quello che costa forzare", () => {
  const d = () => dannoDellaForzatura([ARIZONA, KIT, FIXA], { valore: 30, ricarico: RICARICO });

  it("nomina i prodotti che vanno SOTTO COSTO, coi suoi euro", () => {
    const r = d();
    // N2 Fixa: 20,33 netto − 30% = 14,23, contro un costo di 13,93 →
    // in utile di 30 centesimi, quindi NON sotto costo ma sotto il
    // margine minimo. Sono due cose diverse e si dicono separate.
    expect(r.sottoCosto.map((x) => x.nome)).toEqual([]);
    expect(r.sottoPavimento.map((x) => x.nome)).toContain("N2 Fixa");
  });

  it("al 40% N2 Fixa va sotto costo per davvero, e si dice di quanto", () => {
    const r = dannoDellaForzatura([FIXA], { valore: 40, ricarico: RICARICO });
    expect(r.sottoCosto).toHaveLength(1);
    expect(r.sottoCosto[0].nettoForzato).toBe(12.20);
    expect(r.sottoCosto[0].margine).toBe(-1.73);
    expect(r.perditaPerPezzo).toBe(-1.73);
  });

  it("i peggiori per primi: chi perde più soldi per pezzo", () => {
    const r = dannoDellaForzatura([
      { id: "1", nome: "poco", pubblico_netto: 10, costo: 8 },
      { id: "2", nome: "tanto", pubblico_netto: 200, costo: 180 },
    ], { valore: 30, ricarico: RICARICO });
    expect(r.sottoCosto.map((x) => x.nome)).toEqual(["tanto", "poco"]);
  });

  it("un prodotto senza costo si dice, non si inventa", () => {
    const r = dannoDellaForzatura([{ id: "x", nome: "ignoto", pubblico_netto: 50, costo: null }], { valore: 30 });
    expect(r.senzaCosto).toHaveLength(1);
    expect(r.senzaCosto[0].margine).toBeNull();
    expect(r.sottoCosto).toHaveLength(0);
  });
});

describe("il carrello al banco", () => {
  const prodotti = { a: { id: "a", aliquota_iva_vendita: 22 }, k: { id: "k", aliquota_iva_vendita: 22 }, f: { id: "f", aliquota_iva_vendita: 22 } };
  const cedibili = new Map([["a", 50], ["k", 14.7], ["f", 0]]);
  const listino = { soglia: SOGLIA, tetto: TETTO, forzato: false, cedibili };

  it("ogni riga sconta la sua parte, non la percentuale del coupon", () => {
    const r = scontiPerRigaCarrello({
      carrello: [
        { prodottoId: "a", prezzo: 44.90, quantita: 1 },
        { prodottoId: "k", prezzo: 234.90, quantita: 1 },
        { prodottoId: "f", prezzo: 24.80, quantita: 1 },
      ],
      prodottiPerId: prodotti, subtotale: 304.60,
      couponNum: 30, baseCoupon: "lordo", listinoCoupon: listino,
    });
    expect(r[0].sconto).toBeCloseTo(13.47, 2);   // 30% di 44,90
    expect(r[1].sconto).toBeCloseTo(20.72, 2);   // 8,82% di 234,90
    expect(r[2].sconto).toBe(0);                 // niente margine, niente sconto
  });

  it("senza il listino il coupon sconta piatto, come prima", () => {
    const piatto = scontoCouponCarrello([{ prodottoId: "f", prezzo: 24.80, quantita: 1 }], prodotti, 30, "lordo");
    expect(piatto).toBe(7.44);
  });

  it("forzato, torna piatto anche dove non c'è margine", () => {
    const forzato = scontoCouponCarrello(
      [{ prodottoId: "f", prezzo: 24.80, quantita: 1 }], prodotti, 30, "lordo", null,
      { ...listino, forzato: true },
    );
    expect(forzato).toBe(7.44);
  });

  it("un prodotto fuori dal listino non si sconta, e non si inventa un cedibile", () => {
    // al POS le sole righe senza prodotto in anagrafica sono la
    // spedizione — che non si sconta comunque — e una vendita al corso
    // battuta a mano in tre mesi: misurato prima di scegliere questo verso
    const fuori = scontoCouponCarrello([{ prodottoId: null, prezzo: 6.90, quantita: 1 }], prodotti, 30, "lordo", null, listino);
    expect(fuori).toBe(0);
  });

  it("sotto la soglia il listino non entra in gioco", () => {
    const sotto = scontoCouponCarrello([{ prodottoId: "f", prezzo: 24.80, quantita: 1 }], prodotti, 8, "lordo", null, listino);
    expect(sotto).toBe(1.98);
  });
});

// LA GUARDIA CHE DURA. Il difetto da cui si parte non è in un componente:
// è una percentuale che veniva applicata piatta su un catalogo in cui non
// tutti i prodotti la reggono. Il giorno in cui qualcuno rimette il conto
// piatto, o scrive una seconda copia della formula, queste diventano rosse.
describe("le guardie", () => {
  it("la formula sta in _shared, letta sia dall'app sia da Deno", () => {
    expect(SORGENTE).toContain('from "../supabase/functions/_shared/sconto-listino.js"');
    expect(fs.existsSync(path.join(process.cwd(), "supabase/functions/_shared/sconto-listino.js"))).toBe(true);
  });

  it("il conto del coupon passa dal listino, e c'è UN solo punto che lo fa", () => {
    expect(SORGENTE).toContain("if (listino && passaDalListino({ valore: percentuale, soglia: listino.soglia, forzato: listino.forzato })) {");
    // una seconda copia della formula qui dentro è il guasto del 7/11
    expect(SORGENTE.split("cedibili?.get(").length - 1).toBe(1);
  });

  it("il banco riceve i cedibili SENZA i costi", () => {
    // al POS ci sta una master: `coupon_cedibili` restituisce id e
    // percentuale, non la view del listino con costi e margini
    expect(SORGENTE).toContain('supabase.rpc("coupon_cedibili")');
  });

  it("la forzatura senza motivo non si salva", () => {
    expect(SORGENTE).toContain("if (forzato && !forzatoMotivo.trim()) {");
  });

  it("il valore scritto su WooCommerce è la media effettiva, non il tetto", () => {
    expect(SORGENTE).toContain("? effettoListino.mediaPesata");
  });
});
