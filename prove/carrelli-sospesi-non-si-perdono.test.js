// I CARRELLI SOSPESI NON SI PERDONO. 7/11/2026.
//
// Dalla fiera di Napoli, con il banco aperto: «stanno sparendo i carrelli
// memorizzati, tra cui uno molto importante di Ingrid che superava i 1200
// euro».
//
// La lista dei carrelli sospesi non è una tabella: è UNA riga di
// `impostazioni_layout_tabelle` con dentro i carrelli di tutti, riscritta
// per intero a ogni salvataggio. Prima di scrivere si rilegge il database
// e si fondono le due liste, proprio perché nessuno cancelli il carrello
// di un altro. Ma quella rilettura era scritta così:
//
//     try { const { data } = await supabase...; fondi(data?.valore, ...) }
//     catch { /* si manda la copia locale */ }
//
// e il client di Supabase NON lancia niente quando una richiesta va
// storta: restituisce `{ data: null, error }`. Quindi il `catch` non è mai
// scattato, e una lettura fallita arrivava alla fusione come «di là non
// c'è niente»: si scriveva la copia di quel dispositivo, e i carrelli
// salvati dagli altri telefoni sparivano in silenzio. Nessun errore,
// nessuna riga cancellata, nessun movimento di magazzino — i pezzi
// promessi non si scaricano — e quindi niente da cui risalire.
//
// Queste prove difendono tre cose, e tutte e tre sono soldi:
//
//   UNA LETTURA FALLITA NON SCRIVE. Meglio un carrello che arriva al
//   server in ritardo che i carrelli degli altri cancellati subito.
//   CHI SALVA LO VIENE A SAPERE. "Salvato" si diceva prima di sapere se
//   era vero, e la scrittura fallita finiva in un console.warn.
//   QUELLO DEGLI ALTRI RESTA. La fusione tiene le voci remote che questo
//   dispositivo non ha mai viste.
import { describe, it, expect, beforeEach, vi } from "vitest";
import "./preparazione.js";
import { fondiListaCondivisa, segnaVociRimosse, salvaImpostazioneCondivisa, attendiInvioCondiviso, aggiungiLapidi, leggiLapidi, CHIAVE_CARRELLI_SOSPESI } from "../src/App.jsx";

const carrello = (id, nome, totale) => ({ id, nome, totale, aggiornato: "2026-11-07T17:00:00.000Z", carrello: [] });

// Il finto database: dice come deve andare la rilettura e raccoglie
// quello che viene scritto. Le risposte di PostgREST passano da `fetch`,
// quindi è lì che si misura — non su una finta del client.
function databaseFinto({ letturaRiesce = true, remota = [] } = {}) {
  const scritture = [];
  globalThis.fetch = vi.fn(async (url, opzioni = {}) => {
    const indirizzo = String(url);
    const metodo = String(opzioni.method || "GET").toUpperCase();
    if (!indirizzo.includes("impostazioni_layout_tabelle")) {
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (metodo === "GET") {
      if (!letturaRiesce) {
        return new Response(JSON.stringify({ message: "rete assente" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ valore: remota }), {
        status: 200, headers: { "Content-Type": "application/json", "Accept-Profile": "public" },
      });
    }
    scritture.push(opzioni.body ? JSON.parse(opzioni.body) : null);
    return new Response("[]", { status: 201, headers: { "Content-Type": "application/json" } });
  });
  globalThis.window.fetch = globalThis.fetch;
  return scritture;
}

const listaScritta = (scritture) => {
  const ultima = scritture[scritture.length - 1];
  const riga = Array.isArray(ultima) ? ultima[0] : ultima;
  return riga?.valore || [];
};

describe("la fusione delle due liste", () => {
  it("tiene il carrello di un altro telefono che questo non ha mai visto", () => {
    const unita = fondiListaCondivisa([carrello("a", "Ingrid", 1200)], [carrello("b", "Claudia", 897)], new Set());
    expect(unita.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("toglie solo quello che QUESTO dispositivo ha davvero buttato", () => {
    const unita = fondiListaCondivisa([carrello("a", "Ingrid", 1200), carrello("b", "Claudia", 897)], [carrello("b", "Claudia", 897)], new Set(["b"]));
    expect(unita.map((c) => c.id)).toEqual(["a"]);
  });

  it("di una voce che c'è da tutte e due le parti vince la più recente", () => {
    const vecchia = { ...carrello("a", "Ingrid", 1200), aggiornato: "2026-11-07T10:00:00.000Z" };
    const nuova = { ...carrello("a", "Ingrid", 1310), aggiornato: "2026-11-07T18:00:00.000Z" };
    expect(fondiListaCondivisa([vecchia], [nuova], new Set())[0].totale).toBe(1310);
    expect(fondiListaCondivisa([nuova], [vecchia], new Set())[0].totale).toBe(1310);
  });
});

describe("il salvataggio della lista condivisa", () => {
  beforeEach(() => {
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, []);
    databaseFinto({ letturaRiesce: true, remota: [] });
    return attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
  });

  it("scrive la lista fusa quando la rilettura riesce", async () => {
    const scritture = databaseFinto({ letturaRiesce: true, remota: [carrello("ingrid", "Ingrid", 1200)] });
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, [carrello("claudia", "Claudia", 897)]);
    const esito = await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
    expect(esito.ok).toBe(true);
    expect(listaScritta(scritture).map((c) => c.id).sort()).toEqual(["claudia", "ingrid"]);
  });

  it("NON scrive niente se la rilettura non riesce: era così che sparivano", async () => {
    const scritture = databaseFinto({ letturaRiesce: false });
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, [carrello("claudia", "Claudia", 897)]);
    const esito = await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
    expect(esito.ok).toBe(false);
    expect(scritture).toHaveLength(0);
  });

  it("e quando la rete torna, riprova e scrive tutto: il proprio e quello degli altri", async () => {
    databaseFinto({ letturaRiesce: false });
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, [carrello("claudia", "Claudia", 897)]);
    expect((await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI)).ok).toBe(false);
    const scritture = databaseFinto({ letturaRiesce: true, remota: [carrello("ingrid", "Ingrid", 1200)] });
    const esito = await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
    expect(esito.ok).toBe(true);
    expect(listaScritta(scritture).map((c) => c.id).sort()).toEqual(["claudia", "ingrid"]);
  });

  it("una cancellazione segnata resta una cancellazione anche dopo una riprova", async () => {
    databaseFinto({ letturaRiesce: false });
    segnaVociRimosse(CHIAVE_CARRELLI_SOSPESI, [carrello("vecchio", "Da buttare", 10)], []);
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, []);
    expect((await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI)).ok).toBe(false);
    const scritture = databaseFinto({ letturaRiesce: true, remota: [carrello("vecchio", "Da buttare", 10), carrello("ingrid", "Ingrid", 1200)] });
    expect((await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI)).ok).toBe(true);
    expect(listaScritta(scritture).map((c) => c.id)).toEqual(["ingrid"]);
  });

  it("una scrittura rifiutata dal server lo dice, invece di finire in un console.warn", async () => {
    databaseFinto({ letturaRiesce: true, remota: [] });
    globalThis.fetch = vi.fn(async (url, opzioni = {}) => {
      const metodo = String(opzioni.method || "GET").toUpperCase();
      if (String(url).includes("impostazioni_layout_tabelle") && metodo === "GET") {
        return new Response(JSON.stringify({ valore: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ message: "riga rifiutata" }), { status: 400, headers: { "Content-Type": "application/json" } });
    });
    globalThis.window.fetch = globalThis.fetch;
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, [carrello("claudia", "Claudia", 897)]);
    const esito = await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
    expect(esito.ok).toBe(false);
    expect(String(esito.motivo || "")).not.toBe("");
  });
});

// UN CARRELLO CANCELLATO NON TORNA. 18/11/2026.
//
// Raffaele cancellava il carrello «stella» e dopo pochi minuti era di
// nuovo in elenco: un altro telefono, con la lista in memoria da prima,
// al primo salvataggio suo lo trovava nella propria copia e non nel
// database, e lo rimetteva. Adesso chi cancella lascia una lapide, e la
// fusione di chiunque la rispetta.
function databaseConLapidi({ remota = [], lapidi = null } = {}) {
  const scritture = [];
  globalThis.fetch = vi.fn(async (url, opzioni = {}) => {
    const indirizzo = decodeURIComponent(String(url));
    const metodo = String(opzioni.method || "GET").toUpperCase();
    const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
    if (!indirizzo.includes("impostazioni_layout_tabelle")) return json([]);
    if (metodo === "GET") {
      if (indirizzo.includes(`chiave=eq.${CHIAVE_CARRELLI_SOSPESI}_eliminati`)) return lapidi ? json({ valore: lapidi }) : json(null);
      return json({ valore: remota });
    }
    const corpo = opzioni.body ? JSON.parse(opzioni.body) : null;
    scritture.push(Array.isArray(corpo) ? corpo[0] : corpo);
    return json([], 201);
  });
  globalThis.window.fetch = globalThis.fetch;
  return scritture;
}

describe("un carrello cancellato da un altro telefono non torna", () => {
  beforeEach(() => {
    databaseConLapidi();
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, []);
    return attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI);
  });

  it("il telefono vecchio che salva un altro carrello non rimette «stella»", async () => {
    // il database: «stella» non c'è più, e la lapide dice che l'ha tolta qualcuno
    const scritture = databaseConLapidi({ remota: [], lapidi: { stella: new Date().toISOString() } });
    // la copia di questo telefono è di prima della cancellazione
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, [carrello("stella", "stella", 80), carrello("nuovo", "Nuovo", 50)]);
    expect((await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI)).ok).toBe(true);
    const lista = scritture.filter((r) => r.chiave === CHIAVE_CARRELLI_SOSPESI).pop().valore;
    expect(lista.map((c) => c.id)).toEqual(["nuovo"]);
  });

  it("chi cancella scrive la lapide prima della lista", async () => {
    const scritture = databaseConLapidi({ remota: [carrello("stella", "stella", 80)] });
    segnaVociRimosse(CHIAVE_CARRELLI_SOSPESI, [carrello("stella", "stella", 80)], []);
    salvaImpostazioneCondivisa(CHIAVE_CARRELLI_SOSPESI, []);
    expect((await attendiInvioCondiviso(CHIAVE_CARRELLI_SOSPESI)).ok).toBe(true);
    expect(scritture.map((r) => r.chiave)).toEqual([`${CHIAVE_CARRELLI_SOSPESI}_eliminati`, CHIAVE_CARRELLI_SOSPESI]);
    expect(Object.keys(scritture[0].valore)).toEqual(["stella"]);
    expect(scritture[1].valore).toEqual([]);
  });

  it("le lapidi vecchie di oltre novanta giorni si buttano, le altre restano", () => {
    const adesso = new Date("2026-11-18T12:00:00.000Z");
    const fuori = aggiungiLapidi({ vecchia: "2026-07-01T00:00:00.000Z", recente: "2026-11-01T00:00:00.000Z" }, new Set(["oggi"]), adesso);
    expect(Object.keys(fuori).sort()).toEqual(["oggi", "recente"]);
    expect(leggiLapidi([1, 2])).toEqual({});
  });
});
