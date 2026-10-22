// Quello che ogni prova trova gia' pronto.
//
// NIENTE RETE. `fetch` viene sostituito prima di ogni prova: chi vuole far
// rispondere il database lo dice con `rispondiCon(...)` dentro la prova
// stessa. Una prova che parla col database vero non e' una prova — e' un
// incidente in attesa, per giunta su dati di allievi.
//
// LA TELA. jsdom non disegna un canvas, e la firma col dito ne usa uno: senza
// questa finta, il componente della firma esplode e porta giu' tutta la
// pagina — un guasto del banco, non del codice in prova.
import { beforeEach, vi } from "vitest";

export function rispondiCon(mappa) {
  globalThis.fetch = vi.fn(async (url, opzioni = {}) => {
    const indirizzo = String(url);
    for (const [pezzo, risposta] of Object.entries(mappa)) {
      if (indirizzo.includes(pezzo)) {
        const corpo = typeof risposta === "function"
          ? risposta(opzioni.body ? JSON.parse(opzioni.body) : null, indirizzo)
          : risposta;
        return new Response(JSON.stringify(corpo), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  });
  globalThis.window.fetch = globalThis.fetch;
  return globalThis.fetch;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  rispondiCon({});
  const finto2d = new Proxy({}, { get: () => () => {} });
  window.HTMLCanvasElement.prototype.getContext = () => finto2d;
  window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
  window.confirm = () => true;
  // jsdom non sposta niente, quindi `scrollIntoView` non ce l'ha: senza
  // questa finta un componente che porta lo sguardo da qualche parte
  // esplode, e sembra rotto lui. Trovato il 22/10/2026 facendo il giro
  // di tutte le sezioni, su "Aggiungi corso".
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || (() => {});
  window.alert = () => {};
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }));
});
