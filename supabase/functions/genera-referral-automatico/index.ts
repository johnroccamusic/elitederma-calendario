// Edge Function "genera-referral-automatico"
// Schedulata via pg_cron (vedi migrazione 20260820160000): ogni giorno
// controlla se oggi inizia un corso per una master che non ha ancora un
// referral code, e se sì gliene crea uno seguendo le regole di
// regole_referral_automatico. UN SOLO referral code per master, per
// sempre — non uno per corso: se la master ne ha già uno (creato qui o
// a mano dalla tab "Genera referral code"), non viene toccato.
//
// Non duplica la logica di creazione su WooCommerce: inserisce la riga
// "coupon" (bozza, con master_id e generato_da_cron) e poi richiama la
// stessa "woo-crea-coupon" già usata dalla creazione manuale, così i due
// percorsi restano identici e non divergono nel tempo.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (già forniti automaticamente)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function inizialiMaster(nome: string): string {
  const parole = (nome || "").trim().split(/\s+/).filter(Boolean);
  const lettereNome = parole.map((p) => p[0]).join("").toUpperCase().replace(/[^A-Z]/g, "");
  if (lettereNome.length >= 2) return lettereNome.slice(0, 2);
  const soloLettere = (nome || "").toUpperCase().replace(/[^A-Z]/g, "");
  return (soloLettere.slice(0, 2) || "MM").padEnd(2, "X");
}
// 2 iniziali fisse in testa + 3 cifre e 1 lettera casuali, mescolati fra
// loro (non sempre cifre-poi-lettera) — stessa regola usata lato client
// in App.jsx (codiceReferralCasuale), duplicata qui perché le due
// funzioni girano in runtime diversi e non possono condividere codice
function codiceCasuale(nome: string): string {
  const parti = [
    ...Array.from({ length: 3 }, () => "0123456789"[Math.floor(Math.random() * 10)]),
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)],
  ];
  for (let i = parti.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parti[i], parti[j]] = [parti[j], parti[i]];
  }
  return `${inizialiMaster(nome)}${parti.join("")}`;
}
function addGiorniIso(dataIso: string, giorni: number): string {
  const d = new Date(dataIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (giorni || 0));
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const oggi = new Date().toISOString().slice(0, 10);

    const { data: regole } = await supabase.from("regole_referral_automatico").select("*").limit(1).maybeSingle();
    if (!regole) {
      return new Response(JSON.stringify({ errore: "regole_referral_automatico non configurata" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: corsiOggi } = await supabase.from("corsi_date").select("id, data_inizio, data_fine, master_id").eq("data_inizio", oggi).not("master_id", "is", null);
    if (!corsiOggi?.length) {
      return new Response(JSON.stringify({ ok: true, creati: 0, motivo: "Nessun corso inizia oggi" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const masterIds = [...new Set(corsiOggi.map((c: any) => c.master_id as string))];
    const { data: masterEsistenti } = await supabase.from("coupon").select("master_id").in("master_id", masterIds);
    const masterConCodice = new Set((masterEsistenti || []).map((c: any) => c.master_id));
    const masterDaGenerare = masterIds.filter((id) => !masterConCodice.has(id));

    if (masterDaGenerare.length === 0) {
      return new Response(JSON.stringify({ ok: true, creati: 0, motivo: "Le master di oggi hanno già un referral code" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: masterInfo } = await supabase.from("master").select("id, nome").in("id", masterDaGenerare);

    const risultati: { master: string; codice?: string; errore?: string }[] = [];
    for (const m of masterInfo || []) {
      const corso = corsiOggi.find((c: any) => c.master_id === m.id);
      let codice = codiceCasuale(m.nome);
      for (let tentativi = 0; tentativi < 5; tentativi++) {
        const { data: esiste } = await supabase.from("coupon").select("id").eq("codice", codice.toLowerCase()).maybeSingle();
        if (!esiste) break;
        codice = codiceCasuale(m.nome);
      }

      const validoFinoA = corso ? addGiorniIso(corso.data_fine, regole.giorni_validita_dopo_corso) : null;
      const validoDa = regole.valido_durante_corso ? null : (corso?.data_fine || null);

      const { data: riga, error: erroreInsert } = await supabase.from("coupon").insert({
        codice: codice.toLowerCase(),
        descrizione: `Referral automatico — ${m.nome}`,
        tipo_sconto: "percent",
        valore: regole.percentuale_sconto,
        valido_da: validoDa,
        valido_fino_a: validoFinoA,
        ambito: "tutto",
        utilizzi_max: regole.utilizzi_max,
        utilizzi_max_per_utente: regole.utilizzi_max_per_cliente,
        spesa_minima: regole.spesa_minima,
        non_cumulabile: regole.non_cumulabile,
        stato: "bozza",
        master_id: m.id,
        generato_da_cron: true,
        creato_da: "cron",
      }).select().single();

      if (erroreInsert || !riga) {
        risultati.push({ master: m.nome, errore: erroreInsert?.message || "insert fallito" });
        continue;
      }

      const rispostaCreazione = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/woo-crea-coupon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: riga.id }),
      });
      if (!rispostaCreazione.ok) {
        const dettaglio = await rispostaCreazione.text();
        risultati.push({ master: m.nome, errore: "woo-crea-coupon: " + dettaglio });
        continue;
      }
      risultati.push({ master: m.nome, codice });
    }

    return new Response(JSON.stringify({ ok: true, creati: risultati.filter((r) => r.codice).length, risultati }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
