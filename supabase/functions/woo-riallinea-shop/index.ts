// Edge Function "woo-riallinea-shop"
// Spinge su WooCommerce la situazione VERA dell'app, in un colpo solo.
//
// PERCHE' SERVE. L'app e il sito si allineano a ogni movimento, ma solo
// per il prodotto toccato e solo se quel movimento passa da qui. Tutto il
// resto — una spunta cambiata a mano, una sincronizzazione che ha
// riportato indietro un numero dal sito, una scrittura fallita che nessuno
// ha visto — resta disallineato in silenzio, e lo si scopre quando una
// cliente compra una cosa che non c'e' o non trova una cosa che c'e'.
// E' successo con "Excellentia Siero ricrescita Ciglia - 1pz": spuntato
// "Non sullo shop" nell'app, eppure in vendita sul sito con 30 pezzi.
//
// COSA SPINGE, e in che direzione:
//   - i prodotti che DEVONO stare sullo shop (attivi, pubblicati, senza la
//     spunta "Non sullo shop") ricevono la quantita' dell'app;
//   - quelli che NON devono starci (spunta "Non sullo shop", oppure non
//     piu' attivi) e che sul sito risultano pubblicati passano a
//     "privato": spariscono dal negozio e dalla ricerca, restano visibili
//     a chi amministra, e il link diretto non vende piu'.
//
// COSA NON TOCCA, di proposito:
//   - lo stato di chi e' gia' in bozza o privato sul sito. Una bozza e'
//     una decisione presa li', e pubblicarla d'ufficio sarebbe peggio del
//     disallineamento che si vuole togliere.
//   - il prezzo: lo governa il listino, non questo tasto.
//
// I BUNDLE VIRTUALI non hanno giacenza propria, e il numero scritto nella
// loro riga non vuol dire niente. La disponibilita' si conta dai pezzi,
// come fa il banco: quanti bundle interi si riescono a comporre con i
// componenti che ci sono. Saltarli — come faceva la prima versione di
// questo file — li lasciava fermi a quello che il sito aveva: due
// risultavano "Esaurito" sullo shop mentre i pezzi per comporli erano in
// magazzino.
//   - il prezzo: lo governa il listino, non questo tasto.
//
// Variabili d'ambiente: WC_SITE_URL / WC_CONSUMER_KEY_WRITE /
// WC_CONSUMER_SECRET_WRITE (le stesse di woo-aggiorna-prodotto).
//
// Chiamata dall'app:
//   supabase.functions.invoke('woo-riallinea-shop')
//   supabase.functions.invoke('woo-riallinea-shop', { body: { prova: true } })
// con `prova: true` non scrive niente e dice solo cosa cambierebbe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { svuotaCacheSito } from "../_shared/cacheSito.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// WooCommerce accetta al massimo 100 modifiche per chiamata
const A_GRUPPI_DI = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { /* chiamata senza corpo: va bene */ }
  const prova = corpo?.prova === true;
  // dopo una vendita o un carrello sospeso non serve rifare tutto il
  // catalogo: si passano gli id toccati e il giro dura un attimo
  const soloQuesti = Array.isArray(corpo?.prodottiIds) ? new Set(corpo.prodottiIds as string[]) : null;

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const key = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const secret = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !key || !secret) return json({ errore: "Configurazione WooCommerce (scrittura) mancante" }, 500);
  const auth = "Basic " + btoa(`${key}:${secret}`);

  // I PEZZI PROMESSI. Un prodotto dentro a un carrello sospeso e' gia' di
  // qualcuno: al banco non si rivende (lo impedisce "riservatiAltrove"),
  // ma il sito non ne sapeva niente e continuava a venderlo. La giacenza
  // dell'app resta quella vera — i pezzi sono ancora in scatola — e si
  // toglie solo da quello che si dichiara disponibile online.
  const { data: rigaSospesi } = await supabase
    .from("impostazioni_layout_tabelle").select("valore").eq("chiave", "pos_carrelliSospesi").maybeSingle();
  const promessi: Record<string, number> = {};
  const sospesi = Array.isArray(rigaSospesi?.valore) ? rigaSospesi.valore : [];
  for (const carrello of sospesi) {
    for (const riga of (carrello?.carrello || [])) {
      const id = riga?.prodottoId;
      const q = Number(riga?.quantita) || 0;
      if (id && q > 0) promessi[id] = (promessi[id] || 0) + q;
    }
  }

  const { data: distinta } = await supabase
    .from("bundle_componenti").select("bundle_id, componente_id, quantita_per_bundle");
  const componentiDi: Record<string, { id: string; per: number }[]> = {};
  for (const r of distinta || []) {
    const per = Number(r.quantita_per_bundle) || 0;
    if (!r.bundle_id || !r.componente_id || per <= 0) continue;
    (componentiDi[r.bundle_id] ||= []).push({ id: r.componente_id, per });
  }

  const { data: prodotti, error } = await supabase
    .from("prodotti_shop")
    // TUTTI, anche quelli fuori dallo shop: un componente senza id su
    // WooCommerce non si pubblica, ma i suoi pezzi contano lo stesso per
    // il bundle che lo contiene. Chi non ha l'id si salta nel giro sotto.
    .select("id, nome, woo_product_id, stato, attivo, solo_offline, quantita, tipo_prodotto, bundle_con_giacenza_fisica");
  if (error) return json({ errore: "Lettura prodotti: " + error.message }, 500);

  const perIdProdotto: Record<string, { quantita: unknown }> = {};
  for (const p of prodotti || []) perIdProdotto[p.id as string] = p as { quantita: unknown };

  const daAggiornare: Record<string, unknown>[] = [];
  const nascosti: { id: string; nome: string; woo: number }[] = [];
  const giacenze: { nome: string; woo: number; quantita: number; in_casa: number; promessi: number }[] = [];
  const saltati: { nome: string; perche: string }[] = [];

  for (const p of prodotti || []) {
    if (soloQuesti && !soloQuesti.has(p.id)) continue;
    if (p.woo_product_id == null) continue; // non sta sul sito: niente da allineare
    const woo = Number(p.woo_product_id);
    const fuoriCatalogo = p.solo_offline === true || p.attivo === false;

    if (fuoriCatalogo) {
      // solo chi sul sito risulta ancora pubblicato: sugli altri non c'e'
      // niente da cambiare, e una scrittura inutile e' solo un rischio
      if (p.stato === "publish") {
        daAggiornare.push({ id: woo, status: "private" });
        nascosti.push({ id: p.id, nome: p.nome, woo });
      }
      continue;
    }

    if (p.stato !== "publish") { saltati.push({ nome: p.nome, perche: `sul sito e' "${p.stato}"` }); continue; }

    const virtuale = p.tipo_prodotto === "bundle" && !p.bundle_con_giacenza_fisica;
    let quantita: number;
    if (virtuale) {
      const pezzi = componentiDi[p.id] || [];
      if (pezzi.length === 0) { saltati.push({ nome: p.nome, perche: "bundle senza distinta" }); continue; }
      // quanti se ne compongono: lo decide il componente che finisce
      // prima, con i suoi pezzi gia' al netto di quelli promessi
      let interi = Infinity;
      let mancante = "";
      for (const c of pezzi) {
        const comp = perIdProdotto[c.id];
        const in_casa = Number(comp?.quantita);
        if (!comp || !Number.isFinite(in_casa)) { interi = NaN; mancante = c.id; break; }
        const liberi = Math.max(0, in_casa - (promessi[c.id] || 0));
        interi = Math.min(interi, Math.floor(liberi / c.per));
      }
      if (!Number.isFinite(interi)) { saltati.push({ nome: p.nome, perche: `componente senza giacenza (${mancante})` }); continue; }
      quantita = interi;
    } else {
      const in_casa = Number(p.quantita);
      if (!Number.isFinite(in_casa)) { saltati.push({ nome: p.nome, perche: "giacenza non scritta" }); continue; }
      quantita = in_casa;
    }

    // quello che il sito puo' davvero vendere: i pezzi in casa meno
    // quelli gia' promessi in un carrello sospeso. Mai sotto zero.
    // Su un bundle i promessi sono gia' stati tolti ai componenti.
    const impegnati = virtuale ? 0 : (promessi[p.id] || 0);
    const disponibile = Math.max(0, quantita - impegnati);

    // solo la quantita', esattamente come fa woo-aggiorna-prodotto a ogni
    // movimento: toccare anche manage_stock o stock_status vorrebbe dire
    // cambiare il modo in cui il sito gestisce quel prodotto, e questo
    // tasto serve ad allineare un numero, non a riconfigurare il negozio.
    // Il back order, per dire, vive proprio li' sopra.
    daAggiornare.push({ id: woo, stock_quantity: disponibile });
    giacenze.push({ nome: p.nome, woo, quantita: disponibile, in_casa: quantita, promessi: impegnati });
  }

  if (prova) {
    return json({ prova: true, da_nascondere: nascosti.length, giacenze_da_spingere: giacenze.length,
      saltati: saltati.length, nascosti, saltati,
      impegnati_in_sospesi: giacenze.filter((g) => g.promessi > 0) });
  }

  let scritti = 0;
  const falliti: string[] = [];
  const riusciti = new Set<number>();
  // Il nome, non il numero. WooCommerce risponde con il suo id — "prodotto
  // 672: ID non valido" — e quel numero in magazzino non lo conosce
  // nessuno: per sapere chi fosse bisognava cercarlo a mano nel database.
  const nomePerWoo = new Map<number, string>();
  for (const g of giacenze) nomePerWoo.set(g.woo, g.nome);
  for (const n of nascosti) nomePerWoo.set(n.woo, n.nome);
  const chiE = (id: number) => `${nomePerWoo.get(Number(id)) || "prodotto sconosciuto"} (id ${id})`;
  for (let i = 0; i < daAggiornare.length; i += A_GRUPPI_DI) {
    const gruppo = daAggiornare.slice(i, i + A_GRUPPI_DI);
    const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/products/batch`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ update: gruppo }),
    });
    if (!risposta.ok) {
      falliti.push(`${gruppo.map((r) => chiE(Number(r.id))).join(", ")}: WooCommerce ha risposto ${risposta.status}`);
      continue;
    }
    const esito = await risposta.json();
    for (const riga of esito?.update || []) {
      if (riga?.error) falliti.push(`${chiE(Number(riga.id))}: ${riga.error.message}`);
      else { scritti += 1; riusciti.add(Number(riga.id)); }
    }
  }

  // Lo stato locale segue solo DOPO la conferma del sito, e PRODOTTO PER
  // PRODOTTO: un id che su WooCommerce non esiste piu' fa fallire la sua
  // riga e basta. Guardando solo "nessun errore in tutto il gruppo", un
  // prodotto cancellato dal sito mesi fa avrebbe impedito di registrare
  // il cambiamento di tutti gli altri.
  const nascostiDavvero = nascosti.filter((n) => riusciti.has(n.woo));
  if (nascostiDavvero.length) {
    await supabase.from("prodotti_shop").update({ stato: "private" }).in("id", nascostiDavvero.map((n) => n.id));
  }

  // La cache. Svuotare le pagine UNA PER UNA non basta quando si e'
  // toccato tutto il catalogo: Breeze svuota la sua, ma Cloudflare ha
  // continuato a servire una copia vecchia di oltre un'ora, e sulla
  // pagina dell'espositore si leggeva "Esaurito" mentre WooCommerce
  // diceva gia' "Disponibile". Su un giro completo si svuota tutto, che
  // e' l'unica strada che risulta arrivare anche a Cloudflare; su un giro
  // mirato — dopo una vendita, dopo un carrello sospeso — restano le
  // singole pagine, che e' giusto e costa molto meno.
  const avvisoCache = riusciti.size
    ? await svuotaCacheSito(soloQuesti ? { prodottiWooIds: [...riusciti] } : { tutto: true })
    : null;

  return json({
    ok: falliti.length === 0,
    scritti, nascosti: nascostiDavvero.length, giacenze: giacenze.length, saltati: saltati.length,
    dettaglio_nascosti: nascostiDavvero.map((n) => n.nome),
    falliti, avviso_cache: avvisoCache,
  });
});
