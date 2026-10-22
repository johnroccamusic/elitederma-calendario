// NON SI RIMANDA A UN INDIRIZZO CHE HA GIÀ RIMBALZATO.
//
// Il 22/10/2026 lo stesso modulo è partito QUATTRO volte verso
// «elitederma@europe.con» — .con invece di .com — ed è tornato indietro
// tutte e quattro, in mezzo secondo ogni volta. Il tasto rimanda a
// quello che c'è nella casella Email, e nessuno diceva che il problema
// era lì: si ripremeva sperando.
//
// La regola, e il suo limite: si blocca solo se l'indirizzo è ANCORA
// quello che ha rimbalzato. Corretto anche di una lettera, il rinvio
// riparte — un rimbalzo vecchio non deve diventare una porta chiusa
// per sempre.
import { describe, it, expect } from "vitest";

// la decisione, nuda: è la stessa condizione scritta in eseguiInvio
function siRimanda({ rimbalzataIl, ultimoRimbalzato, emailAdesso }) {
  if (!rimbalzataIl) return true;
  const a = String(ultimoRimbalzato || "").trim().toLowerCase();
  const b = String(emailAdesso || "").trim().toLowerCase();
  return !(a && a === b);
}

describe("rimandare dopo un rimbalzo", () => {
  it("allo stesso indirizzo non si rimanda", () => {
    expect(siRimanda({
      rimbalzataIl: "2026-10-22T07:52:33Z",
      ultimoRimbalzato: "elitederma@europe.con",
      emailAdesso: "elitederma@europe.con",
    })).toBe(false);
  });

  it("corretto anche di una lettera, si rimanda", () => {
    expect(siRimanda({
      rimbalzataIl: "2026-10-22T07:52:33Z",
      ultimoRimbalzato: "elitederma@europe.con",
      emailAdesso: "elitederma@europe.com",
    })).toBe(true);
  });

  it("maiuscole e spazi non contano: è lo stesso indirizzo", () => {
    expect(siRimanda({
      rimbalzataIl: "2026-10-22T07:52:33Z",
      ultimoRimbalzato: "elitederma@europe.con",
      emailAdesso: "  Elitederma@Europe.CON ",
    })).toBe(false);
  });

  it("senza rimbalzi si rimanda e basta", () => {
    expect(siRimanda({ rimbalzataIl: null, ultimoRimbalzato: null, emailAdesso: "anna@gmail.com" })).toBe(true);
  });

  // se il registro non dice a chi era andata, non si blocca: un dubbio
  // non è un motivo per impedire di mandare una mail
  it("se non si sa a chi era andata, si rimanda", () => {
    expect(siRimanda({
      rimbalzataIl: "2026-10-22T07:52:33Z",
      ultimoRimbalzato: "",
      emailAdesso: "anna@gmail.com",
    })).toBe(true);
  });
});
