// Edge Function "invia-notifica-push"
// Manda una notifica ai telefoni iscritti in push_iscrizioni.
//
// PERCHE' STA QUI E NON NEL BROWSER. Per spedire una notifica serve la
// chiave VAPID PRIVATA: firma la richiesta al servizio di push di Apple
// o di Google e dice "sono io". Se stesse nell'app finirebbe nel
// bundle, e chiunque potrebbe scrivere sul telefono delle master. Sta
// nelle variabili d'ambiente di questa funzione e non esce di qui.
//
// A chi: si passa UNO fra
//   { masterId: "<uuid>" }   tutti i dispositivi di quella master
//   { endpoint: "https://…" } un dispositivo solo (serve alla prova)
//   { tutte: true }           tutti i dispositivi attivi
// piu' { titolo, testo, url?, tag? }.
//
// GLI ENDPOINT MUOIONO DA SOLI. Quando una master disinstalla l'app o
// il telefono cambia, il servizio di push risponde 404 o 410: quella
// riga si SPEGNE (attiva = false) invece di essere cancellata, cosi'
// resta scritto che quel telefono c'era. Senza questa pulizia la
// tabella si riempie di indirizzi morti e ogni invio diventa piu'
// lento, in silenzio.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const pubblica = Deno.env.get("VAPID_PUBLIC_KEY");
  const privata = Deno.env.get("VAPID_PRIVATE_KEY");
  const soggetto = Deno.env.get("VAPID_SUBJECT") || "mailto:commerciale.elitederma@gmail.com";
  if (!pubblica || !privata) return json({ errore: "Chiavi VAPID mancanti fra i secrets della funzione" }, 500);
  webpush.setVapidDetails(soggetto, pubblica, privata);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ errore: "JSON non valido" }, 400); }

  const titolo = String(corpo.titolo || "").trim();
  const testo = String(corpo.testo || "").trim();
  if (!titolo) return json({ errore: "Manca il titolo della notifica" }, 400);

  let query = supabase.from("push_iscrizioni").select("id, endpoint, p256dh, auth").eq("attiva", true);
  if (corpo.endpoint) query = query.eq("endpoint", String(corpo.endpoint));
  else if (corpo.masterId) query = query.eq("master_id", String(corpo.masterId));
  else if (corpo.tutte !== true) return json({ errore: "Dire a chi: masterId, endpoint, oppure tutte: true" }, 400);

  const { data: iscrizioni, error } = await query;
  if (error) return json({ errore: "Lettura iscrizioni: " + error.message }, 500);
  if (!iscrizioni?.length) return json({ ok: true, inviate: 0, spente: 0, nota: "Nessun dispositivo iscritto per questo destinatario." });

  const carico = JSON.stringify({ titolo, testo, url: corpo.url || "/", tag: corpo.tag || null });
  let inviate = 0;
  const spente: string[] = [];
  const errori: string[] = [];

  for (const i of iscrizioni) {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        carico,
        { TTL: 60 * 60 * 24 },
      );
      inviate += 1;
      await supabase.from("push_iscrizioni").update({ ultimo_invio: new Date().toISOString(), ultimo_errore: null }).eq("id", i.id);
    } catch (e: any) {
      const stato = e?.statusCode;
      if (stato === 404 || stato === 410) {
        // il telefono non c'e' piu': si spegne la riga, non e' un errore
        spente.push(i.endpoint);
        await supabase.from("push_iscrizioni").update({ attiva: false, ultimo_errore: `${stato} dal servizio di push` }).eq("id", i.id);
      } else {
        const msg = `${stato || "?"} ${e?.body || e?.message || e}`.slice(0, 300);
        errori.push(msg);
        await supabase.from("push_iscrizioni").update({ ultimo_errore: msg }).eq("id", i.id);
      }
    }
  }
  return json({ ok: true, inviate, spente: spente.length, errori });
});
