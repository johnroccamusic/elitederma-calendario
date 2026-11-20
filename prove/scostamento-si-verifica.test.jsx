// «VERIFICATO»: IL CONTO CHE NON TORNA SI CHIUDE CONTANDO LO SCAFFALE.
// 20/11/2026.
//
// Il titolare, davanti alle 84 righe di «I conti non tornano»: «metti un
// tasto verificato vicino a ciascun prodotto per eliminare il prodotto
// dalla lista una volta verificato il quantitativo in magazzino».
//
// La parte che queste prove inchiodano e' il MOTIVO per cui il tasto non
// poteva essere una cancellazione: `controlla_saldi_magazzino()` riscrive
// quell'elenco ogni notte con un upsert, quindi una riga tolta e basta
// torna il giorno dopo identica. E una rettifica normale non la chiude
// nemmeno: `muoviStock` alza giacenza e registro della stessa cifra, e la
// differenza resta dov'era. L'unico gesto che chiude davvero uno
// scostamento e' scrivere a registro il movimento che MANCAVA — ed e'
// quello che la chiamata deve mandare al database.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { cosaCambiaLaVerifica, fraseVerificaFatta, PannelloScostamenti } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";

// i numeri veri della «Colla Ultra Clear 5ml» il 20/11/2026: saldo di
// partenza 64 del 19/10, nessun movimento da allora, e in magazzino 24 —
// qualcuno ha scritto quel numero scavalcando il registro
const COLLA = { prodotto_id: "p-colla", atteso: 64, trovato: 24, differenza: -40, dal: "2026-11-17T05:15:00.000Z" };
const PRODOTTI = { "p-colla": { id: "p-colla", nome: "Colla Ultra Clear 5ml", woo_product_id: 101 } };

// IL GENITORE FINTO, e non e' un dettaglio: nella pagina vera la riga
// sparisce perche' `ricarica` rilegge `magazzino_scostamenti` e il
// database non la restituisce piu'. Qui si fa la stessa cosa — togliere
// la riga all'arrivo del ricarica — cosi' la prova guarda la pagina come
// la vede chi preme, non un elenco congelato.
function Genitore({ scostamenti, prodottiPerId, operatore = null, onRicarica }) {
  const [righe, setRighe] = React.useState(scostamenti);
  return (
    <PannelloScostamenti
      scostamenti={righe}
      prodottiPerId={prodottiPerId}
      operatore={operatore}
      ricarica={(t) => { onRicarica?.(t); setRighe([]); }}
    />
  );
}


describe("cosa cambia una verifica, detto prima di premere", () => {
  it("confermando il numero dell'app la giacenza NON si muove: si scrive solo il registro", () => {
    const c = cosaCambiaLaVerifica({ atteso: 64, trovato: 24, contato: "24" });
    expect(c.valido).toBe(true);
    expect(c.giacenzaCambia).toBe(false);
    expect(c.delta).toBe(-40);
    expect(c.frase).toContain("La giacenza resta 24");
    expect(c.frase).toContain("-40");
  });

  it("contando un numero diverso la giacenza passa a quello, e il movimento cresce", () => {
    // ed e' il caso che la rettifica normale non sa chiudere: li' il
    // delta andrebbe su tutti e due i conti e la differenza resterebbe
    const c = cosaCambiaLaVerifica({ atteso: 64, trovato: 24, contato: "20" });
    expect(c.giacenzaCambia).toBe(true);
    expect(c.delta).toBe(-44);
    expect(c.frase).toContain("da 24 a 20");
  });

  it("quando registro e magazzino dicono gia' la stessa cosa non c'e' niente da scrivere", () => {
    const c = cosaCambiaLaVerifica({ atteso: 30, trovato: 30, contato: "30" });
    expect(c.delta).toBe(0);
    expect(c.giacenzaCambia).toBe(false);
    expect(c.frase).toContain("non c'è niente da correggere");
  });

  it("zero e' un conteggio valido, il vuoto e il negativo no", () => {
    // uno scaffale vuoto e' una risposta, e rifiutarla vorrebbe dire non
    // poter chiudere proprio le righe dei prodotti finiti
    expect(cosaCambiaLaVerifica({ atteso: 5, trovato: 2, contato: "0" }).valido).toBe(true);
    expect(cosaCambiaLaVerifica({ atteso: 5, trovato: 2, contato: "" }).valido).toBe(false);
    expect(cosaCambiaLaVerifica({ atteso: 5, trovato: 2, contato: "-1" }).valido).toBe(false);
    expect(cosaCambiaLaVerifica({ atteso: 5, trovato: 2, contato: "2,5" }).valido).toBe(false);
  });
});

describe("la frase che si legge dopo", () => {
  it("racconta i numeri VERI del database, non la previsione della pagina", () => {
    // i numeri del pannello sono la fotografia delle 05:15: durante il
    // giorno vendite e corsi muovono tutti e due i conti, e l'atteso vero
    // lo ricalcola il database al momento della verifica
    const t = fraseVerificaFatta({ nome: "Colla Ultra Clear 5ml", contato: 24, quantita_prima: 24, delta: -47, giacenza_cambiata: false });
    expect(t).toContain("contati 24 pezzi");
    expect(t).toContain("non è stata toccata");
    expect(t).toContain("-47");
  });

  it("dice anche quando a registro non mancava niente", () => {
    const t = fraseVerificaFatta({ nome: "X", contato: 3, quantita_prima: 3, delta: 0, giacenza_cambiata: false });
    expect(t).toContain("A registro non mancava niente");
  });
});

// IL GESTO, con il pannello montato per davvero. Monta la pagina intera
// sarebbe un peso inutile: il pannello e' esportabile solo attraverso la
// pagina, quindi si prova la pagina dove vive — ma qui basta il pannello,
// che e' quello che la persona tocca.
describe("il tasto, premuto davvero", () => {
  let chiamata;
  beforeEach(() => {
    chiamata = null;
    rispondiCon({
      "/rest/v1/rpc/magazzino_verifica": (corpo) => {
        chiamata = corpo;
        return { ok: true, nome: "Colla Ultra Clear 5ml", atteso: 64, quantita_prima: 24, contato: Number(corpo.p_contato), delta: Number(corpo.p_contato) - 64, giacenza_cambiata: Number(corpo.p_contato) !== 24 };
      },
    });
  });

  it("ogni riga ha il suo tasto, e il pannello chiede quanti pezzi si sono contati", async () => {
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} />);
    expect(p.nodo.querySelector('[data-verifica-apri="p-colla"]')).toBeTruthy();
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    const casella = p.nodo.querySelector("[data-verifica-contato]");
    expect(casella).toBeTruthy();
    // parte dal numero che l'app mostra: il caso normale e' confermarlo,
    // e si chiude con un tocco solo
    expect(casella.value).toBe("24");
    expect(p.nodo.querySelector("[data-verifica-frase]").textContent).toContain("La giacenza resta 24");
    await p.smonta();
  });

  it("confermando manda al database il conteggio, non la differenza", async () => {
    // la differenza la ricalcola il database: mandarla da qui vorrebbe
    // dire scrivere un movimento sulla fotografia di stanotte
    const ricaricate = [];
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} operatore="Raffaele Villanno" onRicarica={(t) => ricaricate.push(t)} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await clicca(p.nodo.querySelector('[data-verifica-conferma="p-colla"]'));
    await attendi(80);
    expect(chiamata).toEqual({ p_prodotto_id: "p-colla", p_contato: 24, p_chi: "Raffaele Villanno" });
    expect(ricaricate.flat()).toContain("magazzino_scostamenti");
    expect(ricaricate.flat()).toContain("prodotti_shop");
    await p.smonta();
  });

  it("contato un numero diverso, e' QUELLO che parte", async () => {
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await scrivi(p.nodo.querySelector("[data-verifica-contato]"), "20");
    expect(p.nodo.querySelector("[data-verifica-frase]").textContent).toContain("da 24 a 20");
    await clicca(p.nodo.querySelector('[data-verifica-conferma="p-colla"]'));
    await attendi(80);
    expect(chiamata.p_contato).toBe(20);
    await p.smonta();
  });

  it("con la casella vuota non si puo' confermare", async () => {
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await scrivi(p.nodo.querySelector("[data-verifica-contato]"), "");
    expect(p.nodo.querySelector('[data-verifica-conferma="p-colla"]').disabled).toBe(true);
    await clicca(p.nodo.querySelector('[data-verifica-conferma="p-colla"]'));
    await attendi(60);
    expect(chiamata).toBeNull();
    await p.smonta();
  });

  it("annullando non scrive niente", async () => {
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await clicca(p.nodo.querySelector("[data-verifica-annulla]"));
    await attendi(60);
    expect(chiamata).toBeNull();
    expect(p.nodo.querySelector("[data-verifica-contato]")).toBeFalsy();
    await p.smonta();
  });

  it("se il database rifiuta, lo dice e NON fa sparire la riga", async () => {
    rispondiCon({ "/rest/v1/rpc/magazzino_verifica": () => ({ ok: false, motivo: "non_trovato" }) });
    const ricaricate = [];
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} onRicarica={(t) => ricaricate.push(t)} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await clicca(p.nodo.querySelector('[data-verifica-conferma="p-colla"]'));
    await attendi(80);
    expect(p.nodo.querySelector("[data-esito-verifica]").textContent).toContain("non è più in anagrafica");
    expect(ricaricate).toEqual([]);
    await p.smonta();
  });

  it("verificato l'ultimo, il riquadro resta per dire com'e' andata", async () => {
    // sparire senza una parola sarebbe il gesto piu' importante della
    // pagina che non lascia traccia
    const p = await monta(<Genitore scostamenti={[COLLA]} prodottiPerId={PRODOTTI} />);
    await clicca(p.nodo.querySelector('[data-verifica-apri="p-colla"]'));
    await clicca(p.nodo.querySelector('[data-verifica-conferma="p-colla"]'));
    await attendi(120);
    expect(p.nodo.querySelector("[data-esito-verifica]").textContent).toContain("I conti su questo prodotto tornano");
    await p.smonta();
  });

  it("senza nessuno scostamento e senza niente da dire, il riquadro non si disegna", async () => {
    const p = await monta(<Genitore scostamenti={[]} prodottiPerId={{}} />);
    expect(p.nodo.textContent).not.toContain("I CONTI");
    await p.smonta();
  });
});

// LA GUARDIA CHE DURA.
//
// La scorciatoia sbagliata qui e' una sola e si scrive in dieci secondi:
// cancellare la riga di `magazzino_scostamenti` dalla pagina. Per una
// notte sembra funzionare, e alle 05:15 del giorno dopo
// `controlla_saldi_magazzino()` la riscrive identica con un upsert —
// quindi il guasto non e' «non funziona», e' «funziona finche' nessuno
// guarda». Se un giorno qualcuno la rimette, questa prova diventa rossa
// invece di farcelo scoprire fra un mese contando le righe.
describe("la riga non si cancella: si chiude il conto", () => {
  it("il pannello passa da `magazzino_verifica` e non cancella niente a mano", () => {
    const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
    const pannello = sorgente.slice(
      sorgente.indexOf("function PannelloScostamenti("),
      sorgente.indexOf("// LO SCARTO COL SITO"),
    );
    expect(pannello).toContain('supabase.rpc("magazzino_verifica"');
    expect(pannello).not.toMatch(/from\(["']magazzino_scostamenti["']\)/);
    expect(pannello).not.toMatch(/\.delete\(\)/);
  });

  it("e il database ricalcola l'atteso da se': dalla pagina parte solo il conteggio", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261120110000_il_conto_che_non_torna_si_verifica.sql"),
      "utf8",
    );
    // niente `p_atteso` fra i parametri: l'atteso arriva dai movimenti,
    // non dalla fotografia delle 05:15 che il browser ha in mano
    expect(sql).toContain("p_contato integer");
    expect(sql).not.toContain("p_atteso");
    expect(sql).toContain("for update");
    expect(sql).toContain("'verifica_magazzino'");
  });
});
