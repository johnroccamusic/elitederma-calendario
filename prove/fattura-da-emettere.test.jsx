// LA SCHEDA DA CUI SI EMETTE UNA FATTURA.
//
// E' il punto dell'app dove un errore costa di piu': una fattura emessa non
// si annulla, si corregge con una nota di credito. Qui si prova che il tasto
// sia spento finche' mancano i dati, che chiami la funzione giusta con i dati
// giusti, e che i dati si presentino in maiuscolo — tranne gli indirizzi di
// posta, che restano come li ha scritti chi li possiede.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { SchedaFatturaDaEmettere } from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca } from "./aiuto.js";

const BASE = {
  id: "p1", codice: "AB12CD", importo: 244, pagato_il: "2026-10-14T10:00:00Z",
  stato: "da_verificare", descrizione: "Dermografo",
  righe: [{ nome: "Dermografo", quantita: 1, prezzo: 244 }],
};
const COMPLETO = {
  nome: "Anna", cognome: "Prova", codice_fiscale: "rssmra85t10a562s",
  indirizzo: "via Finta 1", cap: "00100", citta: "Roma", provincia: "rm",
  cod_dest: "0000000", email: "anna@esempio.it", pec: "anna@pec.it",
};

async function scheda(pagamento, onSalvato = () => {}) {
  const corpi = [];
  rispondiCon({
    "/functions/v1/pos-emetti-fattura": (corpo) => { corpi.push(corpo); return { numero: "124/2026" }; },
  });
  const p = await monta(<SchedaFatturaDaEmettere pagamento={pagamento} isMobile={false} onSalvato={onSalvato} chi="Elena" />);
  return { ...p, corpi };
}

describe("fattura da emettere", () => {
  it("col cliente senza codice fiscale il tasto e' spento e dice cosa manca", async () => {
    const p = await scheda({ ...BASE, cliente: { nome: "Anna", cognome: "Prova" } });
    expect(p.tasto("Emetti la fattura")?.disabled).toBe(true);
    expect(p.testo()).toMatch(/manca/i);
  });

  it("coi dati completi il tasto e' acceso", async () => {
    const p = await scheda({ ...BASE, cliente: COMPLETO });
    expect(p.tasto("Emetti la fattura")?.disabled).toBe(false);
  });

  it("premendolo chiama pos-emetti-fattura col codice e con chi ha premuto", async () => {
    let ricaricato = 0;
    const p = await scheda({ ...BASE, cliente: COMPLETO }, () => { ricaricato += 1; });
    await clicca(p.tasto("Emetti la fattura"));
    const corpo = p.corpi.at(-1);
    expect(corpo.codice).toBe("AB12CD");
    expect(corpo.verificatoDa).toBe("Elena");
    expect(corpo.cliente.codice_fiscale).toBe("RSSMRA85T10A562S");
    expect(p.testo()).toContain("124/2026");
    expect(ricaricato).toBe(1);
  });

  it("una vendita al banco si chiama per id, non per codice", async () => {
    const p = await scheda({ ...BASE, tipo: "banco", cliente: COMPLETO });
    await clicca(p.tasto("Emetti la fattura"));
    const corpo = p.corpi.at(-1);
    expect(corpo.venditaId).toBe("p1");
    expect(corpo.codice).toBeUndefined();
  });

  it("i dati si presentano in maiuscolo, gli indirizzi di posta no", async () => {
    const p = await scheda({ ...BASE, cliente: COMPLETO });
    await clicca(p.tasto("Guarda e correggi i dati"));
    const valori = p.campi().map((i) => i.value);
    expect(valori).toContain("RSSMRA85T10A562S");
    expect(valori).toContain("ROMA");
    expect(valori).toContain("RM");
    expect(valori).toContain("anna@esempio.it");   // intatta
    expect(valori).toContain("anna@pec.it");       // intatta
  });

  it("si vede da dove arriva l'incasso", async () => {
    const qr = await scheda({ ...BASE, cliente: COMPLETO });
    expect(qr.testo()).toContain("Carta col QR (Stripe)");
    const banco = await scheda({ ...BASE, tipo: "banco", cliente: COMPLETO });
    expect(banco.testo()).toContain("Carta al banco (terminale)");
  });
});
