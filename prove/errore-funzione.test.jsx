// IL MOTIVO DI UN ERRORE ARRIVA A CHI GUARDA.
//
// L'8/11/2026 l'assistente ha risposto «Edge Function returned a non-2xx
// status code» a chi aveva scritto il nome di un prodotto. La funzione
// aveva detto perche' — nel corpo della risposta, con `{ ok: false,
// errore }` e stato 502 — ma `supabase.functions.invoke` quel corpo lo
// appende a `error.context` e lascia `data` nullo, quindi il pannello
// mostrava `error.message`, che e' sempre la stessa frase inutile.
//
// Un errore che non dice niente manda a cercare il guasto nel posto
// sbagliato: e' costata una diagnosi.
import { describe, it, expect } from "vitest";
import React from "react";
import AssistenteRegole from "../src/regole/AssistenteRegole.jsx";
import ChiediAiDati from "../src/statistiche/ChiediAiDati.jsx";
import { testoErroreFunzione, statoErroreFunzione } from "../src/errore-funzione.js";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const rifiuto = (corpo, stato = 502) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { "Content-Type": "application/json" } });

describe("il motivo di un errore di edge function", () => {
  it("legge il motivo dal corpo della risposta, non da error.message", async () => {
    const error = { message: "Edge Function returned a non-2xx status code", context: rifiuto({ ok: false, errore: "Il modello ha risposto 429: rate limit" }) };
    expect(await testoErroreFunzione(error)).toBe("Il modello ha risposto 429: rate limit");
    expect(statoErroreFunzione(error)).toBe(502);
  });

  it("se il corpo non e' JSON tiene il messaggio che c'e'", async () => {
    const error = { message: "Failed to send a request to the Edge Function", context: new Response("<html>", { status: 504 }) };
    expect(await testoErroreFunzione(error)).toBe("Failed to send a request to the Edge Function");
  });

  it("senza nemmeno un messaggio non resta muto", async () => {
    expect(await testoErroreFunzione(null)).toBe("Non riuscito.");
    expect(statoErroreFunzione(null)).toBe(null);
  });

  it("l'assistente mostra il motivo vero, e non la frase «non-2xx»", async () => {
    rispondiCon({
      "rest/v1/regolamenti": [],
      "functions/v1/assistente-regole": () => rifiuto({ ok: false, errore: "Il modello ha risposto 429: numero di richieste superato" }),
    });
    const p = await monta(<AssistenteRegole ruolo="programmatore" chi="Admin" />);
    await clicca(p.nodo.querySelector('[data-campo="assistente-regole"]'));
    await scrivi(p.nodo.querySelector('[data-campo="domanda-regole"]'), "pigmento nero");
    await clicca(p.tasto("Chiedi")); await attendi(120);
    const t = p.nodo.querySelector('[data-campo="scambio"]').textContent;
    expect(t).toContain("429");
    expect(t).toContain("numero di richieste superato");
    expect(t).not.toContain("non-2xx");
    await p.smonta();
  });

  it("e lo mostra anche «Chiedi ai dati»", async () => {
    rispondiCon({ "functions/v1/analisi-domanda": () => rifiuto({ ok: false, errore: "La query non e' ammessa su quella vista" }) });
    const p = await monta(<ChiediAiDati chi="Admin" />);
    await scrivi(p.nodo.querySelector('[data-campo="domanda"]'), "quanti pigmenti a ottobre");
    await clicca(p.tasto("Chiedi")); await attendi(120);
    expect(p.testo()).toContain("non e' ammessa su quella vista");
    expect(p.testo()).not.toContain("non-2xx");
    await p.smonta();
  });
});
