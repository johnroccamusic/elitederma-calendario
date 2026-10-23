// IL CIVICO STA DENTRO LA VIA, E IL BANCO LO VUOLE A PARTE.
//
// Gli indirizzi letti dai moduli cartacei sono arrivati come una riga
// sola — «Via monte pasubio 8a», «VIA GENERALE COMO, 45» — perche' sul
// foglio sono una riga sola. Il banco invece, per preparare un pacco,
// vuole il civico nella sua casella, e se e' vuota non fa partire la
// vendita: «mancano i dati della spedizione». Il 23/10/2026 su 255
// iscritti con una via, 244 non avevano il civico a parte e in 208 il
// numero stava in fondo alla via. Non erano due allieve: era quasi tutto
// l'archivio.
//
// Qui si separa il numero dalla via, SOLO quando il civico manca: dove
// qualcuno l'ha gia' scritto a parte non si tocca niente.

// «Via monte pasubio 8a» -> { via: "Via monte pasubio", civico: "8a" }
// «VIA GENERALE COMO, 45» -> { via: "VIA GENERALE COMO", civico: "45" }
// «Via Roma 12/B»         -> { via: "Via Roma", civico: "12/B" }
// «Via Roma snc»          -> { via: "Via Roma", civico: "snc" }
// «Via Roma»              -> { via: "Via Roma", civico: "" }
export function separaCivico(testo) {
  const via = String(testo || "").trim();
  if (!via) return { via: "", civico: "" };
  // il numero in fondo: cifre, eventuale lettera o /lettera o -bis, e
  // "snc" (senza numero civico), preceduto da spazio o virgola
  const m = via.match(/^(.*?)[\s,]+((?:\d+\s*(?:[a-zA-Z]|\/\s*[a-zA-Z0-9]+|-?bis|-?ter)?)|snc)\s*\.?$/i);
  if (!m) return { via, civico: "" };
  const resto = m[1].replace(/[\s,]+$/, "").trim();
  // «12» da solo non e' una via: si lascia com'era
  if (!resto) return { via, civico: "" };
  return { via: resto, civico: m[2].replace(/\s+/g, "").trim() };
}

// «, BELLARIA-IGEA MARINA, RN, ITALIA» -> "BELLARIA-IGEA MARINA"
// «Trento (TN)»                       -> "Trento"
export function pulisciCitta(testo) {
  const pezzi = String(testo || "").split(",").map((x) => x.trim()).filter(Boolean);
  const primo = pezzi[0] || "";
  return primo.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
