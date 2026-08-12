// Edge Function "woo-aggiorna-prodotto"
// Scrive prezzo di vendita e/o giacenza (valori ASSOLUTI, non delta) di
// un prodotto su WooCommerce (PUT /products/{id}) e, SOLO se questa
// chiamata riesce, aggiorna anche il dato locale in prodotti_shop. Se
// fallisce, il dato locale NON viene toccato — WooCommerce resta la
// fonte di verità per prezzo e giacenza.
//
// costo_acquisto e scorta_minima NON passano da qui: sono dati propri
// dell'app (WooCommerce non li conosce), il client li scrive
// direttamente su prodotti_shop senza bisogno di questa funzione.
//
// Usa la SECONDA coppia di chiavi API di WooCommerce, con permessi di
// SCRITTURA (Read/Write) — le stesse già usate dalla precedente
// woo-aggiorna-scorte, che questa funzione sostituisce.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app (già autenticata con l'anon key, la verifica JWT
// di Supabase resta quindi attiva su questa funzione):
//   supabase.functions.invoke('woo-aggiorna-prodotto', { body: { prodottoId, prezzoVendita, giacenza, giacenzaMagazzino } })
// prezzoVendita/giacenza/giacenzaMagazzino sono opzionali: passa solo
// quelli che sono cambiati. giacenzaMagazzino (il magazzino fisico, dato
// solo dell'app, mai su WooCommerce) viene scritto insieme a "giacenza"
// nello stesso aggiornamento locale invece che con una seconda chiamata
// separata dal browser — un giro di rete in meno quando un movimento
// tocca entrambe (es. "sposta da magazzino a shop"), stessa garanzia:
// si scrive solo dopo che WooCommerce ha confermato.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// senza queste intestazioni il browser blocca la risposta (CORS) e il
// client Supabase fallisce con "Failed to send a request to the Edge
// Function" ancora prima che la funzione faccia qualunque cosa
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ errore: "JSON non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { prodottoId, prezzoVendita, giacenza, giacenzaMagazzino } = corpo || {};
  if (!prodottoId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: prodottoId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const cambiaPrezzo = prezzoVendita != null && Number.isFinite(prezzoVendita);
  const cambiaGiacenza = giacenza != null && Number.isFinite(giacenza);
  const cambiaMagazzino = giacenzaMagazzino != null && Number.isFinite(giacenzaMagazzino);
  if (!cambiaPrezzo && !cambiaGiacenza) {
    return new Response(JSON.stringify({ errore: "Nulla da aggiornare: servono prezzoVendita e/o giacenza" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (cambiaPrezzo && prezzoVendita <= 0) {
    return new Response(JSON.stringify({ errore: "Il prezzo di vendita deve essere maggiore di zero" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (cambiaGiacenza && giacenza < 0) {
    return new Response(JSON.stringify({ errore: "La giacenza non può essere negativa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (cambiaMagazzino && giacenzaMagazzino < 0) {
    return new Response(JSON.stringify({ errore: "La giacenza in magazzino non può essere negativa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: prodotto, error: erroreLettura } = await supabase
    .from("prodotti_shop")
    .select("id, woo_product_id")
    .eq("id", prodottoId)
    .single();
  if (erroreLettura || !prodotto) {
    return new Response(JSON.stringify({ errore: "Prodotto non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const payloadWoo: Record<string, unknown> = {};
  if (cambiaPrezzo) payloadWoo.regular_price = String(prezzoVendita);
  if (cambiaGiacenza) payloadWoo.stock_quantity = giacenza;

  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);
  const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/${prodotto.woo_product_id}`, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payloadWoo),
  });

  if (!rispostaWoo.ok) {
    const testo = await rispostaWoo.text();
    // il dato locale NON viene toccato: WooCommerce resta la fonte di verità
    return new Response(
      JSON.stringify({ errore: `WooCommerce ha rifiutato l'aggiornamento (${rispostaWoo.status})`, dettaglio: testo }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const aggiornamentoLocale: Record<string, unknown> = { ts_sync: new Date().toISOString() };
  if (cambiaPrezzo) aggiornamentoLocale.prezzo_vendita = prezzoVendita;
  if (cambiaGiacenza) aggiornamentoLocale.giacenza = giacenza;
  // giacenza_magazzino non esiste su WooCommerce (dato solo dell'app):
  // si scrive qui, nello stesso aggiornamento, solo per risparmiare al
  // browser una seconda chiamata separata — non richiede una sua verifica
  // su WooCommerce, quindi può stare insieme senza cambiare la garanzia
  // "si scrive in locale solo dopo la conferma di WooCommerce"
  if (cambiaMagazzino) aggiornamentoLocale.giacenza_magazzino = giacenzaMagazzino;

  const { error: erroreAggiorna } = await supabase.from("prodotti_shop").update(aggiornamentoLocale).eq("id", prodottoId);
  if (erroreAggiorna) {
    // caso raro ma da segnalare esplicitamente: su WooCommerce è già
    // cambiato, sul database locale no — richiede un nuovo sync catalogo
    return new Response(
      JSON.stringify({ errore: "Aggiornato su WooCommerce ma non nel database locale: " + erroreAggiorna.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true, prezzoVendita: cambiaPrezzo ? prezzoVendita : undefined, giacenza: cambiaGiacenza ? giacenza : undefined, giacenzaMagazzino: cambiaMagazzino ? giacenzaMagazzino : undefined }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
