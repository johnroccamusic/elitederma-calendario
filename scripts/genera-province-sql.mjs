// Le 107 province con la loro regione, in SQL, GENERATE da
// `src/comuni-regioni.js` — che e' l'elenco ISTAT che l'app si porta
// gia' dietro. Non si battono a mano: una sigla sbagliata vuol dire una
// persona che sparisce dal filtro «Lazio» senza che nessuno lo veda.
//
//   node scripts/genera-province-sql.mjs
//
// L'uscita si incolla nella migrazione che crea `province_regioni`.
// Una prova del banco (prove/crm-clienti-shop.test.jsx) rilegge la
// migrazione e pretende che le righe coincidano con questo elenco.
import { PROVINCE, REGIONI } from "../src/comuni-regioni.js";

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export function righeProvince() {
  return PROVINCE.map((p) => {
    const [sigla, nome, indiceRegione] = p.split("|");
    return { sigla, nome, regione: REGIONI[Number(indiceRegione)] };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const righe = righeProvince().map((r) => `  (${q(r.sigla)}, ${q(r.nome)}, ${q(r.regione)})`);
  console.log(righe.join(",\n") + ";");
  console.error(`${righe.length} province`);
}
