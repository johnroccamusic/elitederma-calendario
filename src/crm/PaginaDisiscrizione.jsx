// ?disiscrizione=<gettone>: la pagina che apre chi preme «Non voglio più
// ricevere queste mail» in fondo a una campagna. Rotta pubblica come le
// altre: esce prima del cancello, nessun account, un tocco e basta.
//
// Chiama crm_disiscrivi, security definer: scrive la data su tutte le
// schede con quell'indirizzo e torna solo il nome di battesimo e
// l'indirizzo mascherato. Si disiscrive APPENA la pagina si apre, senza
// un secondo tasto: chi arriva qui ha gia' deciso, e un passaggio in piu'
// serve solo a far cambiare idea a chi si e' distratto.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, CREAM_BORDER, BG, fontBody, fontDisplay } from "../ui/stile.js";

export default function PaginaDisiscrizione({ token }) {
  const [esito, setEsito] = useState(null); // { ok, gia, nome, email } | { ok: false, errore }
  useEffect(() => {
    let vivo = true;
    supabase.rpc("crm_disiscrivi", { p_token: token || "", p_come: "link" }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) setEsito({ ok: false, errore: error.message });
      else setEsito(data || { ok: false, errore: "risposta vuota" });
    });
    return () => { vivo = false; };
  }, [token]);

  const titolo = !esito ? "Un momento…"
    : !esito.ok ? "Questo link non funziona"
    : esito.gia ? "Eri già fuori dalla lista"
    : "Fatto";
  const testo = !esito ? "Sto registrando la tua richiesta."
    : !esito.ok ? "Il link che hai aperto non corrisponde a nessun contatto. Se vuoi smettere di ricevere le nostre mail, rispondi a una di quelle che hai ricevuto scrivendo «disiscrizione»."
    : esito.gia ? `${esito.nome ? esito.nome + ", " : ""}il tuo indirizzo${esito.email ? ` (${esito.email})` : ""} era già fuori dalla nostra lista. Non riceverai altre mail.`
    : `${esito.nome ? esito.nome + ", " : ""}non riceverai più le nostre mail${esito.email ? ` a ${esito.email}` : ""}. Se un giorno vorrai tornare a sentirci, basta scriverci.`;

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: NAVY }} data-titolo>{titolo}</div>
        <div style={{ ...fontBody, fontSize: 14.5, color: MUTED, lineHeight: 1.6, marginTop: 10 }} data-testo>{testo}</div>
        <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 22 }}>Elitederma Academy</div>
      </div>
    </div>
  );
}
