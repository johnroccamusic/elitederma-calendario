// IL DOCUMENTO SI GUARDA PRIMA DI MANDARLO, E SI RITAGLIA.
//
// Finora si sceglieva un file e via: nessuna anteprima, nessun modo di
// accorgersi che era storto, scuro o che era partita la foto sbagliata.
// Il primo a cui e' capitato e' stato il titolare, caricando da PC.
//
// Qui l'allieva vede quello che sta per mandare, lo gira se il telefono
// l'ha messo di lato, e tira il riquadro intorno al documento. Quello
// che parte e' il ritaglio: lo sfondo del tavolo non serve a nessuno e
// pesa, e un documento inquadrato male e' la prima causa di un modulo
// da rifare.
//
// SOLO PNG E JPG, per decisione del 20/10/2026. Un PDF non si ritaglia
// senza prima trasformarlo in immagine, e si e' scelto di non
// accettarlo affatto: chi carica da PC lo converte o fotografa il
// documento. Quello che non si accetta **si dice** — la vecchia strada
// scartava in silenzio, ed e' il modo migliore per ricevere moduli
// senza documento senza che nessuno se ne accorga.
import React, { useEffect, useRef, useState } from "react";
import { NAVY, MUTED, CREAM_BORDER, GOLD, fontBody } from "../ui/stile.js";

const FORMATI = ["image/jpeg", "image/png"];
const LATO_MAX = 1600;

/** Che cos'e' questo file, letto dai primi byte e non dal nome: il nome
 *  mente, e su iPhone un HEIC rinominato .jpg arriva lo stesso. */
export async function tipoVero(file) {
  try {
    const testa = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (testa[0] === 0xff && testa[1] === 0xd8) return "image/jpeg";
    if (testa[0] === 0x89 && testa[1] === 0x50 && testa[2] === 0x4e && testa[3] === 0x47) return "image/png";
    if (testa[0] === 0x25 && testa[1] === 0x50 && testa[2] === 0x44 && testa[3] === 0x46) return "application/pdf";
    // HEIC/HEIF: "ftyp" al quinto byte, poi il marchio
    const marchio = String.fromCharCode(...testa.slice(4, 12));
    if (marchio.startsWith("ftyp") && /heic|heif|mif1|msf1/i.test(marchio)) return "image/heic";
    return "ignoto";
  } catch { return "ignoto"; }
}

export function perchePuoiNonMandarlo(tipo) {
  if (tipo === "application/pdf") {
    return "Questo è un PDF e da qui non posso aprirlo: fai una foto del documento, oppure salva il PDF come immagine (JPG o PNG) e ricaricalo.";
  }
  if (tipo === "image/heic") {
    return "Questa foto è in formato HEIC, che non tutti i programmi aprono. Riscattala con l'app Fotocamera, oppure dalle impostazioni del telefono scegli «Massima compatibilità».";
  }
  return "Questo file non è una foto che posso aprire: serve un'immagine JPG o PNG.";
}

/** Il ritaglio, disegnato davvero su una tela: rotazione prima, taglio
 *  dopo, e il risultato riscritto in JPEG — il formato che pesa meno a
 *  parita' di leggibilita' su una fotografia. */
export async function ritaglia(immagine, { giri, box }) {
  const dritta = giri % 2 === 0;
  const largaPiena = dritta ? immagine.naturalWidth : immagine.naturalHeight;
  const altaPiena = dritta ? immagine.naturalHeight : immagine.naturalWidth;
  // il riquadro arriva in frazioni dell'immagine girata: cosi' non
  // dipende da quanto e' grande lo schermo di chi ritaglia
  const sx = Math.round(box.x * largaPiena);
  const sy = Math.round(box.y * altaPiena);
  const sw = Math.max(1, Math.round(box.w * largaPiena));
  const sh = Math.max(1, Math.round(box.h * altaPiena));
  const scala = Math.min(1, LATO_MAX / Math.max(sw, sh));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(sw * scala));
  tela.height = Math.max(1, Math.round(sh * scala));
  const c = tela.getContext("2d");
  // si gira la tela intorno al centro del ritaglio, poi si disegna
  // l'immagine intera: e' il modo in cui rotazione e taglio restano un
  // conto solo invece di due passaggi che si rincorrono
  c.save();
  c.translate(tela.width / 2, tela.height / 2);
  c.rotate((giri * Math.PI) / 2);
  const larga = dritta ? tela.width : tela.height;
  const alta = dritta ? tela.height : tela.width;
  c.drawImage(
    immagine,
    dritta ? sx : sy, dritta ? sy : sx,
    dritta ? sw : sh, dritta ? sh : sw,
    -larga / 2, -alta / 2, larga, alta,
  );
  c.restore();
  return new Promise((risolvi) => {
    tela.toBlob((b) => risolvi(b), "image/jpeg", 0.85);
  });
}

const TUTTO = { x: 0, y: 0, w: 1, h: 1 };

export default function RitaglioFoto({ file, etichetta, onConferma, onAnnulla }) {
  const [indirizzo, setIndirizzo] = useState(null);
  const [giri, setGiri] = useState(0);
  const [box, setBox] = useState(TUTTO);
  const [lavoro, setLavoro] = useState(false);
  const immagine = useRef(null);
  const riquadro = useRef(null);
  const trascino = useRef(null);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setIndirizzo(url);
    setGiri(0); setBox(TUTTO);
    // l'indirizzo si butta quando si cambia foto: altrimenti il browser
    // tiene in memoria ogni scatto di chi ne ha provati cinque
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function partiTrascinamento(e, angolo) {
    e.preventDefault();
    e.stopPropagation();
    trascino.current = { angolo, box };
  }
  function muovi(e) {
    if (!trascino.current || !riquadro.current) return;
    const r = riquadro.current.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    const x = Math.min(1, Math.max(0, (punto.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (punto.clientY - r.top) / r.height));
    const { angolo, box: partenza } = trascino.current;
    setBox((prec) => {
      const b = { ...prec };
      // un riquadro non puo' rivoltarsi: sotto il cinque per cento si
      // ferma, o si ritaglia il nulla e la foto esce vuota
      const minimo = 0.05;
      if (angolo === "nw") { b.w = partenza.x + partenza.w - x; b.h = partenza.y + partenza.h - y; b.x = x; b.y = y; }
      if (angolo === "ne") { b.w = x - partenza.x; b.h = partenza.y + partenza.h - y; b.y = y; }
      if (angolo === "sw") { b.w = partenza.x + partenza.w - x; b.h = y - partenza.y; b.x = x; }
      if (angolo === "se") { b.w = x - partenza.x; b.h = y - partenza.y; }
      if (b.w < minimo) { b.w = minimo; b.x = Math.min(b.x, 1 - minimo); }
      if (b.h < minimo) { b.h = minimo; b.y = Math.min(b.y, 1 - minimo); }
      b.x = Math.max(0, Math.min(b.x, 1 - b.w));
      b.y = Math.max(0, Math.min(b.y, 1 - b.h));
      return b;
    });
  }
  function fermaTrascinamento() { trascino.current = null; }

  useEffect(() => {
    window.addEventListener("mousemove", muovi);
    window.addEventListener("mouseup", fermaTrascinamento);
    window.addEventListener("touchmove", muovi, { passive: false });
    window.addEventListener("touchend", fermaTrascinamento);
    return () => {
      window.removeEventListener("mousemove", muovi);
      window.removeEventListener("mouseup", fermaTrascinamento);
      window.removeEventListener("touchmove", muovi);
      window.removeEventListener("touchend", fermaTrascinamento);
    };
  });

  async function conferma() {
    if (!immagine.current) return;
    setLavoro(true);
    const ritagliata = await ritaglia(immagine.current, { giri, box });
    setLavoro(false);
    if (!ritagliata) { onConferma(file); return; }
    const nome = `${(etichetta || "documento").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
    onConferma(new File([ritagliata], nome, { type: "image/jpeg" }));
  }

  const maniglia = (angolo, stile) => (
    <span
      onMouseDown={(e) => partiTrascinamento(e, angolo)}
      onTouchStart={(e) => partiTrascinamento(e, angolo)}
      data-maniglia={angolo}
      style={{
        position: "absolute", width: 30, height: 30, borderRadius: 999,
        background: "#fff", border: `2px solid ${NAVY}`, boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        touchAction: "none", cursor: "pointer", ...stile,
      }}
    />
  );

  return (
    <div>
      <div style={{ ...fontBody, fontSize: 12.5, color: NAVY, marginBottom: 8, lineHeight: 1.5 }}>
        Tira gli angoli intorno al documento. Quello che resta dentro è quello che ci mandi.
      </div>
      <div
        ref={riquadro}
        style={{
          position: "relative", width: "100%", background: "#111", borderRadius: 12,
          overflow: "hidden", userSelect: "none", touchAction: "none",
        }}
      >
        {indirizzo && (
          <img
            ref={immagine} src={indirizzo} alt={etichetta || "documento"}
            style={{ display: "block", width: "100%", transform: `rotate(${giri * 90}deg)` }}
          />
        )}
        {/* quello che resta fuori si scurisce: il ritaglio si capisce
            guardando, senza leggere niente */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: `inset 0 0 0 9999px rgba(0,0,0,0.45)`,
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.x * 100}% ${box.y * 100}%, ${box.x * 100}% ${(box.y + box.h) * 100}%, ${(box.x + box.w) * 100}% ${(box.y + box.h) * 100}%, ${(box.x + box.w) * 100}% ${box.y * 100}%, ${box.x * 100}% ${box.y * 100}%)`,
        }} />
        <div style={{
          position: "absolute", pointerEvents: "none",
          left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.w * 100}%`, height: `${box.h * 100}%`,
          border: `2px solid ${GOLD}`,
        }} />
        {maniglia("nw", { left: `calc(${box.x * 100}% - 15px)`, top: `calc(${box.y * 100}% - 15px)` })}
        {maniglia("ne", { left: `calc(${(box.x + box.w) * 100}% - 15px)`, top: `calc(${box.y * 100}% - 15px)` })}
        {maniglia("sw", { left: `calc(${box.x * 100}% - 15px)`, top: `calc(${(box.y + box.h) * 100}% - 15px)` })}
        {maniglia("se", { left: `calc(${(box.x + box.w) * 100}% - 15px)`, top: `calc(${(box.y + box.h) * 100}% - 15px)` })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" onClick={() => setGiri((g) => (g + 3) % 4)}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "9px 14px", cursor: "pointer" }}>
          ⟲ Gira
        </button>
        <button type="button" onClick={() => setGiri((g) => (g + 1) % 4)}
          style={{ ...fontBody, fontSize: 12.5, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${CREAM_BORDER}`, borderRadius: 12, padding: "9px 14px", cursor: "pointer" }}>
          ⟳ Gira
        </button>
        <button type="button" onClick={() => setBox(TUTTO)}
          style={{ ...fontBody, fontSize: 12.5, color: MUTED, background: "none", border: "none", cursor: "pointer" }}>
          tutta la foto
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onAnnulla}
          style={{ ...fontBody, fontSize: 12.5, color: MUTED, background: "none", border: "none", cursor: "pointer" }}>
          cambia foto
        </button>
        <button type="button" onClick={conferma} disabled={lavoro}
          style={{ ...fontBody, fontSize: 13, fontWeight: 700, color: "#fff", background: NAVY, border: "none", borderRadius: 12, padding: "10px 18px", cursor: lavoro ? "default" : "pointer", opacity: lavoro ? 0.6 : 1 }}>
          {lavoro ? "Preparo…" : "Va bene così"}
        </button>
      </div>
    </div>
  );
}

export { FORMATI };
