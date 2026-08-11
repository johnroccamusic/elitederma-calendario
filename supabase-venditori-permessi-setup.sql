-- ---------------------------------------------------------
-- Ogni venditore può avere accesso limitato alle 3 sezioni della propria
-- Dashboard venditori (Performance di vendita/Iscrivi Allievo/Le tue
-- iscrizioni), assegnato in "Password menù" come già succede per gli
-- utenti (TASTI_HOME) e le master. Stesso formato/default di
-- utenti_app.permessi.
-- ---------------------------------------------------------
alter table public.venditori add column if not exists permessi jsonb not null default '[]';

notify pgrst, 'reload schema';
