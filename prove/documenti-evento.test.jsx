// I DOCUMENTI ORGANIZZATIVI DI UN EVENTO: schede chiuse, come Stampe
// packaging. Si preme «Aggiungi documento», si scrive cos'è, e dentro la
// scheda si carica il file e si scrivono le note. Chiuse si leggono tutte
// in un colpo; si apre quella che serve.
import { describe, it, expect } from "vitest";
import React from "react";
import { SchedaDocumenti } from "../src/eventi/GestioneEventi.jsx";
import { monta, clicca, attendi, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CON_FILE = {
  id: "d1", evento_id: "e1", nome: "Regolamento fiera 2026", note: "da mostrare all'ingresso",
  percorso: "e1/1792-abc.pdf", nome_file: "regolamento.pdf", tipo: "application/pdf", dimensione: 184320,
  caricato_il: "2026-10-22T10:04:00Z", caricato_da: "elena@elitederma.it",
};
const SENZA_FILE = { id: "d2", evento_id: "e1", nome: "Assicurazione", note: null, percorso: null, dimensione: null, caricato_il: "2026-10-22T10:05:00Z" };

// LA FINTA RICORDA QUELLO CHE SALVA: dopo un salvataggio la scheda
// rilegge l'elenco, e se rispondesse sempre con le righe di partenza la
// nota appena scritta sparirebbe
async function apri(iniziali = []) {
  let docs = iniziali.map((d) => ({ ...d }));
  const scritte = [];
  rispondiCon({
    "/storage/v1/object/sign/": { signedURL: "/object/sign/eventi-documenti/x?token=y" },
    "/storage/v1/object/eventi-documenti/": {},
    "/auth/v1/user": { id: "u1", email: "elena@elitederma.it" },
    "eventi_documenti": (corpo, url) => {
      const u = String(url);
      // `.select().single()` vuole UN oggetto: risposto con un array,
      // l'id della riga nuova arriva vuoto e la scheda non si apre
      if (corpo && !u.includes("?id=")) { const nuovo = { id: "nuovo", percorso: null, note: null, ...corpo }; docs = [...docs, nuovo]; scritte.push({ tipo: "insert", corpo }); return nuovo; }
      if (corpo) { const id = (u.match(/id=eq\.([^&]+)/) || [])[1]; docs = docs.map((d) => (d.id === id ? { ...d, ...corpo } : d)); scritte.push({ tipo: "update", id, corpo }); return { id, ...corpo }; }
      if (u.includes("?id=")) { const id = (u.match(/id=eq\.([^&]+)/) || [])[1]; docs = docs.filter((d) => d.id !== id); scritte.push({ tipo: "delete", id }); return []; }
      return docs;
    },
  });
  const p = await monta(<SchedaDocumenti eventoId="e1" />);
  return { ...p, scritte };
}
const titoli = (p) => [...p.nodo.querySelectorAll("[data-documento]")].map((d) => d.textContent.trim().slice(0, 40));
const intestazione = (p, id) => p.nodo.querySelector(`[data-documento="${id}"] > div`);
const esci = (campo) => campo.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));

describe("le schede dei documenti", () => {
  it("nascono chiuse: solo il titolo, e se manca il file lo dice", async () => {
    const p = await apri([CON_FILE, SENZA_FILE]);
    expect(titoli(p)).toHaveLength(2);
    expect(p.testo()).toMatch(/Regolamento fiera 2026/);
    expect(p.testo()).toMatch(/180 KB · nota/);
    expect(p.testo()).toMatch(/Assicurazione/);
    expect(p.testo()).toMatch(/senza file/);
    // chiusa: niente campi dentro
    expect(p.nodo.querySelector('[data-campo="titolo-d1"]')).toBe(null);
  });

  it("aperta, dentro ci sono titolo, file, note ed elimina", async () => {
    const p = await apri([CON_FILE]);
    await clicca(intestazione(p, "d1"));
    expect(p.nodo.querySelector('[data-campo="titolo-d1"]').value).toBe("Regolamento fiera 2026");
    expect(p.nodo.querySelector('[data-campo="note-d1"]').value).toBe("da mostrare all'ingresso");
    expect(p.tasto("Apri")).toBeTruthy();
    expect(p.testo()).toMatch(/Sostituisci/);
    expect(p.tasto("Elimina")).toBeTruthy();
  });

  it("«Aggiungi documento» crea la scheda e la apre col titolo da scrivere", async () => {
    const p = await apri();
    await clicca(p.tasto("Aggiungi documento"));
    await attendi(400);
    expect(p.scritte[0].tipo).toBe("insert");
    expect(p.nodo.querySelector('[data-campo="titolo-nuovo"]')).toBeTruthy();
    expect(p.testo()).toMatch(/Carica file/);
  });

  it("il titolo e le note si scrivono dentro e si salvano uscendo dal campo", async () => {
    const p = await apri([SENZA_FILE]);
    await clicca(intestazione(p, "d2"));
    const titolo = p.nodo.querySelector('[data-campo="titolo-d2"]');
    await scrivi(titolo, "Assicurazione RC fiera"); esci(titolo); await attendi(100);
    expect(p.scritte.at(-1)).toMatchObject({ tipo: "update", id: "d2", corpo: { nome: "Assicurazione RC fiera" } });
    const note = p.nodo.querySelector('[data-campo="note-d2"]');
    await scrivi(note, "scade a marzo"); esci(note); await attendi(100);
    expect(p.scritte.at(-1)).toMatchObject({ tipo: "update", id: "d2", corpo: { note: "scade a marzo" } });
    // una nota svuotata diventa niente, non una riga di spazi
    await scrivi(note, "   "); esci(note); await attendi(100);
    expect(p.scritte.at(-1)).toMatchObject({ tipo: "update", id: "d2", corpo: { note: null } });
  });

  it("il file si carica dentro la scheda e prende il titolo già scritto", async () => {
    const p = await apri([SENZA_FILE]);
    await clicca(intestazione(p, "d2"));
    const input = p.nodo.querySelector(`[data-documento="d2"] input[type="file"]`);
    Object.defineProperty(input, "files", { value: [new File(["x"], "polizza.pdf", { type: "application/pdf" })], configurable: true });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await attendi(150);
    const agg = p.scritte.find((s) => s.tipo === "update" && s.corpo.percorso);
    expect(agg.corpo.nome_file).toBe("polizza.pdf");
    expect(agg.corpo.nome).toBeUndefined(); // il titolo c'era gia': non si tocca
  });

  it("eliminare chiede conferma e dice che il file sparisce davvero", async () => {
    const domande = [];
    window.confirm = (t) => { domande.push(t); return false; };
    const p = await apri([CON_FILE]);
    await clicca(intestazione(p, "d1"));
    await clicca(p.tasto("Elimina"));
    expect(domande[0]).toMatch(/Regolamento fiera 2026/);
    expect(domande[0]).toMatch(/cancellato, non solo tolto/);
    expect(p.scritte.some((s) => s.tipo === "delete")).toBe(false);
    window.confirm = () => true;
  });

  it("si apre con un link a scadenza, e la finestra si apre dentro il gesto", async () => {
    const finta = { location: "", chiusa: false, close() { this.chiusa = true; } };
    const aperte = [];
    window.open = (...a) => { aperte.push(a); return finta; };
    const p = await apri([CON_FILE]);
    await clicca(intestazione(p, "d1"));
    await clicca(p.tasto("Apri")); await attendi(80);
    expect(aperte[0][0]).toBe("");
    expect(finta.location).toContain("/object/sign/");
    expect(finta.chiusa).toBe(false);
  });
});
