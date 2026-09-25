// Edge Function "stripe-configura-webhook"
// Registra su Stripe il webhook che ci avvisa degli incassi, e mette al
// sicuro il suo segreto di firma.
//
// Esiste per togliere di mezzo un passaggio a mano che, nel pannello di
// Stripe, cambia posto a ogni restyling: qui l'endpoint si crea via
// API, il segreto di firma torna nella risposta e finisce dritto nel
// Vault, senza passare da nessuna chat e senza che nessuno debba
// copiarlo.
//
// E' idempotente: se l'endpoint per questo indirizzo c'e' gia', non ne
// crea un secondo. Un endpoint duplicato vorrebbe dire ricevere due
// volte lo stesso incasso.
//
// Variabili d'ambiente: STRIPE_SECRET_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NOME_SEGRETO = "stripe_webhook_secret";
const EVENTO = "checkout.session.completed";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const chiave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!chiave) return risposta({ errore: "STRIPE_SECRET_KEY non impostata." }, 500);

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const indirizzo = `${base}/functions/v1/stripe-webhook`;

  const intestazioni = { Authorization: `Bearer ${chiave}`, "Content-Type": "application/x-www-form-urlencoded" };

  // c'e' gia'?
  const elenco = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: intestazioni });
  if (!elenco.ok) return risposta({ errore: `Stripe non risponde (${elenco.status}): ${await elenco.text()}` }, 502);
  const esistenti = (await elenco.json())?.data || [];
  const gia = esistenti.find((e: any) => e.url === indirizzo);

  if (gia) {
    // Il segreto di firma Stripe lo mostra SOLO alla creazione: su un
    // endpoint che esiste gia' non si puo' piu' rileggere. Se nel Vault
    // non c'e', l'unica e' rifarlo — quindi lo si dice invece di far
    // credere che sia tutto a posto.
    const { data: nelVault } = await sb.rpc("segreto_vault", { nome: NOME_SEGRETO });
    return risposta({
      gia: true,
      endpoint: gia.id,
      indirizzo,
      eventi: gia.enabled_events,
      attivo: gia.status === "enabled",
      segretoInCassaforte: !!nelVault,
      nota: nelVault
        ? "L'endpoint c'era gia' e il segreto di firma e' al sicuro: non c'e' niente da fare."
        : "L'endpoint c'era gia' ma il suo segreto di firma non e' da nessuna parte, e Stripe non lo rimostra. Cancella questo endpoint dal pannello Stripe e rilancia questa funzione, oppure passami il segreto a mano.",
    });
  }

  const form = new URLSearchParams();
  form.set("url", indirizzo);
  form.set("enabled_events[]", EVENTO);
  form.set("description", "Genyon — incassi del POS");
  const creato = await fetch("https://api.stripe.com/v1/webhook_endpoints", { method: "POST", headers: intestazioni, body: form });
  if (!creato.ok) return risposta({ errore: `Stripe ha rifiutato la creazione (${creato.status}): ${await creato.text()}` }, 502);
  const endpoint = await creato.json();

  const segreto = endpoint.secret;
  if (!segreto) return risposta({ errore: "Stripe ha creato l'endpoint ma non ha restituito il segreto di firma." }, 502);

  // nel Vault, non in una tabella: in public lo leggerebbe chiunque
  const { error } = await sb.rpc("salva_segreto_vault", { nome: NOME_SEGRETO, valore: segreto });
  if (error) {
    return risposta({
      errore: `Endpoint creato (${endpoint.id}) ma segreto non salvato: ${error.message}. Vai su Stripe, apri l'endpoint, copia il "Segreto di firma" e mettilo a mano.`,
    }, 500);
  }

  return risposta({ creato: true, endpoint: endpoint.id, indirizzo, eventi: endpoint.enabled_events, segretoInCassaforte: true });
});
