// IL CODICE DEL QR NON PASSA ALLA VENDITA DOPO (9/11/2026).
//
// Segnalato dalla logistica: «Tommaso ieri ha fatto un ordine di aula di
// 274,61 a nome di Vecarelli Rossella. A lei sono stati scalati ma non
// mi compare ordine».
//
// Misurato: l'8/11 alle 14:57:43 il pagamento BFG5RE di 274,61 € è
// risultato PAGATO (due Sensitive Cream, un Glucan-Age, due A+B Peeling
// e 6,90 di spedizione). Tre secondi dopo, alle 14:57:46, il banco ha
// registrato un ALTRO carrello — 103,31 €, in CONTANTI, tre prodotti
// diversi, consegnato in aula — e quella vendita si è portata dietro il
// codice BFG5RE, perché `richiestaQr` restava nello stato del POS.
//
// La seconda metà del danno è quella che ha fatto sparire l'ordine: il
// pagamento risultava già legato a una vendita, quindi il recupero
// automatico non ha mai registrato quella vera. Soldi presi, niente da
// spedire, e nessun errore da nessuna parte.
//
// In archivio: UNA riga così su diciannove.
import { describe, it, expect } from "vitest";
import { codiceIncassoDaRegistrare } from "../src/App.jsx";

describe("il codice dell'incasso che finisce sulla vendita", () => {
  it("su una vendita in contanti non ci va MAI", () => {
    // è il caso dell'8/11: il codice c'era nello stato, il metodo no
    expect(codiceIncassoDaRegistrare({ codiceQr: "BFG5RE", metodoPagamento: "contanti" })).toBe(null);
  });

  it("nemmeno su un buono Amazon", () => {
    expect(codiceIncassoDaRegistrare({ codiceQr: "BFG5RE", metodoPagamento: "buono_amazon" })).toBe(null);
  });

  it("su una vendita con la carta ci va: è la prova del pagamento", () => {
    expect(codiceIncassoDaRegistrare({ codiceQr: "BFG5RE", metodoPagamento: "pos" })).toBe("BFG5RE");
  });

  it("su uno splittato ci va: la parte a carta passa dal QR", () => {
    expect(codiceIncassoDaRegistrare({ codiceQr: "BFG5RE", metodoPagamento: "contanti", splittato: true })).toBe("BFG5RE");
  });

  it("su un omaggio non ci va: non si incassa niente", () => {
    expect(codiceIncassoDaRegistrare({ codiceQr: "BFG5RE", metodoPagamento: "pos", omaggio: true })).toBe(null);
  });

  it("senza QR non si inventa niente", () => {
    expect(codiceIncassoDaRegistrare({ codiceQr: null, metodoPagamento: "pos" })).toBe(null);
    expect(codiceIncassoDaRegistrare({})).toBe(null);
  });
});
