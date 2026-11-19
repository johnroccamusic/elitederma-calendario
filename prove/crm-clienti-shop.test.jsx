// LA MAILING LIST DEI CLIENTI SHOP (17/11/2026).
//
// Il titolare: «dobbiamo attivare la possibilita' di fare mailing list
// anche per i clienti shop […] come succede per la lista di tutti i
// contatti importati dal CRM», e «metti un filtro che si chiama "solo
// quelli che non sono in CRM"», e si scrive a «tutti».
//
// Quello che queste prove difendono non e' la grafica: e' che i filtri
// nuovi arrivino al DATABASE (da li' passano sia l'elenco che i
// destinatari congelati di una campagna), che «non in CRM» resti una
// cosa CALCOLATA e non una colonna congelata, e che la pagina DICA il
// limite del filtro per reparto invece di far credere di aver scritto a
// tutti.
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import PaginaContatti, { riassuntoFiltri, filtriPerIlDatabase, pezziArchivio } from "../src/crm/PaginaContatti.jsx";
import { righeProvince } from "../scripts/genera-province-sql.mjs";
import { monta, attendi, clicca, scegli } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const MIGRAZIONE = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261117150000_la_mailing_list_dei_clienti_shop.sql"), "utf8");
const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/crm/PaginaContatti.jsx"), "utf8");

// il corpo di una funzione dentro la migrazione, per guardarci dentro
function corpoFunzione(nome) {
  const i = MIGRAZIONE.indexOf(`create or replace function public.${nome}`);
  expect(i, `la migrazione non dichiara ${nome}`).toBeGreaterThan(-1);
  const fine = MIGRAZIONE.indexOf("$function$;", i);
  return MIGRAZIONE.slice(i, fine);
}

const VALORI = {
  regioni: [{ valore: "Lazio", quanti: 3000 }],
  province: [], comuni: [], qualifiche: [], stati: [], trattati_da: [], mestieri: [], corsi: [], anni: [],
  reparti: [{ valore: "TUTTI I PIGMENTI", quanti: 684 }, { valore: "Laminazione", quanti: 121 }],
  totale: 24865, disiscritti: 0, senza_data: 0,
  clienti_shop: 1888, non_in_crm: 1108, shop_sincronizzato_il: "2026-11-17T18:45:59Z",
};

const CLIENTE_SHOP = {
  id: "s1", nome: "Simona", cognome: "De Vico", email: "simona@esempio.it", provincia: "Caserta", regione: "Campania",
  numero_richieste: 0, fonte_lista: "shop", acquisti_shop: 2, speso_shop: 244, stato_trattativa: "nessuna",
  primo_acquisto_shop_il: "2022-11-30", ultimo_acquisto_shop_il: "2026-03-04",
  reparti_acquistati: ["Laminazione", "TUTTI I PIGMENTI"], collegamento: "nessuno", da_verificare: false,
};
const ORDINI = [
  { id: "v1", numero_ordine: "4821", data_ordine: "2026-03-04T10:00:00Z", totale: 120,
    prodotti: [{ nome: "Glue Fixing Balm", quantita: 1 }] },
  { id: "v2", numero_ordine: "1190", data_ordine: "2022-11-30T10:00:00Z", totale: 124, prodotti: [] },
];

function prepara(chiamate, extra = {}) {
  rispondiCon({
    "rpc/crm_filtri_valori": VALORI,
    "rpc/crm_cerca_contatti": (corpo) => {
      chiamate.push(corpo);
      return { totale: 1, righe: [CLIENTE_SHOP], da: corpo.da, quanti: corpo.quanti };
    },
    "rest/v1/crm_richieste": [],
    "rest/v1/crm_contatti": { opportunita: [], email_aggiuntive: [], telefoni_aggiuntivi: [] },
    "rest/v1/crm_campagne_destinatari": [],
    "rest/v1/vendite_shop": ORDINI,
    ...extra,
  });
}

describe("il testo della migrazione", () => {
  it("le 107 province sono quelle generate da comuni-regioni.js, con la loro regione", () => {
    const attese = righeProvince();
    expect(attese).toHaveLength(107);
    for (const r of attese) {
      const riga = `('${r.sigla}', '${r.nome.replace(/'/g, "''")}', '${r.regione.replace(/'/g, "''")}')`;
      expect(MIGRAZIONE, `manca ${r.sigla}`).toContain(riga);
    }
    // e non ce ne sono altre: una sigla inventata vorrebbe dire una
    // persona agganciata alla regione sbagliata
    const quante = (MIGRAZIONE.match(/^ {2}\('[A-Z]{2}', /gm) || []).length;
    expect(quante).toBe(107);
  });

  it("i filtri nuovi arrivano tutti a crm_contatti_filtrati", () => {
    const f = corpoFunzione("crm_contatti_filtrati");
    for (const chiave of ["cliente_shop", "non_in_crm", "acquisto_dal", "acquisto_al", "reparto", "speso_da"]) {
      expect(f, `il filtro ${chiave} non si legge`).toContain(`filtri->>'${chiave}'`);
    }
    // e i filtri di prima sono ancora tutti li': questa funzione e'
    // l'unica WHERE della lista, riscriverla e perderne uno vorrebbe
    // dire una campagna spedita a gente che era stata esclusa
    for (const chiave of ["cerca", "anno", "dal", "al", "corso", "regione", "provincia", "comune",
      "qualifica", "stato", "trattato_da", "mestiere", "collegamento", "disiscritti", "da_verificare",
      "con_email", "senza_data"]) {
      expect(f, `il filtro ${chiave} e' scomparso`).toContain(`filtri->>'${chiave}'`);
    }
  });

  it("«non in CRM» si CALCOLA, e non si legge da una colonna", () => {
    const f = corpoFunzione("crm_contatti_filtrati");
    const i = f.indexOf("not f_non_in_crm");
    expect(i).toBeGreaterThan(-1);
    const blocco = f.slice(i, i + 260);
    expect(blocco).toContain("vetta_id_principale is null");
    expect(blocco).toContain("crm_richieste");
    // se guardasse `fonte_lista`, il giorno che quel cliente scrive
    // resterebbe «non in CRM» per sempre
    expect(blocco).not.toContain("fonte_lista");
  });

  it("reparto e periodo d'acquisto si guardano NELLO STESSO ordine", () => {
    const f = corpoFunzione("crm_contatti_filtrati");
    const i = f.indexOf("not sugli_ordini or exists");
    expect(i).toBeGreaterThan(-1);
    const blocco = f.slice(i, i + 520);
    expect(blocco).toContain("f_reparto is null or sr.reparto = f_reparto");
    expect(blocco).toContain("f_acq_dal is null");
    expect(blocco).toContain("f_acq_al is null");
    // una sola exists: due condizioni separate direbbero «ha comprato
    // laminazione una volta nella vita E qualcosa nel periodo»
    expect((f.match(/from vendite_shop_reparti sr/g) || []).length).toBe(1);
  });

  it("la sincronizzazione non riscrive mai disiscritto_il", () => {
    const f = corpoFunzione("crm_sincronizza_clienti_shop");
    // lo nomina per contarli, mai in un set
    expect(f).toContain("disiscritto_il is not null");
    expect(f).not.toMatch(/disiscritto_il\s*=/);
  });

  it("chi nasce dallo shop ha zero richieste e la sua fonte scritta", () => {
    const f = corpoFunzione("crm_sincronizza_clienti_shop");
    expect(f).toContain("numero_richieste");
    expect(f).toContain("0, 'shop'");
    // e i dati di Vetta si riempiono solo dove erano vuoti
    expect(f).toContain("telefono = coalesce(c.telefono");
    expect(f).toContain("provincia = coalesce(c.provincia");
    // il comune normalizzato non si scrive: la tendina dei comuni
    // mostrerebbe «ROMA», «roma» e «Roma»
    expect(f).not.toMatch(/\n\s+comune = /);
  });

  it("il prodotto di una riga si riconosce per id E per nome", () => {
    const i = MIGRAZIONE.indexOf("create or replace view public.vendite_shop_reparti");
    const vista = MIGRAZIONE.slice(i, MIGRAZIONE.indexOf(";", i));
    expect(vista).toContain("p.woo_product_id = nullif(riga->>'woo_product_id', '')::integer");
    expect(vista).toContain("lower(trim(p.nome)) = lower(trim(riga->>'nome'))");
    // il nome vale solo come ripiego, non al posto dell'id
    expect(vista).toContain("per_id.id is null");
  });

  it("il riassunto si rifa' ogni notte da se'", () => {
    expect(MIGRAZIONE).toContain("cron.schedule('crm-clienti-shop'");
    expect(MIGRAZIONE).toContain("select public.crm_sincronizza_clienti_shop()");
  });

  it("il rollback e' scritto, e non cancella chi ha gia' ricevuto una mail", () => {
    expect(MIGRAZIONE).toContain("ROLLBACK");
    const i = MIGRAZIONE.indexOf("-- ROLLBACK (da eseguire a mano");
    const coda = MIGRAZIONE.slice(i);
    expect(coda).toContain("crm_campagne_destinatari");
  });
});

describe("le regole pure della pagina", () => {
  it("il riassunto nomina i filtri dello shop", () => {
    expect(riassuntoFiltri({ cliente_shop: true })).toContain("clienti shop");
    expect(riassuntoFiltri({ non_in_crm: true })).toContain("non in CRM");
    expect(riassuntoFiltri({ reparto: "Laminazione" })).toContain("comprato Laminazione");
    expect(riassuntoFiltri({ speso_da: "100" })).toContain("100 €");
    const tutto = riassuntoFiltri({ cliente_shop: true, non_in_crm: true, reparto: "Aghi", speso_da: "50" });
    expect(tutto.split(" · ")).toHaveLength(4);
  });

  it("al database vanno solo le chiavi piene", () => {
    const f = filtriPerIlDatabase({ cliente_shop: false, non_in_crm: true, reparto: "", speso_da: "100", acquisto_dal: "2026-01-01", acquisto_al: "" });
    expect(f).toEqual({ non_in_crm: true, speso_da: "100", acquisto_dal: "2026-01-01" });
  });

  it("la frase dell'archivio regge con una delle due cose a zero", () => {
    expect(pezziArchivio({ clienti_shop: 1888, disiscritti: 12 })).toBe(", di cui 1888 clienti dello shop e 12 disiscritti");
    expect(pezziArchivio({ disiscritti: 12 })).toBe(", di cui 12 disiscritti");
    expect(pezziArchivio({ clienti_shop: 1888 })).toBe(", di cui 1888 clienti dello shop");
    expect(pezziArchivio({})).toBe("");
  });

  it("la campagna riceve GLI STESSI filtri della lista", () => {
    // se ne ricevesse una copia composta a parte, la mail andrebbe a
    // una lista diversa da quella contata a video
    expect(SORGENTE).toContain('setVista({ nome: "componi", filtri: filtriDb');
  });
});

describe("la pagina, montata", () => {
  it("ha la banda dello shop, con i due interruttori e i reparti veri", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    expect(p.nodo.querySelector("[data-banda-shop]")).toBeTruthy();
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("I clienti dello shop");
    expect(t).toContain("Solo clienti shop");
    expect(t).toContain("Solo quelli che non sono in CRM");
    expect(t).toContain("In archivio 24.865 contatti, di cui 1888 clienti dello shop");
    const reparti = [...p.nodo.querySelector('select[data-filtro="Reparto comprato"]').options].map((o) => o.value);
    expect(reparti).toEqual(["", "TUTTI I PIGMENTI", "Laminazione"]);
    await p.smonta();
  });

  it("la nota dice che il reparto si riconosce solo su parte degli ordini", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    const nota = p.nodo.querySelector("[data-nota-shop]").textContent.replace(/\s+/g, " ");
    expect(nota).toContain("1888");
    expect(nota).toContain("1108");
    expect(nota).toMatch(/non più a catalogo|non è più a catalogo/);
    expect(nota).toContain("non tutti");
    await p.smonta();
  });

  it("premendo «solo quelli che non sono in CRM» la domanda al database cambia", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    const prima = chiamate.length;
    const spunta = [...p.nodo.querySelectorAll("label")]
      .find((l) => (l.textContent || "").includes("Solo quelli che non sono in CRM"))
      .querySelector("input");
    await clicca(spunta);
    await attendi(150);
    expect(chiamate.length).toBeGreaterThan(prima);
    expect(chiamate.at(-1).filtri).toMatchObject({ non_in_crm: true });
    expect(p.testo().replace(/\s+/g, " ")).toContain("non in CRM");
    await p.smonta();
  });

  it("scegliendo un reparto il filtro va al database con quel nome", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    await scegli(p.nodo.querySelector('select[data-filtro="Reparto comprato"]'), "Laminazione");
    await attendi(150);
    expect(chiamate.at(-1).filtri).toMatchObject({ reparto: "Laminazione" });
    await p.smonta();
  });

  it("«Aggiorna i clienti shop» chiama la sincronizzazione e rilegge i conti", async () => {
    const chiamate = [];
    const sincronizzazioni = [];
    prepara(chiamate, {
      "rpc/crm_sincronizza_clienti_shop": (corpo) => {
        sincronizzazioni.push(corpo || {});
        return { email_shop: 1888, creati: 3, aggiornati: 1885 };
      },
    });
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    await clicca(p.tasto("Aggiorna i clienti shop"));
    await attendi(250);
    expect(sincronizzazioni).toHaveLength(1);
    expect(p.testo().replace(/\s+/g, " ")).toContain("3 clienti dello shop sono entrati in lista adesso");
    await p.smonta();
  });

  it("la scheda di un cliente shop mostra la spesa, i reparti e i suoi ordini", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(150);
    await clicca(p.nodo.querySelector('[data-contatto="s1"] [role="button"]'));
    await attendi(250);
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("Acquisti sullo shop (2)");
    expect(t).toContain("244,00 € in tutto");
    expect(t).toContain("Laminazione · TUTTI I PIGMENTI");
    expect(t).toContain("4821");
    expect(t).toContain("Glue Fixing Balm");
    await p.smonta();
  });
});
