// LA MIGRAZIONE CHE CARICA IL TESTO DEL CONTRATTO MASTER, GENERATA.
//
// Il testo vive in due posti e DEVE nascere identico nei due: in
// `supabase/functions/_shared/contratto-master.js` (il codice, che e' la
// rete per far vedere la pagina se la query fallisce, e il testo di
// partenza a cui «Rimetti com'era» torna) e in `master_contratti_testi`
// (il database, da cui il SERVER compone la copia congelata alla firma).
//
// Scrivere le due copie a mano vorrebbe dire due contratti che un giorno
// dicono cose diverse, e nessuno saprebbe quale ha firmato quella
// persona. Quindi la migrazione si genera da qui:
//
//   node scripts/genera-testi-contratto.mjs
//
// Stampa anche l'impronta di ogni chiave: e' quella che si confronta
// col database dopo aver applicato la migrazione.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  INTESTAZIONE, PARTI, PREMESSE, ARTICOLI, CLAUSOLE, MANIFESTO, CASELLE,
} from "../supabase/functions/_shared/contratto-master.js";

const CORPI = {
  intestazione: INTESTAZIONE,
  parti: PARTI,
  premesse: PREMESSE,
  articoli: ARTICOLI,
  clausole: CLAUSOLE,
  manifesto: MANIFESTO,
  caselle: CASELLE,
};

const file = new URL("../supabase/testi-contratto-master.sql", import.meta.url);

// `$testo$…$testo$` e non le virgolette: il contratto e' pieno di
// apostrofi, e raddoppiarli a mano su quarantamila caratteri e' il modo
// di sbagliarne uno e non accorgersene.
const righe = [
  "-- IL TESTO DEL CONTRATTO MASTER, DA CARICARE NEL DATABASE (16/11/2026).",
  "--",
  "-- GENERATO DA `scripts/genera-testi-contratto.mjs`: non si corregge a mano.",
  "--",
  "-- NON STA IN `supabase/migrations/` ED E' VOLUTO: sono 78 KB di insert, e",
  "-- il canale con cui questo progetto applica le migrazioni non li regge. Sta",
  "-- quindi fra gli script cumulativi e idempotenti della radice, e si carica",
  "-- in due modi, che scrivono esattamente le stesse righe: dall'editor SQL",
  "-- incollando questo file, oppure da Contratti master -> «Il testo del",
  "-- contratto» -> «Carica il testo di partenza», che prende il testo dal",
  "-- codice. La pagina mostra l'impronta di ogni chiave accanto a quella",
  "-- del codice: se le due coincidono, il database ha il testo del repo.",
  "-- La fonte e' `supabase/functions/_shared/contratto-master.js`, trascritto",
  "-- da `Contratto_Elitederma_completo.pdf` (versione sintetica del 14",
  "-- novembre 2026). Le due copie nascono identiche parola per parola, e le",
  "-- impronte (sha256, primi 16 caratteri) sono stampate dal generatore.",
  "--",
  "-- Si corregge dall'app, non qui: la correzione finisce in",
  "-- `master_contratti_testi` e archivia da se' la versione precedente",
  "-- (trigger `master_contratti_testi_archivia`). Rieseguire questo file",
  "-- RIPORTA TUTTO AL TESTO DI PARTENZA e archivia le correzioni: e' il",
  "-- «Rimetti com'era» di tutte le chiavi insieme.",
  "",
];
const impronte = {};
for (const [chiave, corpo] of Object.entries(CORPI)) {
  const json = JSON.stringify(corpo);
  if (json.includes("$testo$")) throw new Error(`la chiave ${chiave} contiene il delimitatore $testo$`);
  impronte[chiave] = createHash("sha256").update(json).digest("hex").slice(0, 16);
  righe.push(`-- ${chiave}: sha256 ${impronte[chiave]}`);
  righe.push("insert into public.master_contratti_testi (chiave, corpo, aggiornato_da, aggiornato_il)");
  righe.push(`values ('${chiave}', $testo$${json}$testo$::jsonb, 'testo di partenza (14/11/2026)', now())`);
  righe.push("on conflict (chiave) do update set corpo = excluded.corpo,");
  righe.push("  aggiornato_da = excluded.aggiornato_da, aggiornato_il = excluded.aggiornato_il;");
  righe.push("");
}
writeFileSync(file, righe.join("\n"));

for (const [chiave, md5] of Object.entries(impronte)) console.log(`${chiave.padEnd(14)} sha256 ${md5}`);
console.log(`\nscritta: ${file.pathname}`);
