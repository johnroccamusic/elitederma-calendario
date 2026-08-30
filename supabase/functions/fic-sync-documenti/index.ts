// Edge Function "fic-sync-documenti"
// Scarica da Fatture in Cloud le fatture di acquisto ricevute
// (received_documents, tipo "expense") e le allinea in
// fatture_ricevute_fic — upsert su fic_id, quindi rieseguirla non
// duplica nulla. Richiamabile dal tasto "Sincronizza da Fatture in
// Cloud" in Registro documenti fornitore.
//
// Rinnova da solo l'access_token quando è scaduto (o vicino a
// scadere), usando il refresh_token salvato da fic-oauth-callback —
// l'utente non deve mai rifare l'autorizzazione a mano. La stessa
// logica di rinnovo è duplicata (non importata da un file condiviso)
// in fic-documento-allegato: ogni Edge Function qui va deployata come
// bundle a sé, niente import relativi fra funzioni diverse.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   FIC_CLIENT_ID
//   FIC_CLIENT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PER_PAGE = 100;
const MASSIMO_PAGINE = 100; // tetto di sicurezza: 100 x 100 = 10.000 documenti

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function caricaConfigFic() {
  const { data, error } = await supabase
    .from("fatture_in_cloud_config")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    return { config: null, errore: "Nessun collegamento a Fatture in Cloud trovato — va completata prima l'autorizzazione OAuth." };
  }
  return { config: data[0], errore: null as string | null };
}

async function rinnovaTokenSeServe(config: any) {
  const scadeIl = config.token_scade_il ? new Date(config.token_scade_il).getTime() : 0;
  if (scadeIl - Date.now() > 5 * 60 * 1000) {
    return { accessToken: config.access_token as string, errore: null as string | null };
  }

  const clientId = Deno.env.get("FIC_CLIENT_ID");
  const clientSecret = Deno.env.get("FIC_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { accessToken: null, errore: "Configurazione Fatture in Cloud mancante (FIC_CLIENT_ID/FIC_CLIENT_SECRET)" };
  }

  const risposta = await fetch("https://api-v2.fattureincloud.it/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: config.refresh_token,
    }),
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    return { accessToken: null, errore: `Rinnovo token fallito: ${risposta.status} — ${testo}` };
  }
  const token = await risposta.json();
  const nuovaScadenza = new Date(Date.now() + (token.expires_in || 86400) * 1000).toISOString();

  await supabase.from("fatture_in_cloud_config").update({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_scade_il: nuovaScadenza,
  }).eq("id", config.id);

  return { accessToken: token.access_token as string, errore: null as string | null };
}

// da ReceivedDocument (vedi models/schemas/ReceivedDocument.yaml) alla
// riga di fatture_ricevute_fic
function mappaDocumento(d: any) {
  return {
    fic_id: d.id,
    tipo: d.type || null,
    fornitore_nome: d.entity?.name || null,
    numero_documento: d.invoice_number || null,
    data_documento: d.date || null,
    descrizione: d.description || null,
    categoria: d.category || null,
    imponibile: d.amount_net ?? null,
    iva: d.amount_vat ?? null,
    totale: d.amount_gross ?? null,
    fattura_elettronica: d.e_invoice ?? null,
    payload_raw: d,
  };
}

// trova (per P.IVA, poi CF, poi nome) o crea il fornitore su cui
// agganciare il documento — documento_fornitore.fornitore_id è
// obbligatorio, a differenza di fatture_ricevute_fic.fornitore_nome
// che è solo testo. Cache in memoria per non ripetere le stesse query
// per ogni fattura dello stesso fornitore nella stessa sincronizzazione
// (es. le bollette mensili Wind Tre sono 12 documenti, un fornitore)
const cacheFornitori = new Map<string, string>();
async function trovaOCreaFornitore(entity: any) {
  if (!entity) return null;
  const piva = (entity.vat_number || "").trim();
  const cf = (entity.tax_code || "").trim();
  const nome = (entity.name || `${entity.first_name || ""} ${entity.last_name || ""}`).trim();
  const chiaveCache = piva || cf || nome.toLowerCase();
  if (!chiaveCache) return null;
  if (cacheFornitori.has(chiaveCache)) return cacheFornitori.get(chiaveCache)!;

  if (piva) {
    const { data } = await supabase.from("fornitori").select("id").eq("partita_iva", piva).limit(1);
    if (data?.[0]) { cacheFornitori.set(chiaveCache, data[0].id); return data[0].id; }
  }
  if (cf) {
    const { data } = await supabase.from("fornitori").select("id").eq("codice_fiscale", cf).limit(1);
    if (data?.[0]) { cacheFornitori.set(chiaveCache, data[0].id); return data[0].id; }
  }
  if (nome) {
    const { data } = await supabase.from("fornitori").select("id").ilike("nome", nome).limit(1);
    if (data?.[0]) { cacheFornitori.set(chiaveCache, data[0].id); return data[0].id; }
  }

  const { data, error } = await supabase.from("fornitori").insert({
    nome: nome || "Fornitore sconosciuto",
    partita_iva: piva || null,
    codice_fiscale: cf || null,
    indirizzo: entity.address_street || null,
    citta: entity.address_city || null,
    cap: entity.address_postal_code || null,
  }).select("id").single();
  if (error || !data) return null;
  cacheFornitori.set(chiaveCache, data.id);
  return data.id;
}

// da ReceivedDocument alla riga di documento_fornitore (spec
// §4.1) — righe e data_scadenza_prevista sono i campi che userà il
// motore di match (§6.1 "Origine") e la generazione delle scadenze
// (§8 punto 5); "rate" solo se il documento ha più di un pagamento
// La scadenza vera, distinta da quella che Fatture in Cloud si inventa.
//
// FIC non lascia mai una spesa senza scadenza. Se l'XML del fornitore non
// porta termini di pagamento — e la maggior parte non li porta — al momento
// dell'importazione crea una rata unica con termini "0 giorni" e ci scrive
// come data di scadenza IL GIORNO IN CUI HA IMPORTATO IL DOCUMENTO. Su 56
// fatture da luglio 2026, 36 avevano esattamente quella data: una fattura
// del 7 luglio "scadeva" il 24 agosto solo perché il 24 agosto FIC ne ha
// ingoiato l'XML.
//
// Riportarla qui significava generare scadenze passive già scadute il
// giorno stesso. Quando la riconosciamo la lasciamo vuota: la data la mette
// l'operatore quando riconcilia, che è l'unico che sa cosa è stato
// concordato col fornitore.
function scadenzaPrevistaVera(d: any): string | null {
  const scadenza = d.next_due_date || null;
  if (!scadenza) return null;
  const giornoImport = typeof d.created_at === "string" ? d.created_at.slice(0, 10) : null;
  if (!giornoImport || scadenza !== giornoImport) return scadenza;
  // coincide con il giorno di importazione: è una scadenza vera solo se
  // qualcuno ha messo dei termini di pagamento veri (più di una rata, o
  // una rata con giorni diversi da zero)
  const pagamenti = Array.isArray(d.payments_list) ? d.payments_list : [];
  if (pagamenti.length > 1) return scadenza;
  const giorni = Number(pagamenti[0]?.payment_terms?.days ?? 0);
  return giorni > 0 ? scadenza : null;
}

function mappaDocumentoFornitore(d: any, fornitoreId: string) {
  const righe = Array.isArray(d.items_list)
    ? d.items_list.map((r: any) => ({ descrizione: r.name || "", importo: r.net_price ?? null }))
    : null;
  const pagamenti = Array.isArray(d.payments_list) ? d.payments_list : [];
  return {
    fornitore_id: fornitoreId,
    fic_id: d.id,
    tipo: "fattura", // la sincronizzazione legge solo type=expense: nota di credito/autofattura non arrivano da qui
    numero: d.invoice_number || null,
    data_documento: d.date || null,
    imponibile: d.amount_net ?? null,
    iva: d.amount_vat ?? null,
    totale: d.amount_gross ?? null,
    data_scadenza_prevista: scadenzaPrevistaVera(d),
    rate: pagamenti.length > 1 ? pagamenti : null,
    righe,
    // stato NON incluso di proposito: sulla insert prende il default di
    // schema ('importato'), sull'update (stesso fic_id) resta quello
    // che ha già in tabella — non deve tornare indietro un documento
    // già riconciliato/scartato solo perché arriva di nuovo dalla sync
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const { config, errore: erroreConfig } = await caricaConfigFic();
  if (erroreConfig || !config) {
    return new Response(JSON.stringify({ errore: erroreConfig }), { status: 400, headers: jsonHeaders });
  }
  if (!config.company_id) {
    return new Response(JSON.stringify({ errore: "Azienda Fatture in Cloud non impostata su fatture_in_cloud_config.company_id." }), { status: 400, headers: jsonHeaders });
  }

  const { accessToken, errore: erroreToken } = await rinnovaTokenSeServe(config);
  if (erroreToken || !accessToken) {
    return new Response(JSON.stringify({ errore: erroreToken || "Token non disponibile" }), { status: 502, headers: jsonHeaders });
  }

  let pagina = 1;
  let importati = 0;
  let completato = false;

  while (pagina <= MASSIMO_PAGINE) {
    const url = `https://api-v2.fattureincloud.it/c/${config.company_id}/received_documents?type=expense&page=${pagina}&per_page=${PER_PAGE}&fieldset=detailed`;
    const risposta = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!risposta.ok) {
      const testo = await risposta.text();
      return new Response(
        JSON.stringify({ errore: `Fatture in Cloud ha risposto ${risposta.status} alla pagina ${pagina}`, dettaglio: testo, importati, pagina }),
        { status: 502, headers: jsonHeaders }
      );
    }
    const corpo = await risposta.json();
    const documenti = Array.isArray(corpo.data) ? corpo.data : [];
    if (documenti.length === 0) { completato = true; break; }

    const righe = documenti.map(mappaDocumento);
    const { error } = await supabase.from("fatture_ricevute_fic").upsert(righe, { onConflict: "fic_id" });
    if (error) {
      return new Response(JSON.stringify({ errore: "Errore salvataggio su Supabase: " + error.message, importati, pagina }), { status: 500, headers: jsonHeaders });
    }
    importati += righe.length;

    // stesso lotto anche in documento_fornitore (spec riconciliazione
    // §4.1): un giro di trova-o-crea fornitore per documento, poi
    // upsert — se un fornitore non si risolve (entity mancante) il
    // documento resta fuori da questo giro, ripescato al prossimo sync
    const righeDocumentoFornitore = [];
    for (const d of documenti) {
      const fornitoreId = await trovaOCreaFornitore(d.entity);
      if (!fornitoreId) continue;
      righeDocumentoFornitore.push(mappaDocumentoFornitore(d, fornitoreId));
    }
    if (righeDocumentoFornitore.length > 0) {
      const { error: erroreDf } = await supabase.from("documento_fornitore").upsert(righeDocumentoFornitore, { onConflict: "fic_id" });
      if (erroreDf) {
        return new Response(JSON.stringify({ errore: "Errore salvataggio documento_fornitore: " + erroreDf.message, importati, pagina }), { status: 500, headers: jsonHeaders });
      }
    }

    if (!corpo.last_page || pagina >= corpo.last_page) { completato = true; break; }
    pagina += 1;
  }

  // promuove a "da_riconciliare" i documenti appena inseriti (stato di
  // default "importato", vedi mappaDocumentoFornitore) — nessun passo
  // intermedio reale oggi fra i due stati, l'auto-abbinamento contratti
  // ricorrenti (§6.4) arriverà come parte del motore di match
  await supabase.from("documento_fornitore").update({ stato: "da_riconciliare" }).eq("stato", "importato");

  await supabase.from("fatture_in_cloud_config").update({ ultima_sincronizzazione: new Date().toISOString() }).eq("id", config.id);

  return new Response(JSON.stringify({ importati, pagineProcessate: pagina, completato }), { status: 200, headers: jsonHeaders });
});
