// LA LETTURA AUTOMATICA DEL DOCUMENTO D'IDENTITA' (25/10/2026).
//
// Gli allievi continuano a scrivere dati sbagliati: una data di nascita,
// una lettera del cognome, il codice fiscale copiato a mano. Il documento
// che allegano dice la verita', e nessuno lo guardava finche' non
// serviva. La edge function `leggi-documento` lo fa leggere a un modello
// (Anthropic, vedi il Punto 9 dell'informativa) e torna i soli dati
// anagrafici; qui si confrontano con quello che c'e' nel modulo.
//
// IL CONFRONTO NON DECIDE NIENTE. Dice «sul documento c'e' questo, nel
// modulo c'e' quest'altro»: l'allieva corregge se vuole, il venditore
// vede le differenze e verifica lui (art. 22 GDPR, nessuna decisione
// automatizzata).

// chiave del dato letto -> chiave del campo nel modulo e nella scheda
export const CAMPI_DOCUMENTO = [
  // il tipo per primo: «hai dichiarato passaporto e hai caricato una patente»
  // e' la prima cosa che si vuole sapere. Il modello lo chiama
  // `tipo_documento`, il modulo `doc_tipo` (uno dei TIPI_DOCUMENTO).
  { chiave: "doc_tipo", chiaveLetto: "tipo_documento", etichetta: "Tipo di documento", tipo: "tipodoc" },
  { chiave: "nome", etichetta: "Nome" },
  { chiave: "cognome", etichetta: "Cognome" },
  { chiave: "sesso", etichetta: "Sesso" },
  { chiave: "data_nascita", etichetta: "Data di nascita", tipo: "data" },
  { chiave: "comune_nascita", etichetta: "Comune di nascita", tipo: "comune" },
  { chiave: "codice_fiscale", etichetta: "Codice fiscale", tipo: "codice" },
  { chiave: "doc_numero", etichetta: "Numero documento", tipo: "codice" },
];

function senzaAccenti(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// come si confrontano due valori dello stesso campo: maiuscole e spazi non
// contano, gli accenti nemmeno; un comune «ROMA (RM)» e' «ROMA»; una data
// vale per il giorno; un codice si confronta senza spazi
// i modi in cui un tipo di documento puo' essere scritto, dal modello
// o da una persona, ridotti a un nome solo
const TIPI_DOC_CANONICI = [
  ["CARTA_IDENTITA", /CARTA|IDENTIT|\bCIE\b|\bCI\b|ID CARD|IDENTITY/],
  ["PATENTE", /PATENTE|DRIVING|DRIVER|LICEN/],
  ["PASSAPORTO", /PASSAPORT|PASSPORT/],
  ["PERMESSO_SOGGIORNO", /PERMESSO|SOGGIORNO|RESIDENCE PERMIT/],
  ["TESSERA_SANITARIA", /TESSERA|SANITARIA|HEALTH CARD/],
];
export function tipoDocumentoCanonico(valore) {
  const v = senzaAccenti(valore).trim().toUpperCase();
  if (!v) return "";
  const trovato = TIPI_DOC_CANONICI.find(([, re]) => re.test(v));
  return trovato ? trovato[0] : v;
}

// il tipo letto dal modello, scritto come lo scrive il modulo
// (TIPI_DOCUMENTO): serve a «Usa i dati del documento»
export function tipoDocumentoDelModulo(valoreLetto) {
  const c = tipoDocumentoCanonico(valoreLetto);
  return { CARTA_IDENTITA: "Carta d'identità", PATENTE: "Patente", PASSAPORTO: "Passaporto" }[c] || "";
}

export function normalizzaValore(valore, tipo) {
  if (tipo === "tipodoc") return tipoDocumentoCanonico(valore);
  let v = senzaAccenti(valore).trim().toUpperCase();
  if (!v) return "";
  if (tipo === "data") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/) || v.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
    if (!m) return v;
    return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (tipo === "codice") return v.replace(/[^A-Z0-9]/g, "");
  if (tipo === "comune") v = v.replace(/\s*\([A-Z]{2}\)\s*$/, "");
  if (tipo === undefined && (v === "M" || v === "F")) return v;
  return v.replace(/\s+/g, " ");
}

// `letto` = quello che ha letto il modello; `valori` = quello che c'e' nel
// modulo o nella scheda (per chiave). Torna una riga per campo letto, con
// `uguale` e, dove manca uno dei due, `mancante`.
export function confrontaDocumento(letto, valori) {
  if (!letto || typeof letto !== "object") return [];
  return CAMPI_DOCUMENTO
    .filter((c) => letto[c.chiaveLetto || c.chiave] != null && String(letto[c.chiaveLetto || c.chiave]).trim() !== "")
    .map((c) => {
      const grezzo = letto[c.chiaveLetto || c.chiave];
      const doc = normalizzaValore(grezzo, c.tipo);
      const mod = normalizzaValore(valori?.[c.chiave], c.tipo);
      // il tipo si mostra come lo dice il modulo, non come lo scrive il
      // modello («carta_identita» non si legge)
      const mostrato = c.tipo === "tipodoc" ? (tipoDocumentoDelModulo(grezzo) || String(grezzo).trim()) : String(grezzo).trim();
      return {
        chiave: c.chiave, etichetta: c.etichetta,
        documento: mostrato,
        modulo: valori?.[c.chiave] == null ? "" : String(valori[c.chiave]).trim(),
        mancante: mod === "",
        uguale: mod !== "" && doc === mod,
      };
    });
}

// quante righe non tornano: e' il numero che la scheda mostra al venditore
export function differenzeDocumento(letto, valori) {
  return confrontaDocumento(letto, valori).filter((r) => !r.uguale && !r.mancante);
}

// una data letta in qualunque forma, come la vuole il campo (YYYY-MM-DD)
export function dataIso(valore) {
  const n = normalizzaValore(valore, "data");
  return /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : "";
}

// IL DOCUMENTO SCADUTO NON VALE (25/10/2026). Si guarda la scadenza letta
// dal modello: scaduto = la data e' passata, oggi compreso no. Una data
// che non si capisce non e' «scaduto»: e' «non so», e non ferma nessuno.
export function scadenzaDocumento(letto, oggi = new Date().toISOString().slice(0, 10)) {
  const iso = dataIso(letto?.scadenza);
  if (!iso) return { data: "", scaduto: false };
  return { data: iso, scaduto: iso < oggi };
}
