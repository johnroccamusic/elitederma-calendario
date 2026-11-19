// muoviStockInBlocco: l'operazione su piu' prodotti passa da stock_muovi, che
// e' tutta o niente. Qui si prova il lato browser: cosa manda, cosa dice
// quando il database rifiuta, e che il sito si riallinei solo a cose fatte.
import { describe, it, expect } from "vitest";
import "./preparazione.js";
import { rispondiCon } from "./preparazione.js";
import { muoviStockInBlocco, muoviStock } from "../src/magazzino/stock.js";

const A = { id: "a1", nome: "Aghi 1RL", woo_product_id: 11 };
const B = { id: "b2", nome: "Pigmento nero" };

describe("muoviStockInBlocco", () => {
  it("manda tutte le righe in una chiamata sola, con origine e riferimento", async () => {
    const chiamate = []; const allineamenti = [];
    rispondiCon({
      "rpc/stock_muovi": (corpo) => { chiamate.push(corpo); return { ok: true, quantita: {} }; },
      "woo-riallinea-shop": (corpo) => { allineamenti.push(corpo); return { ok: true }; },
    });
    const errore = await muoviStockInBlocco(
      [{ prodotto: A, delta: 3 }, { prodotto: B, delta: 2, collegatoProdottoId: "a1" }, { prodotto: B, delta: 0 }],
      { origine: "reso", nota: "Vendita #1 cancellata", riferimento: "POS-1", utente: "Elena" });
    expect(errore).toBeNull();
    expect(chiamate.length).toBe(1);
    expect(chiamate[0]).toEqual({
      p_righe: [{ prodotto_id: "a1", delta: 3 }, { prodotto_id: "b2", delta: 2, collegato_prodotto_id: "a1" }],
      p_origine: "reso", p_nota: "Vendita #1 cancellata", p_riferimento: "POS-1", p_utente: "Elena",
    });
    await new Promise((ok) => setTimeout(ok, 30));
    // il sito si riallinea solo per chi e' pubblicato
    expect(allineamenti).toEqual([{ prodottiIds: ["a1"] }]);
  });

  it("se il database rifiuta per giacenza, lo dice per nome e non riallinea il sito", async () => {
    const allineamenti = [];
    rispondiCon({
      "rpc/stock_muovi": { ok: false, motivo: "insufficiente", prodotti: [{ prodotto_id: "a1", nome: "Aghi 1RL", disponibili: 2, richiesti: 5 }] },
      "woo-riallinea-shop": (corpo) => { allineamenti.push(corpo); return { ok: true }; },
    });
    const errore = await muoviStockInBlocco([{ prodotto: A, delta: -5 }, { prodotto: B, delta: -1 }], { origine: "scarico" });
    expect(errore).toContain('"Aghi 1RL": ci sono 2 pezzi, non posso scaricarne 5.');
    expect(errore).toContain("Nessun prodotto e' stato toccato.");
    await new Promise((ok) => setTimeout(ok, 30));
    expect(allineamenti.length).toBe(0);
  });

  it("senza righe utili non chiama il database", async () => {
    const f = rispondiCon({});
    expect(await muoviStockInBlocco([{ prodotto: A, delta: 0 }, { prodotto: null, delta: 4 }], { origine: "reso" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("muoviStock (un prodotto) passa dallo stesso blocco: niente piu' lettura e riscrittura dal browser", async () => {
    const f = rispondiCon({
      "rpc/stock_muovi": { ok: true, quantita: {} },
      "woo-riallinea-shop": { ok: true },
    });
    expect(await muoviStock(A, -2, { origine: "rettifica_manuale", nota: "Correzione" })).toBeNull();
    const url = f.mock.calls.map((c) => String(c[0]));
    expect(url.some((u) => u.includes("rpc/stock_muovi"))).toBe(true);
    // nessuna lettura di prodotti_shop e nessuna scrittura diretta della giacenza
    expect(url.some((u) => u.includes("rest/v1/prodotti_shop"))).toBe(false);
    expect(url.some((u) => u.includes("woo-aggiorna-prodotto"))).toBe(false);
  });
});
