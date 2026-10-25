// Edge Function "sistema-testo" (25/10/2026): corregge ortografia e
// punteggiatura e rende piu' chiaro un testo scritto o DETTATO per i
// regolamenti. Non cambia il senso: cifre, percentuali, date, nomi di
// prodotti e corsi restano come sono. La proposta torna alla pagina, e
// chi scrive decide se usarla: nessun testo viene salvato da qui.
//
// Serve una sessione vera (getUser): verify_jwt accetta anche il JWT anon
// del bundle. Nessun dato di allievi passa di qui, solo il testo scritto.
const MODELLO = "claude-haiku-5-5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SISTEMA = `Sei il correttore di bozze di Elitederma, un'accademia di formazione estetica. Ricevi il testo di una regola interna (prezzi, sconti, procedure), spesso dettato a voce e quindi senza punteggiatura o con parole fraintese.
Il tuo compito: correggere ortografia, accenti, apostrofi e punteggiatura; spezzare le frasi troppo lunghe; mettere in ordine quello che e' confuso; rendere il testo chiaro per chi deve applicare la regola.
Vincoli assoluti:
- NON cambiare il senso, e NON aggiungere regole, eccezioni, cifre o condizioni che non ci sono;
- cifre, percentuali, importi, date, nomi di prodotti, corsi e persone restano identici (puoi solo scriverli nel formato italiano: 8,5%, 50 €);
- se un passaggio e' ambiguo, lascialo com'e' e segnalalo in «note»;
- mantieni il registro: pratico, diretto, in italiano;
- puoi usare elenchi con «- » e grassetto con ** per la cifra o la parola che conta, con misura.
Rispondi SOLO con un JSON: {"testo": "...", "note": "una riga su cosa hai cambiato o cosa resta ambiguo, oppure vuota"}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const testo = String(corpo.testo || "").trim().slice(0, 6000);
  if (testo.length < 10) return json({ ok: false, errore: "Scrivi prima qualcosa da sistemare." }, 400);

  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: utente } = await admin.auth.getUser(gettone);
  if (!utente?.user) return json({ ok: false, errore: "Serve l'accesso all'app." }, 401);

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Correzione non disponibile: manca la chiave." }, 503);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELLO, max_tokens: 2000, system: SISTEMA, messages: [{ role: "user", content: `Titolo della regola: ${String(corpo.titolo || "").slice(0, 200)}\n\nTesto da sistemare:\n${testo}` }] }),
  });
  if (!r.ok) return json({ ok: false, errore: `Il modello ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
  const esito = await r.json();
  const grezzo = (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  const a = grezzo.indexOf("{"); const b = grezzo.lastIndexOf("}");
  let piano: any = null;
  try { piano = a >= 0 && b > a ? JSON.parse(grezzo.slice(a, b + 1)) : null; } catch { piano = null; }
  if (!piano || typeof piano.testo !== "string" || !piano.testo.trim()) return json({ ok: false, errore: "Non ho capito la risposta del modello." }, 502);
  return json({ ok: true, testo: piano.testo.trim(), note: String(piano.note || "").trim(), uso: esito?.usage || null });
});
