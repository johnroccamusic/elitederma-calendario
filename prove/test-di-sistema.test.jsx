// TEST DI SISTEMA — la metà che vive nel repo. 24/11/2026.
//
// Il titolare: «creiamo una funzione di test in cui mandiamo tutte le
// verifiche da fare per testare l'app in base a tutti i malfunzionamenti
// che hai trovato nel tempo, in modo che se un giorno vogliamo ripassare
// tutto abbiamo un sistema che si basa su vecchi bug e sulla loro
// risoluzione».
//
// IL TEST HA DUE METÀ, E QUESTA È QUELLA CHE GUARDA IL CODICE.
// `test_di_sistema()` nel database guarda lo stato vivo — dati, vincoli,
// permessi, cron. Qui si rileggono CODICE e MIGRAZIONI, e si inchioda
// quello che nel database non si vede: fra cui la trappola che il
// 24/11/2026 ha tenuto lo shop senza scaricare il magazzino per
// ventiquattro giorni.
import { describe, it, expect } from "vitest";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import TestDiSistema from "../src/sistema/TestDiSistema.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const migrazioni = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({ nome: f, testo: readFileSync(`supabase/migrations/${f}`, "utf8") }));

function sorgenti(cartelle) {
  const fuori = [];
  const gira = (dir) => {
    for (const voce of readdirSync(dir, { withFileTypes: true })) {
      const percorso = `${dir}/${voce.name}`;
      if (voce.isDirectory()) gira(percorso);
      else if (/\.(js|jsx|ts|tsx)$/.test(voce.name)) fuori.push({ percorso, testo: readFileSync(percorso, "utf8") });
    }
  };
  cartelle.forEach(gira);
  return fuori;
}

describe("un ON CONFLICT non può puntare a un indice PARZIALE", () => {
  // IL GUASTO: dal 31/10 al 24/11/2026 nessun ordine dello shop ha
  // scritto il suo movimento di magazzino — 64 ordini pagati, zero
  // righe. `upsert(..., { onConflict: "prodotto_id,riferimento" })` su un
  // indice unico PARZIALE (`where origine = 'ordine_online'`) risponde
  // **42P10**: Postgres non può inferire un indice parziale se la
  // scrittura non ripete il predicato, e PostgREST non lo manda. La
  // giacenza si scriveva, il movimento no, e il codice si fermava a un
  // `console.error`.
  //
  // Questa è la guardia che quel giorno è mancata, e non poteva esistere
  // altrove: nel database l'indice è giusto, nel codice l'upsert è
  // legittimo — è la COPPIA che non sta in piedi.
  const codice = sorgenti(["src", "supabase/functions"]);

  // gli indici unici PARZIALI dichiarati dalle migrazioni, con la loro
  // tabella. La tabella non e' un dettaglio: `prodotto_id` ha un indice
  // parziale su `riordini_in_corso` e la CHIAVE PRIMARIA su
  // `magazzino_scarti_shop` — confrontando le sole colonne si accusa di
  // un guasto chi non ne ha nessuno (preso al primo giro di questa prova)
  const indiciParziali = [];
  migrazioni.forEach(({ nome, testo }) => {
    const senzaCommenti = testo.replace(/--[^\n]*/g, "");
    const re = /create\s+unique\s+index[^;]*?on\s+(?:public\.)?["']?(\w+)["']?\s*\(([^)]*)\)([^;]*);/gis;
    let m;
    while ((m = re.exec(senzaCommenti))) {
      const colonne = m[2].split(",").map((c) => c.trim().replace(/\s+.*$/, "")).filter(Boolean);
      if (/\bwhere\b/i.test(m[3])) indiciParziali.push({ nome, tabella: m[1], colonne });
    }
  });

  it("le migrazioni dichiarano almeno un indice unico parziale, quindi la trappola esiste", () => {
    expect(indiciParziali.length).toBeGreaterThan(0);
  });

  it("nessun onConflict nomina un indice unico parziale della SUA tabella", () => {
    const colpevoli = [];
    codice.forEach(({ percorso, testo }) => {
      const senzaCommenti = testo.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const re = /onConflict:\s*["'`]([^"'`]+)["'`]/g;
      let m;
      while ((m = re.exec(senzaCommenti))) {
        const chiavi = m[1].split(",").map((c) => c.trim()).filter(Boolean).sort().join(",");
        // la tabella e' quella dell'ultimo `.from("...")` prima di qui
        const prima = senzaCommenti.slice(0, m.index);
        const daFrom = [...prima.matchAll(/\.from\(\s*["'`](\w+)["'`]/g)].pop();
        const tabella = daFrom ? daFrom[1] : "(sconosciuta)";
        const parziale = indiciParziali.find(
          (i) => i.tabella === tabella && [...i.colonne].sort().join(",") === chiavi);
        if (parziale) {
          colpevoli.push(`${percorso}: onConflict "${m[1]}" su ${tabella} punta all'indice PARZIALE di ${parziale.nome} — Postgres rispondera' 42P10 e la scrittura NON avverra'`);
        }
      }
    });
    expect(colpevoli, colpevoli.join("\n")).toEqual([]);
  });

  it("lo scarico dello shop scrive il movimento senza onConflict, e perdona il 23505", () => {
    const woo = readFileSync("supabase/functions/_shared/woo.ts", "utf8");
    const funzione = woo.slice(woo.indexOf("async function scriviMovimentoOnline"));
    const conCommenti = funzione.slice(0, funzione.indexOf("\n}\n"));
    // via i commenti: «onConflict» compare nella spiegazione del perche'
    // non si usa, e una prova che inciampa nella propria spiegazione
    // accusa il codice di un guasto che non ha
    const corpo = conCommenti.replace(/\/\/[^\n]*/g, "");
    expect(corpo).not.toMatch(/onConflict/);
    expect(corpo).toMatch(/insert\(movimento\)/);
    // la ripetizione di un webhook non è un errore: si perdona SOLO quella
    expect(corpo).toMatch(/23505/);
    // e un movimento non scritto non torna in un console.error: si vede
    expect(corpo).toMatch(/segnalaScaricoNonRiuscito/);
  });
});

describe("le guardie dei guasti vecchi restano in piedi", () => {
  it("la funzione test_di_sistema esiste ed è chiusa ad anon", () => {
    const f = migrazioni.find((m) => m.nome.includes("test_di_sistema"));
    expect(f, "manca la migrazione del test di sistema").toBeTruthy();
    expect(f.testo).toMatch(/create or replace function public\.test_di_sistema/);
    expect(f.testo).toMatch(/revoke all on function public\.test_di_sistema\(\) from public, anon/);
    expect(f.testo).toMatch(/grant execute on function public\.test_di_sistema\(\) to authenticated/);
  });

  it("ogni controllo dichiara il guasto da cui nasce: senza la storia, un numero non si sa leggere", () => {
    const f = migrazioni.find((m) => m.nome.includes("test_di_sistema")).testo;
    // tante aree quante righe di esito: ogni `return query select` porta
    // area, controllo, esito, misura, atteso, nato_da e cosa_fare
    const quanti = (f.match(/return query/g) || []).length;
    expect(quanti).toBeGreaterThanOrEqual(20);
    // e ognuno nomina una data: è quella che permette di ritrovare il caso
    const conData = (f.match(/\d{1,2}\/\d{2}\/2026/g) || []).length;
    expect(conData).toBeGreaterThanOrEqual(15);
  });

  it("il test NON corregge niente: legge e dice", () => {
    const f = migrazioni.find((m) => m.nome.includes("test_di_sistema")).testo;
    const corpo = f.slice(f.indexOf("create or replace function"));
    expect(corpo).toMatch(/\bstable\b/);
    // un'ISTRUZIONE comincia la riga: dentro i messaggi si citano «for
    // update skip locked» e «alter table ... validate», che non scrivono
    // niente — una prova che li confonde non protegge, da' solo torto
    for (const scrittura of [/^\s*update\s+\w/im, /^\s*insert\s+into\b/im, /^\s*delete\s+from\b/im]) {
      expect(corpo, `il test di sistema non deve scrivere: ${scrittura}`).not.toMatch(scrittura);
    }
  });
});

describe("la pagina del referto", () => {
  const FINTE = [
    { area: "Shop", controllo: "Lo shop scala il magazzino", esito: "ok", misura: "ultimo scarico 24/11 17:43",
      atteso: "non indietro di piu' di qualche ora", nato_da: "24/11/2026: ON CONFLICT su un indice parziale", cosa_fare: "guarda i log" },
    { area: "Magazzino", controllo: "Il registro e la giacenza coincidono", esito: "guarda", misura: "10 prodotti",
      atteso: "zero", nato_da: "19/10/2026: il controllo notturno", cosa_fare: "contare lo scaffale" },
    { area: "Campagne", controllo: "Gli stati sono ammessi", esito: "rotto", misura: "vincolo assente",
      atteso: "otto stati", nato_da: "24/11/2026: nessuna campagna poteva partire", cosa_fare: "allarga il CHECK" },
  ];
  const finta = (righe = FINTE) => rispondiCon({ test_di_sistema: righe });

  it("mette in cima quello che è tornato, e conta i tre gruppi", async () => {
    finta();
    const { nodo } = await monta(<TestDiSistema />);
    await attendi();
    const righe = [...nodo.querySelectorAll("[data-controllo]")];
    expect(righe.length).toBe(3);
    // il rotto per primo: è quello per cui si apre la pagina
    expect(righe[0].getAttribute("data-controllo")).toBe("rotto");
    expect(nodo.querySelector('[data-conta="rotto"]').textContent).toBe("1");
    expect(nodo.querySelector('[data-conta="guarda"]').textContent).toBe("1");
    expect(nodo.querySelector('[data-conta="ok"]').textContent).toBe("1");
  });

  it("aperta una riga, racconta il guasto da cui nasce e cosa fare", async () => {
    finta();
    const { nodo } = await monta(<TestDiSistema />);
    await attendi();
    const riga = nodo.querySelector('[data-controllo="rotto"]');
    expect(riga.textContent).not.toContain("allarga il CHECK");
    await clicca(riga.querySelector("button"));
    expect(riga.textContent).toContain("Da quale guasto nasce");
    expect(riga.textContent).toContain("nessuna campagna poteva partire");
    expect(riga.textContent).toContain("allarga il CHECK");
  });

  it("su una riga a posto non propone niente da fare", async () => {
    finta([FINTE[0]]);
    const { nodo } = await monta(<TestDiSistema />);
    await attendi();
    const riga = nodo.querySelector('[data-controllo="ok"]');
    await clicca(riga.querySelector("button"));
    expect(riga.textContent).toContain("Da quale guasto nasce");
    expect(riga.textContent).not.toContain("Cosa fare");
  });

  it("se il test non può girare lo dice, invece di mostrare una pagina vuota", async () => {
    rispondiCon({ test_di_sistema: new Response(JSON.stringify({ message: "permission denied" }), { status: 403 }) });
    const { nodo } = await monta(<TestDiSistema />);
    await attendi();
    expect(nodo.textContent).toContain("non è potuto girare");
  });
});

// ---------------------------------------------- il giro di ogni notte
//
// «Fallo girare da solo ogni notte» (il titolare, poche ore dopo averlo
// chiesto a mano). Queste prove difendono le tre decisioni che rendono un
// sorvegliante utile invece di molesto.
describe("il giro notturno", () => {
  const notturno = migrazioni.find((m) => m.nome.includes("test_di_sistema_ogni_notte"));

  it("c'è, e il cron gira DOPO i lavori che producono i numeri che legge", () => {
    expect(notturno, "manca la migrazione del giro notturno").toBeTruthy();
    // 06:20: dopo saldi (05:15), riallineamento (05:30) e termometro
    // (05:45). Prima leggerebbe la fotografia di ieri
    expect(notturno.testo).toMatch(/cron\.schedule\(\s*'test-di-sistema-notturno',\s*'20 6 \* \* \*'/);
  });

  it("SCRIVE IL REFERTO PRIMA DI AVVISARE: se la mail non parte, resta cosa guardare", () => {
    const corpo = notturno.testo;
    const posInsert = corpo.indexOf("insert into test_sistema_esiti");
    const posAvviso = corpo.indexOf("net.http_post");
    expect(posInsert).toBeGreaterThan(0);
    expect(posAvviso).toBeGreaterThan(posInsert);
  });

  it("avvisa solo per quello che è NUOVO, e ricorda una volta a settimana", () => {
    // «un avviso ripetuto ogni quarto d'ora è un avviso che si spegne»
    expect(notturno.testo).toMatch(/rotti_nuovi/);
    expect(notturno.testo).toMatch(/array_length\(nuovi, 1\) > 0/);
    expect(notturno.testo).toMatch(/interval '7 days'/);
  });

  it("il referto resta come storico: da lì si vede il giorno in cui è cambiato", () => {
    expect(notturno.testo).toMatch(/create table if not exists public\.test_sistema_esiti/);
    expect(notturno.testo).toMatch(/referto jsonb not null/);
    // e non è leggibile da fuori
    expect(notturno.testo).toMatch(/enable row level security/);
    expect(notturno.testo).toMatch(/to authenticated/);
  });

  it("un lavoro notturno APPENA CREATO non è un lavoro fermo", () => {
    // trovato dal test su se stesso, un minuto dopo essere stato acceso:
    // senza nessun giro registrato veniva contato come «fermo da tre
    // giorni». Chi non ha nessuna esecuzione è nuovo e non si giudica
    const test = migrazioni.find((m) => m.nome.includes("test_di_sistema.sql")).testo;
    expect(test).toMatch(/create or replace function public\.test_di_sistema_cron_fermi/);
    expect(test).toMatch(/exists \(select 1 from cron\.job_run_details r where r\.jobid = j\.jobid\)/);
  });

  it("l'avviso non decide niente da sé: legge il referto già scritto", () => {
    const f = readFileSync("supabase/functions/test-di-sistema-avviso/index.ts", "utf8");
    // nessuna soglia e nessun controllo duplicato nella edge function:
    // due posti che decidono «cosa è rotto» darebbero due verdetti
    expect(f).toMatch(/from\("test_sistema_esiti"\)/);
    expect(f).not.toMatch(/interval|magazzino_scostamenti|pg_policies/);
    // e si autentica col gettone nato in Postgres, come gli altri cron
    expect(f).toMatch(/email_cron_ok/);
    expect(f).toMatch(/x-cron-token/);
  });

  it("scrive se la mail è partita davvero, invece di dichiararlo", () => {
    const f = readFileSync("supabase/functions/test-di-sistema-avviso/index.ts", "utf8");
    expect(f).toMatch(/avvisato: mailMandata \|\| push > 0/);
    expect(f).toMatch(/avviso_errore: erroreMail/);
  });
});
