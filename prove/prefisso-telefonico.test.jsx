// IL PREFISSO INTERNAZIONALE SI SCEGLIE, E PARTE DALLA RESIDENZA.
//
// Era una scritta fissa «+39» — nell'etichetta e dentro la casella — e
// a chi vive fuori chiedeva un numero che non ha. Qui si prova il
// gesto: si scegli il paese di residenza e il prefisso e' gia' quello,
// si batte il numero, e in archivio finisce una stringa sola.
import { describe, it, expect } from "vitest";
import React, { useState } from "react";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { STATI } from "../src/comuni-regioni.js";
import {
  prefissoDiStato, separaPrefisso, componiTelefono, vociPrefisso,
} from "../src/prefissi-telefonici.js";
import { monta, scrivi, scegliCercando } from "./aiuto.js";

// la scheda vera, con una finestrella che fa leggere cosa e' stato
// scritto: quello che conta non e' cosa si vede, e' cosa va in archivio
function Scheda({ iniziali = {} }) {
  const [valori, setValori] = useState(iniziali);
  return (
    <>
      <AreaAnagrafica
        area={AREA_ALLIEVO}
        valori={valori}
        scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
      />
      <pre data-archivio>{JSON.stringify(valori.telefono ?? null)}</pre>
    </>
  );
}
const apri = (iniziali) => monta(<Scheda iniziali={iniziali} />);
const inArchivio = (p) => JSON.parse(p.nodo.querySelector("[data-archivio]").textContent);

describe("i prefissi, come dato", () => {
  it("ogni Stato dell'elenco ne ha uno, e ha la faccia di un prefisso", () => {
    const senza = STATI.map((r) => r.split("|")[1]).filter((n) => !prefissoDiStato(n));
    expect(senza).toEqual([]);
    for (const v of vociPrefisso("")) {
      expect(v.valore).toMatch(/^\+\d{1,4}$/);
    }
  });

  it("i casi che il dataset sbagliava sono quelli giusti", () => {
    // trovati dal riepilogo del generatore, non dall'uso: senza, in
    // archivio sarebbero finiti come numeri veri
    expect(prefissoDiStato("Stato della Città del Vaticano")).toBe("+379");
    expect(prefissoDiStato("Sahara occidentale")).toBe("+212");
    // e la radice da sola non basta mai dove non e' un prefisso
    expect(prefissoDiStato("Sant'Elena")).toBe("+290");
    expect(prefissoDiStato("Isole Fær Øer")).toBe("+298");
    // mentre +1 e +7 SONO prefissi interi
    expect(prefissoDiStato("Stati Uniti d'America")).toBe("+1");
    expect(prefissoDiStato("Federazione russa")).toBe("+7");
  });

  it("la casella vuota vale Italia, come in tutta la scheda", () => {
    expect(prefissoDiStato("")).toBe("+39");
    expect(prefissoDiStato("SVIZZERA")).toBe("+41");
    expect(prefissoDiStato("Romania")).toBe("+40");
  });

  it("si spezza e si rimette insieme senza perdere cifre", () => {
    expect(separaPrefisso("+41791234567")).toEqual({ prefisso: "+41", numero: "791234567" });
    // «+1264» va riconosciuto PRIMA di «+1», o Anguilla diventerebbe
    // americana con quattro cifre di troppo nel numero
    expect(separaPrefisso("+12642351234")).toEqual({ prefisso: "+1264", numero: "2351234" });
    // 0039 e' lo stesso prefisso scritto all'antica
    expect(separaPrefisso("00393331234567")).toEqual({ prefisso: "+39", numero: "3331234567" });
    expect(componiTelefono("+41", "79 123 45 67")).toBe("+41791234567");
  });

  it("un numero vecchio senza prefisso non si inventa, si mostra", () => {
    // i 253 gia' in archivio: nessun «+», e il prefisso mostrato e'
    // quello della residenza. Nessuna cifra si perde.
    expect(separaPrefisso("3331234567", "")).toEqual({ prefisso: "+39", numero: "3331234567" });
  });

  it("senza numero non si archivia il solo prefisso", () => {
    // «+39» da solo sembrerebbe un numero e non si potrebbe chiamare
    expect(componiTelefono("+39", "")).toBe("");
  });

  it("il paese di residenza sta in cima, poi l'Italia", () => {
    const voci = vociPrefisso("SVIZZERA");
    expect(voci[0]).toMatchObject({ nome: "Svizzera", valore: "+41" });
    expect(voci[1]).toMatchObject({ nome: "Italia", valore: "+39" });
    // e nessun paese compare due volte
    expect(new Set(voci.map((v) => v.nome)).size).toBe(voci.length);
  });
});

describe("il gesto, nella scheda", () => {
  it("scelta la Svizzera, il numero battuto si archivia col +41", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    // il prefisso e' gia' quello: non si sceglie niente
    expect(p.casella("telefono_prefisso").value).toBe("+41");
    await scrivi(p.casella("telefono"), "791234567");
    expect(inArchivio(p)).toBe("+41791234567");
  });

  it("e si puo' sempre cambiare: chi vive in Svizzera puo' avere un numero italiano", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scrivi(p.casella("telefono"), "3331234567");
    expect(inArchivio(p)).toBe("+413331234567");
    // si cerca il paese per nome e il numero resta dov'era
    await scegliCercando(p, "telefono_prefisso", "Italia");
    expect(inArchivio(p)).toBe("+393331234567");
    expect(p.casella("telefono").value).toBe("3331234567");
  });

  it("il prefisso si cerca anche per cifre", async () => {
    const p = await apri({});
    await scegliCercando(p, "telefono_prefisso", "33");
    expect(p.casella("telefono_prefisso").value).toBe("+33");
  });

  // IL GESTO CHE ERA ROTTO, e che e' il gesto normale: prima si scegli
  // il paese, poi si batte il numero. In archivio va una stringa sola,
  // e senza cifre quella stringa e' vuota: la scelta del prefisso non
  // lasciava traccia e il numero nasceva col paese sbagliato.
  it("si scegli il paese PRIMA di scrivere il numero, e la scelta tiene", async () => {
    const p = await apri({});
    await scegliCercando(p, "telefono_prefisso", "Francia");
    expect(p.casella("telefono_prefisso").value).toBe("+33");
    await scrivi(p.casella("telefono"), "612345678");
    expect(inArchivio(p)).toBe("+33612345678");
  });

  it("un numero incollato per intero sposta anche il prefisso", async () => {
    // chi copia un contatto incolla «+41 79...» dentro la casella del
    // numero: senza questo il «+41» verrebbe buttato via dal filtro
    // delle cifre e il numero resterebbe attaccato al +39
    const p = await apri({});
    await scrivi(p.casella("telefono"), "+41 79 123 45 67");
    expect(p.casella("telefono_prefisso").value).toBe("+41");
    expect(inArchivio(p)).toBe("+41791234567");
  });

  it("una scheda italiana non cambia di niente", async () => {
    const p = await apri({});
    expect(p.casella("telefono_prefisso").value).toBe("+39");
    await scrivi(p.casella("telefono"), "333 1234567");
    expect(inArchivio(p)).toBe("+393331234567");
  });

  it("un numero gia' in archivio si riapre spezzato, senza essere riscritto", async () => {
    const p = await apri({ telefono: "+393331234567" });
    expect(p.casella("telefono_prefisso").value).toBe("+39");
    expect(p.casella("telefono").value).toBe("3331234567");
    // aprire e basta non tocca l'archivio
    expect(inArchivio(p)).toBe("+393331234567");
  });

  it("cancellato il numero, in archivio resta vuoto e non il prefisso", async () => {
    const p = await apri({ telefono: "+393331234567" });
    await scrivi(p.casella("telefono"), "");
    expect(inArchivio(p)).toBe("");
  });

  it("l'etichetta non dice piu' +39 a nessuno", async () => {
    const p = await apri({});
    expect(p.testo()).toMatch(/Cellulare/);
    expect(p.testo()).not.toMatch(/\(\+39/);
  });
});
