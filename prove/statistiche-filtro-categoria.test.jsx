// IL FILTRO PER CATEGORIA nelle due statistiche di canale (3/11/2026).
//
// Chiesto dal titolare: «in statistiche vendite al banco e statistiche
// shop online bisogna mettere anche il filtro per categoria».
//
// Quello che questa prova difende non e' la tendina, e' il SENSO dei
// numeri. Una categoria sta sulle RIGHE, non sull'ordine: in uno
// scontrino ci sono un kit di laminazione e un pigmento. Filtrando per
// reparto si potevano fare due cose, e una e' sbagliata — tenere gli
// ordini che CONTENGONO quel reparto e sommarne il totale (cioe'
// mostrare anche il pigmento e la spedizione sotto la voce
// «laminazione»), oppure tenere le sole righe di quel reparto. Qui si
// controlla la seconda, numero per numero, e che senza filtro niente
// cambi rispetto a prima.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi, scegli } from "./aiuto.js";

const TUTTI = ["gestionedate", "dashboardvenditori", "dashboardmaster", "erp", "magazzinoshop", "pos",
  "logisticaprodotti", "compensipremi", "statistiche", "crmallievi", "storicoallievi", "impostazioni"];

// oggi, cosi' le vendite cadono dentro la finestra di default (30 giorni)
const OGGI = new Date().toISOString().slice(0, 10);

// due reparti, uno con una sottocategoria: chi sceglie «Laminazione» si
// aspetta dentro anche «Ciglia», che e' sua figlia
const CATEGORIE = [
  { id: "c1", nome: "Laminazione", categoria_padre_id: null, ordine: 1 },
  { id: "c2", nome: "Ciglia", categoria_padre_id: "c1", ordine: 1 },
  { id: "c3", nome: "Pigmenti", categoria_padre_id: null, ordine: 2 },
];
const PRODOTTI = [
  { id: "p1", nome: "Kit laminazione", attivo: true, quantita: 5 },
  { id: "p2", nome: "Pigmento nero", attivo: true, quantita: 9 },
];
const COLLEGAMENTI = [
  { prodotto_id: "p1", categoria_id: "c2" },
  { prodotto_id: "p2", categoria_id: "c3" },
];

// V1: un ordine misto, con la spedizione. V2: un pigmento piu' una riga
// scritta a mano (al banco si battono anche i saldi dei corsi), che non
// sta in nessuna categoria perche' a catalogo non c'e'.
const VENDITE = [
  {
    id: "v1", origine: "woocommerce", tipo_movimento: "vendita", data_ordine: `${OGGI}T10:00:00Z`,
    totale: 100, cliente_nome: "Anna", numero_ordine: "1001",
    prodotti: [
      { prodotto_id: "p1", nome: "Kit laminazione", quantita: 2, totale_riga: 60 },
      { prodotto_id: "p2", nome: "Pigmento nero", quantita: 1, totale_riga: 30 },
      { nome: "Spedizione", spedizione: true, quantita: 0, totale_riga: 10 },
    ],
  },
  {
    id: "v2", origine: "woocommerce", tipo_movimento: "vendita", data_ordine: `${OGGI}T11:00:00Z`,
    totale: 530, cliente_nome: "Bea", numero_ordine: "1002",
    prodotti: [
      { prodotto_id: "p2", nome: "Pigmento nero", quantita: 1, totale_riga: 30 },
      { nome: "saldo corso pmu", quantita: 1, totale_riga: 500 },
    ],
  },
  // al banco, non sullo shop: non deve comparire nella pagina dello shop
  {
    id: "v3", origine: "pos", tipo_movimento: "vendita", data_ordine: `${OGGI}T12:00:00Z`,
    totale: 60, cliente_nome: "Cle", prodotti: [{ prodotto_id: "p1", nome: "Kit laminazione", quantita: 1, totale_riga: 60 }],
  },
];

function seduta() {
  window.sessionStorage.clear();
  window.sessionStorage.setItem("edc_ok", "1");
  window.sessionStorage.setItem("edc_ruolo", "programmatore");
  window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "PROVA", permessi: TUTTI, chiave_sistema: null }));
}

// l'ordine conta: la prima chiave che compare nell'indirizzo vince
function preparaDati() {
  rispondiCon({
    vendite_shop_storico: VENDITE,
    vendite_shop: VENDITE,
    prodotti_categorie: COLLEGAMENTI,
    categorie_prodotti: CATEGORIE,
    prodotti_shop: PRODOTTI,
  });
}

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");

// home -> Statistiche -> Statistiche Totali Vendite Prodotti -> il canale
async function apriCanale(etichettaCanale) {
  seduta();
  preparaDati();
  window.history.replaceState({}, "", "/");
  const p = await monta(<App />);
  await attendi(250);
  await clicca(p.tasto("Statistiche"));
  await attendi(150);
  await clicca(p.tasto("Statistiche Totali Vendite Prodotti"));
  await attendi(200);
  await clicca(p.tasto(etichettaCanale));
  await attendi(200);
  return p;
}

describe("il filtro per categoria nelle statistiche di canale", () => {
  it("shop online: senza filtro conta gli ordini interi, col reparto conta le sue righe", async () => {
    const p = await apriCanale("Statistiche Vendite Shop Online");
    expect(pulito(p)).toContain("Statistiche Vendite Shop Online");

    // senza filtro: i totali degli ordini dello shop (100 + 530), com'era
    // prima che il filtro esistesse. La vendita al banco resta fuori.
    expect(pulito(p)).toContain("630,00 €");
    expect(pulito(p)).not.toContain("Pigmento nero · parte dell'ordine");

    const tendina = p.tendina("categoria");
    expect(tendina).toBeTruthy();
    // la tendina rispecchia l'albero: i reparti e le loro figlie
    const nomi = [...tendina.options].map((o) => o.textContent.replace(/[ —]/g, "").trim());
    expect(nomi).toContain("Laminazione");
    expect(nomi).toContain("Ciglia");
    expect(nomi).toContain("Pigmenti");

    // LAMINAZIONE, che il prodotto non ce l'ha addosso: ce l'ha «Ciglia»,
    // che le sta sotto. Deve trovarlo comunque.
    await scegli(tendina, "c1");
    const conLaminazione = pulito(p);
    expect(conLaminazione).toContain("Incasso della categoria");
    expect(conLaminazione).toContain("60,00 €");
    // l'ordine valeva 100 (pigmento e spedizione compresi): quel numero
    // non deve piu' comparire sotto questo filtro
    expect(conLaminazione).not.toContain("100,00 €");
    expect(conLaminazione).toContain("parte dell'ordine");
    expect(conLaminazione).toContain("Numeri delle sole righe di");

    // PIGMENTI: sta in due ordini, 30 + 30
    await scegli(p.tendina("categoria"), "c3");
    expect(pulito(p)).toContain("60,00 €");
    expect(pulito(p)).not.toContain("530,00 €");

    // LE RIGHE NON A CATALOGO: il saldo del corso battuto a mano
    await scegli(p.tendina("categoria"), "__senza");
    expect(pulito(p)).toContain("500,00 €");
    expect(pulito(p)).toContain("saldo corso pmu");

    await p.smonta();
  });

  it("vendite al banco: la tendina c'è e filtra lo stesso, sul suo canale", async () => {
    const p = await apriCanale("Statistiche Vendite al Banco");
    expect(pulito(p)).toContain("Statistiche Vendite al Banco");
    // solo la vendita al banco: 60
    expect(pulito(p)).toContain("60,00 €");
    expect(pulito(p)).not.toContain("530,00 €");

    await scegli(p.tendina("categoria"), "c3");
    // al banco non è stato venduto nessun pigmento
    expect(pulito(p)).toContain("Nessuna vendita di questa categoria nel periodo selezionato.");
    expect(pulito(p)).toContain("0,00 €");

    await scegli(p.tendina("categoria"), "c1");
    expect(pulito(p)).toContain("60,00 €");
    // l'ordine era tutto di laminazione: non è «parte dell'ordine»
    expect(pulito(p)).not.toContain("parte dell'ordine");

    await p.smonta();
  });
});
