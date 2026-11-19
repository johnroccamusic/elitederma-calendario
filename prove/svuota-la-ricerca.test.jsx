// LA RIGA DELLA RICERCA SI SVUOTA CON UN TASTO (9/11/2026).
//
// Il titolare, dal banco: «quando cerchi un prodotto e lo inserisci,
// sulla riga dove hai scritto il vecchio nome per la ricerca ci vuole il
// tasto cancella per svuotare la riga». Il nome di prima resta scritto
// anche dopo che il prodotto e' nel carrello, e per cercare il prossimo
// si cancella lettera per lettera — con il prodotto appena venduto in
// una mano e il telefono nell'altra.
//
// Si prova il gesto e non la funzione: il tasto compare, si preme, la
// riga e' vuota, e l'elenco dei prodotti torna quello di prima. Un
// riquadro che svuota il proprio stato ma lascia la lista filtrata
// sarebbe peggio di nessun tasto.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const PIGMENTO = {
  id: "p1", nome: "Pigmento Nero Intenso", prezzo_vendita: 30, costo_acquisto: 10,
  quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22,
};
const AGHI = {
  id: "p2", nome: "Aghi 1RL sterili", prezzo_vendita: 10, costo_acquisto: 8,
  quantita: 50, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22,
};

const RISPOSTE = { "/auth/v1/user": { id: "u1", email: "x@y.it" } };

async function banco() {
  return monta(
    <PaginaPOS
      prodottiShop={[PIGMENTO, AGHI]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[]} assistente={[]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={{ id: "u1", nome: "OLGA", venditoreId: "v-olga", permessi: ["pos"] }}
      venditoreLoggato={{ id: "v-olga", nome: "OLGA" }} targetVenditeProdotti={[]} ruoloUtente="user"
    />
  );
}

// la riga della ricerca del banco: la prima casella con quel
// suggerimento, che e' la stessa in elenco e in griglia
const rigaRicerca = (p) => p.campi().find((i) => /Cerca prodotto, codice o categoria/.test(i.placeholder || ""));
const tastoSvuota = (p) => p.nodo.querySelector('[data-campo="svuota-ricerca"]');

describe("la riga della ricerca, al banco", () => {
  it("vuota non ha nessun tasto per svuotarla", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);
    expect(rigaRicerca(p), "la riga della ricerca").toBeTruthy();
    // un tasto che non puo' fare niente e' un dubbio, non una scelta
    expect(tastoSvuota(p)).toBe(null);
    await p.smonta();
  });

  it("scritto un nome compare il tasto, e premuto svuota la riga", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);

    await scrivi(rigaRicerca(p), "pigmento");
    expect(rigaRicerca(p).value).toBe("pigmento");
    // l'elenco si e' ristretto: e' la prova che la riga sta filtrando
    expect(p.testo()).toMatch(/Pigmento Nero Intenso/);
    expect(p.testo()).not.toMatch(/Aghi 1RL/);

    const tasto = tastoSvuota(p);
    expect(tasto, "il tasto per svuotare").toBeTruthy();
    await clicca(tasto);

    expect(rigaRicerca(p).value, "la riga dopo il tasto").toBe("");
    // e il filtro se n'e' andato con lei: tutti i prodotti sono tornati
    expect(p.testo()).toMatch(/Pigmento Nero Intenso/);
    expect(p.testo()).toMatch(/Aghi 1RL/);
    expect(tastoSvuota(p), "e il tasto sparisce con la riga vuota").toBe(null);
    await p.smonta();
  });

  it("svuotata, la riga resta quella in cui si scrive", async () => {
    // si svuota per scrivere un altro nome, non per guardarla vuota:
    // sul telefono il fuoco e' la tastiera che resta aperta
    rispondiCon(RISPOSTE);
    const p = await banco();
    await attendi(150);
    await scrivi(rigaRicerca(p), "aghi");
    await clicca(tastoSvuota(p));
    expect(document.activeElement).toBe(rigaRicerca(p));
    await p.smonta();
  });
});
