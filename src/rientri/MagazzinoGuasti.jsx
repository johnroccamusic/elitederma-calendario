// Magazzino guasti: tutto quello che torna rotto, e da dove.
//
// Serve a due cose diverse, e la seconda e' quella che conta nel tempo.
//
// La prima e' pratica: un pezzo rientrato perche' non funzionava non deve
// tornare a scaffale insieme agli altri, o domani lo si vende a qualcuno.
// Quando il pacco di un corso viene controllato, i pezzi integri rientrano
// in giacenza e i guasti finiscono qui, senza toccare il magazzino.
//
// La seconda e' la statistica: quale prodotto si rompe piu' spesso, e in
// che corsi. Finora quel dato non esisteva da nessuna parte, e senza
// numeri "quel pigmento si rompe sempre" resta un'impressione.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay, stileTitoloPagina } from "../ui/stile.js";
import { TastoLivelloPrecedente } from "../ui/base.jsx";

const STATI = {
  da_controllare: { testo: "Da controllare", colore: "#8A6A1B", sfondo: "#F7EEDE" },
  riparato: { testo: "Riparato", colore: "#2E7D32", sfondo: "#E9F6EC" },
  buttato: { testo: "Buttato", colore: "#C0392B", sfondo: "#FDECEC" },
};

export default function MagazzinoGuasti({ prodottiShop, corsi, corsiDate, location, isMobile = false, onBack }) {
  const [righe, setRighe] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [vista, setVista] = useState("elenco");

  const prodottoById = useMemo(() => Object.fromEntries((prodottiShop || []).map((p) => [p.id, p])), [prodottiShop]);
  const corsoById = useMemo(() => Object.fromEntries((corsi || []).map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries((location || []).map((l) => [l.id, l])), [location]);
  const edizioneById = useMemo(() => Object.fromEntries((corsiDate || []).map((cd) => [cd.id, cd])), [corsiDate]);

  useEffect(() => {
    let vivo = true;
    supabase.from("resi_difettosi").select("*").order("ts", { ascending: false }).then(({ data }) => {
      if (!vivo) return;
      setRighe(data || []);
      setCaricando(false);
    });
    return () => { vivo = false; };
  }, []);

  const nomeProdotto = (id) => prodottoById[id]?.nome || "—";
  const doveNasce = (r) => {
    const cd = r.corso_data_id ? edizioneById[r.corso_data_id] : null;
    if (!cd) return null;
    return `${corsoById[cd.corso_id]?.nome || "—"} · ${locById[cd.location_id]?.nome || "—"} · ${cd.data_inizio || ""}`;
  };

  // la classifica: quale prodotto torna rotto piu' spesso. E' il motivo
  // per cui questa pagina esiste.
  const perProdotto = useMemo(() => {
    const m = {};
    righe.forEach((r) => {
      const v = m[r.prodotto_id] || (m[r.prodotto_id] = { prodottoId: r.prodotto_id, pezzi: 0, episodi: 0, corsi: new Set() });
      v.pezzi += r.quantita || 0;
      v.episodi += 1;
      if (r.corso_data_id) v.corsi.add(r.corso_data_id);
    });
    return Object.values(m).sort((a, b) => b.pezzi - a.pezzi);
  }, [righe]);

  const totalePezzi = righe.reduce((n, r) => n + (r.quantita || 0), 0);

  async function cambiaStato(id, stato) {
    await supabase.from("resi_difettosi").update({ stato }).eq("id", id);
    const { data } = await supabase.from("resi_difettosi").select("*").order("ts", { ascending: false });
    setRighe(data || []);
  }

  const linguetta = (chiave, testo) => (
    <button
      key={chiave} onClick={() => setVista(chiave)}
      style={{
        ...fontBody, fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer",
        background: vista === chiave ? NAVY : "#fff", color: vista === chiave ? "#fff" : NAVY,
        boxShadow: vista === chiave ? "none" : `inset 0 0 0 1px ${CREAM_BORDER}`, whiteSpace: "nowrap",
      }}
    >{testo}</button>
  );

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: isMobile ? "24px 16px 60px" : "32px 28px 60px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <TastoLivelloPrecedente titolo="Gestione magazzino e shop" onClick={onBack} soloIcona />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>Magazzino guasti</div>
        </div>
        <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          Quello che torna rotto dai corsi. Non è in giacenza: sta qui finché qualcuno non decide se si ripara o si butta.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {linguetta("elenco", "Elenco")}
          {linguetta("statistica", "Quali si rompono di più")}
        </div>

        {caricando ? (
          <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>
        ) : righe.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 20, ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
            Non è ancora tornato indietro niente di rotto. Questa pagina si riempie da sola quando un pacco di rientro viene controllato.
          </div>
        ) : vista === "statistica" ? (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
              <span style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: NAVY }}>{totalePezzi}</span>
              <span style={{ ...fontBody, fontSize: 12.5, color: MUTED }}>pezzi tornati rotti, su {perProdotto.length} prodotti diversi</span>
            </div>
            {perProdotto.map((p) => (
              <div key={p.prodottoId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 200px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                  {nomeProdotto(p.prodottoId)}
                  <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                    in {p.corsi.size} {p.corsi.size === 1 ? "corso" : "corsi"} · {p.episodi} {p.episodi === 1 ? "segnalazione" : "segnalazioni"}
                  </span>
                </span>
                <span style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: GOLD, whiteSpace: "nowrap" }}>{p.pezzi}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 20 }}>
            {righe.map((r) => {
              const stato = STATI[r.stato] || STATI.da_controllare;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${CREAM_BORDER}`, flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 220px", minWidth: 0, ...fontBody, fontSize: 13.5, fontWeight: 600, color: NAVY }}>
                    {nomeProdotto(r.prodotto_id)}
                    {doveNasce(r) && (
                      <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>{doveNasce(r)}</span>
                    )}
                    {r.nota && (
                      <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 1 }}>{r.nota}</span>
                    )}
                  </span>
                  <span style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{r.quantita} pz</span>
                  <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: stato.colore, background: stato.sfondo, borderRadius: 8, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                    {stato.testo}
                  </span>
                  {r.stato === "da_controllare" && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => cambiaStato(r.id, "riparato")} style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#2E7D32", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "7px 10px", cursor: "pointer" }}>Riparato</button>
                      <button onClick={() => cambiaStato(r.id, "buttato")} style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#C0392B", background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "7px 10px", cursor: "pointer" }}>Buttato</button>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.45 }}>
              “Riparato” e “Buttato” servono a tenere pulita la lista: nessuno dei due tocca la giacenza. Un pezzo che torna buono si rimette dentro dalla rettifica del magazzino, dove resta scritto chi l'ha fatto.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
