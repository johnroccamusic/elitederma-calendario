// L'INDIRIZZO EMAIL SI GUARDA PRIMA DI MANDARCI SOPRA UN CONTRATTO.
//
// Il 22/10/2026 un modulo di iscrizione e' partito verso
// «elitederma@europe.con» — `.con` invece di `.com`. Resend l'ha
// accettato (e' un indirizzo di forma valida), l'ha mandato, e mezzo
// secondo dopo e' tornato indietro. In archivio restava «Modulo
// inviato», verde, e chi aveva iscritto la persona ha aspettato un
// modulo che non poteva tornare.
//
// Il rimbalzo adesso si vede (vedi FasciaStato), ma vederlo dopo e'
// sempre un giro perso: una mail partita a nome dell'accademia, una
// persona che non riceve niente, e qualcuno che se ne accorge quando ci
// torna sopra. Un'ora prima, mentre la casella e' ancora aperta, costa
// una riga di avviso.
//
// COSA CONTROLLA, E COSA NO. Non si inventa un elenco dei domini che
// esistono: ce ne sono milioni, e una casella che segnala indirizzi veri
// smette di essere letta dopo due volte. Si guardano SOLO gli errori di
// battitura delle code e dei fornitori che compaiono davvero nel nostro
// archivio — `.con` per `.com`, `gmial` per `gmail` — dove la distanza
// fra lo scritto e il giusto e' un tasto.
//
// E' SEMPRE UN AVVISO, MAI UN BLOCCO. Un indirizzo strano puo' essere
// quello buono: ci sono domini aziendali che somigliano a un errore. Chi
// compila sa cosa ha davanti, questa riga serve solo a farglielo
// guardare una seconda volta.

// Le code sbagliate, e cosa volevano dire.
//
// QUI DENTRO CI STANNO SOLO CODE CHE NON ESISTONO. `.co` (Colombia, e la
// usano molte aziende), `.cm` (Camerun), `.ir`, `.lt` somigliano a
// errori di battitura e invece sono vere: segnalarle vorrebbe dire dare
// torto a un indirizzo buono, e una casella che sbaglia due volte non la
// legge piu' nessuno.
const CODE_SBAGLIATE = {
  con: "com", cmo: "com", ocm: "com", cim: "com", comm: "com",
  xom: "com", vom: "com", clm: "com",
  ti: "it", iy: "it",
  ner: "net", met: "net", nte: "net",
  prg: "org", ogr: "org", orh: "org",
};

// I fornitori di posta scritti storti. Solo quelli che nel nostro
// archivio ci sono davvero: gmail, hotmail, libero, yahoo, outlook,
// icloud, virgilio, alice, tiscali.
const FORNITORI_STORTI = {
  gmial: "gmail", gmai: "gmail", gmaill: "gmail", gmail: null, gmali: "gmail",
  gnail: "gmail", gmil: "gmail", gamil: "gmail",
  hotmial: "hotmail", hotmai: "hotmail", hotmal: "hotmail", hotamil: "hotmail",
  hotmail: null, hotnail: "hotmail",
  libeto: "libero", liebro: "libero", libro: "libero", libero: null,
  yaoo: "yahoo", yhaoo: "yahoo", yahooo: "yahoo", yahoo: null,
  outlok: "outlook", outloock: "outlook", outlook: null,
  iclod: "icloud", icluod: "icloud", icloud: null,
  virgilo: "virgilio", virgilio: null,
  tiscalli: "tiscali", tiscali: null,
};

/**
 * Torna la frase da mostrare sotto la casella, o "" se non c'e' niente
 * da dire. Non dice mai "sbagliato": dice cosa ha letto e cosa sembra.
 */
export function avvisoEmail(valore) {
  const scritto = String(valore ?? "").trim().toLowerCase();
  if (!scritto) return "";

  // una chiocciola sola, e qualcosa prima e dopo
  const pezzi = scritto.split("@");
  if (pezzi.length !== 2 || !pezzi[0] || !pezzi[1]) {
    return "Questo indirizzo non ha la forma di un'email: ci vuole una sola chiocciola, con qualcosa prima e dopo.";
  }
  const dominio = pezzi[1];
  if (!dominio.includes(".")) {
    return `«${dominio}» non ha nessun punto: dopo la chiocciola ci vuole un dominio con la sua coda, come «gmail.com».`;
  }
  if (dominio.startsWith(".") || dominio.endsWith(".") || dominio.includes("..")) {
    return `«${dominio}» ha i punti fuori posto: controllalo.`;
  }

  const parti = dominio.split(".");
  const coda = parti[parti.length - 1];
  const giusta = CODE_SBAGLIATE[coda];
  if (giusta) {
    return `«.${coda}» non esiste: volevi scrivere «.${giusta}»? La mail partirebbe e tornerebbe indietro.`;
  }

  // il nome del fornitore, cioe' il pezzo prima della coda
  const nome = parti.length >= 2 ? parti[parti.length - 2] : "";
  const fornitore = Object.prototype.hasOwnProperty.call(FORNITORI_STORTI, nome)
    ? FORNITORI_STORTI[nome] : undefined;
  if (fornitore) {
    return `«${nome}» sembra «${fornitore}» scritto storto: controlla l'indirizzo.`;
  }

  return "";
}
