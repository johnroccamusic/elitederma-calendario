// La scheda di fine corso: cosa torna indietro.
//
// Il punto di tutto il modulo e' che questa scheda non nasce vuota. Le
// vendite dal kit le ha scritte il POS quando sono state battute, le
// sostituzioni le ha scritte la master col pezzo rotto in mano: qui si
// conferma, non si compila. Quello che resta da dichiarare e' solo cio'
// che nessuno poteva sapere prima — quanti sfusi tornano davvero, e se un
// dermografo e' tornato rotto.
//
// Una regola sola vale su tutto: si chiude sempre. Se i conti non tornano
// si segnala e si va avanti, perche' una master ferma in aula davanti a
// una scheda che non si chiude non risolve la discrepanza, la inventa.
// L'unica eccezione sono i dermografi, che sono i pezzi piu' costosi del
// pacco e vanno quadrati.

import { supabase } from "../supabase.js";

export interface RigaRientro {
  rigaId: string;
  tipo: "kit_allievo" | "kit_riserva" | "sfuso" | "dermografo";
  kitId: string | null;
  prodottoId: string | null;
  modello: string | null;
  spediti: number;
  /** pezzi gia' usciti e registrati: vendite dal POS e sostituzioni */
  usciti: number;
  /** quanti di quegli usciti erano vendite */
  venduti: number;
  /** quello che il sistema si aspetta di rivedere */
  atteso: number;
}

export interface IstanzaRientro {
  id: string;
  progressivo: number;
  kitId: string;
  stato: string;
  iscrittoId: string | null;
  componenti: { prodottoId: string; iniziale: number; prelevata: number }[];
}

export interface DatiRientro {
  spedizioneId: string;
  corsoDataId: string;
  rientro: { id: string; stato: string; ha_anomalie: boolean; chiuso_ts: string | null } | null;
  righe: RigaRientro[];
  istanze: IstanzaRientro[];
  /** i difettosi che la master ha gia' dichiarato durante il corso */
  difettosiAttesi: { prodottoId: string; nota: string | null }[];
  /** quante righe erano gia' state dichiarate: serve a non ripartire da zero */
  dichiarazioni: Record<string, { rientrata: number; guasta: number; consegnata: number }>;
}

/** Tutto quello che serve alla scheda, in una lettura sola. */
export async function caricaRientro(corsoDataId: string | null): Promise<DatiRientro | null> {
  if (!corsoDataId) return null;
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("id, stato").eq("corso_data_id", corsoDataId)
    .order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;

  const [{ data: righe }, { data: istanze }, { data: rientro }] = await Promise.all([
    supabase.from("spedizione_righe").select("*").eq("spedizione_id", spedizione.id).order("ts"),
    supabase.from("kit_riserva_istanze").select("*").eq("spedizione_id", spedizione.id).order("progressivo"),
    supabase.from("rientri").select("*").eq("spedizione_id", spedizione.id).maybeSingle(),
  ]);

  const idIstanze = (istanze || []).map((i) => i.id);
  const [{ data: componenti }, { data: prelievi }, { data: sostituzioni }] = await Promise.all([
    idIstanze.length
      ? supabase.from("kit_riserva_componenti").select("*").in("kit_riserva_id", idIstanze)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("prelievi_kit_riserva").select("*"),
    supabase.from("sostituzioni").select("*").eq("spedizione_id", spedizione.id),
  ]);

  // i prelievi che riguardano questa spedizione: o da un suo kit, o da una
  // sua riga
  const idRighe = new Set((righe || []).map((r) => r.id));
  const miei = (prelievi || []).filter(
    (p) => (p.kit_riserva_id && idIstanze.includes(p.kit_riserva_id)) || (p.spedizione_riga_id && idRighe.has(p.spedizione_riga_id)),
  );

  const perRiga: Record<string, { usciti: number; venduti: number }> = {};
  miei.forEach((p) => {
    if (!p.spedizione_riga_id) return;
    const v = perRiga[p.spedizione_riga_id] || (perRiga[p.spedizione_riga_id] = { usciti: 0, venduti: 0 });
    v.usciti += p.quantita || 0;
    if (p.motivo === "vendita") v.venduti += p.quantita || 0;
  });

  const righeRientro: RigaRientro[] = (righe || []).map((r) => {
    const v = perRiga[r.id] || { usciti: 0, venduti: 0 };
    return {
      rigaId: r.id,
      tipo: r.tipo,
      kitId: r.kit_id || null,
      prodottoId: r.prodotto_id || null,
      modello: r.modello || null,
      spediti: r.quantita_spedita || 0,
      usciti: v.usciti,
      venduti: v.venduti,
      atteso: Math.max(0, (r.quantita_spedita || 0) - v.usciti),
    };
  });

  const perIstanza: Record<string, IstanzaRientro["componenti"]> = {};
  (componenti || []).forEach((c) => {
    (perIstanza[c.kit_riserva_id] || (perIstanza[c.kit_riserva_id] = [])).push({
      prodottoId: c.prodotto_id, iniziale: c.quantita_iniziale || 0, prelevata: c.quantita_prelevata || 0,
    });
  });

  const dichiarazioni: Record<string, { rientrata: number; guasta: number; consegnata: number }> = {};
  if (rientro) {
    const { data: righeGia } = await supabase.from("rientro_righe").select("*").eq("rientro_id", rientro.id);
    (righeGia || []).forEach((r) => {
      dichiarazioni[r.spedizione_riga_id] = {
        rientrata: r.quantita_rientrata || 0,
        guasta: r.quantita_guasta || 0,
        consegnata: r.quantita_consegnata || 0,
      };
    });
  }

  return {
    spedizioneId: spedizione.id,
    corsoDataId,
    rientro: rientro || null,
    righe: righeRientro,
    istanze: (istanze || []).map((i) => ({
      id: i.id, progressivo: i.progressivo, kitId: i.kit_id, stato: i.stato,
      iscrittoId: i.iscritto_id || null, componenti: perIstanza[i.id] || [],
    })),
    difettosiAttesi: (sostituzioni || [])
      .filter((s) => s.difettoso_rientra)
      .map((s) => ({ prodottoId: s.prodotto_sostituito_id, nota: s.nota || null })),
    dichiarazioni,
  };
}

/** Il destino di un kit di riserva: e' un tap, e cambia solo lo stato. */
export async function segnaDestinoKit(
  istanzaId: string,
  stato: "rientrato_chiuso" | "consegnato_intero" | "aperto",
  iscrittoId: string | null = null,
): Promise<string | null> {
  const { error } = await supabase
    .from("kit_riserva_istanze")
    .update({ stato, iscritto_id: stato === "consegnato_intero" ? iscrittoId : null })
    .eq("id", istanzaId);
  return error ? error.message : null;
}

export interface DichiarazioneRiga {
  rigaId: string;
  tipo: RigaRientro["tipo"];
  rientrata: number;
  guasta: number;
  consegnata: number;
  spediti: number;
  venduti: number;
}

/**
 * I dermografi sono l'unico blocco duro di tutta la scheda: rientrati
 * buoni + rientrati guasti + venduti devono fare i pezzi spediti. Sono i
 * pezzi piu' costosi del pacco, e un conto che non torna li' e' una
 * perdita, non una svista.
 */
export function dermografiNonQuadrano(righe: DichiarazioneRiga[]): DichiarazioneRiga[] {
  return righe.filter(
    (r) => r.tipo === "dermografo" && r.rientrata + r.guasta + r.venduti !== r.spediti,
  );
}

/**
 * Chiude la scheda. Si chiude SEMPRE, tranne che sui dermografi: le
 * discrepanze si scrivono come anomalie e viaggiano verso chi ricevera'
 * il pacco, che e' l'unico che puo' verificarle allo scaffale.
 */
export async function chiudiRientro({
  spedizioneId, masterId, righe, venditeDichiarate, venditeTrovate,
}: {
  spedizioneId: string;
  masterId: string | null;
  righe: DichiarazioneRiga[];
  venditeDichiarate: number;
  venditeTrovate: number;
}): Promise<{ errore?: string; anomalie?: number }> {
  const bloccanti = dermografiNonQuadrano(righe);
  if (bloccanti.length > 0) {
    return { errore: "I dermografi non quadrano: rientrati, guasti e venduti devono fare i pezzi partiti." };
  }

  const { data: rientro, error } = await supabase
    .from("rientri")
    .upsert({ spedizione_id: spedizioneId, master_id: masterId }, { onConflict: "spedizione_id" })
    .select().single();
  if (error || !rientro) return { errore: error?.message || "non riesco ad aprire la scheda" };

  const note: { tipo: string; testo: string; dichiarato?: number; trovato?: number }[] = [];
  if (venditeDichiarate !== venditeTrovate) {
    note.push({
      tipo: venditeDichiarate > venditeTrovate ? "vendite_non_riscontrate" : "vendite_non_dichiarate",
      dichiarato: venditeDichiarate, trovato: venditeTrovate,
      testo: `Dichiarate ${venditeDichiarate} vendite dalle scorte, trovate ${venditeTrovate} operazioni al POS.`,
    });
  }
  righe.forEach((r) => {
    const consumato = r.spediti - r.rientrata - r.guasta - r.venduti - r.consegnata;
    if (consumato < 0) {
      note.push({
        tipo: "altro",
        testo: `Tornano piu' pezzi di quanti ne siano partiti: ${r.rientrata + r.guasta} su ${r.spediti}.`,
      });
    }
  });

  await supabase.from("rientro_righe").delete().eq("rientro_id", rientro.id);
  if (righe.length > 0) {
    const { error: erroreRighe } = await supabase.from("rientro_righe").insert(
      righe.map((r) => ({
        rientro_id: rientro.id,
        spedizione_riga_id: r.rigaId,
        tipo: r.tipo,
        quantita_rientrata: r.rientrata,
        quantita_venduta: r.venduti,
        quantita_guasta: r.guasta,
        quantita_consegnata: r.consegnata,
        // congelato adesso: e' il dato su cui poggia l'analisi dei
        // consumi, e non deve cambiare se domani si corregge la
        // spedizione
        quantita_consumata_calcolata: Math.max(0, r.spediti - r.rientrata - r.guasta - r.venduti - r.consegnata),
      })),
    );
    if (erroreRighe) return { errore: erroreRighe.message };
  }

  const { error: erroreChiusura } = await supabase.from("rientri").update({
    stato: "chiuso",
    chiuso_ts: new Date().toISOString(),
    ha_anomalie: note.length > 0,
    note_anomalie: note,
  }).eq("id", rientro.id);
  if (erroreChiusura) return { errore: erroreChiusura.message };

  // da qui in poi il pacco e' in viaggio verso casa
  await supabase.from("spedizioni_corso").update({ stato: "in_rientro" }).eq("id", spedizioneId);
  return { anomalie: note.length };
}

export interface VoceListaRientro {
  prodottoId: string | null;
  modello: string | null;
  tipo: string;
  kitId: string | null;
  /** pezzi integri che tornano a scaffale */
  rientrata: number;
  /** pezzi che tornano rotti: NON tornano a scaffale */
  guasta: number;
  spediti: number;
  consumata: number;
}

/**
 * La lista di rientro: cosa torna davvero, come l'ha dichiarata la master.
 *
 * E' un'altra cosa dalla lista di allestimento. Quella dice cosa e'
 * partito; questa dice cosa torna — e in mezzo ci sono i pezzi consumati
 * in aula, quelli venduti e quelli usati per una sostituzione, che
 * indietro non tornano. Ricaricare in magazzino la lista di partenza
 * significherebbe contare pezzi che non ci sono.
 *
 * Null finche' la master non ha chiuso: prima non c'e' niente da leggere.
 */
export async function leggiListaRientro(corsoDataId: string | null): Promise<{
  chiusoIl: string | null;
  haAnomalie: boolean;
  note: { testo: string }[];
  voci: VoceListaRientro[];
} | null> {
  if (!corsoDataId) return null;
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("id").eq("corso_data_id", corsoDataId)
    .order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;
  const { data: rientro } = await supabase
    .from("rientri").select("*").eq("spedizione_id", spedizione.id).maybeSingle();
  if (!rientro || rientro.stato !== "chiuso") return null;

  const [{ data: righeRientro }, { data: righeSped }] = await Promise.all([
    supabase.from("rientro_righe").select("*").eq("rientro_id", rientro.id),
    supabase.from("spedizione_righe").select("*").eq("spedizione_id", spedizione.id),
  ]);
  const perRiga: Record<string, any> = {};
  (righeSped || []).forEach((r) => { perRiga[r.id] = r; });

  return {
    chiusoIl: rientro.chiuso_ts || null,
    haAnomalie: !!rientro.ha_anomalie,
    note: Array.isArray(rientro.note_anomalie) ? rientro.note_anomalie : [],
    voci: (righeRientro || []).map((r) => {
      const sped = perRiga[r.spedizione_riga_id] || {};
      return {
        prodottoId: sped.prodotto_id || null,
        modello: sped.modello || null,
        tipo: r.tipo,
        kitId: sped.kit_id || null,
        rientrata: r.quantita_rientrata || 0,
        guasta: r.quantita_guasta || 0,
        spediti: sped.quantita_spedita || 0,
        consumata: r.quantita_consumata_calcolata || 0,
      };
    }),
  };
}

/**
 * I pezzi tornati rotti finiscono qui, non a scaffale. Un pigmento
 * rientrato perche' non funzionava, ricaricato insieme agli altri, domani
 * lo si vende a qualcuno.
 */
export async function registraDifettosi({
  corsoDataId, voci,
}: {
  corsoDataId: string;
  voci: { prodottoId: string; quantita: number; nota: string | null }[];
}): Promise<string | null> {
  const daScrivere = voci.filter((v) => v.prodottoId && v.quantita > 0);
  if (daScrivere.length === 0) return null;
  const { error } = await supabase.from("resi_difettosi").insert(
    daScrivere.map((v) => ({
      prodotto_id: v.prodottoId,
      quantita: v.quantita,
      corso_data_id: corsoDataId,
      stato: "da_controllare",
      nota: v.nota,
    })),
  );
  return error ? error.message : null;
}

/**
 * Cosa rimettere davvero in magazzino quando il pacco e' stato controllato.
 *
 * Non e' la lista di allestimento al contrario: fra la partenza e il
 * ritorno ci sono i pezzi consumati in aula, quelli venduti e quelli usati
 * per una sostituzione, che indietro non tornano. E i pezzi rientrati
 * guasti non vanno a scaffale: uno che rientra perche' non funziona,
 * ricaricato insieme agli altri, domani lo si vende a qualcuno.
 *
 * I kit si sciolgono nei loro prodotti: uno rientrato chiuso restituisce
 * tutto il contenuto, uno aperto solo quello che non ne e' uscito, uno
 * dato intero a un'allieva niente.
 *
 * Null se la master non ha ancora chiuso: allora chi riceve il pacco non
 * ha una lista, e il ripristino resta quello di prima.
 */
export async function calcolaRipristino(
  corsoDataId: string | null,
  corsiKitProdotti: { kit_id: string | null; prodotto_id: string; tipo: string; quantita: number }[],
): Promise<{
  perProdotto: Record<string, number>;
  perModello: Record<string, number>;
  guastiProdotto: Record<string, number>;
  guastiModello: Record<string, number>;
} | null> {
  if (!corsoDataId) return null;
  const { data: spedizione } = await supabase
    .from("spedizioni_corso").select("id").eq("corso_data_id", corsoDataId)
    .order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!spedizione) return null;
  const { data: rientro } = await supabase
    .from("rientri").select("id, stato").eq("spedizione_id", spedizione.id).maybeSingle();
  if (!rientro || rientro.stato !== "chiuso") return null;

  const [{ data: righeRientro }, { data: righeSped }, { data: istanze }] = await Promise.all([
    supabase.from("rientro_righe").select("*").eq("rientro_id", rientro.id),
    supabase.from("spedizione_righe").select("*").eq("spedizione_id", spedizione.id),
    supabase.from("kit_riserva_istanze").select("*").eq("spedizione_id", spedizione.id),
  ]);
  const idIstanze = (istanze || []).map((i) => i.id);
  const { data: componenti } = idIstanze.length
    ? await supabase.from("kit_riserva_componenti").select("*").in("kit_riserva_id", idIstanze)
    : { data: [] as any[] };

  const perProdotto: Record<string, number> = {};
  const perModello: Record<string, number> = {};
  const guastiProdotto: Record<string, number> = {};
  const guastiModello: Record<string, number> = {};
  const somma = (m: Record<string, number>, k: string | null, q: number) => {
    if (!k || !(q > 0)) return;
    m[k] = (m[k] || 0) + q;
  };
  const distinta = (kitId: string) =>
    (corsiKitProdotti || []).filter((r) => r.kit_id === kitId && r.tipo === "kit");

  const perRigaSped: Record<string, any> = {};
  (righeSped || []).forEach((r) => { perRigaSped[r.id] = r; });

  (righeRientro || []).forEach((r) => {
    const sped = perRigaSped[r.spedizione_riga_id];
    if (!sped) return;
    if (sped.tipo === "sfuso") {
      somma(perProdotto, sped.prodotto_id, r.quantita_rientrata || 0);
      somma(guastiProdotto, sped.prodotto_id, r.quantita_guasta || 0);
    } else if (sped.tipo === "dermografo") {
      if (sped.prodotto_id) {
        somma(perProdotto, sped.prodotto_id, r.quantita_rientrata || 0);
        somma(guastiProdotto, sped.prodotto_id, r.quantita_guasta || 0);
      } else {
        somma(perModello, sped.modello, r.quantita_rientrata || 0);
        somma(guastiModello, sped.modello, r.quantita_guasta || 0);
      }
    } else if (sped.tipo === "kit_allievo" && sped.kit_id) {
      // i kit non consegnati tornano interi, e si sciolgono nel contenuto
      const quanti = r.quantita_rientrata || 0;
      if (quanti > 0) distinta(sped.kit_id).forEach((c) => somma(perProdotto, c.prodotto_id, (c.quantita || 0) * quanti));
    }
  });

  // i kit di riserva: dipende da che fine ha fatto ciascuno
  const compPerIstanza: Record<string, any[]> = {};
  (componenti || []).forEach((c) => { (compPerIstanza[c.kit_riserva_id] || (compPerIstanza[c.kit_riserva_id] = [])).push(c); });
  (istanze || []).forEach((k) => {
    if (k.stato === "consegnato_intero") return; // e' andato via, non torna
    (compPerIstanza[k.id] || []).forEach((c) => {
      const resta = k.stato === "rientrato_chiuso"
        ? (c.quantita_iniziale || 0)
        : Math.max(0, (c.quantita_iniziale || 0) - (c.quantita_prelevata || 0));
      somma(perProdotto, c.prodotto_id, resta);
    });
  });

  return { perProdotto, perModello, guastiProdotto, guastiModello };
}
