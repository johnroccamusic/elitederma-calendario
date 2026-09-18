// Le scorte che stanno in aula, e cosa succede quando la master ne prende
// un pezzo.
//
// "Scorta" e' tutto quello che e' partito in piu' rispetto ai kit degli
// allievi: i kit di riserva (uno per uno, col loro contenuto), il
// materiale sfuso e la merce da vendere, i dermografi extra. Sono le
// uniche cose da cui si puo' prelevare: il kit di un'allieva non e' una
// scorta, e' roba sua.

import { supabase } from "../supabase.js";

export type ProvenienzaScorta =
  | { tipo: "kit"; kitRiservaId: string; progressivo: number; kitId: string }
  | { tipo: "sfuso"; spedizioneRigaId: string };

export interface VoceScorta {
  /** chiave stabile per React e per le mappe */
  chiave: string;
  prodottoId: string | null;
  /** per i dermografi, che a catalogo possono non esistere */
  modello: string | null;
  tipo: "kit_riserva" | "sfuso" | "dermografo";
  provenienza: ProvenienzaScorta;
  /** quanti pezzi restano prelevabili */
  residuo: number;
  partiti: number;
  /** solo per i pezzi dentro un kit: a che kit appartengono */
  etichettaKit: string | null;
}

export interface ScorteInAula {
  spedizioneId: string;
  voci: VoceScorta[];
}

/**
 * Tutto quello che c'e' ancora da prendere per questa edizione. Null se
 * per quel corso non e' partito niente: allora non c'e' nemmeno il tasto.
 */
export async function caricaScorte(corsoDataId: string | null): Promise<ScorteInAula | null> {
  if (!corsoDataId) return null;
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("id").eq("corso_data_id", corsoDataId)
    .in("stato", ["spedita", "in_rientro"]).order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;

  const [{ data: istanze }, { data: righe }, { data: prelievi }] = await Promise.all([
    supabase.from("kit_riserva_istanze").select("id, progressivo, stato, kit_id")
      .eq("spedizione_id", spedizione.id).in("stato", ["sigillato", "aperto"]),
    supabase.from("spedizione_righe").select("id, tipo, prodotto_id, modello, quantita_spedita")
      .eq("spedizione_id", spedizione.id).in("tipo", ["sfuso", "dermografo"]),
    supabase.from("prelievi_kit_riserva").select("spedizione_riga_id, quantita"),
  ]);

  const voci: VoceScorta[] = [];

  // 1. i pezzi dentro i kit di riserva, kit per kit
  if (istanze && istanze.length > 0) {
    const { data: componenti } = await supabase
      .from("kit_riserva_componenti").select("kit_riserva_id, prodotto_id, quantita_iniziale, quantita_prelevata")
      .in("kit_riserva_id", istanze.map((i) => i.id));
    const perId: Record<string, typeof istanze[number]> = {};
    istanze.forEach((i) => { perId[i.id] = i; });
    (componenti || []).forEach((c) => {
      const istanza = perId[c.kit_riserva_id];
      if (!istanza) return;
      voci.push({
        chiave: `k:${c.kit_riserva_id}:${c.prodotto_id}`,
        prodottoId: c.prodotto_id,
        modello: null,
        tipo: "kit_riserva",
        provenienza: { tipo: "kit", kitRiservaId: c.kit_riserva_id, progressivo: istanza.progressivo, kitId: istanza.kit_id },
        residuo: Math.max(0, (c.quantita_iniziale || 0) - (c.quantita_prelevata || 0)),
        partiti: c.quantita_iniziale || 0,
        etichettaKit: `#${istanza.progressivo}`,
      });
    });
  }

  // 2. il materiale sfuso e i dermografi: il residuo si ricava dai
  //    prelievi gia' scritti su quella riga, perche' qui non c'e' una
  //    fotografia del contenuto da scalare come nei kit
  const presiPerRiga: Record<string, number> = {};
  (prelievi || []).forEach((p) => {
    if (!p.spedizione_riga_id) return;
    presiPerRiga[p.spedizione_riga_id] = (presiPerRiga[p.spedizione_riga_id] || 0) + (p.quantita || 0);
  });
  (righe || []).forEach((r) => {
    voci.push({
      chiave: `r:${r.id}`,
      prodottoId: r.prodotto_id || null,
      modello: r.modello || null,
      tipo: r.tipo === "dermografo" ? "dermografo" : "sfuso",
      provenienza: { tipo: "sfuso", spedizioneRigaId: r.id },
      residuo: Math.max(0, (r.quantita_spedita || 0) - (presiPerRiga[r.id] || 0)),
      partiti: r.quantita_spedita || 0,
      etichettaKit: null,
    });
  });

  return { spedizioneId: spedizione.id, voci };
}

/** I due motivi, come li ha detti il committente. Il primo non fa tornare
 *  indietro niente, il secondo si' — ed e' l'unica differenza che conta
 *  per il magazzino. */
export const MOTIVI_PRELIEVO = [
  {
    chiave: "mancante",
    titolo: "Integrazione",
    sottotitolo: "Mancava dal kit dell'allieva",
    difettoRientra: false,
  },
  {
    chiave: "non_funzionante",
    titolo: "Sostituzione",
    sottotitolo: "Il pezzo era guasto o non funzionante",
    difettoRientra: true,
  },
] as const;

export type ChiaveMotivo = typeof MOTIVI_PRELIEVO[number]["chiave"];

/**
 * La master ha preso un pezzo dalla scorta. Si scrive tutto adesso, col
 * pezzo rotto ancora in mano: a fine corso non se lo ricorda nessuno.
 *
 * Tre effetti, e sono quelli che fanno nascere gia' piena la scheda di
 * rientro:
 *   1. la sostituzione resta scritta, con chi, cosa e perche'
 *   2. il pezzo preso esce dall'atteso di rientro (e' un prelievo)
 *   3. se veniva da un kit, quel kit risulta aperto e la fotografia del
 *      suo contenuto si aggiorna
 *
 * Il magazzino centrale non si tocca: quei pezzi ne sono usciti col pacco.
 */
export async function registraSostituzione({
  spedizioneId, voce, motivo, iscrittoId, prodottoSostituitoId, nota, quantita = 1,
}: {
  spedizioneId: string;
  voce: VoceScorta;
  motivo: ChiaveMotivo;
  iscrittoId: string | null;
  prodottoSostituitoId: string | null;
  nota: string | null;
  quantita?: number;
}): Promise<string | null> {
  const daKit = voce.provenienza.tipo === "kit";
  const kitRiservaId = daKit ? voce.provenienza.kitRiservaId : null;
  const spedizioneRigaId = daKit ? null : voce.provenienza.spedizioneRigaId;
  const regola = MOTIVI_PRELIEVO.find((m) => m.chiave === motivo);

  const { data: sostituzione, error } = await supabase
    .from("sostituzioni")
    .insert({
      spedizione_id: spedizioneId,
      kit_riserva_id: kitRiservaId,
      spedizione_riga_id: spedizioneRigaId,
      iscritto_id: iscrittoId,
      prodotto_prelevato_id: voce.prodottoId,
      // su un'integrazione il pezzo sostituito E' quello mancante: e'
      // lo stesso prodotto, solo che nel kit non c'era
      prodotto_sostituito_id: prodottoSostituitoId || voce.prodottoId,
      motivo,
      nota: nota || null,
      difettoso_rientra: !!regola?.difettoRientra,
    })
    .select().single();
  if (error || !sostituzione) return error?.message || "non riesco a scrivere la sostituzione";

  const { error: errorePrelievo } = await supabase.from("prelievi_kit_riserva").insert({
    kit_riserva_id: kitRiservaId,
    spedizione_riga_id: spedizioneRigaId,
    prodotto_id: voce.prodottoId,
    quantita,
    motivo: "sostituzione",
    sostituzione_id: sostituzione.id,
    origine: "quadro_sostituzioni",
  });
  if (errorePrelievo) {
    await supabase.from("sostituzioni").delete().eq("id", sostituzione.id);
    return errorePrelievo.message;
  }

  if (daKit && kitRiservaId && voce.prodottoId) {
    const { data: componente } = await supabase
      .from("kit_riserva_componenti").select("id, quantita_prelevata")
      .eq("kit_riserva_id", kitRiservaId).eq("prodotto_id", voce.prodottoId).maybeSingle();
    if (componente) {
      await supabase.from("kit_riserva_componenti")
        .update({ quantita_prelevata: (componente.quantita_prelevata || 0) + quantita })
        .eq("id", componente.id);
    }
    // prendere un pezzo da una scatola vuol dire averla aperta
    await supabase.from("kit_riserva_istanze").update({ stato: "aperto" }).eq("id", kitRiservaId);
  }
  return null;
}

/** Quello che la master ha gia' dichiarato per questa edizione: serve a
 *  farglielo rivedere, e a non farle registrare due volte la stessa cosa. */
export async function leggiSostituzioni(spedizioneId: string) {
  const { data } = await supabase
    .from("sostituzioni").select("*").eq("spedizione_id", spedizioneId).order("ts", { ascending: false });
  return data || [];
}

export async function annullaSostituzione(sostituzioneId: string): Promise<string | null> {
  const { data: prelievi } = await supabase
    .from("prelievi_kit_riserva").select("id, kit_riserva_id, prodotto_id, quantita")
    .eq("sostituzione_id", sostituzioneId);
  for (const p of prelievi || []) {
    if (p.kit_riserva_id && p.prodotto_id) {
      const { data: componente } = await supabase
        .from("kit_riserva_componenti").select("id, quantita_prelevata")
        .eq("kit_riserva_id", p.kit_riserva_id).eq("prodotto_id", p.prodotto_id).maybeSingle();
      if (componente) {
        await supabase.from("kit_riserva_componenti")
          .update({ quantita_prelevata: Math.max(0, (componente.quantita_prelevata || 0) - (p.quantita || 0)) })
          .eq("id", componente.id);
      }
    }
  }
  await supabase.from("prelievi_kit_riserva").delete().eq("sostituzione_id", sostituzioneId);
  const { error } = await supabase.from("sostituzioni").delete().eq("id", sostituzioneId);
  // il kit resta "aperto": una scatola aperta non si richiude perche' si
  // cancella una riga, e chi la trovera' al rientro la trovera' aperta
  return error ? error.message : null;
}

/** Le edizioni per cui e' partito un pacco. Serve a far comparire il tasto
 *  "Cambi e integrazioni" solo dove c'e' una scorta da cui prendere. */
export async function edizioniConSpedizione(): Promise<Set<string>> {
  const { data } = await supabase
    .from("spedizioni_corso").select("corso_data_id").in("stato", ["spedita", "in_rientro"]);
  return new Set((data || []).map((r: { corso_data_id: string }) => r.corso_data_id));
}
