// «NOSTRA DA CERCARE» SU UNA MODELLA CHE NESSUNO HA CHIESTO (25/11/2026).
//
// Il titolare: «quando un iscritto ha richiesto una sola modella, nella
// pagina assegna modelle risultano come "nostra da cercare" anche le
// modelle per le altre tecniche che lui non ha richiesto e che deve
// portare autonomamente. Il problema lo abbiamo riscontrato su PMU Roma.»
//
// Misurato prima di toccare niente, su PMU BASE ROMA del 30/11/2026:
//   * un'allieva con 1 modella chiesta, EYELINER del giorno 6, compariva
//     da trovare anche nel giorno 2 (sopracciglia) e nel 5 (labbra);
//   * un'altra con 1 modella, SOPRACCIGLIA del giorno 2, compariva da
//     trovare nel giorno 5 e nel 6.
// Quattro modelle che nessuno deve cercare, in una classe che parte fra
// cinque giorni.
//
// La causa sta tutta nella differenza fra due cose che si somigliano:
// `richiede_modelle` e' un flag dell'ALLIEVO, i posti sono per
// TRATTAMENTO — e la vista per giorno elencava «chi e' presente», non
// «chi quel giorno ha chiesto qualcosa».
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { statoModelleDelGiorno } from "../src/App.jsx";

// i posti veri delle due allieve, come stanno in archivio
const EYELINER_G6 = { tipo: "EYELINER BASE", giorno: 6, nome_modella: "", telefono_modella: "" };
const SOPRACCIGLIA_G2 = { tipo: "SOPRACCIGLIA OMBRETTO", giorno: 2, nome_modella: "", telefono_modella: "" };

describe("un giorno che l'allievo non ha chiesto", () => {
  it("IL CASO VERO: una modella sola, e negli altri giorni non si cerca niente", () => {
    // giorno 6: e' il suo, e li' c'e' da trovare
    const suo = statoModelleDelGiorno({ nostra: true, postiDelGiorno: [{ m: EYELINER_G6, indice: 0 }] });
    expect(suo.daTrovareQui).toBe(true);
    expect(suo.nienteInQuestoGiorno).toBe(false);
    expect(suo.etichetta).toBe("nostra");

    // giorno 2 e giorno 5: non ha chiesto niente a noi
    const altro = statoModelleDelGiorno({ nostra: true, postiDelGiorno: [] });
    expect(altro.daTrovareQui).toBe(false);
    expect(altro.nienteInQuestoGiorno).toBe(true);
    expect(altro.etichetta).toBe("non-chiesta-qui");
  });

  it("e NON si offre una riga di ricerca: era anche inerte, non salvava niente", () => {
    // `creaSeMancante` vale `!nostra`: scrivere in quella riga non
    // scriveva nessun posto. Peggio di un numero sbagliato, perche'
    // invitava a lavorarci
    expect(statoModelleDelGiorno({ nostra: true, postiDelGiorno: [] }).rigaVuota).toBe(false);
  });

  it("chi porta la SUA modella la riga vuota ce l'ha ancora: serve a segnare il nome", () => {
    const sua = statoModelleDelGiorno({ nostra: false, postiDelGiorno: [] });
    expect(sua.rigaVuota).toBe(true);
    expect(sua.daTrovareQui).toBe(false);
    expect(sua.etichetta).toBe("sua");
  });

  it("chi porta la sua modella e un posto ce l'ha non diventa un fabbisogno nostro", () => {
    const sua = statoModelleDelGiorno({ nostra: false, postiDelGiorno: [{ m: SOPRACCIGLIA_G2, indice: 0 }] });
    expect(sua.daTrovareQui).toBe(false);
    expect(sua.rigaVuota).toBe(false);
  });

  it("due trattamenti nello stesso giorno restano due posti da trovare", () => {
    const due = statoModelleDelGiorno({
      nostra: true,
      postiDelGiorno: [{ m: SOPRACCIGLIA_G2, indice: 0 }, { m: { ...EYELINER_G6, giorno: 2 }, indice: 1 }],
    });
    expect(due.daTrovareQui).toBe(true);
    expect(due.nienteInQuestoGiorno).toBe(false);
  });

  it("un elenco mancante non inventa un fabbisogno", () => {
    expect(statoModelleDelGiorno({ nostra: true, postiDelGiorno: null }).daTrovareQui).toBe(false);
  });
});

// LA GUARDIA CHE DURA. Il difetto stava in tre decisioni della vista —
// il fondo rosso, la pastiglia, la riga vuota — e ognuna delle tre si
// riscrive a mano in dieci secondi. Se tornano, questa prova diventa
// rossa invece di far scoprire il guasto a chi cerca modelle che non
// esistono.
describe("la vista per giorno non decide da sé", () => {
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

  it("il fondo e la pastiglia passano da statoModelleDelGiorno", () => {
    expect(sorgente).toContain("const stato = statoModelleDelGiorno({ nostra, postiDelGiorno });");
    expect(sorgente).toContain("const daTrovareQui = stato.daTrovareQui;");
    expect(sorgente).toContain("data-stato-modella={stato.etichetta}");
  });

  it("il rosso «da trovare» non torna a leggere il solo flag dell'allievo", () => {
    // era `background: !nostra ? "#F7F6F3" : (tuttiCoperti ? ...)`, e
    // accendeva il rosso su ogni giorno in cui l'allievo era presente
    expect(sorgente).not.toContain('background: !nostra ? "#F7F6F3"');
    expect(sorgente).toContain('background: !daTrovareQui ? "#F7F6F3"');
  });

  it("la riga vuota si offre solo a chi porta la sua modella", () => {
    expect(sorgente).toContain("stato.rigaVuota ?");
  });
});
