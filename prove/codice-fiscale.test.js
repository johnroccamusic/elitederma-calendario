// IL CODICE FISCALE HA SEDICI CARATTERI, e se ne manca uno lo dice.
//
// Sedici e quindici, scritti in maiuscolo dentro una casella, sono la stessa
// macchia: la differenza la scopriva la fattura, settimane dopo.
import { describe, it, expect } from "vitest";
import { avvisoLunghezza, avvisoCampo } from "../src/iscrizione/disposizione.js";
import { letteraDiControllo, avvisoCodiceFiscale, filtraCodiceFiscale } from "../src/iscrizione/codice-fiscale.js";

const campo = { chiave: "codice_fiscale", etichetta: "Codice fiscale", lunghezzaEsatta: 16 };

describe("avviso sulla lunghezza", () => {
  it("tace sulla casella vuota: non ha sbagliato niente, sta aspettando", () => {
    expect(avvisoLunghezza(campo, "")).toBeNull();
    expect(avvisoLunghezza(campo, null)).toBeNull();
    expect(avvisoLunghezza(campo, undefined)).toBeNull();
  });

  it("tace quando i caratteri sono sedici", () => {
    expect(avvisoLunghezza(campo, "RZZMNL90L42I452E")).toBeNull();
  });

  it("dice quanti ne mancano", () => {
    expect(avvisoLunghezza(campo, "RZZMNL90L42I452")).toMatch(/Manca 1 carattere/);
    expect(avvisoLunghezza(campo, "RZZMNL90L42I45")).toMatch(/Mancano 2 caratteri/);
    expect(avvisoLunghezza(campo, "RZZMNL90L42I452")).toMatch(/codice fiscale ne ha 16/);
  });

  it("non dice niente sui campi che una lunghezza fissa non ce l'hanno", () => {
    expect(avvisoLunghezza({ chiave: "citta", etichetta: "Città" }, "SOR")).toBeNull();
  });
});

// LA SEDICESIMA LETTERA E' UNA VERIFICA DELLE ALTRE QUINDICI.
//
// Su 247 codici in archivio, 11 non la superavano: arrivano dal modulo
// del sito, scritti a mano. Un codice sbagliato non si vede a occhio —
// sedici maiuscole sono una macchia uguale a un'altra — e si scopre
// settimane dopo, quando la fattura non parte.
describe("la lettera di controllo", () => {
  it("su un codice giusto non dice niente", () => {
    expect(avvisoCodiceFiscale("RZZMNL90L42I452E")).toBeNull();
    expect(avvisoCodiceFiscale("BMBGNN87T65H224D")).toBeNull();
    expect(avvisoCodiceFiscale("CPPRCC96A42F032U")).toBeNull();
  });

  it("prende i codici veri che in archivio non tornano", () => {
    // Melania De Paola: un 1 al posto della I finale
    expect(avvisoCodiceFiscale("DPLMLN02C55H7031")).toMatch(/non torna/);
    // Teresa Lupoli
    expect(avvisoCodiceFiscale("LPLTRA03M67E932Q")).toMatch(/non torna/);
    // Daniela Marchese
    expect(avvisoCodiceFiscale("MRCDNL87H47A662L")).toMatch(/non torna/);
  });

  it("prende la confusione fra 1 e I, che e' quella tipica", () => {
    expect(avvisoCodiceFiscale("LBNMZP04H681422Q")).toMatch(/non torna/);
    expect(avvisoCodiceFiscale("LBNMZP04H68I422Q")).toBeNull();
  });

  it("NON suggerisce quale sarebbe la lettera giusta", () => {
    // dirla inviterebbe a cambiare l'ultima e andare avanti, ottenendo
    // un codice che supera il controllo ed e' di un'altra persona
    const avviso = avvisoCodiceFiscale("DPLMLN02C55H7031");
    expect(avviso).not.toMatch(/\bI\b/);
    expect(avviso).toMatch(/Ricontrollalo sul documento/);
  });

  it("tace finche' i caratteri non sono sedici: li' parla gia' la lunghezza", () => {
    expect(avvisoCodiceFiscale("")).toBeNull();
    expect(avvisoCodiceFiscale("DPLMLN02C55H703")).toBeNull();
    expect(avvisoCodiceFiscale(null)).toBeNull();
  });

  it("dice la sua anche su caratteri che non possono esserci", () => {
    expect(avvisoCodiceFiscale("HTCRNI97P55Z140]")).toMatch(/solo lettere e numeri/);
  });

  it("la lettera si calcola, e su quindici caratteri regge", () => {
    expect(letteraDiControllo("BMBGNN87T65H224")).toBe("D");
    expect(letteraDiControllo("BMBGNN87T65H224D")).toBe("D");
    expect(letteraDiControllo("troppo corto")).toBeNull();
  });
});

// UN AVVISO ALLA VOLTA sotto la stessa casella: due righe rosse
// sembrano due guasti invece di uno.
describe("l'avviso del campo mette in fila i due controlli", () => {
  it("a meta' strada parla la lunghezza", () => {
    expect(avvisoCampo(campo, "DPLMLN02C55H703")).toMatch(/Manca 1 carattere/);
  });

  it("a sedici caratteri parla la lettera di controllo", () => {
    expect(avvisoCampo(campo, "DPLMLN02C55H7031")).toMatch(/non torna/);
  });

  it("su un altro campo da sedici caratteri non si inventa niente", () => {
    const altro = { chiave: "fattura_piva", etichetta: "P.IVA", lunghezzaEsatta: 16 };
    expect(avvisoCampo(altro, "DPLMLN02C55H7031")).toBeNull();
  });
});

// LA FORMA DELLA CASELLA, misurata sugli undici codici veri che in
// archivio non tornavano. Due si raddrizzano da soli, cinque si
// fermano mentre si scrive, quattro passano e li prende la lettera di
// controllo: insieme coprono tutti e undici.
describe("la casella del codice fiscale fa rispettare la forma", () => {
  it("un codice giusto passa intero, senza essere toccato", () => {
    expect(filtraCodiceFiscale("BMBGNN87T65H224D")).toBe("BMBGNN87T65H224D");
    expect(filtraCodiceFiscale("bmbgnn87t65h224d")).toBe("BMBGNN87T65H224D");
  });

  it("raddrizza da sola le due confusioni che abbiamo trovato davvero", () => {
    // Melania De Paola: un 1 dove va una lettera
    expect(filtraCodiceFiscale("DPLMLN02C55H7031")).toBe("DPLMLN02C55H703I");
    expect(avvisoCodiceFiscale(filtraCodiceFiscale("DPLMLN02C55H7031"))).toBeNull();
    // Antonia Borrelli: una O dove va una cifra
    expect(filtraCodiceFiscale("BRRNTNO7E70H892A")).toBe("BRRNTN07E70H892A");
    expect(avvisoCodiceFiscale(filtraCodiceFiscale("BRRNTNO7E70H892A"))).toBeNull();
  });

  it("SI FERMA, non salta: saltare farebbe scalare tutto il resto", () => {
    // «BRNSFNY8R70H501K» saltando la Y diventerebbe «BRNSFN87H50I»:
    // un codice diverso, con la faccia giusta. Fermandosi resta corto
    // e lo dice l'avviso sulla lunghezza.
    expect(filtraCodiceFiscale("BRNSFNY8R70H501K")).toBe("BRNSFN");
  });

  it("si ferma su quello che non puo' stare in quella posizione", () => {
    // K non e' un mese
    expect(filtraCodiceFiscale("SCCGLI85K60L849D")).toBe("SCCGLI85");
    // la parentesi quadra non e' niente
    expect(filtraCodiceFiscale("HTCRNI97P55Z140]")).toBe("HTCRNI97P55Z140");
  });

  it("non va oltre i sedici caratteri", () => {
    expect(filtraCodiceFiscale("BMBGNN87T65H224DXXXX")).toHaveLength(16);
  });

  it("regge un codice incollato con spazi e punteggiatura in mezzo", () => {
    expect(filtraCodiceFiscale("BMB GNN 87T65 H224D")).toBe("BMBGNN87T65H224D");
  });

  it("sulla casella vuota non inventa niente", () => {
    expect(filtraCodiceFiscale("")).toBe("");
    expect(filtraCodiceFiscale(null)).toBe("");
  });
});
