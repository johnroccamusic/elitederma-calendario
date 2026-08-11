-- ---------------------------------------------------------
-- Password venditori in chiaro, come per gli utenti e le master (non più
-- hash + salt via Edge Function): si scrive e si legge direttamente,
-- niente più funzioni server da pubblicare. Ogni venditore nuovo parte
-- da "0000".
-- ---------------------------------------------------------
alter table public.venditori add column if not exists password text not null default '0000';

notify pgrst, 'reload schema';
