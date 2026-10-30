// COME SI LEGGE UN CONTATTO DI VETTA (30/10/2026).
//
// Le funzioni pure dell'import: niente rete, niente database, cosi' le
// prove in `prove/vetta-normalizza.test.js` le toccano con i casi veri
// trovati nel CRM («Naples», «Turin», «italia», «Rometta» che esiste in
// due province, «Centro estetico e solarium» al posto di un nome).
//
// Lo script `importa-vetta.mjs` le usa su tutti i 23.844 record.

import { PROVINCE, REGIONI, cercaComuni, regioneDiProvincia } from "../src/comuni-regioni.js";

const senzaAccenti = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const chiave = (s) => senzaAccenti(s).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const compatta = (s) => chiave(s).replace(/ /g, "");

// --- provincia e regione come le scrive Vetta ("REGGIO_CALABRIA") -----

const ALIAS_PROVINCE = {
  REGGIOEMILIA: "RE", MONZABRIANZA: "MB", MONZAEBRIANZA: "MB", PESAROURBINO: "PU", PESAROEURBINO: "PU",
  BOLZANO: "BZ", AOSTA: "AO", VALLEDAOSTA: "AO", LAQUILA: "AQ", AQUILA: "AQ", FORLICESENA: "FC", FORLI: "FC",
  CARBONIAIGLESIAS: "SU", MEDIOCAMPIDANO: "SU", OGLIASTRA: "NU", OLBIATEMPIO: "SS", SUDSARDEGNA: "SU",
};
const PROVINCE_PER_CHIAVE = Object.create(null);
for (const r of PROVINCE) {
  const [sigla, nome] = r.split("|");
  PROVINCE_PER_CHIAVE[compatta(nome.split("/")[0])] = sigla;
  PROVINCE_PER_CHIAVE[sigla] = sigla;
}
Object.assign(PROVINCE_PER_CHIAVE, ALIAS_PROVINCE);

export function siglaProvincia(valore) {
  if (!valore) return "";
  return PROVINCE_PER_CHIAVE[compatta(valore)] || "";
}

export function nomeProvincia(sigla) {
  const r = PROVINCE.find((x) => x.split("|")[0] === sigla);
  return r ? r.split("|")[1].split("/")[0] : "";
}

const REGIONI_PER_CHIAVE = Object.create(null);
for (const nome of REGIONI) REGIONI_PER_CHIAVE[compatta(nome.split("/")[0])] = nome;
REGIONI_PER_CHIAVE.TRENTINOALTOADIGE = REGIONI.find((r) => r.startsWith("Trentino"));
REGIONI_PER_CHIAVE.TRENTINO = REGIONI_PER_CHIAVE.TRENTINOALTOADIGE;
REGIONI_PER_CHIAVE.VALLEDAOSTA = REGIONI.find((r) => r.startsWith("Valle"));
REGIONI_PER_CHIAVE.EMILIA = REGIONI_PER_CHIAVE.EMILIAROMAGNA;
REGIONI_PER_CHIAVE.FRIULI = REGIONI_PER_CHIAVE.FRIULIVENEZIAGIULIA;

export function nomeRegione(valore) {
  if (!valore) return "";
  return REGIONI_PER_CHIAVE[compatta(valore)] || "";
}

// --- la citta', scritta come la scrive chi compila ---------------------

// I nomi in inglese (o in dialetto) con cui arrivano le citta' grandi.
const ESONIMI = {
  NAPLES: "Napoli", TURIN: "Torino", MILAN: "Milano", ROME: "Roma", FLORENCE: "Firenze", VENICE: "Venezia",
  GENOA: "Genova", PADUA: "Padova", SYRACUSE: "Siracusa", LEGHORN: "Livorno", MANTUA: "Mantova",
  BOLOGNE: "Bologna", PALERME: "Palermo", NAPOLES: "Napoli", TURIM: "Torino", MILAO: "Milano", "ROMA CAPITALE": "Roma",
  "REGGIO CALABRIA": "Reggio di Calabria", "REGGIO EMILIA": "Reggio nell'Emilia",
};
// cose che non sono una citta' e si scrivono spesso al suo posto
const NON_CITTA = new Set(["ITALIA", "ITALY", "IT", "ESTERO", "NESSUNA", "NO", "NA", "N A", "NULL", "X", "XX", "XXX", "TEST", "PROVA"]);

function paroleUtili(s) {
  const PAROLINE = new Set(["DI", "DA", "DE", "DEL", "DELLA", "DEI", "D", "IN", "SU", "SUL", "SULLA", "A", "AL", "E", "NEL", "NELL", "SAN", "SANTA", "SANT", "SANTO"]);
  return chiave(s).split(" ").filter((p) => p && !PAROLINE.has(p)).sort().join(" ");
}

// Riconosce il comune dal testo libero. Torna { comune, provincia, regione,
// dubbio, nota }: comune vuoto e dubbio vero quando il testo non si
// riconosce o si riconosce in due posti diversi.
export function riconosciComune(cittaTesto, provinciaSuggerita = "") {
  let testo = (cittaTesto || "").toString().trim();
  if (!testo) return { comune: "", provincia: "", regione: "", dubbio: false, nota: "" };
  // «Camaiore (LU)», «Ravarino (MO)»: la provincia sta fra parentesi
  let suggerita = siglaProvincia(provinciaSuggerita);
  const tonda = testo.match(/\(([^)]+)\)/);
  if (tonda) {
    const dentro = siglaProvincia(tonda[1]);
    if (dentro) suggerita = dentro;
    testo = testo.replace(/\([^)]*\)/g, " ").trim();
  }
  // «Bellaria, RN, Italia»: conta il primo pezzo
  if (testo.includes(",")) testo = testo.split(",")[0].trim();
  // «Napoli - NA», «Roma (RM)» gia' tolto, «Roma RM»
  testo = testo.replace(/\s[-–]\s?[A-Z]{2}$/i, "").replace(/\s+[A-Z]{2}$/, (m) => (siglaProvincia(m.trim()) ? "" : m)).trim();
  const k = chiave(testo);
  if (!k || NON_CITTA.has(k)) return { comune: "", provincia: "", regione: "", dubbio: true, nota: `città non riconoscibile: «${cittaTesto}»` };
  const cercato = ESONIMI[k] || testo;
  const trovati = cercaComuni(cercato, 30);
  const esatti = trovati.filter((t) => chiave(t.nome) === chiave(cercato));
  let candidati = esatti;
  if (!candidati.length) {
    // «Reggio Emilia» per «Reggio nell'Emilia»: stesse parole, tolte le paroline
    candidati = trovati.filter((t) => paroleUtili(t.nome) === paroleUtili(cercato));
  }
  if (!candidati.length) return { comune: "", provincia: "", regione: "", dubbio: true, nota: `città non riconosciuta: «${cittaTesto}»` };
  if (candidati.length > 1) {
    const conProvincia = candidati.filter((c) => c.sigla === suggerita);
    if (conProvincia.length === 1) candidati = conProvincia;
    else return { comune: "", provincia: "", regione: "", dubbio: true, nota: `«${cittaTesto}» esiste in più province (${[...new Set(candidati.map((c) => c.sigla))].join(", ")})` };
  }
  const [c] = candidati;
  let nota = "";
  if (suggerita && suggerita !== c.sigla) nota = `provincia scritta ${suggerita}, ma ${c.nome} è in provincia di ${c.sigla}`;
  return { comune: c.nome, provincia: c.sigla, regione: regioneDiProvincia(c.sigla), dubbio: false, nota };
}

// Il luogo di una richiesta: il comune dal testo se c'e', altrimenti
// provincia e regione come le aveva scelte Vetta.
export function luogoRichiesta({ city, provincia, regione }) {
  const sigla = siglaProvincia(provincia);
  const reg = nomeRegione(regione);
  const dalTesto = riconosciComune(city, provincia);
  if (dalTesto.comune) return { ...dalTesto, fonte: "da_citta" };
  if (sigla) {
    const nota = [dalTesto.nota, reg && regioneDiProvincia(sigla) !== reg ? `regione scritta ${regione}, ma ${sigla} è in ${regioneDiProvincia(sigla)}` : ""].filter(Boolean).join("; ");
    return { comune: "", provincia: sigla, regione: regioneDiProvincia(sigla), dubbio: dalTesto.dubbio, nota, fonte: "vetta" };
  }
  if (reg) return { comune: "", provincia: "", regione: reg, dubbio: dalTesto.dubbio, nota: dalTesto.nota, fonte: "vetta" };
  if (provincia || regione) return { comune: "", provincia: "", regione: "", dubbio: true, nota: [dalTesto.nota, `provincia/regione Vetta non riconosciute: ${provincia || ""} ${regione || ""}`.trim()].filter(Boolean).join("; "), fonte: null };
  return { ...dalTesto, fonte: null };
}

// --- il nome ------------------------------------------------------------

const SEMBRA_ATTIVITA = /\b(centro|estetic|beauty|salon|saloon|studio|bar|nails?|lashes|academy|srl|snc|sas|parrucch|hair|spa|shop|store|istituto|wellness|benessere|acconciat|solarium|clinic|laser|tattoo|ink)\b|&|@|\bwww\b|\.(it|com)\b/i;

function pulisciNome(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

// Torna { nome, cognome, originale, motivo }: `motivo` pieno vuol dire
// «da verificare». Un nome solo non e' un errore ma non basta a
// cercarlo nello Storico, e lo si dice.
export function separaNome(firstName, lastName) {
  const f = pulisciNome(firstName); const l = pulisciNome(lastName);
  const originale = [f, l].filter(Boolean).join(" ");
  if (!originale) return { nome: "", cognome: "", originale: "", motivo: "nome vuoto" };
  if (SEMBRA_ATTIVITA.test(originale)) return { nome: f, cognome: l, originale, motivo: "sembra il nome di un'attività" };
  if (/^[^a-zA-ZÀ-ÿ]+$/.test(originale)) return { nome: f, cognome: l, originale, motivo: "nome senza lettere" };
  if (l) return { nome: f, cognome: l, originale, motivo: "" };
  const parole = f.split(" ");
  if (parole.length === 1) return { nome: f, cognome: "", originale, motivo: "solo il nome, senza cognome" };
  return { nome: parole[0], cognome: parole.slice(1).join(" "), originale, motivo: "" };
}

// --- email e telefono ---------------------------------------------------

export function emailPulita(s) {
  const e = (s || "").toString().trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

// solo cifre, col prefisso internazionale davanti (39 se italiano)
export function telefonoPulito(numero, prefisso = "+39") {
  let n = (numero || "").toString().replace(/[^\d+]/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (n.startsWith("+")) return n.replace(/\D/g, "");
  const p = (prefisso || "+39").replace(/\D/g, "") || "39";
  if (n.startsWith(p) && n.length > 11) return n;
  return p + n.replace(/^0(?=3)/, "");
}

// --- mestiere e corsi ---------------------------------------------------

const MESTIERI = {
  ESTETISTA: "estetista", TATUATORE: "tatuatore", LASH_MAKER: "lash maker", MAKE_UP_ARTIST: "make-up artist",
  PARRUCCHIERA: "parrucchiera", PARRUCCHIERE: "parrucchiera", ONICOTECNICA: "onicotecnica", MASSAGGIATORE: "massaggiatore",
  ALTRO_SETTORE: "altro", ALTRO: "altro", TEST_OPTION: "",
};
export function mestiereDa(codice) {
  if (!codice) return "";
  if (MESTIERI[codice] !== undefined) return MESTIERI[codice];
  const t = chiave(codice);
  for (const [k, v] of Object.entries(MESTIERI)) if (chiave(k) === t || (v && chiave(v) === t)) return v;
  return codice.toString().toLowerCase().replace(/_/g, " ");
}

// Le etichette con cui si filtra: una per specialita', qualunque nome
// avesse il corso in Vetta o nel calendario di Genion.
export const CORSI_CANONICI = ["PMU", "Microblading", "Microneedling", "Laminazione", "Extension ciglia", "Tricopigmentazione", "Colori e correzioni", "Areola", "Hennè", "Gemme dentali", "Evolution strokes", "Altro"];

const REGOLE_CORSO = [
  [/MICROBLAD|MICROSHAD|\bMICRO\b/, "Microblading"],
  [/NEEDLING/, "Microneedling"],
  [/LAMINAZ|\bIKE\b|LAMIN\b/, "Laminazione"],
  [/EXTENS?/, "Extension ciglia"],
  [/TRICO/, "Tricopigmentazione"],
  [/COLORI/, "Colori e correzioni"],
  [/AREOLA/, "Areola"],
  [/HENN|BIO ?TATTOO/, "Hennè"],
  [/GEMME/, "Gemme dentali"],
  [/EVOLUTION|AIR ?STROKE/, "Evolution strokes"],
  [/\bPMU\b|TRUCCO PERMANENTE|DERMOPIGMENT|DERMOGRAF|NUDE LINER|SEXYLINE|VELVET/, "PMU"],
];

export function corsoCanonico(testo) {
  const t = chiave(testo);
  if (!t) return "";
  for (const [re, nome] of REGOLE_CORSO) if (re.test(t)) return nome;
  if (/^ALTRO$/.test(t)) return "Altro";
  return "";
}

export function corsiCanonici(lista) {
  const out = [];
  for (const x of lista || []) {
    const c = corsoCanonico(x);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

// --- dati_aggiuntivi: il testo dei vecchi form -----------------------------
//
// «<br><b>Settore: </b>Estetista<br><b>Corso scelto: </b>Corso Microblading
// Base, Corso trucco permanente<br><b>Preferenza giorno: </b>Lunedì…»
export function leggiDatiAggiuntivi(html) {
  const out = { form: "", settore: "", corsi: [], giorno: "", ora: "" };
  const t = (html || "").toString();
  if (!t) return out;
  const prendi = (etichetta) => {
    const m = t.match(new RegExp(`<b>\\s*${etichetta}\\s*:?\\s*</b>\\s*([^<]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  out.form = prendi("Form di origine");
  out.settore = prendi("Settore");
  out.giorno = prendi("Preferenza giorno");
  out.ora = prendi("Preferenza ora");
  const corsoScelto = prendi("Corso scelto");
  const fonti = [corsoScelto, out.form];
  // senza HTML e' il nome del form o della campagna («Corso PMU + Micro», «Retargeting»)
  if (!/<b>/i.test(t)) { out.form = t.trim(); fonti.push(t); }
  for (const f of fonti) for (const pezzo of f.split(/[,+\/]|\be\b/i)) { const c = corsoCanonico(pezzo); if (c && !out.corsi.includes(c)) out.corsi.push(c); }
  return out;
}

// --- chi l'ha trattato, da un'email del vecchio CRM ---------------------

const AGENTI_STORICI = {
  "gabrieleelitedermaacademy@gmail.com": "Gabriele", "raffaele.elitederma@gmail.com": "Raffaele", "manuelamauro5@gmail.com": "Manuela Mauro",
  "michele.villano01@gmail.com": "Michele Villano", "katiadepropris68@gmail.com": "Katia", "olga.elitederma@gmail.com": "Olga",
  "eleonora.elitederma@gmail.com": "Simona Fiorenza", "andrea.elitederma@gmail.com": "Andrea Paura", "roberta.elitederma@gmail.com": "Roberta",
  "arianna.elitederma@gmail.com": "Arianna", "alessia.elitedermaacademy@gmail.com": "Alessia", "vittoria.elitederma@gmail.com": "Vittoria",
  "mario.elitederma@gmail.com": "Mario", "marialaura.elitederma@gmail.com": "Maria Laura",
};
export function nomeAgenteDaEmail(email) {
  const e = (email || "").toString().trim().toLowerCase();
  if (!e) return "";
  if (AGENTI_STORICI[e]) return AGENTI_STORICI[e];
  const locale = e.split("@")[0].replace(/[._\d]+/g, " ").replace(/elitederma(academy)?/g, "").trim();
  return locale ? locale.split(" ").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") : e;
}
