// A CHE PUNTO E' OGNUNA COL CONTRATTO: i gradini, e come si leggono.
//
// Il titolare, 27/11/2026: «un segnalatore per vedere almeno chi abbia
// aperto il testo magari senza firmare perche' non so chi ha posto
// attenzione o meno al contratto».
//
// CINQUE GRADINI, E SONO ESCLUSIVI. «Da firmare» da solo metteva nella
// stessa riga chi non ha mai aperto la pagina e chi ha letto
// ventitre' articoli e si e' fermato davanti alla firma: sono due
// persone da richiamare in due modi diversi.
//
//   firmato -> ha firmato (e per firmare ha letto: la pagina non lascia
//              firmare un testo che non si e' aperto e richiuso)
//   letto   -> ha aperto E RICHIUSO il testo del contratto, non ha firmato
//   aperto  -> ha aperto la pagina, il testo mai
//   mai     -> non e' mai entrata
//   fuori   -> `master.contratto_escluso`: a lei la nuvola non compare
//
// NIENTE QUI DENTRO SI DISEGNA e niente parla col database: sono conti
// puri, e le prove li girano senza montare nessuna pagina.
//
// E CHI SI SCARICA IL PDF NON SPARISCE (27/11/2026). Dal tasto nuovo
// nella pagina della firma il contratto si porta via in PDF: quella
// master il testo nella pagina non lo apre, quindi resta «aperto, non
// letto» — vero — ma la riga lo dice. Il gradino non cambia: dice dove
// si e' fermata DENTRO la pagina, e un sesto gradino per una cosa che
// si legge meglio come una riga accanto rifarebbe tutti i conteggi.
//
// I SECONDI VANNO LETTI PER QUELLO CHE SONO: quanto il riquadro del
// testo e' stato tenuto aperto, sommato su tutte le volte. Non provano
// la lettura — niente la prova, ed e' scritto accanto a questa regola da
// quando esiste — ma un contratto richiuso dopo quattro secondi dice
// qualcosa, e fino a oggi non lo diceva a nessuno.

export const GRADI = ["firmato", "letto", "aperto", "mai", "fuori"];

export const NOMI_GRADO = {
  firmato: "Firmati",
  letto:   "Letto, non firmato",
  aperto:  "Aperto, non letto",
  mai:     "Mai aperto",
  fuori:   "Fuori",
};

/**
 * A che gradino sta questa master.
 *
 * `pagina_aperta_il` manca sulle righe piu' vecchie di questa
 * misurazione: li' vale `creato_il`, perche' fino al 27/11/2026 una riga
 * di contratto nasceva in un modo solo — la pagina di firma che si
 * apriva. Non e' una stima, e' il modo in cui quella riga poteva esistere.
 */
export function gradoContratto(master, contratto) {
  if (master?.contratto_escluso) return "fuori";
  if (!contratto) return "mai";
  if (contratto.stato === "firmato") return "firmato";
  if (contratto.testo_letto_il) return "letto";
  if (contratto.pagina_aperta_il || contratto.creato_il) return "aperto";
  return "mai";
}

/** Quanti stanno su ogni gradino. Le chiavi ci sono sempre, anche a zero. */
export function contaGradi(righe) {
  const conti = {};
  for (const g of GRADI) conti[g] = 0;
  for (const r of righe || []) {
    const g = gradoContratto(r.master, r.contratto);
    conti[g] = (conti[g] || 0) + 1;
  }
  return conti;
}

/** «1 min 40 s». Zero non si scrive: non vuol dire niente. */
export function durata(secondi) {
  const s = Math.max(0, Math.round(Number(secondi) || 0));
  if (!s) return "";
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const resto = s % 60;
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

/** «3 volte», «una volta». Un numero nudo accanto a una data si legge male. */
export function volte(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (!v) return "";
  return v === 1 ? "una volta" : `${v} volte`;
}

const quando = (iso) => {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
};

/**
 * COSA SI LEGGE SULLA RIGA, in pezzi separati invece di una frase sola:
 * chi guarda cerca una cosa per volta, e un paragrafo si salta.
 *
 * Torna un elenco di stringhe; chi disegna le mette in fila.
 */
export function righeDiLettura(master, contratto) {
  const grado = gradoContratto(master, contratto);
  // CHI E' FUORI DICE PRIMA CHE E' FUORI, e poi dove era arrivata. Dal
  // 25/11/2026 l'elenco tiene dentro anche le escluse (la spunta
  // «Escludi» deve restare dove la si e' messa): se quella persona aveva
  // gia' letto il testo, o firmato, va saputo — e' il genere di cosa che
  // si scopre proprio nel momento in cui si spunta la casella.
  if (grado === "fuori") {
    const prima = `Non riceve il contratto${master?.contratto_escluso_motivo ? `: ${master.contratto_escluso_motivo}` : " (senza motivo scritto)."}`;
    return contratto ? [prima, ...righeDiLettura({}, contratto)] : [prima];
  }
  if (grado === "mai") return ["Non ha mai aperto la pagina della firma."];

  const c = contratto || {};
  const fuori = [];

  if (grado === "firmato") {
    fuori.push(`Firmato il ${quando(c.firmato_il)}${c.luogo_firma ? ` a ${c.luogo_firma}` : ""}`);
  }

  const aperta = c.pagina_aperta_il || c.creato_il;
  if (aperta && grado !== "firmato") {
    const quante = volte(c.pagina_aperture);
    const ultima = c.pagina_vista_il && c.pagina_vista_il !== aperta
      ? `, l'ultima il ${quando(c.pagina_vista_il)}`
      : "";
    fuori.push(`Pagina aperta${quante ? ` ${quante}` : ""}: la prima il ${quando(aperta)}${ultima}`);
  }

  // IL TESTO E L'ALLEGATO A SONO DUE DOCUMENTI, e si dicono separati:
  // chi ha letto il contratto e non il Manifesto ha letto meta' di
  // quello che firma.
  if (c.testo_letto_il) {
    const t = durata(c.testo_secondi);
    fuori.push(`Contratto letto il ${quando(c.testo_letto_il)}`
      + (c.testo_aperture > 1 ? ` (aperto ${volte(c.testo_aperture)})` : "")
      + (t ? ` · tenuto aperto ${t}` : ""));
  } else if (c.pdf_scaricato_il) {
    // NON E' LA STESSA FRASE, e la differenza conta: «non l'ha mai
    // aperto» accanto a «ha scaricato il PDF» si leggerebbe come due
    // righe che si contraddicono, mentre sono la stessa storia — quel
    // testo non l'ha letto QUI, se l'e' portato via.
    fuori.push("Il testo non l'ha aperto in questa pagina: se l'è portato via in PDF.");
  } else {
    fuori.push("Il testo del contratto non l'ha mai aperto.");
  }

  // IL PDF SCARICATO (27/11/2026). Le maestre hanno chiesto di poter
  // leggere il contratto fuori dall'app: chi lo fa, nella pagina il
  // testo non lo apre — e senza questa riga risulterebbe fra chi non ci
  // ha messo attenzione, cioe' il contrario del vero. Quanto l'abbia
  // tenuto davanti agli occhi non lo sa nessuno, e non si finge di
  // saperlo: qui non ci sono secondi.
  if (c.pdf_scaricato_il) {
    const quante = volte(c.pdf_scaricati);
    const ultima = c.pdf_scaricato_ultimo_il && c.pdf_scaricato_ultimo_il !== c.pdf_scaricato_il
      ? `, l'ultima il ${quando(c.pdf_scaricato_ultimo_il)}`
      : "";
    fuori.push(`PDF del contratto scaricato${quante ? ` ${quante}` : ""}: la prima volta il ${quando(c.pdf_scaricato_il)}${ultima}`);
  }

  if (c.manifesto_letto_il) {
    const t = durata(c.manifesto_secondi);
    fuori.push(`Allegato A letto il ${quando(c.manifesto_letto_il)}`
      + (t ? ` · tenuto aperto ${t}` : ""));
  } else if (grado !== "firmato") {
    fuori.push("L'Allegato A non l'ha mai aperto.");
  }

  if (grado !== "firmato") {
    fuori.push(c.dati_scritti_il
      ? `Ha cominciato a compilarlo il ${quando(c.dati_scritti_il)}`
      : "Non ha ancora scritto niente di suo: i dati che si vedono sono quelli dell'anagrafica.");
  }

  if (c.riaperto_il) {
    fuori.push(`Riaperto il ${quando(c.riaperto_il)}${c.riaperto_perche ? `: ${c.riaperto_perche}` : ""}`);
  }
  return fuori;
}
