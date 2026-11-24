// I RIMBALZI SI GUARDANO E SI CORREGGONO. 24/11/2026.
//
// Il titolare, dopo la prima campagna vera (437 mail, 20 rimbalzi):
// «clicco sui 20 indirizzi rimbalzati e vedo se sono recuperabili, del
// tipo Gmail, se fossero scritti in un modo inappropriato… a sinistra
// l'indirizzo rimbalzato, a destra un campo pulito dove posso mettere la
// correzione, e alla fine un tasto rinvia la mail agli indirizzi
// corretti».
//
// I VENTI RIMBALZI VERI sono tre famiglie, e queste prove girano sui loro
// indirizzi: tre errori di battitura («libero.ti», «gmail.con»), degli
// indirizzi messi per riempire un campo obbligatorio («no@claa.com», un
// nome di battesimo su gmail) e degli indirizzi di forma giusta con la
// casella chiusa. L'app propone una correzione solo per i primi: sulle
// altre due famiglie non indovina.
import { describe, it, expect } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import ComponiMail from "../src/crm/ComponiMail.jsx";
import { correzioneEmail, avvisoEmail } from "../src/iscrizione/email.js";
import { monta, attendi, clicca, scrivi } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const CAMPAGNA = {
  id: "c1", nome: "KATIA SOLO CHIUSI", oggetto: "{nome}, ci tenevamo ad aggiornarti",
  corpo_html: "<p>Ciao {nome}</p>", stato: "inviata", inviate: 437, fallite: 0,
  totale_destinatari: 437, filtri: { trattato_da: "Katia", esito_operatore: "chiusi" },
};
// tre righe prese dai rimbalzi veri del 24/11: una da correggere, una
// senza correzione possibile, una di forma giusta
const RIMBALZATI = [
  { id: "r1", nome: "Carmela R.", email: "carmen.riccic@libero.ti", stato: "rimbalzata", ultimo_evento: "email.bounced", ultimo_evento_il: "2026-11-24T14:22:25Z" },
  { id: "r2", nome: "Claudia", email: "no@claa.com", stato: "rimbalzata", ultimo_evento: "email.bounced", ultimo_evento_il: "2026-11-24T14:23:14Z" },
  { id: "r3", nome: "Maddalena R.", email: "romanomaddalena82@gmail.com", stato: "rimbalzata", ultimo_evento: "email.bounced", ultimo_evento_il: "2026-11-24T14:23:13Z" },
];

// la lettura dei rimbalzati e quella del pannello «uno per uno» chiedono
// la stessa tabella: si distinguono dal filtro sullo stato nell'indirizzo
function finta(righe = RIMBALZATI, extra = {}) {
  return rispondiCon({
    intestazione_societa: {},
    crm_campagne_destinatari: (_corpo, url) =>
      url.includes("rimbalzata") && !url.includes("count") ? righe : [],
    crm_campagne: [CAMPAGNA],
    ...extra,
  });
}

describe("la correzione che l'app propone", () => {
  it("corregge le code e i fornitori scritti storti, cioè i rimbalzi veri di oggi", () => {
    expect(correzioneEmail("carmen.riccic@libero.ti")).toBe("carmen.riccic@libero.it");
    expect(correzioneEmail("lucreziazecchinelli01@gmail.con")).toBe("lucreziazecchinelli01@gmail.com");
    expect(correzioneEmail("anna@gmial.com")).toBe("anna@gmail.com");
  });

  it("NON indovina dove non c'è un errore di battitura", () => {
    // indirizzi messi per riempire un campo obbligatorio: non si correggono
    expect(correzioneEmail("no@claa.com")).toBe("");
    expect(correzioneEmail("vicky@gmail.com")).toBe("");
    // forma giusta, casella chiusa: niente da proporre
    expect(correzioneEmail("romanomaddalena82@gmail.com")).toBe("");
    // code che somigliano a errori e sono vere (Colombia, Camerun)
    expect(correzioneEmail("mario@azienda.co")).toBe("");
    expect(correzioneEmail("")).toBe("");
    expect(correzioneEmail(null)).toBe("");
  });

  it("legge la stessa tabella di avvisoEmail: dove avvisa, sa anche correggere", () => {
    for (const storto of ["anna@libero.ti", "anna@gmail.con", "anna@gmial.com", "anna@hotmial.it"]) {
      expect(avvisoEmail(storto), storto).not.toBe("");
      expect(correzioneEmail(storto), storto).not.toBe("");
    }
  });
});

describe("il pannello degli indirizzi rimbalzati", () => {
  it("elenca i rimbalzati con il loro indirizzo, aperto di suo", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    const pannello = nodo.querySelector("[data-rimbalzati]");
    expect(pannello).toBeTruthy();
    expect(pannello.textContent).toContain("Indirizzi rimbalzati (3)");
    expect(pannello.textContent).toContain("carmen.riccic@libero.ti");
    expect(pannello.textContent).toContain("no@claa.com");
  });

  it("ogni riga ha la sua casella, e nasce VUOTA come l'ha chiesta", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    const caselle = nodo.querySelectorAll("[data-correzione]");
    expect(caselle.length).toBe(3);
    for (const c of caselle) expect(c.value).toBe("");
  });

  it("la correzione evidente si OFFRE come pastiglia, e non è già scritta", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    // su «libero.ti» la proposta c'è
    expect(nodo.querySelector('[data-proposta="carmen.riccic@libero.it"]')).toBeTruthy();
    // sugli altri due no, e lo dice invece di tacere
    expect(nodo.querySelector("[data-rimbalzati]").textContent).toContain("Nessuna correzione evidente");
  });

  it("premuta la pastiglia, la casella si riempie con quella proposta", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    await clicca(nodo.querySelector('[data-proposta="carmen.riccic@libero.it"]'));
    expect(nodo.querySelector('[data-correzione="carmen.riccic@libero.ti"]').value)
      .toBe("carmen.riccic@libero.it");
  });

  it("dice perché un indirizzo di forma giusta può essere rimbalzato", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    expect(nodo.querySelector("[data-rimbalzati]").textContent)
      .toContain("forse la casella è piena o chiusa");
  });

  it("senza nessuna correzione scritta il tasto di rinvio è SPENTO", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    const tasto = [...nodo.querySelectorAll("button")].find((b) => /Rinvia la mail/.test(b.textContent));
    expect(tasto).toBeTruthy();
    expect(tasto.disabled).toBe(true);
  });

  it("senza rimbalzi il pannello non c'è: non è un riquadro che dice «nessuno»", async () => {
    finta([]);
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    expect(nodo.querySelector("[data-rimbalzati]")).toBeNull();
  });
});

describe("il rinvio agli indirizzi corretti", () => {
  it("manda al database SOLO le righe corrette, con il nuovo indirizzo", async () => {
    const chiamate = [];
    finta(RIMBALZATI, {
      crm_campagna_correggi_rimbalzi: (corpo) => {
        chiamate.push(corpo);
        return { corrette: 1, rifiutate: [], in_coda: 1 };
      },
      "crm-campagna-invia": { ok: true, inviate: 1, fallite: 0, restanti: 0 },
    });
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    await clicca(nodo.querySelector('[data-proposta="carmen.riccic@libero.it"]'));
    const tasto = [...nodo.querySelectorAll("button")].find((b) => /Rinvia la mail/.test(b.textContent));
    expect(tasto.disabled).toBe(false);
    // il tasto dice QUANTI, non «gli indirizzi corretti» in generale
    expect(tasto.textContent).toContain("1 indirizzo corretto");
    await clicca(tasto);
    await attendi();
    expect(chiamate.length).toBe(1);
    expect(chiamate[0].p_campagna).toBe("c1");
    expect(chiamate[0].p_correzioni).toEqual([{ id: "r1", email: "carmen.riccic@libero.it" }]);
  });

  it("una casella riempita con lo STESSO indirizzo che ha rimbalzato non conta", async () => {
    finta();
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    const casella = nodo.querySelector('[data-correzione="no@claa.com"]');
    // scritto in maiuscolo: e' lo stesso indirizzo, e il tasto deve restare spento
    await scrivi(casella, "NO@CLAA.COM");
    expect(casella.value).toBe("NO@CLAA.COM");
    const tasto = [...nodo.querySelectorAll("button")].find((b) => /Rinvia la mail/.test(b.textContent));
    expect(tasto.disabled).toBe(true);
    // e scrivendone uno diverso si accende: senza questo, la prova qui
    // sopra passerebbe anche con una casella che non scrive niente
    await scrivi(casella, "claudia.vera@gmail.com");
    expect([...nodo.querySelectorAll("button")].find((b) => /Rinvia la mail/.test(b.textContent)).disabled).toBe(false);
  });

  it("se il database rifiuta tutto, lo dice col MOTIVO e non spedisce niente", async () => {
    let inviiPartiti = 0;
    finta(RIMBALZATI, {
      crm_campagna_correggi_rimbalzi: () => ({
        corrette: 0,
        rifiutate: [{ id: "r1", email: "tosy@libero.it", vecchia: "carmen.riccic@libero.ti", motivo: "anche questo indirizzo ha già rimbalzato" }],
        in_coda: 0,
      }),
      "crm-campagna-invia": () => { inviiPartiti += 1; return { ok: true, inviate: 0, fallite: 0, restanti: 0 }; },
    });
    const { nodo } = await monta(<ComponiMail campagnaIniziale={CAMPAGNA} />);
    await attendi();
    await clicca(nodo.querySelector('[data-proposta="carmen.riccic@libero.it"]'));
    await clicca([...nodo.querySelectorAll("button")].find((b) => /Rinvia la mail/.test(b.textContent)));
    await attendi();
    expect(inviiPartiti).toBe(0);
    expect(nodo.textContent).toContain("Nessun indirizzo è stato corretto");
    expect(nodo.textContent).toContain("ha già rimbalzato");
  });
});

// LA GUARDIA CHE DURA. Le regole di cosa si può correggere vivono in SQL,
// non nel browser: una pagina mostra quello che le arriva, e nessuna
// prova che monti un componente vedrebbe un rinvio verso un indirizzo
// disiscritto. Qui si rilegge la migrazione e si pretende che quei
// controlli ci siano, e che la riga rimbalzata non venga riscritta.
describe("la migrazione tiene le regole", () => {
  const sql = readFileSync("supabase/migrations/20261124180000_i_rimbalzi_si_correggono.sql", "utf8");

  it("rifiuta i cinque modi di rimandare una mail nel vuoto", () => {
    expect(sql).toMatch(/non ha la forma di un indirizzo/);
    expect(sql).toMatch(/è lo stesso indirizzo che ha rimbalzato/);
    expect(sql).toMatch(/anche questo indirizzo ha già rimbalzato/);
    expect(sql).toMatch(/si è disiscritto/);
    expect(sql).toMatch(/già fra i destinatari di questa campagna/);
  });

  it("la riga rimbalzata si AGGIORNA, non si cancella: è lei che tiene fuori l'indirizzo morto", () => {
    expect(sql).not.toMatch(/delete\s+from\s+crm_campagne_destinatari/i);
    expect(sql).toMatch(/insert into crm_campagne_destinatari/i);
    expect(sql).toMatch(/corretto in/);
  });

  it("il contatto si corregge solo se porta ancora l'indirizzo rimbalzato", () => {
    expect(sql).toMatch(/cont_email = lower\(vecchia\.email\)/);
  });

  it("una campagna già chiusa torna «in invio», o la coda non partirebbe mai", () => {
    expect(sql).toMatch(/when stato = 'inviata' then 'in_invio'/);
  });

  it("non è eseguibile da fuori: solo chi ha fatto accesso", () => {
    expect(sql).toMatch(/revoke all on function public\.crm_campagna_correggi_rimbalzi.*from public, anon/s);
    expect(sql).toMatch(/grant execute on function public\.crm_campagna_correggi_rimbalzi.*to authenticated/s);
  });
});
