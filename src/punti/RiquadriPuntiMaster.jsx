// I punti di una master, dalle vendite che le sono attribuite.
//
// Si dividono per COME SONO STATE PAGATE, non per dove sono passate:
//
//   PUNTI SHOP/POS  shop online, bancomat, carta, link Stripe
//                   base: il prezzo NETTO del giorno della vendita
//   PUNTI CASH      contanti e buono Amazon dal POS
//                   base: il prezzo LORDO, perche' senza fattura l'IVA
//                   non si scorpora e quello che entra e' il prezzo intero
//   PUNTI PERSONALI quello che la master ha comprato per se' col suo
//                   codice di acquisto. Non e' una vendita: non matura
//                   compensi, conta solo nella carriera
//   PUNTI CARRIERA  la somma dei tre: quanto ha mosso in tutto
//
// La formula e' quella del listino privato: prezzo x sconto massimo x 2,
// col prezzo del giorno della vendita letto dalla riga dell'ordine. Il
// conto vive nella view v_punti_master: non c'e' niente da ricalcolare,
// cambia un costo e i punti si muovono da soli.
//
// E' un hook e non un componente perche' le due schede stanno nella
// stessa griglia delle altre della dashboard: una griglia non si divide
// fra due componenti senza che le colonne smettano di essere uguali.
import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

const VUOTO = { punti_shop_pos: 0, punti_cash: 0, punti_personali: 0, punti_carriera: 0, punti_totali: 0, vendite: 0, pezzi: 0 };

export function usePuntiMaster(masterId) {
  const [dati, setDati] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!masterId) { setDati(null); return undefined; }
    (async () => {
      const { data, error } = await supabase
        .from("v_punti_master")
        .select("punti_shop_pos, punti_cash, punti_personali, punti_carriera, punti_totali, vendite, pezzi")
        .eq("master_id", masterId)
        .maybeSingle();
      if (!vivo) return;
      // nessuna riga = nessuna vendita attribuita: due zeri, non il vuoto.
      // Una scheda che sparisce sembra un guasto
      setDati(error ? VUOTO : (data || VUOTO));
    })();
    return () => { vivo = false; };
  }, [masterId]);

  return dati;
}

export default usePuntiMaster;
