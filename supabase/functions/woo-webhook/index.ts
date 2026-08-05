// Edge Function "woo-webhook"
// Riceve i webhook di WooCommerce (ordine creato / ordine aggiornato),
// verifica la firma HMAC-SHA256 con il secret impostato in WooCommerce, e
// salva/aggiorna la vendita nella tabella "vendite_shop" (upsert su
// woo_order_id, così un webhook ripetuto o un aggiornamento successivo
// dello stesso ordine non crea righe duplicate).
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   WC_WEBHOOK_SECRET  — lo stesso "Segreto" impostato nel webhook di WooCommerce
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già forniti automaticamente
// da Supabase a ogni Edge Function, non vanno impostati a mano.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mappaOrdine } from "../_shared/woo.ts";

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

  const secret = Deno.env.get("WC_WEBHOOK_SECRET");
  if (!secret) {
    console.error("WC_WEBHOOK_SECRET non impostato");
    return new Response("Configurazione mancante", { status: 500 });
  }

  // la firma va calcolata sui byte ESATTI ricevuti: va letto il body
  // come testo grezzo PRIMA di fare qualunque JSON.parse
  const rawBody = await req.text();
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
    // "ping" di verifica del webhook (o corpo vuoto): firma corretta,
    // nessun ordine da salvare — rispondere comunque 200 così
    // WooCommerce marca il webhook come attivo
    return new Response("ok (nessun ordine nel payload)", { status: 200 });
  }

  const { error } = await supabase.from("vendite_shop").upsert(riga, { onConflict: "woo_order_id" });
  if (error) {
    console.error("Errore upsert vendite_shop:", error.message);
    return new Response("Errore salvataggio: " + error.message, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
