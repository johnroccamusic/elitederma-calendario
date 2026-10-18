// IL MODULO CHE COMPILA L'ALLIEVA.
//
// Si monta davvero e si preme davvero: questa pagina si e' rotta due volte in
// modi che la compilazione non vedeva — un componente dichiarato dentro un
// altro che distruggeva i campi a ogni lettera, e un identificatore che non
// esisteva. Qui si guarda cosa si vede e cosa succede quando si tocca.
import { describe, it, expect } from "vitest";
import React from "react";
import PaginaModulo from "../src/iscrizione/PaginaModulo.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const CLAUSOLA = "non ha diritto ad alcun rimborso";

const VISTA = {
  nome: "ANNA PROVA", stato: "modulo_inviato", scaduto: false, ricevuto: false,
  contratto: {},   // vuoto: vince il testo del codice, come in produzione
  corso: { nome: "PMU BASE", citta: "BARI", sede: "BARI", indirizzo: "Via Finta 1", inizio: "2027-05-23", fine: "2027-05-28" },
  campi: [
    { chiave: "nome", valore: "ANNA", bloccato: true, obbligatorio: true },
    { chiave: "cognome", valore: "PROVA", bloccato: true, obbligatorio: true },
    { chiave: "email", valore: "anna@esempio.it", bloccato: true, obbligatorio: true },
    { chiave: "codice_fiscale", valore: null, bloccato: false, obbligatorio: true },
    { chiave: "stato_residenza", valore: null, bloccato: false, obbligatorio: true },
    { chiave: "telefono", valore: null, bloccato: false, obbligatorio: true },
    { chiave: "tipo_cliente", valore: "privato", bloccato: false, obbligatorio: true },
  ],
};

async function apriIlModulo() {
  rispondiCon({ "/rest/v1/rpc/modulo_vista": VISTA });
  return monta(<PaginaModulo token={"g".repeat(40)} />);
}

describe("modulo di iscrizione", () => {
  it("si apre e saluta l'allieva per nome", async () => {
    const p = await apriIlModulo();
    expect(p.testo()).toContain("ANNA");
    expect(p.testo()).toContain("PMU BASE");
  });

  it("il regolamento parte CHIUSO: lo apre chi lo vuole leggere", async () => {
    const p = await apriIlModulo();
    expect(p.testo()).not.toContain(CLAUSOLA);
    expect(p.tasto("Leggi il regolamento")).toBeTruthy();
    expect(p.testo()).toMatch(/\d+ punti/);
  });

  it("premendo si apre, ripremendo si richiude", async () => {
    const p = await apriIlModulo();
    await clicca(p.tasto("Leggi il regolamento"));
    expect(p.testo()).toContain(CLAUSOLA);
    expect(p.tasto("Chiudi il regolamento")).toBeTruthy();
    await clicca(p.tasto("Chiudi il regolamento"));
    expect(p.testo()).not.toContain(CLAUSOLA);
  });

  it("la dichiarazione obbligatoria resta sul modulo anche col regolamento chiuso", async () => {
    const p = await apriIlModulo();
    expect(p.testo()).toMatch(/regolamento/i);
  });

  it("i suggerimenti dentro le caselle sono quelli smorzati", async () => {
    const p = await apriIlModulo();
    const conSuggerimento = p.campi().filter((i) => (i.getAttribute("placeholder") || "").trim() !== "");
    expect(conSuggerimento.length).toBeGreaterThan(0);
    for (const casella of conSuggerimento) {
      expect(casella.className).toContain("suggerimento-chiaro");
    }
  });
});
