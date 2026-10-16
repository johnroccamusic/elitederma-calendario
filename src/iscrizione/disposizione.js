// LA DISPOSIZIONE DEI DUE RIQUADRI ANAGRAFICI, IN UN POSTO SOLO.
//
// Questi campi si disegnano in due punti: nella scheda di iscrizione che
// compila il venditore, e nella pagina Impostazioni → Modulo di
// iscrizione, dove si decide quali di essi finiscono sul modulo che
// riceve l'allieva.
//
// Prima erano due elenchi scritti a mano, uno per parte, e si sono
// subito disallineati: la pagina di configurazione mostrava campi che la
// scheda non aveva piu'. Ora la disposizione sta qui e la leggono
// entrambe, cosi' un campo aggiunto qui compare da solo in tutti e due i
// posti — e nessuno dei due puo' restare indietro.
//
// Ogni voce porta anche il suo comportamento, perche' sia identico nei
// due posti:
//   maiuscolo     il testo si scrive tutto in maiuscolo
//   lunghezza     quanti caratteri al massimo (provincia 2, cap 5)
//   soloCifre     niente lettere (il cap)
//   salvaUscendo  uscendo dal campo la scheda si salva da sola
//   tipo          "testo" (predefinito), "telefono", "venditori", "scelta"
//
// ATTENZIONE a `salvaUscendo`. Non e' acceso su tutti: nome, cognome e i
// dati di fatturazione non lo hanno mai avuto nella scheda vera, e qui
// si e' lasciato com'era invece di "sistemarlo" di slancio. Toccarlo
// cambia quando la scheda scrive nel database, e va deciso a parte.

export const AREA_ALLIEVO = {
  titolo: "Dati dell'allievo",
  icona: "persona",
  righe: [
    // nome e cognome non vanno a capo: sono due meta' della stessa riga
    { aCapo: false, campi: [
      { chiave: "nome", etichetta: "Nome", larghezza: 1, maiuscolo: true },
      { chiave: "cognome", etichetta: "Cognome", larghezza: 1, maiuscolo: true },
    ] },
    // il codice fiscale sta coi dati di chi si iscrive, non col
    // documento: serve per la fattura e per il diploma, non solo a
    // identificarla. Prima stava fra "quello che compila l'allieva" e
    // nella scheda del venditore non c'era proprio.
    { campi: [
      { chiave: "codice_fiscale", etichetta: "Codice fiscale", larghezza: "0 1 240px", maiuscolo: true, lunghezza: 16, salvaUscendo: true },
    ] },
    { campi: [
      { chiave: "indirizzo_residenza", etichetta: "Via", larghezza: "3 1 200px", maiuscolo: true, salvaUscendo: true },
      { chiave: "civico_residenza", etichetta: "Civico", larghezza: "1 1 90px", maiuscolo: true, salvaUscendo: true },
      { chiave: "interno_residenza", etichetta: "Interno", larghezza: "1 1 90px", maiuscolo: true, salvaUscendo: true },
    ] },
    { campi: [
      { chiave: "cap_residenza", etichetta: "CAP", larghezza: "1 1 90px", salvaUscendo: true },
      { chiave: "citta_residenza", etichetta: "Città", larghezza: "2 1 150px", maiuscolo: true, salvaUscendo: true },
      { chiave: "prov_residenza", etichetta: "Provincia", larghezza: "0 1 90px", maiuscolo: true, lunghezza: 2, salvaUscendo: true },
      { chiave: "stato_residenza", etichetta: "Stato", larghezza: "1 1 120px", maiuscolo: true, suggerimento: "ITALIA", salvaUscendo: true },
    ] },
    { campi: [
      { chiave: "email", etichetta: "Email", larghezza: "2 1 200px", salvaUscendo: true },
      { chiave: "telefono", etichetta: "Cellulare (+39...)", larghezza: "1 1 150px", tipo: "telefono", suggerimento: "+39 333 1234567", salvaUscendo: true },
    ] },
    // la tendina del tutor e i due tasti Privato/Azienda sono alti
    // diversi: si allineano in basso, non in alto
    { inBasso: true, campi: [
      { chiave: "tutor", etichetta: "Tutor", larghezza: "2 1 140px", tipo: "venditori", maiuscolo: true },
      { chiave: "tipo_cliente", etichetta: "Intestazione", larghezza: "1 1 220px", tipo: "scelta",
        opzioni: [{ valore: "privato", etichetta: "Privato" }, { valore: "azienda", etichetta: "Azienda" }] },
    ] },
  ],
};

export const AREA_FATTURAZIONE = {
  titolo: "Dati di fatturazione",
  icona: "ricevuta",
  righe: [
    { aCapo: false, campi: [{ chiave: "fattura_ditta", etichetta: "Nome ditta", larghezza: "1 1 100%", maiuscolo: true }] },
    { aCapo: false, campi: [
      { chiave: "fattura_indirizzo", etichetta: "Indirizzo", larghezza: 3, maiuscolo: true },
      { chiave: "fattura_civico", etichetta: "N. civico", larghezza: 1, maiuscolo: true, lunghezza: 5 },
    ] },
    { aCapo: false, campi: [
      { chiave: "fattura_citta", etichetta: "Città", larghezza: 2, maiuscolo: true },
      { chiave: "fattura_prov", etichetta: "Prov.", larghezza: 1, maiuscolo: true, lunghezza: 2 },
      { chiave: "fattura_cap", etichetta: "Cap", larghezza: 1, lunghezza: 5 },
    ] },
    { aCapo: false, campi: [
      { chiave: "fattura_piva", etichetta: "P.IVA", larghezza: 1, maiuscolo: true },
      { chiave: "fattura_cod_dest", etichetta: "Cod. Dest.", larghezza: 1, maiuscolo: true },
      { chiave: "fattura_pec", etichetta: "PEC", larghezza: 1 },
    ] },
  ],
};

export const AREE_ANAGRAFICHE = [AREA_ALLIEVO, AREA_FATTURAZIONE];

// tutte le chiavi disegnate dalle due aree, nell'ordine in cui si vedono
export const CHIAVI_ANAGRAFICHE = AREE_ANAGRAFICHE
  .flatMap((a) => a.righe.flatMap((r) => r.campi.map((c) => c.chiave)));

// I RIQUADRI CHE L'ALLIEVA LEGGE E NON COMPILA.
//
// Stanno fuori dall'anagrafica: il corso, quanto costa, il pacchetto, le
// quote. Sul modulo di lei sono di sola lettura — li ha scritti il
// venditore e devono arrivare in fondo come sono partiti — quindi si
// disegnano come righe, non come caselle.
//
// Stavano dentro ModuloIscrizione.jsx. Sono usciti qui il 16/10/2026
// perche' li legge anche la pagina che apre l'allieva: due elenchi,
// un giorno, direbbero due cose diverse sullo stesso modulo.
export const GRUPPI_LETTURA = [
  { titolo: "Il corso", icona: "calendario", chiavi: ["corso_nome", "corso_data_inizio", "corso_data_fine", "corso_citta", "corso_indirizzo", "corso_master"] },
  { titolo: "Dati di vendita", icona: "ricevuta", chiavi: ["totale_pattuito", "quota_venditore", "quota_speciale"] },
  { titolo: "Pacchetto / Kit", icona: "scatola", chiavi: ["pacchetto_kit", "tipo_offerta", "dermografo"] },
  { titolo: "Presenza al corso", icona: "calendario", chiavi: ["giorni_presenza"] },
  { titolo: "Quota acconto", icona: "banconota", chiavi: ["acconto_imponibile", "acconto_totale", "acconto_pagato_il", "acconto_metodo", "acconto_pagato"] },
  { titolo: "Quota pre corso", icona: "clipboard", chiavi: ["precorso_imponibile", "precorso_totale", "precorso_pagato_il", "precorso_metodo", "precorso_pagato"] },
  { titolo: "Da avere al corso", icona: "portafoglio", chiavi: ["saldo_imponibile", "saldo_totale", "saldo_metodo"] },
  { titolo: "Pagherà in totale", icona: "portafoglio", chiavi: ["totale_senza_iva", "totale_con_interessi"] },
  { titolo: "Dati organizzativi", icona: "clipboard", chiavi: ["accordi_commerciali", "richiede_modelle", "numero_modelle", "prezzo_speciale_modelle", "taglia_divisa", "note"] },
];
