// LA VOCE DELL'ASSISTENTE (25/10/2026): parlare e sentirsi rispondere, a
// mani libere, come nella conversazione vocale dell'app di Claude. Il
// modello legge e scrive testo; intorno ci sono le due cose che il
// browser sa gia' fare: riconoscere il parlato (Web Speech API) e
// leggere un testo ad alta voce (speechSynthesis). Niente fornitori,
// niente voce che esce verso terzi — e il limite e' lo stesso del tasto
// «Detta»: su iPhone il riconoscimento del browser e' capriccioso.
//
// Il giro: ascolta → quando la frase e' definitiva la consegna → chi
// chiama risponde → la risposta si legge → si torna ad ascoltare. Si
// ferma solo quando chi parla lo chiude.

export function voceDisponibile() {
  return typeof window !== "undefined"
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    && !!window.speechSynthesis;
}

// toglie dal testo quello che a voce non ha senso: asterischi del
// grassetto, trattini degli elenchi, «Da: …» delle citazioni
export function testoDaLeggere(testo) {
  return String(testo || "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// LE VOCI ITALIANE DEL DISPOSITIVO, dalla migliore. Safari su iPhone
// espone «Alice» (compatta, metallica) e, se scaricate nelle impostazioni
// di Accessibilita', le versioni «Enhanced»/«Premium» e Federica, Emma,
// Paola: la differenza di naturalezza e' tutta li'. Chrome ha le voci di
// Google. Si preferiscono le migliorate, poi le altre; la scelta si puo'
// cambiare dal pannello e resta sul dispositivo.
const CHIAVE_VOCE = "assistente-voce";
export function vociItaliane() {
  const voci = window.speechSynthesis?.getVoices?.() || [];
  const punteggio = (v) => (/enhanced|premium|migliorat|neural|natural/i.test(v.name) ? 3 : 0)
    + (/siri|google|microsoft/i.test(v.name) ? 2 : 0) + (/federica|emma|paola|luca|elsa|isabella/i.test(v.name) ? 1 : 0)
    + (v.localService ? 0.5 : 0);
  return voci.filter((v) => /^it[-_]/i.test(v.lang)).sort((a, b) => punteggio(b) - punteggio(a));
}
export function voceScelta() {
  let nome = null; try { nome = localStorage.getItem(CHIAVE_VOCE); } catch { /* niente memoria */ }
  const voci = vociItaliane();
  return voci.find((v) => v.name === nome) || voci[0] || null;
}
export function scegliVoce(nome) { try { localStorage.setItem(CHIAVE_VOCE, nome); } catch { /* niente memoria */ } }

// Legge un testo in italiano. Torna una promessa che si risolve quando ha
// finito (o quando viene zittita).
export function leggi(testo, { suFine } = {}) {
  return new Promise((risolvi) => {
    const s = window.speechSynthesis;
    if (!s) { risolvi(); return; }
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(testoDaLeggere(testo));
    u.lang = "it-IT";
    const v = voceScelta();
    if (v) u.voice = v;
    // un filo piu' lenta del massimo e col tono naturale: le voci di
    // sistema accelerate suonano piu' metalliche, non piu' sveglie
    u.rate = 0.98; u.pitch = 1;
    u.onend = () => { suFine?.(); risolvi(); };
    u.onerror = () => { suFine?.(); risolvi(); };
    s.speak(u);
  });
}

export function zittisci() { try { window.speechSynthesis?.cancel(); } catch { /* niente da zittire */ } }

// Ascolta UNA frase e la consegna. Torna una funzione per smettere.
export function ascoltaUnaFrase({ suParziale, suFrase, suErrore, suFine }) {
  const Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new Riconoscitore();
  r.lang = "it-IT";
  r.continuous = false;
  r.interimResults = true;
  let consegnata = false;
  r.onresult = (e) => {
    let definitivo = ""; let provvisorio = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0]?.transcript || "";
      if (e.results[i].isFinal) definitivo += t; else provvisorio += t;
    }
    if (provvisorio) suParziale?.(provvisorio);
    if (definitivo.trim() && !consegnata) { consegnata = true; suFrase?.(definitivo.trim()); }
  };
  r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") suErrore?.(e.error); };
  r.onend = () => suFine?.(consegnata);
  try { r.start(); } catch (e) { suErrore?.(String(e?.message || e)); }
  return () => { try { r.stop(); } catch { /* gia' fermo */ } };
}
