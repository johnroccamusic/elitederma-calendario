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

// LA RISPOSTA SI SPEZZA IN FRASI (3/11/2026). Il titolare: «e' ancora
// lento nell'acquisizione dell'audio… come si fa a rendere il dialogo
// piu' fluido senza lunghe attese». Prima si mandava la risposta INTERA
// alla sintesi e si aspettava tutto l'audio prima di aprire bocca: su una
// risposta lunga sono secondi di silenzio in cui sembra rotto.
//
// Adesso e' una catena di montaggio: si chiede l'audio del primo pezzo —
// corto di proposito, cosi' si inizia a parlare subito — e mentre quello
// suona si sta gia' scaricando il pezzo dopo. Il tempo prima della prima
// parola non dipende piu' dalla lunghezza della risposta.
const PRIMO_PEZZO = 90;
const PEZZO = 220;

// Spezza un testo in pezzi da leggere, tagliando alla fine delle frasi.
// Niente lookbehind nella regex: Safari vecchio non la conosce, e questa
// roba gira su iPhone.
export function spezzaPerVoce(testo, primo = PRIMO_PEZZO, dopo = PEZZO) {
  const frasi = String(testo || "")
    .replace(/([.!?:;])\s+/g, "$1\n")
    .split(/\n+/)
    .flatMap((f) => (f.length > 400 ? f.split(/,\s+/) : [f]))
    .map((f) => f.trim())
    .filter(Boolean);
  const pezzi = [];
  let corrente = "";
  for (const f of frasi) {
    const tetto = pezzi.length === 0 ? primo : dopo;
    if (!corrente) corrente = f;
    else if ((corrente + " " + f).length <= tetto) corrente += " " + f;
    else { pezzi.push(corrente); corrente = f; }
  }
  if (corrente) pezzi.push(corrente);
  return pezzi;
}

// LA VOCE NATURALE: il testo si fa leggere dalla funzione `leggi-voce`
// (sintesi esterna, solo testo in uscita) e si suona qui. Se la funzione
// non e' configurata o fallisce al primo pezzo, si torna alla voce del
// telefono: la conversazione non deve fermarsi per una voce.
let audioInCorso = null;
// Ogni lettura ha il suo numero. Zittire lo fa avanzare, e i pezzi che
// stavano arrivando per la lettura di prima non suonano piu': senza,
// chiudere la voce mentre un pezzo era in volo lo faceva partire dopo.
let giroVoce = 0;

function suona(blob, mio) {
  return new Promise((risolvi) => {
    if (mio !== giroVoce) { risolvi(); return; }
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    audioInCorso = a;
    const fine = () => { URL.revokeObjectURL(url); if (audioInCorso === a) audioInCorso = null; risolvi(); };
    a.onended = fine; a.onerror = fine;
    a.play().catch(() => fine());
  });
}

export async function leggiNaturale(testo, supabase) {
  const pulito = testoDaLeggere(testo);
  if (!pulito) return true;
  const mio = ++giroVoce;
  let gettone; let base;
  try {
    const sessione = await supabase.auth.getSession();
    gettone = sessione?.data?.session?.access_token;
    if (!gettone) return false;
    base = supabase.functionsUrl || `${supabase.supabaseUrl}/functions/v1`;
  } catch { return false; }

  const chiedi = (pezzo) => fetch(`${base}/leggi-voce`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gettone}`, apikey: supabase.supabaseKey, "content-type": "application/json" },
    body: JSON.stringify({ testo: pezzo }),
  }).then((r) => (r.ok && (r.headers.get("content-type") || "").startsWith("audio/") ? r.blob() : null))
    .catch(() => null);

  const pezzi = spezzaPerVoce(pulito);
  let inArrivo = chiedi(pezzi[0]);
  for (let i = 0; i < pezzi.length; i++) {
    const blob = await inArrivo;
    if (mio !== giroVoce) return true;
    // il pezzo dopo si scarica MENTRE questo suona
    inArrivo = i + 1 < pezzi.length ? chiedi(pezzi[i + 1]) : null;
    if (!blob) {
      // il primo pezzo fallito vuol dire sintesi non disponibile: lo dice
      // a chi chiama, che ripiega sulla voce del telefono. Se invece si
      // rompe a meta', il resto lo legge il telefono: meglio una voce
      // diversa che una frase mangiata.
      if (i === 0) return false;
      await leggi(pezzi.slice(i).join(" "));
      return true;
    }
    await suona(blob, mio);
    if (mio !== giroVoce) return true;
  }
  return true;
}
export function zittisciNaturale() {
  giroVoce += 1;
  try { audioInCorso?.pause(); audioInCorso = null; } catch { /* niente */ }
}

// Legge un testo in italiano con la voce del telefono. Torna una promessa
// che si risolve quando ha finito (o quando viene zittita).
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

export function zittisci() { zittisciNaturale(); try { window.speechSynthesis?.cancel(); } catch { /* niente da zittire */ } }

// IL SILENZIO LO MISURIAMO NOI (3/11/2026). Prima si aspettava che il
// browser dichiarasse la frase «definitiva»: su iPhone quel momento
// arriva quando vuole lui, e sono i secondi di attesa che il titolare
// sentiva come «lento nell'acquisizione dell'audio». Adesso il
// riconoscimento resta aperto (`continuous`) e si consegna la frase dopo
// un po' di silenzio — meno di un secondo senza parole nuove.
//
// Nove decimi sono misurati sul parlato normale: piu' corti e tagliano
// chi prende fiato a meta' frase, piu' lunghi e si torna all'attesa.
const SILENZIO_MS = 900;

// Ascolta UNA frase e la consegna. Torna una funzione per smettere.
export function ascoltaUnaFrase({ suParziale, suFrase, suErrore, suFine }) {
  const Riconoscitore = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new Riconoscitore();
  r.lang = "it-IT";
  r.continuous = true;
  r.interimResults = true;
  let consegnata = false;
  let definitivo = "";
  let provvisorio = "";
  let orologio = null;

  function consegna() {
    if (consegnata) return;
    const frase = `${definitivo} ${provvisorio}`.trim();
    if (!frase) return;
    consegnata = true;
    clearTimeout(orologio);
    // si ferma il riconoscimento: la risposta arriva mentre il microfono
    // e' chiuso, cosi' non si ascolta la propria voce
    try { r.stop(); } catch { /* gia' fermo */ }
    suFrase?.(frase);
  }
  function riarma() { clearTimeout(orologio); orologio = setTimeout(consegna, SILENZIO_MS); }

  r.onresult = (e) => {
    provvisorio = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0]?.transcript || "";
      if (e.results[i].isFinal) definitivo += t; else provvisorio += t;
    }
    suParziale?.(`${definitivo} ${provvisorio}`.trim());
    riarma();
  };
  r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") suErrore?.(e.error); };
  r.onend = () => { clearTimeout(orologio); consegna(); suFine?.(consegnata); };
  try { r.start(); } catch (e) { suErrore?.(String(e?.message || e)); }
  return () => { clearTimeout(orologio); try { r.stop(); } catch { /* gia' fermo */ } };
}
