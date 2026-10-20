// LA MAIL CHE PORTA IL MODULO ALL'ALLIEVA.
//
// Si guarda cosa viene messo nella busta, intercettando la richiesta
// che parte verso `invia-email`: e' il solo modo di sapere se quello che
// abbiamo deciso finisce davvero dentro la mail. La capacita' di
// chiedere la conferma di lettura e' stata scritta il 19/10/2026 e per
// un giorno NESSUNO la chiedeva su questa mail — non la vedeva nessuno
// perche' non partiva, e non c'era una prova a dirlo.
import { describe, it, expect } from "vitest";
import { inviaModulo, componiMailModulo, linkModulo } from "../src/iscrizioni/invio.js";
import { rispondiCon } from "./preparazione.js";

const ISCRITTO = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "ANNA", cognome: "PROVA", email: "anna@esempio.it",
  token_modulo: "t".repeat(40),
};
const CORSO = { id: "c1", nome: "PMU BASE" };
const CORSO_DATA = { id: "d1", data_inizio: "2027-05-23", data_fine: "2027-05-28", citta: "BARI" };

// cattura il corpo mandato a `invia-email` e lo restituisce
function spia() {
  const visto = { corpo: null };
  rispondiCon({
    "/functions/v1/invia-email": (corpo) => { visto.corpo = corpo; return { id: "re_1" }; },
    "/rest/v1/email_modelli": [],
    "/rest/v1/intestazione_societa": [],
    "/rest/v1/email_inviate": [],
  });
  return visto;
}

describe("la mail del modulo", () => {
  it("chiede la conferma di ricezione", async () => {
    const visto = spia();
    const esito = await inviaModulo({ iscritto: ISCRITTO, corso: CORSO, corsoData: CORSO_DATA, loc: null });
    expect(esito.ok).toBe(true);
    expect(visto.corpo.ricevuta).toBe(true);
    expect(visto.corpo.a).toBe("anna@esempio.it");
  });

  it("senza un'email valida non parte niente", async () => {
    const visto = spia();
    const esito = await inviaModulo({
      iscritto: { ...ISCRITTO, email: "   " }, corso: CORSO, corsoData: CORSO_DATA, loc: null,
    });
    expect(esito.ok).toBe(false);
    expect(esito.errore).toMatch(/email/i);
    // e soprattutto: la busta non e' stata nemmeno preparata
    expect(visto.corpo).toBe(null);
  });

  it("il link c'e' due volte: come tasto e scritto per esteso", async () => {
    const link = linkModulo(ISCRITTO.token_modulo);
    const mail = componiMailModulo({ valori: { nome: "ANNA", corso: "PMU BASE" }, righe: [link], link });
    // il tasto, per chi legge da telefono
    expect(mail.html).toContain(`<a href="${link}"`);
    expect(mail.html).toContain("Apri il modulo");
    // e l'indirizzo in chiaro, per chi non vede i tasti o vuole
    // guardarlo prima di toccarlo
    expect(mail.html.split(link).length - 1).toBeGreaterThanOrEqual(2);
    // nella versione a testo semplice il tasto non esiste: resta il link
    expect(mail.testo).toContain(link);
  });
});
