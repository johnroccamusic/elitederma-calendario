// IL BANCO, QUANDO LA MASTER VENDE A UN'ALLIEVA DEL CORSO.
//
// Questo e' il primo banco di prova che apre il POS: era il componente
// piu' grande che nessuna prova avesse mai montato, e il banco e' il
// posto dove si sbagliano i soldi.
//
// Il gesto provato e' quello vero: si scegle il corso, si scegle
// l'allieva dalla barra, e l'indirizzo deve comparire da se'.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, scegli } from "./aiuto.js";

const oggi = new Date().toISOString().slice(0, 10);
const CORSO = { id: "co1", nome: "PMU BASE" };
const CORSO_DATA = {
  id: "cd1", corso_id: "co1", location_id: null, master_id: null,
  data_inizio: oggi, data_fine: oggi, citta: "ROMA",
};
const ALLIEVA = {
  id: "is1", corso_data_id: "cd1", nome: "MARIO", cognome: "DEZZI",
  indirizzo_residenza: "VIA CARLO SEVERINI", civico_residenza: "46",
  cap_residenza: "00163", citta_residenza: "ROMA", prov_residenza: "RM",
  telefono: "3331234567", richiede_fattura: false,
};
// un'allieva con la scheda a meta': serve a provare che il buco si dica
const INCOMPLETA = {
  id: "is2", corso_data_id: "cd1", nome: "LARA", cognome: "COSTANTINO",
  indirizzo_residenza: "VIA ROMA", citta_residenza: "BARI",
  cap_residenza: null, prov_residenza: null, telefono: null,
};

async function apriBanco() {
  rispondiCon({});
  return monta(
    <PaginaPOS
      prodottiShop={[]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[CORSO_DATA]} corsi={[CORSO]} location={[]}
      iscritti={[ALLIEVA, INCOMPLETA]} coupon={[]} bundleComponenti={[]} master={[]}
      ricarica={() => {}} onBack={() => {}} utenteLoggato={null} venditoreLoggato={null}
      targetVenditeProdotti={[]} ruoloUtente="admin"
    />,
  );
}
const campo = (p, chiave) => p.nodo.querySelector(`[data-campo="${chiave}"]`);
// `Field` disegna <div>etichetta</div> e subito dopo la casella: si
// prende il FRATELLO SEGUENTE dell'etichetta, non il primo input del
// contenitore — quello restituiva "Nome" anche cercando "Cognome",
// perche' le due caselle stanno nella stessa riga.
// Trovare l'etichetta e' piu' delicato di quanto sembri: il
// contenitore di `Field` ha lo STESSO testo della sua etichetta (la
// casella non ne ha), quindi cercando "Nome" si prende il contenitore e
// il suo fratello seguente e' il campo Cognome. Si cerca la div piu'
// interna — quella che non contiene altre div — e si legge la casella
// subito dopo.
const valoreDi = (p, etichetta) => {
  const e = [...p.nodo.querySelectorAll("div")]
    .filter((d) => (d.textContent || "").trim() === etichetta && !d.querySelector("div"))
    .pop();
  const dopo = e?.nextElementSibling;
  if (dopo?.tagName === "INPUT") return dopo.value;
  return dopo?.querySelector("input")?.value ?? null;
};

describe("il banco al corso", () => {
  it("si apre senza spegnersi", async () => {
    const p = await apriBanco();
    expect(p.testo()).toMatch(/Altre opzioni/);
  });

  it("fuori dai corsi la barra delle allieve non c'è", async () => {
    const p = await apriBanco();
    expect(campo(p, "allieva-pos")).toBe(null);
  });

  it("scelto il corso compare la barra, e le allieve sono le sue", async () => {
    const p = await apriBanco();
    await scegli(campo(p, "corso-pos"), "cd1");
    const barra = campo(p, "allieva-pos");
    expect(barra).not.toBe(null);
    expect(p.testo()).toMatch(/A chi vendi/);
    expect([...barra.options].map((o) => o.textContent).join(" ")).toMatch(/Mario Dezzi/);
  });

  it("scelta l'allieva, l'indirizzo si compila da sé", async () => {
    const p = await apriBanco();
    await scegli(campo(p, "corso-pos"), "cd1");
    await scegli(campo(p, "allieva-pos"), "is1");
    expect(valoreDi(p, "Nome")).toBe("Mario");
    expect(valoreDi(p, "Cognome")).toBe("Dezzi");
    expect(valoreDi(p, "Indirizzo")).toBe("VIA CARLO SEVERINI");
    expect(valoreDi(p, "CAP")).toBe("00163");
    // la provincia veniva letta da fattura_prov e restava vuota per chi
    // non chiede fattura: e' il difetto corretto il 20/10/2026
    expect(valoreDi(p, "Prov.")).toBe("RM");
    expect(valoreDi(p, "Civico")).toBe("46");
  });

  it("e dice cosa manca invece di far partire un pacco incompleto", async () => {
    const p = await apriBanco();
    await scegli(campo(p, "corso-pos"), "cd1");
    await scegli(campo(p, "allieva-pos"), "is2");
    expect(p.testo()).toMatch(/Dalla sua scheda manca/);
    expect(p.testo()).toMatch(/il CAP/);
    expect(p.testo()).toMatch(/la provincia/);
    expect(p.testo()).toMatch(/il cellulare/);
  });

  it("con l'indirizzo completo lo dice, e non avvisa di niente", async () => {
    const p = await apriBanco();
    await scegli(campo(p, "corso-pos"), "cd1");
    await scegli(campo(p, "allieva-pos"), "is1");
    expect(p.testo()).toMatch(/Indirizzo completo/);
    expect(p.testo()).not.toMatch(/Dalla sua scheda manca/);
  });
});
