// BANCO VISIVO: la finestra modale in un browser vero.
//
// jsdom non fa il layout: «la scheda sborda a destra di 46 px» o «lo
// spazio in fondo non esiste su Safari» non li vede nessuna prova in
// prove/. Questo file monta la Modal VERA (quella di App.jsx) con un
// contenuto piu' alto dello schermo, e prove/banco/finestra.mjs la
// misura con un browser headless a 390 px: larghezza della scheda,
// niente scorrimento orizzontale, spazio in fondo. Si lancia a mano:
//   sh prove/banco/finestra.sh
import React from "react";
import { createRoot } from "react-dom/client";
import { Modal } from "../../src/App.jsx";

const righe = Array.from({ length: 30 }, (_, i) => (
  <div key={i} data-riga={i} style={{ padding: "14px 12px", borderTop: "1px solid #eee", fontFamily: "sans-serif" }}>
    Prodotto numero {i + 1} ×1 <span style={{ float: "right", fontWeight: 700 }}>9,05 €</span>
  </div>
));

createRoot(document.getElementById("radice")).render(
  <div style={{ height: "300vh", background: "#ddd" }}>
    <p style={{ padding: 20 }}>pagina sotto</p>
    <Modal title="Ordine #POS-PROVA" onClose={() => {}} maxWidth={720}>
      <div data-contenuto>{righe}<div data-ultima style={{ padding: 12 }}>Nota: ultima riga</div></div>
    </Modal>
  </div>
);
