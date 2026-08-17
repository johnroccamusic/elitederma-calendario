-- ---------------------------------------------------------
-- Location → "Sedi esistenti": nome della sede oltre alla città (i
-- calendari continuano a fare riferimento alla città, non al nome della
-- sede) e "Sede centrale" — una sede di proprietà i cui corsi non hanno
-- mai un Costo Location (nessun affitto da pagare).
-- ---------------------------------------------------------
alter table public.location add column if not exists nome_sede text;
alter table public.location add column if not exists sede_centrale boolean not null default false;

notify pgrst, 'reload schema';
