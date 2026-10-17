// IL CONTRATTO CHE L'ALLIEVA FIRMA: si legge, e si corregge.
//
// Tre pezzi — l'intestazione, il regolamento, privacy e consensi — come
// sono scritti sul modulo. Si aprono in lettura, perche' la prima cosa
// che serve e' poterli leggere per intero senza finestre sospese e senza
// riquadri che scorrono dentro altri riquadri.
//
// SI CORREGGE UN PEZZO ALLA VOLTA, e il salvataggio e' un gesto a parte.
// Qui non c'e' il salvataggio automatico che hanno le altre pagine: sono
// clausole contrattuali, e una parola cambiata per sbaglio uscendo da un
// campo e' una cosa che nessuno si accorge di aver fatto. Si entra in
// correzione, si scrive, si preme Salva — oppure Annulla e non e'
// successo niente.
//
// "RIMETTI COM'ERA" cancella la riga dal database, e allora torna a
// valere il testo trascritto nel codice. E' la via d'uscita se qualcuno
// combina un guaio: non bisogna riscrivere nove punti a mano.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { leggiTesti, salvaTesto, ripristinaTesto, DAL_CODICE, NOMI_TESTI, aRighe, daRighe } from "./testi.js";

const quando = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("it-IT",
      { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const areaTesto = {
  ...campoAreaScheda, minHeight: 110, lineHeight: 1.6, fontSize: 12.5,
  resize: "vertical", width: "100%", boxSizing: "border-box", minWidth: 0,
};

export default function TestoContratto({ Icona, amministratore = true }) {
  const [testi, setTesti] = useState(DAL_CODICE);
  const [provenienza, setProvenienza] = useState({});
  const [errore, setErrore] = useState("");
  const [chi, setChi] = useState("");
  const [correggendo, setCorreggendo] = useState("");   // quale pezzo
  const [bozza, setBozza] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [detto, setDetto] = useState("");

  async function ricarica() {
    const { testi: t, provenienza: p, errore: e } = await leggiTesti();
    setTesti(t); setProvenienza(p); setErrore(e || "");
  }

  useEffect(() => {
    let vivo = true;
    leggiTesti().then(({ testi: t, provenienza: p, errore: e }) => {
      if (!vivo) return;
      setTesti(t); setProvenienza(p); setErrore(e || "");
    });
    supabase.auth.getUser().then(({ data }) => { if (vivo) setChi(data?.user?.email || ""); });
    return () => { vivo = false; };
  }, []);

  function apri(chiave) {
    setBozza(JSON.parse(JSON.stringify(testi[chiave])));
    setCorreggendo(chiave);
    setDetto("");
  }
  function chiudi() { setCorreggendo(""); setBozza(null); }

  async function salva() {
    setSalvando(true);
    const e = await salvaTesto(correggendo, bozza, chi);
    setSalvando(false);
    if (e) { setErrore("Non riesco a salvare: " + e); return; }
    setErrore("");
    setDetto(`"${NOMI_TESTI[correggendo]}" è stato salvato.`);
    chiudi();
    await ricarica();
  }

  async function rimettiComEra(chiave) {
    const e = await ripristinaTesto(chiave);
    if (e) { setErrore("Non riesco a rimetterlo com'era: " + e); return; }
    setErrore("");
    setDetto(`"${NOMI_TESTI[chiave]}" è tornato al testo di partenza.`);
    chiudi();
    await ricarica();
  }

  const pannello = { ...areaSchedaIscritto, marginBottom: 16 };
  const paragrafo = { fontSize: 12.5, color: GRAFITE, lineHeight: 1.65, margin: "8px 0" };

  // la riga che dice da dove viene questo pezzo, e i tasti
  function Barra({ chiave }) {
    const p = provenienza[chiave];
    const corretto = !!p;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, color: MUTED }}>
          {corretto
            ? <>Corretto {p.da ? `da ${p.da} ` : ""}il {quando(p.il)}</>
            : <>Testo di partenza, mai corretto</>}
        </span>
        <div style={{ flex: 1 }} />
        {amministratore && correggendo !== chiave && (
          <Button variant="ghost" onClick={() => apri(chiave)}>Correggi</Button>
        )}
        {amministratore && corretto && correggendo !== chiave && (
          <Button variant="ghost" onClick={() => rimettiComEra(chiave)}>Rimetti com'era</Button>
        )}
        {correggendo === chiave && (
          <>
            <Button variant="ghost" onClick={chiudi} disabled={salvando}>Annulla</Button>
            <Button onClick={salva} disabled={salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
          </>
        )}
      </div>
    );
  }

  const scriviNellaBozza = (cambia) => setBozza((b) => { const c = JSON.parse(JSON.stringify(b)); cambia(c); return c; });

  return (
    <div>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: GRAFITE, lineHeight: 1.55,
      }}>
        È il testo che l'allieva legge e firma. <b style={{ color: NAVY }}>Si corregge un pezzo alla volta</b>, e
        il salvataggio è un gesto a parte: qui niente si salva da solo, perché sono clausole di un contratto.
        <div style={{ marginTop: 6 }}>
          Un pezzo mai corretto vale quello trascritto nel codice dal modulo del sito. <b style={{ color: NAVY }}>Rimetti
          com'era</b> ci torna, e non serve riscrivere niente a mano.
        </div>
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 12 }}>{errore}</div>}
      {detto && <div style={{ fontSize: 12.5, color: "#1B7F3B", fontWeight: 700, marginBottom: 12 }}>{detto}</div>}
      {!amministratore && (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, background: "#F7F4EC", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: GRAFITE }}>
          Sola lettura: il contratto lo corregge chi amministra.
        </div>
      )}

      {/* ---------- INTESTAZIONE ---------- */}
      <div style={pannello}>
        <IntestazioneArea Icona={Icona}>{NOMI_TESTI.intro}</IntestazioneArea>
        <Barra chiave="intro" />
        {correggendo === "intro" ? (
          <>
            <Field label="Titolo">
              <input style={{ ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 }}
                value={bozza.titolo || ""}
                onChange={(e) => scriviNellaBozza((c) => { c.titolo = e.target.value; })} />
            </Field>
            <Field label="Sottotitolo">
              <input style={{ ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 }}
                value={bozza.sottotitolo || ""}
                onChange={(e) => scriviNellaBozza((c) => { c.sottotitolo = e.target.value; })} />
            </Field>
          </>
        ) : (
          <>
            <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.4 }}>{testi.intro.titolo}</div>
            <div style={{ ...paragrafo, color: MUTED }}>{testi.intro.sottotitolo}</div>
          </>
        )}
      </div>

      {/* ---------- REGOLAMENTO ---------- */}
      <div style={pannello}>
        <IntestazioneArea Icona={Icona}>{NOMI_TESTI.regolamento}</IntestazioneArea>
        <Barra chiave="regolamento" />
        {correggendo === "regolamento" ? (
          <>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
              Un capoverso per riga. Le righe vuote non contano: servono solo a respirare mentre si scrive.
            </div>
            {(bozza.blocchi || []).map((b, i) => (
              <div key={i} style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: 12, marginBottom: 12, background: "#fff" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Field label={`Punto ${i + 1} — titolo`}>
                      <input style={{ ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 }}
                        value={b.titolo || ""}
                        onChange={(e) => scriviNellaBozza((c) => { c.blocchi[i].titolo = e.target.value; })} />
                    </Field>
                  </div>
                  <Button variant="ghost"
                    style={{ marginBottom: 14, whiteSpace: "nowrap" }}
                    onClick={() => scriviNellaBozza((c) => { c.blocchi.splice(i, 1); })}>
                    Togli
                  </Button>
                </div>
                <Field label="Capoversi">
                  <textarea style={areaTesto}
                    value={aRighe(b.punti)}
                    onChange={(e) => scriviNellaBozza((c) => { c.blocchi[i].punti = daRighe(e.target.value); })} />
                </Field>
              </div>
            ))}
            <Button variant="ghost"
              onClick={() => scriviNellaBozza((c) => { c.blocchi.push({ titolo: "NUOVO PUNTO", punti: [] }); })}>
              Aggiungi un punto
            </Button>
          </>
        ) : (
          (testi.regolamento.blocchi || []).map((b, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{b.titolo}</div>
              {(b.punti || []).map((p, j) => <p key={j} style={paragrafo}>{p}</p>)}
            </div>
          ))
        )}
      </div>

      {/* ---------- PRIVACY, IMMAGINI E CONSENSI ---------- */}
      <div style={pannello}>
        <IntestazioneArea Icona={Icona}>{NOMI_TESTI.consensi}</IntestazioneArea>
        <Barra chiave="consensi" />
        {correggendo === "consensi" ? (
          <>
            {[
              ["regolamentoEtichetta", "Etichetta dell'accettazione"],
              ["regolamentoSpunta", "Frase della spunta sul regolamento"],
              ["informativaEtichetta", "Etichetta dell'informativa"],
              ["firmaEtichetta", "Etichetta della firma"],
              ["notaObbligatori", "Nota sui campi obbligatori"],
              ["tastoInvio", "Scritta sul tasto di invio"],
            ].map(([campo, etichetta]) => (
              <Field key={campo} label={etichetta}>
                <input style={{ ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 }}
                  value={bozza[campo] || ""}
                  onChange={(e) => scriviNellaBozza((c) => { c[campo] = e.target.value; })} />
              </Field>
            ))}
            {/* L'informativa e le immagini NON si correggono da qui: sono
                il Punto 9 e il Punto 10 del regolamento, e si correggono
                la' insieme agli altri punti. Due caselle che scrivessero
                lo stesso testo in due posti porterebbero, prima o poi, a
                un modulo che dice una cosa nel regolamento e un'altra in
                fondo alla pagina. */}
            <Field label="Rimando all'informativa">
              <input style={{ ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 }}
                value={bozza.informativaRimando || ""}
                onChange={(e) => scriviNellaBozza((c) => { c.informativaRimando = e.target.value; })} />
            </Field>
          </>
        ) : (
          <>
            <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{testi.consensi.informativaEtichetta}</div>
            <p style={paragrafo}>{testi.consensi.informativaRimando}</p>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CREAM_BORDER}`, fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
              Sul modulo l'allieva vede anche: <b style={{ color: NAVY }}>{testi.consensi.regolamentoEtichetta}</b> ·
              {" "}<b style={{ color: NAVY }}>{testi.consensi.firmaEtichetta}</b> ·
              {" "}{testi.consensi.notaObbligatori} · tasto «{testi.consensi.tastoInvio}»
            </div>
          </>
        )}
      </div>
    </div>
  );
}
