-- Un pagamento "Integrazione" può essere contabilizzato in più volte (una
-- quota alla volta, anche da schede/corsi diversi quando è associato a più
-- corsi): "importo_residuo" tiene il totale ancora da contabilizzare —
-- parte dall'importo segnalato e scende a ogni "Contabilizza" parziale; la
-- segnalazione diventa "approvato" solo quando arriva a zero.
alter table public.acconti_da_verificare add column if not exists importo_residuo numeric;

notify pgrst, 'reload schema';
