// I certificati che «Crea certificato» sa fare, uno per voce. Ognuno dice
// il suo titolo, dove sta il suo modello, quali voci chiede e come si
// compone il PDF; la pagina e l'archivio sono gli stessi per tutti, cosi'
// un certificato nuovo e' una voce qui e un file per il suo PDF, non una
// pagina copiata.
import { CAMPI_42_ORE, datiVuoti42, mancanti42, generaPdfCertificato42 } from "./certificato-42-ore.js";
import { CAMPI_NEEDLING, datiVuotiNeedling, mancantiNeedling, generaPdfCertificatoNeedling } from "./certificato-needling.js";

export const CERTIFICATI = {
  pmu_42_ore: {
    tipo: "pmu_42_ore",
    titolo: "Certificato 42 ore",
    tessera: "Abilitazione PMU: dati dello studente, periodo del corso, luogo e data.",
    descrizione: "Certificato di abilitazione PMU.",
    modello: "_modelli/certificato-42-ore.pdf",
    nomeModello: "certificazione abilitazione 42 ore PMU – campi vuoti",
    cartella: "42-ore",
    prefissoFile: "Certificato-42-ore",
    campi: CAMPI_42_ORE,
    datiVuoti: datiVuoti42,
    mancanti: mancanti42,
    genera: generaPdfCertificato42,
  },
  needling: {
    tipo: "needling",
    titolo: "Certificato needling",
    tessera: "Abilitazione 16 ore: dati dello studente con codice fiscale, periodo del corso, luogo e data.",
    descrizione: "Certificato di abilitazione needling (16 ore).",
    modello: "_modelli/certificato-needling.pdf",
    nomeModello: "certificato abilitazione PMU 16 ore compilabile",
    cartella: "needling",
    prefissoFile: "Certificato-needling",
    campi: CAMPI_NEEDLING,
    datiVuoti: datiVuotiNeedling,
    mancanti: mancantiNeedling,
    genera: generaPdfCertificatoNeedling,
  },
};

export const ORDINE_CERTIFICATI = ["pmu_42_ore", "needling"];
