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
import React, { useMemo } from "react";
import { NAVY, MUTED, GRAFITE, CREAM_BORDER, GOLD, fontBody, fontDisplay } from "../ui/stile.js";
import { blocchiContratto, casellePronte } from "../../supabase/functions/_shared/contratto-master.js";
import { NOMI } from "./testi.js";

// una parte del documento: il suo nome, da dove viene il testo, e i
// blocchi da leggere. L'ordine è quello in cui si firma.
function partiDaLeggere(testi) {
  const blocchi = blocchiContratto(testi || {}, {});
  const manifesto = testi?.manifesto || {};
  const clausole = testi?.clausole || {};
  return [
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

export default function LetturaContratto({ testi, provenienza = {}, impronteDb = {}, impronteCodice = {}, soloChiave = null, onChiudi }) {
  const parti = useMemo(() => partiDaLeggere(testi), [testi]);
  const intestazione = testi?.intestazione || {};
  const viste = soloChiave ? parti.filter((p) => p.chiave === soloChiave) : parti;
  const nelDb = (k) => !!provenienza[k];

  return (
    <div data-campo="lettura-contratto" style={{
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
          </div>
        );
      })}

      <div style={{ position: "sticky", bottom: 0, background: "#fff", paddingTop: 6, paddingBottom: 10 }}>
        <button
          type="button" data-campo="chiudi-lettura" onClick={onChiudi}
          style={{ ...fontBody, fontSize: 13, fontWeight: 700, width: "100%", minHeight: 44,
                   color: "#fff", background: NAVY, border: "none", borderRadius: 10, cursor: "pointer" }}
        >
          Ho finito di rileggere
        </button>
      </div>
    </div>
  );
}

export { partiDaLeggere };
