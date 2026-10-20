// LE RIGHE DI UNA FATTURA, A PARTIRE DA QUELLO CHE SI E' INCASSATO.
//
// Sta qui e non dentro la edge function perche' la usano due mondi: Deno,
// che emette la fattura, e il banco di prova, che la bombarda di carrelli
// finti. Un calcolo sui soldi che nessuno puo' provare senza emettere una
// fattura vera non e' un calcolo, e' una scommessa — e le prime tre
// scommesse le ha pagate il titolare premendo «Emetti la fattura».
//
// L'ARROTONDAMENTO LO FA FATTURE IN CLOUD, E LO FA SUL TOTALE DI RIGA.
//
// Non e' un'opinione, e' misurato il 20/10/2026 su due rifiuti veri.
// Mandando il netto unitario gia' arrotondato (32,70) rispondeva netto
// 258,17; mandandolo intero (32,704918) rispondeva 258,19. I due numeri
// sono esattamente le due ipotesi: 258,17 e' la somma degli unitari
// arrotondati moltiplicati per la quantita', 258,19 e' la somma dei
// TOTALI DI RIGA arrotondati. Quindi moltiplica e poi arrotonda, riga
// per riga.
//
// Il che vuol dire che l'arrotondamento c'e' comunque: l'unica scelta e'
// se governarlo o subirlo. Subendolo, su 315,00 incassati il documento
// faceva 314,99 e veniva rifiutato — «Il totale dei pagamenti non
// corrisponde al totale da pagare».
//
// Quindi: si decide il NETTO TOTALE che riproduce il lordo incassato, si
// parte dai totali di riga naturali, e il pugno di centesimi che manca si
// appoggia sulle righe piu' care — dove un centesimo non sposta niente.
// Il prezzo unitario che ne esce si manda per intero, perche' e' il
// totale di riga quello che conta: 9811/3 fa 32,703333, e FIC ne ricava
// 98,11, che e' il numero voluto.

const inCentesimi = (x) => Math.round((Number(x) || 0) * 100);

// NON TUTTI I TOTALI ESISTONO, E QUESTA E' LA SCOPERTA CHE CONTA.
//
// L'imponibile e' un numero di centesimi, l'IVA e' `round(imponibile ×
// 0,22)`, e il totale e' la somma dei due. Quella mappa SALTA: da
// 258,20 il totale passa a 315,00 e da 258,21 a 315,02. **315,01 non lo
// fa nessun imponibile.** Contati: fino a 2.000 € il 18% dei centesimi
// e' irraggiungibile.
//
// Quindi «la fattura deve fare esattamente quello che si e' incassato»
// e' una promessa che una volta su sei non si puo' mantenere, e
// inseguirla e' il modo di farsi rifiutare il documento per sempre.
// Quello che si puo' promettere e' questo: il documento e' coerente con
// se' stesso, il pagamento scritto sopra e' il suo totale, e la
// distanza da quello che e' entrato in cassa non supera il centesimo.
//
// Si sceglie il raggiungibile piu' vicino; a parita', quello sotto —
// meglio fatturare un centesimo in meno di quanto si e' preso che un
// centesimo in piu' di quanto si e' preso.
export function nettoPiuVicinoAlLordo(lordoCentesimi, aliquota) {
  const lordoDi = (netto) => netto + Math.round(netto * aliquota);
  const partenza = Math.round(lordoCentesimi / (1 + aliquota));
  let migliore = Math.max(0, partenza);
  let distanza = Math.abs(lordoDi(migliore) - lordoCentesimi);
  for (let salto = -3; salto <= 3; salto += 1) {
    const prova = partenza + salto;
    if (prova < 0) continue;
    const scarto = lordoDi(prova) - lordoCentesimi;
    const quanto = Math.abs(scarto);
    // a parita' di distanza vince quello che fattura di meno
    if (quanto < distanza || (quanto === distanza && scarto < lordoDi(migliore) - lordoCentesimi)) {
      migliore = prova; distanza = quanto;
    }
  }
  return migliore;
}

/**
 * @param {{nome?: string, quantita?: number, prezzo?: number}[]} prodotti
 *        righe del carrello col prezzo UNITARIO lordo (IVA inclusa)
 * @param {number} importo quello che si e' davvero incassato
 * @param {number} aliquotaPct 22, 10, 4…
 * @returns {{righe: {nome: string, quantita: number, prezzoNetto: number}[],
 *             imponibile: number, iva: number, totale: number,
 *             scartoDallIncassato: number}}
 */
export function righeFattura(prodotti, importo, aliquotaPct) {
  const aliquota = (Number(aliquotaPct) || 0) / 100;
  const grezze = (Array.isArray(prodotti) ? prodotti : []).map((r) => ({
    nome: String(r.nome || "Articolo"),
    quantita: Math.max(1, Math.round(Number(r.quantita) || 1)),
    lordo: inCentesimi((Number(r.prezzo) || 0) * (Number(r.quantita) || 1)),
  })).filter((r) => r.lordo > 0);
  if (grezze.length === 0) return { righe: [], imponibile: 0, iva: 0, totale: 0, scartoDallIncassato: 0 };

  // UN BUCO VERO NON SI SPALMA. Se fra le righe e quello che si e'
  // incassato ci sono piu' di cinque centesimi, non e' arrotondamento:
  // e' qualcosa che nelle righe non c'e' — la spedizione, di solito. Si
  // scrive come riga sua invece di gonfiare di nascosto i prodotti.
  const lordoIncassato = inCentesimi(importo);
  const lordoRighe = grezze.reduce((s, r) => s + r.lordo, 0);
  if (lordoIncassato - lordoRighe > 5) {
    grezze.push({ nome: "Spese di spedizione", quantita: 1, lordo: lordoIncassato - lordoRighe });
  }

  const nettoTotale = nettoPiuVicinoAlLordo(lordoIncassato, aliquota);
  const nettiRiga = grezze.map((r) => Math.round(r.lordo / (1 + aliquota)));
  let residuo = nettoTotale - nettiRiga.reduce((s, x) => s + x, 0);
  // dalla riga piu' cara in giu': un centesimo su 48,30 e' invisibile,
  // su una riga da 2,00 si vedrebbe
  const perImporto = grezze
    .map((r, i) => ({ i, lordo: r.lordo }))
    .sort((a, b) => b.lordo - a.lordo)
    .map((x) => x.i);
  for (let giro = 0; residuo !== 0; giro += 1) {
    const i = perImporto[giro % perImporto.length];
    const passo = residuo > 0 ? 1 : -1;
    nettiRiga[i] += passo;
    residuo -= passo;
  }

  const iva = Math.round(nettoTotale * aliquota);
  return {
    righe: grezze.map((r, i) => ({
      nome: r.nome,
      quantita: r.quantita,
      // l'unitario si manda per intero: quello che FIC arrotonda e' il
      // totale di riga, e il totale di riga e' gia' quello giusto
      prezzoNetto: nettiRiga[i] / r.quantita / 100,
    })),
    // IL PAGAMENTO SCRITTO SULLA FATTURA E' IL TOTALE DELLA FATTURA, non
    // quello che e' entrato in cassa: quando i due non possono coincidere
    // (vedi `nettoPiuVicinoAlLordo`) e' questo che Fatture in Cloud
    // confronta, ed e' questo che deve tornare.
    imponibile: nettoTotale / 100,
    iva: iva / 100,
    totale: (nettoTotale + iva) / 100,
    // quanto ci si e' dovuti discostare da quello che e' stato incassato:
    // zero quasi sempre, un centesimo quando quel totale non esiste
    scartoDallIncassato: (nettoTotale + iva - lordoIncassato) / 100,
  };
}
