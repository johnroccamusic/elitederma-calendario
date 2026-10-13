// Edge Function "lunchflow-sync"
// Scarica conti, saldi e movimenti dall'aggregatore open banking Lunch
// Flow e li scrive dove l'app li cerca gia'.
//
// DOVE SCRIVE, e perche' li'. I movimenti finiscono in `movimenti_banca`,
// la stessa tabella dell'estratto conto importato a mano: sopra quei dati
// ci sono gia' la riconciliazione con le spese, le regole automatiche, il
// pannello doppioni e il tasto "Contabilizza". Una tabella parallela
// avrebbe voluto dire movimenti che non si riconciliano e doppioni fra i
// due elenchi che nessuno vede.
//
// NIENTE DOPPIONI. L'anti-duplicato e' la colonna `impronta`, unica, che
// c'era gia'. Per questi movimenti vale 'lf:' + l'id di Lunch Flow, che
// e' stabile fra una chiamata e l'altra: riscaricare lo stesso giorno
// dieci volte lascia dieci volte le stesse righe.
//
// DA QUANDO SCARICA. Dall'ultimo movimento gia' salvato MENO CINQUE
// GIORNI, e novanta giorni al primo giro. I cinque giorni di
// sovrapposizione non sono prudenza generica: una banca puo' consolidare
// un'operazione due o tre giorni dopo averla mostrata, e cambiarle la
// data. Senza quella finestra quei movimenti non sarebbero mai ripassati.
//
// I PENDING RESTANO FUORI (include_pending=false): un'operazione non
// ancora contabilizzata cambia ancora importo e data, e in prima nota
// vale meno di niente.
//
// Variabile d'ambiente: LUNCHFLOW_API_KEY (il pannello Supabase, Edge
// Functions -> Secrets). Non sta e non deve stare nel frontend: con
// quella chiave si leggono i conti dell'azienda.
//
// Chiamata dall'app:   supabase.functions.invoke('lunchflow-sync')
// Chiamata dal cron:   vedi public.sincronizza_banca_giornaliera()
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BASE_URL = "https://www.lunchflow.app/api/v1";
// quanto si risale al primo giro, e di quanto ci si sovrappone dopo
const GIORNI_PRIMO_GIRO = 90;
const GIORNI_SOVRAPPOSIZIONE = 5;

const giorno = (d: Date) => d.toISOString().slice(0, 10);
const meno = (dataIso: string, giorni: number) => {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - giorni);
  return giorno(d);
};

// Gli errori dell'aggregatore detti in italiano: "401" su una pagina non
// dice a nessuno cosa fare, e questa funzione la lancia chi amministra,
// non chi programma.
function spiegaErrore(stato: number, testo: string): string {
  if (stato === 401 || stato === 403) {
    return "Lunch Flow non riconosce la chiave (401). Va rigenerata dal loro pannello e riscritta nel secret LUNCHFLOW_API_KEY di Supabase.";
  }
  if (stato === 429) return "Lunch Flow ha risposto 'troppe richieste' (429): riprova fra qualche minuto.";
  if (stato === 503 || stato === 502 || stato === 504) {
    return `Lunch Flow non e' raggiungibile in questo momento (${stato}). I movimenti restano quelli dell'ultimo giro riuscito: riprova piu' tardi.`;
  }
  return `Lunch Flow ha risposto ${stato}${testo ? `: ${testo.slice(0, 200)}` : ""}`;
}

async function chiedi(percorso: string, chiave: string) {
  const risposta = await fetch(`${BASE_URL}${percorso}`, {
    headers: { "x-api-key": chiave, Accept: "application/json" },
  });
  if (!risposta.ok) {
    const testo = await risposta.text().catch(() => "");
    const errore = new Error(spiegaErrore(risposta.status, testo));
    (errore as Error & { stato?: number }).stato = risposta.status;
    throw errore;
  }
  return await risposta.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const chiave = Deno.env.get("LUNCHFLOW_API_KEY");
  if (!chiave) {
    return json({ errore: "Manca il secret LUNCHFLOW_API_KEY: va scritto nel pannello Supabase, Edge Functions -> Secrets." }, 500);
  }

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { /* chiamata senza corpo: va bene */ }
  // "dal primo giorno": rifa' tutto il periodo, per rimettere in pari
  const daCapo = corpo?.daCapo === true;

  const esito: {
    conti: number; nuovi: number; aggiornati: number;
    saldi: { conto: string; saldo: number | null }[];
    avvisi: string[];
  } = { conti: 0, nuovi: 0, aggiornati: 0, saldi: [], avvisi: [] };

  try {
    const elenco = await chiedi("/accounts", chiave);
    const conti: Record<string, unknown>[] = Array.isArray(elenco) ? elenco : (elenco?.accounts || []);
    esito.conti = conti.length;
    if (conti.length === 0) esito.avvisi.push("Lunch Flow non ha restituito nessun conto collegato.");

    for (const conto of conti) {
      const contoId = String(conto.id ?? conto.accountId ?? "");
      if (!contoId) continue;
      const nomeConto = String(conto.name ?? conto.displayName ?? conto.iban ?? contoId);

      // IL SALDO. Se non arriva, non si ferma tutto: i movimenti valgono
      // anche senza, e un saldo vecchio e' meglio di una pagina vuota.
      let saldo: number | null = null;
      let valuta = "EUR";
      try {
        const b = await chiedi(`/accounts/${contoId}/balance`, chiave);
        const grezzo = b?.balance ?? b?.amount ?? b?.available ?? null;
        saldo = grezzo == null ? null : Number(grezzo);
        valuta = String(b?.currency ?? conto.currency ?? "EUR");
      } catch (e) {
        esito.avvisi.push(`Saldo di "${nomeConto}" non letto: ${(e as Error).message}`);
      }

      // DA QUANDO. L'ultimo movimento gia' sceso da QUESTO conto, meno la
      // finestra di sovrapposizione.
      const { data: ultimo } = await supabase
        .from("movimenti_banca")
        .select("data_operazione")
        .eq("origine", "lunchflow")
        .eq("conto", nomeConto)
        .order("data_operazione", { ascending: false })
        .limit(1)
        .maybeSingle();
      const oggi = giorno(new Date());
      const da = daCapo || !ultimo?.data_operazione
        ? meno(oggi, GIORNI_PRIMO_GIRO)
        : meno(String(ultimo.data_operazione), GIORNI_SOVRAPPOSIZIONE);

      const risposta = await chiedi(
        `/accounts/${contoId}/transactions?from=${da}&to=${oggi}&include_pending=false`,
        chiave,
      );
      const movimenti: Record<string, unknown>[] = risposta?.transactions || [];

      const righe = movimenti
        .filter((m) => m?.id && m?.date)
        .map((m) => {
          const descrizione = String(m.description ?? m.merchant ?? "").trim() || "(senza descrizione)";
          return {
            conto: nomeConto,
            data_operazione: String(m.date).slice(0, 10),
            data_valuta: String(m.date).slice(0, 10),
            importo: Number(m.amount) || 0,
            descrizione,
            causale: m.merchant ? String(m.merchant) : null,
            // il progressivo serve all'import da file per tenere l'ordine
            // dentro la stessa giornata: qui l'ordine lo da' l'id
            progressivo: 0,
            impronta: `lf:${m.id}`,
            lunchflow_id: String(m.id),
            origine: "lunchflow",
            stato: "nuovo",
            file_origine: "Lunch Flow",
            raw: m,
          };
        });

      if (righe.length > 0) {
        // Upsert sull'impronta: quello che c'e' gia' resta com'e' — stato,
        // riconciliazione e nota sono decisioni di una persona, e un
        // secondo giro di sincronizzazione non le deve cancellare.
        const { data: gia } = await supabase
          .from("movimenti_banca")
          .select("impronta")
          .in("impronta", righe.map((r) => r.impronta));
        const conosciute = new Set((gia || []).map((r: { impronta: string }) => r.impronta));
        const daInserire = righe.filter((r) => !conosciute.has(r.impronta));

        if (daInserire.length > 0) {
          // la colonna raw non esiste su movimenti_banca: si tiene fuori
          const pulite = daInserire.map(({ raw: _raw, ...resto }) => resto);
          const { error } = await supabase.from("movimenti_banca").insert(pulite);
          if (error) throw new Error(`Scrittura dei movimenti non riuscita: ${error.message}`);
          esito.nuovi += pulite.length;
        }
        esito.aggiornati += righe.length - daInserire.length;
      }

      await supabase.from("lunchflow_conti").upsert({
        id: contoId,
        nome: nomeConto,
        iban: conto.iban ? String(conto.iban) : null,
        valuta,
        saldo,
        saldo_il: saldo == null ? null : new Date().toISOString(),
        ultimo_sync: new Date().toISOString(),
        ultimo_esito: "ok",
      }, { onConflict: "id" });

      esito.saldi.push({ conto: nomeConto, saldo });
    }

    return json({ ok: true, ...esito });
  } catch (e) {
    const messaggio = (e as Error).message || String(e);
    const stato = (e as Error & { stato?: number }).stato;
    // si scrive anche il giro fallito: senza, dalla pagina non si
    // distingue "non ho mai provato" da "ho provato e non ci riesco"
    await supabase.from("lunchflow_conti")
      .update({ ultimo_sync: new Date().toISOString(), ultimo_esito: messaggio.slice(0, 300) })
      .neq("id", "");
    return json({ errore: messaggio, ...esito }, stato === 401 || stato === 403 ? 401 : 502);
  }
});
