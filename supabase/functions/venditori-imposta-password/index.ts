// Edge Function "venditori-imposta-password"
// Imposta (o sostituisce) la password di un venditore, in vista di un
// futuro login del venditore alla propria Dashboard venditori. La
// password in chiaro non viene MAI scritta da nessuna parte: qui si
// genera un salt casuale e si calcola l'hash con PBKDF2-SHA256 (Web
// Crypto nativo di Deno, nessuna libreria esterna), poi si salvano solo
// hash+salt su venditori.password_hash/password_salt.
//
// Il client (schermata "Definisci venditori" in Impostazioni) non legge
// mai queste due colonne: fetchDati() le esclude apposta dal
// caricamento generale, così non finiscono nel browser di chi usa
// l'app — solo questa funzione, con la service role key, può scriverle.
//
// Variabili d'ambiente richieste: nessuna oltre a quelle di sistema
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, già presenti in ogni
// progetto Supabase).
//
// Chiamata dall'app (già autenticata con l'anon key):
//   supabase.functions.invoke('venditori-imposta-password', { body: { venditoreId, password } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function calcolaHash(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

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

  const { venditoreId, password } = corpo || {};
  if (!venditoreId) {
    return new Response(JSON.stringify({ errore: "Parametro mancante: venditoreId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!password || String(password).length < 4) {
    return new Response(JSON.stringify({ errore: "La password deve avere almeno 4 caratteri" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { hash, salt } = await calcolaHash(String(password));
    const { error } = await supabase.from("venditori").update({ password_hash: hash, password_salt: salt }).eq("id", venditoreId);
    if (error) {
      return new Response(JSON.stringify({ errore: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
