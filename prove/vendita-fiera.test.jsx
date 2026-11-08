// VENDITA FIERA: l'iscrizione chiusa al banco di un evento (8/11/2026).
//
// Chiesto dal titolare con la fiera di Napoli aperta: un flag in cima
// alla scheda di iscrizione, e nella scheda della fiera l'elenco dei
// corsi che si stanno chiudendo li'.
//
// LA COSA CHE QUESTE PROVE DIFENDONO non e' l'aspetto della pagina: e'
// che il flag PORTI CON SE' LA FIERA. Con un si'/no la scheda della
// prossima fiera mostrerebbe le iscrizioni di Napoli, e nessuno potrebbe
// piu' dire quale banco ha chiuso quei corsi — lo stesso guasto dei
// sette consensi col QR generico.
//
// E che l'elenco «di questi giorni» resti una PROPOSTA: in quei giorni
// si iscrive gente da tutta Italia, e `ts` non sa dove stava chi
// compilava.
import { describe, it, expect } from "vitest";
import React from "react";
import {
  giornoRoma, giorniPrima, periodoFiera, nelPeriodo, fiereDaFlaggare,
  iscrizioniDellaFiera, candidateDellaFiera, corsiChiusiInFiera, contoIscrizioniFiera,
} from "../src/eventi/fiera-iscrizioni.js";
import { segnaVenditaFiera } from "../src/eventi/dati.js";
import FlagVenditaFiera from "../src/eventi/FlagVenditaFiera.jsx";
import { SchedaIscrizioniFiera } from "../src/eventi/GestioneEventi.jsx";
import { monta, clicca, scegli } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const NAPOLI = { id: "ev-na", nome: "Fiera di Napoli", citta: "Napoli", stato: "programmato", data_inizio: "2026-11-07", data_fine: "2026-11-09" };
const CATANIA = { id: "ev-ct", nome: "Fiera Catania", citta: "Catania", stato: "programmato", data_inizio: "2026-10-17", data_fine: "2026-10-19" };

const CORSI = [{ id: "c-need", nome: "NEEDLING" }, { id: "c-lam", nome: "LAMINAZIONE BASE" }];
const LUOGHI = [{ id: "l-na", citta: "NAPOLI" }, { id: "l-rm", citta: "ROMA" }, { id: "l-mi", citta: "MILANO" }];
const CLASSI = [
  { id: "cd-lam-na", corso_id: "c-lam", location_id: "l-na", data_inizio: "2027-01-25" },
  { id: "cd-need-rm", corso_id: "c-need", location_id: "l-rm", data_inizio: "2027-02-07" },
  { id: "cd-need-mi", corso_id: "c-need", location_id: "l-mi", data_inizio: "2026-11-29" },
];

// due iscritte segnate alla fiera di Napoli, una alla fiera di Catania,
// una di quei giorni ma senza flag, una fuori finestra
const GIUSY = { id: "i1", nome: "GIUSY", cognome: "QUATRANA", tutor: "CHIARA COLONNELLI", corso_data_id: "cd-lam-na", ts: "2026-11-08T10:56:18Z", totale_pattuito: 540, acconto_totale: 50, acconto_pagato: true, vendita_evento_id: "ev-na" };
const CARMEN = { id: "i2", nome: "CARMEN", cognome: "MOLITIERNO", tutor: "CHIARA COLONNELLI", corso_data_id: "cd-lam-na", ts: "2026-11-08T10:58:07Z", totale_pattuito: 540, acconto_totale: 50, acconto_pagato: true, vendita_evento_id: "ev-na" };
const LUCIA = { id: "i3", nome: "LUCIA", cognome: "TESSICINI", tutor: "OLGA", corso_data_id: "cd-need-rm", ts: "2026-11-07T15:05:34Z", totale_pattuito: 1540, acconto_totale: 150, acconto_pagato: false };
const TRINH = { id: "i4", nome: "TRINH", cognome: "DAO", tutor: "OLGA", corso_data_id: "cd-need-mi", ts: "2026-11-07T12:37:58Z", totale_pattuito: 1690, acconto_totale: 719.8, acconto_pagato: true, vendita_evento_id: "ev-ct" };
const MARTA = { id: "i5", nome: "MARTA", cognome: "CUBEDDU", tutor: "OLGA", corso_data_id: "cd-need-rm", ts: "2026-11-06T09:21:57Z", totale_pattuito: 1690 };
const TUTTE = [GIUSY, CARMEN, LUCIA, TRINH, MARTA];

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");

// ---------------------------------------------------------------------
describe("il giorno di un'iscrizione è quello di chi compilava", () => {
  // SE SI TAGLIASSE LA STRINGA (`ts.slice(0, 10)`) si leggerebbe il
  // giorno UTC: una scheda chiusa alle 00:30 del 9 a Roma è ancora l'8
  // in UTC, e cadrebbe nel giorno sbagliato.
  it("mezzanotte e mezza a Roma è il giorno dopo, non quello di UTC", () => {
    expect(giornoRoma("2026-11-08T23:30:00Z")).toBe("2026-11-09");
    expect("2026-11-08T23:30:00Z".slice(0, 10)).toBe("2026-11-08");
  });

  it("un istante senza senso non diventa una data", () => {
    expect(giornoRoma("")).toBe("");
    expect(giornoRoma("non una data")).toBe("");
  });

  it("i giorni della fiera si leggono dalle sue date, anche se invertite", () => {
    expect(periodoFiera(NAPOLI)).toEqual({ dal: "2026-11-07", al: "2026-11-09" });
    expect(periodoFiera({ data_inizio: "2026-11-09", data_fine: "2026-11-07" })).toEqual({ dal: "2026-11-07", al: "2026-11-09" });
    expect(periodoFiera({})).toBe(null);
  });

  it("il periodo comprende il primo e l'ultimo giorno", () => {
    expect(nelPeriodo(NAPOLI, "2026-11-07T08:00:00Z")).toBe(true);
    expect(nelPeriodo(NAPOLI, "2026-11-09T18:00:00Z")).toBe(true);
    expect(nelPeriodo(NAPOLI, "2026-11-06T18:00:00Z")).toBe(false);
    expect(nelPeriodo(NAPOLI, "2026-11-10T08:00:00Z")).toBe(false);
  });

  it("giorniPrima torna indietro nel calendario, non di trenta giorni fissi", () => {
    expect(giorniPrima("2026-11-08", 7)).toBe("2026-11-01");
    expect(giorniPrima("2026-03-03", 7)).toBe("2026-02-24");
  });
});

// ---------------------------------------------------------------------
describe("quali fiere il flag può nominare", () => {
  const oggi = "2026-11-08";

  it("quella in corso c'è", () => {
    expect(fiereDaFlaggare([NAPOLI, CATANIA], { oggi }).map((e) => e.id)).toEqual(["ev-na"]);
  });

  it("quella finita ieri c'è ancora: le schede si sistemano il lunedì", () => {
    const ieri = { ...NAPOLI, id: "ev-ieri", data_inizio: "2026-11-05", data_fine: "2026-11-07" };
    expect(fiereDaFlaggare([ieri], { oggi }).map((e) => e.id)).toEqual(["ev-ieri"]);
  });

  it("una fiera annullata non c'è: non c'è stato nessun banco", () => {
    expect(fiereDaFlaggare([{ ...NAPOLI, stato: "annullato" }], { oggi })).toEqual([]);
  });

  // UNA TENDINA CHE NON CONTIENE IL VALORE CHE MOSTRA LO CANCELLA AL
  // PRIMO TOCCO: la fiera già scritta sulla scheda c'è sempre.
  it("la fiera già segnata c'è anche se vecchia di un mese", () => {
    expect(fiereDaFlaggare([CATANIA], { oggi })).toEqual([]);
    expect(fiereDaFlaggare([CATANIA], { oggi, giaScelta: "ev-ct" }).map((e) => e.id)).toEqual(["ev-ct"]);
  });
});

// ---------------------------------------------------------------------
describe("le iscrizioni sono di UNA fiera", () => {
  // È la ragione per cui la colonna porta l'id e non un sì/no.
  it("la fiera di Napoli vede le sue, non quelle di Catania", () => {
    expect(iscrizioniDellaFiera(TUTTE, "ev-na").map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(iscrizioniDellaFiera(TUTTE, "ev-ct").map((i) => i.id)).toEqual(["i4"]);
  });

  it("senza fiera non si vede niente, invece di vedere tutto", () => {
    expect(iscrizioniDellaFiera(TUTTE, "")).toEqual([]);
  });

  it("le candidate sono quelle di quei giorni e non ancora attribuite", () => {
    // LUCIA sì (il 7, senza flag); GIUSY e CARMEN no (già segnate);
    // TRINH no (è di Catania, già attribuita); MARTA no (il 6, fuori)
    expect(candidateDellaFiera(TUTTE, NAPOLI).map((i) => i.id)).toEqual(["i3"]);
  });

  it("una fiera senza id non propone niente", () => {
    expect(candidateDellaFiera(TUTTE, {})).toEqual([]);
  });
});

// ---------------------------------------------------------------------
describe("i corsi che stiamo chiudendo", () => {
  // SI RAGGRUPPA PER CLASSE, MAI PER NOME DEL CORSO: due edizioni dello
  // stesso corso in due città sono due classi, e sommarle direbbe che a
  // Napoli si è venduto un corso che parte a Milano.
  it("due edizioni dello stesso corso restano due righe", () => {
    const g = corsiChiusiInFiera(
      [{ ...LUCIA, vendita_evento_id: "ev-na" }, { ...TRINH, vendita_evento_id: "ev-na" }],
      { corsi: CORSI, corsiDate: CLASSI, location: LUOGHI },
    );
    expect(g).toHaveLength(2);
    expect(g.map((x) => x.nome)).toEqual(["NEEDLING", "NEEDLING"]);
    expect(g.map((x) => x.citta).sort()).toEqual(["MILANO", "ROMA"]);
  });

  it("in cima il corso su cui la fiera ha portato più gente", () => {
    const g = corsiChiusiInFiera(
      [GIUSY, CARMEN, { ...LUCIA, vendita_evento_id: "ev-na" }],
      { corsi: CORSI, corsiDate: CLASSI, location: LUOGHI },
    );
    expect(g[0].nome).toBe("LAMINAZIONE BASE");
    expect(g[0].quante).toBe(2);
    expect(g[0].pattuito).toBe(1080);
  });

  it("chi non ha ancora una classe non si perde", () => {
    const g = corsiChiusiInFiera([{ id: "x", nome: "ANNA", cognome: "B", corso_data_id: null, totale_pattuito: 100 }],
      { corsi: CORSI, corsiDate: CLASSI, location: LUOGHI });
    expect(g).toHaveLength(1);
    expect(g[0].nome).toBe("Classe non ancora scelta");
  });
});

// ---------------------------------------------------------------------
describe("il conto della fiera", () => {
  // PATTUITO e INCASSATO sono due numeri diversi, e tenerli separati è
  // il punto: al banco si prende un acconto.
  it("l'incassato conta solo le quote segnate pagate", () => {
    const t = contoIscrizioniFiera([GIUSY, CARMEN, { ...LUCIA, vendita_evento_id: "ev-na" }]);
    expect(t.quante).toBe(3);
    expect(t.pattuito).toBe(2620);
    expect(t.incassato).toBe(100); // i 150 di LUCIA sono da pagare
  });

  it("le righe aggiunte con «+» contano come le altre", () => {
    const t = contoIscrizioniFiera([{
      totale_pattuito: 1000, acconto_totale: 100, acconto_pagato: true,
      acconto_extra: [{ totale: 50, pagato: true }, { totale: 70, pagato: false }],
      precorso_totale: 200, precorso_pagato: true,
    }]);
    expect(t.incassato).toBe(350);
  });

  it("niente scritto, niente numeri inventati", () => {
    expect(contoIscrizioniFiera([])).toEqual({ quante: 0, pattuito: 0, incassato: 0 });
  });
});

// ---------------------------------------------------------------------
// IL GESTO: il flag in cima alla scheda
describe("il flag in cima alla scheda", () => {
  const apri = (eventi, props = {}) => {
    rispondiCon({ "/eventi": eventi });
    return monta(<FlagVenditaFiera onCambia={() => {}} {...props} />);
  };

  it("con una fiera aperta, spuntare scrive QUELLA fiera", async () => {
    let scritto = "non chiamato";
    const p = await apri([NAPOLI], { onCambia: (v) => { scritto = v; } });
    expect(pulito(p)).toContain("Vendita fiera");
    expect(pulito(p)).toContain("Fiera di Napoli");
    const casella = p.nodo.querySelector('[data-campo="vendita-fiera"]');
    expect(casella.checked).toBe(false);
    await clicca(casella);
    expect(scritto).toBe("ev-na");
    await p.smonta();
  });

  it("togliendo la spunta si scrive il vuoto, non un'altra fiera", async () => {
    let scritto = "non chiamato";
    const p = await apri([NAPOLI], { valore: "ev-na", onCambia: (v) => { scritto = v; } });
    await clicca(p.nodo.querySelector('[data-campo="vendita-fiera"]'));
    expect(scritto).toBe("");
    await p.smonta();
  });

  it("con due fiere c'è la tendina, e si cambia", async () => {
    let scritto = "";
    const ieri = { ...NAPOLI, id: "ev-2", nome: "Congresso Roma", data_inizio: "2026-11-06", data_fine: "2026-11-08" };
    const p = await apri([NAPOLI, ieri], { valore: "ev-na", onCambia: (v) => { scritto = v; } });
    const tendina = p.nodo.querySelector('[data-campo="vendita_evento_id"]');
    expect(tendina).not.toBe(null);
    expect([...tendina.options].map((o) => o.value)).toEqual(["ev-na", "ev-2"]);
    await scegli(tendina, "ev-2");
    expect(scritto).toBe("ev-2");
    await p.smonta();
  });

  // UNA SPUNTA CHE NON PUÒ SCRIVERE NIENTE È UN DUBBIO, NON UNA SCELTA.
  it("senza nessuna fiera aperta non c'è la casella, e si dice dove si fa", async () => {
    const p = await apri([CATANIA]);
    expect(p.nodo.querySelector('[data-campo="vendita-fiera"]')).toBe(null);
    expect(pulito(p)).toContain("Gestione eventi");
    await p.smonta();
  });

  it("a scheda chiusa si legge la fiera, e si legge SOLO se c'è", async () => {
    const con = await apri([NAPOLI], { valore: "ev-na", soloLettura: true });
    expect(pulito(con)).toContain("Fiera di Napoli");
    expect(con.nodo.querySelector('[data-campo="vendita-fiera"]').disabled).toBe(true);
    await con.smonta();
    const senza = await apri([NAPOLI], { soloLettura: true });
    expect(pulito(senza)).toBe("");
    await senza.smonta();
  });
});

// ---------------------------------------------------------------------
// IL GESTO: la sezione nella scheda della fiera, da cui si flagga
describe("la sezione «Iscrizioni in fiera»", () => {
  const apri = (iscritti = TUTTE, onCambiato = () => {}) => monta(
    <SchedaIscrizioniFiera
      evento={NAPOLI} iscritti={iscritti} corsi={CORSI} corsiDate={CLASSI} location={LUOGHI}
      onCambiato={onCambiato}
    />,
  );

  it("elenca i corsi che si stanno chiudendo, e non quelli di un'altra fiera", async () => {
    const p = await apri();
    const t = pulito(p);
    expect(t).toContain("LAMINAZIONE BASE");
    expect(t).toContain("Giusy Quatrana");
    expect(t).toContain("Carmen Molitierno");
    // TRINH è di Catania: in questa scheda non compare né fra le
    // iscrizioni della fiera né fra le candidate
    expect(t).not.toContain("Trinh Dao");
    await p.smonta();
  });

  it("i numeri in cima sono quelli delle sue iscrizioni", async () => {
    const p = await apri();
    const t = pulito(p);
    // «1080,00 €» e non «1.080,00 €»: in questa pagina gli importi si
    // scrivono senza separatore delle migliaia, come nel Conto e nel
    // Dettaglio vendite. Due formati nella stessa scheda sarebbero peggio.
    expect(t).toContain("1080,00 €"); // pattuito di Giusy + Carmen
    expect(t).toContain("100,00 €");   // i due acconti già incassati
    await p.smonta();
  });

  it("propone le iscrizioni di quei giorni, e dice che non sono per forza sue", async () => {
    const p = await apri();
    const t = pulito(p);
    expect(t).toContain("Lucia Tessicini");
    expect(t).toContain("Non sono per forza della fiera");
    // MARTA è del 6 novembre, fuori dai giorni della fiera
    expect(t).not.toContain("Marta Cubeddu");
    await p.smonta();
  });

  // LA RICHIESTA DEL TITOLARE: segnare un'iscrizione già chiusa senza
  // aprire la sua scheda, che a iscrizione confermata è chiusa a chiave.
  it("«È della fiera» scrive l'id di QUESTA fiera su QUELLA iscrizione", async () => {
    let scritto = null;
    let indirizzo = "";
    let ricaricato = false;
    rispondiCon({ "/iscritti": (corpo, url) => { scritto = corpo; indirizzo = url; return [{ id: "i3" }]; } });
    const p = await apri(TUTTE, () => { ricaricato = true; });
    await clicca(p.nodo.querySelector('[data-segna="i3"]'));
    expect(scritto).toEqual({ vendita_evento_id: "ev-na" });
    expect(indirizzo).toContain("id=eq.i3");
    expect(ricaricato).toBe(true);
    await p.smonta();
  });

  it("«Non è della fiera» toglie l'attribuzione, non cancella niente", async () => {
    let scritto = null;
    rispondiCon({ "/iscritti": () => [{ id: "i1" }] });
    rispondiCon({ "/iscritti": (corpo) => { scritto = corpo; return [{ id: "i1" }]; } });
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-togli="i1"]'));
    expect(scritto).toEqual({ vendita_evento_id: null });
    await p.smonta();
  });

  // UN UPDATE SENZA `select` DICE «VA BENE» ANCHE QUANDO NON HA TOCCATO
  // NIENTE: l'iscrizione sembrerebbe segnata finché qualcuno non ricarica.
  it("se non si aggiorna nessuna riga lo dice, invece di far finta", async () => {
    rispondiCon({ "/iscritti": () => [] });
    const p = await apri();
    await clicca(p.nodo.querySelector('[data-segna="i3"]'));
    expect(pulito(p)).toContain("Non riesco a salvare");
    await p.smonta();
  });

  it("la scrittura passa da una funzione sola, e si lamenta se non tocca niente", async () => {
    rispondiCon({ "/iscritti": () => [] });
    await expect(segnaVenditaFiera("i3", "ev-na")).rejects.toThrow(/nessuna riga/);
  });

  it("senza nessuna iscrizione dice come si segnano", async () => {
    const p = await apri([]);
    expect(pulito(p)).toContain("Vendita fiera");
    await p.smonta();
  });
});
