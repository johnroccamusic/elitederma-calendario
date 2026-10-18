// Edge Function "invia-email"
// Manda una mail tramite Resend, a nome di notifiche@elitederma.net.
//
// PERCHE' UN DOMINIO A PARTE. elitederma.it sta su Jimdo, che non lascia
// aggiungere i record DNS che servono a Resend (firma DKIM e SPF). Per
// questo l'invio parte da elitederma.net (GoDaddy, verificato su Resend il
// 15/10/2026). Le risposte invece tornano a notifiche@elitederma.it, la
// casella che si legge gia': nessuna posta in entrata dentro l'app.
//
// PERCHE' STA QUI E NON NEL BROWSER. La chiave di Resend permette di
// scrivere a chiunque a nome nostro. Nell'app finirebbe nel bundle, che e'
// scaricabile: sta fra i secrets della funzione e non esce di qui.
//
// CHI PUO' CHIAMARLA. Solo chi ha fatto accesso (gettone di sessione
// valido) oppure un'altra funzione del progetto con la service role key.
// La chiave pubblicabile da sola NON basta: e' nel bundle pubblico, e una
// funzione che spedisce mail aperta a chiunque diventerebbe in un giorno
// un mezzo per mandare spam e phishing col nostro nome.
//
// COSA NON FA. Non e' la strada per le campagne agli ex allievi: per
// quelle servono disiscrizione, invio a lotti e registro, e avranno la
// loro funzione. Qui si manda a pochi destinatari alla volta.
//
// Corpo della richiesta:
//   { a: "x@y.it" | ["x@y.it", …], oggetto, html?, testo?, rispondiA?,
//     allegati?: [{ nome, contenuto }] — contenuto in base64 }
// Almeno uno fra html e testo.
//
// Variabili d'ambiente (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY        obbligatoria
//   EMAIL_MITTENTE_NOME   facoltativa, default "Elitederma Academy"
//   EMAIL_RISPONDI_A      facoltativa, default notifiche@elitederma.it
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MITTENTE_INDIRIZZO = "notifiche@elitederma.net";
const MASSIMO_DESTINATARI = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const emailValida = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// Il gettone arriva nell'header Authorization. Se e' la service role key
// chiama un'altra funzione nostra; altrimenti deve essere la sessione di
// una persona che ha fatto accesso.
async function chiamanteAutorizzato(req: Request): Promise<{ ok: boolean; motivo?: string; chi?: string }> {
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return { ok: false, motivo: "Serve avere fatto accesso." };
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { ok: true, chi: "funzione interna" };
  const { data, error } = await admin.auth.getUser(gettone);
  if (error || !data?.user?.email) return { ok: false, motivo: "Accesso non valido: esci e rientra." };
  return { ok: true, chi: data.user.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const permesso = await chiamanteAutorizzato(req);
  if (!permesso.ok) return json({ errore: permesso.motivo }, 403);

  const chiave = Deno.env.get("RESEND_API_KEY");
  if (!chiave) return json({ errore: "Manca RESEND_API_KEY fra i secrets della funzione" }, 500);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ errore: "JSON non valido" }, 400); }

  const destinatari = (Array.isArray(corpo.a) ? corpo.a : [corpo.a])
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
  if (!destinatari.length) return json({ errore: "Manca il destinatario" }, 400);
  if (destinatari.length > MASSIMO_DESTINATARI) {
    return json({ errore: `Al massimo ${MASSIMO_DESTINATARI} destinatari per invio: le campagne hanno la loro strada.` }, 400);
  }
  const sbagliati = destinatari.filter((d) => !emailValida(d));
  if (sbagliati.length) return json({ errore: "Indirizzi non validi: " + sbagliati.join(", ") }, 400);

  const oggetto = String(corpo.oggetto || "").trim();
  // GLI ALLEGATI. Arrivano gia' in base64 da chi chiama: questa funzione
  // non legge file e non conosce secchi, spedisce e basta. Resend accetta
  // fino a 40 MB per messaggio, ma una casella qualunque molto meno: chi
  // allega si preoccupa del peso prima di arrivare qui.
  //
  // IL TIPO SI DICHIARA. Senza, Resend spedisce tutto come
  // `application/octet-stream`, cioe' "roba binaria": il PDF arriva, ma
  // alcuni programmi di posta non lo riconoscono, non ne fanno
  // l'anteprima e lo mostrano come un file qualunque da scaricare. Per
  // un allegato che e' la copia di un contratto, farsi aprire al primo
  // colpo conta. Se chi chiama non lo dice, si deduce dall'estensione.
  const tipoDaNome = (nome: string) => {
    const est = nome.toLowerCase().split(".").pop() || "";
    return ({
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      csv: "text/csv", txt: "text/plain",
    } as Record<string, string>)[est] || "application/octet-stream";
  };
  const allegati = Array.isArray(corpo.allegati)
    ? corpo.allegati
        .filter((a: any) => a && a.nome && a.contenuto)
        .map((a: any) => ({
          filename: String(a.nome),
          content: String(a.contenuto),
          content_type: String(a.tipo || tipoDaNome(String(a.nome))),
        }))
    : [];
  const html = corpo.html ? String(corpo.html) : undefined;
  const testo = corpo.testo ? String(corpo.testo) : undefined;
  if (!oggetto) return json({ errore: "Manca l'oggetto" }, 400);
  if (!html && !testo) return json({ errore: "Manca il contenuto: html o testo" }, 400);

  const nome = Deno.env.get("EMAIL_MITTENTE_NOME") || "Elitederma Academy";
  const rispondiA = String(corpo.rispondiA || Deno.env.get("EMAIL_RISPONDI_A") || "notifiche@elitederma.it");

  const risposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${nome} <${MITTENTE_INDIRIZZO}>`,
      to: destinatari,
      reply_to: rispondiA,
      subject: oggetto,
      html,
      text: testo,
      ...(allegati.length ? { attachments: allegati } : {}),
    }),
  });
  const esito = await risposta.json().catch(() => ({}));
  if (!risposta.ok) {
    // il messaggio di Resend e' gia' leggibile ("domain not verified",
    // "invalid to address"…): lo si passa com'e'
    return json({ errore: `Resend ${risposta.status}: ${esito?.message || "errore sconosciuto"}` }, 502);
  }
  return json({ ok: true, id: esito?.id, inviataDa: permesso.chi });
});
