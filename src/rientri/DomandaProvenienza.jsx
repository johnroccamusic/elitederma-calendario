// La domanda che compare al POS quando il prodotto appena scelto e' anche
// dentro un kit di riserva che sta in quell'aula.
//
// Due bottoni grandi, nessun campo, nessuna spiegazione da leggere: la
// master sta vendendo davanti a una cliente, non compilando un modulo.
//
// La seconda risposta cambia parola con la sede, perche' e' la stessa cosa
// vista da due posti: il magazzino centrale sta a Roma, quindi da Roma il
// pezzo lo si va a prendere e da qualunque altra sede lo si spedisce.

import { NAVY, CREAM_BORDER, MUTED, GOLD, fontBody, fontDisplay } from "../ui/stile.js";

export default function DomandaProvenienza({ prodotto, disponibilita, inSedeCentrale, isMobile = false, onDalKit, onDaMagazzino, onAnnulla }) {
  if (!prodotto || !disponibilita) return null;

  const daScegliere = (disponibilita.istanze || []).filter((i) => i.residuo > 0);
  const giaAperto = daScegliere.find((i) => i.stato === "aperto");
  // si chiede quale kit aprire solo quando sono tutti ancora sigillati e
  // ce n'e' piu' d'uno: se uno e' gia' aperto si pesca da quello e basta
  const deveScegliereIlKit = !giaAperto && daScegliere.length > 1;

  const tastoGrande = {
    ...fontBody, fontSize: isMobile ? 14 : 15, fontWeight: 700, textAlign: "left",
    padding: isMobile ? "16px 16px" : "18px 20px", borderRadius: 14, cursor: "pointer",
    width: "100%", boxSizing: "border-box", minHeight: 60, lineHeight: 1.3,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 1100 }}
      onClick={onAnnulla}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 18, padding: isMobile ? 18 : 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div style={{ ...fontBody, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
          Da dove esce questo pezzo
        </div>
        <div style={{ ...fontDisplay, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          {prodotto.nome}
        </div>
        <div style={{ ...fontBody, fontSize: 12.5, color: MUTED, marginBottom: 18, lineHeight: 1.45 }}>
          Ce ne {disponibilita.residuo === 1 ? "è ancora 1" : `sono ancora ${disponibilita.residuo}`} nei kit di riserva che hai in aula.
        </div>

        {deveScegliereIlKit ? (
          <>
            <div style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
              Quale kit apri?
            </div>
            {daScegliere.map((i) => (
              <button
                key={i.id}
                onClick={() => onDalKit(i)}
                style={{ ...tastoGrande, background: "#FBF6EA", color: NAVY, border: `1px solid ${GOLD}`, marginBottom: 8 }}
              >
                Kit di riserva #{i.progressivo}
                <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
                  ancora sigillato · {i.residuo} {i.residuo === 1 ? "pezzo" : "pezzi"} dentro
                </span>
              </button>
            ))}
          </>
        ) : (
          <button
            onClick={() => onDalKit(giaAperto || daScegliere[0])}
            style={{ ...tastoGrande, background: NAVY, color: "#fff", border: `1px solid ${NAVY}`, marginBottom: 10 }}
          >
            Lo prelevo dal kit
            <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              {giaAperto
                ? `Dal kit #${giaAperto.progressivo}, che è già aperto`
                : daScegliere[0] ? `Apre il kit #${daScegliere[0].progressivo}` : ""}
            </span>
          </button>
        )}

        <button
          onClick={onDaMagazzino}
          style={{ ...tastoGrande, background: "#fff", color: NAVY, border: `1px solid ${CREAM_BORDER}` }}
        >
          {inSedeCentrale ? "Lo prendiamo dal magazzino" : "Lo spediamo"}
          <span style={{ display: "block", ...fontBody, fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2 }}>
            {inSedeCentrale ? "Il magazzino centrale è qui" : "Parte dal magazzino centrale, come sempre"}
          </span>
        </button>

        <button
          onClick={onAnnulla}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "12px 0 0", width: "100%" }}
        >
          Lascia perdere
        </button>
      </div>
    </div>
  );
}
