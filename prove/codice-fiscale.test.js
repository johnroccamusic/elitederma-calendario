// IL CODICE FISCALE HA SEDICI CARATTERI, e se ne manca uno lo dice.
//
// Sedici e quindici, scritti in maiuscolo dentro una casella, sono la stessa
// macchia: la differenza la scopriva la fattura, settimane dopo.
import { describe, it, expect } from "vitest";
import { avvisoLunghezza } from "../src/iscrizione/disposizione.js";

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
