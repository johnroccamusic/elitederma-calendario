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
    .select("id, nome, quantita, woo_product_id, stato, solo_offline, tipo_prodotto, bundle_con_giacenza_fisica")
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

  // 2-bis. I BUNDLE NON HANNO UNA GIACENZA PROPRIA.
  //
  // La loro disponibilita' e' quanti se ne possono comporre coi
  // componenti, ed e' QUELLA che l'app spinge sul sito
  // (`sincronizzaDisponibilitaBundle`). Confrontare `quantita` — che su
  // un bundle e' un numero che non vuol dire niente — faceva gridare
  // proprio i prodotti che stavano benissimo: alla prima misura, 20 dei
  // 33 scarti erano bundle, e fra loro tutti i peggiori. "Pelle
  // sintetica Premium HQ - 3 pz" risultava sbagliata di 605 pezzi
  // perche' confrontavo scatole con pezzi sfusi.
  //
  // La formula e' copiata da `sincronizzaDisponibilitaBundle` apposta:
  // se misurassi con un conto diverso da quello che scrive il numero,
  // misurerei la differenza fra i miei due conti e non uno scarto vero.
  //
  // Un bundle CON giacenza fisica (una scatola che si compra e si vende
  // intera) e' un prodotto normale e resta fuori da qui.
  const daComporre = new Map<string, number>();
  const bundleVirtuali = (nostri || []).filter(
    (p) => p.tipo_prodotto === "bundle" && !p.bundle_con_giacenza_fisica,
  );
  if (bundleVirtuali.length) {
    const { data: componenti } = await admin
      .from("bundle_componenti").select("bundle_id, componente_id, quantita_per_bundle")
      .in("bundle_id", bundleVirtuali.map((p) => p.id));
    const idComponenti = [...new Set((componenti || []).map((c) => c.componente_id))];
    const { data: giacenzeComp } = idComponenti.length
      ? await admin.from("prodotti_shop").select("id, quantita").in("id", idComponenti)
      : { data: [] };
    const giacenzaDi = new Map((giacenzeComp || []).map((c) => [c.id, Number(c.quantita ?? 0)]));
    for (const b of bundleVirtuali) {
      const suoi = (componenti || []).filter((c) => c.bundle_id === b.id);
      if (!suoi.length) continue;   // senza distinta non si sa comporre niente: si lascia stare
      let possibili = Infinity;
      for (const c of suoi) {
        const per = Number(c.quantita_per_bundle) || 0;
        possibili = Math.min(possibili, per > 0 ? Math.floor((giacenzaDi.get(c.componente_id) ?? 0) / per) : 0);
      }
      if (Number.isFinite(possibili)) daComporre.set(b.id, possibili);
    }
  }

  // 2-ter. I PEZZI PROMESSI A UN CARRELLO SOSPESO NON SONO IN VENDITA.
  //
  // Quello che il sito puo' vendere non e' la giacenza: e' la giacenza
  // MENO i pezzi gia' impegnati in un carrello messo da parte al banco.
  // Lo fa `allineaShop` apposta, da quando il sito continuava a vendere
  // pezzi che il banco aveva gia' promesso a qualcuno.
  //
  // Confrontando la giacenza nuda risultavano scarti che non esistono —
  // e si riconoscevano dal fatto che tornavano a zero esatti sommando i
  // carrelli: "Borsa da lavoro" -3 con tre carrelli che ne avevano uno
  // ciascuno, "Pelle sintetica trico" -5 con un carrello da cinque.
  //
  // E' la terza volta in questa stessa funzione: la regola e' misurare
  // il numero che scrive chi scrive, non quello che sembra giusto.
  const promessi = new Map<string, number>();
  const { data: righeSospesi } = await admin
    .from("impostazioni_layout_tabelle").select("valore")
    .eq("chiave", "pos_carrelliSospesi").maybeSingle();
  for (const carrello of (righeSospesi?.valore as any[]) || []) {
    for (const r of carrello?.carrello || []) {
      const id = r?.prodottoId;
      const q = Number(r?.quantita) || 0;
      if (!id || !q) continue;
      promessi.set(id, (promessi.get(id) || 0) + q);
    }
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
    // per un bundle virtuale "qui" e' quanti se ne possono comporre;
    // e in ogni caso si tolgono i pezzi promessi a un carrello sospeso,
    // perche' quelli il sito non li deve vendere
    const inCasa = daComporre.has(p.id) ? (daComporre.get(p.id) as number) : Number(p.quantita ?? 0);
    const qui = Math.max(0, inCasa - (promessi.get(p.id) || 0));
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
    bundle_calcolati: daComporre.size,
    impegnati_in_carrelli: promessi.size,
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
