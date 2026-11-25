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
} from "../src/App.jsx";

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
    // e dice che il magazzino non li scala ancora, invece di tacerlo
    expect(sorgente).toContain("il magazzino non li scala ancora");
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
