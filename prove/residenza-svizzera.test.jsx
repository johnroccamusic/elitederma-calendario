// LA RESIDENZA SVIZZERA, NELLA SCHEDA E NEL MODULO.
//
// Fino al 7/11/2026 chi viveva a Sion era «Altro stato»: tre caselle di
// scrittura libera, cioe' esattamente la cosa da cui la cascata
// italiana esisteva per scappare — «Vollw» per Volla, il CAP «148»
// senza lo zero, un indirizzo riscritto nel campo citta'.
//
// Qui si prova il gesto: si scegli la Svizzera e si scende per gradini
// come in Italia, con i nomi che in Svizzera hanno quei gradini.
import { describe, it, expect, afterEach } from "vitest";
import React, { useState } from "react";
import PaginaModulo from "../src/iscrizione/PaginaModulo.jsx";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import {
  cantoniSvizzeri, localitaDiCantone, npaDiLocalita, cantoneDiLocalita,
} from "../src/comuni-svizzera.js";
import { elencoResidenza, vociStatoResidenza, formattaAhv } from "../src/iscrizione/residenza.js";
import { rispondiCon } from "./preparazione.js";
import { monta, scegli, voci, scegliCercando, cerca, scrivi, scegliVoce, proposteDi, campoDi } from "./aiuto.js";

function Scheda({ iniziali = {} }) {
  const [valori, setValori] = useState(iniziali);
  return (
    <AreaAnagrafica
      area={AREA_ALLIEVO}
      valori={valori}
      scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
    />
  );
}
const apri = (iniziali) => monta(<Scheda iniziali={iniziali} />);

describe("l'elenco svizzero", () => {
  it("ha i ventisei cantoni, con la sigla che si usa", () => {
    const c = cantoniSvizzeri();
    expect(c.length).toBe(26);
    expect(c.map((x) => x.sigla)).toContain("VS");
    expect(c.map((x) => x.sigla)).toContain("TI");
    // i nomi sono quelli della fonte, bilingui dove lo sono: tradurli a
    // mano vorrebbe dire inventare un dato che la fonte non ha
    expect(c.find((x) => x.sigla === "VS").nome).toBe("Valais / Wallis");
    expect(c.find((x) => x.sigla === "TI").nome).toBe("Ticino");
  });

  it("l'NPA di una localita' e' quello vero", () => {
    expect(npaDiLocalita("VS", "Sion")).toEqual(["1950"]);
    expect(npaDiLocalita("TI", "Lugano")).toEqual(["6900"]);
    // Zurigo ne ha molti, come Roma: quelli si scelgono
    expect(npaDiLocalita("ZH", "Zürich").length).toBeGreaterThan(10);
  });

  it("la localita' si riconosce come la scrive chi compila", () => {
    // in archivio c'e' «SION» in maiuscolo, nell'elenco «Sion»
    expect(cantoneDiLocalita("SION", "1950")).toBe("VS");
    expect(cantoneDiLocalita("lugano")).toBe("TI");
    // e un nome che in due cantoni esiste lo decide l'NPA
    expect(localitaDiCantone("GE").length).toBeGreaterThan(5);
  });

  it("la Svizzera ha un elenco, il Belgio no", () => {
    expect(elencoResidenza("SVIZZERA").stato).toBe("SVIZZERA");
    expect(elencoResidenza("Svizzera").conRegione).toBe(false);
    expect(elencoResidenza("BELGIO")).toBe(null);
    // e la casella vuota vale Italia: 253 schede in archivio hanno la
    // residenza italiana e lo Stato mai scritto
    expect(elencoResidenza("").stato).toBe("ITALIA");
  });

  it("la tendina degli Stati mette davanti quelli con l'elenco", () => {
    const v = vociStatoResidenza().map((x) => x.valore);
    expect(v[0]).toBe("ITALIA");
    expect(v[1]).toBe("SVIZZERA");
    expect(v).toContain("FRANCIA");
    expect(v[v.length - 1]).toBe("ALTRO");
  });
});

describe("la scheda del venditore", () => {
  it("scelta la Svizzera, il cantone si apre subito: sopra non c'e' niente", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    // la regione italiana non c'entra: la casella lo dice e non chiede
    expect(p.tendina("regione_residenza")).toBe(null);
    // e il cantone NON aspetta un gradino che non esiste
    expect(campoDi(p, "prov_residenza").disabled).toBe(false);
    // ventisei cantoni: sopra le venti voci si cerca, e si trova
    expect(await proposteDi(p, "prov_residenza", "val")).toContain("VS");
    expect(p.testo()).not.toMatch(/prima la regione/);
  });

  it("il cantone apre le sue localita', e la localita' scrive l'NPA da se'", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scegliVoce(p, "prov_residenza", "VS");
    expect(campoDi(p, "citta_residenza").disabled).toBe(false);
    expect(await proposteDi(p, "citta_residenza", "sion")).toContain("Sion");
    expect(await proposteDi(p, "citta_residenza", "zerm")).toContain("Zermatt");
    // e non ci sono comuni italiani in mezzo
    expect(await proposteDi(p, "citta_residenza", "roma")).not.toContain("Roma");
    await scegliVoce(p, "citta_residenza", "Sion");
    // un NPA solo non si fa scegliere: si scrive
    expect(campoDi(p, "cap_residenza").value).toBe("1950");
  });

  it("a Zurigo l'NPA si scegli, come il CAP a Roma", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scegliVoce(p, "prov_residenza", "ZH");
    await scegliVoce(p, "citta_residenza", "Zürich");
    expect(campoDi(p, "cap_residenza").disabled).toBe(false);
    expect(campoDi(p, "cap_residenza").value).toBe("");
    expect(npaDiLocalita("ZH", "Zürich")).toContain("8001");
    await scegliVoce(p, "cap_residenza", "8004");
    expect(campoDi(p, "cap_residenza").value).toBe("8004");
  });

  it("le etichette dicono Cantone, Località e NPA", async () => {
    const p = await apri({ stato_residenza: "SVIZZERA" });
    expect(p.testo()).toContain("Cantone");
    expect(p.testo()).toContain("Località");
    expect(p.testo()).toContain("NPA");
    // «Provincia» e «CAP» qui non vogliono dire niente
    expect(p.testo()).not.toContain("Provincia");
  });

  // CAMBIARE PAESE NON PUO' LASCIARE IN PIEDI QUELLO CHE STAVA SOTTO:
  // una sigla italiana sotto un indirizzo svizzero non vuol dire
  // niente, e un NPA sotto un indirizzo italiano nemmeno.
  it("passando in Svizzera, la sigla e il CAP italiani vanno via", async () => {
    const p = await apri({ citta_residenza: "Roma", prov_residenza: "RM", cap_residenza: "00166" });
    expect(p.tendina("prov_residenza").value).toBe("RM");
    await scegliCercando(p, "stato_residenza", "Svizz");
    expect(campoDi(p, "prov_residenza").value).toBe("");
    expect(campoDi(p, "cap_residenza").value).toBe("");
    // la citta' invece RESTA: un nome e' un nome, e sparire senza dirlo
    // e' peggio che restare sbagliato sotto gli occhi
    expect(campoDi(p, "citta_residenza").value).toMatch(/Roma/);
  });

  // IL CASO CHE NON DEVE SUCCEDERE. Le schede in archivio hanno lo
  // Stato vuoto e la residenza italiana: se dichiarare «Italia»
  // cancellasse la citta', chi non ha fatto altro che dichiararla
  // perderebbe la residenza di quella persona.
  it("dichiarare «Italia» su una scheda italiana non cancella niente", async () => {
    const p = await apri({ citta_residenza: "Sorso", prov_residenza: "SS", cap_residenza: "07037" });
    await scegliCercando(p, "stato_residenza", "Italia");
    expect(p.tendina("prov_residenza").value).toBe("SS");
    expect(campoDi(p, "citta_residenza").value).toBe("Sorso");
    expect(campoDi(p, "cap_residenza").value).toBe("07037");
  });

  // L'ORDINE DELLE RIGHE E' UNA REGOLA, NON UN GUSTO (7/11/2026, detta
  // dal titolare provando a iscrivere un allievo): «la selezione dello
  // stato deve essere la prima cosa che trovi in lista, altrimenti,
  // trovando per prima la riga della città, il risultato sarà sempre
  // sbagliato». Chi compila riempie dall'alto in basso: qualunque
  // casella di luogo incontrata prima dello Stato si riempie col paese
  // sbagliato — l'elenco italiano, o la ricerca delle vie che l'Italia
  // e basta — e va rifatta.
  it("lo Stato viene PRIMA della città, nella nascita e nella residenza", async () => {
    const p = await apri({});
    const prima = (a, b) => {
      const x = p.nodo.querySelector(`[data-campo="${a}"]`);
      const y = p.nodo.querySelector(`[data-campo="${b}"]`);
      expect(x).toBeTruthy(); expect(y).toBeTruthy();
      // DOCUMENT_POSITION_FOLLOWING: y viene dopo x nella pagina
      return !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    };
    expect(prima("stato_nascita", "comune_nascita")).toBe(true);
    expect(prima("stato_residenza", "citta_residenza")).toBe(true);
    expect(prima("stato_residenza", "cap_residenza")).toBe(true);
    // e la via sta dopo la cascata: era sopra lo Stato, e il suo
    // suggerimento scriveva «ITALIA» prima che qualcuno scegliesse
    expect(prima("citta_residenza", "indirizzo_residenza")).toBe(true);
    // L'IDENTIFICATIVO FISCALE VIENE DOPO TUTTI E DUE GLI STATI e dopo
    // i dati da cui si calcola. Gli Stati perche' decidono se quella
    // casella chieda il codice fiscale italiano (sedici lettere,
    // calcolato) o l'identificativo del paese di chi si iscrive;
    // sesso, data e comune perche' e' da loro che esce il codice.
    // Trovata prima di uno qualunque di questi, si riempie con la
    // regola sbagliata o troppo presto.
    expect(prima("stato_nascita", "codice_fiscale")).toBe(true);
    expect(prima("stato_residenza", "codice_fiscale")).toBe(true);
    expect(prima("data_nascita", "codice_fiscale")).toBe(true);
    expect(prima("comune_nascita", "codice_fiscale")).toBe(true);
  });

  // IL GUASTO VERO, visto dal titolare compilando: «il codice fiscale
  // sotto continuava a essere calcolato come quello dell'Italia».
  //
  // La casella vuota dello Stato vale Italia — ed e' giusto — quindi
  // scrivendo nome, sesso, data e comune il codice italiano e' GIA'
  // stato scritto; scegliendo la Svizzera dopo, restava li'. Scritto
  // dall'app, davanti a chi incassa, e nessuno lo mette in dubbio.
  it("scelto un altro paese, il codice italiano che avevamo scritto NOI se ne va", async () => {
    const p = await apri({ cognome: "ROSSI", nome: "MARIO", sesso: "M" });
    await scrivi(p.casella("data_nascita"), "1990-03-12");
    await scegliCercando(p, "comune_nascita", "Roma", 0);
    // fin qui e' una scheda italiana, e il codice si calcola da se'
    const italiano = p.casella("codice_fiscale").value;
    expect(italiano).toMatch(/^RSSMRA90C12H501/);
    // adesso vive in Svizzera: quel codice non e' il suo identificativo
    await scegliCercando(p, "stato_residenza", "Svizz");
    expect(p.casella("codice_fiscale").value).toBe("");
  });

  it("ma un codice scritto a mano NON si tocca", async () => {
    const p = await apri({ cognome: "ROSSI", nome: "MARIO" });
    // scritto da una persona, non proposto da noi: resta suo
    await scrivi(p.casella("codice_fiscale"), "RSSMRA90C12H501X");
    await scegliCercando(p, "stato_residenza", "Svizz");
    expect(p.casella("codice_fiscale").value).toBe("RSSMRA90C12H501X");
  });

  // E PERCHE' LO STATO VA SCELTO PRIMA, detto dai numeri: finche' la
  // scheda e' italiana quella casella fa rispettare la FORMA del codice
  // italiano — sei lettere, poi le cifre, poi il mese — e un AHV
  // svizzero scritto li' dentro non sopravvive. Non e' un difetto del
  // filtro: e' il motivo per cui lo Stato e' la seconda cosa che si
  // incontra nella scheda.
  it("l'AHV svizzero si puo' scrivere solo dopo aver scelto la Svizzera", async () => {
    const p = await apri({});
    await scrivi(p.casella("codice_fiscale"), "756.1234.5678.97");
    expect(p.casella("codice_fiscale").value).not.toBe("756.1234.5678.97");
    const q = await apri({});
    await scegliCercando(q, "stato_residenza", "Svizz");
    await scrivi(q.casella("codice_fiscale"), "756.1234.5678.97");
    expect(q.casella("codice_fiscale").value).toBe("756.1234.5678.97");
  });

  // L'ETICHETTA DEVE DIRE IL VERO, e con essa le regole sotto.
  it("fuori Italia l'identificativo fiscale non si misura col metro italiano", async () => {
    const p = await apri({});
    const casella = () => p.nodo.querySelector('[data-campo="codice_fiscale"]');
    // in Italia resta il codice fiscale: sedici caratteri, e lo dice
    expect(casella().maxLength).toBe(16);
    await scrivi(casella(), "RSSMRA90A01H501");
    expect(p.testo()).toMatch(/codice fiscale ne ha 16/);
    // in Svizzera no: l'AHV si scrive 756.1234.5678.97
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scrivi(casella(), "756.1234.5678.97");
    expect(casella().value).toBe("756.1234.5678.97");
    expect(p.testo()).not.toMatch(/ne ha 16/);
  });

  it("uno Stato senza elenco lascia le caselle libere, com'erano", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Belgio");
    expect(p.tendina("citta_residenza")).toBe(null);
    expect(p.tendina("cap_residenza")).toBe(null);
    // la casella mostra il nome scelto, e in archivio va BELGIO
    expect(p.casella("stato_residenza").value).toBe("Belgio");
  });
});

// 232 STATI NON SI SCORRONO (7/11/2026, detto dal titolare provandola:
// «metti la barra di ricerca dove posso scrivere almeno qualche
// lettera, per non farmi scorrere tutta la lista»).
describe("la casella degli Stati si cerca", () => {
  const proposte = (p) => [...p.nodo.querySelectorAll("[data-proposta]")].map((x) => x.textContent);

  it("due lettere bastano, e l'elenco si accorcia", async () => {
    const p = await apri({});
    await cerca(p, "stato_residenza", "sviz");
    expect(proposte(p)).toEqual(["Svizzera"]);
  });

  it("si cerca come si scrive: accenti e parolette non vanno sapute", async () => {
    const p = await apri({});
    await cerca(p, "stato_residenza", "arab sa");
    expect(proposte(p)).toContain("Arabia Saudita");
  });

  it("appena aperta mostra le prime voci, e dice che ce ne sono altre", async () => {
    const p = await apri({});
    await cerca(p, "stato_residenza", "");
    // Italia e Svizzera davanti: sono quelle con l'elenco
    expect(proposte(p)[0]).toBe("Italia");
    expect(proposte(p)[1]).toBe("Svizzera");
    expect(p.testo()).toMatch(/scrivi un'altra lettera/i);
  });

  it("quello che si scrive NON e' il valore: l'elenco e' chiuso", async () => {
    const p = await apri({});
    // «SVIZERA» con una zeta sola non e' un paese, e non deve diventarlo
    await cerca(p, "stato_residenza", "svizera");
    expect(p.testo()).toMatch(/Nessuna voce con queste lettere/);
    // nessuna voce premuta: in archivio non e' finito niente, e la
    // cascata e' ancora quella italiana
    expect(p.tendina("regione_residenza")).toBeTruthy();
  });

  it("anche lo Stato di NASCITA si cerca, ed e' la stessa casella", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_nascita", "Romania");
    expect(p.casella("stato_nascita").value).toBe("Romania");
    // nata all'estero: il comune italiano non si chiede piu'
    expect(p.casella("comune_nascita").disabled).toBe(true);
  });
});

describe("il modulo che compila l'allieva", () => {
  const TOKEN = "s".repeat(40);
  const VISTA = {
    nome: "NINA PROVA", stato: "modulo_inviato", scaduto: false, ricevuto: false,
    contratto: {},
    corso: { nome: "PMU BASE", citta: "BARI", sede: "BARI", indirizzo: "Via Finta 1", inizio: "2027-05-23", fine: "2027-05-28" },
    campi: [
      { chiave: "nome", valore: "NINA", bloccato: true, obbligatorio: true },
      { chiave: "cognome", valore: "PROVA", bloccato: true, obbligatorio: true },
      { chiave: "stato_residenza", valore: "SVIZZERA", bloccato: false, obbligatorio: true },
      { chiave: "prov_residenza", valore: null, bloccato: false, obbligatorio: true },
      { chiave: "citta_residenza", valore: null, bloccato: false, obbligatorio: true },
      { chiave: "cap_residenza", valore: null, bloccato: false, obbligatorio: true },
    ],
  };
  // LA BOZZA VIVE IN localStorage, ed e' voluto: il modulo si apre nella
  // finestra interna dell'app di posta, che si chiude da sola. Fra una
  // prova e l'altra va pulita, o la seconda si porta dietro il cantone
  // scelto dalla prima e sembra che l'app ignori la scheda. Si cancella
  // per chiave: il banco tocca solo cio' che crea.
  afterEach(() => {
    try { window.localStorage.removeItem(`modulo-bozza-${TOKEN.slice(0, 16)}`); } catch { /* niente */ }
  });
  const apriIlModulo = async (vista = VISTA) => {
    rispondiCon({ "/rest/v1/rpc/modulo_vista": vista });
    return monta(<PaginaModulo token={TOKEN} />);
  };
  const tendina = (p, chiave) => p.nodo.querySelector(`[data-campo="${chiave}"]`);

  it("una allieva svizzera scegli il cantone, e da li' scende", async () => {
    const p = await apriIlModulo();
    // ventisei cantoni e trecento localita' non si scorrono su un
    // telefono: si scrivono due lettere
    expect(await proposteDi(p, "prov_residenza", "tic")).toContain("TI");
    await scegliVoce(p, "prov_residenza", "TI");
    expect(await proposteDi(p, "citta_residenza", "luga")).toContain("Lugano");
    await scegliVoce(p, "citta_residenza", "Lugano");
    // e l'NPA di Lugano e' fra quelli che lei puo' scegliere
    const npa = campoDi(p, "cap_residenza");
    expect([...npa.options].map((o) => o.value)).toContain("6900");
  });

  it("e le etichette del modulo dicono Cantone e NPA", async () => {
    const p = await apriIlModulo();
    expect(p.testo()).toContain("Cantone");
    expect(p.testo()).toContain("NPA");
  });

  // Il venditore ha scritto il cantone: lei trova la sua localita' in
  // tendina senza sapere niente, che e' il motivo per cui la cascata
  // sta anche di qua.
  it("col cantone gia' scritto, la localita' e' una tendina", async () => {
    const p = await apriIlModulo({
      ...VISTA,
      campi: VISTA.campi.map((c) => (c.chiave === "prov_residenza"
        ? { ...c, valore: "VS", bloccato: true } : c)),
    });
    expect(await proposteDi(p, "citta_residenza", "sion")).toContain("Sion");
    expect(await proposteDi(p, "citta_residenza", "lugano")).not.toContain("Lugano");
  });

  it("per uno Stato senza elenco le caselle restano da scrivere", async () => {
    const p = await apriIlModulo({
      ...VISTA,
      campi: VISTA.campi.map((c) => (c.chiave === "stato_residenza"
        ? { ...c, valore: "BELGIO" } : c)),
    });
    expect(tendina(p, "citta_residenza").tagName).toBe("INPUT");
    expect(tendina(p, "cap_residenza").tagName).toBe("INPUT");
  });

  // GLI STESSI PUNTI ANCHE DI QUA. La scheda e il modulo chiamano la
  // stessa funzione: due copie vorrebbero dire un numero accettato dal
  // venditore e rifiutato all'allieva, sullo stesso documento.
  it("anche nel modulo l'AVS prende i punti da se'", async () => {
    const p = await apriIlModulo({
      ...VISTA,
      campi: [...VISTA.campi, { chiave: "codice_fiscale", valore: null, bloccato: false, obbligatorio: false }],
    });
    const casella = tendina(p, "codice_fiscale");
    await scrivi(casella, "7561234567897");
    expect(tendina(p, "codice_fiscale").value).toBe("756.1234.5678.97");
  });
});

// I PUNTI DELL'AVS (8/11/2026). Tredici cifre di fila non si rileggono
// per controllare di aver battuto giusto; a gruppi si'. Qui si prova
// che compaiano MENTRE si scrive — una cifra alla volta, come fa un
// dito — e soprattutto che non rovinino quello che non e' un AVS.
describe("l'AVS si scrive a gruppi", () => {
  it("i punti compaiono da se', cifra dopo cifra", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    const casella = () => p.casella("codice_fiscale");
    const visto = [];
    for (const cifra of "7561234567897") {
      await scrivi(casella(), casella().value + cifra);
      visto.push(casella().value);
    }
    expect(casella().value).toBe("756.1234.5678.97");
    // il punto entra fra un gruppo e il successivo, MAI in coda: con
    // «756.» gia' scritto il tasto cancella toglierebbe il punto, la
    // formattazione lo rimetterebbe, e la casella sembrerebbe inchiodata
    expect(visto[2]).toBe("756");
    expect(visto[3]).toBe("756.1");
    expect(visto[6]).toBe("756.1234");
    expect(visto[7]).toBe("756.1234.5");
  });

  it("si cancella all'indietro senza restare incastrati", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    const casella = () => p.casella("codice_fiscale");
    await scrivi(casella(), "7561");
    expect(casella().value).toBe("756.1");
    // il dito toglie l'ultimo carattere: la cifra se ne va e il punto
    // non torna da solo
    await scrivi(casella(), "756.");
    expect(casella().value).toBe("756");
    await scrivi(casella(), "75");
    expect(casella().value).toBe("75");
  });

  it("incollato dalla tessera com'e' scritto, resta com'e'", async () => {
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scrivi(p.casella("codice_fiscale"), "756.1234.5678.97");
    expect(p.casella("codice_fiscale").value).toBe("756.1234.5678.97");
  });

  // LE DUE PROTEZIONI, che sono il motivo per cui questa non e' una
  // maschera qualunque.
  it("un codice fiscale italiano scritto da chi vive in Svizzera non si tocca", async () => {
    // e' il caso vero: un italiano residente a Lugano ha il codice
    // fiscale italiano. Levargli le lettere per fare spazio ai punti
    // sarebbe, al contrario, il guasto da cui veniamo.
    const p = await apri({});
    await scegliCercando(p, "stato_residenza", "Svizz");
    await scrivi(p.casella("codice_fiscale"), "RSSMRA90C12H501X");
    expect(p.casella("codice_fiscale").value).toBe("RSSMRA90C12H501X");
  });

  it("un numero che non comincia per 756 non si spezza in gruppi che non sono i suoi", () => {
    expect(formattaAhv("1234567890123")).toBe("1234567890123");
    expect(formattaAhv("7561234567897")).toBe("756.1234.5678.97");
    // oltre le tredici cifre non si va: l'AVS ne ha tredici
    expect(formattaAhv("75612345678979999")).toBe("756.1234.5678.97");
    // svuotare la casella deve restare possibile
    expect(formattaAhv("")).toBe("");
  });

  it("in Italia quella casella resta il codice fiscale, punti compresi", async () => {
    // la prova che la regola nuova non ha invaso l'Italia: li' i punti
    // sono rumore di chi incolla e si tolgono, come hanno sempre fatto
    const p = await apri({});
    await scrivi(p.casella("codice_fiscale"), "756.1234.5678.97");
    expect(p.casella("codice_fiscale").value).not.toContain(".");
  });
});
