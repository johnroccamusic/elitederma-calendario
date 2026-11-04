// L'ASSISTENTE RISPONDE SOLO DI QUELLO CHE QUELLA PERSONA VEDE (3/11/2026).
//
// Il titolare ha chiesto che il tondo col punto interrogativo risponda
// anche sulle funzionalita' e sui dati dell'app, «pero' solo
// limitatamente alle funzioni che ciascun utente vede». Qui si prova
// proprio quel limite, e non a parole: per ogni area dei dati si
// controlla che senza il permesso giusto non entri nel catalogo che il
// modello legge, e che una query che la nomina venga rifiutata.
//
// Il rifiuto che conta e' quello del database (`analisi_esegui` con
// l'elenco delle viste ammesse): questo banco prova la regola scritta in
// JavaScript, cioe' quella che decide l'elenco e che spiega al modello
// perche' no.
import { describe, it, expect } from "vitest";
import {
  AREE_DATI, VISTE_ANALISI, CATALOGO_ANALISI, catalogoPer, vistePermesse, controllaSql,
  bloccoCopertura, leggiCopertura,
} from "../supabase/functions/_shared/analisi.js";
import { AREE_GUIDA, GUIDA_GENERALE, guidaPer } from "../supabase/functions/_shared/guida-app.js";
import { registroDa, senzaRisposta } from "../supabase/functions/_shared/assistente.js";
import { TASTI_HOME } from "../src/App.jsx";

const soloEntrato = { ruolo: "tutti", permessi: [] };
const masterAlBanco = { ruolo: "master", permessi: ["dashboardmaster", "pos"] };
const magazziniere = { ruolo: "tutti", permessi: ["magazzinoshop"] };
const amministrazione = { ruolo: "amministrazione", permessi: [] };

describe("quali dati vede chi", () => {
  it("chi è soltanto entrato vede il calendario, il catalogo dei corsi e da quando ci sono i dati", () => {
    // `analisi_copertura` è aperta a chiunque di proposito: non contiene
    // nessun importo e nessun nome, solo fonti, due date e un conteggio,
    // e serve a chiunque faccia una domanda su un periodo
    expect(vistePermesse(soloEntrato)).toEqual(["analisi_calendario", "analisi_corsi", "analisi_copertura"]);
  });

  it("una master che vende al banco vede i kit e i prezzi, non i costi né gli incassi", () => {
    const sue = vistePermesse(masterAlBanco);
    expect(sue).toContain("analisi_prodotti");
    expect(sue).toContain("analisi_kit_prodotti");
    expect(sue).not.toContain("analisi_prodotti_costi");
    expect(sue).not.toContain("analisi_incassi");
    expect(sue).not.toContain("analisi_spese");
    expect(sue).not.toContain("analisi_iscrizioni");
  });

  it("chi gestisce il magazzino vede anche i costi e i margini: in app li vede già", () => {
    expect(vistePermesse(magazziniere)).toContain("analisi_prodotti_costi");
  });

  it("chi amministra vede tutto", () => {
    expect(vistePermesse(amministrazione)).toEqual(VISTE_ANALISI);
  });

  // la prova che vale per tutte: nessuna area con un permesso dichiarato
  // puo' finire nelle mani di chi non ha nessun permesso. Aggiungendo
  // un'area nuova, questa prova la controlla da sé.
  it("nessuna area riservata si apre senza un permesso che la apra", () => {
    const aperte = new Set(vistePermesse(soloEntrato));
    for (const a of AREE_DATI) {
      if (a.permessi.length === 0) expect(aperte.has(a.vista)).toBe(true);
      else {
        expect(aperte.has(a.vista)).toBe(false);
        // e con uno qualunque dei suoi permessi, si apre
        for (const p of a.permessi) {
          expect(vistePermesse({ ruolo: "tutti", permessi: [p] })).toContain(a.vista);
        }
      }
    }
  });
});

describe("il catalogo che il modello legge", () => {
  it("parla solo delle viste ammesse, e non nomina le altre", () => {
    const catalogo = catalogoPer(vistePermesse(soloEntrato));
    expect(catalogo).toContain("analisi_calendario");
    expect(catalogo).toContain("analisi_corsi");
    for (const v of ["analisi_spese", "analisi_incassi", "analisi_prodotti_costi", "analisi_vendite"]) {
      expect(catalogo).not.toContain(v);
    }
  });

  it("senza nessuna area è vuoto, non una frase a metà", () => {
    expect(catalogoPer([])).toBe("");
  });

  it("ogni area si presenta col proprio nome, o il modello non sa come chiamarla", () => {
    for (const a of AREE_DATI) expect(a.catalogo.startsWith(a.vista)).toBe(true);
    for (const v of VISTE_ANALISI) expect(CATALOGO_ANALISI).toContain(v);
    expect(new Set(VISTE_ANALISI).size).toBe(VISTE_ANALISI.length);
  });

  // le due cose su cui l'assistente sbaglierebbe da solo, e che gli sono
  // state scritte: il prezzo di un corso non esiste nei dati, e su un
  // bundle la giacenza non vuol dire niente
  it("avverte che il prezzo di un corso non sta nei dati", () => {
    const corsi = AREE_DATI.find((a) => a.vista === "analisi_corsi");
    expect(corsi.catalogo).toMatch(/PREZZO DI UN CORSO NON ESISTE/);
  });

  it("avverte che su un bundle si guarda la disponibilità, non la giacenza", () => {
    const prodotti = AREE_DATI.find((a) => a.vista === "analisi_prodotti");
    expect(prodotti.catalogo).toMatch(/disponibilita/);
    expect(prodotti.catalogo).toMatch(/bundle/);
  });
});

describe("la query si ferma prima del database", () => {
  it("una vista fuori dalle sue aree viene rifiutata, dicendo quali può usare", () => {
    const r = controllaSql("select sum(importo) from analisi_incassi", ["analisi_calendario", "analisi_corsi"]);
    expect(r.ok).toBe(false);
    expect(r.errore).toMatch(/analisi_incassi/);
    expect(r.errore).toMatch(/analisi_calendario/);
  });

  it("una vista fra le sue passa", () => {
    const r = controllaSql("select corso, citta from analisi_calendario where citta ilike '%BARI%'", ["analisi_calendario"]);
    expect(r.ok).toBe(true);
  });

  it("il nome con lo schema davanti non aggira il controllo", () => {
    expect(controllaSql("select * from public.analisi_spese", ["analisi_calendario"]).ok).toBe(false);
  });

  it("senza elenco si comporta come prima: solo viste analisi_*", () => {
    expect(controllaSql("select * from analisi_spese").ok).toBe(true);
    expect(controllaSql("select nome from iscritti").ok).toBe(false);
    expect(controllaSql("delete from analisi_vendite").ok).toBe(false);
  });
});

describe("la guida alle funzioni dell'app", () => {
  it("ogni area della guida è un tasto vero della Home", () => {
    const chiavi = new Set(TASTI_HOME.map((t) => t.chiave));
    for (const a of AREE_GUIDA) expect(chiavi.has(a.chiave)).toBe(true);
  });

  it("non manca nessun tasto della Home: un'area senza guida non si sa spiegare", () => {
    const spiegate = new Set(AREE_GUIDA.map((a) => a.chiave));
    for (const t of TASTI_HOME) expect(spiegate.has(t.chiave)).toBe(true);
  });

  it("si racconta solo quello che quella persona può aprire", () => {
    const sua = guidaPer(masterAlBanco);
    expect(sua).toContain("POS");
    expect(sua).not.toContain("AMMINISTRAZIONE —");
    expect(sua).not.toContain("STATISTICHE —");
    expect(guidaPer(soloEntrato)).toBe(GUIDA_GENERALE);
    expect(guidaPer(amministrazione)).toContain("AMMINISTRAZIONE —");
  });

  // LA REGOLA DI COSA SI SCRIVE NELLA GUIDA: dove si fa una cosa, mai
  // quanto costa. Una percentuale scritta qui invecchierebbe senza che
  // nessuno se ne accorga, e verrebbe creduta perche' detta dall'app.
  it("non contiene nessuna cifra: i numeri stanno nelle regole e nei dati", () => {
    const tutta = guidaPer(amministrazione);
    expect(tutta).not.toMatch(/\d+([.,]\d+)?\s*(€|%)/);
    expect(tutta).not.toMatch(/\d+([.,]\d+)?\s*(euro|per cento)/i);
  });
});

describe("quando una domanda è una regola che manca", () => {
  it("un ragionamento sì: è la domanda che nessuna scheda copriva", () => {
    expect(senzaRisposta({ registro: "ragionamento" })).toBe(true);
  });

  it("un dato no: il database ha risposto, non serve scrivere una regola", () => {
    expect(senzaRisposta({ registro: "dati", dichiarato: true })).toBe(false);
  });

  it("una spiegazione dell'app no, e una chiacchiera nemmeno", () => {
    expect(senzaRisposta({ registro: "guida", dichiarato: true })).toBe(false);
    expect(senzaRisposta({ registro: "conversazione", dichiarato: true })).toBe(false);
  });

  it("una risposta che cita una scheda non può essere una regola mancante", () => {
    expect(senzaRisposta({ registro: "regole", dichiarato: true, quanteSchedeCitate: 2 })).toBe(false);
  });

  it("una disposizione che sta diventando scheda non è una regola mancante", () => {
    expect(senzaRisposta({ registro: "ragionamento", proposta: { titolo: "x" } })).toBe(false);
  });

  it("il registro si deduce se il modello non lo dice", () => {
    expect(registroDa("dati", 0)).toBe("dati");
    expect(registroDa("inventato", 3)).toBe("regole");
    expect(registroDa(undefined, 0)).toBe("ragionamento");
  });
});

// ---------------------------------------------------------------------
// 3/11/2026 pomeriggio — L'ASSISTENTE INDAGA, NON SI ARRENDE.
//
// Il titolare: «perché non ragiona come un modello Claude un po' sveglio
// e deduttivo?». La causa non era il modello: era che aveva UNA query
// sola, e un risultato VUOTO non è un errore — quindi doveva rispondere
// da quel vuoto. È andata esattamente così il 3/11 alle 9:41: query
// giusta sul costo dei kit, vista con un buco, zero righe, e «per PMU
// Base non ho trovato nessun kit». Qui si provano le due regole che lo
// impediscono, e stanno nel codice proprio per poter essere provate.
import { AVVISO_ZERO_RIGHE, esitoInterrogazione, registroFinale } from "../supabase/functions/_shared/assistente.js";
import { spezzaPerVoce } from "../src/regole/voce.js";

describe("un risultato vuoto non si consegna", () => {
  it("zero righe tornano al modello con l'ordine di non concludere", () => {
    const esito = esitoInterrogazione([]);
    expect(esito).toContain("NESSUNA RIGA");
    expect(esito).toMatch(/Non concludere/);
    // e gli si dice COME indagare, non solo che non deve arrendersi
    expect(esito).toMatch(/distinct|ilike/);
    expect(esito).toContain("Righe: 0");
  });

  it("con le righe non c'è nessun avviso: sono una risposta", () => {
    const esito = esitoInterrogazione([{ kit: "KIT ELITE Completo", costo: 142.96 }]);
    expect(esito).not.toContain("NESSUNA RIGA");
    expect(esito).toContain("Righe: 1");
    expect(esito).toContain("KIT ELITE Completo");
  });

  it("un elenco lunghissimo non si riversa tutto nel contesto", () => {
    const tante = Array.from({ length: 200 }, (_, i) => ({ n: i }));
    const esito = esitoInterrogazione(tante);
    expect(esito).toContain("Righe: 200");
    expect(JSON.parse(esito.slice(esito.indexOf("["))).length).toBe(60);
  });

  it("l'avviso è una frase sola, riusabile: non va riscritta nel prompt", () => {
    expect(AVVISO_ZERO_RIGHE.length).toBeGreaterThan(40);
  });
});

describe("il registro lo dice quello che ha fatto", () => {
  it("se ha interrogato i dati, ha risposto dai dati — anche se dichiara altro", () => {
    expect(registroFinale({ interrogazioni: 2, dichiarato: "ragionamento" })).toBe("dati");
    expect(registroFinale({ interrogazioni: 1, dichiarato: "regole", quanteSchedeCitate: 1 })).toBe("dati");
  });

  it("«misto» resta misto: dati più una regola scritta è una cosa diversa", () => {
    expect(registroFinale({ interrogazioni: 1, dichiarato: "misto" })).toBe("misto");
  });

  it("senza interrogazioni vale la regola di prima", () => {
    expect(registroFinale({ interrogazioni: 0, dichiarato: "guida" })).toBe("guida");
    expect(registroFinale({ interrogazioni: 0, dichiarato: null, quanteSchedeCitate: 2 })).toBe("regole");
    expect(registroFinale({})).toBe("ragionamento");
  });

  // la conseguenza che si vede in fondo a Regolamenti: una domanda a cui
  // hanno risposto i dati non è una regola che manca
  it("una risposta dai dati non finisce fra le regole mancanti", () => {
    const registro = registroFinale({ interrogazioni: 1, dichiarato: "ragionamento" });
    expect(senzaRisposta({ registro, dichiarato: true })).toBe(false);
  });
});

describe("la voce parte dalla prima frase", () => {
  const risposta = "A Roma da qui a fine marzo ci sono 3 classi di PMU Base. La prima parte il 30 novembre, poi il 18 gennaio e il 2 marzo. Su quella di novembre restano 4 posti.";

  it("il primo pezzo è corto: si inizia a parlare prima di avere tutto l'audio", () => {
    const pezzi = spezzaPerVoce(risposta);
    expect(pezzi.length).toBeGreaterThan(1);
    expect(pezzi[0].length).toBeLessThanOrEqual(90);
  });

  it("taglia alla fine delle frasi, e non perde niente per strada", () => {
    const pezzi = spezzaPerVoce(risposta);
    const rimontato = pezzi.join(" ").replace(/\s+/g, " ");
    expect(rimontato).toBe(risposta.replace(/\s+/g, " "));
    for (const p of pezzi) expect(p).not.toMatch(/\s$/);
  });

  it("una frase sterminata si spezza sulle virgole invece di restare un blocco", () => {
    const fiume = "ci sono " + Array.from({ length: 40 }, (_, i) => `la classe numero ${i}`).join(", ");
    const pezzi = spezzaPerVoce(fiume);
    expect(pezzi.length).toBeGreaterThan(2);
  });

  it("un testo corto resta un pezzo solo: nessun taglio inutile", () => {
    expect(spezzaPerVoce("Sì, puoi farlo.")).toEqual(["Sì, puoi farlo."]);
    expect(spezzaPerVoce("")).toEqual([]);
  });
});

// ——— DICHIARARE IL PERIODO (4/11/2026) ———
//
// Nasce da una risposta vera: «quanti pigmenti da luglio?» → «900 e
// passa». Il conto era giusto, il periodo no — era gennaio-novembre — e
// il periodo non era scritto da nessuna parte. Un conto giusto sul
// periodo sbagliato è il modo peggiore di sbagliare, perché sembra
// giusto e nessuno lo mette in dubbio.
const COPERTURA_FINTA = [
  { fonte: "vendite shop online", viste: "analisi_vendite", dal: "2022-03-15", al: "2026-11-03", righe: 4250 },
  { fonte: "spese", viste: "analisi_spese", dal: "2026-07-02", al: "2026-11-17", righe: 595 },
  { fonte: "vendite al banco", viste: "analisi_vendite", dal: "2026-09-05", al: "2026-11-03", righe: 129 },
];

describe("da quando ci sono i dati", () => {
  it("le date entrano nel catalogo, fonte per fonte", () => {
    const b = bloccoCopertura(COPERTURA_FINTA);
    expect(b).toContain("vendite al banco: dal 2026-09-05 al 2026-11-03");
    expect(b).toContain("vendite shop online: dal 2022-03-15");
    expect(b).toContain("595 righe");
  });

  it("obbliga a dire il periodo, e a dirlo anche quando nessuno lo chiede", () => {
    const b = bloccoCopertura(COPERTURA_FINTA);
    expect(b).toMatch(/DICHIARA SEMPRE il periodo/);
    expect(b).toMatch(/anche quando nessuno te l'ha chiesto/);
  });

  it("dice le tre cose che hanno fatto sbagliare: periodo troppo indietro, confronti impari, e cosa resta fuori", () => {
    const b = bloccoCopertura(COPERTURA_FINTA);
    // «da gennaio» sul banco non esiste
    expect(b).toMatch(/COMINCIA PRIMA/);
    // 2024 contro 2026 è un canale contro sette
    expect(b).toMatch(/NON CONFRONTARE/);
    // i pigmenti dei kit non sono una vendita: è la domanda di Chiara
    expect(b).toMatch(/COSA RESTA FUORI/);
    expect(b).toMatch(/kit/);
  });

  it("finisce dentro il catalogo vero, dopo le viste", () => {
    const c = catalogoPer(["analisi_vendite"], COPERTURA_FINTA);
    expect(c).toContain("analisi_vendite —");
    expect(c).toContain("DA QUANDO CI SONO I DATI");
    expect(c.indexOf("analisi_vendite —")).toBeLessThan(c.indexOf("DA QUANDO CI SONO I DATI"));
  });

  // IL PUNTO CHE CONTA: le date NON si scrivono nel prompt. Se fossero
  // scritte a mano, il giorno che si importa lo storico del banco
  // resterebbero quelle di oggi e l'assistente direbbe una cosa falsa con
  // l'aria di saperla.
  it("le date non sono scritte nel codice: cambiano col dato", () => {
    const sorgente = AREE_DATI.map((a) => a.catalogo).join("\n") + bloccoCopertura(null);
    expect(sorgente).not.toMatch(/2026-09-05/);
    expect(sorgente).not.toMatch(/2022-03-15/);
    const dopo = bloccoCopertura([{ fonte: "vendite al banco", dal: "2024-01-01", al: "2026-11-04", righe: 9000 }]);
    expect(dopo).toContain("dal 2024-01-01");
    expect(dopo).not.toContain("2026-09-05");
  });

  it("se il database non risponde il catalogo resta quello di prima, non si rompe niente", () => {
    expect(bloccoCopertura(null)).toBe("");
    expect(bloccoCopertura([])).toBe("");
    const c = catalogoPer(["analisi_vendite"], null);
    expect(c).toContain("analisi_vendite —");
    expect(c).not.toContain("DA QUANDO CI SONO I DATI");
  });

  it("le righe senza data si scartano invece di comparire vuote", () => {
    const b = bloccoCopertura([
      { fonte: "fonte senza niente", dal: null, al: null, righe: 0 },
      { fonte: "spese", dal: "2026-07-02", al: "2026-11-17", righe: 595 },
    ]);
    expect(b).toContain("spese: dal 2026-07-02");
    expect(b).not.toContain("fonte senza niente");
  });

  it("si leggono ordinate dalla più vecchia, così si vede subito chi limita i confronti", async () => {
    const admin = { from: () => ({ select: async () => ({ data: [
      { fonte: "banco", dal: "2026-09-05", al: "2026-11-03", righe: 129 },
      { fonte: "shop", dal: "2022-03-15", al: "2026-11-03", righe: 4250 },
    ] }) }) };
    const righe = await leggiCopertura(admin);
    expect(righe.map((r) => r.fonte)).toEqual(["shop", "banco"]);
  });

  it("un errore del database non diventa un'eccezione in faccia a chi ha chiesto", async () => {
    const rotto = { from: () => ({ select: async () => ({ error: { message: "giù" }, data: null }) }) };
    expect(await leggiCopertura(rotto)).toBe(null);
    const esplode = { from: () => { throw new Error("niente rete"); } };
    expect(await leggiCopertura(esplode)).toBe(null);
  });

  it("la vista è dichiarata nel catalogo e aperta a chiunque sia entrato", () => {
    const area = AREE_DATI.find((a) => a.vista === "analisi_copertura");
    expect(area).toBeTruthy();
    expect(area.permessi).toEqual([]);
    expect(area.catalogo).toMatch(/non cominciano insieme|NON cominciano insieme/);
  });
});
