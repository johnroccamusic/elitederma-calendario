-- La stessa persona puo' essere venditore E dipendente: in Anagrafiche
-- deve comparire una volta sola, con tutti i suoi ruoli.
--
-- Il raggruppamento per nome qui non basta e non si puo' forzare
-- rinominando: gli iscritti sono agganciati al venditore per NOME
-- (iscritti.tutor confrontato con venditori.nome), e cambiargli il nome
-- gli farebbe sparire le iscrizioni dalla scheda. Serve un collegamento
-- esplicito, lo stesso che l'app usa gia' per master->venditore e
-- hotel/location->fornitore.
--
-- Colonna nuova nullable: chi non la valorizza continua come prima.
alter table venditori add column if not exists fornitore_id uuid references fornitori(id);
comment on column venditori.fornitore_id is
  'Il soggetto (fornitore o dipendente) che e'' la stessa persona di questo venditore: in Anagrafiche le due righe diventano una sola. Il nome del venditore NON si tocca, perche'' gli iscritti ci sono agganciati per nome.';
create index if not exists idx_venditori_fornitore on venditori(fornitore_id) where fornitore_id is not null;
