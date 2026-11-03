// LE REGOLE DEI CLIENTI REGISTRATI, fuori dalla pagina perche' il banco
// di prova le possa guardare una per una.
//
// Due cose vivono qui e non nel componente: come si normalizza una
// persona (da cui dipende chi e' «già registrato») e come si riempiono
// provincia, CAP e regione partendo dalla citta' scritta.
import { capDiComune, regioneDiProvincia } from "../comuni-regioni.js";

// uno spazio di troppo o una maiuscola non fanno una persona diversa
export function testoPulito(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
export function emailPulita(s) {
  return testoPulito(s).toLowerCase();
}

// IL TELEFONO SI FORZA COL +39, come chiesto dal titolare. Si archivia
// sempre nella stessa forma, `+39` seguito dalle sole cifre: un numero
// scritto «347 123 4567», «+39 3471234567» o «0039 347-1234567» e' lo
// stesso numero, e se si archiviassero in tre modi diversi lo stesso
// cliente entrerebbe tre volte.
//
// Lo zero iniziale di un cellulare scritto «0347…» si toglie: in Italia
// i cellulari non ce l'hanno, e con quello davanti il numero non esiste.
export function telefonoIta(s) {
  let n = String(s || "").replace(/[^\d+]/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  n = n.replace(/\+/g, "");
  if (n.startsWith("39") && n.length > 10) n = n.slice(2);
  n = n.replace(/^0(?=3)/, "");
  return n ? `+39${n}` : "";
}
// le sole cifre, che e' quello su cui si confrontano due numeri
export function cifreTelefono(s) {
  return String(s || "").replace(/\D/g, "");
}

// CHI E' «GIA' REGISTRATO»: nome + cognome + email + telefono.
//
// Parole del titolare: in caso di omonimia la persona e' la stessa solo
// se corrisponde tutto, mail e telefono compresi; stesso nome ma
// contatti diversi e' un secondo cliente. La citta' non entra
// nell'identita': chi trasloca non diventa un'altra persona.
//
// Questa chiave e' la stessa dell'indice unico della tabella
// (20261103170000_registrazione_clienti.sql). Se cambia una, va cambiata
// l'altra, altrimenti la pagina e il database dicono due cose diverse.
export function chiaveIdentita(c) {
  return [
    testoPulito(c?.nome).toLowerCase(),
    testoPulito(c?.cognome).toLowerCase(),
    emailPulita(c?.email),
    // il telefono passa PRIMA dal +39 e poi si riduce a cifre. Senza,
    // «333 111 2223» battuto adesso e «+393331112223» in archivio
    // sembravano due persone, la pagina non vedeva il doppione e lo
    // fermava solo l'indice unico del database — con un messaggio
    // giusto per il motivo sbagliato. L'ha trovato il banco di prova.
    cifreTelefono(telefonoIta(c?.telefono)),
  ].join("|");
}

// Il cliente già in elenco che è la stessa persona, se c'è.
export function giaRegistrato(cliente, elenco = []) {
  const chiave = chiaveIdentita(cliente);
  return (elenco || []).find((x) => chiaveIdentita(x) === chiave) || null;
}

// IL LUOGO SI TIRA FUORI DALLA CITTA', con lo stesso elenco ISTAT che
// l'app si porta già dietro (comuni-regioni.js, nessuna rete): scelto il
// comune dal suggerimento si sanno provincia, regione e CAP.
//
// Quasi tutti i comuni hanno un CAP solo e si scrive da sé; Roma ne ha
// 82 e Milano una ventina, e quelli restano da scegliere — si torna
// l'elenco, e la pagina lo mostra.
export function luogoDaComune(scelto) {
  const nome = testoPulito(scelto?.nome);
  const sigla = testoPulito(scelto?.sigla).toUpperCase();
  const caps = sigla && nome ? capDiComune(sigla, nome) : [];
  return {
    citta: nome,
    provincia: sigla,
    regione: regioneDiProvincia(sigla) || "",
    cap: caps.length === 1 ? caps[0] : "",
    capPossibili: caps,
  };
}

// COSA MANCA PER SALVARE, detto in italiano e tutto insieme: un campo
// alla volta vuol dire premere Salva cinque volte per scoprire cinque
// cose. Email e telefono sono obbligatori perche' sono loro a distinguere
// due omonimi: senza, due persone diverse con lo stesso nome sarebbero
// indistinguibili e la seconda verrebbe respinta come doppione.
export function problemiCliente(c) {
  const problemi = [];
  if (!testoPulito(c?.nome)) problemi.push("il nome");
  if (!testoPulito(c?.cognome)) problemi.push("il cognome");
  if (!testoPulito(c?.citta)) problemi.push("la città");
  const email = emailPulita(c?.email);
  if (!email) problemi.push("l'email");
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) problemi.push("un'email scritta per intero");
  const cifre = cifreTelefono(telefonoIta(c?.telefono));
  // +39 piu' almeno nove cifre: un fisso corto ne ha nove, un cellulare
  // dodici col prefisso
  if (cifre.length < 11) problemi.push("il numero di telefono");
  return problemi;
}

// La riga pronta per il database: normalizzata, cosi' in archivio non
// finiscono due modi di scrivere la stessa cosa.
export function clienteDaSalvare(c, chi = "") {
  return {
    nome: testoPulito(c?.nome).toUpperCase(),
    cognome: testoPulito(c?.cognome).toUpperCase(),
    citta: testoPulito(c?.citta).toUpperCase() || null,
    provincia: testoPulito(c?.provincia).toUpperCase() || null,
    cap: String(c?.cap || "").replace(/\D/g, "").slice(0, 5) || null,
    regione: testoPulito(c?.regione) || null,
    email: emailPulita(c?.email) || null,
    telefono: telefonoIta(c?.telefono) || null,
    note: testoPulito(c?.note) || null,
    registrato_da: testoPulito(chi) || null,
  };
}
