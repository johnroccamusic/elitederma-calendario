// «COPIA» E «SCARICA» DELLE LOCANDINE, SU IPHONE (17/11/2026).
//
// Il titolare: «in Prezzi i tasti che dovrebbero copiare le locandine e
// scaricarle non funzionano e danno errore». I log dicevano che il file
// arrivava (200): l'errore nasceva dopo, nel telefono. Safari lascia
// aprire la condivisione e scrivere negli appunti solo per pochi istanti
// dopo il tocco, e noi prima scaricavamo due megabyte — arrivati alla
// condivisione il tocco era scaduto (NotAllowedError).
//
// Queste prove tengono ferma la cura: il file si mette da parte prima, e
// al tocco la condivisione parte SUBITO, nello stesso istante del tocco,
// senza nessuna attesa davanti. Si controlla proprio questo: che dopo il
// click, prima di lasciar girare qualunque promessa, la condivisione sia
// gia' stata chiesta.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { PaginaPrezziCorsi } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const LARGHEZZA = window.innerWidth;

function databaseConUnaLocandina() {
  rispondiCon({
    "/storage/v1/object/list/locandine-corsi": [
      { name: "tricopigmentazione.png", updated_at: "2026-09-03T18:13:35Z", metadata: { mimetype: "image/png", size: 2000 } },
    ],
    "/storage/v1/object/public/locandine-corsi/": () =>
      new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "Content-Type": "image/png" } }),
  });
}

describe("Prezzi corsi: copia e scarica partono dentro il tocco", () => {
  beforeEach(() => {
    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));
  });
  afterEach(() => {
    window.innerWidth = LARGHEZZA;
    delete navigator.share;
    delete navigator.canShare;
  });

  it("«Scarica» apre la condivisione nello stesso istante del tocco", async () => {
    databaseConUnaLocandina();
    const share = vi.fn(async () => {});
    navigator.share = share;
    navigator.canShare = () => true;
    const p = await monta(<PaginaPrezziCorsi ruoloUtente="user" onBack={() => {}} />);
    await attendi(120); // il file si mette da parte appena la pagina c'e'
    const tasto = p.nodo.querySelector('button[title="Scarica"]');
    expect(tasto).toBeTruthy();
    // nessun `await` qui: la condivisione deve essere gia' partita
    tasto.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files[0].name).toBe("tricopigmentazione.png");
    await act(async () => { await attendi(); });
    await p.smonta();
  });

  it("«Copia» scrive negli appunti nello stesso istante del tocco", async () => {
    databaseConUnaLocandina();
    const write = vi.fn(async () => {});
    const prima = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
    globalThis.ClipboardItem = globalThis.ClipboardItem || class { constructor(o) { this.o = o; } };
    const p = await monta(<PaginaPrezziCorsi ruoloUtente="user" onBack={() => {}} />);
    await attendi(120);
    const tasto = p.nodo.querySelector('button[title^="Copia"]');
    tasto.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => { await attendi(); });
    expect(p.testo()).toContain("Immagine copiata");
    await p.smonta();
    Object.defineProperty(navigator, "clipboard", { value: prima, configurable: true });
  });

  it("se il tocco scade mentre il file arriva, dice di toccare ancora invece di dare errore", async () => {
    databaseConUnaLocandina();
    // il file arriva solo quando lo diciamo noi: il tocco cade prima
    const base = globalThis.fetch;
    const inAttesa = [];
    globalThis.fetch = window.fetch = vi.fn((url, o) => String(url).includes("/object/public/")
      ? new Promise((ok) => inAttesa.push(() => ok(base(url, o))))
      : base(url, o));
    const avvisi = [];
    window.alert = (t) => avvisi.push(t);
    navigator.canShare = () => true;
    const errore = Object.assign(new Error("The request is not allowed by the user agent"), { name: "NotAllowedError" });
    navigator.share = vi.fn(async () => { throw errore; });
    const p = await monta(<PaginaPrezziCorsi ruoloUtente="user" onBack={() => {}} />);
    const tasto = p.nodo.querySelector('button[title="Scarica"]');
    await act(async () => { tasto.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(navigator.share).not.toHaveBeenCalled();
    await act(async () => { inAttesa.forEach((f) => f()); await attendi(120); });
    expect(navigator.share).toHaveBeenCalledTimes(1);
    expect(avvisi).toEqual([]);
    expect(p.testo()).toContain("tocca di nuovo");
    await p.smonta();
  });
});
