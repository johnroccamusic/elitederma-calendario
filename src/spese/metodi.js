// Come si paga una spesa, e cosa vuol dire "non pagata".
//
// Stanno qui e non dentro App.jsx perché li usano due schermate: il
// modulo spese della Contabilità e quello dentro la scheda di un
// evento. Due copie sarebbero divergute al primo metodo aggiunto.
export const METODI_SPESA = [
  "Carta Nexi", "PayPal", "Stripe", "Carta PayPal", "Bonifico",
  "Bonifico periodico", "Domiciliazione bancaria", "Spesa bancaria su C/C", "Cassa contanti",
];

// Gli stati che NON sono "pagata". Tutto il resto dell'app decide con
// `stato === 'pagata'`: prima nota, cassa contanti, ciclo passivo. Qui
// contano solo per dire a che punto è la pratica.
//
// "da_pagare" è il primo perché è il valore predefinito di una spesa
// nuova, ed è già quello che scrive lo scadenziario quando riconcilia
// una fattura non saldata.
export const STATI_NON_PAGATA = [
  { chiave: "da_pagare", etichetta: "Non pagata" },
  { chiave: "fatturata", etichetta: "Fatturata, da pagare" },
  { chiave: "impegnata", etichetta: "Impegnata" },
  { chiave: "preventivata", etichetta: "Preventivata" },
  { chiave: "parzialmente_pagata", etichetta: "Pagata in parte" },
  { chiave: "scaduta", etichetta: "Scaduta" },
  { chiave: "annullata", etichetta: "Annullata" },
];

export function statoValidoSpesa(stato) {
  return stato === "pagata" || STATI_NON_PAGATA.some((s) => s.chiave === stato);
}

// Il valore della tendina unica, e la coppia stato/metodo che ne esce.
// Sono due funzioni sole perché le due schermate devono tradurre allo
// stesso modo: una tendina che dice "Bonifico" vuol dire pagata, e una
// che dice "Impegnata" vuol dire metodo vuoto.
export function valoreTendinaPagamento(stato, metodoPagamento) {
  if (stato === "pagata") return metodoPagamento ? `metodo:${metodoPagamento}` : "pagata:";
  return `stato:${stato || "da_pagare"}`;
}

export function leggiTendinaPagamento(valore) {
  if (valore.startsWith("metodo:")) return { stato: "pagata", metodoPagamento: valore.slice(7) };
  if (valore === "pagata:") return { stato: "pagata", metodoPagamento: "" };
  // uscendo da "pagata" il metodo si azzera: un metodo su una spesa non
  // pagata resterebbe scritto e direbbe il falso
  return { stato: valore.slice(6), metodoPagamento: "" };
}
