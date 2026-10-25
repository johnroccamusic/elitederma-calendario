// IL CONFRONTO FRA DOCUMENTO E MODULO: dice cosa non torna, non decide.
import { describe, it, expect } from "vitest";
import { confrontaDocumento, differenzeDocumento, normalizzaValore, dataIso, tipoDocumentoCanonico, tipoDocumentoDelModulo, scadenzaDocumento } from "../src/iscrizione/documento.js";

describe("normalizzare prima di confrontare", () => {
  it("maiuscole, accenti, spazi e province non contano", () => {
    expect(normalizzaValore("  Petroné ", undefined)).toBe("PETRONE");
    expect(normalizzaValore("Roma (RM)", "comune")).toBe("ROMA");
    expect(normalizzaValore("23/10/1983", "data")).toBe("1983-10-23");
    expect(normalizzaValore("1983-10-23", "data")).toBe("1983-10-23");
    expect(normalizzaValore("ptr lne 83t67 e063m", "codice")).toBe("PTRLNE83T67E063M");
    expect(dataIso("23.10.1983")).toBe("1983-10-23");
  });
});

describe("confrontare", () => {
  const letto = { nome: "ELENA", cognome: "PETRONE", sesso: "F", data_nascita: "1983-10-27", comune_nascita: "GAETA", codice_fiscale: "PTRLNE83T67E063M" };
  it("trova la data sbagliata e lascia in pace il resto", () => {
    const scheda = { nome: "Elena", cognome: "PETRONE", sesso: "F", data_nascita: "1983-10-23", comune_nascita: "Gaeta (LT)", codice_fiscale: "ptrlne83t67e063m" };
    const d = differenzeDocumento(letto, scheda);
    expect(d.map((r) => r.chiave)).toEqual(["data_nascita"]);
    expect(d[0].documento).toBe("1983-10-27");
    expect(d[0].modulo).toBe("1983-10-23");
  });
  it("un campo vuoto nel modulo è «mancante», non «diverso»", () => {
    const r = confrontaDocumento(letto, { nome: "ELENA" });
    expect(r.find((x) => x.chiave === "cognome").mancante).toBe(true);
    expect(differenzeDocumento(letto, { nome: "ELENA" })).toHaveLength(0);
  });
  it("i campi che il modello non ha letto non compaiono", () => {
    expect(confrontaDocumento({ nome: "ELENA", doc_numero: null }, {}).map((r) => r.chiave)).toEqual(["nome"]);
    expect(confrontaDocumento(null, {})).toEqual([]);
  });
});

describe("il tipo di documento", () => {
  it("riconosce lo stesso tipo scritto in modi diversi", () => {
    expect(tipoDocumentoCanonico("carta_identita")).toBe("CARTA_IDENTITA");
    expect(tipoDocumentoCanonico("Carta d'identità")).toBe("CARTA_IDENTITA");
    expect(tipoDocumentoCanonico("CIE")).toBe("CARTA_IDENTITA");
    expect(tipoDocumentoCanonico("patente")).toBe("PATENTE");
    expect(tipoDocumentoDelModulo("passaporto")).toBe("Passaporto");
    expect(tipoDocumentoDelModulo("permesso_soggiorno")).toBe("");
  });
  it("contesta: dichiarato passaporto, caricata una patente", () => {
    const d = differenzeDocumento({ tipo_documento: "patente", nome: "ELENA" }, { doc_tipo: "Passaporto", nome: "ELENA" });
    expect(d.map((r) => r.chiave)).toEqual(["doc_tipo"]);
    expect(d[0].documento).toBe("Patente");
    expect(d[0].modulo).toBe("Passaporto");
    expect(differenzeDocumento({ tipo_documento: "carta_identita" }, { doc_tipo: "Carta d'identità" })).toHaveLength(0);
  });
});

describe("la scadenza", () => {
  it("scaduto ieri sì, oggi no, data illeggibile non ferma", () => {
    expect(scadenzaDocumento({ scadenza: "2026-10-24" }, "2026-10-25").scaduto).toBe(true);
    expect(scadenzaDocumento({ scadenza: "2026-10-25" }, "2026-10-25").scaduto).toBe(false);
    expect(scadenzaDocumento({ scadenza: "25/10/2031" }, "2026-10-25")).toEqual({ data: "2031-10-25", scaduto: false });
    expect(scadenzaDocumento({ scadenza: "boh" }, "2026-10-25")).toEqual({ data: "", scaduto: false });
    expect(scadenzaDocumento(null)).toEqual({ data: "", scaduto: false });
  });
});
