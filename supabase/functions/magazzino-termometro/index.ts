// Edge Function "magazzino-termometro"
//
// Misura lo scarto fra la giacenza dell'app e quella di WooCommerce,
// prodotto per prodotto, e la scrive in `magazzino_scarti_shop`.
//
// PERCHE' MISURARE INVECE DI CORREGGERE.
//
// L'app e il sito sono due database su due macchine, con una rete in
// mezzo: divergeranno, prima o poi. Non si puo' impedire. Quello che si
// puo' fare e' non lasciare che succeda in silenzio — una differenza che
// si vede entro ventiquattr'ore e si sa quant'e' vale piu' di una
// perfezione che non si puo' dimostrare.
//
// E prima di cambiare qualcosa di grosso (spegnere la gestione dello
// stock su WooCommerce, per dire) bisogna sapere se oggi lo scarto e'
// zero o no. Senza questa misura e' un'opinione.
//
// NON TOCCA NIENTE. Ne' qui ne' sul sito: legge e scrive una tabella
// sua. Correggere e' un gesto che si fa guardando, da Gestione
// magazzino, perche' la direzione giusta non la sa un programma: un
// prodotto che sul sito ha due pezzi in meno puo' essere un ordine non
// arrivato o un furto in negozio, e si rimedia in modi opposti.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

// WooCommerce restituisce cento prodotti per pagina e si ferma li': con
// 184 prodotti sullo shop una pagina sola ne perderebbe 84, e sarebbero
// 84 scarti invisibili — l'esatto contrario di quello che serve.
const PER_PAGINA = 100;

// CHI PUO' CHIAMARLA.
//
// E' pubblicata senza `verify_jwt` perche' la sveglia il cron, che un
// JWT del progetto non ce l'ha. Senza un controllo qui dentro sarebbe
// quindi aperta a chiunque conosca l'indirizzo: non puo' rovinare
// niente — legge e scrive una tabella sua — ma farebbe interrogare
// WooCommerce a comando, e in prova restituirebbe le giacenze di tutto
// il catalogo.
//
// Il gettone e' lo stesso del lavoro notturno delle email: nato dentro
// Postgres, mai uscito dal database, e verificato da una funzione
// `security definer` che solo `service_role` puo' eseguire — cosi' la
// chiave pubblicabile del bundle non la puo' usare come oracolo.
async function puoEntrare(req: Request): Promise<boolean> {
  const gettone = req.headers.get("x-cron-token") || "";
  if (!gettone) return false;
  const { data, error } = await admin.rpc("email_cron_ok", { gettone });
  return !error && data === true;
}

Deno.serve(async (req) => {
  if (!(await puoEntrare(req))) return json({ ok: false, errore: "Non autorizzata" }, 403);

  const siteUrl = (Deno.env.get("WC_SITE_URL") || "").replace(/\/+$/, "");
  const key = Deno.env.get("WC_CONSUMER_KEY");
  const secret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!siteUrl || !key || !secret) return json({ ok: false, errore: "Credenziali WooCommerce mancanti" }, 500);

  const prova = req.method === "POST"
    ? await req.json().then((c) => c?.prova === true).catch(() => false)
    : false;

  const auth = "Basic " + btoa(`${key}:${secret}`);

  // 1. i nostri: solo quelli davvero pubblicati sul sito. Un prodotto in
  //    bozza o solo offline non ha una giacenza online da confrontare,
  //    e metterlo in lista vorrebbe dire inventare uno scarto.
  const { data: nostri, error: erroreNostri } = await admin
    .from("prodotti_shop")
    .select("id, nome, quantita, woo_product_id, stato, solo_offline")
    .not("woo_product_id", "is", null)
    .eq("stato", "publish")
    .or("solo_offline.is.null,solo_offline.eq.false");
  if (erroreNostri) return json({ ok: false, errore: erroreNostri.message }, 500);

  // 2. quelli del sito, una pagina alla volta
  const suWoo = new Map<number, { quantita: number | null; gestisce: boolean }>();
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await fetch(`${siteUrl}/wp-json/wc/v3/products?per_page=${PER_PAGINA}&page=${pagina}&status=publish`, {
      headers: { Authorization: auth },
    });
    if (!r.ok) return json({ ok: false, errore: `WooCommerce ha risposto ${r.status} alla pagina ${pagina}` }, 502);
    const lista = await r.json();
    if (!Array.isArray(lista) || lista.length === 0) break;
    for (const p of lista) {
      suWoo.set(Number(p.id), {
        quantita: p.manage_stock ? Number(p.stock_quantity ?? 0) : null,
        gestisce: !!p.manage_stock,
      });
    }
    if (lista.length < PER_PAGINA) break;
  }

  // 3. il confronto
  const scarti: Record<string, unknown>[] = [];
  let confrontati = 0;
  let senzaGestione = 0;
  let nonTrovati = 0;
  for (const p of nostri || []) {
    const online = suWoo.get(Number(p.woo_product_id));
    if (!online) { nonTrovati++; continue; }
    // chi sul sito non gestisce lo stock non ha un numero da
    // confrontare: non e' uno scarto, e' un'altra cosa
    if (!online.gestisce) { senzaGestione++; continue; }
    confrontati++;
    const qui = Number(p.quantita ?? 0);
    const la = Number(online.quantita ?? 0);
    if (qui !== la) {
      scarti.push({
        prodotto_id: p.id, woo_product_id: p.woo_product_id,
        qui, sul_sito: la, differenza: la - qui,
      });
    }
  }

  const riepilogo = {
    confrontati, scarti: scarti.length,
    senza_gestione_stock: senzaGestione, non_trovati_sul_sito: nonTrovati,
  };
  if (prova) return json({ ok: true, prova: true, ...riepilogo, elenco: scarti });

  // i vivi si riscrivono, chi e' rientrato sparisce: un elenco che tiene
  // anche gli allarmi rientrati non lo guarda piu' nessuno
  for (const s of scarti) {
    await admin.from("magazzino_scarti_shop").upsert(
      { ...s, aggiornato_il: new Date().toISOString() },
      { onConflict: "prodotto_id" },
    );
  }
  const vivi = scarti.map((s) => s.prodotto_id as string);
  const pulizia = admin.from("magazzino_scarti_shop").delete();
  await (vivi.length ? pulizia.not("prodotto_id", "in", `(${vivi.join(",")})`) : pulizia.gte("qui", -2147483648));

  return json({ ok: true, ...riepilogo });
});
