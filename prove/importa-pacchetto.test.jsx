// «IMPORTA PACCHETTO»: la stessa lista di prodotti di un altro kit
// (9/11/2026).
//
// Il titolare: «quando creo un nuovo pacchetto di un corso ho solo i
// tasti duplica e + prodotto e non ho "importa pacchetto" che mi
// permetterebbe di importare la stessa lista di prodotti associata ad un
// altro pacchetto esistente».
//
// Si poteva gia' fare, con Copia/Incolla — ma quei due tasti compaiono
// SOLO mentre un altro pacchetto e' aperto, quindi su un pacchetto appena
// creato non si vedevano affatto. E' la lezione del POS fisico del
// 7/11: una scelta annidata la trova solo chi sa gia' che esiste.
//
// Qui si prova il gesto: il tasto c'e' sul pacchetto nuovo, apre
// l'elenco degli altri pacchetti (anche di un altro corso), e scegliendo
// uno le sue righe finiscono in QUESTO kit, con le quantita' giuste.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { PaginaContenutoKit } from "../src/App.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CORSI = [
  { id: "c1", nome: "PMU BASE" },
  { id: "c2", nome: "LAMINAZIONE BASE" },
];
// due pacchetti portano lo STESSO file di diploma: e' il caso normale,
// perche' il primo diploma caricato su un corso si attacca da se' a
// tutti i suoi pacchetti che non ne hanno uno
const DIPLOMA_PMU = { diploma_path: "kit-k1/diploma-1.pdf", diploma_nome: "Diploma PMU.pdf" };
const KIT = [
  { id: "k1", nome: "KIT BASE", corso_id: "c1", ordine: 1, tipo: "kit", ...DIPLOMA_PMU },
  { id: "k2", nome: "KIT NUOVO", corso_id: "c1", ordine: 2, tipo: "kit" },
  { id: "k3", nome: "KIT LAMINA", corso_id: "c2", ordine: 1, tipo: "kit", diploma_path: "kit-k3/diploma-9.pdf", diploma_nome: "Diploma laminazione.pdf" },
  { id: "k4", nome: "KIT VUOTO", corso_id: "c2", ordine: 2, tipo: "kit", ...DIPLOMA_PMU },
];
const RIGHE = [
  { id: "r1", kit_id: "k1", prodotto_id: "p1", tipo: "kit", quantita: 2 },
  { id: "r2", kit_id: "k1", prodotto_id: "p2", tipo: "kit", quantita: 1 },
  // un accessorio didattica NON e' contenuto del pacchetto: non si importa
  { id: "r3", kit_id: "k1", prodotto_id: "p3", tipo: "accessorio", quantita: 5 },
  { id: "r4", kit_id: "k3", prodotto_id: "p4", tipo: "kit", quantita: 3 },
];
const PRODOTTI = [
  { id: "p1", nome: "Pigmento nero", quantita: 10 },
  { id: "p2", nome: "Aghi 1RL", quantita: 50 },
  { id: "p3", nome: "Microscopio", quantita: 1 },
  { id: "p4", nome: "Colla ciglia", quantita: 7 },
];

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
const vociElenco = (p) => [...p.nodo.querySelectorAll('[data-campo="pacchetto-da-importare"]')];
// la scheda si trova PER NOME e non per posizione: i corsi sono in
// ordine alfabetico, quindi «LAMINAZIONE BASE» sta sopra «PMU BASE» e
// un indice sbagliato farebbe passare una prova che guarda il kit
// sbagliato — successo al primo giro
const schedaDi = (p, nome) => schede(p).find((s) => [...s.querySelectorAll("input")].some((i) => i.value === nome));
const tastoImporta = (p, nome) => schedaDi(p, nome).querySelector('[data-campo="importa-pacchetto"]');
const tastiImporta = (p) => [...p.nodo.querySelectorAll('[data-campo="importa-pacchetto"]')];

describe("importa pacchetto", () => {
  it("il tasto c'è su ogni pacchetto, anche su uno appena creato e vuoto", async () => {
    rispondiCon({});
    const p = await pagina();
    // quattro pacchetti, quattro tasti: non dipende dall'avere già
    // qualcosa dentro né dall'aver aperto un altro pacchetto
    expect(tastiImporta(p).length).toBe(4);
    await p.smonta();
  });

  it("apre l'elenco degli ALTRI pacchetti, con il loro corso e quanti prodotti hanno", async () => {
    rispondiCon({});
    const p = await pagina();
    // il secondo pacchetto di PMU BASE: quello «nuovo», vuoto
    await clicca(tastoImporta(p, "KIT NUOVO"));

    const voci = vociElenco(p).map((v) => v.textContent);
    // ci sono gli altri due con dei prodotti dentro, non il vuoto e non sé stesso
    expect(voci.join(" | ")).toMatch(/KIT BASE/);
    expect(voci.join(" | ")).toMatch(/KIT LAMINA/);
    expect(voci.join(" | ")).not.toMatch(/KIT VUOTO/);
    expect(voci.join(" | ")).not.toMatch(/KIT NUOVO/);
    // quello dello stesso corso viene per primo: è quello da cui si copia
    // quasi sempre
    expect(voci[0]).toMatch(/KIT BASE/);
    expect(voci[0]).toMatch(/PMU BASE/);
    // e dice quanti prodotti porta, perché è l'unico modo di accorgersi
    // di aver scelto il pacchetto sbagliato prima di premere
    expect(voci[0]).toMatch(/2 prodotti/);
    // dell'altro corso si legge il corso, così due kit con lo stesso nome
    // non si confondono
    expect(voci.find((v) => /KIT LAMINA/.test(v))).toMatch(/LAMINAZIONE BASE/);
    await p.smonta();
  });

  it("si cerca per nome del pacchetto o del corso", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(tastoImporta(p, "KIT NUOVO"));
    const casella = p.campi().find((i) => /Cerca un pacchetto/.test(i.placeholder || ""));
    await scrivi(casella, "laminaz");
    const voci = vociElenco(p).map((v) => v.textContent);
    expect(voci.length).toBe(1);
    expect(voci[0]).toMatch(/KIT LAMINA/);
    await p.smonta();
  });

  it("scelto il pacchetto, le sue righe finiscono in QUESTO kit", async () => {
    const scritte = [];
    rispondiCon({
      "/rest/v1/corsi_kit_prodotti": (corpo, indirizzo) => {
        if (corpo) scritte.push({ corpo, indirizzo });
        return [];
      },
    });
    const p = await pagina();
    await clicca(tastoImporta(p, "KIT NUOVO"));
    await clicca(vociElenco(p)[0]);   // KIT BASE
    await attendi(80);

    const inserite = scritte.find((s) => Array.isArray(s.corpo));
    expect(inserite, "le righe scritte").toBeTruthy();
    expect(inserite.corpo).toEqual([
      { kit_id: "k2", prodotto_id: "p1", tipo: "kit", quantita: 2 },
      { kit_id: "k2", prodotto_id: "p2", tipo: "kit", quantita: 1 },
    ]);
    // l'accessorio didattica del kit di partenza NON è passato
    expect(JSON.stringify(inserite.corpo)).not.toMatch(/p3/);
    await p.smonta();
  });

  it("se si annulla la conferma non si scrive niente", async () => {
    // la conferma dice che il contenuto di adesso viene sostituito: chi
    // la legge e cambia idea deve trovare il pacchetto com'era
    const vecchiaConferma = window.confirm;
    window.confirm = vi.fn(() => false);
    const scritte = [];
    rispondiCon({
      "/rest/v1/corsi_kit_prodotti": (corpo) => { if (corpo) scritte.push(corpo); return []; },
    });
    const p = await pagina();
    await clicca(tastoImporta(p, "KIT BASE")); // ha già due righe
    await clicca(vociElenco(p)[0]);
    await attendi(80);
    expect(window.confirm).toHaveBeenCalled();
    expect(scritte.length).toBe(0);
    window.confirm = vecchiaConferma;
    await p.smonta();
  });

  it("la conferma dice i due numeri quando il pacchetto non è vuoto", async () => {
    let detto = "";
    const vecchiaConferma = window.confirm;
    window.confirm = vi.fn((m) => { detto = m; return false; });
    rispondiCon({});
    const p = await pagina();
    await clicca(tastoImporta(p, "KIT BASE")); // 2 righe dentro
    await clicca(vociElenco(p)[0]);            // KIT LAMINA: 1 riga
    expect(detto).toMatch(/Righe adesso: 2/);
    expect(detto).toMatch(/Dopo: 1, prese da «KIT LAMINA» \(LAMINAZIONE BASE\)/);
    window.confirm = vecchiaConferma;
    await p.smonta();
  });

  it("ogni scheda ha i suoi tasti e la pagina non cambia senza premere", async () => {
    rispondiCon({});
    const p = await pagina();
    expect(schede(p).length).toBe(4);
    // nessun elenco aperto finché non si preme
    expect(vociElenco(p).length).toBe(0);
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// «IMPORTA DIPLOMA» (9/11/2026, chiesto subito dopo: «mi serve anche
// importa diploma»).
//
// Stessa storia del contenuto: il foglio del diploma e' quasi sempre
// quello di un altro pacchetto, e l'unica strada era ricaricare il PDF —
// cioe' tenere in giro copie dello stesso file che un giorno si
// scostano, e nessuno sa quale sia stata stampata.
const tastoDiploma = (p, nome) => schedaDi(p, nome).querySelector('[data-campo="importa-diploma"]');
const vociDiploma = (p) => [...p.nodo.querySelectorAll('[data-campo="diploma-da-importare"]')];

describe("importa diploma", () => {
  it("il tasto c'è su un pacchetto senza diploma, e non su uno che ce l'ha", async () => {
    rispondiCon({});
    const p = await pagina();
    expect(tastoDiploma(p, "KIT NUOVO"), "su quello senza").toBeTruthy();
    // chi il diploma ce l'ha vede il file associato e la crocetta per
    // toglierlo: per cambiarlo si passa da lì, come prima
    expect(tastoDiploma(p, "KIT BASE"), "su quello che ce l'ha").toBe(null);
    await p.smonta();
  });

  it("l'elenco è uno per FILE, non uno per pacchetto", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(tastoDiploma(p, "KIT NUOVO"));
    const voci = vociDiploma(p).map((v) => v.textContent);
    // KIT BASE e KIT VUOTO hanno lo stesso file: una riga sola
    expect(voci.length).toBe(2);
    expect(voci[0]).toMatch(/Diploma PMU\.pdf/);
    expect(voci[0]).toMatch(/lo usano 2 pacchetti/);
    expect(voci[1]).toMatch(/Diploma laminazione\.pdf/);
    // e quello del proprio corso viene per primo
    expect(voci[0]).toMatch(/PMU BASE/);
    await p.smonta();
  });

  it("scelto, scrive il percorso e il nome su QUESTO pacchetto", async () => {
    const scritte = [];
    rispondiCon({
      // la riga tornata indietro è quella che dice che la scrittura è
      // arrivata davvero: senza, l'app non potrebbe saperlo
      "/rest/v1/kit_definizioni": (corpo, indirizzo) => {
        if (corpo) scritte.push({ corpo, indirizzo });
        return [{ id: "k2" }];
      },
    });
    const p = await pagina();
    await clicca(tastoDiploma(p, "KIT NUOVO"));
    await clicca(vociDiploma(p)[0]);
    await attendi(80);

    const scritta = scritte.find((x) => x.corpo?.diploma_path);
    expect(scritta, "l'aggiornamento").toBeTruthy();
    expect(scritta.corpo.diploma_path).toBe("kit-k1/diploma-1.pdf");
    expect(scritta.corpo.diploma_nome).toBe("Diploma PMU.pdf");
    // su quel pacchetto e su nessun altro
    expect(scritta.indirizzo).toMatch(/id=eq\.k2/);
    await p.smonta();
  });

  it("se nessun pacchetto ha un diploma il tasto non c'è", async () => {
    // un tasto che apre un elenco vuoto manda a cercare una cosa che non
    // esiste: meglio il solo campo per caricare il file
    rispondiCon({});
    const senza = KIT.map((k) => ({ ...k, diploma_path: null, diploma_nome: null }));
    const p = await monta(
      <PaginaContenutoKit
        corsi={CORSI} kitDefinizioni={senza} setKitDefinizioni={() => {}}
        corsiKitProdotti={RIGHE} prodottiShop={PRODOTTI}
        onBack={() => {}} ricarica={() => {}}
      />
    );
    expect(p.nodo.querySelector('[data-campo="importa-diploma"]')).toBe(null);
    await p.smonta();
  });

  it("si cerca per nome del file, del pacchetto o del corso", async () => {
    rispondiCon({});
    const p = await pagina();
    await clicca(tastoDiploma(p, "KIT NUOVO"));
    const casella = p.campi().find((i) => /Cerca per nome del file/.test(i.placeholder || ""));
    await scrivi(casella, "laminaz");
    const voci = vociDiploma(p).map((v) => v.textContent);
    expect(voci.length).toBe(1);
    expect(voci[0]).toMatch(/Diploma laminazione\.pdf/);
    await p.smonta();
  });
});

// UNA SCRITTURA CHE NON TOCCA NIENTE SI DICE (9/11/2026).
//
// Il titolare, davanti a «il pacchetto non ha un modello di diploma»:
// «questo messaggio è falso, ho associato il diploma». Il database
// diceva di no. Qualunque sia stato il gesto, il guasto POSSIBILE è
// sempre lo stesso: PostgREST risponde «va bene» anche a un update che
// non ha cambiato nessuna riga, e chi preme se ne va convinto di aver
// fatto. Da qui in poi l'app conta le righe e, se sono zero, lo dice.
describe("quando il database non cambia niente", () => {
  it("l'importazione del diploma lo dice invece di far finta", async () => {
    const detti = [];
    const vecchioAlert = window.alert;
    window.alert = (m) => detti.push(m);
    rispondiCon({ "/rest/v1/kit_definizioni": () => [] });
    const p = await pagina();
    await clicca(tastoDiploma(p, "KIT NUOVO"));
    await clicca(vociDiploma(p)[0]);
    await attendi(80);
    expect(detti.join(" ")).toMatch(/NON è stato associato/);
    expect(detti.join(" ")).toMatch(/Ricarica la pagina/);
    window.alert = vecchioAlert;
    await p.smonta();
  });

  it("e con la riga cambiata non dice niente", async () => {
    const detti = [];
    const vecchioAlert = window.alert;
    window.alert = (m) => detti.push(m);
    rispondiCon({ "/rest/v1/kit_definizioni": () => [{ id: "k2" }] });
    const p = await pagina();
    await clicca(tastoDiploma(p, "KIT NUOVO"));
    await clicca(vociDiploma(p)[0]);
    await attendi(80);
    expect(detti).toEqual([]);
    window.alert = vecchioAlert;
    await p.smonta();
  });
});
