// L'INDIRIZZO GUARDATO PRIMA DI MANDARCI IL CONTRATTO.
//
// Il 22/10/2026 un modulo è partito verso «elitederma@europe.con» ed è
// tornato indietro mezzo secondo dopo. Ha la forma di un'email, quindi
// passava ogni controllo: l'unico momento per accorgersene era mentre
// la casella era ancora aperta.
import { describe, it, expect } from "vitest";
import { avvisoEmail } from "../src/iscrizione/email.js";
import { avvisoCampo } from "../src/iscrizione/disposizione.js";

describe("l'avviso sull'email", () => {
  it("prende il .con che è costato una mail rimbalzata", () => {
    const d = avvisoEmail("elitederma@europe.con");
    expect(d).toMatch(/\.con/);
    expect(d).toMatch(/\.com/);
    expect(d).toMatch(/tornerebbe indietro/);
  });

  it("prende il fornitore scritto storto", () => {
    expect(avvisoEmail("anna@gmial.com")).toMatch(/gmail/);
    expect(avvisoEmail("anna@hotmial.it")).toMatch(/hotmail/);
  });

  it("dice quando manca la chiocciola o il punto", () => {
    expect(avvisoEmail("anna.gmail.com")).toMatch(/chiocciola/);
    expect(avvisoEmail("anna@gmail")).toMatch(/nessun punto/);
    expect(avvisoEmail("anna@@gmail.com")).toMatch(/chiocciola/);
    expect(avvisoEmail("anna@gmail..com")).toMatch(/punti fuori posto/);
  });

  // UNA CASELLA CHE SBAGLIA DUE VOLTE NON LA LEGGE PIU' NESSUNO.
  // Qui stanno gli indirizzi buoni che somigliano a un errore: se uno
  // solo di questi comincia a lamentarsi, l'avviso è da buttare.
  it("sta zitta sugli indirizzi buoni", () => {
    for (const buono of [
      "anna@gmail.com", "anna@hotmail.it", "anna@libero.it", "anna@yahoo.it",
      "anna@outlook.com", "anna@icloud.com", "anna@virgilio.it", "anna@tiscali.it",
      "anna@pec.elitederma.it", "anna.maria.rossi@studio-legale.eu",
      // code vere che somigliano a sviste: Colombia, Camerun, Iran, Lituania
      "anna@elitederma.co", "anna@qualcosa.cm", "anna@qualcosa.ir", "anna@qualcosa.lt",
      // e un dominio aziendale che per caso somiglia a un fornitore
      "anna@gmail-italia.it",
    ]) {
      expect(avvisoEmail(buono), buono).toBe("");
    }
  });

  it("sulla casella vuota non dice niente", () => {
    expect(avvisoEmail("")).toBe("");
    expect(avvisoEmail(null)).toBe("");
  });

  it("e la scheda lo mostra, perché passa da avvisoCampo", () => {
    expect(avvisoCampo({ chiave: "email" }, "elitederma@europe.con")).toMatch(/\.com/);
    expect(avvisoCampo({ chiave: "email" }, "elitederma@europe.com")).toBe(null);
  });
});
