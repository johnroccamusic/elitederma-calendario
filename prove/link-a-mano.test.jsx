// IL LINK DEL MODULO, PASSATO A MANO.
//
// Il modulo parte per email e basta — il "Copia il link" era stato tolto
// il 20/10/2026 perché di una mail resta scritto cos'è partito e a chi,
// di un link in chat niente. Il 22/10 è arrivato il caso che mancava:
// tre mail consegnate a Hotmail e mai aperte, probabilmente in posta
// indesiderata, e l'iscrizione ferma senza nient'altro da provare.
//
// Torna, con la sua traccia, nella finestra del rinvio — perché è lì che
// nasce il bisogno: si rimanda proprio perché la prima mail non è
// arrivata. Nel fascicolo resta solo la traccia di chi l'ha preso.
import { describe, it, expect } from "vitest";
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

// IL TASTO NON STA NEL FASCICOLO, e ci e' stato per mezz'ora prima che
// il titolare lo dicesse: «non serve nel fascicolo, serve proprio in
// quel tasto dove si sceglie il tipo di invio». Aveva ragione — il
// bisogno nasce mentre si rimanda, non due schermate piu' in la'.
// Nel fascicolo resta la traccia, che e' un fatto da ritrovare.
describe("nel fascicolo resta solo la traccia", () => {
  it("niente tasto per copiare", async () => {
    const p = await apri();
    expect(p.tasto("Copia il link")).toBeUndefined();
  });

  it("ma le copie già fatte si leggono", async () => {
    const p = await apri(MANDATO, [{ id: "c1", copiato_il: "2026-10-22T08:00:00Z", copiato_da: "ELENA" }]);
    expect(p.testo()).toMatch(/Il link passato a mano/);
    expect(p.testo()).toMatch(/ELENA/);
  });

  it("e senza nessuna copia il riquadro non c'è", async () => {
    const p = await apri();
    expect(p.testo()).not.toMatch(/Il link passato a mano/);
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
