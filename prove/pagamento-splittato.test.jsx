// IL PAGAMENTO SPLITTATO: una parte in contanti, il resto con la carta.
// 7/11/2026.
//
// Il titolare, dalla fiera: «sotto al totale due tasti, in unica soluzione
// o splittato. Se scrivi splittato ti dà due caselle: nella prima quanto
// paga in contanti, e sotto l'importo rimanente con lo sconto aggiornato
// per la parte residua con POS fisico o Stripe». E: «per ora solo sul POS
// programmatore e sul POS Chiara».
//
// Qui dentro ci sono soldi, e due regole che queste prove difendono:
//
//   IL CONTANTE COMPRA MERCE. Gli euro in contanti comprano una fetta del
//   carrello allo sconto dei contanti; quello che resta si paga a carta
//   con lo sconto della carta, che è più basso. La prova che è il conto
//   giusto: dando tutto in contanti si torna esattamente al totale «tutto
//   contanti», dando zero a quello «tutto carta».
//
//   LE DUE CASSE NON SI CONFONDONO. In archivio la vendita è una, ma i due
//   importi stanno scritti: la busta della classe e la cassa contanti
//   prendono la parte in contanti, le fatture e l'IVA la parte a carta.
import { describe, it, expect } from "vitest";
import React from "react";
import {
  PaginaPOS, contoSplittato, scontiPerRigaSplittati, scontiPerRigaCarrello,
  incassaContanti, incassoContantiDi, incassoCartaDi, datiEreditatiDallaVendita, contiAppendici,
} from "../src/App.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const oggi = new Date().toISOString().slice(0, 10);
const fraDueOre = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

// 30,00 netti = 36,60 al pubblico; margine 66,7% → quinta fascia, dove le
// due serie dicono numeri diversi: 16% in contanti, 12% a carta
const PRODOTTO = {
  id: "p1", nome: "Pigmento", prezzo_vendita: 30, costo_acquisto: 10,
  quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22,
};
const serie = (sei) => [0, 1, 2, 3].map(() => sei.map((percentuale, i) => ({ da: i * 16.5, a: (i + 1) * 16.5, percentuale })));
const FASCE_CARTA = { soglie: [80, 120, 200], gruppi: serie([2, 4, 6, 8, 12, 15]) };
const FASCE_CONTANTI = { soglie: [80, 120, 200], gruppi: serie([6, 8, 12, 14, 16, 20]) };
const FIERA = {
  id: "ev1", nome: "Fiera di prova", citta: "Napoli", stato: "programmato",
  data_inizio: oggi, data_fine: oggi, pos_banco_fino_al: fraDueOre, pos_banco_sconto_fiera: true,
};
const TEAM = [{ evento_id: "ev1", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true }];
const RISPOSTE = {
  "/auth/v1/user": { id: "u1", email: "x@y.it" },
  "chiave=eq.fasceSconto_eventi_carta": { valore: FASCE_CARTA },
  "chiave=eq.fasceSconto_eventi_contanti": { valore: FASCE_CONTANTI },
  "/eventi_team": TEAM,
  "/eventi": [FIERA],
};

async function banco({ ruolo = "programmatore" } = {}) {
  rispondiCon(RISPOSTE);
  const p = await monta(
    <PaginaPOS
      prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[]} assistente={[]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={{ id: "u1", nome: "OLGA", venditoreId: "v-olga", permessi: ["pos"] }}
      venditoreLoggato={{ id: "v-olga", nome: "OLGA" }} targetVenditeProdotti={[]} ruoloUtente={ruolo}
    />
  );
  await attendi(150);
  return p;
}
const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");
const tessera = (p) => [...p.nodo.querySelectorAll("div")]
  .find((d) => d.style.cursor === "pointer" && (d.textContent || "").includes(PRODOTTO.nome) && /IVA incl\./.test(d.textContent || ""));
const casellaContanti = (p) => p.nodo.querySelector('input[title^="Quanti euro in contanti"]');

// 36,60 di merce: 5,86 di sconto in contanti (30,74), 4,39 a carta (32,21)
const SUB = 36.6;
const SCONTO_CONTANTI = 5.86;
const SCONTO_CARTA = 4.39;
const conto = (contantiDati, scontoExtra = 0) => contoSplittato({
  subtotale: SUB, scontoContanti: SCONTO_CONTANTI, scontoCarta: SCONTO_CARTA, contantiDati, scontoExtra,
});

describe("il contante compra merce", () => {
  it("dieci euro in contanti comprano 11,91 di merce, e il resto va a carta", () => {
    const c = conto(10);
    expect(c.contanti).toBe(10);
    expect(c.lordoContanti).toBe(11.91);
    expect(c.carta).toBe(21.73);
    // e il totale sta IN MEZZO ai due estremi: più di tutto carta no, meno
    // di tutto contanti nemmeno
    expect(c.contanti + c.carta).toBeCloseTo(31.73, 2);
    expect(c.sconto).toBe(4.87);
  });

  it("dando tutto in contanti si torna al totale «tutto contanti»", () => {
    const c = conto(30.74);
    expect(c.carta).toBe(0);
    expect(c.contanti).toBe(30.74);
    expect(c.sconto).toBe(SCONTO_CONTANTI);
  });

  it("senza contanti si torna al totale «tutto carta»", () => {
    const c = conto(0);
    expect(c.carta).toBe(32.21);
    expect(c.sconto).toBe(SCONTO_CARTA);
  });

  it("più di quanto vale il carrello in contanti non si prende, e si dice", () => {
    const c = conto(100);
    expect(c.contanti).toBe(30.74);
    expect(c.carta).toBe(0);
    expect(c.oltre).toBe(true);
  });

  it("la cifra scritta a mano si toglie dal resto, e non lo sfonda", () => {
    const c = conto(10, 5);
    expect(c.extra).toBe(5);
    expect(c.carta).toBe(16.73);
    const troppo = conto(10, 999);
    expect(troppo.extra).toBe(21.73);
    expect(troppo.carta).toBe(0);
  });
});

describe("le righe di un carrello splittato", () => {
  const carrello = [
    { prodottoId: "p1", nome: "Pigmento", prezzo: 36.6, quantita: 1 },
    { prodottoId: "p2", nome: "Aghi", prezzo: 20, quantita: 2 },
  ];
  const prodottiPerId = {
    p1: PRODOTTO,
    // margine 50% → terza fascia: 6% a carta, 12% in contanti
    p2: { id: "p2", nome: "Aghi", prezzo_vendita: 16.39, costo_acquisto: 8.2, aliquota_iva_vendita: 22 },
  };
  const subtotale = 76.6;
  const righe = (fasce, contanti) => scontiPerRigaCarrello({
    carrello, prodottiPerId, subtotale, scontoApplicato: null, fasce, contanti,
  });

  it("ogni riga prende la sua fetta delle due tabelle, e la somma fa lo sconto del totale", () => {
    const rc = righe(FASCE_CONTANTI, true);
    const rk = righe(FASCE_CARTA, false);
    const c = contoSplittato({
      subtotale,
      scontoContanti: rc.reduce((s, x) => s + x.sconto, 0),
      scontoCarta: rk.reduce((s, x) => s + x.sconto, 0),
      contantiDati: 30,
    });
    const miste = scontiPerRigaSplittati({ carrello, righeContanti: rc, righeCarta: rk, quota: c.quota, scontoApplicato: c.sconto });
    const somma = Math.round(miste.reduce((s, x) => s + x.sconto, 0) * 100) / 100;
    expect(somma, "le righe devono sommare ESATTAMENTE lo sconto del carrello").toBe(c.sconto);
    // e ogni percentuale sta fra quella dei contanti e quella della carta
    miste.forEach((m, i) => {
      const dentro = (m.pct >= rk[i].pct - 0.05 && m.pct <= rc[i].pct + 0.05);
      expect(dentro, `riga ${i}: ${m.pct}% non sta fra ${rk[i].pct}% e ${rc[i].pct}%`).toBe(true);
    });
    // le righe del carrello sommano quello che si incassa
    const incassato = Math.round(miste.reduce((s, x) => s + x.totale, 0) * 100) / 100;
    expect(incassato).toBe(Math.round((c.contanti + c.carta) * 100) / 100);
  });
});

describe("le due casse, in archivio", () => {
  const misto = { metodo_pagamento: "misto", totale: 31.73, incasso_contanti_eur: 10, incasso_carta_eur: 21.73 };

  it("di una vendita mista il cassetto prende solo il contante", () => {
    expect(incassoContantiDi(misto)).toBe(10);
    expect(incassoCartaDi(misto)).toBe(21.73);
    expect(incassaContanti("misto")).toBe(true);
  });

  it("su tutte le altre vendite i conti restano quelli di prima", () => {
    expect(incassoContantiDi({ metodo_pagamento: "contanti", totale: 50 })).toBe(50);
    expect(incassoCartaDi({ metodo_pagamento: "contanti", totale: 50 })).toBe(0);
    expect(incassoContantiDi({ metodo_pagamento: "pos", totale: 50 })).toBe(0);
    expect(incassoCartaDi({ metodo_pagamento: "pos", totale: 50 })).toBe(50);
    // il buono Amazon non è contante nel cassetto, e non lo era nemmeno prima
    expect(incassaContanti("buono_amazon")).toBe(false);
    expect(incassoContantiDi({ metodo_pagamento: "buono_amazon", totale: 50 })).toBe(0);
  });

  it("nella busta della classe entra solo la parte in contanti", () => {
    const cd = { id: "cd1", busta_rientrata_il: "2026-11-01" };
    const conti = contiAppendici({
      cd,
      venditeShop: [{ ...misto, id: "v1", corso_data_id: "cd1", busta_numero: null, tipo_movimento: "vendita" }],
      spese: [], buste: [],
    });
    expect(conti.aperta.contanti).toBe(10);
  });

  it("un reso su una vendita mista esce dalle due casse in proporzione", () => {
    const e = datiEreditatiDallaVendita({ ...misto, corso_data_id: null }, -31.73);
    expect(e.metodo_pagamento).toBe("misto");
    expect(e.incasso_contanti_eur).toBe(-10);
    expect(e.incasso_carta_eur).toBe(-21.73);
    // un reso parziale: metà da una cassa, metà dall'altra
    const mezzo = datiEreditatiDallaVendita({ ...misto, corso_data_id: null }, -15.87);
    expect(mezzo.incasso_contanti_eur).toBe(-5);
    expect(mezzo.incasso_carta_eur).toBe(-10.87);
  });
});

describe("il gesto, al banco", () => {
  it("i due tasti ci sono per il programmatore", async () => {
    const p = await banco();
    const t = pulito(p);
    expect(t).toContain("Modalità di pagamento");
    expect(t).toContain("In unica soluzione");
    expect(t).toContain("Splittato");
    await p.smonta();
  });

  it("e non ci sono per chi non è programmatore", async () => {
    const p = await banco({ ruolo: "user" });
    const t = pulito(p);
    expect(t).not.toContain("Splittato");
    expect(t).not.toContain("Modalità di pagamento");
    await p.smonta();
  });

  it("premendo Splittato compaiono le due caselle, e «Come paga?» si tira via", async () => {
    const p = await banco();
    await clicca(p.tasto("Splittato"));
    const t = pulito(p);
    expect(t).toContain("Contanti €");
    expect(t).toContain("Resto da incassare con la carta");
    // il metodo del resto si scegli lì, quindi i quattro tasti non servono più
    expect(t).not.toContain("Come paga?");
    expect(t).toContain("Stripe");
    expect(t).toContain("POS fisico");
    await p.smonta();
  });

  it("scritti i contanti, il resto compare con lo sconto della carta", async () => {
    const p = await banco();
    await clicca(tessera(p));
    await attendi(80);
    await clicca(p.tasto("Splittato"));
    await scrivi(casellaContanti(p), "10");
    await attendi(80);
    const t = pulito(p);
    // 10 in contanti comprano 11,91 di merce al 16%; restano 21,73 al 12%
    expect(t, "quanta merce comprano i contanti").toContain("11,91");
    expect(t, "il resto da incassare con la carta").toContain("21,73");
    // e il totale della vendita è la somma dei due
    expect(t).toContain("31,73");
    await p.smonta();
  });

  it("il QR chiede il resto, non il totale del carrello", async () => {
    const p = await banco();
    await clicca(tessera(p));
    await attendi(80);
    // il banco di chi amministra nasce sul terminale: per vedere il QR si
    // preme Stripe, come ha sempre fatto
    await clicca(p.tasto("Stripe"));
    await attendi(60);
    // tutto a carta: il QR chiede 32,21
    expect(pulito(p)).toContain("Mostra il QR · 32,21");
    await clicca(p.tasto("Splittato"));
    await scrivi(casellaContanti(p), "10");
    await attendi(80);
    expect(pulito(p), "il QR deve chiedere SOLO il resto").toContain("Mostra il QR · 21,73");
    await p.smonta();
  });

  it("se il contante copre tutto, con la carta non resta niente da chiedere", async () => {
    const p = await banco();
    await clicca(tessera(p));
    await attendi(80);
    await clicca(p.tasto("Splittato"));
    await clicca(p.tasto("Stripe"));
    await scrivi(casellaContanti(p), "100");
    await attendi(80);
    const t = pulito(p);
    expect(t).toContain("Il contante copre tutto");
    // e lo dice anche la casella: in contanti il carrello fa 30,74
    expect(t).toContain("30,74");
    await p.smonta();
  });
});
