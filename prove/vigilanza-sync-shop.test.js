// QUANDO LA SINCRONIZZAZIONE DEL SITO E' DA DICHIARARE FERMA.
//
// Dall'1/11/2026 gli ordini dello shop non entravano piu' e nessuno lo
// sapeva: la funzione veniva uccisa a meta' del giro, quindi non
// scriveva nemmeno il proprio errore. Da qui la regola che conta: non
// "l'ultimo giro e' andato male", ma "da quanto non ne arriva uno
// riuscito". Il silenzio e' il guasto.
//
// Queste prove girano sulla regola condivisa fra il browser (il semaforo
// in Vendite shop) e Deno (la notifica e la mail): se divergessero, il
// riquadro sarebbe verde mentre il telefono squilla.
import { describe, it, expect } from "vitest";
import {
  statoSincronizzazione, avvisoSincronizzazione, ultimoGiroRiuscito,
  MINUTI_MASSIMI_SENZA_SYNC,
} from "../supabase/functions/_shared/sync-vigilanza.js";

const ADESSO = new Date("2026-11-02T18:30:00Z").getTime();
const minutiPrima = (m) => new Date(ADESSO - m * 60000).toISOString();
const giro = (esito, minuti, errori = []) => ({ ts: minutiPrima(minuti), esito, errori });

describe("lo stato della sincronizzazione del sito", () => {
  it("con un giro riuscito poco fa è a posto", () => {
    const s = statoSincronizzazione([giro("ok", 5), giro("ok", 20)], ADESSO);
    expect(s.stato).toBe("a_posto");
    expect(s.motivo).toBe(null);
    expect(Math.round(s.minutiDaOk)).toBe(5);
  });

  it("un giro parziale conta come riuscito: i dati li ha aggiornati", () => {
    const s = statoSincronizzazione([giro("parziale", 10)], ADESSO);
    expect(s.stato).toBe("a_posto");
    expect(ultimoGiroRiuscito([giro("parziale", 10)]).esito).toBe("parziale");
  });

  it("un solo giro fallito non è un guasto: al prossimo può rimediare", () => {
    const s = statoSincronizzazione([giro("errore", 2, ["WooCommerce ha risposto 502"]), giro("ok", 17)], ADESSO);
    expect(s.stato).toBe("a_posto");
    expect(s.erroriDiSeguito).toBe(1);
  });

  it("due giri falliti di fila sì", () => {
    const s = statoSincronizzazione([giro("errore", 2, ["502"]), giro("errore", 17, ["502"]), giro("ok", 32)], ADESSO);
    expect(s.stato).toBe("guasto");
    expect(s.motivo).toBe("errori");
    expect(s.erroriDiSeguito).toBe(2);
  });

  // il guasto vero dell'1/11: nessuna riga, perche' la funzione moriva
  // prima di scriverla. Qui si vede che la regola lo prende.
  it("il silenzio è un guasto anche se l'ultima riga diceva «ok»", () => {
    const s = statoSincronizzazione([giro("ok", MINUTI_MASSIMI_SENZA_SYNC + 10)], ADESSO);
    expect(s.stato).toBe("guasto");
    expect(s.motivo).toBe("silenzio");
  });

  it("appena sotto la soglia non si avvisa ancora", () => {
    const s = statoSincronizzazione([giro("ok", MINUTI_MASSIMI_SENZA_SYNC - 5)], ADESSO);
    expect(s.stato).toBe("a_posto");
  });

  it("il silenzio batte gli errori: se manca da troppo, il motivo è quello", () => {
    const s = statoSincronizzazione([giro("errore", 5, ["502"]), giro("errore", 20, ["502"]), giro("ok", 500)], ADESSO);
    expect(s.motivo).toBe("silenzio");
  });

  it("senza nemmeno una riga è muto", () => {
    expect(statoSincronizzazione([], ADESSO).stato).toBe("muto");
  });

  it("legge anche le date come le scrive l'editor SQL, con lo spazio invece della T", () => {
    const s = statoSincronizzazione([{ ts: "2026-11-02 18:25:00+00", esito: "ok" }], ADESSO);
    expect(s.stato).toBe("a_posto");
    expect(Math.round(s.minutiDaOk)).toBe(5);
  });
});

describe("il testo dell'avviso", () => {
  it("per il silenzio dice da quanto e cosa vuol dire", () => {
    const s = statoSincronizzazione([giro("ok", 200)], ADESSO);
    const a = avvisoSincronizzazione(s);
    expect(a.titolo).toBe("Ordini del sito fermi");
    expect(a.testo).toContain("non stanno entrando in app");
    expect(a.testo).toContain("da 3 ore");
    // dove guardare: un avviso senza un gesto da fare si impara a chiudere
    expect(a.testo).toContain("Recupera ordini mancanti");
  });

  it("per i giri falliti riporta l'errore vero", () => {
    const s = statoSincronizzazione([giro("errore", 2, ["WooCommerce ha risposto 502 alla pagina 1"]), giro("errore", 17, ["502"]), giro("ok", 32)], ADESSO);
    const a = avvisoSincronizzazione(s);
    expect(a.testo).toContain("2 giri di fila non riusciti");
    expect(a.testo).toContain("502 alla pagina 1");
  });

  it("il rientro è un messaggio solo, e si capisce che non c'è niente da fare", () => {
    const s = statoSincronizzazione([giro("ok", 3)], ADESSO);
    const a = avvisoSincronizzazione(s, { rientro: true });
    expect(a.titolo).toContain("tornata a posto");
    expect(a.html).toContain("Non serve fare niente");
  });

  it("la notifica e la mail dicono la stessa cosa", () => {
    const s = statoSincronizzazione([giro("ok", 300)], ADESSO);
    const a = avvisoSincronizzazione(s);
    // il titolo e' uno; il corpo in HTML e quello a mano devono parlare
    // dello stesso guasto, o chi riceve le due cose legge due versioni
    expect(a.html).toContain("Ultimo giro riuscito");
    expect(a.testo).toContain("Ultimo giro riuscito");
  });
});
