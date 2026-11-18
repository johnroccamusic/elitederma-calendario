// LE REGOLE DI QUALIFICA del programma rivenditori. 18/11/2026.
//
// Qui non si calcola nessun prezzo, ed è voluto: lo sconto cedibile e i
// prezzi per livello li fa il database (`listino_cedibile`,
// `listino_prezzo_livello`, vista `v_listino_rivenditori`), perché
// l'export per i rivenditori non deve mai ricevere i costi dal server —
// se il prezzo lo calcolasse il browser, il costo dovrebbe uscire per
// forza. Due conti sullo stesso prezzo sono il difetto che questo
// progetto ha già pagato due volte (il POS del 7/11, la cache del 2/11).
//
// Quello che sta qui sono le REGOLE: il ciclo, le verifiche, la revisione
// annuale, il rientro e le fasce di riassortimento. Non toccano prezzi,
// non toccano il database, e si provano una per una.
//
// Le soglie arrivano SEMPRE da `rivenditori_livelli` (tabella di
// configurazione, modificabile dall'admin): nessun numero del programma è
// scritto in questo file. Un 500 battuto qui dentro sarebbe una soglia
// che non si può cambiare senza pubblicare.

export const TETTO_SCONTO_DEFAULT = 50;

// I livelli in ordine dal più basso al più alto, solo quelli accesi. Un
// livello spento resta in archivio ma non partecipa a niente: serve a
// smettere di offrirlo senza perdere chi ce l'ha.
export function livelliAttivi(livelli) {
  return (livelli || []).filter((l) => l.attivo !== false).sort((a, b) => a.ordine - b.ordine);
}

// Lo sconto NOMINALE di un livello: la fetta di tetto che si prende.
// Non è scritto in tabella apposta — vedi il commento della migrazione:
// scritto accanto alla frazione, un giorno i due numeri si
// contraddirebbero e le intestazioni del listino prometterebbero un
// cinquanta per cento che non c'è più.
export function nominalePct(livello, tettoPct = TETTO_SCONTO_DEFAULT) {
  if (!livello) return null;
  return Math.round(Number(livello.frazione) * Number(tettoPct) * 10) / 10;
}

// ---------- il ciclo ----------
//
// Dodici mesi dalla data d'ingresso della singola persona, non l'anno
// solare: due rivenditori entrati a marzo e a ottobre hanno due cicli
// diversi, e misurarli sullo stesso anno vorrebbe dire declassare chi è
// entrato a novembre perché a dicembre non ha comprato quanto gli altri.
export function fineCiclo(inizio) {
  if (!inizio) return null;
  const d = new Date(`${String(inizio).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const giorno = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 12);
  // il 31 agosto + 12 mesi resta il 31 agosto; ma il 29 febbraio di un
  // anno bisestile, su un anno normale, in JavaScript diventa il 1° marzo
  // — e un ciclo che finisce un giorno dopo quello che dice il
  // regolamento è un giorno in cui qualcuno può comprare per salvarsi
  if (d.getUTCDate() !== giorno) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function giorniAllaFine(inizio, oggi) {
  const fine = fineCiclo(inizio);
  if (!fine || !oggi) return null;
  const a = new Date(`${fine}T00:00:00Z`).getTime();
  const b = new Date(`${String(oggi).slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

// Gli acquisti validi del ciclo. Un reso è una riga NEGATIVA e quindi
// entra nella somma abbassandola: «resi e note di credito riducono il
// volume» (punto 1 della specifica).
export function volumeDelCiclo(ordini, inizio, fine = null) {
  if (!inizio) return 0;
  const al = fine || fineCiclo(inizio);
  const dentro = (ordini || []).filter((o) => {
    const d = String(o.data || "").slice(0, 10);
    return d >= String(inizio).slice(0, 10) && d <= al;
  });
  return Math.round(dentro.reduce((s, o) => s + (Number(o.importo_netto) || 0), 0) * 100) / 100;
}

// ---------- le verifiche trimestrali ----------
//
// SOLO INFORMATIVE: dicono quanto manca, non declassano nessuno. Il
// livello cambia alla revisione annuale e basta (punto 4 della
// specifica), e una verifica che declassasse a metà ciclo
// toglierebbe lo sconto a chi ha ancora nove mesi per arrivarci.
export const QUOTE_TRIMESTRALI = [0.25, 0.5, 0.75, 1];

export function tappeTrimestrali(livello, volume, inizio, oggi) {
  if (!livello || !inizio) return [];
  const soglia = Number(livello.mantenimento_eur) || 0;
  const fatto = Number(volume) || 0;
  return QUOTE_TRIMESTRALI.map((quota, i) => {
    const mesi = (i + 1) * 3;
    const d = new Date(`${String(inizio).slice(0, 10)}T00:00:00Z`);
    const giorno = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + mesi);
    if (d.getUTCDate() !== giorno) d.setUTCDate(0);
    const scadenza = d.toISOString().slice(0, 10);
    const obiettivo = Math.round(soglia * quota * 100) / 100;
    return {
      mese: mesi,
      quota,
      scadenza,
      obiettivo,
      fatto,
      mancano: Math.max(0, Math.round((obiettivo - fatto) * 100) / 100),
      raggiunta: fatto >= obiettivo,
      passata: oggi ? String(oggi).slice(0, 10) >= scadenza : false,
    };
  });
}

// ---------- la revisione annuale ----------
//
// Le fasce della specifica (>= 7.500 Distributor, 5.000-7.499,99 Premium,
// …) NON sono scritte qui: sono esattamente le soglie di mantenimento dei
// livelli, quindi si legge il livello più alto il cui mantenimento ci sta
// dentro. Riscriverle sarebbe la stessa tabella in due posti, e il giorno
// che l'admin alza una soglia la revisione continuerebbe a usare quella
// vecchia senza dirlo a nessuno.
export function livelloPerVolume(volume, livelli) {
  const v = Number(volume) || 0;
  const candidati = livelliAttivi(livelli).filter((l) => v >= Number(l.mantenimento_eur));
  return candidati.length ? candidati[candidati.length - 1] : null;
}

// L'esito della revisione: che livello spetta, e se è una conferma, una
// salita o una discesa. Nessun effetto retroattivo: vale dal ciclo nuovo.
export function revisioneAnnuale(volume, livelloAttuale, livelli) {
  const spettante = livelloPerVolume(volume, livelli);
  const ordineOra = livelloAttuale ? Number(livelloAttuale.ordine) : 0;
  const ordineDopo = spettante ? Number(spettante.ordine) : 0;
  return {
    volume: Math.round((Number(volume) || 0) * 100) / 100,
    livello: spettante,
    esito: ordineDopo === ordineOra ? "confermato" : ordineDopo > ordineOra ? "salito" : "sceso",
    perso: ordineDopo < ordineOra ? livelloAttuale : null,
  };
}

// ---------- la regola di rientro ----------
//
// Chi è sceso può rientrare nel livello perso con un ordine pari a
// quanto gli mancava alla soglia annua, con un minimo (l'ordine
// d'ingresso di quel livello) e un massimo (il suo doppio).
// Esempio della specifica: Distributor chiude a 5.500 -> mancano 2.000 ->
// minimo 3.000 -> rientra con 3.000.
export function rientro(livelloPerso, volumeChiuso, _livelli) {
  if (!livelloPerso) return null;
  const soglia = Number(livelloPerso.mantenimento_eur) || 0;
  const ingresso = Number(livelloPerso.ingresso_eur) || 0;
  const mancavano = Math.max(0, Math.round((soglia - (Number(volumeChiuso) || 0)) * 100) / 100);
  const minimo = ingresso;
  const massimo = ingresso * 2;
  return {
    mancavano,
    minimo,
    massimo,
    // l'ordine di rientro: quanto mancava, ma mai meno del minimo e mai
    // più del massimo
    ordine: Math.min(massimo, Math.max(minimo, mancavano)),
  };
}

// ---------- le fasce di riassortimento ----------
//
// Ogni ordine si valuta da solo. Si applica il livello più alto
// compatibile col valore dell'ordine, senza superare quello che il
// rivenditore possiede.
//
// La tabella a sei righe della specifica non esiste come tabella: è
// `riassortimento_minimo_eur` dei cinque livelli. Un ordine da 450 €
// prende il tetto del livello più alto il cui minimo ci sta dentro —
// Premium, 400 — e la riga «400-499,99» della specifica dice infatti
// 10/20/30/40/40. Tutte e sei le fasce tornano da quei cinque numeri.
export function livelloPerImporto(importo, livelli) {
  const v = Number(importo) || 0;
  const candidati = livelliAttivi(livelli).filter((l) => v >= Number(l.riassortimento_minimo_eur));
  return candidati.length ? candidati[candidati.length - 1] : null;
}

export function fasciaRiassortimento(importo, livelloPosseduto, livelli, tettoPct = TETTO_SCONTO_DEFAULT) {
  const perImporto = livelloPerImporto(importo, livelli);
  if (!perImporto || !livelloPosseduto) {
    return { livello: null, scontoPct: 0, motivo: !livelloPosseduto ? "senza_qualifica" : "sotto_il_minimo" };
  }
  // il più basso fra quello che l'ordine merita e quello che la persona ha
  const applicato = Number(perImporto.ordine) <= Number(livelloPosseduto.ordine) ? perImporto : livelloPosseduto;
  return {
    livello: applicato,
    scontoPct: nominalePct(applicato, tettoPct),
    motivo: Number(perImporto.ordine) < Number(livelloPosseduto.ordine) ? "ordine_piccolo" : "pieno",
  };
}

// ---------- l'avviso del preventivo ----------
//
// «Mancano € X per la fascia superiore». Si guarda il totale del carrello
// AI PREZZI DEL LIVELLO CANDIDATO, come dice la specifica: la soglia si
// supera con quello che si pagherebbe di là, non con il totale di qua.
//
// `righe` sono [{ prezzi: {codice: prezzo}, quantita }], e i prezzi
// arrivano dalla vista: qui non si moltiplica nessuno sconto, si somma.
export function totaleAiPrezziDi(righe, livello) {
  if (!livello) return null;
  let totale = 0;
  for (const r of righe || []) {
    const p = Number(r?.prezzi?.[livello.codice]);
    if (!Number.isFinite(p)) return null;
    totale += p * (Number(r.quantita) || 0);
  }
  return Math.round(totale * 100) / 100;
}

export function avvisoFasciaSuperiore(righe, livelloPosseduto, livelli, tettoPct = TETTO_SCONTO_DEFAULT) {
  const attivi = livelliAttivi(livelli);
  if (!livelloPosseduto || !attivi.length) return null;
  // i candidati sono i livelli fino a quello posseduto, dal più alto
  const candidati = attivi.filter((l) => Number(l.ordine) <= Number(livelloPosseduto.ordine)).reverse();
  let applicato = null;
  let totaleApplicato = null;
  for (const c of candidati) {
    const t = totaleAiPrezziDi(righe, c);
    if (t == null) return null;
    if (t >= Number(c.riassortimento_minimo_eur)) { applicato = c; totaleApplicato = t; break; }
  }
  if (!applicato) {
    const piuBasso = candidati[candidati.length - 1];
    const t = totaleAiPrezziDi(righe, piuBasso);
    return {
      livello: null, scontoPct: 0, totale: t,
      superiore: piuBasso,
      mancano: Math.round((Number(piuBasso.riassortimento_minimo_eur) - t) * 100) / 100,
      frase: `Mancano € ${euroIt(Number(piuBasso.riassortimento_minimo_eur) - t)} per la fascia ${piuBasso.nome}`,
    };
  }
  const superiore = candidati[candidati.indexOf(applicato) - 1] || null;
  if (!superiore) {
    return { livello: applicato, scontoPct: nominalePct(applicato, tettoPct), totale: totaleApplicato, superiore: null, mancano: null, frase: null };
  }
  const totaleSuperiore = totaleAiPrezziDi(righe, superiore);
  const mancano = Math.round((Number(superiore.riassortimento_minimo_eur) - totaleSuperiore) * 100) / 100;
  return {
    livello: applicato,
    scontoPct: nominalePct(applicato, tettoPct),
    totale: totaleApplicato,
    superiore,
    mancano,
    totaleSuperiore,
    // L'avviso si dà solo se passando di sopra il totale SCENDE: è il
    // senso della richiesta («se aggiungendo poca merce il carrello passa
    // al livello superiore e il totale scende»). Dirlo quando il totale
    // salirebbe sarebbe un consiglio a spendere di più per pagare di più.
    frase: totaleSuperiore < totaleApplicato
      ? `Mancano € ${euroIt(mancano)} per la fascia superiore (${superiore.nome})`
      : null,
  };
}

// una cifra come si scrive in italiano, per le frasi di questo file
export function euroIt(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- le master ----------
//
// 10% di base, 20% finché rispetta i criteri di promozione. I criteri
// (tag della pagina, due post al mese, prodotti usati in aula) non stanno
// in nessun dato che abbiamo, quindi la verifica è un gesto di chi
// amministra, a trimestre, con esito e note. Vale l'ULTIMA verifica
// scritta: un «non rispettato» di un anno fa non deve tenere giù una
// master che da allora è stata promossa.
export function scontoMaster(verifiche, basePct = 10, promoPct = 20) {
  const ordinate = (verifiche || [])
    .slice()
    .sort((a, b) => String(a.periodo_al).localeCompare(String(b.periodo_al)));
  const ultima = ordinate[ordinate.length - 1] || null;
  if (!ultima) return { pct: Number(basePct), motivo: "nessuna_verifica", ultima: null };
  return {
    pct: ultima.esito === "rispettato" ? Number(promoPct) : Number(basePct),
    motivo: ultima.esito,
    ultima,
  };
}
