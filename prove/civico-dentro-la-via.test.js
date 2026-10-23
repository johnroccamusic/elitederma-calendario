// IL CIVICO STA DENTRO LA VIA, E IL BANCO LO VUOLE A PARTE.
// Gli indirizzi letti dai moduli cartacei sono una riga sola: 244 schede
// su 255 senza civico a parte. Qui i casi veri dell'archivio.
import { describe, it, expect } from "vitest";
import { separaCivico, pulisciCitta } from "../src/iscrizione/indirizzo-pezzi.js";

describe("separare il civico dalla via", () => {
  it("i tre indirizzi della classe di Napoli", () => {
    expect(separaCivico("Via monte pasubio 8a")).toEqual({ via: "Via monte pasubio", civico: "8a" });
    expect(separaCivico("VIA GENERALE COMO, 45")).toEqual({ via: "VIA GENERALE COMO", civico: "45" });
    expect(separaCivico("VIA GRADARA, 11")).toEqual({ via: "VIA GRADARA", civico: "11" });
  });
  it("le forme che si incontrano", () => {
    expect(separaCivico("Via Roma 12/B")).toEqual({ via: "Via Roma", civico: "12/B" });
    expect(separaCivico("Via Roma 12 bis")).toEqual({ via: "Via Roma", civico: "12bis" });
    expect(separaCivico("Via Roma snc")).toEqual({ via: "Via Roma", civico: "snc" });
    expect(separaCivico("Via Leonardo Da Vinci 12, Aldeno").civico).toBe("");
  });
  it("senza numero non inventa niente", () => {
    expect(separaCivico("Via Roma")).toEqual({ via: "Via Roma", civico: "" });
    expect(separaCivico("12")).toEqual({ via: "12", civico: "" });
    expect(separaCivico("")).toEqual({ via: "", civico: "" });
  });
  // «Via XX Settembre 4»: il numero romano non e' un civico, il 4 si'
  it("non scambia una parola della via per il civico", () => {
    expect(separaCivico("Via XX Settembre 4")).toEqual({ via: "Via XX Settembre", civico: "4" });
  });
});

describe("pulire la città", () => {
  it("toglie la sbrodolata dell'import", () => {
    expect(pulisciCitta(", BELLARIA-IGEA MARINA, RN, ITALIA")).toBe("BELLARIA-IGEA MARINA");
    expect(pulisciCitta("Trento (TN)")).toBe("Trento");
    expect(pulisciCitta("Mogliano veneto")).toBe("Mogliano veneto");
    expect(pulisciCitta("")).toBe("");
  });
});
