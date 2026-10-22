// RIAPRIRE UN MODULO GIÀ ARRIVATO.
//
// Il link vale una volta sola: appena il modulo torna, non si riapre.
// Serve — una seconda spedizione sovrascriveva firma e documenti
// lasciando il contratto della prima — ma capita che manchi qualcosa e
// il modulo vada rifatto, e fino al 22/10/2026 non c'era modo.
//
// Qui si prova il gesto: si apre il fascicolo, si scrive perché, si
// preme, e si guarda cosa parte verso il database.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import Fascicolo from "../src/iscrizioni/Fascicolo.jsx";
import { monta, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const ISCRITTA = {
  id: "i1", nome: "BRENDA", cognome: "SIERRA",
  token_modulo: "QHZGNE1G2E824D30",
  modulo_pdf_path: "QHZGNE1G2E824D30/modulo.pdf",
  modulo_pdf_generato_il: "2026-10-20T16:30:00Z",
};

async function apri({ iscritto = ISCRITTA, riaperture = [], esito = { ok: true } } = {}) {
  const chiamate = [];
  rispondiCon({
    "rpc/modulo_riapri": (corpo) => { chiamate.push(corpo); return esito; },
    "moduli_riaperture": riaperture,
    "email_inviate": [],
    // il link firmato del PDF
    "/storage/": { signedUrl: "https://esempio/x.pdf" },
  });
  const p = await monta(<Fascicolo iscritto={iscritto} chi="TOMMASO GIUMBINI" />);
  return { ...p, chiamate };
}

describe("riaprire il modulo", () => {
  it("il tasto c'è, e dice cosa comporta", async () => {
    const p = await apri();
    expect(p.tasto("Riapri il modulo")).toBeTruthy();
    expect(p.testo()).toMatch(/torna a funzionare/);
    expect(p.testo()).toMatch(/non riparte da sola/);
    expect(p.testo()).toMatch(/non si cancella/);
  });

  it("premendo, parte la riapertura col motivo e con chi l'ha fatta", async () => {
    const p = await apri();
    const campo = p.nodo.querySelector('input[placeholder^="Perché"]');
    await scrivi(campo, "Mancava il retro del documento");
    await clicca(p.tasto("Riapri il modulo"));
    expect(p.chiamate).toHaveLength(1);
    expect(p.chiamate[0]).toMatchObject({
      p_iscritto_id: "i1",
      p_motivo: "Mancava il retro del documento",
      p_chi: "TOMMASO GIUMBINI",
    });
    expect(p.testo()).toMatch(/il link si riapre/);
  });

  it("senza motivo si riapre lo stesso, e il motivo resta vuoto", async () => {
    const p = await apri();
    await clicca(p.tasto("Riapri il modulo"));
    expect(p.chiamate[0].p_motivo).toBe(null);
  });

  // PRIMA SI METTE AL SICURO QUELLO CHE C'E'. Riaprire senza la copia
  // firmata vorrebbe dire restare senza nessuna delle due: quella di
  // prima non è stata generata, e quella nuova non è ancora arrivata.
  it("senza la copia firmata il tasto è spento, e dice perché", async () => {
    const p = await apri({ iscritto: { ...ISCRITTA, modulo_pdf_path: null } });
    expect(p.tasto("Riapri il modulo").disabled).toBe(true);
    expect(p.testo()).toMatch(/Prima genera la copia firmata/);
  });

  it("un rifiuto del database si legge, invece di sembrare riuscito", async () => {
    const p = await apri({ esito: { ok: false, errore: "Questo modulo non è ancora arrivato: il link è già aperto." } });
    await clicca(p.tasto("Riapri il modulo"));
    expect(p.testo()).toMatch(/il link è già aperto/);
    expect(p.testo()).not.toMatch(/il link si riapre/);
  });

  it("le riaperture già fatte restano scritte", async () => {
    const p = await apri({ riaperture: [{
      id: "r1", riaperto_il: "2026-10-22T09:40:00Z", riaperto_da: "ELENA",
      motivo: "Documento illeggibile", modulo_ricevuto_il: "2026-10-20T16:30:00Z",
    }] });
    expect(p.testo()).toMatch(/Già riaperto/);
    expect(p.testo()).toMatch(/ELENA/);
    expect(p.testo()).toMatch(/Documento illeggibile/);
  });

  // e non si riapre per sbaglio: la domanda si può rifiutare
  it("rifiutando la conferma non parte niente", async () => {
    window.confirm = () => false;
    const p = await apri();
    await clicca(p.tasto("Riapri il modulo"));
    expect(p.chiamate).toHaveLength(0);
    window.confirm = () => true;
  });
});
