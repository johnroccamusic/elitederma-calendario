// CANCELLARE SI CHIEDE (11/11/2026)
//
// Il titolare: «ogni cancellazione nell'app che sia di prodotto o di
// iscritto o eliminazione da una lista di iscritti o di prodotti deve
// essere preceduta dall'avviso di "sei sicuro di voler cancellare?"».
// E l'esempio: «le iscritte della fiera non puoi poterne cancellare
// cosi' cliccando "non iscritta" e sparisce».
//
// Tre prove, e fanno tre lavori diversi:
//
//  1. IL MATTONE — che la frase sia quella, e che un «no» fermi davvero.
//  2. IL GESTO — la sezione della fiera montata per davvero: col «no» non
//     parte nessuna scrittura, col «si'» sparisce. Il gesto, non il
//     codice: il tasto si preme.
//  3. LA GUARDIA — l'unica che tiene il patto nel tempo. Le prime due
//     provano quello che e' stato scritto oggi; la terza rilegge TUTTE
//     le funzioni che togliono qualcosa e pretende che ognuna chieda,
//     oppure che stia in un elenco di eccezioni con scritto il perche'.
//     Senza, fra un mese un tasto nuovo cancellerebbe in silenzio e
//     nessuno se ne accorgerebbe fino alla telefonata.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { confermaCancellazione, confermaRimozione } from "../src/ui/conferma.js";
import { SchedaIscrizioniFiera } from "../src/eventi/GestioneEventi.jsx";
import { monta, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// ---------------------------------------------------------------------
// 1. il mattone
// ---------------------------------------------------------------------
describe("la domanda prima di cancellare", () => {
  let chiesto = [];
  const vero = window.confirm;
  beforeEach(() => { chiesto = []; });
  afterEach(() => { window.confirm = vero; });

  it("dice «sei sicuro di voler cancellare» e nomina la cosa", () => {
    window.confirm = (t) => { chiesto.push(t); return true; };
    confermaCancellazione('"Ago 1RL" da questo elenco');
    expect(chiesto[0]).toBe('Sei sicuro di voler cancellare "Ago 1RL" da questo elenco?');
  });

  it("la conseguenza va sotto, staccata: si legge per ultima", () => {
    window.confirm = (t) => { chiesto.push(t); return true; };
    confermaCancellazione("questa foto", "Il file non sarà più recuperabile.");
    expect(chiesto[0]).toBe("Sei sicuro di voler cancellare questa foto?\n\nIl file non sarà più recuperabile.");
  });

  // TOGLIERE NON E' CANCELLARE, e dirlo sbagliato e' peggio che non
  // dirlo: chi legge «cancellare» davanti a un'attribuzione che si
  // stacca crede di distruggere una scheda, e non preme piu'.
  it("quello che si stacca si chiama togliere, non cancellare", () => {
    window.confirm = (t) => { chiesto.push(t); return true; };
    confermaRimozione("Giusy Quatrana dalle iscrizioni di questa fiera");
    expect(chiesto[0]).toBe("Sei sicuro di voler togliere Giusy Quatrana dalle iscrizioni di questa fiera?");
  });

  it("senza nome la domanda resta una domanda, non «cancellare undefined»", () => {
    window.confirm = (t) => { chiesto.push(t); return true; };
    confermaCancellazione("");
    confermaCancellazione(null);
    expect(chiesto).toEqual(["Sei sicuro di voler cancellare?", "Sei sicuro di voler cancellare?"]);
  });

  it("un «no» torna falso, e chi chiama si ferma", () => {
    window.confirm = () => false;
    expect(confermaCancellazione("questa riga")).toBe(false);
    expect(confermaRimozione("questa riga")).toBe(false);
  });
});

// ---------------------------------------------------------------------
// 2. il gesto: la sezione della fiera
// ---------------------------------------------------------------------
describe("«Non è della fiera» chiede prima di far sparire la riga", () => {
  const NAPOLI = { id: "ev-na", nome: "Fiera di Napoli", citta: "Napoli", stato: "programmato", data_inizio: "2026-11-07", data_fine: "2026-11-09" };
  const CORSI = [{ id: "c-lam", nome: "LAMINAZIONE BASE" }];
  const LUOGHI = [{ id: "l-na", citta: "NAPOLI" }];
  const CLASSI = [{ id: "cd-lam-na", corso_id: "c-lam", location_id: "l-na", data_inizio: "2027-01-25" }];
  const GIUSY = { id: "i1", nome: "GIUSY", cognome: "QUATRANA", corso_data_id: "cd-lam-na", ts: "2026-11-08T10:56:18Z", totale_pattuito: 540, vendita_evento_id: "ev-na" };
  const LUCIA = { id: "i3", nome: "LUCIA", cognome: "TESSICINI", corso_data_id: "cd-lam-na", ts: "2026-11-07T15:05:34Z", totale_pattuito: 1540 };

  const vero = window.confirm;
  afterEach(() => { window.confirm = vero; });

  const apri = () => monta(
    <SchedaIscrizioniFiera
      evento={NAPOLI} iscritti={[GIUSY, LUCIA]} corsi={CORSI} corsiDate={CLASSI} location={LUOGHI}
      onCambiato={async () => {}}
    />,
  );

  it("col «no» non parte NESSUNA scrittura", async () => {
    let scritto = null;
    rispondiCon({ "/iscritti": (corpo) => { scritto = corpo; return [{ id: "i1" }]; } });
    window.confirm = () => false;
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-togli="i1"]'));
    expect(scritto).toBe(null);
    await p.smonta();
  });

  it("la domanda nomina CHI, perché in un elenco il dito prende la riga accanto", async () => {
    const chiesto = [];
    rispondiCon({ "/iscritti": () => [{ id: "i1" }] });
    window.confirm = (t) => { chiesto.push(t); return false; };
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-togli="i1"]'));
    expect(chiesto).toHaveLength(1);
    expect(chiesto[0]).toContain("Giusy Quatrana");
    // e dice che l'iscrizione NON si cancella: e' la differenza fra
    // «ho perso una scheda» e «l'ho tolta da questo elenco»
    expect(chiesto[0]).toContain("non si cancella");
    await p.smonta();
  });

  it("col «sì» si toglie, come prima", async () => {
    let scritto = null;
    rispondiCon({ "/iscritti": (corpo) => { scritto = corpo; return [{ id: "i1" }]; } });
    window.confirm = () => true;
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-togli="i1"]'));
    expect(scritto).toEqual({ vendita_evento_id: null });
    await p.smonta();
  });

  // SEGNARE NON SI CHIEDE: aggiunge, e si disfa col tasto di fianco. Una
  // domanda a cui si risponde sempre si' insegna a premere a occhi
  // chiusi — e allora anche quella del togliere non protegge piu'.
  it("«È della fiera» non chiede niente: aggiunge, non toglie", async () => {
    let scritto = null; let chieste = 0;
    rispondiCon({ "/iscritti": (corpo) => { scritto = corpo; return [{ id: "i3" }]; } });
    window.confirm = () => { chieste += 1; return true; };
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-segna="i3"]'));
    expect(chieste).toBe(0);
    expect(scritto).toEqual({ vendita_evento_id: "ev-na" });
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// 3. la guardia
// ---------------------------------------------------------------------
// COSA SI CONTA COME CONFERMA: soltanto una domanda vera —
// `window.confirm` o il mattone condiviso. Il primo giro contava anche
// `setQualcosaDaEliminare(`, per riconoscere i gesti che aprono un
// pannello di conferma invece di un avviso del browser: sembra giusto e
// non lo e'. `eliminaVendita` quel `set...DaEliminare(null)` lo chiama
// per CHIUDERE il pannello, in fondo, dopo aver cancellato — quindi
// passava senza aver chiesto niente, e domani ci passerebbe una
// funzione che cancella davvero in silenzio. I pochi gesti che vivono
// dentro un pannello stanno scritti fra le eccezioni, col perche'.
const CHIEDE = /window\.confirm\(|[^a-zA-Z]confirm\(|confermaCancellazione\(|confermaRimozione\(/;

// IL NOME DI UN GESTO CHE TOGLIE. Non e' un elenco di parole scelte a
// gusto: sono i verbi con cui questo progetto chiama i suoi tasti, e un
// tasto nuovo chiamato in un altro modo sfuggirebbe — per questo la
// guardia non sostituisce la lettura del codice, la rende ripetibile.
const VERBI = "[Ee]limina|[Rr]imuovi|[Tt]ogli|[Cc]ancella|[Ss]collega|[Ss]vuota|[Cc]estina";
const DICHIARA = new RegExp(
  `^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+(\\w*(?:${VERBI})\\w*)\\s*\\(|` +
  `^\\s*const\\s+(\\w*(?:${VERBI})\\w*)\\s*=\\s*(?:async\\s*)?\\(`,
);

// LE ECCEZIONI, UNA PER UNA, CON IL PERCHE'. Un elenco senza motivi
// diventa il posto dove si infila quello che non si vuole sistemare.
// Chi aggiunge una riga qui dichiara che quel gesto NON fa sparire
// niente che si debba poter rimpiangere.
const SCUSATE = {
  // non cancellano niente: svuotano una casella, una scelta, un disegno
  "App.jsx::svuota": "svuota la riga di ricerca e la lavagna della cache del sito: non si perde nessun dato",
  "App.jsx::svuotaCampiFattura": "azzera i campi della fattura quando si cambia tipo di cliente: nessuna riga scritta",
  "App.jsx::svuotaForm": "azzera il modulo del coupon in composizione",
  "App.jsx::svuotaSelezionePerFiltro": "toglie la spunta dalle righe quando cambia il filtro: la selezione, non le righe",
  "App.jsx::TastoSvuotaCacheSito": "svuota la cache del sito, che non e' un dato",
  "App.jsx::quantoTogliere": "e' un conto, non un gesto",
  "App.jsx::togliColore": "toglie la tinta di un tasto: si rimette premendo",
  "App.jsx::togliSfondo": "rimette lo sfondo di serie, il file caricato resta nel secchio",
  "App.jsx::togliPreferito": "toglie una scorciatoia dal dock: si riaggiunge con un tocco",
  "App.jsx::gruppoModellaTogli": "e' una spunta che si toglie, e il conto che ne esce; si rimette spuntando",
  "App.jsx::togli": "toglie una pastiglia da una scelta multipla ancora da salvare",
  "App.jsx::rimuoviCorsoExtra": "toglie un corso dalla lista in composizione, prima del Salva",
  "App.jsx::rimuoviCategoriaExtra": "toglie una pastiglia di categoria dal modulo del prodotto: si riprende dalla tendina",
  "App.jsx::rimuoviRigaRipartizione": "toglie una riga di ripartizione dal modulo in composizione, dove le percentuali si rifanno",
  "App.jsx::svuotaCarrello": "chiede quando lo preme una persona (`chiedi: true`); dopo una vendita registrata non c'e' niente da chiedere",
  "iscrizione/PaginaModulo.jsx::cancellaBozza": "butta la bozza sul telefono dopo che il modulo e' partito",
  "ui/FirmaDito.jsx::cancella": "pulisce la lavagna della firma, che esiste per essere rifatta",
  // non sono il gesto: lo e' il pannello che aprono, o il tasto dentro
  "App.jsx::elimina": "apre il pannello di conferma del progetto; il «Elimina» sta dentro",
  "App.jsx::eliminaConfermato": "e' il «Elimina» dentro quel pannello: la domanda l'ha gia' fatta lui",
  "App.jsx::chiediCancellazione": "apre il pannello di una vendita, che elenca cosa sparisce",
  "App.jsx::avvisiCancellazione": "scrive gli avvisi di quel pannello",
  "App.jsx::eliminaVendita": "e' il tasto dentro quel pannello",
  "App.jsx::RigaEliminabile": "e' una riga, non un gesto: il tasto glielo passa chi la usa",
  "App.jsx::PopupEliminaData": "e' il pannello di conferma",
  // il magazzino dei dati: la domanda sta dove c'e' una persona davanti
  "eventi/dati.js::eliminaEvento": "scrittura: la domanda sta sulla pagina che la chiama",
  "eventi/dati.js::eliminaRiga": "scrittura: la domanda sta sulla pagina che la chiama",
  "eventi/dati.js::eliminaDocumentoEvento": "scrittura: la domanda sta sulla pagina che la chiama",
  "eventi/GestioneEventi.jsx::togliStanza": "scrittura di una riga: la domanda sta sul tasto",
  "consensi/dati.ts::scollegaConsensoDaCorso": "scrittura: la domanda sta in QrConsensi",
  "progetti/AllegatiProgetto.jsx::eliminaAllegato": "scrittura: la domanda sta nel componente, sopra",
  "stampe/dati.js::eliminaFile": "scrittura: la domanda sta in StampePackaging",
  "stampe/dati.js::eliminaStampa": "scrittura: la domanda sta in StampePackaging",
  "stampe/dati.js::eliminaRiga": "scrittura: la domanda sta in StampePackaging",
};

function corpoDa(testo, dallaRiga) {
  const i = testo.indexOf("{", dallaRiga);
  if (i < 0) return "";
  let liv = 0;
  for (let j = i; j < testo.length; j += 1) {
    if (testo[j] === "{") liv += 1;
    else if (testo[j] === "}") { liv -= 1; if (liv === 0) return testo.slice(i, j + 1); }
  }
  return testo.slice(i);
}

function tuttiIGesti() {
  const radice = path.join(process.cwd(), "src");
  const file = [];
  (function gira(dir) {
    for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
      const q = path.join(dir, v.name);
      if (v.isDirectory()) gira(q);
      else if (/\.(jsx?|tsx?)$/.test(v.name)) file.push(q);
    }
  })(radice);

  const gesti = [];
  for (const q of file.sort()) {
    const testo = fs.readFileSync(q, "utf8");
    const righe = testo.split("\n");
    let scorso = 0;
    for (let n = 0; n < righe.length; n += 1) {
      const m = DICHIARA.exec(righe[n]);
      if (m) {
        const nome = m[1] || m[2];
        gesti.push({
          chiave: `${path.relative(radice, q)}::${nome}`,
          riga: n + 1,
          chiede: CHIEDE.test(corpoDa(testo, scorso)),
        });
      }
      scorso += righe[n].length + 1;
    }
  }
  return gesti;
}

describe("nessun gesto cancella in silenzio", () => {
  const gesti = tuttiIGesti();

  it("c'è qualcosa da controllare (se questo numero crolla, è rotta la guardia)", () => {
    expect(gesti.length).toBeGreaterThan(100);
  });

  it("ogni funzione che toglie qualcosa chiede prima, o è scusata per scritto", () => {
    const mute = gesti.filter((g) => !g.chiede && !(g.chiave in SCUSATE));
    expect(mute.map((g) => `${g.chiave} (riga ${g.riga})`)).toEqual([]);
  });

  // UN ELENCO DI ECCEZIONI CHE NESSUNO RILEGGE SI RIEMPIE DA SE'. Se un
  // gesto scusato impara a chiedere, o se ne va, la sua riga qui deve
  // sparire: altrimenti il giorno che quel nome torna su un gesto NUOVO
  // nasce gia' scusato, e la guardia non lo vede.
  it("non ci sono eccezioni scadute", () => {
    const vive = new Set(gesti.filter((g) => !g.chiede).map((g) => g.chiave));
    const scadute = Object.keys(SCUSATE).filter((k) => !vive.has(k));
    expect(scadute).toEqual([]);
  });

  it("ogni eccezione dice il perché, e non con una parola", () => {
    const vuote = Object.entries(SCUSATE).filter(([, p]) => String(p || "").trim().length < 20);
    expect(vuote.map(([k]) => k)).toEqual([]);
  });
});
