-- ---------------------------------------------------------
-- "Gestione compensi": non una struttura nominata da collegare ai
-- corsi, ma un compenso di default diretto su ciascun corso (fasce
-- Da/a allievi → Compenso €). Quando un corso viene associato a un
-- master (Gestione Master → Corsi associati), queste fasce vengono
-- copiate come punto di partenza — una copia una tantum, non un
-- collegamento live: modificarle dopo per un master non tocca il
-- default del corso né gli altri master già associati.
--
-- Tolta l'impalcatura di un tentativo precedente (tabella
-- "strutture_compensi" nominata, mai popolata) se presente.
-- ---------------------------------------------------------
alter table public.corsi drop column if exists struttura_compensi_id;
drop table if exists public.strutture_compensi;
alter table public.corsi add column if not exists fasce_compenso_default jsonb not null default '[]';

notify pgrst, 'reload schema';
