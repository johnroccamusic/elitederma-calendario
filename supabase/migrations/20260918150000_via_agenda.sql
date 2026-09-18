-- Via l'Agenda: la funzione, le sue tre tabelle e i permessi per entrarci.
--
-- I permessi delle agende non erano una colonna: erano voci dentro
-- l'array permessi di ogni utente, una per agenda creata ("agenda_<id>").
-- Restare li' dopo che la funzione non esiste piu' significherebbe
-- lasciare in giro chiavi di una porta murata: si tolgono dall'array,
-- lasciando intatti tutti gli altri permessi.
--
-- Erano quattro utenti nominali e una master. Nelle tabelle c'erano due
-- agende e due voci: niente di sostanziale.
update utenti_app
set permessi = (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(permessi) p where p::text not like '"agenda_%')
where permessi::text like '%agenda_%';

update master
set permessi = (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(permessi) p where p::text not like '"agenda_%')
where permessi::text like '%agenda_%';

update venditori
set permessi = (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(permessi) p where p::text not like '"agenda_%')
where permessi::text like '%agenda_%';

drop table if exists agenda_note_settimanali;
drop table if exists agenda_voci;
drop table if exists agende;
