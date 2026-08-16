-- ---------------------------------------------------------
-- Assegnazione Master: la casella "Richiesta fattura" diventa
-- "Bonifico Fattura" (stessa colonna, solo etichetta), e accanto una
-- nuova colonna "Pago Cash" — le due modalità di pagamento della
-- master/docente per quella data.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists paga_cash boolean not null default false;
alter table public.corsi_date_docenti add column if not exists paga_cash boolean not null default false;

notify pgrst, 'reload schema';
