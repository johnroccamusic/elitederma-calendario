// IL DERMOGRAFO PAGATO COL CORSO È DENARO DA ESIGERE (25/11/2026).
//
// Il titolare, davanti alla scheda di PMU ROMA del 30/11: «quando in un
// PMU parziale una persona decide di acquistare un dermografo e viene
// spuntata la casella "lo paga con il corso", deve venire fuori anche il
// metodo di pagamento previsto, e la somma dovuta deve risultare nella
// contabilità della classe dove la master deve esigere quei soldi,
// altrimenti si rischia che non venga pagato il dermografo ma venga
// ugualmente consegnato. Come vedi dalla scheda del PMU Roma del 30
// novembre, nel totale dovuto il pagamento del dermografo non è
// previsto».
//
// Misurato prima di toccare niente: i dermografi «con il corso» in
// archivio sono DUE, 1.780 €, tutti e due SENZA metodo di pagamento e
// nessuno segnato pagato. Uno parte fra cinque giorni e il pacco lo
// porta in aula.
//
// E quei soldi non stavano in nessun conto: le quattro colonne del
// dermografo le scriveva la scheda e le rileggeva solo la scheda.
//
// Le tre decisioni sono del titolare, prese il 25/11/2026 messe davanti
// ai conti: UNA SPUNTA SOLA (al corso si incassa tutto insieme), i soldi
// entrano IN CONTABILITÀ come il saldo, e un dermografo non pagato
// AVVISA MA NON BLOCCA la consegna.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  dermografoRicavoDi, dermografoDaIncassareDi, dermografoImponibileDi,
  dermografoRisultaPagato, daIncassareAlCorsoDi,
} from "../src/App.jsx";

// il caso vero: Tekna 890 €, imponibile 729,51, ritira al corso
const COL_CORSO = {
  dermografo_scelta: "tekna", dermografo_pagamento: "con_corso", dermografo_consegna: "corso",
  dermografo_totale: 890, dermografo_imponibile: 729.51, dermografo_metodo: null, dermografo_pagato: false,
  saldo_totale: 390, numero_modelle: 1,
};

describe("quanto vale il dermografo nei conti", () => {
  it("IL CASO VERO: 890 € entrano nel «da incassare» della classe", () => {
    expect(dermografoDaIncassareDi(COL_CORSO)).toBe(890);
    // 390 di saldo + 60 della modella + 890 di dermografo
    expect(daIncassareAlCorsoDi(COL_CORSO)).toBe(1340);
  });

  it("prima della correzione quella cifra era 450: il dermografo non c'era", () => {
    // la prova che il guasto era questo, non un arrotondamento
    const comeEraPrima = (COL_CORSO.saldo_totale || 0) + 60;
    expect(comeEraPrima).toBe(450);
    expect(daIncassareAlCorsoDi(COL_CORSO)).toBeGreaterThan(comeEraPrima);
  });

  it("«paga da sito» e «offerto col corso» non si esigono al corso", () => {
    expect(dermografoDaIncassareDi({ ...COL_CORSO, dermografo_pagamento: "gia_pagato" })).toBe(0);
    expect(dermografoDaIncassareDi({ ...COL_CORSO, dermografo_pagamento: "omaggio_corso" })).toBe(0);
    expect(dermografoRicavoDi({ ...COL_CORSO, dermografo_pagamento: "omaggio_corso" })).toBe(0);
  });

  it("chi non compra nessun dermografo non cambia di un centesimo", () => {
    const senza = { saldo_totale: 1490, numero_modelle: 3 };
    expect(dermografoDaIncassareDi(senza)).toBe(0);
    expect(daIncassareAlCorsoDi(senza)).toBe(1490 + 180);
  });

  it("già pagato prima del corso: non si esige due volte, ma resta un ricavo", () => {
    const pagato = { ...COL_CORSO, dermografo_pagato: true };
    expect(dermografoDaIncassareDi(pagato)).toBe(0);
    expect(daIncassareAlCorsoDi(pagato)).toBe(450);
    // il bilancio della classe però quei soldi li ha presi lo stesso
    expect(dermografoRicavoDi(pagato)).toBe(890);
    expect(dermografoImponibileDi(pagato)).toBe(729.51);
  });

  it("l'imponibile è il suo, non il lordo: l'IVA non si conta come ricavo", () => {
    expect(dermografoImponibileDi(COL_CORSO)).toBe(729.51);
    // senza imponibile scritto si ripiega sul totale, come per le quote
    expect(dermografoImponibileDi({ ...COL_CORSO, dermografo_imponibile: null })).toBe(890);
  });
});

describe("una spunta sola, decisa dal titolare", () => {
  it("segnata incassata la classe, il dermografo risulta pagato", () => {
    expect(dermografoRisultaPagato(COL_CORSO)).toBe(false);
    expect(dermografoRisultaPagato({ ...COL_CORSO, incassato: true })).toBe(true);
    expect(dermografoRisultaPagato({ ...COL_CORSO, dermografo_pagato: true })).toBe(true);
  });

  it("chi il dermografo non l'ha comprato non ha nessuno stato da mostrare", () => {
    expect(dermografoRisultaPagato({ saldo_totale: 100 })).toBe(null);
  });

  it("MA LA CIFRA NON SI MUOVE QUANDO SI INCASSA: ricavo e incasso sono due domande", () => {
    // se «da incassare» calasse premendo Incassato, la scheda direbbe
    // una cifra prima e un'altra dopo per gli stessi soldi — come già
    // succede per saldo e modelle, che restano scritti
    expect(daIncassareAlCorsoDi({ ...COL_CORSO, incassato: true })).toBe(1340);
  });
});

// LA GUARDIA CHE DURA. «Saldo + modelle» era scritto a mano in tredici
// punti — la scheda, la lista, la stampa, i totali, la cassa, il
// cruscotto — e NESSUNO dei tredici contava il dermografo. È la stessa
// dimenticanza ripetuta del 18/11 (sei letture senza il filtro sugli
// ordini non pagati): quando una somma vive in tredici copie, il giorno
// che le si aggiunge una voce se ne aggiornano undici.
describe("il «da incassare» si calcola in un posto solo", () => {
  const sorgente = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

  it("nessun punto somma più «saldo_totale + modelleTotaleDi» a mano", () => {
    const righe = sorgente.split("\n");
    const aMano = righe
      .map((r, n2) => ({ r, n: n2 + 1 }))
      .filter(({ r }) => /saldo_totale \|\| 0\)\s*\+\s*modelleTotaleDi/.test(r))
      // L'ECCEZIONE DICHIARATA, e vale la pena saperla: la riga «Saldo al
      // corso» della prima nota resta saldo + modelle perché il dermografo
      // entra con una riga SUA, che porta il suo metodo. Metterlo dentro
      // questa somma vorrebbe dire 890 € incassati «in contanti» perché il
      // saldo era in contanti, mentre il dermografo è andato sul POS.
      .filter(({ r }) => !r.includes('aggiungi("saldo", "Saldo al corso"'));
    expect(aMano.map(({ n: n2, r }) => `${n2}: ${r.trim().slice(0, 80)}`)).toEqual([]);
  });

  it("…e quella riga della prima nota ha accanto la riga del dermografo", () => {
    expect(sorgente).toContain('aggiungi("dermografo", "Dermografo al corso"');
  });

  it("la cassa della classe guarda il metodo DEL DERMOGRAFO, non quello del saldo", () => {
    // la stessa allieva può saldare a bonifico e pagare il dermografo in
    // contanti: in busta ci vanno solo i contanti
    expect(sorgente).toContain("eContanti(i.dermografo_metodo) ? dermografoRicavoDi(i) : 0");
    expect(sorgente).toContain("eMetodoPos(i.dermografo_metodo) ? dermografoRicavoDi(i) : 0");
  });

  it("il metodo si sceglie nel riquadro del dermografo, e il blocco doppio non torna", () => {
    expect(sorgente).toContain("data-dermografo-metodo");
    expect(sorgente).not.toContain('"quotaDermografo"');
  });

  it("in aula il dermografo non pagato si vede, e non blocca niente", () => {
    expect(sorgente).toContain("data-dermografo-da-pagare");
    expect(sorgente).not.toMatch(/dermografoDaIncassareDi\(i\) > 0[^\n]*disabled/);
  });
});
