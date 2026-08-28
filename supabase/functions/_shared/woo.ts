// Logica condivisa tra "woo-webhook" (in tempo reale) e
// "woo-import-storico" (una tantum): entrambi ricevono un ordine
// WooCommerce con la stessa identica forma (è lo stesso oggetto "Order"
// della REST API, sia che arrivi via webhook sia via GET /orders) e lo
// trasformano in una riga di vendite_shop.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ritorna null se il payload non è un vero ordine (es. il "ping" di
// verifica che WooCommerce manda quando un webhook viene attivato)
export function mappaOrdine(ordine: any): Record<string, unknown> | null {
  if (!ordine || typeof ordine !== "object" || !ordine.id) return null;

  const totale = parseFloat(ordine.total) || 0;
  const totaleIva = ordine.total_tax != null ? parseFloat(ordine.total_tax) || 0 : null;
  const totaleImponibile = totaleIva != null ? round2(totale - totaleIva) : null;

  const nome = [ordine.billing?.first_name, ordine.billing?.last_name].filter(Boolean).join(" ").trim();

  // oltre al nome (che cambia nel tempo e non basta a riconoscere il
  // prodotto) si tiene quello che WooCommerce dice di certo: il codice del
  // prodotto, quello della variazione e lo SKU. Sono la chiave per
  // scaricare il magazzino anche quando il nome sul sito è diverso da
  // quello in anagrafica
  const prodotti = Array.isArray(ordine.line_items)
    ? ordine.line_items.map((voce: any) => ({
        nome: voce.name || null,
        quantita: voce.quantity ?? null,
        prezzo_unitario: voce.price != null ? Number(voce.price) : null,
        totale_riga: voce.total != null ? parseFloat(voce.total) : null,
        woo_product_id: voce.product_id ?? null,
        woo_variation_id: voce.variation_id ? voce.variation_id : null,
        sku: voce.sku || null,
      }))
    : [];

  const dataOrdine = ordine.date_created_gmt ? `${ordine.date_created_gmt}Z` : ordine.date_created || null;

  return {
    woo_order_id: ordine.id,
    numero_ordine: ordine.number != null ? String(ordine.number) : null,
    data_ordine: dataOrdine,
    stato: ordine.status || null,
    cliente_nome: nome || null,
    cliente_email: ordine.billing?.email || null,
    totale,
    totale_imponibile: totaleImponibile,
    totale_iva: totaleIva,
    prodotti,
    payload_raw: ordine,
  };
}

// converte un timestamp UTC nel giorno di calendario vissuto in Italia:
// serve a confrontare data_ordine con punti_master_impostazioni.data_inizio
// (una colonna "date", senza ora) sullo stesso giorno che vive la master,
// non lo slice UTC usato altrove in questo file — vicino alla mezzanotte
// sbaglierebbe di un giorno
function dataLocaleRoma(dataIso: string): string {
  const parti = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(dataIso));
  const mappa = Object.fromEntries(parti.map((p) => [p.type, p.value]));
  return `${mappa.year}-${mappa.month}-${mappa.day}`;
}

// attribuisce (quando applicabile) una vendita alla master il cui referral
// code è stato usato nell'ordine — stessa identica logica per woo-webhook
// (tempo reale) e woo-import-storico (recupero storico), chiamata su
// "riga" PRIMA di scriverla su vendite_shop:
//
// - non scrive NIENTE se la raccolta punti non è configurata o l'ordine è
//   precedente alla sua data di inizio: operatore_tipo/id/nome vengono letti
//   anche da pagine che sommano SENZA filtro di data (Dashboard Master
//   storica), quindi attribuire un ordine precedente alla raccolta la
//   sporcherebbe in silenzio — meglio non scrivere nulla che scrivere e
//   filtrare solo a valle
// - fra più coupon riconosciuti sullo stesso ordine vince quello con
//   corsi_date_id nullo (referral manuale della master) sul codice
//   auto-generato per una specifica edizione di corso; a parità, il più vecchio
export async function attribuisciMasterReferral(supabase: any, ordine: any, riga: Record<string, unknown>): Promise<void> {
  const dataOrdine = riga.data_ordine as string | null;
  if (!dataOrdine) return;
  const { data: impostazioni } = await supabase.from("punti_master_impostazioni").select("data_inizio").limit(1).maybeSingle();
  if (!impostazioni) return;
  if (dataLocaleRoma(dataOrdine) < impostazioni.data_inizio) return;

  const codiciUsati: string[] = Array.isArray(ordine.coupon_lines)
    ? ordine.coupon_lines.map((c: any) => String(c.code || "").toLowerCase()).filter(Boolean)
    : [];
  if (codiciUsati.length === 0) return;

  const { data: couponTrovati } = await supabase
    .from("coupon")
    .select("id, codice, master_id, corsi_date_id, created_at")
    .in("codice", codiciUsati)
    .not("master_id", "is", null);
  if (!couponTrovati?.length) return;

  const scelto = [...couponTrovati].sort((a: any, b: any) => {
    const aManuale = a.corsi_date_id == null ? 0 : 1;
    const bManuale = b.corsi_date_id == null ? 0 : 1;
    if (aManuale !== bManuale) return aManuale - bManuale;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  })[0];

  const { data: masterRiga } = await supabase.from("master").select("nome").eq("id", scelto.master_id).maybeSingle();
  riga.coupon_id = scelto.id;
  riga.codice_coupon = scelto.codice;
  riga.operatore_tipo = "master";
  riga.operatore_id = scelto.master_id;
  riga.operatore_nome = masterRiga?.nome || null;
}

// stati WooCommerce che "impegnano" davvero lo stock (stessi due in cui
// WooCommerce stesso, di default, decrementa il proprio stock_quantity):
// solo la transizione DENTRO/FUORI da questo insieme scarica o ripristina
// lo stock — mai due volte per lo stesso ordine, vedi woo-webhook
// (confronta lo stato PRIMA dell'upsert con quello nuovo)
export const STATI_VIVI = ["processing", "completed"];

// per ogni riga dell'ordine che corrisponde a un prodotto "bundle" (per
// nome, stesso confronto usato ovunque nell'app), scarica o ripristina
// (direzione -1 / +1) i suoi componenti nella distinta base, proporzionati
// alla quantità venduta — un bundle non ha mai una giacenza propria.
// Ritorna gli id dei bundle toccati, per poi rispingere su WooCommerce la
// loro disponibilità ricalcolata (vedi sincronizzaDisponibilitaBundle)
export async function applicaMovimentoBundle(supabase: any, prodotti: any[], direzione: 1 | -1): Promise<Set<string>> {
  const bundleToccati = new Set<string>();
  for (const riga of prodotti || []) {
    const nome = String(riga?.nome || "").trim();
    const quantita = Number(riga?.quantita) || 0;
    if (!nome || !quantita) continue;
    const { data: prodotto } = await supabase.from("prodotti_shop").select("id, tipo_prodotto").ilike("nome", nome).maybeSingle();
    if (!prodotto || prodotto.tipo_prodotto !== "bundle") continue;
    const { data: componenti } = await supabase.from("bundle_componenti").select("componente_id, quantita_per_bundle").eq("bundle_id", prodotto.id);
    for (const c of componenti || []) {
      const { data: comp } = await supabase.from("prodotti_shop").select("quantita").eq("id", c.componente_id).maybeSingle();
      if (!comp) continue;
      const delta = direzione * quantita * c.quantita_per_bundle;
      const nuova = (comp.quantita || 0) + delta;
      if (nuova < 0) console.error(`Bundle "${nome}": componente ${c.componente_id} andrebbe sotto zero (${nuova}), portato a 0`);
      const { error } = await supabase.from("prodotti_shop").update({ quantita: Math.max(0, nuova) }).eq("id", c.componente_id);
      if (error) console.error(`Bundle "${nome}": errore aggiornando il componente ${c.componente_id}:`, error.message);
      else await supabase.from("movimenti_magazzino").insert({
        prodotto_id: c.componente_id, delta, origine: "ordine_online",
        nota: `Componente di "${nome}" venduto online`, utente: "WooCommerce",
      });
    }
    bundleToccati.add(prodotto.id);
  }
  return bundleToccati;
}

// riconosce a quale riga di anagrafica corrisponde una riga d'ordine.
// Il nome da solo non basta: cambia sul sito senza che l'app lo sappia
// ("Ago 1RLMT" contro "Ago 1RL MT"), e per le taglie WooCommerce manda il
// nome della variazione ("T-Shirt EliteDerma - XXL") che non è quello del
// prodotto in anagrafica. Si prova in ordine di affidabilità: variazione,
// SKU, codice prodotto, nome esatto, nome senza spazi e punteggiatura.
async function trovaProdottoDaRiga(supabase: any, riga: any) {
  const perCodice = async (colonna: string, valore: any) => {
    if (!valore) return null;
    const { data } = await supabase.from("prodotti_shop").select("id, tipo_prodotto, quantita").eq(colonna, valore).maybeSingle();
    return data || null;
  };
  const variazione = await perCodice("woo_variation_id", riga?.woo_variation_id);
  if (variazione) return variazione;
  if (riga?.sku) {
    const { data } = await supabase.from("prodotti_shop").select("id, tipo_prodotto, quantita").eq("sku", riga.sku).maybeSingle();
    if (data) return data;
  }
  // il codice prodotto vale solo per le righe non variabili: su una taglia
  // punterebbe alla vetrina, che non ha giacenza propria
  if (!riga?.woo_variation_id) {
    const prodotto = await perCodice("woo_product_id", riga?.woo_product_id);
    if (prodotto) return prodotto;
  }
  const nome = String(riga?.nome || "").trim();
  if (!nome) return null;
  const { data: perNome } = await supabase.from("prodotti_shop").select("id, tipo_prodotto, quantita").ilike("nome", nome).maybeSingle();
  if (perNome) return perNome;
  // ultima spiaggia: stesso nome a meno di spazi e punteggiatura
  const scarnifica = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cercato = scarnifica(nome);
  const { data: candidati } = await supabase.from("prodotti_shop").select("id, nome, tipo_prodotto, quantita").eq("attivo", true);
  const trovati = (candidati || []).filter((c: any) => scarnifica(String(c.nome || "")) === cercato);
  return trovati.length === 1 ? trovati[0] : null;  // se sono due, meglio non indovinare
}

export async function applicaMovimentoProdottiSemplici(supabase: any, prodotti: any[], direzione: 1 | -1): Promise<Set<string>> {
  const toccati = new Set<string>();
  for (const riga of prodotti || []) {
    const nome = String(riga?.nome || "").trim();
    const quantita = Number(riga?.quantita) || 0;
    if (!quantita) continue;
    const prodotto = await trovaProdottoDaRiga(supabase, riga);
    if (!prodotto) { console.error(`"${nome}": nessun prodotto in anagrafica, magazzino NON scaricato`); continue; }
    if (prodotto.tipo_prodotto === "bundle") continue;
    const delta = direzione * quantita;
    const nuova = (prodotto.quantita || 0) + delta;
    if (nuova < 0) console.error(`"${nome}": lo stock andrebbe a ${nuova}, portato a 0`);
    const { error } = await supabase.from("prodotti_shop").update({ quantita: Math.max(0, nuova) }).eq("id", prodotto.id);
    if (error) { console.error(`"${nome}": errore aggiornando lo stock:`, error.message); continue; }
    await supabase.from("movimenti_magazzino").insert({
      prodotto_id: prodotto.id, delta, origine: "ordine_online",
      nota: direzione < 0 ? "Venduto sullo shop online" : "Ordine online annullato/rimborsato", utente: "WooCommerce",
    });
    toccati.add(prodotto.id);
  }
  return toccati;
}

// ricalcola quanti bundle si possono comporre con le giacenze attuali dei
// componenti e lo spinge su WooCommerce (stock_quantity) per i bundle che
// hanno un woo_product_id — senza questo passaggio WooCommerce potrebbe
// continuare a vendere online un kit che i componenti non permettono più
// di comporre (overselling)
export async function sincronizzaDisponibilitaBundle(
  supabase: any,
  bundleIds: Set<string>,
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<void> {
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);
  for (const bundleId of bundleIds) {
    const { data: bundle } = await supabase.from("prodotti_shop").select("id, nome, woo_product_id").eq("id", bundleId).maybeSingle();
    if (!bundle?.woo_product_id) continue;
    const { data: componenti } = await supabase.from("bundle_componenti").select("componente_id, quantita_per_bundle").eq("bundle_id", bundleId);
    if (!componenti?.length) continue;
    let disponibilita = Infinity;
    for (const c of componenti) {
      const { data: comp } = await supabase.from("prodotti_shop").select("quantita").eq("id", c.componente_id).maybeSingle();
      const giac = comp?.quantita || 0;
      const possibili = c.quantita_per_bundle > 0 ? Math.floor(giac / c.quantita_per_bundle) : 0;
      disponibilita = Math.min(disponibilita, possibili);
    }
    if (!Number.isFinite(disponibilita)) continue;
    const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/products/${bundle.woo_product_id}`, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ manage_stock: true, stock_quantity: disponibilita }),
    });
    if (!risposta.ok) console.error(`Bundle "${bundle.nome}": disponibilità non sincronizzata su WooCommerce (${risposta.status})`);
  }
}
