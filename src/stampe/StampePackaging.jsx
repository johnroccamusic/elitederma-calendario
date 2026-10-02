// "Stampe packaging": l'archivio di cosa si manda in tipografia.
//
// Una scheda per prodotto. A sinistra la foto di com'e' fatto, perche' un
// nome come "scatola media" non dice niente a chi non l'ha in mano; al
// centro il file da mandare in stampa, che si ricarica e si riscarica;
// a destra i dati, riga per riga.
//
// Le righe sono libere. Quelle che servono sempre — nome, tipologia,
// materiale, formato, dimensioni, fornitore — nascono gia' scritte, ma
// ogni stampa ha i suoi dettagli e il "+" accanto a una riga ne apre una
// nuova SOTTO di lei, dove serve e non in fondo.
import React, { useEffect, useMemo, useState } from "react";
import {
  NAVY, CREAM_BORDER, MUTED, GOLD, BG_CHIARO, fontBody, fontDisplay, inputStyle, stileTitoloPagina,
} from "../ui/stile.js";
import { Button, TastoLivelloPrecedente } from "../ui/base.jsx";
import {
  leggiStampe, leggiRighe, creaStampa, salvaStampa, eliminaStampa,
  salvaRiga, eliminaRiga, aggiungiRigaSotto, duplicaStampa, percorsoFile, caricaFile, urlPubblico,
} from "./dati.js";

function IconaPiu({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconaCestino({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

const card = {
  background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 18,
  boxShadow: "0 1px 4px rgba(14,27,51,0.07)", padding: 18, marginBottom: 16,
};

export default function StampePackaging({ onBack, titolo = "Stampe packaging" }) {
  const [stampe, setStampe] = useState(null);
  const [righe, setRighe] = useState([]);
  const [msg, setMsg] = useState("");
  const [occupato, setOccupato] = useState("");

  async function carica() {
    try {
      const [s, r] = await Promise.all([leggiStampe(), leggiRighe()]);
      setStampe(s); setRighe(r);
    } catch (e) { setMsg("Non riesco a leggere le schede: " + e.message); setStampe([]); }
  }
  useEffect(() => { carica(); }, []);

  const righePerStampa = useMemo(() => {
    const m = {};
    righe.forEach((r) => { (m[r.stampa_id] = m[r.stampa_id] || []).push(r); });
    Object.values(m).forEach((v) => v.sort((a, b) => Number(a.ordine) - Number(b.ordine)));
    return m;
  }, [righe]);

  async function conErrore(f, dove) {
    try { await f(); } catch (e) { setMsg(`${dove}: ${e.message}`); }
  }

  // Si scrive a ogni carattere che esce dal campo, non a un "Salva"
  // finale: una scheda piena di campi con un tasto solo in fondo e' il
  // modo migliore per perdere mezz'ora di lavoro chiudendo una pagina.
  async function cambiaRiga(riga, campo, valore) {
    setRighe((p) => p.map((x) => (x.id === riga.id ? { ...x, [campo]: valore } : x)));
    await conErrore(() => salvaRiga(riga.id, { [campo]: valore }), "Riga non salvata");
  }
  async function cambiaStampa(s, campo, valore) {
    setStampe((p) => p.map((x) => (x.id === s.id ? { ...x, [campo]: valore } : x)));
    await conErrore(() => salvaStampa(s.id, { [campo]: valore }), "Scheda non salvata");
  }

  async function nuova() {
    setOccupato("nuova");
    await conErrore(async () => { await creaStampa(""); await carica(); }, "Scheda non creata");
    setOccupato("");
  }

  async function butta(s) {
    if (!window.confirm(`Eliminare la scheda${s.nome ? ` "${s.nome}"` : ""}?\n\nSpariscono anche le sue righe. La foto e il file restano nell'archivio.`)) return;
    await conErrore(async () => { await eliminaStampa(s.id); await carica(); }, "Scheda non eliminata");
  }

  async function sali(s, campo, nomeCampo, file) {
    if (!file) return;
    setOccupato(`${s.id}:${campo}`);
    await conErrore(async () => {
      const p = percorsoFile(s.id, file.name);
      await caricaFile(p, file);
      await salvaStampa(s.id, nomeCampo ? { [campo]: p, [nomeCampo]: file.name } : { [campo]: p });
      await carica();
    }, "Caricamento non riuscito");
    setOccupato("");
  }

  if (stampe == null) {
    return <div style={{ ...fontBody, fontSize: 14, color: MUTED, padding: 40, textAlign: "center" }}>Carico…</div>;
  }

  return (
    <div style={{ padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          {onBack && <TastoLivelloPrecedente titolo="Home" onClick={onBack} />}
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
          <span style={{ flex: 1 }} />
          <Button onClick={nuova} disabled={occupato === "nuova"}>
            {occupato === "nuova" ? "Creo…" : "+ Aggiungi prodotto"}
          </Button>
        </div>
        <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, marginBottom: 20 }}>
          Cosa si manda in tipografia e come: la foto di com’è fatto, il file pronto da mandare, e i dati di stampa.
        </div>

        {msg && (
          <div style={{ ...fontBody, fontSize: 12.5, color: "#C0392B", background: "#FDECEC", border: "1px solid #F3C9C9", borderRadius: 10, padding: "9px 12px", marginBottom: 14 }}>
            {msg} <span onClick={() => setMsg("")} style={{ cursor: "pointer", textDecoration: "underline", marginLeft: 8 }}>chiudi</span>
          </div>
        )}

        {stampe.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 40, color: MUTED, ...fontBody, fontSize: 14 }}>
            Nessuna scheda. Premi <b>Aggiungi prodotto</b>: nasce già con le righe che servono sempre — nome,
            tipologia, materiale, formato, dimensioni e fornitore — da riempire.
          </div>
        ) : stampe.map((s) => {
          const mie = righePerStampa[s.id] || [];
          const foto = urlPubblico(s.foto_path);
          const file = urlPubblico(s.file_path);
          return (
            <div key={s.id} style={card}>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>

                {/* la foto, e sotto il file da mandare in stampa */}
                <div style={{ width: 210, flexShrink: 0 }}>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{
                      width: "100%", height: 150, borderRadius: 12, overflow: "hidden",
                      border: `1px dashed ${CREAM_BORDER}`, background: BG_CHIARO,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {foto
                        ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ ...fontBody, fontSize: 12, color: MUTED, textAlign: "center", padding: 10 }}>
                            {occupato === `${s.id}:foto_path` ? "Carico…" : "Foto del prodotto"}
                          </span>}
                    </div>
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => sali(s, "foto_path", null, e.target.files?.[0])} />
                  </label>

                  <div style={{ marginTop: 10, border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 10 }}>
                    <div style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                      File per la stampa
                    </div>
                    {s.file_path ? (
                      <div style={{ ...fontBody, fontSize: 12, color: NAVY, wordBreak: "break-all" }}>
                        <a href={file} download={s.file_nome || ""} target="_blank" rel="noreferrer"
                          style={{ color: NAVY, fontWeight: 700 }}>
                          ⤓ {s.file_nome || "scarica"}
                        </a>
                      </div>
                    ) : (
                      <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Nessun file caricato</div>
                    )}
                    <label style={{ display: "inline-block", marginTop: 8, cursor: "pointer", ...fontBody, fontSize: 11.5, fontWeight: 700, color: GOLD }}>
                      {occupato === `${s.id}:file_path` ? "Carico…" : s.file_path ? "Sostituisci file" : "Carica file"}
                      <input type="file" style={{ display: "none" }}
                        onChange={(e) => sali(s, "file_path", "file_nome", e.target.files?.[0])} />
                    </label>
                  </div>

                  {/* Duplicare serve piu' di quanto sembri: lo stesso
                      stampato cambia una riga sola — il formato, la
                      grammatura, il fornitore — e ribattere sei campi per
                      cambiarne uno e' lavoro buttato. */}
                  <button
                    onClick={() => conErrore(async () => { await duplicaStampa(s, mie); await carica(); }, "Scheda non duplicata")}
                    style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, background: "#fff",
                      border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "8px 12px",
                      marginTop: 10, width: "100%", cursor: "pointer" }}
                  >
                    Duplica prodotto
                  </button>
                </div>

                {/* i dati di stampa, riga per riga */}
                <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <input
                      value={s.nome || ""}
                      onChange={(e) => cambiaStampa(s, "nome", e.target.value)}
                      placeholder="Nome della scheda"
                      style={{ ...inputStyle, ...fontDisplay, fontSize: 17, fontWeight: 700, color: NAVY, flex: 1, minWidth: 0 }}
                    />
                    <button onClick={() => butta(s)} title="Elimina la scheda"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#C0392B", padding: 4, display: "flex" }}>
                      <IconaCestino size={17} />
                    </button>
                  </div>

                  {mie.map((r) => (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,170px) minmax(0,1fr) 28px 28px", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <input value={r.etichetta || ""} placeholder="Caratteristica"
                        onChange={(e) => cambiaRiga(r, "etichetta", e.target.value)}
                        style={{ ...inputStyle, fontSize: 12.5, fontWeight: 700, color: MUTED }} />
                      <input value={r.valore || ""} placeholder="—"
                        onChange={(e) => cambiaRiga(r, "valore", e.target.value)}
                        style={{ ...inputStyle, fontSize: 13, color: NAVY }} />
                      <button
                        title="Aggiungi una caratteristica sotto questa"
                        onClick={() => conErrore(async () => { await aggiungiRigaSotto(s.id, mie, r.id); await carica(); }, "Riga non aggiunta")}
                        style={{ border: `1px solid ${CREAM_BORDER}`, background: "#fff", borderRadius: 8, height: 28, cursor: "pointer", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconaPiu />
                      </button>
                      <button
                        title="Elimina questa riga"
                        onClick={() => conErrore(async () => { await eliminaRiga(r.id); await carica(); }, "Riga non eliminata")}
                        style={{ border: `1px solid ${CREAM_BORDER}`, background: "#fff", borderRadius: 8, height: 28, cursor: "pointer", color: "#C0392B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconaCestino />
                      </button>
                    </div>
                  ))}

                  {mie.length === 0 && (
                    <button
                      onClick={() => conErrore(async () => { await aggiungiRigaSotto(s.id, [], null); await carica(); }, "Riga non aggiunta")}
                      style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}>
                      + Aggiungi la prima caratteristica
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
