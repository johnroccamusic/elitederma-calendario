// «1 PEZZO OGNI N ALLIEVI» SUGLI ACCESSORI DIDATTICA (17/11/2026).
//
// Il titolare: «negli accessori dobbiamo aggiungere la casella che indica
// quanti pezzi di ciascun prodotto ogni xx allievi. Ad esempio 1 specchio
// ogni 4 allievi: se ci sono 5 allievi, al quinto saranno 2 specchi da
// inviare».
//
// Un gruppo cominciato conta intero (arrotondare in giu' vuol dire
// un'allieva senza specchio), una riga senza gruppo resta fissa per
// corso com'era, e la logistica si trova il numero gia' calcolato.
import { describe, it, expect } from "vitest";
import React from "react";
import { quantitaAccessorio, accessoriDaElencare } from "../src/rientri/composizione";
import { PaginaContenutoKit, PannelloPreparazioneKit } from "../src/App.jsx";
import { monta, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

describe("quanti pezzi di un accessorio partono per una classe", () => {
  const specchio = { quantita: 1, ogni_allievi: 4 };

  it("1 ogni 4: con 5 allievi partono 2 specchi", () => {
    expect(quantitaAccessorio(specchio, 1)).toBe(1);
    expect(quantitaAccessorio(specchio, 4)).toBe(1);
    expect(quantitaAccessorio(specchio, 5)).toBe(2);
    expect(quantitaAccessorio(specchio, 8)).toBe(2);
    expect(quantitaAccessorio(specchio, 9)).toBe(3);
  });

  it("la quantità vale per ogni gruppo: 2 ogni 3, con 7 allievi, fa 6", () => {
    expect(quantitaAccessorio({ quantita: 2, ogni_allievi: 3 }, 7)).toBe(6);
  });

  it("senza gruppo la quantità resta fissa per corso, come prima", () => {
    expect(quantitaAccessorio({ quantita: 3 }, 12)).toBe(3);
    expect(quantitaAccessorio({ quantita: 3, ogni_allievi: null }, 1)).toBe(3);
    expect(quantitaAccessorio({ quantita: 3, ogni_allievi: 0 }, 1)).toBe(3);
  });

  it("allievi sconosciuti: vale il numero della scheda; zero allievi: zero", () => {
    expect(quantitaAccessorio(specchio, null)).toBe(1);
    expect(quantitaAccessorio(specchio, undefined)).toBe(1);
    expect(quantitaAccessorio(specchio, 0)).toBe(0);
  });

  it("l'elenco della logistica porta la quantità calcolata e quella della scheda", () => {
    const righe = [
      { corso_id: "c1", kit_id: null, prodotto_id: "sp", tipo: "accessorio", quantita: 1, ogni_allievi: 4 },
      { corso_id: "c1", kit_id: null, prodotto_id: "fo", tipo: "accessorio", quantita: 2, ogni_allievi: null },
    ];
    const lista = accessoriDaElencare({ corsiKitProdotti: righe, corsoId: "c1", accessoriQuantita: {}, dataInizio: "2099-01-01", oggi: "2026-11-17", allievi: 5 });
    expect(lista.find((r) => r.prodotto_id === "sp")).toMatchObject({ quantita: 2, quantita_scheda: 1 });
    expect(lista.find((r) => r.prodotto_id === "fo")).toMatchObject({ quantita: 2 });
    // chi non passa gli allievi riceve le righe come sono
    const senza = accessoriDaElencare({ corsiKitProdotti: righe, corsoId: "c1", accessoriQuantita: {}, dataInizio: "2099-01-01", oggi: "2026-11-17" });
    expect(senza.find((r) => r.prodotto_id === "sp").quantita).toBe(1);
  });
});

// ---------------------------------------------------------------------
// la scheda in «Tipologie di kit»: la casella si scrive
const CORSI = [{ id: "c1", nome: "PMU BASE" }];
const RIGHE = [
  { id: "a1", kit_id: null, corso_id: "c1", prodotto_id: "p1", tipo: "accessorio", quantita: 1, ogni_allievi: null },
];
const PRODOTTI = [{ id: "p1", nome: "Specchio PMU", quantita: 30 }];

describe("la casella «ogni quanti allievi» nella scheda del corso", () => {
  it("scrivere 4 salva ogni_allievi = 4 su quella riga", async () => {
    const chiamato = rispondiCon({ corsi_kit_prodotti: [{ id: "a1" }] });
    const p = await monta(
      <PaginaContenutoKit
        corsi={CORSI} kitDefinizioni={[]} setKitDefinizioni={() => {}}
        corsiKitProdotti={RIGHE} prodottiShop={PRODOTTI}
        onBack={() => {}} ricarica={() => {}}
      />
    );
    await clicca(p.tasto("Accessori didattica"));
    const casella = p.nodo.querySelector('[data-riga-accessorio="Specchio PMU"] [data-campo="ogni-allievi"]');
    expect(casella, "la casella c'è").toBeTruthy();
    expect(casella.value).toBe("");
    await scrivi(casella, "4");
    casella.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    const patch = chiamato.mock.calls.find(([, o]) => o?.method === "PATCH");
    expect(patch, "la scrittura").toBeTruthy();
    expect(String(patch[0])).toContain("a1");
    expect(JSON.parse(patch[1].body)).toEqual({ ogni_allievi: 4 });
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// e la logistica: il contatore parte dal numero già calcolato
describe("in logistica il numero è già calcolato sugli iscritti", () => {
  it("5 allievi, 1 specchio ogni 4: il contatore dice 2 e la regola si legge", async () => {
    const iscritti = Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, nome: `A${i}`, cognome: "P", pacchetto_kit: "Kit", kit_id: "k1" }));
    const p = await monta(
      <PannelloPreparazioneKit
        corsoData={{ id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-11-14", data_fine: "2099-11-15" }}
        corso={{ id: "c1", nome: "PMU BASE" }} loc={{ id: "l1", nome: "Sede", citta: "ROMA" }}
        statoEdizione={{ corso_data_id: "cd1", riserva_per_kit: {}, accessori_quantita: {} }}
        kitDefinizioni={[{ id: "k1", nome: "Kit", corso_id: "c1", tipo: "kit", ordine: 1 }]}
        corsiKitProdotti={[{ id: "a1", kit_id: null, corso_id: "c1", prodotto_id: "p1", tipo: "accessorio", quantita: 1, ogni_allievi: 4 }]}
        prodottiShop={PRODOTTI}
        iscrittiEdizione={iscritti} inventarioSede={[]} prodottiApertiMagazzino={[]}
        nomeUtente="Raf" onSalvaCampi={() => {}} onCambiaTagliaIscritto={() => {}}
      />
    );
    const riga = p.nodo.querySelector('[data-riga-corredo="Specchio PMU"]');
    expect(riga).toBeTruthy();
    expect(riga.querySelector("input").value).toBe("2");
    expect(riga.textContent).toContain("1 ogni 4 allievi");
    await p.smonta();
  });
});
