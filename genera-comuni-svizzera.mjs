// Rigenera src/comuni-svizzera.js dai dati ufficiali svizzeri.
//
//   node genera-comuni-svizzera.mjs
//
// LA FONTE. OpenPLZ API (openplzapi.org), che per la Svizzera pubblica
// l'«Amtliches Ortschaftenverzeichnis mit Postleitzahl und Perimeter»
// di swisstopo: localita', NPA (il CAP svizzero, quattro cifre),
// comune, distretto e cantone. Si interroga cantone per cantone, 50
// righe alla volta — il massimo che accetta: con 100 risponde 400.
//
// PERCHE' NON swisstopo DIRETTAMENTE: il suo file ufficiale e' uno zip
// (CSV dentro), e Node non sa aprire uno zip senza una dipendenza. Qui
// arriva JSON su https, come per i comuni italiani.
//
// I NOMI DEI CANTONI RESTANO QUELLI DELLA FONTE, anche quando sono
// bilingui — «Valais / Wallis», «Fribourg / Freiburg», «Graubünden /
// Grigioni / Grischun». Tradurli in italiano vorrebbe dire scrivere a
// mano un dato che la fonte non ha: «Svitto» e «Sciaffusa» sono
// italiano corretto e nessuno li riconosce, e sulla busta c'e' scritto
// l'altro. Accanto c'e' sempre la sigla, che e' quella che si usa.
//
// UNA LOCALITA' PUO' COMPARIRE PIU' VOLTE nella fonte: quando sta a
// cavallo di due comuni (Collombey e' sia in Monthey sia in
// Collombey-Muraz) o quando ha piu' NPA. Qui diventa una riga sola per
// cantone, con tutti i suoi NPA.
import { writeFileSync } from "node:fs";

const USCITA = "src/comuni-svizzera.js";
const BASE = "https://openplzapi.org/ch";
const A_PAGINA = 50;

async function chiedi(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

const cantoni = await chiedi(`${BASE}/Cantons`);
// ordinati per nome, come le province italiane
cantoni.sort((a, b) => a.name.localeCompare(b.name, "it"));
const CANTONI = cantoni.map((c) => `${c.shortName}|${c.name}`);
const indiceCantone = new Map(cantoni.map((c, i) => [c.shortName, i]));

// localita' -> { "NOME|cantone": Set(NPA) }, e il nome ufficiale a parte
const npa = new Map();
const nomeUfficiale = new Map();
for (const c of cantoni) {
  for (let pagina = 1; ; pagina += 1) {
    const righe = await chiedi(
      `${BASE}/Cantons/${c.key}/Localities?page=${pagina}&pageSize=${A_PAGINA}`,
    );
    for (const r of righe) {
      const chiave = `${r.name}|${c.shortName}`;
      if (!npa.has(chiave)) { npa.set(chiave, new Set()); nomeUfficiale.set(chiave, r.name); }
      if (r.postalCode) npa.get(chiave).add(String(r.postalCode));
    }
    if (righe.length < A_PAGINA) break;
  }
  process.stdout.write(`${c.shortName} `);
}
process.stdout.write("\n");

// "Nome|indice in CANTONI|NPA separati da virgola"
const LOCALITA = [...npa.entries()]
  .map(([chiave, codici]) => {
    const [, sigla] = chiave.split("|");
    return `${nomeUfficiale.get(chiave)}|${indiceCantone.get(sigla)}|${[...codici].sort().join(",")}`;
  })
  .sort((a, b) => a.localeCompare(b, "it"));

const testo = `// Svizzera: localita', cantone e NPA (il CAP svizzero), dai dati
// ufficiali swisstopo via OpenPLZ API — inclusi nel bundle come i comuni
// italiani, perche' la residenza si compila senza chiamate di rete.
//
// NON modificare a mano: \`node genera-comuni-svizzera.mjs\` lo rifa'.
//
// I nomi dei cantoni sono quelli della fonte, bilingui dove lo sono:
// accanto c'e' la sigla, che e' quella che si usa.
import { normalizzaLuogo } from "./comuni-regioni.js";

// "SIGLA|Nome del cantone"
export const CANTONI = ${JSON.stringify(CANTONI)};

// "Nome localita'|indice in CANTONI|NPA separati da virgola"
const LOCALITA = ${JSON.stringify(LOCALITA)};

export function cantoniSvizzeri() {
  return CANTONI.map((r) => { const [sigla, nome] = r.split("|"); return { sigla, nome }; });
}

export function localitaDiCantone(sigla) {
  const i = CANTONI.findIndex((r) => r.split("|")[0] === sigla);
  if (i < 0) return [];
  return LOCALITA.filter((r) => Number(r.split("|")[1]) === i).map((r) => r.split("|")[0]);
}

// Gli NPA di una localita'. Quasi sempre uno — e allora si scrive da
// se', come per i comuni italiani; Zurigo e Ginevra ne hanno molti.
export function npaDiLocalita(sigla, localita) {
  const i = CANTONI.findIndex((r) => r.split("|")[0] === sigla);
  const chiave = normalizzaLuogo(localita);
  for (const riga of LOCALITA) {
    const [nome, cant, codici] = riga.split("|");
    if (Number(cant) === i && normalizzaLuogo(nome) === chiave) return codici ? codici.split(",") : [];
  }
  return [];
}

// Il cantone di una localita', per riaprire la cascata su una scheda
// gia' compilata. Dove il nome sta in due cantoni comanda l'NPA.
export function cantoneDiLocalita(localita, npaScritto) {
  const chiave = normalizzaLuogo(localita);
  const codice = (npaScritto || "").toString().replace(/[^0-9]/g, "");
  let perNome = "";
  for (const riga of LOCALITA) {
    const [nome, cant, codici] = riga.split("|");
    if (normalizzaLuogo(nome) !== chiave) continue;
    const sigla = CANTONI[Number(cant)].split("|")[0];
    if (codice && (codici ? codici.split(",") : []).includes(codice)) return sigla;
    if (!perNome) perNome = sigla;
  }
  return perNome;
}
`;
writeFileSync(USCITA, testo);
console.log(`${USCITA}: ${CANTONI.length} cantoni, ${LOCALITA.length} localita', ${Math.round(testo.length / 1024)} KB`);
