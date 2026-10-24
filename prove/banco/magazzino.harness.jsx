// BANCO VISIVO: Gestione magazzino con pochi prodotti finti, per guardare
// la testata di «Dettaglio prodotti» sul telefono.
//   PLAYWRIGHT_DIR=<cartella> CLICCA="Filtri" node prove/banco/foto.mjs magazzino <foto.png>
import React from "react";
import { createRoot } from "react-dom/client";
import { PaginaMagazzino } from "../../src/App.jsx";

const prodotti = [
  { id: "p1", nome: "Colla Ultra Clear 5ml", quantita: 64, soglia_riordino: 15, prezzo: 29, prezzo_vendita: 23.77, costo_acquisto: 6, stato: "publish", fornitore_id: "f1" },
  { id: "p2", nome: "Remover Exelash 15g", quantita: 3, soglia_riordino: 10, prezzo: 12, prezzo_vendita: 9.84, costo_acquisto: 2.5, stato: "publish", fornitore_id: "f1" },
  { id: "p3", nome: "Pelle sintetica trico", quantita: 0, soglia_riordino: 5, prezzo: 8.43, prezzo_vendita: 6.91, costo_acquisto: 1.2, stato: "publish", fornitore_id: null },
];
createRoot(document.getElementById("radice")).render(
  <PaginaMagazzino
    ruoloUtente="programmatore" prodottiShop={prodotti} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
    bundleComponenti={[]} impostazioniIva={{}} fornitori={[{ id: "f1", nome: "Exelash" }]} venditeShop={[]}
    corsi={[]} corsiDate={[]} location={[]} iscritti={[]} kitDefinizioni={[]} corsiKitProdotti={[]} logisticaKitEdizioni={[]}
    onApriAdvisor={() => {}} ricarica={async () => {}} assicuraTabelle={async () => {}} registraInterceptaIndietro={() => {}} onBack={() => {}}
  />
);
