// Edge Function "woo-import-storico"
// Recupera dallo storico WooCommerce gli ordini mancanti su Supabase (es.
// se il webhook "woo-webhook" si è fermato per un po') — è idempotente:
// rieseguirla non duplica nulla, fa solo un upsert su woo_order_id.
// Richiamabile dal tasto "Recupera ordini mancanti" in Vendite shop
// (supabase.functions.invoke, stessa autenticazione anon-key delle altre
// funzioni Woo — nessun secret separato da gestire lato client).
//
// Parte SEMPRE da poco prima dell'ultimo ordine già importato (query
// "after" verso WooCommerce), non dal primo ordine in assoluto: con lo
// storico ormai a migliaia di ordini, riscandire tutto a ogni giro (com'era
// prima) supera il tempo/CPU massimo della funzione ed esce con 504/546
// senza importare nulla, nemmeno gli ordini nuovi. Il margine di
// sovrapposizione è innocuo perché l'upsert è idempotente.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_SITE_URL        — es. https://shop.elitederma.it (senza slash finale)
//   WC_CONSUMER_KEY    — Consumer key generata in WooCommerce → Impostazioni → Avanzate → REST API
//   WC_CONSUMER_SECRET — Consumer secret della stessa chiave

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mappaOrdine, attribuisciMasterReferral,
  STATI_VIVI, applicaMovimentoBundle, applicaMovimentoProdottiSemplici, sincronizzaDisponibilitaBundle,
} from "../_shared/woo.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 200; // tetto di sicurezza: 200 x 100 = 20.000 ordini
const GIORNI_SOVRAPPOSIZIONE = 3; // margine prima dell'ultimo ordine noto, per sicurezza

// senza queste intestazioni il browser blocca la risposta (CORS) e il
// client Supabase fallisce con "Failed to send a request to the Edge
// Function" ancora prima che la funzione faccia qualunque cosa
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Salva un lotto di ordini e, come fa il webhook, muove il magazzino sui
// PASSAGGI di stato: un ordine che diventa "vivo" (processing/completed)
// scarica, uno che smette di esserlo ripristina, uno che resta com'era non
// muove niente. Prima questa funzione salvava e basta: quando il webhook
// non arrivava — succede, se il sito e' irraggiungibile e WooCommerce
// smette di riprovare — l'ordine veniva recuperato ma i pezzi restavano in
// magazzino, e la giacenza divergeva in silenzio.
//
// Leggere lo stato precedente PRIMA dell'upsert e' l'unica cosa che rende
// il conto sicuro: rieseguire il recupero dieci volte non scarica dieci
// volte, perche' la seconda volta il passaggio non c'e' piu'.
async function salvaLotto(supabase: any, ordini: any[], siteUrl: string) {
  const righe: Record<string, unknown>[] = [];
  for (const o of ordini) {
    const riga = mappaOrdine(o);
    if (!riga) continue;
    // stessa attribuzione del referral code applicata da woo-webhook in
    // tempo reale — prima mancava qui, quindi lo storico di un ordine mai
    // arrivato via webhook restava senza operatore/coupon
    await attribuisciMasterReferral(supabase, o, riga);
    righe.push(riga);
  }
  if (righe.length === 0) return { salvati: 0, errore: null as string | null };

  const ids = righe.map((r) => r.woo_order_id as number);
  const { data: esistenti } = await supabase
    .from("vendite_shop").select("woo_order_id, stato, prodotti").in("woo_order_id", ids);
  const primaDi = new Map<number, any>((esistenti || []).map((r: any) => [r.woo_order_id, r]));

  const { error } = await supabase.from("vendite_shop").upsert(righe, { onConflict: "woo_order_id" });
  if (error) return { salvati: 0, errore: error.message };

  let bundleToccati = new Set<string>();
  for (const riga of righe) {
    const prima = primaDi.get(riga.woo_order_id as number);
    const eraVivo = STATI_VIVI.includes(String(prima?.stato || ""));
    const oraVivo = STATI_VIVI.includes(String(riga.stato || ""));
    if (!eraVivo && oraVivo) {
      (await applicaMovimentoBundle(supabase, riga.prodotti as any[], -1)).forEach((id: string) => bundleToccati.add(id));
      await applicaMovimentoProdottiSemplici(supabase, riga.prodotti as any[], -1);
    } else if (eraVivo && !oraVivo) {
      (await applicaMovimentoBundle(supabase, (prima?.prodotti as any[]) || [], 1)).forEach((id: string) => bundleToccati.add(id));
      await applicaMovimentoProdottiSemplici(supabase, (prima?.prodotti as any[]) || [], 1);
    }
  }
  // i kit componibili si ricalcolano e si rispingono sul sito, o
  // WooCommerce continuerebbe a vendere un kit che i componenti non
  // permettono piu' di comporre. Serve la chiave di scrittura: se non c'e',
  // il magazzino qui e' comunque a posto e il sito si riallinea al primo
  // salvataggio di quel prodotto
  const chiaveWrite = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const segretoWrite = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (bundleToccati.size && chiaveWrite && segretoWrite) {
    try {
      await sincronizzaDisponibilitaBundle(supabase, bundleToccati, siteUrl, chiaveWrite, segretoWrite);
    } catch (e) {
      console.error("Bundle non risincronizzati sul sito:", e instanceof Error ? e.message : String(e));
    }
  }
  return { salvati: righe.length, errore: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !consumerKey || !consumerSecret) {
    return new Response("Configurazione WooCommerce mancante (WC_SITE_URL/WC_CONSUMER_KEY/WC_CONSUMER_SECRET)", { status: 500, headers: corsHeaders });
  }
  const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  // Cursore incrementale: dall'ultimo ordine già importato in poi
  const { data: ultimo } = await supabase
    .from("vendite_shop")
    .select("data_ordine")
    .order("data_ordine", { ascending: false })
    .limit(1)
    .maybeSingle();

  let after: string | null = null;
  if (ultimo?.data_ordine) {
    const soglia = new Date(ultimo.data_ordine as string);
    soglia.setUTCDate(soglia.getUTCDate() - GIORNI_SOVRAPPOSIZIONE);
    after = soglia.toISOString().slice(0, 19); // WooCommerce vuole ISO8601 senza offset, in GMT
  }

  let pagina = 1;
  let ordiniImportati = 0;
  let completato = false;

  while (pagina <= MASSIMO_PAGINE) {
    const parametri = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(pagina),
      orderby: "id",
      order: "asc",
    });
    if (after) parametri.set("after", after);
    const url = `${siteUrl}/wp-json/wc/v3/orders?${parametri.toString()}`;
    const risposta = await fetch(url, { headers: { Authorization: auth } });

    if (!risposta.ok) {
      const testo = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `WooCommerce ha risposto ${risposta.status} alla pagina ${pagina}`, dettaglio: testo, ordiniImportati, pagina }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ordini = await risposta.json();
    if (!Array.isArray(ordini) || ordini.length === 0) { completato = true; break; }

    const esito = await salvaLotto(supabase, ordini, siteUrl);
    if (esito.errore) {
      return new Response(
        JSON.stringify({ errore: "Errore salvataggio su Supabase: " + esito.errore, ordiniImportati, pagina }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    ordiniImportati += esito.salvati;
    if (ordini.length < PER_PAGE) { completato = true; break; }
    pagina += 1;
  }

  // SECONDA PASSATA — gli ordini che da noi risultano ancora aperti.
  //
  // "after" guarda la data di CREAZIONE: un ordine vecchio che cambia stato
  // sul sito non viene mai più riletto da qui. È così che l'ordine 10130,
  // creato il 14 agosto e completato qualche giorno dopo, è rimasto "in
  // lavorazione" in app per due settimane — il webhook di WooCommerce
  // manda l'ordine appena creato, l'aggiornamento evidentemente no.
  //
  // Qui si chiedono a WooCommerce esattamente quegli ordini, per id
  // (parametro "include"), e si riallinea il loro stato. Sono pochi per
  // definizione: quelli ancora da evadere.
  //
  // Anche qui il magazzino si muove sui passaggi di stato, come sopra: un
  // ordine che risultava aperto e sul sito e' stato annullato rimette
  // dentro i suoi pezzi.
  let ordiniRiallineati = 0;
  const { data: aperti } = await supabase
    .from("vendite_shop")
    .select("woo_order_id")
    .not("woo_order_id", "is", null)
    .in("stato", ["processing", "on-hold", "pending"]);
  const idsAperti = (aperti || []).map((r: any) => r.woo_order_id).filter(Boolean);
  for (let i = 0; i < idsAperti.length; i += PER_PAGE) {
    const lotto = idsAperti.slice(i, i + PER_PAGE);
    const url = `${siteUrl}/wp-json/wc/v3/orders?per_page=${PER_PAGE}&include=${lotto.join(",")}`;
    const risposta = await fetch(url, { headers: { Authorization: auth } });
    // se il sito non risponde si esce senza errore: la prima passata è già
    // salvata, e questa è una rifinitura che si riproverà al giro dopo
    if (!risposta.ok) break;
    const ordini = await risposta.json();
    if (!Array.isArray(ordini) || ordini.length === 0) continue;
    const esito = await salvaLotto(supabase, ordini, siteUrl);
    if (esito.errore) break;
    ordiniRiallineati += esito.salvati;
  }

  return new Response(
    JSON.stringify({ ordiniImportati, ordiniRiallineati, pagineProcessate: pagina, completato, dopoData: after }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
