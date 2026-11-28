// LISTINI RIVENDITORI (18/11/2026).
//
// Quello che queste prove difendono sono TRE COSE, e nessuna è grafica.
//
// 1. LE REGOLE DI QUALIFICA, numero per numero, contro la tabella che il
//    titolare ha scritto nella specifica: le sei fasce dei
//    riassortimenti, le cinque fasce della revisione annuale, il rientro
//    col suo minimo e il suo massimo, le quattro verifiche trimestrali.
//    Sono i conti da cui dipende lo sconto che una persona ottiene.
//
// 2. CHE IL CONTO DEI PREZZI STIA IN UN POSTO SOLO — il database — e che
//    la formula sia quella: cedibile troncato a tre decimali, limitato
//    fra zero e il tetto, costo mancante che vale il tetto e non zero.
//
// 3. CHE DAL FILE PER I RIVENDITORI NON ESCANO COSTI NÉ MARGINI, e che
//    con un livello solo spuntato il file non nomini gli altri livelli:
//    è la richiesta «per un rivenditore Professional spunto solo
//    Professional e il file non deve rivelare nulla degli altri».
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import PaginaListiniRivenditori from "../src/rivenditori/PaginaListiniRivenditori.jsx";
import {
  nominalePct, livelliAttivi, fineCiclo, volumeDelCiclo, tappeTrimestrali,
  livelloPerVolume, revisioneAnnuale, rientro, fasciaRiassortimento,
  avvisoFasciaSuperiore, totaleAiPrezziDi, scontoMaster,
} from "../src/rivenditori/regole.js";
import {
  csvListinoRivenditori, colonneListino, titoloListino, righeEsportabili, righeIntestazione,
  creaListinoRivenditoriPdf, categorieDelListino, nomeCategoria, intestazioneACapo, regoleSconti,
} from "../src/rivenditori/listinoPdf.js";
import { CHIAVE_CATEGORIE_ESCLUSE, CHIAVE_PRODOTTI_ESCLUSI } from "../src/rivenditori/dati.js";
import { soloWinAnsi } from "../src/prezzi/winansi.js";
import { creaRegolamentoPdf, spezzaInRighe } from "../src/rivenditori/regolamentoPdf.js";
import { composizioneRegolamento, tabellaRiassortimenti, esempioRientro } from "../src/rivenditori/regolamento-testo.js";
import { monta, attendi, clicca, scegli, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MIGRAZIONE = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261118100000_listini_rivenditori.sql"), "utf8");

// I cinque livelli come li ha scritti il titolare. Stessi numeri del
// seme della migrazione: una prova che li inventasse non difenderebbe
// niente.
const LIVELLI = [
  { id: 1, codice: "partner", nome: "Partner", ordine: 1, frazione: 0.2, ingresso_eur: 500, ingresso_cumulabile: true, mantenimento_eur: 500, riassortimento_minimo_eur: 100, attivo: true },
  { id: 2, codice: "standard", nome: "Standard", ordine: 2, frazione: 0.4, ingresso_eur: 500, ingresso_cumulabile: false, mantenimento_eur: 1000, riassortimento_minimo_eur: 150, attivo: true },
  { id: 3, codice: "professional", nome: "Professional", ordine: 3, frazione: 0.6, ingresso_eur: 1000, ingresso_cumulabile: false, mantenimento_eur: 2500, riassortimento_minimo_eur: 250, attivo: true },
  { id: 4, codice: "premium", nome: "Premium", ordine: 4, frazione: 0.8, ingresso_eur: 2000, ingresso_cumulabile: false, mantenimento_eur: 5000, riassortimento_minimo_eur: 400, attivo: true },
  { id: 5, codice: "distributor", nome: "Distributor", ordine: 5, frazione: 1, ingresso_eur: 3000, ingresso_cumulabile: false, mantenimento_eur: 7500, riassortimento_minimo_eur: 500, attivo: true },
];

// Le due righe di verifica della specifica, coi numeri che il database
// ha restituito il 18/11/2026 sui dati veri.
const ARIZONA = {
  id: "p-arizona", nome: "Arizona", tipo: "semplice", blocco: "PIGMENTI", blocco_ordine: 1, sullo_shop: true,
  pubblico_lordo: 44.9, pubblico_netto: 36.8, aliquota_iva: 22, costo: 10,
  sconto_max_pct: 50, nota: "pieno", prezzo_distributor: 18.4, margine_distributor_pct: 45.7, margine_distributor_eur: 8.4,
  prezzi: { partner: 33.12, standard: 29.44, professional: 25.76, premium: 22.08, distributor: 18.4 },
  sconti_pct: { partner: 10, standard: 20, professional: 30, premium: 40, distributor: 50 },
};
const KIT = {
  id: "p-kit", nome: "Kit laminazione ciglia", tipo: "bundle", blocco: "LAMINAZIONE", blocco_ordine: 7, sullo_shop: true,
  pubblico_lordo: 234.9, pubblico_netto: 192.54, aliquota_iva: 22, costo: 98.34,
  sconto_max_pct: 33.6, nota: "ridotto", prezzo_distributor: 127.85, margine_distributor_pct: 23.1, margine_distributor_eur: 29.51,
  prezzi: { partner: 179.6, standard: 166.66, professional: 153.72, premium: 140.79, distributor: 127.85 },
  sconti_pct: { partner: 6.7, standard: 13.4, professional: 20.2, premium: 26.9, distributor: 33.6 },
};
const SENZA_COSTO = {
  id: "p-ago", nome: "Ago 5 Magnum Universale 0.35 Cheyenne", tipo: "semplice", blocco: "AGHI", blocco_ordine: 4, sullo_shop: true,
  pubblico_lordo: 35, pubblico_netto: 28.69, aliquota_iva: 22, costo: null,
  sconto_max_pct: 50, nota: "costo_mancante", prezzo_distributor: 14.35, margine_distributor_pct: null, margine_distributor_eur: null,
  prezzi: { partner: 25.82, standard: 22.95, professional: 20.08, premium: 17.21, distributor: 14.35 },
  sconti_pct: { partner: 10, standard: 20, professional: 30, premium: 40, distributor: 50 },
};
const SOTTO_COSTO = {
  id: "p-blk", nome: "Dynamic BLKOUT Ink 240 ml (8 oz)", tipo: "semplice", blocco: "PIGMENTI", blocco_ordine: 1, sullo_shop: true,
  pubblico_lordo: 39.99, pubblico_netto: 32.78, aliquota_iva: 22, costo: 25.99,
  sconto_max_pct: 0, nota: "nessuno_sconto", prezzo_distributor: 32.78, margine_distributor_pct: 20.7, margine_distributor_eur: 6.79,
  prezzi: { partner: 32.78, standard: 32.78, professional: 32.78, premium: 32.78, distributor: 32.78 },
  sconti_pct: { partner: 0, standard: 0, professional: 0, premium: 0, distributor: 0 },
};
const LISTINO = [ARIZONA, SOTTO_COSTO, SENZA_COSTO, KIT];

const PARAMETRI = [
  { chiave: "ricarico_minimo_pct", numero: 30, descrizione: "" },
  { chiave: "tetto_sconto_pct", numero: 50, descrizione: "" },
  { chiave: "master_base_pct", numero: 10, descrizione: "" },
  { chiave: "master_promo_pct", numero: 20, descrizione: "" },
];

function database(extra = {}) {
  return rispondiCon({
    "rivenditori_livelli": LIVELLI,
    "rivenditori_parametri": PARAMETRI,
    "v_listino_rivenditori": LISTINO,
    "rivenditori_modifiche": [],
    "rivenditori_ordini": [],
    "rivenditori_verifiche": [],
    "rivenditori_regolamento": [],
    "rpc/listino_rivenditori_export": LISTINO,
    "intestazione_societa": { nome: "Elitederma" },
    "impostazioni_layout_tabelle": [],
    "rivenditori": [],
    ...extra,
  });
}

describe("i livelli e il loro sconto nominale", () => {
  it("i cinque livelli valgono 10/20/30/40/50 per cento, e nessuno di quei numeri è scritto a mano", () => {
    expect(LIVELLI.map((l) => nominalePct(l, 50))).toEqual([10, 20, 30, 40, 50]);
    // il nominale si ricava dal tetto: alzando il tetto si alzano tutti
    expect(LIVELLI.map((l) => nominalePct(l, 40))).toEqual([8, 16, 24, 32, 40]);
    const tabella = MIGRAZIONE.slice(MIGRAZIONE.indexOf("create table if not exists public.rivenditori_livelli"));
    expect(tabella.slice(0, tabella.indexOf(");"))).not.toMatch(/sconto_nominale|sconto_max/);
  });

  it("un livello spento esce da ogni conto, ma resta in archivio", () => {
    const spenti = LIVELLI.map((l) => (l.codice === "premium" ? { ...l, attivo: false } : l));
    expect(livelliAttivi(spenti).map((l) => l.codice)).toEqual(["partner", "standard", "professional", "distributor"]);
  });
});

describe("la tabella dei riassortimenti, riga per riga come l'ha scritta il titolare", () => {
  // Ogni ordine si valuta da solo: si applica il livello più alto
  // compatibile col valore dell'ordine, senza superare quello posseduto.
  const attesa = [
    ["da € 500", 600, [10, 20, 30, 40, 50]],
    ["€ 400-499,99", 450, [10, 20, 30, 40, 40]],
    ["€ 250-399,99", 300, [10, 20, 30, 30, 30]],
    ["€ 150-249,99", 200, [10, 20, 20, 20, 20]],
    ["€ 100-149,99", 120, [10, 10, 10, 10, 10]],
    ["sotto € 100", 90, [0, 0, 0, 0, 0]],
  ];
  attesa.forEach(([etichetta, importo, sconti]) => {
    it(`${etichetta}: ${sconti.join("/")}`, () => {
      expect(LIVELLI.map((posseduto) => fasciaRiassortimento(importo, posseduto, LIVELLI, 50).scontoPct)).toEqual(sconti);
    });
  });

  it("i confini sono quelli: 499,99 non è ancora la fascia da 500", () => {
    expect(fasciaRiassortimento(499.99, LIVELLI[4], LIVELLI, 50).scontoPct).toBe(40);
    expect(fasciaRiassortimento(500, LIVELLI[4], LIVELLI, 50).scontoPct).toBe(50);
    expect(fasciaRiassortimento(99.99, LIVELLI[0], LIVELLI, 50).motivo).toBe("sotto_il_minimo");
  });

  it("senza qualifica nessuno sconto, per quanto grande sia l'ordine", () => {
    expect(fasciaRiassortimento(10000, null, LIVELLI, 50)).toMatchObject({ scontoPct: 0, motivo: "senza_qualifica" });
  });

  it("la tabella del regolamento si COMPONE dai minimi d'ordine, non è scritta a parte", () => {
    const t = tabellaRiassortimenti(LIVELLI, 50);
    expect(t.testata).toEqual(["Ordine netto", "Partner", "Standard", "Professional", "Premium", "Distributor"]);
    expect(t.righe[0]).toEqual(["da € 500", "10%", "20%", "30%", "40%", "50%"]);
    expect(t.righe[1]).toEqual(["€ 400 - 499,99", "10%", "20%", "30%", "40%", "40%"]);
    expect(t.righe[4]).toEqual(["€ 100 - 149,99", "10%", "10%", "10%", "10%", "10%"]);
    expect(t.righe[5]).toEqual(["sotto € 100", "—", "—", "—", "—", "—"]);
  });
});

describe("la revisione annuale", () => {
  it("le cinque fasce sono le soglie di mantenimento, non una seconda tabella", () => {
    expect(livelloPerVolume(7500, LIVELLI).nome).toBe("Distributor");
    expect(livelloPerVolume(7499.99, LIVELLI).nome).toBe("Premium");
    expect(livelloPerVolume(5000, LIVELLI).nome).toBe("Premium");
    expect(livelloPerVolume(4999.99, LIVELLI).nome).toBe("Professional");
    expect(livelloPerVolume(2500, LIVELLI).nome).toBe("Professional");
    expect(livelloPerVolume(2499.99, LIVELLI).nome).toBe("Standard");
    expect(livelloPerVolume(1000, LIVELLI).nome).toBe("Standard");
    expect(livelloPerVolume(999.99, LIVELLI).nome).toBe("Partner");
    expect(livelloPerVolume(500, LIVELLI).nome).toBe("Partner");
    expect(livelloPerVolume(499.99, LIVELLI)).toBe(null);
  });

  it("dice se è una conferma, una salita o una discesa, e quale livello si è perso", () => {
    expect(revisioneAnnuale(8000, LIVELLI[4], LIVELLI)).toMatchObject({ esito: "confermato", perso: null });
    expect(revisioneAnnuale(5500, LIVELLI[4], LIVELLI).esito).toBe("sceso");
    expect(revisioneAnnuale(5500, LIVELLI[4], LIVELLI).perso.nome).toBe("Distributor");
    expect(revisioneAnnuale(5500, LIVELLI[1], LIVELLI).esito).toBe("salito");
  });

  it("un reso abbassa il volume del ciclo, perché è una riga negativa e non una riga cancellata", () => {
    const ordini = [
      { data: "2026-03-10", importo_netto: 3000 },
      { data: "2026-06-01", importo_netto: -500 },
      { data: "2028-01-01", importo_netto: 9000 }, // fuori dal ciclo
    ];
    expect(volumeDelCiclo(ordini, "2026-01-01")).toBe(2500);
  });
});

describe("la regola di rientro", () => {
  it("l'esempio della specifica: Distributor chiude a 5.500, mancano 2.000, minimo 3.000, rientra con 3.000", () => {
    expect(rientro(LIVELLI[4], 5500, LIVELLI)).toEqual({ mancavano: 2000, minimo: 3000, massimo: 6000, ordine: 3000 });
  });

  it("il massimo è il doppio dell'ordine d'ingresso: chi chiude a zero non deve 7.500 ma 6.000", () => {
    expect(rientro(LIVELLI[4], 0, LIVELLI)).toMatchObject({ mancavano: 7500, massimo: 6000, ordine: 6000 });
  });

  it("chi mancava di poco paga comunque il minimo del livello", () => {
    expect(rientro(LIVELLI[4], 7400, LIVELLI)).toMatchObject({ mancavano: 100, ordine: 3000 });
  });

  it("l'esempio nel regolamento si ricava dalla configurazione, quindi resta vero se le soglie cambiano", () => {
    const e = esempioRientro(LIVELLI);
    expect(e).toMatchObject({ livello: "Distributor", chiuso: 5500, mancavano: 2000, minimo: 3000, ordine: 3000 });
    const piuAlte = LIVELLI.map((l) => ({ ...l, mantenimento_eur: l.mantenimento_eur * 2, ingresso_eur: l.ingresso_eur * 2 }));
    expect(esempioRientro(piuAlte)).toMatchObject({ chiuso: 11000, mancavano: 4000, minimo: 6000 });
  });
});

describe("le verifiche trimestrali", () => {
  it("quattro tappe al 25, 50, 75 e 100 per cento della soglia annua", () => {
    const t = tappeTrimestrali(LIVELLI[4], 2000, "2026-01-15", "2026-05-01");
    expect(t.map((x) => x.obiettivo)).toEqual([1875, 3750, 5625, 7500]);
    expect(t.map((x) => x.scadenza)).toEqual(["2026-04-15", "2026-07-15", "2026-10-15", "2027-01-15"]);
    expect(t[0]).toMatchObject({ raggiunta: true, passata: true, mancano: 0 });
    expect(t[1]).toMatchObject({ raggiunta: false, passata: false, mancano: 1750 });
  });

  it("sono informative: niente in queste regole declassa qualcuno a metà ciclo", () => {
    const sorgente = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/regole.js"), "utf8");
    const dentro = sorgente.slice(sorgente.indexOf("export function tappeTrimestrali"), sorgente.indexOf("export function livelloPerVolume"));
    expect(dentro).not.toMatch(/declass|livello_id|nuovoLivello/);
  });

  it("il ciclo dura dodici mesi dall'ingresso, e il 29 febbraio non diventa il 1° marzo", () => {
    expect(fineCiclo("2026-11-18")).toBe("2027-11-18");
    expect(fineCiclo("2024-02-29")).toBe("2025-02-28");
    expect(fineCiclo("2026-01-31")).toBe("2027-01-31");
  });
});

describe("l'avviso «Mancano € X per la fascia superiore»", () => {
  const righe = (q) => [{ prezzi: ARIZONA.prezzi, quantita: q }];

  it("si dà solo se passando di sopra il totale SCENDE", () => {
    // sei Arizona: a prezzo Partner fanno 198,72 — oltre il minimo
    // Partner (100) ma sotto quello Standard (150)? no: 150 lo supera,
    // quindi la fascia è già Standard. Si prende un carrello piccolo.
    const piccolo = righe(4); // 132,48 a prezzi Partner
    const a = avvisoFasciaSuperiore(piccolo, LIVELLI[4], LIVELLI, 50);
    expect(a.livello.nome).toBe("Partner");
    expect(a.superiore.nome).toBe("Standard");
    // a prezzi Standard quattro Arizona fanno 117,76: sotto il minimo
    // Standard, quindi mancano 32,24 — e il totale di là è più basso
    expect(a.mancano).toBeCloseTo(32.24, 2);
    expect(a.frase).toContain("Mancano € 32,24 per la fascia superiore (Standard)");
  });

  it("al livello più alto possibile non c'è nessuna fascia superiore da promettere", () => {
    const a = avvisoFasciaSuperiore(righe(40), LIVELLI[4], LIVELLI, 50);
    expect(a.livello.nome).toBe("Distributor");
    expect(a.superiore).toBe(null);
    expect(a.frase).toBe(null);
  });

  it("il totale si misura ai prezzi del livello candidato, non a quelli di adesso", () => {
    expect(totaleAiPrezziDi(righe(2), LIVELLI[0])).toBe(66.24);
    expect(totaleAiPrezziDi(righe(2), LIVELLI[4])).toBe(36.8);
  });
});

describe("le master", () => {
  it("dieci per cento di base, venti se l'ultima verifica è rispettata", () => {
    expect(scontoMaster([], 10, 20)).toMatchObject({ pct: 10, motivo: "nessuna_verifica" });
    expect(scontoMaster([{ periodo_al: "2026-09-30", esito: "rispettato" }], 10, 20).pct).toBe(20);
    expect(scontoMaster([
      { periodo_al: "2026-06-30", esito: "rispettato" },
      { periodo_al: "2026-09-30", esito: "non_rispettato" },
    ], 10, 20).pct).toBe(10);
    // e un «non rispettato» vecchio non tiene giù chi è stato promosso dopo
    expect(scontoMaster([
      { periodo_al: "2026-03-31", esito: "non_rispettato" },
      { periodo_al: "2026-09-30", esito: "rispettato" },
    ], 10, 20).pct).toBe(20);
  });
});

describe("il motore dei prezzi sta nel database, e la formula è quella", () => {
  it("lo sconto cedibile è 1 − costo × (1 + ricarico) / netto, limitato fra zero e il tetto", () => {
    expect(MIGRAZIONE).toContain("1 - p_costo * (1 + p_ricarico_pct / 100.0) / p_netto");
    expect(MIGRAZIONE).toMatch(/greatest\(0::numeric, least\(/);
    expect(MIGRAZIONE).toContain("round(p_tetto_pct / 100.0, 3)");
  });

  it("si TRONCA a tre decimali, non si arrotonda: arrotondando, il prezzo scenderebbe sotto costo × ricarico", () => {
    expect(MIGRAZIONE).toContain("trunc((1 - p_costo * (1 + p_ricarico_pct / 100.0) / p_netto) * 1000) / 1000");
  });

  it("un costo che manca vale il TETTO, non zero: così il prodotto resta nel listino e si nomina", () => {
    const i = MIGRAZIONE.indexOf("create or replace function public.listino_cedibile");
    const corpo = MIGRAZIONE.slice(i, MIGRAZIONE.indexOf("$$;", i));
    expect(corpo).toMatch(/p_costo is null or p_costo <= 0 then round\(p_tetto_pct \/ 100\.0, 3\)/);
    expect(SENZA_COSTO.sconto_max_pct).toBe(50);
    expect(SENZA_COSTO.nota).toBe("costo_mancante");
  });

  it("il prezzo di un livello è netto × (1 − cedibile × frazione), a due decimali", () => {
    expect(MIGRAZIONE).toContain("round(p_netto * (1 - p_cedibile * p_frazione), 2)");
  });

  it("i prezzi non si calcolano una seconda volta nel browser", () => {
    const regole = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/regole.js"), "utf8");
    const pagina = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/PaginaListiniRivenditori.jsx"), "utf8");
    [regole, pagina].forEach((sorgente) => {
      expect(sorgente).not.toMatch(/1 - .*ricarico|ricarico.*\/ *netto/i);
      expect(sorgente).not.toMatch(/cedibile \* frazione|frazione \* cedibile/);
    });
  });

  it("i cinque livelli seminati sono quelli della specifica, soglie comprese", () => {
    const seme = MIGRAZIONE.slice(MIGRAZIONE.indexOf("insert into public.rivenditori_livelli"));
    expect(seme).toContain("('partner',      'Partner',      1, 0.2, 500,  true,  500,  100");
    expect(seme).toContain("('standard',     'Standard',     2, 0.4, 500,  false, 1000, 150");
    expect(seme).toContain("('professional', 'Professional', 3, 0.6, 1000, false, 2500, 250");
    expect(seme).toContain("('premium',      'Premium',      4, 0.8, 2000, false, 5000, 400");
    expect(seme).toContain("('distributor',  'Distributor',  5, 1.0, 3000, false, 7500, 500");
  });

  it("il ricarico minimo e il tetto stanno in una tabella di configurazione, non nel codice", () => {
    expect(MIGRAZIONE).toContain("('ricarico_minimo_pct', 30,");
    expect(MIGRAZIONE).toContain("('tetto_sconto_pct',    50,");
  });

  it("`set search_path` non è fra apici: fra apici è UNO schema con la virgola nel nome", () => {
    // il difetto trovato il 18/11 prima di pubblicare: con gli apici le
    // due funzioni plpgsql non trovavano `prodotti_shop`
    expect(MIGRAZIONE).not.toMatch(/search_path to 'public, pg_temp'/);
    expect(MIGRAZIONE).toMatch(/set search_path = public, pg_temp/);
  });
});

describe("il registro delle modifiche", () => {
  it("lo scrive un trigger sul prodotto, non la pagina del listino", () => {
    expect(MIGRAZIONE).toMatch(/after update of prezzo_vendita, costo_acquisto on public\.prodotti_shop/);
    expect(MIGRAZIONE).toMatch(/after update on public\.rivenditori_parametri/);
    expect(MIGRAZIONE).toMatch(/after update on public\.rivenditori_livelli/);
  });

  it("una modifica che arriva da un'altra strada resta registrata, scritta come senza nome", () => {
    expect(MIGRAZIONE).toContain("coalesce(v_chi, 'non registrato')");
  });

  it("il nome di chi scrive arriva dalla porta del listino e dura una transazione", () => {
    expect(MIGRAZIONE).toContain("perform set_config('app.operatore', coalesce(p_chi, ''), true)");
    const dati = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/dati.js"), "utf8");
    expect(dati).toContain('supabase.rpc("listino_scrivi_prezzo"');
    expect(dati).toContain("p_chi: chi || null");
  });

  it("il netto si ricava dal lordo in un posto solo, a sei decimali", () => {
    const dati = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/dati.js"), "utf8");
    expect(dati).toContain('import { nettoDaLordo } from "../prezzi/netto.js"');
    const netto = fs.readFileSync(path.join(process.cwd(), "src/prezzi/netto.js"), "utf8");
    expect(netto).toContain("1e6");
    // e App.jsx non ne tiene una copia sua
    const app = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
    expect(app).toContain('import { nettoDaLordo } from "./prezzi/netto.js"');
    expect(app).not.toMatch(/function nettoDaLordo\(/);
  });
});

describe("l'export per i rivenditori non porta costi né margini", () => {
  it("la funzione del server è `security definer` e non restituisce costo, margine né cedibile in euro", () => {
    const i = MIGRAZIONE.indexOf("create or replace function public.listino_rivenditori_export");
    const corpo = MIGRAZIONE.slice(i, MIGRAZIONE.indexOf("$$;", i));
    expect(corpo).toContain("security definer");
    expect(corpo).not.toMatch(/\bcosto\b/);
    expect(corpo).not.toMatch(/margine/);
  });

  it("il file nasce da quella lettura, non filtrando quella dell'admin", () => {
    const pagina = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/PaginaListiniRivenditori.jsx"), "utf8");
    const dentro = pagina.slice(pagina.indexOf("async function generaPdf"), pagina.indexOf("async function generaExcel"));
    expect(dentro).toContain("leggiListinoDaEsportare()");
    expect(dentro).not.toMatch(/\bvisibili\b|righe\.filter|righe,/);
  });

  it("nel foglio Excel non c'è nessuna colonna di costo o margine", () => {
    const testo = csvListinoRivenditori(LISTINO, LIVELLI);
    const testata = testo.split("\r\n")[0].toLowerCase();
    expect(testata).not.toContain("costo");
    expect(testata).not.toContain("margine");
    expect(testata).toContain("categoria;prodotto;");
    expect(testata).toContain("sconto max (sul prodotto)");
    // e i numeri sono quelli del database, virgola decimale
    expect(testo).toContain("PIGMENTI;Arizona;44,90;36,80;33,12;29,44;25,76;22,08;18,40;50%");
  });

  it("CON UN LIVELLO SOLO il file non nomina gli altri livelli, e lo sconto diventa «applicato»", () => {
    const soloPro = LIVELLI.filter((l) => l.codice === "professional");
    expect(titoloListino(soloPro)).toBe("Listino rivenditori - livello Professional");
    const colonne = colonneListino(soloPro).map((c) => c.titolo);
    expect(colonne).toEqual(["Pubblico consigliato", "Prezzo netto", "Prezzo Professional", "Sconto applicato"]);
    const testo = csvListinoRivenditori(LISTINO, soloPro);
    ["Partner", "Standard", "Premium", "Distributor", "Sconto max"].forEach((parola) => {
      expect(testo).not.toContain(parola);
    });
    // lo sconto scritto è quello DI QUEL LIVELLO su quel prodotto, non il massimo
    expect(testo).toContain("Kit laminazione ciglia;234,90;192,54;153,72;20,2%");
  });

  it("con più livelli la colonna torna «Sconto max sul prodotto», cioè lo sconto cedibile", () => {
    const colonne = colonneListino(LIVELLI).map((c) => c.chiave);
    expect(colonne[colonne.length - 1]).toBe("sconto_max");
  });

  it("l'intestazione dice sconto e soglia d'ingresso di ogni livello spuntato", () => {
    expect(righeIntestazione(LIVELLI, 50)[4]).toBe("Distributor (fino a -50%) - ingresso ordine € 3.000");
    // quattro cifre si raggruppano: in italiano non lo fanno da sole
    expect(righeIntestazione(LIVELLI, 50)[4]).not.toContain("3000");
    expect(righeIntestazione(LIVELLI, 50)[0]).toBe("Partner (fino a -10%) - ingresso € 500 di acquisti cumulati");
  });

  it("restano fuori i prodotti senza prezzo e quelli che non stanno sullo shop", () => {
    const righe = [...LISTINO,
      { ...ARIZONA, id: "x1", nome: "Senza prezzo", pubblico_netto: null },
      { ...ARIZONA, id: "x2", nome: "Solo al banco", sullo_shop: false }];
    expect(righeEsportabili(righe).map((r) => r.nome)).not.toContain("Senza prezzo");
    expect(righeEsportabili(righe).map((r) => r.nome)).not.toContain("Solo al banco");
    expect(righeEsportabili(righe)).toHaveLength(4);
  });
});

describe("il regolamento", () => {
  it("si compone dalla configurazione, quindi non può promettere soglie vecchie", () => {
    const c = composizioneRegolamento({ livelli: LIVELLI, tettoPct: 50 });
    const livelliBlocco = c.blocchi[0];
    expect(livelliBlocco.tabella.righe[0]).toEqual(["Partner", "fino a -10%", "€ 500 di acquisti cumulati", "€ 500", "€ 100"]);
    expect(livelliBlocco.tabella.righe[4]).toEqual(["Distributor", "fino a -50%", "ordine singolo € 3.000", "€ 7.500", "€ 500"]);
    const piuAlte = LIVELLI.map((l) => ({ ...l, mantenimento_eur: l.mantenimento_eur + 1000 }));
    expect(composizioneRegolamento({ livelli: piuAlte, tettoPct: 50 }).blocchi[0].tabella.righe[0][3]).toBe("€ 1.500");
  });

  it("i blocchi stanno nell'ordine chiesto, e in fondo ci sono le firme", () => {
    const c = composizioneRegolamento({ livelli: LIVELLI, tettoPct: 50 });
    expect(c.blocchi.map((b) => b.titolo)).toEqual([
      "1. I livelli del programma", "2. Come si entra",
      "3. Il ciclo, le verifiche e la revisione annuale", "4. La regola di rientro",
      "5. I riassortimenti", "6. Le master", "7. Condizioni generali",
      "8. Regolamento Commerciale Rivenditori Elitederma", "Accettazione",
    ]);
    expect(c.blocchi[c.blocchi.length - 1].firme).toBe(true);
    expect(c.blocchi[c.blocchi.length - 1].paragrafi.join(" ")).toContain("1341");
  });

  it("senza il testo integrale il documento lo DICE, invece di sembrare completo", () => {
    const c = composizioneRegolamento({ livelli: LIVELLI, tettoPct: 50 });
    const articoli = c.blocchi.find((b) => b.titolo.startsWith("8. "));
    expect(articoli.segnaposto).toBe(true);
    expect(articoli.paragrafi[0]).toContain("non è ancora stato caricato");
  });

  it("col testo caricato il segnaposto sparisce e si leggono gli articoli", () => {
    const c = composizioneRegolamento({
      livelli: LIVELLI, tettoPct: 50,
      regolamento: { versione: "2026.1", in_vigore_dal: "2026-12-01", corpo: { articoli: ["Art. 1 — prova"], clausole_1341: ["art. 7"] } },
    });
    const articoli = c.blocchi.find((b) => b.titolo.startsWith("8. "));
    expect(articoli.segnaposto).toBeUndefined();
    expect(articoli.paragrafi).toEqual(["Art. 1 — prova"]);
    expect(c.blocchi[c.blocchi.length - 1].paragrafi.join(" ")).toContain("art. 7");
  });

  it("nel regolamento non entra nessun costo né margine", () => {
    const c = composizioneRegolamento({ livelli: LIVELLI, tettoPct: 50 });
    const tutto = JSON.stringify(c).toLowerCase();
    expect(tutto).not.toContain("costo d'acquisto");
    expect(tutto).not.toContain("margine");
    expect(tutto).not.toContain("cedibile");
  });
});

describe("i due PDF escono davvero", () => {
  // Non si controlla l'impaginazione — jsdom non impagina — ma che
  // pdf-lib arrivi in fondo: un carattere fuori WinAnsi, un font non
  // innestato o una cifra nulla fanno fallire il documento a meta'
  // strada, e nessuna prova che guardi la struttura lo vedrebbe.
  it("il listino per i rivenditori, con tutti i livelli e con uno solo", async () => {
    const tutti = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { tettoPct: 50, righeSocieta: ["ELITEDERMA Srl"] });
    expect(String.fromCharCode(...tutti.bytes.slice(0, 5))).toBe("%PDF-");
    expect(tutti.prodotti).toBe(4);
    expect(tutti.pagine).toBeGreaterThan(0);
    const uno = await creaListinoRivenditoriPdf(LISTINO, LIVELLI.filter((l) => l.codice === "premium"), { tettoPct: 50 });
    expect(String.fromCharCode(...uno.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("il regolamento, col segnaposto e col testo caricato", async () => {
    const senza = await creaRegolamentoPdf(composizioneRegolamento({ livelli: LIVELLI, tettoPct: 50 }), { righeSocieta: ["ELITEDERMA Srl"] });
    expect(String.fromCharCode(...senza.bytes.slice(0, 5))).toBe("%PDF-");
    expect(senza.pagine).toBeGreaterThanOrEqual(2);
    const con = await creaRegolamentoPdf(composizioneRegolamento({
      livelli: LIVELLI, tettoPct: 50,
      regolamento: { versione: "2026.1", in_vigore_dal: "2026-12-01", corpo: { articoli: ["Art. 1 — L'adesione al programma non comporta esclusiva né minimi garantiti."], clausole_1341: ["art. 1"] } },
    }), { versione: "2026.1", inVigoreDal: "2026-12-01" });
    expect(String.fromCharCode(...con.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("un paragrafo va a capo misurando la larghezza vera, non contando i caratteri", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const righe = spezzaInRighe("IIII IIII IIII IIII IIII IIII IIII IIII IIII IIII", font, 9, 60);
    const larghe = spezzaInRighe("MMMM MMMM MMMM MMMM MMMM MMMM MMMM MMMM MMMM MMMM", font, 9, 60);
    expect(larghe.length).toBeGreaterThan(righe.length);
    righe.concat(larghe).forEach((r) => expect(font.widthOfTextAtSize(r, 9)).toBeLessThanOrEqual(60));
  });
});

describe("la pagina, montata per davvero", () => {
  it("ha le cinque schede, e il listino mostra i prezzi per livello", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    ["Listino", "Analisi margini", "Rivenditori", "Regolamento", "Registro modifiche"]
      .forEach((s) => expect(p.testo()).toContain(s));
    expect(p.testo()).toContain("Arizona");
    expect(p.testo()).toContain("33,12");
    expect(p.testo()).toContain("18,40");
    await p.smonta();
  });

  it("spuntando un livello solo, la tabella non mostra più le colonne degli altri", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    expect(p.nodo.querySelectorAll("[data-colonna]")).toHaveLength(5);
    // si spegne «Tutti» e si accende il solo Professional
    await clicca(p.nodo.querySelector('input[data-livello="tutti"]'));
    await clicca(p.nodo.querySelector('input[data-livello="professional"]'));
    expect([...p.nodo.querySelectorAll("[data-colonna]")].map((t) => t.dataset.colonna)).toEqual(["professional"]);
    const testata = p.nodo.querySelector("thead").textContent;
    expect(testata).toContain("Sconto");
    expect(testata).toContain("applicato");
    expect(testata).not.toContain("max");
    ["Partner", "Standard", "Premium", "Distributor"].forEach((nome) => expect(testata).not.toContain(nome));
    expect(p.nodo.querySelector("[data-un-livello]")).toBeTruthy();
    await p.smonta();
  });

  it("senza nessun livello spuntato i due tasti si spengono, e la pagina dice perché", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('input[data-livello="tutti"]'));
    expect(p.tasto("Genera listino").disabled).toBe(true);
    expect(p.tasto("Excel").disabled).toBe(true);
    expect(p.testo()).toContain("Nessun livello spuntato");
    await p.smonta();
  });

  it("le soglie dei livelli si cambiano da qui: stanno in tabella, non nel codice", async () => {
    const chiamate = [];
    database({ "rivenditori_livelli": (corpo, indirizzo) => { chiamate.push([indirizzo, corpo]); return LIVELLI; } });
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} operatore="Prova" />);
    await attendi(120);
    expect(p.nodo.querySelector("[data-soglie]")).toBeFalsy();
    await clicca(p.nodo.querySelector("[data-apri-soglie]"));
    expect(p.nodo.querySelectorAll("[data-soglia]")).toHaveLength(5);
    const casella = p.nodo.querySelector('[data-campo-soglia="distributor:mantenimento_eur"]');
    expect(casella.value).toBe("7.500,00");
    await scrivi(casella, "8000");
    casella.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
    await attendi(80);
    const scrittura = chiamate.find(([, corpo]) => corpo && corpo.mantenimento_eur === 8000);
    expect(scrittura, "la soglia non è stata scritta sul database").toBeTruthy();
    // e porta il nome di chi ha scritto, che è quello che il registro legge
    expect(scrittura[1].aggiornato_da).toBe("Prova");
    await p.smonta();
  });

  it("il filtro per nota tiene solo i prodotti di quel gruppo", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    const tendine = p.tendine();
    const tendinaNote = tendine.find((t) => (t.textContent || "").includes("Tutte le note"));
    await scegli(tendinaNote, "nessuno_sconto");
    expect(p.testo()).toContain("Dynamic BLKOUT Ink");
    expect(p.testo()).not.toContain("Arizona");
    await p.smonta();
  });

  it("l'analisi conta i quattro gruppi e mostra il margine, che nel listino non c'è", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-scheda="margini"]'));
    expect(p.nodo.querySelector('[data-contatore="pieno"]').textContent).toContain("1");
    expect(p.nodo.querySelector('[data-contatore="ridotto"]').textContent).toContain("1");
    expect(p.nodo.querySelector('[data-contatore="nessuno_sconto"]').textContent).toContain("1");
    expect(p.nodo.querySelector('[data-contatore="costo_mancante"]').textContent).toContain("1");
    expect(p.testo()).toContain("45,7%");  // il margine di Arizona al prezzo Distributor
    expect(p.testo()).toContain("Pavimento");
    await p.smonta();
  });

  it("i rivenditori: senza nessuno in elenco lo dice, e spiega perché si cura a mano", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-scheda="rivenditori"]'));
    expect(p.nodo.querySelector("[data-nessun-rivenditore]")).toBeTruthy();
    expect(p.testo()).toContain("nessun ordine dice");
    await p.smonta();
  });

  it("il regolamento avvisa che il testo integrale manca", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-scheda="regolamento"]'));
    expect(p.nodo.querySelector("[data-segnaposto-regolamento]")).toBeTruthy();
    expect(p.testo()).toContain("Genera regolamento");
    await p.smonta();
  });
});

// ---------------------------------------------------------------------
// LE CATEGORIE SI ESCLUDONO DAL LISTINO (18/11/2026)
//
// Chiesto dal titolare: «dividi la lista dei prodotti per categorie, con
// un flag che mi consenta di escluderne alcune dalla generazione del
// listino per il rivenditore». Quello che va difeso è che l'esclusione
// valga su TUTTE E TRE le uscite — PDF, foglio e conteggio in pagina —
// perché tre filtri scritti a parte direbbero tre numeri diversi sullo
// stesso listino; e che le righe escluse restino VISIBILI in pagina, o da
// lì dentro non si potrebbero più correggere prezzo e costo.
const LOGO = fs.readFileSync(path.join(process.cwd(), "public/logo-elitederma-testata.png"));

describe("le categorie si escludono dal listino", () => {
  it("le categorie si contano sulle righe ESPORTABILI, non su tutte", () => {
    const soloBanco = { ...ARIZONA, id: "p-banco", nome: "Solo al banco", blocco: "DA BANCO", blocco_ordine: 9, sullo_shop: false };
    const nomi = categorieDelListino([...LISTINO, soloBanco]).map((c) => c.nome);
    // una categoria fatta di merce che non si può spedire non si offre da
    // escludere: sarebbe una spunta che non fa niente
    expect(nomi).toEqual(["PIGMENTI", "AGHI", "LAMINAZIONE"]);
    expect(categorieDelListino(LISTINO).find((c) => c.nome === "PIGMENTI").quanti).toBe(2);
  });

  it("una categoria esclusa esce dalle righe del listino, e le altre restano", () => {
    expect(righeEsportabili(LISTINO).map((r) => r.nome)).toContain("Arizona");
    const rimaste = righeEsportabili(LISTINO, ["PIGMENTI"]).map((r) => r.nome);
    expect(rimaste).not.toContain("Arizona");
    expect(rimaste).not.toContain("Dynamic BLKOUT Ink 240 ml (8 oz)");
    expect(rimaste).toContain("Kit laminazione ciglia");
    expect(rimaste).toContain("Ago 5 Magnum Universale 0.35 Cheyenne");
  });

  it("una categoria senza nome vale «ALTRI PRODOTTI», e con quel nome si esclude", () => {
    const orfano = { ...ARIZONA, id: "p-orfano", nome: "Senza reparto", blocco: null, blocco_ordine: null };
    expect(nomeCategoria(orfano)).toBe("ALTRI PRODOTTI");
    expect(righeEsportabili([orfano], ["ALTRI PRODOTTI"])).toHaveLength(0);
  });

  it("il foglio Excel non nomina nemmeno la categoria esclusa", () => {
    const csv = csvListinoRivenditori(LISTINO, LIVELLI, ["PIGMENTI"]);
    expect(csv).not.toContain("PIGMENTI");
    expect(csv).not.toContain("Arizona");
    expect(csv).toContain("LAMINAZIONE");
  });

  it("il PDF esce con meno prodotti, e il conto che torna è quello vero", async () => {
    const tutto = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null });
    const senzaPigmenti = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null, escluse: ["PIGMENTI"] });
    expect(tutto.prodotti).toBe(4);
    expect(senzaPigmenti.prodotti).toBe(2);
  });

  it("escludere TUTTE le categorie non fa esplodere niente: esce un listino vuoto", async () => {
    const vuoto = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null, escluse: ["PIGMENTI", "AGHI", "LAMINAZIONE"] });
    expect(vuoto.prodotti).toBe(0);
    expect(new TextDecoder().decode(vuoto.bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("la testata dei listini", () => {
  it("il marchio è il file vero, e finisce DENTRO il PDF", async () => {
    const con = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: new Uint8Array(LOGO) });
    const testo = new TextDecoder("latin1").decode(con.bytes);
    expect(testo).toContain("/Image");
    expect(testo).toContain("/Subtype /Image");
  });

  it("senza il file del logo il listino esce lo stesso, col nome scritto", async () => {
    const senza = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null });
    const testo = new TextDecoder("latin1").decode(senza.bytes);
    expect(new TextDecoder().decode(senza.bytes.slice(0, 5))).toBe("%PDF-");
    expect(testo).not.toContain("/Subtype /Image");
  });

  it("un PNG rotto non fa fallire il listino a metà strada", async () => {
    const rotto = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: new Uint8Array([1, 2, 3, 4]) });
    expect(new TextDecoder().decode(rotto.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("un titolo di colonna che non ci sta va a capo invece di finire sopra quello accanto", () => {
    // il font finto misura 5 punti per carattere: basta a provare la
    // regola senza innestare Helvetica
    const font = { widthOfTextAtSize: (t) => t.length * 5 };
    expect(intestazioneACapo("PUBBLICO CONSIGLIATO", font, 7, 62)).toEqual(["PUBBLICO", "CONSIGLIATO"]);
    expect(intestazioneACapo("SCONTO APPLICATO", font, 7, 62)).toEqual(["SCONTO", "APPLICATO"]);
    // ci sta in una riga sola: non si spezza per abitudine
    expect(intestazioneACapo("PARTNER", font, 7, 62)).toEqual(["PARTNER"]);
    expect(intestazioneACapo("PREZZO NETTO", font, 7, 62)).toEqual(["PREZZO NETTO"]);
    // tre parole: restano due righe, perché la terza mangerebbe i prodotti
    expect(intestazioneACapo("PREZZO AL PUBBLICO CONSIGLIATO", font, 7, 62)).toHaveLength(2);
    // e una parola sola più lunga della colonna si taglia coi puntini
    expect(intestazioneACapo("PROFESSIONALISSIMO", font, 7, 40)[0]).toMatch(/\.\.\.$/);
  });

  it("l'euro si scrive € e non «EUR»: il simbolo passa il filtro WinAnsi", () => {
    expect(soloWinAnsi("€ 3.000")).toBe("€ 3.000");
    // e quello che WinAnsi non ha continua a cadere
    expect(soloWinAnsi("prezzo — speciale …")).toBe("prezzo - speciale ...");
  });

  it("la testata È UNA SOLA: nessuno dei due listini se la disegna per conto suo", () => {
    const rivenditori = fs.readFileSync(path.join(process.cwd(), "src/rivenditori/listinoPdf.js"), "utf8");
    const prezzi = fs.readFileSync(path.join(process.cwd(), "src/prezzi/listinoPdf.js"), "utf8");
    // il nome della ditta non si disegna più qui dentro: lo fa
    // `intestazione.js`, altrimenti i due fogli che arrivano alla stessa
    // persona avrebbero due carte intestate che si scostano al primo ritocco
    [rivenditori, prezzi].forEach((sorgente) => {
      expect(sorgente).not.toMatch(/drawText\([^)]*ELITEDERMA/);
      expect(sorgente).toContain("disegnaTestata");
    });
  });
});

describe("la pagina divide i prodotti per categoria", () => {
  it("ogni categoria ha la sua banda, con la spunta e il conto", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    const bande = p.nodo.querySelectorAll("[data-categoria]");
    expect([...bande].map((b) => b.getAttribute("data-categoria"))).toEqual(["PIGMENTI", "AGHI", "LAMINAZIONE"]);
    expect(p.nodo.querySelector('[data-categoria-spunta="PIGMENTI"]').checked).toBe(true);
    expect(p.nodo.querySelector('[data-banda="PIGMENTI"]').textContent).toContain("2 prodotti");
    await p.smonta();
  });

  it("togliendo la spunta la categoria esce dal listino, e la pagina lo dice prima di generare", async () => {
    const scritture = [];
    database({ "impostazioni_layout_tabelle": (corpo) => { if (corpo) scritture.push(corpo); return []; } });
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-categoria-spunta="PIGMENTI"]'));
    await attendi(60);
    const scritta = scritture.flat().find((c) => c && c.chiave === CHIAVE_CATEGORIE_ESCLUSE);
    expect(scritta, "l'esclusione non è stata scritta").toBeTruthy();
    expect(scritta.valore).toEqual(["PIGMENTI"]);
    expect(p.testo()).toContain("Fuori dal listino una categoria");
    expect(p.nodo.querySelector('[data-fuori="PIGMENTI"]')).toBeTruthy();
    await p.smonta();
  });

  it("le righe di una categoria esclusa RESTANO in pagina: da qui si correggono prezzo e costo", async () => {
    database({ "impostazioni_layout_tabelle": [{ chiave: CHIAVE_CATEGORIE_ESCLUSE, valore: ["PIGMENTI"] }] });
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    expect(p.testo()).toContain("Arizona");
    expect(p.nodo.querySelector('[data-prezzo="Arizona"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-categoria-spunta="PIGMENTI"]').checked).toBe(false);
    await p.smonta();
  });

  it("senza nessuna esclusione la pagina dice quante categorie entrano", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    expect(p.nodo.querySelector("[data-escluse]").textContent).toContain("Tutte le 3 categorie");
    await p.smonta();
  });
});

// LE REGOLE IN APERTURA E LA SPUNTA PER PRODOTTO (18/11/2026, chieste dal
// titolare: «all'inizio le regole per ottenere la scontistica», e «tutti i
// flag vicino a tutti i prodotti, se ne deflaggo uno esce dal listino
// definitivamente»).
describe("le regole degli sconti aprono il listino", () => {
  it("si compongono dalle soglie dei livelli, non da un testo scritto a mano", () => {
    const testo = regoleSconti(LIVELLI, 50).flatMap((b) => [b.titolo, ...b.righe]).join("\n");
    expect(testo).toContain("Partner - sconto fino al 10%: si entra con € 500 di acquisti cumulati");
    expect(testo).toContain("Distributor - sconto fino al 50%: si entra con un singolo ordine da € 3.000");
    expect(testo).toContain("per mantenerlo servono € 7.500 di acquisti in dodici mesi");
    expect(testo).toContain("almeno € 500");
    // e seguono la tabella: alzata una soglia, il listino la dice nuova
    const alzati = LIVELLI.map((l) => (l.codice === "distributor" ? { ...l, mantenimento_eur: 9000 } : l));
    expect(regoleSconti(alzati, 50).flatMap((b) => b.righe).join(" ")).toContain("€ 9.000");
  });

  it("con un livello solo NON nominano gli altri livelli", () => {
    const pro = LIVELLI.filter((l) => l.codice === "professional");
    const testo = regoleSconti(pro, 50).flatMap((b) => [b.titolo, ...b.righe]).join(" ");
    expect(testo).toContain("Professional");
    ["Partner", "Standard", "Premium", "Distributor"].forEach((nome) => expect(testo).not.toContain(nome));
    expect(testo).toContain("almeno € 250");
    // nemmeno la soglia d'ingresso di un altro livello
    expect(testo).not.toContain("€ 3.000");
  });

  it("senza livelli scelti non c'è niente da spiegare", () => {
    expect(regoleSconti([], 50)).toEqual([]);
  });

  it("il PDF con le regole in testa esce lo stesso, con tutti i livelli e con uno", async () => {
    const tutti = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null });
    const uno = await creaListinoRivenditoriPdf(LISTINO, LIVELLI.slice(2, 3), { logo: null });
    [tutti, uno].forEach((r) => {
      expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe("%PDF-");
      expect(r.prodotti).toBe(4);
    });
  });

  it("la pagina mostra le stesse regole prima di generare", async () => {
    database();
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    await clicca(p.nodo.querySelector("[data-apri-regole]"));
    expect(p.nodo.querySelector("[data-regole]").textContent).toContain("Come si conserva lo sconto");
    await p.smonta();
  });
});

describe("ogni prodotto ha la sua spunta", () => {
  it("un prodotto tolto esce dal listino, dal foglio e dal PDF; gli altri restano", async () => {
    const rimaste = righeEsportabili(LISTINO, [], ["p-arizona"]).map((r) => r.nome);
    expect(rimaste).not.toContain("Arizona");
    expect(rimaste).toContain("Dynamic BLKOUT Ink 240 ml (8 oz)");
    expect(csvListinoRivenditori(LISTINO, LIVELLI, [], ["p-arizona"])).not.toContain("Arizona");
    const pdf = await creaListinoRivenditoriPdf(LISTINO, LIVELLI, { logo: null, prodottiEsclusi: ["p-arizona"] });
    expect(pdf.prodotti).toBe(3);
    // e la categoria resta: si toglie un prodotto, non il suo reparto
    expect(categorieDelListino(LISTINO).map((c) => c.nome)).toContain("PIGMENTI");
  });

  it("togliendo la spunta la scelta si salva per id, e la riga resta in pagina", async () => {
    const scritture = [];
    database({ "impostazioni_layout_tabelle": (corpo) => { if (corpo) scritture.push(corpo); return []; } });
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    const spunta = p.nodo.querySelector('[data-prodotto-spunta="Arizona"]');
    expect(spunta.checked).toBe(true);
    await clicca(spunta);
    await attendi(60);
    const scritta = scritture.flat().find((c) => c && c.chiave === CHIAVE_PRODOTTI_ESCLUSI);
    expect(scritta, "l'esclusione del prodotto non è stata scritta").toBeTruthy();
    expect(scritta.valore).toEqual(["p-arizona"]);
    expect(p.nodo.querySelector('[data-tolto="Arizona"]')).toBeTruthy();
    expect(p.nodo.querySelector('[data-prezzo="Arizona"]')).toBeTruthy();
    expect(p.nodo.querySelector("[data-prodotti-tolti]").textContent).toContain("Un prodotto tolto");
    await p.smonta();
  });

  it("un prodotto che non può entrare in nessun listino ha la spunta spenta", async () => {
    const soloBanco = { ...ARIZONA, id: "p-banco", nome: "Solo al banco", sullo_shop: false };
    database({ "v_listino_rivenditori": [...LISTINO, soloBanco] });
    const p = await monta(<PaginaListiniRivenditori onBack={() => {}} />);
    await attendi(120);
    const spunta = p.nodo.querySelector('[data-prodotto-spunta="Solo al banco"]');
    expect(spunta.disabled).toBe(true);
    expect(spunta.checked).toBe(false);
    await p.smonta();
  });
});
