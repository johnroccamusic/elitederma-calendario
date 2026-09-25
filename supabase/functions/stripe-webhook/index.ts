// Edge Function "stripe-webhook"
// Stripe ci dice che il pagamento e' andato a buon fine.
//
// Qui si fanno tre cose e una no:
//   1. si verifica la firma (stesso schema di woo-webhook: senza firma
//      valida chiunque potrebbe dichiarare incassi che non esistono);
//   2. si segna la richiesta come pagata;
//   3. si scrivono i dati di fatturazione che la cliente ha compilato.
//
// Quello che NON si fa e' emettere la fattura. Una fattura emessa non
// si annulla, si fa una nota di credito: fra l'incasso e il documento
// ci va una persona che guarda i dati. La richiesta resta in
// "da_verificare" e l'emissione parte dall'app.
//
// Variabili d'ambiente: STRIPE_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function confrontoSicuro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function firmaAttesa(payload: string, segreto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// L'intestazione di Stripe: "t=1699999999,v1=abc...,v1=def..."
function pezziFirma(intestazione: string) {
  const parti = intestazione.split(",").map((p) => p.trim().split("="));
  const t = parti.find((p) => p[0] === "t")?.[1] || "";
  const v1 = parti.filter((p) => p[0] === "v1").map((p) => p[1]);
  return { t, v1 };
}

// i tre campi liberi tornano indietro come li abbiamo chiesti
function campoLibero(sessione: any, chiave: string): string {
  const c = (sessione?.custom_fields || []).find((x: any) => x.key === chiave);
  return String(c?.text?.value || "").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Metodo non consentito", { status: 405 });

  // Il segreto di firma sta nel Vault, dove l'ha messo
  // "stripe-configura-webhook" quando ha registrato l'endpoint: non e'
  // passato per le mani di nessuno. Resta il ripiego sulla variabile
  // d'ambiente, per chi preferisce incollarlo a mano.
  let segreto: string | null = null;
  try {
    const { data } = await sb.rpc("segreto_vault", { nome: "stripe_webhook_secret" });
    if (data) segreto = String(data);
  } catch (e) {
    console.error("Vault non raggiungibile:", e);
  }
  if (!segreto) segreto = Deno.env.get("STRIPE_WEBHOOK_SECRET") || null;
  if (!segreto) { console.error("Segreto di firma non trovato ne' nel Vault ne' fra i secret"); return new Response("Configurazione mancante", { status: 500 }); }

  const payload = await req.text();
  const intestazione = req.headers.get("stripe-signature") || "";
  const { t, v1 } = pezziFirma(intestazione);
  if (!t || v1.length === 0) return new Response("Firma mancante", { status: 400 });

  // finestra di cinque minuti: una richiesta vecchia rigiocata da altri
  // non deve valere
  const eta = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(eta) || eta > 300) return new Response("Firma scaduta", { status: 400 });

  const attesa = await firmaAttesa(`${t}.${payload}`, segreto);
  if (!v1.some((f) => confrontoSicuro(f, attesa))) return new Response("Firma non valida", { status: 401 });

  let evento: any;
  try { evento = JSON.parse(payload); } catch { return new Response("JSON non valido", { status: 400 }); }

  if (evento.type !== "checkout.session.completed") {
    return new Response("ok (evento che non ci riguarda)", { status: 200 });
  }

  const sessione = evento.data?.object || {};
  const codice = String(sessione?.metadata?.codice || "").toUpperCase();
  if (!codice) return new Response("ok (sessione senza codice)", { status: 200 });

  const { data: richiesta } = await sb.from("pagamenti_pos").select("*").eq("codice", codice).maybeSingle();
  if (!richiesta) { console.error("Pagamento non trovato per il codice", codice); return new Response("ok (codice sconosciuto)", { status: 200 }); }
  // consegnato due volte: la seconda non deve rifare niente
  if (richiesta.stato !== "in_attesa") return new Response("ok (gia' registrato)", { status: 200 });

  const dettagli = sessione.customer_details || {};
  const indirizzo = dettagli.address || {};
  const nomeIntero = String(dettagli.name || "").trim();
  const pezzi = nomeIntero.split(/\s+/);
  const piva = (dettagli.tax_ids || []).map((x: any) => x.value).filter(Boolean)[0] || null;

  const cliente = {
    nome: pezzi.length > 1 ? pezzi.slice(0, -1).join(" ") : nomeIntero,
    cognome: pezzi.length > 1 ? pezzi[pezzi.length - 1] : null,
    ditta: piva ? nomeIntero : null,
    piva,
    codice_fiscale: campoLibero(sessione, "codicefiscale") || null,
    cod_dest: campoLibero(sessione, "codicedestinatario").toUpperCase() || null,
    pec: campoLibero(sessione, "pec") || null,
    indirizzo: indirizzo.line1 || null,
    civico: indirizzo.line2 || null,
    cap: indirizzo.postal_code || null,
    citta: indirizzo.city || null,
    provincia: indirizzo.state || null,
    email: dettagli.email || null,
    telefono: dettagli.phone || null,
  };

  // il cliente entra in anagrafica fatturazione: la fattura poi si
  // costruisce da li', e la scheda resta anche se la si riusa domani
  const { data: clienteSalvato } = await sb.from("clienti_fattura").insert(cliente).select("id").single();

  const { error } = await sb.from("pagamenti_pos").update({
    stato: "da_verificare",
    stripe_payment_intent: sessione.payment_intent || null,
    pagato_il: new Date().toISOString(),
    cliente,
    cliente_fattura_id: clienteSalvato?.id || null,
    aggiornato_il: new Date().toISOString(),
  }).eq("id", richiesta.id).eq("stato", "in_attesa");
  if (error) { console.error("Non sono riuscito a segnare il pagamento:", error.message); return new Response("Errore salvataggio", { status: 500 }); }

  return new Response("ok", { status: 200 });
});
