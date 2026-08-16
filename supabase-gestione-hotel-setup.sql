-- ---------------------------------------------------------
-- Gestione Hotel diventa una pagina completa (prima solo nome, in un
-- modale): ogni hotel prevede telefono, email, indirizzo, civico,
-- città, costo a notte cash e costo a notte fattura. Se un hotel è
-- associato a un'edizione (Assegnazione Master, campo Alloggio), i
-- suoi dati compaiono nella Dashboard Master sotto al relativo corso.
-- ---------------------------------------------------------
alter table public.hotel add column if not exists telefono text;
alter table public.hotel add column if not exists email text;
alter table public.hotel add column if not exists indirizzo text;
alter table public.hotel add column if not exists civico text;
alter table public.hotel add column if not exists citta text;
alter table public.hotel add column if not exists costo_notte_cash numeric;
alter table public.hotel add column if not exists costo_notte_fattura numeric;

notify pgrst, 'reload schema';
