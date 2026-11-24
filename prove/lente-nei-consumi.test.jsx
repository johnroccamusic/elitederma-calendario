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
import { act } from "react";
import { SezioneConsumoProdottiKit } from "../src/App.jsx";
import CalcoloConsumi from "../src/magazzino/CalcoloConsumi.jsx";
import { combaciaPerParole } from "../src/cerca-testo.js";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const oggi = new Date();
const fra = (g) => new Date(oggi.getTime() + g * 86400000).toISOString().slice(0, 10);

const PRODOTTI = [
  { id: "p1", nome: "Pelle sintetica Premium High Quality - 1pz", quantita: 100, attivo: true, costo_acquisto: 2, aliquota_iva_acquisto: 22 },
  { id: "p2", nome: "Pigmento Arizona", quantita: 50, attivo: true, costo_acquisto: 10, aliquota_iva_acquisto: 22 },
  { id: "p3", nome: "Ago 1RL", quantita: 200, attivo: true, costo_acquisto: 1, aliquota_iva_acquisto: 22 },
  // i due della schermata del titolare: cercando «ma» deve tornare la
  // matita e NON il burro dermatologico
  { id: "p4", nome: "Matita professionale nera - media durezza", quantita: 30, attivo: true, costo_acquisto: 3, aliquota_iva_acquisto: 22 },
  { id: "p5", nome: "Burro dermatologico 125ml", quantita: 20, attivo: true, costo_acquisto: 5, aliquota_iva_acquisto: 22 },
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
  { id: "r4", kit_id: "k1", tipo: "kit", prodotto_id: "p4", quantita: 1 },
  { id: "r5", kit_id: "k1", tipo: "kit", prodotto_id: "p5", quantita: 1 },
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
    expect(nodo.textContent).toMatch(/Nessun prodotto comincia per «zzz»/);
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

// ------------------------------------------------- come si cerca un nome
//
// IL CASO VERO, con la schermata (24/11/2026): «quando faccio scegli
// prodotto la ricerca non funziona e nella tendina di destra non ci sono
// neppure tutti i prodotti». Il filtro funzionava — faceva `includes` —
// e per questo «ma» tornava «Burro der(ma)tologico», «Consenso
// infor(ma)to», «Gem(ma) swaroski»: giusto per il codice, sbagliato per
// chi sta cercando Matita.
describe("si cerca per INIZIO di parola, non per pezzo in mezzo", () => {
  it("«ma» trova Matita e Mascara, non Burro dermatologico", () => {
    expect(combaciaPerParole("Matita professionale nera", "ma")).toBe(true);
    expect(combaciaPerParole("Mascara Kerafill Daily Care", "ma")).toBe(true);
    expect(combaciaPerParole("Manipolo autoclavabile", "ma")).toBe(true);
    expect(combaciaPerParole("Burro dermatologico 125ml", "ma")).toBe(false);
    expect(combaciaPerParole("Consenso informato", "ma")).toBe(false);
    expect(combaciaPerParole("Gemma swaroski ss4", "ma")).toBe(false);
  });

  it("i nomi coi trattini si fanno trovare a pezzi: sono quasi tutti così", () => {
    const n = "Gold Master - FineArt - 1RL 0.25 LT-T - 20pz";
    expect(combaciaPerParole(n, "fine")).toBe(true);
    expect(combaciaPerParole(n, "20pz")).toBe(true);
    expect(combaciaPerParole(n, "gold fine")).toBe(true);
    expect(combaciaPerParole(n, "zzz")).toBe(false);
  });

  it("niente scritto non nasconde niente", () => {
    expect(combaciaPerParole("qualunque cosa", "")).toBe(true);
    expect(combaciaPerParole("qualunque cosa", "   ")).toBe(true);
  });

  it("nella tabella dei consumi «ma» porta la matita e lascia fuori il burro", async () => {
    rispondiCon({});
    const { nodo } = await monta(consumo());
    await scrivi(nodo.querySelector("[data-cerca-consumo] input"), "ma");
    expect(nodo.textContent).toContain("Matita professionale");
    expect(nodo.textContent).not.toContain("Burro dermatologico");
  });
});

describe("«Calcolo consumi»: una casella sola, e i risultati si vedono lì", () => {
  // IL CASO VERO (24/11/2026): due caselle affiancate — «cerca» a
  // sinistra e la tendina a destra — e il titolare, provandola: «la
  // ricerca non funziona», «non esce nessuna ricerca». Chi scrive in una
  // casella si aspetta i risultati SOTTO QUELLA CASELLA.
  const pagina = () => (
    <CalcoloConsumi
      prodottiShop={PRODOTTI} corsi={CORSI} corsiDate={CORSI_DATE} iscritti={ISCRITTI}
      quantitaPerEdizione={() => ({ p2: 2 })}
      giacenzaDi={(id) => prodottiPerId[id]?.quantita || 0}
      pezziVendutiNelPeriodo={() => 0}
    />
  );

  it("non c'è più nessuna tendina da scorrere", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    expect(nodo.querySelector("[data-prodotto]"), "la tendina dei prodotti non deve esserci più").toBeNull();
    expect(nodo.textContent).toMatch(/5 prodotti in listino/);
  });

  it("scrivendo «ma» l'elenco si apre lì sotto, con la matita e senza il burro", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const campo = [...nodo.querySelectorAll("input")].find((i) => /scrivi il nome/.test(i.placeholder || ""));
    expect(campo, "manca la casella di ricerca del prodotto").toBeTruthy();
    await scrivi(campo, "ma");
    const testo = nodo.textContent;
    expect(testo).toContain("Matita professionale");
    expect(testo).not.toContain("Burro dermatologico");
  });

  it("toccata una voce, il prodotto è scelto e si può calcolare", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const campo = [...nodo.querySelectorAll("input")].find((i) => /scrivi il nome/.test(i.placeholder || ""));
    await scrivi(campo, "arizona");
    // la PIU' INTERNA: i contenitori hanno lo stesso testo, e il
    // gestore sta sulla riga, non sulla scatola che la contiene
    const voce = [...nodo.querySelectorAll("div")].filter((d) => d.textContent.trim() === "Pigmento Arizona" && !d.querySelector("div")).pop();
    expect(voce, "la voce trovata deve comparire nell'elenco").toBeTruthy();
    // le voci rispondono a MOUSEDOWN e non a click, apposta: il click
    // arriverebbe dopo il blur del campo e l'elenco sarebbe gia' chiuso
    await act(async () => { voce.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); });
    await attendi();
    const tasto = [...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent));
    expect(tasto.disabled).toBe(false);
  });
});
