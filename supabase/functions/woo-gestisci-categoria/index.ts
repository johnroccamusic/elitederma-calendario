// Edge Function "woo-gestisci-categoria"
// Crea, modifica o elimina una categoria prodotto su WooCommerce
// (/wc/v3/products/categories) e, SOLO se la chiamata a WooCommerce
// riesce, riflette la modifica anche su categorie_prodotti. Se
// WooCommerce rifiuta la richiesta, il dato locale NON viene toccato:
// nessuna modifica deve mai risultare "salvata" solo in locale.
//
// Usata dal pannello "Gestione Shop" dentro Magazzino. Le immagini non
// passano da qui come file: il client le carica prima su Supabase
// Storage (bucket "shop-immagini") e passa qui solo l'URL pubblico —
// WooCommerce scarica da quell'URL l'immagine nella propria media
// library al salvataggio, senza bisogno di credenziali WordPress
// aggiuntive.
//
// Usa la coppia di chiavi API di WooCommerce con permessi di SCRITTURA,
// le stesse già usate da woo-aggiorna-prodotto.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE
//
// Chiamata dall'app (già autenticata con l'anon key):
//   supabase.functions.invoke('woo-gestisci-categoria', { body: {
//     azione: 'crea'|'modifica'|'elimina',
//     categoriaId,       // uuid locale, richiesto per modifica/elimina
//     nome, descrizione, // stringhe, opzionali in modifica (solo i campi passati vengono cambiati)
//     categoriaPadreId,  // uuid locale della categoria padre, o null per "nessuna" — opzionale
//     immagineUrl,       // url pubblico dell'immagine categoria, opzionale
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

  const { azione, categoriaId, nome, descrizione, categoriaPadreId, immagineUrl } = corpo || {};
  if (!["crea", "modifica", "elimina"].includes(azione)) {
    return new Response(JSON.stringify({ errore: "Parametro 'azione' non valido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (azione === "crea" && !nome?.trim()) {
    return new Response(JSON.stringify({ errore: "Il nome della categoria è obbligatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if ((azione === "modifica" || azione === "elimina") && !categoriaId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: categoriaId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKeyWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const consumerSecretWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !consumerKeyWrite || !consumerSecretWrite) {
    return new Response(JSON.stringify({ errore: "Configurazione WooCommerce (scrittura) mancante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${consumerKeyWrite}:${consumerSecretWrite}`);

  // risolve un uuid locale di categoria nel corrispondente woo_category_id
  async function wooIdDiCategoria(idLocale: string): Promise<number | null> {
    const { data } = await supabase.from("categorie_prodotti").select("woo_category_id").eq("id", idLocale).single();
    return data?.woo_category_id ?? null;
  }

  try {
    if (azione === "crea") {
      const payloadWoo: Record<string, unknown> = { name: nome.trim() };
      if (descrizione != null) payloadWoo.description = descrizione;
      if (immagineUrl) payloadWoo.image = { src: immagineUrl };
      if (categoriaPadreId) {
        const padreWooId = await wooIdDiCategoria(categoriaPadreId);
        if (!padreWooId) return new Response(JSON.stringify({ errore: "Categoria padre non trovata" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        payloadWoo.parent = padreWooId;
      }

      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/categories`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payloadWoo),
      });
      if (!rispostaWoo.ok) {
        const testo = await rispostaWoo.text();
        return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato la creazione (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const creata = await rispostaWoo.json();

      const { data: riga, error: erroreInsert } = await supabase
        .from("categorie_prodotti")
        .insert({
          woo_category_id: creata.id,
          nome: creata.name,
          descrizione: creata.description || null,
          immagine_url: creata.image?.src || null,
          ordine: creata.menu_order ?? 0,
          categoria_padre_id: categoriaPadreId || null,
        })
        .select()
        .single();
      if (erroreInsert) {
        // creata su WooCommerce ma non salvata in locale: da segnalare, un
        // "Sincronizza catalogo" da Magazzino la recupera comunque
        return new Response(JSON.stringify({ errore: "Creata su WooCommerce ma non nel database locale: " + erroreInsert.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, categoria: riga }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // modifica ed elimina hanno entrambe bisogno del woo_category_id esistente
    const { data: categoriaEsistente, error: erroreLettura } = await supabase
      .from("categorie_prodotti")
      .select("id, woo_category_id")
      .eq("id", categoriaId)
      .single();
    if (erroreLettura || !categoriaEsistente) {
      return new Response(JSON.stringify({ errore: "Categoria non trovata" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "modifica") {
      const payloadWoo: Record<string, unknown> = {};
      if (nome != null) payloadWoo.name = nome.trim();
      if (descrizione != null) payloadWoo.description = descrizione;
      if (immagineUrl != null) payloadWoo.image = immagineUrl ? { src: immagineUrl } : null;
      let padreLocaleDaSalvare: string | null | undefined = undefined;
      if (categoriaPadreId !== undefined) {
        if (categoriaPadreId) {
          const padreWooId = await wooIdDiCategoria(categoriaPadreId);
          if (!padreWooId) return new Response(JSON.stringify({ errore: "Categoria padre non trovata" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          payloadWoo.parent = padreWooId;
        } else {
          payloadWoo.parent = 0;
        }
        padreLocaleDaSalvare = categoriaPadreId || null;
      }
      if (Object.keys(payloadWoo).length === 0) {
        return new Response(JSON.stringify({ errore: "Nulla da aggiornare" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/categories/${categoriaEsistente.woo_category_id}`, {
        method: "PUT",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payloadWoo),
      });
      if (!rispostaWoo.ok) {
        const testo = await rispostaWoo.text();
        return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato l'aggiornamento (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aggiornamentoLocale: Record<string, unknown> = { ts_sync: new Date().toISOString() };
      if (nome != null) aggiornamentoLocale.nome = nome.trim();
      if (descrizione != null) aggiornamentoLocale.descrizione = descrizione;
      if (immagineUrl != null) aggiornamentoLocale.immagine_url = immagineUrl || null;
      if (padreLocaleDaSalvare !== undefined) aggiornamentoLocale.categoria_padre_id = padreLocaleDaSalvare;

      const { error: erroreUpdate } = await supabase.from("categorie_prodotti").update(aggiornamentoLocale).eq("id", categoriaId);
      if (erroreUpdate) {
        return new Response(JSON.stringify({ errore: "Aggiornata su WooCommerce ma non nel database locale: " + erroreUpdate.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // azione === "elimina": le tassonomie WooCommerce non hanno un
    // "cestino", va forzata. I prodotti collegati non vengono toccati (la
    // conferma con l'eventuale conteggio prodotti va mostrata dal client
    // PRIMA di chiamare questa funzione): perdono solo il collegamento a
    // questa categoria, così come farebbe WooCommerce stesso.
    const rispostaWoo = await fetch(`${siteUrl}/wp-json/wc/v3/products/categories/${categoriaEsistente.woo_category_id}?force=true`, {
      method: "DELETE",
      headers: { Authorization: auth },
    });
    if (!rispostaWoo.ok) {
      const testo = await rispostaWoo.text();
      return new Response(JSON.stringify({ errore: `WooCommerce ha rifiutato l'eliminazione (${rispostaWoo.status})`, dettaglio: testo }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // le sotto-categorie di questa, su WordPress, tornano automaticamente
    // di primo livello: lo stesso va rispecchiato in locale
    await supabase.from("categorie_prodotti").update({ categoria_padre_id: null }).eq("categoria_padre_id", categoriaId);
    const { error: erroreDelete } = await supabase.from("categorie_prodotti").delete().eq("id", categoriaId);
    if (erroreDelete) {
      return new Response(JSON.stringify({ errore: "Eliminata su WooCommerce ma non nel database locale: " + erroreDelete.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
