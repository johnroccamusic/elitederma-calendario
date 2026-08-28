-- ---------------------------------------------------------
-- Quanti dermografi sono già stati scaricati per un'edizione.
--
-- Stessa idea di scarico_per_kit: si registra quanto è già uscito dal
-- magazzino, così una risincronizzazione muove solo la differenza e un
-- allievo che cambia idea (o si iscrive dopo) non fa mai scaricare due
-- volte lo stesso pezzo. Forma: { "tekna": 3, "horus": 1 }.
-- ---------------------------------------------------------

alter table public.logistica_kit_edizioni
  add column if not exists scarico_dermografi jsonb not null default '{}'::jsonb;

comment on column public.logistica_kit_edizioni.scarico_dermografi is
  'Dermografi già scaricati per questa edizione, per modello: { tekna: n, horus: n }.';

notify pgrst, 'reload schema';
