// Edge Function "woo-sync-catalogo"
// Importa categorie prodotto e prodotti da WooCommerce (lettura), da
// eseguire su richiesta dal pulsante "Sincronizza catalogo" in
// "Magazzino" (o manualmente da terminale) — separata da woo-webhook
// (ordini) e da woo-aggiorna-prodotto (scrittura), così le chiavi API
// di sola lettura restano isolate da quelle di scrittura.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET — le stesse già
//   usate da woo-import-storico (permessi "Lettura" bastano)
//
// Protetta dalla verifica JWT di Supabase (comportamento di default,
// nessun secret custom): l'app la chiama già autenticata con l'anon
// key tramite supabase.functions.invoke('woo-sync-catalogo').
//
// Non sovrascrive MAI costo_acquisto/scorta_minima di prodotti_shop:
// sono dati inseriti a mano nell'app, WooCommerce non li conosce.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 200;

async function fetchTutteLePagine(url: string, auth: string) {
  const risultati: any[] = [];
  let pagina = 1;
  while (pagina <= MASSIMO_PAGINE) {
    const risposta = await fetch(`${url}&per_page=${PER_PAGE}&page=${pagina}`, { headers: { Authorization: auth } });
    if (!risposta.ok) {
      throw new Error(`WooCommerce ha risposto ${risposta.status} alla pagina ${pagina} di ${url}`);
    }
    const dati = await risposta.json();
    if (!Array.isArray(dati) || dati.length === 0) break;
    risultati.push(...dati);
    if (dati.length < PER_PAGE) break;
    pagina += 1;
  }
  return risultati;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ errore: "Metodo non consentito" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response("Configurazione WooCommerce mancante (WC_SITE_URL/WC_CONSUMER_KEY/WC_CONSUMER_SECRET)", { status: 500 });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  try {
    // --- 1) categorie: due passate, una per creare le righe, una per
    // risolvere la gerarchia (il padre potrebbe comparire dopo il
    // figlio nella paginazione, quindi va risolto solo a righe create) ---
    const categorieWoo = await fetchTutteLePagine(`${siteUrl}/wp-json/wc/v3/products/categories?orderby=id&order=asc`, auth);

    if (categorieWoo.length > 0) {
      const righeCategorie = categorieWoo.map((c) => ({ woo_category_id: c.id, nome: c.name, ts_sync: new Date().toISOString() }));
      const { error: erroreCat } = await supabase.from("categorie_prodotti").upsert(righeCategorie, { onConflict: "woo_category_id" });
      if (erroreCat) throw new Error("Upsert categorie: " + erroreCat.message);

      const { data: categorieSalvate, error: erroreSelCat } = await supabase.from("categorie_prodotti").select("id, woo_category_id");
      if (erroreSelCat) throw new Error("Lettura categorie: " + erroreSelCat.message);
      const idPerWooCategoryId = Object.fromEntries((categorieSalvate || []).map((c: any) => [c.woo_category_id, c.id]));

      for (const c of categorieWoo) {
        const padreId = c.parent && c.parent !== 0 ? idPerWooCategoryId[c.parent] || null : null;
        await supabase.from("categorie_prodotti").update({ categoria_padre_id: padreId }).eq("woo_category_id", c.id);
      }
    }

    const { data: tutteCategorie, error: erroreTutteCat } = await supabase.from("categorie_prodotti").select("id, woo_category_id");
    if (erroreTutteCat) throw new Error("Lettura categorie: " + erroreTutteCat.message);
    const categoriaIdPerWooId = Object.fromEntries((tutteCategorie || []).map((c: any) => [c.woo_category_id, c.id]));

    // --- 2) prodotti: upsert a pagine, poi collegamento categorie per
    // ogni pagina appena upsertata (evita di tenere tutto in memoria) ---
    let prodottiImportati = 0;
    const wooIdVisti: number[] = [];
    let pagina = 1;
    while (pagina <= MASSIMO_PAGINE) {
      const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/products?per_page=${PER_PAGE}&page=${pagina}&orderby=id&order=asc`, { headers: { Authorization: auth } });
      if (!risposta.ok) throw new Error(`WooCommerce ha risposto ${risposta.status} alla pagina ${pagina} dei prodotti`);
      const prodottiWoo = await risposta.json();
      if (!Array.isArray(prodottiWoo) || prodottiWoo.length === 0) break;

      const righeProdotti = prodottiWoo.map((p: any) => ({
        woo_product_id: p.id,
        nome: p.name,
        sku: p.sku || null,
        prezzo_vendita: p.price !== "" && p.price != null ? parseFloat(p.price) : (p.regular_price ? parseFloat(p.regular_price) : null),
        giacenza: p.stock_quantity != null ? parseInt(p.stock_quantity, 10) : null,
        attivo: true,
        ts_sync: new Date().toISOString(),
      }));
      // NOTA: costo_acquisto e scorta_minima NON compaiono qui di
      // proposito — l'upsert non li tocca mai, così i valori inseriti a
      // mano nell'app restano intatti
      const { data: prodottiSalvati, error: erroreProd } = await supabase
        .from("prodotti_shop")
        .upsert(righeProdotti, { onConflict: "woo_product_id" })
        .select("id, woo_product_id");
      if (erroreProd) throw new Error("Upsert prodotti: " + erroreProd.message);

      const prodottoIdPerWooId = Object.fromEntries((prodottiSalvati || []).map((p: any) => [p.woo_product_id, p.id]));
      const idProdottiPagina = Object.values(prodottoIdPerWooId);

      if (idProdottiPagina.length > 0) {
        await supabase.from("prodotti_categorie").delete().in("prodotto_id", idProdottiPagina as string[]);
        const righeCollegamento: { prodotto_id: string; categoria_id: string }[] = [];
        prodottiWoo.forEach((p: any) => {
          const prodottoId = prodottoIdPerWooId[p.id];
          if (!prodottoId) return;
          (Array.isArray(p.categories) ? p.categories : []).forEach((c: any) => {
            const categoriaId = categoriaIdPerWooId[c.id];
            if (categoriaId) righeCollegamento.push({ prodotto_id: prodottoId, categoria_id: categoriaId });
          });
        });
        if (righeCollegamento.length > 0) {
          const { error: erroreLink } = await supabase.from("prodotti_categorie").insert(righeCollegamento);
          if (erroreLink) throw new Error("Collegamento categorie: " + erroreLink.message);
        }
      }

      wooIdVisti.push(...prodottiWoo.map((p: any) => p.id));
      prodottiImportati += prodottiWoo.length;
      if (prodottiWoo.length < PER_PAGE) break;
      pagina += 1;
    }

    // --- 3) prodotti spariti dallo shop: non cancellati (si perderebbe
    // lo storico), solo marcati non più attivi ---
    let disattivati = 0;
    if (wooIdVisti.length > 0) {
      const { data: righeDisattivate, error: erroreDisattiva } = await supabase
        .from("prodotti_shop")
        .update({ attivo: false })
        .not("woo_product_id", "in", `(${wooIdVisti.join(",")})`)
        .eq("attivo", true)
        .select("id");
      if (erroreDisattiva) throw new Error("Disattivazione prodotti rimossi: " + erroreDisattiva.message);
      disattivati = (righeDisattivate || []).length;
    }

    return new Response(
      JSON.stringify({ categorieImportate: categorieWoo.length, prodottiImportati, prodottiDisattivati: disattivati }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
