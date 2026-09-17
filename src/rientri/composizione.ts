// Come nasce la lista di cosa parte per un corso.
//
// Nessuna scrittura qui dentro: questa e' solo la proposta che Raffaele si
// trova davanti e corregge. Si tocca il database solo quando lui conferma.
//
// LA REGOLA CHE COMANDA SU TUTTE: una lista gia' compilata o gia' partita
// non si ricalcola. Mai. Se per quell'edizione qualcuno ha gia' scritto
// dei prodotti nella logistica — o peggio, se il pacco e' gia' in viaggio —
// quei prodotti vengono presi come stanno, con le quantita' che hanno, e
// portati dentro come sfusi. Ricomporli dalla prelista di oggi vorrebbe
// dire riscrivere una lista che qualcuno ha gia' controllato a mano, e
// far sparire proprio le aggiunte fatte apposta.

import type { TipoElemento } from "./tipi";

/** Una riga proposta, prima che qualcuno la confermi. */
export interface RigaProposta {
  tipo: TipoElemento;
  kit_id: string | null;
  prodotto_id: string | null;
  quantita_spedita: number;
  /** Da dove viene questa riga: serve a spiegarlo in pagina, perche' una
   *  quantita' ereditata da una lista gia' compilata non si tocca con la
   *  stessa leggerezza di una proposta appena calcolata. */
  fonte: "iscritti" | "prelista" | "lista_esistente" | "riserva_logistica";
}

interface StatoLogistica {
  accessori_quantita?: Record<string, number> | null;
  extra_da_vendita?: Record<string, unknown> | null;
  riserva_per_kit?: Record<string, number> | null;
  dermografi_riserva?: Record<string, number> | null;
  spedizione_snapshot?: unknown;
  fase?: string | null;
}

interface Iscritto {
  id: string;
  corso_data_id: string;
  pacchetto_kit?: string | null;
  kit_id?: string | null;
}

interface KitDefinizione {
  id: string;
  nome: string;
  corso_id: string | null;
}

interface RigaKitProdotto {
  corso_id: string | null;
  kit_id: string | null;
  prodotto_id: string;
  tipo: string;
  quantita: number;
}

/**
 * Vero se per questa edizione c'e' gia' del lavoro fatto a mano che non va
 * toccato: prodotti gia' scritti nella logistica, oppure una fotografia di
 * spedizione gia' scattata, oppure il pacco gia' oltre la preparazione.
 */
export function listaGiaCompilata(stato: StatoLogistica | null | undefined): boolean {
  if (!stato) return false;
  if (stato.spedizione_snapshot) return true;
  if (stato.fase && stato.fase !== "da_preparare") return true;
  const scritti = Object.values(stato.accessori_quantita || {}).filter((q) => Number(q) > 0);
  return scritti.length > 0;
}

/** Il prodotto dentro una chiave di accessori_quantita: le chiavi hanno
 *  forma "accessorio::<id>", "extra::<id>" oppure "<kitId>::<id>". */
function prodottoDaChiave(chiave: string): string | null {
  const pezzi = chiave.split("::");
  return pezzi.length > 1 ? pezzi[pezzi.length - 1] || null : null;
}

/** Quanti kit di ciascun tipo servono agli iscritti: si contano le scelte
 *  vere, mai "kit standard per numero di iscritti". */
export function kitPerGliIscritti(
  iscritti: Iscritto[],
  kitDefinizioni: KitDefinizione[],
  corsoId: string | null,
): Record<string, number> {
  const conteggio: Record<string, number> = {};
  (iscritti || []).forEach((i) => {
    const kit = i.kit_id
      ? kitDefinizioni.find((k) => k.id === i.kit_id)
      : i.pacchetto_kit
        ? kitDefinizioni.find((k) => k.corso_id === corsoId && k.nome === i.pacchetto_kit)
        : null;
    if (kit) conteggio[kit.id] = (conteggio[kit.id] || 0) + 1;
  });
  return conteggio;
}

/**
 * La proposta completa per un'edizione.
 *
 * Gli sfusi hanno due sorgenti alternative, mai sommate:
 *   - lista gia' compilata  -> si eredita quella, prodotto per prodotto
 *   - edizione ancora vuota -> si parte dalla prelista degli accessori
 *                              didattica del corso
 */
export function componiProposta({
  iscritti,
  kitDefinizioni,
  corsiKitProdotti,
  corsoId,
  stato,
}: {
  iscritti: Iscritto[];
  kitDefinizioni: KitDefinizione[];
  corsiKitProdotti: RigaKitProdotto[];
  corsoId: string | null;
  stato: StatoLogistica | null;
}): RigaProposta[] {
  const righe: RigaProposta[] = [];

  // 1. i kit degli allievi, dedotti da cosa hanno scelto
  const perIscritti = kitPerGliIscritti(iscritti, kitDefinizioni, corsoId);
  Object.entries(perIscritti).forEach(([kitId, quantita]) => {
    righe.push({ tipo: "kit_allievo", kit_id: kitId, prodotto_id: null, quantita_spedita: quantita, fonte: "iscritti" });
  });

  // 2. i kit di riserva gia' decisi in logistica, se ce ne sono
  Object.entries(stato?.riserva_per_kit || {}).forEach(([kitId, quantita]) => {
    const q = Number(quantita) || 0;
    if (q > 0) righe.push({ tipo: "kit_riserva", kit_id: kitId, prodotto_id: null, quantita_spedita: q, fonte: "riserva_logistica" });
  });

  // 3. gli sfusi
  const ereditata = listaGiaCompilata(stato);
  if (ereditata) {
    // Si prende quello che c'e', com'e'. Anche gli "extra da vendita":
    // sono partiti nello stesso pacco e vanno riconsegnati o venduti, e
    // per la scheda di rientro sono roba da contare come tutto il resto.
    const perProdotto: Record<string, number> = {};
    Object.entries(stato?.accessori_quantita || {}).forEach(([chiave, q]) => {
      const prodottoId = prodottoDaChiave(chiave);
      const n = Number(q) || 0;
      if (!prodottoId || n <= 0) return;
      perProdotto[prodottoId] = (perProdotto[prodottoId] || 0) + n;
    });
    Object.entries(perProdotto).forEach(([prodottoId, quantita]) => {
      righe.push({ tipo: "sfuso", kit_id: null, prodotto_id: prodottoId, quantita_spedita: quantita, fonte: "lista_esistente" });
    });
  } else {
    // edizione ancora intonsa: si parte dalla prelista del corso, che dice
    // QUALI prodotti, non quanti — le quantita' le mette Raffaele
    (corsiKitProdotti || [])
      .filter((r) => r.tipo === "accessorio" && !r.kit_id && r.corso_id === corsoId)
      .forEach((r) => {
        righe.push({ tipo: "sfuso", kit_id: null, prodotto_id: r.prodotto_id, quantita_spedita: Number(r.quantita) || 0, fonte: "prelista" });
      });
  }

  // 4. i dermografi di riserva gia' decisi in logistica
  Object.entries(stato?.dermografi_riserva || {}).forEach(([chiave, quantita]) => {
    const q = Number(quantita) || 0;
    // qui la chiave e' il modello, non un id prodotto: entra come riga
    // senza prodotto solo se il modello corrisponde a un prodotto vero,
    // altrimenti la si lascia fuori e la si aggiunge a mano (mai inventare
    // un collegamento che non c'e')
    if (q > 0 && chiave) {
      righe.push({ tipo: "dermografo", kit_id: null, prodotto_id: null, quantita_spedita: q, fonte: "riserva_logistica" });
    }
  });

  return righe;
}

/**
 * La distinta di un kit al momento della partenza: e' questa che diventa
 * la foto in kit_riserva_componenti. Si legge adesso e si copia; da qui in
 * poi il kit spedito ha quel contenuto anche se domani la distinta cambia.
 */
export function distintaDelKit(corsiKitProdotti: RigaKitProdotto[], kitId: string): { prodotto_id: string; quantita: number }[] {
  const perProdotto: Record<string, number> = {};
  (corsiKitProdotti || [])
    .filter((r) => r.kit_id === kitId && r.tipo === "kit")
    .forEach((r) => {
      perProdotto[r.prodotto_id] = (perProdotto[r.prodotto_id] || 0) + (Number(r.quantita) || 0);
    });
  return Object.entries(perProdotto).map(([prodotto_id, quantita]) => ({ prodotto_id, quantita }));
}
