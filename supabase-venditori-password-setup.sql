-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Password venditori (per un futuro login)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- MAI la password in chiaro: solo hash + salt, scritti esclusivamente
-- dalla Edge Function "venditori-imposta-password" (che usa la service
-- role key). L'app non seleziona mai queste due colonne nel caricamento
-- dati generale, così non finiscono nel browser di chi usa l'app.
alter table public.venditori add column if not exists password_hash text;
alter table public.venditori add column if not exists password_salt text;

notify pgrst, 'reload schema';
