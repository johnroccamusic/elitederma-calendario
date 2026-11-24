// LA LENTE DOVE SI GUARDA QUALE PRODOTTO E' STATO USATO. 24/11/2026.
//
// Il titolare: «nella barra di ricerca dei prodotti, quelli che per
// calcolare le statistiche di quale prodotto è stato usato, non posso
// scrivere con la lente di ingrandimento la ricerca di un prodotto
// specifico, devo scorrere una lista. Inserisci pure la lente di
// ricerca.»
//
// Due pagine rispondono a quella domanda e nessuna delle due si cercava:
// «Prodotti usati per i kit → Consumo prodotti» non aveva NESSUNA
// ricerca (duecento righe ordinate per quantità: perfette per sapere cosa
// si consuma di più, inutili per sapere quante pelli sintetiche sono
// uscite), e «Calcolo consumi» ne aveva una che non si riconosceva —
// un campo nudo accanto a una tendina, e si finiva a scorrere la tendina.
import { describe, it, expect } from "vitest";
import React from "react";
import { SezioneConsumoProdottiKit } from "../src/App.jsx";
import CalcoloConsumi from "../src/magazzino/CalcoloConsumi.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const oggi = new Date();
const fra = (g) => new Date(oggi.getTime() + g * 86400000).toISOString().slice(0, 10);

const PRODOTTI = [
  { id: "p1", nome: "Pelle sintetica Premium High Quality - 1pz", quantita: 100, attivo: true, costo_acquisto: 2, aliquota_iva_acquisto: 22 },
  { id: "p2", nome: "Pigmento Arizona", quantita: 50, attivo: true, costo_acquisto: 10, aliquota_iva_acquisto: 22 },
  { id: "p3", nome: "Ago 1RL", quantita: 200, attivo: true, costo_acquisto: 1, aliquota_iva_acquisto: 22 },
];
const CORSI = [{ id: "c1", nome: "PMU BASE", posti_max: 8 }];
const CORSI_DATE = [{ id: "e1", corso_id: "c1", data_inizio: fra(-20), data_fine: fra(-18) }];
// il legame fra allieva e kit e' il NOME del pacchetto
// (`iscritti.pacchetto_kit`), non un id, e le righe della distinta vogliono
// `tipo: "kit"`: senza, `quantitaInviataPerProdotto` torna una mappa vuota
// e la tabella resta vuota — preso al primo giro di queste prove
const ISCRITTI = [
  { id: "a1", corso_data_id: "e1", pacchetto_kit: "KIT BASE" },
  { id: "a2", corso_data_id: "e1", pacchetto_kit: "KIT BASE" },
];
const KIT = [{ id: "k1", corso_id: "c1", nome: "KIT BASE", attivo: true }];
const KIT_PRODOTTI = [
  { id: "r1", kit_id: "k1", tipo: "kit", prodotto_id: "p1", quantita: 3 },
  { id: "r2", kit_id: "k1", tipo: "kit", prodotto_id: "p2", quantita: 1 },
  { id: "r3", kit_id: "k1", tipo: "kit", prodotto_id: "p3", quantita: 2 },
];
const prodottiPerId = Object.fromEntries(PRODOTTI.map((p) => [p.id, p]));

function consumo() {
  return (
    <SezioneConsumoProdottiKit
      corsi={CORSI} corsiDate={CORSI_DATE} kitDefinizioni={KIT} corsiKitProdotti={KIT_PRODOTTI}
      logisticaKitEdizioni={[]} iscritti={ISCRITTI} prodottiPerId={prodottiPerId}
      costoUnitario={(id) => {
        const p = prodottiPerId[id];
        return p?.costo_acquisto ? { netto: p.costo_acquisto, lordo: p.costo_acquisto * 1.22 } : null;
      }}
    />
  );
}

describe("«Consumo prodotti»: la lente", () => {
  it("c'è, ed è la barra di ricerca dell'app (con il tasto per svuotarla)", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    const area = nodo.querySelector("[data-cerca-consumo]");
    expect(area, "manca la barra di ricerca").toBeTruthy();
    const campo = area.querySelector("input");
    expect(campo).toBeTruthy();
    // a casella vuota il tasto per svuotare non c'è: sarebbe un dubbio
    expect(area.querySelector('[data-campo="svuota-ricerca"]')).toBeNull();
    await scrivi(campo, "pelle");
    expect(area.querySelector('[data-campo="svuota-ricerca"]')).toBeTruthy();
  });

  it("scrivendo un nome resta quel prodotto, e gli altri spariscono", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    expect(nodo.textContent).toContain("Pigmento Arizona");
    await scrivi(nodo.querySelector("[data-cerca-consumo] input"), "pelle");
    expect(nodo.textContent).toContain("Pelle sintetica");
    expect(nodo.textContent).not.toContain("Pigmento Arizona");
    expect(nodo.textContent).not.toContain("Ago 1RL");
  });

  it("si cerca come si scrive: due parole, anche spezzate", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    await scrivi(nodo.querySelector("[data-cerca-consumo] input"), "pelle prem");
    expect(nodo.textContent).toContain("Pelle sintetica Premium");
  });

  it("I TOTALI SEGUONO LA RICERCA: tre numeri che non c'entrano con la tabella sotto sono peggio di nessun numero", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    // 2 allieve × (3 pelli + 1 pigmento + 2 aghi) = 12 pezzi in tutto
    expect(nodo.textContent).toContain("12");
    await scrivi(nodo.querySelector("[data-cerca-consumo] input"), "pelle");
    // solo le pelli: 2 × 3 = 6
    const schede = nodo.textContent;
    expect(schede).toContain("6");
    // e lo dice, invece di lasciare credere che siano i totali di tutto
    expect(schede).toContain("i totali qui sotto sono di questa ricerca");
  });

  it("una ricerca senza risultati lo dice, e dice come tornare indietro", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    await scrivi(nodo.querySelector("[data-cerca-consumo] input"), "zzz");
    expect(nodo.textContent).toMatch(/Nessun prodotto con «zzz»/);
    expect(nodo.textContent).toContain("svuota la ricerca");
  });

  it("svuotata la ricerca, tornano tutti", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    const campo = nodo.querySelector("[data-cerca-consumo] input");
    await scrivi(campo, "pelle");
    expect(nodo.textContent).not.toContain("Pigmento Arizona");
    await clicca(nodo.querySelector('[data-campo="svuota-ricerca"]'));
    await attendi();
    expect(nodo.textContent).toContain("Pigmento Arizona");
    expect(nodo.textContent).toContain("Ago 1RL");
  });
});

describe("«Calcolo consumi»: la ricerca si riconosce", () => {
  const pagina = () => (
    <CalcoloConsumi
      prodottiShop={PRODOTTI} corsi={CORSI} corsiDate={CORSI_DATE} iscritti={ISCRITTI}
      quantitaPerEdizione={() => ({ p2: 2 })}
      giacenzaDi={(id) => prodottiPerId[id]?.quantita || 0}
      pezziVendutiNelPeriodo={() => 0}
    />
  );

  it("la casella è la barra dell'app, non un campo nudo", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const campo = [...nodo.querySelectorAll("input")].find((i) => /magliette/.test(i.placeholder || ""));
    expect(campo).toBeTruthy();
    await scrivi(campo, "arizona");
    // il tasto per svuotare è quello dell'app: se c'è, è CampoRicerca
    expect(nodo.querySelector('[data-campo="svuota-ricerca"]')).toBeTruthy();
  });

  it("la tendina dice quanti prodotti sta mostrando, invece di tacere", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    expect(nodo.textContent).toMatch(/3 prodotti in listino/);
    const campo = [...nodo.querySelectorAll("input")].find((i) => /magliette/.test(i.placeholder || ""));
    await scrivi(campo, "arizona");
    expect(nodo.textContent).toMatch(/1 prodotto trovato/);
  });
});
