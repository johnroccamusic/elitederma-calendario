// Edge Function "paga"
// L'indirizzo corto che finisce dentro il QR del POS.
//
// .../functions/v1/paga/7F3K9  ->  302 sulla pagina di Stripe.
//
// Esiste per una ragione sola: la lunghezza. L'indirizzo che Stripe
// restituisce per una sessione di pagamento e' lungo centinaia di
// caratteri, e un QR che deve contenerli diventa un reticolo fitto che
// la fotocamera di un telefono, nella luce di un'aula, fatica a
// leggere. Questo invece sta in una sessantina di caratteri.
//
// Non passa dall'app apposta: il telefono di chi paga non deve
// scaricare due megabyte di applicazione per essere rimandato altrove.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Da qui non esce piu' nessuna pagina.
//
// Le edge function di Supabase rispondono con "content-type: text/plain"
// e una CSP "sandbox": una pagina HTML servita da qui il browser non la
// disegna, la mostra come testo o se la scarica come file — ed e'
// esattamente quello che e' successo sul telefono della prima cliente
// che ha pagato, che si e' ritrovata il sorgente della pagina.
//
// Quindi: o si rimanda a Stripe, o si rimanda alla ricevuta dell'app,
// che e' un sito vero e sa disegnarsi.
const APP = (Deno.env.get("APP_URL") || "https://elitederma-calendario.vercel.app").replace(/\/$/, "");

function versoLApp(codice: string, stato = 200) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP}/?ricevuta=${encodeURIComponent(codice)}`, "Cache-Control": "no-store" },
  });
}
function messaggioSecco(testo: string, stato: number) {
  return new Response(testo, { status: stato, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // sia /paga/7F3K9 sia /paga?c=7F3K9
  const dalPercorso = url.pathname.split("/").filter(Boolean).pop();
  const codice = (url.searchParams.get("c") || (dalPercorso && dalPercorso !== "paga" ? dalPercorso : "") || "").toUpperCase();
  if (!codice) return messaggioSecco("Questo indirizzo non porta a nessun pagamento.", 400);

  const { data: richiesta } = await sb
    .from("pagamenti_pos")
    .select("stato, scade_il, stripe_session_url, stripe_session_id")
    .eq("codice", codice)
    .maybeSingle();

  // qualunque strada diversa dal "vai a pagare" finisce sulla ricevuta:
  // e' lei che sa dire se e' gia' pagato, annullato o scaduto, e lo dice
  // con l'intestazione della societa' davanti
  if (!richiesta) return messaggioSecco("Il codice non corrisponde a nessuna richiesta. Chiedi che te ne generino uno nuovo.", 404);
  if (richiesta.stato !== "in_attesa") return versoLApp(codice);
  if (richiesta.scade_il && new Date(richiesta.scade_il).getTime() < Date.now()) return versoLApp(codice);
  if (!richiesta.stripe_session_url) return versoLApp(codice);

  return new Response(null, { status: 302, headers: { Location: richiesta.stripe_session_url, "Cache-Control": "no-store" } });
});
