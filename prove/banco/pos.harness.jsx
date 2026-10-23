// BANCO VISIVO: il POS con un prodotto e il carrello aperto, per guardare
// il carrello «notte» sul telefono prima di pubblicarlo.
//   PLAYWRIGHT_DIR=<cartella> CLICCA="Pigmento|Carrello" node prove/banco/foto.mjs pos <foto.png>
import React from "react";
import { createRoot } from "react-dom/client";
import { PaginaPOS } from "../../src/App.jsx";

const PRODOTTO = { id: "p1", nome: "Pigmento Nero 10ml", prezzo: 69, prezzo_vendita: 69, quantita: 20, stato: "publish", sku: "8000000102478", immagine_url: null };
const MASTER = { tipo: "master", masterId: "m1", nome: "VALENTINA PROVA" };
createRoot(document.getElementById("radice")).render(
  <PaginaPOS prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
    venditeShop={[]} corsiDate={[{ id: "cd1", corso_id: "c1", data_inizio: "2026-10-20", data_fine: "2026-12-31", master_id: "m1" }]} corsi={[{ id: "c1", nome: "PMU BASE" }]} location={[]}
    iscritti={[{ id: "i1", nome: "LIA", cognome: "PATANIA", corso_data_id: "cd1", stato_iscrizione: "confermato" }]} coupon={[]} bundleComponenti={[]}
    master={[{ id: "m1", nome: "VALENTINA PROVA" }]} ricarica={() => {}} onBack={() => {}}
    utenteLoggato={MASTER} venditoreLoggato={null} targetVenditeProdotti={[]} ruoloUtente="user" />
);
