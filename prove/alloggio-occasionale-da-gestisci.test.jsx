// L'ALLOGGIO PROVVISORIO da «Gestisci»: una scheda completa che crea un
// hotel occasionale e lo aggancia alla riga del corso, con le tariffe.
import { describe, it, expect } from "vitest";
import React from "react";
import { ModaleGestisciAlloggio, AssegnazioneMaster } from "../src/App.jsx";
import { monta, clicca, scrivi, attendi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CD = { id: "cd1", data_inizio: "2026-11-16", data_fine: "2026-11-17" };

describe("Alloggio occasionale da Gestisci", () => {
  it("crea l'hotel con i suoi dati e aggancia la riga del corso", async () => {
    const hotelScritti = []; const righeScritte = [];
    rispondiCon({
      "rest/v1/hotel": (corpo) => { if (corpo) hotelScritti.push(corpo); return { id: "h-nuovo" }; },
      "rest/v1/corsi_date": (corpo) => { if (corpo) righeScritte.push(corpo); return [{ id: "cd1" }]; },
    });
    let salvato = false;
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={CD} tabella="corsi_date" hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => { salvato = true; }} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /Provvisorio/.test(b.textContent)));
    await scrivi(p.nodo.querySelector('[data-campo="occ-nome"]'), "B&B Da Maria");
    await scrivi(p.nodo.querySelector('[data-campo="occ-telefono"]'), "333 1234567");
    await scrivi(p.nodo.querySelector('[data-campo="occ-costo-cash"]'), "60");
    await scrivi(p.campi().find((i) => i.getAttribute("inputmode") === "numeric"), "2");
    await clicca(p.tasto("Salva")); await attendi(150);
    expect(hotelScritti[0]).toMatchObject({ nome: "B&B Da Maria", telefono: "333 1234567", costo_notte_cash: 60, solo_edizione: true, ricorrente_occasionale: "occasionale" });
    expect(righeScritte[0]).toMatchObject({ alloggio_id: "h-nuovo", notti_prenotate: 2, pattuito_a_notte_cash: 60, pattuito_periodo_cash: 120 });
    expect(salvato).toBe(true);
    await p.smonta();
  });
  it("senza il nome non crea niente", async () => {
    const hotelScritti = [];
    rispondiCon({ "rest/v1/hotel": (corpo) => { if (corpo) hotelScritti.push(corpo); return { id: "x" }; }, "rest/v1/corsi_date": [] });
    const p = await monta(<ModaleGestisciAlloggio cd={CD} riga={CD} tabella="corsi_date" hotel={[]} hotelPrezzi={[]} hotelPeriodi={[]} onClose={() => {}} onSalvato={() => {}} />);
    await clicca([...p.nodo.querySelectorAll("button")].find((b) => /Provvisorio/.test(b.textContent)));
    await clicca(p.tasto("Salva")); await attendi(100);
    expect(hotelScritti.length).toBe(0);
    expect(p.testo()).toContain("Serve almeno il nome");
    await p.smonta();
  });
});

// LE DUE STRADE SI DEVONO VEDERE (11/11/2026).
//
// Il titolare: «in operativo corsi, quando per un corso non e' stato
// assegnato l'hotel, come succede per le sedi, che si puo' scegliere
// sede occasionale o sede gia' registrata, deve accadere la stessa cosa
// cliccando sugli hotel».
//
// Le due strade c'erano dal 28/10 — queste prove qui sopra le provano —
// ma nella pagina non si trovavano: la cella diceva «Gestisci», che non
// promette niente, e dentro la finestra erano due pastiglie da 12,5 px
// appoggiate sopra una tendina. Qui si guarda quello che una persona
// legge: la cella dice il gesto, e aperta la finestra le due strade ci
// sono con la riga che dice a cosa servono. jsdom non impagina, quindi
// la grandezza vera non si misura: si controlla che i due tasti siano
// quelli alti 44 della creazione corso e non le pastiglie di prima.
describe("Dalla pagina si capisce che l'alloggio si scegli", () => {
  it("la cella di un corso senza alloggio dice «Scegli alloggio» e nomina le due strade", async () => {
    rispondiCon({ "rest/v1/corsi_date": [], "rest/v1/hotel": [] });
    const p = await monta(
      <AssegnazioneMaster
        corsi={[{ id: "co1", nome: "SEXYLINE", colore: "#3D4A94" }]}
        location={[{ id: "lo1", nome: "ROMA", nome_sede: "Centrale" }]}
        corsiDate={[{ id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-11-20", data_fine: "2026-11-22", master_id: "ma1", pagamento_sede: "bonifico" }]}
        corsiDateDocenti={[]} master={[{ id: "ma1", nome: "CHIARA" }]} assistente={[]} leva={[]}
        hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} locationPrezzi={[]} spese={[]}
        ruoloUtente="programmatore" layoutCondiviso={null}
        ricarica={() => {}} onBack={() => {}} onApriRegistraSpesaAlloggio={() => {}}
      />
    );
    const cella = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Scegli alloggio");
    expect(cella).toBeTruthy();
    // il suggerimento dice le due strade: sul computer e' dove si guarda
    expect(cella.getAttribute("title")).toMatch(/registrati/);
    expect(cella.getAttribute("title")).toMatch(/provvisorio/i);
    // premuta, la finestra si apre con le due strade e con la riga che
    // dice che per questo corso un alloggio non c'e' ancora
    await clicca(cella);
    expect(p.testo()).toContain("Provvisorio / occasionale");
    expect(p.testo()).toMatch(/un alloggio non c.* ancora/);
    const tasti = [...p.nodo.querySelectorAll('[data-campo="alloggio-registrato"], [data-campo="alloggio-occasionale"]')];
    expect(tasti.length).toBe(2);
    for (const t of tasti) expect(t.getAttribute("style")).toContain("min-height: 44px");
    await p.smonta();
  });

  it("con l'alloggio già scelto la cella porta il suo nome e la riga non compare", async () => {
    rispondiCon({ "rest/v1/corsi_date": [], "rest/v1/hotel": [] });
    const p = await monta(
      <AssegnazioneMaster
        corsi={[{ id: "co1", nome: "SEXYLINE", colore: "#3D4A94" }]}
        location={[{ id: "lo1", nome: "ROMA", nome_sede: "Centrale" }]}
        corsiDate={[{ id: "cd1", corso_id: "co1", location_id: "lo1", data_inizio: "2026-11-20", data_fine: "2026-11-22", master_id: "ma1", pagamento_sede: "bonifico", alloggio_id: "h1" }]}
        corsiDateDocenti={[]} master={[{ id: "ma1", nome: "CHIARA" }]} assistente={[]} leva={[]}
        hotel={[{ id: "h1", nome: "Hotel Roma" }]} hotelPrezzi={[]} hotelPeriodi={[]} locationPrezzi={[]} spese={[]}
        ruoloUtente="programmatore" layoutCondiviso={null}
        ricarica={() => {}} onBack={() => {}} onApriRegistraSpesaAlloggio={() => {}}
      />
    );
    const cella = [...p.nodo.querySelectorAll("button")].find((b) => b.textContent.trim() === "HOTEL ROMA");
    expect(cella).toBeTruthy();
    await clicca(cella);
    // le due strade ci sono comunque — si cambia anche con un occasionale —
    // ma la riga di spiegazione no: la si imparerebbe a saltare
    expect(p.testo()).toContain("Provvisorio / occasionale");
    expect(p.testo()).not.toMatch(/un alloggio non c.* ancora/);
    await p.smonta();
  });
});
