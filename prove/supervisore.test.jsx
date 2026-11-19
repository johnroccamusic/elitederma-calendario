// IL SUPERVISORE: i privilegi del programmatore a chi programmatore non è
// (7/11/2026).
//
// Chiesto dal titolare per Chiara Colonnelli: «le stesse mie funzioni di
// programmatore e accesso, anche se lei non è programmatore: deve venire
// a supervisionare tutte le aree e avere i miei stessi privilegi».
//
// Il grado, in questa app, non sta su una riga: lo decide quale password
// si batte. Dare a qualcuno i privilegi del programmatore senza dargli
// la sua password vuol dire un flag sulla SUA riga — e queste prove
// stanno addosso alle due facce di quel flag: con la casella accesa
// entra come programmatore e vede tutto; con la casella spenta è una
// master come le altre. Un permesso che non si revoca non è un permesso.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi, scrivi } from "./aiuto.js";

// le tessere che le sue DUE caselle non le darebbero mai: se compaiono,
// è il grado che le sta aprendo
const CHIARA = {
  id: "m-chiara", nome: "CHIARA COLONNELLI", password: "chiarapw",
  permessi: ["pos", "gestionedate"], venditore_id: null, e_venditore: false, supervisore: true,
};
const MASTER_NORMALE = { ...CHIARA, id: "m-altra", nome: "ALTRA MASTER", password: "altrapw", supervisore: false };

function rispondi(master) {
  rispondiCon({
    // una chiave sola per tutte le richieste al database, che smista
    // sull'indirizzo: così "master" non risponde anche a "master_corsi"
    "/rest/v1/": (_corpo, url) => {
      if (url.includes("/utenti_app")) return [];
      if (url.includes("/master?")) return master;
      return [];
    },
  });
}

async function entra(password, master) {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  rispondi(master);
  const p = await monta(<App />);
  await attendi(80);
  const campo = p.nodo.querySelector('input[type="password"]');
  expect(campo, "la casella del codice d'accesso").toBeTruthy();
  await scrivi(campo, password);
  await clicca(p.tasto("Entra"));
  await attendi(400);
  return p;
}

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");

// E QUELLO CHE SI DA' MENTRE LA PERSONA E' DENTRO.
//
// I permessi e il grado erano fotografati all'accesso: una casella data
// dopo non compariva finché la persona non usciva e rientrava — e
// nessuno pensa di doverlo fare. In un giorno solo è costato due
// segnalazioni dalla fiera: «Olga non vede più i prezzi dei corsi» (il
// permesso ce l'aveva) e «Chiara non può ancora fare gli omaggi» (il
// grado acceso mentre era dentro).
describe("un permesso o un grado dato mentre si è già dentro", () => {
  function seduta(utente, ruolo = "user") {
    window.sessionStorage.clear();
    window.sessionStorage.setItem("edc_ok", "1");
    window.sessionStorage.setItem("edc_ruolo", ruolo);
    window.sessionStorage.setItem("edc_utente", JSON.stringify(utente));
  }

  it("il grado di supervisore vale al ricarico, senza uscire e rientrare", async () => {
    // la sessione è quella di prima: master, grado «user», due caselle
    seduta({ id: "m-chiara", nome: "CHIARA COLONNELLI", permessi: ["pos", "gestionedate"], masterId: "m-chiara", chiave_sistema: null });
    rispondiCon({
      "/rest/v1/": (_corpo, url) => {
        // una riga sola e con il suo id: è quello che l'app pretende
        if (url.includes("/master?") && url.includes("id=eq.m-chiara")) {
          return { id: "m-chiara", permessi: ["pos", "gestionedate"], venditore_id: null, e_venditore: false, supervisore: true };
        }
        return [];
      },
    });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(400);
    expect(window.sessionStorage.getItem("edc_ruolo")).toBe("programmatore");
    expect(pulito(p)).toContain("Area compensi");
    await p.smonta();
  });

  it("una casella nuova su un venditore compare al ricarico", async () => {
    // il caso di Olga: «prezzicorsi» sulla sua riga, la sessione no
    seduta({ id: "v-olga", nome: "OLGA", permessi: ["dashboardvenditori"], venditoreId: "v-olga" });
    rispondiCon({
      "/rest/v1/": (_corpo, url) => {
        if (url.includes("/venditori?") && url.includes("id=eq.v-olga")) {
          return { id: "v-olga", permessi: ["dashboardvenditori", "prezzicorsi"] };
        }
        if (url.includes("/master?")) return null;
        return [];
      },
    });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(400);
    expect(pulito(p), "la tessera dei prezzi").toContain("Prezzi corsi");
    // e il grado non si alza da sé: lei resta un venditore
    expect(window.sessionStorage.getItem("edc_ruolo")).toBe("user");
    await p.smonta();
  });

  it("se il database non risponde con UNA riga, i permessi non si toccano", async () => {
    // la finta del banco non filtra: se tornasse un elenco e ci si
    // fidasse, si azzererebbero i permessi di chi sta usando l'app
    seduta({ id: "v-olga", nome: "OLGA", permessi: ["dashboardvenditori", "prezzicorsi"], venditoreId: "v-olga" });
    rispondiCon({ "/rest/v1/": () => [{ id: "v-olga", permessi: [] }, { id: "altro", permessi: [] }] });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(400);
    expect(pulito(p)).toContain("Prezzi corsi");
    await p.smonta();
  });
});

describe("il supervisore", () => {
  it("entra col grado del programmatore, con la sua password", async () => {
    const p = await entra("chiarapw", [CHIARA, MASTER_NORMALE]);
    expect(window.sessionStorage.getItem("edc_ruolo")).toBe("programmatore");
    // e resta SE STESSA: è il motivo per cui non le si dà la password di
    // sistema — vendite, consensi e modifiche devono risultare suoi
    const chi = JSON.parse(window.sessionStorage.getItem("edc_utente") || "{}");
    expect(chi.nome).toBe("CHIARA COLONNELLI");
    expect(chi.id).toBe("m-chiara");
    expect(chi.chiave_sistema).toBeFalsy();
    await p.smonta();
  });

  it("e vede tutte le aree, anche quelle che i suoi permessi non hanno", async () => {
    const p = await entra("chiarapw", [CHIARA, MASTER_NORMALE]);
    const t = pulito(p);
    // nessuna di queste sta nelle sue due caselle, e la terza non la
    // vede nemmeno un amministratore: è una tessera del programmatore
    expect(t, "Stampe").toContain("Stampe");
    expect(t, "Area compensi e premi").toContain("Area compensi");
    expect(t, "Consensi modelle, impostazioni").toContain("Consensi modelle, impostazioni");
    expect(t, "Modelle fiera").toContain("Modelle fiera");
    await p.smonta();
  });

  it("una master senza la casella resta una master: le aree non si aprono", async () => {
    const p = await entra("altrapw", [CHIARA, MASTER_NORMALE]);
    expect(window.sessionStorage.getItem("edc_ruolo")).toBe("user");
    const t = pulito(p);
    expect(t).not.toContain("Area compensi");
    expect(t).not.toContain("Consensi modelle, impostazioni");
    expect(t).not.toContain("Modelle fiera");
    // quello che le spetta c'è: il flag non è il suo accesso, è solo il grado
    expect(t).toContain("POS");
    await p.smonta();
  });

  it("la casella si legge dal database: senza, nessuno diventa programmatore", async () => {
    // è la prova della colonna dimenticata nel Gate: le colonne lì si
    // elencano una per una, e `puo_omaggi` era già stato dimenticato una
    // volta — chi l'aveva spuntato entrava senza poterne fare
    const senzaColonna = [{ ...CHIARA, supervisore: undefined }];
    const p = await entra("chiarapw", senzaColonna);
    expect(window.sessionStorage.getItem("edc_ruolo")).toBe("user");
    await p.smonta();
  });
});
