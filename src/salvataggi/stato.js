// I salvataggi in volo, tenuti fuori da React.
//
// Servono perché il salvataggio di un prodotto va in background e dura
// qualche secondo: chi ha premuto Salva può chiudere la scheda, tornare
// indietro, andare in un'altra area. Finché questi stati vivevano dentro
// PaginaGestioneShop, uscire da quella pagina voleva dire perdere
// l'esito — e un salvataggio fallito spariva senza dire niente. Peggio:
// con la scheda aperta da Gestione magazzino (`soloScheda`) la striscia
// non veniva disegnata affatto.
//
// Stesso modo di fare delle impostazioni condivise in App.jsx: un po' di
// stato a livello di modulo e una lista di ascoltatori. Non serve un
// contesto React né una libreria — chi guarda sono due componenti.
import { useEffect, useState } from "react";

let lavori = [];      // { chiave, nome } — in corso adesso
let falliti = [];     // { chiave, nome, errore, form } — da rivedere
let daRiaprire = null; // { form, n } — la scheda che l'utente vuole indietro
const ascoltatori = new Set();

function avvisa() {
  const istantanea = { lavori, falliti, daRiaprire };
  ascoltatori.forEach((f) => f(istantanea));
}

export function avviaSalvataggio(chiave, nome) {
  lavori = [...lavori, { chiave, nome }];
  avvisa();
}

// `errore` assente vuol dire andata bene: il lavoro sparisce e basta.
// `form` è la scheda com'era al momento del salvataggio: serve al tasto
// "Riapri la scheda", che deve restituire quello che l'utente aveva
// scritto, non quello che c'è nel database.
export function concludiSalvataggio(chiave, { errore = null, nome = "", form = null } = {}) {
  lavori = lavori.filter((l) => l.chiave !== chiave);
  if (errore) falliti = [...falliti, { chiave, nome, errore, form }];
  avvisa();
}

export function scartaFallito(chiave) {
  falliti = falliti.filter((l) => l.chiave !== chiave);
  avvisa();
}

// Il tasto "Riapri la scheda" non può aprirla da solo: la scheda vive
// dentro Gestione shop, e da lì potremmo essere usciti. Si lascia qui la
// richiesta, App porta l'utente sulla pagina, e la pagina la raccoglie.
export function chiediRiapertura(form) {
  daRiaprire = { form, n: Date.now() };
  avvisa();
}

export function consumaRiapertura() {
  daRiaprire = null;
  avvisa();
}

export function useSalvataggi() {
  const [istantanea, setIstantanea] = useState({ lavori, falliti, daRiaprire });
  useEffect(() => {
    // fra il primo render e l'iscrizione qualcosa può essere già
    // cambiato: si riparte dallo stato di adesso, non da quello di prima
    setIstantanea({ lavori, falliti, daRiaprire });
    ascoltatori.add(setIstantanea);
    return () => { ascoltatori.delete(setIstantanea); };
  }, []);
  return istantanea;
}
