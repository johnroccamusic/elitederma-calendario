// CHIEDI AI DATI: il controllo della SELECT che scrive il modello.
import { describe, it, expect } from "vitest";
import { controllaSql, estraiJson, VISTE_ANALISI, CATALOGO_ANALISI } from "../supabase/functions/_shared/analisi.js";

describe("controllaSql", () => {
  it("accetta una SELECT sulle viste, anche incartata in ```sql", () => {
    const r = controllaSql("```sql\nselect prodotto, sum(quantita) q from analisi_vendite_righe group by 1 order by q desc limit 10;\n```");
    expect(r.ok).toBe(true);
    expect(r.sql.endsWith(";")).toBe(false);
  });
  it("rifiuta scritture, due istruzioni, tabelle base", () => {
    expect(controllaSql("delete from analisi_vendite").ok).toBe(false);
    expect(controllaSql("select 1 from analisi_vendite; select 2").ok).toBe(false);
    expect(controllaSql("select nome from iscritti").ok).toBe(false);
    const r = controllaSql("select * from analisi_vendite v join iscritti i on i.id = v.id");
    expect(r.ok).toBe(false);
    expect(r.errore).toContain("iscritti");
    expect(controllaSql("with q as (select 1) update analisi_spese set totale = 0").ok).toBe(false);
    expect(controllaSql("").ok).toBe(false);
  });
  it("lascia passare lateral e le funzioni di tabella", () => {
    expect(controllaSql("select * from analisi_spese s, lateral (select 1) x").ok).toBe(true);
    expect(controllaSql("with mesi as (select generate_series(1,12) m) select m from mesi join analisi_vendite v on v.mese = m").ok).toBe(true);
  });
  it("il catalogo nomina tutte le viste", () => {
    for (const v of VISTE_ANALISI) expect(CATALOGO_ANALISI).toContain(v);
  });
});

describe("estraiJson", () => {
  it("prende il JSON anche con testo intorno", () => {
    expect(estraiJson('Ecco: {"sql": "select 1 from analisi_vendite", "nota": "x"} fine')).toEqual({ sql: "select 1 from analisi_vendite", nota: "x" });
    expect(estraiJson("niente")).toBeNull();
  });
});
