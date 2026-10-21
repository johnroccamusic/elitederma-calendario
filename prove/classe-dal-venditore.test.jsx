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
  it("la tessera si chiama Calendario iscrizioni, e il titolo sotto uguale", async () => {
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    // la tessera (le due parole attaccate: fra loro c'è un <br/>)
    expect(p.tasto("Calendarioiscrizioni")).toBeTruthy();
    // e il titolo della sezione che la tessera apre, che deve dire lo
    // stesso nome: il dentino lega le due cose, e due nomi diversi alle
    // sue estremità rimettono in piedi la confusione che serve a togliere
    expect(p.testo()).toMatch(/Calendario iscrizioni/);
    expect(p.testo()).not.toMatch(/Iscrivi allievo/);
  });

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
    await clicca(p.tasto("Calendarioiscrizioni"));
    await new Promise((r) => requestAnimationFrame(r));
    expect(portato).toBeGreaterThan(0);
  });

  it("una tessera sola è accesa, ed è quella dell'area aperta", async () => {
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    const accese = [...p.nodo.querySelectorAll('[data-aperto="1"]')];
    expect(accese).toHaveLength(1);
    expect(accese[0].textContent).toMatch(/Calendarioiscrizioni/);
  });

  it("e l'acceso si sposta sulla tessera che si preme", async () => {
    const p = await monta(
      <PaginaDashboardVenditori
        venditoreBloccato={MARIO} venditori={[MARIO]}
        corsi={[CORSO]} location={[SEDE]} corsiDate={[CD]} iscritti={[]} master={[]}
        venditeShop={[]} prodottiShop={[]} targetVenditeProdotti={[]} eventi={[]}
        onBack={() => {}} ricarica={() => {}} apriData={() => {}}
      />
    );
    await clicca(p.tasto("Commissioni sui corsi"));
    const accese = [...p.nodo.querySelectorAll('[data-aperto="1"]')];
    expect(accese).toHaveLength(1);
    expect(accese[0].textContent).toMatch(/Commissioni sui corsi/);
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

  // LA CAPIENZA DELLA SEDE SEGNALA, NON CHIUDE (21/10/2026, deciso dal
  // titolare). Fino a quel giorno `postiMaxEffettivi` teneva il minore
  // fra corso e sede: LAMINAZIONE BASE a UDINE era «Completo» con due
  // iscritti su un corso da dieci, e non si riapriva nemmeno alzando i
  // posti dell'edizione. Ora i posti sono quelli del corso e l'aula
  // piccola si limita a dirlo.
  it("l'aula piena non spegne Iscrivi", async () => {
    const due = [allieva(1, CD_PICCOLA.id), allieva(2, CD_PICCOLA.id)];
    const p = await classe({ corsoData: CD_PICCOLA, sedi: [SEDE_PICCOLA], iscritti: due });
    expect(p.tasto("Completo")).toBeUndefined();
    expect(p.tasto("Iscrivi")?.disabled).toBe(false);
    expect(p.testo()).toMatch(/8 posti liberi/);
  });

  it("ma lo dice, e dice che si può iscrivere comunque", async () => {
    const due = [allieva(1, CD_PICCOLA.id), allieva(2, CD_PICCOLA.id)];
    const p = await classe({ corsoData: CD_PICCOLA, sedi: [SEDE_PICCOLA], iscritti: due });
    expect(p.testo()).toMatch(/Sede Udine tiene 2 persone: l'aula è piena/);
    expect(p.testo()).toMatch(/Puoi iscrivere comunque: il corso ne prevede 10/);
  });

  it("oltre la capienza dell'aula cambia la frase, non il tasto", async () => {
    const tre = [1, 2, 3].map((k) => allieva(k, CD_PICCOLA.id));
    const p = await classe({ corsoData: CD_PICCOLA, sedi: [SEDE_PICCOLA], iscritti: tre });
    expect(p.testo()).toMatch(/qui siete 3: l'aula non basta/);
    expect(p.tasto("Iscrivi")?.disabled).toBe(false);
  });

  it("sotto la capienza dell'aula non si dice niente", async () => {
    const p = await classe({ corsoData: CD_PICCOLA, sedi: [SEDE_PICCOLA], iscritti: [allieva(1, CD_PICCOLA.id)] });
    expect(p.testo()).not.toMatch(/aula/);
  });

  // una sede senza capienza scritta non ha niente da segnalare
  it("una sede senza capienza resta muta", async () => {
    const p = await classe({ iscritti: [allieva(1, CD.id)] });
    expect(p.testo()).not.toMatch(/aula/);
  });
});
