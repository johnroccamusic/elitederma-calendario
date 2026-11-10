// DA .php A .json DA IMPORTARE IN CODE SNIPPETS (10/11/2026).
//
// Gli snippet di WordPress stanno qui come file PHP veri — si leggono,
// si correggono, `php -l` li controlla. Ma su WordPress si mettono da
// «Snippets → Importa», e quello vuole un .json: incollare il codice
// nell'editor di Code Snippets su uno snippet lungo lo rovina (gia'
// successo, vedi il registro).
//
// Si lancia con `node wordpress/genera-json.mjs` e riscrive la cartella
// `wordpress/json/`. Il `<?php` iniziale si toglie: Code Snippets lo
// mette da se', e lasciandolo dentro il codice non parte.
//
// Il nome dello snippet e la descrizione si leggono dalle prime righe
// del commento del file, cosi' non si scrivono due volte.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const cartella = new URL(".", import.meta.url).pathname;
const dentro = join(cartella, "json");
mkdirSync(dentro, { recursive: true });

// Il nome dello snippet e' quello che su WordPress si legge nell'elenco:
// si prende dal «Plugin Name» dell'intestazione, che e' il nome con cui
// quegli snippet sono gia' installati — se non coincide, l'importazione
// ne crea un SECONDO accanto al vecchio invece di sostituirlo, e due
// snippet uguali attivi insieme fanno girare lo stesso codice due volte.
const titoloDi = (php, nomeFile) => {
  const righe = php.split("\n");
  const conNome = righe.find((r) => /^\s*\*\s*Plugin Name\s*:/i.test(r));
  if (conNome) return conNome.replace(/^\s*\*\s*Plugin Name\s*:\s*/i, "").trim();
  const primaUtile = righe.find((r) => /^\s*\*\s*\S/.test(r) && !/^\s*\*\s*-+\s*$/.test(r));
  return primaUtile ? primaUtile.replace(/^\s*\*\s*/, "").trim() : basename(nomeFile, ".php");
};

const descrizioneDi = (php) => {
  const riga = php.split("\n").find((r) => /^\s*\*\s*Description\s*:/i.test(r));
  return riga ? riga.replace(/^\s*\*\s*Description\s*:\s*/i, "").trim() : "";
};

let quanti = 0;
// «-ORIGINALE» non e' uno snippet da installare: e' la copia di com'era
// prima un altro snippet, tenuta per confronto. Importarla vorrebbe dire
// due motori di sconto attivi insieme sullo stesso carrello.
const daSaltare = (f) => /ORIGINALE/i.test(f);

for (const file of readdirSync(cartella).filter((f) => f.endsWith(".php") && !daSaltare(f)).sort()) {
  const php = readFileSync(join(cartella, file), "utf8");
  const codice = php.replace(/^<\?php\r?\n/, "");
  const nome = titoloDi(php, file);
  const json = {
    generator: "Elitederma - genera-json.mjs",
    date_created: new Date().toISOString().slice(0, 16).replace("T", " "),
    snippets: [{
      name: nome,
      desc: [descrizioneDi(php), `Da wordpress/${file} del gestionale. Non si corregge qui: si corregge nel repo e si reimporta.`].filter(Boolean).join(" "),
      code: codice,
      tags: ["elitederma"],
      scope: "global",
      priority: 10,
    }],
  };
  writeFileSync(join(dentro, file.replace(/\.php$/, ".json")), JSON.stringify(json, null, 2) + "\n");
  quanti += 1;
  console.log(`${file} -> json/${file.replace(/\.php$/, ".json")}  (${nome})`);
}
console.log(`\n${quanti} snippet pronti da importare in Code Snippets.`);
