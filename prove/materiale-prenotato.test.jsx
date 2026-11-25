// «ALTRO MATERIALE»: QUELLO CHE L'ALLIEVA COMPRA COL CORSO (25/11/2026).
//
// Il titolare, subito dopo il lavoro sul dermografo: «nella stessa
// casella dove si imposta la prenotazione del dermografo si deve poter
// aggiungere anche "altro materiale", che sarebbe il materiale che
// l'allieva decide di acquistare insieme con il corso. La creazione
// della lista avviene con una casella di ricerca con la lente in cui si
// trova il prodotto voluto tra tutti quelli in magazzino, si seleziona,
// e sotto si crea un elenco: "Aghi 1RL x 2 €xx, Lampada da
// dermopigmentazione €xx", totale da pagare, metodo di pagamento (come
// se fosse un mini POS), e anche questo si somma nelle cifre da ricevere
// al corso nella contabilità. In più in logistica appare una nuova
// casella, dopo quella dei dermografi, "MATERIALE PRENOTATO", con sotto
// il nome dell'allieva e la lista dei materiali prenotati da pagare al
// corso».
//
// È il fratello del dermografo pagato col corso, e segue le stesse tre
// decisioni prese quella mattina: una spunta sola al corso, i soldi in
// contabilità come il saldo, avvisa senza bloccare.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  righeMaterialeDi, materialeRicavoDi, materialeDaIncassareDi,
  materialeImponibileDi, materialeRisultaPagato, daIncassareAlCorsoDi,
  materialePrenotatoEdizione, listaRaccoltaMateriale, RiepilogoVenditaIscritto,
} from "../src/App.jsx";
import React from "react";
import { monta } from "./aiuto.js";

// l'esempio del titolare, con numeri veri
const CON_MATERIALE = {
  saldo_totale: 390,
  materiale_prenotato: [
    { prodotto_id: "p-aghi", nome: "Aghi 1RL", quantita: 2, prezzo: 12.5 },
    { prodotto_id: "p-lampada", nome: "Lampada da dermopigmentazione", quantita: 1, prezzo: 180 },
  ],
  materiale_metodo: "Cash no iva",
  materiale_pagato: false,
};

describe("il materiale prenotato nei conti", () => {
  it("il totale è la somma delle righe: 2 aghi più la lampada", () => {
    expect(materialeRicavoDi(CON_MATERIALE)).toBe(205);
    expect(materialeDaIncassareDi(CON_MATERIALE)).toBe(205);
  });

  it("si somma al «da incassare» della classe, insieme al saldo", () => {
    expect(daIncassareAlCorsoDi(CON_MATERIALE)).toBe(595);
  });

  it("una riga a quantità zero non è una prenotazione", () => {
    const conZero = { ...CON_MATERIALE, materiale_prenotato: [{ prodotto_id: "x", nome: "Boh", quantita: 0, prezzo: 90 }] };
    expect(righeMaterialeDi(conZero)).toHaveLength(0);
    expect(materialeRicavoDi(conZero)).toBe(0);
  });

  it("chi non prenota niente non cambia di un centesimo", () => {
    expect(materialeDaIncassareDi({ saldo_totale: 390 })).toBe(0);
    expect(daIncassareAlCorsoDi({ saldo_totale: 390 })).toBe(390);
    expect(materialeRisultaPagato({ saldo_totale: 390 })).toBe(null);
  });

  it("già pagato prima del corso: non si esige, ma resta un ricavo della classe", () => {
    const pagato = { ...CON_MATERIALE, materiale_pagato: true };
    expect(materialeDaIncassareDi(pagato)).toBe(0);
    expect(daIncassareAlCorsoDi(pagato)).toBe(390);
    expect(materialeRicavoDi(pagato)).toBe(205);
  });

  it("col contante senza fattura non c'è IVA da scorporare; altrimenti sì", () => {
    expect(materialeImponibileDi(CON_MATERIALE)).toBe(205);
    expect(materialeImponibileDi({ ...CON_MATERIALE, materiale_metodo: "POS fisico" })).toBe(168.03);
  });

  it("una spunta sola: incassata la classe, il materiale risulta pagato", () => {
    expect(materialeRisultaPagato(CON_MATERIALE)).toBe(false);
    expect(materialeRisultaPagato({ ...CON_MATERIALE, incassato: true })).toBe(true);
    // ma la cifra non si muove: ricavo e incasso sono due domande
    expect(daIncassareAlCorsoDi({ ...CON_MATERIALE, incassato: true })).toBe(595);
  });

  it("il dermografo e il materiale si sommano, non si sostituiscono", () => {
    const tutto = {
      ...CON_MATERIALE, numero_modelle: 1,
      dermografo_pagamento: "con_corso", dermografo_totale: 890, dermografo_imponibile: 729.51,
    };
    // 390 saldo + 60 modella + 890 dermografo + 205 materiale
    expect(daIncassareAlCorsoDi(tutto)).toBe(1545);
  });
});

describe("dove si vede", () => {
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

  it("si cerca col campo che apre l'elenco sotto, non con una tendina da scorrere", () => {
    expect(sorgente).toContain('chiave="materiale-prenotato"');
    expect(sorgente).toContain("materialeCercabile");
    // un prodotto fuori listino non si prenota: non si vende più
    expect(sorgente).toContain("p.attivo !== false && p.prezzo_vendita != null");
  });

  it("ha il suo metodo di pagamento, come un mini POS", () => {
    expect(sorgente).toContain("data-materiale-metodo");
    expect(sorgente).toContain("data-materiale-totale");
  });

  it("la cassa della classe guarda il metodo DEL MATERIALE", () => {
    expect(sorgente).toContain("eContanti(i.materiale_metodo) ? materialeRicavoDi(i) : 0");
    expect(sorgente).toContain("eMetodoPos(i.materiale_metodo) ? materialeRicavoDi(i) : 0");
  });

  it("in prima nota ha una riga sua, perché il metodo può essere un altro", () => {
    expect(sorgente).toContain('aggiungi("materiale", "Materiale prenotato"');
  });

  it("in logistica c'è la casella, dopo i dermografi, con nome e lista", () => {
    expect(sorgente).toContain('titolo="Materiale prenotato"');
    expect(sorgente).toContain("data-materiale-logistica");
    // e dice che il magazzino li scala col pacco (dal 25/11/2026: prima
    // diceva il contrario, ed era vero allora)
    expect(sorgente).toContain("scalano dal magazzino insieme ai kit");
    expect(sorgente).not.toContain("il magazzino non li scala ancora");
  });

  it("la numerazione delle sezioni non salta quando la casella non c'è", () => {
    // con dermografi e materiale le sezioni sono cinque, senza tre:
    // saltare un numero fa cercare una sezione che non esiste
    expect(sorgente).toContain("materiale: mostraMateriale ? prossimo() : null");
  });

  it("in aula il materiale non pagato si vede, e non blocca niente", () => {
    expect(sorgente).toContain("data-materiale-da-pagare");
  });
});

// IL CONTO IN FONDO ALLA SCHEDA (25/11/2026). Il titolare, con una
// schermata: «anche se hai messo che il pagamento del dermografo è in
// contanti, il suo valore comunque non risulta da incassare in fondo al
// modulo: la somma da ricevere al corso non comprende comunque il
// dermografo».
//
// «Restano da pagare» è il residuo del PATTUITO, e come tale era
// giusto — dermografo, materiale e modelle non stanno nel pattuito.
// Ma è la cifra in fondo alla scheda, quella che si guarda per sapere
// quanto quella persona deve ancora dare, e ne diceva una più bassa di
// quella vera: 390 invece di 1.340. Due numeri diversi sulla stessa
// allieva, perché la lista della classe il conto giusto lo faceva già.
describe("in fondo alla scheda si legge quanto deve dare in tutto", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

  it("il riquadro degli extra c'è, col totale", () => {
    expect(sorgente).toContain("data-extra-al-corso");
    expect(sorgente).toContain("data-tutto-al-corso");
    expect(sorgente).toContain("In pi&ugrave;, da incassare al corso");
  });

  it("il totale passa dalla stessa funzione della lista e della cassa", () => {
    // un quattordicesimo conto scritto qui direbbe un quattordicesimo numero
    expect(sorgente).toContain("const tuttoAlCorso = daIncassareAlCorsoDi(comeSeSalvata);");
  });

  it("«Restano da pagare» resta il residuo del corso, e lo dice", () => {
    expect(sorgente).toContain(">del corso</span>");
  });
});

// IL MATERIALE PRENOTATO SCALA DAL MAGAZZINO COL PACCO (25/11/2026).
//
// Il titolare, chiudendo l'unica cosa rimasta in sospeso di stamattina:
// «il materiale prenotato lo mette Raf nel pacco e scala quando esce dal
// magazzino insieme con la roba dei kit».
//
// Due conseguenze, e sono due cose diverse: chi prepara deve TROVARLO
// nella lista di raccolta (altrimenti non lo prende dallo scaffale), e la
// giacenza deve scendere quando il pacco si dichiara preparato
// (altrimenti si ripete il guasto dello shop del 24/11: merce uscita e
// giacenza ferma, senza che nessuno lo sappia).
describe("il materiale prenotato esce dal magazzino col pacco", () => {
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

  const ALLIEVA_A = {
    id: "a1", corso_data_id: "cd1", nome: "A", cognome: "A", pacchetto_kit: "KIT BASE", kit_id: "k1",
    materiale_prenotato: [
      { prodotto_id: "p-aghi", nome: "Aghi 1RL", quantita: 2, prezzo: 12.5 },
      { prodotto_id: "p-lampada", nome: "Lampada", quantita: 1, prezzo: 180 },
    ],
  };
  const ALLIEVA_B = {
    id: "a2", corso_data_id: "cd1", nome: "B", cognome: "B", pacchetto_kit: "KIT BASE", kit_id: "k1",
    materiale_prenotato: [{ prodotto_id: "p-aghi", nome: "Aghi 1RL", quantita: 3, prezzo: 12.5 }],
  };

  it("due allieve che prenotano lo stesso ago fanno UNA riga da cinque pezzi", () => {
    const { perProdotto, senzaProdotto } = materialePrenotatoEdizione([ALLIEVA_A, ALLIEVA_B]);
    expect(perProdotto).toEqual({ "p-aghi": 5, "p-lampada": 1 });
    expect(senzaProdotto).toEqual([]);
  });

  it("una riga senza prodotto di magazzino si NOMINA, non si lascia cadere", () => {
    // il legame col magazzino è l'id: senza, non c'è niente da scaricare,
    // e il pacco partirebbe con della merce che la giacenza non vede
    const { perProdotto, senzaProdotto } = materialePrenotatoEdizione([
      { materiale_prenotato: [{ nome: "Scritto a mano", quantita: 1, prezzo: 10 }] },
    ]);
    expect(perProdotto).toEqual({});
    expect(senzaProdotto).toEqual(["Scritto a mano"]);
  });

  it("chi non prenota niente non porta nessuna riga", () => {
    expect(materialePrenotatoEdizione([{ id: "x" }]).perProdotto).toEqual({});
    expect(materialePrenotatoEdizione(null).perProdotto).toEqual({});
  });

  // CHI PREPARA LO TROVA NELLA LISTA DI RACCOLTA, insieme ai pezzi dei
  // kit: è lì che si guarda prima di passare fra gli scaffali.
  const KIT = [{ id: "k1", nome: "KIT BASE", corso_id: "c1", ordine: 1 }];
  const DISTINTA = [
    { kit_id: "k1", corso_id: "c1", tipo: "kit", prodotto_id: "p-aghi", quantita: 1 },
    { kit_id: "k1", corso_id: "c1", tipo: "kit", prodotto_id: "p-pelle", quantita: 1 },
  ];
  const PRODOTTI = [
    { id: "p-aghi", nome: "Aghi 1RL" },
    { id: "p-pelle", nome: "Pelle sintetica" },
    { id: "p-lampada", nome: "Lampada" },
  ];
  const raccolta = () => listaRaccoltaMateriale({
    iscrittiEdizione: [ALLIEVA_A, ALLIEVA_B], statoEdizione: {}, kitDefinizioni: KIT,
    corsiKitProdotti: DISTINTA, prodottiShop: PRODOTTI, corsoId: "c1", dataInizio: "2027-01-10",
  });

  it("i pezzi prenotati sono nella lista di raccolta, sommati a quelli dei kit", () => {
    const righe = raccolta();
    const aghi = righe.find((r) => r.prodottoId === "p-aghi");
    // due kit (uno a testa) più i cinque aghi prenotati
    expect(aghi.quantita).toBe(7);
    // una riga sola, che dice da dove viene ogni pezzo
    expect(aghi.da).toContain("materiale prenotato dalle allieve");
    expect(aghi.da.some((d) => d.includes("KIT BASE"))).toBe(true);
    expect(righe.filter((r) => r.prodottoId === "p-aghi")).toHaveLength(1);
  });

  it("un prodotto che viene SOLO dalle prenotazioni ha la sua riga", () => {
    const lampada = raccolta().find((r) => r.prodottoId === "p-lampada");
    expect(lampada.quantita).toBe(1);
    expect(lampada.da).toEqual(["materiale prenotato dalle allieve"]);
  });

  it("senza prenotazioni la lista è quella di prima", () => {
    const righe = listaRaccoltaMateriale({
      iscrittiEdizione: [{ ...ALLIEVA_A, materiale_prenotato: null }], statoEdizione: {}, kitDefinizioni: KIT,
      corsiKitProdotti: DISTINTA, prodottiShop: PRODOTTI, corsoId: "c1", dataInizio: "2027-01-10",
    });
    expect(righe.find((r) => r.prodottoId === "p-aghi").quantita).toBe(1);
    expect(righe.find((r) => r.prodottoId === "p-lampada")).toBeUndefined();
  });

  // LA GUARDIA CHE DURA. Il movimento vero lo fa il database, e nessuna
  // prova di questo banco può premere quel tasto: quello che si può
  // inchiodare è che lo scarico passi dal registro e applichi SEMPRE la
  // differenza, mai il valore assoluto — è il guasto di Udine del 22/09,
  // pezzi usciti due e tre volte.
  it("lo scarico applica la differenza e registra quanto è uscito", () => {
    expect(sorgente).toContain("const materialeScaricato = stato.scarico_materiale || {};");
    expect(sorgente).toContain("const delta = target - giaScaricato;");
    expect(sorgente).toContain("scarico_materiale: nuovoScaricoMateriale");
  });

  it("tornando indietro i pezzi tornano a scaffale, e il registro si azzera", () => {
    expect(sorgente).toContain("Object.entries(stato.scarico_materiale || {}).forEach");
    expect(sorgente).toContain('scarico_dermografi: {}, scarico_materiale: {} }');
  });

  it("una prenotazione aggiunta dopo lo scarico compare fra le cose da riallineare", () => {
    expect(sorgente).toContain("const differenzeMat = [");
    expect(sorgente).toContain("...differenzeKit, ...differenzeDerm, ...differenzeMat");
  });

  it("la fotografia del pacco porta anche la merce prenotata", () => {
    expect(sorgente).toContain("materiale_prenotato: materialePrenotatoEdizione(iscrittiEdizione || []).perProdotto");
  });
});

// LA MERCE SI LEGGE IN COLONNA (25/11/2026, correzione del titolare
// davanti alla scheda: «ma invece di fare sta pecionata nella macchia
// rossa in basso non potevi elencare i prodotti in alto in colonna ben
// visibili sotto a dati operativi, incasso modella, poi prodotti
// ecc...?»).
//
// Aveva ragione: dermografo e materiale prenotato sono cose che qualcuno
// deve mettere in una scatola e farsi pagare, e stavano stipate in due
// righe piccole dentro la fascia rossa dell'incasso — la stessa cosa
// detta due volte, una da leggere e una da saltare. Adesso stanno fra i
// Dati operativi, voce per voce col suo prezzo, dove si leggono le
// modelle e la taglia; la fascia dice quanto, non cosa.
describe("i prodotti si leggono in colonna, nei Dati operativi", () => {
  const ISCRITTA = {
    id: "i1", nome: "A", cognome: "A", totale_pattuito: 2190, saldo_totale: 390,
    richiede_modelle: true, numero_modelle: 1, taglia_divisa: "M",
    dermografo_scelta: "tekna", dermografo_pagamento: "con_corso",
    dermografo_totale: 890, dermografo_metodo: "Contanti", dermografo_consegna: "corso",
    materiale_prenotato: [
      { prodotto_id: "p-1", nome: "Gold Master - Precision - 1RL", quantita: 2, prezzo: 13.45 },
      { prodotto_id: "p-2", nome: "Gold Master - Precision - 3RL", quantita: 1, prezzo: 26.90 },
    ],
    materiale_metodo: "Contanti",
  };

  it("ogni prodotto prenotato ha la sua riga, col nome, i pezzi e il prezzo", async () => {
    const p = await monta(<RiepilogoVenditaIscritto i={ISCRITTA} isMobile={false} />);
    expect(p.nodo.querySelector("[data-materiale-riga]")).toBeTruthy();
    const testo = p.testo();
    expect(testo).toContain("Gold Master - Precision - 1RL");
    expect(testo).toContain("Gold Master - Precision - 3RL");
    expect(testo).toContain("26,90");   // due aghi da 13,45
    expect(testo).toContain("53,80");   // il totale del materiale
    await p.smonta();
  });

  it("il dermografo pagato col corso ha la sua riga, col prezzo e il metodo", async () => {
    const p = await monta(<RiepilogoVenditaIscritto i={ISCRITTA} isMobile={false} />);
    expect(p.nodo.querySelector("[data-dermografo-riga]")).toBeTruthy();
    // il modello si legge: «le la macchina» non dice quale si consegna
    expect(p.testo()).toContain("Tekna");
    expect(p.testo()).toContain("890,00");
    expect(p.testo()).toContain("da pagare prima di consegnarlo");
    await p.smonta();
  });

  it("senza metodo si dice lì, sulla riga di quella merce", async () => {
    const p = await monta(<RiepilogoVenditaIscritto i={{ ...ISCRITTA, materiale_metodo: null, dermografo_metodo: null }} isMobile={false} />);
    expect(p.testo()).toContain("metodo non scelto");
    await p.smonta();
  });

  it("chi non ha comprato niente non vede nessuna riga in più", async () => {
    const p = await monta(<RiepilogoVenditaIscritto i={{ id: "i2", totale_pattuito: 900, saldo_totale: 100, taglia_divisa: "M" }} isMobile={false} />);
    expect(p.nodo.querySelector("[data-materiale-riga]")).toBeFalsy();
    expect(p.nodo.querySelector("[data-dermografo-riga]")).toBeFalsy();
    expect(p.testo()).toContain("Taglia divisa");
    await p.smonta();
  });

  it("la fascia rossa non ripete l'elenco: dice quanto, non cosa", () => {
    const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
    expect(sorgente).not.toContain("di cui {euroScheda(materialeDaIncassareDi(i))} di materiale prenotato");
    expect(sorgente).not.toContain("di cui {euroScheda(dermografoDaIncassareDi(i))} di dermografo");
    expect(sorgente).toContain("l'elenco è qui sopra, in Dati operativi");
  });
});
