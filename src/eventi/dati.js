// Le letture e le scritture della gestione eventi, tutte qui.
//
// Un evento non e' un corso: non ha iscritti, quote, kit da consegnare
// ne' una busta da chiudere. Vive nella sua tabella, e queste funzioni
// sono l'unico punto da cui si tocca.
import { supabase } from "../supabase.js";

export const STATI_EVENTO = [
  { v: "programmato", l: "Programmato" },
  { v: "concluso", l: "Concluso" },
  { v: "annullato", l: "Annullato" },
];

export async function leggiEventi() {
  const { data, error } = await supabase.from("eventi").select("*").order("data_inizio", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function creaEvento(campi) {
  const { data, error } = await supabase.from("eventi").insert(campi).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvaEvento(id, campi) {
  const { error } = await supabase.from("eventi")
    .update({ ...campi, aggiornato_il: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaEvento(id) {
  // le righe figlie se ne vanno da sole (on delete cascade)
  const { error } = await supabase.from("eventi").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- le quattro liste attaccate a un evento -------------------------------

export async function leggiRighe(tabella, eventoId, ordinaPer = "ordine") {
  const { data, error } = await supabase.from(tabella).select("*").eq("evento_id", eventoId).order(ordinaPer);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function aggiungiRiga(tabella, campi) {
  const { data, error } = await supabase.from(tabella).insert(campi).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvaRiga(tabella, id, campi) {
  const { error } = await supabase.from(tabella).update(campi).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminaRiga(tabella, id) {
  const { error } = await supabase.from(tabella).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- hotel: gruppi e stanze ------------------------------------------------

export async function leggiHotelEvento(eventoId) {
  const { data: gruppi, error } = await supabase.from("eventi_hotel_gruppi")
    .select("*").eq("evento_id", eventoId).order("ordine");
  if (error) throw new Error(error.message);
  const ids = (gruppi || []).map((g) => g.id);
  if (ids.length === 0) return { gruppi: [], stanze: [] };
  const { data: stanze, error: e2 } = await supabase.from("eventi_hotel_stanze")
    .select("*").in("gruppo_id", ids).order("ordine");
  if (e2) throw new Error(e2.message);
  return { gruppi: gruppi || [], stanze: stanze || [] };
}

// --- come si legge una data --------------------------------------------------

export function periodoEvento(evento) {
  const da = evento?.data_inizio;
  const a = evento?.data_fine || evento?.data_inizio;
  if (!da) return "data da definire";
  const f = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  if (!a || a === da) return f(da);
  // stesso mese: "3–6 ottobre 2026", altrimenti le due date per esteso
  const [ay, am] = da.split("-"); const [by, bm] = a.split("-");
  if (ay === by && am === bm) {
    const giorno = (d) => Number(d.split("-")[2]);
    const mese = new Date(`${a}T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    return `${giorno(da)}–${giorno(a)} ${mese}`;
  }
  return `${f(da)} → ${f(a)}`;
}

export function quantiGiorni(evento) {
  if (!evento?.data_inizio) return 0;
  const a = new Date(`${evento.data_inizio}T12:00:00`);
  const b = new Date(`${evento.data_fine || evento.data_inizio}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Quanto di quel materiale e' stato venduto al POS all'evento.
//
// Serve a chiudere il conto della consegna: quello che e' partito meno
// quello che e' tornato deve fare quello che si e' venduto. Se non
// torna, o manca qualcosa o qualcuno ha dimenticato di segnarlo.
// Quello che e' USCITO dalla scatola dell'evento: venduto e omaggiato,
// separati. Un pezzo regalato non porta ricavo ma non e' nemmeno
// tornato a casa: contarlo solo nel venduto faceva risultare "mancante"
// tutto cio' che si regala in fiera, che e' esattamente quello che in
// fiera si fa. Il conto della consegna deve pareggiare sulla SOMMA.
export async function usciteAllEvento(eventoId) {
  const { data, error } = await supabase
    .from("vendite_shop").select("prodotti, tipo_movimento")
    .eq("evento_id", eventoId);
  if (error) throw new Error(error.message);
  const venduto = {}, omaggiato = {};
  (data || []).forEach((v) => {
    const dove = v.tipo_movimento === "omaggio" ? omaggiato : venduto;
    (Array.isArray(v.prodotti) ? v.prodotti : []).forEach((r) => {
      if (!r.prodotto_id) return;
      dove[r.prodotto_id] = (dove[r.prodotto_id] || 0) + (Number(r.quantita) || 0);
    });
  });
  return { venduto, omaggiato };
}

// Una spesa creata dalla scheda dell'evento.
//
// I default di colonna di `spese` sono una trappola: `stato` nasce
// 'pagata' e `iva_percentuale` nasce 22. Un insert che omette un campo
// non lo lascia vuoto, gli mette addosso una decisione che nessuno ha
// preso — ed e' gia' costato 239,68 euro di credito IVA inesistente
// sulle voci di costo dei corsi. Quindi qui si scrive TUTTO, esplicito.
export const STATI_SPESA_EVENTO = [
  { v: "pagata", l: "Pagata" },
  { v: "fatturata", l: "Fatturata, da pagare" },
  { v: "impegnata", l: "Impegnata" },
  { v: "preventivata", l: "Preventivata" },
];
export const ALIQUOTE_IVA_EVENTO = [22, 10, 4, 0];

export async function creaSpesaEvento(evento, campi) {
  // lo stato non ha un ripiego: e' proprio quello che la colonna
  // decideva da sola ('pagata'), e una spesa data per pagata finisce in
  // prima nota come uscita di cassa che nessuno ha fatto
  if (!STATI_SPESA_EVENTO.some((s) => s.v === campi.stato)) {
    throw new Error("Stato della spesa mancante o non valido.");
  }
  const imponibile = Math.round((Number(campi.imponibile) || 0) * 100) / 100;
  const iva = Number(campi.iva_percentuale) || 0;
  const totale = Math.round(imponibile * (1 + iva / 100) * 100) / 100;
  // la data: quella scritta, altrimenti il giorno in cui l'evento
  // finisce. Mai nulla — prima nota e ciclo passivo leggono le colonne
  // della data e una spesa senza data sparisce da tutti e due
  const data = campi.data_documento || evento.data_fine || evento.data_inizio || new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("spese").insert({
    descrizione: campi.descrizione || null,
    categoria_id: campi.categoria_id || null,
    sottocategoria_id: campi.sottocategoria_id || null,
    fornitore_id: campi.fornitore_id || null,
    imponibile,
    iva_percentuale: iva,
    totale,
    data_documento: data,
    data_pagamento: campi.stato === "pagata" ? data : null,
    competenza_da: data,
    competenza_a: data,
    tipo_ambito: "evento",
    evento_id: evento.id,
    sede_id: null, corso_id: null, classe_id: null,
    stato: campi.stato,
    origine: "manuale",
    includi_analisi_costi: true,
    note: campi.note || null,
  });
  if (error) throw new Error(error.message);
}
