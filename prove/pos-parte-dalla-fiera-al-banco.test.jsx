// Il banco, aperto per davvero: chi vende alla fiera lo trova già
// impostato su quella fiera, con lo sconto fiera acceso (7/11/2026).
//
// `pos-parte-dalla-fiera.test.js` prova la regola; questa prova il
// GESTO — monta il POS vero, con un operatore vero, e guarda la tendina
// e la spunta come le vede chi sta in piedi dietro al banco. La regola
// può essere giusta e la tendina restare vuota per un filo staccato in
// mezzo: il POS legge le fiere e il team con due richieste sue.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaPOS } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const oggi = new Date().toISOString().slice(0, 10);
const fraDueOre = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

const PRODOTTO = { id: "p1", nome: "Pigmento", prezzo_vendita: 30, quantita: 10, tipo_prodotto: "semplice", attivo: true, aliquota_iva_vendita: 22 };
const FIERA = {
  id: "ev1", nome: "Fiera di prova", citta: "Napoli", stato: "programmato",
  data_inizio: oggi, data_fine: oggi,
  pos_banco_fino_al: fraDueOre, pos_banco_sconto_fiera: true,
};
// le fasce degli eventi: senza, lo sconto fiera non è nemmeno
// disponibile e la spunta non comparirebbe
const FASCE = {
  soglie: [80], gruppi: [
    [{ da: 0, a: 100, percentuale: 10 }],
    [{ da: 0, a: 100, percentuale: 10 }],
  ],
};
// OLGA sta al banco; KATIA no, ed è la riga che conta: una preselezione
// addosso a chi non c'è aggancerebbe alla fiera le vendite della sua aula
const TEAM = [{ evento_id: "ev1", persona_tipo: "venditore", persona_id: "v-olga", nome: "OLGA", vende_al_banco: true }];

async function banco(venditore) {
  return monta(
    <PaginaPOS
      prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
      venditeShop={[]} corsiDate={[]} corsi={[]} location={[]} iscritti={[]} coupon={[]} bundleComponenti={[]}
      master={[]} assistente={[]} ricarica={() => {}} onBack={() => {}}
      utenteLoggato={{ id: "u1", nome: venditore.nome, venditoreId: venditore.id, permessi: ["pos"] }}
      venditoreLoggato={venditore} targetVenditeProdotti={[]} ruoloUtente="user"
    />
  );
}

// l'ordine conta: "eventi_team" contiene "eventi", e la finta prende la
// prima chiave che combacia
const RISPOSTE = {
  "/auth/v1/user": { id: "u1", email: "x@y.it" },
  "chiave=eq.fasceSconto_eventi_carta": { valore: FASCE },
  "chiave=eq.fasceSconto_eventi_contanti": { valore: FASCE },
  "/eventi_team": TEAM,
  "/eventi": [FIERA],
};

const tendinaEvento = (p) => p.tendine().find((s) => /non legata a un evento/.test(s.textContent || ""));

describe("il POS di chi vende al banco della fiera", () => {
  it("si apre già sulla fiera, con lo sconto fiera acceso, e dice perché", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco({ id: "v-olga", nome: "OLGA" });
    await attendi(150);

    const tendina = tendinaEvento(p);
    expect(tendina, "la tendina «Sei a un evento?»").toBeTruthy();
    expect(tendina.value).toBe("ev1");

    // la preselezione si dice: trovarla fatta senza sapere perché è il
    // modo di non guardarla più
    expect(p.testo()).toMatch(/Sei fra chi vende al banco di/);
    expect(p.testo()).toMatch(/Fiera di prova/);

    const spunta = p.campi().find((c) => c.type === "checkbox" && !c.disabled
      && /Sconto fiera/.test(c.closest("label")?.textContent || ""));
    expect(spunta, "la spunta dello sconto fiera").toBeTruthy();
    expect(spunta.checked).toBe(true);

    // E LA SPEDIZIONE PARTE SPENTA (7/11/2026): al banco la merce va
    // nella borsa della cliente. La spedizione nasce accesa — decisione
    // del 23/10 — e con il carrello ancora vuoto si leggeva «Totale da
    // incassare 6,90 €»: a una fiera sono soldi chiesti per un servizio
    // che non c'è.
    expect(p.testo(), "le spese di spedizione al banco della fiera").not.toMatch(/Spedizione\s*6,90/);
    await p.smonta();
  });

  it("chi NON è al banco si apre come sempre: nessun evento, nessuno sconto", async () => {
    rispondiCon(RISPOSTE);
    const p = await banco({ id: "v-katia", nome: "KATIA" });
    await attendi(150);

    const tendina = tendinaEvento(p);
    expect(tendina).toBeTruthy();
    expect(tendina.value).toBe("");
    expect(p.testo()).not.toMatch(/Sei fra chi vende al banco di/);
    // senza evento la spunta dello sconto fiera non esiste nemmeno
    expect(p.testo()).not.toMatch(/Sconto fiera/);
    // e la spedizione resta accesa come l'ha voluta il titolare il
    // 23/10: fuori dal banco della fiera non cambia niente
    expect(p.testo(), "la spedizione fuori dal banco").toMatch(/Spedizione\s*6,90/);
    await p.smonta();
  });

  it("passata l'ora del banco, il POS riparte da «nessun evento» da solo", async () => {
    rispondiCon({ ...RISPOSTE, "/eventi": [{ ...FIERA, pos_banco_fino_al: new Date(Date.now() - 60000).toISOString() }] });
    const p = await banco({ id: "v-olga", nome: "OLGA" });
    await attendi(150);
    expect(tendinaEvento(p).value).toBe("");
    expect(p.testo()).not.toMatch(/Sei fra chi vende al banco di/);
    await p.smonta();
  });
});
