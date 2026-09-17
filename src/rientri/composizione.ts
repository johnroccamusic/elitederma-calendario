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
  corsiKitProdotti, corsoId, accessoriQuantita, dataInizio, oggi,
}: {
  corsiKitProdotti: RigaKitProdotto[];
  corsoId: string | null;
  accessoriQuantita: Record<string, unknown> | null | undefined;
  dataInizio: string | null | undefined;
  oggi: string;
}): RigaKitProdotto[] {
  const delCorso = (corsiKitProdotti || []).filter(
    (r) => r.tipo === "accessorio" && !r.kit_id && r.corso_id === (corsoId || null),
  );
  // un corso che comincia oggi e' gia' in essere: il pacco e' partito
  const giaIniziato = !!dataInizio && dataInizio <= oggi;
  if (!giaIniziato) return delCorso;
  const scritte = accessoriQuantita || {};
  return delCorso.filter((r) => scritte[`accessorio::${r.prodotto_id}`] != null);
}
