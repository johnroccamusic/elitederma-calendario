// I nomi che arrivano da WooCommerce sono codificati per l'HTML: la "e
// commerciale" viaggia come "&amp;", l'apostrofo come "&#8217;", il
// trattino lungo come "&#8211;". Va bene dentro una pagina web, non in
// un'anagrafica: da noi il nome si legge com'e', sullo scontrino, nel
// carrello, nei messaggi. Si decodifica all'ingresso, una volta sola.
//
// Solo per testi piani (nomi, SKU). Le descrizioni restano HTML e li'
// "&amp;" e' giusto cosi'.
const NOMINATE: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", euro: "€", deg: "°",
  agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Eacute: "É", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
};

export function decodificaEntita<T extends string | null | undefined>(testo: T): T {
  if (typeof testo !== "string" || !testo.includes("&")) return testo;
  // prima i codici numerici e i nomi, e "&amp;" per ultimo: cosi'
  // "&amp;lt;" resta "&lt;" (che e' quello che voleva dire) e non "<"
  const passo = testo
    .replace(/&#x([0-9a-f]+);/gi, (_, esa) => String.fromCodePoint(parseInt(esa, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([A-Za-z]+);/g, (tutto, nome) => (nome === "amp" ? tutto : (NOMINATE[nome] ?? tutto)));
  return passo.replace(/&amp;/g, "&") as T;
}
