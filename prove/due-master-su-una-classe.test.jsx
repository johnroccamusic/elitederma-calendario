// DUE MASTER SU UNA CLASSE LA VEDONO TUTTE E DUE. 24/11/2026.
//
// Il titolare: «se associo 2 master a un corso entrambe devono vedere il
// corso nella loro dashboard come se fossero master tutte e due».
//
// Il caso vero, in aula mentre questa prova veniva scritta: PMU BASE a
// MILANO, 22-27 novembre 2026, master STEFANIA SANNA e seconda master
// DEBORA FUMAGALLI (una riga di `corsi_date_docenti` con `tipo: master`).
// Il calendario e «Assegnazione Master» la mostravano a entrambe; la
// DASHBOARD della master e il POS no, perche' quella domanda era scritta
// a mano in quattro punti e tre rispondevano diverso. Da oggi la risposta
// e' una sola, `edizioniDellaMaster`.
//
// Nota su chi vede cosa: un'ASSISTENTE quel ramo ce l'aveva da sempre,
// quindi fino a ieri un'assistente vedeva piu' di una seconda master.
import { describe, it, expect } from "vitest";
import React from "react";
import { edizioniDellaMaster, PaginaDashboardMaster } from "../src/App.jsx";
import { monta, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const giorni = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// la classe di Milano: Stefania principale, Debora seconda master
const CLASSE = { id: "cdMI", corso_id: "pmu", master_id: "stefania", citta: "MILANO", location_id: "loMI", data_inizio: giorni(-2), data_fine: giorni(3) };
const ALTRA = { id: "cdRM", corso_id: "lam", master_id: "chiara", citta: "ROMA", location_id: "loRM", data_inizio: giorni(-2), data_fine: giorni(3) };
const DOCENTI = [
  { id: "d1", corso_data_id: "cdMI", tipo: "master", persona_id: "debora" },
  { id: "d2", corso_data_id: "cdRM", tipo: "assistente", persona_id: "martina" },
];

describe("la domanda «quali classi sono di questa master» ha una risposta sola", () => {
  it("prende quelle dove è la master principale e quelle dove è la seconda", () => {
    expect(edizioniDellaMaster([CLASSE, ALTRA], DOCENTI, "stefania").map((c) => c.id)).toEqual(["cdMI"]);
    expect(edizioniDellaMaster([CLASSE, ALTRA], DOCENTI, "debora").map((c) => c.id)).toEqual(["cdMI"]);
    expect(edizioniDellaMaster([CLASSE, ALTRA], DOCENTI, "chiara").map((c) => c.id)).toEqual(["cdRM"]);
  });

  it("una classe non si conta due volte se è principale E seconda master", () => {
    const doppia = [{ id: "d9", corso_data_id: "cdMI", tipo: "master", persona_id: "stefania" }];
    expect(edizioniDellaMaster([CLASSE], doppia, "stefania").map((c) => c.id)).toEqual(["cdMI"]);
  });

  it("un'assistente non diventa master, e senza master non si risponde niente", () => {
    expect(edizioniDellaMaster([CLASSE, ALTRA], DOCENTI, "martina")).toEqual([]);
    expect(edizioniDellaMaster([CLASSE, ALTRA], DOCENTI, null)).toEqual([]);
    expect(edizioniDellaMaster([CLASSE, ALTRA], null, "debora").map((c) => c.id)).toEqual([]);
  });
});

describe("la dashboard della seconda master, montata per davvero", () => {
  const dashboard = (masterLoggataId) => (
    <PaginaDashboardMaster
      master={[{ id: "stefania", nome: "STEFANIA SANNA" }, { id: "debora", nome: "DEBORA FUMAGALLI" }, { id: "chiara", nome: "CHIARA COLONNELLI" }]}
      corsi={[{ id: "pmu", nome: "PMU BASE" }, { id: "lam", nome: "LAMINAZIONE BASE" }]}
      location={[{ id: "loMI", nome: "MILANO" }, { id: "loRM", nome: "ROMA" }]}
      corsiDate={[CLASSE, ALTRA]} hotel={[]} iscritti={[]}
      masterLoggataId={masterLoggataId} ricarica={async () => {}}
      venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} coupon={[]}
      puntiMasterImpostazioni={{}} regoleReferralAutomatico={{}}
      ruoloUtente="master" utenteLoggato={{ masterId: masterLoggataId }} venditoreLoggato={null}
      assistenti={[]} corsiDateDocenti={DOCENTI} onBack={() => {}}
    />
  );

  it("Debora, seconda master, vede il PMU BASE di Milano", async () => {
    rispondiCon({});
    const p = await monta(dashboard("debora"));
    await attendi(300);
    expect(p.testo()).toContain("PMU BASE");
    await p.smonta();
  });

  it("e non vede la classe di un'altra master", async () => {
    rispondiCon({});
    const p = await monta(dashboard("debora"));
    await attendi(300);
    expect(p.testo()).not.toContain("LAMINAZIONE BASE");
    await p.smonta();
  });

  it("la master principale continua a vedere la sua", async () => {
    rispondiCon({});
    const p = await monta(dashboard("stefania"));
    await attendi(300);
    expect(p.testo()).toContain("PMU BASE");
    await p.smonta();
  });
});

describe("la guardia: la risposta sta in un posto solo", () => {
  it("dashboard e POS passano da `edizioniDellaMaster`, e il filtro a mano non torna", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sorgente = fs.readFileSync(path.resolve(__dirname, "../src/App.jsx"), "utf8");
    expect(sorgente).toContain("edizioniDellaMaster(corsiDate, corsiDateDocenti, masterSelId)");
    expect(sorgente).toContain("edizioniDellaMaster(corsiDate, corsiDateDocentiPos, operatore.id)");
    // i due filtri scritti a mano che tagliavano fuori la seconda master
    expect(sorgente).not.toContain("corsiDate.filter((cd) => cd.master_id === masterSelId)");
    expect(sorgente).not.toContain("corsiFinestraPos.filter((cd) => cd.master_id === operatore.id)");
  });

  it("e il POS chiede al database anche le righe `master`, o quell'elenco sarebbe vuoto", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sorgente = fs.readFileSync(path.resolve(__dirname, "../src/App.jsx"), "utf8");
    expect(sorgente).toContain('const tipi = ["assistente", "master"];');
    expect(sorgente).not.toContain('.eq("tipo", "assistente")');
  });
});
