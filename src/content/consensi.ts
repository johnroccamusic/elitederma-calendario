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
import { consensoLaminazioneV1 } from "./consenso-laminazione-v1";

export interface ModelloConsenso {
  /** quello che finisce nel link: ?consenso=<codice> */
  codice: string;
  /** come lo chiamate voi, non come si intitola il documento */
  nome: string;
  contenuto: typeof consensoV1 | typeof consensoV2 | typeof consensoNeedlingV1 | typeof consensoLaminazioneV1;
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
  { codice: "laminazione", nome: "Consenso Laminazione ciglia", contenuto: consensoLaminazioneV1 },
];

/**
 * OGNI VERSIONE DI TESTO MAI USCITA, e a quale modello apparteneva.
 *
 * Non si cancella una riga da qui nemmeno quando il testo viene
 * sostituito: serve a far dire a una firma vecchia sotto quale documento
 * e' stata data, ed e' l'unica cosa che lo sa. `v1` e `v2` si chiamano
 * cosi' perche' sono nate quando il modello era uno solo; da `needling`
 * in poi il nome della versione porta dentro il modello.
 */
const VERSIONI: Record<string, { codice: string; contenuto: ModelloConsenso["contenuto"] }> = {
  v1: { codice: "pmu-micro", contenuto: consensoV1 },
  v2: { codice: "pmu-micro", contenuto: consensoV2 },
  "needling-v1": { codice: "needling", contenuto: consensoNeedlingV1 },
  "laminazione-v1": { codice: "laminazione", contenuto: consensoLaminazioneV1 },
};

/** Il testo con cui un consenso gia' raccolto e' stato firmato.
 *
 * SERVE ANCHE IL CODICE DEL MODELLO, da quando i modelli sono piu' di
 * uno. Una versione letta da sola non dice piu' di quale documento si
 * parli, e l'archivio finirebbe per mostrare — sotto la firma di una
 * modella trattata a microneedling — le venti domande del trucco
 * permanente.
 *
 * L'ordine in cui si decide:
 *   1. la versione, se la conosciamo e appartiene a quel modello;
 *   2. altrimenti il modello, col suo testo di oggi: una versione
 *      sconosciuta e' un consenso piu' vecchio dei testi che abbiamo, e
 *      il modello giusto e' comunque meglio di uno a caso;
 *   3. se non sappiamo nemmeno il modello, valgono le regole di prima —
 *      e per quei consensi sono giuste, perche' quando sono stati
 *      raccolti esisteva solo il PMU.
 */
export function contenutoDaVersione(
  versione: string | null | undefined,
  modelloCodice?: string | null,
) {
  const trovata = VERSIONI[String(versione || "")];
  const codice = String(modelloCodice || "");
  if (trovata && (!codice || trovata.codice === codice)) return trovata.contenuto;
  const modello = CONSENSI.find((c) => c.codice === codice);
  if (modello) return modello.contenuto;
  return trovata ? trovata.contenuto : consensoV2;
}

/** Ogni modello in giro deve avere la sua versione registrata qui
 *  sopra: se manca, una firma di oggi domani non sa piu' dire cosa
 *  diceva il foglio. C'e' una prova nel banco che lo controlla. */
export function versioniRegistrate() {
  return Object.keys(VERSIONI);
}

export function consensoDaCodice(codice: string | null | undefined): ModelloConsenso | null {
  if (!codice) return null;
  const pulito = String(codice).trim().toLowerCase();
  return CONSENSI.find((c) => c.codice === pulito) || null;
}
