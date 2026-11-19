// LA COMPOSIZIONE DEI KIT E I PRODOTTI IN ATTESA (15/11/2026).
//
// Il titolare: «aggiungi la pagina "Composizione kit", che si apre dopo
// la raccolta del materiale […] un nuovo pulsante, a destra del flag,
// "In attesa di ricezione", che colora la riga di arancione […] Finché
// la lista mancanti di un corso non è vuota, il pulsante "Pacco
// preparato" di quel corso resta disattivato».
//
// Tre cose si provano qui: il conto (quanti pezzi in OGNI busta, e che
// cosa manca), i due gesti della raccolta (preso / in attesa) e la
// serratura sulla riga del corso.
import { describe, it, expect } from "vitest";
import React from "react";
import {
  composizioneKit, listaMancanti, listaRaccoltaMateriale,
  ComposizioneKit, RaccoltaMateriale, RigaCorsoLogistica,
  pezziGiaNelPacco, avvisoProdottoGiaNelPacco, PannelloPreparazioneKit,
} from "../src/App.jsx";
import { monta, clicca, scrivi } from "./aiuto.js";

const KIT_PRO = { id: "k1", nome: "PMU Pro", corso_id: "c1", tipo: "kit", ordine: 1 };
const KIT_BASE = { id: "k2", nome: "PMU Base", corso_id: "c1", tipo: "kit", ordine: 2 };
const KIT_VUOTO = { id: "k3", nome: "PMU Vuoto", corso_id: "c1", tipo: "kit", ordine: 3 };
const PRODOTTI = [
  { id: "p-aghi", nome: "Aghi 1RL (5 pz)" },
  { id: "p-pelle", nome: "Pelle sintetica" },
  { id: "p-busta", nome: "Busta nera kit" },
  // a magazzino, ma dentro nessun kit: e' il prodotto che si aggiunge
  // senza che nessuno debba chiedere niente
  { id: "p-olio", nome: "Olio detergente" },
];
const DISTINTE = [
  { id: "r1", kit_id: "k1", corso_id: "c1", prodotto_id: "p-aghi", quantita: 2, tipo: "kit" },
  { id: "r2", kit_id: "k1", corso_id: "c1", prodotto_id: "p-pelle", quantita: 1, tipo: "kit" },
  { id: "r3", kit_id: "k2", corso_id: "c1", prodotto_id: "p-aghi", quantita: 1, tipo: "kit" },
  { id: "r4", kit_id: "k2", corso_id: "c1", prodotto_id: "p-busta", quantita: 1, tipo: "kit" },
];
// due iscritte col PRO, una col BASE
const ISCRITTI = [
  { id: "a1", pacchetto_kit: "PMU Pro", kit_id: "k1" },
  { id: "a2", pacchetto_kit: "PMU Pro", kit_id: "k1" },
  { id: "a3", pacchetto_kit: "PMU Base", kit_id: "k2" },
];
const COMUNE = {
  iscrittiEdizione: ISCRITTI, kitDefinizioni: [KIT_PRO, KIT_BASE, KIT_VUOTO],
  corsiKitProdotti: DISTINTE, prodottiShop: PRODOTTI, corsoId: "c1", dataInizio: "2099-01-01",
};

describe("composizioneKit", () => {
  it("un blocco per tipo di kit, col numero per busta e il totale", () => {
    const blocchi = composizioneKit({ ...COMUNE, statoEdizione: { riserva_per_kit: { k1: 1 } } });
    expect(blocchi.map((b) => b.nome)).toEqual(["PMU Pro", "PMU Base"]);
    const pro = blocchi[0];
    // 2 iscritte + 1 di riserva
    expect(pro.quante).toBe(3);
    expect(pro.perIscritti).toBe(2);
    expect(pro.riserva).toBe(1);
    // in OGNI busta vanno 2 aghi; in tutto ne servono 6
    const aghi = pro.righe.find((r) => r.nome.startsWith("Aghi"));
    expect(aghi.perBusta).toBe(2);
    expect(aghi.totale).toBe(6);
    // e le righe sono in ordine alfabetico, come nella raccolta
    expect(pro.righe.map((r) => r.nome)).toEqual(["Aghi 1RL (5 pz)", "Pelle sintetica"]);
  });

  it("il numero per busta non cambia se cambia quanta gente c'è", () => {
    const una = composizioneKit({ ...COMUNE, iscrittiEdizione: [ISCRITTI[0]], statoEdizione: {} })[0];
    const tre = composizioneKit({ ...COMUNE, statoEdizione: {} })[0];
    expect(una.righe[0].perBusta).toBe(tre.righe[0].perBusta);
    expect(una.quante).toBe(1);
    expect(tre.quante).toBe(2);
  });

  it("i pezzi da comporre sono gli stessi che la raccolta manda a prendere", () => {
    const stato = { riserva_per_kit: { k1: 1 } };
    const raccolta = listaRaccoltaMateriale({ ...COMUNE, statoEdizione: stato });
    const blocchi = composizioneKit({ ...COMUNE, statoEdizione: stato });
    const perChiave = {};
    blocchi.forEach((b) => b.righe.forEach((r) => { perChiave[r.chiave] = (perChiave[r.chiave] || 0) + r.totale; }));
    // 3 PRO × 2 aghi + 1 BASE × 1 ago = 7, lo stesso numero della raccolta
    expect(perChiave["prodotto::p-aghi"]).toBe(7);
    expect(raccolta.find((r) => r.chiave === "prodotto::p-aghi").quantita).toBe(7);
  });

  it("un kit senza distinta resta in elenco: sparire sarebbe peggio", () => {
    const blocchi = composizioneKit({ ...COMUNE, statoEdizione: { riserva_per_kit: { k3: 2 } } });
    const vuoto = blocchi.find((b) => b.nome === "PMU Vuoto");
    expect(vuoto.quante).toBe(2);
    expect(vuoto.righe).toEqual([]);
  });
});

describe("listaMancanti", () => {
  const stato = { riserva_per_kit: { k1: 1 }, in_attesa: { "prodotto::p-aghi": { il: "2026-11-15T09:00:00Z", da: "Raf" } } };
  const righeRaccolta = listaRaccoltaMateriale({ ...COMUNE, statoEdizione: stato });
  const blocchi = composizioneKit({ ...COMUNE, statoEdizione: stato });

  it("dice quale prodotto manca, in quale kit e in che quantità", () => {
    const mancanti = listaMancanti({ righeRaccolta, blocchi, inAttesa: stato.in_attesa });
    expect(mancanti.length).toBe(1);
    expect(mancanti[0].nome).toBe("Aghi 1RL (5 pz)");
    expect(mancanti[0].quantita).toBe(7);
    expect(mancanti[0].nei).toEqual([
      { kit: "PMU Pro", quantita: 6, perBusta: 2 },
      { kit: "PMU Base", quantita: 1, perBusta: 1 },
    ]);
  });

  it("senza niente in attesa la lista è vuota, e il pacco non si blocca", () => {
    expect(listaMancanti({ righeRaccolta, blocchi, inAttesa: {} })).toEqual([]);
  });

  it("una riga in attesa su un prodotto uscito dal pacco non blocca per sempre", () => {
    // nessuno ha più scelto il PRO: gli aghi restano solo nel BASE, e la
    // chiave in attesa di un prodotto che non c'è più non deve pesare
    const inAttesa = { "prodotto::p-pelle": { il: "2026-11-15T09:00:00Z" } };
    const soloBase = { ...COMUNE, iscrittiEdizione: [ISCRITTI[2]] };
    const mancanti = listaMancanti({
      righeRaccolta: listaRaccoltaMateriale({ ...soloBase, statoEdizione: {} }),
      blocchi: composizioneKit({ ...soloBase, statoEdizione: {} }),
      inAttesa,
    });
    expect(mancanti).toEqual([]);
  });
});

describe("la pagina Composizione kit", () => {
  const blocchi = composizioneKit({ ...COMUNE, statoEdizione: { riserva_per_kit: { k1: 1 } } });

  it("un blocco per kit col suo titolo, e il tasto verde segna quel kit", async () => {
    const segnati = [];
    const p = await monta(
      <ComposizioneKit titolo="PMU BASE · Milano" sottotitolo="14/11/2026" blocchi={blocchi}
        composti={{}} attesa={{}} onComposto={(id, fatto) => segnati.push([id, fatto])} onChiudi={() => {}} />,
    );
    expect(p.nodo.querySelectorAll("[data-blocco-kit]").length).toBe(2);
    expect(p.testo()).toContain("3 kit PMU Pro");
    expect(p.testo()).toContain("1 kit PMU Base");
    // il numero grande della riga è quello che va in UNA busta
    const righe = [...p.nodo.querySelectorAll("[data-riga-composizione]")];
    expect(righe[0].textContent).toContain("Aghi 1RL (5 pz)");
    expect(righe[0].textContent).toContain("6 in tutto");
    // il tasto verde del primo blocco segna il PRIMO kit, non tutti
    await clicca(p.nodo.querySelectorAll('[data-kit-fatto="no"]')[0]);
    expect(segnati).toEqual([["k1", true]]);
    await p.smonta();
  });

  it("il kit composto si vede, e il tasto torna indietro", async () => {
    const segnati = [];
    const p = await monta(
      <ComposizioneKit titolo="PMU BASE · Milano" blocchi={blocchi}
        composti={{ k1: { il: "2026-11-15T10:00:00Z", da: "Raf" } }} attesa={{}}
        onComposto={(id, fatto) => segnati.push([id, fatto])} onChiudi={() => {}} />,
    );
    expect(p.nodo.querySelectorAll('[data-blocco-kit="composto"]').length).toBe(1);
    expect(p.testo()).toContain("composto da Raf");
    expect(p.nodo.querySelector("[data-avanzamento-kit]").textContent).toContain("1 / 2");
    await clicca(p.nodo.querySelector('[data-kit-fatto="si"]'));
    expect(segnati).toEqual([["k1", false]]);
    await p.smonta();
  });

  it("i prodotti in attesa si leggono in arancione nei kit che li contengono", async () => {
    const p = await monta(
      <ComposizioneKit titolo="PMU BASE · Milano" blocchi={blocchi} composti={{}}
        attesa={{ "prodotto::p-aghi": { il: "2026-11-15T09:00:00Z" } }}
        onComposto={() => {}} onChiudi={() => {}} />,
    );
    const inAttesa = [...p.nodo.querySelectorAll('[data-riga-composizione="in-attesa"]')];
    // gli aghi stanno in tutti e due i kit, e in tutti e due sono in attesa
    expect(inAttesa.length).toBe(2);
    expect(inAttesa[0].textContent).toContain("in attesa di ricezione");
    expect(inAttesa[0].style.background).toBe("rgb(253, 240, 226)");
    await p.smonta();
  });

  it("«Terminato» chiude e basta: non dichiara niente", async () => {
    let chiuso = 0;
    const segnati = [];
    const p = await monta(
      <ComposizioneKit titolo="PMU BASE · Milano" blocchi={blocchi} composti={{}} attesa={{}}
        onComposto={(...a) => segnati.push(a)} onChiudi={() => { chiuso += 1; }} />,
    );
    await clicca(p.nodo.querySelector("[data-terminato]"));
    expect(chiuso).toBe(1);
    expect(segnati).toEqual([]);
    await p.smonta();
  });
});

describe("«In attesa di ricezione» nella raccolta", () => {
  const RIGHE = [
    { chiave: "prodotto::p-aghi", prodottoId: "p-aghi", nome: "Aghi 1RL (5 pz)", quantita: 7, da: ["3 × PMU Pro"] },
    { chiave: "prodotto::p-pelle", prodottoId: "p-pelle", nome: "Pelle sintetica", quantita: 3, da: ["3 × PMU Pro"] },
  ];

  it("ogni riga ha il suo tasto, e premuto dice quale riga aspetta", async () => {
    const attese = [];
    const p = await monta(
      <RaccoltaMateriale titolo="PMU BASE · Milano" righe={RIGHE} spunte={{}} attesa={{}}
        onSpunta={() => {}} onAttesa={(chiave, acceso) => attese.push([chiave, acceso])}
        onAzzera={() => {}} onChiudi={() => {}} />,
    );
    expect(p.nodo.querySelectorAll("[data-attesa-riga]").length).toBe(2);
    await clicca(p.nodo.querySelectorAll("[data-attesa-riga]")[1]);
    expect(attese).toEqual([["prodotto::p-pelle", true]]);
    await p.smonta();
  });

  it("la riga in attesa è arancione, e il conto in cima lo dice", async () => {
    const p = await monta(
      <RaccoltaMateriale titolo="PMU BASE · Milano" righe={RIGHE} spunte={{}}
        attesa={{ "prodotto::p-aghi": { il: "2026-11-15T09:00:00Z", da: "Raf" } }}
        onSpunta={() => {}} onAttesa={() => {}} onAzzera={() => {}} onChiudi={() => {}} />,
    );
    const riga = p.nodo.querySelector('[data-riga-raccolta="in-attesa"]');
    expect(riga.textContent).toContain("Aghi 1RL (5 pz)");
    expect(riga.style.background).toBe("rgb(253, 240, 226)");
    expect(p.nodo.querySelector("[data-attesa-conto]").textContent).toContain("1 in attesa di ricezione");
    // e il flag verde continua a esserci: è con quello che si dice «arrivato»
    expect(p.nodo.querySelectorAll("[data-riga-raccolta]").length).toBe(2);
    await p.smonta();
  });

  it("segnarla ricevuta è lo stesso gesto di sempre: la riga si spunta", async () => {
    const spunte = [];
    const p = await monta(
      <RaccoltaMateriale titolo="PMU BASE · Milano" righe={RIGHE} spunte={{}}
        attesa={{ "prodotto::p-aghi": { il: "2026-11-15T09:00:00Z" } }}
        onSpunta={(chiave, acceso) => spunte.push([chiave, acceso])}
        onAttesa={() => {}} onAzzera={() => {}} onChiudi={() => {}} />,
    );
    await clicca(p.nodo.querySelector('[data-riga-raccolta="in-attesa"]'));
    expect(spunte).toEqual([["prodotto::p-aghi", true]]);
    await p.smonta();
  });

  it("senza il tasto dell'attesa la raccolta funziona come prima", async () => {
    const p = await monta(
      <RaccoltaMateriale titolo="PMU BASE · Milano" righe={RIGHE} spunte={{}}
        onSpunta={() => {}} onAzzera={() => {}} onChiudi={() => {}} />,
    );
    expect(p.nodo.querySelectorAll("[data-attesa-riga]").length).toBe(0);
    expect(p.nodo.querySelectorAll('[data-riga-raccolta="da-prendere"]').length).toBe(2);
    await p.smonta();
  });
});

describe("il pacco non si dichiara preparato se manca qualcosa", () => {
  const CORSO_DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-10", data_fine: "2099-01-11" };
  const CORSO = { id: "c1", nome: "PMU BASE", colore: "#123456" };
  const LOC = { id: "l1", nome: "MILANO", sede_centrale: false };
  const MANCANTI = [{
    chiave: "prodotto::p-aghi", prodottoId: "p-aghi", nome: "Aghi 1RL (5 pz)", quantita: 7, da: ["3 × PMU Pro"],
    nei: [{ kit: "PMU Pro", quantita: 6, perBusta: 2 }, { kit: "PMU Base", quantita: 1, perBusta: 1 }],
  }];
  const comuni = {
    corsoData: CORSO_DATA, corso: CORSO, loc: LOC, iscrittiEdizione: ISCRITTI,
    faseCorrente: "da_preparare", selezionato: false, onSeleziona: () => {},
    onTornaIndietroFase: () => {}, onToggleGestioneRientro: () => {}, onCambiaFaseRientro: () => {},
    onTornaIndietroFaseRientro: () => {}, onAllestisci: () => {}, onPrepara: () => {},
    onApriInventarioSede: () => {}, onAnnullaInventario: () => {},
  };

  it("la lista mancanti sta sulla riga del corso, col kit e la quantità", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} onCambiaFase={() => {}} mancanti={MANCANTI} />);
    const lista = p.nodo.querySelector("[data-lista-mancanti]");
    expect(lista).toBeTruthy();
    expect(lista.textContent).toContain("7 × Aghi 1RL (5 pz)");
    expect(lista.textContent).toContain("6 per PMU Pro");
    expect(lista.textContent).toContain("1 per PMU Base");
    await p.smonta();
  });

  it("il tasto «Pacco da preparare» non si preme finché la lista non è vuota", async () => {
    const avanzamenti = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} onCambiaFase={(f) => avanzamenti.push(f)} mancanti={MANCANTI} />);
    const bloccata = p.nodo.querySelector('[data-fase-bloccata="si"]');
    expect(bloccata.textContent).toContain("Pacco da preparare");
    await clicca(bloccata);
    expect(avanzamenti).toEqual([]);
    await p.smonta();
  });

  it("vuota la lista, il pacco si dichiara preparato come sempre", async () => {
    const avanzamenti = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} onCambiaFase={(f) => avanzamenti.push(f)} mancanti={[]} />);
    expect(p.nodo.querySelector("[data-lista-mancanti]")).toBeFalsy();
    expect(p.nodo.querySelector('[data-fase-bloccata="si"]')).toBeFalsy();
    await clicca(p.tasto("Pacco da preparare"));
    expect(avanzamenti).toEqual(["bolla_stampata"]);
    await p.smonta();
  });

  it("chi programma passa comunque: è l'unico che può riallineare", async () => {
    const avanzamenti = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} puoForzare onCambiaFase={(f) => avanzamenti.push(f)} mancanti={MANCANTI} />);
    // la lista si legge lo stesso — è un'informazione, non solo un divieto
    expect(p.nodo.querySelector("[data-lista-mancanti]")).toBeTruthy();
    await clicca(p.tasto("Pacco da preparare"));
    expect(avanzamenti).toEqual(["bolla_stampata"]);
    await p.smonta();
  });
});

// UN PRODOTTO CHE IL PACCO STA GIA' PORTANDO (15/11/2026).
//
// Il titolare: «se Raf aggiunge "prodotto extra o da vendita" e quel
// prodotto è già elencato tra quelli presenti dei kit, il sistema deve
// avvisare con un popup […] sei sicuro di aggiungerne altri?».
//
// Il rischio non è estetico: un extra scarica il magazzino come tutto
// il resto, quindi lo stesso prodotto aggiunto due volte esce due volte.
describe("pezziGiaNelPacco e il suo avviso", () => {
  const blocchi = composizioneKit({ ...COMUNE, statoEdizione: { riserva_per_kit: { k1: 1 } } });
  const ACCESSORI = [{ prodotto_id: "p-busta", quantita: 9 }];

  it("conta i pezzi dei kit sommando tutti i tipi di kit", () => {
    // 3 PRO × 2 aghi + 1 BASE × 1 ago
    expect(pezziGiaNelPacco({ prodottoId: "p-aghi", blocchi }).daiKit).toBe(7);
    expect(pezziGiaNelPacco({ prodottoId: "p-pelle", blocchi }).daiKit).toBe(3);
  });

  it("conta anche gli accessori didattica, con la quantità che partirà davvero", () => {
    const dalloScheda = pezziGiaNelPacco({ prodottoId: "p-busta", blocchi, accessori: ACCESSORI });
    expect(dalloScheda.daAccessori).toBe(9);
    // 1 dal kit BASE + 9 dall'accessorio
    expect(dalloScheda.totale).toBe(10);
    // una quantità scritta a mano comanda su quella della scheda
    const aMano = pezziGiaNelPacco({
      prodottoId: "p-busta", blocchi, accessori: ACCESSORI, accessoriQuantita: { "accessorio::p-busta": 2 },
    });
    expect(aMano.daAccessori).toBe(2);
  });

  it("un prodotto che nel pacco non c'è non ha niente da dire", () => {
    const gia = pezziGiaNelPacco({ prodottoId: "p-sconosciuto", blocchi, accessori: ACCESSORI });
    expect(gia.totale).toBe(0);
    expect(avvisoProdottoGiaNelPacco({ nome: "Qualcosa", ...gia })).toBe("");
  });

  it("l'avviso dice quanti pezzi, di quale prodotto e da dove", () => {
    const testo = avvisoProdottoGiaNelPacco({ nome: "Aghi 1RL (5 pz)", daiKit: 7, daAccessori: 0 });
    expect(testo).toContain("Attenzione: 7 pezzi di «Aghi 1RL (5 pz)»");
    expect(testo).toContain("vengono già scaricati dal magazzino perché presenti nei prodotti associati ai kit");
    expect(testo).toContain("Sei sicuro di aggiungerne altri?");
    // un pezzo solo si dice al singolare: un avviso scritto male si salta
    expect(avvisoProdottoGiaNelPacco({ nome: "Busta nera kit", daiKit: 1 }))
      .toContain("1 pezzo di «Busta nera kit» viene già scaricato");
    // dai kit E dagli accessori: si dicono tutti e due, col loro numero
    const doppio = avvisoProdottoGiaNelPacco({ nome: "Busta nera kit", daiKit: 1, daAccessori: 9 });
    expect(doppio).toContain("10 pezzi");
    expect(doppio).toContain("nei prodotti associati ai kit (1) e negli accessori didattica del corso (9)");
  });
});

describe("il gesto: aggiungere un extra che c'è già", () => {
  const CORSO_DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-10", data_fine: "2099-01-11" };
  const CORSO = { id: "c1", nome: "COLORI E CORREZIONI", colore: "#123456" };
  const LOC = { id: "l1", nome: "MILANO" };

  async function pannello(onSalvaCampi) {
    return monta(
      <PannelloPreparazioneKit
        corsoData={CORSO_DATA} corso={CORSO} loc={LOC}
        statoEdizione={{ corso_data_id: "cd1", riserva_per_kit: {}, accessori_quantita: {} }}
        kitDefinizioni={[KIT_PRO, KIT_BASE]} corsiKitProdotti={DISTINTE} prodottiShop={PRODOTTI}
        iscrittiEdizione={ISCRITTI} inventarioSede={[]} prodottiApertiMagazzino={[]}
        nomeUtente="Raf" onSalvaCampi={onSalvaCampi} onCambiaTagliaIscritto={() => {}}
      />
    );
  }

  async function cercaExtra(p, testo) {
    await clicca(p.tasto("Aggiungi prodotti extra o da vendita"));
    const casella = [...p.nodo.querySelectorAll("input")].find((i) => i.placeholder === "Cerca prodotto…");
    await scrivi(casella, testo);
    return casella;
  }

  it("l'elenco lo dice già prima di premere: «già nel pacco»", async () => {
    const p = await pannello(() => {});
    await cercaExtra(p, "Aghi");
    const riga = p.nodo.querySelector('[data-extra-trovato="gia-nel-pacco"]');
    expect(riga.textContent).toContain("già nel pacco: 5 pezzi");
    expect(riga.textContent).toContain("5 dai kit");
    await p.smonta();
  });

  it("premendo chiede, e con «no» non aggiunge niente", async () => {
    const salvataggi = [];
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await pannello((campi) => salvataggi.push(campi));
    await cercaExtra(p, "Aghi");
    await clicca(p.nodo.querySelector('[data-extra-trovato="gia-nel-pacco"]'));
    expect(domande.length).toBe(1);
    expect(domande[0]).toContain("Attenzione: 5 pezzi di «Aghi 1RL (5 pz)»");
    expect(domande[0]).toContain("Sei sicuro di aggiungerne altri?");
    expect(salvataggi).toEqual([]);
    window.confirm = () => true;
    await p.smonta();
  });

  it("con «sì» l'extra si aggiunge, come sempre", async () => {
    const salvataggi = [];
    window.confirm = () => true;
    const p = await pannello((campi) => salvataggi.push(campi));
    await cercaExtra(p, "Aghi");
    await clicca(p.nodo.querySelector('[data-extra-trovato="gia-nel-pacco"]'));
    expect(salvataggi).toEqual([{ accessori_quantita: { "extra::p-aghi": 0 } }]);
    await p.smonta();
  });

  it("un prodotto che nel pacco non c'è si aggiunge senza chiedere niente", async () => {
    const salvataggi = [];
    const domande = [];
    window.confirm = (t) => { domande.push(t); return true; };
    const p = await pannello((campi) => salvataggi.push(campi));
    await cercaExtra(p, "Olio");
    const riga = p.nodo.querySelector("[data-extra-trovato]");
    // nessun avviso in elenco, e premendo nessuna domanda: un avviso che
    // compare sempre si impara a saltare, e si porta dietro anche quelli
    // che contano
    expect(riga.getAttribute("data-extra-trovato")).toBe("nuovo");
    expect(riga.textContent).not.toContain("già nel pacco");
    await clicca(riga);
    expect(domande).toEqual([]);
    expect(salvataggi).toEqual([{ accessori_quantita: { "extra::p-olio": 0 } }]);
    await p.smonta();
  });
});
