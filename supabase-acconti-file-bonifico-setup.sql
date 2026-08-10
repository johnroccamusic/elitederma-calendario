-- Verifica acconti: quando il venditore segnala un pagamento fatto con
-- bonifico, può allegare la ricevuta per la verifica dello staff.
alter table public.acconti_da_verificare add column if not exists file_path text;

notify pgrst, 'reload schema';
