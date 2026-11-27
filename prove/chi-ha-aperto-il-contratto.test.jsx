// CHI HA APERTO IL TESTO DEL CONTRATTO, ANCHE SENZA FIRMARE (27/11/2026).
//
// Il titolare: «un segnalatore per vedere almeno chi abbia aperto il
// testo magari senza firmare perche' non so chi ha posto attenzione o
// meno al contratto».
//
// TRE LIVELLI, come il lavoro del 16/11.
//
// I CONTI puri: i cinque gradini, che devono essere esclusivi — una
// master sta su uno e uno solo, o il segnalatore non torna con l'elenco
// che ha sotto.
//
// IL GESTO: le due pagine montate per davvero. Che aprendo la pagina
// della firma parta la registrazione; che richiudendo il testo si
// registri l'evento CON i secondi; che chi aveva letto ieri non debba
// riaprire oggi; e che «Contratti master» mostri i cinque segnalatori e
// dica, nome per nome, dove quella persona si e' fermata.
//
// LA GUARDIA, che e' la parte che dura: rilegge la migrazione e pretende
// le due cose che la rendono onesta — il tetto sui secondi (senza, una
// scheda lasciata aperta tutta la notte direbbe «sette ore di lettura»,
// un numero falso che nessuno metterebbe in dubbio) e che NESSUNA
// scrittura di lettura tocchi un contratto firmato.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";
import FirmaContratto from "../src/contratti/FirmaContratto.jsx";
import PaginaContrattiMaster from "../src/contratti/PaginaContrattiMaster.jsx";
import {
  GRADI, NOMI_GRADO, contaGradi, gradoContratto, righeDiLettura, durata, volte,
} from "../src/contratti/lettura.js";

const MASTER = "11111111-1111-1111-1111-111111111111";
const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261127120000_chi_ha_aperto_il_contratto.sql"), "utf8");

describe("i cinque gradini", () => {
  it("una master sta su un gradino e uno solo", () => {
    const righe = [
      { master: { nome: "A" }, contratto: { stato: "firmato", firmato_il: "2026-11-25T17:52:00Z" } },
      { master: { nome: "B" }, contratto: { stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z", testo_letto_il: "2026-11-25T17:20:00Z" } },
      { master: { nome: "C" }, contratto: { stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z" } },
      { master: { nome: "D" }, contratto: null },
      { master: { nome: "E", contratto_escluso: true }, contratto: null },
    ];
    expect(righe.map((r) => gradoContratto(r.master, r.contratto)))
      .toEqual(["firmato", "letto", "aperto", "mai", "fuori"]);
    const conti = contaGradi(righe);
    expect(conti).toEqual({ firmato: 1, letto: 1, aperto: 1, mai: 1, fuori: 1 });
    // la somma dei gradini e' l'elenco intero: un gradino che manca
    // vorrebbe dire una persona che non compare in nessun conteggio
    expect(GRADI.reduce((t, g) => t + conti[g], 0)).toBe(righe.length);
  });

  it("le chiavi ci sono sempre, anche a zero", () => {
    const conti = contaGradi([]);
    for (const g of GRADI) expect(conti[g]).toBe(0);
    for (const g of GRADI) expect(NOMI_GRADO[g]).toBeTruthy();
  });

  // L'ESCLUSIONE VINCE SU TUTTO: a quella persona la nuvola non compare,
  // quindi «non ha aperto» non e' una sua mancanza.
  it("chi e' fuori resta fuori anche se una riga di contratto esiste", () => {
    expect(gradoContratto({ contratto_escluso: true }, { stato: "da_firmare", testo_letto_il: "x" })).toBe("fuori");
  });

  // LE RIGHE PIU' VECCHIE DI QUESTA MISURAZIONE non hanno
  // `pagina_aperta_il`, e `creato_il` vale come prima apertura: fino al
  // 27/11/2026 una riga di contratto nasceva in un modo solo, la pagina
  // di firma che si apriva. Senza questo, le dodici master che hanno
  // aperto il 25/11 risulterebbero «mai aperto».
  it("una riga senza pagina_aperta_il vale «aperto» per la sua data di nascita", () => {
    expect(gradoContratto({}, { stato: "da_firmare", creato_il: "2026-11-25T17:17:00Z" })).toBe("aperto");
    expect(righeDiLettura({}, { stato: "da_firmare", creato_il: "2026-11-25T17:17:00Z" }).join(" "))
      .toContain("Pagina aperta");
  });

  it("i secondi e le volte si leggono in italiano, e lo zero non si scrive", () => {
    expect(durata(0)).toBe("");
    expect(durata(4)).toBe("4 s");
    expect(durata(100)).toBe("1 min 40 s");
    expect(durata(120)).toBe("2 min");
    expect(volte(0)).toBe("");
    expect(volte(1)).toBe("una volta");
    expect(volte(3)).toBe("3 volte");
  });

  // QUELLO CHE SI LEGGE SULLA RIGA e' il caso vero misurato il
  // 27/11/2026: pagina aperta, testo mai aperto, niente scritto.
  it("dice che il testo non e' mai stato aperto e che non ha scritto niente di suo", () => {
    const righe = righeDiLettura({}, {
      stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z", pagina_aperture: 1,
    });
    const tutto = righe.join(" · ");
    expect(tutto).toContain("Il testo del contratto non l'ha mai aperto.");
    expect(tutto).toContain("L'Allegato A non l'ha mai aperto.");
    expect(tutto).toContain("Non ha ancora scritto niente di suo");
    // e NON dice la frase falsa di prima
    expect(tutto).not.toContain("Ha cominciato a compilarlo");
  });

  it("col testo letto dice quando, quante volte e quanto l'ha tenuto aperto", () => {
    const tutto = righeDiLettura({}, {
      stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z", pagina_aperture: 2,
      pagina_vista_il: "2026-11-26T08:00:00Z",
      testo_letto_il: "2026-11-25T17:20:00Z", testo_aperture: 2, testo_secondi: 100,
      dati_scritti_il: "2026-11-25T17:30:00Z",
    }).join(" · ");
    expect(tutto).toContain("Contratto letto il 25/11/2026");
    expect(tutto).toContain("aperto 2 volte");
    expect(tutto).toContain("tenuto aperto 1 min 40 s");
    expect(tutto).toContain("Ha cominciato a compilarlo il 25/11/2026");
  });
});

// ------------------------------------------------------------------ il gesto

function banco(vista) {
  const scritture = [];
  rispondiCon({
    "contratto_master_vista": () => vista,
    "contratto_master_segna_lettura": (corpo) => { scritture.push({ dove: "lettura", corpo }); return { ok: true }; },
    "contratto_master_bozza": (corpo) => { scritture.push({ dove: "bozza", corpo }); return { ok: true, id: "c1" }; },
    "contratto_master_salva": (corpo) => { scritture.push({ dove: "salva", corpo }); return { ok: true, id: "c1" }; },
    "/storage/v1/object/master-documenti": () => ({ Key: "ok" }),
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

describe("la pagina della firma registra chi apre", () => {
  beforeEach(() => {
    window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(["x"], { type: "image/png" }));
  });

  it("aprire la pagina si registra, una volta sola", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(120);
    const pagine = scritture.filter((s) => s.dove === "lettura" && s.corpo?.p_evento === "pagina");
    expect(pagine).toHaveLength(1);
    expect(pagine[0].corpo.p_master_id).toBe(MASTER);
    await p.smonta();
  });

  // LA BOZZA NON PARTE PIU' DA SOLA, ed e' la correzione di un dato
  // falso: fino al 27/11 la pagina salvava al montaggio i precompilati
  // dell'anagrafica, e in archivio nascevano dodici righe su cui
  // «Contratti master» scriveva «Ha cominciato a compilarlo» senza che
  // nessuno avesse battuto un tasto.
  it("non salva nessuna bozza se nessuno ha scritto niente", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(1500);
    expect(scritture.filter((s) => s.dove === "bozza")).toHaveLength(0);
    await p.smonta();
  });

  it("richiudere il contratto lo registra, coi secondi", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(120);
    const apri = p.nodo.querySelector('[data-campo="apri-contratto"]');
    expect(apri).toBeTruthy();
    await clicca(apri);
    await attendi(30);
    // «Ho finito di leggere — chiudi», sullo stesso tasto
    await clicca(p.nodo.querySelector('[data-campo="apri-contratto"]'));
    await attendi(60);
    const letture = scritture.filter((s) => s.dove === "lettura" && s.corpo?.p_evento === "contratto");
    expect(letture).toHaveLength(1);
    expect(letture[0].corpo.p_secondi).toBeGreaterThanOrEqual(0);
    await p.smonta();
  });

  it("l'Allegato A si registra a parte: sono due documenti", async () => {
    const scritture = banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(120);
    await clicca(p.nodo.querySelector('[data-campo="apri-manifesto"]'));
    await attendi(30);
    await clicca(p.nodo.querySelector('[data-campo="apri-manifesto"]'));
    await attendi(60);
    expect(scritture.filter((s) => s.dove === "lettura" && s.corpo?.p_evento === "manifesto")).toHaveLength(1);
    expect(scritture.filter((s) => s.dove === "lettura" && s.corpo?.p_evento === "contratto")).toHaveLength(0);
    await p.smonta();
  });

  // APERTO E RICHIUSO IERI RESTA APERTO E RICHIUSO. Prima quelle due
  // spunte vivevano solo nello stato del browser: chi tornava il giorno
  // dopo trovava il riquadro che dice «prima apri e richiudi» invece
  // della lavagna per firmare.
  it("chi aveva letto ieri trova la lavagna della firma", async () => {
    banco({
      ...VISTA,
      contratto: {
        id: "c1", stato: "da_firmare",
        testo_letto_il: "2026-11-26T09:00:00Z",
        manifesto_letto_il: "2026-11-26T09:10:00Z",
      },
    });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(150);
    expect(p.testo()).not.toContain("Prima apri e richiudi il contratto");
    expect(p.testo()).toContain("✓ letto");
    await p.smonta();
  });

  it("chi non ha letto niente non vede la lavagna", async () => {
    banco(VISTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(150);
    expect(p.testo()).toContain("Prima apri e richiudi il contratto");
    await p.smonta();
  });

  // A FIRMA CHIUSA NON C'E' NIENTE DA REGISTRARE: la pagina non si apre,
  // e scrivere una lettura su una pagina che nessuno poteva vedere
  // sarebbe una traccia inventata.
  it("a firma chiusa non registra niente", async () => {
    const scritture = banco({ ...VISTA, aperta: false });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(150);
    expect(scritture.filter((s) => s.dove === "lettura")).toHaveLength(0);
    await p.smonta();
  });
});

describe("«Contratti master» mostra dove ognuna si e' fermata", () => {
  function bancoElenco(master, contratti) {
    rispondiCon({
      "/rest/v1/master?": () => master,
      "/rest/v1/master_contratti_testi": () => [],
      "/rest/v1/master_contratti": () => contratti,
      "/rest/v1/impostazioni_layout_tabelle": () => [{ valore: { aperta: true }, aggiornato_il: "2026-11-25T17:17:00Z" }],
    });
  }

  const CINQUE = [
    [
      { id: "m1", nome: "HA FIRMATO", contratto_escluso: false },
      { id: "m2", nome: "HA LETTO", contratto_escluso: false },
      { id: "m3", nome: "HA SOLO APERTO", contratto_escluso: false },
      { id: "m4", nome: "MAI ENTRATA", contratto_escluso: false },
      { id: "m5", nome: "STA FUORI", contratto_escluso: true, contratto_escluso_motivo: "Condizioni da riscrivere." },
    ],
    [
      { id: "c1", master_id: "m1", stato: "firmato", firmato_il: "2026-11-25T17:52:00Z", luogo_firma: "Milano", contratto_firmato: { origine: "server" } },
      { id: "c2", master_id: "m2", stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z", pagina_aperture: 3,
        testo_letto_il: "2026-11-25T17:20:00Z", testo_aperture: 1, testo_secondi: 240 },
      { id: "c3", master_id: "m3", stato: "da_firmare", pagina_aperta_il: "2026-11-25T18:17:00Z", pagina_aperture: 1 },
    ],
  ];

  it("i cinque segnalatori ci sono, e i numeri tornano", async () => {
    bancoElenco(...CINQUE);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    const riquadri = p.nodo.querySelectorAll("[data-segnalatore]");
    expect(riquadri).toHaveLength(5);
    const letti = {};
    for (const r of riquadri) letti[r.getAttribute("data-segnalatore")] = r.textContent;
    expect(letti.firmato).toContain("1");
    expect(letti.letto).toContain("1");
    expect(letti.aperto).toContain("1");
    expect(letti.mai).toContain("1");
    expect(letti.fuori).toContain("1");
    expect(letti.letto.toLowerCase()).toContain("non firmato");
    await p.smonta();
  });

  it("dice chi ha letto il testo senza firmare, con quanto l'ha tenuto aperto", async () => {
    bancoElenco(...CINQUE);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    const riga = p.nodo.querySelector('[data-riga="m2"]');
    expect(riga.getAttribute("data-grado")).toBe("letto");
    expect(riga.textContent).toContain("Ha letto");
    expect(riga.textContent).toContain("Contratto letto il 25/11/2026");
    expect(riga.textContent).toContain("tenuto aperto 4 min");
    expect(riga.textContent).toContain("Pagina aperta 3 volte");
    await p.smonta();
  });

  it("e chi ha solo aperto la pagina lo dice, senza accusarla di aver compilato", async () => {
    bancoElenco(...CINQUE);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    const riga = p.nodo.querySelector('[data-riga="m3"]');
    expect(riga.getAttribute("data-grado")).toBe("aperto");
    expect(riga.textContent).toContain("Solo aperto");
    expect(riga.textContent).toContain("Il testo del contratto non l'ha mai aperto.");
    expect(riga.textContent).not.toContain("Ha cominciato a compilarlo");
    await p.smonta();
  });

  it("chi non e' mai entrata lo dice, e la pagina avverte che il tempo non prova la lettura", async () => {
    bancoElenco(...CINQUE);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    expect(p.nodo.querySelector('[data-riga="m4"]').textContent)
      .toContain("Non ha mai aperto la pagina della firma.");
    expect(p.testo()).toContain("non");
    expect(p.testo().toLowerCase()).toContain("che l'abbia letto davvero");
    await p.smonta();
  });

  // LA SPUNTA «ESCLUDI» E I GRADINI STANNO NELLA STESSA RIGA (25 e
  // 27/11/2026). L'elenco tiene dentro anche le escluse, perche' la
  // spunta deve restare dove la si e' messa: quindi una esclusa dice
  // prima che e' fuori e poi dove era arrivata — se aveva gia' letto il
  // testo, va saputo nel momento in cui si spunta la casella.
  it("la casella «Escludi» c'e' su ogni riga, e chi e' fuori resta in elenco", async () => {
    bancoElenco(...CINQUE);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    expect(p.nodo.querySelectorAll('[data-campo="escludi"]')).toHaveLength(5);
    const riga = p.nodo.querySelector('[data-riga="m5"]');
    expect(riga).toBeTruthy();
    expect(riga.getAttribute("data-grado")).toBe("fuori");
    expect(riga.textContent).toContain("Non riceve il contratto: Condizioni da riscrivere.");
    expect(riga.querySelector('[data-campo="escludi"]').checked).toBe(true);
    await p.smonta();
  });

  it("una esclusa che aveva letto il testo lo dice ancora", async () => {
    bancoElenco(
      [{ id: "m9", nome: "ESCLUSA DOPO", contratto_escluso: true, contratto_escluso_motivo: "Condizioni da riscrivere." }],
      [{ id: "c9", master_id: "m9", stato: "da_firmare", pagina_aperta_il: "2026-11-25T17:17:00Z",
         pagina_aperture: 1, testo_letto_il: "2026-11-25T17:20:00Z", testo_secondi: 300 }],
    );
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    const riga = p.nodo.querySelector('[data-riga="m9"]');
    expect(riga.textContent).toContain("Non riceve il contratto");
    expect(riga.textContent).toContain("Contratto letto il 25/11/2026");
    expect(riga.textContent).toContain("tenuto aperto 5 min");
    await p.smonta();
  });
});

// UN TASTO CHE NON PUO' RIUSCIRE DEVE DIRE PERCHE' (27/11/2026). Il
// titolare ha premuto «Fai la copia» sull'unico contratto firmato e ha
// letto «Edge Function returned a non-2xx status code»: la funzione
// `contratto-master-firmato` non e' pubblicata, e il 404 della
// piattaforma arriva con `message` e non con `errore` — quindi perfino
// `testoErroreFunzione` tornava la frase inutile.
describe("«Fai la copia» su una funzione non pubblicata", () => {
  function bancoCopia(risposta) {
    rispondiCon({
      "/rest/v1/master?": () => [{ id: "m1", nome: "HA FIRMATO", contratto_escluso: false }],
      "/rest/v1/master_contratti_testi": () => [],
      "/rest/v1/master_contratti": () => [{
        id: "c1", master_id: "m1", stato: "firmato", firmato_il: "2026-11-25T17:52:00Z",
        luogo_firma: "Milano", contratto_firmato: { origine: "server" }, pdf_path: null,
      }],
      "/rest/v1/impostazioni_layout_tabelle": () => [{ valore: { aperta: true } }],
      "/functions/v1/contratto-master-firmato": () => risposta,
    });
  }

  it("dice che la funzione non e' pubblicata, e che la firma non si perde", async () => {
    bancoCopia(new Response(JSON.stringify({ code: "NOT_FOUND", message: "Requested function was not found" }),
                            { status: 404, headers: { "Content-Type": "application/json" } }));
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    await clicca(p.tasto("Fai la copia"));
    await attendi(150);
    const testo = p.testo();
    expect(testo).toContain("non è pubblicata sul server");
    expect(testo).toContain("La firma è registrata e non si perde");
    // e NON la frase che non dice niente
    expect(testo).not.toContain("non-2xx");
    await p.smonta();
  });

  it("un rifiuto vero della funzione si legge per quello che dice", async () => {
    bancoCopia(new Response(JSON.stringify({ ok: false, errore: "Il contratto non risulta firmato." }),
                            { status: 409, headers: { "Content-Type": "application/json" } }));
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    await clicca(p.tasto("Fai la copia"));
    await attendi(150);
    expect(p.testo()).toContain("Il contratto non risulta firmato.");
    expect(p.testo()).not.toContain("non è pubblicata sul server");
    await p.smonta();
  });

  // LA COPIA E' QUELLO CHE QUELLA PERSONA SI PORTA A CASA: un firmato
  // senza copia va detto sulla riga, non lasciato dedurre dal nome del
  // tasto accanto.
  it("un contratto firmato senza copia lo dice sulla riga", async () => {
    bancoCopia(new Response("{}", { status: 200 }));
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(150);
    expect(p.nodo.querySelector('[data-riga="m1"]').textContent)
      .toContain("La copia firmata non è stata composta: lei non ce l'ha.");
    await p.smonta();
  });
});

describe("la guardia sulla migrazione", () => {
  it("i secondi hanno un tetto", () => {
    expect(sql).toMatch(/least\(greatest\(coalesce\(p_secondi, 0\), 0\), \d+\)/);
  });

  // NESSUNA SCRITTURA DI LETTURA TOCCA UN CONTRATTO FIRMATO. Una firma e'
  // chiusa: chi rilegge il proprio contratto firmato non deve muovere
  // una data su una riga sottoscritta.
  it("ogni scrittura della lettura vale solo su un contratto da firmare", () => {
    const f = sql.slice(sql.indexOf("function public.contratto_master_segna_lettura"),
                        sql.indexOf("function public.contratto_master_bozza"));
    const update = f.split("update public.master_contratti set").slice(1);
    expect(update.length).toBe(3); // pagina, contratto, manifesto
    for (const u of update) expect(u).toContain("stato = 'da_firmare'");
    expect(f).toContain("'gia_firmato'");
  });

  it("i tre eventi sono quelli e non altri", () => {
    expect(sql).toContain("p_evento not in ('pagina', 'contratto', 'manifesto')");
  });

  // LA PORTA VALE ANCHE QUI, come per la bozza e per la firma.
  it("a firma chiusa il database non registra nessuna lettura", () => {
    const f = sql.slice(sql.indexOf("function public.contratto_master_segna_lettura"));
    expect(f.slice(0, f.indexOf("select * into c"))).toContain("contratti_master_firma_aperta()");
  });

  // L'ON CONFLICT SU UN INDICE PARZIALE E' LA TRAPPOLA DEL 24/11/2026:
  // Postgres risponde 42P10 e la scrittura non avviene. Qui l'indice
  // `master_contratti_uno_da_firmare` e' parziale, quindi la ripetizione
  // si prende con l'eccezione.
  it("non nomina un on conflict sull'indice parziale", () => {
    const f = sql.slice(sql.indexOf("function public.contratto_master_segna_lettura"));
    expect(f).not.toMatch(/on conflict/i);
    expect(f).toContain("exception when unique_violation");
  });

  it("la bozza scrive «ha scritto» solo quando i dati cambiano davvero", () => {
    const b = sql.slice(sql.indexOf("function public.contratto_master_bozza"));
    expect(b).toContain("p_dati is distinct from c.dati");
    expect(b).toContain("coalesce(dati_scritti_il, now())");
  });
});
