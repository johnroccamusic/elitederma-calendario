// DA CELLULARE LA SCHEDA DI UN CORSO SI LEGGE IN VERTICALE (10/11/2026).
//
// Il titolare: «da cellulare in operativo corsi fai in modo che tutti i
// dati di ciascun corso si leggano nella scheda in verticale senza
// scorrere lateralmente».
//
// La fascia degli incarichi aveva nove colonne di misura fissa — 86, 150,
// 26, 44, …, 186, 96 — per circa novecento pixel, piu' i duecento del
// pannello di sinistra. Su un telefono quella fascia scorreva di lato
// dentro una pagina che scorre in su e in giu': hotel, camera e note
// hotel non erano scomodi, erano invisibili.
//
// Qui si guarda la CAUSA, non l'effetto: jsdom non impagina, quindi la
// larghezza vera non si puo' misurare: si controlla che sul telefono non
// esistano piu' ne' le colonne fisse ne' il contenitore che scorre di
// lato, e che ogni dato porti la sua etichetta accanto. Che di la', sul
// computer, le colonne ci siano ancora e' l'altra meta' della prova:
// senza, "niente scorrimento" si otterrebbe anche buttando via la
// tabella di chi lavora al computer.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { AssegnazioneMaster } from "../src/App.jsx";
import { monta } from "./aiuto.js";

const CORSI = [{ id: "co1", nome: "SEXYLINE VELVET INDIVIDUALE", colore: "#3D4A94" }];
const LOCATION = [{ id: "lo1", nome: "ROMA", nome_sede: "Hotel Centrale" }];
// una classe della stagione in corso (settembre 2026 → agosto 2027)
const CLASSI = [{
  id: "cd1", corso_id: "co1", location_id: "lo1",
  data_inizio: "2026-11-20", data_fine: "2026-11-22",
  master_id: "ma1", pagamento_sede: "bonifico",
}];
const MASTER = [{ id: "ma1", nome: "CHIARA COLONNELLI" }];
const ASSISTENTI = [{ id: "as1", nome: "MARTINA TORA" }];
const LEVE = [{ id: "le1", nome: "OLGA" }];
const DOCENTI = [
  { id: "d1", corso_data_id: "cd1", tipo: "assistente", persona_id: "as1", ts: "2026-11-01T09:00:00Z" },
  { id: "d2", corso_data_id: "cd1", tipo: "leva", persona_id: "le1", ts: "2026-11-01T09:01:00Z" },
];

function apri() {
  return monta(
    <AssegnazioneMaster
      corsi={CORSI} location={LOCATION} corsiDate={CLASSI} corsiDateDocenti={DOCENTI}
      master={MASTER} assistente={ASSISTENTI} leva={LEVE}
      hotel={[]} hotelPrezzi={[]} hotelPeriodi={[]} locationPrezzi={[]} spese={[]}
      ruoloUtente="programmatore" layoutCondiviso={null}
      ricarica={() => {}} onBack={() => {}} onApriRegistraSpesaAlloggio={() => {}}
    />
  );
}

// tutti gli stili in linea della pagina, uno per nodo
function stili(nodo) {
  return [...nodo.querySelectorAll("*")].map((n) => n.getAttribute("style") || "");
}

describe("Operativo corsi dal telefono", () => {
  beforeEach(() => {
    window.innerWidth = 390;
    window.innerHeight = 844;
    // in jsdom lo schermo e' largo 1024: larghezzaUtile() prende il
    // minore fra i due, quindi basta la finestra
    window.screen = { ...window.screen, width: 390 };
  });

  it("non ha piu' niente che scorra di lato, ne' colonne a misura fissa", async () => {
    const p = await apri();
    expect(p.testo()).toMatch(/SEXYLINE VELVET INDIVIDUALE/);
    const tutti = stili(p.nodo);
    // il contenitore che scorreva
    expect(tutti.filter((s) => /overflow-x:\s*auto/.test(s))).toHaveLength(0);
    // la griglia che lo rendeva necessario: 186px e' la colonna Hotel
    expect(tutti.filter((s) => s.includes("186px"))).toHaveLength(0);
  });

  it("e ogni dato porta la sua etichetta accanto", async () => {
    const p = await apri();
    const t = p.testo();
    // le intestazioni della fascia non ci sono piu': le etichette stanno
    // su ogni riga, una per dato
    for (const voce of ["Nome", "Nota", "Viaggio", "Hotel", "Camera", "Avvisata"]) {
      expect(t, voce).toContain(voce);
    }
    expect(t).toContain("Note hotel");
    // le tre righe di incarico ci sono tutte e tre, con la loro tendina
    expect(t).toContain("Master");
    expect(t).toContain("Assistente");
    expect(t).toContain("Leva");
    expect(p.nodo.querySelectorAll("select").length).toBeGreaterThanOrEqual(3);
  });
});

describe("Operativo corsi dal computer", () => {
  beforeEach(() => {
    window.innerWidth = 1400;
    window.innerHeight = 900;
    window.screen = { ...window.screen, width: 1400 };
  });

  it("tiene la tabella a colonne com'era", async () => {
    const p = await apri();
    const tutti = stili(p.nodo);
    expect(tutti.filter((s) => s.includes("186px")).length).toBeGreaterThan(0);
    // l'intestazione della fascia, che sul telefono si spegne
    expect(p.testo()).toContain("Ruolo");
    expect(p.testo()).toContain("Stato");
  });
});
