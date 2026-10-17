// L'INDIRIZZO DELL'APP, uno solo per tutti i link che escono.
//
// Genyon risponde a due indirizzi: app.elitederma.net (quello buono,
// con dominio e certificato dal 17/10/2026) e il vecchio
// elitederma-calendario.vercel.app, che resta vivo perche' i link gia'
// mandati in giro continuino a funzionare.
//
// PERCHE' NON `window.location.origin`. I link che si generano qui
// dentro — il modulo dell'allieva, il QR del consenso, la pagina della
// master — li apre qualcun altro, spesso mesi dopo. Se si costruiscono
// con l'indirizzo della finestra in cui si sta lavorando, bastava che
// una segretaria avesse aperto il vecchio indirizzo perche' tutti i
// link di quella giornata uscissero col dominio vecchio. Funzionano lo
// stesso, ma portano il nome sbagliato a un'allieva — e il giorno che
// il vecchio indirizzo si spegne smettono di funzionare tutti insieme.
//
// `VITE_APP_URL` si imposta su Vercel. Se manca si ripiega sulla
// finestra: in sviluppo locale e' l'unica cosa sensata, e in produzione
// vuol dire che qualcuno ha tolto la variabile — meglio un link col
// dominio vecchio che un link rotto.
const SCRITTO = String(import.meta.env.VITE_APP_URL || "").trim().replace(/\/+$/, "");

export const INDIRIZZO_APP =
  SCRITTO || (typeof window !== "undefined" ? window.location.origin : "");

/** Un indirizzo dell'app: `link("/?modulo=ABC")` → "https://app.elitederma.net/?modulo=ABC" */
export function link(percorso = "") {
  const p = String(percorso || "");
  return INDIRIZZO_APP + (p.startsWith("/") || p === "" ? p : "/" + p);
}
