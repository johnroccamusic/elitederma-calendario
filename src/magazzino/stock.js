// L'unico posto da cui l'app scrive una giacenza.
//
// Stava dentro App.jsx, e li' andava bene finche' a muovere lo stock era
// soltanto App.jsx. Dal momento in cui anche il materiale degli eventi
// esce e rientra dal magazzino serviva da fuori, e la scelta era fra
// duplicare queste trenta righe o metterle dove le vedono tutti. Mai
// duplicarle: due punti che scrivono la stessa giacenza, prima o poi,
// scrivono due numeri diversi.
import { supabase } from "../supabase.js";

// Rimette in pari WooCommerce su alcuni prodotti: quello che il sito puo'
// vendere non e' la giacenza, e' la giacenza MENO i pezzi gia' promessi in
// un carrello sospeso. Il banco quei pezzi non li rivende da sempre; il
// sito non ne sapeva niente e continuava a venderli.
//
// Si chiama dopo ogni cosa che cambia l'una o gli altri: una vendita, un
// carrello messo da parte, uno ripreso o buttato. Non blocca chi la
// chiama e non fa fallire niente — se il sito non risponde, il tasto
// "Aggiorna lo shop" in Gestione magazzino rimette tutto in pari.
export async function allineaShop(prodottiIds) {
  const ids = [...new Set((prodottiIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const { data, error } = await supabase.functions.invoke("woo-riallinea-shop", { body: { prodottiIds: ids } });
    if (error || data?.errore) console.error("Riallineamento shop non riuscito:", data?.errore || error?.message);
  } catch (e) {
    console.error("Riallineamento shop non riuscito:", e?.message || e);
  }
}
export function pubblicatoSuShop(p) {
  // "privato" su WooCommerce vuol dire che il prodotto esiste sul sito ma
  // lo vede solo chi è dentro come amministratore: per il cliente non è in
  // vendita, esattamente come una bozza
  return !!p?.woo_product_id && p?.stato === "publish" && !p?.solo_offline;
}
// UNICO punto dell'app che scrive lo stock. Rilegge il valore vero prima
// di applicare il delta (non si fida di quello in memoria, che può essere
// vecchio di minuti), non scende mai sotto zero — il controllo sta qui,
// non nella validazione di un form, così vale per tutti i chiamanti —
// registra il movimento nello storico e riallinea WooCommerce quando il
// prodotto è pubblicato
export async function muoviStock(prodotto, delta, { origine, nota = null, riferimento = null, utente = null, collegatoProdottoId = null } = {}) {
  if (!prodotto?.id || !delta) return null;
  const { data: attuale, error: erroreLettura } = await supabase
    .from("prodotti_shop").select("id, nome, quantita, woo_product_id, stato, solo_offline").eq("id", prodotto.id).maybeSingle();
  if (erroreLettura || !attuale) return `"${prodotto.nome}": non riesco a leggere la giacenza — ${erroreLettura?.message || "prodotto non trovato"}`;
  const disponibile = attuale.quantita || 0;
  if (delta < 0 && disponibile + delta < 0) {
    return `"${attuale.nome}": ci sono ${disponibile} pezzi, non posso scaricarne ${-delta}.`;
  }
  const nuova = disponibile + delta;
  if (pubblicatoSuShop(attuale)) {
    // WooCommerce è lo specchio, non la fonte: si scrive prima lì e solo
    // se accetta si aggiorna il dato locale (dentro la stessa chiamata)
    const { data, error } = await supabase.functions.invoke("woo-aggiorna-prodotto", { body: { prodottoId: prodotto.id, quantita: nuova } });
    if (error || data?.errore) return `"${attuale.nome}": aggiornamento su WooCommerce non riuscito — ${data?.errore || error.message}`;
  } else {
    const { error } = await supabase.from("prodotti_shop").update({ quantita: nuova }).eq("id", prodotto.id);
    if (error) return `"${attuale.nome}": errore nello scarico — ${error.message}`;
  }
  await supabase.from("movimenti_magazzino").insert({
    prodotto_id: prodotto.id, delta, origine, nota, riferimento, utente, collegato_prodotto_id: collegatoProdottoId,
  });
  return null;
}
