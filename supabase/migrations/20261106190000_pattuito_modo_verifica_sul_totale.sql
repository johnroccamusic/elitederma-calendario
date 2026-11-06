-- IL TERZO MODO DI PATTUIRE: «VERIFICA SUL TOTALE» (6/11/2026).
--
-- Chiesto dal titolare: nella scheda di iscrizione, accanto a «netto
-- senza IVA» e «finale IVA inclusa», una terza scelta — il totale si
-- copre per intero, e qualsiasi somma pagata con qualsiasi metodo somma
-- fino a raggiungerlo.
--
-- Fino a oggi quella regola stava SOLO sul corso
-- (`corsi.saldo_su_totale_pagato`, l'hennè), quindi per applicarla a una
-- singola iscrizione bisognava cambiare l'impostazione di tutto il
-- corso. Da adesso la puo' dire anche la singola scheda.
--
-- PERCHE' SERVE UNA MIGRAZIONE per quello che sembra solo un bottone in
-- piu': la colonna ha un CHECK che ammette due soli valori. Senza
-- allargarlo, PostgREST rifiuterebbe l'INTERA scrittura della scheda —
-- non il solo campo — e il venditore vedrebbe fallire un salvataggio
-- senza capire quale casella l'abbia fatto fallire (e' lo stesso guasto
-- del 18/10 sulle spedizioni POS, «colonna mancante = scrittura
-- rifiutata»).
--
-- Non tocca nessuna riga: i 189 null, gli 87 'netto' e i 2 'lordo'
-- restano esattamente come sono, e il vincolo nuovo li ammette tutti.
--
-- Rollback (solo se nessuna scheda ha gia' scelto 'totale'):
--   alter table public.iscritti drop constraint iscritti_totale_pattuito_modo_check;
--   alter table public.iscritti add constraint iscritti_totale_pattuito_modo_check
--     check (totale_pattuito_modo is null or totale_pattuito_modo = any (array['netto','lordo']));

alter table public.iscritti drop constraint if exists iscritti_totale_pattuito_modo_check;

alter table public.iscritti add constraint iscritti_totale_pattuito_modo_check
  check (totale_pattuito_modo is null or totale_pattuito_modo = any (array['netto', 'lordo', 'totale']));

comment on column public.iscritti.totale_pattuito_modo is
  'Come e'' stato pattuito il totale di questa iscrizione: ''netto'' (senza IVA), ''lordo'' (IVA inclusa) o ''totale'' (si copre per intero: ogni quota incassata si sottrae per quello che e'' entrato, qualunque sia il metodo). Non converte nessun importo: totale_pattuito resta il numero digitato.';
