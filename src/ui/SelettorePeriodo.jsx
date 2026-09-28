// Un periodo si sceglie sul calendario, non in due caselle.
//
// Chiesto il 28/09/2026: "invece di avere due caselle di inserimento?".
// Due campi data affiancati costringono a leggere due volte e a capire
// da soli se il secondo viene dopo il primo — e su un telefono aprono
// due volte la rotella di iOS. Qui si tocca il primo giorno, si tocca
// l'ultimo, e in mezzo si vede la striscia: il periodo si guarda invece
// di leggerlo.
//
// Regole che ne escono, e che il componente fa rispettare da solo:
//  - il secondo tocco prima del primo NON e' un errore: si rigira il
//    periodo. Chi sbaglia l'ordine voleva quelle due date, non un avviso.
//  - toccare lo stesso giorno due volte fa un periodo di un giorno, che
//    e' quello che serve a una fiera o a una notte d'albergo.
//  - finche' manca il secondo tocco il periodo NON e' cambiato: si
//    scrive solo quando e' completo, o un "dal" senza "al" andrebbe a
//    finire sul database a meta'.
import React, { useEffect, useRef, useState } from "react";
import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay } from "./stile.js";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MESI_CORTI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const GIORNI = ["L", "M", "M", "G", "V", "S", "D"];

// Le date qui sono GIORNI, non istanti: si lavora sulla stringa
// "2026-09-28" e si costruisce il Date a mezzogiorno UTC. Passando da
// `new Date("2026-09-28")` e poi da un fuso a ovest il giorno scivola
// indietro di uno, ed e' il difetto che ha gia' spento una pagina.
function aData(g) { return g ? new Date(`${g}T12:00:00Z`) : null; }
function aStringa(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function celleDelMese(anno, mese) {
  const primo = new Date(Date.UTC(anno, mese, 1, 12));
  // lunedì = 0: in Italia la settimana comincia di lunedì
  const salto = (primo.getUTCDay() + 6) % 7;
  const quanti = new Date(Date.UTC(anno, mese + 1, 0, 12)).getUTCDate();
  const celle = Array(salto).fill(null);
  for (let g = 1; g <= quanti; g++) celle.push(aStringa(new Date(Date.UTC(anno, mese, g, 12))));
  while (celle.length % 7 !== 0) celle.push(null);
  return celle;
}

export function etichettaPeriodo(da, a, { vuoto = "Scegli le date" } = {}) {
  if (!da && !a) return vuoto;
  const d = aData(da), f = aData(a || da);
  if (!d) return vuoto;
  const giorno = (x) => x.getUTCDate();
  const mese = (x) => MESI_CORTI[x.getUTCMonth()];
  const anno = (x) => x.getUTCFullYear();
  if (!a || da === a) return `${giorno(d)} ${mese(d)} ${anno(d)}`;
  if (anno(d) !== anno(f)) return `${giorno(d)} ${mese(d)} ${anno(d)} → ${giorno(f)} ${mese(f)} ${anno(f)}`;
  if (mese(d) !== mese(f)) return `${giorno(d)} ${mese(d)} → ${giorno(f)} ${mese(f)} ${anno(f)}`;
  return `${giorno(d)}–${giorno(f)} ${mese(f)} ${anno(f)}`;
}

export function quantiGiorniPeriodo(da, a) {
  if (!da) return 0;
  const d = aData(da), f = aData(a || da);
  return Math.round((f - d) / 86400000) + 1;
}

export default function SelettorePeriodo({
  da, a, onCambia, disabilitato = false, vuoto = "Scegli le date",
  minimo = null, stile, larghezzaMenu = 300,
}) {
  const [aperto, setAperto] = useState(false);
  // il primo tocco di una scelta in corso: finché c'è, il periodo vero
  // non è ancora cambiato
  const [ancora, setAncora] = useState(null);
  const [passa, setPassa] = useState(null); // il giorno sotto il dito/cursore
  const [mese, setMese] = useState(() => {
    const d = aData(da) || new Date();
    return { anno: d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear(), mese: d.getUTCMonth ? d.getUTCMonth() : d.getMonth() };
  });
  const scatola = useRef(null);

  useEffect(() => {
    if (!aperto) return undefined;
    const fuori = (e) => { if (scatola.current && !scatola.current.contains(e.target)) chiudi(); };
    const esc = (e) => { if (e.key === "Escape") chiudi(); };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [aperto]);

  function chiudi() { setAperto(false); setAncora(null); setPassa(null); }

  function apri() {
    if (disabilitato) return;
    const d = aData(da) || new Date();
    setMese({ anno: d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear(), mese: d.getUTCMonth ? d.getUTCMonth() : d.getMonth() });
    setAncora(null); setPassa(null); setAperto(true);
  }

  function tocca(giorno) {
    if (!giorno) return;
    if (minimo && giorno < minimo) return;
    if (!ancora) { setAncora(giorno); setPassa(giorno); return; }
    // il secondo tocco prima del primo rigira il periodo invece di
    // rifiutarlo: chi sbaglia l'ordine voleva quelle due date
    const inizio = giorno < ancora ? giorno : ancora;
    const fine = giorno < ancora ? ancora : giorno;
    onCambia({ da: inizio, a: fine });
    chiudi();
  }

  // quello che si vede mentre si sceglie: l'ancora e il giorno sotto il
  // dito, così la striscia cresce prima di aver deciso
  const inizioVisto = ancora ? (passa && passa < ancora ? passa : ancora) : da;
  const fineVisto = ancora ? (passa && passa < ancora ? ancora : passa || ancora) : (a || da);

  const celle = celleDelMese(mese.anno, mese.mese);
  const oggi = aStringa(new Date(Date.now() + new Date().getTimezoneOffset() * -60000));

  return (
    <div ref={scatola} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button" onClick={apri} disabled={disabilitato} data-niente-ombra
        style={{
          ...fontBody, fontSize: 14, fontWeight: da ? 700 : 400, textAlign: "left",
          width: "100%", minWidth: 0, boxSizing: "border-box",
          color: disabilitato ? MUTED : (da ? NAVY : MUTED),
          background: disabilitato ? "#EFEFEF" : "#fff",
          border: `1px solid ${aperto ? GOLD : CREAM_BORDER}`, borderRadius: 8,
          padding: "10px 12px", cursor: disabilitato ? "default" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
          ...stile,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {etichettaPeriodo(da, a, { vuoto })}
        </span>
        {da && a && da !== a && (
          <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, flexShrink: 0 }}>
            {quantiGiorniPeriodo(da, a)} gg
          </span>
        )}
      </button>

      {aperto && (
        <div style={{
          position: "absolute", zIndex: 60, top: "calc(100% + 6px)", left: 0,
          width: larghezzaMenu, maxWidth: "min(92vw, 360px)",
          background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14,
          boxShadow: "0 12px 30px -12px rgba(14,27,51,0.45)", padding: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button type="button" data-niente-ombra onClick={() => setMese((m) => (m.mese === 0 ? { anno: m.anno - 1, mese: 11 } : { ...m, mese: m.mese - 1 }))}
              style={frecciaStile}>‹</button>
            <span style={{ flex: 1, textAlign: "center", ...fontDisplay, fontSize: 14, fontWeight: 700, color: NAVY }}>
              {MESI[mese.mese]} {mese.anno}
            </span>
            <button type="button" data-niente-ombra onClick={() => setMese((m) => (m.mese === 11 ? { anno: m.anno + 1, mese: 0 } : { ...m, mese: m.mese + 1 }))}
              style={frecciaStile}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, marginBottom: 3 }}>
            {GIORNI.map((g, i) => (
              <div key={i} style={{ ...fontBody, fontSize: 10, fontWeight: 700, color: MUTED, textAlign: "center" }}>{g}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px 0" }}>
            {celle.map((g, i) => {
              if (!g) return <span key={i} />;
              const dentro = inizioVisto && fineVisto && g >= inizioVisto && g <= fineVisto;
              const estremo = g === inizioVisto || g === fineVisto;
              const spento = minimo && g < minimo;
              // la striscia: gli angoli tondi solo agli estremi, così i
              // giorni in mezzo si toccano e sembrano un nastro unico
              const primo = g === inizioVisto, ultimo = g === fineVisto;
              return (
                <button
                  key={i} type="button" data-niente-ombra disabled={spento}
                  onClick={() => tocca(g)}
                  onMouseEnter={() => ancora && setPassa(g)}
                  style={{
                    ...fontBody, fontSize: 12.5, fontWeight: estremo ? 700 : 400, lineHeight: 1,
                    height: 34, border: "none", padding: 0, cursor: spento ? "default" : "pointer",
                    background: estremo ? NAVY : dentro ? "#F3ECDD" : "transparent",
                    color: estremo ? "#fff" : spento ? "#C9CCD6" : NAVY,
                    opacity: spento ? 0.5 : 1,
                    borderRadius: estremo
                      ? (primo && ultimo ? 8 : primo ? "8px 0 0 8px" : "0 8px 8px 0")
                      : dentro ? 0 : 8,
                    outline: g === oggi && !estremo ? `1px solid ${GOLD}` : "none",
                    outlineOffset: -2,
                  }}
                >{Number(g.slice(8, 10))}</button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0, ...fontBody, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
              {ancora ? "Ora tocca l'ultimo giorno." : "Tocca il primo giorno, poi l'ultimo."}
            </span>
            {(da || a) && (
              <button type="button" data-niente-ombra onClick={() => { onCambia({ da: "", a: "" }); chiudi(); }}
                style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: "#C0392B", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                Cancella
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const frecciaStile = {
  width: 28, height: 28, borderRadius: "50%", border: `1px solid ${CREAM_BORDER}`,
  background: "#fff", color: NAVY, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0,
};
