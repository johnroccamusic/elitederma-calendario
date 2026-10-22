// I DOCUMENTI ORGANIZZATIVI DI UN EVENTO.
//
// Certificazioni, regolamento della fiera, planimetrie, permessi,
// assicurazione. Oggi stanno nelle chat di chi li ha ricevuti, e
// servono proprio il giorno in cui qualcuno li chiede in loco — cioè il
// giorno in cui nessuno ha voglia di cercare in una conversazione di
// tre mesi fa.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { SchedaDocumenti } from "../src/eventi/GestioneEventi.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const DOC = {
  id: "d1", evento_id: "e1", nome: "Regolamento fiera 2026.pdf",
  percorso: "e1/1792-abc.pdf", tipo: "application/pdf", dimensione: 184320,
  caricato_il: "2026-10-22T10:04:00Z", caricato_da: "elena@elitederma.it",
};

async function apri(documenti = []) {
  const chiamate = [];
  rispondiCon({
    "eventi_documenti": (corpo, url) => { chiamate.push({ corpo, url }); return documenti; },
    "/storage/v1/object/sign/": { signedURL: "/object/sign/eventi-documenti/x?token=y" },
    "/auth/v1/user": { id: "u1", email: "elena@elitederma.it" },
  });
  const p = await monta(<SchedaDocumenti eventoId="e1" />);
  return { ...p, chiamate };
}

describe("i documenti di un evento", () => {
  it("senza documenti lo dice, e offre di caricarne", async () => {
    const p = await apri();
    expect(p.testo()).toMatch(/Nessun documento per questo evento/);
    expect(p.testo()).toMatch(/Aggiungi documenti/);
    expect(p.testo()).toMatch(/Certificazioni, regolamento della fiera/);
  });

  // IL TASTO È IL CAMPO, dentro una label: su iPhone un input nascosto
  // aperto con .click() funziona una volta sola, e chi entra in
  // fotocamera e torna indietro non riesce più ad allegare niente.
  // Stessa lezione del modulo di iscrizione.
  it("il tasto per caricare è davvero il campo file", async () => {
    const p = await apri();
    const etichetta = [...p.nodo.querySelectorAll("label")]
      .find((l) => (l.textContent || "").includes("Aggiungi documenti"));
    expect(etichetta).toBeTruthy();
    const campo = etichetta.querySelector('input[type="file"]');
    expect(campo).toBeTruthy();
    expect(campo.multiple).toBe(true);
  });

  it("un documento si legge col nome, il peso e chi l'ha messo", async () => {
    const p = await apri([DOC]);
    const nome = [...p.nodo.querySelectorAll("input")].map((i) => i.value);
    expect(nome).toContain("Regolamento fiera 2026.pdf");
    expect(p.testo()).toMatch(/180 KB/);
    expect(p.testo()).toMatch(/elena@elitederma\.it/);
  });

  // LA FINESTRA SI APRE DENTRO IL GESTO, vuota, e solo dopo si riempie:
  // su iPhone una window.open che arriva dopo un await viene bloccata,
  // e il documento non si apre senza che niente lo spieghi.
  it("si apre con un link a scadenza, non con un indirizzo pubblico", async () => {
    const aperte = [];
    const finta = { location: "", chiusa: false, close() { this.chiusa = true; } };
    window.open = (...a) => { aperte.push(a); return finta; };
    const p = await apri([DOC]);
    await clicca(p.tasto("Apri"));
    await attendi(80);
    // aperta subito e vuota
    expect(aperte).toHaveLength(1);
    expect(aperte[0][0]).toBe("");
    // e poi portata sul link FIRMATO, non su un indirizzo pubblico
    expect(finta.location).toContain("/object/sign/");
    expect(finta.location).not.toContain("/object/public/");
    expect(finta.chiusa).toBe(false);
  });

  it("se il link non si ottiene, la finestra si richiude e lo dice", async () => {
    const finta = { location: "", chiusa: false, close() { this.chiusa = true; } };
    window.open = () => finta;
    rispondiCon({
      "eventi_documenti": [DOC],
      "/storage/v1/object/sign/": { error: "oggetto non trovato" },
      "/auth/v1/user": { id: "u1", email: "elena@elitederma.it" },
    });
    const p = await monta(<SchedaDocumenti eventoId="e1" />);
    await clicca(p.tasto("Apri"));
    await attendi(120);
    expect(finta.chiusa).toBe(true);
    expect(p.testo()).toMatch(/Non riesco ad aprire/);
    // una scheda lasciata aperta su un vuoto è peggio di un errore detto
    expect(p.testo()).toMatch(/Regolamento fiera 2026/);
  });

  it("eliminare chiede conferma, e dice che il file sparisce davvero", async () => {
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await apri([DOC]);
    await clicca(p.nodo.querySelector('button[title="Elimina"]'));
    expect(domande[0]).toMatch(/Regolamento fiera 2026/);
    expect(domande[0]).toMatch(/cancellato, non solo tolto/);
    window.confirm = () => true;
  });
});
