// IL TASTO «BOLLA DI ACCOMPAGNAMENTO» nella scheda di un evento (27/10/2026).
// Prima chiede partenza e destinazione (e vettore, causale, colli), gia'
// compilati con la sede della societa' e il luogo dell'evento — o con
// quello che si era scritto l'ultima volta, perche' una ristampa non
// deve far riscrivere niente, ma deve poter correggere. Poi genera il
// PDF dalle righe di Materiali e lo scarica.
import React, { useEffect, useState } from "react";
import { Button, Field } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, fontBody, fontDisplay, inputStyle } from "../ui/stile.js";
import { leggiRighe, salvaEvento } from "./dati.js";
import { bollaIniziale, creaBollaPdf, datiSocieta, numeroBolla, scaricaPdf } from "./bolla.js";

export default function BollaEvento({ evento, chi = "", onCambiato, generaPdf = creaBollaPdf, scarica = scaricaPdf }) {
  const [aperto, setAperto] = useState(false);
  const [societa, setSocieta] = useState(null);
  const [b, setB] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!aperto) return;
    datiSocieta().then((s) => { setSocieta(s); setB(bollaIniziale(evento, s)); });
  }, [aperto, evento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function genera() {
    if (!b || occupato) return;
    if (!b.partenza.trim() || !b.destinazione.trim()) { setMsg("Servono l'indirizzo di partenza e quello di destinazione."); return; }
    setOccupato(true); setMsg("");
    try {
      const bolla = { ...b, numero: b.numero || numeroBolla(), generata_il: evento?.bolla?.generata_il || new Date().toISOString(), ristampata_il: evento?.bolla ? new Date().toISOString() : null, generata_da: evento?.bolla?.generata_da || chi || null };
      // prima si salva: cosi' la ristampa trova gli indirizzi anche se il
      // PDF non uscisse
      await salvaEvento(evento.id, { bolla });
      const righe = await leggiRighe("eventi_materiali", evento.id);
      const bytes = await generaPdf({ evento, righe, bolla, societa });
      scarica(bytes, `${bolla.numero.replace(/[^A-Za-z0-9]+/g, "-")}-${String(evento.nome || "evento").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`);
      setB(bolla);
      setMsg(`Bolla ${bolla.numero} generata con ${righe.filter((r) => (Number(r.quantita) || 0) > 0).length} righe.`);
      onCambiato?.();
    } catch (e) { setMsg(`Non riesco a generare la bolla: ${e.message}`); }
    setOccupato(false);
  }

  const campo = (k, props = {}) => (
    <textarea value={b?.[k] || ""} onChange={(e) => setB({ ...b, [k]: e.target.value })} rows={3}
      data-campo={`bolla-${k}`} style={{ ...inputStyle, resize: "vertical", minHeight: 58, lineHeight: 1.4 }} {...props} />
  );

  return (
    <div style={{ width: "100%" }}>
      <Button variant="ghost" onClick={() => setAperto((v) => !v)}>
        {aperto ? "Chiudi la bolla" : (evento?.bolla?.numero ? "Ristampa la bolla" : "Bolla di accompagnamento")}
      </Button>
      {aperto && (
        <div data-campo="bolla-pannello" style={{ marginTop: 10, border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, background: "#FFFDF8", textAlign: "left" }}>
          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>Bolla di accompagnamento{b?.numero ? ` · ${b.numero}` : ""}</div>
          <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, margin: "2px 0 10px", lineHeight: 1.5 }}>
            Elenca i materiali di questo evento con le quantità. Controlla gli indirizzi: restano salvati e si possono correggere a ogni ristampa.
          </div>
          {!b ? <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 10 }}>
                <Field label="Partenza (mittente)">{campo("partenza", { placeholder: "Ragione sociale\nVia, CAP, città" })}</Field>
                <Field label="Destinazione (destinatario)">{campo("destinazione", { placeholder: "Fiera / padiglione / stand\nVia, CAP, città" })}</Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginTop: 8 }}>
                <Field label="Vettore"><input value={b.vettore} onChange={(e) => setB({ ...b, vettore: e.target.value })} style={inputStyle} /></Field>
                <Field label="Colli"><input value={b.colli} onChange={(e) => setB({ ...b, colli: e.target.value })} style={inputStyle} placeholder="es. 6" /></Field>
                <Field label="Aspetto esteriore"><input value={b.aspetto} onChange={(e) => setB({ ...b, aspetto: e.target.value })} style={inputStyle} /></Field>
              </div>
              <Field label="Causale del trasporto"><input value={b.causale} onChange={(e) => setB({ ...b, causale: e.target.value })} style={inputStyle} /></Field>
              {msg && <div style={{ ...fontBody, fontSize: 12.5, color: msg.startsWith("Non") || msg.startsWith("Servono") ? "#C0392B" : "#2E7D32", marginTop: 6 }}>{msg}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <Button onClick={genera} disabled={occupato}>{occupato ? "Genero…" : (evento?.bolla?.numero ? "Ristampa la bolla (PDF)" : "Genera la bolla (PDF)")}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
