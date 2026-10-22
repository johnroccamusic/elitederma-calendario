// Edge Function "stripe-crea-pagamento"
// Il banco chiede un pagamento con carta: qui nasce la sessione su
// Stripe e il codice corto da trasformare in QR.
//
// La pagina di Stripe raccoglie anche i dati di fatturazione, perche'
// e' la cliente a scriverli dal suo telefono e non l'operatore a
// leggerli ad alta voce. Stripe da' tre campi liberi e non uno di piu':
// qui sono codice fiscale, codice destinatario e PEC. Partita IVA e
// indirizzo passano dai campi suoi.
//
// Variabili d'ambiente: STRIPE_SECRET_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// niente O/0 e I/1: un codice va anche letto ad alta voce quando il QR
// non si inquadra
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function codiceCorto(lunghezza = 6) {
  const numeri = new Uint32Array(lunghezza);
  crypto.getRandomValues(numeri);
  return Array.from(numeri, (n) => ALFABETO[n % ALFABETO.length]).join("");
}

function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const chiave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!chiave) return risposta({ errore: "STRIPE_SECRET_KEY non impostata fra i secret delle edge function." }, 500);

  let corpo: any;
  try { corpo = await req.json(); } catch { return risposta({ errore: "Corpo non valido." }, 400); }

  const righe = Array.isArray(corpo?.righe) ? corpo.righe : [];
  const importo = Number(corpo?.importo);
  if (!Number.isFinite(importo) || importo <= 0) return risposta({ errore: "Importo mancante o non valido." }, 400);
  if (righe.length === 0) return risposta({ errore: "Nessuna riga da pagare." }, 400);

  // il totale delle righe deve fare il totale chiesto: se non torna, e'
  // un errore di chi chiama e non va scoperto dopo, sulla fattura
  const sommaRighe = righe.reduce((s: number, r: any) => s + (Number(r.prezzo) || 0) * (Number(r.quantita) || 1), 0);
  if (Math.abs(sommaRighe - importo) > 0.02) {
    return risposta({ errore: `Le righe fanno ${sommaRighe.toFixed(2)} € ma l'importo chiesto e' ${importo.toFixed(2)} €.` }, 400);
  }

  // un codice libero: lo si riprova qualche volta, la collisione su sei
  // caratteri e' rarissima ma non impossibile
  let codice = "";
  for (let tentativo = 0; tentativo < 6 && !codice; tentativo += 1) {
    const c = codiceCorto();
    const { data: gia } = await sb.from("pagamenti_pos").select("id").eq("codice", c).maybeSingle();
    if (!gia) codice = c;
  }
  if (!codice) return risposta({ errore: "Non sono riuscito a generare un codice libero." }, 500);

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const indirizzoCorto = `${base}/functions/v1/paga/${codice}`;
  // Finito il pagamento si torna sull'APP, non qui: le edge function di
  // Supabase rispondono "text/plain" con una CSP "sandbox", e una
  // pagina HTML servita da qui il telefono non la disegna — se la
  // scarica come file, col sorgente dentro. La ricevuta la fa l'app.
  const app = (Deno.env.get("APP_URL") || "https://app.elitederma.net").replace(/\/$/, "");
  const ricevuta = `${app}/?ricevuta=${codice}`;
  // QUANTO VALE IL LINK.
  //
  // Due ore sono la misura del banco: la cliente e' li' davanti e o
  // paga o non paga. Non sono la misura di un link mandato a qualcuno
  // perche' paghi piu' tardi — quello arriva su WhatsApp e viene aperto
  // la sera, e scaduto non dice nemmeno perche'. Chi chiama puo'
  // chiedere di piu'; Stripe non accetta oltre le 24 ore dalla
  // creazione, quindi quello e' il tetto.
  const ore = Math.min(24, Math.max(0.5, Number(corpo?.oreValide) || 2));
  const scadeIl = new Date(Date.now() + ore * 3600 * 1000);

  // SERVE LA FATTURA, SI' O NO: lo decide il banco prima di mostrare il
  // QR, e cambia tutto quello che la cliente si trova davanti.
  //
  // Prima questa pagina chiedeva a chiunque indirizzo completo, codice
  // fiscale (obbligatorio) e partita IVA. Anche a chi comprava un
  // pennello da dieci euro: una persona ferma alla cassa a scrivere su
  // un telefono i dati di un documento che non le serve. E tutti quegli
  // incassi finivano poi fra le "fatture da emettere", perche' i dati
  // c'erano — non perche' qualcuno li avesse voluti.
  //
  // Col no si chiede solo quello che Stripe chiede comunque per
  // incassare: la carta e un'email per la ricevuta.
  const vuoleFattura = corpo?.richiedeFattura === true;

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("locale", "it");
  form.set("billing_address_collection", vuoleFattura ? "required" : "auto");
  if (vuoleFattura) form.set("tax_id_collection[enabled]", "true");
  form.set("customer_creation", "always");
  // Quello che la cliente legge sull'estratto conto e sulla ricevuta di
  // Stripe. Senza fattura resta un acquisto come un altro.
  form.set("payment_intent_data[description]", vuoleFattura
    ? String(corpo?.descrizione || "Acquisto Elitederma").slice(0, 200)
    : "Acquisto da shop online");
  form.set("expires_at", String(Math.floor(scadeIl.getTime() / 1000)));
  form.set("success_url", ricevuta);
  form.set("cancel_url", ricevuta);
  form.set("metadata[codice]", codice);
  righe.forEach((r: any, i: number) => {
    form.set(`line_items[${i}][price_data][currency]`, "eur");
    form.set(`line_items[${i}][price_data][product_data][name]`, String(r.nome || "Articolo").slice(0, 250));
    form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round((Number(r.prezzo) || 0) * 100)));
    form.set(`line_items[${i}][quantity]`, String(Math.max(1, Math.round(Number(r.quantita) || 1))));
  });
  // i tre campi che Stripe non ha di suo e che servono alla fattura
  const campi = vuoleFattura ? [
    { key: "codicefiscale", etichetta: "Codice fiscale", obbligatorio: true, max: 16 },
    { key: "codicedestinatario", etichetta: "Codice destinatario SDI (se non ce l'hai, lascia vuoto)", obbligatorio: false, max: 7 },
    { key: "pec", etichetta: "PEC (se non ce l'hai, lascia vuoto)", obbligatorio: false, max: 100 },
  ] : [];
  campi.forEach((c, i) => {
    form.set(`custom_fields[${i}][key]`, c.key);
    form.set(`custom_fields[${i}][label][type]`, "custom");
    form.set(`custom_fields[${i}][label][custom]`, c.etichetta);
    form.set(`custom_fields[${i}][type]`, "text");
    form.set(`custom_fields[${i}][optional]`, c.obbligatorio ? "false" : "true");
    form.set(`custom_fields[${i}][text][maximum_length]`, String(c.max));
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!r.ok) return risposta({ errore: `Stripe ha rifiutato la richiesta (${r.status}): ${await r.text()}` }, 502);
  const sessione = await r.json();

  const { error } = await sb.from("pagamenti_pos").insert({
    codice,
    importo,
    descrizione: corpo?.descrizione || null,
    righe,
    operatore_tipo: corpo?.operatore?.tipo || null,
    operatore_id: corpo?.operatore?.id || null,
    operatore_nome: corpo?.operatore?.nome || null,
    corso_data_id: corpo?.corsoDataId || null,
    carrello_id: corpo?.carrelloId || null,
    // QUANDO SI RISCUOTE UN ORDINE GIA' FATTO, il link sa a quale.
    //
    // Senza, succede questo (22/10/2026): una vendita al banco non
    // pagata, il link rimandato dal dettaglio ordine, la cliente paga —
    // e il pagamento resta senza vendita. Il recupero notturno prova
    // allora a crearne una NUOVA dalle righe della richiesta, ma li'
    // dentro c'e' una riga sola che si chiama «Ordine POS-...», che a
    // catalogo non esiste: fallisce, in silenzio, ogni cinque minuti.
    // Intanto l'Advisor continua a dire che quell'incasso e' rimasto
    // indietro, e la vendita vera resta li' come non pagata.
    //
    // Con la vendita scritta qui non c'e' niente da creare: il recupero
    // salta la riga (cerca solo quelle senza vendita) e l'avviso
    // sparisce da solo.
    vendita_id: corpo?.venditaId || null,
    stato: "in_attesa",
    richiede_fattura: vuoleFattura,
    stripe_session_id: sessione.id,
    stripe_session_url: sessione.url,
    scade_il: scadeIl.toISOString(),
  });
  if (error) return risposta({ errore: "Sessione creata su Stripe ma non salvata: " + error.message }, 500);

  return risposta({ codice, indirizzo: indirizzoCorto, scadeIl: scadeIl.toISOString() });
});
