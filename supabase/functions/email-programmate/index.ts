// Edge Function "email-programmate"
//
// Gira una volta al giorno e manda le mail che le regole di
// `email_regole` dicono di mandare oggi. Non decide niente da sola: se
// non c'e' una regola ACCESA, non parte nulla.
//
// COME SI LEGGE UNA REGOLA. `scarto_giorni` si conta rispetto
// all'evento, negativo = prima. Una regola -3 su `inizio_corso` cerca
// le classi che cominciano fra tre giorni: data dell'evento =
// oggi - scarto_giorni.
//
// PERCHE' SI SCRIVE NEL REGISTRO PRIMA DI MANDARE. L'indice unico su
// `email_inviate` (chiave_modello + iscritto_id, solo per le automatiche
// riuscite) e' l'unica cosa che impedisce a una mail di partire due
// volte. Se si scrivesse dopo l'invio, due giri sovrapposti —  un cron
// ripartito, una chiamata a mano mentre l'altra e' in corso — manderebbero
// due mail prima che la prima riga esista. Allora si prenota il posto
// PRIMA: l'insert e' atomico, chi perde la corsa riceve un errore di
// unicita' e passa oltre. Se poi l'invio fallisce, quella riga viene
// portata a 'errore' e domani si riprova.
//
// Il prezzo di questa scelta: se la funzione morisse fra la prenotazione
// e l'invio, resterebbe una riga "ok" per una mail mai partita, e nessuno
// riproverebbe. Per un messaggio di cortesia una mail in meno e' meglio di
// una mail doppia, e il registro lo mostra.
//
// SI PUO' CHIAMARE A VUOTO. Con { prova: true } non manda e non scrive:
// dice solo cosa partirebbe. E' il modo di controllare una regola prima
// di accenderla.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { componiDaModello, modelloUsabile, valoriCorso } from "../_shared/email.js";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// La data di oggi come la vede chi sta in Italia. Il server sta in UTC:
// dopo le 23 (o le 22 d'estate) "oggi" per lui e' gia' domani, e una
// regola a tre giorni ne manderebbe quattro.
function oggiARoma(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

// Somma giorni a una data "aaaa-mm-gg" restando sul calendario, senza
// passare dal fuso: l'ora legale farebbe scivolare un giorno due volte
// l'anno.
function piuGiorni(data: string, giorni: number): string {
  const [a, m, g] = data.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

async function autorizzato(req: Request): Promise<boolean> {
  const gettone = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return false;
  if (gettone === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  const { data, error } = await admin.auth.getUser(gettone);
  return !error && !!data?.user;
}

async function spedisci(a: string, mail: { oggetto: string; testo: string; html: string }) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/invia-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ a, oggetto: mail.oggetto, html: mail.html, testo: mail.testo }),
  });
  const esito = await r.json().catch(() => ({}));
  if (!r.ok || esito?.errore) return { errore: esito?.errore || `invia-email ${r.status}`, id: null };
  return { errore: null, id: esito?.id || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!(await autorizzato(req))) return json({ errore: "Non autorizzato" }, 403);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { /* chiamata senza corpo: giro vero */ }
  const prova = corpo.prova === true;

  const oggi = oggiARoma();
  const resoconto: Record<string, unknown>[] = [];

  const { data: regole, error: erroreRegole } = await admin
    .from("email_regole").select("*").eq("attiva", true);
  if (erroreRegole) return json({ errore: erroreRegole.message }, 500);
  if (!regole?.length) return json({ oggi, prova, regole: 0, messaggio: "Nessuna regola accesa." });

  for (const regola of regole) {
    const dataEvento = piuGiorni(oggi, -regola.scarto_giorni);
    const campo = regola.evento === "fine_corso" ? "data_fine" : "data_inizio";
    const riga: Record<string, unknown> = {
      modello: regola.chiave_modello, evento: regola.evento,
      scarto_giorni: regola.scarto_giorni, data_cercata: dataEvento,
      classi: 0, mandate: 0, saltate: 0, fallite: 0, dettaglio: [] as string[],
    };
    const dettaglio = riga.dettaglio as string[];

    const { data: modello } = await admin
      .from("email_modelli").select("*").eq("chiave", regola.chiave_modello).maybeSingle();
    if (!modelloUsabile(modello)) {
      riga.saltata = "Il modello è vuoto: scrivere oggetto e testo in Setting → Modelli email.";
      resoconto.push(riga);
      continue;
    }

    const { data: classi } = await admin.from("corsi_date").select("*").eq(campo, dataEvento);
    riga.classi = (classi || []).length;

    for (const classe of classi || []) {
      const [{ data: corso }, { data: loc }, { data: iscritti }] = await Promise.all([
        admin.from("corsi").select("nome").eq("id", classe.corso_id).maybeSingle(),
        classe.location_id
          ? admin.from("location").select("nome, nome_sede, citta, indirizzo").eq("id", classe.location_id).maybeSingle()
          : Promise.resolve({ data: null }),
        admin.from("iscritti").select("id, nome, email").eq("corso_data_id", classe.id),
      ]);

      for (const isc of iscritti || []) {
        const a = String(isc.email || "").trim().toLowerCase();
        if (!a.includes("@")) { riga.saltate = (riga.saltate as number) + 1; continue; }

        const mail = componiDaModello(modello, valoriCorso({
          nome: isc.nome,
          nomeCorso: corso?.nome,
          dataInizio: classe.data_inizio,
          dataFine: classe.data_fine,
          citta: classe.citta || loc?.citta || loc?.nome,
          sede: loc?.nome_sede,
          indirizzo: classe.indirizzo || loc?.indirizzo,
        }));

        if (prova) {
          riga.mandate = (riga.mandate as number) + 1;
          dettaglio.push(`${a} — ${mail.oggetto}`);
          continue;
        }

        // si prenota il posto: se c'e' gia', l'indice unico rimbalza
        const { data: prenotata, error: erroreRegistro } = await admin
          .from("email_inviate").insert({
            chiave_modello: regola.chiave_modello,
            destinatario: a, iscritto_id: isc.id, corso_data_id: classe.id,
            oggetto: mail.oggetto, esito: "ok", automatica: true, inviata_da: "automatico",
          }).select("id").single();
        if (erroreRegistro) { riga.saltate = (riga.saltate as number) + 1; continue; }

        const { errore, id } = await spedisci(a, mail);
        if (errore) {
          await admin.from("email_inviate")
            .update({ esito: "errore", errore }).eq("id", prenotata.id);
          riga.fallite = (riga.fallite as number) + 1;
          dettaglio.push(`${a} — NON partita: ${errore}`);
        } else {
          await admin.from("email_inviate").update({ resend_id: id }).eq("id", prenotata.id);
          riga.mandate = (riga.mandate as number) + 1;
        }
      }
    }

    if (!prova) await admin.from("email_regole").update({ ultima_esecuzione: new Date().toISOString() }).eq("id", regola.id);
    resoconto.push(riga);
  }

  return json({ oggi, prova, resoconto });
});
