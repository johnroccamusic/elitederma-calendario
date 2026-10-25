// Edge Function "leggi-voce" (25/10/2026 sera): trasforma il TESTO di una
// risposta dell'assistente in audio con una voce naturale. Il titolare ha
// chiesto una voce come quella dell'app di Claude, e il telefono non ce
// l'ha: serve un servizio di sintesi. Qui si usa OpenAI (gpt-4o-mini-tts,
// voce «nova» in italiano). Esce solo il testo della risposta — mai la
// voce di chi parla, che resta sul dispositivo.
//
// Senza la chiave (secret OPENAI_API_KEY) risponde 503 e il pannello
// torna alla voce del telefono: la conversazione non si ferma.
// Serve una sessione vera (getUser), come le altre.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const testo = String(corpo.testo || "").trim().slice(0, 2500);
  if (!testo) return json({ ok: false, errore: "Niente da leggere." }, 400);

  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: utente } = await admin.auth.getUser(gettone);
  if (!utente?.user) return json({ ok: false, errore: "Serve l'accesso all'app." }, 401);

  const chiave = Deno.env.get("OPENAI_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Voce naturale non configurata.", ripiego: true }, 503);

  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts", voice: "nova", input: testo, response_format: "mp3", speed: 1,
      instructions: "Parla in italiano, con tono caldo e naturale, come una collega esperta che spiega con calma. Pronuncia i numeri e le percentuali in italiano.",
    }),
  });
  if (!r.ok) return json({ ok: false, errore: `La sintesi ha risposto ${r.status}: ${(await r.text()).slice(0, 200)}`, ripiego: true }, 502);
  return new Response(r.body, { status: 200, headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
});
