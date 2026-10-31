// Cosa fa la pagina del modulo quando `modulo_salva` risponde di no.
//
// Due soli rifiuti chiudono la pagina: il modulo e' gia' arrivato, o
// l'iscrizione e' gia' confermata. Tutto il resto — manca la firma, la
// taglia, il documento, il contratto, un file e' finito nella cartella
// sbagliata — e' una cosa che l'allieva puo' correggere: resta un
// errore leggibile sopra il modulo. Prima bastava un `motivo` qualunque
// per far comparire «Iscrizione gia' confermata» al posto del modulo.
export const MOTIVI_CHE_CHIUDONO = ["gia_inviato", "confermato"];

export function leggiRifiuto(data) {
  if (data?.ok) return null;
  if (MOTIVI_CHE_CHIUDONO.includes(data?.motivo)) return { chiude: true, motivo: data.motivo };
  return { chiude: false, testo: data?.errore || "Non è stato possibile inviare il modulo." };
}
