// LE LISTE DELLE PASSWORD SI ARCHIVIANO (28/11/2026).
//
// Il titolare: «possiamo mettere vicino alla lista dove sono le password
// di ogni utente il tasto archivia, che le mette in una lista di
// archiviati senza cancellarne i dati e almeno pulisco le liste?».
//
// Messo davanti alle due strade ha scelto che archiviare CHIUDE LA
// PORTA: la lista si pulisce e la password non apre piu' niente. Quindi
// qui dentro la parte che conta non e' il tasto — e' il cancello, e le
// guardie che rileggono `src/App.jsx`. Un componente mostra fedelmente
// quello che gli arriva: una colonna dimenticata in una `select` del
// Gate arriva `undefined`, `!undefined` e' vero, e l'archiviato entra
// come se niente fosse senza che nessuna prova montata lo veda.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  eArchiviata, inServizio, inArchivio, daScegliere, etichettaArchivio,
  campiArchiviazione, campiRipristino,
} from "../src/archivio-persone.js";
import { righeCollegateDaArchiviare, TabellaPasswordMaster, TabellaPasswordVenditori } from "../src/App.jsx";
import { AreaAnagrafica } from "../src/iscrizione/AreeAnagrafiche.jsx";
import { AREA_ALLIEVO } from "../src/iscrizione/disposizione.js";
import { monta, clicca } from "./aiuto.js";
import { rispondiCon } from "./preparazione.js";

const SORGENTE = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

const IERI = "2026-11-27T10:00:00.000Z";
const ATTIVA = { id: "v-olga", nome: "OLGA", password: "1111", permessi: [] };
const ARCHIVIATA = { id: "v-mario", nome: "MARIO", password: "2222", permessi: [], archiviato_il: IERI, archiviato_da: "John", archiviato_motivo: "non lavora più qui" };

describe("chi è in archivio, e chi no", () => {
  it("lo dice una colonna sola", () => {
    expect(eArchiviata(ARCHIVIATA)).toBe(true);
    expect(eArchiviata(ATTIVA)).toBe(false);
    expect(eArchiviata(null)).toBe(false);
    // una riga nata prima di oggi quella colonna non la porta: vale «in
    // servizio», o archiviando la colonna si sarebbero archiviati tutti
    expect(eArchiviata({ id: "x", nome: "X" })).toBe(false);
  });

  it("le due liste si dividono, e l'archivio ha le più recenti in cima", () => {
    const vecchia = { id: "v-3", nome: "VECCHIA", archiviato_il: "2026-01-02T00:00:00.000Z" };
    expect(inServizio([ATTIVA, ARCHIVIATA, vecchia]).map((r) => r.id)).toEqual(["v-olga"]);
    expect(inArchivio([vecchia, ATTIVA, ARCHIVIATA]).map((r) => r.id)).toEqual(["v-mario", "v-3"]);
  });
});

// QUELLO CHE SI STA PER SBAGLIARE QUI, ed è la lezione del 14/11/2026 sui
// kit spenti: una tendina che non contiene il valore che sta mostrando lo
// cancella al primo tocco.
describe("la tendina in cui si scegli", () => {
  it("un archiviato non si può più scegliere", () => {
    expect(daScegliere([ATTIVA, ARCHIVIATA]).map((r) => r.id)).toEqual(["v-olga"]);
  });

  it("ma quello GIÀ scritto su questa riga resta in elenco", () => {
    expect(daScegliere([ATTIVA, ARCHIVIATA], "v-mario").map((r) => r.id)).toEqual(["v-olga", "v-mario"]);
  });

  it("e resta anche quando il legame è il NOME e non l'id: è il caso del tutor", () => {
    // `iscritti.tutor` porta il nome del venditore, non il suo id: se il
    // nome spariva dalla tendina, il primo salvataggio della scheda
    // scollegava quell'iscrizione dal suo venditore
    expect(daScegliere([ATTIVA, ARCHIVIATA], "MARIO").map((r) => r.id)).toEqual(["v-olga", "v-mario"]);
    expect(daScegliere([ATTIVA, ARCHIVIATA], " mario ").map((r) => r.id)).toEqual(["v-olga", "v-mario"]);
  });

  it("l'archiviato rimasto in elenco lo dice, l'altro no", () => {
    expect(etichettaArchivio(ARCHIVIATA)).toBe(" (archiviato)");
    expect(etichettaArchivio(ARCHIVIATA, true)).toBe(" (archiviata)");
    expect(etichettaArchivio(ATTIVA)).toBe("");
  });
});

describe("cosa si scrive", () => {
  it("la data, chi ha premuto e il perché", () => {
    const c = campiArchiviazione("John", "non lavora più qui");
    expect(c.archiviato_il).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(c.archiviato_da).toBe("John");
    expect(c.archiviato_motivo).toBe("non lavora più qui");
  });

  it("un motivo vuoto resta vuoto, non diventa una frase inventata", () => {
    const c = campiArchiviazione("John", "   ");
    expect(c.archiviato_motivo).toBeNull();
    expect(c.archiviato_da).toBe("John");
  });

  it("il ripristino azzera tutti e tre, o resterebbe addosso a chi è in servizio", () => {
    expect(campiRipristino()).toEqual({ archiviato_il: null, archiviato_da: null, archiviato_motivo: null });
  });
});

// L'ARCHIVIO SEGUE LA PERSONA, NON LA RIGA. Una master col venditore
// collegato ha UNA password: archiviandone una sola, quella password
// continuerebbe ad aprire l'app dall'altra porta — lista pulita e
// cancello aperto, cioè il modo peggiore di sbagliare qui.
describe("una password, due porte", () => {
  const MASTER = { id: "m-1", nome: "ANDREA PAURA", venditore_id: "v-andrea" };
  const VEND = { id: "v-andrea", nome: "ANDREA" };

  it("archiviando la master si archivia anche il suo venditore", () => {
    expect(righeCollegateDaArchiviare("master", MASTER, { master: [MASTER], venditori: [VEND] }))
      .toEqual([{ tabella: "venditori", id: "v-andrea" }]);
  });

  it("e al contrario", () => {
    expect(righeCollegateDaArchiviare("venditori", VEND, { master: [MASTER] }))
      .toEqual([{ tabella: "master", id: "m-1" }]);
  });

  it("una master senza venditore collegato non trascina niente", () => {
    expect(righeCollegateDaArchiviare("master", { id: "m-2", nome: "SOLA" }, { master: [], venditori: [] })).toEqual([]);
  });

  it("un'utenza d'ufficio collegata a un venditore NON segue, ed è voluto", () => {
    // Raffaele fa ufficio E vende: sono due password di due mestieri, e
    // chiudere la seconda archiviando la prima sarebbe una sorpresa
    expect(righeCollegateDaArchiviare("utenti_app", { id: "u-1", nome: "RAFFAELE", venditore_id: "v-raf" }, { master: [], venditori: [] })).toEqual([]);
  });
});

// LE PAGINE, MONTATE E PREMUTE PER DAVVERO.
describe("le liste, montate", () => {
  let scritture;
  beforeEach(() => {
    scritture = [];
    window.prompt = vi.fn(() => "non lavora più qui");
    rispondiCon({
      impostazioni_layout_tabelle: { valore: {} },
      venditori: (corpo, indirizzo) => { if (corpo) scritture.push({ tabella: "venditori", corpo, indirizzo }); return [{ id: "v-mario" }]; },
      master: (corpo, indirizzo) => { if (corpo) scritture.push({ tabella: "master", corpo, indirizzo }); return [{ id: "m-1" }]; },
    });
  });

  it("in lista ci sono quelli in servizio, non gli archiviati", async () => {
    const p = await monta(<TabellaPasswordVenditori venditori={[ATTIVA, ARCHIVIATA]} master={[]} ricarica={() => {}} operatore="John" />);
    const righe = [...p.nodo.querySelectorAll("tbody tr")];
    expect(righe).toHaveLength(1);
    expect(righe[0].textContent).toContain("OLGA");
    expect(righe[0].textContent).not.toContain("MARIO");
    await p.smonta();
  });

  it("e in fondo c'è «Archiviati (1)», che si apre e dice chi, quando, da chi e perché", async () => {
    const p = await monta(<TabellaPasswordVenditori venditori={[ATTIVA, ARCHIVIATA]} master={[]} ricarica={() => {}} operatore="John" />);
    const apri = p.tasto("Archiviati (1)");
    expect(apri).toBeTruthy();
    await clicca(apri);
    const riga = p.nodo.querySelector('[data-archiviato="v-mario"]');
    expect(riga).not.toBeNull();
    expect(riga.textContent).toContain("MARIO");
    expect(riga.textContent).toContain("John");
    expect(riga.textContent).toContain("non lavora più qui");
    await p.smonta();
  });

  it("senza nessuno in archivio quella sezione non c'è", async () => {
    const p = await monta(<TabellaPasswordVenditori venditori={[ATTIVA]} master={[]} ricarica={() => {}} operatore="John" />);
    expect(p.testo()).not.toContain("Archiviati");
    await p.smonta();
  });

  it("premendo «Archivia» si scrive la data, l'operatore e il motivo su QUELLA riga", async () => {
    const p = await monta(<TabellaPasswordVenditori venditori={[ATTIVA]} master={[]} ricarica={() => {}} operatore="John" />);
    await clicca(p.tasto("Archivia"));
    const scritta = scritture.find((s) => s.tabella === "venditori");
    expect(scritta).toBeTruthy();
    expect(scritta.indirizzo).toContain("v-olga");
    expect(scritta.corpo.archiviato_il).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(scritta.corpo.archiviato_da).toBe("John");
    expect(scritta.corpo.archiviato_motivo).toBe("non lavora più qui");
    // non si tocca nient'altro: né la password né i permessi
    expect(Object.keys(scritta.corpo).sort()).toEqual(["archiviato_da", "archiviato_il", "archiviato_motivo"]);
    await p.smonta();
  });

  it("annullando la domanda non si scrive niente", async () => {
    window.prompt = vi.fn(() => null);
    const p = await monta(<TabellaPasswordVenditori venditori={[ATTIVA]} master={[]} ricarica={() => {}} operatore="John" />);
    await clicca(p.tasto("Archivia"));
    expect(scritture).toHaveLength(0);
    await p.smonta();
  });

  it("archiviando una master si scrive anche sulla riga del suo venditore", async () => {
    const MASTER = { id: "m-1", nome: "ANDREA PAURA", venditore_id: "v-andrea", password: "3333", permessi: [] };
    const p = await monta(<TabellaPasswordMaster master={[MASTER]} venditori={[{ id: "v-andrea", nome: "ANDREA" }]} ricarica={() => {}} operatore="John" />);
    await clicca(p.tasto("Archivia"));
    expect(scritture.filter((s) => s.tabella === "master")).toHaveLength(1);
    const sulVenditore = scritture.find((s) => s.tabella === "venditori" && s.indirizzo.includes("v-andrea"));
    expect(sulVenditore).toBeTruthy();
    expect(sulVenditore.corpo.archiviato_il).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await p.smonta();
  });
});

// LA TENDINA DEL TUTOR, montata. È il legame che si romperebbe peggio:
// `iscritti.tutor` porta il NOME del venditore, quindi un nome che
// sparisce dalla tendina si cancella al primo salvataggio della scheda —
// e quell'iscrizione perde il suo venditore, con le sue provvigioni.
describe("il tutor, nella scheda vera", () => {
  function Scheda({ venditori }) {
    const [valori, setValori] = React.useState({ tutor: "MARIO" });
    return (
      <AreaAnagrafica
        area={AREA_ALLIEVO}
        valori={valori}
        venditori={venditori}
        scrivi={(chiave, v) => setValori((p) => ({ ...p, [chiave]: v }))}
      />
    );
  }

  it("un archiviato non si può scegliere, ma quello già scritto resta e lo dice", async () => {
    const p = await monta(<Scheda venditori={[ATTIVA, ARCHIVIATA]} />);
    const tendina = [...p.nodo.querySelectorAll("select")]
      .find((t) => [...t.options].some((o) => o.value === "OLGA"));
    expect(tendina, "nessuna tendina del tutor").toBeTruthy();
    const voci = [...tendina.options].map((o) => o.textContent);
    expect(voci.join(" ")).toContain("OLGA");
    // MARIO è archiviato ED è il tutor scritto su questa scheda: resta,
    // marcato, perché la tendina lo sta mostrando
    expect(voci.find((v) => v.startsWith("MARIO"))).toBe("MARIO (archiviato)");
    await p.smonta();
  });

  it("e su una scheda che non lo nomina l'archiviato non c'è", async () => {
    function SchedaVuota() {
      const [valori, setValori] = React.useState({});
      return <AreaAnagrafica area={AREA_ALLIEVO} valori={valori} venditori={[ATTIVA, ARCHIVIATA]} scrivi={(c, v) => setValori((p) => ({ ...p, [c]: v }))} />;
    }
    const p = await monta(<SchedaVuota />);
    const tendina = [...p.nodo.querySelectorAll("select")]
      .find((t) => [...t.options].some((o) => o.value === "OLGA"));
    expect([...tendina.options].map((o) => o.value)).not.toContain("MARIO");
    await p.smonta();
  });
});

// LA GUARDIA. Il guasto grave qui non è nel disegno di una tabella: è una
// porta che resta aperta, e si riapre con una riga.
describe("la guardia: la porta resta chiusa", () => {
  it("tutte e quattro le select del cancello chiedono archiviato_il", () => {
    const i = SORGENTE.indexOf('supabase.from("utenti_app").select("id, nome, password, permessi, chiave_sistema');
    expect(i).toBeGreaterThan(0);
    const blocco = SORGENTE.slice(i, i + 900);
    for (const t of ["utenti_app", "master", "venditori", "assistente"]) {
      const riga = blocco.split("\n").find((r) => r.includes(`from("${t}").select(`));
      expect(riga, `manca la select di ${t}`).toBeTruthy();
      // campo assente = colonna non chiesta: arriva `undefined`, e
      // `!undefined` fa entrare l'archiviato (la lezione del 16/11/2026)
      expect(riga, `${t} non chiede archiviato_il`).toContain("archiviato_il");
    }
  });

  it("e tutte e quattro le ricerche per password escludono gli archiviati", () => {
    for (const r of [
      "const nominale = righe.find(",
      "const masterTrovata = (masterRighe || []).find(",
      "const venditoreTrovato = (venditoriRighe || []).find(",
      "const assistenteTrovata = (assistentiRighe || []).find(",
    ]) {
      const i = SORGENTE.indexOf(r);
      expect(i, r).toBeGreaterThan(0);
      expect(SORGENTE.slice(i, i + 260), r).toContain("eArchiviata(");
    }
  });

  it("chi viene archiviato mentre è dentro esce alla prima apertura", () => {
    const i = SORGENTE.indexOf("const colonne = {\n      master: \"id, permessi, venditore_id, e_venditore, supervisore");
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(i, i + 420)).toContain("archiviato_il");
    expect(SORGENTE).toContain("if (eArchiviata(riga)) { esci(); return; }");
  });

  it("il caricatore dei venditori chiede le tre colonne", () => {
    const i = SORGENTE.indexOf('const ve = await supabase.from("venditori").select(');
    expect(i).toBeGreaterThan(0);
    const riga = SORGENTE.slice(i, SORGENTE.indexOf("\n", i));
    expect(riga).toContain("archiviato_il");
  });

  it("l'elenco unito porta l'archivio della master, o una flaggata resterebbe fra i venditori", () => {
    const i = SORGENTE.indexOf("const venditori = useMemo(");
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(i, i + 1600)).toContain("archiviato_il: m.archiviato_il");
  });

  it("le tre righe di sistema non si archiviano", () => {
    // «Utente generico», «Amministratore», «Programmatore» non sono
    // persone: archiviare la prima vuol dire che nell'app non entra più
    // nessuno. Il tasto vive sotto `!sistema`, come l'Elimina.
    const i = SORGENTE.indexOf('<TastoArchivia tabella="utenti_app"');
    expect(i).toBeGreaterThan(0);
    expect(SORGENTE.slice(Math.max(0, i - 400), i)).toContain("!sistema &&");
  });

  it("l'archivio si scrive contando le righe cambiate", () => {
    // un update senza `select` dice «va bene» anche a zero righe, e qui
    // vorrebbe dire una lista che sembra pulita con la porta aperta
    const i = SORGENTE.indexOf("function TastoArchivia(");
    expect(i).toBeGreaterThan(0);
    const corpo = SORGENTE.slice(i, i + 1800);
    expect(corpo).toContain('.select("id")');
    expect(corpo).toContain("campiArchiviazione(");
  });
});
