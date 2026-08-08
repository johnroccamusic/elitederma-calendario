-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Utenti nominali e permessi (rotellina in home)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Ogni utente ha la propria password e un elenco di "permessi" (le
-- chiavi dei tasti della home che può usare, vedi TASTI_HOME in
-- App.jsx: gestionedate, dashboardvenditori, erp, logisticaprodotti,
-- generazioneloghi, gestionemodelle, statistiche, impostazioni). In
-- home, i tasti non presenti in "permessi" restano disattivati e non
-- cliccabili — niente più richiesta di password al click per loro.
--
-- "chiave_sistema" identifica le 3 righe di sistema della tabella
-- "Gestione utenti" (__user/__admin/__programmatore = Utente
-- generico/Amministratore/Programmatore): sono sempre presenti in home
-- e non eliminabili, a differenza degli utenti nominali (chiave_sistema
-- nulla) creati col tasto "+ Genera nuovo utente".
create table if not exists public.utenti_app (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  password text not null,
  permessi jsonb not null default '[]',
  chiave_sistema text unique,
  ts timestamptz not null default now()
);
alter table public.utenti_app add column if not exists chiave_sistema text unique;

alter table public.utenti_app enable row level security;
drop policy if exists "utenti_app_all" on public.utenti_app;
create policy "utenti_app_all" on public.utenti_app for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
