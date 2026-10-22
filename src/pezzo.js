// UNA PUBBLICAZIONE NUOVA SPEZZA LE SCHEDE RIMASTE APERTE.
//
// L'app e' divisa in pezzi che si caricano quando servono, e ognuno ha
// il nome col codice del suo contenuto — `GestioneEventi-Bl0S8LbT.js`,
// `index-BxhQZihE.js`. A ogni pubblicazione quel codice cambia, e il
// file di prima **sparisce dal server**: verificato il 22/10/2026, un
// nome della build precedente risponde 404.
//
// Una scheda lasciata aperta tiene in memoria il file d'avvio vecchio,
// che quei nomi vecchi li conosce ancora. Al primo pezzo che non ha
// gia' caricato chiede un file che non c'e' piu'. L'`import` fallisce,
// e sotto una `Suspense` senza rete quello che resta e' la scritta di
// attesa, per sempre: chi guarda vede una pagina che gira e non si
// carica, e non ha modo di sapere che basterebbe ricaricare.
//
// E' il caso peggiore per l'app intera: `Accesso.jsx` carica `App.jsx`
// cosi', quindi un file d'avvio vecchio non apre piu' niente — non una
// pagina, tutto.
//
// Qui il fallimento diventa una ricarica, che e' l'unica cosa che
// rimedia davvero: la pagina si riprende il file d'avvio nuovo e i nomi
// tornano a combaciare.
//
// UNA VOLTA OGNI MEZZO MINUTO, E NON DI PIU'. Se il pezzo manca per un
// motivo vero — rete giu', file rotto — una pagina che si ricarica in
// cerchio non si riesce nemmeno a chiudere con calma: passato quel
// tempo il guasto si lascia vedere. E il guasto non viene mai
// nascosto: si rilancia comunque a chi sta sopra.
import { lazy } from "react";

const CHIAVE = "edc_ricarica_per_pezzo";
const ATTESA = 30000;

export function pezzo(carica) {
  return lazy(() => carica().catch((guasto) => {
    let ultima = 0;
    try { ultima = Number(sessionStorage.getItem(CHIAVE) || 0); } catch { /* navigazione privata */ }
    if (Date.now() - ultima > ATTESA) {
      try { sessionStorage.setItem(CHIAVE, String(Date.now())); } catch { /* idem */ }
      window.location.reload();
    }
    throw guasto;
  }));
}
