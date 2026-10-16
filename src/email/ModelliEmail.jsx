// SETTING > MODELLI EMAIL.
//
// Il testo delle mail che Genyon manda, scritto da chi le manda e non da
// chi programma. Finora la conferma iscrizione era dentro App.jsx: per
// cambiare una virgola serviva un rilascio.
//
// TRE SCELTE CHE REGGONO QUESTA PAGINA.
//
// 1. Si salva con un pulsante, non da soli. Quasi tutto in questa app si
//    salva uscendo dal campo, ed e' giusto per un numero o una spunta. Un
//    testo no: qui si scrive, si rilegge, si cambia idea a meta' frase. Un
//    salvataggio a ogni pausa manderebbe in giro versioni mai finite.
//
// 2. L'anteprima si fa con un'iscritta VERA, scelta dall'elenco. Con dei
//    valori finti ("Mario Rossi", "Corso di prova") non si vede quello che
//    conta davvero — che un corso ha il nome lunghissimo, che una sede non
//    ha l'indirizzo, che una data e' a cavallo di due mesi.
//
// 3. L'anteprima e la prova usano il testo CHE SI STA SCRIVENDO, non
//    quello salvato. Altrimenti bisognerebbe salvare per vedere, e si
//    tornerebbe al punto 1.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field } from "../ui/base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, fontBody, fontDisplay, inputStyle } from "../ui/stile.js";
import { MODELLI, SEGNAPOSTI, leggiModello, salvaModello, leggiRegole, salvaRegola, provaInviiAutomatici, frasePeriodo } from "./modelli.js";

const riquadro = {
  border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 12, background: "#fff",
};

// `soloChiave` lo blocca su un modello e nasconde il selettore: serve a
// Impostazioni > Modulo di iscrizione, dove la mail che accompagna il
// modulo si scrive li' accanto a tutto il resto del modulo invece che in
// un'altra pagina.
export default function ModelliEmail({ componi, soloChiave = null }) {
  const [chiave, setChiave] = useState(soloChiave || MODELLI[0].chiave);
  const modello = MODELLI.find((m) => m.chiave === chiave) || MODELLI[0];

  const [oggetto, setOggetto] = useState("");
  const [testo, setTesto] = useState("");
  const [riga, setRiga] = useState(null);      // la riga come sta nel database
  const [caricando, setCaricando] = useState(true);
  const [esito, setEsito] = useState(null);     // { tipo: "ok"|"errore"|"lavoro", testo }

  const [iscritti, setIscritti] = useState([]);
  const [iscrittoId, setIscrittoId] = useState("");
  const [contesto, setContesto] = useState(null); // { nome, corso, corsoData, loc }
  const [mioIndirizzo, setMioIndirizzo] = useState("");

  const campoTesto = useRef(null);
  const campoOggetto = useRef(null);
  const ultimoCampo = useRef("testo");

  // il modello scelto
  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    setEsito(null);
    leggiModello(chiave).then(({ modello: r, errore }) => {
      if (!vivo) return;
      setCaricando(false);
      if (errore) { setEsito({ tipo: "errore", testo: "Non riesco a leggere il modello: " + errore }); return; }
      setRiga(r);
      setOggetto(r?.oggetto || "");
      setTesto(r?.testo || "");
    });
    return () => { vivo = false; };
  }, [chiave]);

  // chi sta scrivendo (per `aggiornato_da` e per la prova)
  useEffect(() => {
    let vivo = true;
    // `getUser` valida il gettone col server; se la rete fa i capricci si
    // ripiega sulla sessione gia' in memoria. Senza, il tasto della prova
    // resterebbe spento senza che si capisca perche'.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!vivo) return;
      const email = data?.user?.email;
      if (email) { setMioIndirizzo(email); return; }
      const { data: sessione } = await supabase.auth.getSession();
      if (vivo) setMioIndirizzo(sessione?.session?.user?.email || "");
    });
    return () => { vivo = false; };
  }, []);

  // le ultime iscritte con un indirizzo, per l'anteprima
  useEffect(() => {
    let vivo = true;
    supabase.from("iscritti")
      .select("id, nome, cognome, email, corso_data_id, token_modulo")
      .not("email", "is", null).not("corso_data_id", "is", null)
      .order("ts", { ascending: false }).limit(40)
      .then(({ data }) => {
        if (!vivo) return;
        const lista = (data || []).filter((i) => String(i.email || "").includes("@"));
        setIscritti(lista);
        if (lista.length) setIscrittoId(lista[0].id);
      });
    return () => { vivo = false; };
  }, []);

  // il corso, la classe e la sede dell'iscritta scelta: tre righe, chieste
  // solo quando servono invece di tenersi in memoria mezzo database
  useEffect(() => {
    let vivo = true;
    const isc = iscritti.find((i) => i.id === iscrittoId);
    if (!isc) { setContesto(null); return; }
    (async () => {
      const { data: cd } = await supabase.from("corsi_date").select("*").eq("id", isc.corso_data_id).maybeSingle();
      if (!cd) { if (vivo) setContesto({ nome: isc.nome, corso: null, corsoData: null, loc: null, token: isc.token_modulo || null }); return; }
      const [{ data: co }, { data: lo }] = await Promise.all([
        supabase.from("corsi").select("*").eq("id", cd.corso_id).maybeSingle(),
        cd.location_id
          ? supabase.from("location").select("*").eq("id", cd.location_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (vivo) setContesto({ nome: isc.nome, corso: co || null, corsoData: cd, loc: lo || null, token: isc.token_modulo || null });
    })();
    return () => { vivo = false; };
  }, [iscrittoId, iscritti]);

  // l'anteprima: la stessa funzione che compone la mail quando parte per
  // davvero, non una seconda scrittura che un giorno direbbe un'altra cosa
  const anteprima = contesto && (oggetto.trim() || testo.trim())
    ? componi({ ...contesto, modello: { oggetto, testo } })
    : null;

  function inserisci(segnaposto) {
    const quale = ultimoCampo.current === "oggetto" ? campoOggetto : campoTesto;
    const el = quale.current;
    const valore = quale === campoOggetto ? oggetto : testo;
    const metti = quale === campoOggetto ? setOggetto : setTesto;
    const da = el?.selectionStart ?? valore.length;
    const a = el?.selectionEnd ?? valore.length;
    const nuovo = valore.slice(0, da) + `{${segnaposto}}` + valore.slice(a);
    metti(nuovo);
    // il cursore resta dopo il segnaposto, o si continua a scrivere in testa
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const p = da + segnaposto.length + 2;
      el.setSelectionRange(p, p);
    });
  }

  async function salva() {
    setEsito({ tipo: "lavoro", testo: "Salvo…" });
    const errore = await salvaModello({ chiave, oggetto, testo, chi: mioIndirizzo });
    if (errore) { setEsito({ tipo: "errore", testo: "Non salvato: " + errore }); return; }
    const { modello: r } = await leggiModello(chiave);
    setRiga(r);
    setEsito({ tipo: "ok", testo: "Modello salvato. Vale dalla prossima mail." });
  }

  async function inviaProva() {
    if (!anteprima) return;
    if (!window.confirm(`Mandare una prova di questa mail a ${mioIndirizzo}?`)) return;
    setEsito({ tipo: "lavoro", testo: "Mando la prova…" });
    const { data, error } = await supabase.functions.invoke("invia-email", {
      body: {
        a: mioIndirizzo,
        oggetto: `[PROVA] ${anteprima.oggetto}`,
        html: anteprima.html,
        testo: anteprima.testo,
      },
    });
    const errore = data?.errore || (error ? error.message : "");
    if (errore) { setEsito({ tipo: "errore", testo: "Prova non partita: " + errore }); return; }
    setEsito({ tipo: "ok", testo: `Prova mandata a ${mioIndirizzo}.` });
  }

  const cambiato = (oggetto || "") !== (riga?.oggetto || "") || (testo || "") !== (riga?.testo || "");
  const coloreEsito = esito?.tipo === "errore" ? "#B3261E" : esito?.tipo === "ok" ? "#1B7F4C" : GRAFITE;

  return (
    <div style={{ ...fontBody }}>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 14 }}>
        Il testo delle mail che partono da qui. Le parole fra graffe — <b style={{ color: NAVY }}>{"{nome}"}</b>,{" "}
        <b style={{ color: NAVY }}>{"{corso}"}</b> — vengono sostituite al momento dell'invio.
        Finché il modello è vuoto vale il testo scritto nel programma.
        <br />
        Per i dati del corso conviene <b style={{ color: NAVY }}>{"{dettagli}"}</b>: salta da solo le righe
        che mancano. Scrivendoli a mano, la punteggiatura attorno a un segnaposto vuoto resta scritta.
      </div>

      {MODELLI.length > 1 && !soloChiave && (
        <Field label="Modello">
          <select style={inputStyle} value={chiave} onChange={(e) => setChiave(e.target.value)}>
            {MODELLI.map((m) => <option key={m.chiave} value={m.chiave}>{m.titolo}</option>)}
          </select>
        </Field>
      )}

      <div style={{ ...riquadro, marginBottom: 14 }}>
        <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>{modello.titolo}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{modello.aChi}</div>
      </div>

      {caricando ? (
        <div style={{ fontSize: 13, color: MUTED, padding: "20px 0" }}>Leggo il modello…</div>
      ) : (
        <>
          <Field label="Oggetto">
            <input
              ref={campoOggetto} style={inputStyle} value={oggetto}
              onFocus={() => { ultimoCampo.current = "oggetto"; }}
              onChange={(e) => setOggetto(e.target.value)}
              placeholder="Conferma iscrizione – {corso}, {date}"
            />
          </Field>

          <Field label="Testo">
            <textarea
              ref={campoTesto}
              style={{ ...inputStyle, minHeight: 220, resize: "vertical", lineHeight: 1.5 }}
              value={testo}
              onFocus={() => { ultimoCampo.current = "testo"; }}
              onChange={(e) => setTesto(e.target.value)}
              placeholder={"Ciao {nome},\n\nla tua iscrizione al corso {corso} è confermata.\n\n{dettagli}\n\nA presto,\nElitederma Academy"}
            />
          </Field>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
              Tocca un segnaposto per inserirlo dove sta il cursore:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SEGNAPOSTI.map((s) => (
                <button
                  key={s.chiave} type="button" onClick={() => inserisci(s.chiave)} title={s.spiega}
                  style={{
                    ...fontBody, fontSize: 12, fontWeight: 700, color: NAVY, cursor: "pointer",
                    background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 999,
                    padding: "6px 11px", minHeight: 32,
                  }}
                >
                  {`{${s.chiave}}`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <Button onClick={salva} disabled={!cambiato || esito?.tipo === "lavoro"}>Salva il modello</Button>
            <Button
              variant="ghost" onClick={inviaProva}
              disabled={!anteprima || !mioIndirizzo || esito?.tipo === "lavoro"}
              title={mioIndirizzo ? `Manda a ${mioIndirizzo}` : "Non so a quale indirizzo hai fatto accesso"}
            >
              Invia prova a me
            </Button>
            {cambiato && <span style={{ fontSize: 12, color: MUTED }}>Modifiche non salvate.</span>}
          </div>
          {esito && <div style={{ fontSize: 12.5, color: coloreEsito, marginBottom: 10 }}>{esito.testo}</div>}
          {riga?.aggiornato_il && (
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 16 }}>
              Ultima modifica: {new Date(riga.aggiornato_il).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
              {riga.aggiornato_da ? ` · ${riga.aggiornato_da}` : ""}
            </div>
          )}

          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Anteprima</div>
          <Field label="Con i dati di">
            <select style={inputStyle} value={iscrittoId} onChange={(e) => setIscrittoId(e.target.value)}>
              {!iscritti.length && <option value="">nessuna iscritta con email</option>}
              {iscritti.map((i) => (
                <option key={i.id} value={i.id}>{[i.nome, i.cognome].filter(Boolean).join(" ")}</option>
              ))}
            </select>
          </Field>
          {anteprima ? (
            <div style={riquadro}>
              <div style={{ fontSize: 12, color: MUTED }}>Oggetto</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{anteprima.oggetto}</div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Testo</div>
              <div style={{ fontSize: 13.5, color: GRAFITE, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{anteprima.testo}</div>
            </div>
          ) : (
            <div style={{ ...riquadro, fontSize: 13, color: MUTED }}>
              {iscritti.length ? "Scrivi oggetto e testo per vedere l'anteprima." : "Serve un'iscritta con l'email per fare l'anteprima."}
            </div>
          )}
          <InviiAutomatici />
        </>
      )}
    </div>
  );
}

// GLI INVII AUTOMATICI.
//
// Sta qui sotto e non in una pagina sua perche' una regola senza il suo
// testo non vuol dire niente: chi accende "tre giorni prima" deve avere
// appena letto cosa parte. Separarli vorrebbe dire accendere al buio.
function InviiAutomatici() {
  const [regole, setRegole] = useState([]);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(true);
  const [prova, setProva] = useState(null);
  const [inCorso, setInCorso] = useState(false);

  async function ricarica() {
    const { regole: r, errore: e } = await leggiRegole();
    setCaricando(false);
    setErrore(e || "");
    setRegole(r);
  }
  useEffect(() => { ricarica(); }, []);

  const titoloDi = (chiave) => MODELLI.find((m) => m.chiave === chiave)?.titolo || chiave;

  async function cambia(regola, patch, conferma) {
    if (conferma && !window.confirm(conferma)) return;
    const e = await salvaRegola(regola.id, patch);
    if (e) { setErrore(e); return; }
    setErrore("");
    ricarica();
  }

  async function guarda() {
    setInCorso(true);
    setProva(null);
    const { esito, errore: e } = await provaInviiAutomatici();
    setInCorso(false);
    if (e) { setErrore(e); return; }
    setErrore("");
    setProva(esito);
  }

  if (caricando) return null;

  return (
    <div style={{ marginTop: 22, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 16 }}>
      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Invii automatici</div>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 12 }}>
        Ogni mattina Genyon guarda queste regole e manda quello che tocca oggi. Una regola spenta non manda
        niente, e nemmeno una accesa il cui testo qui sopra è vuoto.
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 10 }}>{errore}</div>}

      {!regole.length && !errore && (
        <div style={{ ...riquadro, fontSize: 13, color: MUTED }}>Nessuna regola.</div>
      )}

      {regole.map((r) => (
        <div key={r.id} style={{ ...riquadro, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: NAVY }}>{titoloDi(r.chiave_modello)}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {frasePeriodo(r.evento, r.scarto_giorni)}, alle iscritte di quella classe
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: r.attiva ? "#1B7F4C" : MUTED, cursor: "pointer" }}>
              <input
                type="checkbox" checked={!!r.attiva}
                onChange={() => cambia(
                  r, { attiva: !r.attiva },
                  r.attiva ? null
                    : `Accendere questa regola?\n\nDa domani mattina Genyon manderà «${titoloDi(r.chiave_modello)}» da solo, ${frasePeriodo(r.evento, r.scarto_giorni)}, alle iscritte di quella classe.\n\nSe non l'hai ancora fatto, mandati prima una prova.`,
                )}
              />
              {r.attiva ? "Accesa" : "Spenta"}
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: MUTED }}>Giorni prima:</span>
            <input
              type="number" min="0" max="60"
              defaultValue={Math.abs(r.scarto_giorni)}
              onBlur={(e) => {
                const n = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                if (n === Math.abs(r.scarto_giorni)) return;
                cambia(r, { scarto_giorni: -n });
              }}
              style={{ ...inputStyle, width: 80 }}
            />
            {r.ultima_esecuzione && (
              <span style={{ fontSize: 11.5, color: MUTED }}>
                ultimo giro: {new Date(r.ultima_esecuzione).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
              </span>
            )}
          </div>
          {r.nota && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, fontStyle: "italic" }}>{r.nota}</div>}
        </div>
      ))}

      <Button variant="ghost" onClick={guarda} disabled={inCorso}>
        {inCorso ? "Guardo…" : "Guarda cosa partirebbe oggi"}
      </Button>

      {prova && (
        <div style={{ ...riquadro, marginTop: 10, fontSize: 12.5, color: GRAFITE, lineHeight: 1.5 }}>
          <div style={{ color: MUTED, marginBottom: 6 }}>Nessuna mail è stata mandata: è solo un controllo.</div>
          {prova.messaggio && <div>{prova.messaggio}</div>}
          {(prova.resoconto || []).map((r, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <b style={{ color: NAVY }}>{titoloDi(r.modello)}</b> — cerca le classi del {r.data_cercata}:{" "}
              {r.saltata ? <span style={{ color: "#B3261E" }}>{r.saltata}</span> : (
                <>
                  {r.classi} class{r.classi === 1 ? "e" : "i"}, {r.mandate} destinatar{r.mandate === 1 ? "ia" : "ie"}
                  {r.saltate ? `, ${r.saltate} saltate (senza email o già mandata)` : ""}
                </>
              )}
              {(r.dettaglio || []).length > 0 && (
                <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: `2px solid ${CREAM_BORDER}`, color: MUTED }}>
                  {r.dettaglio.map((d, j) => <div key={j}>{d}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
