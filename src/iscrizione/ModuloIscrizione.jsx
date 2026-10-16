// SETTING > MODULO DI ISCRIZIONE.
//
// Qui si decide che cosa vedra' l'allieva sul modulo che le arriva.
//
// DA DOVE VIENE IL MODULO. Non piu' da quello vecchio del sito: di
// quello restano solo le parti che l'allieva deve leggere o fornire —
// regolamento, informativa privacy, consensi, documento d'identita' e
// firma. Tutto il resto (chi e', che corso ha preso, quanto paga) e' lo
// SPECCHIO della scheda che il venditore ha gia' compilato in Genyon,
// con le stesse etichette che lui vede. Vedi campi-scheda.js.
//
// IL REGOLAMENTO E' UN TASTO, non nove sottosezioni. Nessuno lo
// configura e nessuno lo sfoglia da qui: si apre tutto intero quando lo
// si vuole rileggere, come il consenso delle modelle.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button } from "../ui/base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { SEZIONI, CONSENSI, INTRO } from "./contenuto.js";
import { SEZIONI_SCHEDA, CHIEDE_ALL_ALLIEVA, TUTTI_I_CAMPI, etichettaFonte } from "./campi-scheda.js";
import { leggiScelte, salvaScelta } from "./campi.js";

const REGOLAMENTO = SEZIONI.find((s) => s.tipo === "testo");

function Apribile({ titolo, sottotitolo, aperto, onToccata, children }) {
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, marginBottom: 8, background: "#fff", overflow: "hidden" }}>
      <button
        type="button" onClick={onToccata}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
          background: aperto ? "#FAF7F1" : "#fff", border: "none", cursor: "pointer",
          padding: "12px 14px", minHeight: 48,
        }}
      >
        <span style={{ ...fontBody, fontSize: 13, color: MUTED, width: 14, flex: "0 0 14px", transform: aperto ? "rotate(90deg)" : "none" }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...fontDisplay, fontSize: 14.5, fontWeight: 700, color: NAVY, display: "block" }}>{titolo}</span>
          {sottotitolo && <span style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>{sottotitolo}</span>}
        </span>
      </button>
      {aperto && <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>{children}</div>}
    </div>
  );
}

// Una riga = un campo della scheda. A sinistra come si chiama e da dove
// arriva, a destra l'interruttore. Niente caselle finte da riempire:
// questa e' la pagina dove si sceglie, non dove si compila.
function RigaCampo({ campo, incluso, salvando, onCambia }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "9px 2px", borderBottom: `1px solid ${CREAM_BORDER}80`,
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: incluso ? NAVY : MUTED, lineHeight: 1.3 }}>
          {campo.etichetta}
        </div>
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
          {campo.fonte ? etichettaFonte(campo.fonte) : campo.nota || "la scrive l'allieva"}
        </div>
      </div>
      <label
        style={{
          display: "flex", alignItems: "center", gap: 7, cursor: "pointer", flex: "0 0 auto",
          ...fontBody, fontSize: 12, fontWeight: 700,
          color: incluso ? "#1B7F4C" : MUTED,
        }}
      >
        <input type="checkbox" checked={incluso} disabled={salvando} onChange={() => onCambia(!incluso)} />
        {incluso ? "Sul modulo" : "Nascosto"}
      </label>
    </div>
  );
}

export default function ModuloIscrizione() {
  const [scelte, setScelte] = useState({});
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState("");
  const [chi, setChi] = useState("");
  const [aperta, setAperta] = useState("allieva");
  const [regolamentoAperto, setRegolamentoAperto] = useState(false);

  useEffect(() => {
    let vivo = true;
    leggiScelte().then(({ scelte: s, errore: e }) => {
      if (!vivo) return;
      if (e) setErrore(e); else setScelte(s);
    });
    supabase.auth.getUser().then(({ data }) => { if (vivo) setChi(data?.user?.email || ""); });
    return () => { vivo = false; };
  }, []);

  // Una chiave che non ha ancora una riga nel database vale quello che
  // dice `predefinito`: cosi' un campo aggiunto al codice compare subito
  // col suo stato giusto, senza bisogno di andare a scriverlo a mano.
  function inclusoDi(campo) {
    const r = scelte[campo.chiave];
    if (r) return r.incluso !== false;
    return campo.predefinito !== false;
  }

  async function cambia(campo, valore) {
    const prima = scelte[campo.chiave];
    setScelte((s) => ({ ...s, [campo.chiave]: { chiave: campo.chiave, incluso: valore, precompilato_da: campo.fonte || null } }));
    setSalvando(campo.chiave);
    const e = await salvaScelta(campo.chiave, { incluso: valore, precompilato_da: campo.fonte || null }, chi);
    setSalvando("");
    if (e) {
      setErrore(e);
      setScelte((s) => ({ ...s, [campo.chiave]: prima }));
    } else setErrore("");
  }

  const tutti = [...TUTTI_I_CAMPI, ...CHIEDE_ALL_ALLIEVA];
  const accesi = tutti.filter(inclusoDi).length;
  const dallaScheda = TUTTI_I_CAMPI.filter(inclusoDi).length;

  return (
    <div style={{ ...fontBody }}>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: GRAFITE, lineHeight: 1.5,
      }}>
        Il modulo che riceve l'allieva è lo <b style={{ color: NAVY }}>specchio della scheda di iscrizione</b>:
        i suoi dati e quelli del corso arrivano già compilati da quello che il venditore ha scritto.
        Del vecchio modulo del sito restano solo il regolamento, la privacy, il documento e la firma.
        <div style={{ marginTop: 8, fontWeight: 700, color: NAVY }}>
          {accesi} camp{accesi === 1 ? "o" : "i"} sul modulo · {dallaScheda} pres{dallaScheda === 1 ? "o" : "i"} dalla scheda
          {" · "}{CHIEDE_ALL_ALLIEVA.filter(inclusoDi).length} chiest{CHIEDE_ALL_ALLIEVA.filter(inclusoDi).length === 1 ? "o" : "i"} all'allieva
        </div>
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 10 }}>Non riesco a salvare: {errore}</div>}

      {/* Il regolamento: un tasto, come il consenso delle modelle. */}
      <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 14, marginBottom: 14, background: "#fff" }}>
        <div style={{ ...fontDisplay, fontSize: 14.5, fontWeight: 700, color: NAVY }}>Regolamento, privacy e consensi</div>
        <div style={{ fontSize: 12, color: MUTED, margin: "4px 0 10px", lineHeight: 1.5 }}>
          {REGOLAMENTO.blocchi.length} punti più l'informativa sul trattamento dei dati e l'autorizzazione alle
          immagini. Vanno sempre sul modulo: sono la ragione per cui si firma.
        </div>
        <Button variant="ghost" onClick={() => setRegolamentoAperto((v) => !v)}>
          {regolamentoAperto ? "Chiudi il regolamento" : "Leggi il regolamento completo"}
        </Button>
        {regolamentoAperto && (
          <div style={{
            marginTop: 12, maxHeight: 420, overflowY: "auto",
            border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, background: "#FCFBF8",
          }}>
            <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{INTRO.titolo}</div>
            {REGOLAMENTO.blocchi.map((b) => (
              <div key={b.titolo} style={{ marginBottom: 16 }}>
                <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{b.titolo}</div>
                {b.punti.map((p, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "8px 0" }}>{p}</p>
                ))}
              </div>
            ))}
            <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, margin: "18px 0 6px" }}>
              {CONSENSI.informativaEtichetta}
            </div>
            {CONSENSI.informativaTesto.map((p, i) => (
              <p key={i} style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "8px 0" }}>{p}</p>
            ))}
            <p style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, margin: "14px 0 0", whiteSpace: "pre-line" }}>
              {CONSENSI.immaginiTesto}
            </p>
          </div>
        )}
      </div>

      {/* Lo specchio della scheda */}
      {SEZIONI_SCHEDA.map((s) => {
        const quanti = s.campi.filter(inclusoDi).length;
        return (
          <Apribile
            key={s.chiave} titolo={s.titolo}
            sottotitolo={`${quanti} di ${s.campi.length} sul modulo`}
            aperto={aperta === s.chiave}
            onToccata={() => setAperta(aperta === s.chiave ? null : s.chiave)}
          >
            {s.nota && <div style={{ fontSize: 12, color: MUTED, margin: "10px 0", lineHeight: 1.5 }}>{s.nota}</div>}
            {s.campi.map((c) => (
              <RigaCampo key={c.chiave} campo={c} incluso={inclusoDi(c)}
                         salvando={salvando === c.chiave} onCambia={(v) => cambia(c, v)} />
            ))}
          </Apribile>
        );
      })}

      {/* Quello che non sappiamo noi */}
      <Apribile
        titolo="Quello che chiede all'allieva"
        sottotitolo={`${CHIEDE_ALL_ALLIEVA.filter(inclusoDi).length} di ${CHIEDE_ALL_ALLIEVA.length} sul modulo`}
        aperto={aperta === "allieva_compila"}
        onToccata={() => setAperta(aperta === "allieva_compila" ? null : "allieva_compila")}
      >
        <div style={{ fontSize: 12, color: MUTED, margin: "10px 0", lineHeight: 1.5 }}>
          Le uniche cose che il venditore non ha in scheda. Restano dal modulo del sito, dove venivano già chieste.
        </div>
        {CHIEDE_ALL_ALLIEVA.map((c) => (
          <RigaCampo key={c.chiave} campo={c} incluso={inclusoDi(c)}
                     salvando={salvando === c.chiave} onCambia={(v) => cambia(c, v)} />
        ))}
        <div style={{ fontSize: 12, color: GRAFITE, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}` }}>
          <b style={{ color: NAVY }}>{CONSENSI.firmaEtichetta}</b> — sempre presente, e non si toglie: senza firma
          il modulo non vale niente.
        </div>
      </Apribile>
    </div>
  );
}
