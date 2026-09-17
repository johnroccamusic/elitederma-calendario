// Le scritture del modulo. Tutte qui dentro, nessuna sparsa nelle pagine.
//
// Quello che questo file NON fa, e non deve mai fare: scrivere su
// logistica_kit_edizioni. Quella tabella e' l'andata del pacco, e' viva, e
// contiene liste compilate a mano su diciassette edizioni. Il modulo la
// legge e basta.

import { supabase } from "../supabase.js";
import { distintaDelKit, type RigaProposta } from "./composizione";
import type { SpedizioneCorso, SpedizioneRiga, KitRiservaIstanza } from "./tipi";

/** La spedizione di un'edizione, con le sue righe. Null se non esiste. */
export async function leggiSpedizione(corsoDataId: string): Promise<{
  spedizione: SpedizioneCorso;
  righe: SpedizioneRiga[];
  istanze: KitRiservaIstanza[];
} | null> {
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

/** Tutte le spedizioni esistenti, per dire in elenco quali edizioni ce
 *  l'hanno gia' senza aprirle una per una. */
export async function leggiSpedizioniPerEdizione(): Promise<Record<string, SpedizioneCorso>> {
  const { data } = await supabase.from("spedizioni_corso").select("*").order("ts");
  const mappa: Record<string, SpedizioneCorso> = {};
  (data || []).forEach((s: SpedizioneCorso) => { mappa[s.corso_data_id] = s; });
  return mappa;
}

/**
 * Crea la spedizione e le sue righe. Non genera ancora le istanze dei kit
 * di riserva: quelle nascono alla conferma, quando le quantita' sono
 * quelle vere (vedi confermaPartenza).
 */
export async function creaSpedizione({
  corsoDataId, masterId, nAllieviPrevisti, creataDa, righe,
}: {
  corsoDataId: string;
  masterId: string | null;
  nAllieviPrevisti: number | null;
  creataDa: string | null;
  righe: RigaProposta[];
}): Promise<{ spedizione?: SpedizioneCorso; errore?: string }> {
  const { data: spedizione, error } = await supabase
    .from("spedizioni_corso")
    .insert({
      corso_data_id: corsoDataId,
      master_id: masterId,
      n_allievi_previsti: nAllieviPrevisti,
      creata_da: creataDa,
      stato: "bozza",
    })
    .select().single();
  if (error || !spedizione) return { errore: error?.message || "non riesco a creare la spedizione" };

  const daScrivere = righe
    .filter((r) => r.quantita_spedita > 0)
    .map((r) => ({
      spedizione_id: spedizione.id,
      tipo: r.tipo,
      kit_id: r.kit_id,
      prodotto_id: r.prodotto_id,
      quantita_spedita: r.quantita_spedita,
    }));
  if (daScrivere.length > 0) {
    const { error: erroreRighe } = await supabase.from("spedizione_righe").insert(daScrivere);
    if (erroreRighe) {
      // niente spedizioni monche in giro: se le righe non entrano, si
      // porta via anche la testata
      await supabase.from("spedizioni_corso").delete().eq("id", spedizione.id);
      return { errore: erroreRighe.message };
    }
  }
  return { spedizione };
}

export async function salvaQuantitaRiga(rigaId: string, quantita: number): Promise<string | null> {
  const { error } = await supabase
    .from("spedizione_righe").update({ quantita_spedita: Math.max(0, Math.round(quantita) || 0) }).eq("id", rigaId);
  return error ? error.message : null;
}

export async function aggiungiRiga(spedizioneId: string, riga: RigaProposta): Promise<string | null> {
  const { error } = await supabase.from("spedizione_righe").insert({
    spedizione_id: spedizioneId,
    tipo: riga.tipo,
    kit_id: riga.kit_id,
    prodotto_id: riga.prodotto_id,
    quantita_spedita: riga.quantita_spedita,
  });
  return error ? error.message : null;
}

export async function eliminaRiga(rigaId: string): Promise<string | null> {
  const { error } = await supabase.from("spedizione_righe").delete().eq("id", rigaId);
  return error ? error.message : null;
}

/**
 * La partenza del pacco. Qui succedono le tre cose che reggono tutto il
 * resto del modulo:
 *
 *   1. ogni kit di riserva diventa un'istanza numerata — se ne partono 4,
 *      qui nascono 4 righe, non una riga con quantita' 4. E' l'unico modo
 *      per poter chiedere, dopo, "il kit riserva #2 che fine ha fatto?"
 *   2. di ogni istanza si fotografa il contenuto: quella foto non cambiera'
 *      piu', nemmeno se la distinta del kit cambia domani
 *   3. la spedizione passa a "spedita", e da li' in poi il POS sa che in
 *      quell'aula c'e' della merce
 *
 * Si puo' chiamare una volta sola: se le istanze ci sono gia', non si
 * rifanno (raddoppierebbero i kit in aula).
 */
export async function confermaPartenza({
  spedizioneId, corsiKitProdotti, dataSpedizione,
}: {
  spedizioneId: string;
  corsiKitProdotti: { corso_id: string | null; kit_id: string | null; prodotto_id: string; tipo: string; quantita: number }[];
  dataSpedizione: string;
}): Promise<string | null> {
  const { data: gia } = await supabase
    .from("kit_riserva_istanze").select("id").eq("spedizione_id", spedizioneId).limit(1);
  if (gia && gia.length > 0) return "questa spedizione e' gia' partita: le istanze dei kit di riserva esistono gia'";

  const { data: righe, error } = await supabase
    .from("spedizione_righe").select("*").eq("spedizione_id", spedizioneId).eq("tipo", "kit_riserva");
  if (error) return error.message;

  for (const riga of righe || []) {
    if (!riga.kit_id || !(riga.quantita_spedita > 0)) continue;
    const istanze = Array.from({ length: riga.quantita_spedita }, (_, i) => ({
      spedizione_id: spedizioneId,
      kit_id: riga.kit_id,
      progressivo: i + 1,
    }));
    const { data: create, error: erroreIstanze } = await supabase
      .from("kit_riserva_istanze").insert(istanze).select();
    if (erroreIstanze) return erroreIstanze.message;

    const distinta = distintaDelKit(corsiKitProdotti, riga.kit_id);
    if (distinta.length > 0) {
      const foto = (create || []).flatMap((istanza: KitRiservaIstanza) =>
        distinta.map((d) => ({
          kit_riserva_id: istanza.id,
          prodotto_id: d.prodotto_id,
          quantita_iniziale: d.quantita,
        })),
      );
      const { error: erroreFoto } = await supabase.from("kit_riserva_componenti").insert(foto);
      if (erroreFoto) return erroreFoto.message;
    }
  }

  const { error: erroreStato } = await supabase
    .from("spedizioni_corso")
    .update({ stato: "spedita", data_spedizione: dataSpedizione })
    .eq("id", spedizioneId);
  return erroreStato ? erroreStato.message : null;
}
