// UN ORDINE CHE NON E' STATO PAGATO NON E' UN INCASSO. 18/11/2026.
//
// Il difetto trovato dal titolare: in «Clienti shop» i primi otto della
// classifica avevano 45.000, 41.020, 29.565 € di «totale speso» e zero
// euro pagati. Nessuna delle letture degli ordini del sito guardava
// `stato`, quindi i carrelli abbandonati e i pagamenti falliti — che
// WooCommerce conserva come ordini veri — erano sommati agli incassi:
// 710.752,88 € mai entrati sopra 646.706,45 € veri.
//
// E la seconda meta', chiesta subito dopo: dentro quello che resta,
// 242.435,70 € non sono prodotti ma ACCONTI DI CORSI comprati dal sito.
// Un cliente che ha versato l'acconto di un corso da 3.000 € non e' un
// cliente da 3.000 € di prodotti.
//
// I numeri delle prove sono quelli veri del caso: Elvira Palminteri,
// quindici ordini da 3.000 € tutti annullati o falliti e un acquisto
// vero da 89,44 €.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "./preparazione.js";
import {
  venditaIncassata, venditaRimborsata, venditaNonRiuscita,
  costruisciClientiShop, costruisciClassificaProdottiShop,
  STATI_ORDINE_INCASSATO,
} from "../src/App.jsx";

const ordine = (n, stato, totale, prodotti = [], extra = {}) => ({
  id: `o${n}`, origine: "woocommerce", numero_ordine: String(n), stato, totale,
  data_ordine: `2024-04-${String(10 + n).padStart(2, "0")}T10:00:00Z`,
  cliente_email: "elviraa2102@gmail.com", cliente_nome: "Elvira Palminteri",
  prodotti, payload_raw: { customer_id: 701, billing: { phone: "3341568364" } },
  ...extra,
});
const rigaCorso = (importo) => ({ nome: "PMU BASE - acconto", quantita: 1, totale_riga: importo });
const rigaProdotto = (importo) => ({ nome: "Colla Laminazione Ciglia", quantita: 1, totale_riga: importo });
const VOCI = [
  { nome: "PMU BASE - acconto", tipo: "corso" },
  { nome: "Colla Laminazione Ciglia", tipo: "prodotto" },
];

describe("venditaIncassata: quali stati sono soldi arrivati", () => {
  it("del sito contano solo completed e processing", () => {
    expect(STATI_ORDINE_INCASSATO).toEqual(["completed", "processing"]);
    expect(venditaIncassata({ origine: "woocommerce", stato: "completed" })).toBe(true);
    expect(venditaIncassata({ origine: "woocommerce", stato: "processing" })).toBe(true);
    for (const s of ["cancelled", "failed", "pending", "on-hold", "refunded", "", null]) {
      expect(venditaIncassata({ origine: "woocommerce", stato: s })).toBe(false);
    }
  });
  it("un rimborso non e' un incasso, ed e' una cosa a parte dal non riuscito", () => {
    const r = { origine: "woocommerce", stato: "refunded" };
    expect(venditaRimborsata(r)).toBe(true);
    expect(venditaNonRiuscita(r)).toBe(false);
    expect(venditaNonRiuscita({ origine: "woocommerce", stato: "cancelled" })).toBe(true);
  });
  // al banco si registra solo quello che si e' incassato, e dal 23/10/2026
  // il database pretende la prova del pagamento: pretendere `completed`
  // anche li' farebbe sparire una vendita vera per una colonna vuota
  it("una vendita del banco conta anche senza stato scritto", () => {
    expect(venditaIncassata({ origine: "pos", stato: null, totale: 50 })).toBe(true);
    expect(venditaIncassata({ origine: "pos", stato: "completed" })).toBe(true);
    expect(venditaIncassata({ origine: "pos", stato: "refunded" })).toBe(false);
  });
});

describe("costruisciClientiShop: il caso vero di Elvira Palminteri", () => {
  const vendite = [
    ...Array.from({ length: 8 }, (_, i) => ordine(i + 1, "cancelled", 3000, [rigaCorso(3000)])),
    ...Array.from({ length: 7 }, (_, i) => ordine(i + 9, "failed", 3000, [rigaCorso(3000)])),
    ordine(16, "completed", 89.44, [rigaProdotto(89.44)]),
  ];
  const [c] = costruisciClientiShop(vendite, VOCI, []);

  it("conta un ordine solo e 89,44 €, non quindici e 45.000", () => {
    expect(c.numeroOrdini).toBe(1);
    expect(c.totaleSpeso).toBeCloseTo(89.44, 2);
    expect(c.spesaMaggiore).toBeCloseTo(89.44, 2);
    expect(c.carrelloMedio).toBeCloseTo(89.44, 2);
  });
  it("i quindici tentativi non spariscono: hanno una colonna loro", () => {
    expect(c.ordiniNonRiusciti).toBe(15);
    expect(c.valoreNonRiuscito).toBeCloseTo(45000, 2);
    expect(c.ordini).toHaveLength(16); // nella scheda si vedono tutti
  });
  it("le date sono quelle degli ordini PAGATI, non del primo tentativo", () => {
    expect(c.primoOrdine).toBe(vendite[15].data_ordine);
    expect(c.ultimoOrdine).toBe(vendite[15].data_ordine);
  });
});

describe("prodotti e corsi sono due colonne diverse", () => {
  const vendite = [
    ordine(1, "completed", 3012.13, [rigaCorso(3000), rigaProdotto(12.13)]),
    ordine(2, "cancelled", 3000, [rigaCorso(3000)]),
  ];
  const [c] = costruisciClientiShop(vendite, VOCI, []);

  it("l'acconto del corso non si conta fra i prodotti", () => {
    expect(c.totaleCorsi).toBeCloseTo(3000, 2);
    expect(c.totaleProdotti).toBeCloseTo(12.13, 2);
  });
  it("prodotti + corsi + resto fa esattamente il totale incassato", () => {
    expect(c.totaleProdotti + c.totaleCorsi + c.altroIncassato).toBeCloseTo(c.totaleSpeso, 2);
  });
  it("una voce non classificata vale prodotto, come in classifica", () => {
    const [x] = costruisciClientiShop([ordine(1, "completed", 10, [{ nome: "Roba nuova", quantita: 1, totale_riga: 10 }])], VOCI, []);
    expect(x.totaleProdotti).toBeCloseTo(10, 2);
    expect(x.totaleCorsi).toBe(0);
  });
  it("la spedizione non e' un prodotto", () => {
    const [x] = costruisciClientiShop([ordine(1, "completed", 16.9, [rigaProdotto(10), { nome: "Spedizione", spedizione: true, totale_riga: 6.9 }])], VOCI, []);
    expect(x.totaleProdotti).toBeCloseTo(10, 2);
    expect(x.altroIncassato).toBeCloseTo(6.9, 2);
  });
});

describe("chi ha solo tentativi resta in elenco, con zero euro", () => {
  const [c] = costruisciClientiShop([ordine(1, "failed", 3000, [rigaCorso(3000)])], VOCI, []);
  it("c'e', ma non e' un cliente", () => {
    expect(c).toBeTruthy();
    expect(c.numeroOrdini).toBe(0);
    expect(c.totaleSpeso).toBe(0);
    expect(c.ordiniNonRiusciti).toBe(1);
    expect(c.nome).toBe("Elvira Palminteri"); // il nome si legge lo stesso
  });
});

describe("il nome e' quello dell'ultimo ordine PAGATO", () => {
  it("un tentativo piu' recente con un altro nome non ruba la riga", () => {
    const [c] = costruisciClientiShop([
      ordine(1, "completed", 50, [rigaProdotto(50)], { cliente_nome: "Anna Rossi", cliente_email: "anna@x.it" }),
      ordine(2, "cancelled", 3000, [rigaCorso(3000)], { cliente_nome: "Chi Ha Provato", cliente_email: "altro@x.it" }),
    ], VOCI, []);
    expect(c.nome).toBe("Anna Rossi");
    expect(c.email).toBe("anna@x.it");
  });
  it("senza nessun ordine pagato si legge comunque il nome del tentativo", () => {
    const [c] = costruisciClientiShop([
      ordine(1, "failed", 3000, [rigaCorso(3000)], { cliente_nome: "Chi Ha Provato" }),
    ], VOCI, []);
    expect(c.nome).toBe("Chi Ha Provato");
  });
});

describe("piu' nomi sullo stesso account", () => {
  it("si segnala, perche' il raggruppamento e' per customer_id", () => {
    const [c] = costruisciClientiShop([
      ordine(1, "completed", 50, [rigaProdotto(50)], { cliente_nome: "Anna Rossi" }),
      ordine(2, "completed", 60, [rigaProdotto(60)], { cliente_nome: "Marco Bianchi" }),
    ], VOCI, []);
    expect(c.piuNomi).toBe(true);
  });
  it("un nome solo non si segnala", () => {
    const [c] = costruisciClientiShop([ordine(1, "completed", 50, [rigaProdotto(50)])], VOCI, []);
    expect(c.piuNomi).toBe(false);
  });
});

describe("la classifica dei prodotti non vende carrelli abbandonati", () => {
  const classifica = costruisciClassificaProdottiShop([
    ordine(1, "completed", 12.13, [rigaProdotto(12.13)]),
    ordine(2, "cancelled", 1000, [rigaProdotto(1000)]),
    ordine(3, "completed", 3000, [rigaCorso(3000)]),
  ], VOCI, []);
  it("conta solo l'ordine pagato", () => {
    expect(classifica.classificaProdotti).toHaveLength(1);
    expect(classifica.classificaProdotti[0].incasso).toBeCloseTo(12.13, 2);
  });
  it("il corso resta nella sua classifica, mai in quella dei prodotti", () => {
    expect(classifica.classificaCorsi[0].incasso).toBeCloseTo(3000, 2);
  });
});

// LA GUARDIA CHE DURA. Il difetto non era in una funzione: era la stessa
// dimenticanza ripetuta in sei letture diverse degli stessi ordini. Qui si
// rilegge il sorgente e si pretende che ogni punto che raccoglie gli ordini
// del sito passi da `venditaIncassata`. Se un giorno nasce la settima
// lettura senza quel filtro, questa prova diventa rossa invece di farci
// scoprire il guasto fra due anni guardando una classifica.
describe("nessuna lettura degli ordini del sito conta quelli non pagati", () => {
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
  const righe = sorgente.split("\n");
  // le righe che mettono insieme gli ordini del sito (un filtro su `origine`)
  const raccolte = righe
    .map((r, i) => ({ r, n: i + 1 }))
    .filter(({ r }) => /\.filter\(\(v\) =>.*origine (===|==) "woocommerce"/.test(r)
      || /\.filter\(\(v\) =>.*origine === origine/.test(r));
  it("le trova tutte (se ne nasce una nuova, va guardata)", () => {
    expect(raccolte.length).toBeGreaterThanOrEqual(6);
  });
  raccolte.forEach(({ r, n }) => {
    it(`riga ${n} filtra per incasso, oppure dice per iscritto perche' no`, () => {
      // Le due eccezioni sono vere e si dichiarano con le parole «TUTTI
      // gli ordini» nelle righe sopra: la scheda del cliente (che deve
      // mostrare anche i tentativi), la mappa dei nomi storici dei
      // prodotti e il registro degli ordini. Una lettura nuova senza
      // filtro e senza quella frase fa diventare rossa questa prova.
      const finestra = righe.slice(Math.max(0, n - 6), n - 1).join("\n");
      expect(r.includes("venditaIncassata") || finestra.includes("TUTTI gli ordini")).toBe(true);
    });
  });
});
