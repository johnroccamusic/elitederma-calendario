// CALCOLO CONSUMI: quanto di un prodotto servirà da qui a N mesi.
//
// Il titolare (24/11/2026): «in gestione magazzino un tasto "calcolo
// consumi": si seleziona un prodotto e gli diciamo calcola i consumi
// teorici dal al, in modo che in base ai consumi che ci sono stati ci fa
// una stima delle necessità fino ad arrivare a X mesi — da settembre 2026
// a settembre 2027 — IN FUNZIONE DEI CORSI CHE CI SONO STATI, il consumo
// medio che potrebbe esserci di quel prodotto, delle magliette taglia M o
// di tutta la categoria».
//
// PERCHE' NON SI PROIETTA UNA MEDIA AL MESE, ed e' la ragione per cui
// questo file esiste. Misurato il 24/11/2026: a settembre sono partite 15
// classi, a ottobre 23, a dicembre 3. Una media mensile spalmata su
// dodici mesi direbbe lo stesso numero per dicembre e per ottobre, cioe'
// un numero che non vale per nessuno dei due. Il consumo dei kit segue le
// ALLIEVE, e le allieve seguono le classi: si misura quanto consuma una
// allieva e si moltiplica per le allieve che ci saranno.
//
// E LE ALLIEVE CHE CI SARANNO NON SONO QUELLE GIA' ISCRITTE. Misurato lo
// stesso giorno: gennaio 2027 ha 19 classi a calendario e 38 iscritte
// (2 per classe), febbraio 10 classi e 7 iscritte, da giugno 2027 zero —
// mentre nei mesi misurati la media era 4,8 per classe. Le classi di
// marzo si riempiono a marzo. Proiettare sulle iscritte di oggi direbbe
// «a marzo non serve quasi niente», e qualcuno ordinerebbe troppo poco:
// e' il modo peggiore di sbagliare, perche' il numero sembra un dato.
//
// Quindi due scenari, sempre tutti e due, e li legge una persona:
//   * «con quello che e' a calendario»: le classi a calendario, riempite
//     come si riempivano nei mesi misurati;
//   * «al ritmo dei mesi misurati»: tante classi al mese quante ne sono
//     partite in media nel periodo misurato — serve perche' anche il
//     CALENDARIO e' incompleto piu' si va lontano (settembre 2027 ha una
//     classe a calendario, settembre 2026 ne aveva quindici).
// Il primo e' un pavimento, il secondo un ritmo normale. Il numero vero
// sta in mezzo, e chi ordina deve vedere i due estremi invece di un
// numero solo che non sa di essere incerto.

/** Sotto questo numero di classi non si dichiara una media per corso: una
 *  classe non fa una media, ed e' la stessa soglia di `consumi.ts`. */
export const CLASSI_MINIME_PER_MEDIA = 2;

const mese = (iso) => String(iso || "").slice(0, 7);
const numeroMese = (m) => Number(String(m || "").slice(5, 7)) || 0;

export const MESI_NOMI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** Tutti i mesi al 100%: è il trend di partenza, e lascia il conto
 *  esattamente com'era prima che questa tabella esistesse. */
export const TREND_PIENO = Object.fromEntries(MESI_NOMI.map((_, i) => [i + 1, 100]));

/**
 * IL TREND MENSILE, SCRITTO DAL TITOLARE (24/11/2026).
 *
 * «Devi farmi esprimere la percentuale di iscrizioni rispetto agli altri
 * mesi: settembre 90%, ottobre 100%, dicembre 60%, gennaio 60%… in modo
 * che definisco il trend dei mesi. Per i mesi per cui esiste una
 * statistica valgono i mesi, per i mesi che non esiste valgono le
 * percentuali che esprimo io.» E, sul significato: «la percentuale è
 * espressa rispetto al fatturato medio, quindi 100% dei mesi in cui si
 * lavora di più, 40% è rispetto al 100%».
 *
 * Quindi 100 non vuol dire «come la media»: vuol dire «come un mese di
 * punta». Da cui il livello pieno, qui sotto, che è la cosa che rende i
 * due numeri confrontabili.
 */
export function percentualeDelMese(trend, m) {
  const v = Number(trend?.[numeroMese(m)]);
  return Number.isFinite(v) && v > 0 ? v / 100 : 1;
}

/**
 * QUANTE CLASSI VALE UN MESE DI PUNTA, ricavato dai mesi misurati.
 *
 * Serve perché i mesi misurati non sono per forza mesi pieni: se
 * settembre è al 90% e ha fatto 15 classi, il livello pieno è 16,7 e non
 * 15. Senza questo passaggio un dicembre al 60% verrebbe calcolato sul
 * 90% di settembre preso per 100, e tutta la scala slitterebbe.
 *
 * Con il trend tutto a 100 torna la media semplice delle classi al mese:
 * è il motivo per cui la tabella nasce piena e non cambia niente finché
 * nessuno la tocca.
 */
export function livelloPieno(classiPerMeseMisurato, trend = TREND_PIENO) {
  const voci = Object.entries(classiPerMeseMisurato || {});
  if (!voci.length) return 0;
  let somma = 0, pesi = 0;
  voci.forEach(([m, classi]) => {
    const q = percentualeDelMese(trend, m);
    if (q <= 0) return;
    somma += (Number(classi) || 0) / q;
    pesi += 1;
  });
  return pesi ? somma / pesi : 0;
}


/**
 * QUANTA PARTE DEL MESE RESTA ANCORA DA FARE.
 *
 * Nata il 24/11/2026, da una domanda del titolare — «perche' la stima
 * parte da novembre e non da settembre» — che guardando la riga di
 * novembre ha fatto venire fuori un difetto vero accanto alla risposta.
 *
 * Il mese in corso e' mezzo passato, e le due colonne che si confrontano
 * NON parlano dello stesso pezzo di mese: le «attese» sono il mese
 * INTERO (a novembre 2026: 13 classi, tutte gia' partite), mentre «a
 * calendario» sono solo le classi che devono ancora cominciare (5).
 * Colmare quella differenza vuol dire aggiungere OTTO classi che sono
 * gia' state fatte e il cui materiale e' gia' uscito dal magazzino: un
 * ordine gonfiato, e gonfiato proprio nel mese che si ha sotto gli
 * occhi. Quindi nel mese in corso le attese valgono per la frazione di
 * mese che resta.
 *
 * Il giorno di oggi NON conta, perche' una classe futura e' quella con
 * `data_inizio > oggi`: le due regole devono guardare lo stesso pezzo di
 * calendario, o si torna a contare due volte.
 */
export function frazioneDiMeseRestante(m, oggi) {
  if (!oggi || mese(oggi) !== m) return 1;
  const [y, mm] = String(m).split("-").map(Number);
  const giorniDelMese = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const giorno = Number(String(oggi).slice(8, 10)) || 0;
  if (!giorniDelMese) return 1;
  return Math.max(0, Math.min(1, (giorniDelMese - giorno) / giorniDelMese));
}

/** I mesi da `daMese` a `aMese` compresi, come "2026-12". */
export function mesiFra(daMese, aMese) {
  const fuori = [];
  if (!/^\d{4}-\d{2}$/.test(daMese || "") || !/^\d{4}-\d{2}$/.test(aMese || "")) return fuori;
  let [y, m] = daMese.split("-").map(Number);
  const [ay, am] = aMese.split("-").map(Number);
  while (y < ay || (y === ay && m <= am)) {
    fuori.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return fuori;
}

/**
 * QUANTO CONSUMA UNA ALLIEVA, misurato sulle classi del periodo.
 *
 * `misurate` sono le classi del periodo scelto, ognuna con le sue allieve
 * e i pezzi che le sono partiti — i pezzi li conta chi chiama, con
 * `quantitaInviataPerProdotto`, cioè LA STESSA funzione che riempie la
 * lista di allestimento e che scarica il magazzino. Un secondo conto qui
 * darebbe un consumo diverso da quello che il magazzino ha visto uscire.
 *
 * Torna il dato per corso e quello complessivo: per corso perché un
 * pigmento lo consuma il PMU e non la laminazione, e un mese di
 * laminazioni non deve far ordinare pigmenti.
 */
export function consumoPerAllieva(misurate) {
  const perCorso = {};
  let allieve = 0, pezzi = 0, classi = 0;
  (misurate || []).forEach((c) => {
    const a = Number(c.allieve) || 0;
    const p = Number(c.pezzi) || 0;
    classi += 1; allieve += a; pezzi += p;
    const k = c.corsoId || "—";
    if (!perCorso[k]) perCorso[k] = { corsoId: c.corsoId || null, classi: 0, allieve: 0, pezzi: 0 };
    perCorso[k].classi += 1; perCorso[k].allieve += a; perCorso[k].pezzi += p;
  });
  Object.values(perCorso).forEach((v) => {
    v.perAllieva = v.allieve ? v.pezzi / v.allieve : 0;
    v.allievePerClasse = v.classi ? v.allieve / v.classi : 0;
    // una classe sola non fa una media: il dato resta leggibile ma si
    // dichiara debole, e chi chiama decide se mostrarlo o tacere
    v.affidabile = v.classi >= CLASSI_MINIME_PER_MEDIA;
  });
  return {
    perCorso,
    classi, allieve, pezzi,
    perAllieva: allieve ? pezzi / allieve : 0,
    allievePerClasse: classi ? allieve / classi : 0,
  };
}

/**
 * LE ALLIEVE CHE AVRA' UNA CLASSE FUTURA.
 *
 * Si prende la più alta fra quelle già iscritte e la media storica di quel
 * corso, perché una classe non si svuota: chi è iscritto ci va, e gli
 * altri posti si riempiono fino alla data. E mai più dei posti: una classe
 * da quattro non ne fa otto nemmeno se la media dice otto.
 */
export function allievePreviste({ iscritteOra = 0, mediaPerClasse = 0, postiMax = null } = {}) {
  const stima = Math.max(Number(iscritteOra) || 0, Number(mediaPerClasse) || 0);
  const tetto = Number(postiMax);
  const conTetto = tetto > 0 ? Math.min(stima, Math.max(tetto, Number(iscritteOra) || 0)) : stima;
  return Math.round(conTetto * 10) / 10;
}

/**
 * LA PROIEZIONE, mese per mese, fino al mese scelto.
 *
 * Tre numeri per ogni mese, e ognuno risponde a una domanda diversa:
 *   - `classiACalendario`: quante classi ci sono SCRITTE in quel mese. È
 *     il numero che fa capire se la stima bassa vale: un mese con una
 *     classe a calendario, quando i mesi misurati ne avevano venti, non è
 *     un mese tranquillo — è un calendario ancora da riempire.
 *   - `daCalendario`: quelle classi, riempite come si riempivano.
 *   - `alRitmo`: tante classi quante ne partivano in media nel periodo
 *     misurato, riempite allo stesso modo.
 * Più le vendite, che non seguono i corsi ma il tempo: lì la media al mese
 * è la risposta giusta, e si somma a tutti e due gli scenari.
 */
export function proiezione({
  storico,
  classiFuture = [],
  daMese,
  aMese,
  venditeAlMese = 0,
  giacenza = 0,
  classiAlMeseStoriche = null,
  trend = null,
  classiPerMeseMisurato = null,
  oggi = null,
} = {}) {
  const mesi = mesiFra(daMese, aMese);
  const perMese = Object.fromEntries(mesi.map((m) => [m, { mese: m, classiACalendario: 0, daCalendario: 0, corsiSenzaMisura: 0 }]));

  // il consumo per allieva del corso di quella classe; dove quel corso non
  // è nel periodo misurato si ripiega sulla media di tutti, e la riga lo
  // dice — un corso nuovo non deve valere zero pezzi in silenzio
  const perAllievaDi = (corsoId) => {
    const v = storico?.perCorso?.[corsoId || "—"];
    if (v && v.affidabile) return { valore: v.perAllieva, misurato: true };
    if (v && v.classi > 0) return { valore: v.perAllieva, misurato: true };
    return { valore: storico?.perAllieva || 0, misurato: false };
  };
  const allievePerClasseDi = (corsoId) => {
    const v = storico?.perCorso?.[corsoId || "—"];
    if (v && v.classi > 0) return v.allievePerClasse;
    return storico?.allievePerClasse || 0;
  };

  (classiFuture || []).forEach((c) => {
    const m = mese(c.dataInizio);
    if (!perMese[m]) return;
    const allieve = allievePreviste({
      iscritteOra: c.iscritteOra,
      mediaPerClasse: allievePerClasseDi(c.corsoId),
      postiMax: c.postiMax,
    });
    const pa = perAllievaDi(c.corsoId);
    perMese[m].classiACalendario += 1;
    perMese[m].daCalendario += allieve * pa.valore;
    if (!pa.misurato) perMese[m].corsiSenzaMisura += 1;
  });

  // IL RITMO NON SOSTITUISCE IL CALENDARIO, LO COMPLETA. Un mese con
  // quindici classi scritte è già noto meglio di qualunque media; uno con
  // una classe scritta, quando il ritmo ne dice sedici, ha quindici
  // classi che arriveranno e non sono ancora scritte. Quindi: quello che
  // c'è, più le classi mancanti. Le mancanti si riempiono con la media
  // generale e non con quella per corso, perché QUALI corsi si faranno in
  // un mese che nessuno ha ancora messo a calendario non lo sa nessuno —
  // e inventarlo vorrebbe dire far ordinare pigmenti per un mese di
  // laminazioni.
  //
  // QUANTE CLASSI ATTENDERSI IN UN MESE, nell'ordine dettato dal
  // titolare: «per i mesi per cui esiste una statistica valgono i mesi,
  // per i mesi che non esiste valgono le percentuali che esprimo io».
  //   1. lo stesso mese, se è fra quelli misurati (settembre 2027 lo sa
  //      da settembre 2026): è un dato, e batte qualunque stima;
  //   2. altrimenti il livello di un mese di punta per la percentuale che
  //      quel mese ha nella tabella del trend.
  const perClasseMedia = (storico?.allievePerClasse || 0) * (storico?.perAllieva || 0);
  const livello = classiPerMeseMisurato
    ? livelloPieno(classiPerMeseMisurato, trend || TREND_PIENO)
    : (classiAlMeseStoriche != null ? Number(classiAlMeseStoriche) : 0);
  const classiDelMeseMisurato = {};
  Object.entries(classiPerMeseMisurato || {}).forEach(([m, n2]) => {
    const k = numeroMese(m);
    // più anni dello stesso mese: si tiene il più alto, perché un mese
    // misurato a metà (il periodo scelto comincia il 10) non deve far
    // sembrare quel mese più scarico di quello che è
    classiDelMeseMisurato[k] = Math.max(classiDelMeseMisurato[k] || 0, Number(n2) || 0);
  });
  const classiAttesePerMese = (m) => {
    const daStorico = classiDelMeseMisurato[numeroMese(m)];
    if (daStorico != null) return { valore: daStorico, fonte: "storico" };
    return { valore: livello * percentualeDelMese(trend || TREND_PIENO, m), fonte: trend ? "trend" : "media" };
  };

  let cumCal = 0, cumRitmo = 0;
  let finisceCalendario = null, finisceRitmo = null;
  const righe = mesi.map((m) => {
    const r = perMese[m];
    const daCalendario = Math.round(r.daCalendario * 10) / 10;
    // nel mese in corso si attende solo quello che il mese ha ancora da
    // dare: il resto e' gia' uscito dal magazzino (vedi
    // `frazioneDiMeseRestante`)
    const restaDelMese = frazioneDiMeseRestante(m, oggi);
    const attesePiene = classiAttesePerMese(m);
    const attese = { ...attesePiene, valore: attesePiene.valore * restaDelMese };
    const classiMancanti = Math.max(0, attese.valore - r.classiACalendario);
    const alRitmo = Math.round((r.daCalendario + classiMancanti * perClasseMedia) * 10) / 10;
    cumCal += daCalendario + venditeAlMese;
    cumRitmo += alRitmo + venditeAlMese;
    if (finisceCalendario == null && cumCal > giacenza) finisceCalendario = m;
    if (finisceRitmo == null && cumRitmo > giacenza) finisceRitmo = m;
    return {
      mese: m,
      classiACalendario: r.classiACalendario,
      classiAttese: Math.round(attese.valore * 10) / 10,
      classiAttesePieneDelMese: Math.round(attesePiene.valore * 10) / 10,
      restaDelMese,
      fonteAttese: attese.fonte,
      percentualeTrend: Math.round(percentualeDelMese(trend || TREND_PIENO, m) * 100),
      classiStimateInPiu: Math.round(classiMancanti * 10) / 10,
      corsiSenzaMisura: r.corsiSenzaMisura,
      daiCorsiCalendario: daCalendario,
      daiCorsiAlRitmo: alRitmo,
      dalleVendite: Math.round(venditeAlMese * 10) / 10,
      totaleCalendario: Math.round((daCalendario + venditeAlMese) * 10) / 10,
      totaleAlRitmo: Math.round((alRitmo + venditeAlMese) * 10) / 10,
      cumulatoCalendario: Math.round(cumCal * 10) / 10,
      cumulatoAlRitmo: Math.round(cumRitmo * 10) / 10,
    };
  });

  return {
    righe,
    totaleCalendario: Math.round(cumCal * 10) / 10,
    totaleAlRitmo: Math.round(cumRitmo * 10) / 10,
    giacenza,
    // quanti pezzi mancano per arrivare in fondo al periodo
    daOrdinareCalendario: Math.max(0, Math.ceil(cumCal - giacenza)),
    daOrdinareAlRitmo: Math.max(0, Math.ceil(cumRitmo - giacenza)),
    finisceCalendario, finisceRitmo,
    livelloPieno: Math.round(livello * 10) / 10,
    conTrend: !!trend,
  };
}

/** «settembre 2027» da «2027-09»: la pagina lo scrive così. */
export function nomeMese(m) {
  const nomi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  if (!/^\d{4}-\d{2}$/.test(m || "")) return "—";
  const [y, mm] = m.split("-").map(Number);
  return `${nomi[mm - 1]} ${y}`;
}
