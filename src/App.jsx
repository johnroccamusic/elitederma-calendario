import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || "";

const NAVY = "#0E1B33";
const CREAM_BORDER = "#E8E3D6";
const BG = "#FAF8F3";
const MUTED = "#8B8FA3";

const fontDisplay = { fontFamily: "'Quicksand',sans-serif", fontWeight: 500 };
const fontBody = { fontFamily: "'Jost',sans-serif" };

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GIORNI = ["L","M","M","G","V","S","D"];

function fmtData(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// genera la griglia di un mese come array di settimane (7 celle, null=padding)
function generaSettimane(anno, mese) {
  const primoGiorno = new Date(anno, mese, 1);
  const offset = (primoGiorno.getDay() + 6) % 7; // lunedì=0
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const celle = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let d = 1; d <= giorniMese; d++) celle.push(d);
  while (celle.length % 7 !== 0) celle.push(null);
  const settimane = [];
  for (let i = 0; i < celle.length; i += 7) settimane.push(celle.slice(i, i + 7));
  return settimane;
}
function dateStrFor(anno, mese, d) {
  return `${anno}-${String(mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// assegna una "corsia" (lane) a ciascun evento di una riga evitando sovrapposizioni
function assegnaLane(eventiRiga) {
  const lanes = [];
  return eventiRiga
    .slice()
    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
    .map((ev) => {
      let lane = 0;
      while (lanes[lane] && lanes[lane] >= ev.data_inizio) lane++;
      lanes[lane] = ev.data_fine;
      return { ...ev, lane };
    });
}

// sigle automobilistiche delle principali città italiane, per le etichette nel calendario
const SIGLE_CITTA = {
  "milano": "MI", "roma": "RM", "napoli": "NA", "torino": "TO", "bologna": "BO",
  "firenze": "FI", "verona": "VR", "venezia": "VE", "palermo": "PA", "genova": "GE",
  "bari": "BA", "catania": "CT", "padova": "PD", "bergamo": "BG", "brescia": "BS",
  "modena": "MO", "parma": "PR", "reggio emilia": "RE", "perugia": "PG", "cagliari": "CA",
  "ancona": "AN", "pescara": "PE", "trento": "TN", "bolzano": "BZ", "trieste": "TS",
  "udine": "UD", "rimini": "RN", "salerno": "SA", "livorno": "LI", "pisa": "PI",
  "siena": "SI", "lucca": "LU", "ravenna": "RA", "ferrara": "FE", "vicenza": "VI",
  "treviso": "TV", "como": "CO", "varese": "VA", "monza": "MB", "brindisi": "BR",
  "lecce": "LE", "taranto": "TA", "foggia": "FG", "messina": "ME", "siracusa": "SR",
  "sassari": "SS", "reggio calabria": "RC", "cosenza": "CS", "latina": "LT", "pavia": "PV",
  "piacenza": "PC", "cremona": "CR", "mantova": "MN", "novara": "NO", "asti": "AT",
  "cuneo": "CN", "aosta": "AO", "la spezia": "SP", "pistoia": "PT", "arezzo": "AR",
  "grosseto": "GR", "terni": "TR", "viterbo": "VT", "rieti": "RI", "frosinone": "FR",
  "campobasso": "CB", "potenza": "PZ", "matera": "MT", "avellino": "AV", "benevento": "BN",
  "caserta": "CE", "nuoro": "NU", "oristano": "OR", "imperia": "IM", "savona": "SV",
  "alessandria": "AL", "biella": "BI", "vercelli": "VC", "lodi": "LO", "sondrio": "SO",
  "belluno": "BL", "rovigo": "RO", "gorizia": "GO", "pordenone": "PN", "chieti": "CH",
  "teramo": "TE", "isernia": "IS", "l'aquila": "AQ", "macerata": "MC", "fermo": "FM",
  "pesaro": "PU", "prato": "PO", "massa": "MS",
};
function siglaCitta(nome) {
  if (!nome) return "";
  const s = SIGLE_CITTA[nome.trim().toLowerCase()];
  return s || nome.trim().slice(0, 2).toUpperCase();
}
// etichetta breve per le barre del calendario: nome corso (max 10 caratteri) + sigla città
function etichettaBarra(corso, loc) {
  const nome = (corso?.nome || "").slice(0, 10);
  return `${nome} ${siglaCitta(loc?.nome)}`;
}

// ---------- Card / pulsanti base ----------
function CardHome({ title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...fontBody,
        textAlign: "left",
        width: "100%",
        background: "#FFFFFF",
        border: `1px solid ${CREAM_BORDER}`,
        borderRadius: 14,
        padding: "20px 22px",
        marginBottom: 14,
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ ...fontDisplay, fontSize: 22, color: NAVY, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: MUTED }}>{sub}</div>
      </div>
      <div style={{ fontSize: 22, color: NAVY }}>&rsaquo;</div>
    </button>
  );
}

function Button({ children, onClick, variant = "primary", style = {}, disabled }) {
  const base = {
    ...fontBody,
    fontSize: 14,
    padding: "10px 18px",
    borderRadius: 10,
    cursor: disabled ? "default" : "pointer",
    border: "1px solid " + NAVY,
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: NAVY, color: "#fff" },
    ghost: { background: "transparent", color: NAVY },
    danger: { background: "#fff", color: "#C0392B", border: "1px solid #C0392B" },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  ...fontBody,
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${CREAM_BORDER}`,
  fontSize: 14,
};

// ---------- helper per i calcoli di imponibile/IVA/totale ----------
const PREZZO_MODELLA = 60;

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function parseNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}
// data una quota { imponibile, totale, metodo }, aggiorna l'imponibile e ricalcola il totale
// (o viceversa). applicaIva=false = nessun calcolo IVA (es. saldo pagato in contanti)
function conImponibileAggiornato(prev, valore, applicaIva) {
  const num = parseNum(valore);
  const totale = valore === "" ? "" : String(applicaIva ? round2(num * 1.22) : num);
  return { ...prev, imponibile: valore, totale };
}
function conTotaleAggiornato(prev, valore, applicaIva) {
  const num = parseNum(valore);
  const imponibile = valore === "" ? "" : String(applicaIva ? round2(num / 1.22) : num);
  return { ...prev, totale: valore, imponibile };
}
function ivaDiQuota(q) {
  if (q.imponibile === "" && q.totale === "") return "";
  return round2(parseNum(q.totale) - parseNum(q.imponibile)).toFixed(2);
}

// blocco Imponibile/IVA/Totale + metodo di pagamento per una singola quota
function BloccoQuota({ titolo, valori, onImponibile, onTotale, onMetodo, soloLettura }) {
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10, background: soloLettura ? BG : "#fff" }}>
      <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{titolo}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 90px" }}>
          <Field label="Imponibile">
            <input
              style={{ ...inputStyle, background: soloLettura ? "#EFEFEF" : "#fff", color: soloLettura ? MUTED : NAVY }}
              inputMode="decimal"
              value={valori.imponibile}
              disabled={soloLettura}
              onChange={(e) => onImponibile && onImponibile(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <Field label="IVA 22%">
            <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={ivaDiQuota(valori)} disabled />
          </Field>
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <Field label="Totale">
            <input
              style={{ ...inputStyle, background: soloLettura ? "#EFEFEF" : "#fff", color: soloLettura ? MUTED : NAVY }}
              inputMode="decimal"
              value={valori.totale}
              disabled={soloLettura}
              onChange={(e) => onTotale && onTotale(e.target.value)}
            />
          </Field>
        </div>
      </div>
      {onMetodo && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...fontBody, fontSize: 13, color: NAVY }}>
          {["Sito", "Bonifico", "Pos", "Contanti"].map((opz) => (
            <label key={opz} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="radio" name={titolo + "-metodo"} checked={valori.metodo === opz} onChange={() => onMetodo(opz)} />
              {opz}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
      <button onClick={onBack} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", fontSize: 20, color: NAVY }}>
        &larr;
      </button>
      <div style={{ ...fontDisplay, fontSize: 26, color: NAVY }}>{title}</div>
    </div>
  );
}

// ---------- Gate di accesso ----------
function Gate({ onOk }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const urlDebug = import.meta.env.VITE_SUPABASE_URL || "(VITE_SUPABASE_URL non impostata)";
  return (
    <div style={{ ...fontBody, maxWidth: 340, margin: "120px auto", textAlign: "center" }}>
      <div style={{ ...fontDisplay, fontSize: 24, color: NAVY, letterSpacing: 0.5 }}>CALENDARIO CORSI</div>
      <div style={{ ...fontDisplay, fontSize: 15, color: NAVY, marginBottom: 18, letterSpacing: 0.5 }}>ELITEDERMA</div>
      <input
        type="password"
        placeholder="Codice d'accesso"
        value={code}
        onChange={(e) => { setCode(e.target.value); setErr(false); }}
        style={{ ...inputStyle, textAlign: "center", marginBottom: 12 }}
        onKeyDown={(e) => e.key === "Enter" && check()}
      />
      <Button onClick={check} style={{ width: "100%" }}>Entra</Button>
      {err && <div style={{ color: "#C0392B", fontSize: 13, marginTop: 10 }}>Codice non corretto</div>}
      <div style={{ fontSize: 10, color: MUTED, marginTop: 30, wordBreak: "break-all" }}>
        Database collegato: {urlDebug}
      </div>
    </div>
  );
  function check() {
    if (!ACCESS_CODE || code === ACCESS_CODE) {
      sessionStorage.setItem("edc_ok", "1");
      onOk();
    } else setErr(true);
  }
}

// ---------- Impostazioni ----------
function Impostazioni({ corsi, location, corsiDate, ricarica, onBack }) {
  const [nomeCorso, setNomeCorso] = useState("");
  const [colore, setColore] = useState("#4A90D9");
  const [postiMax, setPostiMax] = useState(10);
  const [nomeLoc, setNomeLoc] = useState("");
  const [corsoSel, setCorsoSel] = useState("");
  const [locSel, setLocSel] = useState("");
  const [valoreDate, setValoreDate] = useState({ inizio: null, fine: null });
  const [postiData, setPostiData] = useState("");
  const [msg, setMsg] = useState("");

  const coloriUsati = useMemo(() => corsi.map((c) => c.colore.toLowerCase()), [corsi]);

  async function eliminaCorso(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Corso eliminato.");
    ricarica();
  }
  async function eliminaLocation(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("location").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Città eliminata.");
    ricarica();
  }
  async function eliminaData(id) {
    if (!window.confirm("Sei sicuro di voler cancellare questo dato?")) return;
    const { error } = await supabase.from("corsi_date").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setMsg("Data eliminata.");
    ricarica();
  }

  async function aggiungiCorso() {
    if (!nomeCorso.trim()) return;
    if (coloriUsati.includes(colore.toLowerCase())) {
      setMsg("Questo colore è già usato da un altro corso: scegline un altro.");
      return;
    }
    const { error } = await supabase.from("corsi").insert({ nome: nomeCorso.trim(), colore, posti_max: Number(postiMax) || 10 });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNomeCorso(""); setMsg("Corso aggiunto.");
    ricarica();
  }

  async function aggiungiLocation() {
    if (!nomeLoc.trim()) return;
    const { error } = await supabase.from("location").insert({ nome: nomeLoc.trim() });
    if (error) { setMsg("Errore: " + error.message); return; }
    setNomeLoc(""); setMsg("Location aggiunta.");
    ricarica();
  }

  async function aggiungiData() {
    if (!corsoSel || !locSel || !valoreDate.inizio) { setMsg("Seleziona corso, città e almeno un giorno sul calendario."); return; }
    const fine = valoreDate.fine || valoreDate.inizio;
    const { error } = await supabase.from("corsi_date").insert({
      corso_id: corsoSel,
      location_id: locSel,
      data_inizio: valoreDate.inizio,
      data_fine: fine,
      posti_max: postiData ? Number(postiData) : null,
    });
    if (error) { setMsg("Errore: " + error.message); return; }
    setValoreDate({ inizio: null, fine: null }); setPostiData(""); setMsg("Data aggiunta al calendario.");
    ricarica();
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Impostazioni" onBack={onBack} />

      <div style={cardStyle}>
        <div style={hStyle}>Aggiungi corso</div>
        <div style={subStyle}>Nome, colore univoco per il calendario, posti massimi di default.</div>
        <Field label="Nome corso">
          <input style={inputStyle} value={nomeCorso} onChange={(e) => setNomeCorso(e.target.value)} placeholder="es. Microblading" />
        </Field>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <Field label="Colore">
              <input type="color" value={colore} onChange={(e) => setColore(e.target.value)} style={{ width: "100%", height: 40, border: `1px solid ${CREAM_BORDER}`, borderRadius: 8 }} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Posti massimi">
              <input type="number" min="1" style={inputStyle} value={postiMax} onChange={(e) => setPostiMax(e.target.value)} />
            </Field>
          </div>
        </div>
        <Button onClick={aggiungiCorso}>Aggiungi corso</Button>
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Nuova location</div>
        <div style={subStyle}>Aggiungi una città in cui si terranno i corsi.</div>
        <Field label="Città">
          <input style={inputStyle} value={nomeLoc} onChange={(e) => setNomeLoc(e.target.value)} placeholder="es. Milano" />
        </Field>
        <Button onClick={aggiungiLocation}>Aggiungi location</Button>
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Aggiungi data</div>
        <div style={subStyle}>Crea una nuova edizione: corso + città + giorno.</div>
        <Field label="Corso">
          <select style={inputStyle} value={corsoSel} onChange={(e) => setCorsoSel(e.target.value)}>
            <option value="">Seleziona corso</option>
            {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Città">
          <select style={inputStyle} value={locSel} onChange={(e) => setLocSel(e.target.value)}>
            <option value="">Seleziona città</option>
            {location.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <SelettoreCalendario corsi={corsi} location={location} corsiDate={corsiDate} valore={valoreDate} onCambia={setValoreDate} />
        </Field>
        <Field label="Posti (opzionale)">
          <input type="number" min="1" style={inputStyle} value={postiData} onChange={(e) => setPostiData(e.target.value)} placeholder="usa il default del corso" />
        </Field>
        <Button onClick={aggiungiData}>Aggiungi data</Button>
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Corsi esistenti</div>
        <div style={subStyle}>Clicca il cestino per eliminare un corso (rimuove anche le sue date e i relativi iscritti).</div>
        {corsi.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessun corso ancora.</div>}
        {corsi.map((c) => (
          <RigaEliminabile
            key={c.id}
            label={<span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: c.colore, marginRight: 8 }} />{c.nome}</span>}
            dettaglio={`posti default: ${c.posti_max}`}
            onDelete={() => eliminaCorso(c.id)}
          />
        ))}
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Città esistenti</div>
        <div style={subStyle}>Clicca il cestino per eliminare una città (rimuove anche le date collegate a quella città).</div>
        {location.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna città ancora.</div>}
        {location.map((l) => (
          <RigaEliminabile key={l.id} label={l.nome} onDelete={() => eliminaLocation(l.id)} />
        ))}
      </div>

      <div style={cardStyle}>
        <div style={hStyle}>Date esistenti</div>
        <div style={subStyle}>Tutte le edizioni create finora, divise per città e corso. Clicca il cestino per eliminarne una (rimuove anche i suoi iscritti).</div>
        <DateRaggruppatePerCitta corsi={corsi} location={location} corsiDate={corsiDate} onDelete={eliminaData} />
      </div>

      {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

const cardStyle = { background: "#FFFFFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 14, padding: 22, marginBottom: 18 };
const hStyle = { ...fontDisplay, fontSize: 20, color: NAVY, margin: "0 0 4px" };
const subStyle = { ...fontBody, fontSize: 13, color: MUTED, marginBottom: 14 };

function RigaEliminabile({ label, dettaglio, onDelete }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${CREAM_BORDER}` }}>
      <div>
        <div style={{ ...fontBody, fontSize: 14, color: NAVY }}>{label}</div>
        {dettaglio && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{dettaglio}</div>}
      </div>
      <button
        onClick={onDelete}
        title="Elimina"
        style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 6, display: "flex", alignItems: "center" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  );
}

// Vista raggruppata: CITTÀ → corso → elenco date. Usata sia nella Home (sola lettura)
// che in Impostazioni (con cestino per eliminare).
function DateRaggruppatePerCitta({ corsi, location, corsiDate, iscritti, onApriData, onDelete }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const perCitta = {};
  corsiDate.forEach((cd) => {
    const locId = cd.location_id;
    if (!perCitta[locId]) perCitta[locId] = { nome: locById[locId]?.nome || "?", mesi: {} };
    const [anno, mese] = cd.data_inizio.split("-");
    const chiaveMese = `${anno}-${mese}`;
    if (!perCitta[locId].mesi[chiaveMese]) {
      perCitta[locId].mesi[chiaveMese] = { etichetta: `${MESI[parseInt(mese, 10) - 1]} ${anno}`, voci: [] };
    }
    perCitta[locId].mesi[chiaveMese].voci.push(cd);
  });
  const cittaOrdinate = Object.values(perCitta).sort((a, b) => a.nome.localeCompare(b.nome));

  if (corsiDate.length === 0) {
    return <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna data ancora.</div>;
  }

  return (
    <div>
      {cittaOrdinate.map((c) => (
        <div key={c.nome} style={{ marginBottom: 18 }}>
          <div style={{ ...fontDisplay, fontSize: 18, color: NAVY, marginBottom: 8, letterSpacing: 0.5 }}>{c.nome.toUpperCase()}</div>
          {Object.keys(c.mesi)
            .sort()
            .map((chiaveMese) => {
              const gruppoMese = c.mesi[chiaveMese];
              return (
                <div key={chiaveMese} style={{ marginBottom: 10 }}>
                  <div style={{ ...fontBody, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>
                    {gruppoMese.etichetta}
                  </div>
                  {gruppoMese.voci
                    .slice()
                    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                    .map((cd) => {
                      const corso = corsoById[cd.corso_id];
                      const dataEtichetta = cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`;
                      return onDelete ? (
                        <div key={cd.id} style={{ paddingLeft: 4 }}>
                          <RigaEliminabile
                            label={
                              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: corso?.colore || NAVY, flexShrink: 0 }} />
                                {corso?.nome || "?"} — {dataEtichetta}
                              </span>
                            }
                            onDelete={() => onDelete(cd.id)}
                          />
                        </div>
                      ) : (
                        <div
                          key={cd.id}
                          onClick={() => onApriData?.(cd)}
                          style={{ ...fontBody, fontSize: 13, color: MUTED, padding: "5px 4px", cursor: onApriData ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 420 }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: corso?.colore || NAVY, flexShrink: 0 }} />
                            <b style={{ color: NAVY, fontWeight: 500 }}>{corso?.nome || "?"}</b>
                            <span>— {dataEtichetta}</span>
                          </span>
                          {iscritti && (() => {
                            const max = cd.posti_max ?? corso?.posti_max ?? 0;
                            const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
                            const liberi = Math.max(0, max - occupati);
                            return <span>{liberi} post{liberi === 1 ? "o" : "i"}</span>;
                          })()}
                        </div>
                      );
                    })}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

// Selettore usato per spostare un iscritto: stessa struttura città→corso→date,
// ma cliccabile per scegliere la destinazione e con le date già al completo disattivate.
function SelettoreSpostamento({ corsi, location, corsiDate, iscritti, corsoDataEscluso, onScegli }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const disponibili = corsiDate.filter((cd) => cd.id !== corsoDataEscluso);
  const perCitta = {};
  disponibili.forEach((cd) => {
    const locId = cd.location_id;
    if (!perCitta[locId]) perCitta[locId] = { nome: locById[locId]?.nome || "?", corsi: {} };
    if (!perCitta[locId].corsi[cd.corso_id]) perCitta[locId].corsi[cd.corso_id] = { corso: corsoById[cd.corso_id], date: [] };
    perCitta[locId].corsi[cd.corso_id].date.push(cd);
  });
  const cittaOrdinate = Object.values(perCitta).sort((a, b) => a.nome.localeCompare(b.nome));

  if (disponibili.length === 0) {
    return <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Non ci sono altre date disponibili.</div>;
  }

  return (
    <div>
      {cittaOrdinate.map((c) => (
        <div key={c.nome} style={{ marginBottom: 16 }}>
          <div style={{ ...fontDisplay, fontSize: 16, color: NAVY, marginBottom: 6, letterSpacing: 0.5 }}>{c.nome.toUpperCase()}</div>
          {Object.values(c.corsi)
            .sort((a, b) => (a.corso?.nome || "").localeCompare(b.corso?.nome || ""))
            .map((gruppo) => (
              <div key={gruppo.corso?.id || Math.random()} style={{ marginBottom: 8, paddingLeft: 4 }}>
                <div style={{ ...fontBody, fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 3, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: gruppo.corso?.colore || NAVY, flexShrink: 0 }} />
                  {gruppo.corso?.nome || "?"}
                </div>
                {gruppo.date
                  .slice()
                  .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
                  .map((cd) => {
                    const max = cd.posti_max ?? gruppo.corso?.posti_max ?? 0;
                    const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
                    const liberi = Math.max(0, max - occupati);
                    const pieno = liberi <= 0;
                    return (
                      <div
                        key={cd.id}
                        onClick={() => !pieno && onScegli(cd, gruppo.corso, locById[cd.location_id])}
                        style={{
                          ...fontBody,
                          fontSize: 13,
                          color: pieno ? "#C9A9A9" : MUTED,
                          padding: "5px 8px",
                          marginLeft: 15,
                          borderRadius: 6,
                          cursor: pieno ? "default" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          maxWidth: 380,
                          background: pieno ? "#F6EFEF" : "transparent",
                        }}
                      >
                        <span>{cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}</span>
                        <span>{pieno ? "completo" : `${liberi} posti liberi`}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}


const LANE_H = 20; // altezza di ogni "corsia" di eventi (px)
const HEADER_H = 26; // spazio per il numero del giorno

// un singolo mese: titolo + griglia con le barre degli eventi
function MeseGriglia({ anno, mese, corsi, location, corsiDate, onApriData, corsoById, locById }) {
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const settimane = generaSettimane(anno, mese);
  function dateStr(d) { return dateStrFor(anno, mese, d); }

  const eventiMese = corsiDate.filter(
    (cd) => cd.data_inizio <= dateStr(giorniMese) && cd.data_fine >= dateStr(1)
  );

  return (
    <div style={{ marginBottom: 34 }}>
      <div style={{ ...fontDisplay, fontSize: 20, color: NAVY, marginBottom: 10 }}>{MESI[mese]} {anno}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {GIORNI.map((g, i) => <div key={i} style={{ ...fontBody, fontSize: 11, color: MUTED, textAlign: "center" }}>{g}</div>)}
      </div>

      {settimane.map((settimana, wi) => {
        const giorniValidi = settimana.filter((d) => d !== null);
        if (giorniValidi.length === 0) return null;
        const inizioRiga = dateStr(giorniValidi[0]);
        const fineRiga = dateStr(giorniValidi[giorniValidi.length - 1]);
        const eventiRiga = eventiMese.filter((ev) => ev.data_inizio <= fineRiga && ev.data_fine >= inizioRiga);
        const eventiConLane = assegnaLane(eventiRiga);
        const maxLane = eventiConLane.reduce((m, e) => Math.max(m, e.lane), -1);
        const rowHeight = HEADER_H + (maxLane + 1) * LANE_H + 6;

        return (
          <div key={wi} style={{ position: "relative", marginBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {settimana.map((d, i) => (
                <div key={i} style={{ border: d ? `1px solid ${CREAM_BORDER}` : "none", borderRadius: 8, height: rowHeight, background: d ? "#fff" : "transparent", boxSizing: "border-box" }}>
                  {d && <div style={{ ...fontBody, fontSize: 12, color: NAVY, padding: "4px 6px" }}>{d}</div>}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", top: HEADER_H, left: 0, right: 0, bottom: 0 }}>
              {eventiConLane.map((ev) => {
                const startIdx = settimana.findIndex((d) => d && dateStr(d) === ev.data_inizio);
                const colStart = startIdx >= 0 ? startIdx : 0;
                const endIdx = settimana.reduce((acc, d, idx) => (d && dateStr(d) <= ev.data_fine ? idx : acc), colStart);
                const colSpan = endIdx - colStart + 1;
                return (
                  <div
                    key={ev.id}
                    onClick={() => onApriData(ev)}
                    title={`${corsoById[ev.corso_id]?.nome} · ${locById[ev.location_id]?.nome}`}
                    style={{
                      position: "absolute",
                      top: ev.lane * LANE_H,
                      left: `calc(${(colStart / 7) * 100}% + 2px)`,
                      width: `calc(${(colSpan / 7) * 100}% - 4px)`,
                      height: LANE_H - 4,
                      background: corsoById[ev.corso_id]?.colore || NAVY,
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 500,
                      ...fontBody,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 6px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                    }}
                  >
                    {etichettaBarra(corsoById[ev.corso_id], locById[ev.location_id])}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Calendario({ corsi, location, corsiDate, onApriData, onBack }) {
  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  const oggi = new Date();
  // elenco continuo di mesi: da 6 mesi fa a 12 mesi avanti, così basta scorrere invece di usare frecce
  const mesi = useMemo(() => {
    const arr = [];
    for (let i = -6; i <= 12; i++) {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1);
      arr.push({ anno: d.getFullYear(), mese: d.getMonth() });
    }
    return arr;
  }, []);

  const refOggi = React.useRef(null);
  useEffect(() => {
    refOggi.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <TopBar title="Calendario" onBack={onBack} />
        <Button variant="ghost" onClick={() => refOggi.current?.scrollIntoView({ block: "start", behavior: "smooth" })}>Oggi</Button>
      </div>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginBottom: 16 }}>
        Scorri su o giù per vedere gli altri mesi. Ogni barra colorata è un corso — clicca per aprire iscritti e posti disponibili.
      </div>

      {mesi.map(({ anno, mese }) => (
        <div key={`${anno}-${mese}`} ref={anno === oggi.getFullYear() && mese === oggi.getMonth() ? refOggi : null}>
          <MeseGriglia anno={anno} mese={mese} corsi={corsi} location={location} corsiDate={corsiDate} onApriData={onApriData} corsoById={corsoById} locById={locById} />
        </div>
      ))}
    </div>
  );
}

// ---------- Selettore date dal calendario (per Aggiungi data) ----------
function SelettoreCalendario({ corsi, location, corsiDate, valore, onCambia }) {
  const [mese, setMese] = useState(new Date().getMonth());
  const [anno, setAnno] = useState(new Date().getFullYear());

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const settimane = generaSettimane(anno, mese);
  function dateStr(d) { return dateStrFor(anno, mese, d); }

  function clicGiorno(d) {
    const ds = dateStr(d);
    if (!valore.inizio || valore.fine) {
      onCambia({ inizio: ds, fine: null });
    } else if (ds < valore.inizio) {
      onCambia({ inizio: ds, fine: valore.inizio });
    } else {
      onCambia({ inizio: valore.inizio, fine: ds });
    }
  }

  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button type="button" onClick={() => { const m = mese - 1; if (m < 0) { setMese(11); setAnno(anno - 1); } else setMese(m); }} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY }}>&larr;</button>
        <div style={{ ...fontBody, fontSize: 13, color: NAVY, fontWeight: 500 }}>{MESI[mese]} {anno}</div>
        <button type="button" onClick={() => { const m = mese + 1; if (m > 11) { setMese(0); setAnno(anno + 1); } else setMese(m); }} style={{ ...fontBody, border: "none", background: "none", cursor: "pointer", color: NAVY }}>&rarr;</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
        {GIORNI.map((g, i) => <div key={i} style={{ ...fontBody, fontSize: 10, color: MUTED, textAlign: "center" }}>{g}</div>)}
      </div>

      {settimane.map((settimana, wi) => {
        const giorniValidi = settimana.filter((d) => d !== null);
        if (giorniValidi.length === 0) return null;
        const inizioRiga = dateStr(giorniValidi[0]);
        const fineRiga = dateStr(giorniValidi[giorniValidi.length - 1]);
        const eventiRiga = corsiDate.filter((ev) => ev.data_inizio <= fineRiga && ev.data_fine >= inizioRiga);
        const eventiConLane = assegnaLane(eventiRiga);
        const maxLane = eventiConLane.reduce((m, e) => Math.max(m, e.lane), -1);
        const barH = 15;
        const rowHeight = 20 + Math.max(0, maxLane + 1) * barH + 4;

        return (
          <div key={wi} style={{ position: "relative", marginBottom: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {settimana.map((d, i) => {
                if (!d) return <div key={i} style={{ height: rowHeight }} />;
                const ds = dateStr(d);
                const selezionato = valore.inizio && (
                  (valore.fine && ds >= valore.inizio && ds <= valore.fine) ||
                  (!valore.fine && ds === valore.inizio)
                );
                return (
                  <div
                    key={i}
                    onClick={() => clicGiorno(d)}
                    style={{
                      height: rowHeight,
                      borderRadius: 6,
                      background: selezionato ? "#D9E6F5" : "#fff",
                      border: `1px solid ${selezionato ? "#7FA8D9" : CREAM_BORDER}`,
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ ...fontBody, fontSize: 11, color: NAVY, padding: "2px 5px" }}>{d}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", top: 20, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
              {eventiConLane.map((ev) => {
                const startIdx = settimana.findIndex((d) => d && dateStr(d) === ev.data_inizio);
                const colStart = startIdx >= 0 ? startIdx : 0;
                const endIdx = settimana.reduce((acc, d, idx) => (d && dateStr(d) <= ev.data_fine ? idx : acc), colStart);
                const colSpan = endIdx - colStart + 1;
                return (
                  <div
                    key={ev.id}
                    title={`${corsoById[ev.corso_id]?.nome} · ${locById[ev.location_id]?.nome}`}
                    style={{
                      position: "absolute",
                      top: ev.lane * barH,
                      left: `calc(${(colStart / 7) * 100}% + 2px)`,
                      width: `calc(${(colSpan / 7) * 100}% - 4px)`,
                      height: barH - 3,
                      background: corsoById[ev.corso_id]?.colore || NAVY,
                      borderRadius: 3,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 500,
                      ...fontBody,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 4px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {etichettaBarra(corsoById[ev.corso_id], locById[ev.location_id])}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 8 }}>
        {!valore.inizio && "Clicca il primo giorno del corso."}
        {valore.inizio && !valore.fine && `Inizio: ${fmtData(valore.inizio)} — clicca l'ultimo giorno (o lo stesso giorno se dura un giorno solo).`}
        {valore.inizio && valore.fine && `Selezionato: ${fmtData(valore.inizio)}${valore.fine !== valore.inizio ? ` → ${fmtData(valore.fine)}` : ""}. Clicca un altro giorno per ricominciare.`}
      </div>
    </div>
  );
}

// ---------- Cerca corso ----------
function CercaCorso({ corsi, location, corsiDate, iscritti, onApriData, onBack }) {
  const [citta, setCitta] = useState("");
  const [corso, setCorso] = useState("");
  const [mese, setMese] = useState(""); // formato "YYYY-MM" dall'input type="month"
  const [tutti, setTutti] = useState(false);

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);

  // trasformo il mese selezionato in un intervallo primo/ultimo giorno per il confronto
  let meseInizio = null, meseFine = null;
  if (mese) {
    const [y, m] = mese.split("-").map(Number);
    meseInizio = `${mese}-01`;
    meseFine = `${mese}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  }

  const filtrati = corsiDate.filter((cd) => {
    if (!tutti) {
      if (citta && cd.location_id !== citta) return false;
      if (corso && cd.corso_id !== corso) return false;
      if (mese && !(cd.data_inizio <= meseFine && cd.data_fine >= meseInizio)) return false;
      if (!citta && !corso && !mese) return false;
    }
    return true;
  });

  // raggruppa per corso + città
  const gruppi = {};
  filtrati.forEach((cd) => {
    const key = cd.corso_id + "|" + cd.location_id;
    if (!gruppi[key]) gruppi[key] = [];
    gruppi[key].push(cd);
  });

  function postiLiberi(cd) {
    const max = cd.posti_max ?? corsoById[cd.corso_id]?.posti_max ?? 0;
    const occupati = iscritti.filter((i) => i.corso_data_id === cd.id).length;
    return Math.max(0, max - occupati);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Cerca corso" onBack={onBack} />

      <div style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Città">
            <select style={inputStyle} value={citta} onChange={(e) => { setCitta(e.target.value); setTutti(false); }}>
              <option value="">Tutte</option>
              {location.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Corso">
            <select style={inputStyle} value={corso} onChange={(e) => { setCorso(e.target.value); setTutti(false); }}>
              <option value="">Tutti</option>
              {corsi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <Field label="Mese">
            <input type="month" style={inputStyle} value={mese} onChange={(e) => { setMese(e.target.value); setTutti(false); }} />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Button variant={tutti ? "primary" : "ghost"} onClick={() => { setTutti(true); setCitta(""); setCorso(""); setMese(""); }}>Tutti i corsi</Button>
        </div>
      </div>

      {Object.keys(gruppi).length === 0 && (
        <div style={{ ...fontBody, color: MUTED, fontSize: 14 }}>Imposta un filtro oppure premi "Tutti i corsi" per vedere l'elenco.</div>
      )}

      {Object.entries(gruppi).map(([key, date]) => {
        const first = date[0];
        return (
          <div key={key} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: corsoById[first.corso_id]?.colore }} />
              <div style={hStyle}>{corsoById[first.corso_id]?.nome} · {locById[first.location_id]?.nome}</div>
            </div>
            {date.sort((a, b) => a.data_inizio.localeCompare(b.data_inizio)).map((cd) => (
              <div
                key={cd.id}
                onClick={() => onApriData(cd)}
                style={{ ...fontBody, fontSize: 14, color: NAVY, padding: "8px 4px", borderTop: `1px solid ${CREAM_BORDER}`, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
              >
                <span>{cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}</span>
                <span style={{ color: MUTED }}>{postiLiberi(cd)} posti liberi</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Cerca iscritto ----------
function CercaIscritto({ corsi, location, corsiDate, iscritti, onApriData, onBack }) {
  const [query, setQuery] = useState("");

  const corsoById = useMemo(() => Object.fromEntries(corsi.map((c) => [c.id, c])), [corsi]);
  const locById = useMemo(() => Object.fromEntries(location.map((l) => [l.id, l])), [location]);
  const corsoDataById = useMemo(() => Object.fromEntries(corsiDate.map((cd) => [cd.id, cd])), [corsiDate]);

  const q = query.trim().toLowerCase();
  const risultati = q
    ? iscritti.filter((i) => i.nome.toLowerCase().includes(q) || i.cognome.toLowerCase().includes(q))
    : [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title="Cerca iscritto" onBack={onBack} />
      <div style={cardStyle}>
        <Field label="Nome o cognome">
          <input
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="es. Rossi"
            autoFocus
          />
        </Field>
      </div>

      {q && risultati.length === 0 && (
        <div style={{ ...fontBody, fontSize: 14, color: MUTED }}>Nessun iscritto trovato con questo nome.</div>
      )}

      {risultati.map((i) => {
        const cd = corsoDataById[i.corso_data_id];
        if (!cd) return null;
        const corso = corsoById[cd.corso_id];
        const loc = locById[cd.location_id];
        return (
          <div
            key={i.id}
            onClick={() => onApriData(cd)}
            style={{ ...cardStyle, cursor: "pointer", padding: "16px 20px", marginBottom: 10 }}
          >
            <div style={{ ...fontBody, fontSize: 15, color: NAVY, fontWeight: 500, marginBottom: 3 }}>{i.nome} {i.cognome}</div>
            <div style={{ ...fontBody, fontSize: 13, color: MUTED, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: corso?.colore || NAVY, flexShrink: 0 }} />
              {corso?.nome || "?"} · {loc?.nome || "?"} · {cd.data_inizio === cd.data_fine ? fmtData(cd.data_inizio) : `${fmtData(cd.data_inizio)} → ${fmtData(cd.data_fine)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Scheda data (iscritti) ----------
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || "";

// link cliccabile a un allegato caricato nello storage "allegati-iscritti"
function AllegatoLink({ percorso, etichetta }) {
  const { data } = supabase.storage.from("allegati-iscritti").getPublicUrl(percorso);
  return (
    <a
      href={data.publicUrl}
      target="_blank"
      rel="noreferrer"
      style={{ ...fontBody, fontSize: 12, color: NAVY, textDecoration: "underline" }}
    >
      {etichetta}
    </a>
  );
}

function SchedaData({ corsoData, corsi, location, corsiDate, iscritti, ricarica, onBack }) {
  const [vista, setVista] = useState("lista"); // 'lista' | 'form'
  const [modificandoId, setModificandoId] = useState(null); // id dell'iscritto in modifica, null se è una nuova iscrizione

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [note, setNote] = useState("");
  const [tutor, setTutor] = useState("");
  const [telefono, setTelefono] = useState("");
  const QUOTA_VUOTA = { imponibile: "", totale: "", metodo: "" };
  const [pagAcconto, setPagAcconto] = useState(QUOTA_VUOTA);
  const [pagPrecorso, setPagPrecorso] = useState(QUOTA_VUOTA);
  const [pagSaldo, setPagSaldo] = useState(QUOTA_VUOTA);
  const [accordiCommerciali, setAccordiCommerciali] = useState("");
  const [richiedeModelle, setRichiedeModelle] = useState("");
  const [numeroModelle, setNumeroModelle] = useState("");
  const [fileIscrizione, setFileIscrizione] = useState(null);
  const [fileScreenAcconto, setFileScreenAcconto] = useState(null);
  const [fileScreenRecap, setFileScreenRecap] = useState(null);
  const [caricando, setCaricando] = useState(false);

  const [spostaIscrittoId, setSpostaIscrittoId] = useState(null); // id dell'iscritto per cui si sta scegliendo la nuova data
  const [msg, setMsg] = useState("");
  const [adminSbloccato, setAdminSbloccato] = useState(sessionStorage.getItem("edc_admin_ok") === "1");
  const [mostraGestione, setMostraGestione] = useState(false);

  const corso = corsi.find((c) => c.id === corsoData.corso_id);
  const loc = location.find((l) => l.id === corsoData.location_id);
  const listaIscritti = iscritti.filter((i) => i.corso_data_id === corsoData.id);
  const max = corsoData.posti_max ?? corso?.posti_max ?? 0;
  const liberi = Math.max(0, max - listaIscritti.length);

  function apriGestioneClasse() {
    if (mostraGestione) { setMostraGestione(false); return; }
    if (adminSbloccato) { setMostraGestione(true); return; }
    const codice = window.prompt("Codice amministratore per aprire la gestione classe:");
    if (codice === null) return;
    if (ADMIN_CODE && codice === ADMIN_CODE) {
      sessionStorage.setItem("edc_admin_ok", "1");
      setAdminSbloccato(true);
      setMostraGestione(true);
    } else {
      window.alert("Codice non corretto.");
    }
  }

  // carica un file nello storage "allegati-iscritti" e restituisce il percorso salvato
  async function caricaAllegato(file, prefisso) {
    if (!file) return null;
    const percorso = `${corsoData.id}/${prefisso}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("allegati-iscritti").upload(percorso, file);
    if (error) throw error;
    return percorso;
  }

  function resetCampi() {
    setNome(""); setCognome(""); setNote(""); setTutor(""); setTelefono("");
    setPagAcconto(QUOTA_VUOTA); setPagPrecorso(QUOTA_VUOTA); setPagSaldo(QUOTA_VUOTA);
    setAccordiCommerciali(""); setRichiedeModelle(""); setNumeroModelle("");
    setFileIscrizione(null); setFileScreenAcconto(null); setFileScreenRecap(null);
  }

  function apriIscrizione() {
    resetCampi();
    setModificandoId(null);
    setMsg("");
    setVista("form");
  }

  function apriModificaCompleta(i) {
    setNome(i.nome); setCognome(i.cognome); setNote(i.note || "");
    setTutor(i.tutor || ""); setTelefono(i.telefono || "");
    setPagAcconto({
      imponibile: i.acconto_imponibile != null ? String(i.acconto_imponibile) : "",
      totale: i.acconto_totale != null ? String(i.acconto_totale) : "",
      metodo: i.acconto_metodo || "",
    });
    setPagPrecorso({
      imponibile: i.precorso_imponibile != null ? String(i.precorso_imponibile) : "",
      totale: i.precorso_totale != null ? String(i.precorso_totale) : "",
      metodo: i.precorso_metodo || "",
    });
    setPagSaldo({
      imponibile: i.saldo_imponibile != null ? String(i.saldo_imponibile) : "",
      totale: i.saldo_totale != null ? String(i.saldo_totale) : "",
      metodo: i.saldo_metodo || "",
    });
    setAccordiCommerciali(i.accordi_commerciali || "");
    setRichiedeModelle(i.richiede_modelle === true ? "si" : i.richiede_modelle === false ? "no" : "");
    setNumeroModelle(i.numero_modelle != null ? String(i.numero_modelle) : "");
    setFileIscrizione(null); setFileScreenAcconto(null); setFileScreenRecap(null);
    setModificandoId(i.id);
    setMsg("");
    setVista("form");
  }

  function annullaForm() {
    resetCampi();
    setModificandoId(null);
    setMsg("");
    setVista("lista");
  }

  async function salvaIscritto() {
    if (!nome.trim() || !cognome.trim()) { setMsg("Inserisci nome e cognome."); return; }
    if (!modificandoId && liberi <= 0) { setMsg("Nessun posto disponibile su questa data."); return; }
    setCaricando(true);
    try {
      const originale = modificandoId ? iscritti.find((x) => x.id === modificandoId) : null;
      const [pathIscrizione, pathAcconto, pathRecap] = await Promise.all([
        fileIscrizione ? caricaAllegato(fileIscrizione, "modulo") : Promise.resolve(originale?.file_iscrizione ?? null),
        fileScreenAcconto ? caricaAllegato(fileScreenAcconto, "acconto") : Promise.resolve(originale?.file_screen_acconto ?? null),
        fileScreenRecap ? caricaAllegato(fileScreenRecap, "recap") : Promise.resolve(originale?.file_screen_recap ?? null),
      ]);
      const payload = {
        nome: nome.trim(),
        cognome: cognome.trim(),
        note: note.trim() || null,
        tutor: tutor.trim() || null,
        telefono: telefono.trim() || null,
        acconto_imponibile: pagAcconto.imponibile === "" ? null : parseNum(pagAcconto.imponibile),
        acconto_totale: pagAcconto.totale === "" ? null : parseNum(pagAcconto.totale),
        acconto_metodo: pagAcconto.metodo || null,
        precorso_imponibile: pagPrecorso.imponibile === "" ? null : parseNum(pagPrecorso.imponibile),
        precorso_totale: pagPrecorso.totale === "" ? null : parseNum(pagPrecorso.totale),
        precorso_metodo: pagPrecorso.metodo || null,
        saldo_imponibile: pagSaldo.imponibile === "" ? null : parseNum(pagSaldo.imponibile),
        saldo_totale: pagSaldo.totale === "" ? null : parseNum(pagSaldo.totale),
        saldo_metodo: pagSaldo.metodo || null,
        accordi_commerciali: accordiCommerciali.trim() || null,
        richiede_modelle: richiedeModelle === "" ? null : richiedeModelle === "si",
        numero_modelle: richiedeModelle === "si" && numeroModelle !== "" ? parseInt(numeroModelle, 10) : null,
        file_iscrizione: pathIscrizione,
        file_screen_acconto: pathAcconto,
        file_screen_recap: pathRecap,
      };
      let error;
      if (modificandoId) {
        ({ error } = await supabase.from("iscritti").update(payload).eq("id", modificandoId));
      } else {
        payload.corso_data_id = corsoData.id;
        ({ error } = await supabase.from("iscritti").insert(payload));
      }
      if (error) { setMsg("Errore: " + error.message); return; }
      setMsg(modificandoId ? "Iscritto aggiornato." : "Iscritto aggiunto.");
      resetCampi();
      setModificandoId(null);
      setVista("lista");
      ricarica();
    } catch (e) {
      setMsg("Errore nel caricamento allegati: " + e.message);
    } finally {
      setCaricando(false);
    }
  }

  async function elimina(id) {
    if (!window.confirm("Sei sicuro di voler cancellare in modo definitivo l'allievo?")) return;
    const { error } = await supabase.from("iscritti").delete().eq("id", id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function toggleIncassato(i) {
    const { error } = await supabase.from("iscritti").update({ incassato: !i.incassato }).eq("id", i.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    ricarica();
  }

  async function eseguiSpostamento(iscritto, cdTarget, corsoTarget, locTarget) {
    const etichetta = cdTarget.data_inizio === cdTarget.data_fine ? fmtData(cdTarget.data_inizio) : `${fmtData(cdTarget.data_inizio)} → ${fmtData(cdTarget.data_fine)}`;
    if (!window.confirm(`Spostare ${iscritto.nome} ${iscritto.cognome} su ${corsoTarget?.nome || "?"} · ${locTarget?.nome || "?"} · ${etichetta}?`)) return;
    const { error } = await supabase.from("iscritti").update({ corso_data_id: cdTarget.id }).eq("id", iscritto.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    setSpostaIscrittoId(null);
    setMsg("Iscritto spostato.");
    ricarica();
  }

  const [postiLocali, setPostiLocali] = useState(max);
  useEffect(() => { setPostiLocali(max); }, [corsoData.id, max]);

  function cambiaPostiLocali(delta) {
    setPostiLocali((p) => Math.max(listaIscritti.length, p + delta));
  }

  async function confermaPosti() {
    const { error } = await supabase.from("corsi_date").update({ posti_max: postiLocali }).eq("id", corsoData.id);
    if (error) { setMsg("Errore: " + error.message); return; }
    await ricarica();
    setMsg("Posti aggiornati.");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <TopBar title={`${corso?.nome || ""} · ${loc?.nome || ""}`} onBack={onBack} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <div style={{ ...fontBody, color: MUTED, fontSize: 14 }}>
          {corsoData.data_inizio === corsoData.data_fine ? fmtData(corsoData.data_inizio) : `${fmtData(corsoData.data_inizio)} → ${fmtData(corsoData.data_fine)}`} — {liberi} posti liberi su {max}
        </div>
        {vista === "lista" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={mostraGestione ? "primary" : "ghost"} onClick={apriGestioneClasse}>
              {mostraGestione ? "Esci da gestione classe" : "Gestione classe"}
            </Button>
            {!mostraGestione && (
              <Button onClick={apriIscrizione} disabled={liberi <= 0} title={liberi <= 0 ? "Nessun posto disponibile" : ""}>
                {liberi <= 0 ? "Completo" : "Iscrivi"}
              </Button>
            )}
          </div>
        ) : (
          <Button variant="ghost" onClick={annullaForm}>&larr; Torna alla lista</Button>
        )}
      </div>

      {vista === "lista" && mostraGestione && (
        <div style={{ ...fontDisplay, fontSize: 20, fontWeight: 700, color: NAVY, textAlign: "center", textTransform: "uppercase", letterSpacing: 1, marginBottom: 18 }}>
          Gestione classe
        </div>
      )}

      {vista === "form" && (
        <div style={cardStyle}>
          <div style={hStyle}>{modificandoId ? "Modifica iscritto" : "Iscrivi allievo"}</div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Field label="Nome"><input style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Cognome"><input style={inputStyle} value={cognome} onChange={(e) => setCognome(e.target.value)} /></Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <Field label="Tutor"><input style={inputStyle} value={tutor} onChange={(e) => setTutor(e.target.value)} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Numero di telefono"><input style={inputStyle} value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field>
            </div>
          </div>
          <BloccoQuota
            titolo="Quota acconto"
            valori={pagAcconto}
            onImponibile={(v) => setPagAcconto((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagAcconto((prev) => conTotaleAggiornato(prev, v, true))}
            onMetodo={(v) => setPagAcconto((prev) => ({ ...prev, metodo: v }))}
          />
          <BloccoQuota
            titolo="Quota pre corso"
            valori={pagPrecorso}
            onImponibile={(v) => setPagPrecorso((prev) => conImponibileAggiornato(prev, v, true))}
            onTotale={(v) => setPagPrecorso((prev) => conTotaleAggiornato(prev, v, true))}
            onMetodo={(v) => setPagPrecorso((prev) => ({ ...prev, metodo: v }))}
          />
          <BloccoQuota
            titolo="Da avere al corso"
            valori={pagSaldo}
            onImponibile={(v) => setPagSaldo((prev) => conImponibileAggiornato(prev, v, prev.metodo !== "Contanti"))}
            onTotale={(v) => setPagSaldo((prev) => conTotaleAggiornato(prev, v, prev.metodo !== "Contanti"))}
            onMetodo={(v) =>
              setPagSaldo((prev) => {
                const applicaIva = v !== "Contanti";
                const imp = parseNum(prev.imponibile);
                const totale = prev.imponibile === "" ? "" : String(applicaIva ? round2(imp * 1.22) : imp);
                return { ...prev, metodo: v, totale };
              })
            }
          />
          <BloccoQuota
            titolo="Totale pagato"
            soloLettura
            valori={{
              imponibile: (parseNum(pagAcconto.imponibile) + parseNum(pagPrecorso.imponibile) + parseNum(pagSaldo.imponibile)).toFixed(2),
              totale: (parseNum(pagAcconto.totale) + parseNum(pagPrecorso.totale) + parseNum(pagSaldo.totale)).toFixed(2),
            }}
          />
          <Field label="Accordi commerciali">
            <input style={inputStyle} value={accordiCommerciali} onChange={(e) => setAccordiCommerciali(e.target.value)} />
          </Field>
          <Field label="Richiede modelle a pagamento?">
            <div style={{ display: "flex", gap: 16, ...fontBody, fontSize: 14, color: NAVY }}>
              {[["si", "Sì"], ["no", "No"]].map(([val, lab]) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="richiedeModelle" checked={richiedeModelle === val} onChange={() => setRichiedeModelle(val)} />
                  {lab}
                </label>
              ))}
            </div>
          </Field>

          {richiedeModelle === "si" && (
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <Field label="Quante modelle">
                  <input type="number" min="0" style={inputStyle} value={numeroModelle} onChange={(e) => setNumeroModelle(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Da pagare per modelle">
                  <input style={{ ...inputStyle, background: "#EFEFEF", color: MUTED }} value={numeroModelle === "" ? "" : (parseNum(numeroModelle) * 60).toFixed(2)} disabled />
                </Field>
              </div>
            </div>
          )}

          <Field label="Modulo iscrizione (PDF)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_iscrizione && !fileIscrizione && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_iscrizione} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="application/pdf,image/*" style={inputStyle} onChange={(e) => setFileIscrizione(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Screen acconto (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_acconto && !fileScreenAcconto && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_acconto} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setFileScreenAcconto(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Screen di recap (opzionale)">
            {modificandoId && iscritti.find((x) => x.id === modificandoId)?.file_screen_recap && !fileScreenRecap && (
              <div style={{ marginBottom: 6 }}>Attuale: <AllegatoLink percorso={iscritti.find((x) => x.id === modificandoId).file_screen_recap} etichetta="apri il file" /> — scegline uno nuovo per sostituirlo</div>
            )}
            <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setFileScreenRecap(e.target.files?.[0] || null)} />
          </Field>
          <Field label="Note (opzionale)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={salvaIscritto} disabled={caricando}>
              {caricando ? "Caricamento…" : modificandoId ? "Salva modifiche" : "Aggiungi iscritto"}
            </Button>
            <Button variant="ghost" onClick={annullaForm}>Annulla</Button>
          </div>
          {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY, marginTop: 10 }}>{msg}</div>}
        </div>
      )}

      {vista === "lista" && (
        <>
          <div style={cardStyle}>
            <div style={hStyle}>Iscritti ({listaIscritti.length})</div>
            {listaIscritti.length === 0 && <div style={{ ...fontBody, color: MUTED, fontSize: 14 }}>Nessun iscritto ancora. Usa "Iscrivi" in alto per aggiungerne uno.</div>}
            {listaIscritti.map((i, idx) => (
              <div key={i.id} style={{ borderTop: `1px solid ${CREAM_BORDER}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div
                    onClick={() => apriModificaCompleta(i)}
                    title="Clicca per modificare i dati dell'iscritto"
                    style={{ ...fontBody, fontSize: 17, fontWeight: 700, color: NAVY, cursor: "pointer", display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>{idx + 1}.</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{i.nome} {i.cognome}</span>
                    {i.tutor && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>· Tutor: {i.tutor}</span>}
                    {i.note && <span style={{ fontSize: 12, fontWeight: 400, color: MUTED }}>({i.note})</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <Button variant="ghost" onClick={() => setSpostaIscrittoId(spostaIscrittoId === i.id ? null : i.id)} style={{ padding: "6px 12px", fontSize: 13 }}>
                      Sposta
                    </Button>
                    <button
                      onClick={() => elimina(i.id)}
                      title="Elimina"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, flexShrink: 0, display: "flex", alignItems: "center" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {spostaIscrittoId === i.id && (
                  <div style={{ marginTop: 10, padding: 14, border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, background: BG }}>
                    <div style={{ ...fontBody, fontSize: 13, color: NAVY, fontWeight: 500, marginBottom: 10 }}>Scegli il nuovo corso/data per {i.nome} {i.cognome}:</div>
                    <SelettoreSpostamento
                      corsi={corsi}
                      location={location}
                      corsiDate={corsiDate}
                      iscritti={iscritti}
                      corsoDataEscluso={corsoData.id}
                      onScegli={(cd, corsoTarget, locTarget) => eseguiSpostamento(i, cd, corsoTarget, locTarget)}
                    />
                    <Button variant="ghost" onClick={() => setSpostaIscrittoId(null)} style={{ marginTop: 8 }}>Annulla</Button>
                  </div>
                )}
                {mostraGestione && (
                  <>
                    <div style={{ ...fontBody, fontSize: 13, color: MUTED, marginTop: 8, padding: "10px 12px", background: BG, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                      {i.tutor && <div><b style={{ color: NAVY }}>Tutor:</b> {i.tutor}</div>}
                      {i.telefono && <div><b style={{ color: NAVY }}>Telefono:</b> {i.telefono}</div>}
                      {i.acconto_totale != null && <div><b style={{ color: NAVY }}>Acconto:</b> {i.acconto_imponibile} € imp. → {i.acconto_totale} € tot. ({i.acconto_metodo || "?"})</div>}
                      {i.precorso_totale != null && <div><b style={{ color: NAVY }}>Pre corso:</b> {i.precorso_imponibile} € imp. → {i.precorso_totale} € tot. ({i.precorso_metodo || "?"})</div>}
                      {i.saldo_totale != null && <div><b style={{ color: NAVY }}>Da avere al corso:</b> {i.saldo_imponibile} € imp. → {i.saldo_totale} € tot. ({i.saldo_metodo || "?"})</div>}
                      {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
                        <div><b style={{ color: NAVY }}>Totale pagato:</b> {round2((i.acconto_imponibile || 0) + (i.precorso_imponibile || 0) + (i.saldo_imponibile || 0))} € imp. → {round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0))} € tot.</div>
                      )}
                      {i.richiede_modelle !== null && i.richiede_modelle !== undefined && (
                        <div><b style={{ color: NAVY }}>Richiede modelle:</b> {i.richiede_modelle ? "Sì" : "No"}</div>
                      )}
                      {i.richiede_modelle && i.numero_modelle != null && (
                        <div><b style={{ color: NAVY }}>Modelle da pagare:</b> {i.numero_modelle} × 60 € = {round2(i.numero_modelle * 60)} €</div>
                      )}
                      {i.accordi_commerciali && <div style={{ gridColumn: "1 / -1" }}><b style={{ color: NAVY }}>Accordi commerciali:</b> {i.accordi_commerciali}</div>}
                      {(i.file_iscrizione || i.file_screen_acconto || i.file_screen_recap) && (
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
                          {i.file_iscrizione && <AllegatoLink percorso={i.file_iscrizione} etichetta="Modulo iscrizione" />}
                          {i.file_screen_acconto && <AllegatoLink percorso={i.file_screen_acconto} etichetta="Screen acconto" />}
                          {i.file_screen_recap && <AllegatoLink percorso={i.file_screen_recap} etichetta="Screen recap" />}
                        </div>
                      )}
                      {!i.tutor && !i.telefono && i.acconto_totale == null && i.precorso_totale == null && i.saldo_totale == null && !i.accordi_commerciali && !i.file_iscrizione && (
                        <div style={{ gridColumn: "1 / -1" }}>Nessun dato di vendita registrato per questo iscritto.</div>
                      )}
                    </div>
                    {(i.saldo_totale != null || i.numero_modelle != null) && (() => {
                      const daIncassare = round2((i.saldo_totale || 0) + (i.numero_modelle || 0) * 60);
                      const aPosto = i.incassato || daIncassare === 0;
                      const colore = aPosto ? "#2E7D32" : "#C0392B";
                      return (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: aPosto ? "#E8F5E9" : "#FDECEC",
                            border: `1px solid ${colore}`,
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: colore }}>
                            DA INCASSARE {daIncassare} €
                          </div>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...fontBody, fontSize: 12, color: colore }}>
                            <input type="checkbox" checked={!!i.incassato} onChange={() => toggleIncassato(i)} style={{ width: 22, height: 22, cursor: "pointer" }} />
                            incassato
                          </label>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ))}
          </div>
          {msg && <div style={{ ...fontBody, fontSize: 13, color: NAVY }}>{msg}</div>}

          {mostraGestione ? (
            <div style={cardStyle}>
              <Button onClick={() => window.print()} style={{ width: "100%" }}>Stampa elenco classe</Button>
            </div>
          ) : (
            <div style={cardStyle}>
              <div style={hStyle}>Posti in classe</div>
              <div style={subStyle}>Aumenta o riduci il numero massimo di posti per questa specifica data.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => cambiaPostiLocali(-1)}
                  disabled={postiLocali <= listaIscritti.length}
                  style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, fontSize: 20, cursor: postiLocali <= listaIscritti.length ? "default" : "pointer", opacity: postiLocali <= listaIscritti.length ? 0.35 : 1 }}
                >
                  −
                </button>
                <div style={{ ...fontDisplay, fontSize: 26, color: NAVY, minWidth: 40, textAlign: "center" }}>{postiLocali}</div>
                <button
                  type="button"
                  onClick={() => cambiaPostiLocali(1)}
                  style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${NAVY}`, background: NAVY, color: "#fff", fontSize: 20, cursor: "pointer" }}
                >
                  +
                </button>
                <Button onClick={confermaPosti} disabled={postiLocali === max} style={{ marginLeft: 6 }}>
                  Conferma
                </Button>
              </div>
            </div>
          )}

          {mostraGestione && (
            <div
              className="stampa-classe"
              style={{ position: "absolute", left: "-9999px", top: 0, width: 700, background: "#fff", padding: 24, fontFamily: "'Jost',sans-serif", color: "#000" }}
            >
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, marginBottom: 24, textTransform: "uppercase" }}>
                Contabilità corso {corso?.nome} {loc?.nome} {corsoData.data_inizio === corsoData.data_fine ? fmtData(corsoData.data_inizio) : `${fmtData(corsoData.data_inizio)} – ${fmtData(corsoData.data_fine)}`}
              </div>
              {listaIscritti.length === 0 && <div>Nessun iscritto.</div>}
              {listaIscritti.map((i, idx) => (
                <div key={i.id} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #ccc" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{idx + 1}. {i.nome} {i.cognome}</div>
                  {i.tutor && <div>Tutor: {i.tutor}</div>}
                  {i.telefono && <div>Telefono: {i.telefono}</div>}
                  {i.acconto_totale != null && <div>Acconto: {i.acconto_imponibile} € imp. → {i.acconto_totale} € tot. ({i.acconto_metodo || "?"})</div>}
                  {i.precorso_totale != null && <div>Pre corso: {i.precorso_imponibile} € imp. → {i.precorso_totale} € tot. ({i.precorso_metodo || "?"})</div>}
                  {i.saldo_totale != null && <div>Da avere al corso: {i.saldo_imponibile} € imp. → {i.saldo_totale} € tot. ({i.saldo_metodo || "?"})</div>}
                  {(i.acconto_totale != null || i.precorso_totale != null || i.saldo_totale != null) && (
                    <div style={{ fontWeight: 700 }}>Totale pagato: {round2((i.acconto_imponibile || 0) + (i.precorso_imponibile || 0) + (i.saldo_imponibile || 0))} € imp. → {round2((i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0))} € tot.</div>
                  )}
                  {i.richiede_modelle !== null && i.richiede_modelle !== undefined && <div>Richiede modelle: {i.richiede_modelle ? "Sì" : "No"}</div>}
                  {i.richiede_modelle && i.numero_modelle != null && <div>Modelle da pagare: {i.numero_modelle} × 60 € = {round2(i.numero_modelle * 60)} €</div>}
                  {(i.saldo_totale != null || i.numero_modelle != null) && (
                    <div style={{ fontWeight: 700 }}>
                      Da incassare: {round2((i.saldo_totale || 0) + (i.numero_modelle || 0) * 60)} € — {i.incassato ? "INCASSATO" : "NON INCASSATO"}
                    </div>
                  )}
                  {i.accordi_commerciali && <div>Accordi commerciali: {i.accordi_commerciali}</div>}
                  {i.note && <div>Note: {i.note}</div>}
                </div>
              ))}
              {listaIscritti.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 12, borderTop: "2px solid #000", fontWeight: 700, fontSize: 15 }}>
                  <div>Totale generale classe: {round2(listaIscritti.reduce((s, i) => s + (i.acconto_imponibile || 0) + (i.precorso_imponibile || 0) + (i.saldo_imponibile || 0), 0))} € imp. → {round2(listaIscritti.reduce((s, i) => s + (i.acconto_totale || 0) + (i.precorso_totale || 0) + (i.saldo_totale || 0), 0))} € tot.</div>
                  <div style={{ marginTop: 6 }}>Totale ancora da incassare: {round2(listaIscritti.reduce((s, i) => s + (i.incassato ? 0 : (i.saldo_totale || 0) + (i.numero_modelle || 0) * 60), 0))} €</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- App principale ----------
export default function App() {
  const [ok, setOk] = useState(sessionStorage.getItem("edc_ok") === "1");
  const [view, setView] = useState("home");
  const [corsoDataAperta, setCorsoDataAperta] = useState(null);
  const [corsi, setCorsi] = useState([]);
  const [location, setLocation] = useState([]);
  const [corsiDate, setCorsiDate] = useState([]);
  const [iscritti, setIscritti] = useState([]);
  const [loading, setLoading] = useState(true);

  // fetch "silenzioso": ricarica i dati senza mostrare la schermata di caricamento
  // (usato dopo ogni modifica, così l'app non "sparisce" per un attimo)
  async function fetchDati() {
    const [c, l, cd, i] = await Promise.all([
      supabase.from("corsi").select("*").order("nome"),
      supabase.from("location").select("*").order("nome"),
      supabase.from("corsi_date").select("*").order("data_inizio"),
      supabase.from("iscritti").select("*").order("ts"),
    ]);
    setCorsi(c.data || []);
    setLocation(l.data || []);
    setCorsiDate(cd.data || []);
    setIscritti(i.data || []);
  }

  async function caricaIniziale() {
    setLoading(true);
    await fetchDati();
    setLoading(false);
  }

  useEffect(() => { if (ok) caricaIniziale(); }, [ok]);

  // swipe da sinistra a destra su mobile → torna alla home (come i pulsanti "indietro")
  useEffect(() => {
    let startX = 0, startY = 0, tracking = false;
    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }
    function onTouchEnd(e) {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (view !== "home" && dx > 80 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        setView("home");
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [view]);

  if (!ok) return <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}><Gate onOk={() => setOk(true)} /></div>;

  if (loading) {
    return (
      <div style={{ ...fontBody, background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
        Caricamento…
      </div>
    );
  }

  function apriData(cd) {
    setCorsoDataAperta(cd.id);
    setView("scheda");
  }
  const corsoDataApertaObj = corsiDate.find((cd) => cd.id === corsoDataAperta) || null;

  return (
    <div style={{ ...fontBody, background: BG, minHeight: "100vh" }}>
      {view === "home" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px" }}>
          <div style={{ ...fontDisplay, fontSize: 28, color: NAVY, textAlign: "center", letterSpacing: 0.5 }}>CALENDARIO CORSI</div>
          <div style={{ ...fontDisplay, fontSize: 17, color: NAVY, marginBottom: 30, textAlign: "center", letterSpacing: 0.5 }}>ELITEDERMA</div>
          <CardHome title="Calendario" sub="Vista mensile con tutte le edizioni" onClick={() => setView("calendario")} />
          <CardHome title="Cerca corso" sub="Per città, data o corso" onClick={() => setView("cerca")} />
          <CardHome title="Cerca iscritto" sub="Trova in quale corso è iscritto" onClick={() => setView("cercaiscritto")} />
          <CardHome title="Crea data/location" sub="Corsi, location e nuove date" onClick={() => setView("impostazioni")} />

          <div style={{ ...fontDisplay, fontSize: 20, color: NAVY, margin: "34px 0 14px", textAlign: "center", letterSpacing: 1, lineHeight: 1.25 }}>
            DATE IN<br />PROGRAMMAZIONE
          </div>
          <DateRaggruppatePerCitta corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} />
        </div>
      )}

      {view === "impostazioni" && (
        <Impostazioni corsi={corsi} location={location} corsiDate={corsiDate} ricarica={fetchDati} onBack={() => setView("home")} />
      )}

      {view === "calendario" && (
        <Calendario corsi={corsi} location={location} corsiDate={corsiDate} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "cerca" && (
        <CercaCorso corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "cercaiscritto" && (
        <CercaIscritto corsi={corsi} location={location} corsiDate={corsiDate} iscritti={iscritti} onApriData={apriData} onBack={() => setView("home")} />
      )}

      {view === "scheda" && corsoDataApertaObj && (
        <SchedaData
          corsoData={corsoDataApertaObj}
          corsi={corsi}
          location={location}
          corsiDate={corsiDate}
          iscritti={iscritti}
          ricarica={fetchDati}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
}
