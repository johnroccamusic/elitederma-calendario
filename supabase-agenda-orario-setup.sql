-- Agenda: orario dell'evento (facoltativo), per poterli ordinare nelle
-- carte dell'agenda e mostrarli nella vista giorno espansa.
alter table public.agenda_voci add column if not exists orario time;

notify pgrst, 'reload schema';
