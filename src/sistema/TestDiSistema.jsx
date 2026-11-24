// TEST DI SISTEMA (24/11/2026, chiesto dal titolare).
//
// «Creiamo una funzione di test in cui mandiamo tutte le verifiche da
// fare per testare l'app in base a tutti i malfunzionamenti che hai
// trovato nel tempo, in modo che se un giorno vogliamo ripassare tutto
// abbiamo un sistema che si basa su vecchi bug e sulla loro
// risoluzione.»
//
// I CONTROLLI NON STANNO QUI, STANNO NEL DATABASE (`test_di_sistema()`),
// e il motivo è il guasto dello stesso giorno: lo shop non scaricava il
// magazzino da ventiquattro giorni, e nessuna delle 1.532 prove del banco
// poteva vederlo — il codice nel repo era giusto, l'indice parziale stava
// nel database, e il danno nasceva solo in produzione. Un controllo che
// vive nel browser avrebbe guardato la cosa sbagliata.
//
// QUESTA PAGINA È SOLO IL REFERTO. Non calcola niente e non corregge
// niente: un controllo che aggiusta da sé è il modo di non sapere più
// cosa era rotto. Per ogni riga si legge il numero misurato, quello che
// ci si aspetta, il guasto da cui quel controllo nasce — con la data — e
// cosa fare se è tornato.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, GOLD, CREAM_BORDER, GRAFITE, fontBody, fontDisplay } from "../ui/stile.js";
import { Button } from "../ui/base.jsx";

const COLORE = {
  ok: { testo: "#2E7D32", sfondo: "#EAF5EA", bordo: "#C7E3C7", etichetta: "a posto" },
  guarda: { testo: "#8A6A1B", sfondo: "#FBF3E4", bordo: GOLD, etichetta: "da guardare" },
  rotto: { testo: "#C0392B", sfondo: "#FBEBE9", bordo: "#F0C8C2", etichetta: "è tornato" },
};

export default function TestDiSistema({ isMobile = false }) {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(null);
  const [girando, setGirando] = useState(false);
  const [quando, setQuando] = useState(null);
  const [aperte, setAperte] = useState({});

  async function gira() {
    setGirando(true); setErrore(null);
    const { data, error } = await supabase.rpc("test_di_sistema");
    if (error) setErrore(error.message);
    else {
      const ordine = { rotto: 0, guarda: 1, ok: 2 };
      setRighe([...(data || [])].sort((a, b) =>
        (ordine[a.esito] ?? 3) - (ordine[b.esito] ?? 3) || String(a.area).localeCompare(String(b.area), "it")));
      setQuando(new Date());
    }
    setGirando(false);
  }
  useEffect(() => { gira(); }, []);

  const conta = (e) => (righe || []).filter((r) => r.esito === e).length;
  const scheda = { background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 12 : 16 };

  return (
    <div style={{ padding: isMobile ? "0 0 60px" : "0 0 60px" }} data-test-sistema>
      <div style={{ ...fontBody, fontSize: isMobile ? 12.5 : 13.5, color: GRAFITE, lineHeight: 1.55, marginBottom: 16 }}>
        Ripassa <b style={{ color: NAVY }}>i guasti trovati nel tempo</b> e dice se qualcuno è tornato. Ogni controllo
        porta con sé la sua storia: cosa era rotto, quando, e cosa guardare se succede di nuovo.
        <br />
        Guarda lo <b>stato vivo</b> — dati, vincoli, permessi, lavori notturni — cioè quello che le prove del banco non
        possono vedere: il 24/11/2026 lo shop non scaricava il magazzino da ventiquattro giorni e il codice era giusto,
        perché il difetto stava nel database.
      </div>

      {righe && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {["rotto", "guarda", "ok"].map((e) => (
            <div key={e} style={{ ...scheda, flex: "1 1 140px", borderColor: COLORE[e].bordo, background: COLORE[e].sfondo, padding: "10px 14px" }}>
              <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: COLORE[e].testo, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {COLORE[e].etichetta}
              </div>
              <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }} data-conta={e}>{conta(e)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <Button onClick={gira} disabled={girando}>{girando ? "Sto controllando…" : "Rifai il test"}</Button>
        {quando && <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>
          Controllato alle {quando.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
        </span>}
      </div>

      {errore && (
        <div style={{ ...scheda, borderColor: "#F0C8C2", background: "#FBEBE9", ...fontBody, fontSize: 13, color: "#C0392B" }}>
          Il test non è potuto girare: {errore}
        </div>
      )}
      {!righe && !errore && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Sto controllando…</div>}

      {(righe || []).map((r, i) => {
        const c = COLORE[r.esito] || COLORE.guarda;
        const aperto = !!aperte[i];
        return (
          <div key={i} style={{ ...scheda, borderColor: c.bordo, marginBottom: 8 }} data-controllo={r.esito}>
            <button type="button" onClick={() => setAperte((x) => ({ ...x, [i]: !x[i] }))}
              style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: c.testo, background: c.sfondo, border: `1px solid ${c.bordo}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {c.etichetta}
              </span>
              <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.area}</span>
              <span style={{ ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY, flex: "1 1 220px", minWidth: 0 }}>{r.controllo}</span>
              <span style={{ ...fontBody, fontSize: 12.5, color: r.esito === "ok" ? MUTED : c.testo, fontWeight: r.esito === "ok" ? 400 : 700, overflowWrap: "anywhere" }}>
                {r.misura}
              </span>
              <span style={{ ...fontBody, fontSize: 11, color: MUTED }}>{aperto ? "▾" : "▸"}</span>
            </button>
            {aperto && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CREAM_BORDER}`, display: "grid", gap: 8 }}>
                <Voce titolo="Cosa ci si aspetta" testo={r.atteso} />
                <Voce titolo="Da quale guasto nasce" testo={r.nato_da} />
                {r.esito !== "ok" && <Voce titolo="Cosa fare" testo={r.cosa_fare} forte />}
              </div>
            )}
          </div>
        );
      })}

      {righe && conta("rotto") === 0 && (
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
          Nessun vecchio guasto è tornato. «Da guardare» non vuol dire rotto: vuol dire che quel numero merita
          un’occhiata di una persona — e dove non c’è niente da fare, va scritto perché.
        </div>
      )}
    </div>
  );
}

function Voce({ titolo, testo, forte = false }) {
  if (!testo) return null;
  return (
    <div>
      <div style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</div>
      <div style={{ ...fontBody, fontSize: 12.5, color: forte ? NAVY : GRAFITE, lineHeight: 1.5, fontWeight: forte ? 600 : 400 }}>{testo}</div>
    </div>
  );
}
