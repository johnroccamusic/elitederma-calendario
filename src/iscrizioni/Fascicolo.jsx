// IL FASCICOLO DI UN'ISCRIZIONE: cosa ha firmato, e cosa le e' arrivato.
//
// Si apre dalla tessera "Modulo ricevuto" della fascia di stato. Finche'
// non c'era, di un modulo arrivato si vedeva solo che era arrivato: il
// documento che l'allieva aveva sottoscritto stava sparso fra tre file
// in un secchio privato, e della mail di conferma non restava niente
// sotto gli occhi di nessuno.
//
// Qui dentro:
//
//   LA COPIA FIRMATA   il PDF con dati, regolamento di quel giorno,
//                      dichiarazioni con la loro ora, firma e documento
//   L'INVIO            che la mail e' partita, a chi, quando, e se il
//                      server di posta di lei l'ha accettata
//
// "Consegnata" e "letta" non sono la stessa cosa, e dal 19/10/2026 la
// seconda non passa piu' di qui: c'era un tasto dentro la mail che
// l'allieva premeva, ed e' stato tolto su richiesta in favore della
// conferma di lettura chiesta al programma di posta. Quella torna come
// una mail a notifiche@elitederma.it, non nel registro — e Mail di
// iPhone non la chiede affatto. Il riquadro lo dice, invece di restare
// in attesa di qualcosa che non arrivera'.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { Button } from "../ui/base.jsx";
import { NAVY, MUTED, CREAM_BORDER, GRAFITE, fontBody } from "../ui/stile.js";

const VERDE = "#2E7D32";
const ROSSO = "#B3261E";
const AMBRA = "#8A6A1B";

const quando = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" });
};

function Riquadro({ titolo, children, nota = null }) {
  return (
    <div style={{ border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: 16, marginBottom: 14, background: "#fff" }}>
      <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        {titolo}
      </div>
      {children}
      {nota && <div style={{ ...fontBody, fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginTop: 10 }}>{nota}</div>}
    </div>
  );
}

function Riga({ etichetta, children, colore = NAVY }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 6, flexWrap: "wrap" }}>
      <div style={{ ...fontBody, fontSize: 12, color: MUTED, flex: "0 0 120px" }}>{etichetta}</div>
      <div style={{ ...fontBody, fontSize: 13, color: colore, fontWeight: 600, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>
        {children}
      </div>
    </div>
  );
}

export default function Fascicolo({ iscritto, chi = "", onAggiornato = () => {} }) {
  const [linkPdf, setLinkPdf] = useState("");
  const [invii, setInvii] = useState(null);
  const [riaperture, setRiaperture] = useState(null);
  const [motivoRiapertura, setMotivoRiapertura] = useState("");
  const [riaprendo, setRiaprendo] = useState(false);
  const [esitoRiapertura, setEsitoRiapertura] = useState("");
  const [rigenerando, setRigenerando] = useState(false);
  const [esito, setEsito] = useState("");
  // il percorso del PDF si tiene nello stato: dopo "Rigenera" la riga
  // dell'iscritto in memoria e' ancora quella di prima, e senza questo il
  // pannello continuerebbe a dire che il documento non c'e'
  const [percorso, setPercorso] = useState(iscritto?.modulo_pdf_path || "");
  const [generatoIl, setGeneratoIl] = useState(iscritto?.modulo_pdf_generato_il || "");

  // IL SECCHIO E' PRIVATO, quindi niente `getPublicUrl`: si chiede un
  // link a scadenza, che vale un'ora e solo per chi ha una sessione.
  useEffect(() => {
    let vivo = true;
    if (!percorso) { setLinkPdf(""); return; }
    supabase.storage.from("moduli-iscrizione").createSignedUrl(percorso, 3600)
      .then(({ data }) => { if (vivo) setLinkPdf(data?.signedUrl || ""); });
    return () => { vivo = false; };
  }, [percorso]);

  useEffect(() => {
    let vivo = true;
    if (!iscritto?.id) return;
    supabase.from("email_inviate")
      .select("*").eq("iscritto_id", iscritto.id)
      .order("inviata_il", { ascending: false })
      .then(({ data }) => { if (vivo) setInvii(data || []); });
    return () => { vivo = false; };
  }, [iscritto?.id]);

  useEffect(() => {
    let vivo = true;
    if (!iscritto?.id) return;
    supabase.from("moduli_riaperture")
      .select("*").eq("iscritto_id", iscritto.id)
      .order("riaperto_il", { ascending: false })
      .then(({ data }) => { if (vivo) setRiaperture(data || []); });
    return () => { vivo = false; };
  }, [iscritto?.id]);

  // RIAPRIRE IL MODULO.
  //
  // Il link vale una volta sola: appena il modulo torna, non si apre
  // piu'. E' nata per un motivo vero — una seconda spedizione
  // sovrascriveva firma e documenti lasciando il contratto della prima —
  // ma capita che manchi qualcosa e il modulo vada rifatto.
  //
  // Non si "sblocca" e basta: `modulo_riapri` mette prima da parte tutto
  // quello che c'era, e solo dopo toglie la serratura. La prima consegna
  // non si perde, si archivia.
  async function riapri() {
    const nome = [iscritto?.nome, iscritto?.cognome].filter(Boolean).join(" ");
    if (!window.confirm(
      `Riaprire il modulo di ${nome}?\n\n`
      + "Il link che le è già arrivato tornerà a funzionare, e dovrà rifirmare: "
      + "quello che ha mandato la prima volta resta archiviato qui dentro, non si cancella.\n\n"
      + "Avvisala, perché la mail non riparte da sola."
    )) return;
    setRiaprendo(true); setEsitoRiapertura("");
    const { data, error } = await supabase.rpc("modulo_riapri", {
      p_iscritto_id: iscritto.id,
      p_motivo: motivoRiapertura.trim() || null,
      p_chi: chi || null,
    });
    setRiaprendo(false);
    if (error || !data?.ok) {
      setEsitoRiapertura(data?.errore || error?.message || "Non sono riuscito a riaprirlo.");
      return;
    }
    setEsitoRiapertura("Fatto: il link si riapre. Avvisala che deve ricompilarlo e rifirmare.");
    setMotivoRiapertura("");
    onAggiornato();
  }

  async function rigenera() {
    setRigenerando(true); setEsito("");
    try {
      const { data, error } = await supabase.functions.invoke("modulo-ricevuto", {
        body: { token: iscritto.token_modulo, soloPdf: true },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.guastoPdf || "Non è stato possibile generare il documento.");
      setPercorso(data.percorso);
      setGeneratoIl(new Date().toISOString());
      setEsito(`Fatto: ${data.pagine} pagine.` + (data.scartate?.length ? ` Non sono entrate: ${data.scartate.join("; ")}` : ""));
      onAggiornato();
    } catch (e) {
      setEsito(e.message || String(e));
    } finally {
      setRigenerando(false);
    }
  }

  // la conferma di ricezione del modulo e' quella che conta: si cerca
  // fra gli invii la riga di quella mail
  const conferma = (invii || []).find((x) => x.chiave_modello === "ricezione_modulo");

  return (
    <div>
      <Riquadro
        titolo="La copia firmata"
        nota={!percorso
          ? "Le iscrizioni arrivate prima che questa copia esistesse non ce l'hanno: si genera adesso, e non fa ripartire nessuna mail."
          : "È il documento allegato alla mail di conferma: dati, regolamento com'era il giorno della firma, dichiarazioni con la loro ora, firma e documento d'identità."}
      >
        {percorso ? (
          <>
            <Riga etichetta="Generata il">{quando(generatoIl) || "—"}</Riga>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <Button onClick={() => linkPdf && window.open(linkPdf, "_blank", "noopener")} disabled={!linkPdf}>
                {linkPdf ? "Apri il modulo firmato" : "Preparo il link…"}
              </Button>
              <Button variant="ghost" onClick={rigenera} disabled={rigenerando || !iscritto?.token_modulo}>
                {rigenerando ? "Genero…" : "Rigenera"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ ...fontBody, fontSize: 13, color: AMBRA, marginBottom: 10 }}>
              Per questa iscrizione il documento non è ancora stato generato.
            </div>
            <Button onClick={rigenera} disabled={rigenerando || !iscritto?.token_modulo}>
              {rigenerando ? "Genero…" : "Genera la copia firmata"}
            </Button>
          </>
        )}
        {esito && (
          <div style={{ ...fontBody, fontSize: 12.5, marginTop: 10, lineHeight: 1.5, color: esito.startsWith("Fatto") ? VERDE : ROSSO }}>
            {esito}
          </div>
        )}
      </Riquadro>

      <Riquadro
        titolo="Riaprire il modulo"
        nota="Il link che le è arrivato torna a funzionare, e lei deve ricompilarlo e rifirmare. La mail non riparte da sola: avvisala tu. Quello che ha mandato la prima volta non si cancella — resta qui sotto, con la sua data."
      >
        <div style={{ ...fontBody, fontSize: 13, color: GRAFITE, lineHeight: 1.55, marginBottom: 10 }}>
          Serve quando manca qualcosa e il modulo va rifatto. Di suo il link vale una volta sola:
          senza questo tasto, chi lo riapre legge «già inviato».
        </div>
        <input
          value={motivoRiapertura}
          onChange={(e) => setMotivoRiapertura(e.target.value)}
          placeholder="Perché lo riapri (resta scritto)"
          style={{
            ...fontBody, fontSize: 13, width: "100%", boxSizing: "border-box", minWidth: 0,
            border: `1px solid ${CREAM_BORDER}`, borderRadius: 10, padding: "9px 11px", marginBottom: 10,
          }}
        />
        <Button variant="ghost" onClick={riapri} disabled={riaprendo || !percorso}>
          {riaprendo ? "Riapro…" : "Riapri il modulo"}
        </Button>
        {!percorso && (
          <div style={{ ...fontBody, fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
            Prima genera la copia firmata qui sopra: riaprire senza averla messa al sicuro
            vorrebbe dire restare senza nessuna delle due.
          </div>
        )}
        {esitoRiapertura && (
          <div style={{ ...fontBody, fontSize: 12.5, marginTop: 10, lineHeight: 1.5, color: esitoRiapertura.startsWith("Fatto") ? VERDE : ROSSO }}>
            {esitoRiapertura}
          </div>
        )}
        {(riaperture || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...fontBody, fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
              Già riaperto
            </div>
            {(riaperture || []).map((r) => (
              <div key={r.id} style={{ borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 8, marginTop: 8 }}>
                <Riga etichetta="Riaperto il">{quando(r.riaperto_il) || "—"}</Riga>
                <Riga etichetta="Da">{r.riaperto_da || "— non registrato —"}</Riga>
                <Riga etichetta="Perché">{r.motivo || "— nessun motivo scritto —"}</Riga>
                <Riga etichetta="Era arrivato il">{quando(r.modulo_ricevuto_il) || "—"}</Riga>
              </div>
            ))}
          </div>
        )}
      </Riquadro>

      <Riquadro
        titolo="La conferma di lettura"
        nota={"Dal 19/10/2026 la conferma si chiede al programma di posta dell'allieva. Se il suo la manda, arriva come email a notifiche@elitederma.it: non passa da qui e non compare in questa pagina. Mail di iPhone non la chiede mai, Gmail la ignora sugli account normali, e dove compare si può rifiutare."}
      >
        {/* QUESTO RIQUADRO NON PUO' PIU' DIRE DI SI'.
            Finche' c'era il tasto nella mail, la presa visione finiva
            scritta qui ed era la cosa che reggeva in una discussione. Il
            tasto e' stato tolto su richiesta, e le intestazioni standard
            non tornano nel registro: lo dice, invece di lasciare un
            "non ancora confermata" che aspetterebbe per sempre. */}
        {conferma?.confermata_il ? (
          <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: VERDE, lineHeight: 1.45 }}>
            Confermata dall&apos;allieva il {quando(conferma.confermata_il)}
          </div>
        ) : conferma ? (
          <div style={{ ...fontBody, fontSize: 13.5, color: GRAFITE, lineHeight: 1.55 }}>
            Chiesta insieme alla mail. Se è arrivata, è in casella a notifiche@elitederma.it.
            <div style={{ color: AMBRA, marginTop: 6 }}>
              Qui resta registrata solo la consegna, che è un&apos;altra cosa: dice che la casella l&apos;ha accettata, non che qualcuno l&apos;abbia letta.
            </div>
          </div>
        ) : (
          <div style={{ ...fontBody, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>
            Per questa iscrizione non risulta nessuna mail di conferma.
          </div>
        )}
      </Riquadro>

      <Riquadro
        titolo="Le mail mandate a questa allieva"
        nota={'"Aperta" si misura con un\'immagine invisibile che molti programmi di posta bloccano: se manca non vuol dire che non l\'abbia letta. Un rimbalzo invece è un guasto vero — vuol dire indirizzo sbagliato, e nessuna copia arrivata.'}
      >
        {invii === null && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Leggo il registro…</div>}
        {invii?.length === 0 && <div style={{ ...fontBody, fontSize: 13, color: MUTED }}>Nessuna mail registrata.</div>}
        {(invii || []).map((e) => (
          <div key={e.id} style={{ borderTop: `1px solid ${CREAM_BORDER}`, paddingTop: 10, marginTop: 10 }}>
            <div style={{ ...fontBody, fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{e.oggetto}</div>
            <Riga etichetta="Partita">{quando(e.inviata_il) || "—"}</Riga>
            <Riga etichetta="A">{e.destinatario || "— nessun indirizzo —"}</Riga>
            <Riga etichetta="Esito" colore={e.esito === "ok" ? VERDE : ROSSO}>
              {e.esito === "ok" ? "Partita senza errori" : `Non partita: ${e.errore || "motivo non registrato"}`}
            </Riga>
            {e.rimbalzata_il
              ? <Riga etichetta="Consegna" colore={ROSSO}>Rimbalzata il {quando(e.rimbalzata_il)}</Riga>
              : e.consegnata_il
                ? <Riga etichetta="Consegna" colore={VERDE}>Consegnata il {quando(e.consegnata_il)}</Riga>
                : <Riga etichetta="Consegna" colore={GRAFITE}>Nessuna conferma di consegna</Riga>}
            {e.aperta_il && <Riga etichetta="Aperta">{quando(e.aperta_il)}</Riga>}
            {e.confermata_il && <Riga etichetta="Presa visione" colore={VERDE}>{quando(e.confermata_il)}</Riga>}
          </div>
        ))}
      </Riquadro>
    </div>
  );
}
