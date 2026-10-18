// IL FASCICOLO DI UN'ISCRIZIONE.
//
// Quello che si prova qui non e' che il pannello si disegni: e' che
// distingua tre cose che si somigliano e non sono la stessa cosa —
// "la mail e' partita", "il server di posta l'ha accettata", "l'allieva
// ha dichiarato di averla ricevuta". Confonderle vorrebbe dire mostrare
// a chi guarda una conferma che non c'e'.
//
// E che la tessera "Modulo ricevuto" non si prema prima che il modulo
// sia arrivato: dietro ci sarebbe una cartella vuota.
import { describe, it, expect } from "vitest";
import React from "react";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";
import Fascicolo from "../src/iscrizioni/Fascicolo.jsx";
import FasciaStato from "../src/iscrizioni/FasciaStato.jsx";

const ISCRITTA = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  nome: "GIULIA", cognome: "ROSSI",
  token_modulo: "TOKENDIPROVA00000",
  modulo_pdf_path: "TOKENDIPROVA0000/modulo-firmato-1.pdf",
  modulo_pdf_generato_il: "2026-10-18T09:00:00.000Z",
};

const MAIL = {
  id: "bbbbbbbb-0000-0000-0000-000000000001",
  chiave_modello: "ricezione_modulo",
  destinatario: "giulia@example.com",
  oggetto: "Abbiamo ricevuto il tuo modulo",
  esito: "ok", errore: null,
  inviata_il: "2026-10-18T09:01:00.000Z",
  consegnata_il: null, aperta_il: null, rimbalzata_il: null, confermata_il: null,
};

function banco(mail) {
  rispondiCon({
    "/rest/v1/email_inviate": [mail],
    "/storage/v1/object/sign/": { signedURL: "/storage/v1/object/sign/finto?token=x" },
  });
}

describe("il fascicolo di un'iscrizione", () => {
  it("non confonde «partita» con «presa visione»", async () => {
    banco(MAIL);
    const p = await monta(<Fascicolo iscritto={ISCRITTA} />);
    const t = p.testo();
    // la mail risulta partita...
    expect(t).toContain("Partita senza errori");
    // ...ma nessuno ha ancora confermato niente
    expect(t).toContain("Non ancora confermata");
    expect(t).not.toContain("Confermata il");
    await p.smonta();
  });

  it("consegnata dal postino non vuol dire presa visione", async () => {
    banco({ ...MAIL, consegnata_il: "2026-10-18T09:02:00.000Z" });
    const p = await monta(<Fascicolo iscritto={ISCRITTA} />);
    const t = p.testo();
    expect(t).toContain("Consegnata il");
    // la consegna NON deve far risultare confermata la presa visione
    expect(t).toContain("Non ancora confermata");
    await p.smonta();
  });

  it("quando l'allieva conferma, lo dice", async () => {
    banco({ ...MAIL, consegnata_il: "2026-10-18T09:02:00.000Z", confermata_il: "2026-10-18T10:30:00.000Z" });
    const p = await monta(<Fascicolo iscritto={ISCRITTA} />);
    expect(p.testo()).toContain("Confermata il");
    expect(p.testo()).not.toContain("Non ancora confermata");
    await p.smonta();
  });

  it("un rimbalzo si vede, ed e' un guasto non una sfumatura", async () => {
    banco({ ...MAIL, rimbalzata_il: "2026-10-18T09:05:00.000Z" });
    const p = await monta(<Fascicolo iscritto={ISCRITTA} />);
    expect(p.testo()).toContain("Rimbalzata il");
    await p.smonta();
  });

  it("senza copia firmata offre di generarla, e non finge che ci sia", async () => {
    banco(MAIL);
    const p = await monta(<Fascicolo iscritto={{ ...ISCRITTA, modulo_pdf_path: null }} />);
    expect(p.testo()).toContain("non è ancora stato generato");
    expect(p.tasto("Genera la copia firmata")).toBeTruthy();
    expect(p.tasto("Apri il modulo firmato")).toBeFalsy();
    await p.smonta();
  });
});

describe("la tessera «Modulo ricevuto»", () => {
  it("non si preme finche' il modulo non e' arrivato", async () => {
    let aperto = 0;
    const p = await monta(
      <FasciaStato stato="modulo_inviato" onFascicolo={() => { aperto++; }} />,
    );
    // il pallino del modulo ricevuto non deve essere un tasto
    const tasti = [...p.nodo.querySelectorAll("button")];
    for (const b of tasti) await clicca(b);
    expect(aperto).toBe(0);
    await p.smonta();
  });

  it("il rinvio si spegne quando il modulo e' arrivato", async () => {
    let mandati = 0;
    const p = await monta(
      <FasciaStato stato="modulo_ricevuto" onInvia={() => { mandati++; }} />,
    );
    for (const b of [...p.nodo.querySelectorAll("button")]) await clicca(b);
    expect(mandati).toBe(0);
    await p.smonta();
  });

  it("il rinvio funziona finche' il modulo non e' arrivato", async () => {
    let mandati = 0;
    const p = await monta(
      <FasciaStato stato="modulo_inviato" onInvia={() => { mandati++; }} />,
    );
    const tasto = [...p.nodo.querySelectorAll("button")]
      .find((b) => (b.title || "").includes("rimandarlo"));
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    expect(mandati).toBe(1);
    await p.smonta();
  });

  it("si preme da quando il modulo e' arrivato", async () => {
    let aperto = 0;
    const p = await monta(
      <FasciaStato stato="modulo_ricevuto" onFascicolo={() => { aperto++; }} />,
    );
    const tasto = [...p.nodo.querySelectorAll("button")]
      .find((b) => (b.title || "").includes("fascicolo"));
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    expect(aperto).toBe(1);
    await p.smonta();
  });
});
