// LE FASI DI UN CORSO SONO UNA LINEA (15/11/2026).
//
// Il titolare, con un mockup: «in spedizioni corsi ridisegna le celle
// dei corsi con questa grafica e con questo criterio. Come vedi i
// pulsanti rossi esistono solo per le fasi ancora da fare, poi
// diventano cerchietti verdi».
//
// Erano quattro pastiglie affiancate, tutte colorate e tutte della
// stessa misura: per sapere a che punto fosse un corso bisognava
// leggerle tutte. Qui si prova il criterio, non il disegno: chi e'
// verde, chi e' rosso, chi non e' ne' l'uno ne' l'altro, e che cosa
// risponde al dito.
import { describe, it, expect } from "vitest";
import React from "react";
import { RigaCorsoLogistica, PaginaLogisticaProdotti } from "../src/App.jsx";
import { monta, clicca } from "./aiuto.js";

const CORSO_DATA = { id: "cd1", corso_id: "c1", location_id: "l1", data_inizio: "2099-01-10", data_fine: "2099-01-11" };
const CORSO = { id: "c1", nome: "PMU BASE", colore: "#123456" };
const MILANO = { id: "l1", nome: "MILANO", sede_centrale: false };
const SEDE = { id: "l2", nome: "ROMA", sede_centrale: true };
const ISCRITTI = [{ id: "a1", pacchetto_kit: "PMU Pro" }, { id: "a2", pacchetto_kit: "PMU Pro" }];

const comuni = {
  corsoData: CORSO_DATA, corso: CORSO, iscrittiEdizione: ISCRITTI, selezionato: false,
  onSeleziona: () => {}, onCambiaFase: () => {}, onTornaIndietroFase: () => {},
  onToggleGestioneRientro: () => {}, onCambiaFaseRientro: () => {}, onTornaIndietroFaseRientro: () => {},
  onAllestisci: () => {}, onPrepara: () => {}, onApriInventarioSede: () => {}, onAnnullaInventario: () => {},
};
const stati = (nodo) => [...nodo.querySelectorAll("[data-tappa-fase]")].map((t) => t.getAttribute("data-tappa-fase"));

describe("la linea delle fasi di una spedizione", () => {
  it("le fatte sono verdi, una sola è rossa, le altre restano grigie", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="ritirato_corriere" />);
    // due fasi superate, quella corrente, e l'ultima ancora di là da venire
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "corrente", "futuro"]);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    expect(tappe[0].textContent).toContain("Pacco preparato");
    expect(tappe[2].textContent).toContain("Pacco da ritirare");
    await p.smonta();
  });

  it("un corso appena nato ha UNA rossa, non tre", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    const s = stati(p.nodo);
    expect(s.filter((x) => x === "corrente").length).toBe(1);
    expect(s).toEqual(["corrente", "futuro", "futuro", "futuro"]);
    await p.smonta();
  });

  it("tutte fatte: nessuna rossa", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="completato" />);
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "fatto", "fatto"]);
    await p.smonta();
  });

  it("si preme la rossa e si avanza; una futura non fa niente", async () => {
    const avanzamenti = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" onCambiaFase={(f) => avanzamenti.push(f)} />);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    await clicca(tappe[2]);
    expect(avanzamenti).toEqual([]);
    await clicca(tappe[0]);
    expect(avanzamenti).toEqual(["bolla_stampata"]);
    await p.smonta();
  });

  it("«Indietro» torna di una fase, e sul corso appena nato non c'è", async () => {
    const indietro = [];
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata" onTornaIndietroFase={(f) => indietro.push(f)} />);
    await clicca(p.nodo.querySelector("[data-indietro-fase]"));
    expect(indietro).toEqual(["da_preparare"]);
    await p.smonta();

    const q = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    expect(q.nodo.querySelector("[data-indietro-fase]")).toBeFalsy();
    await q.smonta();
  });

  // 15/11/2026, corretto dal titolare: «hai spostato la freccetta
  // indietro sotto la linea dello stato mentre prima doveva stare alla
  // destra dei cerchietti». Sotto, in mezzo alle etichette, sembrava
  // l'etichetta di una quinta tappa.
  it("«Indietro» sta in alto a destra, fuori dalla fila delle pastiglie", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata" />);
    const indietro = p.nodo.querySelector("[data-indietro-fase]");
    // sta accanto alla linea, non dentro la fila delle tappe: li' in
    // mezzo sembrerebbe l'etichetta di una tappa in piu'
    expect(p.nodo.querySelector("[data-riga-tappe]").contains(indietro)).toBe(false);
    expect(indietro.parentElement).toBe(p.nodo.querySelector("[data-linea-fasi]"));
    await p.smonta();
  });

  // 15/11/2026, corretto dal titolare: «elimina le icone e le celle
  // verdi intorno al testo, scrivi solo il testo sotto l'icona di
  // spunta verde; lascia la nuvola rossa solo per le fasi da
  // completare». Una fase fatta e' gia' detta dal pallino: ripeterla in
  // un riquadro verde con dentro un'icona verde e' la stessa cosa detta
  // tre volte, e quattro riquadri di fila pesano quanto il rosso che
  // dovrebbe saltare all'occhio.
  it("nessuna tappa ha un'icona; la nuvola è solo della rossa", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="ritirato_corriere" />);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    // 15/11/2026, corretto due volte: niente icone, né accanto al verde
    // né dentro la nuvola rossa — il pallino lo dice già
    tappe.forEach((t) => expect(t.querySelector("svg")).toBeFalsy());
    expect(tappe[0].style.background).toBe("none");
    expect(tappe[3].style.background).toBe("none");
    expect(tappe[2].style.background).not.toBe("none");
    // e il nome non esce dalla nuvola nemmeno se è una parola sola
    expect(tappe[2].querySelector("span").style.overflowWrap).toBe("anywhere");
    expect(tappe[2].style.boxSizing).toBe("border-box");
    await p.smonta();
  });

  // le due righe — pallini e tappe — stanno sulla stessa griglia:
  // scritte con due misure diverse, il pallino si scollerebbe dalla sua
  // etichetta al primo nome lungo.
  it("le due righe hanno le stesse colonne", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="completato" />);
    const pallini = p.nodo.querySelector("[data-riga-pallini]");
    const tappe = p.nodo.querySelector("[data-riga-tappe]");
    expect(pallini.style.gridTemplateColumns).toBe(tappe.style.gridTemplateColumns);
    expect(p.nodo.querySelectorAll("[data-pallino-fase]").length).toBe(4);
    await p.smonta();
  });

  it("la freccia della testata apre il corso, e non è il passo indietro", async () => {
    let aperto = 0;
    const indietro = [];
    const p = await monta(
      <RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="bolla_stampata"
        onSeleziona={() => { aperto += 1; }} onTornaIndietroFase={(f) => indietro.push(f)} />
    );
    await clicca(p.nodo.querySelector("[data-apri-corso]"));
    expect(aperto).toBe(1);
    expect(indietro).toEqual([]);
    await p.smonta();
  });
});

// 15/11/2026, dal mockup: «tutte le date dei corsi avranno lo stesso
// colore blu». Era il colore del corso, e sei corsi in colonna erano
// sei tessere di sei colori: il colore diventava la cosa piu' grossa
// della pagina senza dire niente che il nome, due centimetri a destra,
// non dicesse gia'.
describe("la testata della cella", () => {
  it("la data è blu anche su un corso che ha un colore suo", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} corso={{ ...CORSO, colore: "#FF00AA" }} loc={MILANO} faseCorrente="da_preparare" />);
    expect(p.nodo.innerHTML).not.toContain("#FF00AA");
    expect(p.nodo.textContent).toContain("GEN");
    await p.smonta();
  });

  // 15/11/2026: «il numero della data della cella di destra deve avere
  // lo stesso stile di quello della cella di sinistra». Due tessere
  // disegnate in due punti si scostano al primo ritocco, e sono una
  // accanto all'altra sulla stessa schermata: adesso e' una sola
  // (TesseraData).
  it("la tessera della data è la stessa della cella e del pannello", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    const tessera = [...p.nodo.querySelectorAll("div")].find((d) => (d.textContent || "") === "10GEN");
    expect(tessera.style.border).toContain("3px solid");
    expect(tessera.querySelector("div").style.fontSize).toBe("24px");
    await p.smonta();
  });

  // 15/11/2026: il solo fondo crema non bastava a dire quale scheda è
  // scelta, perché lo stesso crema sta anche nel pannello accanto e
  // nella striscia che li unisce. Il bordo oro lo dice.
  it("la scheda scelta ha il bordo oro, le altre no", async () => {
    const scelta = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" selezionato />);
    const riga = scelta.nodo.querySelector("[data-riga-corso]");
    expect(riga.style.border).toContain("2px solid");
    expect(riga.style.background).not.toBe("rgb(255, 255, 255)");
    await scelta.smonta();

    const altra = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    expect(altra.nodo.querySelector("[data-riga-corso]").style.border).toContain("1px solid");
    await altra.smonta();
  });

  it("il nome è in maiuscolo e i kit stanno nella loro pastiglia", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={MILANO} faseCorrente="da_preparare" />);
    const titolo = [...p.nodo.querySelectorAll("div")].find((d) => d.textContent === "PMU BASE" && d.style.textTransform === "uppercase");
    expect(titolo).toBeTruthy();
    expect(p.nodo.textContent).toContain("2 KIT");
    await p.smonta();
  });
});

describe("la linea di un corso in sede centrale", () => {
  it("tre tappe, e la prima da fare è quella rossa", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare" preparatoTs="2099-01-01T10:00:00Z" />);
    expect(stati(p.nodo)).toEqual(["fatto", "corrente", "futuro"]);
    const tappe = [...p.nodo.querySelectorAll("[data-tappa-fase]")];
    expect(tappe[0].textContent).toContain("Materiale preparato");
    expect(tappe[1].textContent).toContain("Materiale da consegnare");
    await p.smonta();
  });

  it("consegnato, si legge «Cosa torna in magazzino»", async () => {
    const p = await monta(
      <RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare"
        preparatoTs="2099-01-01T10:00:00Z" allestitoTs="2099-01-02T10:00:00Z" />
    );
    expect(stati(p.nodo)).toEqual(["fatto", "fatto", "corrente"]);
    expect(p.tasto("Cosa torna in magazzino")).toBeTruthy();
    await p.smonta();
  });

  it("mentre il magazzino si muove la linea sparisce e lo dice", async () => {
    const p = await monta(<RigaCorsoLogistica {...comuni} loc={SEDE} faseCorrente="da_preparare" inLavorazione avanzamento={{ fatti: 3, totale: 9 }} />);
    expect(stati(p.nodo)).toEqual([]);
    expect(p.nodo.textContent).toContain("Magazzino in movimento: 3 di 9 prodotti");
    await p.smonta();
  });
});

// LA LISTA PARTE DAL CORSO CHE SI E' SCELTO (15/11/2026, chiesto dal
// titolare: «quando selezioni un corso, la lista di preparazione
// relativa sia graficamente collegata al corso e parta sempre da quel
// corso a scendere, non attaccata in alto»).
//
// Quello che jsdom NON vede e' l'impaginazione: offsetTop e
// offsetHeight qui valgono zero, quindi la misura vera si guarda con
// gli occhi. Qui si prova che la striscia che unisce le due colonne
// esista quando un corso e' scelto, e che se ne vada da telefono, dove
// le colonne non sono affiancate.
describe("la lista agganciata al corso scelto", () => {
  const dati = {
    corsi: [CORSO],
    location: [MILANO],
    corsiDate: [{ ...CORSO_DATA, data_fine: "2099-01-11" }],
    iscritti: ISCRITTI.map((i) => ({ ...i, corso_data_id: "cd1" })),
    corsiKitProdotti: [], kitDefinizioni: [], logisticaKitEdizioni: [],
    prodottiShop: [], prodottiImmagini: [], categorieProdotti: [], prodottiCategorie: [],
    bundleComponenti: [], inventarioSede: [], prodottiApertiMagazzino: [],
    utenteLoggato: { nome: "Raf" }, ruoloUtente: "programmatore",
    onApriMagazziniLocali: () => {}, onBack: () => {}, ricarica: () => {},
  };

  it("fra la scheda scelta e la sua lista c'è la striscia che le tiene insieme", async () => {
    const p = await monta(<PaginaLogisticaProdotti {...dati} />);
    expect(p.nodo.querySelector("[data-riga-corso='cd1']")).toBeTruthy();
    expect(p.nodo.querySelector("[data-ponte-corso]")).toBeTruthy();
    await p.smonta();
  });
});
