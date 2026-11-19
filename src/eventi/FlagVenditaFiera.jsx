// IL FLAG «VENDITA FIERA», IN CIMA ALLA SCHEDA DI ISCRIZIONE (8/11/2026).
//
// Chiesto dal titolare con la fiera di Napoli aperta. Si tocca una
// casella e quell'iscrizione diventa una vendita di quella fiera: da
// li' compare nella scheda dell'evento, fra i corsi che stiamo
// chiudendo al banco.
//
// STA IN CIMA perche' e' la prima cosa che si sa e l'ultima che si
// ricorderebbe: al banco si compila di corsa, col cliente davanti, e un
// flag in fondo a una scheda lunga due schermi non lo tocca nessuno.
//
// IL GESTO E' UN FLAG, QUELLO CHE SI SCRIVE E' LA FIERA. Vedi la
// migrazione 20261108120000: un si'/no farebbe comparire le iscrizioni
// di Napoli nella scheda di ogni fiera futura.
//
// Gli eventi si leggono qui e non arrivano dall'alto: sono tre righe in
// tutto, e la scheda di iscrizione non li ha mai avuti fra le mani —
// farglieli attraversare mezza App per una casella non vale il prezzo.
// Cosi' una fiera creata stamattina compare senza ricaricare niente.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, GOLD, MUTED, CREAM_BORDER, fontBody, campoCompattoStyle } from "../ui/stile.js";
import { fiereDaFlaggare, periodoFiera } from "./fiera-iscrizioni.js";

const etichettaFiera = (e) => {
  const p = periodoFiera(e);
  const quando = p ? `${p.dal.slice(8, 10)}/${p.dal.slice(5, 7)}` : "";
  return [e.nome, e.citta, quando].filter(Boolean).join(" · ");
};

export default function FlagVenditaFiera({ valore = "", onCambia, soloLettura = false }) {
  const [eventi, setEventi] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase.from("eventi").select("id, nome, citta, data_inizio, data_fine, stato")
      .order("data_inizio", { ascending: false })
      .then(({ data }) => { if (vivo) setEventi(data || []); });
    return () => { vivo = false; };
  }, []);

  // la fiera gia' scritta sta SEMPRE nell'elenco, anche se vecchia: una
  // tendina che non contiene il valore che mostra lo cancella al primo
  // tocco
  const scegliibili = fiereDaFlaggare(eventi || [], { giaScelta: valore });
  const acceso = !!valore;
  const scelta = scegliibili.find((e) => e.id === valore) || null;

  if (eventi === null) return null;
  // A SCHEDA CHIUSA si legge solo se c'e' qualcosa da leggere: su
  // un'iscrizione che non e' di nessuna fiera, una riga che lo dice e'
  // rumore in cima a una scheda che si apre per guardare altro.
  if (soloLettura && !acceso) return null;

  if (scegliibili.length === 0) {
    // NIENTE CASELLA SENZA UNA FIERA, e si dice perche'. Una spunta che
    // non puo' scrivere niente e' un dubbio, non una scelta — e
    // «vendita fiera» senza la fiera e' il dato che questa colonna
    // esiste per non avere.
    return (
      <div data-campo="vendita-fiera-senza-fiere" style={{
        ...fontBody, fontSize: 11.5, color: MUTED, border: `1px dashed ${CREAM_BORDER}`,
        borderRadius: 12, padding: "8px 11px", marginBottom: 12,
      }}>
        Vendita fiera: in questi giorni non c'è nessuna fiera aperta. Si segna da Gestione eventi,
        nella scheda della fiera.
      </div>
    );
  }

  return (
    <div style={{
      ...fontBody, border: `1px solid ${acceso ? GOLD : CREAM_BORDER}`,
      borderLeft: `4px solid ${acceso ? GOLD : CREAM_BORDER}`, borderRadius: 12,
      background: acceso ? "#FFFDF8" : "#fff", padding: "9px 12px", marginBottom: 12,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: soloLettura ? "default" : "pointer" }}>
        <input
          type="checkbox" data-campo="vendita-fiera" checked={acceso} disabled={soloLettura}
          onChange={(e) => onCambia?.(e.target.checked ? (valore || scegliibili[0].id) : "")}
          style={{ width: 17, height: 17, accentColor: GOLD }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>Vendita fiera</span>
      </label>

      {!acceso && (
        <span style={{ fontSize: 11.5, color: MUTED }}>
          Spunta se questa iscrizione si è chiusa al banco di {scegliibili.length === 1 ? etichettaFiera(scegliibili[0]) : "una fiera"}.
        </span>
      )}

      {/* Con una fiera sola non c'e' niente da scegliere, e il nome si
          legge: una tendina da una voce e' un tocco in piu' per
          confermare quello che si sapeva gia'. Con piu' di una la
          tendina c'e', e parte dalla piu' recente — una preselezione che
          si vede, non una che decide in silenzio. */}
      {acceso && scegliibili.length === 1 && (
        <span style={{ fontSize: 12.5, color: NAVY, fontWeight: 700 }}>{etichettaFiera(scegliibili[0])}</span>
      )}
      {acceso && scegliibili.length > 1 && (
        <select
          data-campo="vendita_evento_id" value={valore} disabled={soloLettura}
          onChange={(e) => onCambia?.(e.target.value)}
          style={{ ...campoCompattoStyle, flex: "1 1 220px", minWidth: 0, maxWidth: 420 }}
        >
          {scegliibili.map((e) => (
            <option key={e.id} value={e.id}>{etichettaFiera(e)}</option>
          ))}
        </select>
      )}
      {acceso && !scelta && (
        <span style={{ fontSize: 11.5, color: "#B3261E" }}>La fiera segnata non è più in elenco.</span>
      )}
    </div>
  );
}
