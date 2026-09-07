-- Un progetto puo' essere di due persone insieme: "assegnato a" era una
-- casella sola, quindi la seconda non aveva dove stare e finiva scritta
-- nelle note, dove nessun filtro la trova.
--
-- Le colonne incaricato_* restano al loro posto, senza che nessuno le
-- scriva piu': cancellarle non farebbe funzionare niente di meglio e
-- toglierebbe la traccia di com'erano assegnati i progetti di prima.
alter table public.progetti add column if not exists incaricati jsonb not null default '[]'::jsonb;

update public.progetti
set incaricati = jsonb_build_array(jsonb_build_object(
  'id', incaricato_id::text, 'nome', incaricato_nome, 'tipo', coalesce(incaricato_tipo, 'utente')))
where incaricato_id is not null and jsonb_array_length(incaricati) = 0;

comment on column public.progetti.incaricati is
  'Le persone assegnate al progetto: [{id, nome, tipo}]. Più di una perché un progetto può essere di due persone insieme.';
