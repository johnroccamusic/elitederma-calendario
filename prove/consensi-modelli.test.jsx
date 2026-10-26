// IL CONSENSO NEEDLING, montato come lo vede la modella.
//
// Il secondo modello di consenso e' il primo che puo' sbagliare bersaglio:
// finche' ce n'era uno solo, qualunque codice portava allo stesso testo e
// alle stesse domande. Da adesso no, e quello che si prova qui e' proprio
// che i due non si scambino — un foglio di microneedling che chiede
// l'emofilia, o un PMU che chiede dell'acne in fase attiva, sarebbero
// sbagliati tutti e due e nessuno se ne accorgerebbe guardando lo schermo.
import { describe, it, expect } from "vitest";
import React from "react";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";
import PaginaConsenso from "../src/consensi/PaginaConsenso.jsx";
import QrConsensi from "../src/consensi/QrConsensi.jsx";
import { collegaConsensoACorso } from "../src/consensi/dati";
import { CONSENSI, consensoDaCodice, contenutoDaVersione, versioniRegistrate } from "../src/content/consensi";

describe("l'elenco dei modelli di consenso", () => {
  it("il needling c'e', e ha un codice suo", () => {
    const m = consensoDaCodice("needling");
    expect(m).toBeTruthy();
    expect(m.contenuto.titolo).toContain("MICRONEEDLING");
  });

  it("nessun codice e' ripetuto: il codice E' il QR", () => {
    const codici = CONSENSI.map((c) => c.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("nessuna versione e' ripetuta fra modelli diversi", () => {
    const versioni = CONSENSI.map((c) => c.contenuto.versione);
    expect(new Set(versioni).size).toBe(versioni.length);
  });

  it("la laminazione c'e', col suo codice", () => {
    const m = consensoDaCodice("laminazione");
    expect(m).toBeTruthy();
    expect(m.contenuto.sottotitolo).toContain("Laminazione Ciglia");
  });

  it("ogni modello ha la sua versione registrata", () => {
    // senza, una firma di oggi domani non sa piu' dire cosa diceva il
    // foglio: e' il controllo che serve il giorno in cui si aggiunge il
    // quarto modello e ci si dimentica la riga in VERSIONI
    const registrate = versioniRegistrate();
    for (const m of CONSENSI) {
      expect(registrate, `manca ${m.contenuto.versione}`).toContain(m.contenuto.versione);
    }
  });

  it("dentro un modello, due domande non hanno la stessa chiave", () => {
    for (const m of CONSENSI) {
      const chiavi = (m.contenuto.anamnesi || []).map((d) => d.chiave);
      expect(new Set(chiavi).size, `doppione in ${m.codice}`).toBe(chiavi.length);
    }
  });
});

describe("risalire al testo con cui una firma e' stata data", () => {
  it("un consenso needling non prende le domande del PMU", () => {
    const c = contenutoDaVersione("needling-v1", "needling");
    expect(c.titolo).toContain("MICRONEEDLING");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("acne_attiva");
    expect(chiavi).not.toContain("emofilia");
  });

  it("e un PMU non prende quelle del needling", () => {
    const c = contenutoDaVersione("v2", "pmu-micro");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("emofilia");
    expect(chiavi).not.toContain("acne_attiva");
  });

  it("una laminazione non prende le domande del needling", () => {
    const c = contenutoDaVersione("laminazione-v1", "laminazione");
    const chiavi = c.anamnesi.map((d) => d.chiave);
    expect(chiavi).toContain("patologie_oculari");
    expect(chiavi).not.toContain("acne_attiva");
  });

  it("se la versione non la conosciamo, vale il modello e non un testo a caso", () => {
    // un consenso piu' vecchio dei testi che abbiamo in casa
    const c = contenutoDaVersione("laminazione-v0", "laminazione");
    expect(c.sottotitolo).toContain("Laminazione Ciglia");
  });

  it("i consensi vecchi, senza codice, restano come prima", () => {
    // raccolti quando il needling non esisteva: per loro la versione da
    // sola bastava, ed e' giusto che continui a bastare
    expect(contenutoDaVersione("v1").versione).toBe("v1");
    expect(contenutoDaVersione("v2").versione).toBe("v2");
  });
});

describe("la pagina che apre il QR del needling", () => {
  it("mostra il titolo giusto e le condizioni del cartaceo", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    const t = p.testo();
    expect(t).toContain("MICRONEEDLING");
    expect(t).toContain("Acne in fase attiva");
    expect(t).toContain("Cure oncologiche negli ultimi 5 anni");
    // e NON le domande dell'altro modello
    expect(t).not.toContain("Emofilia");
    await p.smonta();
  });

  it("non si invia finche' il questionario non e' completo", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    expect(p.testo()).toContain("Manca ancora");
    const invia = p.tasto("Invia");
    expect(invia?.disabled).toBe(true);
    await p.smonta();
  });

  it("un codice che non esiste non apre un modulo a caso", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="questo-non-esiste" />);
    expect(p.testo()).not.toContain("MICRONEEDLING");
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
    await p.smonta();
  });
});

// UN CORSO STA SU UN CONSENSO SOLO.
//
// Nella scheda di una classe compaiono i consensi del suo corso: due
// consensi sullo stesso corso vorrebbero dire due QR accanto, inquadrati
// in aula a caso. Non e' disordine, e' il documento sbagliato sotto la
// firma giusta.
const CORSI = [
  { id: "c-pmu", nome: "PMU BASE" },
  { id: "c-need", nome: "NEEDLING" },
  { id: "c-libero", nome: "TRICO BASE" },
];
const LEGAMI = [
  { id: "l1", modello_codice: "pmu-micro", corso_id: "c-pmu" },
  { id: "l2", modello_codice: "needling", corso_id: "c-need" },
];

// LE RIGHE DEL CARTACEO IN CUI SI SCRIVE CHI OPERA.
//
// Erano tre righe vuote sul foglio del microneedling, e nella prima
// trasposizione erano diventate una formula generica: il nome di chi
// eseguiva il trattamento spariva dal documento. Un consenso che non
// dice chi ha fatto cosa su quella persona risponde a meta' della
// domanda per cui esiste.
// IL TESTO VA APERTO PRIMA DI FIRMARE.
//
// La tendina "Leggi il testo completo" e' chiusa di suo: si poteva
// scorrere il modulo fino in fondo, spuntare "ho letto e compreso" e
// firmare senza averla mai aperta. Su un consenso informato — un
// documento che esiste proprio per dire che la persona ha capito a cosa
// si sottopone — quello e' il difetto peggiore che potesse avere.
describe("la presa visione del testo, su tutti i consensi", () => {
  for (const m of CONSENSI) {
    it(`${m.codice}: senza aprire il testo non si firma e non si spunta`, async () => {
      rispondiCon({});
      const p = await monta(<PaginaConsenso codice={m.codice} />);
      expect(p.nodo.querySelector("canvas")).toBeFalsy();
      const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
      expect(spunte.length).toBeGreaterThan(0);
      expect(spunte.every((x) => x.disabled)).toBe(true);
      expect(p.testo()).toContain("aprire il testo del consenso e richiuderlo");
      await p.smonta();
    });

    it(`${m.codice}: aperto e richiuso, firma e spunte si sbloccano`, async () => {
      rispondiCon({});
      const p = await monta(<PaginaConsenso codice={m.codice} />);
      await clicca(p.tasto("Leggi il testo completo"));
      await clicca(p.tasto("Chiudi il testo"));
      expect(p.nodo.querySelector("canvas")).toBeTruthy();
      const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
      expect(spunte.every((x) => x.disabled)).toBe(false);
      expect(p.testo()).not.toContain("aprire il testo del consenso e richiuderlo");
      await p.smonta();
    });
  }

  for (const m of CONSENSI) {
    it(`${m.codice}: l'avviso in evidenza c'e', e resta anche dopo aver letto`, async () => {
      rispondiCon({});
      const p = await monta(<PaginaConsenso codice={m.codice} />);
      expect(p.testo()).toContain("ATTENZIONE");
      expect(p.testo()).toContain("Leggi con attenzione tutto il testo prima di firmare");
      // dopo la lettura sparisce la parte sul "aprilo e richiudilo", ma
      // l'avvertimento resta: si sta sempre per firmare
      await clicca(p.tasto("Leggi il testo completo"));
      await clicca(p.tasto("Chiudi il testo"));
      expect(p.testo()).toContain("ATTENZIONE");
      expect(p.testo()).not.toContain("Aprilo e richiudilo");
      await p.smonta();
    });
  }

  it("aprirlo e lasciarlo aperto non basta: conta la richiusura", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    await clicca(p.tasto("Leggi il testo completo"));
    expect(p.nodo.querySelector("canvas")).toBeFalsy();
    await p.smonta();
  });
});

// LE CASELLE CHE RENDONO VALIDO IL CONSENSO.
//
// Prima ce n'era una sola e diceva tre cose insieme: "ho letto e
// compreso, le informazioni sulla mia salute sono vere, e acconsento al
// trattamento". Chi la spuntava aderiva a tre consensi distinti con un
// gesto solo, e nessuno poteva piu' dire a quale. E mancava del tutto
// l'art. 9 — il consenso esplicito ai dati sulla SALUTE, che e' poi
// quello che il questionario raccoglie.
describe("le dichiarazioni da spuntare", () => {
  for (const m of CONSENSI) {
    it(`${m.codice}: ha le caselle che servono, e nessuna ne tiene dentro due`, () => {
      const caselle = m.contenuto.caselle;
      expect(caselle, `${m.codice} non ha caselle`).toBeTruthy();
      const chiavi = caselle.map((x) => x.chiave);
      expect(new Set(chiavi).size).toBe(chiavi.length);
      // le quattro obbligatorie che rendono il modulo regolare
      for (const attesa of ["trattamento", "salute_veritiera", "dati_salute", "informativa_privacy"]) {
        expect(chiavi, `${m.codice}: manca ${attesa}`).toContain(attesa);
        expect(caselle.find((x) => x.chiave === attesa).tipo).toBe("obbligatoria");
      }
      // e quella sulle immagini, che resta facoltativa: un consenso al
      // trattamento che si puo' avere solo cedendo anche le foto non
      // sarebbe libero
      expect(caselle.find((x) => x.chiave === "immagini").tipo).toBe("facoltativa");
    });

    it(`${m.codice}: senza le obbligatorie non si invia`, async () => {
      rispondiCon({});
      const p = await monta(<PaginaConsenso codice={m.codice} />);
      await clicca(p.tasto("Leggi il testo completo"));
      await clicca(p.tasto("Chiudi il testo"));
      expect(p.testo()).toContain("Dati relativi alla salute");
      expect(p.tasto("Invia")?.disabled).toBe(true);
      await p.smonta();
    });
  }

  it("dove c'e' un trattamento predefinito, non lo si deve scegliere a mano", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="areola" />);
    const tendina = [...p.nodo.querySelectorAll("select")]
      .find((s) => [...s.options].some((o) => o.value.includes("areola capezzolo")));
    expect(tendina.value).toBe("Dermopigmentazione del complesso areola capezzolo");
    // e non deve comparire fra le cose che mancano: guardo quella frase
    // e non tutta la pagina, dove "il trattamento" ricorre dappertutto
    const manca = p.testo().split("Manca ancora:")[1] || "";
    expect(manca).not.toContain("il trattamento");
    await p.smonta();
  });

  it("spuntarne una non spunta le altre", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    await clicca(p.tasto("Leggi il testo completo"));
    await clicca(p.tasto("Chiudi il testo"));
    const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
    await clicca(spunte[0]);
    const dopo = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
    expect(dopo.filter((x) => x.checked)).toHaveLength(1);
    await p.smonta();
  });
});

describe("i consensi gia' firmati non cambiano sotto i piedi a nessuno", () => {
  it("la v2 del PMU resta, intatta, accanto alla v3", () => {
    const v2 = contenutoDaVersione("v2", "pmu-micro");
    const v3 = contenutoDaVersione("v3", "pmu-micro");
    expect(v2.versione).toBe("v2");
    expect(v3.versione).toBe("v3");
    // la v2 non ha le caselle nuove: diciannove persone hanno firmato
    // quella, e deve continuare a dire cosa diceva
    expect(v2.caselle).toBeUndefined();
    expect(v3.caselle).toBeTruthy();
    // ma il testo e l'anamnesi sono gli stessi: cambia solo cosa si spunta
    expect(v3.testo).toBe(v2.testo);
    expect(v3.anamnesi.map((d) => d.chiave)).toEqual(v2.anamnesi.map((d) => d.chiave));
  });

  it("il PMU e' tornato a essere il trucco del viso, e basta", () => {
    const c = consensoDaCodice("pmu-micro").contenuto;
    // trico e areola hanno un modulo loro: fuori dall'intestazione e
    // fuori dalla tendina, o si sceglierebbero sul consenso sbagliato
    for (const fuori of ["Tricopigmentazione", "Areola"]) {
      expect(c.trattamenti, `${fuori} e' ancora nella tendina del PMU`).not.toContain(fuori);
    }
    expect(c.sottotitolo).not.toContain("TRICOPIGMENTAZIONE");
    expect(c.sottotitolo).toContain("VISO");
    // quel che resta e' il viso
    expect(c.trattamenti).toContain("Labbra");
    expect(c.trattamenti).toContain("Eyeliner");
    // e il CORPO resta neutro: non nomina il viso, e non deve — e' lo
    // stesso testo firmato ventisei volte
    for (const parola of ["trucco permanente", "labbra", "sopraccigli", "viso"]) {
      expect(c.testo.toLowerCase(), `il corpo nomina "${parola}"`).not.toContain(parola);
    }
  });

  it("il consenso areola dice quello che un modulo del viso non direbbe mai", () => {
    const c = consensoDaCodice("areola").contenuto;
    // l'areola si pigmenta spesso dopo una mastectomia: il modulo deve
    // pretendere cicatrici guarite e il nulla osta di chi la ha in cura
    expect(c.testo).toContain("nulla osta scritto del medico");
    expect(c.testo).toContain("sei mesi");
    // e dire che e' una zona intima, con cosa ne consegue
    expect(c.testo).toContain("può chiedere di essere accompagnata");
    expect(c.testo).toContain("può interrompere il trattamento in qualsiasi momento");
    // il consenso alle foto deve dire di che zona si tratta: senza, non
    // e' informato
    expect(c.caselle.find((x) => x.chiave === "immagini").testo).toContain("zona intima");
    // due voci, e distinguono COSA si tratta — non come. Dopo una
    // mastoplastica additiva puo' toccare solo la cicatrice, e sul
    // consenso deve risultare quale delle due e' stata fatta
    expect(c.trattamenti).toContain("Dermopigmentazione del complesso areola capezzolo");
    expect(c.trattamenti).toContain("Dermopigmentazione di cicatrici periareolari");
    expect(c.trattamentoPredefinito).toBe("Dermopigmentazione del complesso areola capezzolo");
    // e il testo dice che su una cicatrice il risultato e' un altro
    expect(c.testo).toContain("cicatrici periareolari");
    expect(c.testo).toContain("non la elimina e non la appiattisce");
    // e il questionario deve chiedere quello che il PMU non chiedeva
    const chiavi = c.anamnesi.map((d) => d.chiave);
    for (const attesa of ["radio_chemio", "linfonodi_ascellari", "nulla_osta_medico"]) {
      expect(chiavi).toContain(attesa);
    }
    // "si e' sottoposta a interventi al seno?" era una domanda la cui
    // risposta si conosce prima di farla: e' diventata un campo, dove si
    // scrive QUALE e QUANDO — che e' il dato da cui dipende tutto
    expect(chiavi).not.toContain("interventi_seno");
    const intervento = c.campiExtra.find((x) => x.chiave === "intervento");
    expect(intervento.obbligatorio).toBe(true);
  });

  it("il consenso trico dice quello che negli altri non c'e'", () => {
    const c = consensoDaCodice("trico").contenuto;
    // la cosa per cui esiste un modulo a parte: chi si siede per una
    // tricopigmentazione a volte spera nella ricrescita, e il consenso
    // non puo' lasciare quella speranza senza risposta
    expect(c.testo).toContain("non ne favorisce la ricrescita");
    expect(c.caselle.find((x) => x.chiave === "trattamento").testo).toContain("non cura la caduta");
    // e chiede le controindicazioni del cuoio capelluto
    const chiavi = c.anamnesi.map((d) => d.chiave);
    for (const attesa of ["dermatiti_cuoio", "alopecia_attiva", "trapianto_cuoio"]) {
      expect(chiavi).toContain(attesa);
    }
  });

  it("una stessa condizione si chiama allo stesso modo in tutti i moduli", () => {
    // se "diabete" in un modulo e "diabete_mellito" in un altro, il
    // giorno in cui si vorra' contare quante modelle l'hanno dichiarato
    // bisognera' sapere quattro nomi per la stessa cosa
    const perChiave = new Map();
    for (const m of CONSENSI) {
      for (const d of m.contenuto.anamnesi || []) {
        const vista = perChiave.get(d.chiave);
        if (vista) {
          expect(d.domanda, `"${d.chiave}" chiede due cose diverse (${vista.codice} e ${m.codice})`)
            .toBe(vista.domanda);
        } else {
          perChiave.set(d.chiave, { domanda: d.domanda, codice: m.codice });
        }
      }
    }
  });

  it("oggi il PMU fa firmare la v3", () => {
    expect(consensoDaCodice("pmu-micro").contenuto.versione).toBe("v3");
  });
});

// SE C'E' UNA DOMANDA, C'E' DOVE SCRIVERE.
//
// Il campo libero compariva solo su alcune domande e solo dopo il SÌ:
// sotto "Si è sottoposta a interventi chirurgici al seno" si leggeva
// "Quale intervento e in che mese e anno" e poi due bottoni, senza
// nessuna casella — una richiesta senza posto in cui rispondere.
describe("lo spazio per la nota", () => {
  for (const m of CONSENSI) {
    it(`${m.codice}: ogni domanda ha la sua casella, anche prima di rispondere`, async () => {
      rispondiCon({});
      const p = await monta(<PaginaConsenso codice={m.codice} />);
      const domande = m.contenuto.anamnesi || [];
      // una casella di testo per ogni domanda, senza aver premuto niente
      const note = [...p.nodo.querySelectorAll("input")]
        .filter((i) => (i.placeholder || "").startsWith("Nota, se")
          || domande.some((d) => d.specifica && (d.aiuto || "Specifica") === i.placeholder));
      expect(note.length, `${m.codice}: ${note.length} caselle per ${domande.length} domande`)
        .toBe(domande.length);
      await p.smonta();
    });
  }

  it("la nota si puo' scrivere anche rispondendo NO", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="laminazione" />);
    const nota = [...p.nodo.querySelectorAll("input")]
      .find((i) => (i.placeholder || "").startsWith("Nota, se"));
    expect(nota).toBeTruthy();
    expect(nota.disabled).toBe(false);
    await p.smonta();
  });

  it("dove si chiede di scrivere, la richiesta sta DENTRO la casella", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="areola" />);
    // "Quali" e simili non devono stare sopra i bottoni a sembrare una
    // domanda senza risposta possibile
    const segnaposti = [...p.nodo.querySelectorAll("input")].map((i) => i.placeholder);
    expect(segnaposti).toContain("Quali");
    await p.smonta();
  });
});

describe("chi esegue il trattamento", () => {
  it("il needling lo chiede, ed e' obbligatorio", () => {
    const c = consensoDaCodice("needling").contenuto;
    expect(c.esecutore).toBeTruthy();
    expect(c.esecutore.obbligatorio).toBe(true);
  });

  it("il testo non torna a nominare una formula al posto della persona", () => {
    const t = consensoDaCodice("needling").contenuto.testo;
    // deve rimandare al nome scritto nel modulo...
    expect(t).toContain("indicato in questo modulo");
    // ...e non dare per scontato chi opera
    expect(t).not.toContain("da un'allieva/o sotto la supervisione del docente, di eseguire");
  });

  it("il campo c'e' davvero nel modulo, e senza non si invia", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="needling" />);
    // l'etichetta porta dentro l'asterisco degli obbligatori, quindi non
    // e' un nodo foglia: si guarda il testo della pagina e il campo vero
    expect(p.testo()).toContain("Chi esegue il trattamento");
    const segnaposti = [...p.nodo.querySelectorAll("input")].map((i) => i.placeholder);
    expect(segnaposti).toContain("Nome e cognome dell'allieva/o che opera");
    // e finche' e' vuoto il modulo non parte
    expect(p.testo()).toContain("chi esegue il trattamento");
    expect(p.tasto("Invia")?.disabled).toBe(true);
    await p.smonta();
  });

  it("dove il cartaceo non lo chiede, il campo non compare", async () => {
    rispondiCon({});
    const p = await monta(<PaginaConsenso codice="pmu-micro" />);
    expect(p.testo()).not.toContain("Chi esegue il trattamento");
    await p.smonta();
  });
});

describe("quali corsi la tendina propone", () => {
  it("non propone un corso gia' preso da un altro consenso", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": LEGAMI });
    const p = await monta(<QrConsensi corsi={CORSI} />);

    const sceglibili = [...p.nodo.querySelectorAll("option")]
      .filter((o) => o.value && !o.disabled)
      .map((o) => o.textContent.trim());

    // NEEDLING e' sul consenso needling: nella tendina del PMU non deve
    // essere scegliibile, e viceversa
    expect(sceglibili.filter((t) => t.startsWith("NEEDLING"))).toHaveLength(0);
    expect(sceglibili.filter((t) => t.startsWith("PMU BASE"))).toHaveLength(0);
    // quello libero invece si', una volta per consenso
    expect(sceglibili.filter((t) => t.startsWith("TRICO BASE")).length).toBe(CONSENSI.length);
    await p.smonta();
  });

  it("li mostra spenti, dicendo di chi sono", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": LEGAMI });
    const p = await monta(<QrConsensi corsi={CORSI} />);
    const spenti = [...p.nodo.querySelectorAll("option")].filter((o) => o.disabled);
    const testi = spenti.map((o) => o.textContent.trim());
    // chi cerca NEEDLING nella tendina sbagliata deve capire perche' non
    // puo' prenderlo, non pensare che l'elenco sia rotto
    expect(testi.some((t) => t.includes("NEEDLING") && t.includes("Consenso Needling"))).toBe(true);
    expect(testi.some((t) => t.includes("PMU BASE") && t.includes("Consenso PMU e Micro"))).toBe(true);
    await p.smonta();
  });
});

describe("la serratura sta nella funzione che scrive", () => {
  it("rifiuta un corso gia' su un altro consenso, anche se la tendina non lo proponeva", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [{ modello_codice: "pmu-micro" }] });
    const errore = await collegaConsensoACorso("needling", "c-pmu");
    expect(errore).toBeTruthy();
    expect(errore).toContain("già sul consenso");
  });

  it("lascia passare un corso libero", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [] });
    const errore = await collegaConsensoACorso("needling", "c-libero");
    expect(errore).toBeNull();
  });

  it("rimettere lo stesso corso sullo stesso consenso non e' un errore", async () => {
    rispondiCon({ "/rest/v1/consensi_corsi": [{ modello_codice: "needling" }] });
    const errore = await collegaConsensoACorso("needling", "c-need");
    expect(errore).toBeNull();
  });
});

describe("il consenso extension ciglia", () => {
  it("chiede il patch test, chi opera, e tiene separati i due consensi alle foto", () => {
    const c = consensoDaCodice("extension").contenuto;
    expect(c.versione).toBe("extension-v1");
    expect(c.esecutore?.obbligatorio).toBe(true);
    const patch = c.campiExtra.find((x) => x.chiave === "patch_test");
    expect(patch?.obbligatorio).toBe(true);
    // le foto: con volto per sito e social, senza volto per uso interno,
    // tutte e due facoltative e indipendenti
    expect(c.caselle.find((x) => x.chiave === "immagini").testo).toContain("volto riconoscibile");
    expect(c.caselle.find((x) => x.chiave === "immagini_senza_volto").tipo).toBe("facoltativa");
    // l'anamnesi del cartaceo
    const chiavi = c.anamnesi.map((d) => d.chiave);
    for (const k of ["allergie", "reazioni_extension_laminazione", "patologie_oculari", "interventi_occhi_6_mesi", "lenti_contatto", "tiroide_alopecia_ciglia", "medicine", "gravidanza_allattamento", "claustrofobia", "asma_vapori"]) expect(chiavi).toContain(k);
    expect(c.testo).toContain("cianoacrilato");
    expect(c.testo).toContain("12 mesi");
  });
});
