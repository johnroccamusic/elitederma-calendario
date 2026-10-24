// BANCO VISIVO: l'Advisor con un prodotto da ordinare per un evento.
//   PLAYWRIGHT_DIR=<cartella> VISTA=scrivania node prove/banco/foto.mjs advisor <foto.png>
import React from "react";
import { createRoot } from "react-dom/client";
import { PaginaAdvisor } from "../../src/App.jsx";

const PRODOTTO = { id: "p1", nome: "Ultra Clear Glue 5ml", quantita: 10, soglia_riordino: 15, quantita_riordino: 50, stato: "publish", immagine_url: null, fornitore_id: "f1", lead_time_giorni: 10, giorni_sicurezza: 3 };
createRoot(document.getElementById("radice")).render(
  <PaginaAdvisor
    prodottiShop={[PRODOTTO]} categorieProdotti={[]} prodottiCategorie={[]} prodottiImmagini={[]}
    corsi={[]} corsiDate={[]} location={[]} iscritti={[]} kitDefinizioni={[]} corsiKitProdotti={[]} logisticaKitEdizioni={[]}
    fornitori={[{ id: "f1", nome: "Exelash" }]}
    eventi={[{ id: "e1", nome: "Fiera di Tirana", data_inizio: "2026-11-02", data_fine: "2026-11-04", stato: "programmato" }]}
    eventiMateriali={[{ id: "em1", evento_id: "e1", prodotto_id: "p1", quantita: 50 }]}
    riordiniInCorso={[]} ricarica={async () => {}} onApriProdotto={() => {}} onApriIscritto={() => {}} onBack={() => {}}
  />
);
