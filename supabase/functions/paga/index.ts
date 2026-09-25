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

function pagina(titolo: string, messaggio: string, codice = 200) {
  return new Response(
    `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px">` +
    `<div style="max-width:420px;text-align:center"><h1 style="font-size:20px;color:#0E1B33;margin:0 0 10px">${titolo}</h1>` +
    `<p style="font-size:15px;line-height:1.6;color:#5E5039;margin:0">${messaggio}</p></div></body></html>`,
    { status: codice, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // sia /paga/7F3K9 sia /paga?c=7F3K9
  const dalPercorso = url.pathname.split("/").filter(Boolean).pop();
  const codice = (url.searchParams.get("c") || (dalPercorso && dalPercorso !== "paga" ? dalPercorso : "") || "").toUpperCase();
  if (!codice) return pagina("Link non valido", "Questo indirizzo non porta a nessun pagamento.", 400);

  const { data: richiesta } = await sb
    .from("pagamenti_pos")
    .select("stato, scade_il, stripe_session_url, stripe_session_id")
    .eq("codice", codice)
    .maybeSingle();

  if (!richiesta) return pagina("Pagamento non trovato", "Il codice non corrisponde a nessuna richiesta. Chiedi che te ne generino uno nuovo.", 404);
  if (richiesta.stato === "annullato") return pagina("Richiesta annullata", "Questo pagamento e' stato annullato al banco.", 410);
  if (richiesta.stato !== "in_attesa") return pagina("Gia' pagato", "Questo pagamento risulta gia' ricevuto. Non serve rifarlo.", 200);
  if (richiesta.scade_il && new Date(richiesta.scade_il).getTime() < Date.now()) {
    return pagina("Richiesta scaduta", "Questo link non vale piu'. Chiedi che te ne generino uno nuovo.", 410);
  }
  if (!richiesta.stripe_session_url) return pagina("Pagamento non pronto", "La richiesta esiste ma non ha ancora una pagina di pagamento. Riprova fra un istante.", 409);

  return new Response(null, { status: 302, headers: { Location: richiesta.stripe_session_url, "Cache-Control": "no-store" } });
});
