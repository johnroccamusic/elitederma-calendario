// LA QUOTA COORDINATORE LA VEDE CHI LA PRENDE (28/11/2026).
//
// Il titolare: «le commissioni sui corsi di Elena le vedono tutti».
// Era vero, e la scheda non aveva nessuna condizione: stava dietro al
// solo `mesiCoordinatore.length > 0 &&`, quindi la leggeva chiunque
// aprisse la linguetta «Commissioni sui corsi» della Dashboard
// venditori — e quella tessera ce l'hanno quattordici venditori.
// Tredici persone che leggono il compenso della quattordicesima.
//
// Qui dentro ci sono tre cose, e la terza e' quella che dura: la regola
// pura, le pagine montate e premute per davvero, e una guardia che
// rilegge `src/App.jsx` — perche' il buco si riapre con una riga, e un
// componente che mostra quello che gli viene dato non se ne accorge.
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { CommissioniSuiCorsi, vedeQuotaCoordinatore } from "../src/App.jsx";
import { monta } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

// Elena, come e' scritta davvero in archivio: il venditore si chiama
// «ELENA», la sua utenza d'ufficio «Elena Rocca», e le due sono
// collegate dallo stesso id di venditore.
const ELENA = { id: "v-elena", nome: "ELENA", permessi: ["dashboardvenditori"] };
const MARIO = { id: "v-mario", nome: "MARIO", permessi: ["dashboardvenditori"] };
const COORD = { personaNome: "ELENA", personaId: "v-elena", percentuale: 0.5, dal: "2026-10-01" };

describe("chi vede la scheda della quota coordinatore", () => {
  it("chi amministra la vede sempre: e' chi la paga", () => {
    expect(vedeQuotaCoordinatore(COORD, { amministra: true, identita: [] })).toBe(true);
    expect(vedeQuotaCoordinatore(COORD, { amministra: true, identita: [MARIO] })).toBe(true);
  });

  it("la vede chi la prende, riconosciuta dall'id", () => {
    expect(vedeQuotaCoordinatore(COORD, { identita: [{ id: "v-elena", nome: "Elena Rocca" }] })).toBe(true);
  });

  it("NON la vede un altro venditore", () => {
    expect(vedeQuotaCoordinatore(COORD, { identita: [MARIO] })).toBe(false);
  });

  // il caso vero del 28/11: la riga salvata in archivio porta il solo
  // nome, perche' l'id e' nato oggi. Senza questo ripiego la scheda
  // sarebbe sparita anche a Elena, cioe' all'unica che deve vederla.
  it("senza id scritto vale il nome, come la riga salvata prima di oggi", () => {
    const senzaId = { personaNome: "ELENA", percentuale: 0.5, dal: "2026-10-01" };
    expect(vedeQuotaCoordinatore(senzaId, { identita: [{ id: "v-elena", nome: "ELENA" }] })).toBe(true);
    expect(vedeQuotaCoordinatore(senzaId, { identita: [{ id: "v-elena", nome: " elena " }] })).toBe(true);
    expect(vedeQuotaCoordinatore(senzaId, { identita: [MARIO] })).toBe(false);
  });

  // con l'id scritto il nome non basta piu': due omonimi non devono
  // poter leggere la stessa cifra.
  it("con l'id scritto un omonimo NON la vede", () => {
    expect(vedeQuotaCoordinatore(COORD, { identita: [{ id: "v-altra", nome: "ELENA" }] })).toBe(false);
  });

  it("senza nessuno che guarda non si vede niente", () => {
    expect(vedeQuotaCoordinatore(COORD, {})).toBe(false);
    expect(vedeQuotaCoordinatore(COORD, { identita: [null] })).toBe(false);
  });

  it("un'impostazione spenta non si vede nemmeno a chi la prende", () => {
    expect(vedeQuotaCoordinatore({ personaNome: "", percentuale: 0, dal: "" }, { identita: [ELENA] })).toBe(false);
  });
});

// LA SCHEDA MONTATA PER DAVVERO. Si monta `CommissioniSuiCorsi`, che
// e' il pezzo che tiene la serratura e legge l'impostazione dal
// database come in app; che la dashboard gli passi l'identita' giusta
// lo tengono le guardie qui sotto, perche' quello e' un collegamento e
// un componente non puo' accorgersi di riceverlo sbagliato.
//
// `LAYOUT_CARICATE` tiene la promessa in memoria per tutto il file,
// quindi l'impostazione si serve una volta sola: il coordinatore e'
// ELENA in tutte e tre le prove, e cambia solo chi guarda.
const FRA_UN_MESE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const CORSO = { id: "c1", nome: "PMU BASE", posti_max: 10 };
const SEDE = { id: "l1", nome: "SEDE ROMA", citta: "ROMA" };
const CD = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: FRA_UN_MESE, data_fine: FRA_UN_MESE };
const ISC = [{ id: "i1", nome: "ALLIEVA", cognome: "PROVA", corso_data_id: "cd1", totale_pattuito: 2000, quota_venditore: 140 }];

async function scheda(prop) {
  rispondiCon({
    impostazioni_layout_tabelle: { valore: { personaNome: "ELENA", percentuale: 0.5, dal: "2026-10-01" } },
    commissioni_corsi_liquidazioni: [],
  });
  return monta(
    <CommissioniSuiCorsi
      iscritti={ISC} corsiDate={[CD]} corsi={[CORSO]} location={[SEDE]} isMobile={false}
      {...prop}
    />
  );
}

describe("la scheda, montata", () => {
  it("un altro venditore non vede la scheda, e non legge il nome del coordinatore", async () => {
    const p = await scheda({ identita: [MARIO] });
    expect(p.nodo.querySelector('[data-campo="quota-coordinatore"]')).toBeNull();
    expect(p.testo()).not.toContain("Quota coordinatore");
    expect(p.testo()).not.toContain("ELENA");
  });

  it("Elena la vede, col suo nome e le sue righe", async () => {
    const p = await scheda({ identita: [{ id: "v-elena", nome: "ELENA" }] });
    expect(p.nodo.querySelector('[data-campo="quota-coordinatore"]')).not.toBeNull();
    expect(p.testo()).toContain("Quota coordinatore");
    expect(p.nodo.querySelectorAll('[data-campo="coord-mese"]').length).toBeGreaterThan(0);
  });

  it("chi amministra la vede anche guardando la dashboard di un altro", async () => {
    const p = await scheda({ amministra: true, identita: [MARIO] });
    expect(p.nodo.querySelector('[data-campo="quota-coordinatore"]')).not.toBeNull();
  });

  // LIQUIDARE E' UN ATTO CONTABILE: congela un importo e dichiara che
  // quel mese e' stato pagato. Fino al 28/11/2026 il tasto lo poteva
  // premere qualunque venditore che aprisse questa pagina.
  it("Elena vede la sua scheda ma NON puo' liquidare", async () => {
    const p = await scheda({ identita: [{ id: "v-elena", nome: "ELENA" }] });
    expect(p.nodo.querySelector('[data-campo="quota-coordinatore"]')).not.toBeNull();
    expect(p.tasto("Liquida")).toBeUndefined();
    expect(p.tasto("Riapri")).toBeUndefined();
  });

  it("chi amministra puo' liquidare", async () => {
    const p = await scheda({ amministra: true, identita: [MARIO] });
    expect(p.tasto("Liquida")).toBeTruthy();
  });
});

// LA GUARDIA. Il guasto non stava in un componente — stava in una
// condizione che mancava — quindi una prova che monta una pagina lo
// vede solo se la pagina gli arriva con le prop giuste. Queste righe
// guardano il codice.
describe("la guardia: il buco non si riapre", () => {
  it("la scheda passa da vedeQuotaCoordinatore", () => {
    const i = SORGENTE.indexOf('data-campo="quota-coordinatore"');
    expect(i).toBeGreaterThan(0);
    const prima = SORGENTE.slice(Math.max(0, i - 400), i);
    expect(prima).toContain("vedeCoordinatore &&");
    expect(SORGENTE).toContain("const vedeCoordinatore = vedeQuotaCoordinatore(");
  });

  it("la vecchia condizione nuda non torna", () => {
    // `{mesiCoordinatore.length > 0 && (` da sola era tutto il
    // controllo che c'era: mostrava la scheda a chiunque.
    expect(SORGENTE).not.toContain("{mesiCoordinatore.length > 0 && (");
  });

  it("chi guarda e' il venditore BLOCCATO, non quello scelto dalla tendina", () => {
    const i = SORGENTE.indexOf("const identitaChiGuarda =");
    expect(i).toBeGreaterThan(0);
    const blocco = SORGENTE.slice(i, i + 400);
    expect(blocco).toContain("venditoreBloccato");
    // leggere `venditoreSel` vorrebbe dire che basta scegliere il
    // coordinatore dalla tendina per aprire la sua scheda, e in quello
    // stato ci arriva chiunque non sia l'utente generico.
    expect(blocco).not.toContain("venditoreSel");
  });

  it("amministra vuol dire programmatore o amministratore, non l'assenza del blocco", () => {
    const i = SORGENTE.indexOf("const amministra = ruoloUtente ===");
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(i, i + 160)).toContain('"amministratore"');
  });

  it("la dashboard riceve il ruolo da chi la monta", () => {
    const i = SORGENTE.indexOf("<PaginaDashboardVenditori");
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(i, i + 1600)).toContain("ruoloUtente={ruoloUtente}");
  });

  it("Setting salva anche l'id del coordinatore", () => {
    expect(SORGENTE).toContain("personaId: idPersona");
  });

  // «commissioni sui corsi e' una sezione aperta solo ad elena che ha
  // una percentuale sui corsi. fine. gli altri neppure devono sapere
  // che esiste» — quindi non si nasconde la scheda dentro una linguetta
  // che tutti vedono: si toglie la linguetta.
  it("la LINGUETTA esiste solo per chi vede le commissioni", () => {
    const i = SORGENTE.indexOf('chiave: "commissioni", testo: "Commissioni sui corsi"');
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(Math.max(0, i - 220), i)).toContain("vedeCommissioni ?");
  });

  it("e il contenuto non si disegna comunque senza il permesso", () => {
    expect(SORGENTE).toContain('{tabDashboardVenditore === "commissioni" && vedeCommissioni && (');
  });

  it("la linguetta la decide la stessa funzione della scheda", () => {
    const i = SORGENTE.indexOf("const vedeCommissioni = vedeQuotaCoordinatore(");
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(i, i + 300)).toContain("identita: identitaChiGuarda");
  });

  // «altrimenti si vedono 3 bottoni a sinistra e un vuoto a destra»: la
  // griglia era inchiodata a quattro colonne, quindi togliendo una
  // tessera restava al suo posto un buco della sua misura.
  it("le colonne della griglia le conta l'elenco delle tessere", () => {
    const i = SORGENTE.indexOf("const tessereVenditore = [");
    expect(i).toBeGreaterThan(0);
    const j = SORGENTE.indexOf("tessereVenditore.map((t) => (");
    expect(j).toBeGreaterThan(i);
    const griglia = SORGENTE.slice(SORGENTE.lastIndexOf("<div style={{ display: \"grid\"", j), j);
    expect(griglia).toContain("repeat(${tessereVenditore.length}");
    // le quattro colonne fisse non devono tornare, in nessuno dei due rami
    expect(griglia).not.toContain('"repeat(4, minmax(0, 1fr))"');
    expect(griglia).not.toContain('"repeat(4, calc((100% - 3 * 14px) / 4))"');
  });

  it("la tessera resta della misura di sempre: si centra, non si allarga", () => {
    // la larghezza massima segue il numero di tessere, quindi tre tessere
    // occupano tre quarti di quella larghezza e la griglia le centra;
    // un 820 inchiodato le avrebbe allargate per riempire il vuoto
    expect(SORGENTE).toContain("const larghezzaTessereDash = tessereVenditore.length * larghezzaTesseraDash");
    const j = SORGENTE.indexOf("tessereVenditore.map((t) => (");
    const griglia = SORGENTE.slice(SORGENTE.lastIndexOf("<div style={{ display: \"grid\"", j), j);
    expect(griglia).toContain("larghezzaTessereDash");
  });

  it("i due tasti contabili sono di chi amministra, e la riga si firma", () => {
    expect(SORGENTE).toContain("liquidato_da: operatore || null");
    const i = SORGENTE.indexOf('{inCorso === m.chiave ? "Liquido…" : "Liquida"}');
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(Math.max(0, i - 400), i)).toContain("amministra && (");
  });
});
