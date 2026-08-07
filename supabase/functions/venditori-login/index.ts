// Edge Function "venditori-login"
// Verifica la password di un venditore per l'accesso in sola lettura
// alla propria Dashboard venditori. Se il venditore non ha ancora una
// password esplicita (password_hash nullo — es. creato prima di questa
// funzionalità), accetta "0000" come password di default, la stessa
// assegnata automaticamente ad ogni nuovo venditore da "Definisci
// venditori".
//
// Non restituisce MAI hash/salt al client: solo esito ok/errore e il
// nome del venditore (per mostrarlo nella dashboard). Il client non
// legge mai password_hash/password_salt direttamente — solo questa
// funzione, con la service role key, le confronta lato server.
//
// Chiamata dall'app (già autenticata con l'anon key):
//   supabase.functions.invoke('venditori-login', { body: { venditoreId, password } })

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
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function verificaHash(password: string, saltHex: string, hashAtteso: string): Promise<boolean> {
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return bytesToHex(new Uint8Array(bits)) === hashAtteso;
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
  if (!venditoreId || !password) {
    return new Response(JSON.stringify({ errore: "Scegli il tuo nome e scrivi la password" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { data: venditore, error: erroreLettura } = await supabase
      .from("venditori")
      .select("id, nome, password_hash, password_salt")
      .eq("id", venditoreId)
      .single();
    if (erroreLettura || !venditore) {
      return new Response(JSON.stringify({ errore: "Venditore non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const valida = !venditore.password_hash
      ? String(password) === "0000"
      : await verificaHash(String(password), venditore.password_salt, venditore.password_hash);

    if (!valida) {
      return new Response(JSON.stringify({ errore: "Password errata" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, nome: venditore.nome }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
