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

const VUOTO = { punti_shop_pos: 0, punti_cash: 0, punti_evento_pos: 0, punti_evento_cash: 0, punti_personali: 0, punti_carriera: 0, punti_totali: 0, vendite: 0, pezzi: 0 };

export function usePuntiMaster(masterId) {
  const [dati, setDati] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!masterId) { setDati(null); return undefined; }
    // un'assistente sfogliata dalla dashboard arriva come «ass:<id>»: non
    // e' una master e non ha punti suoi. Chiedere alla vista con quell'id
    // era una richiesta rifiutata (400) a ogni apertura — trovata nei log
    // il 28/10/2026 — e la scheda mostrava gli zeri per il motivo sbagliato
    if (String(masterId).startsWith("ass:")) { setDati(VUOTO); return undefined; }
    (async () => {
      const { data, error } = await supabase
        .from("v_punti_master")
        .select("punti_shop_pos, punti_cash, punti_evento_pos, punti_evento_cash, punti_personali, punti_carriera, punti_totali, vendite, pezzi")
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

// I CARRELLI UNO PER UNO.
// I riquadri dicono quanti punti in totale; questo dice da dove sono
// usciti. Si legge da v_punti_master_righe, che ha una riga per
// prodotto venduto: qui si raggruppa per vendita, perche' la domanda e'
// "quali carrelli", non "quali prodotti".
//
// Stessa fonte dei riquadri, quindi i due numeri non possono
// discordare: la somma dei punti dei carrelli e' il totale delle schede.
export function useCarrelliPuntiMaster(masterId, attivo) {
  const [righe, setRighe] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!masterId || !attivo) { setRighe(null); return undefined; }
    if (String(masterId).startsWith("ass:")) { setRighe([]); return undefined; }
    (async () => {
      const { data, error } = await supabase
        .from("v_punti_master_righe")
        .select("vendita_id, numero_ordine, data_ordine, origine, metodo_pagamento, codice_coupon, prodotto, quantita, punti, e_cash, e_evento, totale_vendita, netto_allora")
        .eq("master_id", masterId)
        .order("data_ordine", { ascending: false })
        .limit(2000);
      if (!vivo) return;
      if (error) { setRighe([]); return; }
      // una riga per carrello: i prodotti si sommano dentro
      const perVendita = new Map();
      (data || []).forEach((r) => {
        const chiave = r.vendita_id;
        const gia = perVendita.get(chiave);
        if (gia) {
          gia.punti += Number(r.punti) || 0;
          gia.pezzi += Number(r.quantita) || 0;
          gia.prodotti.push(r.prodotto);
        } else {
          perVendita.set(chiave, {
            venditaId: chiave,
            numero: r.numero_ordine,
            data: r.data_ordine,
            origine: r.origine,
            metodo: r.metodo_pagamento,
            coupon: r.codice_coupon,
            cash: !!r.e_cash,
            evento: !!r.e_evento,
            totale: Number(r.totale_vendita) || 0,
            punti: Number(r.punti) || 0,
            pezzi: Number(r.quantita) || 0,
            prodotti: [r.prodotto],
          });
        }
      });
      setRighe([...perVendita.values()].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))));
    })();
    return () => { vivo = false; };
  }, [masterId, attivo]);

  return righe;
}

export default usePuntiMaster;
