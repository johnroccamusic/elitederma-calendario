// CHI E' IN ARCHIVIO, E COSA VUOL DIRE (28/11/2026).
//
// Il titolare: «possiamo mettere vicino alla lista dove sono le password
// di ogni utente il tasto archivia, che le mette in una lista di
// archiviati senza cancellarne i dati e almeno pulisco le liste?».
//
// Le liste sono quattro — Gestione utenti, Password Master, Password
// venditori, Password assistenti — e di qui passano tutte e quattro, piu'
// il cancello che legge la password e ogni tendina in cui si scegli una
// persona. Quattro idee di «archiviato» vorrebbero dire una lista pulita
// e una porta aperta, e nessuno saprebbe quale delle due crede al vero.
//
// Archiviare NON cancella niente: la riga resta dov'e' con tutti i suoi
// dati, e con lei le iscrizioni che ha chiuso, le classi che ha tenuto, i
// suoi punti e le sue provvigioni. Cambia una cosa sola: non compare piu'
// dove si scegli, e la sua password non apre l'app.

export function eArchiviata(riga) {
  return !!riga?.archiviato_il;
}

// Le righe in servizio: e' l'elenco che si mostra nelle quattro liste.
export function inServizio(lista) {
  return (lista || []).filter((r) => !eArchiviata(r));
}

// Quelle messe da parte, le piu' recenti per prime: e' la «lista di
// archiviati» da cui si ripristina.
export function inArchivio(lista) {
  return (lista || [])
    .filter(eArchiviata)
    .sort((a, b) => String(b.archiviato_il || "").localeCompare(String(a.archiviato_il || "")));
}

// L'ELENCO PER UNA TENDINA IN CUI SI SCEGLIE, e qui sta la sola
// accortezza che conta: un archiviato non si puo' piu' scegliere, ma
// quello GIA' scritto su quella riga resta in elenco. Una tendina che
// non contiene il valore che sta mostrando lo cancella al primo tocco —
// e' la lezione del 14/11/2026 sui kit spenti, dove il pacchetto gia'
// scelto resta con «non piu' in vendita» accanto.
//
// `giaScelto` e' l'id (o il nome, per la tendina del tutor) che quella
// riga porta adesso.
export function daScegliere(lista, giaScelto = null) {
  const scelto = giaScelto == null ? "" : String(giaScelto).trim().toUpperCase();
  return (lista || []).filter((r) => {
    if (!eArchiviata(r)) return true;
    if (!scelto) return false;
    return String(r.id || "").toUpperCase() === scelto || String(r.nome || "").trim().toUpperCase() === scelto;
  });
}

// L'etichetta da mettere accanto al nome in una tendina: «(archiviata)»
// solo su chi lo e', cioe' solo sul valore rimasto in elenco perche' era
// gia' scritto. Senza, si leggerebbe un nome qualunque e non si capirebbe
// perche' non si possa piu' scegliere.
export function etichettaArchivio(riga, femminile = false) {
  return eArchiviata(riga) ? (femminile ? " (archiviata)" : " (archiviato)") : "";
}

// Cosa si scrive archiviando e ripristinando. In un posto solo perche'
// sono quattro tabelle: quattro `update` scritti a mano vorrebbero dire
// che un giorno uno di loro si dimentica il nome di chi ha premuto, e
// togliere un accesso senza lasciare un nome e' esattamente il difetto
// che «Liquida» aveva fino a stamattina.
export function campiArchiviazione(chi, motivo) {
  return {
    archiviato_il: new Date().toISOString(),
    archiviato_da: String(chi || "").trim() || null,
    archiviato_motivo: String(motivo || "").trim() || null,
  };
}

export function campiRipristino() {
  return { archiviato_il: null, archiviato_da: null, archiviato_motivo: null };
}
