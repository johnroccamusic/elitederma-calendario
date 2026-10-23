// BANCO VISIVO: «Vendite al banco» sul telefono, con vendite finte.
// Serve a vedere la tabella a tre righe senza aprire l'app: si lancia con
//   PLAYWRIGHT_DIR=<cartella> node prove/banco/foto.mjs vendite <foto.png>
import React from "react";
import { createRoot } from "react-dom/client";
import { PaginaVenditeShop } from "../../src/App.jsx";

const v = (n, data, totale, chi, corso, metodo) => ({
  id: "v" + n, numero_ordine: "POS-17927671086" + n, data_ordine: data + "T10:00:00Z", totale, totale_imponibile: totale / 1.22, totale_iva: totale - totale / 1.22,
  stato: "completed", origine: "pos", metodo_pagamento: metodo, operatore_nome: chi, tipo_movimento: "vendita", corso_data_id: corso ? "cd1" : null,
  prodotti: [{ nome: "Pigmento", quantita: 1, totale_riga: totale }],
});
const vendite = [
  v(17, "2026-10-23", 271.28, "MARTINA MEI", true, "contanti"),
  v(18, "2026-10-23", 150.12, "ANDREA PAURA", true, "pos"),
  v(19, "2026-10-20", 315, "RAFFAELE", false, "pos"),
  v(20, "2026-10-19", 117.13, "VALENTINA CALASCIBETTA", true, "pos"),
  v(21, "2026-10-19", 168.9, "ELIA CITO", true, "buono_amazon"),
];
createRoot(document.getElementById("radice")).render(
  <PaginaVenditeShop venditeShop={vendite} corsi={[{ id: "c1", nome: "PMU BASE" }]} corsiDate={[{ id: "cd1", corso_id: "c1" }]} origine="pos" ricarica={async () => {}} onBack={() => {}} ruoloUtente="programmatore" />
);
