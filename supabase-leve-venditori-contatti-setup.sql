-- ---------------------------------------------------------
-- Contatti per Leve, Assistenti e Venditori (Impostazioni > Definisci
-- Leve / Definisci Assistenti / Gestione venditori): telefono ed email
-- raccolti riga per riga, stesso principio già in uso per il telefono
-- dei venditori.
-- ---------------------------------------------------------
alter table public.leva add column if not exists telefono text;
alter table public.leva add column if not exists email text;
alter table public.assistente add column if not exists telefono text;
alter table public.assistente add column if not exists email text;
alter table public.venditori add column if not exists email text;

notify pgrst, 'reload schema';
