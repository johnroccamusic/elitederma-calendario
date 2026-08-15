-- ---------------------------------------------------------
-- Assegnazione Master: colonna "Avvisata" (flag verde) tra Master e
-- Note — per ricordarsi di aver avvisato quella persona (master,
-- assistente o leva) del corso, su ogni riga.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists avvisata boolean not null default false;
alter table public.corsi_date_docenti add column if not exists avvisata boolean not null default false;

notify pgrst, 'reload schema';
