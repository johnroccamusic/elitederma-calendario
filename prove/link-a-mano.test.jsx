// IL LINK DEL MODULO, PASSATO A MANO.
//
// Il modulo parte per email e basta — il "Copia il link" era stato tolto
// il 20/10/2026 perché di una mail resta scritto cos'è partito e a chi,
// di un link in chat niente. Il 22/10 è arrivato il caso che mancava:
// tre mail consegnate a Hotmail e mai aperte, probabilmente in posta
// indesiderata, e l'iscrizione ferma senza nient'altro da provare.
//
// Torna, dentro il fascicolo e con la sua traccia.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import Fascicolo from "../src/iscrizioni/Fascicolo.jsx";
import FasciaStato from "../src/iscrizioni/FasciaStato.jsx";
import { monta, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MANDATO = {
  id: "i1", nome: "BRENDA", cognome: "SIERRA",
  token_modulo: "QHZGNE1G2E824D30",
  modulo_inviato_il: "2026-10-20T16:24:39Z",
  modulo_ricevuto_il: null,
};

async function apri(iscritto = MANDATO, copie = []) {
  const scritte = [];
  rispondiCon({
    "moduli_link_copiati": (corpo) => {
      if (corpo) { scritte.push(corpo); return [{ id: "c9", copiato_il: "2026-10-22T10:00:00Z", copiato_da: "TOMMASO" }]; }
      return copie;
    },
    "moduli_riaperture": [],
    "email_inviate": [],
    "/storage/": { signedUrl: "https://esempio/x.pdf" },
  });
  const p = await monta(<Fascicolo iscritto={iscritto} chi="TOMMASO GIUMBINI" />);
  return { ...p, scritte };
}

describe("il link passato a mano", () => {
  it("c'è, ed è scritto per esteso anche senza copiarlo", async () => {
    const p = await apri();
    expect(p.tasto("Copia il link")).toBeTruthy();
    expect(p.testo()).toMatch(/\?modulo=QHZGNE1G2E824D30/);
    expect(p.testo()).toMatch(/stesso link/);
  });

  it("copiandolo finisce negli appunti e resta scritto chi l'ha preso", async () => {
    const appunti = vi.fn(async () => {});
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText: appunti }, configurable: true });
    const p = await apri();
    await clicca(p.tasto("Copia il link"));
    expect(appunti).toHaveBeenCalledWith(expect.stringContaining("?modulo=QHZGNE1G2E824D30"));
    expect(p.scritte[0]).toMatchObject({ iscritto_id: "i1", copiato_da: "TOMMASO GIUMBINI" });
    expect(p.testo()).toMatch(/Copiato/);
  });

  it("se gli appunti non ci sono lo dice, invece di fingere", async () => {
    Object.defineProperty(window.navigator, "clipboard", { value: undefined, configurable: true });
    const p = await apri();
    await clicca(p.tasto("Copia il link"));
    expect(p.testo()).toMatch(/selezionalo qui sotto/);
    // la traccia si scrive lo stesso: il link è comunque uscito da qui
    expect(p.scritte).toHaveLength(1);
  });

  // DOPO NON SERVE PIÙ, E DARLO SAREBBE MANDARLA CONTRO UN MURO: chi lo
  // apre legge «già inviato».
  it("a modulo arrivato il link sparisce", async () => {
    const p = await apri({ ...MANDATO, modulo_ricevuto_il: "2026-10-21T09:00:00Z" });
    expect(p.tasto("Copia il link")).toBeUndefined();
  });

  it("le copie già fatte restano scritte", async () => {
    const p = await apri(MANDATO, [{ id: "c1", copiato_il: "2026-10-22T08:00:00Z", copiato_da: "ELENA" }]);
    expect(p.testo()).toMatch(/Già passato a mano/);
    expect(p.testo()).toMatch(/ELENA/);
  });
});

// IL FASCICOLO SI DEVE POTER APRIRE QUANDO LA MAIL NON TORNA, che è il
// momento in cui era chiuso.
describe("quando si apre il fascicolo", () => {
  const premibili = (p) => [...p.nodo.querySelectorAll("button")].length;

  it("col modulo mandato e non tornato, si apre", async () => {
    let aperto = false;
    const p = await monta(
      <FasciaStato stato="modulo_inviato" onFascicolo={() => { aperto = true; }} />
    );
    expect(premibili(p)).toBeGreaterThan(0);
    p.nodo.querySelector("button").click();
    expect(aperto).toBe(true);
  });

  it("prima di mandarlo resta chiuso: lì dentro non c'è nemmeno una mail", async () => {
    const p = await monta(<FasciaStato stato="dati_inseriti" onFascicolo={() => {}} />);
    expect(premibili(p)).toBe(0);
  });
});
