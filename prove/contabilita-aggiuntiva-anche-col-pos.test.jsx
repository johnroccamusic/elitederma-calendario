// LA CONTABILITÀ AGGIUNTIVA VALE ANCHE PER IL POS (12/11/2026)
//
// Il titolare: «verifica che se la busta è stata spedita, nel caso in cui
// la master riceve un pagamento al corso in contanti o con POS, si apre una
// contabilità aggiuntiva e non viene intaccata quella che già è stata
// spedita. La nuova contabilità aggiuntiva avrà un suo percorso e dovrà
// essere chiusa a parte.»
//
// Verificato: per i contanti funzionava, per il POS no — una vendita con
// carta fatta dopo la chiusura finiva dentro la prima contabilità. La causa
// non era la regola ma la marcatura: alla chiusura si scriveva il numero 1
// solo sulle vendite in contanti, quindi per il POS «prima» e «dopo» erano
// indistinguibili.
//
// Queste prove inchiodano le due facce della correzione: la regola vale per
// ogni metodo DOVE la chiusura ha marcato tutto, e NON vale dove non ha
// marcato — le 41 buste chiuse prima di oggi, che non devono muoversi di un
// centesimo.
import { describe, it, expect } from "vitest";
import "./preparazione.js";
import {
  venditaInAppendice, venditeDellaPrimaBusta, contiAppendici,
  semaforoContabilita, contabilitaDaApprovare,
} from "../src/App.jsx";

// una busta chiusa OGGI: la chiusura ha marcato tutte le vendite
const CHIUSA_OGGI = { id: "cd1", busta_spedita_il: "2026-11-12", busta_importo: 300, busta_vendite_marcate: true };
// una delle 41 buste chiuse prima del 12/11/2026: marcate solo le vendite
// in contanti
const CHIUSA_PRIMA = { id: "cd1", busta_spedita_il: "2026-10-05", busta_rientrata_il: "2026-10-05", busta_depositata_il: "2026-10-05", busta_importo: 300 };
const APERTA = { id: "cd1" };

const v = (id, metodo, extra = {}) => ({ id, corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: metodo, totale: 100, totale_imponibile: 81.97, busta_numero: null, prodotti: [], ...extra });
const DENTRO = v("v0", "contanti", { busta_numero: 1 });

describe("una vendita dopo la chiusura non tocca la contabilità già chiusa", () => {
  it("in contanti: apre la contabilità aggiuntiva", () => {
    const dopo = v("v1", "contanti");
    expect(venditaInAppendice(dopo, CHIUSA_OGGI)).toBe(true);
    expect(venditeDellaPrimaBusta([DENTRO, dopo], CHIUSA_OGGI).map((x) => x.id)).toEqual(["v0"]);
  });
  it("col POS: la stessa cosa, ed è la correzione di oggi", () => {
    const dopo = v("v1", "pos");
    expect(venditaInAppendice(dopo, CHIUSA_OGGI)).toBe(true);
    // la prima contabilità resta quello che era alla chiusura
    expect(venditeDellaPrimaBusta([DENTRO, dopo], CHIUSA_OGGI).map((x) => x.id)).toEqual(["v0"]);
  });
  it("e col buono Amazon, che non è né contante né carta", () => {
    expect(venditaInAppendice(v("v1", "buono_amazon"), CHIUSA_OGGI)).toBe(true);
  });
  it("una vendita mista ci entra per intero: lo scontrino è uno", () => {
    const dopo = v("v1", "misto", { incasso_contanti_eur: 40, incasso_carta_eur: 60 });
    expect(venditaInAppendice(dopo, CHIUSA_OGGI)).toBe(true);
    const { aperta } = contiAppendici({ cd: CHIUSA_OGGI, venditeShop: [DENTRO, dopo], spese: [], buste: [] });
    expect(aperta.vendite.map((x) => x.id)).toEqual(["v1"]);
    // nella busta ci va solo la parte in contanti
    expect(aperta.contanti).toBe(40);
  });
  it("con la busta ancora aperta non cambia niente: è tutto la prima contabilità", () => {
    const pos = v("v1", "pos");
    expect(venditaInAppendice(pos, APERTA)).toBe(false);
    expect(venditeDellaPrimaBusta([pos], APERTA).length).toBe(1);
  });
});

describe("il passato non si riscrive", () => {
  it("su una busta chiusa prima del 12/11 una vendita con carta senza numero resta nella prima contabilità", () => {
    const pos = v("v1", "pos");
    expect(venditaInAppendice(pos, CHIUSA_PRIMA)).toBe(false);
    expect(venditeDellaPrimaBusta([DENTRO, pos], CHIUSA_PRIMA).map((x) => x.id)).toEqual(["v0", "v1"]);
    // e non compare in nessuna contabilità aggiuntiva
    const { aperta } = contiAppendici({ cd: CHIUSA_PRIMA, venditeShop: [DENTRO, pos], spese: [], buste: [] });
    expect(aperta.vuota).toBe(true);
  });
  it("ma i contanti continuano a valere come sempre, anche là", () => {
    const cash = v("v1", "contanti");
    expect(venditaInAppendice(cash, CHIUSA_PRIMA)).toBe(true);
  });
});

describe("la contabilità aggiuntiva ha un suo percorso, e si chiude a parte", () => {
  it("fatta di sole vendite con carta esiste, e il suo contante è zero", () => {
    const { aperta } = contiAppendici({ cd: CHIUSA_OGGI, venditeShop: [DENTRO, v("v1", "pos")], spese: [], buste: [] });
    expect(aperta.numero).toBe(2);
    expect(aperta.vuota).toBe(false);
    expect(aperta.contanti).toBe(0);
    expect(aperta.pulito).toBe(0);
  });
  it("e la classe resta arancione finché non la si chiude", () => {
    expect(semaforoContabilita({ ...CHIUSA_OGGI, busta_depositata_il: "2026-11-12", busta_rientrata_il: "2026-11-12" }, [DENTRO, v("v1", "pos")], [], [])).toBe("arancione");
    // senza quella vendita la classe è chiusa
    expect(semaforoContabilita({ ...CHIUSA_OGGI, busta_depositata_il: "2026-11-12", busta_rientrata_il: "2026-11-12" }, [DENTRO], [], [])).toBe("verde");
  });
  it("chiusa col suo numero, la vendita con carta esce dall'aperta e la 3 nasce", () => {
    const buste = [{ id: "b2", corso_data_id: "cd1", numero: 2, spedita_il: null, rientrata_il: null, depositata_il: "2026-11-12", importo: 0 }];
    const { chiuse, aperta } = contiAppendici({ cd: CHIUSA_OGGI, venditeShop: [DENTRO, v("v1", "pos", { busta_numero: 2 })], spese: [], buste });
    expect(chiuse.length).toBe(1);
    expect(chiuse[0].vendite.map((x) => x.id)).toEqual(["v1"]);
    expect(chiuse[0].contanti).toBe(0);
    expect(aperta.numero).toBe(3);
    expect(aperta.vuota).toBe(true);
  });
  it("una contabilità aggiuntiva senza contante NON compare in «In arrivo»: non c'è niente da ricevere", () => {
    const base = { iscritti: [], corsiDateDocenti: [], master: [], masterCorsi: [], assistente: [], assistenteCorsi: [], leva: [], location: [], hotel: [], quoteVenditoriSplit: [], spese: [], busteAppendici: [] };
    const cd = { ...CHIUSA_OGGI, busta_rientrata_il: "2026-11-12", busta_depositata_il: "2026-11-12" };
    const r = contabilitaDaApprovare({ ...base, corsiDate: [cd], venditeShop: [DENTRO, v("v1", "pos")] });
    expect(r.quante).toBe(0);
    // con del contante dentro invece sì
    const r2 = contabilitaDaApprovare({ ...base, corsiDate: [cd], venditeShop: [DENTRO, v("v2", "contanti")] });
    expect(r2.quante).toBe(1);
    expect(r2.totale).toBe(100);
  });
});
