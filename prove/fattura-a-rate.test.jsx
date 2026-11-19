// UNA FATTURA A RATE HA UNA SPESA PER RATA. 19/11/2026.
//
// Il titolare, sulla fattura Orthostetica n. 771: «anche se è pagata devo
// poterci unire la fattura ricevuta da Fatture in Cloud».
//
// Quella fattura è di 1.820,09 e Fatture in Cloud la porta con il suo piano
// rate scritto dentro (documento_fornitore.rate): 910,05 il 13/11 e 910,04
// il 13/12. In app sono due spese, una pagata e una da pagare.
//
// Il legame fattura→spesa stava su UNA colonna della fattura
// (fatture_ricevute_fic.spesa_id), e il quadro «Associa una fattura» mostra
// apposta solo le fatture LIBERE — per non staccarne una da dove sta.
// Conseguenza: attaccata la fattura alla prima rata, la seconda non poteva
// più riceverla. Quell'uscita sarebbe rimasta «da associare» per sempre.
//
// Adesso il legame sta sulla SPESA (spese.fattura_fic_id) e la copertura si
// CALCOLA: somma dei totali delle spese legate contro il totale della
// fattura. Niente colonna da tenere aggiornata, quindi nessun numero che
// possa contraddire le righe che riassume.
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { coperturaFattura, ModaleAssociaFattura } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

// i numeri veri della 771 e della 846, letti dal database il 19/11/2026
const F771 = { id: "f-771", fic_id: 442042557, fornitore_nome: "ORTHOSTETICA SRL", numero_documento: "771", data_documento: "2026-10-13", totale: 1820.09 };
const F846 = { id: "f-846", fic_id: 444240786, fornitore_nome: "ORTHOSTETICA SRL", numero_documento: "846", data_documento: "2026-10-29", totale: 1843.58 };
const DOC771 = {
  id: "d-771", fic_id: 442042557, numero: "771", totale: 1820.09,
  rate: [
    { amount: 910.05, due_date: "2026-11-13", status: "not_paid" },
    { amount: 910.04, due_date: "2026-12-13", status: "not_paid" },
  ],
};
const RATA1 = { id: "s-1", totale: 910.05, fattura_fic_id: "f-771", descrizione: "Orthostetica fattura 771 - 1 parte" };
const RATA2 = { id: "s-2", totale: 910.04, fattura_fic_id: null, descrizione: "Orthostetica" };

describe("quanto di una fattura è coperto", () => {
  it("nessuna spesa: niente di coperto, e non è «iniziata»", () => {
    const c = coperturaFattura(F771, [RATA2]);
    expect(c.coperto).toBe(0);
    expect(c.resta).toBe(1820.09);
    expect(c.iniziata).toBe(false);
    expect(c.completa).toBe(false);
  });

  it("una rata pagata: coperta a metà, e resta l'altra AL CENTESIMO", () => {
    const c = coperturaFattura(F771, [RATA1, RATA2]);
    expect(c.coperto).toBe(910.05);
    expect(c.resta).toBe(910.04);
    expect(c.iniziata).toBe(true);
    // è il punto di tutto il lavoro: una rata sola NON chiude la fattura
    expect(c.completa).toBe(false);
  });

  it("tutte e due le rate: completa, e 910,05 + 910,04 fa esattamente il totale", () => {
    const c = coperturaFattura(F771, [RATA1, { ...RATA2, fattura_fic_id: "f-771" }]);
    expect(c.coperto).toBe(1820.09);
    expect(c.resta).toBe(0);
    expect(c.completa).toBe(true);
    expect(c.righe).toHaveLength(2);
  });

  it("i centesimi non la lasciano aperta per un soffio", () => {
    // 1.820,08 su 1.820,09: la fattura è chiusa, non «resta un centesimo»
    const c = coperturaFattura(F771, [{ id: "x", totale: 1820.08, fattura_fic_id: "f-771" }]);
    expect(c.completa).toBe(true);
  });

  it("coperta più del dovuto si segnala: una di quelle spese è di un'altra fattura", () => {
    const c = coperturaFattura(F771, [RATA1, { id: "y", totale: 1500, fattura_fic_id: "f-771" }]);
    expect(c.eccede).toBe(true);
    // `resta` non va sottozero: in pagina «resta −589,96» non vuol dire niente
    expect(c.resta).toBe(0);
  });

  it("le spese di un'ALTRA fattura non si sommano a questa", () => {
    const c = coperturaFattura(F846, [RATA1, { id: "z", totale: 921.79, fattura_fic_id: "f-846" }]);
    expect(c.coperto).toBe(921.79);
    expect(c.resta).toBe(921.79);
  });

  it("senza fattura non si inventa nessuna copertura", () => {
    expect(coperturaFattura(null, [RATA1]).righe).toEqual([]);
    expect(coperturaFattura(undefined, [RATA1]).completa).toBe(false);
  });
});

// LA GUARDIA CHE DURA. Il difetto non stava in un componente: stava nella
// FORMA del legame, una colonna sola su una fattura che di spese ne ha
// tante. Il giorno in cui qualcuno rimette `spesa_id` addosso alla fattura
// — o riscrive il filtro delle «fatture libere» — questa prova diventa
// rossa, invece di far scoprire fra un anno una rata che non si chiude.
describe("il legame sta sulla spesa, e nessuno legge più quello vecchio", () => {
  it("nessun punto dell'app legge o scrive fatture_ricevute_fic.spesa_id", () => {
    // `spesa_id` esiste ancora, ma su `spese_attribuzioni`, che e' un'altra
    // cosa: qui si cerca solo quello della FATTURA
    const righe = SORGENTE.split("\n")
      .map((r, i) => [i + 1, r])
      .filter(([, r]) => /\bf\.spesa_id\b/.test(r) || (/spesa_id/.test(r) && /fatture_ricevute_fic/.test(r)));
    expect(righe).toEqual([]);
    expect(SORGENTE).not.toContain('fatture_ricevute_fic").update({ spesa_id');
  });

  it("il quadro offre le fatture NON COPERTE PER INTERO, non quelle «libere»", () => {
    expect(SORGENTE).toContain('const aperte = (fatture || []).filter((f) => !coperturaFattura(f, spese).completa);');
    expect(SORGENTE).not.toContain('const libere = (fatture || []).filter((f) => !f.spesa_id);');
  });

  it("il legame si scrive su TUTTE le spese della riga, non sulla prima", () => {
    // un bonifico solo che paga due spese è una riga sola: attaccando la
    // fattura a una delle due, l'altra resterebbe senza
    expect(SORGENTE).toContain('.from("spese").update({ fattura_fic_id: f.id }).in("id", idSpese).select("id, fattura_fic_id")');
  });

  it("«Errore, non pagata» stacca la fattura nella STESSA scrittura della spesa", () => {
    const pezzo = SORGENTE.slice(SORGENTE.indexOf("async function riportaDaPagare"));
    expect(pezzo.slice(0, 2500)).toContain("fattura_fic_id: null,");
  });
});

// IL GESTO. Il quadro vero, montato e premuto.
describe("il quadro «Associa una fattura»", () => {
  it("una fattura con una rata già coperta COMPARE, e dice quanto resta", async () => {
    const p = await monta(
      <ModaleAssociaFattura
        riga={{ id: "r2", descrizione: "Orthostetica 2 parte", importo: 910.04, spesaReale: RATA2 }}
        idSpese={["s-2"]}
        fatture={[F771]}
        spese={[RATA1, RATA2]}
        documenti={[DOC771]}
      />,
    );
    expect(p.testo()).toContain("771");
    expect(p.testo()).toContain("Gia' coperta");
    // quello che resta, non il totale: è la cifra che deve combaciare
    expect(p.testo()).toContain("910,04");
    // e il piano rate di Fatture in Cloud, che è la prova che è a rate
    expect(p.testo()).toContain("In 2 rate");
    await p.smonta();
  });

  it("una fattura coperta per intero NON compare: scegliendola la si porterebbe via", async () => {
    const p = await monta(
      <ModaleAssociaFattura
        riga={{ id: "r3", descrizione: "Altra uscita", importo: 100, spesaReale: { id: "s-3", totale: 100 } }}
        idSpese={["s-3"]}
        fatture={[F771]}
        spese={[RATA1, { ...RATA2, fattura_fic_id: "f-771" }]}
        documenti={[DOC771]}
      />,
    );
    expect(p.testo()).not.toContain("771");
    expect(p.testo()).toContain("coperte per intero");
    await p.smonta();
  });

  it("premendo scrive fattura_fic_id su TUTTE le spese della riga, e su nessun'altra", async () => {
    let scritta = null;
    rispondiCon({
      "/rest/v1/spese": (corpo, indirizzo) => {
        scritta = { corpo, indirizzo };
        return [{ id: "s-2", fattura_fic_id: "f-771" }, { id: "s-9", fattura_fic_id: "f-771" }];
      },
    });
    const p = await monta(
      <ModaleAssociaFattura
        riga={{ id: "gruppo_x", descrizione: "Un bonifico, due spese", importo: 910.04, speseGruppo: [RATA2, { id: "s-9", totale: 0 }] }}
        idSpese={["s-2", "s-9"]}
        fatture={[F771]}
        spese={[RATA1, RATA2]}
        documenti={[DOC771]}
      />,
    );
    await clicca(p.tasto("771"));
    expect(scritta).not.toBeNull();
    expect(scritta.corpo).toEqual({ fattura_fic_id: "f-771" });
    // le due spese della riga, per id: `in.("s-2","s-9")`
    expect(scritta.indirizzo).toContain("s-2");
    expect(scritta.indirizzo).toContain("s-9");
    await p.smonta();
  });

  it("zero righe scritte lo dice, invece di chiudere dicendo «fatto»", async () => {
    rispondiCon({ "/rest/v1/spese": () => [] });
    const p = await monta(
      <ModaleAssociaFattura
        riga={{ id: "r2", descrizione: "x", importo: 910.04, spesaReale: RATA2 }}
        idSpese={["s-2"]}
        fatture={[F771]}
        spese={[RATA1, RATA2]}
      />,
    );
    await clicca(p.tasto("771"));
    expect(p.testo()).toContain("non ha aggiornato nessuna riga");
    await p.smonta();
  });

  it("un'uscita più grande di quello che resta si segnala in rosso", async () => {
    const p = await monta(
      <ModaleAssociaFattura
        riga={{ id: "r9", descrizione: "Uscita grossa", importo: 1500, spesaReale: { id: "s-8", totale: 1500 } }}
        idSpese={["s-8"]}
        fatture={[F771]}
        spese={[RATA1]}
        documenti={[DOC771]}
      />,
    );
    expect(p.testo()).toContain("supera di");
    await p.smonta();
  });
});
