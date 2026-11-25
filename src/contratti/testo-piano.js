// SOSTITUIRE UNA PARTE DEL CONTRATTO PER INTERO (25/11/2026, chiesto
// dal titolare: «manca anche il tasto "sostituisci contratto" nel caso
// io lo voglia cambiare integralmente»).
//
// Correggere capoverso per capoverso — il tasto «Modifica» — serve a
// cambiare una parola. Non basta per cambiare il contratto: non si
// aggiunge un articolo, non se ne toglie uno, non si incolla un testo
// nuovo che ha un numero diverso di capoversi. Per questo la stessa
// parte si può aprire come UN TESTO SOLO, incollarci dentro quello
// nuovo, e salvare.
//
// LE DUE FUNZIONI SONO UNA SOLA COSA: `aTesto` scrive la struttura
// salvata come testo, `daTesto` la rilegge. Devono tornare identiche
// l'una dall'altra — `prove/contratto-master.test.jsx` lo prova sul
// contratto vero, parte per parte: se una sola virgola non tornasse, un
// documento aperto e richiuso senza toccare niente si salverebbe
// diverso da com'era.
//
// IL FORMATO È QUELLO CHE SI VEDE, e la pagina lo scrive sopra la
// casella: una riga per capoverso, una riga vuota fra un articolo e il
// successivo, la prima riga di ogni blocco è il suo titolo. Nessun
// capoverso del contratto contiene un a capo (misurato: 277 stringhe,
// zero), quindi la riga è un'unità sicura.

const righeDi = (testo) => String(testo ?? "").split("\n").map((r) => r.trim());
const nonVuote = (testo) => righeDi(testo).filter(Boolean);
// i blocchi si separano con una riga vuota
const blocchiDi = (testo) =>
  String(testo ?? "").split(/\n\s*\n/).map((b) => nonVuote(b)).filter((b) => b.length > 0);

/** Come si scrive, parte per parte: la riga che la pagina mostra sopra la casella. */
export const COME_SI_SCRIVE = {
  intestazione: "Tre righe: titolo, sottotitolo, versione.",
  parti: "Quattro righe: la riga sopra l'Accademia, l'Accademia, la riga sopra il/la Master, l'epigrafe modello.",
  premesse: "Prima riga il titolo, poi un capoverso per riga.",
  articoli: "Un articolo per blocco, separati da una riga vuota. La prima riga di ogni blocco è il titolo dell'articolo, le altre i suoi commi.",
  clausole: "Prima riga il titolo, poi un capoverso per riga (le voci dell'elenco cominciano con «•»).",
  manifesto: "Prima riga il titolo, seconda la versione, poi una riga vuota e un blocco per sezione: prima riga il titolo del blocco, le altre il testo.",
  caselle: "Una dichiarazione per blocco, separati da una riga vuota: prima riga l'etichetta, la seconda il testo. Le dichiarazioni devono restare tre e nello stesso ordine — la loro chiave decide quale spunta è.",
};

// I CAPOVERSI VUOTI SPARISCONO, e vale la pena sapere perche'. Nel
// Manifesto trascritto dal PDF il blocco «Lo Stile Elitederma» ha un
// capoverso BUCATO (`punti: [ , ]`, cioe' un posto vuoto): e' un pezzo
// di testo perso nella trascrizione del 14/11, e a video quel titolo
// compare senza niente sotto. Scritto come testo e riletto, quel posto
// vuoto non torna — ed e' giusto che non torni: un capoverso che non
// contiene niente non e' un capoverso. La prova del giro completo
// confronta con questo, non con l'originale.
export function normalizzato(chiave, corpo) {
  const puliti = (p) => (p || []).map((x) => String(x ?? "").trim()).filter(Boolean);
  switch (chiave) {
    case "premesse":
    case "clausole":
      return { ...corpo, punti: puliti(corpo?.punti) };
    case "articoli":
      return (corpo || []).map((a) => ({ ...a, punti: puliti(a.punti) }));
    case "manifesto":
      return { ...corpo, blocchi: (corpo?.blocchi || []).map((b) => ({ ...b, punti: puliti(b.punti) })) };
    default:
      return corpo;
  }
}

/** La struttura salvata, scritta come testo. */
export function aTesto(chiave, corpo) {
  const c = corpo || {};
  switch (chiave) {
    case "intestazione":
      return [c.titolo, c.sottotitolo, c.versione].map((x) => x ?? "").join("\n");
    case "parti":
      return [c.etichettaAccademia, c.accademia, c.etichettaMaster, c.epigrafeModello].map((x) => x ?? "").join("\n");
    case "premesse":
    case "clausole":
      return [c.titolo ?? "", ...normalizzato(chiave, c).punti].join("\n");
    case "articoli":
      return normalizzato(chiave, corpo).map((a) => [a.titolo ?? "", ...a.punti].join("\n")).join("\n\n");
    case "manifesto":
      return [c.titolo ?? "", c.versione ?? "", "", normalizzato(chiave, c).blocchi
        .map((b) => [b.titolo ?? "", ...b.punti].join("\n")).join("\n\n")].join("\n");
    case "caselle":
      return (corpo || []).map((d) => [d.etichetta ?? "", d.testo ?? ""].join("\n")).join("\n\n");
    default:
      return "";
  }
}

/**
 * Il testo riletto come struttura.
 *
 * Torna `{ corpo, errore }`: un formato che non si capisce NON diventa
 * un contratto a metà. Chi chiama mostra l'errore e non salva niente —
 * su un documento che qualcuno firma, «ho fatto del mio meglio» è la
 * risposta sbagliata.
 *
 * `precedente` serve alle dichiarazioni: `chiave`, `tipo` e
 * `daClausole` non sono testo, sono meccanismo (dicono quale spunta è e
 * se è obbligatoria) e si tengono dalla versione di prima, in ordine.
 */
export function daTesto(chiave, testo, precedente = null) {
  const righe = righeDi(testo);
  const piene = nonVuote(testo);
  switch (chiave) {
    case "intestazione": {
      if (piene.length < 3) return { errore: "Servono tre righe: titolo, sottotitolo, versione." };
      return { corpo: { titolo: piene[0], sottotitolo: piene[1], versione: piene[2] } };
    }
    case "parti": {
      if (piene.length < 4) return { errore: "Servono quattro righe: riga sopra l'Accademia, Accademia, riga sopra il/la Master, epigrafe modello." };
      return { corpo: { etichettaAccademia: piene[0], accademia: piene[1], etichettaMaster: piene[2], epigrafeModello: piene[3] } };
    }
    case "premesse":
    case "clausole": {
      if (piene.length < 2) return { errore: "Serve almeno il titolo e un capoverso." };
      return { corpo: { titolo: piene[0], punti: piene.slice(1) } };
    }
    case "articoli": {
      const blocchi = blocchiDi(testo);
      if (blocchi.length === 0) return { errore: "Non ho trovato nessun articolo." };
      const senzaCommi = blocchi.filter((b) => b.length < 2).length;
      if (senzaCommi) return { errore: `${senzaCommi} ${senzaCommi === 1 ? "articolo ha" : "articoli hanno"} solo il titolo: fra un articolo e il successivo ci va una riga vuota.` };
      return { corpo: blocchi.map((b) => ({ titolo: b[0], punti: b.slice(1) })) };
    }
    case "manifesto": {
      if (piene.length < 3) return { errore: "Servono almeno titolo, versione e un blocco." };
      // titolo e versione sono le prime due righe piene, i blocchi tutto
      // quello che viene dopo la SECONDA: si cerca la loro POSIZIONE, non
      // il loro testo — due righe uguali manderebbero a pescare la prima
      const posizioni = [];
      righe.forEach((r, i) => { if (r) posizioni.push(i); });
      const resto = righe.slice(posizioni[1] + 1).join("\n");
      const blocchi = blocchiDi(resto);
      if (blocchi.length === 0) return { errore: "Non ho trovato nessun blocco del Manifesto." };
      return { corpo: { titolo: piene[0], versione: piene[1], blocchi: blocchi.map((b) => ({ titolo: b[0], punti: b.slice(1) })) } };
    }
    case "caselle": {
      const blocchi = blocchiDi(testo);
      const prima = Array.isArray(precedente) ? precedente : [];
      if (blocchi.length !== prima.length) {
        return { errore: `Le dichiarazioni devono restare ${prima.length} e nello stesso ordine: la loro chiave decide quale spunta è e se è obbligatoria. Ne ho lette ${blocchi.length}.` };
      }
      const male = blocchi.findIndex((b) => b.length < 2);
      if (male >= 0) return { errore: `Alla dichiarazione ${male + 1} manca l'etichetta o il testo: prima riga l'etichetta, la seconda il testo.` };
      return {
        corpo: blocchi.map((b, i) => ({ ...prima[i], etichetta: b[0], testo: b.slice(1).join(" ") })),
      };
    }
    default:
      return { errore: "Parte sconosciuta: " + chiave };
  }
}

/** Cosa ho capito di quello che è stato incollato, in una riga. */
export function riconosciuto(chiave, corpo) {
  if (!corpo) return "";
  const capoversi = (p) => `${(p || []).length} capovers${(p || []).length === 1 ? "o" : "i"}`;
  switch (chiave) {
    case "articoli":
      return `${corpo.length} articol${corpo.length === 1 ? "o" : "i"} · ${corpo.reduce((n, a) => n + (a.punti || []).length, 0)} commi`;
    case "manifesto":
      return `${(corpo.blocchi || []).length} blocchi · ${(corpo.blocchi || []).reduce((n, b) => n + (b.punti || []).length, 0)} capoversi`;
    case "caselle":
      return `${corpo.length} dichiarazion${corpo.length === 1 ? "e" : "i"}`;
    case "premesse":
    case "clausole":
      return capoversi(corpo.punti);
    default:
      return "";
  }
}
