// COME SI CERCA UN NOME, in questo progetto.
//
// Ogni parola scritta dev'essere l'INIZIO di una parola del nome. Non
// «contenuta dentro»: e' la differenza fra una ricerca che risponde e una
// che sembra rotta.
//
// Lo ha fatto vedere il titolare il 24/11/2026, con una schermata:
// cercando «ma» fra i prodotti gli tornavano «Burro der(ma)tologico»,
// «Consenso infor(ma)to», «Gem(ma) swaroski» — tutti giusti per un
// `includes`, tutti sbagliati per chi sta cercando Matita, Mascara o
// Manipolo. Chi scrive «ma» intende l'inizio di una parola, sempre.
//
// E' la stessa regola che usano gia' `cercaComuni` (il comune di
// nascita), la simulazione dei prezzi al banco e le locandine dei corsi.
// Quelle tre non sono state riscritte: ognuna ha in piu' un ordinamento
// per pertinenza che qui non serve, e un refactor non chiesto su una
// ricerca che funziona e' un rischio senza un guadagno.
//
// Le parole si spezzano anche su trattini e punteggiatura, perche' i
// nomi dei prodotti ne sono pieni: «Gold Master - FineArt - 1RL 0.25
// LT-T - 20pz» deve farsi trovare scrivendo «fine», «lt» o «20pz».

/** Le parole di un testo, minuscole e senza punteggiatura. */
export function parole(testo) {
  return String(testo ?? "")
    .toLowerCase()
    .split(/[^a-z0-9àèéìòùç]+/i)
    .filter(Boolean);
}

/**
 * Il testo combacia con quello che si e' scritto?
 *
 * Vero quando OGNI parola cercata e' l'inizio di una parola del testo.
 * Con niente scritto e' sempre vero: una ricerca vuota non nasconde
 * niente.
 */
export function combaciaPerParole(testo, cercato) {
  const cercate = parole(cercato);
  if (!cercate.length) return true;
  const dentro = parole(testo);
  return cercate.every((q) => dentro.some((z) => z.startsWith(q)));
}
