-- Campi contatto per lo storico allievi: vuoti ora, popolati in un secondo
-- momento (import telefono/email o compilazione manuale dalla scheda).
alter table public.storico_allievi
  add column telefono text,
  add column email text;
