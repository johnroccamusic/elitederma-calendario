// DOVE SI CAMBIANO GLI INDIRIZZI E I GIORNI DEL RECESSO.
//
// Quattro cose, una riga sola nel database (`impostazioni_recesso`).
//
// PERCHE' NON STANNO NEL CODICE. La PEC cambia quando cambia il
// fornitore; i due numeri di legge vanno confermati dal legale e
// potrebbero cambiare con una norma. Nessuna delle due e' una cosa per
// cui si debba ripubblicare l'app.
//
// NIENTE SI SALVA DA SOLO: sono gli indirizzi a cui arriva un recesso e
// i termini entro cui si puo' esercitare. Si scrive e si preme Salva.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button, Field } from "../ui/base.jsx";
import { areaSchedaIscritto, campoAreaScheda, IntestazioneArea } from "../ui/scheda.jsx";
import { NAVY, MUTED, GRAFITE, GOLD, CREAM_BORDER } from "../ui/stile.js";

const VUOTA = { pec_recesso: "", email_amministrazione: "", giorni_recesso: 14, giorni_avvio_immediato: 15 };

export default function ImpostazioniRecesso({ Icona, amministratore = true }) {
  const [riga, setRiga] = useState(VUOTA);
  const [bozza, setBozza] = useState(null);
  const [errore, setErrore] = useState("");
  const [detto, setDetto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function ricarica() {
    const { data, error } = await supabase.from("impostazioni_recesso").select("*").limit(1).maybeSingle();
    if (error) { setErrore(error.message); return; }
    setRiga({ ...VUOTA, ...(data || {}) });
  }
  useEffect(() => { ricarica(); }, []);

  const v = bozza || riga;
  const scrivi = (campo, valore) => setBozza((b) => ({ ...(b || riga), [campo]: valore }));

  async function salva() {
    setSalvando(true); setDetto("");
    const { data: utente } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("impostazioni_recesso").update({
      pec_recesso: (v.pec_recesso || "").trim() || null,
      email_amministrazione: (v.email_amministrazione || "").trim() || null,
      giorni_recesso: Number(v.giorni_recesso) || 14,
      giorni_avvio_immediato: Number(v.giorni_avvio_immediato) || 15,
      aggiornato_il: new Date().toISOString(),
      aggiornato_da: utente?.user?.email || null,
    }).eq("id", true).select("id");
    setSalvando(false);
    // `.select` e non solo update: PostgREST risponde "va bene" anche
    // quando non ha cambiato niente, e un indirizzo che non si e'
    // salvato davvero si scopre il giorno di un recesso
    if (error) { setErrore("Non riesco a salvare: " + error.message); return; }
    if (!data?.length) { setErrore("Nessuna riga aggiornata: controlla i permessi."); return; }
    setErrore(""); setBozza(null); setDetto("Salvato.");
    await ricarica();
  }

  const campo = { ...campoAreaScheda, width: "100%", boxSizing: "border-box", minWidth: 0 };

  return (
    <div>
      <div style={{
        border: `1px solid ${GOLD}`, background: "#FDF8EF", borderRadius: 12,
        padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: GRAFITE, lineHeight: 1.55,
      }}>
        Qui si cambiano gli indirizzi a cui arriva un recesso e i termini entro cui si può esercitare.
        <div style={{ marginTop: 6 }}>
          I due numeri sono <b style={{ color: NAVY }}>di legge</b>: 14 giorni per recedere dalla firma del modulo,
          e 15 giorni sotto i quali il modulo chiede l'avvio immediato (art. 59, lett. a). Cambiali solo con il parere del legale.
        </div>
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 12 }}>{errore}</div>}
      {detto && <div style={{ fontSize: 12.5, color: "#1B7F3B", fontWeight: 700, marginBottom: 12 }}>{detto}</div>}

      <div style={{ ...areaSchedaIscritto, marginBottom: 16 }}>
        <IntestazioneArea Icona={Icona}>Dove arriva un recesso</IntestazioneArea>
        <Field label="PEC — è l'indirizzo scritto nel regolamento, Punto 3 lett. e)">
          <input style={campo} value={v.pec_recesso || ""} disabled={!amministratore}
            placeholder="nome@legalmail.it"
            onChange={(e) => scrivi("pec_recesso", e.target.value)} />
        </Field>
        <Field label="Email dell'amministrazione — riceve l'avviso quando un'allieva recede (opzionale)">
          <input style={campo} value={v.email_amministrazione || ""} disabled={!amministratore}
            placeholder="amministrazione@elitederma.it"
            onChange={(e) => scrivi("email_amministrazione", e.target.value)} />
        </Field>
      </div>

      <div style={{ ...areaSchedaIscritto, marginBottom: 16 }}>
        <IntestazioneArea Icona={Icona}>I giorni</IntestazioneArea>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <Field label="Giorni per recedere, dalla firma">
              <input style={campo} type="number" min="0" value={v.giorni_recesso} disabled={!amministratore}
                onChange={(e) => scrivi("giorni_recesso", e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <Field label="Sotto quanti giorni si chiede l'avvio immediato">
              <input style={campo} type="number" min="0" value={v.giorni_avvio_immediato} disabled={!amministratore}
                onChange={(e) => scrivi("giorni_avvio_immediato", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {amministratore && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={salva} disabled={!bozza || salvando}>{salvando ? "Salvo…" : "Salva"}</Button>
          {bozza && <Button variant="ghost" onClick={() => { setBozza(null); setDetto(""); }}>Annulla</Button>}
          {bozza && <span style={{ fontSize: 12, color: "#B3261E", fontWeight: 700 }}>Modifiche non salvate.</span>}
          {riga.aggiornato_il && !bozza && (
            <span style={{ fontSize: 11.5, color: MUTED }}>
              Ultima modifica {new Date(riga.aggiornato_il).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
              {riga.aggiornato_da ? ` da ${riga.aggiornato_da}` : ""}
            </span>
          )}
        </div>
      )}
      {!amministratore && (
        <div style={{ border: `1px solid ${CREAM_BORDER}`, background: "#F7F4EC", borderRadius: 10,
                      padding: "9px 12px", fontSize: 12.5, color: GRAFITE }}>
          Sola lettura: questi indirizzi li cambia chi amministra.
        </div>
      )}
    </div>
  );
}
