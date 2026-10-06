// Edge Function "immagine-prodotto"
//
// Le foto dei prodotti stanno sul sito, e il sito non manda l'intestazione
// che permette al browser di leggerle da un'altra origine. Per il browser
// sono visibili ma intoccabili: si possono mostrare in un <img>, non
// leggere i byte per metterle dentro un PDF.
//
// Questa funzione fa da ponte: prende la foto e la restituisce con il
// permesso. Nient'altro — il PDF si costruisce nel browser, come tutti gli
// altri dell'app.
//
// Non e' un proxy aperto: l'indirizzo deve stare sotto gli upload del
// nostro sito, altrimenti si rifiuta.
const INIZIO_AMMESSO = "https://elitederma.shop/wp-content/uploads/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url).searchParams.get("url") || "";
  if (!url.startsWith(INIZIO_AMMESSO)) {
    return new Response(JSON.stringify({ errore: "Indirizzo non ammesso" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // QUALE DELLE TANTE COPIE.
  //
  // WordPress di ogni foto tiene l'originale e un po' di miniature. Le
  // miniature sono TAGLIATE A QUADRATO: su una boccetta di pigmento, che
  // e' verticale, il quadrato ne mostra meta'. L'originale invece ha le
  // proporzioni giuste, ma a volte pesa un megabyte e mezzo per finire
  // dentro un quadratino di mezzo centimetro.
  //
  // Quindi: si guarda quanto pesa l'originale e, se sta sotto i 200 KB, si
  // prende quello — foto intera, peso ragionevole. Solo le foto enormi
  // ripiegano sul ritaglio quadrato, che e' sempre meglio di niente.
  const punto = url.lastIndexOf(".");
  const senzaEstensione = punto > 0 ? url.slice(0, punto) : url;
  const estensione = punto > 0 ? url.slice(punto) : "";
  const TETTO = 200 * 1024;

  let originaleLeggero = false;
  try {
    const misura = await fetch(url, { method: "HEAD" });
    const quanto = Number(misura.headers.get("Content-Length") || 0);
    originaleLeggero = misura.ok && quanto > 0 && quanto <= TETTO;
  } catch { /* se non si riesce a misurare si prova lo stesso, piu' sotto */ }

  const candidati = originaleLeggero || punto <= 0
    ? [url]
    : [`${senzaEstensione}-300x300${estensione}`, `${senzaEstensione}-150x150${estensione}`, url];

  let risposta: Response | null = null;
  for (const indirizzo of candidati) {
    const prova = await fetch(indirizzo);
    if (prova.ok) { risposta = prova; break; }
    // il corpo va consumato o la connessione resta aperta
    await prova.body?.cancel();
  }
  if (!risposta) {
    return new Response(JSON.stringify({ errore: "Foto non trovata sul sito" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(risposta.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": risposta.headers.get("Content-Type") || "application/octet-stream",
      // le foto dei prodotti cambiano di rado: un giorno di cache evita di
      // ripassare dal sito ogni volta che si rifa' il listino
      "Cache-Control": "public, max-age=86400",
    },
  });
});
