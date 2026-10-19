// Edge Function "modulo-ricevuto"
//
// Manda all'allieva la conferma che il suo modulo e' arrivato. La chiama
// la pagina pubblica del modulo, subito dopo che `modulo_salva` ha
// scritto davvero.
//
// PERCHE' NON LA MANDA IL BROWSER. `invia-email` accetta solo una
// sessione valida o la service role key, e l'allieva non ha nessuna
// delle due: la sua pagina si apre con un link, senza account. Aprire
// `invia-email` anche alla chiave pubblicabile vorrebbe dire regalare a
// chiunque legga il bundle un modo per spedire a nome di Elitederma.
// Quindi la mail parte da qui, dal server, dove la service role key c'e'
// gia' e non esce.
//
// CHI PUO' CHIAMARLA. Chi ha il gettone del modulo — lo stesso
// lasciapassare delle altre pagine pubbliche (master, modelle,
// biglietti). Il gettone non basta a far partire una mail qualsiasi: la
// funzione manda SOLO a quell'iscritta, SOLO il testo del modello
// `ricezione_modulo`, e SOLO se il modulo risulta davvero ricevuto. Chi
// avesse un gettone rubato otterrebbe, al massimo, di mandare a
// quell'allieva una mail che le e' gia' arrivata — e nemmeno quella,
// perche' l'indice unico del registro la ferma alla seconda.
//
// Per questo va pubblicata con --no-verify-jwt: chi la chiama non ha un
// JWT da mostrare.
//
// Corpo: { token, prova? }. Con { prova: true } compone e restituisce la
// mail senza mandarla e senza scrivere nel registro — serve a guardarla
// prima, come per gli invii automatici.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { componiMailRicezione, valoriCorso } from "../_shared/email.js";
import { creaPdfModulo } from "../_shared/modulo-pdf.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CHIAVE = "ricezione_modulo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const emailValida = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

async function spedisci(
  a: string,
  mail: { oggetto: string; testo: string; html: string },
  allegati: { nome: string; contenuto: string; tipo?: string }[] = [],
) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      a, oggetto: mail.oggetto, html: mail.html, testo: mail.testo,
      ...(allegati.length ? { allegati } : {}),
      // si chiede al programma di posta di confermare la lettura: e'
      // questa la conferma voluta, al posto del tasto che c'era prima
      ricevuta: true,
    }),
  });
  const esito = await r.json().catch(() => ({}));
  if (!r.ok || esito?.errore) return { errore: esito?.errore || `invia-email ${r.status}`, id: null };
  return { errore: null, id: esito?.id || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, errore: "Metodo non consentito" }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return json({ ok: false, errore: "JSON non valido" }, 400); }
  const token = String(corpo.token || "").trim();
  const prova = corpo.prova === true;
  // RIGENERA SOLO IL PDF, SENZA MANDARE NIENTE.
  //
  // Serve alle iscrizioni arrivate prima che questa copia esistesse, e a
  // quelle in cui la generazione era fallita: dalla scheda si rifa' il
  // documento senza far ripartire una mail che l'allieva ha gia'
  // ricevuto. Scrive, quindi non e' una prova; ma non spedisce, quindi
  // non tocca il registro degli invii.
  const soloPdf = corpo.soloPdf === true;
  if (token.length < 12) return json({ ok: false, errore: "Link non valido." }, 400);

  const { data: isc, error: erroreIscritto } = await admin
    .from("iscritti").select("*").eq("token_modulo", token).maybeSingle();
  if (erroreIscritto) return json({ ok: false, errore: erroreIscritto.message }, 500);
  if (!isc) return json({ ok: false, errore: "Link non valido." }, 404);

  // la conferma dice "abbiamo ricevuto": se il modulo non risulta
  // ricevuto, non c'e' niente da confermare. E' anche quello che
  // impedisce di usare questa funzione come un bottone per mandare mail.
  //
  // La prova a vuoto passa lo stesso, e lo dice: serve a guardare la mail
  // PRIMA che un modulo arrivi — altrimenti il testo si potrebbe
  // controllare solo rovinando un'iscrizione vera. Non manda e non
  // scrive, quindi non c'e' niente da proteggere.
  const ricevuto = !!isc.modulo_ricevuto_il;
  if (!ricevuto && !prova) {
    return json({ ok: false, errore: "Il modulo non risulta ancora ricevuto." }, 409);
  }

  const destinatario = String(isc.email || "").trim().toLowerCase();

  // la classe, il corso e la sede: servono ai segnaposti del testo
  const { data: classe } = await admin
    .from("corsi_date").select("*").eq("id", isc.corso_data_id).maybeSingle();
  const { data: corso } = classe?.corso_id
    ? await admin.from("corsi").select("nome").eq("id", classe.corso_id).maybeSingle()
    : { data: null };
  const { data: loc } = classe?.location_id
    ? await admin.from("location").select("nome, nome_sede, citta, indirizzo").eq("id", classe.location_id).maybeSingle()
    : { data: null };

  const { valori, righe } = valoriCorso({
    nome: isc.nome,
    nomeCorso: corso?.nome,
    dataInizio: classe?.data_inizio,
    dataFine: classe?.data_fine,
    citta: classe?.citta || loc?.citta || loc?.nome,
    sede: loc?.nome_sede,
    indirizzo: classe?.indirizzo || loc?.indirizzo,
  });

  // il modello si rilegge a ogni invio: chi corregge una frase in Setting
  // deve vederne l'effetto alla mail dopo
  const { data: modello } = await admin
    .from("email_modelli").select("*").eq("chiave", CHIAVE).maybeSingle();
  const { data: societa } = await admin
    .from("intestazione_societa").select("*").limit(1).maybeSingle();

  // IL LINK DEL RECESSO. La norma vuole che la conferma lo porti, e
  // porta il gettone del recesso, non quello del modulo. L'indirizzo si
  // puo' cambiare da un secret senza ripubblicare la funzione.
  const indirizzoApp = (Deno.env.get("APP_URL") || "https://app.elitederma.net").replace(/\/+$/, "");
  const linkRecesso = isc.token_recesso ? `${indirizzoApp}/?recesso=${isc.token_recesso}` : "";

  const mail = componiMailRicezione({ valori, righe, modello, societa, linkRecesso });

  // IL MODULO FIRMATO, IN PDF, ALLEGATO ALLA CONFERMA.
  //
  // Non e' un di piu': e' la copia che l'allieva deve avere in mano di
  // quello che ha sottoscritto — dati, dichiarazioni con la loro ora,
  // firma, documento, e il testo del contratto com'era quel giorno. Una
  // conferma che dice "abbiamo ricevuto" senza allegare cosa si e'
  // ricevuto lascia tutte e due le parti senza niente in mano.
  //
  // Se la generazione fallisce la mail parte lo stesso, senza allegato:
  // meglio una conferma monca di nessuna conferma. Il guasto resta
  // scritto, e dalla scheda si potra' rigenerare.
  const scaricaDalSecchio = async (percorso: string | null) => {
    if (!percorso) return null;
    const { data, error } = await admin.storage.from("moduli-iscrizione").download(percorso);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  };

  let pdf: Uint8Array | null = null;
  let guastoPdf: string | null = null;
  let pagine = 0;
  let scartate: string[] = [];
  const pesoSorgenti: Record<string, number> = {};
  try {
    const prendi = async (nome: string, percorso: string | null) => {
      const b = await scaricaDalSecchio(percorso);
      if (percorso) pesoSorgenti[nome] = b ? b.length : 0;
      return b;
    };
    const esito = await creaPdfModulo({
      iscritto: isc,
      corso: {
        nome: corso?.nome, citta: classe?.citta || loc?.citta || loc?.nome,
        indirizzo: classe?.indirizzo || loc?.indirizzo,
        inizio: classe?.data_inizio, fine: classe?.data_fine,
      },
      societa,
      firma: await prendi("firma", isc.firma_path),
      fronte: await prendi("fronte", isc.doc_fronte),
      retro: await prendi("retro", isc.doc_retro),
      // il timbro e la firma della societa': sta nello stesso secchio
      // privato, in `_azienda/`, e il percorso lo dice l'intestazione
      timbro: await prendi("timbro", societa?.timbro_path || null),
    });
    pdf = esito.byte;
    pagine = esito.pagine;
    scartate = esito.scartate;
  } catch (e) {
    guastoPdf = e instanceof Error ? e.message : String(e);
  }

  const nomeAllegato = `Modulo iscrizione - ${String(isc.cognome || "").trim()} ${String(isc.nome || "").trim()}`.trim().replace(/\s+/g, " ") + ".pdf";

  if (prova) {
    return json({
      ok: true, prova: true, ricevuto, a: destinatario, mail,
      pdf: pdf ? { nome: nomeAllegato, byte: pdf.length, pagine, scartate } : null,
      pesoSorgenti, guastoPdf,
    });
  }

  // il PDF si archivia accanto alla firma e ai documenti, nello stesso
  // secchio privato: da li' lo rilegge la scheda dell'iscritto
  let percorsoPdf: string | null = null;
  if (pdf) {
    percorsoPdf = `${String(token).slice(0, 16)}/modulo-firmato-${Date.now()}.pdf`;
    const { error: erroreCaricamento } = await admin.storage.from("moduli-iscrizione")
      .upload(percorsoPdf, pdf, { contentType: "application/pdf", upsert: true });
    if (erroreCaricamento) { percorsoPdf = null; guastoPdf = erroreCaricamento.message; }
    else {
      await admin.from("iscritti").update({
        modulo_pdf_path: percorsoPdf, modulo_pdf_generato_il: new Date().toISOString(),
      }).eq("id", isc.id);
    }
  }

  if (soloPdf) {
    return json({ ok: !!percorsoPdf, soloPdf: true, percorso: percorsoPdf, pagine, scartate, guastoPdf });
  }

  if (!emailValida(destinatario)) {
    // si registra lo stesso: una conferma mai partita perche' manca
    // l'indirizzo e' esattamente la cosa che qualcuno deve poter vedere
    await admin.from("email_inviate").insert({
      chiave_modello: CHIAVE, destinatario: "", iscritto_id: isc.id,
      corso_data_id: isc.corso_data_id || null, oggetto: mail.oggetto,
      esito: "errore", errore: "Nessun indirizzo email sulla scheda.",
      automatica: true, inviata_da: "modulo",
    });
    return json({ ok: false, errore: "Nessun indirizzo email sulla scheda." });
  }

  // SI PRENOTA IL POSTO PRIMA DI MANDARE. L'indice unico parziale su
  // (chiave_modello, iscritto_id) per le automatiche riuscite e' l'unica
  // cosa che impedisce due conferme per lo stesso modulo — e qui serve
  // davvero, perche' questa funzione la chiama una pagina pubblica, che
  // qualcuno puo' ricaricare. Chi perde la corsa riceve l'errore di
  // unicita' e passa oltre, senza mandare niente.
  const { data: prenotata, error: erroreRegistro } = await admin
    .from("email_inviate").insert({
      chiave_modello: CHIAVE, destinatario, iscritto_id: isc.id,
      corso_data_id: isc.corso_data_id || null, oggetto: mail.oggetto,
      esito: "ok", automatica: true, inviata_da: "modulo",
    }).select("id").single();
  if (erroreRegistro) return json({ ok: true, gia: true, messaggio: "La conferma era già partita." });

  const { errore, id } = await spedisci(destinatario, mail,
    pdf ? [{ nome: nomeAllegato, contenuto: encodeBase64(pdf), tipo: "application/pdf" }] : []);
  if (errore) {
    await admin.from("email_inviate").update({ esito: "errore", errore }).eq("id", prenotata.id);
    return json({ ok: false, errore });
  }
  await admin.from("email_inviate").update({ resend_id: id }).eq("id", prenotata.id);
  return json({ ok: true, a: destinatario });
});
