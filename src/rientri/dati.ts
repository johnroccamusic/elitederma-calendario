// Le scritture del modulo. Tutte qui dentro, nessuna sparsa nelle pagine.
//
// Quello che questo file NON fa, e non deve fare: scrivere su
// logistica_kit_edizioni. Quella tabella e' l'andata del pacco, e' viva,
// e contiene liste compilate a mano su diciassette edizioni. Il modulo la
// legge e basta.
//
// E non esiste una pagina "spedizioni" del modulo: la spedizione nasce
// dentro Logistica corsi, che e' dove Raffaele lavora gia', nel momento
// in cui dichiara il pacco preparato. Aggiungere una seconda area per
// fare la stessa cosa era un doppione, ed e' stato tolto.

import { supabase } from "../supabase.js";
import { distintaDelKit } from "./composizione";

/** La fotografia che la logistica scatta alla partenza (componiSpedizione). */
interface FotoSpedizione {
  kit?: Record<string, { nome?: string | null; per_iscritti?: number; riserva?: number }>;
  iscritti?: { id: string }[];
  dermografi?: { assegnati?: Record<string, number>; riserva?: Record<string, number> };
  accessori?: Record<string, number>;
  merce_vendita?: Record<string, number>;
}

interface RigaKitProdotto {
  corso_id: string | null;
  kit_id: string | null;
  prodotto_id: string;
  tipo: string;
  quantita: number;
}

/**
 * Il pacco parte: da questo momento esistono i kit di riserva, uno per
 * uno, e il POS sa che in quell'aula c'e' della merce.
 *
 * Si aggancia al gesto che gia' esiste in Logistica corsi — "pacco
 * preparato", quello che scarica il magazzino e scatta la fotografia —
 * perche' quello E' il momento della partenza. Non serve dichiararla due
 * volte in due posti.
 *
 * Idempotente: se per quell'edizione la spedizione c'e' gia', non si fa
 * niente. Tornare indietro di fase e riavanzare non deve raddoppiare i
 * kit che stanno in aula.
 */
export async function registraPartenza({
  corsoDataId, masterId, foto, corsiKitProdotti, creataDa,
}: {
  corsoDataId: string;
  masterId: string | null;
  foto: FotoSpedizione;
  corsiKitProdotti: RigaKitProdotto[];
  creataDa: string | null;
}): Promise<string | null> {
  if (!corsoDataId || !foto) return null;

  const { data: gia } = await supabase
    .from("spedizioni_corso").select("id").eq("corso_data_id", corsoDataId).limit(1);
  if (gia && gia.length > 0) return null;

  const { data: spedizione, error } = await supabase
    .from("spedizioni_corso")
    .insert({
      corso_data_id: corsoDataId,
      master_id: masterId,
      // quanti allievi c'erano quando il pacco e' partito: fotografia, mai
      // ricalcolata. E' il denominatore del consumo per allievo
      n_allievi_previsti: (foto.iscritti || []).length,
      creata_da: creataDa,
      stato: "spedita",
      data_spedizione: new Date().toISOString().slice(0, 10),
    })
    .select().single();
  if (error || !spedizione) return error?.message || "non riesco a registrare la partenza";

  const righe: Record<string, unknown>[] = [];
  Object.entries(foto.kit || {}).forEach(([kitId, dati]) => {
    if ((dati.per_iscritti || 0) > 0) {
      righe.push({ spedizione_id: spedizione.id, tipo: "kit_allievo", kit_id: kitId, quantita_spedita: dati.per_iscritti });
    }
    if ((dati.riserva || 0) > 0) {
      righe.push({ spedizione_id: spedizione.id, tipo: "kit_riserva", kit_id: kitId, quantita_spedita: dati.riserva });
    }
  });
  // accessori didattica e merce da vendere viaggiano nello stesso pacco:
  // per il rientro sono la stessa cosa, roba da contare
  const sfusi: Record<string, number> = {};
  Object.entries(foto.accessori || {}).forEach(([id, q]) => { if (Number(q) > 0) sfusi[id] = (sfusi[id] || 0) + Number(q); });
  Object.entries(foto.merce_vendita || {}).forEach(([id, q]) => { if (Number(q) > 0) sfusi[id] = (sfusi[id] || 0) + Number(q); });
  Object.entries(sfusi).forEach(([prodottoId, quantita]) => {
    righe.push({ spedizione_id: spedizione.id, tipo: "sfuso", prodotto_id: prodottoId, quantita_spedita: quantita });
  });
  Object.entries(foto.dermografi?.riserva || {}).forEach(([modello, q]) => {
    if (Number(q) > 0) righe.push({ spedizione_id: spedizione.id, tipo: "dermografo", modello, quantita_spedita: Number(q) });
  });

  if (righe.length > 0) {
    const { error: erroreRighe } = await supabase.from("spedizione_righe").insert(righe);
    if (erroreRighe) {
      await supabase.from("spedizioni_corso").delete().eq("id", spedizione.id);
      return erroreRighe.message;
    }
  }

  // i kit di riserva, uno per uno, con la foto di cosa c'era dentro
  for (const [kitId, dati] of Object.entries(foto.kit || {})) {
    const quanti = dati.riserva || 0;
    if (quanti <= 0) continue;
    const { data: istanze, error: erroreIstanze } = await supabase
      .from("kit_riserva_istanze")
      .insert(Array.from({ length: quanti }, (_, i) => ({
        spedizione_id: spedizione.id, kit_id: kitId, progressivo: i + 1,
      })))
      .select();
    if (erroreIstanze) return erroreIstanze.message;

    const distinta = distintaDelKit(corsiKitProdotti, kitId);
    if (distinta.length === 0) continue;
    const { error: erroreFoto } = await supabase.from("kit_riserva_componenti").insert(
      (istanze || []).flatMap((istanza: { id: string }) =>
        distinta.map((d) => ({
          kit_riserva_id: istanza.id,
          prodotto_id: d.prodotto_id,
          quantita_iniziale: d.quantita,
        })),
      ),
    );
    if (erroreFoto) return erroreFoto.message;
  }

  return null;
}

/** Quello che e' partito per un'edizione, se e' partito. */
export async function leggiSpedizione(corsoDataId: string) {
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("*").eq("corso_data_id", corsoDataId)
    .order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;
  const [{ data: righe }, { data: istanze }] = await Promise.all([
    supabase.from("spedizione_righe").select("*").eq("spedizione_id", spedizione.id).order("ts"),
    supabase.from("kit_riserva_istanze").select("*").eq("spedizione_id", spedizione.id).order("progressivo"),
  ]);
  return { spedizione, righe: righe || [], istanze: istanze || [] };
}
