// L'elenco dei consensi, uno per codice.
//
// Ogni consenso e' un modulo a se': testo suo, elenco di trattamenti
// suo, e un codice suo — che e' poi il QR che la modella inquadra. Il
// primo e' PMU e Micro; laminazione, extension e gli altri si
// aggiungono qui sotto, una riga per uno.
//
// Il codice e la versione non si toccano mai una volta in giro. Il
// codice perche' i QR stampati continuano a puntarci; la versione
// perche' una firma deve poter dire sotto quale testo e' stata data.
// Testo cambiato = versione nuova accanto alla vecchia.

import { consensoV1 } from "./consenso-v1";
import { consensoV2 } from "./consenso-v2";
import { consensoNeedlingV1 } from "./consenso-needling-v1";

export interface ModelloConsenso {
  /** quello che finisce nel link: ?consenso=<codice> */
  codice: string;
  /** come lo chiamate voi, non come si intitola il documento */
  nome: string;
  contenuto: typeof consensoV1 | typeof consensoV2 | typeof consensoNeedlingV1;
}

export const CONSENSI: ModelloConsenso[] = [
  // Il codice resta "pmu-micro": i QR gia' stampati continuano a
  // funzionare. Cambia il contenuto, che dal 14/10/2026 e' la v2 con
  // l'anamnesi. La v1 non si cancella: i consensi gia' firmati portano
  // scritto "v1" e devono poter dire sotto quale testo sono stati dati.
  { codice: "pmu-micro", nome: "Consenso PMU e Micro", contenuto: consensoV2 },
  // Microneedling, dal 19/10/2026. Codice suo, quindi QR suo: il foglio
  // che si fa inquadrare in aula a un corso di needling non e' lo stesso
  // di un PMU, e le domande sullo stato di salute nemmeno.
  { codice: "needling", nome: "Consenso Needling", contenuto: consensoNeedlingV1 },
];

/** Il testo con cui un consenso gia' raccolto e' stato firmato.
 *
 * SERVE ANCHE IL CODICE DEL MODELLO, da quando i modelli sono piu' di
 * uno. Prima bastava la versione perche' esisteva una sola famiglia di
 * testi: "v1" o "v2", e tertium non datur. Con il needling accanto, una
 * versione letta da sola non dice piu' di quale documento si parli — e
 * l'archivio finirebbe per mostrare, sotto la firma di una modella
 * trattata a microneedling, le venti domande del trucco permanente.
 *
 * Il codice puo' mancare: i consensi raccolti prima del 19/10/2026 non
 * ce l'hanno sempre, e in quel caso valgono le regole di prima — che per
 * loro sono giuste, perche' allora il needling non esisteva.
 */
export function contenutoDaVersione(
  versione: string | null | undefined,
  modelloCodice?: string | null,
) {
  const v = String(versione || "");
  if (String(modelloCodice || "") === "needling" || v.startsWith("needling-")) {
    return consensoNeedlingV1;
  }
  return v === "v1" ? consensoV1 : consensoV2;
}

export function consensoDaCodice(codice: string | null | undefined): ModelloConsenso | null {
  if (!codice) return null;
  const pulito = String(codice).trim().toLowerCase();
  return CONSENSI.find((c) => c.codice === pulito) || null;
}
