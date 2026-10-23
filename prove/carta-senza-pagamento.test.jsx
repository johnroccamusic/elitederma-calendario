// CON LA CARTA, SENZA LA PROVA DEL PAGAMENTO, NON SI INCASSA.
//
// Il 19/10/2026 una master ha premuto «Incassa vendita» con «Carta»
// scelta e il QR mai nato: il carrello si è svuotato, il magazzino è
// sceso, la vendita è entrata in coda e il ritentativo l'ha registrata
// e spedita — 117,13 € mai incassati, pacco partito il giorno dopo.
//
// Qui si monta il banco vero. Per chi non ha il terminale la carta È il
// QR, e il QR chiude la vendita da solo quando i soldi arrivano: il
// tasto, con la carta, deve restare spento e dire perché.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PRODOTTO = { id: "p1", nome: "Pigmento", prezzo_vendita: 30, quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22 };
const MASTER = { id: "m1", nome: "VALENTINA PROVA", masterId: "m1", permessi: ["pos"], chiave_sistema: null };
const ADMIN = { id: "a1", nome: "ELENA PROVA", permessi: ["pos", "erp"], chiave_sistema: "__admin" };

async function banco({ utente, ruolo }) {
  rispondiCon({ "/auth/v1/user": { id: "u1", email: "x@y.it" } });
  const p = await monta(
    <PaginaPOS
      prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[{ id: "m1", nome: "VALENTINA PROVA" }]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={utente} venditoreLoggato={null} targetVenditeProdotti={[]} ruoloUtente={ruolo}
    />
  );
  // un prodotto nel carrello: si preme la sua tessera nel catalogo. Da
  // scrivania la tessera e' un <div> col cursore a mano, non un <button>
  const tessera = [...p.nodo.querySelectorAll("div")]
    .find((d) => d.style.cursor === "pointer" && (d.textContent || "").trim().startsWith("Pigmento"));
  expect(tessera, "la tessera del prodotto nel catalogo").toBeTruthy();
  await clicca(tessera); await attendi(80);
  const incassa = [...p.nodo.querySelectorAll("button")].find((b) => /incassa/i.test(b.textContent || "") && !/vendita registrata/i.test(b.textContent || ""));
  return { ...p, incassa };
}

describe("il tasto Incassa vendita con la carta", () => {
  it("per una master resta spento, e dice che la carta si chiude dal QR", async () => {
    const p = await banco({ utente: MASTER, ruolo: "user" });
    expect(p.incassa).toBeTruthy();
    expect(p.incassa.disabled).toBe(true);
    expect(p.nodo.querySelector('[data-campo="carta-senza-pagamento"]')).toBeTruthy();
    expect(p.testo()).toMatch(/si chiude da sola quando il pagamento arriva/);
  });

  it("in contanti si preme, perché l'incasso lo constata chi sta al banco", async () => {
    const p = await banco({ utente: MASTER, ruolo: "user" });
    const contanti = [...p.nodo.querySelectorAll("button")].find((b) => /Contanti/.test(b.textContent || ""));
    await clicca(contanti); await attendi(60);
    const incassa = [...p.nodo.querySelectorAll("button")].find((b) => /incassa/i.test(b.textContent || ""));
    expect(incassa.disabled).toBe(false);
    expect(p.nodo.querySelector('[data-campo="carta-senza-pagamento"]')).toBe(null);
  });

  it("per chi amministra col POS esterno si preme: ha visto lo scontrino", async () => {
    const p = await banco({ utente: ADMIN, ruolo: "amministratore" });
    expect(p.incassa).toBeTruthy();
    expect(p.incassa.disabled).toBe(false);
    expect(p.testo()).toMatch(/POS esterno/);
  });
});
