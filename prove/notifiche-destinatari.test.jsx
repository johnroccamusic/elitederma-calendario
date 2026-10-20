// A CHI VA LA NOTIFICA.
//
// La casella d'invio sapeva indirizzare solo le master: l'uuid andava
// dritto in `masterId`. Con i venditori in mezzo un uuid non dice piu'
// di chi e', e sbagliarlo non da' errore — la notifica non arriva a
// nessuno, in silenzio. Qui si guarda cosa parte davvero.
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import PaginaNotifichePush from "../src/notifiche/PaginaNotifichePush.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, scegli, scrivi, clicca, voci } from "./aiuto.js";

const MASTER = [{ id: "11111111-1111-1111-1111-111111111111", nome: "MASTER UNO" }];
const VENDITORI = [
  { id: "22222222-2222-2222-2222-222222222222", nome: "KATIA" },
  { id: "33333333-3333-3333-3333-333333333333", nome: "OLGA" },
];
// un telefono per la master e uno per Katia; Olga non ne ha
const RIGHE = [
  { id: "r1", endpoint: "https://x/1", attiva: true, master_id: MASTER[0].id, venditore_id: null, dispositivo: "iPhone", creato_il: "2026-10-19T10:00:00Z" },
  { id: "r2", endpoint: "https://x/2", attiva: true, master_id: null, venditore_id: VENDITORI[0].id, dispositivo: "Android", creato_il: "2026-10-20T10:00:00Z" },
];

function apri() {
  const visto = { corpo: null };
  rispondiCon({
    "/rest/v1/push_iscrizioni": RIGHE,
    "/functions/v1/invia-notifica-push": (corpo) => { visto.corpo = corpo; return { ok: true, inviate: 1, spente: 0 }; },
  });
  return monta(<PaginaNotifichePush master={MASTER} venditori={VENDITORI} />).then((p) => ({ p, visto }));
}

beforeEach(() => { window.confirm = vi.fn(() => true); });

async function mandaA(p, valore) {
  const tendina = p.nodo.querySelector("select");
  await scegli(tendina, valore);
  await scrivi(p.nodo.querySelector("textarea"), "Riunione lunedì alle 9");
  await clicca(p.tasto("Manda"));
}

describe("a chi va la notifica", () => {
  it("fra i destinatari ci sono i venditori, e il gruppo intero", async () => {
    const { p } = await apri();
    const opzioni = voci(p.nodo.querySelector("select"));
    expect(opzioni).toContain("g:venditori");
    expect(opzioni).toContain(`v:${VENDITORI[0].id}`);
    expect(opzioni).toContain(`m:${MASTER[0].id}`);
    // Olga non ha un telefono iscritto: non si puo' scegliere, o si
    // manderebbe a nessuno credendo di averla avvisata
    expect(opzioni).not.toContain(`v:${VENDITORI[1].id}`);
  });

  it("«tutti i venditori» manda al gruppo, non a tutti i dispositivi", async () => {
    const { p, visto } = await apri();
    await mandaA(p, "g:venditori");
    expect(visto.corpo.gruppo).toBe("venditori");
    expect(visto.corpo.tutte).toBeUndefined();
    expect(visto.corpo.masterId).toBeUndefined();
  });

  it("un venditore solo arriva come venditoreId", async () => {
    const { p, visto } = await apri();
    await mandaA(p, `v:${VENDITORI[0].id}`);
    expect(visto.corpo.venditoreId).toBe(VENDITORI[0].id);
    expect(visto.corpo.masterId).toBeUndefined();
  });

  it("una master sola resta masterId", async () => {
    const { p, visto } = await apri();
    await mandaA(p, `m:${MASTER[0].id}`);
    expect(visto.corpo.masterId).toBe(MASTER[0].id);
    expect(visto.corpo.venditoreId).toBeUndefined();
  });

  it("senza scegliere niente va a tutti", async () => {
    const { p, visto } = await apri();
    await mandaA(p, "");
    expect(visto.corpo.tutte).toBe(true);
  });

  it("la conferma dice il nome giusto, non «undefined»", async () => {
    const { p } = await apri();
    await mandaA(p, `v:${VENDITORI[0].id}`);
    expect(window.confirm.mock.calls[0][0]).toContain("KATIA");
  });
});
