// Il netto da un lordo, in un posto solo. 18/11/2026.
//
// Era dentro App.jsx e lo chiamavano la scheda prodotto e l'elenco a
// righe; da quando anche «Listini rivenditori» corregge i prezzi, un
// secondo conto qui vorrebbe dire due idee del prezzo netto — e questa
// regola il progetto l'ha già pagata una volta (vedi sotto).
//
// Unico punto in cui si parte dal lordo. Se scrivi 39,90 quel prezzo
// ricalcola SOLO il netto, e il netto si tiene a sei decimali: così
// rifacendo il giro all'indietro il lordo torna 39,90 e non 39,89.
// Arrotondando il netto a due decimali il lordo digitato si perdeva in
// 54.098 casi su 300.000 al 22% (un prezzo su cinque), ed è il motivo per
// cui era nato il "prezzo forzato": un secondo lordo scritto a mano che
// poi comandava di nascosto su sito, POS, fasce e punti. A sei decimali
// il netto basta da solo — provato su ogni centesimo da 0,01 a 3.000 € al
// 22, 10, 5, 4 e 0%: zero prezzi spostati.
export function nettoDaLordo(lordo, aliquotaPct) {
  if (lordo == null || aliquotaPct == null) return null;
  return Math.round((lordo / (1 + aliquotaPct / 100) + Number.EPSILON) * 1e6) / 1e6;
}
