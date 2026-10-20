// DATA E LUOGO DI NASCITA, E IL CODICE FISCALE CHE NE ESCE.
//
// Il gesto vero: si sceglie F, si scrive la data, si scrive il comune, e
// il codice compare da se'. Qui si clicca, perche' quello che deve
// funzionare e' la sequenza — il calcolo da solo e' gia' provato in
// codice-fiscale.test.js.
import { describe, it, expect } from "vitest";
import React, { useState } from "react";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { monta, clicca, scrivi, scegli, premi } from "./aiuto.js";

function Scheda({ iniziali = {} }) {
  const [valori, setValori] = useState(iniziali);
  return (
    <AreaAnagrafica
      area={AREA_ALLIEVO}
      valori={valori}
      scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
    />
  );
}
const apri = (iniziali) => monta(<Scheda iniziali={iniziali} />);
const campo = (p, chiave) => p.nodo.querySelector(`input[data-campo="${chiave}"]`);
const tastoSesso = (p, v) => p.nodo.querySelector(`button[data-campo="sesso"][data-valore="${v}"]`);

// Giovanna Bambace: scheda vera, e il codice vero e' quello in
// archivio. Data e luogo qui non li ho inventati — si leggono dal suo
// codice: `T` e' dicembre, `65` e' il 25 (giorno + 40, donna), `H224`
// e' Reggio di Calabria.
const BAMBACE = { cognome: "BAMBACE", nome: "GIOVANNA" };

describe("il codice fiscale si compila da se'", () => {
  it("scelti sesso, data e comune, il codice compare", async () => {
    const p = await apri(BAMBACE);
    expect(campo(p, "codice_fiscale").value).toBe("");
    await clicca(tastoSesso(p, "F"));
    await scrivi(campo(p, "data_nascita"), "1987-12-25");
    await scrivi(campo(p, "comune_nascita"), "REGGIO DI CALABRIA");
    expect(campo(p, "codice_fiscale").value).toBe("BMBGNN87T65H224D");
    // e lo dice: chi guarda la scheda deve sapere che non l'ha scritto
    // nessuno
    expect(p.testo()).toMatch(/Calcolato da data e luogo di nascita/);
  });

  it("un codice gia' scritto non si tocca", async () => {
    // il caso dell'omocodia: l'Agenzia ne cambia delle cifre, e il
    // calcolo non puo' saperlo. Quello che c'e' in archivio comanda.
    const p = await apri({ ...BAMBACE, codice_fiscale: "BMBGNN87T65H224P" });
    await clicca(tastoSesso(p, "F"));
    await scrivi(campo(p, "data_nascita"), "1987-12-25");
    await scrivi(campo(p, "comune_nascita"), "REGGIO DI CALABRIA");
    expect(campo(p, "codice_fiscale").value).toBe("BMBGNN87T65H224P");
  });

  it("cancellato a mano, resta cancellato", async () => {
    const p = await apri(BAMBACE);
    await clicca(tastoSesso(p, "F"));
    await scrivi(campo(p, "data_nascita"), "1987-12-25");
    await scrivi(campo(p, "comune_nascita"), "REGGIO DI CALABRIA");
    expect(campo(p, "codice_fiscale").value).toBe("BMBGNN87T65H224D");
    // lo svuota: era quello il motivo per cui si cancella un codice
    // calcolato, e riscriverglielo addosso renderebbe la casella
    // impossibile da correggere
    await scrivi(campo(p, "codice_fiscale"), "");
    expect(campo(p, "codice_fiscale").value).toBe("");
  });

  it("nata all'estero: lo Stato spegne il comune, e il codice usa il suo codice", async () => {
    const p = await apri({ cognome: "POPA", nome: "MARIA" });
    await clicca(tastoSesso(p, "F"));
    await scrivi(campo(p, "data_nascita"), "1990-03-12");
    await scegli(p.tendina("stato_nascita"), "Romania");
    expect(campo(p, "comune_nascita").disabled).toBe(true);
    expect(campo(p, "codice_fiscale").value).toMatch(/Z129.$/);
  });

  it("senza il sesso non si calcola niente", async () => {
    // il giorno di una donna e' il giorno + 40: indovinarlo vorrebbe
    // dire un codice valido di un'altra persona
    const p = await apri(BAMBACE);
    await scrivi(campo(p, "data_nascita"), "1987-12-25");
    await scrivi(campo(p, "comune_nascita"), "REGGIO DI CALABRIA");
    expect(campo(p, "codice_fiscale").value).toBe("");
  });

  it("un codice che contraddice la data di nascita si dice", async () => {
    const p = await apri({
      ...BAMBACE, sesso: "F", data_nascita: "1987-12-25",
      comune_nascita: "REGGIO DI CALABRIA",
      // lettera di controllo giusta, ma e' il codice di chi e' nata nel 1990
      codice_fiscale: "BMBGNN90T65H224Y",
    });
    expect(p.testo()).toMatch(/una data di nascita diversa/);
  });

  it("il comune si sceglie dall'elenco, e «REGGIO CALABRIA» lo trova", async () => {
    // il nome ufficiale e' «Reggio di Calabria»: chi scrive senza il
    // «di» — cioe' chiunque — non otteneva nessun codice e nessun
    // motivo. Adesso lo trova e lo sceglie.
    const p = await apri(BAMBACE);
    await clicca(tastoSesso(p, "F"));
    await scrivi(campo(p, "data_nascita"), "1987-12-25");
    await scrivi(campo(p, "comune_nascita"), "REGGIO CALABRIA");
    const prima = p.nodo.querySelector('[data-proposta="0"]');
    expect(prima).not.toBe(null);
    expect(prima.textContent).toContain("Reggio di Calabria");
    // la provincia accanto non e' decorazione: i Reggio sono tre
    expect(prima.textContent).toContain("RC");
    await premi(prima);
    expect(campo(p, "comune_nascita").value).toBe("REGGIO DI CALABRIA");
    expect(campo(p, "codice_fiscale").value).toBe("BMBGNN87T65H224D");
  });

  it("un comune che non esiste lo dice, invece di tacere", async () => {
    const p = await apri(BAMBACE);
    await scrivi(campo(p, "comune_nascita"), "REGGIO CALABRIA");
    expect(p.testo()).toMatch(/non è nell'elenco dei comuni/);
    await premi(p.nodo.querySelector('[data-proposta="0"]'));
    expect(p.testo()).not.toMatch(/non è nell'elenco dei comuni/);
  });

  it("su una scheda gia' compilata l'elenco non si apre da solo", async () => {
    const p = await apri({ ...BAMBACE, comune_nascita: "REGGIO DI CALABRIA" });
    expect(p.nodo.querySelector('[data-proposta="0"]')).toBe(null);
  });
});
