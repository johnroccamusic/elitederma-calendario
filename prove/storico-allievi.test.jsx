// LO STORICO ALLIEVI.
//
// «Vado nello storico allievi e non trovo nessuno»: la pagina mostrava
// l'archivio pre-gestionale piu' i soli corsi GIA' CONCLUSI, e chi
// cercava un'allieva iscritta a ottobre non la trovava — senza che
// niente a schermo dicesse perche'. Un elenco di allievi che esclude
// quelli di adesso non e' un elenco di allievi.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaStoricoAllievi } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const oggi = new Date();
const giorno = (quanti) => new Date(oggi.getTime() + quanti * 86400000).toISOString().slice(0, 10);

const CORSI = [{ id: "co1", nome: "PMU BASE" }];
const CLASSI = [
  { id: "cd-finito", corso_id: "co1", location_id: "lo1", data_inizio: giorno(-40), data_fine: giorno(-35) },
  { id: "cd-corso", corso_id: "co1", location_id: "lo1", data_inizio: giorno(-1), data_fine: giorno(2) },
  { id: "cd-futuro", corso_id: "co1", location_id: "lo1", data_inizio: giorno(30), data_fine: giorno(34) },
];
const LOCATION = [{ id: "lo1", nome: "ROMA" }];
const ISCRITTI = [
  { id: "i1", corso_data_id: "cd-finito", nome: "ANNA", cognome: "VECCHIA", telefono: "3331", email: "a@x.it" },
  { id: "i2", corso_data_id: "cd-corso", nome: "BETTA", cognome: "ADESSO", telefono: "3332", email: "b@x.it",
    codice_fiscale: "BMBGNN87T65H501A", data_nascita: "1987-12-25", comune_nascita: "ROMA",
    indirizzo_residenza: "VIA TERNI", civico_residenza: "90", cap_residenza: "00182",
    citta_residenza: "ROMA", prov_residenza: "RM", tutor: "ELENA" },
  { id: "i3", corso_data_id: "cd-futuro", nome: "CARLA", cognome: "DOMANI", telefono: "3333", email: "c@x.it" },
];
const STORICO = [{
  id: "s1", data: "2024-05-01", nome: "Fortuna", cognome: "Pierro", citta: "PESCARA",
  corso_id: "co1", telefono: null, email: null, precisione_data: "mese", origine: "storico",
}];

async function apri(props = {}) {
  rispondiCon({});
  return monta(
    <PaginaStoricoAllievi
      storicoAllievi={STORICO} corsi={CORSI} iscritti={ISCRITTI} corsiDate={CLASSI} location={LOCATION}
      ricarica={() => {}} onBack={() => {}} {...props}
    />,
  );
}

describe("storico allievi", () => {
  it("ci sono anche i corsi in corso e quelli in programma, non solo i finiti", async () => {
    const p = await apri();
    expect(p.testo()).toContain("Vecchia");   // concluso
    expect(p.testo()).toContain("Adesso");    // in corso
    expect(p.testo()).toContain("Domani");    // in programma
    expect(p.testo()).toContain("Pierro");    // archivio
    expect(p.testo()).toContain("4 allieve");
  });

  it("telefono ed email si leggono dall'elenco, senza aprire niente", async () => {
    const p = await apri();
    expect(p.testo()).toContain("3332");
    expect(p.testo()).toContain("b@x.it");
  });

  it("l'occhio apre tutto quello che di quella persona si sa", async () => {
    // prima diceva soltanto «telefono ed email vengono dal modulo: si
    // modificano da lì» — cioe' spiegava dove andare a cercare invece
    // di far vedere, mentre i dati ce li abbiamo tutti
    const p = await apri();
    const riga = [...p.nodo.querySelectorAll("tr")].find((t) => (t.textContent || "").includes("Adesso"));
    expect(riga).toBeTruthy();
    const occhio = [...riga.querySelectorAll("button")].find((b) => /dettagl/i.test(b.title || ""));
    expect(occhio).toBeTruthy();
    await clicca(occhio);
    const testo = p.testo();
    expect(testo).toContain("BMBGNN87T65H501A");
    expect(testo).toContain("VIA TERNI 90");
    expect(testo).toContain("00182 ROMA (RM)");
    expect(testo).toContain("25/12/1987");
    expect(testo).toContain("ELENA");
    // e dice a che punto è quel corso
    expect(testo).toMatch(/Corso in corso/);
  });

  it("se non è arrivata nessuna riga lo dice, invece di sembrare vuoto", async () => {
    const p = await apri({ storicoAllievi: [], iscritti: [] });
    expect(p.testo()).toMatch(/l'archivio non si è caricato/);
  });

  it("ma con i dati non lo dice", async () => {
    const p = await apri();
    expect(p.testo()).not.toMatch(/l'archivio non si è caricato/);
  });
});
