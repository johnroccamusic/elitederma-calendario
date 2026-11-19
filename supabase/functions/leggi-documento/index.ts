// Edge Function "leggi-documento" (25/10/2026)
//
// L'allieva allega la foto del documento dal modulo di iscrizione; qui la
// si fa leggere a un modello (Anthropic) che restituisce i SOLI dati
// anagrafici in JSON. Niente decisioni: il risultato torna alla pagina,
// che lo confronta con quello che ha scritto lei, e si salva in
// `iscritti.documento_letto` perche' il venditore veda le differenze.
//
// Pubblicata con --no-verify-jwt: chi la chiama e' l'allieva, senza
// sessione. La porta e' il gettone del modulo (`token_modulo`): vale solo
// per un'iscrizione il cui modulo non e' ancora tornato. L'immagine non si
// conserva qui — quella arriva nel secchio al momento dell'invio.
//
// Secret: ANTHROPIC_API_KEY. Modello: claude-haiku-5-5 (vede le immagini,
// costa poco, basta per un documento stampato).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODELLO = "claude-haiku-5-5";
const MAX_BYTES = 4 * 1024 * 1024;
// Il gettone e' l'unica porta e ogni lettura costa token a nostro carico:
// chi ha il link non puo' farla girare all'infinito. Un'allieva che rifa'
// la foto un paio di volte sta molto sotto; chi ripete per centinaia di
// volte no. Il conto sta in documento_letto.limite, accanto a fronte/retro
// (chi legge quel campo guarda solo le due chiavi dei lati).
const MAX_ALL_ORA = 8;
const MAX_TOTALE = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ISTRUZIONI = `Sei un lettore di documenti d'identita' italiani ed europei (carta d'identita' cartacea o elettronica, patente, passaporto, permesso di soggiorno, tessera sanitaria).
Dalla fotografia estrai SOLO i dati anagrafici stampati e rispondi con un unico oggetto JSON, senza testo prima o dopo, con esattamente queste chiavi:
{"leggibile": true/false, "tipo_documento": "carta_identita"|"patente"|"passaporto"|"permesso_soggiorno"|"tessera_sanitaria"|"altro"|null, "nome": string|null, "cognome": string|null, "sesso": "M"|"F"|null, "data_nascita": "YYYY-MM-DD"|null, "comune_nascita": string|null, "provincia_nascita": string|null, "stato_nascita": string|null, "codice_fiscale": string|null, "doc_numero": string|null, "scadenza": "YYYY-MM-DD"|null, "note": string|null, "riquadro": {"x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1}|null, "rotazione": 0|90|180|270, "qualita": "buona"|"scarsa"|"illeggibile", "problemi": [string]}
Regole: copia i valori come sono stampati (maiuscole comprese), senza inventare; se un dato non si legge o non c'e', metti null; "leggibile" e' false se l'immagine non e' un documento o e' illeggibile; in "note" al massimo una frase su cio' che non torna (es. foto sfocata, documento scaduto).
"riquadro" e' la posizione del documento nella foto, in frazioni della larghezza e dell'altezza dell'immagine (x,y = angolo in alto a sinistra; w,h = larghezza e altezza), con un piccolo margine intorno; null se il documento riempie gia' tutta la foto o non si distingue. "rotazione" sono i gradi in senso orario di cui va girata la foto perche' il documento risulti dritto e leggibile (0 se e' gia' dritto).
"qualita" giudica la foto: "buona" se tutti i dati si leggono bene; "scarsa" se si leggono ma con fatica (poca luce, leggera sfocatura, riflessi, ombre, inclinata); "illeggibile" se uno o piu' dati anagrafici non si leggono con certezza, il documento e' tagliato o non e' un documento. In "problemi" elenca in italiano, brevi, i difetti trovati (es. "poca luce", "sfocata", "riflesso sulla foto", "documento tagliato a destra", "dito davanti"); lista vuota se la foto e' a posto. Non indovinare mai un dato che non leggi: meglio null e "illeggibile".`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const token = String(corpo.token || "").trim();
  const lato = corpo.lato === "retro" ? "retro" : "fronte";
  const immagine = String(corpo.immagine || "");
  if (token.length < 12) return json({ ok: false, errore: "Link non valido." }, 400);
  const m = immagine.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return json({ ok: false, errore: "Serve una foto JPG o PNG." }, 400);
  const mediaType = m[1];
  const base64 = m[2];
  if (base64.length * 0.75 > MAX_BYTES) return json({ ok: false, errore: "Foto troppo grande." }, 413);

  // la porta: il gettone del modulo, su un'iscrizione ancora aperta
  const { data: isc, error: errIsc } = await admin.from("iscritti")
    .select("id, modulo_ricevuto_il, stato, documento_letto").eq("token_modulo", token).maybeSingle();
  if (errIsc) return json({ ok: false, errore: errIsc.message }, 500);
  if (!isc) return json({ ok: false, errore: "Link non valido." }, 404);
  if (isc.modulo_ricevuto_il || isc.stato === "confermato") return json({ ok: false, errore: "Il modulo è già stato inviato." }, 409);

  const chiave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chiave) return json({ ok: false, errore: "Lettura non disponibile." }, 503);

  // si conta il TENTATIVO prima di chiamare il modello: un fallimento del
  // lettore costa comunque, e contare dopo lascerebbe la porta aperta a
  // chi manda richieste che muoiono a meta'
  const base = (isc.documento_letto && typeof isc.documento_letto === "object") ? isc.documento_letto : {};
  const ora = Date.now();
  const precedentiTentativi: number[] = Array.isArray((base as any).limite?.tentativi) ? (base as any).limite.tentativi.filter((t: unknown) => typeof t === "number") : [];
  const ultimaOra = precedentiTentativi.filter((t) => ora - t < 3600_000).length;
  if (ultimaOra >= MAX_ALL_ORA || precedentiTentativi.length >= MAX_TOTALE) {
    return json({ ok: false, errore: "Troppi tentativi di lettura. Se la foto non viene letta, puoi inviare comunque il modulo." }, 429);
  }
  const conTentativo = { ...base, limite: { tentativi: [...precedentiTentativi, ora].slice(-MAX_TOTALE) } };
  await admin.from("iscritti").update({ documento_letto: conTentativo }).eq("id", isc.id);

  let risposta: Response;
  try {
    risposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chiave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: 600,
        system: ISTRUZIONI,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: `Questo e' il ${lato} del documento. Rispondi solo con il JSON.` },
          ],
        }],
      }),
    });
  } catch (e) {
    return json({ ok: false, errore: "Il lettore non risponde: " + String(e).slice(0, 120) }, 502);
  }
  if (!risposta.ok) {
    const t = await risposta.text().catch(() => "");
    console.error("Anthropic", risposta.status, t.slice(0, 300));
    return json({ ok: false, errore: `Il lettore ha risposto ${risposta.status}.` }, 502);
  }
  const esito = await risposta.json();
  const testo = (esito?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  let letto: Record<string, unknown> | null = null;
  try {
    const pulito = testo.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    letto = JSON.parse(pulito.slice(pulito.indexOf("{"), pulito.lastIndexOf("}") + 1));
  } catch {
    console.error("JSON non interpretabile:", testo.slice(0, 300));
    return json({ ok: false, errore: "Non sono riuscito a leggere il documento." }, 502);
  }
  if (!letto || typeof letto !== "object") return json({ ok: false, errore: "Non sono riuscito a leggere il documento." }, 502);

  // si tiene: il letto, da che lato, con quale modello e quando. Niente foto.
  const precedente = conTentativo;
  const registrazione = {
    ...precedente,
    [lato]: { ...letto, modello: MODELLO, letto_il: new Date().toISOString(),
              uso: { in: esito?.usage?.input_tokens ?? null, out: esito?.usage?.output_tokens ?? null } },
  };
  const { error: errSalva } = await admin.from("iscritti").update({ documento_letto: registrazione }).eq("id", isc.id);
  if (errSalva) console.error("documento_letto non salvato:", errSalva.message);

  return json({ ok: true, lato, letto });
});
