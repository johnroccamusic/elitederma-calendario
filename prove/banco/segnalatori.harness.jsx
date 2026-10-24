// BANCO VISIVO: quattro segnalatori come in Gestione magazzino.
import React from "react";
import { createRoot } from "react-dom/client";
import { RiquadroSegnalatore, stileRigaSegnalatori } from "../../src/App.jsx";

const Icona = ({ size = 20, color = "#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>;
const mobile = window.innerWidth <= 700;
createRoot(document.getElementById("radice")).render(
  <div style={stileRigaSegnalatori(mobile)}>
    <RiquadroSegnalatore etichetta="Prodotti sotto scorta" valore={9} unita="prodotti" Icona={Icona} disco="#C9A227" colore="#8A6D1D" onClick={() => {}} />
    <RiquadroSegnalatore etichetta="Fermi da oltre 90 giorni" valore={63} unita="prodotti" Icona={Icona} disco="#8B8FA3" colore="#0E1B33" onClick={() => {}} />
    <RiquadroSegnalatore etichetta="Esauriti" valore={2} unita="prodotti" Icona={Icona} disco="#C0392B" colore="#C0392B" onClick={() => {}} />
    <RiquadroSegnalatore etichetta="Valore del magazzino" valore="€ 58.432,10" unita="a costo" Icona={Icona} disco="#0E1B33" colore="#0E1B33" />
  </div>
);
