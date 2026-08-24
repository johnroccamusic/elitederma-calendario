// ============================================================================
// fic-sync — sincronizza Fatture in Cloud dentro Supabase
//
// Scarica TUTTO quello che il connettore standard si perde (solo ricevuti,
// le fatture emesse non si sincronizzano per scelta):
//   • acquisti e SPESE        -> /c/{id}/received_documents?type=expense|passive_credit_note|...
//   • "Da registrare"         -> /c/{id}/received_documents/pending
//
// Invocazione:  POST /functions/v1/fic-sync   body: {"modo":"incrementale"|"completo"}
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const FIC = "https://api-v2.fattureincloud.it";

const CLIENT_ID     = Deno.env.get("FIC_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("FIC_CLIENT_SECRET")!;
// Da quale data partire alla prima sincronizzazione completa
const DATA_INIZIO   = Deno.env.get("FIC_DATA_INIZIO") ?? "2024-01-01";
// Quanti giorni indietro ricontrollare a ogni giro (per intercettare le modifiche)
const GIORNI_INDIETRO = Number(Deno.env.get("FIC_GIORNI_INDIETRO") ?? "90");

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Connessione = {
  company_id: number;
  nome: string | null;
  access_token: string;
  refresh_token: string;
  scade_il: string;
};

// ---------------------------------------------------------------------------
// OAuth: rinnova il token se sta per scadere
// ---------------------------------------------------------------------------
async function tokenValido(conn: Connessione): Promise<string> {
  const mancano = new Date(conn.scade_il).getTime() - Date.now();
  if (mancano > 5 * 60 * 1000) return conn.access_token;

  const risposta = await fetch(`${FIC}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token,
    }),
  });

  if (!risposta.ok) {
    throw new Error(
      `Rinnovo token fallito per l'azienda ${conn.company_id} (${risposta.status}): ${await risposta.text()}`,
    );
  }

  const dati = await risposta.json();
  const scade = new Date(Date.now() + (dati.expires_in ?? 86400) * 1000).toISOString();

  await sb.from("fic_connessioni").update({
    access_token: dati.access_token,
    refresh_token: dati.refresh_token ?? conn.refresh_token,
    scade_il: scade,
    aggiornata_il: new Date().toISOString(),
  }).eq("company_id", conn.company_id);

  return dati.access_token as string;
}

// ---------------------------------------------------------------------------
// Chiamata GET con ritentativi su 429 (rate limit) e 5xx
// ---------------------------------------------------------------------------
async function ficGet(
  percorso: string,
  parametri: Record<string, string | number | undefined>,
  token: string,
): Promise<any> {
  const url = new URL(FIC + percorso);
  for (const [k, v] of Object.entries(parametri)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let ultimoErrore = "";
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (r.status === 429 || r.status >= 500) {
      ultimoErrore = `${r.status} ${await r.text()}`;
      await sleep(1000 * Math.pow(2, tentativo)); // 1s, 2s, 4s, 8s, 16s
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} su ${url.pathname}: ${await r.text()}`);
    return await r.json();
  }
  throw new Error(`Troppi tentativi su ${url.pathname}: ${ultimoErrore}`);
}

// Scorre tutte le pagine di una lista
async function* tutteLePagine(
  percorso: string,
  parametri: Record<string, string | number | undefined>,
  token: string,
): AsyncGenerator<any> {
  let pagina = 1;
  while (true) {
    const risposta = await ficGet(percorso, { ...parametri, page: pagina, per_page: 100 }, token);
    for (const elemento of risposta.data ?? []) yield elemento;

    const ultima = risposta.last_page ?? 1;
    if (pagina >= ultima) break;
    pagina++;
    await sleep(350); // gentile con il rate limit
  }
}

// ---------------------------------------------------------------------------
// Mappatura: dal JSON di Fatture in Cloud alle nostre colonne
// ---------------------------------------------------------------------------
const numero = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function mappaDocumento(d: any, companyId: number, direzione: "emesso" | "ricevuto") {
  return {
    company_id: companyId,
    fic_id: d.id,
    direzione,
    tipo: d.type ?? "invoice",
    numero: [d.number, d.numeration].filter(Boolean).join("/") || null,
    data: d.date ?? null,
    controparte: d.entity?.name ?? null,
    piva: d.entity?.vat_number ?? null,
    cf: d.entity?.tax_code ?? null,
    imponibile: numero(d.amount_net),
    iva: numero(d.amount_vat),
    totale: numero(d.amount_gross ?? d.amount_total),
    categoria: d.category ?? null,
    allegato: d.attachment_file_name ?? d.attachment_token ?? null,
    raw: d,
    aggiornato_il: new Date().toISOString(),
  };
}

function mappaPending(d: any, companyId: number) {
  return {
    company_id: companyId,
    fic_id: d.id,
    fornitore: d.supplier_name ?? d.entity?.name ?? null,
    piva: d.supplier_vat_number ?? d.entity?.vat_number ?? null,
    data: d.date ?? null,
    totale: numero(d.amount_gross ?? d.amount_total),
    file_nome: d.file_name ?? d.attachment_file_name ?? null,
    raw: d,
    visto_il: new Date().toISOString(),
    sparito_il: null as string | null,
  };
}

// Scrive a blocchi di 200 per non sforare i limiti della richiesta
async function salva(tabella: string, righe: any[], chiave: string) {
  for (let i = 0; i < righe.length; i += 200) {
    const blocco = righe.slice(i, i + 200);
    const { error } = await sb.from(tabella).upsert(blocco, { onConflict: chiave });
    if (error) throw new Error(`Scrittura su ${tabella} fallita: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Sincronizzazione di una azienda
// ---------------------------------------------------------------------------
// I tipi di documento RICEVUTO validi per l'API (verificato sul vivo, non
// coincide con quanto indicato nelle istruzioni originali): "expense" e' la
// voce "Spese" dell'interfaccia, quella che il connettore standard non
// scarica. Non esiste un tipo "invoice"/"credit_note"/"delivery_note" per i
// documenti ricevuti: FIC li chiama "self_invoice", "passive_credit_note",
// "passive_delivery_note".
const TIPI_RICEVUTI = ["expense", "passive_credit_note", "passive_delivery_note", "self_invoice"];

async function sincronizza(conn: Connessione, modo: string) {
  const token = await tokenValido(conn);
  const cid = conn.company_id;

  const da = modo === "completo"
    ? DATA_INIZIO
    : new Date(Date.now() - GIORNI_INDIETRO * 86400_000).toISOString().slice(0, 10);
  const filtro = `date >= '${da}'`;

  // Solo documenti RICEVUTI: le fatture emesse non si sincronizzano, per
  // scelta (non solo per lo scope OAuth mancante su issued_documents).
  let ricevuti = 0, pending = 0;
  const avvisi: string[] = [];

  // Acquisti e SPESE — un giro per ogni tipo, tutte le aree ricevute.
  // Un tipo che fallisce (es. scope OAuth mancante) non deve bloccare gli
  // altri: lo saltiamo e lo segnaliamo, il resto prosegue.
  for (const tipo of TIPI_RICEVUTI) {
    try {
      const righe: any[] = [];
      for await (const d of tutteLePagine(`/c/${cid}/received_documents`, { type: tipo, q: filtro }, token)) {
        righe.push(mappaDocumento(d, cid, "ricevuto"));
      }
      if (righe.length) await salva("fic_documenti", righe, "company_id,direzione,fic_id");
      ricevuti += righe.length;
    } catch (e) {
      avvisi.push(`${tipo}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(350);
  }

  // "Da registrare" — sempre lista intera, sono pochi.
  //    Le API NON permettono di registrarli: qui li fotografiamo soltanto.
  {
    const righe: any[] = [];
    for await (const d of tutteLePagine(`/c/${cid}/received_documents/pending`, {}, token)) {
      righe.push(mappaPending(d, cid));
    }
    if (righe.length) await salva("fic_documenti_pending", righe, "company_id,fic_id");
    pending = righe.length;

    // Quelli non piu' in lista sono stati registrati su FIC: li marchiamo come chiusi
    const idAttivi = righe.map((r) => r.fic_id);
    const query = sb.from("fic_documenti_pending")
      .update({ sparito_il: new Date().toISOString() })
      .eq("company_id", cid)
      .is("sparito_il", null);
    const { error } = idAttivi.length
      ? await query.not("fic_id", "in", `(${idAttivi.join(",")})`)
      : await query;
    if (error) throw new Error(`Chiusura pending fallita: ${error.message}`);
  }

  return { ricevuti, pending, avviso: avvisi.length ? avvisi.join(" | ") : null };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  let modo = "incrementale";
  try {
    const corpo = await req.json();
    if (corpo?.modo) modo = String(corpo.modo);
  } catch { /* body vuoto: va bene, resta incrementale */ }

  const { data: connessioni, error } = await sb
    .from("fic_connessioni").select("*").eq("attiva", true);

  if (error) {
    return Response.json({ errore: error.message }, { status: 500 });
  }
  if (!connessioni?.length) {
    return Response.json({ errore: "Nessuna azienda collegata a Fatture in Cloud" }, { status: 400 });
  }

  const esiti: any[] = [];

  for (const conn of connessioni as Connessione[]) {
    const { data: log } = await sb.from("fic_sync_log")
      .insert({ company_id: conn.company_id, modo }).select("id").single();

    try {
      const { avviso, ...conteggi } = await sincronizza(conn, modo);
      const esito = avviso ? "parziale" : "ok";
      await sb.from("fic_sync_log").update({
        finita_il: new Date().toISOString(), esito, messaggio: avviso, ...conteggi,
      }).eq("id", log!.id);
      esiti.push({ azienda: conn.nome ?? conn.company_id, esito, avviso, ...conteggi });
    } catch (e) {
      const messaggio = e instanceof Error ? e.message : String(e);
      await sb.from("fic_sync_log").update({
        finita_il: new Date().toISOString(), esito: "errore", messaggio,
      }).eq("id", log!.id);
      esiti.push({ azienda: conn.nome ?? conn.company_id, esito: "errore", messaggio });
    }
  }

  const tuttoBene = esiti.every((e) => e.esito === "ok");
  return Response.json({ modo, esiti }, { status: tuttoBene ? 200 : 207 });
});
