// IL DEPOSITO DELLA MASTER (12/11/2026)
//
// Il titolare: «sulla scheda di ciascun corso, nella dashboard della
// master, nel caso in cui questa master abbia incassato dei pagamenti in
// contanti, ci dovrà essere un riepilogo con scritto "devi depositare
// euro". Dopodiché, una volta che la master ha depositato, ci deve essere a
// fianco un tasto con scritto "depositato", e quando la master schiaccia il
// tasto depositato si accende un tasto sul riepilogo amministrativo di
// Stefano, Elena, John, Chiara, con scritto "ricevuto deposito master
// euro", e la master a sua volta nella dashboard il tasto deposita si
// trasforma in "conferma di ricevuta" con vicino la data.»
//
// Deciso dal titolare: sono gli STESSI soldi della busta di quella classe.
// Quindi la cosa da inchiodare, più dei tasti, è che il numero sia UNO:
// quello che la master legge e quello che la busta congela.
import { describe, it, expect } from "vitest";
import React from "react";
import {
  contanteDaDepositare, contiRiepilogoClasse, venditeDellaPrimaBusta,
  CardDataMaster, PannelloRiepilogoAmministrativo, PaginaDashboardMaster,
} from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const CD = { id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-11-10", data_fine: "2026-11-11" };
const VENDITA_CASH = { id: "v1", corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: "contanti", totale: 150, totale_imponibile: 150, busta_numero: null, prodotti: [], data_ordine: "2026-11-10T10:00:00" };
// un'allieva che ha saldato in contanti al corso
const ISCRITTA = { id: "i1", corso_data_id: "cd1", nome: "ANNA", saldo_totale: 200, saldo_metodo: "Cash no iva", incassato: true };

describe("il numero è uno: quello che la master legge e quello che la busta congela", () => {
  it("contante incassato al corso, meno quello già uscito da quella busta", () => {
    const spese = [
      // 50 € di spesa pagata in contanti dalla busta: quei soldi non ci sono più
      { id: "s1", classe_id: "cd1", totale: 50, importo_pagato_cash: 50, metodo_pagamento: "Contanti", stato: "pagata" },
      // una pagata dalla cassa contanti NON esce dalla busta
      { id: "s2", classe_id: "cd1", totale: 30, importo_pagato_cash: 30, metodo_pagamento: "Cassa contanti", stato: "pagata" },
    ];
    const atteso = contiRiepilogoClasse({
      listaIscritti: [ISCRITTA],
      venditeAlCorso: venditeDellaPrimaBusta([VENDITA_CASH], CD),
      speseClasse: spese,
    }).cassaContanti;
    expect(atteso).toBe(300); // 200 di saldo + 150 di vendite − 50 usciti
    expect(contanteDaDepositare({ cd: CD, iscritti: [ISCRITTA], venditeShop: [VENDITA_CASH], spese })).toBe(300);
  });
  it("a busta chiusa comanda l'importo congelato, non un conto rifatto adesso", () => {
    const chiusa = { ...CD, busta_spedita_il: "2026-11-12", busta_importo: 300, busta_vendite_marcate: true };
    // nel frattempo è arrivata un'altra vendita in contanti: non tocca il numero
    const dopo = { ...VENDITA_CASH, id: "v2", totale: 90 };
    expect(contanteDaDepositare({ cd: chiusa, iscritti: [ISCRITTA], venditeShop: [{ ...VENDITA_CASH, busta_numero: 1 }, dopo], spese: [] })).toBe(300);
  });
  it("niente contanti, niente deposito", () => {
    const soloPos = { ...VENDITA_CASH, metodo_pagamento: "pos" };
    expect(contanteDaDepositare({ cd: CD, iscritti: [], venditeShop: [soloPos], spese: [] })).toBe(0);
  });
});

describe("la scheda del corso nella dashboard della master", () => {
  const card = (deposito) => (
    <CardDataMaster corsoData={CD} corso={{ id: "co1", nome: "PMU" }} loc={{ id: "lo1", nome: "ROMA" }} iscrittiEdizione={[]} deposito={deposito} />
  );

  it("dice quanto deve depositare, col tasto «Depositato»", async () => {
    let premuto = 0;
    const p = await monta(card({ importo: 300, stato: "da_depositare", premibile: true, salvando: false, messaggio: "", onDeposita: () => { premuto += 1; } }));
    expect(p.testo()).toContain("Contanti incassati a questo corso");
    expect(p.testo()).toContain("Devi depositare");
    expect(p.testo()).toContain("300,00");
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato");
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    expect(premuto).toBe(1);
    await p.smonta();
  });

  it("dichiarato: il tasto dice «Depositato» con la data, e non si preme più", async () => {
    const p = await monta(card({ importo: 300, stato: "dichiarato", dataDichiarato: "2026-11-12", premibile: false, salvando: false, messaggio: "", onDeposita: () => {} }));
    expect(p.testo()).toContain("12/11/2026");
    expect(p.testo()).toContain("deve ancora confermare");
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato")).toBeFalsy();
    await p.smonta();
  });

  it("confermato: diventa «Conferma di ricevuta» con la data", async () => {
    const p = await monta(card({ importo: 300, stato: "confermato", dataConferma: "2026-11-13", premibile: false, salvando: false, messaggio: "", onDeposita: () => {} }));
    expect(p.testo()).toContain("Conferma di ricevuta");
    expect(p.testo()).toContain("13/11/2026");
    expect(p.testo()).toContain("Deposito ricevuto");
    await p.smonta();
  });

  it("chi sfoglia la dashboard di un'altra legge e non preme", async () => {
    const p = await monta(card({ importo: 300, stato: "da_depositare", premibile: false, salvando: false, messaggio: "", onDeposita: () => {} }));
    expect(p.testo()).toContain("Devi depositare");
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato")).toBeFalsy();
    await p.smonta();
  });

  it("su un corso senza contanti il riquadro non c'è", async () => {
    const p = await monta(card(null));
    expect(p.testo()).not.toContain("Devi depositare");
    await p.smonta();
  });
});

describe("il riepilogo amministrativo nomina la master", () => {
  it("il tasto arancione diventa «Ricevuto deposito master € X»", async () => {
    rispondiCon({
      "rest/v1/corsi_date_buste": [],
      "rest/v1/corsi_date": [],
      "rest/v1/vendite_shop": [],
      "rest/v1/spese": [],
    });
    const cd = { ...CD, busta_spedita_il: "2026-11-12", busta_importo: 300, busta_vendite_marcate: true, busta_spedita_da_master_id: "m1" };
    const p = await monta(
      <PannelloRiepilogoAmministrativo
        corsoData={cd} iscritti={[]} spese={[]} venditeShop={[{ ...VENDITA_CASH, busta_numero: 1 }]} prodottiShop={[]}
        corsi={[{ id: "co1", nome: "PMU" }]} corsiDateDocenti={[]} master={[{ id: "m1", nome: "Chiara" }]} masterCorsi={[]}
        assistente={[]} assistenteCorsi={[]} leva={[]} location={[{ id: "lo1", nome: "ROMA" }]} hotel={[]}
        costiCategorie={[]} costiSottocategorie={[]} quoteVenditoriSplit={[]} ricarica={async () => {}}
        onMessaggio={() => {}}
      />
    );
    await attendi(200);
    expect(p.testo()).toContain("Deposito di CHIARA: da ricevere");
    expect(p.testo()).toContain("CHIARA ha dichiarato il deposito il 12/11/2026");
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ricevuto deposito master"));
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(false);
    await p.smonta();
  });
});

describe("il gesto, con la dashboard della master montata per davvero", () => {
  it("premere «Depositato» chiude la contabilità di quella classe e marca TUTTE le sue vendite", async () => {
    const scritture = [];
    const CD_APERTA = { ...CD, id: "cd9", data_inizio: "2026-11-10", data_fine: "2026-11-20", master_id: "m1" };
    rispondiCon({
      // le spese delle sue classi: la query mirata della dashboard
      "rest/v1/spese": (corpo) => { if (corpo) scritture.push(["spese", corpo]); return []; },
      "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(["corsi_date", corpo]); return []; },
      "rest/v1/vendite_shop": (corpo) => { if (corpo) scritture.push(["vendite_shop", corpo]); return []; },
    });
    const p = await monta(
      <PaginaDashboardMaster
        master={[{ id: "m1", nome: "Chiara" }]} corsi={[{ id: "co1", nome: "PMU" }]}
        location={[{ id: "lo1", nome: "ROMA" }]} corsiDate={[CD_APERTA]} hotel={[]}
        iscritti={[{ ...ISCRITTA, corso_data_id: "cd9" }]}
        masterLoggataId="m1" ricarica={async () => {}}
        venditeShop={[{ ...VENDITA_CASH, corso_data_id: "cd9" }]} prodottiShop={[]}
        targetVenditeProdotti={[]} coupon={[]} puntiMasterImpostazioni={{}} regoleReferralAutomatico={{}}
        ruoloUtente="master" utenteLoggato={{ masterId: "m1" }} venditoreLoggato={null}
        assistenti={[]} corsiDateDocenti={[]} onBack={() => {}}
      />
    );
    await attendi(300);
    // 200 di saldo in contanti + 150 di vendita al banco
    expect(p.testo()).toContain("Devi depositare");
    expect(p.testo()).toContain("350,00");
    window.confirm = () => true;
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato");
    expect(tasto).toBeTruthy();
    await clicca(tasto); await attendi(250);
    const chiusura = scritture.find((x) => x[0] === "corsi_date" && x[1].busta_spedita_il);
    expect(chiusura).toBeTruthy();
    // l'importo si congela, e resta scritto che l'ha chiusa lei
    expect(chiusura[1].busta_importo).toBe(350);
    expect(chiusura[1].busta_spedita_da_master_id).toBe("m1");
    // la marcatura che rende conoscibile il «dopo» anche per il POS
    expect(chiusura[1].busta_vendite_marcate).toBe(true);
    expect(scritture.find((x) => x[0] === "vendite_shop" && x[1].busta_numero === 1)).toBeTruthy();
    await p.smonta();
  });
});
