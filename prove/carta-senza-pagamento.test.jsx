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

// DAL 9/11/2026 IL BANCO NON SI APRE SU NESSUN METODO (il titolare:
// «dopo una vendita si resetta ogni tipo di pagamento e l'operatore deve
// scegliere ogni volta come chiuderla»). Quindi la carta va scelta prima
// di poterne provare il blocco: è il gesto vero di chi incassa.
const scegli = async (p, etichetta) => {
  const tasto = [...p.nodo.querySelectorAll("button")].find((b) => new RegExp(etichetta).test(b.textContent || ""));
  expect(tasto, `il tasto ${etichetta}`).toBeTruthy();
  await clicca(tasto); await attendi(60);
  return [...p.nodo.querySelectorAll("button")].find((b) => /incassa/i.test(b.textContent || "") && !/vendita registrata/i.test(b.textContent || ""));
};

describe("il tasto Incassa vendita con la carta", () => {
  it("senza aver scelto come si paga resta spento, e lo dice", async () => {
    const p = await banco({ utente: MASTER, ruolo: "user" });
    expect(p.incassa).toBeTruthy();
    expect(p.incassa.disabled).toBe(true);
    expect(p.nodo.querySelector('[data-campo="scegli-il-metodo"]'), "la riga che dice di scegliere").toBeTruthy();
    expect(p.testo()).toMatch(/dopo ogni vendita non resta niente di scelto/);
  });

  it("scelta Stripe resta spento, e dice che la carta si chiude dal QR", async () => {
    const p = await banco({ utente: MASTER, ruolo: "user" });
    const incassa = await scegli(p, "Stripe");
    expect(incassa.disabled).toBe(true);
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

  it("per chi amministra, scelto il POS fisico si preme: ha visto lo scontrino", async () => {
    const p = await banco({ utente: ADMIN, ruolo: "amministratore" });
    expect(p.incassa.disabled, "prima di scegliere resta spento").toBe(true);
    const incassa = await scegli(p, "POS fisico");
    expect(incassa.disabled).toBe(false);
    expect(p.testo()).toMatch(/POS fisico/);
  });
});

// DOPO UNA VENDITA NON RESTA NIENTE DI SCELTO (9/11/2026).
//
// Il titolare, dopo il caso di Rossella Becarelli: «non far restare il
// POS in nessuna condizione vendita dopo vendita. Quindi dopo una
// vendita si resetta ogni tipo di pagamento e l'operatore deve
// scegliere ogni volta come chiuderla».
//
// Non è una preferenza: l'8/11 una vendita in contanti si è portata
// dietro il codice del QR del cliente di prima, e quel pagamento —
// risultando già usato — non è mai stato recuperato. 274,61 € incassati
// e nessun ordine in logistica.
describe("dopo una vendita il banco non resta su nessun metodo", () => {
  it("«+ Nuova vendita» spegne il metodo scelto", async () => {
    const p = await banco({ utente: MASTER, ruolo: "user" });
    // si scegli contanti: il tasto si accende
    const incassa = await scegli(p, "Contanti");
    expect(incassa.disabled).toBe(false);
    expect(p.nodo.querySelector('[data-campo="scegli-il-metodo"]')).toBe(null);

    // e si ricomincia: niente resta scelto
    const nuova = [...p.nodo.querySelectorAll("button")].find((b) => /\+ Nuova vendita/.test(b.textContent || ""));
    expect(nuova, "il tasto per ricominciare").toBeTruthy();
    await clicca(nuova); await attendi(80);

    const tessera = [...p.nodo.querySelectorAll("div")]
      .find((d) => d.style.cursor === "pointer" && (d.textContent || "").trim().startsWith("Pigmento"));
    await clicca(tessera); await attendi(80);
    const dopo = [...p.nodo.querySelectorAll("button")].find((b) => /incassa/i.test(b.textContent || "") && !/vendita registrata/i.test(b.textContent || ""));
    expect(dopo.disabled, "senza scegliere non si incassa").toBe(true);
    expect(p.nodo.querySelector('[data-campo="scegli-il-metodo"]')).toBeTruthy();
  });
});
