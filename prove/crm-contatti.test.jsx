// LA LISTA CONTATTI DEL CRM (Fase 4, 30/10/2026): i filtri vanno al database
// come oggetto, il conteggio e' quello che torna dal database, la scheda
// aperta mostra la cronologia delle richieste, e i disiscritti si vedono
// solo con il loro filtro.
import { describe, it, expect } from "vitest";
import React from "react";
import PaginaContatti, { cronologiaRichieste, riassuntoFiltri, filtriPerIlDatabase, etichettaQualifica, nomeDi } from "../src/crm/PaginaContatti.jsx";
import { monta, attendi, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const VALORI = {
  regioni: [{ valore: "LAZIO", quanti: 3000 }, { valore: "LOMBARDIA", quanti: 2500 }],
  province: [{ valore: "ROMA", regione: "LAZIO", quanti: 2000 }, { valore: "MILANO", regione: "LOMBARDIA", quanti: 1800 }],
  comuni: [{ valore: "Roma", provincia: "ROMA", quanti: 1500 }],
  qualifiche: [{ valore: "CLIENTI", quanti: 1955 }, { valore: "CONTATTI_SCARTATI", quanti: 19960 }],
  stati: [{ valore: "venduto", quanti: 1933 }, { valore: "nessuna", quanti: 21594 }],
  trattati_da: [{ valore: "Katia", quanti: 5620 }],
  mestieri: [{ valore: "estetista", quanti: 8527 }],
  corsi: [{ valore: "Microblading", quanti: 5377 }, { valore: "PMU", quanti: 5575 }],
  anni: [{ valore: 2026, quanti: 9000 }, { valore: 2025, quanti: 8000 }, { valore: 2022, quanti: 419 }],
  totale: 23757, disiscritti: 12, senza_data: 14884,
};
const CONTATTI = [
  { id: "c1", nome: "Giulia", cognome: "Rossi", email: "giulia@esempio.it", comune: "Roma", provincia: "ROMA", regione: "LAZIO", mestiere: "estetista",
    qualifica: "CLIENTI", stato_trattativa: "venduto", corsi_interesse: ["Microblading", "Laminazione"], trattato_da: "Katia", numero_richieste: 2,
    ultimo_contatto_il: "2025-05-10T10:00:00Z", collegamento: "certo", collegamento_nota: "storico: stesso nome, vendita in Vetta", da_verificare: false },
  { id: "c2", nome: "Centro Estetico Luna", cognome: null, nome_originale: "Centro Estetico Luna", email: null, telefono: "393331112222", regione: "LOMBARDIA",
    qualifica: "CONTATTI_SCARTATI", stato_trattativa: "nessuna", corsi_interesse: ["PMU"], numero_richieste: 1,
    ultimo_contatto_il: "2026-02-01T10:00:00Z", collegamento: "nessuno", da_verificare: true, da_verificare_motivo: "sembra il nome di un'attività" },
];
const RICHIESTE_C1 = [
  { id: "r2", richiesta_il: "2025-05-10T10:00:00Z", data_certa: true, corsi: ["Laminazione"], form_origine: "Corso di Laminazione Italy", trattato_da: "Katia", qualifica: "CLIENTI" },
  { id: "r1", richiesta_il: "2024-03-02T10:00:00Z", data_certa: true, corsi: ["Microblading"], form_origine: "Form Microblading", trattato_da: "Olga", qualifica: "CONTATTI_DA_RICHIAMARE" },
];

function prepara(chiamate) {
  rispondiCon({
    "rpc/crm_filtri_valori": VALORI,
    "rpc/crm_cerca_contatti": (corpo) => {
      chiamate.push(corpo);
      const f = corpo?.filtri || {};
      const righe = CONTATTI.filter((c) => (!f.regione || c.regione === f.regione) && (!f.corso || c.corsi_interesse.includes(f.corso)));
      return { totale: righe.length, righe, da: corpo.da, quanti: corpo.quanti };
    },
    "rest/v1/crm_richieste": RICHIESTE_C1,
    "rest/v1/crm_contatti": { opportunita: [{ vetta_id: "o1", stato: "CLOSED_WON", corso: "Laminazione", importo: 1290, chiusa_il: "2025-07-07", agganciata_per: "nome" }], email_aggiuntive: [], telefoni_aggiuntivi: [] },
  });
}

describe("la lista contatti del CRM", () => {
  it("chiede una pagina al database e scrive il conteggio che torna", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    expect(chiamate.length).toBeGreaterThan(0);
    expect(chiamate[0]).toMatchObject({ filtri: {}, da: 0, quanti: 50 });
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("2 contatti");
    expect(t).toContain("In archivio 23.757 contatti, di cui 12 disiscritti");
    expect(t).toContain("Per 14.884 la data della richiesta non è nota");
    // il filtro Anno offre anche gli anni delle vendite, non solo il 2026
    const anni = [...p.nodo.querySelector('select[data-filtro="Anno"]').options].map((o) => o.value);
    expect(anni).toEqual(["", "2026", "2025", "2022"]);
    expect(t).toContain("Giulia Rossi");
    expect(t).toContain("Centro Estetico Luna");
    expect(t).toContain("da verificare");
    await p.smonta();
  });

  it("un filtro di regione va al database e il conteggio si aggiorna", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    const tendina = p.nodo.querySelector('select[data-filtro="Regione"]');
    await (async () => {
      const { act } = await import("react");
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setter.call(tendina, "LOMBARDIA");
        tendina.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
    })();
    await attendi(250);
    const ultima = chiamate[chiamate.length - 1];
    expect(ultima.filtri).toEqual({ regione: "LOMBARDIA" });
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("1 contatto");
    expect(t).not.toContain("Giulia Rossi");
    expect(t).toContain("LOMBARDIA");
    await p.smonta();
  });

  it("aprendo un contatto si legge la cronologia delle richieste e le opportunità", async () => {
    const chiamate = [];
    prepara(chiamate);
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    const riga = p.nodo.querySelector('[data-contatto="c1"] [role="button"]');
    await clicca(riga);
    await attendi(200);
    const cron = p.nodo.querySelector("[data-cronologia]");
    expect(cron.textContent).toBe("03/2024 Microblading · 05/2025 Laminazione");
    const t = p.testo().replace(/\s+/g, " ");
    expect(t).toContain("Opportunità in Vetta (1)");
    expect(t).toContain("1290,00 €");
    expect(t).toContain("agganciata per nome");
    expect(t).toContain("Segna come disiscritto");
    await p.smonta();
  });

  it("le funzioni pure: cronologia, riassunto, filtri puliti, etichette", () => {
    expect(cronologiaRichieste(RICHIESTE_C1)).toBe("03/2024 Microblading · 05/2025 Laminazione");
    expect(cronologiaRichieste([{ richiesta_il: "2026-01-15T10:00:00Z", corsi: [] }])).toBe("01/2026 richiesta");
    // caricata in blocco in Vetta: la data non si spaccia per vera
    expect(cronologiaRichieste([{ richiesta_il: "2026-03-09T16:12:10Z", data_certa: false, corsi: ["PMU"] }])).toBe("data non nota PMU");
    expect(riassuntoFiltri({ corso: "Microblading", regione: "LAZIO", anno: "2025", qualifica: "CLIENTI", disiscritti: true })).toBe("Microblading · 2025 · LAZIO · Cliente · disiscritti");
    expect(filtriPerIlDatabase({ cerca: "", regione: "LAZIO", disiscritti: false, con_email: true, anno: "" })).toEqual({ regione: "LAZIO", con_email: true });
    expect(etichettaQualifica("CONTATTI_DA_RICHIAMARE")).toBe("Da richiamare");
    expect(etichettaQualifica("ALTRO_VALORE")).toBe("altro valore");
    expect(nomeDi({ nome: "", cognome: "", nome_originale: "", email: "x@y.it" })).toBe("x@y.it");
  });
});

describe("scegliere i destinatari di una campagna dalla lista", () => {
  it("«Usa questi contatti» scrive i filtri sulla campagna, prepara i destinatari e torna alla campagna", async () => {
    const chiamate = []; const aggiornamenti = []; const rpc = [];
    const { default: ComponiMail } = await import("../src/crm/ComponiMail.jsx");
    void ComponiMail;
    prepara(chiamate);
    const risposteBase = globalThis.fetch;
    // sopra alle risposte della lista, quelle della campagna
    rispondiCon({
      "rpc/crm_campagna_prepara": (corpo) => { rpc.push(corpo); return { inseriti: 1, senza_email: 1, disiscritti: 0, da_verificare: 0 }; },
      "rest/v1/crm_campagne?": (corpo, url) => {
        if (corpo) aggiornamenti.push(corpo);
        const c = { id: "c5", nome: "Scritta prima", oggetto: "Ciao", stato: "bozza", filtri: {}, totale_destinatari: 1, inviate: 0, fallite: 0, creata_il: "2026-10-30T10:00:00Z" };
        return url.includes("order=creata_il") ? [c] : c;
      },
      "rest/v1/intestazione_societa": { nome: "ELITEDERMA Srl" },
    });
    const conCampagna = globalThis.fetch;
    globalThis.fetch = async (url, opz) => (String(url).includes("crm_campagn") || String(url).includes("intestazione_societa") ? conCampagna(url, opz) : risposteBase(url, opz));
    globalThis.window.fetch = globalThis.fetch;

    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    // si apre una campagna esistente dall'elenco, poi «Seleziona destinatari»
    await clicca(p.tasto("Campagne"));
    await attendi(200);
    const riga = p.nodo.querySelector('[data-campagna="c5"]');
    await clicca(riga);
    await attendi(200);
    await clicca(p.tasto("Seleziona destinatari"));
    await attendi(200);
    expect(p.nodo.querySelector("[data-scelta-destinatari]").textContent).toContain("Stai scegliendo i destinatari di «Scritta prima»");
    const tendina = p.nodo.querySelector('select[data-filtro="Regione"]');
    const { act } = await import("react");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(tendina, "LOMBARDIA");
      tendina.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await attendi(250);
    await clicca(p.tasto("Usa questi 1 contatti"));
    await attendi(300);
    expect(aggiornamenti.some((a) => a.filtri && a.filtri.regione === "LOMBARDIA" && a.riassunto_filtri === "LOMBARDIA")).toBe(true);
    expect(rpc[0]).toEqual({ p_campagna: "c5" });
    expect(p.testo()).toContain("Destinatari pronti: 1 (fuori: 1 senza email).");
    await p.smonta();
  });
});

describe("la scheda del contatto dice le mail di campagna ricevute", () => {
  it("mostra stato e campagna", async () => {
    const chiamate = [];
    prepara(chiamate);
    const base = globalThis.fetch;
    globalThis.fetch = async (url, opz) => String(url).includes("crm_campagne_destinatari")
      ? new Response(JSON.stringify([{ id: "d1", stato: "aperta", inviata_il: "2026-10-30T20:00:00Z", ultimo_evento_il: "2026-10-30T20:15:00Z", crm_campagne: { nome: "Emilia-Romagna · 30/10/2026", oggetto: "Ciao" } }]), { status: 200, headers: { "Content-Type": "application/json" } })
      : base(url, opz);
    globalThis.window.fetch = globalThis.fetch;
    const p = await monta(<PaginaContatti onBack={() => {}} />);
    await attendi(200);
    await clicca(p.nodo.querySelector('[data-contatto="c1"] [role="button"]'));
    await attendi(200);
    const riga = p.nodo.querySelector("[data-campagna-ricevuta]");
    expect(riga.textContent).toContain("aperta · Emilia-Romagna · 30/10/2026");
    await p.smonta();
  });
});
