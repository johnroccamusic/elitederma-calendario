// I CAMPI DEL MODULO DI ISCRIZIONE DEL VENDITORE.
//
// L'elenco serve solo a sapere quali chiavi esistono e come partono: il
// disegno — quali riquadri, quali righe, in che ordine — sta nel JSX di
// ModuloIscrizione.jsx, che ricalca il modulo vero riquadro per riquadro.
//
// `predefinito: false` vuol dire che parte spento perche' e' roba
// nostra, non sua: quanto prende il venditore, gli accordi commerciali,
// le note interne.
import { TIPI_DOCUMENTO } from "../tipi-documento.js";

// LE TAGLIE DELLA DIVISA. «NO DIVISA» non e' una taglia: e' chi la
// maglietta non la vuole, e si conta a parte.
export const TAGLIE = ["NO DIVISA", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export const CAMPI_MODULO = [
  // Dati dell'allievo
  { chiave: "nome", etichetta: "Nome" },
  { chiave: "cognome", etichetta: "Cognome" },
  // la residenza per intero, subito dopo nome e cognome: e' il blocco
  // che va sul modulo dell'allieva, quindi dev'esserci tutto
  { chiave: "indirizzo_residenza", etichetta: "Via" },
  { chiave: "civico_residenza", etichetta: "Civico" },
  { chiave: "interno_residenza", etichetta: "Interno" },
  { chiave: "cap_residenza", etichetta: "CAP" },
  { chiave: "citta_residenza", etichetta: "Città" },
  { chiave: "prov_residenza", etichetta: "Provincia" },
  { chiave: "stato_residenza", etichetta: "Stato" },
  { chiave: "email", etichetta: "Email" },
  { chiave: "telefono", etichetta: "Cellulare (+39...)" },
  { chiave: "codice_fiscale", etichetta: "Codice fiscale" },
  { chiave: "tutor", etichetta: "Tutor" },
  { chiave: "tipo_cliente", etichetta: "Intestazione" },
  // Dati di fatturazione
  { chiave: "fattura_ditta", etichetta: "Nome ditta", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_indirizzo", etichetta: "Indirizzo", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_civico", etichetta: "N. civico", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_citta", etichetta: "Città", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_prov", etichetta: "Prov.", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_cap", etichetta: "Cap", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_piva", etichetta: "P.IVA", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_cod_dest", etichetta: "Cod. Dest.", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  { chiave: "fattura_pec", etichetta: "PEC", soloSe: { chiave: "tipo_cliente", valore: "azienda" } },
  // Il corso
  { chiave: "corso_nome", etichetta: "Corso" },
  { chiave: "corso_data_inizio", etichetta: "Data inizio" },
  { chiave: "corso_data_fine", etichetta: "Data fine" },
  { chiave: "corso_citta", etichetta: "Località" },
  { chiave: "corso_indirizzo", etichetta: "Indirizzo della sede" },
  { chiave: "corso_master", etichetta: "Master", predefinito: false },
  // Dati di vendita
  { chiave: "totale_pattuito", etichetta: "Totale pattuito (senza IVA)" },
  { chiave: "quota_venditore", etichetta: "Quota venditore (7%)", predefinito: false },
  { chiave: "quota_speciale", etichetta: "Quota speciale", predefinito: false },
  // Pacchetto / Kit
  { chiave: "pacchetto_kit", etichetta: "Pacchetto/Kit" },
  { chiave: "tipo_offerta", etichetta: "Tipo di offerta" },
  { chiave: "dermografo", etichetta: "Dermografo" },
  // Presenza al corso
  { chiave: "giorni_presenza", etichetta: "Corso parziale" },
  // Quota acconto
  { chiave: "acconto_imponibile", etichetta: "Imponibile", predefinito: false },
  { chiave: "acconto_totale", etichetta: "Totale" },
  { chiave: "acconto_pagato_il", etichetta: "Data" },
  { chiave: "acconto_metodo", etichetta: "Metodo" },
  { chiave: "acconto_pagato", etichetta: "Stato (pagato / da pagare)" },
  // Quota pre corso
  { chiave: "precorso_imponibile", etichetta: "Imponibile", predefinito: false },
  { chiave: "precorso_totale", etichetta: "Totale" },
  { chiave: "precorso_pagato_il", etichetta: "Data" },
  { chiave: "precorso_metodo", etichetta: "Metodo" },
  { chiave: "precorso_pagato", etichetta: "Stato (pagato / da pagare)" },
  // Da avere al corso
  { chiave: "saldo_imponibile", etichetta: "Imponibile", predefinito: false },
  { chiave: "saldo_totale", etichetta: "Totale" },
  { chiave: "saldo_metodo", etichetta: "Metodo" },
  // Pagherà in totale
  { chiave: "totale_senza_iva", etichetta: "Totale senza IVA" },
  { chiave: "totale_con_interessi", etichetta: "Totale con interessi" },
  // Dati organizzativi
  { chiave: "accordi_commerciali", etichetta: "Accordi commerciali", predefinito: false },
  { chiave: "richiede_modelle", etichetta: "Richiede modelle a pagamento?" },
  { chiave: "numero_modelle", etichetta: "Quante modelle" },
  { chiave: "prezzo_speciale_modelle", etichetta: "Prezzo speciale", predefinito: false },
  // la taglia la sceglie LEI nel modulo (29/10/2026): il venditore puo'
  // lasciarla vuota, e se l'ha scritta lei la puo' cambiare
  { chiave: "taglia_divisa", etichetta: "Taglia divisa", opzioni: TAGLIE },
  { chiave: "note", etichetta: "Note", predefinito: false },
  // Quello che mette lei: resta dal modulo del sito
  { chiave: "doc_tipo", etichetta: "Tipo documento", opzioni: TIPI_DOCUMENTO },
  { chiave: "doc_numero", etichetta: "Numero documento" },
  { chiave: "doc_fronte", etichetta: "Foto documento — fronte" },
  { chiave: "doc_retro", etichetta: "Foto documento — retro" },
];

export const PER_CHIAVE = Object.fromEntries(CAMPI_MODULO.map((c) => [c.chiave, c]));
// Quello che resta solo suo: il documento. Il codice fiscale e' salito
// fra i dati dell'allievo il 16/10/2026 — lo chiede anche il venditore.
export const SUOI = ["doc_tipo", "doc_numero", "doc_fronte", "doc_retro"];
