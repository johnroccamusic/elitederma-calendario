// IL BACK ORDER DI UN BUNDLE SI EREDITA DAI COMPONENTI (4/11/2026).
//
// Il caso vero, segnalato dal titolare: Mascara Kerafill 1pz, 7 pezzi in
// casa e back order acceso; Espositore 10pz, bundle virtuale, 7 / 10 =
// zero componibili → sul sito risultava indisponibile, mentre il pezzo
// singolo si ordinava benissimo.
//
// Quello che queste prove difendono e' soprattutto il caso in cui la
// regola NON deve scattare: un componente che manca e non si puo'
// riordinare blocca il bundle, e prometterlo al cliente vorrebbe dire
// prendere un ordine che non si puo' evadere.
import { describe, it, expect } from "vitest";
import {
  bundleOrdinabileAZero,
  componibiliDa,
  campiBackorderBundle,
  messaggioBackorderBundle,
  messaggioBackorder,
  BACKORDER_TESTO_PREDEFINITO,
} from "../supabase/functions/_shared/bundle.js";

describe("quanti bundle si compongono", () => {
  it("sette pezzi da dieci per bundle fanno zero espositori", () => {
    expect(componibiliDa({ per: 10, giacenza: 7 })).toBe(0);
  });
  it("venticinque pezzi da dieci fanno due espositori, non due e mezzo", () => {
    expect(componibiliDa({ per: 10, giacenza: 25 })).toBe(2);
  });
  it("una giacenza negativa non diventa un bundle in meno", () => {
    expect(componibiliDa({ per: 10, giacenza: -4 })).toBe(0);
  });
  it("senza quantita per bundle non si compone niente", () => {
    expect(componibiliDa({ per: 0, giacenza: 100 })).toBe(0);
    expect(componibiliDa({ per: null, giacenza: 100 })).toBe(0);
  });
  it("una giacenza non scritta non vale zero per sbaglio: vale zero per scelta", () => {
    expect(componibiliDa({ per: 10, giacenza: undefined })).toBe(0);
  });
});

describe("il bundle è ordinabile a scorte zero?", () => {
  it("il caso del mascara: unico componente a back order, quindi sì", () => {
    // Mascara Kerafill Daily Care — 1pz: 7 in casa, back order acceso.
    // Espositore 10pz: zero componibili, ma i pezzi si riordinano.
    expect(bundleOrdinabileAZero([{ per: 10, giacenza: 7, backorder: true }])).toBe(true);
  });

  it("lo stesso bundle senza back order sul componente resta indisponibile", () => {
    expect(bundleOrdinabileAZero([{ per: 10, giacenza: 7, backorder: false }])).toBe(false);
  });

  it("basta UN componente che manca e non si riordina per bloccare tutto", () => {
    // la colla arriva, le ciglia no: il kit non si compone e non si
    // promette. È il caso che conta, perché il contrario sarebbe un
    // ordine che non si può evadere.
    const esito = bundleOrdinabileAZero([
      { per: 1, giacenza: 0, backorder: true },
      { per: 1, giacenza: 0, backorder: false },
    ]);
    expect(esito).toBe(false);
  });

  it("un componente che abbonda non deve bloccare il bundle anche se non è a back order", () => {
    // è il punto in cui la regola ingenua («tutti a back order»)
    // sbaglierebbe: la scatola ce n'è cinquanta, non blocca niente, e
    // pretendere il back order anche da lei terrebbe fermo l'espositore
    const esito = bundleOrdinabileAZero([
      { per: 10, giacenza: 7, backorder: true },   // è lui che blocca
      { per: 1, giacenza: 50, backorder: false },  // ne basta e avanza
    ]);
    expect(esito).toBe(true);
  });

  it("quando i componenti bastano la risposta segue comunque chi è al limite", () => {
    expect(bundleOrdinabileAZero([{ per: 10, giacenza: 100, backorder: true }])).toBe(true);
    expect(bundleOrdinabileAZero([{ per: 10, giacenza: 100, backorder: false }])).toBe(false);
  });

  it("un bundle senza distinta non si promette: non c'è niente da riordinare", () => {
    expect(bundleOrdinabileAZero([])).toBe(false);
    expect(bundleOrdinabileAZero(null)).toBe(false);
    expect(bundleOrdinabileAZero([{ per: 0, giacenza: 5, backorder: true }])).toBe(false);
  });

  it("due componenti entrambi al limite vogliono il back order su entrambi", () => {
    expect(bundleOrdinabileAZero([
      { per: 1, giacenza: 0, backorder: true },
      { per: 2, giacenza: 0, backorder: true },
    ])).toBe(true);
  });
});

describe("i campi che vanno a WooCommerce", () => {
  it("accesso: gestisce le scorte, notify, e il messaggio scritto", () => {
    const c = campiBackorderBundle(true, "Arriva in 7 giorni");
    expect(c.manage_stock).toBe(true);
    // 'notify' e non 'yes': con 'yes' il cliente può ordinare ma non
    // legge niente sulla scheda
    expect(c.backorders).toBe("notify");
    expect(c.meta_data[0]).toEqual({ key: "_elitederma_backorder_messaggio", value: "Arriva in 7 giorni" });
  });

  it("spento: il messaggio si cancella, non si lascia lì", () => {
    const c = campiBackorderBundle(false, "Arriva in 7 giorni");
    expect(c.backorders).toBe("no");
    // se restasse scritto, sulla scheda di un prodotto che non si ordina
    // più il cliente leggerebbe ancora «su ordinazione»
    expect(c.meta_data[0].value).toBe("");
  });

  it("manage_stock resta acceso anche a back order spento", () => {
    // senza, WooCommerce non guarda nemmeno la giacenza che gli mandiamo
    expect(campiBackorderBundle(false, "").manage_stock).toBe(true);
  });
});

describe("quale frase legge il cliente", () => {
  it("quella scritta sul bundle comanda", () => {
    const frase = messaggioBackorderBundle("Espositori su ordinazione, 15 giorni", [
      { per: 10, giacenza: 7, backorder: true, messaggio: "Mascara in arrivo" },
    ]);
    expect(frase).toBe("Espositori su ordinazione, 15 giorni");
  });

  it("senza quella del bundle vale quella del componente che blocca", () => {
    const frase = messaggioBackorderBundle("", [
      { per: 1, giacenza: 90, backorder: false, messaggio: "non è lei che blocca" },
      { per: 10, giacenza: 7, backorder: true, messaggio: "Mascara in arrivo" },
    ]);
    expect(frase).toBe("Mascara in arrivo");
  });

  // 10/11/2026: prima qui tornava una stringa vuota, e il titolare sulla
  // scheda dell'Espositore del Siero leggeva «Disponibile su
  // ordinazione» — la frase di WooCommerce, che non dice quando arriva.
  // Vuoto non vuol dire «nessuna frase»: vuol dire «la frase di
  // WooCommerce», quindi non si manda mai.
  it("se nessuno l'ha scritta vale quella predefinita, mai il vuoto", () => {
    expect(messaggioBackorderBundle(null, [{ per: 10, giacenza: 7, backorder: true, messaggio: null }])).toBe(BACKORDER_TESTO_PREDEFINITO);
    expect(messaggioBackorderBundle("   ", [])).toBe(BACKORDER_TESTO_PREDEFINITO);
    expect(messaggioBackorder("")).toBe(BACKORDER_TESTO_PREDEFINITO);
    expect(messaggioBackorder("  Arriva lunedì  ")).toBe("Arriva lunedì");
    // la frase dettata dal titolare, parola per parola
    expect(BACKORDER_TESTO_PREDEFINITO).toBe("Disponibile in 4 giorni");
  });
});
