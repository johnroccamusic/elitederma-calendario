// L'AVVISO DEL TEST DI SISTEMA (24/11/2026).
//
// Il titolare: «fallo girare da solo ogni notte».
//
// Il giro lo fa Postgres (`test_di_sistema_notturno`, cron alle 06:20):
// esegue i controlli, scrive il referto in `test_sistema_esiti` e chiama
// questa funzione SOLO quando c'e' qualcosa di nuovo da dire. Qui dentro
// non c'e' nessun controllo e nessuna soglia: si legge il referto gia'
// scritto e si manda. Due posti che decidono «cosa e' rotto» darebbero
// due verdetti sullo stesso database.
//
// PERCHE' SERVE UNA EDGE FUNCTION PER UNA MAIL. Il cron ha la chiave
// pubblicabile, e `invia-email` non la accetta (giustamente: da li' esce
// posta a nome dell'Accademia). Serve la service role, che vive
// nell'ambiente delle edge function e non nel vault — quella del vault e'
// di prima del passaggio alle chiavi nuove, provata, 403.
//
// I DESTINATARI SONO QUELLI DELLA VIGILANZA DELLO SHOP (`sync_shop_vigilanza`),
// e non e' pigrizia: sono gia' «chi riceve gli avvisi di sistema», si
// cambiano da Vendite shop, e una seconda lista vorrebbe dire due posti
// da aggiornare il giorno che una persona cambia mail — con la certezza
// che uno dei due resta indietro. Il giorno che servissero destinatari
// diversi si separa, e si scrive perche'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// identica a `sync-shop-vigilanza` e a `email-programmate`, e per gli
// stessi motivi: il gettone nasce dentro Postgres e non esce dal
// database, cosi' il cron non ha bisogno di una credenziale che scavalca
// ogni policy
async function autorizzato(req: Request): Promise<boolean> {
  const gettoneCron = (req.headers.get("x-cron-token") || "").trim();
  if (gettoneCron) {
    const { data, error } = await admin.rpc("email_cron_ok", { gettone: gettoneCron });
    return !error && data === true;
  }
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return false;
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  const { data, error } = await admin.auth.getUser(gettone);
  return !error && !!data?.user;
}

const normalizza = (s: unknown) => String(s || "").trim().toLowerCase();

async function dispositiviDi(utenti: string[]) {
  if (!utenti?.length) return [];
  const voluti = new Set(utenti.map(normalizza));
  const { data } = await admin.from("push_iscrizioni")
    .select("endpoint, utente, dispositivo, attiva").eq("attiva", true);
  return (data || []).filter((r: any) => voluti.has(normalizza(r.utente)));
}

function componi(riga: any) {
  const referto = Array.isArray(riga?.referto) ? riga.referto : [];
  const rotti = referto.filter((r: any) => r.esito === "rotto");
  const nuovi: string[] = Array.isArray(riga?.rotti_nuovi) ? riga.rotti_nuovi : [];
  const titolo = nuovi.length
    ? `Test di sistema: ${nuovi.length === 1 ? "un controllo è" : `${nuovi.length} controlli sono`} tornato rosso`
    : `Test di sistema: ${rotti.length} ${rotti.length === 1 ? "controllo resta rosso" : "controlli restano rossi"}`;

  // nel testo ci va il GUASTO da cui nasce ogni controllo: un avviso che
  // dice solo «rosso» manda a cercare cosa, e il nome del controllo da
  // solo non basta a ricordarsi di cosa si trattava mesi dopo
  const righe = rotti.map((r: any) => {
    const nuovo = nuovi.includes(r.controllo) ? " [NUOVO]" : "";
    return `• ${r.area} — ${r.controllo}${nuovo}\n  misurato: ${r.misura}\n  atteso: ${r.atteso}\n  nasce da: ${r.nato_da}\n  cosa fare: ${r.cosa_fare}`;
  });
  const testo = [
    nuovi.length
      ? `Stanotte il test di sistema ha trovato qualcosa che ieri era a posto.`
      : `Questi controlli sono rossi da piu' di una settimana.`,
    "",
    ...righe,
    "",
    `A posto: ${riga.quanti_ok}. Da guardare: ${riga.quanti_guarda}. Rossi: ${riga.quanti_rotti}.`,
    "Il referto completo si legge in Impostazioni → Test di sistema.",
  ].join("\n");

  const html = `<p>${nuovi.length
      ? "Stanotte il test di sistema ha trovato qualcosa che ieri era a posto."
      : "Questi controlli sono rossi da più di una settimana."}</p>`
    + rotti.map((r: any) => `<div style="margin:14px 0;padding:10px 12px;border-left:3px solid #C0392B;background:#FBEBE9">
        <b>${r.area} — ${r.controllo}</b>${nuovi.includes(r.controllo) ? ' <span style="color:#C0392B">[NUOVO]</span>' : ""}
        <div>Misurato: <b>${r.misura}</b> · atteso: ${r.atteso}</div>
        <div style="color:#6B6B6B;font-size:13px;margin-top:6px">Nasce da: ${r.nato_da}</div>
        <div style="margin-top:6px">Cosa fare: ${r.cosa_fare}</div>
      </div>`).join("")
    + `<p>A posto: ${riga.quanti_ok}. Da guardare: ${riga.quanti_guarda}. Rossi: ${riga.quanti_rotti}.<br>
        Il referto completo si legge in Impostazioni → Test di sistema.</p>`;

  return { titolo, testo, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!(await autorizzato(req))) return json({ errore: "Non autorizzato" }, 403);

  let corpo: any = {};
  try { corpo = req.headers.get("content-length") === "0" ? {} : await req.json(); } catch { /* vuoto */ }

  // il referto di cui avvisare: quello indicato, o l'ultimo scritto
  const q = admin.from("test_sistema_esiti").select("*");
  const { data: riga } = corpo?.esito_id
    ? await q.eq("id", corpo.esito_id).maybeSingle()
    : await q.order("ts", { ascending: false }).limit(1).maybeSingle();
  if (!riga) return json({ errore: "nessun referto da cui avvisare" }, 404);
  if (!riga.quanti_rotti) return json({ ok: true, niente_da_dire: true });

  const avviso = componi(riga);

  const { data: config } = await admin.from("sync_shop_vigilanza").select("*").eq("id", 1).maybeSingle();
  const mail: string[] = Array.isArray(config?.email_avviso) ? config.email_avviso : [];
  const utenti: string[] = Array.isArray(config?.push_utenti) ? config.push_utenti : [];

  let mailMandata = false; let erroreMail: string | null = null;
  if (mail.length) {
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ a: mail, oggetto: avviso.titolo, html: avviso.html, testo: avviso.testo }),
      });
      const esito = await r.json().catch(() => ({}));
      if (!r.ok || esito?.errore) erroreMail = esito?.errore || `invia-email ${r.status}`;
      else mailMandata = true;
    } catch (e) {
      erroreMail = e instanceof Error ? e.message : String(e);
    }
  } else {
    erroreMail = "nessun indirizzo configurato in sync_shop_vigilanza";
  }

  const dispositivi = await dispositiviDi(utenti);
  let push = 0;
  for (const d of dispositivi) {
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-notifica-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: d.endpoint, titolo: avviso.titolo, testo: avviso.testo, url: "/", tag: "test-sistema" }),
      });
      const esito = await r.json().catch(() => ({}));
      if (r.ok && !esito?.errore) push += Number(esito?.inviate || 0);
    } catch { /* un telefono che non risponde non ferma la mail */ }
  }

  // l'esito dell'avviso si scrive sul referto: «avvisato» senza sapere se
  // la mail e' partita e' la stessa bugia di «salvato» detto prima di
  // saperlo (7/11/2026, i carrelli sospesi)
  await admin.from("test_sistema_esiti")
    .update({ avvisato: mailMandata || push > 0, avviso_errore: erroreMail })
    .eq("id", riga.id);

  return json({ ok: true, rotti: riga.quanti_rotti, nuovi: riga.rotti_nuovi,
                 mail: { a: mail, mandata: mailMandata, errore: erroreMail },
                 push: { inviate: push, dispositivi: dispositivi.length } });
});
