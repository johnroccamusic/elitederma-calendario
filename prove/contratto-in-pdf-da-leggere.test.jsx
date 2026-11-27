// IL CONTRATTO SI SCARICA IN PDF, PER LEGGERLO (27/11/2026).
//
// Il titolare: «le maestre che devono firmare il contratto mi hanno
// chiesto un tasto che generi un PDF per la lettura del testo. Quindi
// nella loro area, vicino a dove c'e' scritto apri, puoi anche mettere
// un tasto che fa il PDF».
//
// TRE LIVELLI.
//
// COSA C'E' DENTRO IL FOGLIO: `sezioniDaLeggere` e' pura, e qui si
// controlla articolo per articolo. Serve perche' pdf-lib comprime il
// testo: un PDF generato non si rilegge con un confronto sui byte, e una
// prova che guardasse solo i byte direbbe «il file esiste» senza dire
// «dentro c'e' il contratto».
//
// IL PDF VERO, generato per davvero in jsdom come la bolla di
// accompagnamento: un carattere fuori WinAnsi o un testo vuoto fanno
// fallire pdf-lib a metà strada, e nessuna prova sulla struttura lo
// vedrebbe.
//
// IL GESTO: la pagina della firma montata, il tasto premuto. E la cosa
// che conta piu' di tutte: SCARICARE IL PDF NON APRE NESSUNA PORTA. Se
// bastasse, la regola «non si firma un documento che non si e' aperto»
// diventerebbe «non si firma un documento che non si e' scaricato».
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";
import FirmaContratto from "../src/contratti/FirmaContratto.jsx";
import {
  sezioniDaLeggere, creaPdfContrattoDaLeggere, nomeFileContrattoDaLeggere,
} from "../src/contratti/contrattoPdf.js";
import { righeDiLettura } from "../src/contratti/lettura.js";
import { DAL_CODICE } from "../src/contratti/testi.js";

const MASTER = "11111111-1111-1111-1111-111111111111";
const sorgente = fs.readFileSync(path.join(process.cwd(), "src/contratti/contrattoPdf.js"), "utf8");

// LA MIGRAZIONE CHE COMANDA E' L'ULTIMA CHE DEFINISCE LA FUNZIONE, non
// una scritta a mano in questa prova: il giorno che ne nasce un'altra la
// guardia deve guardare quella, o resterebbe verde su un corpo che non
// gira piu' da nessuna parte.
function ultimaMigrazioneDellaLettura() {
  const dir = path.join(process.cwd(), "supabase/migrations");
  const file = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => fs.readFileSync(path.join(dir, f), "utf8")
      .includes("function public.contratto_master_segna_lettura"));
  expect(file.length).toBeGreaterThan(0);
  return fs.readFileSync(path.join(dir, file[file.length - 1]), "utf8");
}

describe("cosa c'è dentro il foglio da leggere", () => {
  it("c'è tutto quello che si firma, nell'ordine in cui si firma", () => {
    const sezioni = sezioniDaLeggere(DAL_CODICE, {});
    const parti = sezioni.map((s) => s.parte);
    expect(parti[0]).toBe("contratto");            // Le parti
    expect(parti).toContain("clausole");
    expect(parti).toContain("dichiarazioni");
    expect(parti[parti.length - 1]).toBe("manifesto");
    // le clausole vengono prima delle dichiarazioni, e l'Allegato A in
    // fondo: è l'ordine del cartaceo
    expect(parti.indexOf("clausole")).toBeLessThan(parti.indexOf("dichiarazioni"));
    // i ventitré articoli ci sono tutti, dal primo all'ultimo
    const articoli = sezioni.filter((s) => String(s.titolo || "").startsWith("Art. "));
    expect(articoli).toHaveLength(23);
    expect(articoli[0].titolo).toContain("Art. 1 ");
    expect(articoli[22].titolo).toContain("Art. 23 ");
  });

  it("il testo è quello del contratto, non una seconda stesura", () => {
    // si corregge un articolo come lo correggerebbe «Il testo del
    // contratto», e deve comparire sul foglio: se il PDF avesse una
    // copia propria degli articoli, qui resterebbe quella vecchia
    const testi = {
      ...DAL_CODICE,
      articoli: [{ titolo: "1. OGGETTO", punti: ["1.1 Frase corretta dal titolare."] }],
    };
    const sezioni = sezioniDaLeggere(testi, {});
    expect(JSON.stringify(sezioni)).toContain("Frase corretta dal titolare.");
    // e di articoli ce n'è uno: non è rimasta appesa nessuna copia dei
    // ventitré scritti nel codice
    expect(sezioni.filter((s) => s.parte === "contratto")).toHaveLength(3); // parti, premesse, l'articolo
  });

  it("l'epigrafe porta i dati scritti, e i trattini dove non c'è niente", () => {
    const con = JSON.stringify(sezioniDaLeggere(DAL_CODICE, {
      nome_cognome: "MARIA ROSSI", codice_fiscale: "RSSMRA80A41H501W",
    }));
    expect(con).toContain("MARIA ROSSI");
    expect(con).toContain("RSSMRA80A41H501W");
    // senza niente scritto resta il modello del cartaceo, coi suoi
    // segnaposti: è quello che lei vede anche nella pagina
    const senza = JSON.stringify(sezioniDaLeggere(DAL_CODICE, {}));
    expect(senza).toContain("[Nome e cognome]");
  });

  it("le tre dichiarazioni ci sono, vuote, e portano l'elenco delle clausole", () => {
    const d = sezioniDaLeggere(DAL_CODICE, {}).find((s) => s.parte === "dichiarazioni");
    expect(d.caselle).toHaveLength(3);
    expect(d.caselle.map((c) => c.chiave)).toEqual(["contratto", "clausole", "manifesto"]);
    // nessuna è spuntata: su questo foglio non si è dichiarato niente
    for (const c of d.caselle) expect(c.spuntata).toBeUndefined();
    const clausole = d.caselle.find((c) => c.chiave === "clausole").clausole;
    expect(clausole.length).toBeGreaterThanOrEqual(15);
    expect(clausole.join(" ")).toContain("Art. 3.6");
  });

  it("l'Allegato A è un documento suo, coi suoi blocchi", () => {
    const m = sezioniDaLeggere(DAL_CODICE, {}).find((s) => s.parte === "manifesto");
    expect(m.titolo).toBe(DAL_CODICE.manifesto.titolo);
    expect(m.blocchi.length).toBe(DAL_CODICE.manifesto.blocchi.length);
  });
});

describe("il PDF vero", () => {
  it("esce davvero, con dentro tutto il contratto", async () => {
    const bytes = await creaPdfContrattoDaLeggere({ testi: DAL_CODICE, dati: { nome_cognome: "MARIA ROSSI" } });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    // ventitré articoli, le clausole e l'Allegato A non stanno in due
    // pagine: se ne uscissero due, qualcosa è rimasto fuori
    expect(bytes.length).toBeGreaterThan(20000);
  });

  it("un carattere che il font non ha non fa fallire il foglio", async () => {
    const testi = {
      ...DAL_CODICE,
      articoli: [{ titolo: "1. OGGETTO — “prova”", punti: ["1.1 Un trattino lungo — e un ×, più 中文."] }],
    };
    const bytes = await creaPdfContrattoDaLeggere({ testi, dati: {} });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("il nome del file dice che è da leggere, non la copia firmata", () => {
    const nome = nomeFileContrattoDaLeggere(new Date("2026-11-27T10:00:00Z"));
    expect(nome).toBe("contratto-master-elitederma-da-leggere-2026-11-27.pdf");
  });

  // LA GUARDIA: il testo non si riscrive qui. Due stesure degli articoli
  // vorrebbero dire un PDF che dice una cosa e una firma che ne vale
  // un'altra.
  it("il generatore non contiene nemmeno un pezzo di clausola", () => {
    expect(sorgente).not.toContain("con sede legale in Roma");
    expect(sorgente).not.toMatch(/Art\. \d+\.\d+,/);
    expect(sorgente).toContain("blocchiContratto");
    expect(sorgente).toContain("casellePronte");
  });

  it("dice su ogni pagina che non è il documento firmato", () => {
    // la frase sta in una costante sola, e la usano la testata e il
    // piede di ogni pagina: un foglio trovato staccato dagli altri non
    // deve poter passare per una pagina del contratto firmato
    expect(sorgente).toContain('const AVVISO = "COPIA PER LA LETTURA');
    const piede = sorgente.slice(sorgente.indexOf("const pagine = pdf.getPages()"));
    expect(piede).toContain("AVVISO");
  });
});

// ------------------------------------------------------------------ il gesto

function banco(vista) {
  const scritture = [];
  rispondiCon({
    "contratto_master_vista": () => vista,
    "contratto_master_segna_lettura": (corpo) => { scritture.push({ dove: "lettura", corpo }); return { ok: true }; },
    "contratto_master_bozza": (corpo) => { scritture.push({ dove: "bozza", corpo }); return { ok: true, id: "c1" }; },
    "/from(": () => [],
  });
  return scritture;
}

const VISTA = {
  aperta: true,
  master: { id: MASTER, nome: "MARIA ROSSI", escluso: false, escluso_motivo: null },
  contratto: null,
  firmato: null,
  dati: { nome_cognome: "MARIA ROSSI", email: "maria@example.it" },
  testi: {},
};

describe("il tasto nella pagina della firma", () => {
  beforeEach(() => {
    window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(["x"], { type: "image/png" }));
  });

  it("sta accanto a «Apri e leggi», e premuto compone il foglio e lo consegna", async () => {
    const scritture = banco(VISTA);
    let passato = null; let scaricato = null;
    const p = await monta(<FirmaContratto
      masterId={MASTER}
      generaPdf={async (x) => { passato = x; return new Uint8Array([37, 80, 68, 70]); }}
      scarica={(b, nome) => { scaricato = nome; }}
    />);
    await attendi(120);
    const tasto = p.nodo.querySelector('[data-campo="pdf-contratto"]');
    expect(tasto).toBeTruthy();
    // davvero accanto: i due tasti stanno nella stessa riga
    expect(tasto.parentElement.querySelector('[data-campo="apri-contratto"]')).toBeTruthy();
    await clicca(tasto);
    await attendi(120);
    expect(scaricato).toMatch(/^contratto-master-elitederma-da-leggere-\d{4}-\d{2}-\d{2}\.pdf$/);
    // il foglio si compone col testo e coi dati che lei sta scrivendo
    expect(passato.dati.nome_cognome).toBe("MARIA ROSSI");
    expect(passato.testi.articoli.length).toBeGreaterThan(20);
    await p.smonta();
  });

  it("lo scarico si registra: chi legge il contratto in PDF non è chi non l'ha aperto", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto
      masterId={MASTER}
      generaPdf={async () => new Uint8Array([37, 80, 68, 70])}
      scarica={() => {}}
    />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-campo="pdf-contratto"]'));
    await attendi(120);
    const pdf = scritture.filter((s) => s.dove === "lettura" && s.corpo?.p_evento === "pdf");
    expect(pdf).toHaveLength(1);
    expect(pdf[0].corpo.p_master_id).toBe(MASTER);
    await p.smonta();
  });

  // LA COSA DA NON ROMPERE MAI.
  it("scaricare il PDF non conta come aver letto: la firma resta chiusa", async () => {
    banco(VISTA);
    const p = await monta(<FirmaContratto
      masterId={MASTER}
      generaPdf={async () => new Uint8Array([37, 80, 68, 70])}
      scarica={() => {}}
    />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-campo="pdf-contratto"]'));
    await attendi(120);
    expect(p.nodo.querySelector('[data-campo="manca-ancora"]').textContent)
      .toContain("Aprire il contratto e richiuderlo");
    expect(p.nodo.querySelector('[data-campo="firmo"]').getAttribute("aria-disabled")).toBe("true");
    // e la lavagna della firma non si è accesa
    expect(p.testo()).toContain("Prima apri e richiudi il contratto e l'Allegato A");
    await p.smonta();
  });

  it("se il foglio non si compone lo dice, e non registra nessuno scarico", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto
      masterId={MASTER}
      generaPdf={async () => { throw new Error("pdf-lib non risponde"); }}
      scarica={() => {}}
    />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-campo="pdf-contratto"]'));
    await attendi(120);
    expect(p.testo()).toContain("Il PDF non è stato composto: pdf-lib non risponde");
    expect(p.testo()).toContain("Apri e leggi");
    expect(scritture.filter((s) => s.corpo?.p_evento === "pdf")).toHaveLength(0);
    await p.smonta();
  });

  it("il tasto è uno: l'Allegato A sta dentro quel foglio, e lo dice", async () => {
    banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} generaPdf={async () => new Uint8Array([37])} scarica={() => {}} />);
    await attendi(120);
    expect(p.nodo.querySelector('[data-campo="pdf-manifesto"]')).toBeNull();
    expect(p.testo()).toContain("È anche dentro il PDF che si scarica qui sopra");
    expect(p.testo()).toContain("Non è la copia firmata");
    await p.smonta();
  });
});

describe("in «Contratti master» lo scarico si legge", () => {
  it("dice quante volte e quando, senza inventare secondi", () => {
    const tutto = righeDiLettura({}, {
      stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z",
      pdf_scaricato_il: "2026-11-27T09:00:00Z",
      pdf_scaricato_ultimo_il: "2026-11-27T18:30:00Z",
      pdf_scaricati: 2,
    }).join(" · ");
    expect(tutto).toContain("PDF del contratto scaricato 2 volte");
    expect(tutto).toContain("la prima volta il 27/11/2026");
    expect(tutto).toContain("l'ultima il 27/11/2026");
    expect(tutto).not.toContain("tenuto aperto");
  });

  it("chi l'ha scaricato e non aperto non legge due righe che si contraddicono", () => {
    const righe = righeDiLettura({}, {
      stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z",
      pdf_scaricato_il: "2026-11-27T09:00:00Z", pdf_scaricati: 1,
    });
    const tutto = righe.join(" · ");
    expect(tutto).toContain("se l'è portato via in PDF");
    expect(tutto).not.toContain("Il testo del contratto non l'ha mai aperto.");
  });

  it("chi non l'ha scaricato non ha nessuna riga in più", () => {
    const tutto = righeDiLettura({}, { stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z" }).join(" · ");
    expect(tutto).not.toContain("PDF");
    expect(tutto).toContain("Il testo del contratto non l'ha mai aperto.");
  });
});

describe("la guardia sulla migrazione", () => {
  const sql = ultimaMigrazioneDellaLettura();

  it("il database conosce l'evento del PDF", () => {
    expect(sql).toContain("p_evento not in ('pagina', 'contratto', 'manifesto', 'pdf')");
  });

  it("anche lo scarico vale solo su un contratto da firmare", () => {
    const f = sql.slice(sql.indexOf("function public.contratto_master_segna_lettura"));
    const update = f.split("update public.master_contratti set").slice(1);
    expect(update.length).toBe(4); // pagina, contratto, manifesto, pdf
    for (const u of update) expect(u).toContain("stato = 'da_firmare'");
    expect(f).toContain("'gia_firmato'");
  });

  // I SECONDI NON SI INVENTANO: quanto quel foglio sia stato tenuto
  // davanti agli occhi, fuori dall'app, non lo sa nessuno.
  it("lo scarico non scrive secondi di lettura", () => {
    const f = sql.slice(sql.indexOf("pdf_scaricato_il        = coalesce"));
    const fine = f.slice(0, f.indexOf("where id = c.id"));
    expect(fine).not.toContain("secondi");
  });

  it("niente on conflict sull'indice parziale", () => {
    const f = sql.slice(sql.indexOf("function public.contratto_master_segna_lettura"));
    expect(f).not.toMatch(/on conflict/i);
    expect(f).toContain("exception when unique_violation");
  });
});
