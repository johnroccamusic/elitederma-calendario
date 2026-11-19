// UN KIT SI PUO' SPEGNERE (14/11/2026).
//
// Il titolare: «metti sulla barra di ogni kit un selettore che spegne il
// kit e non lo renda più selezionabile quando iscrivi gli allievi. Il
// kit continua ad esistere per la logistica e gli allievi già iscritti
// mentre non si vedrà più per gli allievi futuri dal momento che il
// selettore sarà spento.»
//
// Le due facce si provano insieme, perché è la differenza fra «spento» e
// «cancellato» a essere tutto il lavoro: la levetta scrive UNA colonna e
// non tocca niente altro, e la tendina di chi iscrive smette di
// proporlo — ma chi ce l'ha già scritto se lo tiene, senza nessun avviso
// che gli dica che quel pacchetto non porta più prodotti, perché li
// porta.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { PaginaContenutoKit, CampoPacchettoKit, kitSpento } from "../src/App.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CORSI = [{ id: "c1", nome: "PMU BASE" }];
const KIT = [
  { id: "k1", nome: "KIT BASE", corso_id: "c1", ordine: 1, tipo: "kit", attivo: true },
  { id: "k2", nome: "KIT PRO VECCHIO", corso_id: "c1", ordine: 2, tipo: "kit", attivo: false },
  { id: "k3", nome: "", corso_id: "c1", ordine: 3, tipo: "divisore", attivo: true },
  // una riga nata prima della migrazione non ha la colonna: vale accesa
  { id: "k4", nome: "KIT SENZA COLONNA", corso_id: "c1", ordine: 4, tipo: "kit" },
];
const RIGHE = [{ id: "r1", kit_id: "k2", prodotto_id: "p1", tipo: "kit", quantita: 2 }];
const PRODOTTI = [{ id: "p1", nome: "Pigmento nero", quantita: 10 }];

async function pagina() {
  return monta(
    <PaginaContenutoKit
      corsi={CORSI} kitDefinizioni={KIT} setKitDefinizioni={() => {}}
      corsiKitProdotti={RIGHE} prodottiShop={PRODOTTI}
      onBack={() => {}} ricarica={() => {}}
    />
  );
}
const schede = (p) => [...p.nodo.querySelectorAll("[data-scheda-pacchetto]")];
const schedaDi = (p, nome) => schede(p).find((s) => [...s.querySelectorAll("input")].some((i) => i.value === nome));
const levetta = (p, idKit) => p.nodo.querySelector(`#kit-attivo-${idKit}`);

describe("spento non vuol dire cancellato", () => {
  it("una colonna mancante vale ACCESA", () => {
    // le 60 righe già in archivio sono nate senza: se `undefined`
    // contasse come spento, un giorno nessun kit si potrebbe più scegliere
    expect(kitSpento({})).toBe(false);
    expect(kitSpento({ attivo: true })).toBe(false);
    expect(kitSpento({ attivo: false })).toBe(true);
    expect(kitSpento(null)).toBe(false);
  });
});

describe("il selettore sulla barra del pacchetto", () => {
  it("c'è su ogni pacchetto e NON sui divisori", async () => {
    rispondiCon({});
    const p = await pagina();
    expect(levetta(p, "k1")).toBeTruthy();
    expect(levetta(p, "k2")).toBeTruthy();
    expect(levetta(p, "k4")).toBeTruthy();
    // un divisore non è un pacchetto: non si sceglie, quindi non si spegne
    expect(levetta(p, "k3")).toBeFalsy();
    await p.smonta();
  });

  it("dice quale è spento, a colpo d'occhio", async () => {
    rispondiCon({});
    const p = await pagina();
    expect(schedaDi(p, "KIT PRO VECCHIO").textContent).toMatch(/Non si vende più/i);
    expect(schedaDi(p, "KIT BASE").textContent).not.toMatch(/Non si vende più/i);
    expect(levetta(p, "k1").getAttribute("aria-checked")).toBe("true");
    expect(levetta(p, "k2").getAttribute("aria-checked")).toBe("false");
    await p.smonta();
  });

  it("premuta scrive SOLO `attivo`, e solo su quel pacchetto", async () => {
    const scritte = [];
    rispondiCon({
      "/rest/v1/kit_definizioni": (corpo, indirizzo) => {
        if (corpo) scritte.push([corpo, indirizzo]);
        return [{ id: "k1" }];
      },
    });
    const p = await pagina();
    await clicca(levetta(p, "k1"));
    await attendi(80);
    expect(scritte.length).toBe(1);
    expect(scritte[0][0]).toEqual({ attivo: false });
    expect(scritte[0][1]).toMatch(/id=eq\.k1/);
    // nessun prodotto si muove, nessuna iscrizione si tocca: spegnere non
    // è cancellare
    expect(scritte.some(([, ind]) => /corsi_kit_prodotti|iscritti/.test(ind))).toBe(false);
    await p.smonta();
  });

  it("e si riaccende", async () => {
    const scritte = [];
    rispondiCon({
      "/rest/v1/kit_definizioni": (corpo) => { if (corpo) scritte.push(corpo); return [{ id: "k2" }]; },
    });
    const p = await pagina();
    await clicca(levetta(p, "k2"));
    await attendi(80);
    expect(scritte[0]).toEqual({ attivo: true });
    await p.smonta();
  });

  it("se il database non cambia nessuna riga lo dice, invece di far finta", async () => {
    // un update senza select risponde «va bene» anche a zero righe: la
    // levetta tornerebbe indietro al ricarico e nessuno saprebbe perché
    const vecchioAlert = window.alert;
    window.alert = vi.fn();
    rispondiCon({ "/rest/v1/kit_definizioni": () => [] });
    const p = await pagina();
    await clicca(levetta(p, "k1"));
    await attendi(80);
    expect(window.alert).toHaveBeenCalled();
    expect(String(window.alert.mock.calls[0][0])).toMatch(/nessuna riga/i);
    window.alert = vecchioAlert;
    await p.smonta();
  });
});

describe("la tendina di chi iscrive", () => {
  const campo = (value, onChange = () => {}) =>
    monta(<CampoPacchettoKit value={value} onChange={onChange} opzioni={KIT} />);

  it("non propone i pacchetti spenti", async () => {
    const p = await campo("");
    const voci = [...p.nodo.querySelectorAll("option")].map((o) => o.textContent);
    expect(voci.join(" | ")).toMatch(/KIT BASE/);
    expect(voci.join(" | ")).toMatch(/KIT SENZA COLONNA/);
    expect(voci.join(" | ")).not.toMatch(/KIT PRO VECCHIO/);
    await p.smonta();
  });

  it("ma quello già scritto su una scheda resta, e NON è «non più in elenco»", async () => {
    const p = await campo("KIT PRO VECCHIO");
    const voci = [...p.nodo.querySelectorAll("option")].map((o) => o.textContent);
    // c'è, ed è scelto: aprendo la scheda di un'allieva per tutt'altro il
    // suo pacchetto non deve sparire da sotto
    expect(voci.join(" | ")).toMatch(/KIT PRO VECCHIO — non più in vendita/);
    expect(p.nodo.querySelector("select").value).toBe("KIT PRO VECCHIO");
    // «non più in elenco» vuol dire CANCELLATO, e si porta dietro la
    // frase «non porta nessun prodotto in preparazione»: qui sarebbe
    // falsa, i prodotti li porta tutti
    expect(p.testo()).not.toMatch(/non più in elenco/);
    expect(p.testo()).not.toMatch(/non porta nessun prodotto/);
    expect(p.testo()).toMatch(/porta i suoi prodotti in preparazione/);
    await p.smonta();
  });

  it("un kit cancellato davvero continua a dirsi «non più in elenco»", async () => {
    const p = await campo("KIT CHE NON ESISTE PIÙ");
    expect(p.testo()).toMatch(/non più in elenco/);
    expect(p.testo()).toMatch(/non porta nessun prodotto/);
    await p.smonta();
  });
});
