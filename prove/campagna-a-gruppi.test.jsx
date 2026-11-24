// SPEDIRE A GRUPPI SENZA MANDARE DOPPIONI. 24/11/2026.
//
// Il titolare, dopo che la prima campagna si e' fermata al tetto
// giornaliero di Resend con 200 mail partite su 5.291: «nella pagina di
// invio dovrebbe esserci un filtro extra che si chiama "escludi quelle
// gia' spedite", in modo che non mando doppioni se dovessi sospendere e
// riprendere». E: «un tasto salva campagna, che non e' bozza… un'area in
// cui ci sono le campagne in corso, anche se stoppate, dove posso
// rientrare e terminare la spedizione se voglio dividere il pubblico a
// gruppi».
//
// Due cose da tenere distinte, ed e' il senso di queste prove:
//   * dentro la STESSA campagna il doppione era gia' impossibile (la
//     ri-preparazione salta chi c'e' gia', il lotto prende solo le righe
//     in coda). La pagina adesso lo DICE, perche' la paura era quella;
//   * fra campagne diverse no, e li' serve la spunta — che scrive nei
//     filtri della campagna, perche' la regola vive in
//     `crm_campagna_prepara` e non nel browser.
import { describe, it, expect } from "vitest";
import React from "react";
import { act } from "react";
import ComponiMail, { fraseEsclusi, ElencoCampagne } from "../src/crm/ComponiMail.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// quella su cui si LAVORA: pronta, i destinatari congelati, niente ancora
// partito. Una campagna «in invio» e' bloccata apposta — il testo non si
// cambia dopo che duecento persone l'hanno ricevuto — e la prova in fondo
// a questo file lo inchioda.
const CAMPAGNA = {
  id: "c1", nome: "Campagna del 24/11/2026", oggetto: "{nome}, ci tenevamo ad aggiornarti",
  corpo_html: "<p>Ciao {nome}</p>", stato: "pronta", inviate: 0, fallite: 0,
  totale_destinatari: 5291, filtri: { trattato_da: "Katia" }, creata_il: "2026-11-24T11:48:07Z",
};
const IN_CORSO = { ...CAMPAGNA, stato: "in_invio", inviate: 200 };
// jsdom non ha sempre i separatori di migliaia: si guarda il numero, non il punto
const cifra = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/g, "$1\\.?"));

describe("il filtro «escludi quelle già spedite»", () => {
  it("la frase degli esclusi nomina chi ha già ricevuto un'altra campagna", () => {
    expect(fraseEsclusi({ gia_ricevute: 24 })).toBe("Fuori: 24 che hanno già ricevuto un'altra campagna.");
    expect(fraseEsclusi({ gia_ricevute: 0 })).toBe("Nessuno escluso.");
  });

  it("la spunta c'è, nasce SPENTA e dice che dentro questa campagna non serve", async () => {
    rispondiCon({ intestazione_societa: {}, crm_campagne_destinatari: [] });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    const riquadro = contenitore.querySelector("[data-escludi-gia-spedite]");
    expect(riquadro).toBeTruthy();
    expect(riquadro.querySelector("input").checked).toBe(false);
    expect(riquadro.textContent).toContain("Escludi quelle già spedite");
    // la risposta alla paura vera: sospendere e riprendere non duplica
    expect(riquadro.textContent).toContain("riprendendo l’invio non riceve due volte");
  });

  it("se la campagna la porta già accesa, la spunta è accesa", async () => {
    rispondiCon({ intestazione_societa: {}, crm_campagne_destinatari: [] });
    const { nodo: contenitore } = await monta(
      <ComponiMail campagnaIniziale={{ ...CAMPAGNA, filtri: { trattato_da: "Katia", escludi_gia_spedite: true } }} />,
    );
    expect(contenitore.querySelector("[data-escludi-gia-spedite] input").checked).toBe(true);
  });

  it("accesa, finisce nei FILTRI della campagna: è là che la legge il database", async () => {
    const scritture = [];
    rispondiCon({
      intestazione_societa: {},
      crm_campagne: (corpo, url) => {
        if (corpo) scritture.push({ corpo, url });
        return [{ ...CAMPAGNA, filtri: { ...CAMPAGNA.filtri, escludi_gia_spedite: true } }];
      },
      crm_campagna_prepara: { inseriti: 5067, gia_ricevute: 24, contatti_filtrati: 5291 },
      crm_campagne_destinatari: [],
    });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await clicca(contenitore.querySelector("[data-escludi-gia-spedite] input"));
    const tasti = [...contenitore.querySelectorAll("button")];
    await clicca(tasti.find((b) => /destinatari/i.test(b.textContent) && !/Cancella|Seleziona/i.test(b.textContent)));
    await attendi();
    const conFiltri = scritture.find((s) => s.corpo?.filtri);
    expect(conFiltri, "nessuna scrittura ha portato i filtri").toBeTruthy();
    expect(conFiltri.corpo.filtri.escludi_gia_spedite).toBe(true);
    // e i filtri di prima non si perdono per strada
    expect(conFiltri.corpo.filtri.trattato_da).toBe("Katia");
  });

  it("spenta, la chiave vale false e non resta scritta a metà", async () => {
    const scritture = [];
    rispondiCon({
      intestazione_societa: {},
      crm_campagne: (corpo) => { if (corpo) scritture.push(corpo); return [CAMPAGNA]; },
      crm_campagna_prepara: { inseriti: 5291 },
      crm_campagne_destinatari: [],
    });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    const tasti = [...contenitore.querySelectorAll("button")];
    await clicca(tasti.find((b) => /^Salva campagna$/i.test(b.textContent)));
    await attendi();
    const conFiltri = scritture.find((c) => c.filtri);
    expect(conFiltri.filtri.escludi_gia_spedite).toBe(false);
  });
});

describe("«Salva campagna», e l'area da cui si riprende", () => {
  it("il tasto non si chiama più «Salva bozza» e dice dove la si ritrova", async () => {
    rispondiCon({
      intestazione_societa: {},
      crm_campagne: (corpo) => (corpo ? [CAMPAGNA] : [CAMPAGNA]),
      crm_campagne_destinatari: [],
    });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    const testi = [...contenitore.querySelectorAll("button")].map((b) => b.textContent);
    expect(testi).toContain("Salva campagna");
    expect(testi.join(" ")).not.toContain("Salva bozza");
    await clicca([...contenitore.querySelectorAll("button")].find((b) => /^Salva campagna$/.test(b.textContent)));
    await attendi();
    expect(contenitore.textContent).toContain("La ritrovi in «Campagne»");
  });

  it("e dalla composizione si va alle Campagne con un tasto", async () => {
    let aperto = false;
    rispondiCon({ intestazione_societa: {}, crm_campagne_destinatari: [] });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={IN_CORSO} onApriCampagne={() => { aperto = true; }} />);
    const tasto = [...contenitore.querySelectorAll("button")].find((b) => b.textContent === "Campagne");
    expect(tasto, "il tasto per l'area delle campagne non c'è").toBeTruthy();
    await clicca(tasto);
    expect(aperto).toBe(true);
  });
});

describe("una campagna in invio non si riscrive", () => {
  it("niente spunta e niente «Salva campagna» a invio iniziato, ma si va alle Campagne e si riprende", async () => {
    rispondiCon({ intestazione_societa: {}, crm_campagne_destinatari: [] });
    const { nodo: contenitore } = await monta(<ComponiMail campagnaIniziale={IN_CORSO} onApriCampagne={() => {}} />);
    // duecento persone hanno gia' ricevuto QUESTO testo: cambiarlo adesso
    // vorrebbe dire due mail diverse spedite con lo stesso nome
    expect(contenitore.querySelector("[data-escludi-gia-spedite]")).toBeNull();
    const testi = [...contenitore.querySelectorAll("button")].map((b) => b.textContent);
    expect(testi).not.toContain("Salva campagna");
    expect(testi).toContain("Campagne");
    expect(testi.join(" ")).toContain("Riprendi l'invio");
  });
});

describe("l'elenco delle campagne", () => {
  const DUE = [
    { ...CAMPAGNA, id: "c1" },
    { id: "c2", nome: "Campagna di ottobre", oggetto: "Bologna", stato: "inviata", inviate: 120, fallite: 0, totale_destinatari: 120, creata_il: "2026-10-30T20:23:23Z" },
  ];
  const RIEPILOGO = [
    { campagna_id: "c1", in_coda: 5091, in_spedizione: 0, inviate: 157, consegnate: 40, aperte: 0, rimbalzate: 3, segnalate: 0, fallite: 0, destinatari: 5291 },
    { campagna_id: "c2", in_coda: 0, in_spedizione: 0, inviate: 10, consegnate: 100, aperte: 10, rimbalzate: 0, segnalate: 0, fallite: 0, destinatari: 120 },
  ];

  it("mette in cima quelle DA FINIRE, con quante mail restano in coda", async () => {
    rispondiCon({ crm_campagne_riepilogo: RIEPILOGO, crm_campagne: DUE });
    const { nodo: contenitore } = await monta(<ElencoCampagne onApri={() => {}} onChiudi={() => {}} />);
    await attendi();
    const banda = contenitore.querySelector("[data-da-finire]");
    expect(banda, "la banda «Da finire» non c'è").toBeTruthy();
    expect(banda.textContent).toContain("una campagna");
    expect(banda.textContent).toMatch(cifra(5091));
    // la campagna da finire viene PRIMA di quella chiusa
    const ordine = [...contenitore.querySelectorAll("[data-campagna]")].map((n) => n.getAttribute("data-campagna"));
    expect(ordine).toEqual(["c1", "c2"]);
    expect(contenitore.querySelector('[data-campagna="c1"]').textContent).toContain("Riprendi");
    expect(contenitore.querySelector('[data-campagna="c2"]').textContent).not.toContain("Riprendi");
  });

  it("i numeri vengono dal RIEPILOGO del database, non dalle righe (PostgREST ne serve mille)", async () => {
    const chiamate = [];
    rispondiCon({
      crm_campagne_riepilogo: (corpo, url) => { chiamate.push(url); return RIEPILOGO; },
      crm_campagne_destinatari: (corpo, url) => { chiamate.push(url); return []; },
      crm_campagne: DUE,
    });
    const { nodo: contenitore } = await monta(<ElencoCampagne onApri={() => {}} onChiudi={() => {}} />);
    await attendi();
    expect(chiamate.some((u) => u.includes("crm_campagne_riepilogo"))).toBe(true);
    expect(chiamate.some((u) => u.includes("crm_campagne_destinatari"))).toBe(false);
    expect(contenitore.querySelector('[data-campagna="c1"]').textContent).toMatch(/5\.?091 ancora in coda/);
    expect(contenitore.querySelector('[data-campagna="c2"]').textContent).toContain("110 consegnate");
  });

  it("premere una riga apre quella campagna", async () => {
    let apertaId = null;
    rispondiCon({ crm_campagne_riepilogo: RIEPILOGO, crm_campagne: DUE });
    const { nodo: contenitore } = await monta(<ElencoCampagne onApri={(c) => { apertaId = c.id; }} onChiudi={() => {}} />);
    await attendi();
    await clicca(contenitore.querySelector('[data-campagna="c1"]'));
    expect(apertaId).toBe("c1");
  });
});

describe("la guardia: la regola di chi entra fra i destinatari sta in SQL", () => {
  it("la migrazione esclude chi ha già ricevuto, e solo da ALTRE campagne", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.resolve(__dirname, "../supabase/migrations/20261124140000_campagne_escludi_gia_spedite_e_riepilogo.sql");
    const sql = fs.readFileSync(file, "utf8");
    expect(sql).toContain("escludi_gia_spedite");
    expect(sql).toContain("d.campagna_id <> p_campagna");
    // «fallita» NON conta come spedita: quella mail non e' arrivata
    const blocco = sql.slice(sql.indexOf("escludi_gia_spedite:"), sql.indexOf("delete from _cand x using"));
    expect(blocco).toContain("'inviata', 'consegnata', 'aperta'");
    expect(blocco).not.toContain("'fallita'");
  });

  it("e il browser non rifà quel conto per conto suo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sorgente = fs.readFileSync(path.resolve(__dirname, "../src/crm/ComponiMail.jsx"), "utf8");
    // la spunta scrive una chiave nei filtri: non filtra i destinatari qui
    expect(sorgente).toContain("escludi_gia_spedite: escludiGiaSpedite");
    expect(sorgente).not.toContain('select("campagna_id, stato")');   // la lettura che contava mille righe su 58.000
  });
});
