// LA LOCANDINA SI SFOGLIA COL DITO E SI ALLARGA CON DUE (9/11/2026).
//
// Il titolare: «la locandina, che se e' composta di piu' pagine posso
// sfogliare col dito facendo slide da destra verso sinistra, e col pinch
// posso zoomare per vedere i prezzi».
//
// Due posti, un componente: il riquadro dentro la chat — dove si sfoglia
// e si capisce quale foglio e' — e lo schermo pieno, dove i prezzi si
// leggono davvero. In un pannello da 380 px una locandina e' un
// francobollo: sfogliarla li' serve a scegliere, non a leggere, e per
// questo il tocco apre.
//
// Le pagine arrivane gia' pronte come IMMAGINI (vedi
// `pagineDelleLocandine` in App.jsx): un PDF di tre pagine arriva come
// tre pagine. Qui dentro non si sa niente di PDF, e un prodotto, un
// corso o un diploma si sfoglierebbero con lo stesso componente.
import { useEffect, useRef, useState } from "react";
import { NAVY, MUTED, CREAM_BORDER, fontBody, fontDisplay } from "../ui/stile.js";

const ZOOM_MAX = 5;
// quanto deve correre il dito prima che la pagina cambi: meno di cosi' e
// un tocco storto sfoglierebbe da solo
const CORSA_MINIMA = 44;
// quanto deve muoversi il dito prima di decidere se sta sfogliando o
// scorrendo la chat: sotto questa soglia non si decide niente
const SOGLIA_DIREZIONE = 8;

const distanza = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const mezzo = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
const fra = (v, min, max) => Math.max(min, Math.min(max, v));

// IL RIQUADRO CHE SI TOCCA. Tiene lo zoom e lo scorrimento del dito;
// l'indice della pagina sta fuori, perche' la chat e lo schermo pieno
// devono mostrare la stessa pagina.
function Visore({ pagine, indice, onIndice, pieno, onApri }) {
  const box = useRef(null);
  const gesto = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [trascina, setTrascina] = useState(0);
  const [animato, setAnimato] = useState(true);
  const ultimoTocco = useRef(0);
  // IL GESTO SI DECIDE SUL GESTO, NON SU QUELLO CHE E' GIA' DISEGNATO.
  //
  // Zoom, spostamento e corsa del dito vivono anche qui, in un ref:
  // React accorpa i cambi di stato e li disegna dopo, quindi un dito
  // alzato nello stesso istante in cui si e' mosso leggerebbe i valori
  // di prima del gesto — e la pagina resterebbe dov'era. Lo stato
  // serve a disegnare, il ref a decidere.
  const vivo = useRef({ zoom: 1, pan: { x: 0, y: 0 }, trascina: 0 });
  function metti(z, p) { vivo.current.zoom = z; vivo.current.pan = p; setZoom(z); setPan(p); }
  function mettiTrascina(dx) { vivo.current.trascina = dx; setTrascina(dx); }
  // cambiata pagina si riparte da intera: una pagina nuova che arriva
  // ingrandita e spostata la si guarda senza capire cos'e'
  useEffect(() => { metti(1, { x: 0, y: 0 }); }, [indice]);

  const quante = pagine.length;
  function vaA(n) {
    const prossimo = fra(n, 0, quante - 1);
    if (prossimo !== indice) onIndice(prossimo);
  }
  // il pan non porta mai l'immagine fuori dal riquadro: oltre il bordo
  // comparirebbe il vuoto, e si perde di vista dove si sta guardando
  function panLegale(x, y, z) {
    const r = box.current?.getBoundingClientRect();
    const lx = r ? (r.width * (z - 1)) / 2 : 0;
    const ly = r ? (r.height * (z - 1)) / 2 : 0;
    return { x: fra(x, -lx, lx), y: fra(y, -ly, ly) };
  }

  // I LISTENER SI ATTACCANO A MANO, non con onTouchMove.
  //
  // React registra `touchmove` come listener PASSIVO: da dentro, un
  // `preventDefault()` non fa niente e il browser continua a scorrere la
  // pagina e a zoomare di suo mentre si sfoglia. Con addEventListener e
  // `{ passive: false }` il gesto e' nostro davvero.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    function inizio(e) {
      // IL TOCCO SULLE FRECCE NON E' UN GESTO SULLA FOTO: senza questa
      // riga, premere «›» nel riquadro della chat cambiava pagina E
      // apriva lo schermo pieno, due cose per un dito solo
      if (e.target?.closest?.("button")) { gesto.current = null; return; }
      setAnimato(false);
      if (e.touches.length >= 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const r = el.getBoundingClientRect();
        const c = mezzo(a, b);
        gesto.current = {
          modo: "pinch", d0: distanza(a, b) || 1, zoom0: vivo.current.zoom, pan0: { ...vivo.current.pan },
          c0: { x: c.x - (r.left + r.width / 2), y: c.y - (r.top + r.height / 2) },
        };
        e.preventDefault();
        return;
      }
      const t = e.touches[0];
      if (!t) { gesto.current = null; return; }
      gesto.current = {
        // con lo zoom acceso il dito sposta l'immagine; a pagina intera
        // non si sa ancora se sta sfogliando o scorrendo la chat
        modo: vivo.current.zoom > 1 ? "pan" : "forse",
        x0: t.clientX, y0: t.clientY, pan0: { ...vivo.current.pan }, mosso: false,
      };
    }
    function muovi(e) {
      const g = gesto.current;
      if (!g) return;
      if (g.modo === "pinch") {
        if (e.touches.length < 2) return;
        const [a, b] = [e.touches[0], e.touches[1]];
        const z = fra((g.zoom0 * distanza(a, b)) / g.d0, 1, ZOOM_MAX);
        // lo zoom cresce INTORNO AL PUNTO FRA LE DUE DITA: altrimenti
        // allargando si perde di vista la riga che si stava leggendo
        const px = g.c0.x - ((g.c0.x - g.pan0.x) * z) / g.zoom0;
        const py = g.c0.y - ((g.c0.y - g.pan0.y) * z) / g.zoom0;
        metti(z, z <= 1 ? { x: 0, y: 0 } : panLegale(px, py, z));
        e.preventDefault();
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) g.mosso = true;
      if (g.modo === "forse") {
        if (Math.abs(dx) < SOGLIA_DIREZIONE && Math.abs(dy) < SOGLIA_DIREZIONE) return;
        // IL DITO IN VERTICALE RESTA DELLA CHAT. Il pannello
        // dell'assistente scorre: prendersi anche quel gesto vorrebbe
        // dire una conversazione che non si puo' piu' far scorrere
        // passando sopra una locandina.
        g.modo = Math.abs(dx) > Math.abs(dy) ? "sfoglia" : "scorre";
      }
      if (g.modo === "scorre") return;
      if (g.modo === "pan") {
        metti(vivo.current.zoom, panLegale(g.pan0.x + dx, g.pan0.y + dy, vivo.current.zoom));
        e.preventDefault();
        return;
      }
      // sfoglia: il primo e l'ultimo foglio frenano, cosi' si sente che
      // di la' non c'e' niente invece di sembrare che il tocco non vada
      const bordo = (dx > 0 && indice === 0) || (dx < 0 && indice === quante - 1);
      mettiTrascina(bordo ? dx / 4 : dx);
      e.preventDefault();
    }
    function fine(e) {
      const g = gesto.current;
      if (!g) { setAnimato(true); return; }
      if (g.modo === "sfoglia") {
        const dx = vivo.current.trascina;
        setAnimato(true); mettiTrascina(0);
        if (dx <= -CORSA_MINIMA) vaA(indice + 1);
        else if (dx >= CORSA_MINIMA) vaA(indice - 1);
      } else if (g.modo === "pinch" || g.modo === "pan") {
        setAnimato(true);
        if (vivo.current.zoom <= 1.03) metti(1, { x: 0, y: 0 });
      } else {
        setAnimato(true);
        // UN TOCCO FERMO: nella chat apre, a schermo pieno il doppio
        // tocco ingrandisce (ed e' l'unico modo di zoomare per chi ha un
        // dito solo libero, con lo scatolone nell'altra mano)
        if (!g.mosso && e.touches.length === 0) {
          const adesso = Date.now();
          const doppio = adesso - ultimoTocco.current < 320;
          ultimoTocco.current = adesso;
          if (onApri) onApri();
          else if (doppio) {
            if (vivo.current.zoom > 1) metti(1, { x: 0, y: 0 });
            else metti(2.6, { x: 0, y: 0 });
            e.preventDefault();
          }
        }
      }
      if (e.touches.length === 0) gesto.current = null;
    }
    el.addEventListener("touchstart", inizio, { passive: false });
    el.addEventListener("touchmove", muovi, { passive: false });
    el.addEventListener("touchend", fine, { passive: false });
    el.addEventListener("touchcancel", fine, { passive: false });
    return () => {
      el.removeEventListener("touchstart", inizio);
      el.removeEventListener("touchmove", muovi);
      el.removeEventListener("touchend", fine);
      el.removeEventListener("touchcancel", fine);
    };
    // SENZA ELENCO DI DIPENDENZE, APPOSTA: si riattacca a ogni disegno.
    // Queste tre funzioni leggono zoom, pan, trascinamento e pagina di
    // ADESSO; con un elenco di dipendenze (o con `[]`) il dito alzato
    // deciderebbe in base al valore di quando il listener e' nato, e lo
    // sfogliamento si fermerebbe sulla pagina sbagliata.
  });

  // da scrivania non c'e' il pinch: ctrl+rotella (o il pizzico del
  // trackpad, che arriva come ctrl+rotella) ingrandisce
  function rotella(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const z = fra(vivo.current.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 1, ZOOM_MAX);
    metti(z, z <= 1 ? { x: 0, y: 0 } : vivo.current.pan);
  }

  return (
    <div
      ref={box}
      data-campo={pieno ? "sfoglia-pieno" : "sfoglia-locandina"}
      onWheel={rotella}
      // `pan-y` lascia alla chat lo scorrimento verticale e si tiene
      // l'orizzontale; a schermo pieno non c'e' niente dietro da
      // scorrere, quindi il gesto e' tutto nostro
      style={{
        position: "relative", overflow: "hidden", touchAction: pieno ? "none" : "pan-y",
        background: pieno ? "transparent" : "#F4F2EC",
        borderRadius: pieno ? 0 : 10, border: pieno ? "none" : `1px solid ${CREAM_BORDER}`,
        width: "100%", height: "100%", cursor: onApri ? "zoom-in" : "default",
        userSelect: "none", WebkitUserSelect: "none",
      }}
    >
      <div style={{
        display: "flex", width: "100%", height: "100%",
        transform: `translateX(calc(${-indice * 100}% + ${trascina}px))`,
        transition: animato ? "transform 230ms ease" : "none",
      }}>
        {pagine.map((p, i) => (
          <div key={p.chiave} data-campo="pagina-locandina" style={{ flex: "0 0 100%", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {p.guasta
              ? <div style={{ ...fontBody, fontSize: 12, color: "#B3261E", padding: 12, textAlign: "center" }}>{p.guasta}</div>
              : <img
                  src={p.url} alt={p.titolo} draggable={false}
                  style={{
                    maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block",
                    transform: i === indice ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : "none",
                    transition: animato ? "transform 160ms ease" : "none",
                    pointerEvents: "none",
                  }}
                />}
          </div>
        ))}
      </div>
      {/* le frecce: il dito sfoglia, ma col mouse e per chi non sa che si
          sfoglia servono due tasti che si vedono */}
      {quante > 1 && (
        <>
          <button type="button" data-campo="pagina-prima" aria-label="Pagina precedente" disabled={indice === 0}
            onClick={(e) => { e.stopPropagation(); setAnimato(true); vaA(indice - 1); }}
            style={{ ...frecciaStile("left"), opacity: indice === 0 ? 0.25 : 1 }}>‹</button>
          <button type="button" data-campo="pagina-dopo" aria-label="Pagina successiva" disabled={indice === quante - 1}
            onClick={(e) => { e.stopPropagation(); setAnimato(true); vaA(indice + 1); }}
            style={{ ...frecciaStile("right"), opacity: indice === quante - 1 ? 0.25 : 1 }}>›</button>
        </>
      )}
    </div>
  );
}

function frecciaStile(lato) {
  return {
    position: "absolute", top: "50%", transform: "translateY(-50%)", [lato]: 6,
    width: 34, height: 34, borderRadius: "50%", padding: 0, cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.35)", background: "rgba(14,27,51,0.62)", color: "#fff",
    ...fontDisplay, fontSize: 20, lineHeight: "30px", textAlign: "center",
  };
}

export default function SfogliaLocandine({ pagine = [], altezza = 230 }) {
  const [indice, setIndice] = useState(0);
  const [pieno, setPieno] = useState(false);
  useEffect(() => {
    if (!pieno) return;
    const suTasto = (e) => {
      if (e.key === "Escape") setPieno(false);
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, pagine.length - 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [pieno, pagine.length]);
  if (!pagine.length) return null;
  const ora = pagine[Math.min(indice, pagine.length - 1)];
  const quante = pagine.length;

  return (
    <div data-campo="locandine-del-corso">
      <div style={{ height: altezza }}>
        <Visore pagine={pagine} indice={indice} onIndice={setIndice} pieno={false} onApri={() => setPieno(true)} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 5 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0, ...fontDisplay, fontSize: 12.5, fontWeight: 700, color: NAVY, overflowWrap: "anywhere" }}>
          {ora.titolo}
          {ora.di > 1 && <span style={{ ...fontBody, fontWeight: 400, color: MUTED }}> · pagina {ora.pagina} di {ora.di}</span>}
        </div>
        {quante > 1 && (
          <div data-campo="conta-pagine" style={{ ...fontBody, fontSize: 11.5, color: MUTED, whiteSpace: "nowrap" }}>{indice + 1} / {quante}</div>
        )}
      </div>
      <div style={{ ...fontBody, fontSize: 11, color: MUTED, marginTop: 2 }}>
        {quante > 1 ? "Scorri col dito per sfogliare. " : ""}Tocca per aprirla grande: li' si allarga con due dita.
      </div>

      {pieno && (
        <div
          data-campo="locandina-a-tutto-schermo"
          style={{
            position: "fixed", inset: 0, zIndex: 3000, background: "rgba(14,27,51,0.95)",
            display: "flex", flexDirection: "column",
            padding: "max(env(safe-area-inset-top, 0px), 10px) 8px max(env(safe-area-inset-bottom, 0px), 10px)",
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <Visore pagine={pagine} indice={indice} onIndice={setIndice} pieno onApri={null} />
          </div>
          <div style={{ ...fontBody, fontSize: 12, color: "#fff", textAlign: "center", paddingTop: 8, opacity: 0.85 }}>
            {ora.titolo}{ora.di > 1 ? ` · pagina ${ora.pagina} di ${ora.di}` : ""}
            {quante > 1 ? ` — ${indice + 1} / ${quante}` : ""}
          </div>
          {/* si chiude col tasto e con Esc, NON toccando il fondo: con due
              dita addosso a una foto un tocco di troppo e' normale, e
              chiudere per sbaglio quello che si sta leggendo e' peggio */}
          <button
            type="button" data-campo="chiudi-locandina" onClick={() => setPieno(false)} aria-label="Chiudi"
            style={{
              position: "absolute", top: "max(env(safe-area-inset-top, 0px), 12px)", right: 12,
              width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.3)", padding: 0, cursor: "pointer",
              background: "rgba(14,27,51,0.8)", color: "#fff", ...fontDisplay, fontSize: 22, lineHeight: "36px",
            }}
          >×</button>
        </div>
      )}
    </div>
  );
}
