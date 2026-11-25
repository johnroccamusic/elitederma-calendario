// «IN SPEDIZIONE» NON ERA FRA GLI STATI AMMESSI. 24/11/2026.
//
// Il titolare, alla prima campagna vera: «la prova ha funzionato ma
// l'invio massivo no: Edge Function returned a non-2xx status code».
//
// Il difetto non stava in nessun componente e non stava nella funzione
// d'invio: il 31/10/2026 il lotto ha iniziato a essere PRESO marcando le
// righe `in_spedizione` (`for update skip locked`, e' quello che impedisce
// i doppi invii), e il CHECK su `crm_campagne_destinatari.stato`, scritto
// il giorno prima con sette stati, non e' stato allargato. Il database
// rifiutava con un 23514, PostgREST lo restituiva come errore della RPC,
// la funzione lo girava in un 500: dal 31/10 nessuna campagna poteva
// partire, e in archivio tutte e 52.883 le righe erano ancora `in_coda`.
//
// QUESTA PROVA ESISTE PERCHE' UNA PROVA CHE MONTA UNA PAGINA NON L'AVREBBE
// MAI VISTO: il guasto viveva fra il database e il codice. Si rileggono le
// migrazioni, si ricava l'elenco degli stati che il database ammette
// ADESSO, e si pretende che ogni stato che qualcuno scrive o legge sia
// dentro quell'elenco.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { STATI_DESTINATARIO, COLORE_STATO_DESTINATARIO } from "../src/crm/ComponiMail.jsx";

const radice = path.resolve(__dirname, "..");
const cartellaMigrazioni = path.join(radice, "supabase", "migrations");

// l'elenco ammesso lo dice la migrazione PIU' RECENTE che definisce quel
// vincolo: e' il modo in cui la prova resta vera il giorno che si aggiunge
// uno stato, invece di inchiodare la lista di oggi
function statiAmmessiDalDatabase() {
  const file = fs.readdirSync(cartellaMigrazioni)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .filter((n) => fs.readFileSync(path.join(cartellaMigrazioni, n), "utf8")
      .match(/crm_campagne_destinatari[\s\S]{0,4000}?check\s*\(stato in \(/i))
    .pop();
  expect(file, "nessuna migrazione definisce il CHECK sullo stato dei destinatari").toBeTruthy();
  const sql = fs.readFileSync(path.join(cartellaMigrazioni, file), "utf8");
  // si salta il rollback, che e' commentato e porta il vincolo VECCHIO
  const vivo = sql.split("\n").filter((r) => !r.trim().startsWith("--")).join("\n");
  const dentro = vivo.match(/check\s*\(stato in \(([^)]*)\)/i);
  expect(dentro, `il CHECK vivo non si legge in ${file}`).toBeTruthy();
  return [...dentro[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

// gli stati della CAMPAGNA sono un altro elenco, nell'altro vincolo: la
// funzione d'invio scrive su tutte e due le tabelle, e confonderli
// vorrebbe dire una prova che accusa «in_invio» di non esistere
function statiAmmessiPerLaCampagna() {
  for (const n of fs.readdirSync(cartellaMigrazioni).filter((x) => x.endsWith(".sql")).sort().reverse()) {
    const sql = fs.readFileSync(path.join(cartellaMigrazioni, n), "utf8")
      .split("\n").filter((r) => !r.trim().startsWith("--")).join("\n");
    const m = sql.match(/default 'bozza' check \(stato in \(([^)]*)\)/i);
    if (m) return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  }
  throw new Error("nessuna migrazione definisce il CHECK sullo stato della campagna");
}

// gli stati che il codice NOMINA: la funzione d'invio (TypeScript) e la
// funzione SQL che prende il lotto
function statiNominatiDalCodice() {
  const sorgenti = [
    fs.readFileSync(path.join(radice, "supabase/functions/crm-campagna-invia/index.ts"), "utf8"),
    fs.readFileSync(path.join(cartellaMigrazioni, "20261031180000_campagne_lotti_atomici_e_disiscrizione_per_email.sql"), "utf8"),
  ].join("\n");
  const trovati = new Set();
  // stato: "x"   stato = 'x'   .eq("stato", "x")
  for (const m of sorgenti.matchAll(/stato["']?\s*[:=]\s*["']([a-z_]+)["']/g)) trovati.add(m[1]);
  for (const m of sorgenti.matchAll(/["']stato["']\s*,\s*["']([a-z_]+)["']/g)) trovati.add(m[1]);
  // .in("stato", ["a", "b"])   e   stato in ('a', 'b')
  for (const m of sorgenti.matchAll(/stato["']?\s*(?:,|in)\s*[[(]([^\])]*)[\])]/g)) {
    for (const s of m[1].matchAll(/["']([a-z_]+)["']/g)) trovati.add(s[1]);
  }
  trovati.delete("stato");
  return [...trovati];
}

describe("la campagna si spedisce: gli stati del codice e quelli del database sono gli stessi", () => {
  it("il database ammette «in_spedizione», che e' lo stato con cui il lotto si prende", () => {
    expect(statiAmmessiDalDatabase()).toContain("in_spedizione");
  });

  it("ogni stato che il codice scrive o legge e' ammesso da uno dei due CHECK", () => {
    const ammessi = [...statiAmmessiDalDatabase(), ...statiAmmessiPerLaCampagna()];
    const nominati = statiNominatiDalCodice();
    // se questa resta vuota la prova non sta controllando niente
    expect(nominati.length).toBeGreaterThan(3);
    const fuori = nominati.filter((s) => !ammessi.includes(s));
    expect(fuori, `questi stati il database li rifiuta: ${fuori.join(", ")}`).toEqual([]);
  });

  it("e ogni stato ammesso ha la sua etichetta in pagina, o si legge la chiave grezza", () => {
    const ammessi = statiAmmessiDalDatabase();
    const senzaNome = ammessi.filter((s) => !STATI_DESTINATARIO[s]);
    expect(senzaNome, `stati senza etichetta: ${senzaNome.join(", ")}`).toEqual([]);
    const senzaColore = ammessi.filter((s) => !COLORE_STATO_DESTINATARIO[s]);
    expect(senzaColore, `stati senza colore: ${senzaColore.join(", ")}`).toEqual([]);
  });

  it("la pagina non inventa stati che il database non conosce", () => {
    const ammessi = statiAmmessiDalDatabase();
    const inventati = Object.keys(STATI_DESTINATARIO).filter((s) => !ammessi.includes(s));
    expect(inventati, `etichette senza stato: ${inventati.join(", ")}`).toEqual([]);
  });
});

describe("il motivo di un invio non riuscito arriva fino a chi guarda", () => {
  const sorgente = fs.readFileSync(path.join(radice, "src/crm/ComponiMail.jsx"), "utf8");

  it("ogni chiamata a una edge function legge il corpo, non solo error.message", () => {
    expect(sorgente).toContain('import { testoErroreFunzione } from "../errore-funzione.js"');
    // il conto NON si inchioda a un numero: si contano le invoke e si
    // pretende che ognuna abbia la sua lettura del corpo. Inchiodarlo a
    // due ha fatto cadere questa prova il giorno che e' nata la terza
    // (il «rimetti in pari» del 25/11), che quella lettura ce l'aveva.
    const invoke = sorgente.match(/supabase\.functions\.invoke\(/g) || [];
    const usi = sorgente.match(/testoErroreFunzione\(error\)/g) || [];
    expect(invoke.length).toBeGreaterThanOrEqual(3);
    expect(usi.length).toBe(invoke.length);
  });

  it("e non torna il «error?.message» nudo, che dice solo «non-2xx»", () => {
    const righeInvoke = sorgente.split("\n").filter((r) => r.includes("error?.message"));
    expect(righeInvoke, `righe che mostrerebbero «non-2xx»: ${righeInvoke.join(" | ")}`).toEqual([]);
  });
});
