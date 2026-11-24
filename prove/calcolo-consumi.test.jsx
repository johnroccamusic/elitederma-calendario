// CALCOLO CONSUMI. 24/11/2026.
//
// Il titolare: «un tasto calcolo consumi: selezioni un prodotto e gli
// dici calcola i consumi teorici dal al, in modo che in base ai consumi
// che ci sono stati ci fa una stima delle necessità fino ad arrivare a X
// mesi, in funzione dei corsi che ci sono stati».
//
// QUESTE PROVE DIFENDONO DUE NUMERI MISURATI IL GIORNO IN CUI È NATA LA
// PAGINA, e sono i due modi in cui una stima del genere mente:
//   * gennaio 2027 ha 19 classi a calendario e 38 iscritte, 2 per classe,
//     mentre nei mesi misurati erano 4,8 — le classi di marzo si
//     riempiono a marzo. Proiettare sulle iscritte di oggi fa ordinare
//     troppo poco, e il numero sembra un dato;
//   * settembre 2027 ha UNA classe a calendario, settembre 2026 ne aveva
//     quindici: il calendario lontano è da riempire, quindi il totale
//     «con quello che è a calendario» è un pavimento e non una previsione.
import { describe, it, expect } from "vitest";
import React from "react";
import CalcoloConsumi from "../src/magazzino/CalcoloConsumi.jsx";
import { consumoPerAllieva, proiezione, allievePreviste, mesiFra, nomeMese, livelloPieno, percentualeDelMese, TREND_PIENO } from "../src/magazzino/consumi-previsti.js";
import { act } from "react";
import { monta, attendi, clicca, scrivi, scegli } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

// due corsi con consumi diversi, come PMU e LAMINAZIONE: un pigmento lo
// consuma il primo e non il secondo
const MISURATE = [
  { id: "e1", corsoId: "pmu", dataInizio: "2026-09-10", allieve: 4, pezzi: 8 },
  { id: "e2", corsoId: "pmu", dataInizio: "2026-10-05", allieve: 6, pezzi: 12 },
  { id: "e3", corsoId: "lam", dataInizio: "2026-10-20", allieve: 10, pezzi: 0 },
];

describe("quanto consuma una allieva", () => {
  it("si misura per corso, perché un pigmento non lo consuma la laminazione", () => {
    const s = consumoPerAllieva(MISURATE);
    expect(s.perCorso.pmu.perAllieva).toBe(2); // 20 pezzi / 10 allieve
    expect(s.perCorso.lam.perAllieva).toBe(0);
    // la media generale è diluita su tutte le allieve, ed è giusto: vale
    // finché il mix dei corsi resta quello misurato
    expect(s.perAllieva).toBeCloseTo(20 / 20, 3);
    expect(s.allievePerClasse).toBeCloseTo(20 / 3, 2);
  });

  it("una classe sola non fa una media, e lo dichiara", () => {
    const s = consumoPerAllieva([{ corsoId: "x", allieve: 3, pezzi: 30 }]);
    expect(s.perCorso.x.classi).toBe(1);
    expect(s.perCorso.x.affidabile).toBe(false);
    const due = consumoPerAllieva([{ corsoId: "x", allieve: 3, pezzi: 30 }, { corsoId: "x", allieve: 3, pezzi: 30 }]);
    expect(due.perCorso.x.affidabile).toBe(true);
  });

  it("senza classi non inventa una media", () => {
    const s = consumoPerAllieva([]);
    expect(s.classi).toBe(0);
    expect(s.perAllieva).toBe(0);
  });
});

describe("le allieve che avrà una classe futura", () => {
  it("non sono quelle già iscritte: è il caso di gennaio 2027", () => {
    // 2 iscritte oggi, la media del corso dice 4,8: vale 4,8
    expect(allievePreviste({ iscritteOra: 2, mediaPerClasse: 4.8, postiMax: 8 })).toBe(4.8);
  });

  it("ma se sono già più della media, vince il numero vero", () => {
    expect(allievePreviste({ iscritteOra: 7, mediaPerClasse: 4.8, postiMax: 8 })).toBe(7);
  });

  it("mai più dei posti: una classe da quattro non ne fa otto", () => {
    expect(allievePreviste({ iscritteOra: 0, mediaPerClasse: 8.5, postiMax: 4 })).toBe(4);
  });

  it("e se gli iscritti superano i posti si tiene il numero vero, non il tetto", () => {
    // è già successo: una classe con un posto in più aggiunto a mano
    expect(allievePreviste({ iscritteOra: 6, mediaPerClasse: 2, postiMax: 4 })).toBe(6);
  });
});

describe("la proiezione mese per mese", () => {
  const storico = consumoPerAllieva(MISURATE);

  it("conta le classi a calendario e le riempie con la media del loro corso", () => {
    const p = proiezione({
      storico,
      classiFuture: [{ corsoId: "pmu", dataInizio: "2027-01-10", iscritteOra: 2, postiMax: 8 }],
      daMese: "2027-01", aMese: "2027-01", giacenza: 0, classiAlMeseStoriche: 0,
    });
    // 5 allieve attese (media pmu) × 2 pezzi = 10
    expect(p.righe[0].classiACalendario).toBe(1);
    expect(p.righe[0].daiCorsiCalendario).toBe(10);
  });

  it("IL RITMO COMPLETA IL CALENDARIO, non lo sostituisce: è il caso di settembre 2027", () => {
    const p = proiezione({
      storico,
      classiFuture: [{ corsoId: "pmu", dataInizio: "2027-09-05", iscritteOra: 0, postiMax: 8 }],
      daMese: "2027-09", aMese: "2027-09", giacenza: 0, classiPerMeseMisurato: { "2026-03": 3 },
    });
    const r = p.righe[0];
    expect(r.classiACalendario).toBe(1);
    expect(r.classiStimateInPiu).toBe(2); // 3 al mese − 1 scritta
    // la classe scritta col suo corso, le due mancanti con la media generale
    expect(r.daiCorsiCalendario).toBe(10);
    expect(r.daiCorsiAlRitmo).toBeCloseTo(10 + 2 * (storico.allievePerClasse * storico.perAllieva), 1);
    expect(r.daiCorsiAlRitmo).toBeGreaterThan(r.daiCorsiCalendario);
  });

  it("un mese col calendario già più pieno del ritmo non si abbassa", () => {
    const p = proiezione({
      storico,
      classiFuture: [
        { corsoId: "pmu", dataInizio: "2027-01-10", iscritteOra: 0, postiMax: 8 },
        { corsoId: "pmu", dataInizio: "2027-01-20", iscritteOra: 0, postiMax: 8 },
        { corsoId: "pmu", dataInizio: "2027-01-25", iscritteOra: 0, postiMax: 8 },
      ],
      daMese: "2027-01", aMese: "2027-01", giacenza: 0, classiPerMeseMisurato: { "2026-05": 2 },
    });
    expect(p.righe[0].classiStimateInPiu).toBe(0);
    expect(p.righe[0].daiCorsiAlRitmo).toBe(p.righe[0].daiCorsiCalendario);
  });

  it("le vendite entrano a media mensile, in una colonna loro, su tutti e due gli scenari", () => {
    const p = proiezione({
      storico, classiFuture: [], daMese: "2027-01", aMese: "2027-02",
      venditeAlMese: 7, giacenza: 0, classiAlMeseStoriche: 0,
    });
    expect(p.righe[0].dalleVendite).toBe(7);
    expect(p.righe[0].totaleCalendario).toBe(7);
    expect(p.righe[1].cumulatoCalendario).toBe(14);
    expect(p.righe[1].cumulatoAlRitmo).toBe(14);
  });

  it("dice quando la giacenza di oggi finisce, e quanti pezzi ordinare", () => {
    const p = proiezione({
      storico, classiFuture: [], daMese: "2027-01", aMese: "2027-04",
      venditeAlMese: 10, giacenza: 25, classiAlMeseStoriche: 0,
    });
    expect(p.finisceCalendario).toBe("2027-03"); // 10+10+10 = 30 > 25
    expect(p.daOrdinareCalendario).toBe(15); // 40 attesi − 25 in casa
  });

  it("un corso futuro mai misurato non vale zero in silenzio: si conta e si dichiara", () => {
    const p = proiezione({
      storico,
      classiFuture: [{ corsoId: "corso-nuovo", dataInizio: "2027-01-10", iscritteOra: 3, postiMax: 8 }],
      daMese: "2027-01", aMese: "2027-01", giacenza: 0, classiAlMeseStoriche: 0,
    });
    expect(p.righe[0].corsiSenzaMisura).toBe(1);
    expect(p.righe[0].daiCorsiCalendario).toBeGreaterThan(0);
  });

  it("i mesi si contano giusti anche a cavallo d'anno", () => {
    expect(mesiFra("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(mesiFra("2027-01", "2027-01")).toEqual(["2027-01"]);
    expect(mesiFra("2027-03", "2027-01")).toEqual([]);
    expect(nomeMese("2027-09")).toBe("settembre 2027");
  });
});

// ------------------------------------------------------------- la pagina
const PRODOTTI = [
  { id: "p1", nome: "T-Shirt EliteDerma taglia M", quantita: 30, attivo: true },
  { id: "p2", nome: "Pigmento Arizona", quantita: 12, attivo: true },
  { id: "p3", nome: "Ago 1RL", quantita: 100, attivo: false }, // fuori listino
];
const CORSI = [{ id: "pmu", nome: "PMU BASE", posti_max: 8 }, { id: "lam", nome: "LAMINAZIONE BASE", posti_max: 10 }];
const oggi = new Date();
const fra = (giorni) => new Date(oggi.getTime() + giorni * 86400000).toISOString().slice(0, 10);
// le classi nascono rispetto a OGGI: una data a calendario in una prova è
// una prova con una scadenza (lezione del 16/11 e del 23/11)
const CORSI_DATE = [
  { id: "e1", corso_id: "pmu", data_inizio: fra(-60), posti_max: 8 },
  { id: "e2", corso_id: "pmu", data_inizio: fra(-30), posti_max: 8 },
  { id: "e3", corso_id: "lam", data_inizio: fra(-20), posti_max: 10 },
  { id: "f1", corso_id: "pmu", data_inizio: fra(20), posti_max: 8 },
];
const ISCRITTI = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, corso_data_id: "e1" })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, corso_data_id: "e2" })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, corso_data_id: "e3" })),
  { id: "d1", corso_data_id: "f1" },
];
// il pigmento: 2 per allieva nel PMU, niente nella laminazione
const QUANTITA = (cd) => (cd.corso_id === "pmu"
  ? { p2: 2 * ISCRITTI.filter((i) => i.corso_data_id === cd.id).length }
  : {});


// SCEGLIERE UN PRODOTTO ADESSO E' UN GESTO SOLO: si scrive nella casella
// e si preme la voce che compare sotto. Dal 24/11/2026 la tendina non
// c'e' piu' — il titolare, provandola: «la ricerca non funziona», «non
// esce nessuna ricerca»: due caselle affiancate chiedevano di capire che
// la prima filtrava la seconda, e chi non lo capiva restava a scorrere.
async function scegliProdotto(nodo, testo, nomeVoce) {
  const campo = [...nodo.querySelectorAll("input")].find((i) => /scrivi il nome/.test(i.placeholder || ""));
  if (!campo) throw new Error("manca la casella di ricerca del prodotto");
  await scrivi(campo, testo);
  // la riga piu' interna: i contenitori portano lo stesso testo, e il
  // gestore sta sulla riga. E risponde a MOUSEDOWN, non a click: il
  // click arriverebbe dopo il blur e l'elenco sarebbe gia' chiuso
  const voce = [...nodo.querySelectorAll("div")]
    .filter((d) => d.textContent.trim() === nomeVoce && !d.querySelector("div")).pop();
  if (!voce) throw new Error(`la voce «${nomeVoce}» non compare nell'elenco`);
  await act(async () => { voce.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); });
  await attendi();
}

function pagina(extra = {}) {
  return (
    <CalcoloConsumi
      prodottiShop={PRODOTTI} corsi={CORSI} corsiDate={CORSI_DATE} iscritti={ISCRITTI}
      quantitaPerEdizione={QUANTITA}
      giacenzaDi={(pid) => PRODOTTI.find((p) => p.id === pid)?.quantita || 0}
      pezziVendutiNelPeriodo={() => 0}
      {...extra}
    />
  );
}

describe("la pagina Calcolo consumi", () => {
  it("si apre con la casella di ricerca e il tasto spento finché non si scegli", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const campo = [...nodo.querySelectorAll("input")].find((i) => /scrivi il nome/.test(i.placeholder || ""));
    expect(campo, "manca la casella di ricerca del prodotto").toBeTruthy();
    // e nessuna tendina da scorrere: era il difetto di partenza
    expect(nodo.querySelector("[data-prodotto]")).toBeNull();
    const tasto = [...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent));
    expect(tasto.disabled).toBe(true);
  });

  it("i prodotti fuori listino non si offrono: non si ordinano più", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const campo = [...nodo.querySelectorAll("input")].find((i) => /scrivi il nome/.test(i.placeholder || ""));
    await scrivi(campo, "a");
    const testo = nodo.textContent;
    expect(testo).toContain("Pigmento Arizona");
    expect(testo).not.toContain("Ago 1RL");
  });

  it("scelto il prodotto, calcola il consumo per allieva e lo mostra per corso", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "arizona", "Pigmento Arizona");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    const misurato = nodo.querySelector("[data-misurato]");
    expect(misurato).toBeTruthy();
    // 20 pezzi su 10 allieve PMU + 10 allieve laminazione = 1 per allieva
    expect(misurato.textContent).toContain("Per allieva");
    // e la riga del PMU dice 2
    expect(nodo.querySelector('[data-corso-misurato="pmu"]').textContent).toContain("PMU BASE");
  });

  it("LA CLASSE FUTURA CONTA LE ALLIEVE ATTESE, non la sola iscritta di oggi", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "arizona", "Pigmento Arizona");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    const stima = nodo.querySelector("[data-stima]");
    expect(stima).toBeTruthy();
    // la classe futura ha 1 iscritta, ma il PMU ne fa 5 di media: la
    // stima deve valere 5 × 2 = 10 pezzi, non 1 × 2 = 2
    const riga = [...stima.querySelectorAll("[data-mese]")].find((r) => r.textContent.includes("10"));
    expect(riga, "nessun mese con i 10 pezzi della classe futura").toBeTruthy();
  });

  it("mostra tutti e due gli scenari e dice che il calendario è un pavimento", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "arizona", "Pigmento Arizona");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    const stima = nodo.querySelector("[data-stima]");
    expect(stima.textContent).toContain("Con quello che è a calendario");
    expect(stima.textContent).toContain("Al ritmo dei mesi misurati");
    expect(stima.textContent).toContain("pavimento");
  });

  it("un prodotto che nei kit non c'è lo DICE, invece di mostrare zero e tacere", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "shirt", "T-Shirt EliteDerma taglia M"); // QUANTITA non le dà
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    expect(nodo.querySelector("[data-misurato]").textContent).toContain("non compare");
  });

  it("un periodo senza classi non produce una stima inventata", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "arizona", "Pigmento Arizona");
    await scrivi(nodo.querySelector("[data-dal]"), "2020-01-01");
    await scrivi(nodo.querySelector("[data-al]"), "2020-03-01");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    expect(nodo.textContent).toContain("niente da misurare");
    expect(nodo.querySelector("[data-stima]")).toBeNull();
  });

  it("un periodo al rovescio si rifiuta e lo dice", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await scegliProdotto(nodo, "arizona", "Pigmento Arizona");
    await scrivi(nodo.querySelector("[data-dal]"), "2026-11-01");
    await scrivi(nodo.querySelector("[data-al]"), "2026-09-01");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Calcola i consumi/.test(b.textContent)));
    await attendi();
    expect(nodo.textContent).toContain("non è valido");
  });

  it("«tutto un reparto» somma i prodotti di quel reparto", async () => {
    rispondiCon({});
    const repartoDi = new Map([["p1", { id: "r1", nome: "ABBIGLIAMENTO" }], ["p2", { id: "r2", nome: "TUTTI I PIGMENTI" }]]);
    const { nodo } = await monta(pagina({ repartoDi }));
    await clicca(nodo.querySelector('[data-modo="reparto"]'));
    const tendina = nodo.querySelector("[data-reparto]");
    expect([...tendina.options].map((o) => o.textContent).join(" ")).toContain("TUTTI I PIGMENTI");
    await scegli(tendina, "TUTTI I PIGMENTI");
    expect(nodo.textContent).toContain("1 prodotti in questo reparto");
  });
});

describe("il trend dei mesi scritto dal titolare", () => {
  const storico = consumoPerAllieva(MISURATE);
  // i numeri veri: settembre 15 classi, ottobre 23, novembre 18
  const MISURATO_PER_MESE = { "2026-09": 15, "2026-10": 23, "2026-11": 18 };
  const TREND = { ...TREND_PIENO, 9: 90, 12: 60, 1: 60, 2: 70, 8: 30 };

  it("100% è un mese di PUNTA, non la media: settembre al 90% vale di più di 15", () => {
    // 15/0,9 = 16,7 · 23/1 = 23 · 18/1 = 18 → media 19,2
    expect(livelloPieno(MISURATO_PER_MESE, TREND)).toBeCloseTo(19.2, 1);
    expect(percentualeDelMese(TREND, "2026-12")).toBe(0.6);
  });

  it("col trend tutto al 100% il conto è quello di prima: la tabella nasce innocua", () => {
    expect(livelloPieno(MISURATO_PER_MESE)).toBeCloseTo((15 + 23 + 18) / 3, 2);
    expect(percentualeDelMese(null, "2027-03")).toBe(1);
  });

  it("un mese senza storico prende la SUA percentuale, non la media", () => {
    const p = proiezione({
      storico, classiFuture: [], daMese: "2026-12", aMese: "2027-02",
      giacenza: 0, trend: TREND, classiPerMeseMisurato: MISURATO_PER_MESE,
    });
    const [dic, gen, feb] = p.righe;
    expect(dic.percentualeTrend).toBe(60);
    expect(dic.fonteAttese).toBe("trend");
    expect(dic.classiAttese).toBeCloseTo(19.2 * 0.6, 1);
    expect(gen.classiAttese).toBeCloseTo(dic.classiAttese, 1);
    // febbraio al 70% deve pesare più di dicembre al 60%
    expect(feb.classiAttese).toBeGreaterThan(dic.classiAttese);
  });

  it("UN MESE GIA' MISURATO VALE IL SUO NUMERO VERO, non la percentuale", () => {
    // settembre 2027: settembre è fra i mesi misurati (15 classi), e la
    // regola del titolare è «per i mesi per cui esiste una statistica
    // valgono i mesi»
    const p = proiezione({
      storico, classiFuture: [], daMese: "2027-09", aMese: "2027-09",
      giacenza: 0, trend: TREND, classiPerMeseMisurato: MISURATO_PER_MESE,
    });
    expect(p.righe[0].fonteAttese).toBe("storico");
    expect(p.righe[0].classiAttese).toBe(15);
    // e NON il livello pieno scontato del 90%
    expect(p.righe[0].classiAttese).not.toBeCloseTo(19.2 * 0.9, 1);
  });

  it("agosto al 30% non fa ordinare come marzo al 100%", () => {
    const p = proiezione({
      storico, classiFuture: [], daMese: "2027-03", aMese: "2027-08",
      giacenza: 0, trend: TREND, classiPerMeseMisurato: MISURATO_PER_MESE,
    });
    const marzo = p.righe[0], agosto = p.righe[p.righe.length - 1];
    expect(marzo.mese).toBe("2027-03");
    expect(agosto.mese).toBe("2027-08");
    expect(agosto.daiCorsiAlRitmo).toBeLessThan(marzo.daiCorsiAlRitmo / 2);
  });

  it("il livello pieno torna nel risultato, così la pagina può dirlo", () => {
    const p = proiezione({
      storico, classiFuture: [], daMese: "2027-01", aMese: "2027-01",
      giacenza: 0, trend: TREND, classiPerMeseMisurato: MISURATO_PER_MESE,
    });
    expect(p.livelloPieno).toBeCloseTo(19.2, 1);
    expect(p.conTrend).toBe(true);
  });
});

describe("la tabella del trend in pagina", () => {
  it("c'è in cima, con dodici caselle, e si apre", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    const sezione = nodo.querySelector("[data-trend]");
    expect(sezione).toBeTruthy();
    expect(sezione.textContent).toContain("Il trend dei mesi");
    // dice che serve solo dove lo storico non c'è: è la regola del titolare
    expect(sezione.textContent).toContain("solo per i mesi di cui non c");
    await clicca(sezione.querySelector("button"));
    expect(nodo.querySelectorAll("[data-trend-mese]").length).toBe(12);
  });

  it("nasce con tutti i mesi al 100%: finché non la tocchi non cambia niente", async () => {
    rispondiCon({});
    const { nodo } = await monta(pagina());
    await attendi();
    await clicca(nodo.querySelector("[data-trend] button"));
    const valori = [...nodo.querySelectorAll("[data-trend-mese]")].map((i) => i.value);
    expect(valori).toEqual(Array(12).fill("100"));
  });

  it("scritta una percentuale, il salvataggio la manda al database", async () => {
    const scritture = [];
    rispondiCon({
      impostazioni_layout_tabelle: (corpo) => { if (corpo) scritture.push(corpo); return []; },
    });
    const { nodo } = await monta(pagina());
    await attendi();
    await clicca(nodo.querySelector("[data-trend] button"));
    await scrivi(nodo.querySelector('[data-trend-mese="12"]'), "60");
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Salva il trend/.test(b.textContent)));
    await attendi();
    expect(scritture.length).toBe(1);
    const riga = Array.isArray(scritture[0]) ? scritture[0][0] : scritture[0];
    expect(riga.chiave).toBe("consumi_trend_mensile");
    expect(riga.valore["12"] ?? riga.valore[12]).toBe(60);
    // gli altri mesi restano al 100, non diventano zero
    expect(riga.valore["3"] ?? riga.valore[3]).toBe(100);
  });
});
