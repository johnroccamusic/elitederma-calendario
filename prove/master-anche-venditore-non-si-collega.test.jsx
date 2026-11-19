// «È ANCHE VENDITORE» E «VENDITORE COLLEGATO» SONO DUE COSE (19/11/2026).
//
// Il titolare, su VALENTINA CALASCIBETTA: acceso il flag «è anche
// venditore» e scelto il suo nome dalla tendina accanto, l'app rispondeva
// «insert or update on table "master" violates foreign key constraint
// "master_venditore_id_fkey"».
//
// Il database aveva ragione. `venditori` — il nome che quasi trecento
// punti dell'app leggono — non è la tabella: è la tabella PIÙ le master
// col flag acceso, presentate come venditori CON IL LORO ID DI MASTER.
// Una riga così in `venditori` non esiste, e `master.venditore_id` è una
// chiave esterna verso `venditori.id`. Quel pannello riceveva l'elenco
// unito, quindi offriva una scelta impossibile — e proprio quella che uno
// fa per istinto subito dopo aver acceso il flag.
//
// Queste prove stanno addosso alle due facce: la tendina offre solo righe
// vere, e il pannello dice che col flag acceso non c'è niente da
// collegare.
import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { TabellaPasswordMaster } from "../src/App.jsx";
import { monta } from "./aiuto.js";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

// la tabella vera: una riga sola, con un id di `venditori`
const VENDITORI_TABELLA = [
  { id: "v-olga", nome: "OLGA", cognome: null, permessi: [], password: "olgapw" },
];

const VALENTINA = {
  id: "m-valentina", nome: "VALENTINA CALASCIBETTA", password: "valec",
  permessi: [], venditore_id: null, e_venditore: true,
};

async function pannello(master, venditori = VENDITORI_TABELLA) {
  return monta(<TabellaPasswordMaster master={master} venditori={venditori} ricarica={() => {}} />);
}

const opzioni = (p) => [...p.nodo.querySelectorAll("select option")].map((o) => (o.textContent || "").trim());

describe("la tendina «Venditore collegato»", () => {
  it("offre le righe vere della tabella, non le master col flag acceso", async () => {
    const p = await pannello([VALENTINA]);
    const voci = opzioni(p);
    expect(voci).toContain("OLGA");
    // il suo stesso nome lì dentro è la scelta che il database rifiuta
    expect(voci).not.toContain("VALENTINA CALASCIBETTA");
    await p.smonta();
  });

  it("col flag acceso e nessun collegamento dice che non serve collegare nessuno", async () => {
    const p = await pannello([VALENTINA]);
    expect(p.testo()).toContain("non serve collegare nessuno");
    await p.smonta();
  });

  it("su una master già collegata a una sua riga la frase non c'è", async () => {
    const p = await pannello([{ ...VALENTINA, venditore_id: "v-olga" }]);
    expect(p.testo()).not.toContain("non serve collegare nessuno");
    const scelta = p.nodo.querySelector("select");
    expect(scelta.value).toBe("v-olga");
    await p.smonta();
  });

  it("su una master senza flag non dice niente", async () => {
    const p = await pannello([{ ...VALENTINA, e_venditore: false }]);
    expect(p.testo()).not.toContain("non serve collegare nessuno");
    await p.smonta();
  });
});

// LA GUARDIA, che è la parte che dura.
//
// Il difetto non stava dentro un componente — il componente mostra quello
// che gli danno — ma nel COLLEGAMENTO: a quel pannello veniva passato
// l'elenco sbagliato. Nessuna prova che monti una pagina può vederlo,
// quindi qui si rilegge il sorgente e si pretende che le pagine che
// scrivono sulla tabella `venditori`, o che ci agganciano una chiave
// esterna, ricevano `venditoriTabella`.
describe("chi scrive sulla tabella riceve la tabella", () => {
  it("«Utenti» (gestione utenti, Password Master, Password venditori)", () => {
    const riga = SORGENTE.split("\n").find((l) => l.includes("propsUtenti={{"));
    expect(riga, "la riga che compone le props di «Utenti»").toBeTruthy();
    expect(riga).toContain("venditori: venditoriTabella");
  });

  it("«Definisci Master», dove si collega la master a una sua riga", () => {
    const i = SORGENTE.indexOf("<PaginaGestioneMaster");
    expect(i).toBeGreaterThan(-1);
    const apertura = SORGENTE.slice(i, SORGENTE.indexOf(">", i));
    expect(apertura).toContain("venditori={venditoriTabella}");
  });

  it("«Definisci venditori» continua a ricevere la tabella", () => {
    const i = SORGENTE.indexOf("<PaginaGestioneVenditori");
    expect(i).toBeGreaterThan(-1);
    const apertura = SORGENTE.slice(i, SORGENTE.indexOf(">", i));
    expect(apertura).toContain("venditori={venditoriTabella}");
  });

  it("l'elenco unito continua a dichiarare da dove arriva una riga", () => {
    // `da_master` è l'unico segno che quella riga non esiste in `venditori`:
    // se sparisse, non ci sarebbe più modo di distinguerle
    expect(SORGENTE).toContain("da_master: true");
  });
});
