-- Corsi in sede: un passo in piu' prima della consegna.
--
-- "Corso allestito" voleva dire due cose insieme — il materiale e' pronto
-- e il materiale e' in aula — e in mezzo ci sono ore in cui il pacco
-- esiste ma non e' ancora uscito dal magazzino. Ora sono due passaggi:
-- "Materiale preparato", che e' solo una spunta di chi prepara le scatole
-- e non muove niente, e "Materiale consegnato", che resta il momento in
-- cui i pezzi lasciano davvero lo scaffale.
--
-- allestito_ts non cambia significato ne' nome: continua a marcare la
-- consegna e a portarsi dietro lo scarico. Cosi' le edizioni gia' chiuse
-- restano esattamente come sono.
alter table public.logistica_kit_edizioni
  add column if not exists materiale_preparato_ts timestamptz;

comment on column public.logistica_kit_edizioni.materiale_preparato_ts is
  'Corsi in sede: il materiale e'' stato preparato. Passo prima della consegna, non muove il magazzino.';
comment on column public.logistica_kit_edizioni.allestito_ts is
  'Corsi in sede: il materiale e'' stato consegnato in aula. E'' qui che i prodotti escono dal magazzino.';
