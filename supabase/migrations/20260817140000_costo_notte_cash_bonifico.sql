-- ---------------------------------------------------------
-- "Gestisci alloggio": il pattuito a notte diventa due campi affiancati,
-- Cash e Bonifico, invece di uno solo che cambiava significato secondo la
-- tendina "Tipo di pagamento" — così si tengono entrambe le tariffe
-- negoziate con l'hotel senza doverle riscrivere ogni volta che si cambia
-- tipo di pagamento.
-- ---------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_date' and column_name = 'pattuito_a_notte'
  ) then
    alter table public.corsi_date rename column pattuito_a_notte to pattuito_a_notte_cash;
  end if;
end $$;
alter table public.corsi_date add column if not exists pattuito_a_notte_cash numeric;
alter table public.corsi_date add column if not exists pattuito_a_notte_bonifico numeric;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_date_docenti' and column_name = 'pattuito_a_notte'
  ) then
    alter table public.corsi_date_docenti rename column pattuito_a_notte to pattuito_a_notte_cash;
  end if;
end $$;
alter table public.corsi_date_docenti add column if not exists pattuito_a_notte_cash numeric;
alter table public.corsi_date_docenti add column if not exists pattuito_a_notte_bonifico numeric;

notify pgrst, 'reload schema';
