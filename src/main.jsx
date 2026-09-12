import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { avviaAggiornamentoAutomatico } from "./aggiornamento.js";

// l'app aperta da giorni si ricarica da sola quando resta ferma o quando
// esce una versione nuova: vedi aggiornamento.js
avviaAggiornamentoAutomatico();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
