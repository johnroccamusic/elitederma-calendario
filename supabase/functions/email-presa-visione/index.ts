// Edge Function "email-presa-visione"
//
// La ricevuta che l'allieva firma: apre il link in fondo alla mail di
// conferma, preme il tasto, e da quel momento c'e' scritto che ha
// dichiarato di aver ricevuto la sua copia firmata del modulo.
//
// PERCHE' NON BASTA IL CLIC. Un link dentro una mail viene aperto anche
// da chi non e' una persona: l'antispam del destinatario, l'anteprima
// del programma di posta, il controllo di sicurezza aziendale. Lo fanno
// in GET, pochi secondi dopo la consegna. Se registrassimo la presa
// visione all'apertura, ogni mail risulterebbe confermata prima ancora
// che qualcuno l'avesse vista — cioe' una ricevuta che si firma da sola,
// buona da mostrare e inutile da sostenere.
//
// Quindi: GET disegna una pagina con un tasto, e non scrive niente. La
// conferma la registra il POST di quel modulo, che nessun controllo
// automatico fa partire.
//
// PERCHE' UNA PAGINA SUA E NON UNA ROTTA DELL'APP. Una ricevuta deve
// rispondere anche il giorno in cui il gestionale e' fermo o sta
// ripubblicando. Qui non c'e' React, non c'e' il bundle, non c'e' niente
// da caricare: HTML scritto a mano, servito dalla stessa funzione.
//
// Va pubblicata con --no-verify-jwt: chi la apre e' un'allieva con un
// link, senza account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const NAVY = "#0E1B33";
const TAUPE = "#8C7A63";

function pagina(corpo: string, stato = 200) {
  return new Response(
    `<!doctype html><html lang="it"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex">`
    + `<title>Conferma di ricezione — Elitederma</title>`
    + `<style>`
    + `body{margin:0;background:#FBF8F2;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;`
    + `color:${NAVY};display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}`
    + `.foglio{background:#fff;border:1px solid #EFE7D8;border-radius:16px;padding:32px 28px;max-width:440px;width:100%;`
    + `box-shadow:0 8px 30px rgba(14,27,51,.07)}`
    + `h1{font-size:19px;margin:0 0 10px;line-height:1.35}`
    + `p{font-size:14.5px;line-height:1.6;color:#4a5160;margin:0 0 14px}`
    + `button{background:${TAUPE};color:#fff;border:0;border-radius:10px;padding:14px 22px;font-size:15px;`
    + `font-weight:700;cursor:pointer;width:100%}`
    + `.ok{color:#2E7D32;font-weight:700}`
    + `.piede{font-size:12px;color:#8b90a0;margin:18px 0 0}`
    + `</style></head><body><div class="foglio">${corpo}</div></body></html>`,
    { status: stato, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || "").trim();
  if (token.length < 24) {
    return pagina(`<h1>Link non valido</h1><p>Questo indirizzo non corrisponde a nessuna conferma. `
      + `Controlla di averlo copiato per intero dalla mail.</p>`, 400);
  }

  const { data: riga } = await admin
    .from("email_inviate")
    .select("id, destinatario, oggetto, inviata_il, confermata_il")
    .eq("token_conferma", token).maybeSingle();

  if (!riga) {
    return pagina(`<h1>Link non valido</h1><p>Questo indirizzo non corrisponde a nessuna conferma.</p>`, 404);
  }

  // GIA' CONFERMATA: si dice, e non si riscrive la data. Vale la prima
  // volta — quella e' la data che conta, e sovrascriverla ogni volta che
  // si riapre la mail vorrebbe dire perderla.
  if (riga.confermata_il) {
    return pagina(`<h1>Conferma già registrata</h1>`
      + `<p>Risulta registrata il <strong>${quando(riga.confermata_il)}</strong>. Non devi fare altro.</p>`
      + `<p class="piede">Elitederma Srl</p>`);
  }

  if (req.method === "POST") {
    const adesso = new Date().toISOString();
    const { error } = await admin.from("email_inviate")
      .update({ confermata_il: adesso }).eq("id", riga.id).is("confermata_il", null);
    if (error) {
      return pagina(`<h1>Non è stato possibile registrare la conferma</h1>`
        + `<p>Riprova fra qualche minuto. Se continua, scrivici a notifiche@elitederma.it.</p>`, 500);
    }
    return pagina(`<h1 class="ok">Grazie, è tutto registrato.</h1>`
      + `<p>Abbiamo annotato che hai ricevuto la copia firmata del tuo modulo di iscrizione, `
      + `il <strong>${quando(adesso)}</strong>.</p>`
      + `<p>Conserva la mail con l'allegato: è la tua copia del contratto.</p>`
      + `<p class="piede">Elitederma Srl</p>`);
  }

  // il tasto. Nessun campo da riempire: l'unica cosa che serve e' che a
  // premerlo sia una persona.
  return pagina(`<h1>Conferma di aver ricevuto il modulo firmato</h1>`
    + `<p>Alla mail del ${quando(riga.inviata_il)} era allegata la copia firmata del tuo modulo `
    + `di iscrizione, in PDF.</p>`
    + `<p>Premendo qui sotto confermi di averla ricevuta. Serve a tutti e due per avere una data certa.</p>`
    + `<form method="post"><button type="submit">Confermo di averlo ricevuto</button></form>`
    + `<p class="piede">Elitederma Srl — se non hai trovato l'allegato, scrivici a notifiche@elitederma.it `
    + `e te lo rimandiamo.</p>`);
});
