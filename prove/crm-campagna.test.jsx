// COMPONI MAIL E DISISCRIZIONE (Fase 4 del CRM, 30/10/2026): la campagna
// si scrive al primo gesto che ne ha bisogno, i destinatari li congela il
// database, l'invio richiama la funzione finche' la coda e' vuota, e il
// link in fondo alla mail disiscrive a un tocco.
import { describe, it, expect } from "vitest";
import React from "react";
import { act } from "react";
import ComponiMail, { fraseEsclusi, nomeProposto, ElencoCampagne } from "../src/crm/ComponiMail.jsx";
import PaginaDisiscrizione from "../src/crm/PaginaDisiscrizione.jsx";
import { componiCampagna, htmlInTesto } from "../supabase/functions/_shared/email.js";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

function scrivi(input, valore) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, valore);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

describe("componiCampagna", () => {
  it("riempie i segnaposti, protegge l'HTML e chiude con il piede fisso", () => {
    const m = componiCampagna({
      oggetto: "{nome}, novità a {comune}", corpoHtml: "<p>Ciao <b>{nome}</b></p>",
      valori: { nome: "Giulia <3", comune: "Roma" },
      societa: { nome: "ELITEDERMA Srl", indirizzo: "Via Terni 90/a, 00182 ROMA" },
      linkDisiscrizione: "https://app/?disiscrizione=abc",
    });
    expect(m.oggetto).toBe("Giulia <3, novità a Roma");
    expect(m.html).toContain("Ciao <b>Giulia &lt;3</b>");
    expect(m.html).toContain("Non voglio più ricevere queste mail");
    expect(m.html).toContain('href="https://app/?disiscrizione=abc"');
    expect(m.html).toContain("ELITEDERMA Srl");
    expect(m.testo).toContain("Ciao Giulia <3");
    expect(m.testo).toContain("Per non ricevere più queste mail: https://app/?disiscrizione=abc");
  });
  it("il testo semplice tiene i link e gli elenchi", () => {
    expect(htmlInTesto('<h2>Titolo</h2><ul><li>uno</li><li>due</li></ul><p>vai <a href="https://x.it">qui</a></p>')).toBe("Titolo\n• uno\n• due\nvai qui (https://x.it)");
  });
  it("le frasi di servizio", () => {
    expect(fraseEsclusi({ senza_email: 3, disiscritti: 1, doppioni_email: 2 })).toBe("Fuori: 3 senza email, 1 disiscritto, 2 con la stessa email di un altro.");
    expect(fraseEsclusi({})).toBe("Nessuno escluso.");
    expect(nomeProposto("Microblading · LAZIO")).toMatch(/^Microblading · LAZIO · \d{2}\/\d{2}\/\d{4}$/);
  });
});

describe("Componi mail", () => {
  it("prepara i destinatari creando la campagna dai filtri, poi spedisce a lotti finché la coda è vuota", async () => {
    const scritture = []; const rpc = []; const invii = [];
    let campagna = null;
    rispondiCon({
      "rest/v1/intestazione_societa": { nome: "ELITEDERMA Srl", indirizzo: "Via Terni 90/a, 00182 ROMA" },
      "rest/v1/crm_campagne?": (corpo, url) => {
        if (corpo && !campagna) { campagna = { id: "camp1", stato: "bozza", totale_destinatari: 0, inviate: 0, fallite: 0, ...corpo }; scritture.push({ tipo: "insert", corpo }); return campagna; }
        if (corpo) { campagna = { ...campagna, ...corpo }; scritture.push({ tipo: "update", corpo }); return campagna; }
        return campagna;
      },
      "rpc/crm_campagna_prepara": (corpo) => { rpc.push(corpo); campagna = { ...campagna, stato: "pronta", totale_destinatari: 230 }; return { inseriti: 230, contatti_filtrati: 240, senza_email: 7, disiscritti: 2, da_verificare: 1, rimbalzate_prima: 0, doppioni_email: 0 }; },
      "functions/v1/crm-campagna-invia": (corpo) => {
        invii.push(corpo);
        const restanti = Math.max(0, 230 - invii.length * 100);
        campagna = { ...campagna, stato: restanti ? "in_invio" : "inviata", inviate: 230 - restanti };
        return { ok: true, inviate: Math.min(100, 230 - (invii.length - 1) * 100), fallite: 0, restanti, stato: restanti ? "in_invio" : "inviata" };
      },
    });
    const p = await monta(<ComponiMail filtri={{ regione: "LAZIO", corso: "Microblading" }} riassunto="Microblading · LAZIO" totale={240} utente="Elena" onChiudi={() => {}} />);
    await attendi(150);
    expect(p.testo()).toContain("Destinatari dai filtri: Microblading · LAZIO");
    await act(async () => { scrivi(p.nodo.querySelector("[data-oggetto]"), "{nome}, a novembre Microblading a {comune}"); });
    // l'anteprima usa un nome di prova e la stessa funzione del server
    expect(p.nodo.querySelector("[data-anteprima-oggetto]").textContent).toBe("Giulia, a novembre Microblading a Roma");
    expect(p.nodo.querySelector("[data-anteprima]").innerHTML).toContain("Non voglio più ricevere queste mail");

    await clicca(p.tasto("Prepara i destinatari"));
    await attendi(200);
    expect(scritture[0].tipo).toBe("insert");
    expect(scritture[0].corpo).toMatchObject({ filtri: { regione: "LAZIO", corso: "Microblading" }, riassunto_filtri: "Microblading · LAZIO", creata_da: "Elena", oggetto: "{nome}, a novembre Microblading a {comune}" });
    expect(rpc[0]).toEqual({ p_campagna: "camp1" });
    expect(p.testo()).toContain("Destinatari pronti: 230. Fuori: 7 senza email, 2 disiscritti, 1 da verificare.");

    await clicca(p.tasto("Invia a 230"));
    await attendi(400);
    expect(invii.length).toBe(3);
    expect(invii[0]).toEqual({ campagna_id: "camp1", lotto: 100 });
    expect(p.testo()).toContain("Spedite 230 mail");
    await p.smonta();
  });

  it("l'elenco delle campagne mostra stato e conteggi", async () => {
    rispondiCon({
      "rest/v1/crm_campagne?": [{ id: "c1", nome: "Microblading · LAZIO · 30/10/2026", oggetto: "Ciao", stato: "inviata", totale_destinatari: 230, inviate: 228, fallite: 2, creata_il: "2026-10-30T10:00:00Z", creata_da: "Elena" }],
      "rest/v1/crm_campagne_destinatari": [{ campagna_id: "c1", stato: "consegnata" }, { campagna_id: "c1", stato: "aperta" }, { campagna_id: "c1", stato: "rimbalzata" }],
    });
    const p = await monta(<ElencoCampagne onApri={() => {}} onChiudi={() => {}} />);
    await attendi(200);
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("Microblading · LAZIO · 30/10/2026");
    expect(t).toContain("Inviata");
    expect(t).toContain("230 destinatari · 228 spedite · 2 consegnate · 1 aperte · 1 rimbalzate · 2 non riuscite");
    await p.smonta();
  });
});

describe("la pagina di disiscrizione", () => {
  it("disiscrive appena si apre e lo dice con il nome", async () => {
    const chiamate = [];
    rispondiCon({ "rpc/crm_disiscrivi": (corpo) => { chiamate.push(corpo); return { ok: true, gia: false, nome: "Giulia", email: "g…@esempio.it" }; } });
    const p = await monta(<PaginaDisiscrizione token="abcdefghijklmnopqrstuvwxyz0123456789" />);
    await attendi(150);
    expect(chiamate[0]).toEqual({ p_token: "abcdefghijklmnopqrstuvwxyz0123456789", p_come: "link" });
    expect(p.nodo.querySelector("[data-titolo]").textContent).toBe("Fatto");
    expect(p.nodo.querySelector("[data-testo]").textContent).toContain("Giulia, non riceverai più le nostre mail a g…@esempio.it");
    await p.smonta();
  });
  it("con un link sbagliato lo dice senza inventare", async () => {
    rispondiCon({ "rpc/crm_disiscrivi": { ok: false, errore: "link non valido" } });
    const p = await monta(<PaginaDisiscrizione token="x" />);
    await attendi(150);
    expect(p.nodo.querySelector("[data-titolo]").textContent).toBe("Questo link non funziona");
    await p.smonta();
  });
});

describe("i destinatari si scelgono anche dopo, e si cancellano", () => {
  it("«Cancella destinatari» svuota la coda e la campagna torna bozza", async () => {
    const cancellazioni = [];
    let campagna = { id: "c9", nome: "Prova", oggetto: "Ciao", corpo_html: "<p>x</p>", stato: "pronta", totale_destinatari: 22306, inviate: 0, fallite: 0, filtri: {} };
    rispondiCon({
      "rest/v1/intestazione_societa": { nome: "ELITEDERMA Srl" },
      "rest/v1/crm_campagne_destinatari": (corpo, url) => { cancellazioni.push(url); return []; },
      "rest/v1/crm_campagne?": (corpo) => { if (corpo) campagna = { ...campagna, ...corpo }; return campagna; },
    });
    const p = await monta(<ComponiMail campagnaIniziale={campagna} onChiudi={() => {}} onSelezionaDestinatari={() => {}} />);
    await attendi(200);
    expect(p.tasto("Cancella destinatari")).toBeTruthy();
    expect(p.tasto("Seleziona destinatari")).toBeTruthy();
    await clicca(p.tasto("Cancella destinatari"));
    await attendi(200);
    expect(cancellazioni.some((u) => u.includes("stato=eq.in_coda"))).toBe(true);
    expect(campagna.stato).toBe("bozza");
    expect(campagna.totale_destinatari).toBe(0);
    expect(p.testo()).toContain("Destinatari tolti");
    await p.smonta();
  });
});
