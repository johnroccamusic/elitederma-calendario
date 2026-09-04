// Edge Function "woo-ordina-prodotti"
// Riscrive l'ordine dei prodotti dentro una categoria dello shop: riceve
// le posizioni decise trascinando in "Gestione shop" e le manda a
// WooCommerce come "menu_order", poi le rispecchia in
// prodotti_shop.ordine_vetrina.
//
// Le posizioni arrivano gia' calcolate dall'app (10, 20, 30...): lo
// spazio fra un numero e l'altro serve a chi domani vorra' infilare un
// prodotto in mezzo senza dover rinumerare tutta la categoria.
//
// Un solo giro su /products/batch, che aggiorna fino a 100 prodotti per
// chiamata: riordinare venti prodotti non deve voler dire venti chiamate
// al sito.
//
// Corpo della richiesta:
//   { "posizioni": [ { "prodottoId": "<uuid>", "posizione": 10 }, ... ] }
//
// Variabili d'ambiente richieste (Supabase -> Edge Functions -> Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET — le stesse di
//   woo-gestisci-prodotto (qui servono i permessi di scrittura)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// WooCommerce accetta al massimo 100 elementi per ogni chiamata batch
const MASSIMO_PER_BATCH = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), { status: stato, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return risposta({ errore: "Metodo non consentito" }, 405);

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return risposta({ errore: "Credenziali WooCommerce mancanti nei secret" }, 500);
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  let posizioni: { prodottoId?: string; posizione?: number }[] = [];
  try {
    const corpo = await req.json();
    posizioni = Array.isArray(corpo?.posizioni) ? corpo.posizioni : [];
  } catch {
    return risposta({ errore: "Corpo della richiesta non leggibile" }, 400);
  }
  const richieste = posizioni.filter((r) => r?.prodottoId && Number.isFinite(Number(r.posizione)));
  if (richieste.length === 0) return risposta({ errore: "Nessuna posizione da salvare" }, 400);

  // il codice del sito non arriva dall'app: si rilegge qui, cosi' nessuno
  // puo' far scrivere su un prodotto WooCommerce che non e' suo
  const { data: prodotti, error: erroreLettura } = await supabase
    .from("prodotti_shop")
    .select("id, woo_product_id")
    .in("id", richieste.map((r) => r.prodottoId as string));
  if (erroreLettura) return risposta({ errore: "Lettura prodotti: " + erroreLettura.message }, 500);

  const wooIdPerProdotto = new Map((prodotti || []).filter((p: any) => p.woo_product_id != null).map((p: any) => [p.id, p.woo_product_id]));
  const daScrivere = richieste
    .filter((r) => wooIdPerProdotto.has(r.prodottoId as string))
    .map((r) => ({ prodottoId: r.prodottoId as string, wooId: wooIdPerProdotto.get(r.prodottoId as string), posizione: Math.trunc(Number(r.posizione)) }));
  // un prodotto senza codice del sito non e' un errore: e' un prodotto
  // che sullo shop non c'e', e semplicemente non ha una posizione
  const saltati = richieste.length - daScrivere.length;
  if (daScrivere.length === 0) return risposta({ aggiornati: 0, saltati });

  try {
    for (let i = 0; i < daScrivere.length; i += MASSIMO_PER_BATCH) {
      const fetta = daScrivere.slice(i, i + MASSIMO_PER_BATCH);
      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/batch`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ update: fetta.map((r) => ({ id: r.wooId, menu_order: r.posizione })) }),
      });
      if (!rispostaWoo.ok) {
        const testo = await rispostaWoo.text();
        return risposta({ errore: `WooCommerce ha rifiutato il riordino (${rispostaWoo.status})`, dettaglio: testo }, 502);
      }
    }
  } catch (e) {
    return risposta({ errore: "Non sono riuscito a parlare con WooCommerce: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  // il sito ha accettato: adesso l'app puo' rispecchiarlo. Se questo
  // fallisse, l'ordine sullo shop e' comunque quello giusto e la prossima
  // "Sincronizza catalogo" rimette in pari il database
  for (const r of daScrivere) {
    const { error } = await supabase.from("prodotti_shop").update({ ordine_vetrina: r.posizione }).eq("id", r.prodottoId);
    if (error) return risposta({ errore: "Salvato sullo shop, ma non nel database: " + error.message }, 500);
  }

  return risposta({ aggiornati: daScrivere.length, saltati });
});
