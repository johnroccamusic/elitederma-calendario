// REGISTRAZIONE CLIENTI (3/11/2026), chiesta dal titolare: una tessera in
// Home per chiunque — master comprese — dove chi vende registra un
// cliente, e un secondo elenco dove si consultano tutti quelli
// registrati.
//
// Due sezioni, una pagina: «Registra un cliente» e «Clienti registrati».
// Stanno insieme perche' sono lo stesso gesto visto da due parti — si
// registra, e subito dopo si vuole vedere se c'e'.
//
// IL LUOGO NON SI SCRIVE, SI SCEGLIE. La citta' si cerca scrivendola
// (stesso meccanismo del comune di nascita in Iscrizione allievi:
// `cercaComuni` sull'elenco ISTAT che l'app si porta dietro, nessuna
// rete) e scelta dal suggerimento riempie da se' provincia, regione e
// CAP. Non e' comodita': `regione` scritta a mano diventa «Puglia»,
// «puglia», «PUGLIA» e «Apulia», e un elenco di clienti per regione non
// si fa piu'.
//
// IL TELEFONO E' FORZATO COL +39: il prefisso non e' scrivibile, si
// batte solo il numero, e in archivio finisce sempre nella stessa forma
// (vedi `telefonoIta` in dati.js). Un numero estero oggi non si
// registra da qui — se servira', e' una decisione da prendere, non un
// campo da allargare di nascosto.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field, TastoLivelloPrecedente } from "../ui/base.jsx";
import { NAVY, MUTED, GOLD, CREAM_BORDER, BG_CHIARO, fontBody, fontDisplay, inputStyle, stileTitoloPagina } from "../ui/stile.js";
import CampoComune from "../iscrizione/CampoComune.jsx";
import { capDiComune } from "../comuni-regioni.js";
import {
  chiaveIdentita, clienteDaSalvare, giaRegistrato, luogoDaComune,
  problemiCliente, telefonoIta, testoPulito,
} from "./dati.js";

const VUOTO = { nome: "", cognome: "", citta: "", provincia: "", cap: "", regione: "", email: "", telefono: "", note: "" };

function dataOra(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// I DUE TASTINI DELLA RIGA (3/11/2026, chiesti dal titolare: «mettere
// l'icona del cancellino e anche quella di modifica»). Stanno a destra
// della riga, 44x44 di area premibile: su un telefono un'icona piu'
// piccola si prende con l'unghia.
function TastoMatita({ onClick, titolo }) {
  return (
    <button type="button" onClick={onClick} title={titolo} data-campo="modifica" style={{
      width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer",
      color: NAVY, display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M14 6l4 4" />
      </svg>
    </button>
  );
}
function TastoCestino({ onClick, titolo }) {
  return (
    <button type="button" onClick={onClick} title={titolo} data-campo="cancella" style={{
      width: 44, height: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer",
      color: "#C0392B", display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14" />
      </svg>
    </button>
  );
}

export default function RegistrazioneClienti({ chi = "", onBack, titolo = "Registrazione clienti" }) {
  const [vista, setVista] = useState("nuovo");
  const [c, setC] = useState(VUOTO);
  const [capPossibili, setCapPossibili] = useState([]);
  const [elenco, setElenco] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cerca, setCerca] = useState("");
  // il cliente che il salvataggio ha trovato già in archivio: si mostra
  // intero, perché «utente già registrato» senza dire QUALE lascia il
  // dubbio che sia un altro
  const [doppione, setDoppione] = useState(null);
  // la scheda che si sta correggendo (il suo id) oppure null: lo stesso
  // modulo serve a registrare e a modificare, perche' i campi e i
  // controlli sono gli stessi — due moduli gemelli vorrebbero dire due
  // posti dove cambiare una regola
  const [inModifica, setInModifica] = useState(null);

  const leggi = useCallback(async () => {
    const { data, error } = await supabase.from("clienti_registrati")
      .select("*").order("registrato_il", { ascending: false }).limit(2000);
    if (error) { setMsg({ tipo: "errore", testo: `Non riesco a leggere l'elenco: ${error.message}` }); setElenco([]); return; }
    setElenco(data || []);
  }, []);
  useEffect(() => { leggi(); }, [leggi]);

  const scrivi = (campo, valore) => { setC((p) => ({ ...p, [campo]: valore })); setMsg(null); setDoppione(null); };

  // scelta la città dal suggerimento: provincia, regione e CAP si
  // riempiono da sé. Dove i CAP sono molti (Roma ne ha 82) resta la
  // tendina, perché quello non lo può sapere nessuno al posto di chi
  // registra
  const scegliComune = (x) => {
    const l = luogoDaComune(x);
    setCapPossibili(l.capPossibili || []);
    setC((p) => ({ ...p, citta: l.citta.toUpperCase(), provincia: l.provincia, regione: l.regione, cap: l.cap }));
  };
  // città battuta a mano senza passare dal suggerimento: si prova a
  // ricavare comunque il resto, ma se il nome non è in elenco non si
  // inventa niente
  const esceDallaCitta = () => {
    const nome = testoPulito(c.citta);
    if (!nome || c.provincia) return;
    const l = luogoDaComune({ nome, sigla: "" });
    if (l.provincia) { setCapPossibili(l.capPossibili || []); setC((p) => ({ ...p, provincia: l.provincia, regione: l.regione, cap: l.cap })); }
  };

  // LA MATITA porta la riga dentro il modulo. I CAP si ricalcolano dal
  // comune: una scheda vecchia di una citta' con molti CAP deve poter
  // cambiare anche quello.
  function apriModifica(x) {
    const caps = x.citta && x.provincia ? capDiComune(x.provincia, x.citta) : [];
    setCapPossibili(caps);
    setC({
      nome: x.nome || "", cognome: x.cognome || "", citta: x.citta || "", provincia: x.provincia || "",
      cap: x.cap || "", regione: x.regione || "", email: x.email || "",
      // il +39 si toglie da quello che si vede: il prefisso sta fuori
      // dalla casella, e dentro ci andrebbe due volte
      telefono: String(x.telefono || "").replace(/^\+39/, ""), note: x.note || "",
    });
    setInModifica(x.id);
    setVista("nuovo");
    setMsg(null); setDoppione(null);
  }
  function annullaModifica() {
    setInModifica(null); setC(VUOTO); setCapPossibili([]); setMsg(null); setDoppione(null);
  }

  // IL CESTINO. Chiede conferma col nome davanti, perche' una riga
  // cancellata qui non va in nessun cestino da cui ripescarla: se
  // servisse, e' un lavoro a parte come quello delle vendite.
  async function cancella(x) {
    if (!window.confirm(`Cancellare ${x.nome} ${x.cognome}?\n\nLa scheda viene eliminata e non si recupera. Se serve, si potrà registrare di nuovo.`)) return;
    const { error } = await supabase.from("clienti_registrati").delete().eq("id", x.id);
    if (error) { setMsg({ tipo: "errore", testo: `Non cancellato: ${error.message}` }); return; }
    setElenco((p) => (p || []).filter((r) => r.id !== x.id));
    if (inModifica === x.id) annullaModifica();
    setMsg({ tipo: "ok", testo: `${x.nome} ${x.cognome} è stato cancellato.` });
  }

  const problemi = problemiCliente(c);
  const pronto = problemi.length === 0;

  async function salva() {
    if (!pronto || salvando) return;
    setSalvando(true); setMsg(null); setDoppione(null);
    try {
      // il controllo prima di scrivere serve a dare il messaggio con la
      // riga davanti; la serratura vera è l'indice unico della tabella,
      // che prende anche due venditori che premono Salva insieme
      // in modifica la scheda e' sempre uguale a se stessa: senza
      // escluderla si rifiuterebbe da sola
      const gia = giaRegistrato(c, elenco || [], inModifica);
      if (gia) { setDoppione(gia); setMsg({ tipo: "avviso", testo: "Utente già registrato." }); setSalvando(false); return; }

      const riga = clienteDaSalvare(c, chi);
      if (inModifica) {
        // la correzione non riscrive chi ha registrato: quello resta la
        // storia della riga. Scrive chi l'ha corretta e quando.
        const { registrato_da: _nonSiTocca, ...campi } = riga;
        const { data, error } = await supabase.from("clienti_registrati")
          .update({ ...campi, modificato_il: new Date().toISOString(), modificato_da: testoPulito(chi) || null })
          .eq("id", inModifica).select().single();
        if (error) {
          if (error.code === "23505" || /duplicate key|clienti_registrati_identita/i.test(error.message || "")) {
            await leggi();
            setMsg({ tipo: "avviso", testo: "Utente già registrato: con questi dati esiste già un'altra scheda." });
            setSalvando(false); return;
          }
          throw new Error(error.message);
        }
        setElenco((p) => (p || []).map((r) => (r.id === inModifica ? (data || r) : r)));
        setInModifica(null); setC(VUOTO); setCapPossibili([]);
        setMsg({ tipo: "ok", testo: `${riga.nome} ${riga.cognome} è stato aggiornato.` });
        setSalvando(false); setVista("elenco");
        return;
      }
      const { data, error } = await supabase.from("clienti_registrati").insert(riga).select().single();
      if (error) {
        // 23505 = l'indice unico: è la stessa persona, arrivata due volte
        if (error.code === "23505" || /duplicate key|clienti_registrati_identita/i.test(error.message || "")) {
          await leggi();
          const { data: trovato } = await supabase.from("clienti_registrati").select("*")
            .eq("nome", riga.nome).eq("cognome", riga.cognome).limit(20);
          const stessa = (trovato || []).find((x) => chiaveIdentita(x) === chiaveIdentita(riga)) || null;
          setDoppione(stessa);
          setMsg({ tipo: "avviso", testo: "Utente già registrato." });
          setSalvando(false);
          return;
        }
        throw new Error(error.message);
      }
      setElenco((p) => [data, ...(p || [])]);
      setC(VUOTO); setCapPossibili([]);
      setMsg({ tipo: "ok", testo: `${riga.nome} ${riga.cognome} è stato registrato.` });
    } catch (e) {
      setMsg({ tipo: "errore", testo: e?.message || "Non sono riuscito a salvare." });
    }
    setSalvando(false);
  }

  const visibili = useMemo(() => {
    const q = testoPulito(cerca).toLowerCase();
    const tutti = elenco || [];
    if (!q) return tutti;
    return tutti.filter((x) => [x.nome, x.cognome, x.citta, x.provincia, x.regione, x.cap, x.email, x.telefono]
      .some((v) => String(v || "").toLowerCase().includes(q)));
  }, [elenco, cerca]);

  const campo = { ...inputStyle, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ background: "transparent", minHeight: "100vh", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          {/* col nome scritto dentro, non solo l'icona: il tondo con la
              sola casa non si legge, e il giro delle sezioni cerca
              proprio il tasto «Home» per sapere che la pagina si e'
              aperta davvero */}
          <TastoLivelloPrecedente titolo="Home" onClick={onBack} />
          <div style={{ ...stileTitoloPagina, color: NAVY }}>{titolo}</div>
        </div>
        <div style={{ ...fontBody, fontSize: 14, color: MUTED, marginBottom: 18 }}>
          I clienti che registri restano qui, consultabili da tutti.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            { chiave: "nuovo", testo: inModifica ? "Modifica cliente" : "Registra un cliente" },
            { chiave: "elenco", testo: `Clienti registrati${elenco ? ` (${elenco.length})` : ""}` },
          ].map((t) => (
            <button key={t.chiave} type="button" onClick={() => { setVista(t.chiave); setMsg(null); }}
              style={{
                ...fontBody, fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${vista === t.chiave ? NAVY : CREAM_BORDER}`,
                background: vista === t.chiave ? NAVY : "#fff",
                color: vista === t.chiave ? "#fff" : NAVY,
              }}>
              {t.testo}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{
            ...fontBody, fontSize: 13, lineHeight: 1.55, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontWeight: 700,
            color: msg.tipo === "errore" ? "#C0392B" : msg.tipo === "avviso" ? "#8A6D1D" : "#2E7D32",
            background: msg.tipo === "errore" ? "#FBEBE9" : msg.tipo === "avviso" ? "#FDF8EC" : "#EAF5EA",
            border: `1px solid ${msg.tipo === "errore" ? "#F0C8C2" : msg.tipo === "avviso" ? "#EBD9AE" : "#C7E3C7"}`,
          }}>
            {msg.testo}
            {doppione && (
              <div style={{ ...fontBody, fontSize: 12.5, fontWeight: 400, marginTop: 6, color: NAVY }}>
                {doppione.nome} {doppione.cognome}
                {doppione.citta ? ` · ${doppione.citta}${doppione.provincia ? ` (${doppione.provincia})` : ""}` : ""}
                {doppione.email ? ` · ${doppione.email}` : ""}
                {doppione.telefono ? ` · ${doppione.telefono}` : ""}
                {doppione.registrato_il ? ` · registrato il ${dataOra(doppione.registrato_il)}` : ""}
                {doppione.registrato_da ? ` da ${doppione.registrato_da}` : ""}
                <div style={{ color: MUTED, marginTop: 4 }}>
                  Se è un'altra persona con lo stesso nome, cambia email o telefono: con contatti diversi è un cliente nuovo.
                </div>
              </div>
            )}
          </div>
        )}

        {vista === "nuovo" && inModifica && (
          <div style={{ ...fontBody, fontSize: 12.5, color: "#8A6D1D", background: "#FDF8EC", border: "1px solid #EBD9AE", borderRadius: 10, padding: "9px 11px", marginBottom: 12, lineHeight: 1.55 }}>
            Stai <b>correggendo una scheda già registrata</b>: salvando si aggiorna quella, non se ne crea una nuova. Chi l'ha registrata resta scritto; accanto comparirà chi l'ha corretta.
          </div>
        )}

        {vista === "nuovo" && (
          <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, padding: "16px 18px 6px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
              <Field label="Nome">
                <input data-campo="nome" style={campo} value={c.nome} autoComplete="off"
                  onChange={(e) => scrivi("nome", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Cognome">
                <input data-campo="cognome" style={campo} value={c.cognome} autoComplete="off"
                  onChange={(e) => scrivi("cognome", e.target.value.toUpperCase())} />
              </Field>
            </div>

            <Field label="Città">
              <CampoComune
                chiave="citta" valore={c.citta} stile={campo}
                suggerimento="scrivi le prime lettere…"
                scrivi={(_k, v) => scrivi("citta", v)}
                onScegli={scegliComune}
                esceDalCampo={esceDallaCitta}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 12 }}>
              <Field label="Provincia">
                {/* provincia e regione le scrive la città: a mano
                    diventerebbero quattro modi di scrivere la stessa
                    regione */}
                <input data-campo="provincia" style={{ ...campo, background: BG_CHIARO }} value={c.provincia} readOnly tabIndex={-1} />
              </Field>
              <Field label="CAP">
                {capPossibili.length > 1 ? (
                  <select data-campo="cap" style={{ ...campo }} value={c.cap} onChange={(e) => scrivi("cap", e.target.value)}>
                    <option value="">— scegli il CAP —</option>
                    {capPossibili.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                ) : (
                  <input data-campo="cap" style={{ ...campo, background: capPossibili.length === 1 ? BG_CHIARO : "#fff" }}
                    value={c.cap} inputMode="numeric" maxLength={5}
                    onChange={(e) => scrivi("cap", e.target.value.replace(/\D/g, "").slice(0, 5))} />
                )}
              </Field>
              <Field label="Regione">
                <input data-campo="regione" style={{ ...campo, background: BG_CHIARO }} value={c.regione} readOnly tabIndex={-1} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
              <Field label="Email">
                <input data-campo="email" style={campo} value={c.email} inputMode="email" autoComplete="off"
                  onChange={(e) => scrivi("email", e.target.value.trim())} />
              </Field>
              <Field label="Telefono">
                {/* il +39 è scritto fuori dalla casella e non si tocca:
                    così chi batte il numero non lo ripete, e in archivio
                    i numeri hanno tutti la stessa forma */}
                <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                  <span style={{
                    ...fontBody, fontSize: 14, fontWeight: 700, color: NAVY, background: BG_CHIARO,
                    border: `1px solid ${CREAM_BORDER}`, borderRight: "none", borderRadius: "10px 0 0 10px",
                    padding: "0 10px", display: "flex", alignItems: "center", flexShrink: 0,
                  }}>+39</span>
                  <input data-campo="telefono" style={{ ...campo, borderRadius: "0 10px 10px 0" }}
                    value={c.telefono} inputMode="tel" autoComplete="off" placeholder="347 1234567"
                    onChange={(e) => scrivi("telefono", e.target.value)} />
                </div>
              </Field>
            </div>

            <Field label="Note (facoltative)">
              <input data-campo="note" style={campo} value={c.note} onChange={(e) => scrivi("note", e.target.value)} />
            </Field>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "4px 0 16px" }}>
              <Button onClick={salva} disabled={!pronto || salvando}>
                {salvando ? "Salvo…" : inModifica ? "Salva le modifiche" : "Salva"}
              </Button>
              {inModifica && <Button variant="ghost" onClick={annullaModifica}>Annulla</Button>}
              {!pronto && (
                <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>
                  Manca ancora {problemi.join(", ")}.
                </span>
              )}
              {c.telefono && (
                <span style={{ ...fontBody, fontSize: 12, color: MUTED }}>
                  In archivio: <b style={{ color: NAVY }}>{telefonoIta(c.telefono) || "—"}</b>
                </span>
              )}
            </div>
          </div>
        )}

        {vista === "elenco" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <input data-campo="cerca" style={{ ...campo, maxWidth: 320, borderRadius: 999, background: BG_CHIARO }}
                value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="cerca per nome, città, email, telefono…" />
              <span style={{ ...fontBody, fontSize: 12, fontWeight: 700, color: MUTED }}>
                {elenco === null ? "carico…" : `${visibili.length}${cerca.trim() ? ` di ${elenco.length}` : ""}`}
              </span>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              {elenco === null && <div style={{ padding: 18, ...fontBody, fontSize: 13, color: MUTED }}>Carico…</div>}
              {elenco !== null && visibili.length === 0 && (
                <div style={{ padding: 18, ...fontBody, fontSize: 13, color: MUTED }}>
                  {elenco.length === 0 ? "Non c'è ancora nessun cliente registrato." : "Nessun cliente con queste parole."}
                </div>
              )}
              {visibili.map((x, i) => (
                <div key={x.id} style={{
                  padding: "11px 6px 11px 14px", borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`,
                  display: "flex", alignItems: "center", gap: 6,
                  background: inModifica === x.id ? "#FDF8EC" : "transparent",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>
                      {x.nome} {x.cognome}
                    </div>
                    <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                      {[x.citta && `${x.citta}${x.provincia ? ` (${x.provincia})` : ""}`, x.cap, x.regione].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ ...fontBody, fontSize: 12.5, color: NAVY, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                      {[x.telefono, x.email].filter(Boolean).join(" · ")}
                    </div>
                    {x.note && <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>{x.note}</div>}
                    <div style={{ ...fontBody, fontSize: 11, color: GOLD, fontWeight: 700, marginTop: 2 }}>
                      {dataOra(x.registrato_il)}{x.registrato_da ? ` · ${x.registrato_da}` : ""}
                      {/* una riga corretta lo dice: chi e quando. Senza,
                          un dato cambiato non si può chiedere a nessuno */}
                      {x.modificato_il && (
                        <span style={{ color: MUTED, fontWeight: 400 }}>
                          {` · corretta il ${dataOra(x.modificato_il)}${x.modificato_da ? ` da ${x.modificato_da}` : ""}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <TastoMatita onClick={() => apriModifica(x)} titolo={`Modifica ${x.nome} ${x.cognome}`} />
                  <TastoCestino onClick={() => cancella(x)} titolo={`Cancella ${x.nome} ${x.cognome}`} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
