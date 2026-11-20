// Edge Function "ruota-referral-master"
//
// Il referral personale di ogni master dura un mese: il primo del mese
// nasce quello nuovo, il vecchio si cancella dal sito e nell'app si segna
// scaduto. Le regole — cos'e' un referral personale, quale mese, cosa
// fare oggi — stanno in _shared/referralMensile.js, condivise con l'app.
//
// Tre modi di chiamarla:
//  - {}                      il giro vero: adotta, ruota, ritira;
//  - { prova: true }         dice cosa farebbe oggi, senza toccare niente;
//  - { masterId, codice, valore, fasce }
//                            crea il referral del mese a UNA master, dal
//                            tasto "Conferma" di Genera referral code.
//                            Passa di qui e non dal client perche' la
//                            scadenza sul sito va scritta in un modo
//                            diverso da come la scriviamo noi (vedi
//                            primoDelMeseDopo): una strada sola, cosi' i
//                            codici nati a mano e quelli nati dal cron
//                            scadono nello stesso istante.
//
// L'ordine, nel giro vero: PRIMA nasce il codice nuovo, POI si ritira il
// vecchio. Se il nuovo non nasce (WooCommerce giu'), il vecchio NON si
// ritira: e' gia' fuori uso comunque — nell'app per la data, sul sito
// per la sua date_expires — ma resta nel piano, ed e' da lui che il giro
// dopo, un'ora piu' tardi, copia l'accordo per riprovare. Ritirarlo
// lascerebbe la master senza codice e senza niente da cui ripartire.
//
// Chi puo' chiamarla: il cron col gettone (lo stesso delle email, che
// verifica public.email_cron_ok), una persona con una sessione, o un'altra
// funzione con la service role key. La chiave pubblicabile non basta.
//
// Variabili d'ambiente (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (gia' forniti)
//   WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generaCodiceCasuale, livelloIniziale, inizialiMaster } from "../_shared/codiceReferral.js";
import { giornoRoma, pianoDelGiorno, referralDiOggi, rigaCodiceNuovo, ultimoGiornoDelMese, primoDelMeseDopo } from "../_shared/referralMensile.js";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
};
function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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

function woo() {
  const sito = Deno.env.get("WC_SITE_URL");
  const chiave = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const segreto = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!sito || !chiave || !segreto) return null;
  return { sito, auth: "Basic " + btoa(`${chiave}:${segreto}`) };
}

// la scadenza sul sito, scritta alla maniera di WooCommerce
async function scadenzaSulSito(wooId: number, scadenza: string): Promise<string | null> {
  const w = woo();
  if (!w) return "configurazione WooCommerce (scrittura) mancante";
  try {
    const r = await fetch(`${w.sito}/wp-json/wc/v3/coupons/${wooId}`, {
      method: "PUT",
      headers: { Authorization: w.auth, "Content-Type": "application/json" },
      body: JSON.stringify({ date_expires: scadenza }),
    });
    return r.ok ? null : `WooCommerce ${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) {
    return "rete verso WooCommerce: " + String(e);
  }
}

// Dal sito si cancella davvero (force: niente cestino, il codice non
// deve poter tornare). Un 404 va bene: vuol dire che non c'e' gia' piu'.
async function cancellaDalSito(wooId: number): Promise<string | null> {
  const w = woo();
  if (!w) return "configurazione WooCommerce (scrittura) mancante";
  try {
    const r = await fetch(`${w.sito}/wp-json/wc/v3/coupons/${wooId}?force=true`, { method: "DELETE", headers: { Authorization: w.auth } });
    if (r.ok || r.status === 404) return null;
    return `WooCommerce ${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) {
    return "rete verso WooCommerce: " + String(e);
  }
}

// stessa regola di genera-referral-automatico e del tasto nell'app: il
// registro permanente, mai la tabella coupon, che le righe le perde
async function generaCodiceUnivoco(nome: string): Promise<string> {
  const iniziali = inizialiMaster(nome);
  const { count } = await admin.from("codici_emessi").select("codice", { count: "exact", head: true }).ilike("codice", `${iniziali}%`);
  let livello = livelloIniziale(count || 0);
  let tentativi = 0;
  for (;;) {
    const codice = generaCodiceCasuale(nome, livello).toLowerCase();
    const { data: esiste } = await admin.from("codici_emessi").select("codice").eq("codice", codice).maybeSingle();
    if (!esiste) return codice;
    tentativi++;
    if (tentativi >= 12) { livello++; tentativi = 0; }
  }
}

// Fa nascere un codice: registro, riga, sito, scadenza sul sito.
async function creaCodice(riga: Record<string, unknown>, scadenzaSito: string): Promise<{ codice: string; errore?: string }> {
  const codice = String(riga.codice);
  // nel registro PRIMA della riga: se qualcosa fallisce dopo, il codice
  // resta bruciato per sempre e non si riassegna a nessuno
  const { error: erroreRegistro } = await admin.from("codici_emessi").insert({ codice, origine: "mensile", master_id: riga.master_id, corsi_date_id: null });
  if (erroreRegistro) return { codice, errore: "registro codici: " + erroreRegistro.message };
  const { data: nuova, error: erroreRiga } = await admin.from("coupon").insert(riga).select("id").single();
  if (erroreRiga || !nuova) return { codice, errore: "coupon: " + (erroreRiga?.message || "insert fallito") };
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/woo-crea-coupon`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ couponId: nuova.id }),
  });
  if (!r.ok) return { codice, errore: "woo-crea-coupon: " + (await r.text()).slice(0, 200) };
  const { data: creata } = await admin.from("coupon").select("woo_coupon_id").eq("id", nuova.id).single();
  if (creata?.woo_coupon_id) {
    const errore = await scadenzaSulSito(creata.woo_coupon_id, scadenzaSito);
    if (errore) return { codice, errore: "scadenza sul sito: " + errore };
  }
  return { codice };
}

async function leggiCoupon() {
  const { data, error } = await admin.from("coupon")
    .select("*")
    .not("master_id", "is", null)
    .is("corsi_date_id", null);
  if (error) throw new Error("lettura coupon: " + error.message);
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!(await autorizzato(req))) return json({ errore: "Non autorizzato" }, 403);

  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* il cron manda {} */ }

  try {
    const oggi = giornoRoma();
    const coupon = await leggiCoupon();

    // ---- un codice a una master, dal tasto dell'app ----
    if (corpo?.masterId) {
      const { data: m } = await admin.from("master").select("id, nome").eq("id", corpo.masterId).maybeSingle();
      if (!m) return json({ errore: "Master non trovata" }, 404);
      const gia = referralDiOggi(coupon, m.id, oggi);
      if (gia) return json({ errore: `${m.nome} ha gia' il referral di questo mese: ${String(gia.codice).toUpperCase()}` }, 409);
      const { data: regole } = await admin.from("regole_referral_automatico").select("*").eq("serie", "corsi").maybeSingle();
      const valore = Number(corpo.valore);
      if (!(valore > 0)) return json({ errore: "Sconto mancante" }, 400);
      const codice = String(corpo.codice || "").trim().toLowerCase() || await generaCodiceUnivoco(m.nome);
      const riga = rigaCodiceNuovo({
        master_id: m.id,
        tipo_sconto: "percent",
        base_sconto: "lordo",
        valore,
        valore_woo: valore,
        tipo_regola_sconto: "fasce",
        fasce_sconto: corpo.fasce ?? null,
        utilizzi_max: regole?.utilizzi_max ?? null,
        utilizzi_max_per_utente: regole?.utilizzi_max_per_cliente ?? null,
        spesa_minima: regole?.spesa_minima ?? null,
        non_cumulabile: regole?.non_cumulabile ?? true,
      }, codice, ultimoGiornoDelMese(oggi), m.nome);
      riga.creato_da = "manuale";
      const esito = await creaCodice(riga, primoDelMeseDopo(oggi));
      return json(esito.errore ? { errore: esito.errore, codice: esito.codice } : { ok: true, codice: esito.codice, validoFinoA: riga.valido_fino_a }, esito.errore ? 502 : 200);
    }

    // ---- il giro del giorno ----
    const piano = pianoDelGiorno(coupon, oggi);
    const nomi: Record<string, string> = {};
    const ids = [...new Set(coupon.map((c: any) => c.master_id))];
    if (ids.length) {
      const { data } = await admin.from("master").select("id, nome").in("id", ids);
      (data || []).forEach((m: any) => { nomi[m.id] = m.nome; });
    }

    if (corpo?.prova === true) {
      return json({
        prova: true,
        oggi,
        validoFinoA: piano.validoFinoA,
        adottare: piano.adottare.map((c: any) => ({ master: nomi[c.master_id], codice: c.codice })),
        ruotare: piano.ruotare.map((r: any) => ({ master: nomi[r.masterId], vecchio: r.modello.codice })),
        ritirare: piano.ritirare.map((c: any) => ({ master: nomi[c.master_id], codice: c.codice })),
      });
    }

    const esito = { oggi, adottati: [] as string[], nati: [] as { master: string; codice: string }[], ritirati: [] as string[], errori: [] as string[] };

    // 1. i codici senza scadenza prendono la fine di questo mese
    for (const c of piano.adottare as any[]) {
      if (c.woo_coupon_id) {
        const errore = await scadenzaSulSito(c.woo_coupon_id, piano.scadenzaSito);
        // sul sito per primo: se resta indietro lui, il codice continua a
        // scontare; se restiamo indietro noi, e' solo un dato
        if (errore) { esito.errori.push(`${c.codice}: scadenza sul sito, ${errore}`); continue; }
      }
      const { error } = await admin.from("coupon").update({ valido_fino_a: piano.validoFinoA }).eq("id", c.id);
      if (error) esito.errori.push(`${c.codice}: ${error.message}`); else esito.adottati.push(c.codice);
    }

    // 2. il codice nuovo, a chi e' rimasta senza
    const senzaNuovo = new Set<string>();
    for (const r of piano.ruotare as any[]) {
      const nome = nomi[r.masterId] || "";
      const codice = await generaCodiceUnivoco(nome);
      const creato = await creaCodice(rigaCodiceNuovo(r.modello, codice, piano.validoFinoA, nome), piano.scadenzaSito);
      if (creato.errore) { esito.errori.push(`${nome}: ${creato.errore}`); senzaNuovo.add(r.masterId); }
      else esito.nati.push({ master: nome, codice });
    }

    // 3. i vecchi: via dal sito, scaduti nell'app (la riga resta: porta
    //    i punti dei mesi passati)
    for (const c of piano.ritirare as any[]) {
      if (senzaNuovo.has(c.master_id)) continue;
      if (c.woo_coupon_id) {
        const errore = await cancellaDalSito(c.woo_coupon_id);
        // non si segna scaduto un codice che sul sito sconta ancora: il
        // giro dopo ci riprova
        if (errore) { esito.errori.push(`${c.codice}: cancellazione dal sito, ${errore}`); continue; }
      }
      const { error } = await admin.from("coupon").update({ stato: "scaduto" }).eq("id", c.id);
      if (error) esito.errori.push(`${c.codice}: ${error.message}`); else esito.ritirati.push(c.codice);
    }

    return json({ ok: esito.errori.length === 0, ...esito });
  } catch (e) {
    return json({ errore: e instanceof Error ? e.message : String(e) }, 500);
  }
});
