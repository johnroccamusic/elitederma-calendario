// «SCRIVO UN PRODOTTO E MI DICE I PREZZI DEL BANCO» (8/11/2026).
//
// Il titolare: «quando scrivo un nome di un prodotto mi dice il prezzo
// normale, poi se sono in fiera mi dice sconto fiera in contanti, il
// prezzo finale, e sconto fiera POS, il prezzo finale. In pratica una
// specie di simulazione del POS banco».
//
// La cosa che queste prove tengono ferma e' UNA: le cifre che
// l'assistente dice devono essere quelle che il banco incassa. Per
// questo non esiste un secondo conto — `prezziAlBancoDi` costruisce un
// carrello di una riga e chiama `scontiPerRigaCarrello`, la stessa
// funzione dello scontrino — e per questo i numeri qui sotto sono
// verificati a mano, non copiati da un giro del programma.
import { describe, it, expect } from "vitest";
import React from "react";
import { prezziAlBancoDi, scontiPerRigaCarrello } from "../src/App.jsx";
import AssistenteRegole from "../src/regole/AssistenteRegole.jsx";
import { cercaProdottiPerTesto, parolePerCerca } from "../src/pos/prezzo-al-banco.js";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// Le tabelle vere della Fiera di Napoli, lette dalle impostazioni:
// carta 4/6/10/13/14/15, contanti 6/8/12/14/16/20, sui sei scaglioni di
// margine (0-16,5 / 33 / 49,5 / 66 / 82,5 / 100) e tre soglie di spesa.
const scaglioni = (p) => [
  { da: 0, a: 16.5, percentuale: p[0] }, { da: 16.5, a: 33, percentuale: p[1] },
  { da: 33, a: 49.5, percentuale: p[2] }, { da: 49.5, a: 66, percentuale: p[3] },
  { da: 66, a: 82.5, percentuale: p[4] }, { da: 82.5, a: 100, percentuale: p[5] },
];
const serie = (p) => ({ soglie: [80, 120, 200], gruppi: [scaglioni(p), scaglioni(p), scaglioni(p), scaglioni(p)] });
const FIERA_CARTA = serie([4, 6, 10, 13, 14, 15]);
const FIERA_CONTANTI = serie([6, 8, 12, 14, 16, 20]);

// netto 30,00 + 22% = 36,60 al pubblico; costo 12,00.
//   margine a carta:    (30 - 12) / 30      = 60,00%  -> scaglione 4 -> 13%
//   margine in contanti: (36,60 - 12)/36,60 = 67,21%  -> scaglione 5 -> 16%
const PIGMENTO = { id: "p1", nome: "Pigmento nero intenso", sku: "PIG-NERO", prezzo_vendita: 30, aliquota_iva_vendita: 22, costo_acquisto: 12 };
const SENZA_COSTO = { id: "p2", nome: "Ring Lamp 14", sku: "RING14", prezzo_vendita: 50, aliquota_iva_vendita: 22, costo_acquisto: null };
const PRODOTTI = [PIGMENTO, SENZA_COSTO, { id: "p3", nome: "Kit laminazione essential", sku: "KIT-LAM-ESS", prezzo_vendita: 100, aliquota_iva_vendita: 22, costo_acquisto: 40 }];

describe("i prezzi del banco", () => {
  it("in fiera dice il listino, il prezzo in contanti e quello col POS", () => {
    const r = prezziAlBancoDi(PIGMENTO, { fasceCarta: FIERA_CARTA, fasceContanti: FIERA_CONTANTI });
    expect(r.listino).toBe(36.6);
    // 36,60 - 16% = 30,74   (il contante sconta di piu')
    expect(r.contanti.pct).toBe(16);
    expect(r.contanti.totale).toBe(30.74);
    // 36,60 - 13% = 31,84
    expect(r.carta.pct).toBe(13);
    expect(r.carta.totale).toBe(31.84);
    expect(r.senzaMargine).toBe(false);
  });

  it("il conto e' quello del POS, non un secondo conto", () => {
    // la stessa riga passata a mano alla funzione dello scontrino deve
    // dare gli stessi centesimi: se un giorno i due si staccassero,
    // l'assistente direbbe un prezzo e il banco ne incasserebbe un altro
    const righe = scontiPerRigaCarrello({
      carrello: [{ prodottoId: "p1", prezzo: 36.6, quantita: 1 }],
      prodottiPerId: { p1: PIGMENTO }, subtotale: 36.6, scontoApplicato: null,
      fasce: FIERA_CONTANTI, contanti: true,
    });
    const dalBanco = prezziAlBancoDi(PIGMENTO, { fasceCarta: FIERA_CARTA, fasceContanti: FIERA_CONTANTI });
    expect(dalBanco.contanti.totale).toBe(righe[0].totale);
    expect(dalBanco.contanti.pct).toBe(righe[0].pct);
  });

  it("fuori fiera dice solo il prezzo normale", () => {
    const r = prezziAlBancoDi(PIGMENTO, { fasceCarta: null, fasceContanti: FIERA_CONTANTI });
    expect(r.listino).toBe(36.6);
    expect(r.contanti).toBe(null);
    expect(r.carta).toBe(null);
  });

  it("senza costo d'acquisto non c'e' sconto, e lo dice", () => {
    const r = prezziAlBancoDi(SENZA_COSTO, { fasceCarta: FIERA_CARTA, fasceContanti: FIERA_CONTANTI });
    expect(r.senzaMargine).toBe(true);
    expect(r.contanti.pct).toBe(0);
    expect(r.contanti.totale).toBe(61);
  });

  it("un prodotto senza prezzo non si nomina", () => {
    expect(prezziAlBancoDi({ id: "x", nome: "Camice", prezzo_vendita: null }, {})).toBe(null);
  });
});

describe("riconoscere il prodotto dal testo", () => {
  it("trova il prodotto dal nome, anche a pezzi di parola", () => {
    expect(cercaProdottiPerTesto("pigmento nero", PRODOTTI).map((p) => p.id)).toEqual(["p1"]);
    expect(cercaProdottiPerTesto("lamin ess", PRODOTTI).map((p) => p.id)).toEqual(["p3"]);
    expect(cercaProdottiPerTesto("quanto costa il pigmento", PRODOTTI).map((p) => p.id)).toEqual(["p1"]);
  });

  it("trova anche per sku", () => {
    expect(cercaProdottiPerTesto("RING14", PRODOTTI).map((p) => p.id)).toEqual(["p2"]);
  });

  it("una domanda vera non e' un prodotto", () => {
    expect(cercaProdottiPerTesto("come registro un cliente", PRODOTTI)).toEqual([]);
    expect(cercaProdottiPerTesto("quanto sconto posso fare in aula", PRODOTTI)).toEqual([]);
    expect(cercaProdottiPerTesto("", PRODOTTI)).toEqual([]);
  });

  it("le paroline e le parole del prezzo non si cercano", () => {
    expect(parolePerCerca("quanto costa il pigmento in contanti")).toEqual(["pigmento"]);
  });

  it("due lettere sole non pescano mezza anagrafica", () => {
    expect(cercaProdottiPerTesto("ab", PRODOTTI)).toEqual([]);
  });
});

describe("l'assistente, scritto il nome di un prodotto", () => {
  const prezziAlBanco = (testo) => {
    const trovati = cercaProdottiPerTesto(testo, PRODOTTI);
    if (!trovati.length) return null;
    return {
      fiera: { nome: "Fiera di Napoli", citta: "Napoli" },
      prodotti: trovati.map((p) => prezziAlBancoDi(p, { fasceCarta: FIERA_CARTA, fasceContanti: FIERA_CONTANTI })),
    };
  };

  it("mostra i tre prezzi e NON disturba il modello", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/regolamenti": [],
      "functions/v1/assistente-regole": (corpo) => { chiamate.push(corpo); return { ok: true, risposta: "non dovrei essere qui" }; },
    });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" prezziAlBanco={prezziAlBanco} />);
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), "pigmento nero");
    await clicca(p.tasto("Chiedi")); await attendi(100);
    const scheda = p.nodo.querySelector('[data-campo="prezzi-al-banco"]');
    expect(scheda).toBeTruthy();
    const t = scheda.textContent;
    expect(t).toContain("Fiera di Napoli");
    expect(t).toContain("36,60 €");   // prezzo normale
    expect(t).toContain("30,74 €");   // contanti, -16%
    expect(t).toContain("31,84 €");   // POS, -13%
    expect(t).toContain("-16%");
    expect(t).toContain("-13%");
    expect(chiamate.length).toBe(0);
    await p.smonta();
  });

  it("una domanda vera continua ad andare al modello", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/regolamenti": [],
      "functions/v1/assistente-regole": (corpo) => { chiamate.push(corpo); return { ok: true, risposta: "Si fa da Gestione utenti.", citati: [] }; },
    });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" prezziAlBanco={prezziAlBanco} />);
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), "come registro un cliente");
    await clicca(p.tasto("Chiedi")); await attendi(100);
    expect(chiamate.length).toBe(1);
    expect(p.nodo.querySelector('[data-campo="prezzi-al-banco"]')).toBe(null);
    await p.smonta();
  });

  it("senza la simulazione il pannello funziona come prima", async () => {
    const chiamate = [];
    rispondiCon({
      "rest/v1/regolamenti": [],
      "functions/v1/assistente-regole": (corpo) => { chiamate.push(corpo); return { ok: true, risposta: "Eccolo.", citati: [] }; },
    });
    const p = await monta(<AssistenteRegole ruolo="venditori" chi="Olga" />);
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), "pigmento nero");
    await clicca(p.tasto("Chiedi")); await attendi(100);
    expect(chiamate.length).toBe(1);
    await p.smonta();
  });
});
