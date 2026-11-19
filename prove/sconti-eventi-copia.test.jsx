// GLI SCONTI DELLA FIERA SI RICOPIANO DA DUE POSTI (4/11/2026).
//
// Chiesto dal titolare: accanto a «Copia da corsi» ci vuole anche
// «Copia da master». Non e' un doppione — il codice d'aula e' lo sconto
// che la scuola fa ai suoi allievi, il referral personale e' quello che
// una master fa a un cliente qualunque, e al banco di una fiera il
// cliente e' proprio quello. Quale delle due somigli di piu' lo sa chi
// la fiera la fa.
//
// Cosa difendono queste prove:
//  1. i due tasti ci sono tutti e due, su carta e su contanti, e
//     scrivono due tabelle DIVERSE: se copiassero la stessa, averne due
//     sarebbe peggio che averne uno — sembrerebbe una scelta e non lo
//     sarebbe;
//  2. copiare scrive SOLO l'impostazione degli eventi: di la' non si
//     tocca niente;
//  3. da una serie tutta a zero non si copia. Quella delle master nasce
//     con sei zeri (FASCE_SCONTO_DEFAULT), quindi «esiste» sempre: un
//     tasto acceso li' sopra prometterebbe di ricopiare una tabella e
//     invece azzererebbe lo sconto della fiera con un gesto solo.
import { describe, it, expect } from "vitest";
import React from "react";
import { PannelloScontiEventi, serieScontoConPercentuali } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi } from "./aiuto.js";

const sei = (p) => [
  { da: 0, a: 16.5, percentuale: p[0] }, { da: 16.5, a: 33, percentuale: p[1] },
  { da: 33, a: 49.5, percentuale: p[2] }, { da: 49.5, a: 66, percentuale: p[3] },
  { da: 66, a: 82.5, percentuale: p[4] }, { da: 82.5, a: 100, percentuale: p[5] },
];
const serie = (p, soglie = [80, 120, 200]) => ({ soglie, gruppi: [sei(p), sei(p), sei(p), sei(p)] });

// numeri diversi in ogni tabella, apposta: e' l'unico modo di vedere
// quale tasto ha copiato che cosa
const CORSI_CARTA = serie([6, 8, 10, 10, 10, 10]);
const CORSI_CONTANTI = serie([8, 10, 12, 12, 12, 12]);
const MASTER_CARTA = serie([3, 5, 7, 9, 11, 13]);
const MASTER_CONTANTI = serie([4, 6, 8, 10, 12, 14]);

const pct = (tabella) => tabella.gruppi[0].map((f) => f.percentuale);

// Il database finto delle impostazioni condivise: in lettura risponde
// per chiave, in scrittura mette da parte quello che gli e' arrivato.
function preparaImpostazioni(valori, scritture) {
  rispondiCon({
    impostazioni_layout_tabelle: (corpo, indirizzo) => {
      if (corpo) { scritture.push(Array.isArray(corpo) ? corpo[0] : corpo); return corpo; }
      const chiave = (/chiave=eq\.([^&]+)/.exec(indirizzo) || [])[1] || "";
      return chiave in valori ? [{ valore: valori[chiave] }] : [];
    },
  });
}

async function apriPannello(valori, scritture) {
  preparaImpostazioni(valori, scritture);
  const p = await monta(
    <PannelloScontiEventi prodottiShop={[]} coupon={[]} corsi={[]} corsiDate={[]} ricarica={() => {}} isMobile={false} />,
  );
  await attendi(200);
  return p;
}

// i tasti con la stessa scritta sono due: prima quello di «Carta e shop
// online», poi quello dei contanti — l'ordine del documento e' l'ordine
// delle due sezioni
const tasti = (p, scritta) => [...p.nodo.querySelectorAll("button")]
  .filter((b) => (b.textContent || "").trim() === scritta);

// l'ultima scrittura arrivata per una chiave
const ultimaPer = (scritture, chiave) => [...scritture].reverse().find((s) => s?.chiave === chiave)?.valore;

const VALORI = {
  fasceSconto_corsi_carta: CORSI_CARTA,
  fasceSconto_corsi_contanti: CORSI_CONTANTI,
  referralMaster_regolaSconto: { tipo: "fasce", fasce: MASTER_CARTA },
  fasceSconto_referral_contanti: MASTER_CONTANTI,
};

describe("gli sconti della fiera si copiano da corsi e da master", () => {
  it("i due tasti ci sono su tutte e due le serie, e copiano due tabelle diverse", async () => {
    const scritture = [];
    const p = await apriPannello(VALORI, scritture);

    expect(tasti(p, "Copia da corsi")).toHaveLength(2);
    expect(tasti(p, "Copia da master")).toHaveLength(2);

    // carta: prima dai corsi, poi dalle master. La seconda deve
    // sovrascrivere la prima con i SUOI numeri
    await clicca(tasti(p, "Copia da corsi")[0]);
    await attendi(800);
    expect(pct(ultimaPer(scritture, "fasceSconto_eventi_carta"))).toEqual([6, 8, 10, 10, 10, 10]);

    await clicca(tasti(p, "Copia da master")[0]);
    await attendi(800);
    expect(pct(ultimaPer(scritture, "fasceSconto_eventi_carta"))).toEqual([3, 5, 7, 9, 11, 13]);

    // contanti: la serie delle master ha numeri suoi, piu' generosi
    await clicca(tasti(p, "Copia da master")[1]);
    await attendi(800);
    expect(pct(ultimaPer(scritture, "fasceSconto_eventi_contanti"))).toEqual([4, 6, 8, 10, 12, 14]);

    await clicca(tasti(p, "Copia da corsi")[1]);
    await attendi(800);
    expect(pct(ultimaPer(scritture, "fasceSconto_eventi_contanti"))).toEqual([8, 10, 12, 12, 12, 12]);

    // e di la' non si e' toccato niente: le uniche chiavi scritte sono
    // quelle degli eventi
    expect([...new Set(scritture.map((s) => s.chiave))].sort())
      .toEqual(["fasceSconto_eventi_carta", "fasceSconto_eventi_contanti"]);

    // le soglie di spesa viaggiano con la tabella, o la fascia copiata
    // finirebbe su un carrello diverso da quello di la'
    expect(ultimaPer(scritture, "fasceSconto_eventi_carta").soglie).toEqual([80, 120, 200]);
    await p.smonta();
  });

  it("da una tabella tutta a zero non si copia", () => {
    expect(serieScontoConPercentuali(serie([0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(serieScontoConPercentuali(null)).toBe(false);
    expect(serieScontoConPercentuali([])).toBe(false);
    // basta un numero in una fascia qualsiasi perche' ci sia qualcosa da copiare
    expect(serieScontoConPercentuali(serie([0, 0, 0, 0, 0, 2]))).toBe(true);
    expect(serieScontoConPercentuali(MASTER_CARTA)).toBe(true);
  });
});
