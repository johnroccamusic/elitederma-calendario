// IL CONTRATTO DI COLLABORAZIONE DELLA MASTER (16/11/2026).
//
// Tre cose si provano qui, e sono tre livelli diversi.
//
// IL TESTO: che sia tutto, e che i segnaposti del cartaceo non siano
// rimasti dentro. Un contratto con «entro il giorno [___]» stampato
// sopra una firma è un contratto che non dice quando si paga.
//
// LE REGOLE pure: come si compone l'epigrafe dai dati di chi firma, cosa
// manca per poter firmare, e — la più importante — che l'elenco dei
// campi obbligatori scritto in SQL coincida con quello scritto in
// JavaScript. Sono due linguaggi e due scritture: se si scostano, la
// pagina lascia firmare qualcosa che il database poi rifiuta, oppure
// (peggio) chiede un dato che il database non pretende e nessuno capisce
// perché il tasto resti spento.
//
// IL GESTO: la pagina montata per davvero. Che la firma NON si possa
// dare prima di aver aperto e richiuso i due documenti, che le tre
// dichiarazioni siano tre, che a chi è fuori la pagina dica il perché
// invece di mostrare un modulo, e che un contratto già firmato non si
// ripresenti da firmare.
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { monta, clicca, attendi, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";
import FirmaContratto from "../src/contratti/FirmaContratto.jsx";
import PaginaContrattiMaster from "../src/contratti/PaginaContrattiMaster.jsx";
import { partiDaLeggere } from "../src/contratti/LetturaContratto.jsx";
import { RIGHE, OBBLIGATORI } from "../src/contratti/disposizione.js";
import { CHIAVI, DAL_CODICE } from "../src/contratti/testi.js";
import {
  ARTICOLI, CAMPI, CASELLE, CLAUSOLE, MANIFESTO, PREMESSE,
  casellePronte, epigrafeMaster, giornoCorto, luogoEData, mancantiPerFirmare, vociClausole,
} from "../supabase/functions/_shared/contratto-master.js";

const MASTER = "11111111-1111-1111-1111-111111111111";

const PIENI = {
  nome_cognome: "MARIA ROSSI",
  sesso: "F",
  data_nascita: "1988-04-12",
  comune_nascita: "Roma",
  codice_fiscale: "RSSMRA88D52H501Z",
  citta_residenza: "Roma",
  cap_residenza: "00182",
  indirizzo_residenza: "Via Terni",
  civico_residenza: "90/A",
  partita_iva: "16179891003",
  email: "maria@example.it",
};

describe("il testo del contratto", () => {
  it("ci sono tutti e ventitré gli articoli, in ordine", () => {
    expect(ARTICOLI).toHaveLength(23);
    ARTICOLI.forEach((a, i) => expect(a.titolo).toMatch(new RegExp(`^Art\\. ${i + 1} – `)));
  });

  it("ogni articolo ha almeno un comma, e nessuno è vuoto", () => {
    for (const a of ARTICOLI) {
      expect(a.punti.length).toBeGreaterThan(0);
      for (const p of a.punti) expect(String(p).trim().length).toBeGreaterThan(0);
    }
  });

  it("le premesse sono le sei lettere più la riga che le rende parte del contratto", () => {
    expect(PREMESSE.punti.filter((p) => /^[A-F]\) /.test(p))).toHaveLength(6);
    expect(PREMESSE.punti.at(-1)).toContain("parte integrante del contratto");
  });

  // COSA SOSTITUISCE, E COSA NO (17/11/2026, confermato dal titolare:
  // «sostituisce solo gli accordi sulla docenza e sullo stesso
  // argomento»). «Di pari oggetto» non è un'imprecisione del cartaceo:
  // è il confine. Togliere quelle parole farebbe firmare la
  // cancellazione di una quota venditore, di una provvigione sui
  // prodotti o di un accordo da rivenditrice — accordi di un'altra
  // materia, che restano in piedi apposta (lo dicono anche gli
  // artt. 14.1 e 7.6). Allargarlo è una decisione sua, non una
  // sistemazione: se un giorno si allarga, questa prova deve cadere
  // con il suo perché scritto accanto.
  it("la premessa F sostituisce i soli accordi DI PARI OGGETTO, e salva i diritti maturati", () => {
    const f = PREMESSE.punti.find((p) => p.startsWith("F) "));
    expect(f).toContain("sostituisce i precedenti accordi di pari oggetto");
    expect(f).toContain("salvi i diritti già maturati");
    expect(f).toContain("pattuizioni che le parti indichino per iscritto come ancora efficaci");
    // e non vale a ritroso: nessuna penale per fatti anteriori
    expect(f).toContain("nessuna penale o restrizione qui prevista opera per fatti anteriori");
    // il contratto NON assorbe l'accordo sul marchio fra il titolare e
    // la Società: è l'esclusione dichiarata dell'art. 14.1
    const art14 = ARTICOLI.find((a) => a.titolo.startsWith("Art. 14 "));
    expect(art14.punti.find((p) => p.startsWith("14.1."))).toContain("non costituisce né sostituisce l'accordo tra il titolare e la Società");
  });

  // IL SEGNAPOSTO DELL'ART. 9.6, compilato come ha deciso il titolare.
  it("l'art. 9.6 dice il giorno 5, e non è rimasto un trattino", () => {
    const art9 = ARTICOLI.find((a) => a.titolo.startsWith("Art. 9 "));
    const comma = art9.punti.find((p) => p.startsWith("9.6."));
    expect(comma).toContain("entro il giorno 5 del mese successivo");
    expect(comma).not.toContain("[___]");
  });

  // Il corpo del contratto non deve contenere NESSUN trattino da
  // riempire a penna: i dati di chi firma non sono testo, li compone
  // `epigrafeMaster` dai valori veri.
  it("nel corpo non resta nessuno spazio in bianco del cartaceo", () => {
    const tutto = JSON.stringify([PREMESSE, ARTICOLI, CLAUSOLE, MANIFESTO, CASELLE]);
    expect(tutto).not.toMatch(/\[_+\]/);
    expect(tutto).not.toContain("[Nome e cognome]");
  });

  it("l'approvazione specifica ha le sedici clausole del cartaceo", () => {
    const voci = vociClausole();
    expect(voci).toHaveLength(16);
    expect(voci[0]).toContain("Art. 3.6");
    expect(voci.at(-1)).toContain("Art. 22.2");
    // il pallino lo rimette chi disegna l'elenco
    for (const v of voci) expect(v.startsWith("•")).toBe(false);
  });

  it("l'Allegato A ha i suoi diciannove blocchi e i cinque principi", () => {
    expect(MANIFESTO.blocchi).toHaveLength(19);
    const titoli = MANIFESTO.blocchi.map((b) => b.titolo);
    for (const p of ["Rispetto", "Disponibilità", "Professionalità", "Umiltà", "Sinergia"]) {
      expect(titoli).toContain(p);
    }
  });

  // LE TRE FIRME DEL CARTACEO SONO TRE ATTI, e qui sono tre caselle:
  // con una sola non si potrebbe dire a quale dei tre la persona abbia
  // aderito.
  it("le dichiarazioni sono tre, tutte obbligatorie, e quella delle clausole porta l'elenco", () => {
    expect(CASELLE).toHaveLength(3);
    expect(CASELLE.map((c) => c.chiave)).toEqual(["contratto", "clausole", "manifesto"]);
    for (const c of CASELLE) expect(c.tipo).toBe("obbligatoria");
    const pronte = casellePronte();
    expect(pronte[1].clausole).toHaveLength(16);
    expect(pronte[0].clausole).toBeUndefined();
  });

  it("i sette pezzi del testo ci sono tutti, anche senza database", () => {
    for (const k of CHIAVI) expect(DAL_CODICE[k]).toBeTruthy();
  });
});

describe("l'epigrafe del contratto", () => {
  it("si compone dai dati di chi firma", () => {
    const e = epigrafeMaster(PIENI);
    expect(e).toContain("MARIA ROSSI");
    expect(e).toContain("C.F. RSSMRA88D52H501Z");
    expect(e).toContain("nato/a a Roma il 12/04/1988");
    expect(e).toContain("residente in Roma");
    expect(e).toContain("CAP 00182");
    expect(e).toContain("P. IVA 16179891003");
    expect(e).toContain("email maria@example.it");
    expect(e.endsWith("di seguito «il/la Master».")).toBe(true);
  });

  // «VIA» NON SI APPICCICA DAVANTI SEMPRE: in archivio la via si scrive
  // come sta sulla busta, e prefissarla a occhi chiusi fa uscire «Via
  // Via Terni» su un contratto firmato.
  it("non raddoppia la parola «Via» quando c'è già", () => {
    expect(epigrafeMaster({ indirizzo_residenza: "Via Terni", civico_residenza: "90/A" })).toContain("Via Terni n. 90/A");
    expect(epigrafeMaster({ indirizzo_residenza: "VLE P TOGLIATTI" })).toContain("VLE P TOGLIATTI");
    expect(epigrafeMaster({ indirizzo_residenza: "Via Via Terni" })).not.toContain("Via Via Via");
    // e dove la parola manca, la mette
    expect(epigrafeMaster({ indirizzo_residenza: "monte pasubio" })).toContain("Via monte pasubio");
  });

  // UNA VOCE FACOLTATIVA CHE MANCA SI SALTA, non lascia i trattini: una
  // riga di trattini in un contratto firmato si legge come un campo che
  // qualcuno ha dimenticato di riempire.
  it("salta le voci facoltative che mancano, invece di lasciare i trattini", () => {
    const e = epigrafeMaster({ ...PIENI, pec: "" });
    expect(e).not.toContain("PEC");
    expect(e).not.toMatch(/\[_+\]/);
    const conPec = epigrafeMaster({ ...PIENI, pec: "mr@pec.it" });
    expect(conPec).toContain("PEC mr@pec.it");
  });

  it("senza niente resta il modello del cartaceo, così si vede che manca", () => {
    expect(epigrafeMaster({})).toContain("[Nome e cognome]");
  });

  it("la data si scrive come sul cartaceo, gg/mm/aaaa", () => {
    expect(giornoCorto("1988-04-12")).toBe("12/04/1988");
    expect(giornoCorto(null)).toBe("");
  });
});

describe("«Luogo e data»", () => {
  // IL LUOGO È IL SUO COMUNE DI RESIDENZA e la DATA È IL GIORNO IN CUI
  // FIRMA: «la data farà fede quella della compilazione».
  it("è il comune di residenza e il giorno della firma", () => {
    expect(luogoEData({ citta_residenza: "Roma" }, "2026-11-16")).toBe("Roma, 16 novembre 2026");
  });

  it("senza comune scrive solo la data, non un luogo inventato", () => {
    expect(luogoEData({}, "2026-11-16")).toBe("16 novembre 2026");
  });
});

describe("cosa manca per firmare", () => {
  it("a pagina vuota manca tutto, firma compresa", () => {
    const m = mancantiPerFirmare();
    expect(m).toContain("La firma");
    expect(m).toContain("Aprire il contratto e richiuderlo");
    expect(m).toContain("Foto del documento — fronte");
    expect(m).toContain("Foto del documento — retro");
    for (const c of CASELLE) expect(m).toContain(c.etichetta);
  });

  it("con tutto a posto non manca niente", () => {
    expect(mancantiPerFirmare({
      dati: PIENI,
      spunte: { contratto: true, clausole: true, manifesto: true },
      firma: "x", docFronte: "f", docRetro: "r", letto: true,
    })).toEqual([]);
  });

  // A CHI È NATA ALL'ESTERO il comune italiano non si chiede: la casella
  // è spenta, e pretenderla vorrebbe dire un contratto che non si può
  // firmare.
  it("a chi è nata all'estero non si chiede il comune italiano", () => {
    const senzaComune = { ...PIENI, comune_nascita: "", stato_nascita: "SVIZZERA" };
    const m = mancantiPerFirmare({
      dati: senzaComune,
      spunte: { contratto: true, clausole: true, manifesto: true },
      firma: "x", docFronte: "f", docRetro: "r", letto: true,
    });
    expect(m).toEqual([]);
    // ma a chi è nata in Italia sì
    expect(mancantiPerFirmare({
      dati: { ...PIENI, comune_nascita: "" },
      spunte: { contratto: true, clausole: true, manifesto: true },
      firma: "x", docFronte: "f", docRetro: "r", letto: true,
    })).toContain("Comune di nascita");
  });

  it("una dichiarazione non spuntata basta a fermare la firma", () => {
    const m = mancantiPerFirmare({
      dati: PIENI, spunte: { contratto: true, clausole: true },
      firma: "x", docFronte: "f", docRetro: "r", letto: true,
    });
    expect(m).toEqual([CASELLE[2].etichetta]);
  });
});

// L'ELENCO DEI CAMPI OBBLIGATORI VIVE IN DUE LINGUAGGI, e la
// duplicazione è voluta: in JavaScript serve alla pagina per scrivere
// «Manca ancora: …», in SQL serve a rifiutare. Perché non si scostino,
// questa prova legge tutti e due e pretende che coincidano. Senza, il
// giorno in cui qualcuno aggiunge un campo in uno solo dei due posti, la
// pagina lascia firmare qualcosa che il database rifiuta — o chiede un
// dato che nessuno pretende, e il tasto resta spento senza un motivo.
describe("il database e la pagina chiedono gli stessi dati", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261116120000_contratti_master.sql"), "utf8",
  );

  it("la migrazione dei contratti esiste e dichiara il suo elenco", () => {
    expect(sql).toContain("obbligatori constant text[] := array[");
  });

  it("i due elenchi dei campi obbligatori coincidono", () => {
    const dentro = sql.slice(sql.indexOf("obbligatori constant text[] := array["));
    const elenco = dentro.slice(0, dentro.indexOf("];"));
    const dalSql = [...elenco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const dalJs = CAMPI.filter((c) => c.obbligatorio).map((c) => c.chiave).sort();
    expect(dalSql).toEqual(dalJs);
  });

  it("e sono gli stessi che la pagina marca con l'asterisco", () => {
    expect([...OBBLIGATORI].sort()).toEqual(CAMPI.filter((c) => c.obbligatorio).map((c) => c.chiave).sort());
  });

  // CHI RESTA FUORI È UN DATO, non un nome nel codice: se domani il
  // titolare cambia idea su chi firma, non deve servire una
  // pubblicazione. La prova guarda che nel codice dell'app non ci sia
  // nessun nome di persona a decidere.
  it("l'esclusione è una colonna, e nel codice non c'è nessun nome", () => {
    expect(sql).toContain("contratto_escluso");
    for (const file of ["src/contratti/FirmaContratto.jsx", "src/contratti/PaginaContrattiMaster.jsx",
                        "src/contratti/dati.js", "supabase/functions/_shared/contratto-master.js"]) {
      const corpo = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(corpo).not.toMatch(/GIUMBINI/i);
    }
  });

  // LE SERRATURE CHE NON DIPENDONO DALL'IDENTITÀ. Con un solo account
  // Supabase per tutti, «authenticated» non dice chi sia la persona: il
  // ruolo lo decide ancora il Gate interno dell'app. Ma queste tre cose
  // il database le fa rispettare comunque, e sono quelle che contano.
  it("il database rifiuta la firma mancante, il testo mancante e la seconda firma", () => {
    expect(sql).toContain("'senza_firma'");
    expect(sql).toContain("'senza_contratto'");
    expect(sql).toContain("'gia_firmato'");
    expect(sql).toContain("'percorso_non_valido'");
    // e un contratto «firmato» senza firma non può nemmeno esistere
    expect(sql).toContain("master_contratti_firmato_completo");
  });

  it("riaprire archivia prima di sbloccare", () => {
    const riapri = sql.slice(sql.indexOf("function public.contratto_master_riapri"));
    const archivia = riapri.indexOf("insert into public.master_contratti_riaperture");
    const sblocca = riapri.indexOf("stato = 'da_firmare'", archivia > 0 ? 0 : 0);
    expect(archivia).toBeGreaterThan(-1);
    expect(archivia).toBeLessThan(riapri.indexOf("update public.master_contratti set"));
    expect(sblocca).toBeGreaterThan(-1);
  });
});

// IL TESTO CARICATO NEL DATABASE DEVE ESSERE QUELLO DEL CODICE.
//
// Lo script `supabase/testi-contratto-master.sql` è generato dal file
// del codice: se qualcuno corregge il testo e si dimentica di
// rigenerarlo, il database e il repo fanno firmare due contratti
// diversi, e nessuno sa quale ha sottoscritto quella persona.
describe("lo script che carica il testo è allineato al codice", () => {
  const seme = fs.readFileSync(path.join(process.cwd(), "supabase", "testi-contratto-master.sql"), "utf8");

  it("carica tutte e sette le chiavi", () => {
    for (const k of CHIAVI) expect(seme).toContain(`values ('${k}', $testo$`);
  });

  it("e per ognuna il testo è identico, carattere per carattere", () => {
    for (const k of CHIAVI) {
      const apre = seme.indexOf(`values ('${k}', $testo$`) + `values ('${k}', $testo$`.length;
      const chiude = seme.indexOf("$testo$::jsonb", apre);
      expect(chiude).toBeGreaterThan(apre);
      expect(seme.slice(apre, chiude)).toBe(JSON.stringify(DAL_CODICE[k]));
    }
  });
});

describe("la disposizione delle caselle", () => {
  const chiavi = RIGHE.flatMap((r) => r.campi.map((c) => c.chiave));

  it("ci sono tutte le caselle che il contratto vuole", () => {
    for (const c of CAMPI) expect(chiavi).toContain(c.chiave);
  });

  // I DUE STATI SUBITO DOPO IL NOME. Non è un gusto: una casella di
  // luogo incontrata prima dello Stato si riempie col paese sbagliato, e
  // il codice fiscale sotto viene calcolato come se la persona fosse
  // italiana (lezione del 7/11/2026 sul modulo di iscrizione).
  it("i due Stati vengono prima di ogni dato che da loro dipende", () => {
    const dove = (k) => chiavi.indexOf(k);
    expect(dove("stato_nascita")).toBeLessThan(dove("comune_nascita"));
    expect(dove("stato_nascita")).toBeLessThan(dove("codice_fiscale"));
    expect(dove("stato_residenza")).toBeLessThan(dove("codice_fiscale"));
    expect(dove("stato_residenza")).toBeLessThan(dove("citta_residenza"));
    expect(dove("stato_residenza")).toBeLessThan(dove("cap_residenza"));
    // e il nome viene per primo
    expect(dove("nome_cognome")).toBe(0);
  });

  // LE CASELLE NON SONO DEFINIZIONI NUOVE: dove la chiave esiste già
  // nell'anagrafica di un allievo, la definizione è quella — il comune
  // che si scegli dall'elenco, la data che è un calendario, il telefono
  // col suo prefisso.
  it("riusa le definizioni della scheda, invece di rifarle", () => {
    const per = Object.fromEntries(RIGHE.flatMap((r) => r.campi).map((c) => [c.chiave, c]));
    expect(per.comune_nascita.tipo).toBe("comuneNascita");
    expect(per.data_nascita.tipo).toBe("data");
    expect(per.telefono.tipo).toBe("telefono");
    expect(per.sesso.opzioni.map((o) => o.valore)).toEqual(["F", "M"]);
    expect(per.codice_fiscale.lunghezzaEsatta).toBe(16);
  });
});

// ------------------------------------------------------------------ il gesto

function banco(vista) {
  const scritture = [];
  rispondiCon({
    "contratto_master_vista": () => vista,
    "contratto_master_bozza": (corpo) => { scritture.push({ dove: "bozza", corpo }); return { ok: true, id: "c1" }; },
    "contratto_master_salva": (corpo) => { scritture.push({ dove: "salva", corpo }); return { ok: true, id: "c1" }; },
    "contratto_master_riapri": (corpo) => { scritture.push({ dove: "riapri", corpo }); return { ok: true }; },
    "/functions/v1/contratto-master-firmato": (corpo) => { scritture.push({ dove: "copia", corpo }); return { ok: true }; },
    "/storage/v1/object/master-documenti": () => ({ Key: "ok" }),
    "/from(": () => [],
  });
  return scritture;
}

const VISTA_VUOTA = {
  // `aperta: true`: le prove del gesto girano a porta aperta, che è la
  // condizione in cui c'è qualcosa da provare. La porta chiusa ha le sue
  // prove, in fondo.
  aperta: true,
  master: { id: MASTER, nome: "MARIA ROSSI", escluso: false, escluso_motivo: null },
  contratto: null,
  firmato: null,
  dati: { nome_cognome: "MARIA ROSSI", email: "maria@example.it" },
  testi: {},
};

describe("la pagina della firma, montata", () => {
  beforeEach(() => {
    // la lavagna della firma restituisce un PNG vero: con `toBlob` che
    // chiama indietro con `null` (la finta di preparazione.js) nessuna
    // firma potrebbe mai esistere, e la prova direbbe sempre «manca la
    // firma» per un motivo che non c'entra
    window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(["x"], { type: "image/png" }));
  });

  it("a chi è fuori dice il perché, e non mostra nessun modulo", async () => {
    banco({ ...VISTA_VUOTA, master: { id: MASTER, nome: "TIZIO", escluso: true, escluso_motivo: "Condizioni da riscrivere." } });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.testo()).toContain("Condizioni da riscrivere.");
    expect(p.tasto("Firmo il contratto")).toBeUndefined();
    await p.smonta();
  });

  it("un contratto già firmato non si ripresenta da firmare", async () => {
    banco({
      ...VISTA_VUOTA,
      firmato: {
        id: "c1", stato: "firmato", firmato_il: "2026-11-16T10:00:00Z", luogo_firma: "Roma",
        dati: PIENI, consenso_contratto_il: "2026-11-16T10:00:00Z",
        consenso_clausole_il: "2026-11-16T10:00:00Z", consenso_manifesto_il: "2026-11-16T10:00:00Z",
        pdf_path: "contratti/x/contratto.pdf",
      },
    });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.testo()).toContain("Contratto firmato");
    expect(p.tasto("Firmo il contratto")).toBeUndefined();
    expect(p.tasto("Apri la copia firmata")).toBeTruthy();
    await p.smonta();
  });

  // IL TESTO VA APERTO E RICHIUSO PRIMA DI FIRMARE, e si segna alla
  // CHIUSURA: aperto e lasciato aperto vuol dire che ci si è scorsi
  // attraverso.
  it("finché i due documenti non sono stati aperti e richiusi non c'è lavagna per firmare", async () => {
    banco(VISTA_VUOTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.nodo.querySelector("canvas")).toBeNull();
    expect(p.testo()).toContain("Prima apri e richiudi il contratto e l'Allegato A");
    expect(p.testo()).toContain("Aprire il contratto e richiuderlo");

    // aperto e NON richiuso: non basta
    await clicca(p.nodo.querySelector('[data-campo="apri-contratto"]'));
    expect(p.nodo.querySelector("canvas")).toBeNull();

    // richiuso: il contratto è letto, ma l'Allegato A no
    await clicca(p.nodo.querySelector('[data-campo="apri-contratto"]'));
    expect(p.nodo.querySelector("canvas")).toBeNull();
    expect(p.testo()).toContain("Aprire l'Allegato A e richiuderlo");

    // aperto e richiuso anche l'Allegato A: adesso si può firmare
    await clicca(p.nodo.querySelector('[data-campo="apri-manifesto"]'));
    await clicca(p.nodo.querySelector('[data-campo="apri-manifesto"]'));
    expect(p.nodo.querySelector("canvas")).toBeTruthy();
    await p.smonta();
  });

  it("il contratto aperto mostra le parti, le premesse e gli articoli", async () => {
    banco(VISTA_VUOTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    await clicca(p.nodo.querySelector('[data-campo="apri-contratto"]'));
    const testo = p.testo();
    expect(testo).toContain("Art. 1 – Definizioni");
    expect(testo).toContain("Art. 23 – Disposizioni finali");
    expect(testo).toContain("Elitederma S.r.l., con sede legale in Roma");
    expect(testo).toContain("entro il giorno 5 del mese successivo");
    await p.smonta();
  });

  it("l'epigrafe si vede mentre si compila, con i dati che si stanno scrivendo", async () => {
    banco({ ...VISTA_VUOTA, dati: PIENI });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    const epigrafe = p.nodo.querySelector('[data-campo="epigrafe"]');
    expect(epigrafe.textContent).toContain("MARIA ROSSI");
    expect(epigrafe.textContent).toContain("P. IVA 16179891003");
    await p.smonta();
  });

  it("le dichiarazioni sono tre e quella delle clausole elenca le sedici voci", async () => {
    banco(VISTA_VUOTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    const spunte = [...p.nodo.querySelectorAll('input[type="checkbox"]')];
    expect(spunte).toHaveLength(3);
    expect(p.testo()).toContain("Art. 22.2, foro competente esclusivo");
    // spente finché i due documenti non sono letti: una spunta che si
    // può dare prima di aprire il testo è una spunta che non prova niente
    for (const s of spunte) expect(s.disabled).toBe(true);
    await p.smonta();
  });

  it("«Manca ancora» elenca quello che resta, e il tasto resta spento", async () => {
    banco(VISTA_VUOTA);
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    const manca = p.nodo.querySelector('[data-campo="manca-ancora"]').textContent;
    expect(manca).toContain("Partita IVA");
    expect(manca).toContain("La firma");
    expect(p.tasto("Firmo il contratto").getAttribute("aria-disabled")).toBe("true");
    await p.smonta();
  });

  it("un contratto riaperto lo dice, invece di far credere che non si tocchi", async () => {
    banco({
      ...VISTA_VUOTA,
      contratto: { id: "c1", stato: "da_firmare", dati: {}, riaperto_il: "2026-11-16T09:00:00Z", riaperto_perche: "condizioni cambiate" },
    });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.nodo.querySelector('[data-campo="avviso-riaperto"]').textContent).toContain("condizioni cambiate");
    await p.smonta();
  });
});

describe("«Contratti master», montata", () => {
  function bancoElenco(master, contratti, testi = []) {
    rispondiCon({
      "/rest/v1/master?": () => master,
      "/rest/v1/master_contratti_testi": () => testi,
      "/rest/v1/master_contratti": () => contratti,
    });
  }

  it("conta firmati, da firmare e fuori, e nomina chi resta fuori col motivo", async () => {
    bancoElenco(
      [
        { id: "m1", nome: "MARIA ROSSI", contratto_escluso: false },
        { id: "m2", nome: "ANNA BIANCHI", contratto_escluso: false },
        { id: "m3", nome: "TIZIO", contratto_escluso: true, contratto_escluso_motivo: "Condizioni da riscrivere." },
      ],
      [{ id: "c1", master_id: "m1", stato: "firmato", firmato_il: "2026-11-16T10:00:00Z", luogo_firma: "Roma", contratto_firmato: { origine: "server" } }],
    );
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    const testo = p.testo();
    expect(testo).toContain("MARIA ROSSI");
    expect(testo).toContain("Firmato il");
    expect(testo).toContain("ANNA BIANCHI");
    expect(testo).toContain("Non l'ha ancora aperto");
    expect(testo).toContain("Condizioni da riscrivere.");
    await p.smonta();
  });

  // SE IL TESTO NON È NEL DATABASE il server non può congelare niente, e
  // alla firma si ricadrebbe sul testo mandato dal browser. È la prima
  // cosa da sistemare, quindi è la prima che si legge.
  it("dice in cima quando il testo non è ancora nel database", async () => {
    bancoElenco([{ id: "m1", nome: "MARIA ROSSI", contratto_escluso: false }], [], []);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    const avviso = p.nodo.querySelector('[data-campo="testo-mancante"]');
    expect(avviso).toBeTruthy();
    expect(avviso.textContent).toContain("non è ancora nel database");
    expect(p.tasto("Carica il testo di partenza")).toBeTruthy();
    await p.smonta();
  });

  it("col testo caricato l'avviso sparisce", async () => {
    bancoElenco(
      [{ id: "m1", nome: "MARIA ROSSI", contratto_escluso: false }], [],
      CHIAVI.map((k) => ({ chiave: k, corpo: DAL_CODICE[k], aggiornato_da: "testo di partenza (14/11/2026)", aggiornato_il: "2026-11-16T00:00:00Z" })),
    );
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    expect(p.nodo.querySelector('[data-campo="testo-mancante"]')).toBeNull();
    expect(p.testo()).toContain("testo di partenza, mai corretto");
    await p.smonta();
  });

  // RIAPRIRE NON È CANCELLARE, e la domanda deve dirlo: la firma resta
  // archiviata. Col «no» non si tocca niente.
  it("riaprire chiede, e col «no» non scrive niente", async () => {
    const chiamate = [];
    rispondiCon({
      "/rest/v1/master?": () => [{ id: "m1", nome: "MARIA ROSSI", contratto_escluso: false }],
      "/rest/v1/master_contratti_testi": () => CHIAVI.map((k) => ({ chiave: k, corpo: DAL_CODICE[k] })),
      "/rest/v1/master_contratti": () => [{ id: "c1", master_id: "m1", stato: "firmato", firmato_il: "2026-11-16T10:00:00Z", contratto_firmato: {} }],
      "contratto_master_riapri": (corpo) => { chiamate.push(corpo); return { ok: true }; },
    });
    window.prompt = () => "serve rifarlo";
    window.confirm = vi.fn(() => false);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await clicca(p.tasto("Riapri"));
    await attendi(60);
    expect(window.confirm).toHaveBeenCalled();
    expect(String(window.confirm.mock.calls[0][0])).toContain("togliere");
    expect(chiamate).toHaveLength(0);
    await p.smonta();
  });
});

// LA PORTA DELLA FIRMA (16/11/2026, sera): «blocca per il momento
// l'accesso alle master alla firma del contratto».
//
// Tre cose si provano, e la seconda è quella che conta: che la porta NON
// sia un tasto nascosto. Nascondere la nuvola e lasciare la funzione
// aperta vorrebbe dire che chi ha la pagina già aperta, o un indirizzo,
// firma comunque — ed è esattamente la differenza fra una regola e una
// tendina tirata.
describe("la porta della firma", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations",
              "20261116200000_la_firma_del_contratto_si_apre_con_un_interruttore.sql"), "utf8",
  );

  it("la serratura sta nel database, non nella pagina", () => {
    // le due funzioni che SCRIVONO la controllano
    for (const funzione of ["contratto_master_salva", "contratto_master_bozza"]) {
      const corpo = sql.slice(sql.indexOf(`function public.${funzione}`));
      const controllo = corpo.indexOf("if not public.contratti_master_firma_aperta() then");
      expect(controllo).toBeGreaterThan(-1);
      // e la controllano PRIMA di tutto il resto: a porta chiusa non c'è
      // niente da sapere su nessuno
      expect(controllo).toBeLessThan(corpo.indexOf("select * into"));
    }
    expect(sql).toContain("'chiusa'");
  });

  // ASSENZA = CHIUSA. Una porta che si apre perché un'impostazione non è
  // stata trovata è una porta che non è mai stata chiusa.
  it("se l'impostazione manca la porta è chiusa, non aperta", () => {
    const f = sql.slice(sql.indexOf("function public.contratti_master_firma_aperta"));
    const corpo = f.slice(0, f.indexOf("$function$;"));
    expect(corpo).toContain("coalesce(");
    expect(corpo).toContain("false)");
    // e nella pagina il predefinito è lo stesso: niente letto = chiusa
    const app = fs.readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
    expect(app).toContain("portaFirmaContratto?.aperta === true");
  });

  // NON SI SPEGNE MASTER PER MASTER: `contratto_escluso` vuol dire «questa
  // persona, per un motivo suo», e riempirla di diciannove righe identiche
  // farebbe perdere la sola che aveva un significato.
  it("non tocca le esclusioni delle singole master", () => {
    expect(sql).not.toMatch(/update\s+public\.master\s+set\s+contratto_escluso/);
  });

  it("a porta chiusa la pagina lo dice e non mostra nessun modulo", async () => {
    banco({ ...VISTA_VUOTA, aperta: false });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.testo()).toContain("La firma non è ancora aperta");
    expect(p.tasto("Firmo il contratto")).toBeUndefined();
    expect(p.nodo.querySelector("canvas")).toBeNull();
    await p.smonta();
  });

  // CHIUDERE LA PORTA NON CANCELLA QUELLO CHE È STATO FIRMATO: «per ora
  // non si firma» non vuol dire «quello che hai firmato non si vede più».
  it("a porta chiusa un contratto già firmato si continua a leggere", async () => {
    banco({
      ...VISTA_VUOTA, aperta: false,
      firmato: {
        id: "c1", stato: "firmato", firmato_il: "2026-11-16T10:00:00Z", luogo_firma: "Roma",
        dati: PIENI, consenso_contratto_il: "2026-11-16T10:00:00Z",
        consenso_clausole_il: "2026-11-16T10:00:00Z", consenso_manifesto_il: "2026-11-16T10:00:00Z",
        pdf_path: "contratti/x/contratto.pdf",
      },
    });
    const p = await monta(<FirmaContratto masterId={MASTER} />);
    await attendi(80);
    expect(p.testo()).toContain("Contratto firmato");
    expect(p.tasto("Apri la copia firmata")).toBeTruthy();
    await p.smonta();
  });

  function bancoPorta(aperta, testi = CHIAVI.map((k) => ({ chiave: k, corpo: DAL_CODICE[k] }))) {
    const scritture = [];
    rispondiCon({
      "/rest/v1/master?": () => [
        { id: "m1", nome: "MARIA ROSSI", contratto_escluso: false },
        { id: "m2", nome: "ANNA BIANCHI", contratto_escluso: false },
      ],
      "contratti_master_firma_aperta": () => ({ valore: { aperta }, aggiornato_il: "2026-11-16T21:00:00Z" }),
      "/rest/v1/master_contratti_testi": () => testi,
      "/rest/v1/master_contratti": () => [],
      "/rest/v1/impostazioni_layout_tabelle": (corpo) => {
        if (corpo) { scritture.push(corpo); return [{ chiave: "contratti_master_firma_aperta" }]; }
        return [{ valore: { aperta }, aggiornato_il: "2026-11-16T21:00:00Z" }];
      },
    });
    return scritture;
  }

  it("«Contratti master» dice in cima com'è la porta", async () => {
    bancoPorta(false);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    const riquadro = p.nodo.querySelector('[data-campo="porta"]');
    expect(riquadro.textContent).toContain("La firma è chiusa alle master");
    expect(riquadro.textContent).toContain("non è un tasto nascosto");
    expect(p.tasto("Apri la firma alle master")).toBeTruthy();
    await p.smonta();
  });

  // APRIRE SI CHIEDE, e la domanda dice QUANTE persone potranno firmare:
  // «sei sicuro?» da solo non dice cosa si sta aprendo.
  it("aprire chiede e nomina quante master, e col «no» non scrive niente", async () => {
    const scritture = bancoPorta(false);
    window.confirm = vi.fn(() => false);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await clicca(p.tasto("Apri la firma alle master"));
    await attendi(60);
    expect(window.confirm).toHaveBeenCalled();
    expect(String(window.confirm.mock.calls[0][0])).toContain("2 master");
    expect(scritture).toHaveLength(0);
    await p.smonta();
  });

  // E SE IL TESTO NON È NEL DATABASE lo dice prima: aprire adesso vuol
  // dire congelare alla firma il testo del browser invece di quello del
  // database.
  it("aprire col testo mancante avvisa prima", async () => {
    bancoPorta(false, []);
    window.confirm = vi.fn(() => false);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await clicca(p.tasto("Apri la firma alle master"));
    await attendi(60);
    expect(String(window.confirm.mock.calls[0][0])).toContain("non è ancora nel database");
    await p.smonta();
  });

  // CHIUDERE NON SI CHIEDE: non fa sparire niente e si disfa con lo
  // stesso dito. Una domanda a cui si risponde sempre sì insegna a
  // premere a occhi chiusi.
  it("chiudere non chiede, e scrive la porta chiusa", async () => {
    const scritture = bancoPorta(true);
    window.confirm = vi.fn(() => true);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    expect(p.nodo.querySelector('[data-campo="porta"]').textContent).toContain("La firma è aperta alle master");
    await clicca(p.tasto("Chiudi la firma"));
    await attendi(60);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(scritture).toHaveLength(1);
    expect(scritture[0][0]?.valore?.aperta ?? scritture[0].valore?.aperta).toBe(false);
    await p.smonta();
  });
});

// RILEGGERE IL CONTRATTO CARICATO (25/11/2026, chiesto dal titolare:
// «io che ho caricato il contratto master, devo avere un tasto dove
// posso rileggere e verificare il contratto caricato»).
//
// La pagina diceva se le sette parti c'erano e se la loro impronta
// coincideva col repo — cioè rispondeva a «è quello giusto?» con un
// numero, e chi l'aveva caricato doveva fidarsi di sedici cifre.
// Adesso lo si legge per intero, dal DATABASE, composto dalle stesse
// funzioni della pagina di firma: rileggere una cosa e farne firmare
// un'altra sarebbe il contrario del motivo per cui il tasto esiste.
describe("si rilegge il contratto che il database fa firmare", () => {
  const RIGHE_DB = CHIAVI.map((k) => ({
    chiave: k, corpo: DAL_CODICE[k],
    aggiornato_da: "testo di partenza (14/11/2026)", aggiornato_il: "2026-11-16T00:00:00Z",
  }));

  function banco(testi = RIGHE_DB) {
    rispondiCon({
      "/rest/v1/master?": () => [{ id: "m1", nome: "MARIA ROSSI", contratto_escluso: false }],
      "/rest/v1/master_contratti_testi": () => testi,
      "/rest/v1/master_contratti": () => [],
    });
  }

  it("il tasto apre il contratto per intero, articoli compresi", async () => {
    banco();
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    expect(p.nodo.querySelector('[data-campo="lettura-contratto"]')).toBeNull();
    await clicca(p.tasto("Rileggi il contratto caricato"));
    await attendi(60);
    const lettore = p.nodo.querySelector('[data-campo="lettura-contratto"]');
    expect(lettore).toBeTruthy();
    // le sette parti, dalla prima all'ultima
    for (const k of CHIAVI.filter((c) => c !== "intestazione")) {
      expect(lettore.querySelector(`[data-parte="${k}"]`)).toBeTruthy();
    }
    // e il testo vero, non un riassunto
    expect(lettore.textContent).toContain(ARTICOLI[0].titolo);
    expect(lettore.textContent).toContain("Elitederma S.r.l.");
    await p.smonta();
  });

  it("dice da dove viene ogni parte: è quella la verifica", async () => {
    // una parte sola nel database: le altre, alla firma, arriverebbero
    // dal browser di chi firma — e qui si deve vedere
    banco(RIGHE_DB.filter((r) => r.chiave === "premesse"));
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await clicca(p.tasto("Rileggi il contratto caricato"));
    await attendi(60);
    const lettore = p.nodo.querySelector('[data-campo="lettura-contratto"]');
    expect(lettore.querySelector('[data-parte="premesse"]').textContent).toContain("dal database");
    expect(lettore.querySelector('[data-parte="articoli"]').textContent).toContain("non è nel database");
    await p.smonta();
  });

  it("si legge anche una parte sola, senza scorrere ventitré articoli", async () => {
    banco();
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    const riga = p.nodo.querySelector('[data-testo="premesse"]');
    await clicca(riga.querySelector('[data-campo="leggi-premesse"]'));
    await attendi(60);
    const lettore = p.nodo.querySelector('[data-campo="lettura-contratto"]');
    expect(lettore.querySelector('[data-parte="premesse"]')).toBeTruthy();
    expect(lettore.querySelector('[data-parte="articoli"]')).toBeNull();
    await p.smonta();
  });

  it("si richiude, e il tasto lo dice", async () => {
    banco();
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await clicca(p.tasto("Rileggi il contratto caricato"));
    await attendi(60);
    await clicca(p.tasto("Ho finito di rileggere"));
    await attendi(60);
    expect(p.nodo.querySelector('[data-campo="lettura-contratto"]')).toBeNull();
    await p.smonta();
  });

  it("i blocchi sono quelli della pagina di firma, non una seconda composizione", () => {
    const fonte = fs.readFileSync(path.join(process.cwd(), "src/contratti/LetturaContratto.jsx"), "utf8");
    expect(fonte).toContain("blocchiContratto");
    expect(fonte).toContain("casellePronte");
    // e l'epigrafe senza master resta a trattini, invece di far credere
    // che il contratto esca così
    const parti = partiDaLeggere({});
    expect(JSON.stringify(parti)).toContain("[Nome e cognome]");
  });
});

// E SI CORREGGE DOVE SI LEGGE (25/11/2026, chiesto dal titolare: «qui
// nel testo del contratto vorrei un tasto modifica, che senza spostare
// il documento dalla posizione in cui ho la lettura in quel momento lo
// rende editabile e, una volta eseguita la modifica, salvabile»).
//
// Era l'ultima cosa che in questo capitolo restava «da fare»: il testo
// si correggeva nel repo e si ricaricava col tasto.
describe("il contratto si corregge dove si legge", () => {
  const RIGHE_DB = CHIAVI.map((k) => ({
    chiave: k, corpo: DAL_CODICE[k],
    aggiornato_da: "testo di partenza (14/11/2026)", aggiornato_il: "2026-11-16T00:00:00Z",
  }));

  function banco(scritture) {
    rispondiCon({
      "/rest/v1/master?": () => [{ id: "m1", nome: "MARIA ROSSI", contratto_escluso: false }],
      "/rest/v1/master_contratti_testi": (corpo) => {
        if (corpo) { scritture.push(corpo); return [{ chiave: "x" }]; }
        return RIGHE_DB;
      },
      "/rest/v1/master_contratti": () => [],
    });
  }

  async function apriCorrezione(p) {
    await clicca(p.tasto("Rileggi il contratto caricato"));
    await attendi(60);
    await clicca(p.nodo.querySelector('[data-campo="modifica-contratto"]'));
    await attendi(60);
  }

  it("il tasto rende editabile quello che si sta leggendo, senza uscire dalla lettura", async () => {
    banco([]);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await apriCorrezione(p);
    const lettore = p.nodo.querySelector('[data-campo="lettura-contratto"]');
    expect(lettore).toBeTruthy();
    // le caselle ci sono, e sono le parti del testo salvato
    const caselle = [...lettore.querySelectorAll("textarea")];
    expect(caselle.length).toBeGreaterThan(50);
    expect(caselle.some((c) => c.value === PREMESSE.punti[0])).toBe(true);
    // e si dice cosa si sta facendo, prima e non dopo
    expect(p.nodo.querySelector('[data-campo="avviso-correzione"]').textContent).toContain("da adesso in avanti");
    await p.smonta();
  });

  it("finché non si cambia niente non c'è niente da salvare", async () => {
    banco([]);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await apriCorrezione(p);
    const salva = p.nodo.querySelector('[data-campo="salva-contratto"]');
    expect(salva.disabled).toBe(true);
    expect(salva.textContent).toContain("Non hai cambiato niente");
    await p.smonta();
  });

  it("corretta una riga si salva SOLO quella parte, col testo nuovo", async () => {
    const scritture = [];
    banco(scritture);
    window.confirm = vi.fn(() => true);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await apriCorrezione(p);
    const casella = [...p.nodo.querySelectorAll("textarea")].find((c) => c.value === PREMESSE.punti[0]);
    await scrivi(casella, "A) Testo corretto dal titolare.");
    const salva = p.nodo.querySelector('[data-campo="salva-contratto"]');
    expect(salva.disabled).toBe(false);
    expect(salva.textContent).toContain("Salva");
    await clicca(salva);
    await attendi(120);
    // una sola riga scritta: le premesse
    expect(scritture).toHaveLength(1);
    expect(scritture[0].chiave).toBe("premesse");
    expect(scritture[0].corpo.punti[0]).toBe("A) Testo corretto dal titolare.");
    // e gli altri capoversi restano quelli di prima
    expect(scritture[0].corpo.punti[1]).toBe(PREMESSE.punti[1]);
    await p.smonta();
  });

  it("si chiede prima di scrivere, e col «no» non si scrive niente", async () => {
    const scritture = [];
    banco(scritture);
    window.confirm = vi.fn(() => false);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await apriCorrezione(p);
    const casella = [...p.nodo.querySelectorAll("textarea")].find((c) => c.value === PREMESSE.punti[0]);
    await scrivi(casella, "A) Qualcosa.");
    await clicca(p.nodo.querySelector('[data-campo="salva-contratto"]'));
    await attendi(60);
    expect(window.confirm).toHaveBeenCalled();
    expect(String(window.confirm.mock.calls[0][0])).toContain("Premesse");
    expect(scritture).toHaveLength(0);
    // e si resta in correzione, col testo battuto ancora lì
    expect(p.nodo.querySelector('[data-campo="salva-contratto"]')).toBeTruthy();
    await p.smonta();
  });

  it("«Annulla» butta la correzione e non scrive niente", async () => {
    const scritture = [];
    banco(scritture);
    const p = await monta(<PaginaContrattiMaster />);
    await attendi(120);
    await apriCorrezione(p);
    const casella = [...p.nodo.querySelectorAll("textarea")].find((c) => c.value === PREMESSE.punti[0]);
    await scrivi(casella, "A) Da buttare.");
    await clicca(p.nodo.querySelector('[data-campo="annulla-correzione"]'));
    await attendi(60);
    expect(scritture).toHaveLength(0);
    // si torna a leggere, col testo di prima
    expect(p.nodo.querySelector('[data-campo="lettura-contratto"]').textContent).toContain(PREMESSE.punti[0]);
    await p.smonta();
  });

  it("quello che è meccanismo non diventa una casella di testo", () => {
    // la chiave e il tipo di una dichiarazione decidono QUALE spunta è
    // e se è obbligatoria: correggerle da una casella non cambierebbe
    // una parola del contratto, romperebbe la firma
    const fonte = fs.readFileSync(path.join(process.cwd(), "src/contratti/LetturaContratto.jsx"), "utf8");
    expect(fonte).toContain('CHIAVI_MECCANISMO = new Set(["chiave", "tipo", "daClausole", "id"])');
  });
});
