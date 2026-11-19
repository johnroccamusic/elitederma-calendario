// LA BUSTA SI SPEDISCE, POI ARRIVA (11/11/2026).
//
// Il titolare: «Elena dispone i pagamenti con i soldi contenuti nella busta
// o rinvia in scadenziario passivo le spese che non ha potuto pagare. Da
// quel momento chiude la busta e la porta via con sé. Non è possibile
// aggiungere altro alla busta. La master che però resta in classe potrebbe
// fare altre vendite in contanti che prima si andavano a sommare
// erratamente alla busta che era stata portata via.»
//
// La cosa che queste prove inchiodano è una sola, ed è il motivo per cui la
// tappa di mezzo esiste: una vendita fatta dopo la PARTENZA della busta non
// deve finire dentro quella busta. Prima la soglia era l'ARRIVO, e fra i due
// momenti passano dei giorni.
import { describe, it, expect } from "vitest";
import React from "react";
import "./preparazione.js";
import {
  bustaChiusa, statoViaggioBusta, statoViaggioAppendice, venditaInAppendice,
  venditeDellaPrimaBusta, contiAppendici, semaforoContabilita, contabilitaDaApprovare,
  BUSTA_APERTA, BUSTA_IN_VIAGGIO, BUSTA_RICEVUTA,
} from "../src/App.jsx";

const APERTA = { id: "cd1" };
const IN_VIAGGIO = { id: "cd1", busta_spedita_il: "2026-11-09", busta_importo: 300 };
const IN_CASSA = { id: "cd1", busta_spedita_il: "2026-11-09", busta_rientrata_il: "2026-11-11", busta_depositata_il: "2026-11-11", busta_importo: 300 };
// com'e' scritta in archivio una delle 41 buste di prima della migrazione,
// se per qualunque ragione la data di spedizione mancasse
const VECCHIA = { id: "cd1", busta_rientrata_il: "2026-10-20", busta_depositata_il: "2026-10-20", busta_importo: 300 };
const vendita = (id, extra = {}) => ({ id, corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: "contanti", totale: 100, busta_numero: null, prodotti: [], ...extra });

describe("le tappe del viaggio", () => {
  it("aperta, in viaggio, ricevuta", () => {
    expect(statoViaggioBusta(APERTA)).toBe(BUSTA_APERTA);
    expect(statoViaggioBusta(IN_VIAGGIO)).toBe(BUSTA_IN_VIAGGIO);
    expect(statoViaggioBusta(IN_CASSA)).toBe(BUSTA_RICEVUTA);
  });
  it("una busta arrivata chiude la contabilità, anche se la data di spedizione manca", () => {
    // le letture si appoggiano a bustaChiusa: fidarsi di una colonna sola
    // riaprirebbe la contabilità di una classe chiusa mesi fa
    expect(bustaChiusa(VECCHIA)).toBe(true);
    expect(statoViaggioBusta(VECCHIA)).toBe(BUSTA_RICEVUTA);
    expect(bustaChiusa(APERTA)).toBe(false);
  });
  it("un'appendice partita è in viaggio, e arrivata è ricevuta", () => {
    expect(statoViaggioAppendice({ numero: 2, spedita_il: "2026-11-10" })).toBe(BUSTA_IN_VIAGGIO);
    expect(statoViaggioAppendice({ numero: 2, spedita_il: "2026-11-10", rientrata_il: "2026-11-12" })).toBe(BUSTA_RICEVUTA);
  });
});

describe("la soglia è la partenza, non l'arrivo", () => {
  it("una vendita fatta mentre la busta è in viaggio NON entra in quella busta", () => {
    const dopo = vendita("v2");
    expect(venditaInAppendice(dopo, IN_VIAGGIO)).toBe(true);
    expect(venditeDellaPrimaBusta([dopo], IN_VIAGGIO)).toEqual([]);
  });
  it("e con la busta ancora sul tavolo ci entra, come sempre", () => {
    const prima = vendita("v1");
    expect(venditaInAppendice(prima, APERTA)).toBe(false);
    expect(venditeDellaPrimaBusta([prima], APERTA).length).toBe(1);
  });
  it("quello che la busta si è portato via resta dentro: il numero 1 lo dice", () => {
    const dentro = vendita("v1", { busta_numero: 1 });
    expect(venditeDellaPrimaBusta([dentro], IN_VIAGGIO).length).toBe(1);
  });
  it("l'appendice si apre con la partenza e raccoglie le vendite di dopo", () => {
    const conti = contiAppendici({ cd: IN_VIAGGIO, venditeShop: [vendita("v1", { busta_numero: 1 }), vendita("v2")], spese: [], buste: [] });
    expect(conti.aperta.numero).toBe(2);
    expect(conti.aperta.vuota).toBe(false);
    expect(conti.aperta.contanti).toBe(100);
    // con la busta ancora qui non esiste nessuna appendice
    expect(contiAppendici({ cd: APERTA, venditeShop: [vendita("v2")], spese: [], buste: [] }).aperta).toBe(null);
  });
  it("un'appendice in viaggio chiude comunque la sua busta e fa nascere la 3", () => {
    const buste = [{ id: "b2", corso_data_id: "cd1", numero: 2, spedita_il: "2026-11-10", rientrata_il: null, importo: 100 }];
    const conti = contiAppendici({ cd: IN_VIAGGIO, venditeShop: [vendita("v2", { busta_numero: 2 }), vendita("v3")], spese: [], buste });
    expect(conti.chiuse.length).toBe(1);
    expect(conti.chiuse[0].stato).toBe(BUSTA_IN_VIAGGIO);
    expect(conti.chiuse[0].contanti).toBe(100);
    expect(conti.aperta.numero).toBe(3);
  });
});

describe("il semaforo", () => {
  const sem = (cd, buste = []) => semaforoContabilita(cd, [], [], buste);
  it("rosso finché non è partita", () => {
    expect(sem(APERTA)).toBe("rosso");
  });
  it("arancione mentre è per strada: quel contante non è in nessun cassetto", () => {
    expect(sem(IN_VIAGGIO)).toBe("arancione");
  });
  it("arancione anche con un'appendice partita e non depositata", () => {
    expect(sem(IN_CASSA, [{ id: "b2", corso_data_id: "cd1", numero: 2, spedita_il: "2026-11-10", rientrata_il: null, importo: 50 }])).toBe("arancione");
  });
  it("verde solo quando è tutto in cassa", () => {
    expect(sem(IN_CASSA)).toBe("verde");
    expect(sem(IN_CASSA, [{ id: "b2", corso_data_id: "cd1", numero: 2, spedita_il: "2026-11-10", rientrata_il: "2026-11-12", depositata_il: "2026-11-12", importo: 50 }])).toBe("verde");
  });
});

describe("«In arrivo»: una busta per strada è proprio quello che sta per arrivare", () => {
  const base = { iscritti: [], corsiDateDocenti: [], master: [], masterCorsi: [], assistente: [], assistenteCorsi: [], leva: [], location: [], hotel: [], quoteVenditoriSplit: [], spese: [], venditeShop: [], busteAppendici: [] };
  it("entra col suo importo congelato, non con un conto rifatto adesso", () => {
    const r = contabilitaDaApprovare({ ...base, corsiDate: [IN_VIAGGIO] });
    expect(r.quante).toBe(1);
    expect(r.totale).toBe(300);
    expect(r.righe[0].attesa).toBe("in_viaggio");
  });
  it("una busta depositata e senza appendici non è più in arrivo", () => {
    expect(contabilitaDaApprovare({ ...base, corsiDate: [IN_CASSA] }).quante).toBe(0);
  });
  it("e un'appendice in viaggio ci entra come la prima busta", () => {
    const r = contabilitaDaApprovare({ ...base, corsiDate: [IN_CASSA], busteAppendici: [{ id: "b2", corso_data_id: "cd1", numero: 2, spedita_il: "2026-11-10", rientrata_il: null, importo: 50 }] });
    expect(r.quante).toBe(1);
    expect(r.totale).toBe(50);
    expect(r.righe[0].appendice.numero).toBe(2);
    expect(r.righe[0].attesa).toBe("in_viaggio");
  });
});
