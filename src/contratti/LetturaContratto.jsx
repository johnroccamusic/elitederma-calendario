// RILEGGERE IL CONTRATTO CHE IL DATABASE STA FACENDO FIRMARE
// (25/11/2026, chiesto dal titolare: «io che ho caricato il contratto
// master, devo avere un tasto dove posso rileggere e verificare il
// contratto caricato»).
//
// Fino a oggi «Contratti master → Il testo del contratto» diceva se le
// sette parti c'erano e se la loro impronta coincideva con quella del
// repo — cioè rispondeva a «è quello giusto?» con un numero. Non c'era
// nessun modo di LEGGERLO: chi l'ha caricato doveva fidarsi di
// sedici cifre esadecimali, oppure aprire il repo.
//
// TRE REGOLE, e sono tutte e tre la stessa: quello che si legge qui
// dev'essere quello che la master firma, non una seconda versione.
//
//  1. Il testo arriva da `leggiTesti()`, cioè dal DATABASE, che è da
//     dove il server lo congela alla firma. Dove il database non ha la
//     riga, `leggiTesti` ricade sul codice — e questa pagina lo scrive
//     in rosso su quella parte, perché è esattamente il caso in cui
//     alla firma si ricadrebbe sul testo mandato dal browser.
//  2. I blocchi li compone `blocchiContratto`/`casellePronte`, le stesse
//     funzioni della pagina di firma e del PDF archiviato. Un secondo
//     modo di comporre il documento vorrebbe dire rileggere una cosa e
//     farne firmare un'altra, che è il contrario del motivo per cui
//     questo tasto esiste.
//  3. L'epigrafe del/della Master qui è fatta di trattini
//     («[Nome e cognome]»): non c'è nessuna master, e i suoi dati si
//     compongono alla firma. Si dice, invece di lasciar credere che il
//     contratto esca così.
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { NAVY, MUTED, GRAFITE, CREAM_BORDER, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { blocchiContratto, casellePronte } from "../../supabase/functions/_shared/contratto-master.js";
import { NOMI } from "./testi.js";

// una parte del documento: il suo nome, da dove viene il testo, e i
// blocchi da leggere. L'ordine è quello in cui si firma.
function partiDaLeggere(testi) {
  const blocchi = blocchiContratto(testi || {}, {});
  const manifesto = testi?.manifesto || {};
  const clausole = testi?.clausole || {};
  const intestazione = testi?.intestazione || {};
  return [
    // l'intestazione è una parte come le altre: così le sette righe del
    // database e le sette parti del lettore coincidono, e il tasto
    // «Leggi» di ogni riga trova sempre qualcosa da mostrare
    { chiave: "intestazione", blocchi: [{ titolo: intestazione.titolo, punti: [intestazione.sottotitolo, intestazione.versione].filter(Boolean) }] },
    { chiave: "parti", blocchi: blocchi.filter((b) => b.chiave === "parti") },
    { chiave: "premesse", blocchi: blocchi.filter((b) => b.chiave === "premesse") },
    { chiave: "articoli", blocchi: blocchi.filter((b) => b.chiave === "articoli") },
    { chiave: "clausole", blocchi: [{ titolo: clausole.titolo, punti: clausole.punti }] },
    {
      chiave: "manifesto",
      sottotitolo: manifesto.versione,
      blocchi: [{ titolo: manifesto.titolo, punti: [] }, ...(manifesto.blocchi || [])],
    },
    {
      chiave: "caselle",
      // le dichiarazioni si leggono come le vede chi le spunta: il testo
      // della casella e, per quella delle clausole, l'elenco vero —
      // `casellePronte` lo pesca da CLAUSOLE, in un posto solo
      blocchi: casellePronte(testi || {}).map((c) => ({
        titolo: c.etichetta,
        punti: [c.testo, ...(c.clausole || [])],
      })),
    },
  ];
}

// ---------------------------------------------------------------
// SI CORREGGE DOVE SI LEGGE (25/11/2026, chiesto dal titolare: «qui nel
// testo del contratto vorrei un tasto modifica, che senza spostare il
// documento dalla posizione in cui ho la lettura in quel momento lo
// rende editabile e, una volta eseguita la modifica, salvabile»).
//
// Fino a oggi il testo si correggeva nel repo e si ricaricava col tasto:
// era l'ultima cosa scritta come «resta da fare» in questo capitolo.
//
// COSA SI MODIFICA, E COSA NO. Le caselle nascono da una camminata sul
// testo salvato: ogni STRINGA del `corpo` diventa una casella, con il
// suo percorso dentro il jsonb. Così la correzione torna esattamente
// dov'era — non si ricompone il documento, si riscrive il campo.
//
// Restano fuori le chiavi che non sono testo ma MECCANISMO: `chiave` e
// `tipo` di una dichiarazione decidono quale spunta è, e se è
// obbligatoria; `daClausole` dice di pescare l'elenco vero da CLAUSOLE.
// Correggerle da una casella di testo non cambierebbe una parola del
// contratto: romperebbe la firma.
const CHIAVI_MECCANISMO = new Set(["chiave", "tipo", "daClausole", "id"]);

function camminaStringhe(valore, percorso = []) {
  if (typeof valore === "string") return [{ percorso, valore }];
  if (Array.isArray(valore)) return valore.flatMap((v, i) => camminaStringhe(v, [...percorso, i]));
  if (valore && typeof valore === "object") {
    return Object.entries(valore).flatMap(([k, v]) => (CHIAVI_MECCANISMO.has(k) ? [] : camminaStringhe(v, [...percorso, k])));
  }
  return [];
}

// rimette una stringa al suo posto, senza toccare il resto: la copia è
// profonda sul ramo che cambia e condivisa altrove, come fa React
function conValore(corpo, percorso, nuovo) {
  if (percorso.length === 0) return nuovo;
  const [testa, ...resto] = percorso;
  if (Array.isArray(corpo)) {
    const copia = [...corpo];
    copia[testa] = conValore(corpo[testa], resto, nuovo);
    return copia;
  }
  return { ...corpo, [testa]: conValore(corpo?.[testa], resto, nuovo) };
}

// l'etichetta di una casella: il nome del campo quando ce l'ha («titolo»,
// «versione»), niente per i capoversi di un elenco — lì il testo parla da
// sé e un'etichetta per ogni riga sarebbe rumore
const NOMI_CAMPO = {
  titolo: "Titolo", sottotitolo: "Sottotitolo", versione: "Versione",
  etichettaAccademia: "Riga sopra l'Accademia", accademia: "L'Accademia",
  etichettaMaster: "Riga sopra il/la Master", epigrafeModello: "Epigrafe del/della Master (modello)",
  etichetta: "Etichetta", testo: "Testo",
};
function etichettaCampo(percorso) {
  const ultimo = percorso[percorso.length - 1];
  if (typeof ultimo === "number") return "";
  return NOMI_CAMPO[ultimo] || String(ultimo);
}

// una casella che cresce col testo: un contratto ha capoversi lunghi
// dieci righe, e una casella di tre righe che scorre dentro una pagina
// che scorre non si legge mentre la si corregge
function CasellaTesto({ valore, onCambia, titolo }) {
  const nodo = useRef(null);
  useLayoutEffect(() => {
    const el = nodo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [valore]);
  return (
    <textarea
      ref={nodo} value={valore} aria-label={titolo || "testo"}
      onChange={(e) => onCambia(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden",
        ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.65,
        border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 8px",
        background: "#FFFDF8", marginBottom: 6,
      }}
    />
  );
}

export default function LetturaContratto({
  testi, provenienza = {}, impronteDb = {}, impronteCodice = {}, soloChiave = null, onChiudi,
  onSalva = null,
}) {
  const parti = useMemo(() => partiDaLeggere(testi), [testi]);
  const intestazione = testi?.intestazione || {};
  const viste = soloChiave ? parti.filter((p) => p.chiave === soloChiave) : parti;
  const nelDb = (k) => !!provenienza[k];

  // SI CORREGGE QUI, SENZA SPOSTARSI. La bozza è una copia delle parti
  // viste: finché non si preme Salva, nel database non cambia niente —
  // sono clausole contrattuali, e una parola cambiata uscendo da una
  // casella è una cosa di cui nessuno si accorge (stessa regola del
  // regolamento del modulo di iscrizione).
  const [bozza, setBozza] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreSalva, setErroreSalva] = useState("");
  const contenitore = useRef(null);
  // dove si stava leggendo: entrando e uscendo dalla correzione le
  // caselle cambiano altezza, e senza questo la pagina salterebbe
  // altrove — è la cosa che il titolare ha chiesto per prima
  const posizione = useRef(0);

  // LA POSIZIONE SI RIMETTE SOLO QUANDO SI ENTRA E SI ESCE dalla
  // correzione, mai mentre si scrive. Con `bozza` fra le dipendenze
  // questo scattava a OGNI LETTERA battuta, e riportava la vista al
  // punto in cui si era premuto «Modifica»: scrivere nell'articolo 12
  // faceva saltare la pagina su, a ogni tasto. Mentre si batte la
  // posizione la tiene il browser, ed e' giusto cosi' — la casella che
  // cresce sposta quello che le sta sotto, non quello che si sta
  // leggendo.
  const inCorrezione = !!bozza;
  useLayoutEffect(() => {
    if (!contenitore.current || !posizione.current) return;
    contenitore.current.scrollTop = posizione.current;
  }, [inCorrezione]);

  function apriCorrezione() {
    posizione.current = contenitore.current?.scrollTop || 0;
    const copia = {};
    viste.forEach((p) => { copia[p.chiave] = JSON.parse(JSON.stringify(testi?.[p.chiave] ?? null)); });
    setErroreSalva("");
    setBozza(copia);
  }
  function chiudiCorrezione() {
    posizione.current = contenitore.current?.scrollTop || 0;
    setBozza(null);
  }
  function cambia(chiave, percorso, valore) {
    setBozza((b) => ({ ...b, [chiave]: conValore(b[chiave], percorso, valore) }));
  }
  // si scrivono SOLO le parti davvero cambiate: salvare le altre
  // vorrebbe dire archiviare sette versioni identiche a ogni correzione
  // di una virgola, e perdere la storia dentro il rumore
  const cambiate = bozza
    ? Object.keys(bozza).filter((k) => JSON.stringify(bozza[k]) !== JSON.stringify(testi?.[k]))
    : [];
  async function salva() {
    if (!onSalva || cambiate.length === 0) return;
    // SI CHIEDE, perché da qui esce quello che una persona firma, e la
    // domanda nomina cosa cambia: «sei sicuro?» da solo non dice quali
    // parti del contratto si stanno riscrivendo
    const quali = cambiate.map((k) => NOMI[k] || k).join(", ");
    const ok = window.confirm(
      `Stai per cambiare il testo che le master firmeranno da adesso.\n\nParti corrette: ${quali}.\n\n`
      + "Chi ha già firmato tiene il suo testo, e la versione di adesso resta in archivio. Salvo?",
    );
    if (!ok) return;
    setSalvando(true); setErroreSalva("");
    const errore = await onSalva(Object.fromEntries(cambiate.map((k) => [k, bozza[k]])));
    setSalvando(false);
    if (errore) { setErroreSalva(errore); return; }
    setBozza(null);
  }

  return (
    <div data-campo="lettura-contratto" ref={contenitore} style={{
      marginTop: 12, border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, background: "#fff",
      padding: "14px 14px 4px", maxHeight: "70vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: NAVY }}>{intestazione.titolo}</div>
      <div style={{ ...fontBody, fontSize: 12.5, color: GRAFITE, marginTop: 2 }}>{intestazione.sottotitolo}</div>
      <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2 }}>{intestazione.versione}</div>
      <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginTop: 8, borderTop: `1px dashed ${GOLD}`, paddingTop: 8 }}>
        È il testo che il database fa firmare, composto come lo legge la master. Al posto dei dati
        del/della Master ci sono i trattini: l&apos;epigrafe si compone alla firma, con quello che scrive lei.
      </div>
      {/* IN CORREZIONE SI DICE COSA SI STA CAMBIANDO, prima e non dopo:
          da qui esce quello che le master firmeranno. Chi ha già
          firmato tiene il suo testo, congelato alla sua firma. */}
      {bozza && (
        <div data-campo="avviso-correzione" style={{
          ...fontBody, fontSize: 12, lineHeight: 1.55, color: "#6B4E00", background: "#FFF8E6",
          border: "1px solid #E6CF8C", borderRadius: 10, padding: "10px 12px", marginTop: 10,
        }}>
          Stai correggendo il contratto che si firma <b>da adesso in avanti</b>. Chi ha già firmato tiene
          il suo testo, congelato alla sua firma, e la versione che sostituisci resta in archivio.
          Niente si salva da sé: finché non premi <b>Salva</b>, nel database non cambia niente.
        </div>
      )}

      {viste.map((p) => {
        const dentro = nelDb(p.chiave);
        const uguali = impronteDb[p.chiave] && impronteCodice[p.chiave] && impronteDb[p.chiave] === impronteCodice[p.chiave];
        return (
          <div key={p.chiave} data-parte={p.chiave} style={{ marginTop: 16, borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ ...fontDisplay, fontSize: 13, fontWeight: 700, color: NAVY }}>{NOMI[p.chiave]}</div>
              {/* DA DOVE VIENE QUESTO PEZZO: è la verifica, non un
                  dettaglio. Una parte che il database non ha, alla
                  firma arriva dal browser di chi firma. */}
              {!dentro ? (
                <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#B3261E" }}>
                  non è nel database: questo è il testo del codice
                </span>
              ) : !uguali && impronteDb[p.chiave] && impronteCodice[p.chiave] ? (
                <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#6B4E00" }}>
                  dal database · diverso dal repo
                </span>
              ) : (
                <span style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: "#1C5E33" }}>dal database</span>
              )}
            </div>
            {p.sottotitolo && (
              <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, marginTop: 2 }}>{p.sottotitolo}</div>
            )}
            {/* IN CORREZIONE si scrivono i CAMPI SALVATI, non il
                documento composto: così quello che si batte torna
                esattamente dov'era nel jsonb. È anche il motivo per cui
                qui l'epigrafe della master non compare: alla firma la
                compone il server con i dati di chi firma, e non c'è
                niente da correggere. */}
            {bozza ? (
              <div style={{ marginTop: 8 }}>
                {camminaStringhe(bozza[p.chiave]).map(({ percorso, valore }) => {
                  const etichetta = etichettaCampo(percorso);
                  return (
                    <div key={percorso.join(".")}>
                      {etichetta && (
                        <div style={{ ...fontBody, fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{etichetta}</div>
                      )}
                      <CasellaTesto
                        valore={valore} titolo={`${NOMI[p.chiave]} — ${etichetta || "capoverso"}`}
                        onCambia={(v) => cambia(p.chiave, percorso, v)}
                      />
                    </div>
                  );
                })}
                {camminaStringhe(bozza[p.chiave]).length === 0 && (
                  <div style={{ ...fontBody, fontSize: 12, color: MUTED }}>Questa parte non ha testo da correggere.</div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {(p.blocchi || []).map((b, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    {b.titolo && (
                      <div style={{ ...fontDisplay, fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 5 }}>{b.titolo}</div>
                    )}
                    {(b.punti || []).map((t, j) => {
                      const voce = String(t).trim().startsWith("•");
                      return (
                        <div key={j} style={{
                          ...fontBody, fontSize: 12.5, color: GRAFITE, lineHeight: 1.65,
                          marginBottom: 5, paddingLeft: voce ? 14 : 0,
                        }}>{t}</div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* I TASTI RESTANO SOTTO GLI OCCHI (sticky): un contratto di
          ventitré articoli corretto a metà non deve far cercare il
          salva in fondo a sei schermate. */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", paddingTop: 6, paddingBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {erroreSalva && (
          <div style={{ ...fontBody, fontSize: 12, color: "#B3261E", width: "100%" }}>{erroreSalva}</div>
        )}
        {!bozza ? (
          <>
            <button
              type="button" data-campo="chiudi-lettura" onClick={onChiudi}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, flex: "1 1 160px", minHeight: 44,
                       color: "#fff", background: NAVY, border: "none", borderRadius: 10, cursor: "pointer" }}
            >
              Ho finito di rileggere
            </button>
            {onSalva && (
              <button
                type="button" data-campo="modifica-contratto" onClick={apriCorrezione}
                style={{ ...fontBody, fontSize: 13, fontWeight: 700, flex: "0 1 160px", minHeight: 44,
                         color: NAVY, background: "#FFFDF8", border: `1px solid ${GOLD}`, borderRadius: 10, cursor: "pointer" }}
              >
                Modifica
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button" data-campo="salva-contratto" disabled={salvando || cambiate.length === 0} onClick={salva}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, flex: "1 1 160px", minHeight: 44,
                       color: "#fff", background: cambiate.length === 0 ? MUTED : "#1C5E33", border: "none",
                       borderRadius: 10, cursor: cambiate.length === 0 ? "default" : "pointer" }}
            >
              {salvando ? "Sto salvando…" : cambiate.length === 0 ? "Non hai cambiato niente" : `Salva ${cambiate.length === 1 ? "la parte corretta" : `le ${cambiate.length} parti corrette`}`}
            </button>
            <button
              type="button" data-campo="annulla-correzione" disabled={salvando} onClick={chiudiCorrezione}
              style={{ ...fontBody, fontSize: 13, fontWeight: 700, flex: "0 1 140px", minHeight: 44,
                       color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, cursor: "pointer" }}
            >
              Annulla
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export { partiDaLeggere };
