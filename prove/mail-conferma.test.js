// LA MAIL DI CONFERMA: cosa ci deve essere, e cosa non ci deve essere.
//
// Nasce da un guasto fatto qui dentro il 19/10/2026: togliendo dal file
// il blocco del tasto di presa visione se n'e' andato anche
// `bloccoRecesso`, che gli stava attaccato. La funzione ha continuato a
// chiamarlo e la conferma ha smesso di partire — 500 — ma `deno check`
// non ha detto niente, perche' quel file e' JavaScript e una funzione
// che non esiste piu' non e' un errore di tipo.
//
// Il link del recesso non e' un dettaglio di stile: per legge quella
// mail lo deve portare, e il testo del modello correggibile in Setting
// non lo puo' far sparire perche' viene attaccato dopo, sempre. Una
// prova che lo guardi vale piu' di qualunque attenzione.
import { describe, it, expect } from "vitest";
import { componiMailRicezione, valoriCorso } from "../supabase/functions/_shared/email.js";

const LINK_RECESSO = "https://app.elitederma.net/?recesso=ABCD1234EFGH5678";

function componi({ modello = null } = {}) {
  const { valori, righe } = valoriCorso({
    nome: "ANNA", nomeCorso: "PMU BASE", dataInizio: "2027-05-23", dataFine: "2027-05-28",
    citta: "BARI", sede: "PUGLIAFORM", indirizzo: "Via Finta 1",
  });
  return componiMailRicezione({
    valori, righe, modello,
    societa: { nome: "ELITEDERMA Srl", indirizzo: "Via Terni 90/a" },
    linkRecesso: LINK_RECESSO,
  });
}

describe("la mail che conferma il modulo ricevuto", () => {
  it("porta sempre il link del recesso, col testo di serie", () => {
    const m = componi();
    expect(m.testo).toContain(LINK_RECESSO);
    expect(m.html).toContain(LINK_RECESSO);
    expect(m.testo).toContain("14 giorni per recedere");
  });

  it("lo porta anche quando il testo lo riscrive qualcuno da Setting", () => {
    // il modello scritto a mano non nomina il recesso: deve comparire lo
    // stesso, perche' viene attaccato dopo
    const m = componi({ modello: { oggetto: "Ciao {nome}", testo: "Tutto a posto, {nome}." } });
    // il nome esce normalizzato da `valoriCorso`: "ANNA" diventa "Anna",
    // perche' nessuno vuole leggere il proprio nome urlato in una mail
    expect(m.testo).toContain("Tutto a posto, Anna");
    expect(m.testo).toContain(LINK_RECESSO);
  });

  it("nomina l'allegato: un PDF senza una riga che lo dica passa inosservato", () => {
    const m = componi();
    expect(m.testo).toContain("copia firmata del tuo modulo");
    expect(m.html).toContain("copia firmata del tuo modulo");
  });

  it("non ha piu' il tasto di presa visione, tolto il 19/10/2026", () => {
    const m = componi();
    expect(m.testo).not.toContain("Confermo di aver ricevuto");
    expect(m.html).not.toContain("email-presa-visione");
  });

  it("il piede dice chi scrive e perche', che e' quello che la tiene fuori dallo spam", () => {
    const m = componi();
    expect(m.testo).toContain("ELITEDERMA Srl");
    expect(m.testo).toContain("Ricevi questa mail perché");
  });

  it("l'HTML si chiude: i blocchi si infilano dentro il div, non dopo", () => {
    const m = componi();
    expect(m.html.trim().endsWith("</div>")).toBe(true);
    // e il recesso sta DENTRO, non appeso fuori dalla cornice
    expect(m.html.indexOf(LINK_RECESSO)).toBeLessThan(m.html.lastIndexOf("</div>"));
  });
});
