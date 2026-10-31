// ?disiscrizione=<gettone>: la pagina che apre chi preme «Non voglio più
// ricevere queste mail» in fondo a una campagna. Rotta pubblica come le
// altre: esce prima del cancello, nessun account, un tocco e basta.
//
// Chiama crm_disiscrivi, security definer: scrive la data su tutte le
// schede con quell'indirizzo e torna solo il nome di battesimo e
// l'indirizzo mascherato. Si disiscrive SOLO premendo il tasto (31/10/2026):
// prima scattava all'apertura, ma i programmi di posta e gli antivirus
// aprono i link da soli per controllarli, e cosi' disiscrivevano persone
// che non avevano deciso niente. Il tasto di Gmail e Mail (one-click) non
// passa di qui: fa una POST alla funzione crm-disiscrivi.
import React, { useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, CREAM_BORDER, BG, fontBody, fontDisplay } from "../ui/stile.js";

export default function PaginaDisiscrizione({ token }) {
  const [esito, setEsito] = useState(null); // { ok, gia, nome, email } | { ok: false, errore }
  const [invio, setInvio] = useState(false);
  function conferma() {
    setInvio(true);
    supabase.rpc("crm_disiscrivi", { p_token: token || "", p_come: "link" }).then(({ data, error }) => {
      if (error) setEsito({ ok: false, errore: error.message });
      else setEsito(data || { ok: false, errore: "risposta vuota" });
    });
  }

  const titolo = !esito ? (invio ? "Un momento…" : "Non vuoi più ricevere le nostre mail?")
    : !esito.ok ? "Questo link non funziona"
    : esito.gia ? "Eri già fuori dalla lista"
    : "Fatto";
  const testo = !esito ? (invio ? "Sto registrando la tua richiesta." : "Premi il tasto qui sotto e non ti scriveremo più.")
    : !esito.ok ? "Il link che hai aperto non corrisponde a nessun contatto. Se vuoi smettere di ricevere le nostre mail, rispondi a una di quelle che hai ricevuto scrivendo «disiscrizione»."
    : esito.gia ? `${esito.nome ? esito.nome + ", " : ""}il tuo indirizzo${esito.email ? ` (${esito.email})` : ""} era già fuori dalla nostra lista. Non riceverai altre mail.`
    : `${esito.nome ? esito.nome + ", " : ""}non riceverai più le nostre mail${esito.email ? ` a ${esito.email}` : ""}. Se un giorno vorrai tornare a sentirci, basta scriverci.`;

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }} data-titolo>{titolo}</div>
        <div style={{ ...fontBody, fontSize: 14.5, color: MUTED, lineHeight: 1.6, marginTop: 10 }} data-testo>{testo}</div>
        {!esito && !invio && (
          <button type="button" data-conferma onClick={conferma}
            style={{ ...fontBody, marginTop: 18, background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
            Sì, disiscrivimi
          </button>
        )}
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 22 }}>Elitederma Academy</div>
      </div>
    </div>
  );
}
