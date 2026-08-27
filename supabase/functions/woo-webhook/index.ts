// Edge Function "woo-webhook"
// Riceve i webhook di WooCommerce (ordine creato / ordine aggiornato),
// verifica la firma HMAC-SHA256 con il secret impostato in WooCommerce, e
// salva/aggiorna la vendita nella tabella "vendite_shop" (upsert su
// woo_order_id, così un webhook ripetuto o un aggiornamento successivo
// dello stesso ordine non crea righe duplicate).
//
// Se l'ordine ha usato un coupon che è un referral code di una master
// (coupon.master_id valorizzato), la vendita viene attribuita a quella
// master con GLI STESSI CAMPI già usati per le vendite POS (operatore_
// tipo/id/nome) — così compare nella sua dashboard esattamente come una
// vendita al banco, distinta solo da origine="woocommerce".
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_WEBHOOK_SECRET  — lo stesso "Segreto" impostato nel webhook di WooCommerce
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già forniti automaticamente
// da Supabase a ogni Edge Function, non vanno impostati a mano.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mappaOrdine, attribuisciMasterReferral, STATI_VIVI, applicaMovimentoBundle, applicaMovimentoProdottiSemplici, sincronizzaDisponibilitaBundle } from "../_shared/woo.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// confronto a tempo costante (evita che un attaccante deduca il secret
// misurando quanto impiega una comparazione carattere per carattere)
function confrontoSicuro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function firmaAttesa(rawBody: string, secret: string): Promise<string> {
  const chiave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Metodo non consentito", { status: 405 });
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") || "";

  // il ping di verifica che WooCommerce manda quando si salva/attiva il
  // webhook è diverso da una consegna vera: non ha nessuna firma ed è
  // "application/x-www-form-urlencoded" con corpo "webhook_id=123" (non
  // JSON). Non contiene nessun dato dell'ordine, quindi non c'è nulla da
  // proteggere: risponde 200 senza pretendere la firma, così WooCommerce
  // non mostra un falso errore alla configurazione del webhook
  if (contentType.includes("x-www-form-urlencoded") && /^webhook_id=\d+$/.test(rawBody)) {
    return new Response("ok (ping di verifica)", { status: 200 });
  }

  const secret = Deno.env.get("WC_WEBHOOK_SECRET");
  if (!secret) {
    console.error("WC_WEBHOOK_SECRET non impostato");
    return new Response("Configurazione mancante", { status: 500 });
  }

  // la firma va calcolata sui byte ESATTI ricevuti: rawBody è già il
  // testo grezzo, letto PRIMA di qualunque JSON.parse
  const firmaRicevuta = req.headers.get("x-wc-webhook-signature") || "";
  const firmaCalcolata = await firmaAttesa(rawBody, secret);

  if (!firmaRicevuta || !confrontoSicuro(firmaRicevuta, firmaCalcolata)) {
    return new Response("Firma non valida", { status: 401 });
  }

  let ordine: any;
  try {
    ordine = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return new Response("JSON non valido", { status: 400 });
  }

  const riga = mappaOrdine(ordine);
  if (!riga) {
    // corpo firmato correttamente ma senza un vero ordine dentro: non
    // c'è niente da salvare, ma la richiesta era legittima
    return new Response("ok (nessun ordine nel payload)", { status: 200 });
  }

  // referral code: se uno dei coupon usati sull'ordine è associato a una
  // master, la vendita va attribuita a lei — un ordine può avere più
  // coupon_lines, la scelta fra più referral riconosciuti e il cancello
  // sulla data di inizio raccolta vivono in attribuisciMasterReferral
  // (condivisa con woo-import-storico, stessa identica regola)
  await attribuisciMasterReferral(supabase, ordine, riga);

  // letto PRIMA dell'upsert: serve a sapere se questo webhook è la prima
  // volta che l'ordine diventa "vivo" (da scaricare) o che smette di
  // esserlo (da ripristinare) — un ordine già vivo che resta vivo (es.
  // "processing" -> "completed", o lo stesso identico webhook consegnato
  // due volte) non deve muovere il magazzino una seconda volta
  const { data: esistente } = await supabase
    .from("vendite_shop")
    .select("stato, prodotti")
    .eq("woo_order_id", riga.woo_order_id as number)
    .maybeSingle();

  const { error } = await supabase.from("vendite_shop").upsert(riga, { onConflict: "woo_order_id" });
  if (error) {
    console.error("Errore upsert vendite_shop:", error.message);
    return new Response("Errore salvataggio: " + error.message, { status: 500 });
  }

  // stock: un ordine che diventa "vivo" scarica, uno che smette di esserlo
  // ripristina. I bundle non hanno giacenza propria e muovono i loro
  // componenti; tutti gli altri prodotti muovono il proprio stock, che da
  // quando è uno solo non viene più riallineato dal sync del catalogo.
  // Un errore qui non deve far fallire la risposta al webhook: la vendita
  // è già salvata, un problema di magazzino va segnalato nei log
  try {
    const eraVivo = STATI_VIVI.includes(String(esistente?.stato || ""));
    const oraVivo = STATI_VIVI.includes(String(riga.stato || ""));
    let bundleToccati = new Set<string>();
    if (!eraVivo && oraVivo) {
      bundleToccati = await applicaMovimentoBundle(supabase, riga.prodotti as any[], -1);
      await applicaMovimentoProdottiSemplici(supabase, riga.prodotti as any[], -1);
    } else if (eraVivo && !oraVivo) {
      bundleToccati = await applicaMovimentoBundle(supabase, (esistente?.prodotti as any[]) || [], 1);
      await applicaMovimentoProdottiSemplici(supabase, (esistente?.prodotti as any[]) || [], 1);
    }
    if (bundleToccati.size) {
      const siteUrl = Deno.env.get("WC_SITE_URL");
      const consumerKey = Deno.env.get("WC_CONSUMER_KEY_WRITE");
      const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
      if (siteUrl && consumerKey && consumerSecret) {
        await sincronizzaDisponibilitaBundle(supabase, bundleToccati, siteUrl, consumerKey, consumerSecret);
      } else {
        console.error("Componenti bundle aggiornati, ma WC_CONSUMER_KEY_WRITE/SECRET mancanti: disponibilità non sincronizzata su WooCommerce");
      }
    }
  } catch (erroreBundle) {
    console.error("Errore nello scarico/ripristino dello stock:", erroreBundle);
  }

  return new Response("ok", { status: 200 });
});
