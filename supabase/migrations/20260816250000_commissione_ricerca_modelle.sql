-- ---------------------------------------------------------
-- Riepilogo amministrativo: quando una classe incassa quote modelle,
-- il 50% va riportato come costo "Commissione ricerca modelle"
-- (pagato in cash di default). Split libero Bonifico/Cash come le
-- altre righe automatiche della tabella spese.
-- ---------------------------------------------------------
insert into public.costi_sottocategorie (id, categoria_id, nome, ordine, automatico, campo_automatico) values
  ('commerciale__commissione_ricerca_modelle', 'commerciale', 'Commissione ricerca modelle', 4, false, null)
on conflict (id) do nothing;

alter table public.corsi_date add column if not exists commissione_modelle_bonifico numeric;
alter table public.corsi_date add column if not exists commissione_modelle_cash numeric;

notify pgrst, 'reload schema';
