// Edge Function "genera-referral-automatico"
// Schedulata via pg_cron (vedi migrazione 20260820170000): ogni giorno
// controlla i corsi che iniziano oggi e genera, per ciascuna edizione
// (corsi_date) che non ne ha già uno collegato, un referral code seguendo
// le regole di regole_referral_automatico. UN coupon per EDIZIONE di corso
// (non più uno per master per sempre): due edizioni della stessa master,
// anche nello stesso giorno, ricevono ciascuna il proprio codice.
//
// Con body { backfill: true } (invocazione manuale una tantum, non
// schedulata) elabora le corsi_date con una master associata GIÀ INIZIATE
// (data_inizio <= oggi) prive di un coupon collegato — solo il pregresso:
// le edizioni future restano al cron quotidiano del loro giorno, non le
// tocca il backfill (altrimenti si genererebbero da subito coupon reali su
// WooCommerce per corsi ancora lontani nel tempo).
//
// Non duplica la logica di creazione su WooCommerce: inserisce la riga
// "coupon" (bozza, con master_id, corsi_date_id e generato_da_cron) e poi
// richiama la stessa "woo-crea-coupon" già usata dalla creazione manuale,
// così i due percorsi restano identici e non divergono nel tempo.
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
    let backfill = false;
    try {
      const body = await req.json();
      backfill = body?.backfill === true;
    } catch {
      // body vuoto ({}) o assente: normale invocazione quotidiana del cron
    }

    const { data: regole } = await supabase.from("regole_referral_automatico").select("*").limit(1).maybeSingle();
    if (!regole) {
      return new Response(JSON.stringify({ errore: "regole_referral_automatico non configurata" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let queryCorsi = supabase.from("corsi_date").select("id, data_inizio, data_fine, master_id").not("master_id", "is", null);
    queryCorsi = backfill ? queryCorsi.lte("data_inizio", oggi) : queryCorsi.eq("data_inizio", oggi);
    const { data: corsiCandidati } = await queryCorsi;
    if (!corsiCandidati?.length) {
      return new Response(JSON.stringify({ ok: true, creati: 0, motivo: backfill ? "Nessuna edizione passata senza coupon" : "Nessun corso inizia oggi" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const corsiDateIds = corsiCandidati.map((c: any) => c.id as string);
    const { data: edizioniConCoupon } = await supabase.from("coupon").select("corsi_date_id").in("corsi_date_id", corsiDateIds);
    const edizioniConCodice = new Set((edizioniConCoupon || []).map((c: any) => c.corsi_date_id));
    const corsiDaGenerare = corsiCandidati.filter((c: any) => !edizioniConCodice.has(c.id));

    if (corsiDaGenerare.length === 0) {
      return new Response(JSON.stringify({ ok: true, creati: 0, motivo: "Tutte le edizioni candidate hanno già un referral code" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const masterIds = [...new Set(corsiDaGenerare.map((c: any) => c.master_id as string))];
    const { data: masterInfo } = await supabase.from("master").select("id, nome").in("id", masterIds);
    const masterById: Record<string, { id: string; nome: string }> = {};
    (masterInfo || []).forEach((m: any) => { masterById[m.id] = m; });

    const risultati: { master: string; corsoDataId: string; codice?: string; errore?: string }[] = [];
    for (const corso of corsiDaGenerare as any[]) {
      const m = masterById[corso.master_id];
      if (!m) continue;
      let codice = codiceCasuale(m.nome);
      for (let tentativi = 0; tentativi < 5; tentativi++) {
        const { data: esiste } = await supabase.from("coupon").select("id").eq("codice", codice.toLowerCase()).maybeSingle();
        if (!esiste) break;
        codice = codiceCasuale(m.nome);
      }

      const validoFinoA = addGiorniIso(corso.data_fine, regole.giorni_validita_dopo_corso);
      const validoDa = regole.valido_durante_corso ? null : corso.data_fine;

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
        corsi_date_id: corso.id,
        generato_da_cron: true,
        creato_da: backfill ? "backfill" : "cron",
      }).select().single();

      if (erroreInsert || !riga) {
        risultati.push({ master: m.nome, corsoDataId: corso.id, errore: erroreInsert?.message || "insert fallito" });
        continue;
      }

      const rispostaCreazione = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/woo-crea-coupon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: riga.id }),
      });
      if (!rispostaCreazione.ok) {
        const dettaglio = await rispostaCreazione.text();
        risultati.push({ master: m.nome, corsoDataId: corso.id, errore: "woo-crea-coupon: " + dettaglio });
        continue;
      }
      risultati.push({ master: m.nome, corsoDataId: corso.id, codice });
    }

    return new Response(JSON.stringify({ ok: true, creati: risultati.filter((r) => r.codice).length, risultati }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ errore: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
