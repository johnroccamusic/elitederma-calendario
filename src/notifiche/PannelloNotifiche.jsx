// La striscia "Notifiche" nella dashboard master: dice com'e' messo
// QUESTO telefono e lascia accendere o spegnere gli avvisi.
//
// Dice lo stato per esteso invece di un interruttore solo, perche' i
// modi di non ricevere niente sono tre e portano a tre rimedi diversi:
// l'app non e' sulla Home (iPhone), il permesso e' stato negato (si
// riapre dalle impostazioni del telefono), oppure semplicemente non si
// e' ancora premuto il tasto. Un interruttore spento che non spiega
// quale dei tre e' il caso manda la persona a chiedere a noi.
import React, { useEffect, useState } from "react";
import { NAVY, MUTED, CREAM_BORDER, BG, fontBody } from "../ui/stile.js";
import { supabase } from "../supabase.js";
import { statoNotifiche, attivaNotifiche, disattivaNotifiche, pushSupportate } from "./push.js";

export default function PannelloNotifiche({ masterId = null, utente = null, compatto = false }) {
  const [stato, setStato] = useState(null);
  const [inCorso, setInCorso] = useState("");
  const [msg, setMsg] = useState(null);   // { tipo, testo }

  const rileggi = () => { statoNotifiche().then(setStato).catch(() => setStato(null)); };
  useEffect(() => { rileggi(); }, []);

  if (!pushSupportate()) return null;
  if (!stato) return null;

  async function accendi() {
    setInCorso("attiva"); setMsg(null);
    const esito = await attivaNotifiche({ masterId, utente });
    setInCorso("");
    rileggi();
    setMsg(esito.ok
      ? { tipo: "ok", testo: "Notifiche attive su questo dispositivo." }
      : { tipo: "errore", testo: esito.errore });
  }
  async function spegni() {
    if (!window.confirm("Spegnere le notifiche su questo dispositivo?")) return;
    setInCorso("spegni"); setMsg(null);
    await disattivaNotifiche();
    setInCorso("");
    rileggi();
    setMsg({ tipo: "ok", testo: "Notifiche spente su questo dispositivo." });
  }
  async function prova() {
    setInCorso("prova"); setMsg(null);
    try {
      // si manda a QUESTO endpoint e basta: la prova deve arrivare qui,
      // non sul telefono di tutte
      const reg = await navigator.serviceWorker.ready;
      const sot = await reg.pushManager.getSubscription();
      if (!sot) throw new Error("Questo dispositivo non risulta iscritto.");
      const { data, error } = await supabase.functions.invoke("invia-notifica-push", {
        body: { endpoint: sot.endpoint, titolo: "GENYON", testo: "Prova riuscita: le notifiche arrivano." },
      });
      if (error || data?.errore) throw new Error(data?.errore || error.message);
      setMsg(data?.inviate > 0
        ? { tipo: "ok", testo: "Mandata: dovrebbe comparire fra un istante." }
        : { tipo: "errore", testo: "Nessun invio: " + (data?.nota || (data?.errori || []).join(" · ")) });
    } catch (e) { setMsg({ tipo: "errore", testo: e?.message || String(e) }); }
    setInCorso("");
  }

  // le tre strade per non ricevere niente, dette com'erano
  const daInstallare = stato.iPhone && !stato.installata;
  const negato = stato.permesso === "denied";
  const attive = stato.iscritta && stato.permesso === "granted";

  const tasto = (testo, onClick, scuro) => (
    <button
      type="button" onClick={onClick} disabled={!!inCorso}
      style={{
        ...fontBody, fontSize: 12.5, fontWeight: 700, cursor: inCorso ? "default" : "pointer",
        color: scuro ? "#fff" : NAVY, background: scuro ? NAVY : "#fff",
        border: `1px solid ${scuro ? NAVY : CREAM_BORDER}`, borderRadius: 14, padding: "7px 14px",
        opacity: inCorso ? 0.6 : 1, whiteSpace: "nowrap",
      }}
    >{testo}</button>
  );

  return (
    <div style={{ background: BG, border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: compatto ? "10px 12px" : "12px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 240px", minWidth: 0, ...fontBody, fontSize: 13, color: NAVY }}>
          <b>Notifiche</b>
          <span style={{ display: "block", ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2, lineHeight: 1.45 }}>
            {daInstallare
              ? "Su iPhone arrivano solo all'app aggiunta alla schermata Home: aprila dalla sua icona e torna qui."
              : negato
                ? "Il permesso è stato negato su questo dispositivo. Si riapre dalle impostazioni del telefono, alla voce Notifiche di GENYON."
                : attive
                  ? "Attive su questo dispositivo."
                  : "Spente su questo dispositivo."}
          </span>
        </span>
        {!daInstallare && !negato && !attive && tasto(inCorso === "attiva" ? "Attivo…" : "Attiva le notifiche", accendi, true)}
        {attive && (
          <>
            {tasto(inCorso === "prova" ? "Mando…" : "Prova", prova)}
            {tasto(inCorso === "spegni" ? "Spengo…" : "Spegni", spegni)}
          </>
        )}
      </div>
      {msg && (
        <div style={{ ...fontBody, fontSize: 12, color: msg.tipo === "errore" ? "#C0392B" : "#2E7D32", marginTop: 8, lineHeight: 1.45 }}>{msg.testo}</div>
      )}
    </div>
  );
}
