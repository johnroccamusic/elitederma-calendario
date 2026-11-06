// «Aggiorna lo shop»: la risposta persa non e' un lavoro fallito (6/11/2026).
//
// Il titolare ha premuto il tasto e ha letto «Non riuscito: Failed to send
// a request to the Edge Function». Il giro, misurato lo stesso giorno da
// riga di comando, risponde in 23 secondi e scrive 182 giacenze senza
// sbagliare un colpo: quello che era fallito non era il riallineamento,
// era il viaggio di ritorno della risposta. Ventitre secondi sono tanti
// per un telefono che tiene aperta una connessione — lo schermo che si
// spegne, un cambio di app, il wi-fi che diventa rete dati.
//
// Queste prove stanno addosso alla frase, perche' la frase e' tutto il
// difetto: «non riuscito» su un lavoro riuscito manda a cercare un guasto
// che non c'e'.
import { describe, it, expect } from "vitest";
import { esitoRiallineaShop } from "../src/App.jsx";

const PIENO = { giacenze: 182, nascosti: 0, saltati: 2, falliti: [] };

describe("esitoRiallineaShop", () => {
  it("il giro andato a buon fine racconta quante giacenze ha spinto", () => {
    const esito = esitoRiallineaShop(PIENO, null);
    expect(esito.riuscito).toBe(true);
    expect(esito.rispostaPersa).toBe(false);
    expect(esito.testo).toContain("182 giacenze aggiornate");
    expect(esito.testo).toContain("2 saltati");
  });

  it("i prodotti che il sito ha rifiutato si leggono per nome", () => {
    const esito = esitoRiallineaShop(
      { ...PIENO, falliti: ["Kit henne business (id 672): ID non valido."] },
      null,
    );
    // il giro e' arrivato in fondo: si dice cosa non e' passato, non «non riuscito»
    expect(esito.riuscito).toBe(true);
    expect(esito.testo).toContain("Kit henne business");
  });

  it("la risposta persa NON si chiama «non riuscito»", () => {
    const esito = esitoRiallineaShop(null, {
      name: "FunctionsFetchError",
      message: "Failed to send a request to the Edge Function",
    });
    expect(esito.rispostaPersa).toBe(true);
    expect(esito.riuscito).toBe(false);
    expect(esito.testo).not.toContain("Non riuscito");
    // e non si lascia in faccia la frase inglese della libreria
    expect(esito.testo).not.toContain("Edge Function");
    // dice le due cose che servono: com'e' andata probabilmente, e che ripremere e' sicuro
    expect(esito.testo).toMatch(/aggiornato lo stesso/i);
    expect(esito.testo).toMatch(/non fa danni/i);
  });

  it("riconosce la risposta persa anche senza il nome dell'errore", () => {
    // supabase-js non promette il `name`: la frase e' l'altra traccia
    const esito = esitoRiallineaShop(null, { message: "Failed to fetch" });
    expect(esito.rispostaPersa).toBe(true);
  });

  it("un rifiuto vero del sito resta un rifiuto, con il suo motivo", () => {
    const esito = esitoRiallineaShop({ errore: "Configurazione WooCommerce (scrittura) mancante" }, null);
    expect(esito.riuscito).toBe(false);
    expect(esito.rispostaPersa).toBe(false);
    expect(esito.testo).toBe("Non riuscito: Configurazione WooCommerce (scrittura) mancante");
  });

  it("un errore senza messaggio non lascia «undefined» nel riquadro", () => {
    const esito = esitoRiallineaShop(null, {});
    expect(esito.testo).not.toContain("undefined");
    expect(esito.testo).toContain("Non riuscito");
  });
});
