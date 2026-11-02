// QUANDO LA SINCRONIZZAZIONE DEL SITO VA CONSIDERATA FERMA, e cosa si
// scrive a chi deve saperlo.
//
// Sta qui e non in src/ perche' la usano due mondi, come `email.js`: il
// browser, che con questa regola accende il semaforo in Vendite shop, e
// Deno, che con la stessa regola decide se mandare la notifica e la
// mail. Due copie vorrebbero dire che un giorno il riquadro e' verde e
// il telefono squilla, o il contrario — e nessuno dei due sarebbe
// creduto piu'.
//
// Qui dentro non si legge e non si scrive niente: entrano le righe di
// `sync_shop_esiti`, esce uno stato e il testo dell'avviso.

// Il cron gira ogni quarto d'ora (dal 2/11/2026; prima ogni ora). Settanta
// minuti sono piu' di quattro giri saltati: non e' un inciampo, e' un
// guasto. Piu' corto di cosi' e un intoppo di rete sveglierebbe qualcuno
// per niente, piu' lungo e un giorno di ordini sparisce senza che si sappia.
export const MINUTI_MASSIMI_SENZA_SYNC = 70;

// Un 502 di WooCommerce capita e si rimedia da solo al giro dopo. Due di
// fila sono mezz'ora di guasto, e vanno detti.
export const ERRORI_DI_SEGUITO_PER_AVVISARE = 2;

// Postgres restituisce "2026-09-25 08:31:00.53+00" dall'editor SQL e
// "2026-09-25T08:31:00.53+00:00" da PostgREST: con lo spazio al posto
// della T e l'offset a due cifre Safari risponde Invalid Date. Deliberata-
// mente identica a `dataDaPostgres` di App.jsx.
export function istanteDa(valore) {
  if (!valore) return null;
  const iso = String(valore).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Un giro "parziale" i dati li ha aggiornati lo stesso, solo non tutti:
// conta come riuscito. Un giro "errore" no — e' arrivato in fondo, ma a
// mani vuote.
export function ultimoGiroRiuscito(esiti) {
  return (esiti || []).find((e) => e.esito === "ok" || e.esito === "parziale") || null;
}

export function minutiDa(valore, adesso = Date.now()) {
  const d = istanteDa(valore);
  return d ? (adesso - d.getTime()) / 60000 : Infinity;
}

/**
 * Lo stato della sincronizzazione, letto dalle righe di `sync_shop_esiti`
 * ordinate dalla piu' recente.
 *
 * Due guasti diversi, e il secondo e' quello che e' successo davvero:
 *
 *  - `errori`: i giri arrivano in fondo e dicono di non avercela fatta.
 *    Si vede, perche' la riga c'e'.
 *  - `silenzio`: non arriva nessuna riga. E' il caso dell'1/11/2026: la
 *    funzione veniva uccisa a meta' per consumo di risorse, quindi non
 *    faceva in tempo a scrivere niente. Per questo la vigilanza non puo'
 *    stare DENTRO la funzione sorvegliata: chi muore non si segnala.
 *
 * @returns {{stato: "a_posto"|"guasto"|"muto", motivo: null|"errori"|"silenzio",
 *   ultimo: object|null, ultimoOk: object|null, minutiDaOk: number,
 *   erroriDiSeguito: number, errori: string[]}}
 */
export function statoSincronizzazione(esiti = [], adesso = Date.now()) {
  const righe = esiti || [];
  const ultimo = righe[0] || null;
  const ultimoOk = ultimoGiroRiuscito(righe);
  const minutiDaOk = minutiDa(ultimoOk?.ts, adesso);

  let erroriDiSeguito = 0;
  for (const r of righe) {
    if (r.esito === "errore") erroriDiSeguito += 1;
    else break;
  }
  const errori = (Array.isArray(ultimo?.errori) ? ultimo.errori : []).map(String);

  if (!ultimo) return { stato: "muto", motivo: null, ultimo, ultimoOk, minutiDaOk, erroriDiSeguito, errori };
  // Il silenzio viene prima: se non arriva un giro riuscito da troppo
  // tempo e' il guasto piu' grave, qualunque cosa dica l'ultima riga.
  if (minutiDaOk > MINUTI_MASSIMI_SENZA_SYNC) {
    return { stato: "guasto", motivo: "silenzio", ultimo, ultimoOk, minutiDaOk, erroriDiSeguito, errori };
  }
  if (erroriDiSeguito >= ERRORI_DI_SEGUITO_PER_AVVISARE) {
    return { stato: "guasto", motivo: "errori", ultimo, ultimoOk, minutiDaOk, erroriDiSeguito, errori };
  }
  return { stato: "a_posto", motivo: null, ultimo, ultimoOk, minutiDaOk, erroriDiSeguito, errori };
}

function quandoScritto(valore) {
  const d = istanteDa(valore);
  if (!d) return "mai";
  return d.toLocaleString("it-IT", {
    timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function daQuanto(minuti) {
  if (!Number.isFinite(minuti)) return "da sempre";
  if (minuti < 90) return `da ${Math.round(minuti)} minuti`;
  const ore = minuti / 60;
  if (ore < 36) return `da ${Math.round(ore)} ore`;
  return `da ${Math.round(ore / 24)} giorni`;
}

/**
 * Il testo dell'avviso: lo stesso per la notifica e per la mail, cosi'
 * chi riceve le due cose non legge due versioni dello stesso fatto.
 *
 * Dice tre cose e in quest'ordine: cosa non funziona, da quando, e cosa
 * vuol dire per chi lavora (gli ordini del sito non stanno entrando).
 * L'ultima riga e' dove guardare, perche' un avviso senza un gesto da
 * fare si impara a chiudere.
 */
export function avvisoSincronizzazione(stato, { rientro = false } = {}) {
  if (rientro) {
    const quando = quandoScritto(stato.ultimoOk?.ts);
    return {
      titolo: "Ordini del sito: è tornata a posto",
      testo: `La sincronizzazione con lo shop ha ripreso: ultimo giro riuscito il ${quando}. Gli ordini stanno entrando di nuovo.`,
      html: `<p>La sincronizzazione con lo shop ha ripreso: ultimo giro riuscito il <strong>${quando}</strong>.</p><p>Gli ordini stanno entrando di nuovo. Non serve fare niente.</p>`,
    };
  }

  const quandoOk = quandoScritto(stato.ultimoOk?.ts);
  const dettaglio = stato.motivo === "silenzio"
    ? `Non arriva nessun giro ${daQuanto(stato.minutiDaOk)}: la funzione non sta nemmeno arrivando in fondo.`
    : `${stato.erroriDiSeguito} giri di fila non riusciti.${stato.errori.length ? ` Ultimo errore: ${stato.errori.join(" · ")}` : ""}`;

  const testo = [
    "Gli ordini dello shop non stanno entrando in app.",
    dettaglio,
    `Ultimo giro riuscito: ${quandoOk}.`,
    "Guarda il riquadro in cima a Vendite shop e premi “Recupera ordini mancanti”.",
  ].join(" ");

  return {
    titolo: "Ordini del sito fermi",
    testo,
    html: [
      "<p><strong>Gli ordini dello shop non stanno entrando in app.</strong></p>",
      `<p>${dettaglio}</p>`,
      `<p>Ultimo giro riuscito: <strong>${quandoOk}</strong>.</p>`,
      "<p>Apri <strong>Vendite shop</strong>: il riquadro in cima dice com'è andato l'ultimo giro, e il tasto “Recupera ordini mancanti” ne fa uno subito.</p>",
      "<p style=\"color:#777;font-size:13px\">Questo avviso parte da sé quando la sincronizzazione resta ferma, al massimo una volta ogni sei ore. Chi lo riceve si cambia in Vendite shop.</p>",
    ].join(""),
  };
}
