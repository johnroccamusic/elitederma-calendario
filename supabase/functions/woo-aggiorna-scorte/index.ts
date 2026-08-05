// Edge Function "woo-aggiorna-scorte"
// Ricarica le scorte di un prodotto: scrive la nuova giacenza su
// WooCommerce (PUT /products/{id}) e, SOLO se questa chiamata riesce,
// aggiorna anche il dato locale in prodotti_shop. Se la chiamata a
// WooCommerce fallisce, il dato locale NON viene toccato — meglio un
// errore chiaro che una giacenza locale diversa da quella reale sullo shop.
//
// Separata da woo-sync-catalogo (sola lettura) apposta: usa una SECONDA
// coppia di chiavi API di WooCommerce, con permessi di SCRITTURA
// (Read/Write), diverse da quelle in sola lettura già usate altrove.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL                — stesso valore già usato per la sola lettura
//   WC_CONSUMER_KEY_WRITE       — Consumer key con permessi Read/Write
//   WC_CONSUMER_SECRET_WRITE    — Consumer secret della stessa chiave
//
// Chiamata dall'app (già autenticata con l'anon key del progetto, la
// verifica JWT di Supabase resta quindi attiva su questa funzione,
// diversamente da woo-webhook/woo-sync-catalogo che sono chiamate da
// sistemi esterni senza un token Supabase):
//   supabase.functions.invoke('woo-aggiorna-scorte', { body: { prodottoId, quantitaDaAggiungere } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ errore: "JSON non valido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { prodottoId, quantitaDaAggiungere } = corpo || {};
  if (!prodottoId || typeof quantitaDaAggiungere !== "number" || !Number.isFinite(quantitaDaAggiungere)) {
    return new Response(JSON.stringify({ errore: "Parametri mancanti: servono prodottoId e quantitaDaAggiungere (numero)" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const { data: prodotto, error: erroreLettura } = await supabase
    .from("prodotti_shop")
    .select("id, woo_product_id, giacenza")
    .eq("id", prodottoId)
    .single();
  if (erroreLettura || !prodotto) {
    return new Response(JSON.stringify({ errore: "Prodotto non trovato" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const nuovaGiacenza = (prodotto.giacenza || 0) + quantitaDaAggiungere;
  if (nuovaGiacenza < 0) {
    return new Response(JSON.stringify({ errore: "La giacenza risultante sarebbe negativa" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);
  const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/${prodotto.woo_product_id}`, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ stock_quantity: nuovaGiacenza }),
  });

  if (!rispostaWoo.ok) {
    const testo = await rispostaWoo.text();
    // il dato locale NON viene toccato: WooCommerce resta la fonte di verità
    return new Response(
      JSON.stringify({ errore: `WooCommerce ha rifiutato l'aggiornamento (${rispostaWoo.status})`, dettaglio: testo }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const { error: erroreAggiorna } = await supabase
    .from("prodotti_shop")
    .update({ giacenza: nuovaGiacenza, ts_sync: new Date().toISOString() })
    .eq("id", prodottoId);
  if (erroreAggiorna) {
    // caso raro ma da segnalare esplicitamente: su WooCommerce è già
    // cambiato, sul database locale no — richiede un nuovo sync catalogo
    return new Response(
      JSON.stringify({ errore: "Aggiornato su WooCommerce ma non nel database locale: " + erroreAggiorna.message, nuovaGiacenza }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true, nuovaGiacenza }), { status: 200, headers: { "Content-Type": "application/json" } });
});
