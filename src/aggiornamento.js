// L'app resta aperta sui telefoni delle master per giorni: la sera la si
// lascia sulla home, la mattina la si riprende, e quella scheda tiene il
// programma della sera prima. Gli aggiornamenti pubblicati nel frattempo
// non arrivano finche' qualcuno non ricarica a mano — e nessuno lo fa.
//
// Qui l'app si ricarica da sola, in due casi:
//   1. mezz'ora senza un tocco, un tasto o uno scorrimento: nessuno sta
//      lavorando, ricaricare non fa perdere niente;
//   2. quando la si riprende in mano (la scheda torna visibile) e nel
//      frattempo e' uscita una versione nuova: se erano passati piu' di
//      dieci minuti si ricarica subito, altrimenti compare una striscia
//      con "Aggiorna", perche' chi ha lasciato un modulo a meta' per due
//      minuti non deve ritrovarselo vuoto.
//
// La versione si riconosce dal nome del pacchetto: Vite lo firma con un
// codice che cambia a ogni build (index-Ab12Cd.js), e index.html lo
// dichiara. Basta rileggere index.html dal server e confrontare.
// La sessione di accesso sta in localStorage e sopravvive al
// ricaricamento: nessuno deve rifare il login.

const MEZZORA = 30 * 60 * 1000;
const DIECI_MINUTI = 10 * 60 * 1000;
const OGNI_MINUTO = 60 * 1000;

function pacchettoCorrente() {
  const script = document.querySelector('script[type="module"][src*="/assets/"]');
  return script ? script.getAttribute("src") : null;
}

async function pacchettoPubblicato() {
  try {
    const risposta = await fetch(`/index.html?nocache=${Date.now()}`, { cache: "no-store" });
    if (!risposta.ok) return null;
    const html = await risposta.text();
    const trovato = html.match(/\/assets\/index-[^"']+\.js/);
    return trovato ? trovato[0] : null;
  } catch {
    return null;
  }
}

function ricarica() {
  window.location.reload();
}

function mostraStrisciaAggiorna() {
  if (document.getElementById("striscia-aggiorna")) return;
  const striscia = document.createElement("div");
  striscia.id = "striscia-aggiorna";
  striscia.style.cssText = [
    "position:fixed", "left:50%", "bottom:calc(env(safe-area-inset-bottom, 0px) + 96px)", "transform:translateX(-50%)",
    "z-index:5000", "display:flex", "align-items:center", "gap:12px",
    "background:#0E1B33", "color:#fff", "padding:10px 14px 10px 16px", "border-radius:14px",
    "font:600 13px/1.3 'Roboto',sans-serif", "box-shadow:0 8px 24px rgba(0,0,0,0.3)", "max-width:calc(100vw - 32px)",
  ].join(";");
  striscia.innerHTML = `<span>C'è una versione nuova dell'app.</span>
    <button type="button" style="font:700 13px 'Roboto',sans-serif;background:#fff;color:#0E1B33;border:none;border-radius:10px;padding:7px 12px;cursor:pointer">Aggiorna</button>`;
  striscia.querySelector("button").addEventListener("click", ricarica);
  document.body.appendChild(striscia);
}

export function avviaAggiornamentoAutomatico() {
  if (import.meta.env.DEV) return;
  const corrente = pacchettoCorrente();
  let ultimaAttivita = Date.now();
  const segnaAttivita = () => { ultimaAttivita = Date.now(); };
  ["pointerdown", "keydown", "touchstart", "scroll", "wheel"].forEach((evento) => {
    window.addEventListener(evento, segnaAttivita, { passive: true, capture: true });
  });

  const inattivaDa = () => Date.now() - ultimaAttivita;

  async function controlla() {
    // il timer di un browser in secondo piano puo' dormire a lungo: al
    // risveglio si ragiona sul tempo davvero passato, non sui giri fatti
    if (inattivaDa() >= MEZZORA) { ricarica(); return; }
    if (document.visibilityState !== "visible" || !corrente) return;
    const pubblicato = await pacchettoPubblicato();
    if (!pubblicato || pubblicato === corrente) return;
    if (inattivaDa() >= DIECI_MINUTI) ricarica();
    else mostraStrisciaAggiorna();
  }

  setInterval(controlla, OGNI_MINUTO);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") controlla(); });
}
