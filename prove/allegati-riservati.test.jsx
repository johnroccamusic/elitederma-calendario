// GLI ALLEGATI RISERVATI SI APRONO CON UN LINK A SCADENZA (31/10/2026).
// I secchi con moduli cartacei, bonifici, biglietti, fatture e documenti non
// hanno piu' un indirizzo pubblico: l'app chiede un link che vale un'ora
// quando si preme, e la finestra si apre subito, dentro il gesto.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { AllegatoLink } from "../src/App.jsx";
import { percorsoDaValore, urlAllegato, BUCKET_RISERVATI } from "../src/file/allegati.js";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

describe("percorsoDaValore", () => {
  it("lascia stare un percorso e ricava il percorso da un URL pubblico intero (le spese)", () => {
    expect(percorsoDaValore("spese-allegati", "2026/fattura 1.pdf")).toBe("2026/fattura 1.pdf");
    expect(percorsoDaValore("spese-allegati", "https://x.supabase.co/storage/v1/object/public/spese-allegati/123-fattura%20uno.pdf"))
      .toBe("123-fattura uno.pdf");
  });
  it("i secchi con dati riservati sono quelli giusti", () => {
    ["allegati-iscritti", "spese-allegati", "master-documenti", "venditori-documenti", "leve-assistenti-documenti"]
      .forEach((b) => expect(BUCKET_RISERVATI.has(b)).toBe(true));
    ["loghi-immagini", "diploma-templates", "shop-immagini"].forEach((b) => expect(BUCKET_RISERVATI.has(b)).toBe(false));
  });
});

describe("AllegatoLink", () => {
  let finestra;
  beforeEach(() => {
    finestra = { location: { href: "" }, close: vi.fn(), opener: {} };
    window.open = vi.fn(() => finestra);
  });

  it("su un secchio riservato chiede un link firmato e lo apre nella finestra gia' aperta", async () => {
    const chiamate = [];
    rispondiCon({
      "storage/v1/object/sign/allegati-iscritti": (corpo, url) => { chiamate.push(url); return { signedURL: "/object/sign/allegati-iscritti/cart/modulo.pdf?token=abc" }; },
    });
    const p = await monta(<AllegatoLink percorso="cart/modulo.pdf" etichetta="apri il file" />);
    const a = p.nodo.querySelector("a");
    // niente indirizzo pubblico nel disegno
    expect(a.getAttribute("href")).not.toContain("/object/public/");
    await clicca(a); await attendi(100);
    expect(window.open).toHaveBeenCalledWith("", "_blank");   // aperta subito, dentro il gesto
    expect(chiamate.length).toBe(1);
    expect(chiamate[0]).toContain("/object/sign/allegati-iscritti/cart/modulo.pdf");
    expect(finestra.location.href).toContain("token=abc");
    await p.smonta();
  });

  it("se il link non si ottiene, chiude la finestra e lo dice", async () => {
    window.alert = vi.fn();
    rispondiCon({ "storage/v1/object/sign/allegati-iscritti": { signedURL: null, error: "Object not found" } });
    const p = await monta(<AllegatoLink percorso="manca.pdf" etichetta="apri" />);
    await clicca(p.nodo.querySelector("a")); await attendi(100);
    expect(finestra.close).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalled();
    await p.smonta();
  });

  it("su un secchio pubblico (diploma-templates) non chiede niente alla rete", async () => {
    const f = rispondiCon({});
    const url = await urlAllegato("diploma-templates", "modello.pdf");
    expect(url).toContain("/object/public/diploma-templates/modello.pdf");
    expect(f).not.toHaveBeenCalled();
  });
});
