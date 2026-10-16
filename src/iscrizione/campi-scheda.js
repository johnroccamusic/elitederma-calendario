// LO SPECCHIO DELLA NOSTRA SCHEDA DI ISCRIZIONE.
//
// Il modulo che va all'allieva non ricalca piu' quello vecchio del sito.
// Di quello restano soltanto le parti che non sappiamo noi e che lei
// deve leggere o fornire: il regolamento, l'informativa privacy, i
// consensi, i documenti d'identita' e la firma. Per tutto il resto —
// chi e', che corso ha preso, quanto paga — fa fede la scheda che il
// venditore ha gia' compilato in Genyon.
//
// Quindi questo elenco e' la scheda, sezione per sezione, con le
// etichette che il venditore vede lui: se in scheda c'e' scritto
// "Pacchetto/Kit", qui c'e' scritto "Pacchetto/Kit". Chi decide cosa
// mostrare all'allieva non deve tradurre niente.
//
// NON CI SONO GLI INGRANAGGI. La scheda salva 64 campi, ma meta' sono
// roba di servizio — i file dei bonifici, gli imponibili, i flag
// "segnalato" e "skip" — che su un foglio da far firmare non vogliono
// dire niente. Se un giorno ne servisse uno, si aggiunge qui.
//
// `fonte` dice da dove si prende il valore: "iscritti.x" dalla riga
// dell'allieva, "corsi_date.x" / "corsi.x" / "location.x" dalla classe.

export const SEZIONI_SCHEDA = [
  {
    chiave: "allieva",
    titolo: "Dati dell'allieva",
    nota: "Come sono scritti nella scheda, sezione Anagrafica.",
    campi: [
      { chiave: "nome", etichetta: "Nome", fonte: "iscritti.nome", predefinito: true },
      { chiave: "cognome", etichetta: "Cognome", fonte: "iscritti.cognome", predefinito: true },
      { chiave: "telefono", etichetta: "Numero di telefono", fonte: "iscritti.telefono", predefinito: true },
      { chiave: "email", etichetta: "Email", fonte: "iscritti.email", predefinito: true },
      { chiave: "indirizzo_residenza", etichetta: "Indirizzo di residenza", fonte: "iscritti.indirizzo_residenza", predefinito: true },
      { chiave: "cap_residenza", etichetta: "CAP", fonte: "iscritti.cap_residenza", predefinito: true },
      { chiave: "citta_residenza", etichetta: "Città di residenza", fonte: "iscritti.citta_residenza", predefinito: true },
      { chiave: "tutor", etichetta: "Tutor", fonte: "iscritti.tutor", predefinito: true },
    ],
  },
  {
    chiave: "corso",
    titolo: "Il corso",
    nota: "Presi dalla classe a cui l'allieva è iscritta, non riscritti a mano.",
    campi: [
      { chiave: "corso_nome", etichetta: "Corso", fonte: "corsi.nome", predefinito: true },
      { chiave: "corso_data_inizio", etichetta: "Data inizio", fonte: "corsi_date.data_inizio", predefinito: true },
      { chiave: "corso_data_fine", etichetta: "Data fine", fonte: "corsi_date.data_fine", predefinito: true },
      { chiave: "corso_citta", etichetta: "Località del corso", fonte: "corsi_date.citta", predefinito: true },
      { chiave: "corso_indirizzo", etichetta: "Indirizzo della sede", fonte: "corsi_date.indirizzo", predefinito: true },
      { chiave: "corso_master", etichetta: "Master", fonte: "master.nome", predefinito: false },
    ],
  },
  {
    chiave: "acquisto",
    titolo: "Che cosa ha preso",
    nota: "Sezione Contabili della scheda.",
    campi: [
      { chiave: "pacchetto_kit", etichetta: "Pacchetto/Kit", fonte: "iscritti.pacchetto_kit", predefinito: true },
      { chiave: "tipo_offerta", etichetta: "Tipo di offerta", fonte: "iscritti.tipo_offerta", predefinito: true },
      { chiave: "dermografo", etichetta: "Dermografo", fonte: "iscritti.dermografo", predefinito: true },
      { chiave: "taglia_divisa", etichetta: "Taglia divisa", fonte: "iscritti.taglia_divisa", predefinito: true },
      { chiave: "totale_pattuito", etichetta: "Totale pattuito", fonte: "iscritti.totale_pattuito", predefinito: true },
      { chiave: "accordi_commerciali", etichetta: "Accordi commerciali", fonte: "iscritti.accordi_commerciali", predefinito: false },
      { chiave: "note", etichetta: "Note", fonte: "iscritti.note", predefinito: false },
    ],
  },
  {
    chiave: "pagamenti",
    titolo: "Pagamenti",
    nota: "Gli importi come stanno in scheda: sul modulo si leggono, non si cambiano.",
    campi: [
      { chiave: "acconto_totale", etichetta: "Acconto", fonte: "iscritti.acconto_totale", predefinito: true },
      { chiave: "acconto_metodo", etichetta: "Come paga l'acconto", fonte: "iscritti.acconto_metodo", predefinito: true },
      { chiave: "acconto_pagato_il", etichetta: "Data di pagamento dell'acconto", fonte: "iscritti.acconto_pagato_il", predefinito: true },
      { chiave: "precorso_totale", etichetta: "Pre-corso", fonte: "iscritti.precorso_totale", predefinito: true },
      { chiave: "precorso_metodo", etichetta: "Come paga il pre-corso", fonte: "iscritti.precorso_metodo", predefinito: true },
      { chiave: "saldo_totale", etichetta: "Saldo", fonte: "iscritti.saldo_totale", predefinito: true },
      { chiave: "saldo_metodo", etichetta: "Come paga il saldo", fonte: "iscritti.saldo_metodo", predefinito: true },
    ],
  },
  {
    chiave: "fatturazione",
    titolo: "Fatturazione",
    nota: "Compaiono solo se in scheda è spuntato «Richiede fattura».",
    campi: [
      { chiave: "richiede_fattura", etichetta: "Richiede fattura", fonte: "iscritti.richiede_fattura", predefinito: true },
      { chiave: "fattura_ditta", etichetta: "Nome ditta", fonte: "iscritti.fattura_ditta", predefinito: true },
      { chiave: "fattura_indirizzo", etichetta: "Indirizzo", fonte: "iscritti.fattura_indirizzo", predefinito: true },
      { chiave: "fattura_civico", etichetta: "N. civico", fonte: "iscritti.fattura_civico", predefinito: true },
      { chiave: "fattura_citta", etichetta: "Città", fonte: "iscritti.fattura_citta", predefinito: true },
      { chiave: "fattura_prov", etichetta: "Prov.", fonte: "iscritti.fattura_prov", predefinito: true },
      { chiave: "fattura_cap", etichetta: "Cap", fonte: "iscritti.fattura_cap", predefinito: true },
      { chiave: "fattura_piva", etichetta: "P.IVA", fonte: "iscritti.fattura_piva", predefinito: true },
      { chiave: "fattura_cod_dest", etichetta: "Cod. Dest.", fonte: "iscritti.fattura_cod_dest", predefinito: true },
      { chiave: "fattura_pec", etichetta: "PEC", fonte: "iscritti.fattura_pec", predefinito: true },
    ],
  },
  {
    chiave: "modelle",
    titolo: "Modelle",
    nota: "Sezione Organizzativi della scheda.",
    campi: [
      { chiave: "richiede_modelle", etichetta: "Chiede le modelle all'accademia", fonte: "iscritti.richiede_modelle", predefinito: true },
      { chiave: "numero_modelle", etichetta: "Quante modelle", fonte: "iscritti.numero_modelle", predefinito: true },
      { chiave: "prezzo_speciale_modelle", etichetta: "Prezzo speciale", fonte: "iscritti.prezzo_speciale_modelle", predefinito: false },
    ],
  },
];

// Quello che l'allieva mette lei, e che noi non abbiamo: resta dal
// modulo vecchio del sito perche' e' li' che veniva chiesto.
export const CHIEDE_ALL_ALLIEVA = [
  { chiave: "doc_tipo", etichetta: "Tipo documento", nota: "Carta di identità, patente o passaporto" },
  { chiave: "doc_numero", etichetta: "Numero documento" },
  { chiave: "codice_fiscale", etichetta: "Codice Fiscale" },
  { chiave: "doc_fronte", etichetta: "Foto del documento — fronte" },
  { chiave: "doc_retro", etichetta: "Foto del documento — retro" },
];

export const TUTTI_I_CAMPI = SEZIONI_SCHEDA.flatMap((s) => s.campi);

export function etichettaFonte(fonte) {
  if (!fonte) return null;
  const [tabella] = String(fonte).split(".");
  if (tabella === "iscritti") return "dalla scheda dell'allieva";
  if (tabella === "corsi" || tabella === "corsi_date") return "dalla classe";
  if (tabella === "location") return "dalla sede";
  if (tabella === "master") return "dalla master";
  return fonte;
}
