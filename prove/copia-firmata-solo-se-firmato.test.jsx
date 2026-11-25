// «UN ERRORE NELLA RISTAMPA DEL MODULO» (25/11/2026).
//
// Il titolare, con una schermata del fascicolo di un'allieva: premendo
// «Genera la copia firmata» si leggeva, in rosso, «Edge Function
// returned a non-2xx status code».
//
// Erano due cose, e la seconda è quella che conta.
//
// 1. LA FUNZIONE IL MOTIVO LO DICEVA: 409, «Il modulo non risulta
//    ancora ricevuto». Ma `supabase.functions.invoke`, davanti a una
//    risposta non-2xx, lascia `data` nullo e appende il corpo a
//    `error.context`, quindi `error.message` è sempre quella frase
//    inutile. È la lezione dell'8/11/2026, e `testoErroreFunzione`
//    esiste apposta: questa pagina non la usava.
//
// 2. IL TASTO NON DOVEVA ESSERCI. Compariva su ogni scheda da «Modulo
//    inviato» in poi, cioè su 265 iscrizioni su 313 il cui modulo non è
//    mai tornato — 254 delle quali confermate lo stesso, perché
//    iscritte prima o su carta. Lì non c'è nessuna firma da
//    fotografare. Un tasto che non può riuscire è peggio di un tasto
//    che manca: chi lo preme crede di aver sbagliato lui.
//
// Misurato lo stesso giorno: dei 48 moduli davvero tornati, OGGI CE
// L'HANNO TUTTI la loro copia. Quel ramo resta per i moduli che
// torneranno, non per un recupero da fare.
import { describe, it, expect } from "vitest";
import React from "react";
import Fascicolo from "../src/iscrizioni/Fascicolo.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const BASE = {
  id: "i1", nome: "VERONICA", cognome: "PASQUA", token_modulo: "tok-1",
  stato: "confermato", modulo_ricevuto_il: null, modulo_pdf_path: null, email: "x@y.it",
};

function finta() {
  rispondiCon({
    "rest/v1/email_inviate": () => [],
    "rest/v1/moduli_riaperture": () => [],
    "rest/v1/moduli_link_copiati": () => [],
  });
}

describe("la copia firmata di un modulo mai tornato", () => {
  it("IL CASO VERO: niente tasto, e si dice perché", async () => {
    finta();
    const p = await monta(<Fascicolo iscritto={BASE} />);
    await attendi();
    // la frase è quella dettata dal titolare
    expect(p.testo()).toContain("Modulo non presente: inviato con il vecchio sistema");
    expect(p.testo()).not.toContain("Genera la copia firmata");
    await p.smonta();
  });

  it("un modulo ancora da mandare dice che comparirà, non che manca qualcosa", async () => {
    finta();
    const p = await monta(<Fascicolo iscritto={{ ...BASE, stato: "modulo_inviato" }} />);
    await attendi();
    expect(p.testo()).toContain("appena lei lo invia");
    expect(p.testo()).not.toContain("Genera la copia firmata");
    await p.smonta();
  });

  it("col modulo tornato e la copia mancante il tasto c'è: il recupero resta possibile", async () => {
    finta();
    const p = await monta(<Fascicolo iscritto={{ ...BASE, modulo_ricevuto_il: "2026-11-20T10:00:00Z" }} />);
    await attendi();
    expect(p.testo()).toContain("Genera la copia firmata");
    await p.smonta();
  });
});

describe("l'errore dice il perché", () => {
  it("il messaggio della funzione arriva a schermo, non «non-2xx status code»", async () => {
    const { testoErroreFunzione } = await import("../src/errore-funzione.js");
    const finto = {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => ({ ok: false, errore: "Il modulo non risulta ancora ricevuto." }) },
    };
    expect(await testoErroreFunzione(finto)).toBe("Il modulo non risulta ancora ricevuto.");
  });

  it("la pagina la usa invece di leggere error.message nudo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sorgente = fs.readFileSync(path.join(process.cwd(), "src/iscrizioni/Fascicolo.jsx"), "utf8");
    expect(sorgente).toContain("await testoErroreFunzione(error)");
    expect(sorgente).not.toContain("throw new Error(error.message)");
  });
});
