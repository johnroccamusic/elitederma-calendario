// LA MAIL TORNATA INDIETRO, SULLA FASCIA DI STATO.
//
// "Partita" e "arrivata" non sono la stessa cosa, e fino al 22/10/2026
// la fascia conosceva solo la prima: un modulo mandato a un indirizzo
// inesistente lasciava scritto "Modulo inviato", in verde, mentre la
// mail era già tornata indietro.
import { describe, it, expect } from "vitest";
import React from "react";
import FasciaStato from "../src/iscrizioni/FasciaStato.jsx";
import { monta } from "./aiuto.js";

const fascia = (props) => monta(<FasciaStato onInvia={() => {}} {...props} />);

describe("la fascia davanti a un rimbalzo", () => {
  it("senza rimbalzo dice Modulo inviato", async () => {
    const p = await fascia({ stato: "modulo_inviato" });
    expect(p.testo()).toMatch(/Modulo inviato/);
    expect(p.testo()).not.toMatch(/Non arrivata/);
  });

  it("col rimbalzo dice Non arrivata", async () => {
    const p = await fascia({ stato: "modulo_inviato", rimbalzata: true });
    expect(p.testo()).toMatch(/Non arrivata/);
    expect(p.testo()).not.toMatch(/Modulo inviato/);
  });

  it("e dice cosa fare, passandoci sopra", async () => {
    const p = await fascia({ stato: "modulo_inviato", rimbalzata: true });
    const titoli = [...p.nodo.querySelectorAll("[title]")].map((n) => n.getAttribute("title"));
    expect(titoli.join(" | ")).toMatch(/Correggi l'email nella scheda e premi per rimandare/);
  });

  // si rimanda: è tutto il punto, una volta corretto l'indirizzo
  it("il pallino resta premibile", async () => {
    let premuto = false;
    const p = await monta(
      <FasciaStato stato="modulo_inviato" rimbalzata onInvia={() => { premuto = true; }} />
    );
    const tasti = [...p.nodo.querySelectorAll("button")];
    expect(tasti.length).toBeGreaterThan(0);
    tasti[0].click();
    expect(premuto).toBe(true);
  });

  // UN RIMBALZO VECCHIO NON E' PIU' UNA COSA DA FARE: se il modulo è
  // arrivato lo stesso — indirizzo corretto e rimandato, o compilato da
  // un'altra strada — quella mail tornata indietro non interessa più.
  it("se il modulo è poi arrivato, il rimbalzo tace", async () => {
    const p = await fascia({ stato: "modulo_ricevuto", rimbalzata: true });
    expect(p.testo()).not.toMatch(/Non arrivata/);
  });

  it("e un recesso resta un recesso", async () => {
    const p = await fascia({ stato: "recesso", rimbalzata: true });
    expect(p.testo()).not.toMatch(/Non arrivata/);
  });
});
