// Edge Function "contratto-master-firmato"
//
// Compone la COPIA FIRMATA del contratto di collaborazione di una master,
// l'archivia e la manda per email: a lei, e all'Accademia — «una volta
// confermato io lo riceverò firmato».
//
// PERCHE' NON LA FA IL BROWSER. Due ragioni, e tutte e due contano. La
// prima: `invia-email` accetta solo una sessione valida o la service role
// key, e quella key sta qui e non esce. La seconda, che e' la deroga
// dichiarata nel CLAUDE.md per il modulo di iscrizione e vale identica
// qui: questo PDF deve PARTIRE ALLEGATO a una mail che manda il server.
// Se lo facesse il telefono di chi firma, basterebbe che la pagina si
// chiuda un istante prima e la copia non arriverebbe a nessuno.
//
// CHI PUO' CHIAMARLA: chi ha fatto accesso al gestionale — la master che
// ha appena firmato, o chi amministra dal tasto «Rimanda la copia». Non
// e' una funzione pubblica e non ha un gettone: si pubblica col controllo
// del JWT acceso.
//
// Corpo: { contrattoId, rimanda?, prova? }
//   - `prova: true` compone e restituisce l'esito SENZA archiviare e
//     senza mandare niente: serve a guardare il documento prima;
//   - `rimanda: true` rifa' la copia anche se c'e' gia' e la rimanda.
//     Senza, una seconda chiamata sullo stesso contratto non spedisce
//     due volte — una copia e' arrivata, e la seconda sarebbe rumore.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { creaPdfContrattoMaster } from "../_shared/contratto-master-pdf.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CHIAVE = "contratto_master_firmato";
const SECCHIO = "master-documenti";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const emailValida = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// LA SESSIONE DELLO STAFF. `verify_jwt` da solo non basta: la chiave
// pubblicabile che sta nel bundle E' un JWT valido, di `anon`. Quindi si
// chiede `getUser` sul gettone ricevuto, come fa `analisi-domanda`.
async function eStaff(req: Request): Promise<boolean> {
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return false;
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  const { data, error } = await admin.auth.getUser(gettone);
  return !error && !!data?.user?.email;
}

// L'INDIRIZZO DELL'ACCADEMIA. Sta scritto in `intestazione_societa`, in
// una delle righe libere dell'intestazione («email: …»): si pesca da li'
// invece di scriverlo qui, cosi' cambiarlo non richiede di ripubblicare
// la funzione. Il secret `CONTRATTI_A` lo scavalca, e in ultimo c'e'
// l'indirizzo noto — meglio una copia che arriva sempre nello stesso
// posto che una copia che non arriva a nessuno.
function indirizzoAccademia(societa: Record<string, any> | null): string {
  const dalSecret = (Deno.env.get("CONTRATTI_A") || "").trim();
  if (emailValida(dalSecret)) return dalSecret;
  for (const valore of Object.values(societa || {})) {
    const trovato = String(valore ?? "").match(/[^\s:;,<>()]+@[^\s:;,<>()]+\.[a-z]{2,}/i);
    if (trovato && emailValida(trovato[0])) return trovato[0];
  }
  return "commerciale.elitederma@gmail.com";
}

async function spedisci(
  a: string,
  oggetto: string,
  html: string,
  testo: string,
  allegati: { nome: string; contenuto: string; tipo?: string }[] = [],
) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ a, oggetto, html, testo, ...(allegati.length ? { allegati } : {}) }),
  });
  const esito = await r.json().catch(() => ({}));
  if (!r.ok || esito?.errore) return { errore: esito?.errore || `invia-email ${r.status}`, id: null };
  return { errore: null, id: esito?.id || null };
}

const quando = (iso: unknown) => {
  if (!iso) return "";
  try {
    return new Date(String(iso)).toLocaleString("it-IT", {
      timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);

  if (!(await eStaff(req))) {
    return json({ ok: false, errore: "Serve avere fatto accesso al gestionale." }, 403);
  }

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const contrattoId = String(corpo.contrattoId || "").trim();
  const prova = corpo.prova === true;
  const rimanda = corpo.rimanda === true;
  if (!contrattoId) return json({ ok: false, errore: "Manca il contratto." }, 400);

  const { data: contratto, error: erroreContratto } = await admin
    .from("master_contratti").select("*").eq("id", contrattoId).maybeSingle();
  if (erroreContratto) return json({ ok: false, errore: erroreContratto.message }, 500);
  if (!contratto) return json({ ok: false, errore: "Questo contratto non esiste." }, 404);

  // LA COPIA DICE «FIRMATO»: se il contratto non risulta firmato non c'e'
  // niente da copiare, ed e' anche quello che impedisce di usare questa
  // funzione come un tasto per mandare mail.
  if (contratto.stato !== "firmato") {
    return json({ ok: false, errore: "Questo contratto non risulta firmato." }, 409);
  }

  const { data: master } = await admin
    .from("master").select("id, nome, email").eq("id", contratto.master_id).maybeSingle();
  const { data: societa } = await admin
    .from("intestazione_societa").select("*").limit(1).maybeSingle();

  const scarica = async (secchio: string, percorso: string | null) => {
    if (!percorso) return null;
    const { data, error } = await admin.storage.from(secchio).download(percorso);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  };

  let pdf: Uint8Array | null = null;
  let guasto: string | null = null;
  let pagine = 0;
  let scartate: string[] = [];
  try {
    const esito = await creaPdfContrattoMaster({
      contratto,
      societa,
      firma: await scarica(SECCHIO, contratto.firma_path),
      fronte: await scarica(SECCHIO, contratto.doc_fronte),
      retro: await scarica(SECCHIO, contratto.doc_retro),
      // il timbro sta nell'ALTRO secchio privato, in `_azienda/`: e' lo
      // stesso file che chiude il modulo di iscrizione, e tenerne due
      // copie vorrebbe dire che un giorno i due documenti portano due
      // timbri diversi
      timbro: await scarica("moduli-iscrizione", societa?.timbro_path || null),
    });
    pdf = esito.byte;
    pagine = esito.pagine;
    scartate = esito.scartate;
  } catch (e) {
    guasto = e instanceof Error ? e.message : String(e);
  }

  const nomeFile = `Contratto master - ${String(master?.nome || "").trim()}`.replace(/\s+/g, " ").trim() + ".pdf";

  if (prova) {
    return json({ ok: !!pdf, prova: true, pdf: pdf ? { nome: nomeFile, byte: pdf.length, pagine, scartate } : null, guasto });
  }
  if (!pdf) return json({ ok: false, errore: `La copia non è stata composta: ${guasto || "motivo non noto"}` }, 500);

  // SI ARCHIVIA PRIMA DI MANDARE. Il PDF e' la copia di un contratto: se
  // la mail non parte, quel documento deve esistere comunque e si
  // rimanda dal gestionale. Il contrario — mandare e non archiviare —
  // lascerebbe l'unica copia in una casella di posta.
  const percorso = `contratti/${contratto.master_id}/contratto-firmato-${Date.now()}.pdf`;
  const { error: erroreCaricamento } = await admin.storage.from(SECCHIO)
    .upload(percorso, pdf, { contentType: "application/pdf", upsert: true });
  if (erroreCaricamento) {
    return json({ ok: false, errore: `La copia non è stata archiviata: ${erroreCaricamento.message}` }, 500);
  }
  await admin.from("master_contratti").update({
    pdf_path: percorso, pdf_generato_il: new Date().toISOString(),
  }).eq("id", contratto.id);

  // GIA' MANDATA: non si rimanda da sola. Chi vuole rifarlo passa da
  // «Rimanda la copia», che e' un gesto di una persona.
  if (contratto.copia_inviata_il && !rimanda) {
    return json({ ok: true, gia: true, percorso, pagine, scartate, messaggio: "La copia era già stata mandata." });
  }

  const nome = String(master?.nome || "").trim();
  const suo = String(master?.email || "").trim().toLowerCase();
  const nostro = indirizzoAccademia(societa);
  const data = quando(contratto.firmato_il);
  const luogo = contratto.luogo_firma ? ` a ${contratto.luogo_firma}` : "";

  const oggettoSuo = "La tua copia del contratto di collaborazione Elitederma";
  const testoSuo = `Ciao ${nome},\n\nin allegato trovi la copia del contratto di collaborazione professionale autonoma che hai sottoscritto${luogo} il ${data}, con l'Allegato A (Manifesto Elitederma), le dichiarazioni che hai approvato e la tua firma.\n\nConservala: è il documento che fa fede.\n\nElitederma Srl`;
  const htmlSuo = `<p>Ciao ${nome},</p><p>in allegato trovi la copia del <b>contratto di collaborazione professionale autonoma</b> che hai sottoscritto${luogo} il ${data}, con l'Allegato A (Manifesto Elitederma), le dichiarazioni che hai approvato e la tua firma.</p><p>Conservala: è il documento che fa fede.</p><p>Elitederma Srl</p>`;

  const oggettoNostro = `Contratto master firmato — ${nome}`;
  const testoNostro = `${nome} ha firmato il contratto di collaborazione${luogo} il ${data}.\n\nLa copia firmata è in allegato e resta archiviata nel gestionale, in Contratti master.`;
  const htmlNostro = `<p><b>${nome}</b> ha firmato il contratto di collaborazione${luogo} il ${data}.</p><p>La copia firmata è in allegato e resta archiviata nel gestionale, in <b>Contratti master</b>.</p>`;

  const allegato = [{ nome: nomeFile, contenuto: encodeBase64(pdf), tipo: "application/pdf" }];
  const esiti: Record<string, string | null> = {};

  // ALL'ACCADEMIA SI MANDA SEMPRE, a lei solo se un indirizzo c'e'. Una
  // master senza email in anagrafica non deve far perdere la copia anche
  // a noi: il contratto e' firmato, e qualcuno lo deve avere.
  const nostroEsito = await spedisci(nostro, oggettoNostro, htmlNostro, testoNostro, allegato);
  esiti.accademia = nostroEsito.errore;
  if (emailValida(suo)) {
    const suoEsito = await spedisci(suo, oggettoSuo, htmlSuo, testoSuo, allegato);
    esiti.master = suoEsito.errore;
  } else {
    esiti.master = "Nessun indirizzo email sulla scheda della master.";
  }

  // OGNI INVIO LASCIA UNA RIGA, anche quando fallisce: una copia mai
  // partita perche' manca l'indirizzo e' esattamente la cosa che
  // qualcuno deve poter vedere.
  await admin.from("email_inviate").insert([
    {
      chiave_modello: CHIAVE, destinatario: nostro, oggetto: oggettoNostro,
      esito: esiti.accademia ? "errore" : "ok", errore: esiti.accademia,
      automatica: false, inviata_da: "contratto-master",
    },
    {
      chiave_modello: CHIAVE, destinatario: emailValida(suo) ? suo : "", oggetto: oggettoSuo,
      esito: esiti.master ? "errore" : "ok", errore: esiti.master,
      automatica: false, inviata_da: "contratto-master",
    },
  ]);

  // «Inviata» vuol dire che almeno una delle due e' partita: se non e'
  // partita nessuna, il tasto «Rimanda la copia» deve restare quello che
  // si premera' domani.
  if (!esiti.accademia || !esiti.master) {
    await admin.from("master_contratti").update({ copia_inviata_il: new Date().toISOString() }).eq("id", contratto.id);
  }

  return json({
    ok: true, percorso, pagine, scartate,
    a: { master: emailValida(suo) ? suo : null, accademia: nostro },
    errori: esiti,
  });
});
