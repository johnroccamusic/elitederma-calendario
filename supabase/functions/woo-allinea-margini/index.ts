// Edge Function "woo-allinea-margini"
//
// Scrive su OGNI prodotto di WooCommerce quanto rende, in percentuale,
// in un campo nascosto: `_ed_margine_pct`. E accanto, dall'08/10/2026,
// quanti euro di quel pezzo si possono cedere (`_ed_cedibile_eur`) e in
// quale reparto del listino sta (`_ed_blocco`): sono i due numeri su cui
// si regge il listino delle master.
//
// Serve allo sconto a fasce. Un coupon di WooCommerce ha una percentuale
// sola per tutto il carrello: non sa scontare il 5% su un prodotto e il
// 15% su quello accanto, perche' non sa quanto costano. Con questo campo
// lo sa — e il frammento installato sul sito (wordpress/elitederma-sconto-fasce.php)
// puo' scegliere la fascia giusta riga per riga, esattamente come fa il POS.
//
// Il margine, non la percentuale di sconto: cosi' questo campo vale per
// TUTTI i coupon a fasce, presenti e futuri, e cambiare le fasce non
// obbliga a riscrivere duecento prodotti. Le fasce viaggiano sul coupon.
//
// Un prodotto senza costo di acquisto non ha margine noto: si scrive il
// campo vuoto, e sul sito non prendera' sconto — la stessa regola del POS.
//
// Variabili d'ambiente: WC_SITE_URL / WC_CONSUMER_KEY_WRITE / WC_CONSUMER_SECRET_WRITE

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  const siteUrl = Deno.env.get("WC_SITE_URL");
  const key = Deno.env.get("WC_CONSUMER_KEY_WRITE");
  const secret = Deno.env.get("WC_CONSUMER_SECRET_WRITE");
  if (!siteUrl || !key || !secret) return json({ errore: "Configurazione WooCommerce (scrittura) mancante" }, 500);

  // Il listino: da li' arrivano lo sconto massimo di ogni prodotto e il
  // reparto a cui appartiene. Sono i due numeri che servono al listino
  // delle master, e vengono dalla view perche' la' dentro c'e' gia'
  // tutto — riduzioni di reparto comprese — e una seconda formula qui
  // comincerebbe a divergere dal giorno dopo.
  const { data: listino } = await supabase
    .from("v_prezzi_listini")
    .select("id, blocco_ordine, pubblico_netto, sconto_max_pct");
  const perId: Record<string, any> = {};
  (listino || []).forEach((r: any) => { perId[r.id] = r; });

  // IL CEDIBILE DEL LISTINO RIVENDITORI (19/11/2026), che e' UNA COSA
  // SOLA: `_ed_cedibile_riv_pct`, quanto quel pezzo puo' cedere in
  // percento. Lo legge lo snippet dello sconto progressivo, per i
  // coupon sopra la soglia.
  //
  // `_ed_cedibile_eur` NON viene da qui: resta sulla scala vecchia
  // (`v_prezzi_listini`), perche' e' il numero su cui una master sconta
  // comprando per se'. Per qualche ora erano stati uniti, e la misura
  // dice perche' si e' tornati indietro: sul catalogo intero lo sconto
  // di una master passava da 1.007,47 a 1.385,25 euro, +377,78. Non era
  // stato chiesto. Il titolare, la sera stessa: «i codici delle master
  // fanno riferimento ad un altro trattamento, in seguito passeranno ad
  // acquisire la qualifica di rivenditore».
  //
  // Le due scale non coincidono su nessuno dei 187 prodotti dello shop
  // — cedibile medio 29,2% contro 40,8% — quindi tenerle separate non e'
  // pignoleria: e' la differenza fra lo sconto di una master e quello di
  // un rivenditore, che sono due cose.
  const { data: cedibili } = await supabase.rpc("coupon_cedibili");
  const rivPerId: Record<string, any> = {};
  (cedibili || []).forEach((r: any) => { rivPerId[r.prodotto_id] = r; });

  const { data: prodotti, error } = await supabase
    .from("prodotti_shop")
    .select("id, nome, woo_product_id, prezzo_vendita, costo_acquisto")
    .not("woo_product_id", "is", null)
    // I ritirati restano fuori: il loro id su WooCommerce non esiste
    // piu', e ogni allineamento tornava con "ID non valido" su righe che
    // non si potevano sistemare. Tre errori fissi a ogni giro insegnano
    // solo a non leggere piu' il messaggio.
    .not("attivo", "is", false);
  if (error) return json({ errore: "Lettura prodotti: " + error.message }, 500);

  const aggiornamenti = (prodotti || []).map((p: any) => {
    const netto = Number(p.prezzo_vendita);
    const costo = p.costo_acquisto;
    // stringa vuota e non "0": zero vorrebbe dire "non ci guadagno
    // niente", vuoto vuol dire "non si sa", e sono due cose diverse
    const noto = netto > 0 && costo != null && costo !== "";
    const margine = noto ? String(Math.round(((netto - Number(costo)) / netto) * 10000) / 100) : "";
    // anche in euro, netti, per pezzo: serve ai coupon "sul margine",
    // dove lo sconto e' una percentuale di QUESTI euro e non del prezzo.
    // Ricavarli dal prezzo in carrello vorrebbe dire sapere l'aliquota
    // riga per riga; scritti qui, il sito non deve calcolare niente.
    const margineEuro = noto ? String(Math.round((netto - Number(costo)) * 100) / 100) : "";
    // Per il listino delle master: quanti euro di questo pezzo si
    // POSSONO cedere, e in quale reparto sta.
    //
    // Si scrive il cedibile, non lo sconto della master, per la stessa
    // ragione per cui sopra si scrive il margine e non la fascia:
    // cambiare la quota non deve obbligare a riscrivere trecento
    // prodotti. La quota viaggia sul coupon, e il reparto serve al sito
    // per sapere quale quota applicare quando un reparto ha la sua.
    const l = perId[p.id];
    // Il cedibile in percento, dal LISTINO RIVENDITORI: e' la legge
    // dello sconto dei coupon dal 19/11/2026. Vuoto e non "0" quando il
    // prodotto non sta nel listino — vuoto vuol dire «non si sa» e il
    // sito non sconta, zero vorrebbe dire «si sa che e' zero»: qui le
    // due cose portano allo stesso sconto, ma non allo stesso motivo.
    const riv = rivPerId[p.id];
    const cedibileRivPct = riv?.cedibile_pct != null ? String(Number(riv.cedibile_pct)) : "";
    // gli euro cedibili del codice master: dalla scala VECCHIA, come
    // prima del 19/11. Vedi il perche' qui sopra.
    const cedibilePct = l?.sconto_max_pct;
    const nettoListino = Number(l?.pubblico_netto);
    const cedibileEuro = cedibilePct != null && nettoListino > 0
      ? String(Math.round(nettoListino * Number(cedibilePct)) / 100) : "";
    return {
      id: p.woo_product_id,
      meta_data: [
        { key: "_ed_margine_pct", value: margine },
        { key: "_ed_margine_eur", value: margineEuro },
        { key: "_ed_cedibile_riv_pct", value: cedibileRivPct },
        { key: "_ed_cedibile_eur", value: cedibileEuro },
        // il NUMERO del reparto e non il nome: la quota per reparto del
        // codice master si cerca con quello (`listino_master_quota` ha
        // per chiavi 1..12 e 99). Col nome avrebbe sempre ricaduto sulla
        // quota generale, in silenzio e su tutti i reparti.
        { key: "_ed_blocco", value: l?.blocco_ordine != null ? String(l.blocco_ordine) : "" },
      ],
    };
  });

  const auth = "Basic " + btoa(`${key}:${secret}`);
  let scritti = 0;
  const errori: string[] = [];
  // a blocchi di cento: e' il massimo che l'endpoint batch di WooCommerce
  // accetta per chiamata
  for (let i = 0; i < aggiornamenti.length; i += 100) {
    const blocco = aggiornamenti.slice(i, i + 100);
    const risposta = await fetch(`${siteUrl}/wp-json/wc/v3/products/batch`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ update: blocco }),
    });
    if (!risposta.ok) {
      errori.push(`blocco ${i / 100 + 1}: ${risposta.status} ${(await risposta.text()).slice(0, 200)}`);
      continue;
    }
    const esito = await risposta.json();
    scritti += (esito?.update || []).filter((x: any) => !x?.error).length;
    (esito?.update || []).filter((x: any) => x?.error).forEach((x: any) => errori.push(`prodotto ${x.id}: ${x.error?.message}`));
  }

  return json({
    ok: errori.length === 0,
    prodotti: aggiornamenti.length,
    scritti,
    senzaCosto: aggiornamenti.filter((a) => a.meta_data[0].value === "").length,
    errori: errori.slice(0, 10),
  });
});
