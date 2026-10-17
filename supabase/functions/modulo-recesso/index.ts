// Edge Function "modulo-recesso"
//
// Registra il recesso di un'allieva e avvisa chi deve saperlo.
//
// CHI PUO' CHIAMARLA. Chi ha il gettone del recesso. E' lo stesso
// lasciapassare delle altre pagine pubbliche, e qui non e' una
// comodita': un diritto con una scadenza di quattordici giorni non puo'
// dipendere dal fatto che qualcuno ricordi una password. Per questo va
// pubblicata con --no-verify-jwt.
//
// COSA PUO' FARE CHI AVESSE UN GETTONE RUBATO: sciogliere QUEL
// contratto, una volta sola, e far partire tre mail agli indirizzi di
// casa. Non puo' leggere altro, non puo' toccare altre iscrizioni, e il
// secondo tentativo viene rifiutato — l'atto e' unico per iscritto.
//
// IL LAVORO SUL DATABASE NON STA QUI. Sta in `recesso_registra`, una
// transazione sola che scrive l'atto e cambia lo stato: separati, un
// guasto a meta' lascerebbe o un'iscrizione che occupa ancora un posto o
// un recesso senza prova. Qui restano l'indirizzo IP, che in SQL non si
// vede, e le mail.
//
// LE TRE MAIL, in quest'ordine di importanza:
//   1. all'allieva: la ricevuta, con data, ora, importo e 14 giorni
//   2. alla PEC: e' l'indirizzo che il regolamento dichiara al Punto 3
//   3. al venditore che ha seguito l'iscrizione, se ha un indirizzo
//
// Se una mail non parte, il recesso resta registrato: e' un atto
// giuridico, non puo' dipendere da un server di posta. Il guasto finisce
// nel registro degli invii.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { proteggi, APRE_HTML } from "../_shared/email.js";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const emailValida = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const euro = (n: unknown) => `€ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
const dataOra = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" });

async function spedisci(a: string, oggetto: string, testo: string, html: string) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ a, oggetto, html, testo }),
  });
  const esito = await r.json().catch(() => ({}));
  if (!r.ok || esito?.errore) return { errore: esito?.errore || `invia-email ${r.status}`, id: null };
  return { errore: null, id: esito?.id || null };
}

// una riga nel registro per ogni invio, riuscito o no
async function registra(chiave: string, a: string, oggetto: string, d: Record<string, unknown>, errore: string | null, id: string | null) {
  await admin.from("email_inviate").insert({
    chiave_modello: chiave, destinatario: a, iscritto_id: d.iscritto_id,
    corso_data_id: d.corso_data_id || null, oggetto,
    esito: errore ? "errore" : "ok", errore, resend_id: id,
    automatica: true, inviata_da: "recesso",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const token = String(corpo.token || "").trim();
  const motivo = String(corpo.motivo || "").trim().slice(0, 2000);
  if (token.length < 12) return json({ ok: false, errore: "Link non valido." }, 400);

  // l'IP com'e' arrivato al bordo: la prima voce di x-forwarded-for e'
  // quella del chiamante, le altre sono i passaggi intermedi
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("cf-connecting-ip") || null;
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 500) || null;

  const { data: d, error } = await admin.rpc("recesso_registra", {
    p_token: token, p_motivo: motivo || null, p_ip: ip, p_user_agent: userAgent,
  });
  if (error) return json({ ok: false, errore: error.message }, 500);
  if (!d?.ok) return json({ ok: false, errore: d?.errore || "Non è stato possibile registrare il recesso." }, 409);

  const corso = d.corso || {};
  const totale = d.rimborso?.totale || 0;
  const voci = (d.rimborso?.voci || []) as { voce: string; importo: number }[];
  const quando = dataOra(d.avvenuto_il);
  const chi = [d.nome, d.cognome].filter(Boolean).join(" ");
  const righe = [
    ["Corso", corso.nome],
    ["Date", corso.inizio ? (corso.fine && corso.fine !== corso.inizio ? `${corso.inizio} – ${corso.fine}` : corso.inizio) : ""],
    ["Città", corso.citta],
    ["Contratto firmato il", d.firmato_il ? dataOra(d.firmato_il) : ""],
    ["Recesso registrato il", quando],
  ].filter(([, v]) => v);
  const tabella = righe.map(([k, v]) => `${k}: ${v}`).join("\n");
  const tabellaHtml = `<table style="border-collapse:collapse;margin:16px 0">${righe
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7a7f8c">${proteggi(k)}</td><td style="padding:4px 0"><strong>${proteggi(v)}</strong></td></tr>`)
    .join("")}</table>`;
  const dettaglioRimborso = voci.length
    ? "\n" + voci.map((v) => `  ${v.voce}: ${euro(v.importo)}`).join("\n")
    : "";

  // ------------------------------------------------- 1. all'allieva
  if (emailValida(String(d.email || ""))) {
    const oggetto = `Recesso registrato — ${corso.nome || "il tuo corso"}`;
    const testo = [
      `Ciao ${d.nome || ""},`.trim(),
      "",
      `abbiamo registrato il tuo recesso dal contratto di iscrizione il ${quando}.`,
      "",
      tabella,
      "",
      totale > 0
        ? `Ti rimborseremo ${euro(totale)} entro 14 giorni dalla comunicazione del recesso.${dettaglioRimborso}`
        : "Non risultano somme versate da rimborsare.",
      "",
      d.motivo ? `Motivo che ci hai indicato: ${d.motivo}` : "",
      "",
      "Questa mail vale come ricevuta.",
      "",
      "Elitederma Academy",
    ].filter((r) => r !== null).join("\n");
    const html = `${APRE_HTML}`
      + `<p style="margin:0 0 14px">Ciao ${proteggi(d.nome || "")},</p>`
      + `<p style="margin:0 0 14px">abbiamo registrato il tuo recesso dal contratto di iscrizione il <strong>${proteggi(quando)}</strong>.</p>`
      + tabellaHtml
      + (totale > 0
          ? `<p style="margin:0 0 6px">Ti rimborseremo <strong>${proteggi(euro(totale))}</strong> entro 14 giorni dalla comunicazione del recesso.</p>`
            + `<div style="font-size:13px;color:#7a7f8c;margin:0 0 14px">${voci.map((v) => `${proteggi(v.voce)}: ${proteggi(euro(v.importo))}`).join("<br>")}</div>`
          : `<p style="margin:0 0 14px">Non risultano somme versate da rimborsare.</p>`)
      + (d.motivo ? `<p style="margin:0 0 14px;color:#7a7f8c">Motivo che ci hai indicato: ${proteggi(String(d.motivo))}</p>` : "")
      + `<p style="margin:22px 0 0">Questa mail vale come ricevuta.</p>`
      + `<p style="margin:14px 0 0">Elitederma Academy</p>`
      + `\n</div>`;
    const { errore: e1, id } = await spedisci(String(d.email), oggetto, testo, html);
    await registra("recesso_ricevuta", String(d.email), oggetto, d, e1, id);
  }

  // ------------------------------------- 2. alla PEC e all'amministrazione
  const interni = [d.pec, d.email_amministrazione]
    .map((x) => String(x || "").trim()).filter((x) => emailValida(x));
  for (const a of interni) {
    const oggetto = `RECESSO — ${chi} — ${corso.nome || ""}`.trim();
    const testo = [
      `${chi} ha esercitato il diritto di recesso.`,
      "",
      tabella,
      "",
      totale > 0 ? `Da rimborsare: ${euro(totale)} entro 14 giorni.${dettaglioRimborso}` : "Nessuna somma da rimborsare.",
      d.motivo ? `\nMotivo indicato: ${d.motivo}` : "",
      "",
      `Indirizzo IP: ${ip || "non rilevato"}`,
      `Email dell'allievo/a: ${d.email || "non presente in scheda"}`,
    ].join("\n");
    const html = `${APRE_HTML}`
      + `<p style="margin:0 0 14px"><strong>${proteggi(chi)}</strong> ha esercitato il diritto di recesso.</p>`
      + tabellaHtml
      + (totale > 0
          ? `<p style="margin:0 0 6px">Da rimborsare: <strong>${proteggi(euro(totale))}</strong> entro 14 giorni.</p>`
            + `<div style="font-size:13px;color:#7a7f8c;margin:0 0 14px">${voci.map((v) => `${proteggi(v.voce)}: ${proteggi(euro(v.importo))}`).join("<br>")}</div>`
          : `<p style="margin:0 0 14px">Nessuna somma da rimborsare.</p>`)
      + (d.motivo ? `<p style="margin:0 0 14px">Motivo indicato: ${proteggi(String(d.motivo))}</p>` : "")
      + `<div style="font-size:12px;color:#7a7f8c;margin-top:18px">Indirizzo IP: ${proteggi(ip || "non rilevato")}<br>`
      + `Email dell'allievo/a: ${proteggi(String(d.email || "non presente in scheda"))}</div>`
      + `\n</div>`;
    const { errore: e2, id } = await spedisci(a, oggetto, testo, html);
    await registra("recesso_avviso_interno", a, oggetto, d, e2, id);
  }

  // ------------------------------------------------ 3. al venditore
  // il legame con il venditore oggi e' il NOME scritto in `tutor`, non
  // un collegamento: se nessuno corrisponde, l'avviso interno sopra e'
  // comunque partito, e qui non si fa finta di niente ne' si blocca.
  if (d.tutor) {
    const { data: v } = await admin.from("venditori")
      .select("nome, email").ilike("nome", String(d.tutor)).limit(1).maybeSingle();
    const a = String(v?.email || "").trim();
    if (emailValida(a) && !interni.includes(a)) {
      const oggetto = `Recesso di ${chi} — ${corso.nome || ""}`.trim();
      const testo = [
        `${chi}, che hai seguito tu, ha esercitato il diritto di recesso il ${quando}.`,
        "", tabella, "",
        totale > 0 ? `Da rimborsare: ${euro(totale)}.` : "Nessuna somma da rimborsare.",
      ].join("\n");
      const html = `${APRE_HTML}`
        + `<p style="margin:0 0 14px"><strong>${proteggi(chi)}</strong>, che hai seguito tu, ha esercitato il diritto di recesso il ${proteggi(quando)}.</p>`
        + tabellaHtml
        + `<p style="margin:0">${totale > 0 ? `Da rimborsare: <strong>${proteggi(euro(totale))}</strong>.` : "Nessuna somma da rimborsare."}</p>`
        + `\n</div>`;
      const { errore: e3, id } = await spedisci(a, oggetto, testo, html);
      await registra("recesso_avviso_venditore", a, oggetto, d, e3, id);
    }
  }

  return json({
    ok: true, avvenuto_il: d.avvenuto_il, rimborso: d.rimborso,
    rimborso_entro: d.rimborso_entro,
  });
});
