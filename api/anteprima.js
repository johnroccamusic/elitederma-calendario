// Anteprima dei link condivisi (WhatsApp, Telegram, email…).
//
// Il problema: chi genera l'anteprima legge i meta tag dell'HTML che il
// server restituisce e NON esegue il JavaScript. La pagina si imposta il
// titolo da sola una volta caricata, ma a quel punto il crawler se n'è già
// andato: la scheda diceva sempre "Gestionale Elitederma", uguale per ogni
// corso.
//
// La scelta che rende tutto semplice: il testo dell'anteprima viaggia
// dentro il link, non viene cercato nel database. Questa funzione non ha
// una chiave, non apre una sessione, non interroga niente — legge due
// parametri dall'indirizzo e li scrive nei meta tag. Il token del link
// resta un'informazione che lei nemmeno guarda.
//
// Alla pagina vera ci pensa comunque il browser: la funzione restituisce
// l'index.html dell'app (preso dal deploy stesso) con i meta tag
// sostituiti, quindi chi apre il link riceve l'applicazione di sempre.

// Il testo arriva dall'indirizzo, quindi arriva da fuori: va trattato come
// tale. Le entità HTML impediscono che finisca dentro il markup come
// markup, e il taglio a 120 caratteri evita che qualcuno usi il nostro
// dominio per far comparire in chat un'anteprima lunga a piacere.
const LIMITE = 120;

function pulisci(valore) {
  return String(valore || "")
    .slice(0, LIMITE)
    .replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const indirizzo = new URL(req.url, `https://${host}`);

  const titolo = pulisci(indirizzo.searchParams.get("corso")) || "Gestionale Elitederma";
  const sottotitolo = pulisci(indirizzo.searchParams.get("quando"));

  try {
    // "/index.html" non passa da questa funzione: la riscrittura in
    // vercel.json vale solo per "/" con il parametro "master", quindi non
    // si rientra qui e non si innesca un giro infinito.
    const risposta = await fetch(`https://${host}/index.html`);
    if (!risposta.ok) throw new Error(`index.html: ${risposta.status}`);
    let html = await risposta.text();

    const meta = [
      `<title>${titolo}</title>`,
      `<meta property="og:title" content="${titolo}" />`,
      `<meta property="og:site_name" content="Elitederma Academy" />`,
      `<meta property="og:type" content="website" />`,
      sottotitolo ? `<meta property="og:description" content="${sottotitolo}" />` : "",
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${titolo}" />`,
      sottotitolo ? `<meta name="twitter:description" content="${sottotitolo}" />` : "",
    ].filter(Boolean).join("\n    ");

    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+property="og:title"[^>]*>/gi, "")
      .replace(/<meta\s+property="og:site_name"[^>]*>/gi, "")
      .replace(/<meta\s+name="twitter:title"[^>]*>/gi, "")
      .replace("</head>", `    ${meta}\n  </head>`);

    res.setHeader("content-type", "text/html; charset=utf-8");
    // l'anteprima può stare in cache al bordo per un minuto; il browser no,
    // altrimenti un link aperto due volte mostrerebbe il titolo del primo
    res.setHeader("cache-control", "public, max-age=0, s-maxage=60");
    return res.status(200).send(html);
  } catch (errore) {
    // Se per qualsiasi motivo l'index.html non arriva, la cosa che NON deve
    // succedere è che il link smetta di aprirsi: si manda il visitatore alla
    // pagina vera con la query intatta (l'app legge "master" da lì). Perde
    // l'anteprima, non la pagina.
    res.setHeader("location", `/index.html${indirizzo.search}`);
    return res.status(302).end();
  }
}
