// IL DEPOSITO DELLA MASTER È UN PROMEMORIA (12/11/2026)
//
// Il titolare, prima: «sulla scheda di ciascun corso, nella dashboard
// della master, nel caso in cui questa master abbia incassato dei
// pagamenti in contanti, ci dovrà essere un riepilogo con scritto "devi
// depositare euro". Dopodiché, una volta che la master ha depositato, ci
// deve essere a fianco un tasto con scritto "depositato", e quando la
// master schiaccia il tasto depositato si accende un tasto sul riepilogo
// amministrativo di Stefano, Elena, John, Chiara, con scritto "ricevuto
// deposito master euro", e la master a sua volta nella dashboard il tasto
// deposita si trasforma in "conferma di ricevuta" con vicino la data.»
//
// E poi, correggendo la prima versione: «il tasto della master non fa
// operazioni contabili, è solo una funzione di promemoria con cui la
// master segnala di aver lasciato i soldi e l'amministrazione conferma di
// averli ricevuti», e «i soldi non vanno a sommare in cassa, funge da
// deposito».
//
// Quindi la cosa che queste prove inchiodano è quello che il tasto NON
// fa: non chiude la contabilità della classe, non congela l'importo della
// busta, non marca nessuna vendita, non mette niente in cassa contanti.
// La prima versione faceva tutte e quattro.
import { describe, it, expect } from "vitest";
import React from "react";
import {
  contanteDaDepositare, contiRiepilogoClasse, venditeDellaPrimaBusta, depositoMasterDi,
  CardDataMaster, PannelloRiepilogoAmministrativo, PaginaDashboardMaster,
} from "../src/App.jsx";
import { monta, clicca, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const CD = { id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-11-10", data_fine: "2026-11-11" };
const VENDITA_CASH = { id: "v1", corso_data_id: "cd1", tipo_movimento: "vendita", metodo_pagamento: "contanti", totale: 150, totale_imponibile: 150, busta_numero: null, prodotti: [], data_ordine: "2026-11-10T10:00:00" };
// un'allieva che ha saldato in contanti al corso
const ISCRITTA = { id: "i1", corso_data_id: "cd1", nome: "ANNA", saldo_totale: 200, saldo_metodo: "Cash no iva", incassato: true };

describe("il numero è uno: quello che la master legge e quello del Riepilogo", () => {
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

describe("il promemoria vive per conto suo, non sulle date della busta", () => {
  it("una busta spedita dall'amministrazione NON è un deposito dichiarato", () => {
    // è questa la riga che prima non c'era: la busta chiusa dall'ufficio
    // veniva letta come «la master ha dichiarato il deposito»
    const chiusa = { ...CD, busta_spedita_il: "2026-11-12", busta_importo: 300, busta_vendite_marcate: true };
    expect(depositoMasterDi(chiusa).dichiarato).toBe(false);
    expect(depositoMasterDi(chiusa).confermato).toBe(false);
  });
  it("e una busta in cassa non è una conferma di ricevuta", () => {
    const inCassa = { ...CD, busta_spedita_il: "2026-11-12", busta_rientrata_il: "2026-11-13", busta_depositata_il: "2026-11-13", busta_importo: 300 };
    expect(depositoMasterDi(inCassa).confermato).toBe(false);
  });
  it("le due date del promemoria, con l'importo che la master ha dichiarato", () => {
    const cd = { ...CD, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350, deposito_master_ricevuto_il: "2026-11-13" };
    const d = depositoMasterDi(cd);
    expect(d.dichiarato).toBe(true);
    expect(d.confermato).toBe(true);
    expect(d.dataDichiarato).toBe("2026-11-12");
    expect(d.dataConferma).toBe("2026-11-13");
    expect(d.masterId).toBe("m1");
    expect(d.importo).toBe(350);
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
    // e dice che non chiude niente: è la frase che distingue le due versioni
    expect(p.testo()).toContain("promemoria");
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato");
    expect(tasto).toBeTruthy();
    await clicca(tasto);
    expect(premuto).toBe(1);
    await p.smonta();
  });

  it("dichiarato: pastiglia «Depositato» con la data, e si può disfare", async () => {
    let annullato = 0;
    const p = await monta(card({ importo: 300, stato: "dichiarato", dataDichiarato: "2026-11-12", premibile: false, annullabile: true, salvando: false, messaggio: "", onDeposita: () => {}, onAnnulla: () => { annullato += 1; } }));
    expect(p.testo()).toContain("12/11/2026");
    expect(p.testo()).toContain("deve ancora confermare");
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato")).toBeFalsy();
    const disfa = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.includes("Non li ho ancora lasciati"));
    expect(disfa).toBeTruthy();
    await clicca(disfa);
    expect(annullato).toBe(1);
    await p.smonta();
  });

  it("confermato: diventa «Conferma di ricevuta» con la data, e non si disfa più da qui", async () => {
    const p = await monta(card({ importo: 300, stato: "confermato", dataConferma: "2026-11-13", premibile: false, annullabile: false, salvando: false, messaggio: "", onDeposita: () => {} }));
    expect(p.testo()).toContain("Conferma di ricevuta");
    expect(p.testo()).toContain("13/11/2026");
    expect(p.testo()).toContain("Deposito ricevuto");
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.includes("Non li ho ancora lasciati"))).toBeFalsy();
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

describe("il Riepilogo amministrativo: una riga sua, separata dalla busta", () => {
  const pannello = (cd) => (
    <PannelloRiepilogoAmministrativo
      corsoData={cd} iscritti={[]} spese={[]} venditeShop={[{ ...VENDITA_CASH, busta_numero: 1 }]} prodottiShop={[]}
      corsi={[{ id: "co1", nome: "PMU" }]} corsiDateDocenti={[]} master={[{ id: "m1", nome: "Chiara" }]} masterCorsi={[]}
      assistente={[]} assistenteCorsi={[]} leva={[]} location={[{ id: "lo1", nome: "ROMA" }]} hotel={[]}
      costiCategorie={[]} costiSottocategorie={[]} quoteVenditoriSplit={[]} ricarica={async () => {}}
      onMessaggio={() => {}}
    />
  );
  const soloLetture = () => rispondiCon({
    "rest/v1/corsi_date_buste": [], "rest/v1/corsi_date": [], "rest/v1/vendite_shop": [], "rest/v1/spese": [],
  });

  it("dichiarato: «Deposito di CHIARA: da ricevere» col tasto «Ricevuto deposito master € X»", async () => {
    soloLetture();
    const cd = { ...CD, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350 };
    const p = await monta(pannello(cd));
    await attendi(200);
    expect(p.testo()).toContain("Deposito di CHIARA: da ricevere");
    expect(p.testo()).toContain("CHIARA ha segnalato il 12/11/2026");
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ricevuto deposito master"));
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(false);
    expect(tasto.textContent).toContain("350");
    await p.smonta();
  });

  it("e la busta resta la busta: il tasto arancione non si chiama più col nome della master", async () => {
    soloLetture();
    // busta per strada E deposito dichiarato insieme: due cose, due righe
    const cd = { ...CD, busta_spedita_il: "2026-11-12", busta_importo: 300, busta_vendite_marcate: true, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 300 };
    const p = await monta(pannello(cd));
    await attendi(200);
    expect(p.testo()).toContain("Busta in viaggio");
    const arancione = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Busta in viaggio");
    expect(arancione).toBeTruthy();
    // il tasto del promemoria c'è, ed è un altro
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ricevuto deposito master"))).toBeTruthy();
    await p.smonta();
  });

  it("niente dichiarato, nessuna riga: non si scrive «nessun deposito»", async () => {
    soloLetture();
    const p = await monta(pannello({ ...CD }));
    await attendi(200);
    expect(p.testo()).not.toContain("Deposito di");
    expect(p.testo()).not.toContain("Ricevuto deposito master");
    await p.smonta();
  });

  it("premere «Ricevuto deposito master» scrive SOLO la data della conferma", async () => {
    const scritture = [];
    rispondiCon({
      "rest/v1/corsi_date_buste": [],
      "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(corpo); return [{ id: "cd1" }]; },
      "rest/v1/vendite_shop": (corpo) => { if (corpo) scritture.push(corpo); return []; },
      "rest/v1/spese": [],
    });
    const cd = { ...CD, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350 };
    const p = await monta(pannello(cd));
    await attendi(200);
    window.confirm = () => true;
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ricevuto deposito master"));
    await clicca(tasto); await attendi(200);
    expect(scritture.length).toBe(1);
    expect(Object.keys(scritture[0])).toEqual(["deposito_master_ricevuto_il"]);
    await p.smonta();
  });

  it("confermato: pastiglia verde con la data, e il passo indietro toglie la sola conferma", async () => {
    const scritture = [];
    rispondiCon({
      "rest/v1/corsi_date_buste": [],
      "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(corpo); return [{ id: "cd1" }]; },
      "rest/v1/vendite_shop": [], "rest/v1/spese": [],
    });
    const cd = { ...CD, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350, deposito_master_ricevuto_il: "2026-11-13" };
    const p = await monta(pannello(cd));
    await attendi(200);
    expect(p.testo()).toContain("Deposito di CHIARA: ricevuto");
    expect(p.testo()).toContain("13/11/2026");
    window.confirm = () => true;
    const disfa = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.includes("Non li abbiamo ricevuti"));
    expect(disfa).toBeTruthy();
    await clicca(disfa); await attendi(200);
    // la dichiarazione della master resta: è una cosa che ha detto lei
    expect(scritture.length).toBe(1);
    expect(Object.keys(scritture[0])).toEqual(["deposito_master_ricevuto_il"]);
    expect(scritture[0].deposito_master_ricevuto_il).toBe(null);
    await p.smonta();
  });
});

describe("il gesto, con la dashboard della master montata per davvero", () => {
  const CD_APERTA = { ...CD, id: "cd9", data_inizio: "2026-11-10", data_fine: "2026-11-20", master_id: "m1" };
  const dashboard = (corsiDate) => (
    <PaginaDashboardMaster
      master={[{ id: "m1", nome: "Chiara" }]} corsi={[{ id: "co1", nome: "PMU" }]}
      location={[{ id: "lo1", nome: "ROMA" }]} corsiDate={corsiDate} hotel={[]}
      iscritti={[{ ...ISCRITTA, corso_data_id: "cd9" }]}
      masterLoggataId="m1" ricarica={async () => {}}
      venditeShop={[{ ...VENDITA_CASH, corso_data_id: "cd9" }]} prodottiShop={[]}
      targetVenditeProdotti={[]} coupon={[]} puntiMasterImpostazioni={{}} regoleReferralAutomatico={{}}
      ruoloUtente="master" utenteLoggato={{ masterId: "m1" }} venditoreLoggato={null}
      assistenti={[]} corsiDateDocenti={[]} onBack={() => {}}
    />
  );

  it("premere «Depositato» scrive il promemoria e NIENTE ALTRO", async () => {
    const scritture = [];
    rispondiCon({
      "rest/v1/spese": (corpo) => { if (corpo) scritture.push(["spese", corpo]); return []; },
      "rest/v1/corsi_date": (corpo) => { if (corpo) scritture.push(["corsi_date", corpo]); return [{ id: "cd9" }]; },
      "rest/v1/vendite_shop": (corpo) => { if (corpo) scritture.push(["vendite_shop", corpo]); return []; },
    });
    const p = await monta(dashboard([CD_APERTA]));
    await attendi(300);
    // 200 di saldo in contanti + 150 di vendita al banco
    expect(p.testo()).toContain("Devi depositare");
    expect(p.testo()).toContain("350,00");
    window.confirm = () => true;
    const tasto = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato");
    expect(tasto).toBeTruthy();
    await clicca(tasto); await attendi(250);

    const scritte = scritture.filter((x) => x[0] === "corsi_date");
    expect(scritte.length).toBe(1);
    // le tre chiavi del promemoria, e nessun'altra
    expect(Object.keys(scritte[0][1]).sort()).toEqual(["deposito_master_da_id", "deposito_master_il", "deposito_master_importo"]);
    expect(scritte[0][1].deposito_master_importo).toBe(350);
    expect(scritte[0][1].deposito_master_da_id).toBe("m1");

    // QUESTO è il punto della correzione: niente di contabile si è mosso
    const corpo = scritte[0][1];
    expect(corpo.busta_spedita_il).toBeUndefined();
    expect(corpo.busta_depositata_il).toBeUndefined();
    expect(corpo.busta_importo).toBeUndefined();
    expect(corpo.busta_vendite_marcate).toBeUndefined();
    // e nessuna vendita è stata marcata: la contabilità resta aperta
    expect(scritture.some((x) => x[0] === "vendite_shop" && x[1])).toBe(false);
    await p.smonta();
  });

  it("già dichiarato: legge la data e non ripreme", async () => {
    rispondiCon({ "rest/v1/spese": [], "rest/v1/corsi_date": [], "rest/v1/vendite_shop": [] });
    const p = await monta(dashboard([{ ...CD_APERTA, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350 }]));
    await attendi(300);
    expect(p.testo()).toContain("Hai segnalato il deposito il 12/11/2026");
    expect([...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Depositato")).toBeFalsy();
    await p.smonta();
  });

  it("confermato dall'amministrazione: «Conferma di ricevuta» con la data", async () => {
    rispondiCon({ "rest/v1/spese": [], "rest/v1/corsi_date": [], "rest/v1/vendite_shop": [] });
    const p = await monta(dashboard([{ ...CD_APERTA, deposito_master_il: "2026-11-12", deposito_master_da_id: "m1", deposito_master_importo: 350, deposito_master_ricevuto_il: "2026-11-13" }]));
    await attendi(300);
    expect(p.testo()).toContain("Conferma di ricevuta");
    expect(p.testo()).toContain("13/11/2026");
    await p.smonta();
  });
});
