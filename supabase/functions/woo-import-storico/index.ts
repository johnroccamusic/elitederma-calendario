// Edge Function "woo-import-storico"
// Importazione UNA TANTUM dello storico ordini già esistenti su
// WooCommerce (da eseguire manualmente una sola volta, prima o dopo aver
// attivato il webhook "woo-webhook" — è idempotente: rieseguirla non
// duplica nulla, fa solo un upsert su woo_order_id).
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL          — es. https://shop.elitederma.it (senza slash finale)
//   WC_CONSUMER_KEY       — Consumer key generata in WooCommerce → Impostazioni → Avanzate → REST API
//   WC_CONSUMER_SECRET    — Consumer secret della stessa chiave
//   IMPORT_TRIGGER_SECRET — una stringa a scelta: va passata nell'header
//                            "X-Import-Secret" quando si chiama questa
//                            funzione, per evitare che chiunque trovi
//                            l'URL possa forzare un reimport
//
// Invocazione (una volta sola, da terminale):
//   curl -X POST "https://<project-ref>.supabase.co/functions/v1/woo-import-storico" \
//     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
//     -H "X-Import-Secret: <IMPORT_TRIGGER_SECRET>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mappaOrdine } from "../_shared/woo.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 200; // tetto di sicurezza: 200 x 100 = 20.000 ordini

Deno.serve(async (req) => {
  const importSecret = Deno.env.get("IMPORT_TRIGGER_SECRET");
  if (!importSecret || req.headers.get("x-import-secret") !== importSecret) {
    return new Response("Non autorizzato", { status: 401 });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response("Configurazione WooCommerce mancante (WC_SITE_URL/WC_CONSUMER_KEY/WC_CONSUMER_SECRET)", { status: 500 });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  let pagina = 1;
  let ordiniImportati = 0;
  let completato = false;

  while (pagina <= MASSIMO_PAGINE) {
    const url = `${siteUrl}/wp-json/wc/v3/orders?per_page=${PER_PAGE}&page=${pagina}&orderby=id&order=asc`;
    const risposta = await fetch(url, { headers: { Authorization: auth } });

    if (!risposta.ok) {
      const testo = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `WooCommerce ha risposto ${risposta.status} alla pagina ${pagina}`, dettaglio: testo, ordiniImportati, pagina }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const ordini = await risposta.json();
    if (!Array.isArray(ordini) || ordini.length === 0) { completato = true; break; }

    const righe = ordini.map(mappaOrdine).filter((r): r is Record<string, unknown> => r !== null);
    if (righe.length > 0) {
      const { error } = await supabase.from("vendite_shop").upsert(righe, { onConflict: "woo_order_id" });
      if (error) {
        return new Response(
          JSON.stringify({ errore: "Errore salvataggio su Supabase: " + error.message, ordiniImportati, pagina }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    ordiniImportati += righe.length;
    if (ordini.length < PER_PAGE) { completato = true; break; }
    pagina += 1;
  }

  return new Response(
    JSON.stringify({ ordiniImportati, pagineProcessate: pagina, completato }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
