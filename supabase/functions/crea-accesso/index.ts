// Edge Function "crea-accesso"
//
// Crea l'utenza di accesso di una persona (email + password del cancello)
// e la lega alla sua riga di Gestione utenti / Password Master / Password
// venditori, scrivendo l'email nella colonna email_accesso.
//
// Perche' esiste. La chiave che crea gli utenti su Supabase e' la service
// role key: chi ce l'ha puo' leggere e riscrivere tutto il database
// scavalcando qualunque regola. Non puo' stare dentro l'app, che e'
// scaricabile da chiunque. Sta qui, dove gira solo sul server di Supabase.
//
// Senza questa funzione l'unico modo di dare un accesso sarebbe entrare
// nella dashboard di Supabase a mano, una persona alla volta.
//
// Chi puo' chiamarla: solo chi ha gia' fatto accesso (serve il gettone) e
// per di piu' risulta amministratore. Finche' nessuno e' ancora collegato
// a un'email — cioe' durante la prima distribuzione delle credenziali —
// basta avere fatto accesso, perche' gli unici account esistenti sono
// quelli del titolare.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABELLE_AMMESSE = ["utenti_app", "master", "venditori"];

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Chi sta chiamando, e puo' farlo? Il gettone arriva nell'header
// Authorization; lo apre la service role key, che sa dire a chi appartiene
async function chiamanteAutorizzato(req: Request): Promise<{ ok: boolean; motivo?: string; email?: string }> {
  const header = req.headers.get("Authorization") || "";
  const gettone = header.replace(/^Bearer\s+/i, "").trim();
  if (!gettone) return { ok: false, motivo: "Serve avere fatto accesso." };

  const { data, error } = await admin.auth.getUser(gettone);
  if (error || !data?.user?.email) return { ok: false, motivo: "Accesso non valido: esci e rientra." };
  const email = data.user.email.toLowerCase();

  const { data: amministratori } = await admin
    .from("utenti_app")
    .select("email_accesso, amministratore")
    .not("email_accesso", "is", null)
    .eq("amministratore", true);

  // nessuno ancora collegato: siamo nella prima distribuzione, e gli
  // account che esistono sono solo quelli del titolare
  if (!amministratori || amministratori.length === 0) return { ok: true, email };
  if (amministratori.some((r) => (r.email_accesso || "").toLowerCase() === email)) return { ok: true, email };
  return { ok: false, motivo: "Solo un amministratore puo' creare gli accessi." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const permesso = await chiamanteAutorizzato(req);
    if (!permesso.ok) return risposta({ errore: permesso.motivo }, 403);

    const body = await req.json().catch(() => ({}));
    const tabella = String(body.tabella || "");
    const id = String(body.id || "");
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!TABELLE_AMMESSE.includes(tabella)) return risposta({ errore: "Tabella non valida." }, 400);
    if (!id) return risposta({ errore: "Manca la riga a cui collegare l'accesso." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return risposta({ errore: "Email non valida." }, 400);
    if (password && password.length < 8) return risposta({ errore: "La password deve avere almeno 8 caratteri." }, 400);

    // esiste gia' un'utenza con questa email? Capita: la persona era gia'
    // stata creata a mano, o si sta solo ricollegando una riga
    const { data: elenco, error: erroreElenco } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (erroreElenco) return risposta({ errore: "Non riesco a leggere le utenze: " + erroreElenco.message }, 500);
    const esistente = (elenco?.users || []).find((u) => (u.email || "").toLowerCase() === email);

    let creata = false;
    if (!esistente) {
      if (!password) return risposta({ errore: "Per creare l'utenza serve una password." }, 400);
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // niente email di conferma: la password gliela consegna il titolare
      });
      if (error) return risposta({ errore: "Non riesco a creare l'utenza: " + error.message }, 400);
      creata = true;
    } else if (password) {
      const { error } = await admin.auth.admin.updateUserById(esistente.id, { password });
      if (error) return risposta({ errore: "Non riesco a cambiare la password: " + error.message }, 400);
    }

    // il collegamento vero e proprio. Se l'email e' gia' di qualcun altro
    // il database rifiuta (trigger email_accesso_non_duplicata) e il
    // messaggio dice a chi
    const { error: erroreLegame } = await admin.from(tabella).update({ email_accesso: email }).eq("id", id);
    if (erroreLegame) return risposta({ errore: erroreLegame.message }, 400);

    return risposta({
      ok: true,
      email,
      creata,
      passwordAggiornata: !creata && !!password,
    });
  } catch (e) {
    return risposta({ errore: String(e?.message || e) }, 500);
  }
});
