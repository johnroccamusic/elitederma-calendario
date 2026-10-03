// I due riquadri dei punti nella dashboard di una master.
//
// I punti nascono dalle vendite che le sono attribuite — quelle battute
// dal suo POS e quelle fatte online con il suo codice — e si dividono per
// COME SONO STATE PAGATE, non per dove sono passate:
//
//   PUNTI SHOP/POS  shop online, bancomat, carta, link Stripe
//                   base: il prezzo NETTO del giorno della vendita
//   PUNTI CASH      contanti e buono Amazon dal POS
//                   base: il prezzo LORDO, perche' senza fattura l'IVA
//                   non si scorpora e quello che entra e' il prezzo intero
//
// La formula e' quella del listino privato: prezzo x sconto massimo x 2.
// Il prezzo e' quello del giorno della vendita, letto dalla riga
// dell'ordine: un pigmento venduto a 39,90 vale i punti di 39,90 anche se
// oggi sta a 44,90. Il conto vive nella view v_punti_master, quindi non
// c'e' niente da ricalcolare: cambia un costo, cambia lo sconto massimo,
// e i punti si muovono da soli.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, GOLD, MUTED, CREAM_BORDER, fontBody, fontDisplay } from "../ui/stile.js";

const fmtPunti = (n) =>
  (n == null ? "0,00" : Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function RiquadriPuntiMaster({ masterId, isMobile = false }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!masterId) { setDati(null); return undefined; }
    (async () => {
      const { data, error } = await supabase
        .from("v_punti_master")
        .select("punti_shop_pos, punti_cash, punti_totali, vendite, pezzi")
        .eq("master_id", masterId)
        .maybeSingle();
      if (!vivo) return;
      if (error) { setErrore(error.message); return; }
      // nessuna riga = nessuna vendita attribuita: si mostrano due zeri,
      // non il vuoto. Un riquadro che sparisce sembra un guasto
      setDati(data || { punti_shop_pos: 0, punti_cash: 0, punti_totali: 0, vendite: 0, pezzi: 0 });
    })();
    return () => { vivo = false; };
  }, [masterId]);

  if (!masterId || errore) return null;

  const scheda = (etichetta, valore, sotto, colore, sfondo, bordo) => (
    <div style={{
      flex: "1 1 220px", minWidth: 0, background: sfondo, border: `1px solid ${bordo}`,
      borderRadius: 18, padding: isMobile ? "14px 14px" : "18px 20px",
    }}>
      <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {etichetta}
      </div>
      <div style={{ ...fontDisplay, fontSize: isMobile ? 30 : 38, fontWeight: 800, color: colore, lineHeight: 1.05, marginTop: 6 }}>
        {dati ? fmtPunti(valore) : "…"}
      </div>
      <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{sotto}</div>
    </div>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {scheda("Punti shop/POS", dati?.punti_shop_pos,
          "Shop online, bancomat, carta e link Stripe", NAVY, "#EEF3FA", "#D7E2F0")}
        {scheda("Punti cash", dati?.punti_cash,
          "Contanti e buono Amazon dal POS", "#8A6D1D", "#FDF8EC", "#EBD9AE")}
      </div>
      {dati && (dati.vendite > 0) && (
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
          In tutto <b style={{ color: NAVY }}>{fmtPunti(dati.punti_totali)}</b> punti
          su {dati.vendite} vendite e {dati.pezzi} pezzi. I punti si calcolano sul prezzo del
          giorno della vendita, quindi non cambiano se un prodotto aumenta dopo.
        </div>
      )}
    </div>
  );
}
