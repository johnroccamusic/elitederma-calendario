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

// Legge un testo in italiano. Torna una promessa che si risolve quando ha
// finito (o quando viene zittita). Si preferisce una voce italiana di
// sistema, se ce n'e' una.
export function leggi(testo, { suFine } = {}) {
  return new Promise((risolvi) => {
    const s = window.speechSynthesis;
    if (!s) { risolvi(); return; }
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(testoDaLeggere(testo));
    u.lang = "it-IT";
    const voci = s.getVoices?.() || [];
    const it = voci.find((v) => /^it[-_]/i.test(v.lang) && /siri|alice|federica|paola|luca|google/i.test(v.name)) || voci.find((v) => /^it[-_]/i.test(v.lang));
    if (it) u.voice = it;
    u.rate = 1.02;
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
