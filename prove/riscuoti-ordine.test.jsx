// RISCUOTERE UN ORDINE RIMASTO NON PAGATO.
//
// La vendita e' registrata — il magazzino e' sceso — ma i soldi non sono
// arrivati: carta rifiutata, QR scaduto, cliente uscita. Da qui nasce un
// link di pagamento per quella vendita.
//
// Due cose vanno provate col gesto e non a occhio: che il tasto esista
// solo in amministrazione, e che la domanda sulla fattura venga PRIMA
// del link — perche' dopo non si cambia piu', e la pagina che la
// persona si trova davanti e' un'altra.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleDettaglioOrdine } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const VENDITA = {
  id: "v1", numero_ordine: "POS-1792489505013", origine: "pos",
  tipo_movimento: "vendita", stato: "completato",
  data_ordine: "2026-10-20T10:00:00Z", totale: 159.09,
  totale_imponibile: 130.4, totale_iva: 28.69,
  operatore_tipo: "master", operatore_id: "m1", operatore_nome: "KATIA",
  prodotti: [{ nome: "Borsa da lavoro PMU", quantita: 1, totale_riga: 35.25, prezzo_listino: 39.9, sconto_riga: 4.65 }],
};

// quello che risponde la edge function di Stripe
const LINK = { codice: "K7PQ29", indirizzo: "https://esempio.supabase.co/functions/v1/paga/K7PQ29", scadeIl: "2026-10-21T10:00:00Z" };

async function apri(puoRiscuotere, vendita = VENDITA) {
  const chiamate = [];
  rispondiCon({
    "stripe-crea-pagamento": (corpo) => { chiamate.push(corpo); return LINK; },
  });
  const p = await monta(
    <ModaleDettaglioOrdine vendita={vendita} onChiudi={() => {}} puoRiscuotere={puoRiscuotere} />,
  );
  return { ...p, chiamate };
}

describe("il link di pagamento su una vendita gia' fatta", () => {
  it("al banco di chi vende non c'è", async () => {
    const p = await apri(false);
    expect(p.testo()).not.toContain("Genera un link di pagamento");
  });

  it("in amministrazione c'è, e porta il totale dell'ordine", async () => {
    const p = await apri(true);
    expect(p.tasto("Genera un link di pagamento")).toBeTruthy();
    expect(p.testo()).toContain("159,09");
  });

  it("chiede la fattura PRIMA di creare il link", async () => {
    const p = await apri(true);
    await clicca(p.tasto("Genera un link di pagamento"));
    expect(p.testo()).toContain("Il cliente ha bisogno di fattura?");
    // finche' si sta rispondendo, a Stripe non e' partito niente
    expect(p.chiamate.length).toBe(0);
  });

  it("col sì il link nasce chiedendo i dati per la fattura", async () => {
    const p = await apri(true);
    await clicca(p.tasto("Genera un link di pagamento"));
    await clicca(p.tasto("Sì, serve fattura"));
    expect(p.chiamate.length).toBe(1);
    expect(p.chiamate[0].richiedeFattura).toBe(true);
    // il totale chiesto e' quello dell'ordine, in una riga sola: le
    // righe dei prodotti non fanno il totale (spedizione, sconti) e la
    // funzione rifiuta se non torna
    expect(p.chiamate[0].importo).toBe(159.09);
    expect(p.chiamate[0].righe).toEqual([{ nome: "Ordine POS-1792489505013", prezzo: 159.09, quantita: 1 }]);
    // vale un giorno: un link mandato su WhatsApp si apre la sera
    expect(p.chiamate[0].oreValide).toBe(24);
    // l'incasso resta di chi ha venduto, non di chi manda il link
    expect(p.chiamate[0].operatore).toEqual({ tipo: "master", id: "m1", nome: "KATIA" });
    expect(p.testo()).toContain("K7PQ29");
  });

  it("col no non si chiede niente alla persona", async () => {
    const p = await apri(true);
    await clicca(p.tasto("Genera un link di pagamento"));
    await clicca(p.tasto("No, paga e basta"));
    expect(p.chiamate[0].richiedeFattura).toBe(false);
  });

  it("su un reso non c'è niente da incassare", async () => {
    const p = await apri(true, { ...VENDITA, tipo_movimento: "reso" });
    expect(p.testo()).not.toContain("Genera un link di pagamento");
  });
});
