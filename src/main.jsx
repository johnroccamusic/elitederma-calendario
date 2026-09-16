import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { avviaAggiornamentoAutomatico } from "./aggiornamento.js";

// ---------------------------------------------------------------------------
// IL CANCELLO DI ACCESSO
//
// Per accendere la schermata di accesso (email e password) basta cambiare
// qui sotto `false` in `true`. Nient'altro.
//
// Cosa cambia con `true`: chi apre l'app trova prima la schermata
// "Accademia Elitederma" e deve entrare con un account; solo dopo vede il
// gestionale, dove la password interna continua a decidere il ruolo
// esattamente come oggi. Le tre pagine pubbliche (?master=, ?modelle=,
// ?biglietti=) restano libere: passano dal cancello senza chiedere niente.
//
// Perche' e' un interruttore e non e' gia' acceso. Fino al 17/09/2026
// `Accesso.jsx` esisteva ma non lo importava nessuno: qui si rendeva
// `<App />` direttamente. Quindi NESSUNO ha mai avuto una sessione, e per
// il database tutti sono "anon". Accendere il cancello cambia l'abitudine
// quotidiana di chiunque usi il gestionale, e va fatto quando le
// credenziali sono state distribuite — non un minuto prima.
//
// Va acceso PRIMA di chiudere le regole del database a "solo chi ha fatto
// accesso": chiuderle mentre tutti sono fuori spegne l'app per tutti. E'
// gia' successo il 15/08/2026, e fu annullato lo stesso giorno.
// ---------------------------------------------------------------------------
const CANCELLO_ACCESO = false;

// caricato solo se serve: cosi' con il cancello spento non nasce un secondo
// client Supabase accanto a quello di App.jsx
const Accesso = lazy(() => import("./Accesso.jsx"));

// l'app aperta da giorni si ricarica da sola quando resta ferma o quando
// esce una versione nuova: vedi aggiornamento.js
avviaAggiornamentoAutomatico();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {CANCELLO_ACCESO ? (
      <Suspense fallback={null}>
        <Accesso />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
