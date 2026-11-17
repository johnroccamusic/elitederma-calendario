// Come nasce la lista di cosa parte per un corso.
//
// Nessuna scrittura qui dentro: sono le due regole che decidono cosa
// finisce nel pacco, e le usa la scheda di Logistica corsi — non esiste
// una pagina di spedizioni del modulo, sarebbe stata un doppione.
interface RigaKitProdotto {
  corso_id: string | null;
  kit_id: string | null;
  prodotto_id: string;
  tipo: string;
  quantita: number;
  // «quantita» pezzi ogni N allievi; vuoto = quantita fissa per corso
  ogni_allievi?: number | null;
}

/**
 * Quanti pezzi di un accessorio didattica partono per una classe.
 *
 * Una riga puo' dire due cose (17/11/2026, chiesto dal titolare: «1
 * specchio ogni 4 allievi; se ci sono 5 allievi, al quinto saranno 2
 * specchi da inviare»):
 *
 *   - senza «ogni N allievi»  -> «quantita» pezzi per corso, fissi,
 *     com'e' sempre stato (un microscopio, una forbicina);
 *   - con «ogni N allievi»    -> «quantita» pezzi per ogni gruppo di N
 *     allievi, e un gruppo cominciato conta intero: 5 allievi, uno
 *     specchio ogni 4 -> 2 specchi. Arrotondare in giu' vorrebbe dire
 *     un'allieva senza specchio.
 *
 * Se gli allievi non si sanno (null) vale la quantita' scritta: meglio
 * il numero della scheda che uno zero inventato. Con zero allievi
 * invece il conto e' zero davvero — una classe vuota non riceve niente.
 */
export function quantitaAccessorio(
  riga: { quantita?: number | null; ogni_allievi?: number | null },
  allievi: number | null | undefined,
): number {
  const pezzi = Math.max(0, Number(riga?.quantita) || 0);
  const ogni = Math.floor(Number(riga?.ogni_allievi) || 0);
  if (!(ogni > 0) || allievi == null) return pezzi;
  const n = Math.max(0, Math.floor(Number(allievi) || 0));
  return pezzi * Math.ceil(n / ogni);
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

/**
 * Quali accessori didattica elencare nella scheda di logistica di
 * un'edizione.
 *
 * La regola, e vale per entrambi i posti che la usano:
 *
 *   - edizione ancora da venire  -> tutta la lista del corso, com'e' oggi.
 *     Raffaele scrive quanti pezzi ne manda.
 *   - corso passato o in essere  -> SOLO le righe che qualcuno aveva gia'
 *     scritto per quell'edizione. Niente di nuovo compare a posteriori.
 *   - corso senza lista          -> non si elenca niente, e il blocco non
 *     compare proprio.
 *
 * Il secondo caso e' il motivo per cui questa funzione esiste. La lista
 * degli accessori si legge dal vivo dalle impostazioni del corso: senza
 * questo filtro, aggiungere domani un accessorio a MICRO BASE lo farebbe
 * comparire nelle schede di ventisei edizioni gia' fatte, e la master si
 * troverebbe a dover render conto di roba che non ha mai avuto in aula.
 */
export function accessoriDaElencare({
  corsiKitProdotti, corsoId, accessoriQuantita, dataInizio, oggi, allievi = null,
}: {
  corsiKitProdotti: RigaKitProdotto[];
  corsoId: string | null;
  accessoriQuantita: Record<string, unknown> | null | undefined;
  dataInizio: string | null | undefined;
  oggi: string;
  // gli allievi della classe: chi li passa riceve in «quantita» i pezzi
  // gia' calcolati per quella classe (vedi quantitaAccessorio), e in
  // «quantita_scheda» il numero scritto sulla scheda del corso
  allievi?: number | null;
}): (RigaKitProdotto & { quantita_scheda?: number })[] {
  const delCorso = (corsiKitProdotti || [])
    .filter((r) => r.tipo === "accessorio" && !r.kit_id && r.corso_id === (corsoId || null))
    .map((r) => (allievi == null ? r : { ...r, quantita_scheda: r.quantita, quantita: quantitaAccessorio(r, allievi) }));
  // un corso che comincia oggi e' gia' in essere: il pacco e' partito
  const giaIniziato = !!dataInizio && dataInizio <= oggi;
  if (!giaIniziato) return delCorso;
  const scritte = accessoriQuantita || {};
  return delCorso.filter((r) => scritte[`accessorio::${r.prodotto_id}`] != null);
}
