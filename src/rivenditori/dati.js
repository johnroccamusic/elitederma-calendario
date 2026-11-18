// LISTINI RIVENDITORI: lettura e scrittura. 18/11/2026.
//
// Il conto non sta qui. Prezzi per livello, sconto cedibile, margine e
// nota li fa il database (vista `v_listino_rivenditori`, funzioni
// `listino_cedibile` e `listino_prezzo_livello`): questo file li porta in
// pagina e riporta indietro le correzioni.
import { supabase } from "../supabase.js";
import { nettoDaLordo } from "../prezzi/netto.js";

// ---------- configurazione ----------
export async function leggiLivelli() {
  const { data, error } = await supabase.from("rivenditori_livelli").select("*").order("ordine");
  if (error) throw error;
  return data || [];
}

export async function leggiParametri() {
  const { data, error } = await supabase.from("rivenditori_parametri").select("*").order("chiave");
  if (error) throw error;
  return data || [];
}

export function parametro(parametri, chiave, seManca) {
  const r = (parametri || []).find((p) => p.chiave === chiave);
  const n = Number(r?.numero);
  return Number.isFinite(n) ? n : seManca;
}

// Un parametro si scrive con il nome di chi lo scrive: da lì il registro
// delle modifiche (trigger `trg_rivenditori_traccia_parametri`) sa chi è
// stato. Il conteggio delle righe cambiate non è un vezzo: un update che
// non tocca niente risponde «va bene» (regola del 9/11/2026).
export async function salvaParametro(chiave, numero, chi) {
  const { data, error } = await supabase.from("rivenditori_parametri")
    .update({ numero, aggiornato_il: new Date().toISOString(), aggiornato_da: chi || null })
    .eq("chiave", chiave).select("chiave");
  if (error) throw error;
  if (!data?.length) throw new Error("Il database non ha cambiato nessuna riga: ricarica la pagina e riprova.");
}

export async function salvaLivello(id, campi, chi) {
  const { data, error } = await supabase.from("rivenditori_livelli")
    .update({ ...campi, aggiornato_il: new Date().toISOString(), aggiornato_da: chi || null })
    .eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Il database non ha cambiato nessuna riga: ricarica la pagina e riprova.");
}

// ---------- il listino ----------
//
// Due letture, e la differenza è il punto 6 della specifica.
//
// `leggiListinoAdmin` legge la vista, che porta costo, margine e sconto
// cedibile: serve a chi amministra per decidere.
//
// `leggiListinoDaEsportare` chiama una funzione `security definer` che
// quei tre campi NON li restituisce. Non è l'interfaccia che li nasconde:
// il server non li manda. Il file per i rivenditori nasce da questa
// seconda lettura, non filtrando la prima.
export async function leggiListinoAdmin() {
  const { data, error } = await supabase.from("v_listino_rivenditori").select("*")
    .order("blocco_ordine").order("nome");
  if (error) throw error;
  return data || [];
}

export async function leggiListinoDaEsportare() {
  const { data, error } = await supabase.rpc("listino_rivenditori_export");
  if (error) throw error;
  return (data || []).slice().sort((a, b) =>
    (a.blocco_ordine - b.blocco_ordine) || String(a.nome).localeCompare(String(b.nome), "it"));
}

// Prezzo al pubblico e costo, corretti dal listino.
//
// Tre cose, e ognuna è una regola già pagata altrove:
//
// 1. si scrive il LORDO e il netto lo segue a sei decimali
//    (`nettoDaLordo`, un posto solo): schiacciarlo a due decimali
//    riporterebbe 39,90 a 39,89 su un prezzo su cinque;
// 2. se il prodotto è pubblicato, PRIMA il sito e poi l'archivio — se il
//    sito rifiuta, meglio restare indietro che divergere. È lo stesso
//    ordine della scheda prodotto e dell'elenco a righe;
// 3. si passa da `listino_scrivi_prezzo`, che porta con sé il nome di chi
//    scrive: è così che la modifica finisce nel registro con un nome
//    invece di «non registrato».
export async function scriviPrezzoECosto({ prodotto, lordo, costo, chi }) {
  const iva = Number(prodotto.aliquota_iva ?? 22) || 0;
  const cambiaPrezzo = lordo != null && Number(lordo) !== Number(prodotto.pubblico_lordo);
  const cambiaCosto = costo !== undefined && Number(costo ?? NaN) !== Number(prodotto.costo ?? NaN)
    && !(costo == null && prodotto.costo == null);
  if (!cambiaPrezzo && !cambiaCosto) return { fatto: false };

  if (cambiaPrezzo && prodotto.sullo_shop) {
    const { data, error } = await supabase.functions.invoke("woo-aggiorna-prodotto", {
      body: { prodottoId: prodotto.id, prezzoVendita: Number(lordo) },
    });
    if (error || data?.errore) {
      throw new Error(`Prezzo non aggiornato sul sito: ${data?.errore || error?.message || "errore"}`);
    }
  }

  const { error } = await supabase.rpc("listino_scrivi_prezzo", {
    p_prodotto_id: prodotto.id,
    p_prezzo_netto: cambiaPrezzo ? nettoDaLordo(Number(lordo), iva) : null,
    p_costo: cambiaCosto ? (costo == null ? null : Number(costo)) : null,
    p_chi: chi || null,
    p_scrivi_prezzo: cambiaPrezzo,
    p_scrivi_costo: cambiaCosto,
  });
  if (error) throw error;
  return { fatto: true, prezzo: cambiaPrezzo, costo: cambiaCosto };
}

export async function leggiModifiche(limite = 200) {
  const { data, error } = await supabase.from("rivenditori_modifiche")
    .select("*").order("quando", { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}

// ---------- i rivenditori ----------
export async function leggiRivenditori() {
  const { data, error } = await supabase.from("rivenditori").select("*").order("nome");
  if (error) throw error;
  return data || [];
}

export async function salvaRivenditore(id, campi) {
  if (id == null) {
    const { data, error } = await supabase.from("rivenditori").insert(campi).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("rivenditori").update(campi).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function cancellaRivenditore(id) {
  const { error } = await supabase.from("rivenditori").delete().eq("id", id);
  if (error) throw error;
}

export async function leggiOrdini() {
  const { data, error } = await supabase.from("rivenditori_ordini").select("*").order("data", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function aggiungiOrdine(riga) {
  const { data, error } = await supabase.from("rivenditori_ordini").insert(riga).select("*").single();
  if (error) throw error;
  return data;
}

export async function cancellaOrdine(id) {
  const { error } = await supabase.from("rivenditori_ordini").delete().eq("id", id);
  if (error) throw error;
}

export async function leggiVerifiche() {
  const { data, error } = await supabase.from("rivenditori_verifiche").select("*").order("periodo_al", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function aggiungiVerifica(riga) {
  const { data, error } = await supabase.from("rivenditori_verifiche").insert(riga).select("*").single();
  if (error) throw error;
  return data;
}

// ---------- il regolamento ----------
export async function leggiRegolamenti() {
  const { data, error } = await supabase.from("rivenditori_regolamento")
    .select("*").order("in_vigore_dal", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function salvaRegolamento(riga) {
  const { data, error } = await supabase.from("rivenditori_regolamento").insert(riga).select("*").single();
  if (error) throw error;
  return data;
}

// Una versione sola in vigore: l'indice unico parziale sul database lo
// fa rispettare comunque, qui si spegne la precedente prima di accendere
// quella nuova.
export async function attivaRegolamento(id) {
  const spegni = await supabase.from("rivenditori_regolamento").update({ attivo: false }).neq("id", id).eq("attivo", true);
  if (spegni.error) throw spegni.error;
  const { data, error } = await supabase.from("rivenditori_regolamento").update({ attivo: true }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Il database non ha cambiato nessuna riga: ricarica la pagina e riprova.");
}

// ---------- la scelta dei livelli da esportare ----------
//
// Si ricorda fra una volta e l'altra, come i reparti esclusi del listino
// vecchio: chi prepara un listino per un rivenditore Professional lo
// rifà con la stessa spunta, e rimetterla ogni volta è lavoro ripetuto.
export const CHIAVE_LIVELLI_SCELTI = "listini_rivenditori_livelli_scelti";

export async function leggiLivelliScelti() {
  const { data, error } = await supabase.from("impostazioni_layout_tabelle")
    .select("valore").eq("chiave", CHIAVE_LIVELLI_SCELTI).maybeSingle();
  if (error) return null;
  return Array.isArray(data?.valore) ? data.valore.map(String) : null;
}

export async function salvaLivelliScelti(codici) {
  const { error } = await supabase.from("impostazioni_layout_tabelle")
    .upsert({ chiave: CHIAVE_LIVELLI_SCELTI, valore: codici, aggiornato_il: new Date().toISOString() }, { onConflict: "chiave" });
  if (error) throw error;
}
