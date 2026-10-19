// IL MODULO CHE COMPILA L'ALLIEVA.
//
// Si monta davvero e si preme davvero: questa pagina si e' rotta due volte in
// modi che la compilazione non vedeva — un componente dichiarato dentro un
// altro che distruggeva i campi a ogni lettera, e un identificatore che non
// esisteva. Qui si guarda cosa si vede e cosa succede quando si tocca.
import { describe, it, expect, afterEach } from "vitest";
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

const TOKEN = "g".repeat(40);
// la bozza vive in localStorage: senza questa pulizia una prova si
// porterebbe dietro quello che ha scritto la precedente. Si cancella per
// chiave, non si svuota tutto — il banco tocca solo cio' che crea.
afterEach(() => {
  try { window.localStorage.removeItem(`modulo-bozza-${TOKEN.slice(0, 16)}`); } catch { /* niente */ }
});

async function apriIlModulo(vista = VISTA) {
  rispondiCon({ "/rest/v1/rpc/modulo_vista": vista });
  return monta(<PaginaModulo token={TOKEN} />);
}

// apre il regolamento e lo richiude: e' il gesto che sblocca il resto
async function leggiEChiudi(p) {
  await clicca(p.tasto("Leggi il regolamento"));
  await clicca(p.tasto("Chiudi il regolamento"));
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

  it("senza aprire il regolamento non si firma e non si spunta niente", async () => {
    const p = await apriIlModulo();
    // la lavagna della firma non c'e' ancora
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
    expect(p.testo()).toContain("Leggi con attenzione il regolamento");
    expect(p.testo()).toContain("ATTENZIONE");
    // e le caselle delle dichiarazioni sono spente
    const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
    expect(spunte.length).toBeGreaterThan(0);
    expect(spunte.every((x) => x.disabled)).toBe(true);
    expect(p.testo()).toContain("Aprire il regolamento e richiuderlo");
  });

  it("aperto e richiuso, firma e dichiarazioni si sbloccano", async () => {
    const p = await apriIlModulo();
    await leggiEChiudi(p);
    expect(p.nodo.querySelector("canvas")).toBeTruthy();
    const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
    expect(spunte.every((x) => x.disabled)).toBe(false);
    expect(p.testo()).not.toContain("Aprire il regolamento e richiuderlo");
  });

  it("aprirlo e lasciarlo aperto non basta: conta la richiusura", async () => {
    const p = await apriIlModulo();
    await clicca(p.tasto("Leggi il regolamento"));
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
  });

  it("il campo del documento si apre col tocco, non da codice", async () => {
    // il documento compare solo se la scheda lo prevede: la vista di
    // partenza non lo ha, e senza questa riga si proverebbe un campo che
    // non e' stato nemmeno chiesto
    const p = await apriIlModulo({ ...VISTA, campi: [
      ...VISTA.campi,
      { chiave: "doc_fronte", valore: null, bloccato: false, obbligatorio: true },
      { chiave: "doc_retro", valore: null, bloccato: false, obbligatorio: true },
    ] });
    const file = p.nodo.querySelector('input[type="file"]');
    expect(file).toBeTruthy();
    // deve stare DENTRO una label: e' quello che fa partire il selettore
    // come gesto dell'utente, e non smette di funzionare dopo un
    // annullamento sull'iPhone
    expect(file.closest("label")).toBeTruthy();
    // e non deve essere irraggiungibile al tocco
    expect(file.style.pointerEvents).not.toBe("none");
  });

  it("un modulo gia' inviato non si riapre", async () => {
    const p = await apriIlModulo({ ...VISTA, scaduto: true, motivo: "gia_inviato", ricevuto: true });
    expect(p.testo()).toContain("Modulo già inviato");
    // e il modulo non c'e': niente firma, niente tasto di invio
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
    expect(p.tasto("Leggi il regolamento")).toBeFalsy();
  });

  it("un'iscrizione confermata dice un'altra cosa", async () => {
    const p = await apriIlModulo({ ...VISTA, scaduto: true, motivo: "confermato" });
    expect(p.testo()).toContain("già confermata");
    expect(p.testo()).not.toContain("Modulo già inviato");
  });

  it("quello che aveva scritto si ritrova, e lo dice", async () => {
    window.localStorage.setItem(`modulo-bozza-${TOKEN.slice(0, 16)}`, JSON.stringify({
      risposte: { telefono: "3331234567" }, spunte: {}, regolamentoLetto: true,
    }));
    const p = await apriIlModulo();
    expect(p.testo()).toContain("Abbiamo ritrovato quello che avevi già scritto");
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("3331234567");
    // la bozza si portava dietro anche il regolamento gia' letto
    expect(p.nodo.querySelector("canvas")).toBeTruthy();
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
