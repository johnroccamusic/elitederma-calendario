// REGISTRAZIONE CLIENTI (3/11/2026).
//
// Due cose da difendere, e nessuna delle due è la tendina:
//
// 1. CHI È «GIÀ REGISTRATO». Parole del titolare: in caso di omonimia la
//    persona è la stessa solo se corrisponde tutto, mail e telefono
//    compresi; stesso nome ma contatti diversi è un secondo cliente. La
//    chiave sta in dati.js e deve coincidere con l'indice unico della
//    tabella — se le due normalizzazioni divergono, la pagina dice «già
//    registrato» su una riga che il database accetta.
// 2. IL LUOGO NON SI SCRIVE. Scelta la città dal suggerimento, provincia,
//    regione e CAP si riempiono da sé: una regione battuta a mano diventa
//    quattro modi di scrivere la stessa regione, e l'elenco per regione
//    non si fa più.
//
// Il telefono si archivia sempre come +39 più le cifre: lo stesso numero
// scritto in tre modi non deve diventare tre clienti.
import { describe, it, expect } from "vitest";
import React from "react";
import App from "../src/App.jsx";
import { rispondiCon } from "./preparazione.js";
import { monta, clicca, attendi, scrivi, premi } from "./aiuto.js";
import {
  chiaveIdentita, giaRegistrato, luogoDaComune, problemiCliente, telefonoIta, clienteDaSalvare,
} from "../src/clienti/dati.js";

const TUTTI = ["gestionedate", "dashboardvenditori", "statistiche", "registrazioneclienti"];

function seduta(permessi = TUTTI) {
  window.sessionStorage.clear();
  window.sessionStorage.setItem("edc_ok", "1");
  window.sessionStorage.setItem("edc_ruolo", "venditore");
  window.sessionStorage.setItem("edc_utente", JSON.stringify({ id: "u1", nome: "KATIA", permessi, chiave_sistema: null }));
}

// il database finto: GET torna l'elenco, POST torna la riga scritta
function preparaDati(elenco, scritture, metodi = []) {
  rispondiCon({
    clienti_registrati: (corpo, indirizzo) => {
      if (corpo) {
        scritture.push({ indirizzo, corpo });
        // l'id di una correzione sta nell'indirizzo (?id=eq.xxx): si
        // rimanda indietro quello, come farebbe PostgREST
        const id = (/id=eq\.([^&]+)/.exec(indirizzo) || [])[1] || `c${scritture.length}`;
        return { id, registrato_il: "2026-11-03T12:00:00Z", ...corpo };
      }
      metodi.push(indirizzo);
      return elenco;
    },
  });
}

async function apriRegistrazione(elenco, scritture) {
  seduta();
  preparaDati(elenco, scritture);
  window.history.replaceState({}, "", "/");
  const p = await monta(<App />);
  await attendi(250);
  await clicca(p.tasto("Registrazione clienti"));
  await attendi(200);
  return p;
}

const pulito = (p) => (p.testo() || "").replace(/\s+/g, " ");
const dentro = (p, chiave) => p.nodo.querySelector(`[data-campo="${chiave}"]`);

describe("le regole dei clienti registrati", () => {
  it("il telefono si archivia sempre come +39 più le cifre", () => {
    expect(telefonoIta("347 1234567")).toBe("+393471234567");
    expect(telefonoIta("+39 347 123 4567")).toBe("+393471234567");
    expect(telefonoIta("0039 347-1234567")).toBe("+393471234567");
    expect(telefonoIta("+393471234567")).toBe("+393471234567");
    // lo zero davanti a un cellulare non esiste: si toglie
    expect(telefonoIta("03471234567")).toBe("+393471234567");
    // un fisso resta com'è, prefisso compreso
    expect(telefonoIta("080 1234567")).toBe("+390801234567");
    expect(telefonoIta("")).toBe("");
  });

  it("l'omonimo con contatti diversi è un secondo cliente; scritto in un altro modo è lo stesso", () => {
    const base = { nome: "Maria", cognome: "Rossi", email: "maria@rossi.it", telefono: "+393331112223" };
    // spazi, maiuscole e numero spaziato: la stessa persona
    expect(chiaveIdentita({ nome: " maria ", cognome: "ROSSI", email: "Maria@Rossi.it", telefono: "333 111 2223" }))
      .toBe(chiaveIdentita(base));
    // stesso nome, mail diversa: un altro cliente
    expect(chiaveIdentita({ ...base, email: "maria.rossi@gmail.com" })).not.toBe(chiaveIdentita(base));
    // stesso nome e mail, telefono diverso: un altro cliente
    expect(chiaveIdentita({ ...base, telefono: "+393339998887" })).not.toBe(chiaveIdentita(base));
    // la città NON entra nell'identità: chi trasloca non si sdoppia
    expect(chiaveIdentita({ ...base, citta: "BARI" })).toBe(chiaveIdentita({ ...base, citta: "MILANO" }));

    const elenco = [{ ...base, id: "x" }];
    expect(giaRegistrato({ ...base, citta: "ROMA" }, elenco)?.id).toBe("x");
    expect(giaRegistrato({ ...base, telefono: "+393339998887" }, elenco)).toBe(null);
  });

  it("la città tira fuori provincia, regione e CAP", () => {
    const uno = luogoDaComune({ nome: "Altamura", sigla: "BA" });
    expect(uno.provincia).toBe("BA");
    expect(uno.regione).toBe("Puglia");
    expect(uno.cap).toMatch(/^\d{5}$/);
    // dove i CAP sono molti non si indovina: si torna l'elenco e si scegli
    const roma = luogoDaComune({ nome: "Roma", sigla: "RM" });
    expect(roma.regione).toBe("Lazio");
    expect(roma.capPossibili.length).toBeGreaterThan(1);
    expect(roma.cap).toBe("");
  });

  it("senza email o telefono non si salva: sono loro a distinguere due omonimi", () => {
    const pieno = { nome: "Maria", cognome: "Rossi", citta: "BARI", email: "maria@rossi.it", telefono: "3331112223" };
    expect(problemiCliente(pieno)).toEqual([]);
    expect(problemiCliente({ ...pieno, email: "" })).toContain("l'email");
    expect(problemiCliente({ ...pieno, email: "maria@rossi" })).toContain("un'email scritta per intero");
    expect(problemiCliente({ ...pieno, telefono: "333" })).toContain("il numero di telefono");
    expect(problemiCliente({ ...pieno, citta: "" })).toContain("la città");
    expect(problemiCliente({ nome: "", cognome: "", citta: "", email: "", telefono: "" }).length).toBe(5);
  });

  it("la riga da salvare è normalizzata", () => {
    const r = clienteDaSalvare({ nome: " maria ", cognome: "rossi", citta: "altamura", provincia: "ba", cap: "70022", regione: "Puglia", email: " Maria@Rossi.IT ", telefono: "347 123 4567" }, "KATIA");
    expect(r).toMatchObject({
      nome: "MARIA", cognome: "ROSSI", citta: "ALTAMURA", provincia: "BA", cap: "70022",
      regione: "Puglia", email: "maria@rossi.it", telefono: "+393471234567", registrato_da: "KATIA",
    });
  });
});

describe("Registrazione clienti: la pagina", () => {
  it("la tessera c'è per chi vende, e dentro ci sono le due sezioni", async () => {
    const p = await apriRegistrazione([], []);
    const t = pulito(p);
    expect(t).toContain("Registrazione clienti");
    expect(t).toContain("Registra un cliente");
    expect(t).toContain("Clienti registrati");
    // i campi chiesti dal titolare, tutti
    for (const chiave of ["nome", "cognome", "citta", "provincia", "cap", "regione", "email", "telefono"]) {
      expect(dentro(p, chiave), `manca il campo ${chiave}`).toBeTruthy();
    }
    // il +39 è scritto fuori dalla casella e non si tocca
    expect(t).toContain("+39");
    await p.smonta();
  });

  it("scelta la città dal suggerimento, provincia regione e CAP si riempiono da sé", async () => {
    const p = await apriRegistrazione([], []);
    await scrivi(dentro(p, "citta"), "ALTAMUR");
    const proposta = p.nodo.querySelector('[data-proposta="0"]');
    expect(proposta.textContent).toContain("Altamura");
    await premi(proposta);
    expect(dentro(p, "citta").value).toBe("ALTAMURA");
    expect(dentro(p, "provincia").value).toBe("BA");
    expect(dentro(p, "regione").value).toBe("Puglia");
    expect(dentro(p, "cap").value).toMatch(/^\d{5}$/);
    // provincia e regione non si battono a mano
    expect(dentro(p, "provincia").readOnly).toBe(true);
    expect(dentro(p, "regione").readOnly).toBe(true);
    await p.smonta();
  });

  it("salva il cliente normalizzato, e la seconda volta dice «utente già registrato»", async () => {
    const scritture = [];
    const p = await apriRegistrazione([], scritture);

    await scrivi(dentro(p, "nome"), "maria");
    await scrivi(dentro(p, "cognome"), "rossi");
    await scrivi(dentro(p, "citta"), "ALTAMUR");
    await premi(p.nodo.querySelector('[data-proposta="0"]'));
    await scrivi(dentro(p, "email"), "Maria@Rossi.IT");
    await scrivi(dentro(p, "telefono"), "347 123 4567");
    // mentre si scrive, la pagina dice come finirà in archivio
    expect(pulito(p)).toContain("+393471234567");

    await clicca(p.tasto("Salva"));
    await attendi(150);
    expect(scritture.length).toBe(1);
    expect(scritture[0].corpo).toMatchObject({
      nome: "MARIA", cognome: "ROSSI", citta: "ALTAMURA", provincia: "BA", regione: "Puglia",
      email: "maria@rossi.it", telefono: "+393471234567", registrato_da: "KATIA",
    });
    expect(pulito(p)).toContain("MARIA ROSSI è stato registrato");

    // la stessa persona, scritta in un altro modo: niente seconda riga
    await scrivi(dentro(p, "nome"), " maria");
    await scrivi(dentro(p, "cognome"), "Rossi ");
    await scrivi(dentro(p, "citta"), "ALTAMUR");
    await premi(p.nodo.querySelector('[data-proposta="0"]'));
    await scrivi(dentro(p, "email"), "maria@rossi.it");
    await scrivi(dentro(p, "telefono"), "+39 347 1234567");
    await clicca(p.tasto("Salva"));
    await attendi(150);
    expect(pulito(p)).toContain("Utente già registrato");
    expect(scritture.length).toBe(1);

    // cambiando il telefono è un'altra persona, e si salva
    await scrivi(dentro(p, "telefono"), "333 9998887");
    await clicca(p.tasto("Salva"));
    await attendi(150);
    expect(scritture.length).toBe(2);
    expect(scritture[1].corpo.telefono).toBe("+393339998887");

    // e nell'elenco ci sono tutti e due
    await clicca(p.tasto("Clienti registrati"));
    await attendi(150);
    const t = pulito(p);
    expect(t).toContain("MARIA ROSSI");
    expect(t).toContain("+393471234567");
    expect(t).toContain("+393339998887");
    await p.smonta();
  });

  it("l'elenco mostra i clienti già in archivio e si cerca", async () => {
    const elenco = [
      { id: "a", nome: "ANNA", cognome: "BIANCHI", citta: "BARI", provincia: "BA", cap: "70121", regione: "Puglia", email: "anna@b.it", telefono: "+393331112223", registrato_il: "2026-11-01T09:00:00Z", registrato_da: "KATIA" },
      { id: "b", nome: "LUCIA", cognome: "VERDI", citta: "MILANO", provincia: "MI", cap: "20121", regione: "Lombardia", email: "lucia@v.it", telefono: "+393334445556", registrato_il: "2026-11-02T09:00:00Z", registrato_da: "GINA" },
    ];
    const p = await apriRegistrazione(elenco, []);
    await clicca(p.tasto("Clienti registrati"));
    await attendi(150);
    expect(pulito(p)).toContain("ANNA BIANCHI");
    expect(pulito(p)).toContain("LUCIA VERDI");
    await scrivi(dentro(p, "cerca"), "milano");
    expect(pulito(p)).toContain("LUCIA VERDI");
    expect(pulito(p)).not.toContain("ANNA BIANCHI");
    await p.smonta();
  });

  it("la matita porta la riga nel modulo e salvando aggiorna quella, non ne crea una nuova", async () => {
    const scritture = [];
    const elenco = [{
      id: "a", nome: "ANNA", cognome: "BIANCHI", citta: "ALTAMURA", provincia: "BA", cap: "70022", regione: "Puglia",
      email: "anna@b.it", telefono: "+393331112223", registrato_il: "2026-11-01T09:00:00Z", registrato_da: "GINA",
    }];
    const p = await apriRegistrazione(elenco, scritture);
    await clicca(p.tasto("Clienti registrati"));
    await attendi(150);

    const matita = p.nodo.querySelector('[data-campo="modifica"]');
    expect(matita).toBeTruthy();
    await clicca(matita);
    await attendi(150);
    // la riga è dentro il modulo, e il +39 non è raddoppiato
    expect(dentro(p, "nome").value).toBe("ANNA");
    expect(dentro(p, "citta").value).toBe("ALTAMURA");
    expect(dentro(p, "regione").value).toBe("Puglia");
    expect(dentro(p, "telefono").value).toBe("3331112223");
    expect(pulito(p)).toContain("Modifica cliente");
    expect(pulito(p)).toContain("correggendo una scheda già registrata");

    // risalvata identica non si rifiuta da sola («utente già registrato»
    // sarebbe lei stessa)
    await scrivi(dentro(p, "email"), "anna.bianchi@b.it");
    await clicca(p.tasto("Salva le modifiche"));
    await attendi(150);
    expect(scritture.length).toBe(1);
    expect(scritture[0].indirizzo).toContain("id=eq.a");
    expect(scritture[0].corpo).toMatchObject({ nome: "ANNA", email: "anna.bianchi@b.it", modificato_da: "KATIA" });
    // chi ha registrato la scheda non si riscrive: è la storia della riga
    expect(scritture[0].corpo.registrato_da).toBeUndefined();
    expect(pulito(p)).toContain("ANNA BIANCHI è stato aggiornato");
    await p.smonta();
  });

  // AGGIORNATA IL 4/11/2026: la conferma non dice più «non si recupera»
  // e il tasto non cancella più — mette nel cestino, da cui si ripesca
  // per sei mesi. La riga esce dall'elenco esattamente come prima.
  it("il cestino chiede conferma col nome e porta la riga nel cestino", async () => {
    const scritture = [];
    const elenco = [{
      id: "a", nome: "ANNA", cognome: "BIANCHI", citta: "BARI", provincia: "BA", cap: "70121", regione: "Puglia",
      email: "anna@b.it", telefono: "+393331112223", registrato_il: "2026-11-01T09:00:00Z", registrato_da: "GINA",
    }];
    const chiesto = [];
    window.confirm = (t) => { chiesto.push(t); return true; };
    const p = await apriRegistrazione(elenco, scritture);
    await clicca(p.tasto("Clienti registrati"));
    await attendi(150);
    await clicca(p.nodo.querySelector('[data-campo="cancella"]'));
    await attendi(150);
    expect(chiesto.join(" ")).toContain("ANNA BIANCHI");
    expect(chiesto.join(" ")).toContain("nel cestino");
    expect(chiesto.join(" ")).toContain("sei mesi");
    expect(pulito(p)).toContain("ANNA BIANCHI è nel cestino");
    expect(pulito(p)).not.toContain("anna@b.it");
    await p.smonta();
  });

  it("il cestino non cancella niente se si annulla la conferma", async () => {
    const elenco = [{
      id: "a", nome: "ANNA", cognome: "BIANCHI", citta: "BARI", provincia: "BA", cap: "70121", regione: "Puglia",
      email: "anna@b.it", telefono: "+393331112223", registrato_il: "2026-11-01T09:00:00Z", registrato_da: "GINA",
    }];
    window.confirm = () => false;
    const p = await apriRegistrazione(elenco, []);
    await clicca(p.tasto("Clienti registrati"));
    await attendi(150);
    await clicca(p.nodo.querySelector('[data-campo="cancella"]'));
    await attendi(150);
    expect(pulito(p)).toContain("ANNA BIANCHI");
    expect(pulito(p)).not.toContain("cancellato");
    window.confirm = () => true;
    await p.smonta();
  });

  it("senza il permesso la tessera non c'è", async () => {
    seduta(["gestionedate"]);
    preparaDati([], []);
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    expect(p.tasto("Registrazione clienti")).toBeFalsy();
    await p.smonta();
  });
});

// ——— IL CESTINO (4/11/2026) ———
//
// Prima di oggi il cestino sulla riga cancellava e basta. È la stessa
// forma del guasto del 26/10, quando tre vendite incassate sono sparite
// dal banco senza una copia e senza il nome di chi aveva premuto.
//
// Quello che queste prove difendono: la riga esce dall'elenco, la copia
// si vede nel cestino col nome di chi l'ha cancellata, si rimette, e il
// caso che conta — la stessa persona registrata di nuovo nel frattempo —
// torna con la frase del database e NON con un elenco che si svuota
// come se fosse andata bene.
function preparaConCestino({ elenco, cestino, scritture, errore = null }) {
  rispondiCon({
    "rpc/cliente_cestina": (corpo) => {
      scritture.push({ cosa: "cestina", corpo });
      const x = elenco.find((r) => r.id === corpo.p_id);
      return { id: x.id, nome: x.nome, cognome: x.cognome, email: x.email, telefono: x.telefono,
        riga: x, cestinato_il: "2026-11-04T09:00:00Z", cestinato_da: corpo.p_chi };
    },
    "rpc/cliente_ripristina": (corpo) => {
      scritture.push({ cosa: "ripristina", corpo });
      if (errore) return { message: errore, code: "P0001" };
      const x = (cestino || []).find((r) => r.id === corpo.p_id);
      return x.riga;
    },
    clienti_cestino: () => cestino,
    clienti_registrati: (corpo) => (corpo ? { id: "nuovo", ...corpo } : elenco),
  });
}

const UNA = {
  id: "a", nome: "MARIA", cognome: "ROSSI", citta: "BARI", provincia: "BA", cap: "70100",
  regione: "Puglia", email: "maria@example.com", telefono: "+393331112223",
  registrato_il: "2026-11-03T12:00:00Z", registrato_da: "KATIA",
};

describe("Il cestino dei clienti cancellati", () => {
  it("cancellare mette nel cestino: la riga esce dall'elenco e la linguetta compare col conteggio", async () => {
    const scritture = [];
    seduta();
    preparaConCestino({ elenco: [UNA], cestino: [], scritture });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    await clicca(p.tasto("Registrazione clienti"));
    await attendi(200);
    await clicca(p.tasto("Clienti registrati (1)"));
    await attendi(120);
    expect(pulito(p)).toMatch(/maria rossi/i);

    window.confirm = () => true;
    await clicca(dentro(p, "cancella"));
    await attendi(200);

    // è passata dalla funzione del database, non da una delete
    const cestinata = scritture.find((x) => x.cosa === "cestina");
    expect(cestinata).toBeTruthy();
    expect(cestinata.corpo.p_id).toBe("a");
    // e porta il nome di chi ha premuto: è la cosa che mancava sulle vendite
    expect(cestinata.corpo.p_chi).toBeTruthy();
    const t = pulito(p);
    expect(t).toContain("è nel cestino");
    expect(t).toContain("Cestino (1)");
    await p.smonta();
  });

  it("la conferma annullata non cancella niente", async () => {
    const scritture = [];
    seduta();
    preparaConCestino({ elenco: [UNA], cestino: [], scritture });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    await clicca(p.tasto("Registrazione clienti"));
    await attendi(200);
    await clicca(p.tasto("Clienti registrati (1)"));
    await attendi(120);
    window.confirm = () => false;
    await clicca(dentro(p, "cancella"));
    await attendi(150);
    expect(scritture.filter((x) => x.cosa === "cestina")).toEqual([]);
    expect(pulito(p)).not.toContain("Cestino (");
    window.confirm = () => true;
    await p.smonta();
  });

  it("dentro il cestino si legge chi l'ha cancellata e quando, e «Rimetti» la riporta in archivio", async () => {
    const scritture = [];
    const inCestino = [{
      id: "a", nome: "MARIA", cognome: "ROSSI", email: "maria@example.com", telefono: "+393331112223",
      riga: UNA, cestinato_il: "2026-11-04T09:00:00Z", cestinato_da: "STEFANO",
    }];
    seduta();
    preparaConCestino({ elenco: [], cestino: inCestino, scritture });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    await clicca(p.tasto("Registrazione clienti"));
    await attendi(300);
    // la linguetta c'è perché il cestino non è vuoto
    await clicca(dentro(p, "tab-cestino"));
    await attendi(200);
    const t = pulito(p);
    expect(t).toContain("STEFANO");
    expect(t).toMatch(/cancellata il/);
    expect(t).toContain("sei mesi");

    await clicca(dentro(p, "ripristina"));
    await attendi(200);
    const rimessa = scritture.find((x) => x.cosa === "ripristina");
    expect(rimessa.corpo.p_id).toBe("a");
    expect(pulito(p)).toContain("è tornato fra i clienti registrati");
    await p.smonta();
  });

  it("se nel frattempo la persona è stata registrata di nuovo, il rifiuto del database si vede e la riga resta nel cestino", async () => {
    const scritture = [];
    const inCestino = [{
      id: "a", nome: "MARIA", cognome: "ROSSI", email: "maria@example.com", telefono: "+393331112223",
      riga: UNA, cestinato_il: "2026-11-04T09:00:00Z", cestinato_da: "STEFANO",
    }];
    seduta();
    preparaConCestino({ elenco: [], cestino: inCestino, scritture });
    // Un rifiuto di PostgREST NON è un 200 con dentro un messaggio: è uno
    // stato 4xx, ed è l'unico modo in cui il client Supabase lo riconosce
    // come errore. Avvolgendo la finta si riproduce quello vero — con un
    // 200 la pagina avrebbe creduto che fosse andata bene, che è
    // precisamente il guasto da cui questa prova difende.
    const finta = globalThis.fetch;
    globalThis.fetch = async (url, opzioni) => {
      if (String(url).includes("rpc/cliente_ripristina")) {
        scritture.push({ cosa: "ripristina", corpo: JSON.parse(opzioni.body) });
        return new Response(JSON.stringify({
          code: "P0001",
          message: "Non la rimetto: MARIA ROSSI risulta già registrato con la stessa email e lo stesso telefono.",
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return finta(url, opzioni);
    };
    globalThis.window.fetch = globalThis.fetch;
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    await clicca(p.tasto("Registrazione clienti"));
    await attendi(300);
    await clicca(dentro(p, "tab-cestino"));
    await attendi(200);
    await clicca(dentro(p, "ripristina"));
    await attendi(200);
    const t = pulito(p);
    // la frase del database, non una mia traduzione
    expect(t).toContain("Non la rimetto");
    expect(t).toContain("già registrato");
    // e soprattutto: la riga NON è sparita dal cestino
    expect(dentro(p, "ripristina")).toBeTruthy();
    expect(t).not.toContain("è tornato fra i clienti registrati");
    await p.smonta();
  });

  it("col cestino vuoto la linguetta non c'è: una linguetta sempre vuota non la guarda nessuno", async () => {
    const scritture = [];
    seduta();
    preparaConCestino({ elenco: [UNA], cestino: [], scritture });
    window.history.replaceState({}, "", "/");
    const p = await monta(<App />);
    await attendi(250);
    await clicca(p.tasto("Registrazione clienti"));
    await attendi(300);
    expect(dentro(p, "tab-cestino")).toBeFalsy();
    await p.smonta();
  });
});
