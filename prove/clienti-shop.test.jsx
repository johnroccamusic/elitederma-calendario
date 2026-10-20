// I CLIENTI DELLO SHOP, E CHI DI LORO HA FATTO CORSI.
//
// Non esiste un'anagrafica clienti: lo shop non ci ha mandato una
// rubrica, ci ha mandato ordini, e il cliente e' scritto su ognuno.
// L'elenco si RICAVA da li', cosi' chi compra domani compare da solo.
//
// La parte difficile e' l'altra: dire se quel cliente ha gia' fatto un
// corso. Per un po' la pagina rispondeva «mai stato allievo», e due
// volte su due ha detto una bugia — Debora Fumagalli e Angelica
// Burelli, due nostre master che i corsi li hanno fatti. Il motivo e'
// strutturale: l'incrocio guardava le sole iscrizioni del gestionale,
// mentre chi ha fatto corsi prima sta nello storico, che di email non
// ne ha nemmeno una.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaCrmShop } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

// `conto` e' l'account WooCommerce: e' quello a raggruppare gli ordini
// di una stessa persona, non il nome
const ordine = (n, conto, quando, totale, nome, email, billing = {}) => ({
  id: `v${n}`, origine: "woocommerce", numero_ordine: `W-${n}`, data_ordine: quando,
  totale, stato: "completed", cliente_nome: nome, cliente_email: email,
  prodotti: [{ nome: "Ago Nano", quantita: 1, totale_riga: totale }],
  payload_raw: { customer_id: conto, billing, shipping: {} },
});

const CASA = { phone: "3339876543", address_1: "VIA TERNI 90", postcode: "00182", city: "ROMA", state: "RM", country: "IT" };

// un'iscritta vera, con email
const ISCRITTI = [{ id: "i1", nome: "ANNA", cognome: "VERDI", email: "ANNA@esempio.it " }];
// Debora: nello storico (e master), senza email da nessuna delle due
// parti. I corsi li ha fatti, ma nessun confronto per email puo' saperlo.
const STORICO = [{ id: "s1", nome: "Debora", cognome: "Fumagalli" }];
// Angelica: master con la STESSA email con cui compra. Li' non c'e'
// niente da verificare: e' lei.
const MASTER = [
  { id: "m1", nome: "DEBORA FUMAGALLI", email: null },
  { id: "m2", nome: "ANGELICA BURELLI", email: "angelicaburellibeauty@gmail.com" },
];

const VENDITE = [
  ordine(1, 11, "2025-03-02T10:00:00Z", 120, "Giulia Bianchi", "giulia@esempio.it", CASA),
  ordine(2, 11, "2026-01-10T10:00:00Z", 80, "Giulia Bianchi", "giulia@esempio.it", CASA),
  ordine(3, 22, "2026-02-02T10:00:00Z", 300, "Anna Verdi", "anna@esempio.it", { phone: "3451112222" }),
  ordine(4, 33, "2026-03-03T10:00:00Z", 60, "Debora Fumagalli", "deborafumagalli@alice.it"),
  ordine(5, 44, "2026-04-04T10:00:00Z", 90, "Angelica Burelli", "angelicaburellibeauty@gmail.com"),
  // il banco non e' lo shop
  { id: "p1", origine: "pos", numero_ordine: "POS-1", data_ordine: "2026-02-01T10:00:00Z", totale: 50, prodotti: [] },
];

async function apri() {
  rispondiCon({});
  return monta(
    <PaginaCrmShop venditeShop={VENDITE} vociShopClassificazione={[]} prodottiShop={[]}
      iscritti={ISCRITTI} storicoAllievi={STORICO} master={MASTER}
      onApriClassificazioneVoci={() => {}} onBack={() => {}} />,
  );
}
const righe = (p) => [...p.nodo.querySelectorAll("tbody tr")];
const rigaDi = (p, chi) => righe(p).find((r) => r.textContent.includes(chi));

describe("clienti shop", () => {
  it("il telefono si legge dall'elenco, non solo l'email", async () => {
    const p = await apri();
    expect(p.testo()).toContain("giulia@esempio.it");
    expect(p.testo()).toContain("3339876543");
  });

  it("gli ordini dello stesso cliente fanno una riga sola", async () => {
    const p = await apri();
    expect(righe(p).length).toBe(4);
    expect(rigaDi(p, "Giulia Bianchi").textContent).toContain("200,00");
  });

  it("le vendite al banco non sono clienti dello shop", async () => {
    const p = await apri();
    expect(p.testo()).not.toContain("POS-1");
  });

  it("aprendo il cliente si vede quello che l'ordine porta con sé", async () => {
    const p = await apri();
    await clicca(rigaDi(p, "Giulia Bianchi"));
    const testo = p.testo();
    expect(testo).toContain("VIA TERNI 90");
    expect(testo).toContain("00182 ROMA (RM)");
    expect(testo).toContain("W-1");
    expect(testo).toContain("W-2");
  });

  it("l'email che combacia è un fatto: iscritta o master che sia", async () => {
    const p = await apri();
    expect(rigaDi(p, "Anna Verdi").textContent).toContain("allieva");
    // Angelica e' master, e la sua email e' quella con cui compra
    expect(rigaDi(p, "Angelica Burelli").textContent).toContain("allieva");
    expect(p.testo()).toContain("Risulta allievo (2)");
  });

  it("Debora è nello storico, che non ha email: «da verificare», non «mai»", async () => {
    const p = await apri();
    const sua = rigaDi(p, "Debora Fumagalli");
    expect(sua.textContent).toContain("da verificare");
    expect(p.testo()).toContain("Da verificare (1)");
    // e la parola che diceva una bugia non c'è più da nessuna parte
    expect(p.testo()).not.toContain("Mai stato allievo");
  });

  it("solo chi non risulta da nessuna parte è «nessun riscontro»", async () => {
    const p = await apri();
    expect(p.testo()).toContain("Nessun riscontro (1)");
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.startsWith("Nessun riscontro"));
    await clicca(tasto);
    expect(righe(p).length).toBe(1);
    expect(righe(p)[0].textContent).toContain("Giulia Bianchi");
  });

  it("e il filtro «da verificare» lascia passare solo i dubbi", async () => {
    const p = await apri();
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.startsWith("Da verificare"));
    await clicca(tasto);
    expect(righe(p).length).toBe(1);
    expect(righe(p)[0].textContent).toContain("Debora Fumagalli");
  });
});
