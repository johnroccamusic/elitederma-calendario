// QUANTO SCONTO HA PRESO QUESTO PRODOTTO (7/11/2026).
//
// Chiesto dalle ragazze al banco della fiera di Napoli: «per ogni
// prodotto vogliono vedere quale percentuale il programma ha calcolato
// con lo sconto fiera, perché la cliente glielo chiede». Il conto per
// riga c'era già — lo sconto a fasce nasce riga per riga, sul margine di
// quel prodotto — ma era scritto due volte: una per il carrello, una per
// la vendita che si registra.
//
// Queste prove stanno addosso a quella cosa sola: il numero che la
// cliente si sente dire al banco DEVE essere quello che finisce scritto
// nella vendita. Per questo si prova la funzione unica, e si prova che
// il pezzo moltiplicato per la quantità ritrovi la riga: è il conto che
// fa la cliente a voce, e un centesimo di scarto lì è una discussione
// davanti al banco.
import { describe, it, expect } from "vitest";
import React from "react";
import { scontiPerRigaCarrello, righeDaPagare, PaginaPOS } from "../src/App.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// due prodotti che rendono in modo diverso: è il caso che rende il
// numero di riga diverso dalla media del carrello
const PIGMENTO = { id: "p1", prezzo_vendita: 30, costo_acquisto: 10, aliquota_iva_vendita: 22 }; // margine 66,7%
const AGHI = { id: "p2", prezzo_vendita: 10, costo_acquisto: 8, aliquota_iva_vendita: 22 }; // margine 20%
const SENZA_COSTO = { id: "p3", prezzo_vendita: 20, costo_acquisto: null, aliquota_iva_vendita: 22 };
const PER_ID = { p1: PIGMENTO, p2: AGHI, p3: SENZA_COSTO };

// le sei fasce di margine, dalla meno redditizia alla più: un prodotto
// che rende poco riceve poco, ed è tutto il senso della tabella
const serie = (sei) => [0, 1, 2, 3].map(() => sei.map((percentuale, i) => ({ da: i * 16.5, a: (i + 1) * 16.5, percentuale })));
const FASCE = { soglie: [80, 120, 200], gruppi: serie([2, 4, 6, 8, 12, 15]) };

describe("scontiPerRigaCarrello: lo sconto di ogni riga", () => {
  it("ogni prodotto ha la sua percentuale, quella del suo margine", () => {
    const carrello = [
      { prodottoId: "p1", prezzo: 36.6, quantita: 1 },
      { prodottoId: "p2", prezzo: 12.2, quantita: 1 },
    ];
    const righe = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 48.8, scontoApplicato: 4.88,
      fasce: FASCE,
    });
    // il pigmento rende il 66,7% → quinta fascia, 12%; gli aghi il 20% →
    // seconda fascia, 4%. Due righe dello stesso carrello, due numeri.
    expect(righe[0].pct).toBe(12);
    expect(righe[1].pct).toBe(4);
    expect(righe[0].sconto).toBeCloseTo(4.39, 2);
    expect(righe[1].sconto).toBeCloseTo(0.49, 2);
  });

  it("il prezzo del pezzo si ricava dalla riga, e la riga è quella che fa fede", () => {
    // Tre pigmenti: 109,80 pieni, 12% = 13,18, si pagano 96,62. Che su
    // tre pezzi NON è divisibile — 32,206666 — e nessun arrotondamento
    // lo rende divisibile. Quindi il pezzo si scrive arrotondato
    // (32,21) e il conto che fa fede resta quello della riga: al banco
    // la riga dice «al pezzo» e accanto il totale dei tre pezzi, così i
    // due numeri non si contraddicono.
    //
    // La direzione conta, ed è l'unica cosa che qui non si può
    // sbagliare: 32,21 × 3 farebbe 96,63, un centesimo PIÙ di quello
    // che la vendita registra. Scontare il pezzo e moltiplicare vuol
    // dire incassare una cifra che nella vendita non c'è.
    const carrello = [{ prodottoId: "p1", prezzo: 36.6, quantita: 3 }];
    const [riga] = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 109.8, scontoApplicato: 13.18, fasce: FASCE,
    });
    expect(riga.sconto).toBe(13.18);
    expect(riga.totale).toBe(96.62);
    expect(riga.totale).toBe(Math.round((riga.lordo - riga.sconto) * 100) / 100);
    expect(riga.unitario).toBe(32.21);
    // il pezzo non si allontana dalla riga più di un centesimo
    expect(Math.abs(riga.unitario * 3 - riga.totale)).toBeLessThanOrEqual(0.011);
  });

  it("un prodotto senza costo di acquisto non prende niente, e si vede", () => {
    const carrello = [
      { prodottoId: "p1", prezzo: 36.6, quantita: 1 },
      { prodottoId: "p3", prezzo: 24.4, quantita: 1 },
    ];
    const righe = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 61, scontoApplicato: 4.39, fasce: FASCE,
    });
    // senza costo non si sa il margine, e senza margine non c'è niente
    // da cedere: zero, non una media del carrello spalmata sopra
    expect(righe[1].sconto).toBe(0);
    expect(righe[1].pct).toBe(0);
    expect(righe[1].totale).toBe(24.4);
  });

  it("la somma delle righe fa ESATTAMENTE lo sconto del carrello", () => {
    // due numeri che non tornano al centesimo vogliono dire un totale
    // incassato e delle righe registrate che raccontano due vendite
    const carrello = [
      { prodottoId: "p1", prezzo: 36.6, quantita: 2 },
      { prodottoId: "p2", prezzo: 12.2, quantita: 3 },
      { prodottoId: "p3", prezzo: 24.4, quantita: 1 },
    ];
    const scontoApplicato = 10.24;
    const righe = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 134.2, scontoApplicato, fasce: FASCE,
    });
    const somma = Math.round(righe.reduce((s, x) => s + x.sconto, 0) * 100) / 100;
    expect(somma).toBe(scontoApplicato);
  });

  it("uno sconto a mano in euro si spalma, e nessuna riga va sotto zero", () => {
    const carrello = [
      { prodottoId: "p1", prezzo: 36.6, quantita: 1 },
      { prodottoId: "p2", prezzo: 12.2, quantita: 1 },
    ];
    const righe = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 48.8, scontoApplicato: 10,
      scontoTipo: "euro", scontoNum: 10,
    });
    const somma = Math.round(righe.reduce((s, x) => s + x.sconto, 0) * 100) / 100;
    expect(somma).toBe(10);
    righe.forEach((r) => { expect(r.sconto).toBeLessThanOrEqual(r.lordo); expect(r.totale).toBeGreaterThanOrEqual(0); });
  });

  it("uno sconto più grande del carrello non sfonda le righe", () => {
    // `scontoApplicato` è già tagliato al subtotale: le righe devono
    // seguirlo, non andare in negativo per conto loro
    const carrello = [{ prodottoId: "p1", prezzo: 36.6, quantita: 1 }];
    const [riga] = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 36.6, scontoApplicato: 36.6,
      scontoTipo: "euro", scontoNum: 100,
    });
    expect(riga.sconto).toBe(36.6);
    expect(riga.totale).toBe(0);
  });

  it("in omaggio non c'è nessuno sconto commerciale: le righe valgono zero", () => {
    const carrello = [{ prodottoId: "p1", prezzo: 36.6, quantita: 1 }];
    const [riga] = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 36.6, scontoApplicato: 0,
      fasce: FASCE, omaggio: true,
    });
    expect(riga.sconto).toBe(0);
    expect(riga.totale).toBe(36.6);
  });

  it("col codice di una master lo sconto sta sui suoi prodotti, non tutto sull'ultimo", () => {
    // Prima questo caso non era calcolabile per riga: le righe
    // venivano tutte zero e il riproporzionamento buttava l'intera
    // differenza sull'ULTIMA riga del carrello. Il totale era giusto,
    // l'attribuzione no — e con essa il margine per prodotto.
    const carrello = [
      { prodottoId: "p1", prezzo: 36.6, quantita: 1 },
      { prodottoId: "p2", prezzo: 12.2, quantita: 1 },
    ];
    const cedibile = new Map([["p1", { cedibile: 4, blocco: null }], ["p2", { cedibile: 2, blocco: null }]]);
    const righe = scontiPerRigaCarrello({
      carrello, prodottiPerId: PER_ID, subtotale: 48.8, scontoApplicato: 3.66,
      acquistoMaster: true, cedibilePerProdotto: cedibile, quotaMaster: { generale: 50, reparti: {} },
    });
    expect(righe[0].sconto).toBeCloseTo(2.44, 2);
    expect(righe[1].sconto).toBeCloseTo(1.22, 2);
  });
});

// ---------------------------------------------------------------------
// E adesso il banco vero: il POS montato, un prodotto battuto, e quello
// che si legge sulla riga. La regola può essere giusta e la riga
// restare muta — era proprio il caso di prima, dove la percentuale
// c'era ma stava in fondo al NOME del prodotto, dentro un riquadro che
// taglia quello che non ci sta.
const oggi = new Date().toISOString().slice(0, 10);
const fraDueOre = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
const PRODOTTO_BANCO = {
  id: "p1", nome: "Pigmento Nero Intenso per sopracciglia", prezzo_vendita: 30, costo_acquisto: 10,
  quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22,
};
const FIERA = {
  id: "ev1", nome: "Fiera di prova", citta: "Napoli", stato: "programmato",
  data_inizio: oggi, data_fine: oggi, pos_banco_fino_al: fraDueOre, pos_banco_sconto_fiera: true,
};
const TEAM = [{ evento_id: "ev1", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true }];
const RISPOSTE = {
  "/auth/v1/user": { id: "u1", email: "x@y.it" },
  "chiave=eq.fasceSconto_eventi_carta": { valore: FASCE },
  "chiave=eq.fasceSconto_eventi_contanti": { valore: FASCE },
  "/eventi_team": TEAM,
  "/eventi": [FIERA],
};

async function banco() {
  return monta(
    <PaginaPOS
      prodottiShop={[PRODOTTO_BANCO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[]} assistente={[]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={{ id: "u1", nome: "OLGA", venditoreId: "v-olga", permessi: ["pos"] }}
      venditoreLoggato={{ id: "v-olga", nome: "OLGA" }} targetVenditeProdotti={[]} ruoloUtente="user"
    />
  );
}

// Le righe che la cliente vede quando paga col QR: devono dire lo
// stesso prezzo che le è stato detto al banco, e sommare esattamente
// quello che paga. Prima lo sconto si spalmava con un fattore unico su
// tutte le righe — il totale tornava, le righe no.
describe("righeDaPagare: la pagina del pagamento e la ricevuta", () => {
  const CARRELLO = [
    { prodottoId: "p1", nome: "Pigmento", prezzo: 36.6, quantita: 1 },
    { prodottoId: "p3", nome: "Senza costo", prezzo: 24.4, quantita: 1 },
  ];
  const sconti = () => scontiPerRigaCarrello({
    carrello: CARRELLO, prodottiPerId: PER_ID, subtotale: 61, scontoApplicato: 4.39, fasce: FASCE,
  });

  it("ogni riga porta il suo prezzo scontato, non la media del carrello", () => {
    const righe = righeDaPagare({ carrello: CARRELLO, righeSconto: sconti(), totaleDaIncassare: 56.61 });
    // il pigmento prende il 12% (32,21), il prodotto senza costo di
    // acquisto non prende niente e resta a 24,40. Con la media sarebbero
    // state 33,97 e 22,64: due numeri che al banco nessuno ha detto.
    expect(righe[0].prezzo).toBe(32.21);
    expect(righe[1].prezzo).toBe(24.4);
    expect(Math.round((righe[0].prezzo + righe[1].prezzo) * 100) / 100).toBe(56.61);
  });

  it("la spedizione è una riga sua e non si sconta", () => {
    const righe = righeDaPagare({ carrello: CARRELLO, righeSconto: sconti(), speseSpedizione: 6.9, totaleDaIncassare: 63.51 });
    expect(righe[2]).toMatchObject({ nome: "Spedizione", prezzo: 6.9 });
    expect(Math.round(righe.reduce((a, r) => a + r.prezzo, 0) * 100) / 100).toBe(63.51);
  });

  it("con le provvigioni scalate la somma resta quello che si incassa", () => {
    // qui il totale NON è la somma delle righe: si riproporziona, e il
    // centesimo di resto va sull'ultima riga
    const totale = 40;
    const righe = righeDaPagare({ carrello: CARRELLO, righeSconto: sconti(), totaleDaIncassare: totale });
    expect(Math.round(righe.reduce((a, r) => a + r.prezzo, 0) * 100) / 100).toBe(totale);
  });

  it("in omaggio ogni riga vale zero, non solo il totale", () => {
    const righe = righeDaPagare({ carrello: CARRELLO, righeSconto: sconti(), totaleDaIncassare: 0 });
    righe.forEach((r) => expect(r.prezzo).toBe(0));
  });

  it("due pezzi si dicono nel nome, come prima", () => {
    const carrello = [{ prodottoId: "p1", nome: "Pigmento", prezzo: 36.6, quantita: 2 }];
    const righeSconto = scontiPerRigaCarrello({ carrello, prodottiPerId: PER_ID, subtotale: 73.2, scontoApplicato: 8.78, fasce: FASCE });
    const righe = righeDaPagare({ carrello, righeSconto, totaleDaIncassare: 64.42 });
    expect(righe[0].nome).toBe("2 × Pigmento");
    expect(righe[0].prezzo).toBe(64.42);
  });
});

// La tessera del prodotto nell'elenco: si batte premendola, come fa
// chi vende. Si riconosce dal dito del mouse e dal prezzo «IVA incl.»,
// non dalla posizione nella griglia.
const tessera = (p) => [...p.nodo.querySelectorAll("div")]
  .find((d) => d.style.cursor === "pointer"
    && (d.textContent || "").includes(PRODOTTO_BANCO.nome)
    && /IVA incl\./.test(d.textContent || ""));

describe("al banco, sulla riga del prodotto", () => {
  it("si legge il prezzo pieno, quello scontato e la percentuale", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);

    // il banco si apre già sulla fiera con lo sconto acceso (7/11/2026)
    await clicca(tessera(p));
    await attendi(80);

    const testo = p.testo();
    // 30,00 netti fanno 36,60 al pubblico; il pigmento rende il 66,7%,
    // quinta fascia, 12% → 4,39 di sconto, 32,21 da pagare
    expect(testo, "il prezzo pieno").toMatch(/36,60/);
    expect(testo, "il prezzo scontato del pezzo").toMatch(/32,21/);
    expect(testo, "la percentuale di QUESTA riga").toMatch(/−12%/);
    await p.smonta();
  });

  it("la percentuale non sta più dentro il nome, dove veniva tagliata", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);
    await clicca(tessera(p));
    await attendi(80);

    // il nome del prodotto è lungo come quelli veri, e il suo riquadro
    // taglia con l'ellissi: se la percentuale tornasse lì dentro, al
    // banco sparirebbe di nuovo senza che nessuno se ne accorga
    const nome = [...p.nodo.querySelectorAll("div")]
      .find((d) => (d.textContent || "").trim() === PRODOTTO_BANCO.nome
        && (d.style.textOverflow === "ellipsis"));
    expect(nome, "il riquadro del nome che taglia").toBeTruthy();
    expect(nome.textContent).not.toMatch(/%/);
    await p.smonta();
  });

  it("con due pezzi dice il prezzo del pezzo e quanto fa la riga", async () => {
    // il caso vero del banco: si batte lo stesso prodotto due volte. Il
    // prezzo del pezzo è arrotondato, quindi accanto ci va il totale
    // della riga — o i due numeri sembrano contraddirsi
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);
    await clicca(tessera(p));
    await clicca(tessera(p));
    await attendi(80);

    const testo = p.testo();
    expect(testo, "il prezzo del pezzo, detto per quello che è").toMatch(/32,21.{0,3}al pezzo/);
    expect(testo, "e quanto fa la riga intera").toMatch(/2 pz 64,42/);
    await p.smonta();
  });

  it("senza sconto acceso la riga dice solo il prezzo, come sempre", async () => {
    rispondiCon({ ...RISPOSTE, "/eventi": [{ ...FIERA, pos_banco_fino_al: null, pos_banco_sconto_fiera: false }] });
    const p = await banco();
    await attendi(150);
    await clicca(tessera(p));
    await attendi(80);

    const testo = p.testo();
    expect(testo).toMatch(/36,60/);
    expect(testo).not.toMatch(/32,21/);
    expect(testo).not.toMatch(/−12%/);
    await p.smonta();
  });
});
