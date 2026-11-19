// IL REGOLAMENTO COMMERCIALE RIVENDITORI: com'è composto. 18/11/2026.
//
// IL TESTO INTEGRALE NON C'È ANCORA, ED È UN SEGNAPOSTO DICHIARATO.
// La specifica dice: «Usa come testo il "Regolamento Commerciale
// Rivenditori Elitederma 2026" (in vigore dal 1° dicembre 2026, foro di
// Roma), che ti incollo/allego. […] Se non te lo allego, lascia un
// segnaposto e chiedimelo». Non è stato allegato, quindi il PDF esce con
// tutte le parti che si ricavano dalla configurazione — livelli, soglie,
// riassortimenti, ciclo, rientro — e in fondo, al posto degli articoli,
// un riquadro che dice che il testo manca. Scriverlo io vorrebbe dire
// inventare clausole contrattuali e farle firmare a qualcuno.
//
// Quello che invece si compone da sé viene TUTTO dalla configurazione
// (`rivenditori_livelli`, `rivenditori_parametri`): così il PDF è sempre
// aggiornato, che è esattamente la ragione per cui la specifica chiede di
// leggerlo da lì e non di scriverlo nel documento.
import { livelliAttivi, nominalePct, euroIt } from "./regole.js";

// vedi `soglia` in listinoPdf.js: in italiano i numeri di quattro cifre
// non si raggruppano da soli, e «€ 3000» su un regolamento si legge male
const eur = (n) => `€ ${Number(n || 0).toLocaleString("it-IT", { maximumFractionDigits: 0, useGrouping: "always" })}`;

export const VERSIONE_SEGNAPOSTO = "segnaposto";

export function tabellaLivelli(livelli, tettoPct) {
  return {
    testata: ["Livello", "Sconto massimo", "Ingresso", "Acquisti annui", "Riassortimento minimo"],
    righe: livelliAttivi(livelli).map((l) => [
      l.nome,
      `fino a -${String(nominalePct(l, tettoPct)).replace(".", ",")}%`,
      l.ingresso_cumulabile ? `${eur(l.ingresso_eur)} di acquisti cumulati` : `ordine singolo ${eur(l.ingresso_eur)}`,
      eur(l.mantenimento_eur),
      eur(l.riassortimento_minimo_eur),
    ]),
  };
}

// La tabella dei riassortimenti NON è un dato a parte: si ricava dai
// minimi d'ordine dei livelli (vedi il commento in regole.js). Le fasce
// sono gli scaglioni fra un minimo e il successivo, e in ogni fascia un
// livello prende il più basso fra il suo sconto e il tetto della fascia.
export function tabellaRiassortimenti(livelli, tettoPct) {
  const attivi = livelliAttivi(livelli);
  const minimi = [...new Set(attivi.map((l) => Number(l.riassortimento_minimo_eur)))].sort((a, b) => b - a);
  const righe = [];
  minimi.forEach((min, i) => {
    const sopra = minimi[i - 1];
    const etichetta = i === 0 ? `da ${eur(min)}` : `${eur(min)} - ${euroIt(sopra - 0.01)}`;
    const tettoFascia = attivi.filter((l) => Number(l.riassortimento_minimo_eur) <= min).pop();
    righe.push([etichetta, ...attivi.map((l) => {
      const suo = nominalePct(l, tettoPct);
      const cap = nominalePct(tettoFascia, tettoPct);
      return `${String(Math.min(suo, cap)).replace(".", ",")}%`;
    })]);
  });
  const piuPiccolo = minimi[minimi.length - 1];
  righe.push([`sotto ${eur(piuPiccolo)}`, ...attivi.map(() => "—")]);
  return { testata: ["Ordine netto", ...attivi.map((l) => l.nome)], righe };
}

// Il rientro, con l'esempio numerico che la specifica chiede: si prende
// il livello più alto e si mostra un ciclo chiuso a due terzi della sua
// soglia, così l'esempio resta vero anche se le soglie cambiano.
export function esempioRientro(livelli) {
  const attivi = livelliAttivi(livelli);
  const alto = attivi[attivi.length - 1];
  if (!alto) return null;
  const soglia = Number(alto.mantenimento_eur);
  const chiuso = Math.round((soglia * 0.733) / 100) * 100; // 7.500 -> 5.500
  const mancavano = soglia - chiuso;
  const minimo = Number(alto.ingresso_eur);
  return {
    livello: alto.nome,
    chiuso, mancavano, minimo, massimo: minimo * 2,
    ordine: Math.min(minimo * 2, Math.max(minimo, mancavano)),
    frase: `Esempio: un ${alto.nome} chiude il ciclo a ${eur(chiuso)} — mancano ${eur(mancavano)} alla soglia di ${eur(soglia)}, ma il minimo del livello è l'ordine d'ingresso, ${eur(minimo)}: rientra con un ordine di ${eur(Math.min(minimo * 2, Math.max(minimo, mancavano)))}. Da quell'ordine parte un nuovo ciclo di dodici mesi.`,
  };
}

export const CONDIZIONI_GENERALI = [
  "Pagamento anticipato: l'ordine si lavora a pagamento ricevuto.",
  "Spedizione a carico del rivenditore, salvo diversa pattuizione scritta.",
  "Resi: si accettano solo previo accordo scritto e per merce integra, nelle confezioni originali. Resi e note di credito riducono il volume di acquisti del ciclo.",
  "I prezzi al pubblico indicati nel listino sono consigliati e non vincolanti.",
  "Gli sconti del programma non si cumulano con altre promozioni.",
  "Tutti gli importi del programma sono IVA esclusa, al netto degli sconti e con spedizione esclusa.",
];

// La composizione del documento, nell'ordine che la specifica detta.
// Ogni blocco è { titolo, paragrafi } oppure { titolo, tabella }: chi
// disegna il PDF non deve sapere niente delle regole, e chi scrive le
// regole non deve sapere niente di pdf-lib.
export function composizioneRegolamento({ livelli, tettoPct = 50, regolamento = null }) {
  const attivi = livelliAttivi(livelli);
  const alto = attivi[attivi.length - 1];
  const blocchi = [];

  blocchi.push({ titolo: "1. I livelli del programma", tabella: tabellaLivelli(livelli, tettoPct) });

  blocchi.push({
    titolo: "2. Come si entra",
    paragrafi: [
      ...attivi.map((l) => l.ingresso_cumulabile
        ? `${l.nome}: con ${eur(l.ingresso_eur)} di acquisti cumulati, anche su più ordini. Lo sconto vale dagli ordini successivi.`
        : `${l.nome}: con un singolo ordine da ${eur(l.ingresso_eur)}, con lo sconto già applicato a quell'ordine.`),
      "Ambassador non è un livello di sconto: è uno status su invito che si aggiunge al livello del rivenditore e non dà nessuno sconto in più.",
    ],
  });

  blocchi.push({
    titolo: "3. Il ciclo, le verifiche e la revisione annuale",
    paragrafi: [
      "Il ciclo dura dodici mesi dalla data d'ingresso del singolo rivenditore, non dall'inizio dell'anno.",
      "A tre, sei, nove e dodici mesi si confronta il volume cumulato con il 25%, 50%, 75% e 100% della soglia annua del livello. Queste verifiche sono informative: dicono quanto manca e non comportano nessun declassamento immediato.",
      "Alla fine del ciclo si fa la revisione annuale sugli acquisti validi di quel ciclo, e il livello diventa quello che il volume raggiunge: " +
        attivi.slice().reverse().map((l, i, a) => {
          const sopra = a[i - 1];
          return sopra
            ? `da ${eur(l.mantenimento_eur)} a ${euroIt(Number(sopra.mantenimento_eur) - 0.01)} ${l.nome}`
            : `da ${eur(l.mantenimento_eur)} ${l.nome}`;
        }).join("; ") + `; sotto ${eur(attivi[0]?.mantenimento_eur)} nessuna qualifica.`,
      "La revisione non ha effetto retroattivo: non si rifanno gli sconti già applicati agli ordini del ciclo chiuso.",
      "Fuori dall'ingresso e dal rientro, il livello non cambia a metà ciclo.",
    ],
  });

  const esempio = esempioRientro(livelli);
  blocchi.push({
    titolo: "4. La regola di rientro",
    paragrafi: [
      "Chi scende di livello può rientrare in quello perso con un ordine pari a quanto gli mancava alla soglia annua, con un minimo pari all'ordine d'ingresso di quel livello e un massimo pari al doppio.",
      esempio?.frase,
    ].filter(Boolean),
  });

  blocchi.push({
    titolo: "5. I riassortimenti",
    tabella: tabellaRiassortimenti(livelli, tettoPct),
    paragrafi: [
      "Ogni ordine si valuta da solo: si applica il livello più alto compatibile col valore dell'ordine, senza superare il livello posseduto. Il controllo si fa sul totale dell'ordine ai prezzi del livello candidato.",
      "Le percentuali della tabella sono le massime. Su alcuni prodotti lo sconto è ridotto, e in quel caso vale lo sconto indicato nel listino accanto al prodotto.",
    ],
  });

  blocchi.push({
    titolo: "6. Le master",
    paragrafi: [
      "Alle master si applica uno sconto di base del 10%, che sale al 20% finché rispettano i criteri di promozione: tag della pagina Elitederma e citazione dei prodotti in ogni lavoro pubblicato, almeno due post al mese, uso dei prodotti nei corsi.",
      "Il rispetto dei criteri si verifica ogni trimestre. Se la verifica è negativa lo sconto torna al 10%.",
    ],
  });

  blocchi.push({ titolo: "7. Condizioni generali", paragrafi: CONDIZIONI_GENERALI });

  if (regolamento?.corpo?.articoli?.length) {
    blocchi.push({
      titolo: "8. Regolamento Commerciale Rivenditori Elitederma",
      paragrafi: regolamento.corpo.articoli,
    });
  } else {
    blocchi.push({
      titolo: "8. Regolamento Commerciale Rivenditori Elitederma",
      segnaposto: true,
      paragrafi: [
        "[Il testo integrale del regolamento non è ancora stato caricato.]",
        "Qui va il «Regolamento Commerciale Rivenditori Elitederma 2026», in vigore dal 1° dicembre 2026, foro di Roma. Finché non è caricato, questo documento vale come prospetto delle condizioni commerciali e non come regolamento sottoscrivibile.",
      ],
    });
  }

  blocchi.push({
    titolo: "Accettazione",
    firme: true,
    paragrafi: [
      "Il rivenditore dichiara di aver letto e di accettare il presente regolamento in ogni sua parte.",
      regolamento?.corpo?.clausole_1341?.length
        ? `Ai sensi degli artt. 1341 e 1342 c.c. il rivenditore approva specificamente le clausole: ${regolamento.corpo.clausole_1341.join("; ")}.`
        : "Ai sensi degli artt. 1341 e 1342 c.c. il rivenditore approva specificamente le clausole indicate nel regolamento. [Elenco da completare con il testo integrale.]",
    ],
  });

  return { titolo: "Regolamento commerciale rivenditori", blocchi, livelloAlto: alto?.nome || null };
}
