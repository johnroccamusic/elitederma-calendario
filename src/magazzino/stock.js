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
// UNICO punto dell'app che scrive lo stock, per UN prodotto. Dal 31/10/2026
// e' un caso particolare di muoviStockInBlocco: la lettura, il controllo
// «mai sotto zero», la scrittura e il movimento stanno in una transazione
// del database (stock_muovi), non piu' in tre passaggi dal browser — due
// persone sullo stesso prodotto non si perdono piu' un movimento. Il sito
// WooCommerce si riallinea dopo, non prima: il valore che fa fede e' quello
// dell'app.
export async function muoviStock(prodotto, delta, { origine, nota = null, riferimento = null, utente = null, collegatoProdottoId = null } = {}) {
  if (!prodotto?.id || !delta) return null;
  return muoviStockInBlocco([{ prodotto, delta, collegatoProdottoId }], { origine, nota, riferimento, utente });
}

// Un'operazione su PIU' prodotti, tutta insieme o per niente (31/10/2026).
// Chiama `stock_muovi`, che nel database blocca i prodotti, rifiuta
// l'intero blocco se uno solo scenderebbe sotto zero e scrive giacenze e
// movimenti nella stessa transazione. Prima un reso di otto righe si poteva
// fermare alla terza e un secondo tentativo rimetteva a posto le prime due
// una seconda volta.
//
// `righe`: [{ prodotto, delta, collegatoProdottoId?, nota?, riferimento? }]
// (nota e riferimento di riga prevalgono su quelli del blocco). Restituisce null se
// e' andata bene, altrimenti la frase da mostrare — stessa convenzione di
// muoviStock. WooCommerce si riallinea DOPO il commit, senza bloccare e
// senza far fallire niente: il giro notturno e il tasto «Aggiorna lo shop»
// coprono un sito che non risponde.
export async function muoviStockInBlocco(righe, { origine, nota = null, riferimento = null, utente = null } = {}) {
  const valide = (righe || []).filter((r) => r?.prodotto?.id && r.delta);
  if (valide.length === 0) return null;
  const { data, error } = await supabase.rpc("stock_muovi", {
    p_righe: valide.map((r) => ({
      prodotto_id: r.prodotto.id, delta: r.delta,
      ...(r.collegatoProdottoId ? { collegato_prodotto_id: r.collegatoProdottoId } : {}),
      ...(r.nota ? { nota: r.nota } : {}),
      ...(r.riferimento ? { riferimento: r.riferimento } : {}),
    })),
    p_origine: origine, p_nota: nota, p_riferimento: riferimento, p_utente: utente,
  });
  if (error) return `Magazzino non aggiornato, nessun prodotto e' stato toccato: ${error.message}`;
  if (!data?.ok) {
    if (data?.motivo === "insufficiente") {
      return (data.prodotti || []).map((p) => `"${p.nome}": ci sono ${p.disponibili} pezzi, non posso scaricarne ${p.richiesti}.`).join("\n")
        + "\nNessun prodotto e' stato toccato.";
    }
    return `Magazzino non aggiornato, nessun prodotto e' stato toccato: ${data?.errore || data?.motivo || "risposta vuota"}`;
  }
  allineaShop(valide.filter((r) => r.prodotto.woo_product_id).map((r) => r.prodotto.id));
  return null;
}
