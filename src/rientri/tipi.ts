// Modulo "Rientro materiali corso" — i tipi delle otto tabelle.
//
// Rispecchiano uno a uno la migration 20260917140000_rientro_materiali_corso:
// se cambia una colonna di la', cambia un campo di qua. Le union di stringhe
// sono le stesse dei CHECK sul database — li' e' il vincolo vero, qui e'
// l'aiuto a non sbagliarlo mentre si scrive.
//
// Sono i primi file TypeScript di questo progetto, che per il resto e'
// JavaScript: Vite compila i .ts senza configurazione, ma NESSUNO controlla
// i tipi durante la build (esbuild li toglie e basta). Servono all'editor,
// non a bloccare un errore in produzione — per quello restano il montaggio
// in jsdom e la prova sui dati veri.

export type StatoSpedizione =
  | "bozza"
  | "spedita"
  | "in_rientro"
  | "chiusa"
  | "chiusa_con_anomalie";

/** Le quattro tipologie spedite, ognuna con una logica di chiusura diversa. */
export type TipoElemento = "kit_allievo" | "kit_riserva" | "sfuso" | "dermografo";

/** I tre destini di un kit di riserva, piu' lo stato di partenza. */
export type StatoKitRiserva =
  | "sigillato"
  | "aperto"
  | "consegnato_intero"
  | "rientrato_chiuso";

export type MotivoPrelievo = "vendita" | "sostituzione";

/** Chi ha scritto il prelievo. Distingue cio' che il sistema sa da solo da
 *  cio' che qualcuno ha dichiarato a mano: e' su questa differenza che si
 *  regge la riconciliazione di fine corso. */
export type OriginePrelievo =
  | "pos_automatico"
  | "quadro_sostituzioni"
  | "dichiarato_al_rientro";

export type MotivoSostituzione =
  | "danneggiato"
  | "mancante"
  | "non_funzionante"
  | "altro";

export type StatoRientro = "aperto" | "chiuso";

export type ProvenienzaVendita = "kit_riserva" | "magazzino_centrale";

export interface SpedizioneCorso {
  id: string;
  corso_data_id: string;
  master_id: string | null;
  data_spedizione: string | null;
  stato: StatoSpedizione;
  /** Quanti allievi c'erano quando il pacco e' partito: fotografia, mai
   *  ricalcolata. E' il denominatore dell'analisi dei consumi. */
  n_allievi_previsti: number | null;
  creata_da: string | null;
  chiusa_ts: string | null;
  ts: string;
}

export interface SpedizioneRiga {
  id: string;
  spedizione_id: string;
  tipo: TipoElemento;
  /** Valorizzato per i kit. */
  kit_id: string | null;
  /** Valorizzato per sfusi e dermografi. */
  prodotto_id: string | null;
  quantita_spedita: number;
  ts: string;
}

export interface KitRiservaIstanza {
  id: string;
  spedizione_id: string;
  kit_id: string;
  /** 1, 2, 3… dentro la stessa spedizione. E' il "#N" della domanda
   *  "il kit riserva #2 che fine ha fatto?". */
  progressivo: number;
  stato: StatoKitRiserva;
  /** Solo quando il kit e' stato dato intero a un'iscritta non prevista. */
  iscritto_id: string | null;
  ts: string;
}

export interface KitRiservaComponente {
  id: string;
  kit_riserva_id: string;
  prodotto_id: string;
  /** Quanti pezzi c'erano alla partenza. Copia, non riferimento alla
   *  distinta: la distinta cambia nel tempo, questa foto no. */
  quantita_iniziale: number;
  quantita_prelevata: number;
  ts: string;
}

export interface Sostituzione {
  id: string;
  spedizione_id: string;
  kit_riserva_id: string | null;
  iscritto_id: string | null;
  /** Cosa e' stato preso dal kit di riserva. */
  prodotto_prelevato_id: string;
  /** Cosa era difettoso o mancante nel kit dell'allieva. */
  prodotto_sostituito_id: string | null;
  motivo: MotivoSostituzione;
  nota: string | null;
  foto_url: string | null;
  difettoso_rientra: boolean;
  ts: string;
}

export interface PrelievoKitRiserva {
  id: string;
  kit_riserva_id: string;
  prodotto_id: string;
  quantita: number;
  motivo: MotivoPrelievo;
  /** Obbligatorio quando origine e' "pos_automatico". Vuoto su una vendita
   *  dichiarata a mano al rientro: e' quel vuoto ad accendere l'anomalia. */
  vendita_id: string | null;
  /** Sempre valorizzato quando motivo e' "sostituzione". */
  sostituzione_id: string | null;
  origine: OriginePrelievo;
  ts: string;
}

export interface Rientro {
  id: string;
  spedizione_id: string;
  master_id: string | null;
  stato: StatoRientro;
  chiuso_ts: string | null;
  ha_anomalie: boolean;
  note_anomalie: NotaAnomalia[];
  ts: string;
}

/** Una discrepanza trovata alla chiusura. Non blocca: viaggia verso chi
 *  riceve il pacco, che e' l'unico che puo' verificarla allo scaffale. */
export interface NotaAnomalia {
  tipo: "vendite_non_riscontrate" | "vendite_non_dichiarate" | "altro";
  prodotto_id?: string;
  dichiarato?: number;
  trovato?: number;
  testo: string;
}

export interface RientroRiga {
  id: string;
  rientro_id: string;
  spedizione_riga_id: string;
  tipo: TipoElemento;
  quantita_rientrata: number;
  quantita_venduta: number;
  quantita_guasta: number;
  quantita_consegnata: number;
  /** spedito − rientrata − venduta − guasta − consegnata, congelata alla
   *  chiusura. */
  quantita_consumata_calcolata: number | null;
  ts: string;
}

/** Le tre colonne aggiunte a vendite_shop. Restano vuote sulla stragrande
 *  maggioranza delle vendite: si riempiono solo quando il prodotto era
 *  davvero disponibile in un kit di riserva in aula e la domanda e' stata
 *  posta. */
export interface ProvenienzaSuVendita {
  provenienza: ProvenienzaVendita | null;
  kit_riserva_id: string | null;
  spedizione_id: string | null;
}

/** Quanto resta prelevabile da un componente di kit di riserva. Sotto a 1
 *  il POS smette di offrire "dal kit": non c'e' piu' niente da prendere. */
export function residuoComponente(c: KitRiservaComponente): number {
  return Math.max(0, (c.quantita_iniziale || 0) - (c.quantita_prelevata || 0));
}
