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
