// «MODELLE FIERA» (7/11/2026): il consenso della modella al banco.
//
// Chiesto dal titolare con la fiera di Napoli aperta. La cosa che queste
// prove difendono è una sola, e non è l'aspetto della pagina: che il
// consenso firmato al banco PORTI CON SÉ LA FIERA. Un consenso senza
// padrone è il guasto di ottobre — sette consensi che non sapevano a
// quale corso appartenessero e che nessuno poteva più rivendicare — e in
// fiera sarebbe peggio: le modelle sono molte, di nessuna classe, e se
// una domani contesta un trattamento quel foglio va ritrovato.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import ModelleFiera from "../src/consensi/ModelleFiera.jsx";
import { salvaConsenso, leggiConsensiDellEvento } from "../src/consensi/dati";
import { CONSENSI } from "../src/content/consensi";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi, scegli } from "./aiuto.js";

const oggi = new Date().toISOString().slice(0, 10);
const FIERA = { id: "ev1", nome: "Fiera di Napoli", citta: "Napoli", stato: "programmato", data_inizio: oggi, data_fine: oggi };
const ALTRA = { id: "ev2", nome: "Fiera di Tirana", citta: "Tirana", stato: "programmato", data_inizio: oggi, data_fine: oggi };

const FIRMATO = {
  id: "co1", evento_id: "ev1", corso_data_id: null, modello_codice: "pmu-micro",
  versione_testo: "pmu-micro-v3", nome: "GIULIA", cognome: "VERDI",
  consenso_trattamento: true, consenso_foto_video: false, ts: new Date().toISOString(),
};

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");

// ---------------------------------------------------------------------
// Dove finisce scritta l'appartenenza
describe("il consenso sa a chi appartiene", () => {
  const dati = {
    modelloCodice: "pmu-micro", versioneTesto: "pmu-micro-v3",
    nome: "Giulia", cognome: "Verdi", consensoTrattamento: true, consensoFotoVideo: false,
  };

  it("firmato al banco di una fiera, porta la fiera", async () => {
    let scritto = null;
    rispondiCon({ "/consensi_modelle": (corpo) => { scritto = corpo; return []; } });
    const esito = await salvaConsenso(dati, {}, { eventoId: "ev1" });
    expect(esito.errore).toBeFalsy();
    expect(scritto.evento_id).toBe("ev1");
    // e NON una classe: in fiera una classe non c'è, e inventarla
    // vorrebbe dire attribuire una firma a un'aula che non c'era
    expect(scritto.corso_data_id).toBe(null);
  });

  it("firmato in aula, porta la classe e nessuna fiera", async () => {
    let scritto = null;
    rispondiCon({ "/consensi_modelle": (corpo) => { scritto = corpo; return []; } });
    await salvaConsenso(dati, {}, { corsoDataId: "cd1" });
    expect(scritto.corso_data_id).toBe("cd1");
    expect(scritto.evento_id).toBe(null);
  });

  it("firmato col codice generico, non porta niente (e si trova solo in archivio)", async () => {
    let scritto = null;
    rispondiCon({ "/consensi_modelle": (corpo) => { scritto = corpo; return []; } });
    await salvaConsenso(dati, {}, {});
    expect(scritto.corso_data_id).toBe(null);
    expect(scritto.evento_id).toBe(null);
  });

  it("i consensi di una fiera si chiedono per la sua colonna, non per nome", async () => {
    let chiesto = "";
    rispondiCon({ "/consensi_modelle": (_corpo, url) => { chiesto = url; return [FIRMATO]; } });
    const righe = await leggiConsensiDellEvento("ev1");
    expect(chiesto).toContain("evento_id=eq.ev1");
    expect(righe[0].eventoId).toBe("ev1");
    expect(righe[0].nome).toBe("GIULIA");
  });

  it("senza fiera non si chiede niente al database", async () => {
    let chiamate = 0;
    rispondiCon({ "/consensi_modelle": () => { chiamate += 1; return []; } });
    expect(await leggiConsensiDellEvento("")).toEqual([]);
    expect(chiamate).toBe(0);
  });
});

// ---------------------------------------------------------------------
// La pagina, come la usa chi sta al banco
describe("la pagina «Modelle fiera»", () => {
  async function pagina(eventi = [FIERA], firmati = []) {
    rispondiCon({ "/consensi_modelle": firmati, "/eventi": eventi });
    const p = await monta(<ModelleFiera isMobile={false} onBack={() => {}} />);
    await attendi(120);
    return p;
  }

  it("con una fiera sola è già scelta, e il codice compare solo dopo il trattamento", async () => {
    const p = await pagina();
    expect(pulito(p)).toContain("Fiera di Napoli · Napoli");
    // nessun QR prima di aver detto che trattamento si fa: sei codici
    // accanto su un banco vogliono dire il foglio sbagliato sotto la
    // firma giusta
    expect(pulito(p)).not.toContain("?consenso=");

    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === CONSENSI[0].nome);
    expect(tasto, `il tasto «${CONSENSI[0].nome}»`).toBeTruthy();
    await clicca(tasto);
    await attendi(80);

    const t = pulito(p);
    // IL PUNTO DI TUTTA LA PAGINA: il codice porta la fiera
    expect(t).toContain(`?consenso=${CONSENSI[0].codice}&evento=ev1`);
    expect(t).toContain("lega il consenso a Fiera di Napoli");
    // e non la classe
    expect(t).not.toContain("&edizione=");
    await p.smonta();
  });

  it("ogni trattamento ha il suo tasto, e il codice cambia con lui", async () => {
    const p = await pagina();
    for (const m of CONSENSI) {
      const tasto = [...p.nodo.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === m.nome);
      expect(tasto, `manca il tasto di ${m.codice}`).toBeTruthy();
    }
    const needling = CONSENSI.find((m) => m.codice === "needling");
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === needling.nome));
    await attendi(80);
    expect(pulito(p)).toContain("?consenso=needling&evento=ev1");
    await p.smonta();
  });

  it("senza nessuna fiera aperta lo dice, e non mostra nessun codice", async () => {
    const p = await pagina([]);
    const t = pulito(p);
    expect(t).toContain("non c’è nessuna fiera aperta");
    expect(t).not.toContain("?consenso=");
    // non c'è nemmeno il trattamento da scegliere: non ci sarebbe dove
    // attaccare la firma
    expect([...p.nodo.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === CONSENSI[0].nome)).toBe(false);
    await p.smonta();
  });

  it("con due fiere si scegli quale, e prima di sceglierla niente codici", async () => {
    const p = await pagina([FIERA, ALTRA]);
    const tendina = p.nodo.querySelector('select[data-campo="fiera"]');
    expect(tendina).toBeTruthy();
    expect(pulito(p)).not.toContain("?consenso=");

    await scegli(tendina, "ev2");
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === CONSENSI[0].nome));
    await attendi(80);
    expect(pulito(p)).toContain("&evento=ev2");
    await p.smonta();
  });

  it("chi ha già firmato a quella fiera si rilegge da qui", async () => {
    const p = await pagina([FIERA], [FIRMATO]);
    const t = pulito(p);
    expect(t).toContain("Hanno firmato a questa fiera");
    expect(t).toContain("GIULIA");
    expect(t).toContain("1 modella");
    await p.smonta();
  });

  it("nessuna firma ancora: lo dice, e dice dove stanno quelle del codice generico", async () => {
    const p = await pagina([FIERA], []);
    const t = pulito(p);
    expect(t).toContain("Nessuna modella ha ancora firmato a questa fiera");
    expect(t).toContain("archivio");
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// La tessera in Home: è un permesso vero
describe("la tessera «Modelle fiera» in Home", () => {
  function seduta(permessi) {
    window.sessionStorage.clear();
    window.sessionStorage.setItem("edc_ok", "1");
    window.sessionStorage.setItem("edc_ruolo", "venditore");
    window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "OLGA", permessi, chiave_sistema: null }));
  }
  async function home(permessi) {
    seduta(permessi);
    rispondiCon({ "/eventi": [FIERA] });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(300);
    return p;
  }
  const tessera = (p) => [...p.nodo.querySelectorAll("button")]
    .find((b) => (b.textContent || "").trim().startsWith("Modelle fiera"));

  it("c'è per chi sta al banco, e dentro c'è la fiera", async () => {
    const p = await home(["pos", "modellefiera"]);
    const t = tessera(p);
    expect(t).toBeTruthy();
    await clicca(t);
    await attendi(250);
    expect(pulito(p)).toContain("Fiera di Napoli");
    await p.smonta();
  });

  it("non c'è per chi non ce l'ha: si sblocca a richiesta, non si vede a tutti", async () => {
    const p = await home(["pos"]);
    expect(tessera(p)).toBeFalsy();
    await p.smonta();
  });
});
