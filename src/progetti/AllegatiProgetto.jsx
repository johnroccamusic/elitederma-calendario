// GLI ALLEGATI DI UN PROGETTO (26/10/2026): su ogni progetto uno o piu'
// file — bozze, preventivi, grafiche, foto. Una riga per file nella
// tabella progetti_allegati, il file nel secchio PRIVATO
// progetti-allegati, aperto con un link firmato che dura un'ora.
//
// Tre cose imparate sui documenti degli eventi e riapplicate qui: il
// tasto per caricare E' il campo file dentro una label (su iPhone un
// input aperto con .click() funziona una volta sola); la finestra per
// aprire il file si apre DENTRO il gesto, vuota, e si riempie dopo; se
// la riga non si scrive, il file caricato viene tolto invece di restare
// orfano in un secchio dove nessuno lo ritrova.
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { NAVY, MUTED, GOLD, CREAM_BORDER, fontBody } from "../ui/stile.js";

const SECCHIO = "progetti-allegati";

export function misuraFile(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function leggiAllegati(progettoId) {
  const { data, error } = await supabase.from("progetti_allegati").select("*").eq("progetto_id", progettoId).order("caricato_il");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function caricaAllegato(progettoId, file, chi) {
  if (!file) throw new Error("Nessun file scelto.");
  // il nome del file non finisce nel percorso: spazi, accenti e
  // parentesi fanno un percorso che un giorno non si riapre. Il nome
  // vero sta nella riga.
  const estensione = (file.name?.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  const percorso = `${progettoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${estensione ? "." + estensione : ""}`;
  const { error } = await supabase.storage.from(SECCHIO).upload(percorso, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(`Non riesco a caricare «${file.name}»: ${error.message}`);
  const { data, error: erroreRiga } = await supabase.from("progetti_allegati")
    .insert({ progetto_id: progettoId, nome: file.name || "Allegato", percorso, tipo: file.type || null, dimensione: file.size || null, caricato_da: chi || null })
    .select().single();
  if (erroreRiga) {
    await supabase.storage.from(SECCHIO).remove([percorso]);
    throw new Error(`«${file.name}» caricato ma non registrato: ${erroreRiga.message}`);
  }
  return data;
}

// il file per primo, poi la riga: al contrario resterebbe una riga che
// punta al vuoto
export async function eliminaAllegato(a) {
  if (a?.percorso) await supabase.storage.from(SECCHIO).remove([a.percorso]);
  const { error } = await supabase.from("progetti_allegati").delete().eq("id", a.id);
  if (error) throw new Error(error.message);
}

export async function linkAllegato(percorso, secondi = 3600) {
  const { data, error } = await supabase.storage.from(SECCHIO).createSignedUrl(percorso, secondi);
  if (error) throw new Error(error.message);
  const indirizzo = data?.signedUrl || "";
  // non basta che sia una stringa: con una risposta storta il client
  // compone «.../storage/v1undefined», che e' una stringa piena e un
  // indirizzo che non esiste
  if (!/^https?:\/\//.test(indirizzo)) throw new Error("link non valido");
  return indirizzo;
}

export default function AllegatiProgetto({ progettoId, chi = "", compatto = false }) {
  const [righe, setRighe] = useState(null);
  const [caricando, setCaricando] = useState(0); // quanti file stanno salendo
  const [guasto, setGuasto] = useState("");

  const ricarica = () => leggiAllegati(progettoId).then(setRighe).catch((e) => { setRighe([]); setGuasto(e.message); });
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [progettoId]);

  // piu' file in un colpo: si caricano uno alla volta, e un file che
  // fallisce non ferma gli altri — si dice quale
  async function carica(lista) {
    const file = [...(lista || [])];
    if (!file.length) return;
    setGuasto(""); setCaricando(file.length);
    const errori = [];
    for (const f of file) {
      try { await caricaAllegato(progettoId, f, chi); } catch (e) { errori.push(e.message); }
      setCaricando((n) => n - 1);
    }
    if (errori.length) setGuasto(errori.join(" · "));
    await ricarica();
  }
  async function apri(a) {
    const finestra = window.open("", "_blank", "noopener");
    try {
      const indirizzo = await linkAllegato(a.percorso);
      if (finestra) finestra.location = indirizzo; else window.location.href = indirizzo;
    } catch (e) {
      if (finestra) finestra.close();
      setGuasto(`Non riesco ad aprire «${a.nome}»: ${e.message}`);
    }
  }
  async function elimina(a) {
    if (!window.confirm(`Eliminare «${a.nome}»?\n\nIl file viene cancellato, non solo tolto dall'elenco.`)) return;
    setGuasto("");
    try { await eliminaAllegato(a); await ricarica(); } catch (e) { setGuasto(`Non eliminato: ${e.message}`); }
  }

  return (
    <div data-campo="allegati-progetto" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...fontBody, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Allegati{righe && righe.length ? ` (${righe.length})` : ""}
        </span>
        {/* il tasto E' il campo, con multiple: uno o piu' file insieme */}
        <label data-campo="allega" style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: caricando ? "default" : "pointer", ...fontBody, fontSize: 12, fontWeight: 700, color: GOLD }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          {caricando ? `Carico… (${caricando})` : "Allega file"}
          <input type="file" multiple disabled={!!caricando} style={{ display: "none" }} onChange={(e) => { carica(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {guasto && <div style={{ ...fontBody, fontSize: 12, color: "#C0392B", marginTop: 4 }}>{guasto}</div>}
      {righe && righe.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {righe.map((a) => (
            <div key={a.id} data-campo="allegato" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: compatto ? "3px 0" : "5px 8px", borderRadius: 8, background: compatto ? "transparent" : "#FAF8F3" }}>
              <button type="button" onClick={() => apri(a)} title="Apri l'allegato"
                style={{ all: "unset", cursor: "pointer", ...fontBody, fontSize: 13, color: NAVY, fontWeight: 600, textDecoration: "underline", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {a.nome}
              </button>
              <span style={{ ...fontBody, fontSize: 11, color: MUTED, whiteSpace: "nowrap", flexShrink: 0 }}>{misuraFile(a.dimensione)}{a.caricato_da ? ` · ${a.caricato_da}` : ""}</span>
              <button type="button" onClick={() => elimina(a)} title="Elimina l'allegato" aria-label={`Elimina ${a.nome}`}
                style={{ all: "unset", cursor: "pointer", color: "#C0392B", display: "flex", flexShrink: 0, padding: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
