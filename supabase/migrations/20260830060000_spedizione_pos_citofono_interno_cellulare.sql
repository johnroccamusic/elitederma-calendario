-- Quello che serve al corriere per consegnare davvero: il nome sul
-- citofono (spesso diverso dal destinatario), l'interno e un numero da
-- chiamare. Senza, il pacco torna indietro e il cliente se la prende con
-- noi.
alter table public.spedizioni_pos
  add column if not exists citofono text,
  add column if not exists interno text,
  add column if not exists cellulare text;
