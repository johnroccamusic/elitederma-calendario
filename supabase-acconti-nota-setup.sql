-- Verifica pagamenti: il venditore ora segnala un pagamento con un file e
-- una nota scritta a mano (non più con importo/metodo strutturati) —
-- tipo/importo/metodo restano in tabella per compatibilità ma non sono
-- più obbligatori. "origine" distingue le due sorgenti che finiscono in
-- Verifica Pagamenti: segnalazione manuale del venditore ("manuale",
-- mostrata come "Verifica acconto/saldo") oppure creata in automatico
-- quando nel modulo di iscrizione si sceglie Bonifico come metodo di
-- pagamento ("bonifico_modulo", mostrata come "Verifica bonifico").
alter table public.acconti_da_verificare add column if not exists nota text;
alter table public.acconti_da_verificare alter column tipo drop not null;
alter table public.acconti_da_verificare alter column importo drop not null;
alter table public.acconti_da_verificare alter column metodo drop not null;
alter table public.acconti_da_verificare add column if not exists origine text not null default 'manuale' check (origine in ('manuale','bonifico_modulo'));

notify pgrst, 'reload schema';
