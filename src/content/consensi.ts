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

export interface ModelloConsenso {
  /** quello che finisce nel link: ?consenso=<codice> */
  codice: string;
  /** come lo chiamate voi, non come si intitola il documento */
  nome: string;
  contenuto: typeof consensoV1;
}

export const CONSENSI: ModelloConsenso[] = [
  { codice: "pmu-micro", nome: "Consenso PMU e Micro", contenuto: consensoV1 },
];

export function consensoDaCodice(codice: string | null | undefined): ModelloConsenso | null {
  if (!codice) return null;
  const pulito = String(codice).trim().toLowerCase();
  return CONSENSI.find((c) => c.codice === pulito) || null;
}
