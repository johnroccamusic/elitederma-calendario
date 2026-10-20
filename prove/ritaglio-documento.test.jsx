// IL DOCUMENTO SI GUARDA PRIMA DI MANDARLO.
//
// Due regole, e tutte e due nate da come si sbaglia davvero.
//
// IL FORMATO SI LEGGE DAI PRIMI BYTE, non dal nome: su iPhone un HEIC
// rinominato `.jpg` arriva lo stesso, e l'`accept` dell'input non e' una
// garanzia — e' un suggerimento al selettore dei file.
//
// E QUELLO CHE NON SI ACCETTA SI DICE, col rimedio accanto. Scartare in
// silenzio e' il modo migliore per ricevere moduli senza documento
// senza che nessuno se ne accorga: e' gia' successo lato server, dove
// almeno gli scarti restavano scritti.
import { describe, it, expect } from "vitest";
import { tipoVero, perchePuoiNonMandarlo, FORMATI } from "../src/iscrizione/RitaglioFoto.jsx";

// un file finto fatto dei suoi primi byte veri
const con = (byte, nome) => new File([new Uint8Array([...byte, ...Array(32).fill(0)])], nome);
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const HEIC = [0, 0, 0, 0x20, ...[..."ftypheic"].map((c) => c.charCodeAt(0))];

describe("che file è", () => {
  it("riconosce JPG e PNG, e si fida dei byte non del nome", async () => {
    expect(await tipoVero(con(JPEG, "documento.pdf"))).toBe("image/jpeg");
    expect(await tipoVero(con(PNG, "senza-estensione"))).toBe("image/png");
  });

  it("un PDF resta un PDF anche se si chiama .jpg", async () => {
    expect(await tipoVero(con(PDF, "carta-identita.jpg"))).toBe("application/pdf");
  });

  it("e riconosce l'HEIC dell'iPhone, che è il caso che sfugge", async () => {
    expect(await tipoVero(con(HEIC, "IMG_0042.jpg"))).toBe("image/heic");
  });

  it("solo JPG e PNG passano", () => {
    expect(FORMATI).toEqual(["image/jpeg", "image/png"]);
    expect(FORMATI).not.toContain("application/pdf");
  });
});

describe("quando non si può mandare", () => {
  it("di un PDF dice che è un PDF e cosa fare", () => {
    const testo = perchePuoiNonMandarlo("application/pdf");
    expect(testo).toMatch(/PDF/);
    expect(testo).toMatch(/foto|immagine/i);
  });

  it("di un HEIC dice il nome del formato e dove si cambia", () => {
    const testo = perchePuoiNonMandarlo("image/heic");
    expect(testo).toMatch(/HEIC/);
    expect(testo).toMatch(/compatibilità/i);
  });

  it("e di qualunque altra cosa non lascia senza risposta", () => {
    expect(perchePuoiNonMandarlo("ignoto")).toMatch(/JPG|PNG/);
  });
});

// ---------------------------------------------------------------------
// E IL GESTO: si tira un angolo e il riquadro si stringe.
import React from "react";
import RitaglioFoto from "../src/iscrizione/RitaglioFoto.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { act } from "react";

const FOTO = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], "doc.jpg", { type: "image/jpeg" });

function preparaBrowser(nodo) {
  // jsdom non impagina: il riquadro misurerebbe zero e ogni trascinamento
  // finirebbe nello stesso punto
  const r = nodo.querySelector("div[style*='position: relative']");
  r.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 });
  return r;
}

async function trascina(x, y) {
  await act(async () => {
    window.dispatchEvent(new window.MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
  });
  await act(async () => { window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true })); });
}

describe("il ritaglio", () => {
  it("si apre su tutta la foto e ha i quattro angoli", async () => {
    window.URL.createObjectURL = () => "blob:finto";
    window.URL.revokeObjectURL = () => {};
    const p = await monta(<RitaglioFoto file={FOTO} etichetta="Fronte" onConferma={() => {}} onAnnulla={() => {}} />);
    for (const angolo of ["nw", "ne", "sw", "se"]) {
      expect(p.nodo.querySelector(`[data-maniglia="${angolo}"]`)).toBeTruthy();
    }
    expect(p.testo()).toMatch(/Tira gli angoli/);
  });

  it("tirando l'angolo in basso a destra il riquadro si stringe", async () => {
    window.URL.createObjectURL = () => "blob:finto";
    window.URL.revokeObjectURL = () => {};
    const p = await monta(<RitaglioFoto file={FOTO} etichetta="Fronte" onConferma={() => {}} onAnnulla={() => {}} />);
    preparaBrowser(p.nodo);
    const se = p.nodo.querySelector('[data-maniglia="se"]');
    await act(async () => { se.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); });
    await trascina(200, 150); // a metà del riquadro
    const cornice = [...p.nodo.querySelectorAll("div")].find((d) => (d.style.border || "").includes("solid"));
    expect(cornice.style.width).toBe("50%");
    expect(cornice.style.height).toBe("50%");
  });

  it("e non si può ridurre a niente", async () => {
    window.URL.createObjectURL = () => "blob:finto";
    window.URL.revokeObjectURL = () => {};
    const p = await monta(<RitaglioFoto file={FOTO} etichetta="Fronte" onConferma={() => {}} onAnnulla={() => {}} />);
    preparaBrowser(p.nodo);
    const se = p.nodo.querySelector('[data-maniglia="se"]');
    await act(async () => { se.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); });
    await trascina(0, 0);
    const cornice = [...p.nodo.querySelectorAll("div")].find((d) => (d.style.border || "").includes("solid"));
    expect(parseFloat(cornice.style.width)).toBeGreaterThanOrEqual(5);
  });

  it("se la tela non sa ritagliare, la foto parte comunque", async () => {
    // jsdom non disegna: `toBlob` torna niente. Chi compila non deve
    // restare bloccato per un difetto del browser — meglio la foto
    // intera che nessuna foto.
    window.URL.createObjectURL = () => "blob:finto";
    window.URL.revokeObjectURL = () => {};
    let mandata = null;
    const p = await monta(<RitaglioFoto file={FOTO} etichetta="Fronte" onConferma={(f) => { mandata = f; }} onAnnulla={() => {}} />);
    await clicca(p.tasto("Va bene così"));
    await attendi(60);
    expect(mandata).toBe(FOTO);
  });
});
