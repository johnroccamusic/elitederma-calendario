// «DAL TUO DOCUMENTO LEGGIAMO…»: il riquadro nel modulo dell'allieva.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import LetturaDocumento from "../src/iscrizione/LetturaDocumento.jsx";
import { monta, clicca } from "./aiuto.js";

const LETTO = { leggibile: true, nome: "ELENA", cognome: "PETRONE", data_nascita: "1983-10-27", codice_fiscale: "PTRLNE83T67E063M" };

describe("il riquadro della lettura", () => {
  it("mostra le righe, segna quelle diverse e porta nel modulo solo i campi liberi", async () => {
    const onUsa = vi.fn();
    const p = await monta(
      <LetturaDocumento lettura={{ stato: "ok", letto: LETTO }}
        valori={{ nome: "Elena", cognome: "PETRONI", data_nascita: "1983-10-23", codice_fiscale: "PTRLNE83T67E063M" }}
        bloccati={{ cognome: true }} onUsa={onUsa} />
    );
    expect(p.nodo.querySelector('[data-riga="nome"]').dataset.uguale).toBe("si");
    expect(p.nodo.querySelector('[data-riga="data_nascita"]').dataset.uguale).toBe("no");
    expect(p.testo()).toContain("nel modulo: 1983-10-23");
    // il cognome lo ha scritto il venditore: si segnala, non si tocca
    expect(p.testo()).toContain("Cognome: nel documento è diverso");
    const usa = p.tasto("Usa i dati del documento");
    expect(usa.textContent).toContain("(1)");
    await clicca(usa);
    expect(onUsa).toHaveBeenCalledWith({ data_nascita: "1983-10-27" });
    await p.smonta();
  });
  it("mentre legge lo dice, e un errore non blocca", async () => {
    const p = await monta(<LetturaDocumento lettura={{ stato: "leggo" }} valori={{}} />);
    expect(p.testo()).toContain("Sto leggendo");
    await p.smonta();
    const q = await monta(<LetturaDocumento lettura={{ stato: "errore", errore: "lettore giù" }} valori={{}} />);
    expect(q.testo()).toContain("Puoi mandare il modulo lo stesso");
    await q.smonta();
  });
  it("foto illeggibile: va rifatta, e dice perché", async () => {
    const p = await monta(<LetturaDocumento lettura={{ stato: "ok", letto: { leggibile: false, qualita: "illeggibile", problemi: ["poca luce", "documento tagliato a destra"] } }} valori={{}} />);
    expect(p.nodo.querySelector('[data-esito="illeggibile"]')).toBeTruthy();
    expect(p.testo()).toContain("va rifatta");
    expect(p.testo()).toContain("poca luce, documento tagliato a destra");
    expect(p.tasto("Usa i dati del documento")).toBeUndefined();
    await p.smonta();
  });
  it("foto scarsa ma leggibile: avvisa e lascia proseguire", async () => {
    const p = await monta(<LetturaDocumento lettura={{ stato: "ok", letto: { ...LETTO, qualita: "scarsa", problemi: ["riflesso"] } }} valori={{ nome: "ELENA" }} />);
    expect(p.nodo.querySelector('[data-esito="scarsa"]').textContent).toContain("riflesso");
    expect(p.testo()).toContain("Dal tuo documento leggiamo");
    await p.smonta();
  });
  it("dichiarato passaporto, caricata una patente: lo contesta e «Usa i dati» corregge il tipo", async () => {
    const onUsa = vi.fn();
    const p = await monta(<LetturaDocumento lettura={{ stato: "ok", letto: { ...LETTO, tipo_documento: "patente" } }} valori={{ doc_tipo: "Passaporto", nome: "ELENA", cognome: "PETRONE", data_nascita: "1983-10-27", codice_fiscale: "PTRLNE83T67E063M" }} onUsa={onUsa} />);
    expect(p.nodo.querySelector('[data-esito="tipo-diverso"]').textContent).toContain("Hai indicato «Passaporto», ma la foto sembra una patente");
    await clicca(p.tasto("Usa i dati del documento"));
    expect(onUsa).toHaveBeenCalledWith({ doc_tipo: "Patente" });
    await p.smonta();
  });
  it("documento scaduto: non vale, va caricato uno valido", async () => {
    const p = await monta(<LetturaDocumento lettura={{ stato: "ok", letto: { ...LETTO, scadenza: "2024-03-01" } }} valori={{ nome: "ELENA" }} />);
    expect(p.nodo.querySelector('[data-esito="scaduto"]').textContent).toContain("scaduto");
    expect(p.testo()).toContain("01/03/2024");
    expect(p.tasto("Usa i dati del documento")).toBeUndefined();
    await p.smonta();
    const q = await monta(<LetturaDocumento lettura={{ stato: "ok", letto: { ...LETTO, scadenza: "2031-03-01" } }} valori={{ nome: "ELENA" }} />);
    expect(q.testo()).toContain("Scadenza del documento: 01/03/2031");
    await q.smonta();
  });
});
