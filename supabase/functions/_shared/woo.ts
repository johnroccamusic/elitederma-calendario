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

  const prodotti = Array.isArray(ordine.line_items)
    ? ordine.line_items.map((voce: any) => ({
        nome: voce.name || null,
        quantita: voce.quantity ?? null,
        prezzo_unitario: voce.price != null ? Number(voce.price) : null,
        totale_riga: voce.total != null ? parseFloat(voce.total) : null,
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
