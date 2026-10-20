// IL COMUNE DI NASCITA SI SCEGLIE DA UN ELENCO, NON SI INDOVINA.
//
// Era una casella di testo libero, e il codice fiscale si calcola solo
// col nome ufficiale, parola per parola: chi scrive «REGGIO CALABRIA»
// — cioe' chiunque, perche' il «di» non lo dice nessuno — non otteneva
// niente, e niente spiegava perche'. Stessa cosa per «S. GIOVANNI
// ROTONDO», «PATERNO» senza accento, «REGGIO EMILIA».
//
// Qui sotto la casella compare l'elenco dei comuni che c'entrano, con
// la loro provincia accanto: la provincia non e' decorazione, serve a
// distinguere i quattro Paterno e i tre Reggio. Si sceglie, e in
// archivio finisce il nome ufficiale.
//
// PERCHE' NON UNA TENDINA CHIUSA come il comune di residenza: quella si
// scende per gradini (regione -> provincia -> comune) e qui non c'e'
// nessun gradino prima — il luogo di nascita non ha niente a che fare
// con dove si abita. Settemilanovecento voci in una tendina sola non si
// scorrono.
//
// Niente rete: l'elenco ISTAT l'app se lo porta gia' dietro, quindi
// risponde anche col telefono senza campo. E' l'opposto della via, che
// va chiesta a OpenStreetMap perche' un elenco completo non esiste.
import React, { useState } from "react";
import { cercaComuni } from "../comuni-regioni.js";
import { NAVY, MUTED, CREAM_BORDER, fontBody } from "../ui/stile.js";

export default function CampoComuneNascita({
  valore, scrivi, esceDalCampo = () => {}, chiave = "comune_nascita",
  stile, spenta = false, suggerimento = "",
}) {
  // si cerca solo mentre qualcuno scrive: aprendo una scheda gia'
  // compilata l'elenco non deve comparire a suggerire quello che c'e'
  // gia' — e' lo stesso motivo per cui esiste in CampoVia
  const [digitando, setDigitando] = useState(false);
  const scritto = valore || "";
  // IL COMUNE SCRITTO PER INTERO RESTA NELL'ELENCO, ED E' IL PRIMO.
  //
  // C'era un filtro che toglieva la proposta identica a quello che si
  // stava scrivendo — copiato dal campo della via, dove ha senso perche'
  // li' la proposta non porta niente che non ci sia gia'. Qui toglieva
  // la riga che conta: scritto «ROMA» sparivano Roma e restavano Fiano
  // Romano, Monte Romano, Cineto Romano… cioe' sette paesi e non il
  // posto che si era appena scritto.
  //
  // Vedere «Roma (RM)» in cima non e' una ripetizione: e' la conferma
  // che quel nome l'elenco lo conosce, ed e' l'unica cosa da cui
  // dipende il codice fiscale.
  const utili = digitando && !spenta && scritto.trim().length >= 2
    ? cercaComuni(scritto)
    : [];

  return (
    <div style={{ position: "relative" }}>
      <input
        data-campo={chiave}
        value={scritto}
        disabled={spenta}
        placeholder={spenta ? "" : suggerimento}
        className="suggerimento-chiaro"
        autoComplete="off"
        onChange={(e) => { scrivi(chiave, e.target.value.toUpperCase()); setDigitando(true); }}
        // il clic su una proposta arriva DOPO il blur: senza il ritardo
        // l'elenco si chiude prima che il dito lo raggiunga
        onBlur={() => { setTimeout(() => setDigitando(false), 150); esceDalCampo(); }}
        style={stile}
      />
      {utili.length > 0 && (
        <div style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", marginTop: 2,
          background: "#FFF", border: `1px solid ${CREAM_BORDER}`, borderRadius: 8,
          boxShadow: "0 6px 18px rgba(14,27,51,0.12)", overflow: "hidden",
        }}>
          {utili.map((x, i) => (
            <div
              key={`${x.nome}|${x.sigla}`}
              data-proposta={i}
              // `mousedown` e non `click`: il blur della casella arriva
              // prima del clic e chiuderebbe l'elenco a mezz'aria
              onMouseDown={() => {
                scrivi(chiave, x.nome.toUpperCase());
                setDigitando(false);
                esceDalCampo();
              }}
              style={{
                ...fontBody, fontSize: 13.5, color: NAVY, padding: "9px 11px", cursor: "pointer",
                borderTop: i === 0 ? "none" : `1px solid ${CREAM_BORDER}`,
              }}
            >
              {x.nome}
              {x.sigla ? <span style={{ color: MUTED }}>{` (${x.sigla})`}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
