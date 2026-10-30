// Edge Function "crm-campagna-invia" (30/10/2026)
// Spedisce una campagna del CRM, cento destinatari alla volta, con Resend.
//
// PERCHE' NON invia-email. Quella ha il tetto di venti destinatari e manda
// UNA mail a tutti insieme; una campagna manda una mail A TESTA, ognuna col
// suo nome dentro e il suo link di disiscrizione, e deve poter arrivare a
// ventimila persone senza che una pagina del browser resti aperta per
// un'ora. Qui ogni chiamata fa un lotto e dice quanti ne restano: chi
// chiama (la pagina Campagne) richiama finche' la coda e' vuota, e se si
// chiude a meta' la campagna resta "in invio" e si riprende da dove era.
//
// CHI PUO' CHIAMARLA. Solo chi ha fatto accesso o la service role key, come
// invia-email: la chiave di Resend scrive a chiunque a nome nostro.
//
// Corpo:
//   { campagna_id, lotto?: 100 }            spedisce il prossimo lotto
//   { campagna_id, prova: { a: "x@y.it" } }  manda la mail a un indirizzo
//                                            solo, con valori finti, senza
//                                            toccare i destinatari
//
// Variabili d'ambiente: RESEND_API_KEY (obbligatoria), EMAIL_MITTENTE_NOME,
// EMAIL_RISPONDI_A, APP_URL (default https://elitederma-calendario.vercel.app).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { componiCampagna } from "../_shared/email.js";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MITTENTE_INDIRIZZO = "notifiche@elitederma.net";
const LOTTO_MASSIMO = 100;   // il massimo dell'endpoint batch di Resend
const APP_URL = (Deno.env.get("APP_URL") || "https://elitederma-calendario.vercel.app").replace(/\/$/, "");
const FUNZIONI_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function chiamanteAutorizzato(req: Request): Promise<{ ok: boolean; motivo?: string; chi?: string }> {
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return { ok: false, motivo: "Serve avere fatto accesso." };
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { ok: true, chi: "funzione interna" };
  const { data, error } = await admin.auth.getUser(gettone);
  if (error || !data?.user?.email) return { ok: false, motivo: "Accesso non valido: esci e rientra." };
  return { ok: true, chi: data.user.email };
}

async function societa() {
  const { data } = await admin.from("intestazione_societa").select("nome, indirizzo, indirizzo_2").limit(1).maybeSingle();
  return data || null;
}

// il link di disiscrizione: la pagina dell'app per chi legge, la funzione
// pubblica per il tasto del programma di posta (List-Unsubscribe), che fa
// una POST senza aprire niente
const linkPagina = (token: string) => `${APP_URL}/?disiscrizione=${encodeURIComponent(token)}`;
const linkUnClick = (token: string) => `${FUNZIONI_URL}/crm-disiscrivi?t=${encodeURIComponent(token)}`;

type Destinatario = {
  id: string; email: string; nome: string | null; valori: Record<string, string> | null; token_disiscrizione: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const permesso = await chiamanteAutorizzato(req);
  if (!permesso.ok) return json({ errore: permesso.motivo }, 403);
  const chiave = Deno.env.get("RESEND_API_KEY");
  if (!chiave) return json({ errore: "Manca RESEND_API_KEY fra i secrets della funzione" }, 500);

  let corpo: Record<string, any> = {};
  try { corpo = await req.json(); } catch { return json({ errore: "JSON non valido" }, 400); }
  const campagnaId = String(corpo.campagna_id || "");
  if (!campagnaId) return json({ errore: "Manca campagna_id" }, 400);

  const { data: camp, error: errCamp } = await admin.from("crm_campagne").select("*").eq("id", campagnaId).maybeSingle();
  if (errCamp || !camp) return json({ errore: "Campagna non trovata" }, 404);
  if (!String(camp.oggetto || "").trim()) return json({ errore: "La campagna non ha un oggetto" }, 400);
  if (!String(camp.corpo_html || "").trim()) return json({ errore: "La campagna non ha un testo" }, 400);

  const nomeMittente = Deno.env.get("EMAIL_MITTENTE_NOME") || "Elitederma Academy";
  const rispondiA = Deno.env.get("EMAIL_RISPONDI_A") || "notifiche@elitederma.it";
  const ditta = await societa();

  // ---- la prova: una mail sola, a chi la sta scrivendo
  if (corpo.prova && corpo.prova.a) {
    const a = String(corpo.prova.a).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) return json({ errore: "Indirizzo di prova non valido" }, 400);
    const m = componiCampagna({
      oggetto: camp.oggetto, corpoHtml: camp.corpo_html,
      valori: { nome: "Giulia", cognome: "Rossi", comune: "Roma", provincia: "ROMA", regione: "LAZIO", corso: "Microblading" },
      societa: ditta, linkDisiscrizione: `${APP_URL}/?disiscrizione=prova`,
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${nomeMittente} <${MITTENTE_INDIRIZZO}>`, to: [a], reply_to: rispondiA,
        subject: `[PROVA] ${m.oggetto}`, html: m.html, text: m.testo,
      }),
    });
    const esito = await r.json().catch(() => ({}));
    if (!r.ok) return json({ errore: `Resend ${r.status}: ${esito?.message || "errore sconosciuto"}` }, 502);
    await admin.from("crm_campagne").update({ prova_inviata_a: a, prova_inviata_il: new Date().toISOString() }).eq("id", campagnaId);
    return json({ ok: true, prova: a, id: esito?.id });
  }

  // ---- il lotto
  if (!["pronta", "in_invio"].includes(camp.stato)) return json({ errore: `La campagna è ${camp.stato}: non si può spedire.` }, 400);
  const lotto = Math.min(LOTTO_MASSIMO, Math.max(1, Number(corpo.lotto) || LOTTO_MASSIMO));
  const { data: coda, error: errCoda } = await admin.from("crm_campagne_destinatari")
    .select("id, email, nome, valori, token_disiscrizione")
    .eq("campagna_id", campagnaId).eq("stato", "in_coda")
    .order("id").limit(lotto);
  if (errCoda) return json({ errore: errCoda.message }, 500);
  const destinatari = (coda || []) as Destinatario[];

  if (camp.stato === "pronta") {
    await admin.from("crm_campagne").update({ stato: "in_invio", aggiornata_il: new Date().toISOString() }).eq("id", campagnaId);
  }

  if (destinatari.length === 0) {
    const { count } = await admin.from("crm_campagne_destinatari").select("id", { count: "exact", head: true })
      .eq("campagna_id", campagnaId).eq("stato", "in_coda");
    if (!count) {
      await admin.from("crm_campagne").update({ stato: "inviata", inviata_il: new Date().toISOString(), aggiornata_il: new Date().toISOString() }).eq("id", campagnaId);
    }
    return json({ ok: true, inviate: 0, fallite: 0, restanti: count || 0, stato: count ? "in_invio" : "inviata" });
  }

  // UNA MAIL A TESTA. Il nome dentro, il link di disiscrizione suo, e le
  // due intestazioni che fanno comparire il tasto "Disiscriviti" in Gmail
  // e in Mail: quella con l'indirizzo e quella che dice che basta una POST.
  const messaggi = destinatari.map((d) => {
    const token = d.token_disiscrizione || "";
    const valori = {
      nome: String(d.valori?.nome || "").trim(), cognome: String(d.valori?.cognome || "").trim(),
      comune: String(d.valori?.comune || "").trim(), provincia: String(d.valori?.provincia || "").trim(),
      regione: String(d.valori?.regione || "").trim(), corso: String(d.valori?.corso || "").trim(),
    };
    const m = componiCampagna({ oggetto: camp.oggetto, corpoHtml: camp.corpo_html, valori, societa: ditta, linkDisiscrizione: linkPagina(token) });
    return {
      from: `${nomeMittente} <${MITTENTE_INDIRIZZO}>`,
      to: [d.email], reply_to: rispondiA,
      subject: m.oggetto, html: m.html, text: m.testo,
      headers: {
        "List-Unsubscribe": `<${linkUnClick(token)}>, <mailto:${rispondiA}?subject=disiscrizione>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "campagna", value: campagnaId }],
    };
  });

  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify(messaggi),
  });
  const esito = await r.json().catch(() => ({}));
  const adesso = new Date().toISOString();
  let inviate = 0, fallite = 0;
  if (!r.ok) {
    // il lotto intero e' stato rifiutato (chiave, dominio, limite): si
    // segna l'errore su ogni riga e ci si ferma, cosi' chi guarda lo legge
    const messaggio = `Resend ${r.status}: ${esito?.message || "errore sconosciuto"}`;
    await admin.from("crm_campagne_destinatari")
      .update({ stato: "fallita", errore: messaggio, ultimo_evento: "rifiuto lotto", ultimo_evento_il: adesso })
      .in("id", destinatari.map((d) => d.id));
    fallite = destinatari.length;
  } else {
    // Resend risponde con gli id nello stesso ordine dei messaggi
    const ids: Array<{ id?: string }> = Array.isArray(esito?.data) ? esito.data : [];
    for (let i = 0; i < destinatari.length; i++) {
      const id = ids[i]?.id || null;
      if (id) {
        await admin.from("crm_campagne_destinatari").update({ stato: "inviata", resend_id: id, inviata_il: adesso, errore: null }).eq("id", destinatari[i].id);
        inviate++;
      } else {
        await admin.from("crm_campagne_destinatari").update({ stato: "fallita", errore: "Resend non ha restituito un id", ultimo_evento_il: adesso }).eq("id", destinatari[i].id);
        fallite++;
      }
    }
  }

  const { count: restanti } = await admin.from("crm_campagne_destinatari").select("id", { count: "exact", head: true })
    .eq("campagna_id", campagnaId).eq("stato", "in_coda");
  const { count: totInviate } = await admin.from("crm_campagne_destinatari").select("id", { count: "exact", head: true })
    .eq("campagna_id", campagnaId).in("stato", ["inviata", "consegnata", "aperta", "rimbalzata", "segnalata"]);
  const { count: totFallite } = await admin.from("crm_campagne_destinatari").select("id", { count: "exact", head: true })
    .eq("campagna_id", campagnaId).eq("stato", "fallita");
  const finita = !restanti;
  await admin.from("crm_campagne").update({
    inviate: totInviate || 0, fallite: totFallite || 0,
    stato: finita ? "inviata" : "in_invio",
    inviata_il: finita ? adesso : null,
    aggiornata_il: adesso,
  }).eq("id", campagnaId);

  return json({ ok: r.ok, inviate, fallite, restanti: restanti || 0, stato: finita ? "inviata" : "in_invio", inviataDa: permesso.chi, ...(r.ok ? {} : { errore: `Resend ${r.status}: ${esito?.message || ""}` }) });
});
