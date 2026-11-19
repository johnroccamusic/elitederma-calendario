// IL TESTO DEL CONTRATTO NEL DATABASE (31/10/2026): le righe di partenza non
// si leggono come correzioni, e «Rimetti com'era» riscrive il testo invece
// di cancellare la riga.
import { describe, it, expect } from "vitest";
import { leggiTesti, salvaTesto, ripristinaTesto, DAL_CODICE, PARTENZA } from "../src/iscrizione/testi.js";
import { rispondiCon } from "./preparazione.js";

describe("testi del contratto", () => {
  it("una riga di partenza vale come mai corretta, una correzione di una persona no", async () => {
    rispondiCon({
      "rest/v1/modulo_iscrizione_testi": [
        { chiave: "intro", corpo: DAL_CODICE.intro, aggiornato_da: PARTENZA + " dal codice, 31/10/2026", aggiornato_il: "2026-10-31T08:00:00Z" },
        { chiave: "consensi", corpo: { ...DAL_CODICE.consensi, tastoInvio: "Invia" }, aggiornato_da: "Elena", aggiornato_il: "2026-11-02T09:00:00Z" },
      ],
    });
    const { testi, provenienza } = await leggiTesti();
    expect(provenienza.intro).toBeUndefined();
    expect(provenienza.consensi).toEqual({ da: "Elena", il: "2026-11-02T09:00:00Z" });
    // il database comanda sul testo, il codice copre le chiavi che mancano
    expect(testi.consensi.tastoInvio).toBe("Invia");
    expect(testi.regolamento).toEqual(DAL_CODICE.regolamento);
  });

  it("«Rimetti com'era» riscrive il testo di partenza, non cancella la riga", async () => {
    const chiamate = [];
    rispondiCon({ "rest/v1/modulo_iscrizione_testi": (corpo, url) => { chiamate.push({ url, corpo }); return []; } });
    expect(await ripristinaTesto("regolamento")).toBe("");
    expect(chiamate.length).toBe(1);
    expect(chiamate[0].corpo.chiave).toBe("regolamento");
    expect(chiamate[0].corpo.corpo).toEqual(DAL_CODICE.regolamento);
    expect(chiamate[0].corpo.aggiornato_da.startsWith(PARTENZA)).toBe(true);
    expect(await ripristinaTesto("non-esiste")).toContain("Chiave sconosciuta");
  });

  it("salvare una correzione scrive l'autore", async () => {
    const chiamate = [];
    rispondiCon({ "rest/v1/modulo_iscrizione_testi": (corpo) => { chiamate.push(corpo); return []; } });
    expect(await salvaTesto("intro", { titolo: "x", sottotitolo: "y" }, "Elena")).toBe("");
    expect(chiamate[0]).toMatchObject({ chiave: "intro", aggiornato_da: "Elena" });
  });
});
