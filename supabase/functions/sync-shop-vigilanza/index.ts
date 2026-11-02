// Edge Function "sync-shop-vigilanza"
// Guarda se la sincronizzazione degli ordini del sito e' ferma e, se lo
// e', manda una notifica push e una mail a chi amministra.
//
// PERCHE' UNA FUNZIONE A PARTE. Il guasto dell'1/11/2026 ha ucciso
// `woo-import-storico` a meta' del giro (546 WORKER_RESOURCE_LIMIT):
// non e' arrivata a scrivere il proprio esito, e non sarebbe arrivata
// nemmeno a mandare un avviso su se stessa. Un controllo dentro la cosa
// controllata non vede il caso in cui la cosa controllata muore. Qui si
// guarda il silenzio da fuori: quanto tempo e' passato dall'ultimo giro
// riuscito, non cosa dice l'ultimo giro.
//
// QUANDO: un cron ogni quarto d'ora (`vigila_sync_shop`), qualche minuto
// dopo la sincronizzazione.
//
// CHI PUO' CHIAMARLA: il cron col gettone `x-cron-token`, una persona che
// ha fatto accesso (il tasto "Guarda com'e' adesso" e "Mandami una prova"
// in Vendite shop), o un'altra funzione con la service role key.
//
// Corpo, tutto facoltativo:
//   {}                      il giro vero: controlla, e avvisa se serve
//   { prova: true }         dice cosa farebbe, senza mandare niente e
//                           senza scrivere lo stato
//   { mandaProva: true }    manda una notifica e una mail di prova ai
//                           destinatari configurati, per vedere se la
//                           catena arriva davvero fino al telefono
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { statoSincronizzazione, avvisoSincronizzazione, MINUTI_MASSIMI_SENZA_SYNC } from "../_shared/sync-vigilanza.js";

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

// Identica a quella di `email-programmate`, e per gli stessi motivi: il
// gettone nasce dentro Postgres e non esce dal database, cosi' il cron
// non ha bisogno di una credenziale che scavalca ogni policy.
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

// I dispositivi di chi deve essere avvisato. Si cercano per nome utente
// perche' l'endpoint cambia a ogni reinstallazione; chi non ha mai
// acceso le notifiche, o le ha spente, semplicemente non c'e' - e la
// risposta lo dice, invece di far credere che l'avviso sia partito.
async function dispositiviDi(utenti: string[]) {
  if (!utenti?.length) return [];
  const voluti = new Set(utenti.map(normalizza));
  const { data } = await admin.from("push_iscrizioni")
    .select("endpoint, utente, dispositivo, attiva").eq("attiva", true);
  return (data || []).filter((r: any) => voluti.has(normalizza(r.utente)));
}

async function mandaPush(dispositivi: any[], avviso: { titolo: string; testo: string }) {
  let inviate = 0;
  const errori: string[] = [];
  for (const d of dispositivi) {
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-notifica-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: d.endpoint, titolo: avviso.titolo, testo: avviso.testo,
          url: "/", tag: "sync-shop",
        }),
      });
      const esito = await r.json().catch(() => ({}));
      if (!r.ok || esito?.errore) errori.push(`${d.utente} (${d.dispositivo}): ${esito?.errore || r.status}`);
      else inviate += Number(esito?.inviate || 0);
    } catch (e) {
      errori.push(`${d.utente}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { inviate, errori };
}

async function mandaMail(a: string[], avviso: { titolo: string; testo: string; html: string }) {
  if (!a?.length) return { mandata: false, errore: "nessun indirizzo configurato" };
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ a, oggetto: avviso.titolo, html: avviso.html, testo: avviso.testo }),
    });
    const esito = await r.json().catch(() => ({}));
    if (!r.ok || esito?.errore) return { mandata: false, errore: esito?.errore || `invia-email ${r.status}` };
    return { mandata: true, errore: null };
  } catch (e) {
    return { mandata: false, errore: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!(await autorizzato(req))) return json({ errore: "Non autorizzato" }, 403);

  let corpo: Record<string, unknown> = {};
  try { corpo = req.headers.get("content-length") === "0" ? {} : await req.json(); } catch { /* giro vero */ }
  const prova = corpo.prova === true;
  const mandaProva = corpo.mandaProva === true;

  const { data: riga, error: erroreRiga } = await admin
    .from("sync_shop_vigilanza").select("*").eq("id", 1).maybeSingle();
  if (erroreRiga) return json({ errore: "Lettura impostazioni: " + erroreRiga.message }, 500);
  if (!riga) return json({ errore: "La riga di vigilanza non esiste: va eseguita la migrazione." }, 500);

  // Trenta righe bastano: a un giro ogni quarto d'ora sono sette ore e
  // mezza di storia, molto piu' della soglia.
  const { data: esiti } = await admin
    .from("sync_shop_esiti").select("ts, esito, errori, ordini_importati, completato")
    .order("ts", { ascending: false }).limit(30);

  const adesso = new Date();
  let stato = statoSincronizzazione(esiti || [], adesso.getTime());
  // "muto" vuol dire che non c'e' nemmeno una riga: per chi deve essere
  // avvisato e' silenzio come l'altro, e va detto allo stesso modo.
  if (stato.stato === "muto") stato = { ...stato, stato: "guasto", motivo: "silenzio" };

  const destinatariMail: string[] = Array.isArray(riga.email_avviso) ? riga.email_avviso : [];
  const dispositivi = await dispositiviDi(Array.isArray(riga.push_utenti) ? riga.push_utenti : []);

  // "Mandami una prova": la catena intera - questa funzione, le chiavi
  // VAPID, Resend, il telefono - senza aspettare un guasto vero. Non
  // scrive niente sullo stato, perche' non e' un avviso vero.
  if (mandaProva) {
    const avviso = {
      titolo: "Prova: la vigilanza del sito funziona",
      testo: `Se leggi questo, l'avviso arriva. Adesso la sincronizzazione risulta ${stato.stato === "guasto" ? "FERMA" : "a posto"}.`,
      html: `<p>Se leggi questo, l'avviso arriva.</p><p>Adesso la sincronizzazione risulta <strong>${stato.stato === "guasto" ? "ferma" : "a posto"}</strong>. Questa è una prova chiesta da Vendite shop, non un guasto.</p>`,
    };
    const push = await mandaPush(dispositivi, avviso);
    const mail = await mandaMail(destinatariMail, avviso);
    return json({
      prova: true, stato: stato.stato,
      push: { dispositivi: dispositivi.length, inviate: push.inviate, errori: push.errori },
      mail: { a: destinatariMail, mandata: mail.mandata, errore: mail.errore },
    });
  }

  const eraGuasto = riga.stato === "guasto";
  const oreDaUltimoAvviso = riga.ultimo_avviso_il
    ? (adesso.getTime() - new Date(riga.ultimo_avviso_il).getTime()) / 3600000
    : Infinity;
  const oreFra = Number(riga.ore_fra_avvisi ?? 6);

  // Tre casi, e solo tre:
  //  - guasto nuovo: si avvisa subito;
  //  - guasto che dura: si riavvisa solo ogni `ore_fra_avvisi`, perche'
  //    un avviso ripetuto ogni quarto d'ora e' un avviso che si spegne;
  //  - rientro: un avviso solo, perche' sapere che e' finita vale quanto
  //    sapere che era iniziata.
  const guastoNuovo = stato.stato === "guasto" && !eraGuasto;
  const guastoCheDura = stato.stato === "guasto" && eraGuasto && oreDaUltimoAvviso >= oreFra;
  const rientro = stato.stato === "a_posto" && eraGuasto;
  const daAvvisare = riga.acceso !== false && (guastoNuovo || guastoCheDura || rientro);

  const avviso = daAvvisare ? avvisoSincronizzazione(stato, { rientro }) : null;

  if (prova) {
    return json({
      prova: true, sogliaMinuti: MINUTI_MASSIMI_SENZA_SYNC, acceso: riga.acceso !== false,
      stato: stato.stato, motivo: stato.motivo,
      minutiDaUltimoGiroRiuscito: Number.isFinite(stato.minutiDaOk) ? Math.round(stato.minutiDaOk) : null,
      erroriDiSeguito: stato.erroriDiSeguito,
      avviserebbe: daAvvisare, perche: guastoNuovo ? "guasto nuovo" : guastoCheDura ? "guasto che dura" : rientro ? "rientro" : "niente da dire",
      destinatari: { mail: destinatariMail, dispositivi: dispositivi.map((d: any) => `${d.utente} (${d.dispositivo})`) },
      avviso,
    });
  }

  let esitoAvviso: string | null = riga.ultimo_esito_avviso ?? null;
  if (avviso) {
    const push = await mandaPush(dispositivi, avviso);
    const mail = await mandaMail(destinatariMail, avviso);
    esitoAvviso = [
      `${rientro ? "rientro" : "guasto"} ${adesso.toISOString().slice(0, 16).replace("T", " ")}`,
      `push ${push.inviate}/${dispositivi.length}${push.errori.length ? ` (${push.errori.join("; ").slice(0, 150)})` : ""}`,
      `mail ${mail.mandata ? "ok" : `NO: ${mail.errore}`}`,
    ].join(" · ");
  }

  // Lo stato si scrive SEMPRE, anche quando non si avvisa: e'
  // `ultimo_controllo_il` a dire che la vigilanza stessa e' viva. Senza,
  // un sorvegliante morto sarebbe indistinguibile da tutto a posto - che
  // e' esattamente il guasto da cui e' nata.
  const aggiornamento: Record<string, unknown> = {
    stato: stato.stato,
    ultimo_controllo_il: adesso.toISOString(),
    ultimo_esito_avviso: esitoAvviso,
  };
  if (guastoNuovo) aggiornamento.guasto_dal = adesso.toISOString();
  if (stato.stato === "a_posto") { aggiornamento.guasto_dal = null; aggiornamento.avvisi_mandati = 0; }
  if (avviso && !rientro) {
    aggiornamento.ultimo_avviso_il = adesso.toISOString();
    aggiornamento.avvisi_mandati = Number(riga.avvisi_mandati || 0) + 1;
  }
  const { error: erroreScrittura } = await admin.from("sync_shop_vigilanza").update(aggiornamento).eq("id", 1);

  return json({
    stato: stato.stato, motivo: stato.motivo,
    minutiDaUltimoGiroRiuscito: Number.isFinite(stato.minutiDaOk) ? Math.round(stato.minutiDaOk) : null,
    avvisato: !!avviso, rientro, esitoAvviso,
    scrittura: erroreScrittura ? erroreScrittura.message : "ok",
  });
});
