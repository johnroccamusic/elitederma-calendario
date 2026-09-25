// Edge Function "pos-emetti-fattura"
// Il passo che chiude il giro: dall'app qualcuno ha guardato i dati che
// la cliente ha scritto, li ha confermati, e la fattura parte.
//
// Perche' non parte da sola nel webhook: una fattura emessa non si
// annulla, si fa una nota di credito. Un codice destinatario sbagliato
// battuto su un telefono diventa un documento da correggere con un
// altro documento. Qui invece c'e' un paio d'occhi in mezzo.
//
// E' idempotente: una richiesta gia' fatturata non ne emette una
// seconda, risponde con quella che c'e' gia'.
//
// Variabili d'ambiente: FIC_CLIENT_ID, FIC_CLIENT_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { leggiConnessione, tokenValido, idAliquota, emettiFattura } from "../_shared/fic.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALIQUOTA = 22;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  let corpo: any;
  try { corpo = await req.json(); } catch { return risposta({ errore: "Corpo non valido." }, 400); }
  const codice = String(corpo?.codice || "").toUpperCase();
  if (!codice) return risposta({ errore: "Manca il codice del pagamento." }, 400);

  const { data: pag } = await sb.from("pagamenti_pos").select("*").eq("codice", codice).maybeSingle();
  if (!pag) return risposta({ errore: "Pagamento non trovato." }, 404);
  if (pag.stato === "fatturato") {
    return risposta({ gia: true, fatturaId: pag.fattura_fic_id, numero: pag.fattura_numero });
  }
  if (pag.stato !== "da_verificare") {
    return risposta({ errore: `Questo pagamento e' in stato "${pag.stato}": si fattura solo quello che e' stato incassato.` }, 409);
  }

  // i dati corretti a mano dall'app vincono su quelli arrivati da
  // Stripe: e' tutto il senso della verifica
  const cliente = { ...(pag.cliente || {}), ...(corpo?.cliente || {}) };
  if (!cliente.codice_fiscale && !cliente.piva) {
    return risposta({ errore: "Senza codice fiscale ne' partita IVA la fattura elettronica non parte." }, 400);
  }

  const righe = (Array.isArray(pag.righe) ? pag.righe : []).map((r: any) => {
    const lordo = (Number(r.prezzo) || 0) * (Number(r.quantita) || 1);
    const quantita = Math.max(1, Number(r.quantita) || 1);
    return {
      nome: String(r.nome || "Articolo"),
      quantita,
      // i prezzi del POS sono IVA inclusa: la fattura vuole il netto
      prezzoNetto: Math.round((lordo / quantita) / (1 + ALIQUOTA / 100) * 100) / 100,
    };
  });
  if (righe.length === 0) return risposta({ errore: "Il pagamento non ha righe da fatturare." }, 400);

  try {
    const conn = await leggiConnessione(sb);
    const token = await tokenValido(sb, conn);
    const aliquotaId = await idAliquota(token, conn.company_id, ALIQUOTA);
    const dataIso = new Date(pag.pagato_il || Date.now()).toISOString().slice(0, 10);
    const fattura = await emettiFattura(token, conn.company_id, {
      cliente, righe, aliquotaId, dataIso,
      importoPagato: Number(pag.importo) || 0,
      metodo: "Carta di credito (Stripe)",
    });

    await sb.from("pagamenti_pos").update({
      stato: "fatturato",
      cliente,
      fattura_fic_id: fattura.id,
      fattura_numero: fattura.numero,
      fattura_emessa_il: new Date().toISOString(),
      fattura_errore: null,
      verificato_il: new Date().toISOString(),
      verificato_da: corpo?.verificatoDa || null,
      aggiornato_il: new Date().toISOString(),
    }).eq("id", pag.id);

    if (pag.cliente_fattura_id) {
      await sb.from("clienti_fattura").update({ ...cliente, aggiornato_il: new Date().toISOString() }).eq("id", pag.cliente_fattura_id);
    }

    return risposta({ fatturaId: fattura.id, numero: fattura.numero });
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    // l'errore resta scritto sulla richiesta: chi riprova domani deve
    // sapere cos'era andato storto, non ricominciare al buio
    await sb.from("pagamenti_pos").update({ fattura_errore: messaggio, aggiornato_il: new Date().toISOString() }).eq("id", pag.id);
    return risposta({ errore: messaggio }, 502);
  }
});
