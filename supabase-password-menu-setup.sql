-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Password per voce di menù (rotellina in home)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Una riga per ogni voce protetta della home (es. "gestionedate", "erp",
-- "generazioneloghi", "gestionemodelle", "statistiche", "impostazioni").
-- Password in chiaro: stesso livello di sicurezza già in uso per
-- ADMIN_CODE (confrontato lato client), pensata solo per tenere lontani
-- gli utenti non autorizzati dal menù, non come barriera a prova di
-- tecnico esperto. Se una voce non ha password impostata (stringa vuota),
-- resta valido il codice amministratore generale.
create table if not exists public.password_menu (
  vista text primary key,
  password text not null default ''
);

alter table public.password_menu enable row level security;
drop policy if exists "password_menu_all" on public.password_menu;
create policy "password_menu_all" on public.password_menu for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
