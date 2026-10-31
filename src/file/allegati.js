// Gli allegati riservati si aprono con un link a scadenza, non con un
// indirizzo pubblico (31/10/2026).
//
// «Pubblico» e' un'impostazione del secchio: chi conosce l'indirizzo di un
// file lo scarica, policy o non policy, e per sempre. Nei secchi qui sotto
// stanno i moduli cartacei degli iscritti, le schermate dei bonifici, i
// biglietti, le fatture dei fornitori, i contratti e i documenti di master e
// venditori. Per questi l'app chiede a Supabase un link che vale un'ora e
// solo per chi ha una sessione. Gli altri secchi (loghi, template dei
// diplomi, immagini del negozio) restano pubblici e si aprono come prima.
import { supabase } from "../supabase.js";

export const BUCKET_RISERVATI = new Set([
  "allegati-iscritti", "master-documenti", "venditori-documenti", "leve-assistenti-documenti", "spese-allegati",
]);

// Alcune righe (le spese) hanno salvato l'URL pubblico intero invece del
// percorso. Si accettano tutti e due, cosi' non serve riscrivere i dati per
// aprirle: dal link si ricava il percorso dopo il nome del secchio.
export function percorsoDaValore(bucket, valore) {
  const v = String(valore || "");
  const m = v.match(new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`));
  return m ? decodeURIComponent(m[1]) : v;
}

export async function urlAllegato(bucket, valore, secondi = 3600) {
  const percorso = percorsoDaValore(bucket, valore);
  if (!BUCKET_RISERVATI.has(bucket)) return supabase.storage.from(bucket).getPublicUrl(percorso).data.publicUrl;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(percorso, secondi);
  // il client incolla la propria base a quello che gli torna: con una
  // risposta storta esce ".../storage/v1null", una stringa piena e un
  // indirizzo che non esiste. Si controlla che sia un vero link firmato.
  if (error || !data?.signedUrl || !/\/object\/sign\/.+token=/.test(data.signedUrl)) {
    throw new Error(error?.message || "link non disponibile");
  }
  return data.signedUrl;
}

// Apre un allegato in una scheda nuova. La finestra si apre SUBITO, dentro il
// gesto di chi preme, vuota, e si riempie quando il link e' pronto: se la si
// aprisse dopo l'attesa il browser (iPhone in testa) la scambierebbe per un
// popup e la bloccherebbe.
export async function apriAllegato(bucket, valore) {
  const finestra = window.open("", "_blank");
  try {
    const url = await urlAllegato(bucket, valore);
    if (finestra) { finestra.location.href = url; finestra.opener = null; }
    else window.location.href = url;
  } catch (e) {
    if (finestra) finestra.close();
    window.alert(`Non riesco ad aprire il file: ${e.message || e}`);
  }
}

export async function scaricaBytes(bucket, valore) {
  const url = await urlAllegato(bucket, valore, 300);
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`impossibile scaricare ${valore}`);
  return new Uint8Array(await risposta.arrayBuffer());
}
