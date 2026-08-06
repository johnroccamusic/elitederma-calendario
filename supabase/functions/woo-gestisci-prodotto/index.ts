// Edge Function "woo-gestisci-prodotto"
// Crea o modifica un prodotto WooCommerce nella sua interezza (nome,
// descrizioni, prezzo, stato, categorie, galleria immagini), a
// differenza di woo-aggiorna-prodotto che resta dedicata al solo
// editor rapido prezzo/giacenza usato nella tabella di Magazzino — le
// due funzioni restano separate per non allargare cosa può cambiare
// quel percorso più snello.
//
// Come le altre funzioni di scrittura: chiama prima WooCommerce, e SOLO
// se risponde con successo riflette la modifica sulle tabelle locali
// (prodotti_shop, prodotti_categorie, prodotti_immagini). In caso di
// errore nessun dato locale viene toccato: niente falsi "salvato".
//
// Le immagini arrivano come URL pubblici (già caricati dal client su
// Supabase Storage, bucket "shop-immagini") oppure come riferimento a
// un'immagine già esistente su WooCommerce (woo_image_id, per un
// semplice riordino): WooCommerce scarica da un src nuovo l'immagine
// nella propria media library, senza bisogno di credenziali WordPress
// aggiuntive.
//
// Usa la coppia di chiavi API di WooCommerce con permessi di SCRITTURA,
// le stesse già usate da woo-aggiorna-prodotto.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app (già autenticata con l'anon key):
//   supabase.functions.invoke('woo-gestisci-prodotto', { body: {
//     azione: 'crea'|'modifica',
//     prodottoId,                 // uuid locale, richiesto per modifica
//     nome, descrizioneBreve, descrizione, prezzo, stato,  // 'stato': 'publish'|'draft'
//     categorieIds: [uuid, ...],  // opzionale in modifica (solo se passato viene sostituito)
//     immagini: [{ url, wooImageId }],  // ordine = ordine di visualizzazione, opzionale in modifica
//   }})

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

  const { azione, prodottoId, nome, descrizioneBreve, descrizione, prezzo, stato, categorieIds, immagini } = corpo || {};
  if (!["crea", "modifica"].includes(azione)) {
    return new Response(JSON.stringify({ errore: "Parametro 'azione' non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (azione === "crea") {
    if (!nome?.trim()) return new Response(JSON.stringify({ errore: "Il nome del prodotto è obbligatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!(prezzo > 0)) return new Response(JSON.stringify({ errore: "Il prezzo deve essere maggiore di zero" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (azione === "modifica" && !prodottoId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: prodottoId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);

  // risolve una lista di uuid locali di categoria nei corrispondenti woo_category_id
  async function wooIdsDiCategorie(idsLocali: string[]): Promise<number[]> {
    if (!idsLocali?.length) return [];
    const { data } = await supabase.from("categorie_prodotti").select("id, woo_category_id").in("id", idsLocali);
    return (data || []).map((c: any) => c.woo_category_id);
  }

  function immaginiPerWoo(lista: any[] | undefined): { id?: number; src?: string }[] | undefined {
    if (!Array.isArray(lista)) return undefined;
    return lista.map((img) => (img.wooImageId ? { id: img.wooImageId } : { src: img.url }));
  }

  // sostituisce per intero le righe locali di categorie/immagini di un
  // prodotto sulla base di quanto WooCommerce ha effettivamente salvato
  // (non di quanto richiesto: gli id delle immagini nuove li assegna Woo)
  async function sincronizzaCollegamentiLocali(prodottoIdLocale: string, prodottoWoo: any, categorieRichieste: string[] | undefined) {
    if (categorieRichieste !== undefined) {
      await supabase.from("prodotti_categorie").delete().eq("prodotto_id", prodottoIdLocale);
      const categorieWooIds = new Set((prodottoWoo.categories || []).map((c: any) => c.id));
      if (categorieWooIds.size > 0) {
        const { data: categorieLocali } = await supabase.from("categorie_prodotti").select("id, woo_category_id").in("woo_category_id", [...categorieWooIds]);
        const righe = (categorieLocali || []).map((c: any) => ({ prodotto_id: prodottoIdLocale, categoria_id: c.id }));
        if (righe.length > 0) await supabase.from("prodotti_categorie").insert(righe);
      }
    }
    if (immagini !== undefined) {
      await supabase.from("prodotti_immagini").delete().eq("prodotto_id", prodottoIdLocale);
      const righeImmagini = (Array.isArray(prodottoWoo.images) ? prodottoWoo.images : [])
        .filter((img: any) => img?.src)
        .map((img: any, indice: number) => ({ prodotto_id: prodottoIdLocale, woo_image_id: img.id ?? null, url: img.src, ordine: indice }));
      if (righeImmagini.length > 0) await supabase.from("prodotti_immagini").insert(righeImmagini);
    }
  }

  try {
    if (azione === "crea") {
      const categorieWooIds = await wooIdsDiCategorie(categorieIds);
      const payloadWoo: Record<string, unknown> = {
        name: nome.trim(),
        regular_price: String(prezzo),
        status: stato === "draft" ? "draft" : "publish",
      };
      if (descrizione != null) payloadWoo.description = descrizione;
      if (descrizioneBreve != null) payloadWoo.short_description = descrizioneBreve;
      if (categorieWooIds.length > 0) payloadWoo.categories = categorieWooIds.map((id) => ({ id }));
      const immaginiWoo = immaginiPerWoo(immagini);
      if (immaginiWoo?.length) payloadWoo.images = immaginiWoo;

      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payloadWoo),
      });
      if (!rispostaWoo.ok) {
        const testo = await rispostaWoo.text();
        return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato la creazione (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const creato = await rispostaWoo.json();

      const { data: riga, error: erroreInsert } = await supabase
        .from("prodotti_shop")
        .insert({
          woo_product_id: creato.id,
          nome: creato.name,
          prezzo_vendita: creato.price !== "" && creato.price != null ? parseFloat(creato.price) : prezzo,
          descrizione: creato.description || null,
          descrizione_breve: creato.short_description || null,
          stato: creato.status || "publish",
          attivo: true,
        })
        .select()
        .single();
      if (erroreInsert) {
        return new Response(JSON.stringify({ errore: "Creato su WooCommerce ma non nel database locale: " + erroreInsert.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await sincronizzaCollegamentiLocali(riga.id, creato, categorieIds);
      return new Response(JSON.stringify({ ok: true, prodottoId: riga.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // azione === "modifica"
    const { data: prodottoEsistente, error: erroreLettura } = await supabase
      .from("prodotti_shop")
      .select("id, woo_product_id")
      .eq("id", prodottoId)
      .single();
    if (erroreLettura || !prodottoEsistente) {
      return new Response(JSON.stringify({ errore: "Prodotto non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payloadWoo: Record<string, unknown> = {};
    if (nome != null) payloadWoo.name = nome.trim();
    if (descrizione != null) payloadWoo.description = descrizione;
    if (descrizioneBreve != null) payloadWoo.short_description = descrizioneBreve;
    if (prezzo != null) {
      if (!(prezzo > 0)) return new Response(JSON.stringify({ errore: "Il prezzo deve essere maggiore di zero" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      payloadWoo.regular_price = String(prezzo);
    }
    if (stato != null) payloadWoo.status = stato === "draft" ? "draft" : "publish";
    if (categorieIds !== undefined) {
      const categorieWooIds = await wooIdsDiCategorie(categorieIds);
      payloadWoo.categories = categorieWooIds.map((id) => ({ id }));
    }
    const immaginiWoo = immaginiPerWoo(immagini);
    if (immaginiWoo !== undefined) payloadWoo.images = immaginiWoo;

    if (Object.keys(payloadWoo).length === 0) {
      return new Response(JSON.stringify({ errore: "Nulla da aggiornare" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/${prodottoEsistente.woo_product_id}`, {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payloadWoo),
    });
    if (!rispostaWoo.ok) {
      const testo = await rispostaWoo.text();
      return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato l'aggiornamento (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aggiornato = await rispostaWoo.json();

    const aggiornamentoLocale: Record<string, unknown> = { ts_sync: new Date().toISOString() };
    if (nome != null) aggiornamentoLocale.nome = aggiornato.name;
    if (descrizione != null) aggiornamentoLocale.descrizione = aggiornato.description || null;
    if (descrizioneBreve != null) aggiornamentoLocale.descrizione_breve = aggiornato.short_description || null;
    if (prezzo != null) aggiornamentoLocale.prezzo_vendita = aggiornato.price !== "" && aggiornato.price != null ? parseFloat(aggiornato.price) : prezzo;
    if (stato != null) aggiornamentoLocale.stato = aggiornato.status || stato;

    const { error: erroreUpdate } = await supabase.from("prodotti_shop").update(aggiornamentoLocale).eq("id", prodottoId);
    if (erroreUpdate) {
      return new Response(JSON.stringify({ errore: "Aggiornato su WooCommerce ma non nel database locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await sincronizzaCollegamentiLocali(prodottoId, aggiornato, categorieIds);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
