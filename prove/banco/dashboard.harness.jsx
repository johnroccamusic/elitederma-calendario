// BANCO VISIVO: la Dashboard venditori con qualche iscrizione finta.
//   PLAYWRIGHT_DIR=<cartella> CLICCA="Le tue iscrizioni" node prove/banco/foto.mjs dashboard <foto.png>
import React from "react";
import { createRoot } from "react-dom/client";
import { PaginaDashboardVenditori } from "../../src/App.jsx";

const MARIO = { id: "v1", nome: "MARIO", permessi: ["dashboardvenditori"] };
const corsi = [{ id: "c1", nome: "NEEDLING", colore: "#2E7D32" }, { id: "c2", nome: "EXTENSION BASE", colore: "#8A6A1B" }, { id: "c3", nome: "PMU BASE" }];
const location = [{ id: "l1", nome: "MILANO", citta: "MILANO" }, { id: "l2", nome: "ROMA", citta: "ROMA" }];
const corsiDate = [
  { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2026-11-14", data_fine: "2026-11-15" },
  { id: "cd2", corso_id: "c2", location_id: "l2", data_inizio: "2026-11-20", data_fine: "2026-11-21" },
  { id: "cd3", corso_id: "c3", location_id: "l2", data_inizio: "2026-12-02", data_fine: "2026-12-04" },
];
const iscritti = [
  { id: "i1", nome: "GIULIA", cognome: "ROSSI", corso_data_id: "cd1", tutor: "MARIO", ts: "2026-10-23T10:00:00Z" },
  { id: "i2", nome: "MARTINA", cognome: "CASTAGNA", corso_data_id: "cd2", tutor: "MARIO", ts: "2026-10-23T09:00:00Z" },
  { id: "i3", nome: "CLAUDIA", cognome: "GUADAGNINO", corso_data_id: "cd3", tutor: "MARIO", ts: "2026-10-19T09:00:00Z" },
];
createRoot(document.getElementById("radice")).render(
  <PaginaDashboardVenditori venditoreBloccato={MARIO} venditori={[MARIO]} corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti}
    master={[]} venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]} onBack={() => {}} ricarica={() => {}} apriData={() => {}} />
);
