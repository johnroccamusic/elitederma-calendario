// Edge Function "crm-disiscrivi" (30/10/2026) — PUBBLICA, senza JWT.
//
// E' l'indirizzo scritto nell'intestazione List-Unsubscribe delle mail di
// campagna. Gmail, Mail di iPhone e Outlook mostrano un tasto
// "Disiscriviti" e, premuto, fanno una POST qui SENZA aprire nessuna
// pagina (RFC 8058, "one-click"). Quindi:
//   POST ?t=<gettone>  -> disiscrive e risponde 200, nient'altro
//   GET  ?t=<gettone>  -> rimanda alla pagina dell'app che lo fa a vista
//
// Non tocca la tabella da sola: chiama crm_disiscrivi, la stessa funzione
// del database che usa la pagina, con la service role. Il gettone e' lungo
// 36 caratteri casuali e vale per un contatto solo: senza, qui non succede
// niente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const APP_URL = (Deno.env.get("APP_URL") || "https://elitederma-calendario.vercel.app").replace(/\/$/, "");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("t") || "").trim();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET, POST" } });
  }
  if (req.method === "GET") {
    return Response.redirect(`${APP_URL}/?disiscrizione=${encodeURIComponent(token)}`, 302);
  }
  if (req.method !== "POST") return new Response("Metodo non consentito", { status: 405 });
  if (!token) return new Response("Manca il gettone", { status: 400 });
  const { data, error } = await admin.rpc("crm_disiscrivi", { p_token: token, p_come: "tasto del programma di posta" });
  if (error) return new Response("Errore: " + error.message, { status: 500 });
  if (!data?.ok) return new Response("Link non valido", { status: 404 });
  return new Response("Disiscrizione registrata. Non riceverai più queste mail.", {
    status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
});
