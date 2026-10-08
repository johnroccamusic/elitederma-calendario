// "Notifiche push": da qui si accendono su questo dispositivo, si vede
// chi le riceve e si manda un messaggio.
//
// Serve soprattutto a sapere CHI NON LE RICEVE. Una notifica che non
// arriva non si vede da nessuna parte: non c'e' un errore, non c'e' una
// riga rossa, semplicemente quella persona non sa la cosa. L'elenco qui
// sotto e' l'unico posto in cui si legge che la master X non ha mai
// installato l'app, o che il suo telefono ha smesso di rispondere.
import React, { useEffect, useState } from "react";
import { NAVY, GOLD, MUTED, CREAM_BORDER, BG, fontBody, fontDisplay } from "../ui/stile.js";
import { supabase } from "../supabase.js";
import PannelloNotifiche from "./PannelloNotifiche.jsx";

const quando = (ts) => (ts ? new Date(ts).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export default function PaginaNotifichePush({ master = [], utenteLoggato = null }) {
  const [righe, setRighe] = useState(null);
  const [msg, setMsg] = useState(null);
  const [inCorso, setInCorso] = useState("");
  const [a, setA] = useState("");          // "" = tutti, altrimenti master_id
  const [titolo, setTitolo] = useState("GENYON");
  const [testo, setTesto] = useState("");

  const leggi = () => {
    supabase.from("push_iscrizioni").select("*").order("creato_il", { ascending: false })
      .then(({ data }) => setRighe(data || []));
  };
  useEffect(() => { leggi(); }, []);

  async function manda() {
    if (!testo.trim()) { setMsg({ tipo: "errore", testo: "Scrivi il messaggio." }); return; }
    const chi = a ? (master || []).find((m) => m.id === a)?.nome : "TUTTI i dispositivi iscritti";
    if (!window.confirm(`Mandare la notifica a ${chi}?\n\n«${titolo.trim() || "GENYON"} — ${testo.trim()}»`)) return;
    setInCorso("manda"); setMsg(null);
    try {
      const corpo = a ? { masterId: a } : { tutte: true };
      const { data, error } = await supabase.functions.invoke("invia-notifica-push", {
        body: { ...corpo, titolo: titolo.trim() || "GENYON", testo: testo.trim() },
      });
      if (error || data?.errore) throw new Error(data?.errore || error.message);
      const pezzi = [`Mandata a ${data.inviate} dispositiv${data.inviate === 1 ? "o" : "i"}`];
      if (data.spente) pezzi.push(`${data.spente} spent${data.spente === 1 ? "o" : "i"} perché non rispondono più`);
      if (data.nota) pezzi.push(data.nota);
      if (data.errori?.length) pezzi.push("errori: " + data.errori.join(" · "));
      setMsg({ tipo: data.inviate > 0 ? "ok" : "errore", testo: pezzi.join(" · ") });
      leggi();
    } catch (e) { setMsg({ tipo: "errore", testo: e?.message || String(e) }); }
    setInCorso("");
  }

  const nomeMaster = (id) => (master || []).find((m) => m.id === id)?.nome || null;
  const attive = (righe || []).filter((r) => r.attiva);
  const conDispositivo = new Set(attive.map((r) => r.master_id).filter(Boolean));
  const senza = (master || []).filter((m) => m.attiva !== false && !conDispositivo.has(m.id));

  const th = { ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left", padding: "9px 12px", background: BG, whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderTop: `1px solid ${CREAM_BORDER}`, ...fontBody, fontSize: 12.5, color: NAVY };

  return (
    <div>
      <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
        Le notifiche arrivano solo ai dispositivi che le hanno accese, e su iPhone solo all'app aggiunta alla schermata Home. Qui si accendono su questo dispositivo, si vede chi le riceve e si manda un messaggio.
      </div>

      <PannelloNotifiche masterId={utenteLoggato?.masterId || null} utente={utenteLoggato?.nome || "staff"} />

      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, margin: "18px 0 8px" }}>Manda una notifica</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
        <select value={a} onChange={(e) => setA(e.target.value)} style={{ ...fontBody, fontSize: 13, padding: "8px 10px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, flex: "1 1 200px", minWidth: 0 }}>
          <option value="">A tutti i dispositivi iscritti</option>
          {(master || []).filter((m) => conDispositivo.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo"
          style={{ ...fontBody, fontSize: 13, padding: "8px 10px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, flex: "1 1 160px", minWidth: 0 }} />
      </div>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={2} placeholder="Il messaggio, come lo leggeranno sul telefono"
        style={{ ...fontBody, fontSize: 13, padding: "9px 11px", borderRadius: 12, border: `1px solid ${CREAM_BORDER}`, background: "#fff", color: NAVY, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" onClick={manda} disabled={!!inCorso}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: "#fff", background: NAVY, border: `1px solid ${NAVY}`, borderRadius: 14, padding: "8px 16px", cursor: inCorso ? "default" : "pointer", opacity: inCorso ? 0.6 : 1 }}>
          {inCorso === "manda" ? "Mando…" : "Manda"}
        </button>
        {msg && <span style={{ ...fontBody, fontSize: 12, color: msg.tipo === "errore" ? "#C0392B" : "#2E7D32" }}>{msg.testo}</span>}
      </div>

      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, margin: "22px 0 8px" }}>
        Dispositivi iscritti {righe ? `(${attive.length})` : ""}
      </div>
      {righe === null ? (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
      ) : righe.length === 0 ? (
        <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Ancora nessuno. Il primo sei tu: premi «Attiva le notifiche» qui sopra.</div>
      ) : (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead><tr>{["Chi", "Dispositivo", "Acceso il", "Ultimo invio", "Stato"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id} style={{ opacity: r.attiva ? 1 : 0.55 }}>
                    <td style={{ ...td, fontWeight: 700 }}>{nomeMaster(r.master_id) || r.utente || "—"}</td>
                    <td style={td}>{r.dispositivo || "—"}</td>
                    <td style={td}>{quando(r.creato_il)}</td>
                    <td style={td}>{quando(r.ultimo_invio)}</td>
                    <td style={{ ...td, color: r.attiva ? "#2E7D32" : "#C0392B", fontWeight: 700 }}>
                      {r.attiva ? "attivo" : "spento"}
                      {r.ultimo_errore && <span style={{ display: "block", ...fontBody, fontSize: 10.5, color: MUTED, fontWeight: 400 }}>{r.ultimo_errore}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* chi NON le riceve: e' la riga che serve davvero, perche' una
          notifica non arrivata non lascia traccia da nessuna parte */}
      {righe !== null && senza.length > 0 && (
        <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 10, padding: "9px 11px", marginTop: 12, lineHeight: 1.55 }}>
          <b>Non ricevono niente</b> ({senza.length}): {senza.map((m) => m.nome).join(", ")}.
          <span style={{ display: "block", color: MUTED, marginTop: 3 }}>Devono aprire GENYON dall'icona sulla Home e premere «Attiva le notifiche» nella loro dashboard.</span>
        </div>
      )}
    </div>
  );
}
