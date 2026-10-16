// IL MODULO DI ISCRIZIONE dentro Genyon.
//
// Per ora e' la COPIA FEDELE di quello che gira su elitederma.eu: stessi
// campi, stesso ordine, stesso testo. Si guarda e si compila per vedere
// com'e' fatto, ma non salva niente e non manda niente — le modifiche
// vere vengono dopo, e tocca decidere dove finiscono le risposte.
//
// A SEZIONI CHE SI APRONO. Tutto di fila sono nove punti di regolamento
// piu' una trentina di campi: un muro che nessuno legge. Qui si apre una
// cosa alla volta, e il regolamento ha i suoi nove punti ciascuno per
// conto suo — come sull'originale.
import React, { useState } from "react";
import { Field } from "../ui/base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay, inputStyle } from "../ui/stile.js";
import { INTRO, SEZIONI, CONSENSI } from "./contenuto.js";

function Apribile({ titolo, sottotitolo, aperto, onToccata, bordoOro = false, children }) {
  return (
    <div style={{
      border: `1px solid ${bordoOro ? GOLD : CREAM_BORDER}`, borderRadius: 12,
      marginBottom: 8, background: "#fff", overflow: "hidden",
    }}>
      <button
        type="button" onClick={onToccata}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
          background: aperto ? "#FAF7F1" : "#fff", border: "none", cursor: "pointer",
          padding: "12px 14px", minHeight: 48,
        }}
      >
        <span style={{
          ...fontBody, fontSize: 13, color: MUTED, width: 14, flex: "0 0 14px",
          transform: aperto ? "rotate(90deg)" : "none", transition: "transform .15s",
        }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...fontDisplay, fontSize: 14.5, fontWeight: 700, color: NAVY, display: "block" }}>{titolo}</span>
          {sottotitolo && <span style={{ ...fontBody, fontSize: 11.5, color: MUTED }}>{sottotitolo}</span>}
        </span>
      </button>
      {aperto && <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${CREAM_BORDER}` }}>{children}</div>}
    </div>
  );
}

function CampoDisegnato({ c, valore, onCambia }) {
  const etichetta = c.etichetta + (c.obbligatorio ? " *" : "");
  const comune = { style: inputStyle, value: valore ?? "", onChange: (e) => onCambia(e.target.value) };
  return (
    <div style={{ marginBottom: 2 }}>
      <Field label={etichetta}>
        {c.tipo === "tendina" ? (
          <select {...comune}>
            <option value="">Seleziona una scelta</option>
            {(c.voci || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : c.tipo === "scelta" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
            {(c.voci || []).map((v) => (
              <label key={v} style={{ ...fontBody, fontSize: 13, color: GRAFITE, display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="radio" checked={valore === v} onChange={() => onCambia(v)} style={{ marginTop: 3 }} />
                <span>{v}</span>
              </label>
            ))}
          </div>
        ) : c.tipo === "file" ? (
          <input type="file" style={{ ...inputStyle, padding: 8 }} onChange={() => {}} />
        ) : (
          <input
            type={c.tipo === "data" ? "date" : c.tipo === "numero" ? "number" : c.tipo === "email" ? "email" : c.tipo === "telefono" ? "tel" : "text"}
            {...comune}
          />
        )}
      </Field>
      {c.nota && (
        <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: -6, marginBottom: 10, lineHeight: 1.45, whiteSpace: "pre-line" }}>
          {c.nota}
        </div>
      )}
    </div>
  );
}

export default function ModuloIscrizione() {
  const [aperta, setAperta] = useState("regolamento");
  const [puntoAperto, setPuntoAperto] = useState(null);
  const [risposte, setRisposte] = useState({});
  const metti = (k) => (v) => setRisposte((r) => ({ ...r, [k]: v }));

  return (
    <div style={{ ...fontBody }}>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: GRAFITE, lineHeight: 1.5,
      }}>
        Copia fedele del modulo che gira oggi sul sito. <b style={{ color: NAVY }}>Non salva e non invia niente</b>:
        serve a vederlo tutto insieme prima di cambiarlo.
      </div>

      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>{INTRO.titolo}</div>
      <div style={{ fontSize: 12, color: MUTED, margin: "4px 0 14px", lineHeight: 1.45 }}>{INTRO.sottotitolo}</div>

      {SEZIONI.map((s) => {
        const quanti = s.tipo === "testo" ? `${s.blocchi.length} punti`
          : s.tipo === "campi" ? `${s.campi.length} camp${s.campi.length === 1 ? "o" : "i"}`
          : "regolamento, immagini, privacy, firma";
        return (
          <Apribile
            key={s.chiave} titolo={s.titolo} sottotitolo={quanti}
            aperto={aperta === s.chiave}
            onToccata={() => setAperta(aperta === s.chiave ? null : s.chiave)}
          >
            {s.nota && <div style={{ fontSize: 12, color: MUTED, margin: "10px 0", lineHeight: 1.5 }}>{s.nota}</div>}

            {s.tipo === "testo" && (
              <div style={{ marginTop: 10 }}>
                {s.blocchi.map((b) => (
                  <Apribile
                    key={b.titolo} titolo={b.titolo} sottotitolo={`${b.punti.length} capoversi`}
                    aperto={puntoAperto === b.titolo}
                    onToccata={() => setPuntoAperto(puntoAperto === b.titolo ? null : b.titolo)}
                  >
                    {b.punti.map((p, i) => (
                      <p key={i} style={{ fontSize: 13, color: GRAFITE, lineHeight: 1.6, margin: "10px 0" }}>{p}</p>
                    ))}
                  </Apribile>
                ))}
              </div>
            )}

            {s.tipo === "campi" && (
              <div style={{ marginTop: 10 }}>
                {s.campi.map((c) => (
                  <div key={c.chiave + c.etichetta}>
                    {c.soloPer && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: GOLD, marginBottom: 4 }}>
                        Solo per {c.soloPer}
                      </div>
                    )}
                    <CampoDisegnato c={c} valore={risposte[c.chiave]} onCambia={metti(c.chiave)} />
                  </div>
                ))}
              </div>
            )}

            {s.tipo === "consensi" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{CONSENSI.regolamentoEtichetta}</div>
                <label style={{ fontSize: 13, color: GRAFITE, display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!risposte.regolamento} onChange={(e) => metti("regolamento")(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{CONSENSI.regolamentoSpunta}</span>
                </label>
                <p style={{ fontSize: 12.5, color: GRAFITE, lineHeight: 1.6, marginTop: 12, whiteSpace: "pre-line" }}>{CONSENSI.immaginiTesto}</p>

                <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY, margin: "16px 0 4px" }}>{CONSENSI.informativaEtichetta}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  {CONSENSI.informativaScelte.map((v) => (
                    <label key={v} style={{ fontSize: 13, color: GRAFITE, display: "flex", gap: 6, cursor: "pointer" }}>
                      <input type="radio" checked={risposte.informativa === v} onChange={() => metti("informativa")(v)} />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
                <div style={{
                  marginTop: 12, maxHeight: 220, overflowY: "auto",
                  border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 12, background: "#FCFBF8",
                }}>
                  {CONSENSI.informativaTesto.map((p, i) => (
                    <p key={i} style={{ fontSize: 12, color: GRAFITE, lineHeight: 1.6, margin: "8px 0" }}>{p}</p>
                  ))}
                </div>

                <div style={{ ...fontDisplay, fontSize: 13.5, fontWeight: 700, color: NAVY, margin: "16px 0 4px" }}>{CONSENSI.firmaEtichetta}</div>
                <div style={{
                  height: 90, border: `1px dashed ${CREAM_BORDER}`, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: MUTED, background: "#fff",
                }}>
                  qui si firma col dito
                </div>

                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 12 }}>{CONSENSI.notaObbligatori}</div>
                <div style={{
                  marginTop: 8, display: "inline-block", padding: "10px 18px", borderRadius: 12,
                  background: NAVY, color: "#fff", fontSize: 13, fontWeight: 700, opacity: 0.5,
                }}>
                  {CONSENSI.tastoInvio}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>(spento: questa è una copia, non invia)</div>
              </div>
            )}
          </Apribile>
        );
      })}
    </div>
  );
}
