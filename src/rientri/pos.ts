// Quello che il POS deve sapere sui kit che stanno in aula.
//
// La domanda alla master compare solo quando ha senso: quel prodotto e'
// davvero dentro un kit di riserva partito per quel corso, e ne e' rimasto
// almeno un pezzo. Su tutto il resto — il 95% delle vendite — non si vede
// niente e la vendita resta identica a prima.
//
// Quando i pezzi finiscono la domanda sparisce da sola: alla terza vendita
// di pigmento rosso, se nei kit ce n'erano due, "dal kit" non e' piu'
// un'opzione. Non e' una validazione, e' aritmetica.

import { supabase } from "../supabase.js";

export interface IstanzaConResiduo {
  id: string;
  progressivo: number;
  stato: string;
  kit_id: string;
  /** quanti pezzi di QUEL prodotto restano in QUESTO kit */
  residuo: number;
}

export interface DisponibilitaProdotto {
  residuo: number;
  istanze: IstanzaConResiduo[];
}

export interface KitInAula {
  spedizioneId: string;
  /** prodotto_id -> quanto e' ancora prelevabile, e da quali kit */
  perProdotto: Record<string, DisponibilitaProdotto>;
}

/**
 * Cosa c'e' di prelevabile in aula per questa edizione. Null se per quel
 * corso non e' partito niente — e allora il POS non cambia di una virgola.
 */
export async function caricaKitInAula(corsoDataId: string | null): Promise<KitInAula | null> {
  if (!corsoDataId) return null;
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("id, stato").eq("corso_data_id", corsoDataId)
    .in("stato", ["spedita", "in_rientro"]).order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;

  const { data: istanze } = await supabase
    .from("kit_riserva_istanze").select("id, progressivo, stato, kit_id")
    .eq("spedizione_id", spedizione.id)
    // un kit consegnato intero a un'allieva non e' piu' li' da aprire, e
    // uno gia' dichiarato rientrato chiuso e' roba del rientro
    .in("stato", ["sigillato", "aperto"]);
  if (!istanze || istanze.length === 0) return { spedizioneId: spedizione.id, perProdotto: {} };

  const { data: componenti } = await supabase
    .from("kit_riserva_componenti").select("kit_riserva_id, prodotto_id, quantita_iniziale, quantita_prelevata")
    .in("kit_riserva_id", istanze.map((i) => i.id));

  const perIstanza: Record<string, typeof istanze[number]> = {};
  istanze.forEach((i) => { perIstanza[i.id] = i; });

  const perProdotto: Record<string, DisponibilitaProdotto> = {};
  (componenti || []).forEach((c) => {
    const residuo = Math.max(0, (c.quantita_iniziale || 0) - (c.quantita_prelevata || 0));
    if (residuo <= 0) return;
    const istanza = perIstanza[c.kit_riserva_id];
    if (!istanza) return;
    const voce = perProdotto[c.prodotto_id] || (perProdotto[c.prodotto_id] = { residuo: 0, istanze: [] });
    voce.residuo += residuo;
    voce.istanze.push({ id: istanza.id, progressivo: istanza.progressivo, stato: istanza.stato, kit_id: istanza.kit_id, residuo });
  });

  // se un kit e' gia' aperto si pesca da quello: aprirne un secondo
  // significa avere due scatole rotte invece di una
  Object.values(perProdotto).forEach((v) => {
    v.istanze.sort((a, b) => {
      if (a.stato !== b.stato) return a.stato === "aperto" ? -1 : 1;
      return a.progressivo - b.progressivo;
    });
  });
  return { spedizioneId: spedizione.id, perProdotto };
}

/**
 * Il kit da cui prendere. Prima quello gia' aperto: aprirne un secondo
 * quando uno e' gia' rotto vuol dire avere due scatole rotte invece di
 * una. Se sono tutti sigillati si apre il primo, in ordine di numero.
 *
 * Non si chiede quale: al banco c'e' gente che aspetta, e fra due scatole
 * identiche non c'e' una risposta giusta — conta che il pezzo esca da una
 * sola, e che resti scritto da quale.
 */
export function kitDaAprireAutomaticamente(d: DisponibilitaProdotto | undefined): IstanzaConResiduo | null {
  if (!d || d.istanze.length === 0) return null;
  const aperto = d.istanze.find((i) => i.stato === "aperto" && i.residuo > 0);
  if (aperto) return aperto;
  return d.istanze.find((i) => i.residuo > 0) || null;
}

export interface SceltaDalKit {
  prodottoId: string;
  kitRiservaId: string;
  quantita: number;
}

/**
 * Dopo che la vendita e' stata registrata: si scrive che quei pezzi sono
 * usciti dai kit. Tre effetti, e sono quelli che fanno nascere gia' piena
 * la scheda di fine corso:
 *
 *   - una riga di prelievo per ogni prodotto, con l'id della vendita
 *   - il kit passa ad "aperto": vendere E' dichiarare di averlo aperto
 *   - la fotografia del contenuto si aggiorna, cosi' il POS sa che quel
 *     pezzo non c'e' piu' e alla prossima vendita non lo offre
 *
 * Non tocca il magazzino centrale: quei pezzi ne sono usciti giorni fa,
 * col pacco del corso.
 */
export async function registraPrelieviDaVendita({
  venditaId, spedizioneId, scelte,
}: {
  venditaId: string;
  spedizioneId: string;
  scelte: SceltaDalKit[];
}): Promise<string | null> {
  if (!scelte.length) return null;

  const { error: errorePrelievi } = await supabase.from("prelievi_kit_riserva").insert(
    scelte.map((s) => ({
      kit_riserva_id: s.kitRiservaId,
      prodotto_id: s.prodottoId,
      quantita: s.quantita,
      motivo: "vendita",
      vendita_id: venditaId,
      origine: "pos_automatico",
    })),
  );
  if (errorePrelievi) return errorePrelievi.message;

  for (const s of scelte) {
    const { data: componente } = await supabase
      .from("kit_riserva_componenti").select("id, quantita_prelevata")
      .eq("kit_riserva_id", s.kitRiservaId).eq("prodotto_id", s.prodottoId).maybeSingle();
    if (componente) {
      await supabase.from("kit_riserva_componenti")
        .update({ quantita_prelevata: (componente.quantita_prelevata || 0) + s.quantita })
        .eq("id", componente.id);
    }
    await supabase.from("kit_riserva_istanze").update({ stato: "aperto" }).eq("id", s.kitRiservaId);
  }

  const kitCoinvolti = [...new Set(scelte.map((s) => s.kitRiservaId))];
  await supabase.from("vendite_shop").update({
    provenienza: "kit_riserva",
    // la colonna ne tiene uno: quando la vendita ha svuotato piu' kit la
    // si lascia vuota, perche' il dato vero e' riga per riga nei prelievi
    kit_riserva_id: kitCoinvolti.length === 1 ? kitCoinvolti[0] : null,
    spedizione_id: spedizioneId,
  }).eq("id", venditaId);

  return null;
}
