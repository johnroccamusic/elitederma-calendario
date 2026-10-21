// LA CLASSE APERTA DA UN VENDITORE.
//
// E' la strada piu' corta che esista nell'app: Mario entra con la sua
// password, atterra sulla Dashboard venditori — che si apre già su
// "Iscrivi Allievo" — clicca una data e deve trovare il tasto
// "Iscrivi". Tre schermate, nessun bivio, e nessuna prova la
// guardava: il giorno in cui si è rotta l'unica diagnosi possibile era
// leggere il codice.
import { describe, it, expect } from "vitest";
import React from "react";
import { PaginaDashboardVenditori, SchedaData } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

const MARIO = { id: "v1", nome: "MARIO", permessi: ["dashboardvenditori"] };
const CORSO = { id: "c1", nome: "LAMINAZIONE BASE", posti_max: 10 };
const SEDE = { id: "l1", nome: "SEDE ROMA", citta: "ROMA" };
// una sede piccola: il corso ne prevede dieci, l'aula due
const SEDE_PICCOLA = { id: "l2", nome: "SEDE UDINE", citta: "UDINE", posti_max: 2 };
const CD = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2026-11-14", data_fine: "2026-11-14" };
const CD_PICCOLA = { ...CD, id: "cd2", location_id: "l2" };

const allieva = (n, cdId) => ({
  id: `i${n}`, nome: `ALLIEVA${n}`, cognome: "PROVA", corso_data_id: cdId, tutor: "MARIO",
});

function classe({ corsoData = CD, sedi = [SEDE], iscritti = [] }) {
  return monta(
    <SchedaData
      ruoloUtente="user" venditoreLoggato={MARIO}
      corsoData={corsoData} corsi={[CORSO]} location={sedi} corsiDate={[CD, CD_PICCOLA]}
      iscritti={iscritti} master={[]} utentiApp={[]} masterCorsi={[]} corsiDateDocenti={[]}
      quoteVenditoriSplit={[]} locationPrezzi={[]} assistente={[]} assistenteCorsi={[]}
      leva={[]} hotel={[]} layoutIscrizioni={null} fontDiplomi={[]} segnaposti={[]}
      costiCategorie={[]} costiSottocategorie={[]} spese={[]} impegni={[]}
      corsiGiorni={[]} tipiModella={[]} corsiTipiModella={[]} venditori={[MARIO]}
      kitDefinizioni={[]} prodottiShop={[]} venditeShop={[]} accontiDaVerificare={[]}
      ricarica={() => {}} onBack={() => {}} codiceAmministratoreAttuale="ED26"
      sottoVistaIniziale={{ vista: "lista", modificandoId: null, mostraGestione: false }}
      onCambiaSottoVista={() => {}}
    />
  );
}

describe("il venditore iscrive", () => {
  // La Dashboard non si apre su una pagina vuota da scegliere: si apre
  // già sull'elenco delle date, che è l'unica cosa per cui un venditore
  // ci entra.
  it("entrando, l'elenco delle date c'è già", async () => {
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    expect(p.testo()).toMatch(/Dashboard Mario/);
    expect(p.testo()).toMatch(/Laminazione Base/i);
  });

  // IL DIFETTO DEL 21/10/2026, riferito da chi vende: «clicco su iscrivi
  // allievo, sia da telefono che da pc, e non succede nulla». Era vero
  // alla lettera: la Dashboard nasce su quella tessera, quindi premerla
  // riscriveva lo stesso stato e React non ridisegnava niente. Adesso
  // porta all'elenco — e soprattutto la pagina dice che il gesto dopo
  // e' scegliere una data, perche' «Iscrivi allievo» non apre un modulo.
  it("la tessera già aperta porta comunque all'elenco", async () => {
    let portato = 0;
    window.HTMLElement.prototype.scrollIntoView = () => { portato += 1; };
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    await clicca(p.tasto("Iscrivi allievo"));
    await new Promise((r) => requestAnimationFrame(r));
    expect(portato).toBeGreaterThan(0);
  });

  it("dice che la data si sceglie prima", async () => {
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    expect(p.testo()).toMatch(/Scegli qui sotto la data del corso/);
  });

  it("nella classe il tasto Iscrivi apre il modulo", async () => {
    const p = await classe({});
    const t = p.tasto("Iscrivi");
    expect(t).toBeTruthy();
    expect(t.disabled).toBe(false);
    await clicca(t);
    expect(p.testo()).toMatch(/Iscrivi allievo/);
    expect(p.testo()).toMatch(/Dati dell'allievo/);
  });

  // IL VICOLO CIECO: la classe è al completo e il tasto si spegne. Qui
  // si prova soltanto che succede — a cosa dice, e a chi può uscirne,
  // ci pensa il seguito.
  it("a classe piena il tasto si spegne e dice Completo", async () => {
    const pieni = Array.from({ length: 10 }, (_, k) => allieva(k, CD.id));
    const p = await classe({ iscritti: pieni });
    const t = p.tasto("Completo");
    expect(t).toBeTruthy();
    expect(t.disabled).toBe(true);
    expect(p.testo()).toMatch(/0 posti liberi/);
  });

  // E il caso che oggi non ha via d'uscita: il limite è della SEDE, non
  // del corso. Due iscritti su un corso da dieci, e nemmeno alzando i
  // posti dell'edizione si riapre — `Math.min` tiene il minore.
  it("il limite della sede chiude la classe a due su dieci", async () => {
    const due = [allieva(1, CD_PICCOLA.id), allieva(2, CD_PICCOLA.id)];
    const p = await classe({ corsoData: CD_PICCOLA, sedi: [SEDE_PICCOLA], iscritti: due });
    expect(p.tasto("Completo")?.disabled).toBe(true);
    expect(p.testo()).toMatch(/0 posti liberi/);
  });
});
