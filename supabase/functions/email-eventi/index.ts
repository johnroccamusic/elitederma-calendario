// Edge Function "email-eventi"
//
// Il postino che ci richiama. Resend manda qui un avviso ogni volta che
// una nostra mail viene consegnata, aperta, rimbalzata o segnalata come
// spam, e questa funzione lo annota sulla riga di `email_inviate` che
// quella mail aveva lasciato partendo.
//
// COSA DICE E COSA NON DICE. "Consegnata" vuol dire che il server di
// posta del destinatario l'ha accettata: e' un fatto, e vale. "Aperta"
// si misura con un'immagine invisibile dentro il messaggio, e moltissimi
// programmi di posta la bloccano: una mail letta benissimo puo'
// risultare mai aperta. Per questo la presa visione vera e' l'altra —
// il tasto che preme l'allieva, in `email-presa-visione`. Questa serve a
// vedere i rimbalzi, che sono il guasto che conta: un indirizzo sbagliato
// significa un'allieva senza il suo contratto, e oggi non lo saprebbe
// nessuno.
//
// LA FIRMA SI VERIFICA. L'indirizzo di questa funzione e' pubblico, e
// senza controllo chiunque potrebbe scriverci dentro "consegnata" per
// qualunque mail. Resend firma ogni avviso alla maniera di Svix: HMAC
// SHA-256 su `id.timestamp.corpo`, con un segreto che nasce quando si
// crea il webhook. Senza `RESEND_WEBHOOK_SECRET` la funzione rifiuta
// tutto invece di fidarsi — come fa gia' `woo-webhook`, che e' il
// pattern buono di questo progetto.
//
// Va pubblicata con --no-verify-jwt: chi chiama e' Resend, che non ha un
// JWT del progetto; a fare da serratura e' la firma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

// confronto a tempo costante: su una firma, uscire al primo byte diverso
// dice quanti ne erano giusti
function ugualiACostante(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function firmaValida(req: Request, corpo: string): Promise<boolean> {
  const segreto = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  if (!segreto) return false;

  const id = req.headers.get("svix-id") || "";
  const istante = req.headers.get("svix-timestamp") || "";
  const firme = req.headers.get("svix-signature") || "";
  if (!id || !istante || !firme) return false;

  // un avviso vecchio non si accetta: senza questo, una copia
  // intercettata resterebbe buona per sempre
  const scartoMinuti = Math.abs(Date.now() / 1000 - Number(istante)) / 60;
  if (!Number.isFinite(scartoMinuti) || scartoMinuti > 10) return false;

  // il segreto e' "whsec_" + la chiave in base64. La copia in un buffer
  // suo non e' pignoleria: `decodeBase64` restituisce una vista che per i
  // tipi di Deno potrebbe stare su memoria condivisa, e `importKey` non
  // la accetta.
  const byteChiave = decodeBase64(segreto.replace(/^whsec_/, ""));
  const bufferChiave = new ArrayBuffer(byteChiave.length);
  new Uint8Array(bufferChiave).set(byteChiave);
  const chiave = await crypto.subtle.importKey(
    "raw", bufferChiave,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mia = encodeBase64(new Uint8Array(
    await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(`${id}.${istante}.${corpo}`)),
  ));

  // l'intestazione puo' portarne piu' di una (rotazione del segreto):
  // basta che una corrisponda
  for (const pezzo of firme.split(" ")) {
    const [versione, valore] = pezzo.split(",");
    if (versione !== "v1" || !valore) continue;
    try {
      if (ugualiACostante(decodeBase64(valore), decodeBase64(mia))) return true;
    } catch { /* una firma malformata non e' una firma */ }
  }
  return false;
}

// che cosa si scrive, per ogni tipo di avviso
function daScrivere(tipo: string, quando: string): Record<string, unknown> | null {
  switch (tipo) {
    case "email.delivered":        return { consegnata_il: quando };
    case "email.opened":           return { aperta_il: quando };
    case "email.bounced":          return { rimbalzata_il: quando };
    case "email.complained":       return { rimbalzata_il: quando };
    case "email.delivery_delayed": return {};
    case "email.sent":             return {};
    case "email.clicked":          return {};
    default:                       return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);

  // il corpo si legge come testo UNA volta sola: la firma e' calcolata
  // sui byte esatti, e rileggerlo da JSON e riscriverlo cambierebbe gli
  // spazi, quindi la firma
  const corpo = await req.text();
  if (!(await firmaValida(req, corpo))) return json({ ok: false, errore: "Firma non valida" }, 401);

  let avviso: Record<string, any> = {};
  try { avviso = JSON.parse(corpo); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }

  const tipo = String(avviso.type || "");
  const idMail = String(avviso.data?.email_id || "");
  const quando = String(avviso.created_at || new Date().toISOString());
  if (!idMail) return json({ ok: true, ignorato: "senza email_id" });

  const campi = daScrivere(tipo, quando);
  if (!campi) return json({ ok: true, ignorato: tipo });

  // `ultimo_evento` si scrive sempre: anche un avviso che non ha una
  // colonna sua racconta qualcosa a chi guarda la scheda
  const { data, error } = await admin.from("email_inviate")
    .update({ ...campi, ultimo_evento: tipo })
    .eq("resend_id", idMail)
    .select("id, chiave_modello, iscritto_id");
  if (error) return json({ ok: false, errore: error.message }, 500);

  // UN RIMBALZO SUL MODULO VA SULLA SCHEDA DELL'ALLIEVA.
  //
  // Qui dentro finiva e qui dentro restava: `email_inviate` la guarda
  // solo il fascicolo, e il fascicolo si apre dalla tappa "Modulo
  // ricevuto" in poi — che e' esattamente la tappa che non arrivera' mai,
  // perche' la mail e' rimbalzata. Il 22/10/2026 un modulo e' partito
  // verso «...@europe.con» ed e' tornato indietro mezzo secondo dopo:
  // nella fascia c'era scritto "Modulo inviato", e chi aspettava ha
  // aspettato.
  //
  // Scritto sulla riga dell'iscritta, lo legge la fascia di stato senza
  // aprire niente.
  const rimbalzo = tipo === "email.bounced" || tipo === "email.complained";
  const riga = (data || [])[0];
  if (rimbalzo && riga?.iscritto_id && riga.chiave_modello === "invio_modulo") {
    const { error: erroreScheda } = await admin.from("iscritti")
      .update({ modulo_mail_rimbalzata_il: quando })
      .eq("id", riga.iscritto_id);
    // non si risponde 500: l'avviso di Resend e' stato registrato, e
    // farglielo ripetere all'infinito riscriverebbe solo quello che c'e'
    // gia'. Resta nei log, che e' dove si va a cercare.
    if (erroreScheda) console.error("iscritti.modulo_mail_rimbalzata_il —", erroreScheda.message);
  }

  // LE CAMPAGNE DEL CRM (30/10/2026) hanno il loro registro, una riga a
  // destinatario: stesso id di Resend, stessi avvisi. Un rimbalzo o una
  // segnalazione di spam si scrive sulla riga, e da li' «Prepara i
  // destinatari» non prende piu' quell'indirizzo. Chi ci segnala come spam
  // ha detto, nel modo piu' chiaro che c'e', di non volere altre mail:
  // si disiscrive, con il motivo scritto.
  if (!(data || []).length) {
    const statoCampagna = tipo === "email.delivered" ? "consegnata"
      : tipo === "email.opened" ? "aperta"
      : tipo === "email.bounced" ? "rimbalzata"
      : tipo === "email.complained" ? "segnalata"
      : null;
    const { data: dest, error: errDest } = await admin.from("crm_campagne_destinatari")
      .update({ ...(statoCampagna ? { stato: statoCampagna } : {}), ultimo_evento: tipo, ultimo_evento_il: quando })
      .eq("resend_id", idMail)
      .select("id, contatto_id, email");
    if (errDest) return json({ ok: false, errore: errDest.message }, 500);
    const d = (dest || [])[0];
    if (d && tipo === "email.complained" && d.email) {
      await admin.from("crm_contatti")
        .update({ disiscritto_il: quando, disiscritto_come: "segnalazione spam", aggiornato_il: quando })
        .ilike("email", d.email).is("disiscritto_il", null);
    }
    return json({ ok: true, tipo, righe: 0, campagna: dest?.length || 0 });
  }

  // nessuna riga: la mail non e' partita da noi, o e' di prima del
  // registro. Si risponde 200 lo stesso, o Resend continuerebbe a
  // riprovare per sempre un avviso che non ha destinazione.
  return json({ ok: true, tipo, righe: data?.length || 0 });
});
