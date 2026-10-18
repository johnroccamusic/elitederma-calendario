// IL FASCICOLO DI UN'ISCRIZIONE: cosa ha firmato, e cosa le e' arrivato.
//
// Si apre dalla tessera "Modulo ricevuto" della fascia di stato. Finche'
// non c'era, di un modulo arrivato si vedeva solo che era arrivato: il
// documento che l'allieva aveva sottoscritto stava sparso fra tre file
// in un secchio privato, e della mail di conferma non restava niente
// sotto gli occhi di nessuno.
//
// Qui dentro ci sono le tre cose che servono in una discussione, e sono
// tre cose diverse:
//
//   LA COPIA FIRMATA   il PDF con dati, regolamento di quel giorno,
//                      dichiarazioni con la loro ora, firma e documento
//   L'INVIO            che la mail e' partita, a chi, quando, e se il
//                      server di posta di lei l'ha accettata
//   LA PRESA VISIONE   che lei ha premuto il tasto e ha dichiarato di
//                      averla ricevuta
//
// Le ultime due si somigliano e non sono la stessa cosa. "Consegnata" lo
// dice il postino; "presa visione" lo dice la persona. Davanti a una
// contestazione vale la seconda — per questo sta in fondo, scritta
// grande, e non e' un dettaglio in una riga di registro.
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

export default function Fascicolo({ iscritto, onAggiornato = () => {} }) {
  const [linkPdf, setLinkPdf] = useState("");
  const [invii, setInvii] = useState(null);
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
        titolo="La presa visione"
        nota={'È la dichiarazione dell\'allieva, non un dato tecnico: preme il tasto in fondo alla mail e da quel momento risulta che ha ricevuto la sua copia. "Consegnata" lo dice il server di posta, questa la dice lei.'}
      >
        {conferma?.confermata_il ? (
          <div style={{ ...fontBody, fontSize: 15, fontWeight: 700, color: VERDE, lineHeight: 1.45 }}>
            Confermata il {quando(conferma.confermata_il)}
          </div>
        ) : conferma ? (
          <div style={{ ...fontBody, fontSize: 13.5, color: AMBRA, lineHeight: 1.5 }}>
            Non ancora confermata. La mail è partita: il tasto è in fondo al messaggio, e finché non lo preme qui non cambia niente.
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
